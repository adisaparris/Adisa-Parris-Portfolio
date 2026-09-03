# Adisa Parris — Portfolio

A single-page, scroll-driven portfolio site. Static HTML, CSS and ES modules —
no build step, no framework, no bundler. Libraries come from CDN, pinned.

Built to `BUILD-BRIEF.md`.

---

## Run it locally

ES modules do not load over `file://`, so it needs a static server:

```bash
npx serve .
```

or

```bash
python3 -m http.server 8000
```

Then open the printed URL. That is the whole setup — there is nothing to install
and nothing to compile.

## Deploy

The repository root *is* the site. Both of these work with no configuration:

- **GitHub Pages** — Settings → Pages → deploy from `main`, folder `/ (root)`.
- **Netlify** — drag the folder onto the Netlify drop zone, or connect the repo
  and leave the build command empty with the publish directory set to `/`.

If you deploy somewhere other than `https://adisaparris.github.io/Adisa-Parris-Portfolio/`,
update the `og:image` and `canonical` URLs in `index.html` — Open Graph needs
absolute URLs.

---

## Re-running the asset pipeline

`assets/` is committed, so a clean checkout deploys without ever running this.
You only need it when the source artwork changes.

```bash
cd tools
npm install
node prep-assets.mjs --src "../../CLAUDE/Immersive Website Test" --verify
```

Point `--src` at the folder holding `Adisa Parris - Portfolio Media (Spring 2026)/`
and `Adisa Parris - Self Photos/`.

It writes:

| Output | What it is |
|---|---|
| `assets/img/*.webp` | responsive sets at 480 / 960 / 1600 (/1920) |
| `assets/img/portrait-1280.jpg` | the one JPEG fallback |
| `assets/svg/doodle-line.svg` | centreline trace of the self-portrait |
| `assets/svg/favicon.svg` | the same line, cropped to the head |
| `assets/manifest.json` | intrinsic dimensions, for `width`/`height` attributes |
| `css/lqip.css` | 20px blurred placeholders as base64 custom properties |
| `index.html` | the doodle path, injected between the `doodle:` markers |

The script asserts its own budgets — largest single asset under 300 KB, doodle
SVG under 12 KB — and exits non-zero if either regresses.

`--verify` additionally writes `tools/.verify/doodle-400.png` so the trace can be
eyeballed at the size it actually renders.

`tools/node_modules` is gitignored; delete it when you are done.

### Why the tracer is hand-rolled

Potrace and friends produce *outlines* — filled shapes around a stroke. The site
needs the opposite: the centre of the pen stroke, as one stroked `<path>`, so
`stroke-dasharray` / `stroke-dashoffset` can draw it on.

`tools/trace-doodle.mjs` does threshold → Zhang-Suen thinning → skeleton walk →
Ramer-Douglas-Peucker → nearest-neighbour stroke ordering → relative smooth
cubics. The one non-obvious part: junctions are classified by **crossing number**
(0→1 transitions around the 8-ring), not by counting neighbours. A pixel on a
diagonal staircase has three neighbours but is not a fork — counting neighbours
reports 1711 junctions on this drawing and shatters it into 2779 fragments;
crossing number reports 58 and gives 84 clean strokes.

The result is one `<path>` with 84 subpaths. `getTotalLength()` spans all of
them, so a single dashoffset tween draws the whole portrait in sequence,
pen-lifts and all.

---

## Structure

```
index.html            all seven sections
css/
  main.css            @imports the rest, in order
  reset.css
  tokens.css          palette, type scale, spacing, motion
  lqip.css            GENERATED - do not edit
  layout.css          section shells, grid, left rail
  components.css      cards, marquee, cursor, accordion
js/
  main.js             entry point, init order
  accordion.js        case-study expansion
assets/               GENERATED - see above
tools/                dev-time only, never shipped to the browser
```

## Measured

Taken in Chrome at 1280x860 against the local server. Re-check after any change
that adds images or libraries.

| | Measured | Budget |
|---|---|---|
| First load | 217 KB | — |
| Full scroll-through (every image) | 785 KB | 2.5 MB |
| Cumulative layout shift | 0.0001 | < 0.05 |
| Largest single asset | 233 KB | 300 KB |
| Images missing `alt` / `width` / `height` | 0 / 0 / 0 | 0 |
| Interactive elements without an accessible name | 0 | 0 |
| Heading-order skips | 0 | 0 |

Contrast, computed rather than eyeballed: `--cream-dim` on `--ink` 8.6:1,
`--cream-dim` on `--teal` 5.2:1, `--coral` on `--ink` 6.8:1, `--ink` on
`--cream` 17.2:1. `--coral` on `--teal` is only 3.5:1, which is why coral never
carries text on a teal ground.

**Still worth doing by hand:** Lighthouse, and toggling the OS reduced-motion
setting. The reduced-motion code paths are unit-verified (Lenis refuses to
build, the cursor stays inert, the preloader finishes in ~400ms) and all eight
CSS rules in the `prefers-reduced-motion` block match live elements — but the
brief is right that the real check is the OS switch.

## Ground rules the code keeps

- **The static page is the fallback, permanently.** With JavaScript off, every
  case study is open, every image is visible, the preloader and custom cursor do
  not exist, and the page reads top to bottom. Nothing is gated behind a script.
- **Only `transform`, `opacity` and `filter` are animated.** Never `width`,
  `height`, `top`, `left` or `margin`.
- **Every `<img>` carries `width` and `height`** so nothing shifts as images
  arrive.
- **`prefers-reduced-motion` is honoured as a hard stop**, not a softening: no
  smooth scroll, no parallax, no marquee, no custom cursor, and the sticky stack
  becomes a plain stack.
- **Nothing that must end up visible waits on an animation frame.** A hidden tab
  gets zero `requestAnimationFrame` callbacks, so the preloader teardown, the
  scroll unlock and the hero reveal all carry `setTimeout` backstops. Without
  them a tab opened in the background can come back to a blank, unscrollable
  hero — which is exactly the trap §10.5 is about, one level deeper.
- **The `js` class is not a promise that the module ran.** The inline head
  script sets it before any module loads, so the case-study fallback keys off
  `has-accordion`, which `js/accordion.js` sets only once its handlers are
  bound. Key it off `js` and a failed module seals the case studies behind dead
  buttons.
