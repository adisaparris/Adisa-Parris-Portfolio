/* ------------------------------------------------------------------ *
 * main.js - entry point and init order.
 *
 * Everything here is defensive about the CDN libraries being absent: if
 * GSAP or Lenis fail to load, the page stays a complete, readable, fully
 * navigable portfolio. That is the Phase 1 build, and it is the permanent
 * fallback.
 * ------------------------------------------------------------------ */

import { initAccordions } from './accordion.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function markImagesLoaded() {
  document.querySelectorAll('.media img').forEach((img) => {
    if (img.complete) {
      img.classList.add('is-loaded');
      return;
    }
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    img.addEventListener('error', () => img.classList.add('is-loaded'), { once: true });
  });
}

function boot() {
  markImagesLoaded();
  initAccordions();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export { reduce };
