/* ------------------------------------------------------------------ *
 * preloader.js - §5.00
 *
 * A counter that runs 000 -> 100 against real load progress, with the line
 * drawing itself behind it. Then the panel splits and leaves upward.
 *
 * Three rules this has to keep (§5.00, §10.5):
 *   - it never traps anyone. Whatever happens to the network, it is gone
 *     within HARD_LIMIT.
 *   - the number means something. It tracks actual signals, not a fixed
 *     duration dressed up as progress.
 *   - it plays once per session, decided in the head script so a back-nav
 *     never flashes it.
 * ------------------------------------------------------------------ */

import { lockScroll } from './lenis-setup.js';

const SESSION_KEY = 'adisa:preloaded';
const MIN_MS = 900; // §5.00: floored so it cannot flash
const MIN_MS_REDUCED = 300; // §6.7
const HARD_LIMIT = 5000; // §10.5: visible after this no matter what

export function initPreloader({ reduce = false, onDone = () => {} } = {}) {
  const panel = document.querySelector('[data-preloader]');

  // Already played this session (the head script decided), or no markup.
  if (!panel || document.documentElement.classList.contains('is-preloaded')) {
    panel?.remove();
    finish();
    onDone();
    return;
  }

  const countEl = panel.querySelector('[data-preload-count]');
  const panels = panel.querySelectorAll('.preloader__panel');
  const doodle = panel.querySelector('[data-doodle="preloader"]');

  lockScroll(true);

  const started = performance.now();
  const minMs = reduce ? MIN_MS_REDUCED : MIN_MS;

  /* --- real progress signals -------------------------------------- */

  const signals = { fonts: 0, hero: 0, load: 0 };
  const weights = { fonts: 0.3, hero: 0.35, load: 0.35 };
  const realProgress = () =>
    Object.keys(weights).reduce((sum, k) => sum + signals[k] * weights[k], 0);

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => { signals.fonts = 1; });
  } else {
    signals.fonts = 1;
  }

  const hero = document.querySelector('[data-hero-portrait] img');
  if (!hero || hero.complete) {
    signals.hero = 1;
  } else {
    hero.addEventListener('load', () => { signals.hero = 1; }, { once: true });
    hero.addEventListener('error', () => { signals.hero = 1; }, { once: true });
  }

  if (document.readyState === 'complete') {
    signals.load = 1;
  } else {
    window.addEventListener('load', () => { signals.load = 1; }, { once: true });
  }

  /* --- the counter ------------------------------------------------- */

  let shown = 0;
  let done = false;

  const tick = () => {
    if (done) return;

    const elapsed = performance.now() - started;
    // Never let the displayed number outrun the minimum duration, or the
    // counter hits 100 and then sits there.
    const ceiling = Math.min(realProgress(), elapsed / minMs);
    shown += (ceiling - shown) * 0.12;

    if (countEl) {
      countEl.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    }

    if (shown > 0.995 && elapsed >= minMs) {
      complete();
      return;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);

  // §10.5 / Phase 5 acceptance: a preloader that can hang is a broken site.
  const bail = setTimeout(complete, HARD_LIMIT);

  /* --- the line drawing itself ------------------------------------- */

  if (doodle && !reduce && window.gsap) {
    drawDoodle(doodle, Math.max(minMs / 1000, 1.4));
  }

  /* --- exit --------------------------------------------------------- */

  function finish() {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (e) {
      /* private mode - it will simply play again */
    }
    document.documentElement.classList.add('is-preloaded');
    lockScroll(false);
  }

  function complete() {
    if (done) return;
    done = true;
    clearTimeout(bail);

    if (countEl) countEl.textContent = '100';

    const cleanup = () => {
      panel.remove();
      finish();
      onDone();
    };

    if (reduce || !window.gsap) {
      cleanup();
      return;
    }

    // The panel splits and leaves upward, halves staggered so it reads as two
    // pieces rather than one lid.
    gsap
      .timeline({ onComplete: cleanup })
      .to(panel.querySelector('.preloader__content'), {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.inOut',
      })
      .to(
        panels,
        {
          yPercent: -100,
          duration: 1,
          ease: 'power4.inOut',
          stagger: 0.08,
        },
        '-=0.1'
      )
      // Scroll unlocks as the panel clears, not after the tween settles.
      .add(finish, '-=0.7');
  }
}

/**
 * §6.5 drawLine, timed variant.
 *
 * stroke-dasharray and stroke-dashoffset are inherited SVG properties, so
 * setting them on <use> reaches the referenced path inside the shadow tree.
 * The length has to come from the real <path>, which is the one element that
 * can answer getTotalLength().
 */
export function drawDoodle(svg, seconds = 1.4) {
  const source = document.getElementById('doodle-path');
  const target = svg.querySelector('use') || svg.querySelector('path');
  if (!source || !target) return null;

  const length = source.getTotalLength();
  gsap.set(target, { strokeDasharray: length, strokeDashoffset: length });

  return gsap.to(target, {
    strokeDashoffset: 0,
    duration: seconds,
    ease: 'power1.inOut',
  });
}
