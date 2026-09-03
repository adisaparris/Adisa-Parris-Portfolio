/* ------------------------------------------------------------------ *
 * main.js - entry point and init order.
 *
 * Everything here is defensive about the CDN libraries being absent: if
 * GSAP or Lenis fail to load, the page stays a complete, readable, fully
 * navigable portfolio. That is the Phase 1 build, and it is the permanent
 * fallback.
 *
 * Order matters in one place only: the hero is primed to its hidden start
 * state before the preloader runs, so it cannot be glimpsed mid-setup, and
 * the intro plays when the panel clears.
 * ------------------------------------------------------------------ */

import { initAccordions } from './accordion.js';
import { initSmoothScroll, getLenis } from './lenis-setup.js';
import { initPreloader, drawDoodle } from './preloader.js';
import { initCursor } from './cursor.js';
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
  velocitySkew,
  drawLineOnScroll,
  primeHero,
  heroIntro,
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
  if (!gsap || !ScrollTrigger) return false;

  gsap.registerPlugin(ScrollTrigger);

  const lenis = initSmoothScroll(reduce);

  refreshOn();
  sectionGround();

  // §6.7: with motion off the page keeps its static end state. Everything
  // below animates, so none of it runs.
  if (reduce) return true;

  railProgress();
  heroExit();

  if (window.SplitType) {
    document.querySelectorAll('[data-reveal]').forEach((el) => revealText(el));
    reSplitOnResize();
  }

  document.querySelectorAll('[data-parallax]').forEach(parallaxImage);
  revealRows(document.querySelectorAll('[data-craft-row]'));
  stickyStack([...document.querySelectorAll('.work__item')]);

  velocitySkew([...document.querySelectorAll('[data-marquee-track]')], lenis);

  const aboutDoodle = document.querySelector('[data-doodle="about"]');
  if (aboutDoodle) drawLineOnScroll(aboutDoodle, '#about');

  // The line signs off in the footer (§5.06).
  const footDoodle = document.querySelector('[data-doodle="footer"]');
  if (footDoodle) {
    const draw = drawDoodle(footDoodle, 1.6);
    draw?.pause();
    ScrollTrigger.create({
      trigger: '#contact',
      start: 'top 70%',
      once: true,
      onEnter: () => draw?.play(),
    });
  }

  initCursor(reduce);
  return true;
}

function boot() {
  markImagesLoaded();
  initAccordions();

  const animated = initScrollSystem();
  const canAnimateHero = animated && !reduce;

  if (canAnimateHero) primeHero();

  initPreloader({
    reduce,
    onDone: () => {
      if (canAnimateHero) heroIntro();
    },
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
