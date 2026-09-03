/* ------------------------------------------------------------------ *
 * accordion.js - inline case-study expansion for the work cards.
 *
 * A <button aria-expanded> controlling a panel, per §9. The panel animates
 * grid-template-rows 0fr -> 1fr so it measures its own content; there is no
 * max-height to guess wrong.
 *
 * Anything that needs to know the page got taller subscribes to the
 * 'panel:settled' event, which fires after the transition ends. That is
 * where ScrollTrigger.refresh() hangs in Phase 4.
 * ------------------------------------------------------------------ */

/**
 * Take a card out of the sticky stack while its case study is open.
 *
 * The stack works by letting each card cover the one before it. That is
 * exactly wrong for a card you are reading: the panel opens below the fold of
 * the stuck card and the next card sits on top of it. So an expanded card
 * leaves the deck and scrolls like an ordinary section.
 *
 * Switching position on a stuck element moves it, so the scroll position is
 * corrected by the same delta and nothing appears to jump.
 */
function unstick(item, expanded) {
  const before = item.getBoundingClientRect().top;
  item.classList.toggle('is-expanded', expanded);
  const after = item.getBoundingClientRect().top;
  const delta = after - before;
  if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
}

export function initAccordions() {
  const toggles = document.querySelectorAll('[data-toggle]');

  toggles.forEach((toggle) => {
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!panel) return;

    // The label is real text, not CSS `content` - generated content is not a
    // dependable accessible name, and the button needs one.
    const label = toggle.querySelector('.card__toggle-label');
    const project = toggle.closest('[data-card]')?.querySelector('.card__title')?.textContent.trim();
    if (project) toggle.setAttribute('aria-label', 'Open case study: ' + project);

    const item = toggle.closest('.work__item');

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      panel.dataset.open = String(!open);

      const verb = open ? 'Open' : 'Close';
      if (label) label.textContent = verb + ' case study';
      if (project) toggle.setAttribute('aria-label', verb + ' case study: ' + project);

      if (item) unstick(item, !open);
    });

    // The layout is only actually stable once the rows transition finishes.
    panel.addEventListener('transitionend', (event) => {
      if (event.propertyName !== 'grid-template-rows') return;
      document.dispatchEvent(
        new CustomEvent('panel:settled', { detail: { panel, toggle } })
      );
    });
  });
}
