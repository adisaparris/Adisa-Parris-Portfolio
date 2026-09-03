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
 * §6.1 revealText
 *
 * SplitType into lines, wrap each line in a mask, slide the lines up from
 * behind it. Lines are measured at the current width, so a resize has to
 * throw the split away and redo it - see reSplitOnResize() below. Reverting
 * first is not optional: splitting an already-split element nests the
 * wrappers and the text ends up clipped (§10.4).
 * ------------------------------------------------------------------ */

const originalHTML = new WeakMap();
const rebuilders = new Set();

/**
 * Backstop for the reveals.
 *
 * If ScrollTrigger ever measures a stale layout, copy can be left parked
 * off-screen behind its mask - the one failure here that actually loses
 * content. This catches it.
 *
 * The margin makes it fire *later* than the real trigger (which is at
 * `top 82%`), so in normal operation ScrollTrigger always wins and the
 * designed timing is what you see. A plain timer would be wrong: it would
 * spend every below-fold reveal on any visitor who pauses for a few seconds.
 */
const failsafes = new Map();
const backstop =
  typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            backstop.unobserve(entry.target);
            failsafes.get(entry.target)?.();
            failsafes.delete(entry.target);
          });
        },
        { rootMargin: '0px 0px -45% 0px' }
      )
    : null;

function buildLines(el) {
  if (!originalHTML.has(el)) originalHTML.set(el, el.innerHTML);
  else el.innerHTML = originalHTML.get(el);

  const split = new SplitType(el, { types: 'lines', tagName: 'span' });

  split.lines.forEach((line) => {
    const mask = document.createElement('span');
    mask.className = 'line-mask';
    line.parentNode.insertBefore(mask, line);
    mask.appendChild(line);
  });

  return split.lines;
}

export function revealText(el, opts = {}) {
  const { start = 'top 82%', stagger = 0.07, duration = 1.1 } = opts;
  let revealed = false;
  let trigger = null;

  const build = () => {
    const lines = buildLines(el);

    if (revealed) {
      gsap.set(lines, { yPercent: 0 });
      return;
    }

    const play = () => {
      if (revealed) return;
      revealed = true;
      gsap.to(lines, { yPercent: 0, duration, ease: 'power4.out', stagger });
    };

    gsap.set(lines, { yPercent: 110 });
    trigger?.kill();
    trigger = ScrollTrigger.create({ trigger: el, start, once: true, onEnter: play });

    failsafes.set(el, play);
    backstop?.observe(el);
  };

  build();
  rebuilders.add(build);

  return build;
}

export function reSplitOnResize(delay = 250) {
  let width = window.innerWidth;
  let timer;

  window.addEventListener('resize', () => {
    // Mobile browsers fire resize when the URL bar hides. Only a width change
    // can alter where the lines break.
    if (window.innerWidth === width) return;
    width = window.innerWidth;

    clearTimeout(timer);
    timer = setTimeout(() => {
      rebuilders.forEach((rebuild) => rebuild());
      ScrollTrigger.refresh();
    }, delay);
  });
}

/* ------------------------------------------------------------------ *
 * §6.2 parallaxImage
 * ------------------------------------------------------------------ */

export function parallaxImage(wrapper) {
  const img = wrapper.querySelector('img');
  if (!img) return;

  // §9: half intensity on mobile.
  const k = window.matchMedia('(max-width: 767px)').matches ? 0.5 : 1;

  // Artwork shown whole is padded inside its plate, so scaling it up crops the
  // mark against its own frame. Those get drift only.
  const whole = wrapper.classList.contains('media--plate') ||
                wrapper.classList.contains('media--contain');

  const scaleFrom = whole ? 1 : 1 + 0.15 * k;
  const shift = (whole ? 3 : 6) * k;

  gsap.fromTo(
    img,
    { scale: scaleFrom, yPercent: -shift },
    {
      scale: 1,
      yPercent: shift,
      ease: 'none',
      scrollTrigger: {
        trigger: wrapper,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
    }
  );
}

/* ------------------------------------------------------------------ *
 * Craft rows - masked slide on a 0.05 stagger (§5.04)
 * ------------------------------------------------------------------ */

export function revealRows(rows) {
  if (!rows.length) return;

  gsap.fromTo(
    [...rows].map((row) => row.querySelector('.craft__row-inner')),
    { yPercent: 100 },
    {
      yPercent: 0,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.05,
      scrollTrigger: { trigger: rows[0].parentElement, start: 'top 82%', once: true },
    }
  );
}

/* ------------------------------------------------------------------ *
 * §5.01 hero exit - the headline parts as you leave. Not pinned.
 * ------------------------------------------------------------------ */

export function heroExit() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      // Gone by 80% of viewport height, per §5.01.
      end: () => '+=' + window.innerHeight * 0.8,
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  tl.to('[data-hero-line="in"]', { xPercent: -6, ease: 'none' }, 0)
    .to('[data-hero-line="out"]', { xPercent: 6, ease: 'none' }, 0)
    .to('[data-hero-portrait] img', { scale: 1.12, ease: 'none' }, 0)
    .to('.hero__grid', { opacity: 0, ease: 'power1.in' }, 0);
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
