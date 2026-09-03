/* ------------------------------------------------------------------ *
 * animations.js - the named motion functions from BUILD-BRIEF §6.
 *
 * Every scroll-linked behaviour on the site lives here as a named function.
 * Nothing scatters one-off tweens through the codebase.
 *
 * All of them are no-ops when GSAP is missing or reduced motion is on. The
 * static page is the fallback and it has to stay correct on its own.
 * ------------------------------------------------------------------ */

const GROUNDS = {
  ink: '#0b0e0f',
  teal: '#124a57',
  'teal-lo': '#0e3641',
  cream: '#fbf1d9',
};

/* ------------------------------------------------------------------ *
 * §6.6 sectionGround
 * ------------------------------------------------------------------ */

export function sectionGround() {
  const sections = document.querySelectorAll('[data-ground]');
  if (!sections.length) return;

  sections.forEach((section) => {
    const colour = GROUNDS[section.dataset.ground];
    if (!colour) return;

    // body carries `transition: background-color .6s` in CSS, so setting the
    // value is the whole tween - and reduced motion cancels it for free.
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (self.isActive) document.body.style.backgroundColor = colour;
      },
    });
  });
}

/* ------------------------------------------------------------------ *
 * Left rail - progress fill and the current section's label
 * ------------------------------------------------------------------ */

export function railProgress() {
  const bar = document.querySelector('[data-rail-progress]');
  const label = document.querySelector('[data-rail-label]');
  if (!bar) return;

  gsap.set(bar, { scaleY: 0, transformOrigin: 'top center' });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => gsap.set(bar, { scaleY: self.progress }),
  });

  if (!label) return;

  document.querySelectorAll('[data-section]').forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (self.isActive) label.textContent = section.dataset.section;
      },
    });
  });
}

/* ------------------------------------------------------------------ *
 * Refresh discipline (§10.3)
 *
 * Triggers measured before images arrive or before an accordion opens are
 * measuring a page that no longer exists.
 * ------------------------------------------------------------------ */

export function refreshOn() {
  window.addEventListener('load', () => ScrollTrigger.refresh());
  document.addEventListener('panel:settled', () => ScrollTrigger.refresh());

  // Fonts change line counts, which changes every downstream trigger.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
}
