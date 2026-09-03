/* ------------------------------------------------------------------ *
 * main.js - entry point and init order.
 *
 * Everything here is defensive about the CDN libraries being absent: if
 * GSAP or Lenis fail to load, the page stays a complete, readable, fully
 * navigable portfolio. That is the Phase 1 build, and it is the permanent
 * fallback.
 * ------------------------------------------------------------------ */

import { initAccordions } from './accordion.js';
import { initSmoothScroll } from './lenis-setup.js';
import {
  sectionGround,
  railProgress,
  refreshOn,
  revealText,
  reSplitOnResize,
  parallaxImage,
  revealRows,
  heroExit,
  stickyStack,
} from './animations.js';

export const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function initScrollSystem() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  initSmoothScroll(reduce);

  refreshOn();
  sectionGround();

  // §6.7: with motion off the page keeps its static end state. Everything
  // below animates, so none of it runs.
  if (reduce) return;

  railProgress();
  heroExit();

  if (window.SplitType) {
    document.querySelectorAll('[data-reveal]').forEach((el) => revealText(el));
    reSplitOnResize();
  }

  document.querySelectorAll('[data-parallax]').forEach(parallaxImage);
  revealRows(document.querySelectorAll('[data-craft-row]'));
  stickyStack([...document.querySelectorAll('.work__item')]);
}

function boot() {
  markImagesLoaded();
  initAccordions();
  initScrollSystem();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
