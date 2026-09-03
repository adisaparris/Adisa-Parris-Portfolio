/* ------------------------------------------------------------------ *
 * lenis-setup.js - smooth scroll, wired to ScrollTrigger.
 *
 * The wiring in initSmoothScroll() is the whole ballgame (BUILD-BRIEF §6.0).
 * Lenis is driven by GSAP's ticker and NOT by its own requestAnimationFrame
 * loop; driving it from both produces a half-frame judder that looks like a
 * performance problem and is not one.
 * ------------------------------------------------------------------ */

let lenis = null;

export function getLenis() {
  return lenis;
}

export function initSmoothScroll(reduce) {
  // §6.7: reduced motion skips Lenis entirely and leaves native scrolling be.
  if (reduce) return null;

  const { Lenis, gsap, ScrollTrigger } = window;
  if (!Lenis || !gsap || !ScrollTrigger) return null;

  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/**
 * Jump the scroll position by `delta` with no easing and no animation.
 *
 * Used to cancel out layout shifts (see unstick() in accordion.js). Native
 * scrollBy would fight Lenis, which holds its own idea of where the page is,
 * so route through Lenis when it is running.
 */
export function scrollByInstant(delta) {
  if (!delta) return;
  if (lenis) {
    lenis.scrollTo(lenis.actualScroll + delta, { immediate: true, force: true });
  } else {
    window.scrollBy({ top: delta, behavior: 'instant' });
  }
}

/** Lenis holds scroll while the preloader is up, so nobody scrolls past it. */
export function lockScroll(locked) {
  document.body.classList.toggle('is-loading', locked);
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}
