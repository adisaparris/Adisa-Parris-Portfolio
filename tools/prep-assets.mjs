/**
 * prep-assets.mjs - dev-time asset pipeline. NOT shipped to the browser.
 *
 *   node tools/prep-assets.mjs --src "../Immersive Website Test"
 *
 * Source artwork is 12-23 MB PNGs and a handful of PDFs. This turns them into
 * responsive WebP sets, a JPEG fallback for the portrait, base64 LQIP
 * placeholders, and the centreline-traced doodle SVG.
 *
 * Outputs (all git-committed, so a clean checkout deploys without running this):
 *   assets/img/<name>-<width>.webp
 *   assets/img/portrait-1600.jpg
 *   assets/svg/doodle-line.svg
 *   css/lqip.css          - base64 20px blur placeholders as custom properties
 *   assets/manifest.json  - intrinsic dimensions, for width/height attributes
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import { traceDoodle } from './trace-doodle.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
  })
);

const SRC = path.resolve(
  ROOT,
  args.get('src') || '../../CLAUDE/Immersive Website Test'
);
const IMG_OUT = path.join(ROOT, 'assets', 'img');
const SVG_OUT = path.join(ROOT, 'assets', 'svg');

const MEDIA = 'Adisa Parris - Portfolio Media (Spring 2026)';
const SELF = 'Adisa Parris - Self Photos';

const QUALITY = 82;

/* ------------------------------------------------------------------------ *
 * Asset table
 *
 * trim     - crop surrounding transparent/white margin (logo marks)
 * flatten  - composite onto a solid colour instead of keeping alpha
 * widths   - emitted sizes; never upscaled past the source's own resolution
 * ------------------------------------------------------------------------ */

const ASSETS = [
  // --- 01 Maggio's ---
  {
    name: 'maggios-oven',
    src: `${MEDIA}/Maggio's - Business Card/Maggio's BC - Front - Oven Graphic.pdf`,
    widths: [480, 960, 1600],
  },
  {
    name: 'maggios-cards',
    src: `${MEDIA}/Maggio's - Business Card/Maggio's Business Card Mockup (WoodBackground)_.png`,
    widths: [480, 960, 1600],
  },
  {
    name: 'maggios-loyalty',
    src: `${MEDIA}/Maggio's Loyalty Card/Maggio's - Loyalty Card.png`,
    widths: [480, 960],
  },
  {
    name: 'maggios-poster',
    src: `${MEDIA}/maggio's anniversary poster.pdf`,
    widths: [480, 960, 1600],
  },
  {
    name: 'maggios-cert',
    src: `${MEDIA}/Maggio's Loyalty Card/Maggio's Pizza Cert.pdf`,
    widths: [480, 960, 1600],
    flatten: '#ffffff',
  },

  // --- 02 Saltwater ---
  {
    name: 'saltwater-badge',
    src: `${MEDIA}/Saltwater Condos (Portfolio Piece)/Saltwater Condos Full Background.pdf`,
    widths: [480, 960, 1600],
    flatten: '#000000',
  },
  {
    name: 'saltwater-ridged',
    src: `${MEDIA}/Saltwater Condos (Portfolio Piece)/Saltwater Condos Ridged Edge.pdf`,
    widths: [480, 960],
    trim: true,
  },
  {
    name: 'saltwater-cards',
    src: `${MEDIA}/Saltwater Condos (Portfolio Piece)/Saltwater Condos Business Card MockUp.png`,
    widths: [480, 960, 1600],
  },

  // --- 03 Typography ---
  {
    name: 'typography-poster',
    src: `${MEDIA}/typography poster.pdf`,
    widths: [480, 960, 1600, 2400],
  },

  // --- 04 / 05 marks ---
  {
    name: 'petwell-logo',
    src: `${MEDIA}/PetWell Logo.png`,
    widths: [480, 960],
    trim: true,
  },
  {
    name: 'travelbird-logo',
    src: `${MEDIA}/travel bird logo.pdf`,
    widths: [480, 960],
    trim: true,
  },

  // --- 06 Field studies ---
  {
    name: 'sunflowers',
    src: `${MEDIA}/super plant drawing.png`,
    widths: [480, 960],
    trim: true,
    // Watercolour grain on an alpha channel is expensive; 82 costs 3x for
    // texture nobody sees at card size.
    quality: 68,
  },

  // --- portrait ---
  {
    // 2400 is dropped deliberately: the photo is dark, grainy and never shown
    // wider than a column, and its 2400 WebP alone was 1.1 MB against a 2.5 MB
    // page budget.
    name: 'portrait',
    src: `${SELF}/Adisa Side Profile.JPEG`,
    widths: [480, 960, 1600],
    quality: 70,
    fallback: { width: 1280, quality: 74 },
  },
];

/* ------------------------------------------------------------------------ */

const PDF_LONG_EDGE = 2400; // §4: rasterise PDFs at 2000px+ on the long edge

function rasterisePdf(file) {
  const doc = mupdf.Document.openDocument(fs.readFileSync(file), 'application/pdf');
  const page = doc.loadPage(0);
  const b = page.getBounds();
  const w = b[2] - b[0];
  const h = b[3] - b[1];
  const scale = PDF_LONG_EDGE / Math.max(w, h);
  const pix = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB,
    /* alpha */ true,
    /* showExtras */ true
  );
  return Buffer.from(pix.asPNG());
}

async function loadSource(spec) {
  const file = path.join(SRC, spec.src);
  if (!fs.existsSync(file)) throw new Error('missing source: ' + spec.src);
  const input = path.extname(file).toLowerCase() === '.pdf' ? rasterisePdf(file) : file;

  let pipeline = sharp(input, { limitInputPixels: 512 * 1024 * 1024 });
  if (spec.trim) pipeline = pipeline.trim({ threshold: 12 });
  if (spec.flatten) pipeline = pipeline.flatten({ background: spec.flatten });

  const buf = await pipeline.png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, meta };
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

async function build() {
  fs.mkdirSync(IMG_OUT, { recursive: true });
  fs.mkdirSync(SVG_OUT, { recursive: true });

  const manifest = {};
  const lqip = {};
  const report = [];
  let largest = { name: '', bytes: 0 };

  for (const spec of ASSETS) {
    const { buf, meta } = await loadSource(spec);

    // Never upscale: a 512px source gets a 512px "960".
    const widths = [...new Set(spec.widths.map((w) => Math.min(w, meta.width)))]
      .sort((a, b) => a - b);

    const emitted = [];
    for (const w of widths) {
      const out = path.join(IMG_OUT, `${spec.name}-${w}.webp`);
      await sharp(buf)
        .resize({ width: w, kernel: 'lanczos3' })
        .webp({ quality: spec.quality ?? QUALITY, alphaQuality: 90, effort: 6 })
        .toFile(out);

      const bytes = fs.statSync(out).size;
      if (bytes > largest.bytes) largest = { name: path.basename(out), bytes };
      emitted.push({ w, bytes });
    }

    if (spec.fallback) {
      const out = path.join(IMG_OUT, `${spec.name}-${spec.fallback.width}.jpg`);
      await sharp(buf)
        .resize({ width: Math.min(spec.fallback.width, meta.width), kernel: 'lanczos3' })
        .flatten({ background: '#0B0E0F' })
        .jpeg({ quality: spec.fallback.quality, mozjpeg: true })
        .toFile(out);
      const bytes = fs.statSync(out).size;
      if (bytes > largest.bytes) largest = { name: path.basename(out), bytes };
      emitted.push({ w: spec.fallback.width, bytes, jpg: true });
    }

    // 20px blurred placeholder, inlined as a CSS custom property.
    const tiny = await sharp(buf)
      .resize({ width: 20 })
      .blur(1.2)
      .webp({ quality: 45, alphaQuality: 60 })
      .toBuffer();
    lqip[spec.name] = 'data:image/webp;base64,' + tiny.toString('base64');

    manifest[spec.name] = {
      width: meta.width,
      height: meta.height,
      ratio: +(meta.width / meta.height).toFixed(4),
      widths,
      lqipBytes: tiny.length,
    };

    report.push({ name: spec.name, meta, emitted, tiny: tiny.length });
  }

  /* --- doodle --------------------------------------------------------- */

  const doodleSrc = path.join(SRC, `${MEDIA}/Doodle Adisa.png`);
  const { svg, stats } = await traceDoodle(doodleSrc);
  const svgPath = path.join(SVG_OUT, 'doodle-line.svg');
  fs.writeFileSync(svgPath, svg);

  // The path is inlined in index.html (once, in <defs>, referenced three times
  // by <use>) so the preloader can draw it without waiting on a fetch. Keep the
  // two in sync from here rather than by hand.
  const indexPath = path.join(ROOT, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const d = svg.match(/<path d="([^"]*)"/)[1];
    const block = `<!-- doodle:start -->\n    <path id="doodle-path" d="${d}"/>\n    <!-- doodle:end -->`;
    const next = html.replace(
      /<!-- doodle:start -->[\s\S]*?<!-- doodle:end -->/,
      block
    );
    if (next === html) {
      console.warn('\nWARN index.html has no doodle:start/doodle:end markers - path not injected');
    } else {
      fs.writeFileSync(indexPath, next);
    }
  }

  // The favicon is NOT the portrait. The traced drawing is 84 strokes of
  // hairline - lovely at 400px, an unreadable coral smudge at the 16px a
  // browser tab actually renders. So the icon is an A drawn in the same
  // language: one stroked path, round caps, coral on ink.
  //
  // The ground is a real <rect> rather than a CSS background, because the
  // icon pipeline does not reliably apply a style attribute on the root svg.
  fs.writeFileSync(
    path.join(SVG_OUT, 'favicon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect width="100" height="100" fill="#0B0E0F"/>' +
      '<path d="M26 79L50 23L74 79M35 62H65" fill="none" stroke="#E27D6D"' +
      ' stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
  );

  // Apple wants a PNG, and it must not be a client's logo.
  await sharp(fs.readFileSync(path.join(SVG_OUT, 'favicon.svg')))
    .resize(180, 180)
    .png()
    .toFile(path.join(IMG_OUT, 'apple-touch-icon.png'));

  // Phase 0 acceptance: "renders correctly at 400px wide". Rasterise it so that
  // can actually be looked at rather than assumed.
  if (args.get('verify')) {
    const dir = path.join(HERE, '.verify');
    fs.mkdirSync(dir, { recursive: true });
    await sharp(Buffer.from(svg.replace('stroke="currentColor"', 'stroke="#0B0E0F"')))
      .resize({ width: 400 })
      .flatten({ background: '#FBF1D9' })
      .png()
      .toFile(path.join(dir, 'doodle-400.png'));
    console.log('\nverify: tools/.verify/doodle-400.png');
  }
  manifest['doodle-line'] = {
    viewBox: stats.viewBox,
    approxLength: stats.approxLength,
    strokes: stats.strokes,
  };

  /* --- generated files ------------------------------------------------ */

  const lqipCss =
    '/* Generated by tools/prep-assets.mjs - do not edit by hand. */\n' +
    ':root {\n' +
    Object.entries(lqip).map(([k, v]) => `  --lqip-${k}: url("${v}");`).join('\n') +
    '\n}\n';
  fs.writeFileSync(path.join(ROOT, 'css', 'lqip.css'), lqipCss);
  fs.writeFileSync(
    path.join(ROOT, 'assets', 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );

  /* --- report --------------------------------------------------------- */

  console.log('\nsource                     intrinsic     emitted');
  console.log('-'.repeat(78));
  for (const r of report) {
    const sizes = r.emitted
      .map((e) => `${e.w}${e.jpg ? 'jpg' : ''}:${kb(e.bytes)}`)
      .join('  ');
    console.log(
      r.name.padEnd(26) +
        `${r.meta.width}x${r.meta.height}`.padEnd(14) +
        sizes
    );
  }

  const totalLqip = Object.values(lqip).reduce((n, v) => n + v.length, 0);
  console.log('-'.repeat(78));
  console.log('doodle-line.svg   ' + kb(stats.bytes) + '  ' + stats.strokes +
    ' strokes, ' + stats.points + ' pts, length ~' + stats.approxLength +
    ' units, viewBox ' + stats.viewBox);
  console.log('lqip.css          ' + kb(lqipCss.length) + '  (' + Object.keys(lqip).length +
    ' placeholders, ' + kb(totalLqip) + ' of base64)');
  console.log('largest single    ' + largest.name + '  ' + kb(largest.bytes));
  console.log('assets/img total  ' + kb(
    fs.readdirSync(IMG_OUT).reduce((n, f) => n + fs.statSync(path.join(IMG_OUT, f)).size, 0)
  ));

  // Phase 0 budgets, enforced here rather than by eye.
  const problems = [];
  if (largest.bytes > 300 * 1024) {
    problems.push(`largest asset ${largest.name} is ${kb(largest.bytes)} (budget 300 KB)`);
  }
  if (stats.bytes > 12 * 1024) {
    problems.push(`doodle-line.svg is ${kb(stats.bytes)} (budget 12 KB)`);
  }
  console.log(problems.length
    ? '\nFAIL\n  ' + problems.join('\n  ') + '\n'
    : '\nOK  all Phase 0 budgets met\n');
  if (problems.length) process.exitCode = 1;
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
