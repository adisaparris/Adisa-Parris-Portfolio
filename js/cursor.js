/* ------------------------------------------------------------------ *
 * cursor.js - §5 persistent chrome
 *
 * An 8px coral dot chasing the pointer at 0.15, and a 36px ring lagging at
 * 0.08 that opens to 72px and says VIEW over a work card.
 *
 * Gated on (hover: hover) and (pointer: fine) in BOTH the CSS and here
 * (§10.7). A phone must never get this: on touch there is no pointer to
 * follow, and the ring would sit wherever the last tap landed.
 * ------------------------------------------------------------------ */

const FINE_POINTER = '(hover: hover) and (pointer: fine)';

export function initCursor(reduce) {
  if (reduce) return;
  if (!window.matchMedia(FINE_POINTER).matches) return;
  if (!window.gsap) return;

  const dot = document.querySelector('[data-cursor]');
  const ring = document.querySelector('[data-cursor-ring]');
  if (!dot || !ring) return;

  // Only now is it safe to hide the system cursor: if any of the checks above
  // had bailed, the page would have been left with no pointer at all.
  document.documentElement.classList.add('has-cursor');

  let px = 0, py = 0;          // pointer
  let dx = 0, dy = 0;          // dot
  let rx = 0, ry = 0;          // ring
  let seen = false;

  const show = (state) => {
    dot.dataset.active = String(state);
    ring.dataset.active = String(state);
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      px = event.clientX;
      py = event.clientY;
      if (!seen) {
        // Start where the pointer is, so nothing flies in from the corner.
        seen = true;
        dx = rx = px;
        dy = ry = py;
        show(true);
      }
    },
    { passive: true }
  );

  document.addEventListener('pointerleave', () => show(false));
  document.addEventListener('pointerenter', () => seen && show(true));

  gsap.ticker.add(() => {
    if (!seen) return;
    dx += (px - dx) * 0.15;
    dy += (py - dy) * 0.15;
    rx += (px - rx) * 0.08;
    ry += (py - ry) * 0.08;
    gsap.set(dot, { x: dx, y: dy });
    gsap.set(ring, { x: rx, y: ry });
  });

  document.querySelectorAll('[data-card]').forEach((card) => {
    card.addEventListener('pointerenter', () => { ring.dataset.view = 'true'; });
    card.addEventListener('pointerleave', () => { ring.dataset.view = 'false'; });
  });
}
