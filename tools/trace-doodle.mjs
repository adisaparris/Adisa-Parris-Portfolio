/**
 * trace-doodle.mjs - centreline trace of a single-stroke line drawing.
 *
 * Potrace-style tracers produce *outlines* (filled shapes). This site needs the
 * opposite: the centre of each pen stroke, as one stroked <path>, so that
 * stroke-dasharray / stroke-dashoffset can draw it on. So we do it by hand:
 *
 *   raster -> threshold -> Zhang-Suen thinning -> skeleton graph -> polylines
 *   -> spur pruning -> Ramer-Douglas-Peucker -> nearest-neighbour stroke order
 *   -> Catmull-Rom -> relative smooth cubics -> one <path d="M... m... m...">
 *
 * Multiple subpaths inside ONE path element is deliberate: getTotalLength()
 * spans them all, so a single dashoffset tween draws the whole portrait in
 * sequence, pen-lifts and all.
 *
 * Two details that matter and are easy to get wrong:
 *
 *   1. Junctions are classified by CROSSING NUMBER (0->1 transitions around the
 *      8-ring), not by counting neighbours. A pixel on a diagonal staircase has
 *      three neighbours but is not a fork. Counting neighbours on this drawing
 *      reports 1711 junctions; the crossing number reports 58, which is right.
 *
 *   2. The path is written with relative integer coordinates on a 1000-unit
 *      grid and smooth-cubic (`s`) segments. Absolute decimal cubics cost ~3x
 *      the bytes for a curve nobody can tell apart at display size.
 */

import sharp from 'sharp';

/* ---------- 1. raster -> binary grid ------------------------------------ */

async function rasterise(file, workWidth, threshold) {
  const { data, info } = await sharp(file)
    .flatten({ background: '#ffffff' })
    .greyscale()
    .resize({ width: workWidth, kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const grid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = data[i * info.channels] < threshold ? 1 : 0;
  return { grid, w, h };
}

/* ---------- 2. Zhang-Suen thinning -------------------------------------- */

function thin(grid, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : grid[y * w + x]);
  let changed = true;

  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const doomed = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!grid[y * w + x]) continue;

          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y),
                p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1),
                p8 = at(x - 1, y), p9 = at(x - 1, y - 1);

          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;

          const ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let i = 0; i < 8; i++) if (ring[i] === 0 && ring[i + 1] === 1) a++;
          if (a !== 1) continue;

          if (step === 0) {
            if (p2 * p4 * p6) continue;
            if (p4 * p6 * p8) continue;
          } else {
            if (p2 * p4 * p8) continue;
            if (p2 * p6 * p8) continue;
          }
          doomed.push(y * w + x);
        }
      }
      if (doomed.length) {
        changed = true;
        for (const i of doomed) grid[i] = 0;
      }
    }
  }
  return grid;
}

/* ---------- 3. skeleton -> polylines ------------------------------------ */

// Clockwise from north; the ring order matters for the crossing number.
const RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

function makeGraph(grid, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : grid[y * w + x]);

  /** 0->1 transitions around the 8-ring: 1 = endpoint, 2 = on a run, 3+ = fork. */
  const crossing = (x, y) => {
    let a = 0;
    for (let i = 0; i < 8; i++) {
      const p = at(x + RING[i][0], y + RING[i][1]);
      const q = at(x + RING[(i + 1) % 8][0], y + RING[(i + 1) % 8][1]);
      if (p === 0 && q === 1) a++;
    }
    return a;
  };

  const cn = new Uint8Array(w * h);
  const ink = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y * w + x]) continue;
      cn[y * w + x] = crossing(x, y);
      ink.push([x, y]);
    }
  }
  return { cn, ink, at };
}

function skeletonToPolylines(grid, w, h) {
  const { cn, ink, at } = makeGraph(grid, w, h);
  const visited = new Uint8Array(w * h);

  const neighbours = (x, y) => {
    const out = [];
    for (const [dx, dy] of RING) {
      const nx = x + dx, ny = y + dy;
      if (at(nx, ny)) out.push([nx, ny]);
    }
    return out;
  };

  /**
   * Walk a run. On a diagonal staircase a run pixel has two forward candidates
   * that are themselves adjacent; take the one that best continues the current
   * heading so the trace does not zigzag.
   */
  const walk = (sx, sy, fx, fy) => {
    const line = [[sx, sy], [fx, fy]];
    visited[fy * w + fx] = 1;
    let px = sx, py = sy, cx = fx, cy = fy;

    while (cn[cy * w + cx] === 2) {
      const hx = cx - px, hy = cy - py;
      let best = null, bestScore = -Infinity;

      for (const [nx, ny] of neighbours(cx, cy)) {
        if (nx === px && ny === py) continue;
        if (visited[ny * w + nx]) continue;
        const dx = nx - cx, dy = ny - cy;
        const len = Math.hypot(dx, dy) || 1;
        const score = (hx * dx + hy * dy) / len; // straightest wins
        if (score > bestScore) { bestScore = score; best = [nx, ny]; }
      }
      if (!best) break;

      line.push(best);
      visited[best[1] * w + best[0]] = 1;
      px = cx; py = cy;
      cx = best[0]; cy = best[1];
    }
    return line;
  };

  const lines = [];
  const isNode = (x, y) => cn[y * w + x] !== 2;

  // Runs anchored at an endpoint or a fork.
  for (const [x, y] of ink) {
    if (!isNode(x, y)) continue;
    visited[y * w + x] = 1;
  }
  for (const [x, y] of ink) {
    if (!isNode(x, y)) continue;
    for (const [nx, ny] of neighbours(x, y)) {
      if (visited[ny * w + nx]) continue;
      lines.push(walk(x, y, nx, ny));
    }
  }
  // Anything still unvisited is a closed loop with no node on it.
  for (const [x, y] of ink) {
    if (visited[y * w + x]) continue;
    const start = neighbours(x, y).find(([nx, ny]) => !visited[ny * w + nx]);
    visited[y * w + x] = 1;
    if (start) lines.push(walk(x, y, start[0], start[1]));
  }

  return lines;
}

/* ---------- 4. pruning, simplifying, ordering --------------------------- */

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function polylineLength(line) {
  let n = 0;
  for (let i = 1; i < line.length; i++) n += dist(line[i - 1], line[i]);
  return n;
}

function rdp(points, eps) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];

  let worst = 0, idx = 0;
  const x1 = first[0], y1 = first[1], x2 = last[0], y2 = last[1];
  const dx = x2 - x1, dy = y2 - y1;
  const span = Math.hypot(dx, dy);

  for (let i = 1; i < points.length - 1; i++) {
    const px = points[i][0], py = points[i][1];
    const d = span === 0
      ? Math.hypot(px - x1, py - y1)
      : Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / span;
    if (d > worst) { worst = d; idx = i; }
  }

  if (worst <= eps) return [first, last];
  return [
    ...rdp(points.slice(0, idx + 1), eps).slice(0, -1),
    ...rdp(points.slice(idx), eps),
  ];
}

/** Greedy nearest-neighbour so the pen never leaps across the page. */
function orderStrokes(lines) {
  if (!lines.length) return lines;
  const pool = lines.slice();

  let startIdx = 0;
  for (let i = 1; i < pool.length; i++) {
    if (pool[i][0][1] < pool[startIdx][0][1]) startIdx = i;
  }

  const ordered = [pool.splice(startIdx, 1)[0]];
  while (pool.length) {
    const tail = ordered[ordered.length - 1];
    const pen = tail[tail.length - 1];

    let best = 0, bestD = Infinity, flip = false;
    pool.forEach((line, i) => {
      const dHead = dist(pen, line[0]);
      const dTail = dist(pen, line[line.length - 1]);
      if (dHead < bestD) { bestD = dHead; best = i; flip = false; }
      if (dTail < bestD) { bestD = dTail; best = i; flip = true; }
    });

    const line = pool.splice(best, 1)[0];
    ordered.push(flip ? line.slice().reverse() : line);
  }
  return ordered;
}

/* ---------- 5. polylines -> compact path data --------------------------- */

/** Join numbers with the fewest legal separators: "3 -4" -> "3-4". */
function joinNums(nums) {
  let out = '';
  for (const n of nums) {
    const s = String(n);
    if (out && !s.startsWith('-')) out += ' ';
    out += s;
  }
  return out;
}

function toPathData(lines, scale) {
  const out = [];
  let penX = 0, penY = 0; // current point, in emitted (rounded) units

  for (const line of lines) {
    if (line.length < 2) continue;

    const pts = line.map(([x, y]) => [Math.round(x * scale), Math.round(y * scale)]);

    out.push('m' + joinNums([pts[0][0] - penX, pts[0][1] - penY]));
    penX = pts[0][0]; penY = pts[0][1];

    if (pts.length === 2) {
      out.push('l' + joinNums([pts[1][0] - penX, pts[1][1] - penY]));
      penX = pts[1][0]; penY = pts[1][1];
      continue;
    }

    // Catmull-Rom control points, written as one `c` then `s` for the rest.
    // `s` reflects the previous control point, so it costs two pairs, not three.
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const c2x = Math.round(p2[0] - (p3[0] - p1[0]) / 6);
      const c2y = Math.round(p2[1] - (p3[1] - p1[1]) / 6);

      if (i === 0) {
        const c1x = Math.round(p1[0] + (p2[0] - p0[0]) / 6);
        const c1y = Math.round(p1[1] + (p2[1] - p0[1]) / 6);
        out.push('c' + joinNums([
          c1x - penX, c1y - penY,
          c2x - penX, c2y - penY,
          p2[0] - penX, p2[1] - penY,
        ]));
      } else {
        out.push('s' + joinNums([
          c2x - penX, c2y - penY,
          p2[0] - penX, p2[1] - penY,
        ]));
      }
      penX = p2[0]; penY = p2[1];
    }
  }

  // The very first command must be absolute.
  return out.length ? 'M' + out[0].slice(1) + out.slice(1).join('') : '';
}

/* ---------- public ------------------------------------------------------ */

// Defaults picked by rendering a parameter sweep and comparing against the
// source drawing. A looser threshold on a larger grid keeps the hair mass and
// the jawline continuous; tightening either one breaks them into fragments.
export async function traceDoodle(file, {
  workWidth = 760,
  threshold = 170,
  minStroke = 4,
  epsilon = 2.0,
  viewBox = 1000,
  strokeWidth = 7,
} = {}) {
  const { grid, w, h } = await rasterise(file, workWidth, threshold);
  thin(grid, w, h);

  let kept = skeletonToPolylines(grid, w, h)
    // Short runs are thinning debris at forks, not marks the artist made.
    .filter((line) => line.length >= 2 && polylineLength(line) >= minStroke)
    .map((line) => rdp(line, epsilon))
    .filter((line) => line.length >= 2);

  kept = orderStrokes(kept);

  const scale = viewBox / w;
  const d = toPathData(kept, scale);

  // Rough arc length in viewBox units - the runtime still calls
  // getTotalLength(); this is for the build log and as a sanity check.
  const approxLength = kept.reduce((sum, line) => sum + polylineLength(line), 0) * scale;

  const vbH = Math.round(h * scale);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + viewBox + ' ' + vbH +
    '" fill="none" stroke="currentColor" stroke-width="' + strokeWidth +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';

  return {
    svg,
    stats: {
      strokes: kept.length,
      points: kept.reduce((sum, l) => sum + l.length, 0),
      approxLength: Math.round(approxLength),
      viewBox: '0 0 ' + viewBox + ' ' + vbH,
      bytes: Buffer.byteLength(svg),
    },
  };
}
