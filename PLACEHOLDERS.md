# Placeholders — needs Adisa's input before launch

Everything here is live on the page right now with drafted or stand-in content.
None of it blocks the build; all of it should be confirmed before the site is
public.

---

## 1. Project facts — copy is inferred from the artwork

The case-study copy in `index.html` came from BUILD-BRIEF §11, which was written
by reading the work itself. **Treat every factual claim as unconfirmed**, in
particular:

| Project | Claimed | Needs confirming |
|---|---|---|
| Maggio's Wood Fired Pizza | 2024, client work for a Wauwatosa pizzeria | Year; whether this was a real client engagement, spec, or coursework |
| Saltwater Condos | 2024, home-automation company for coastal properties | Year; whether "Saltwater Condos" is a real client or a self-directed brief |
| The Future of Typography | 2023, UW–Whitewater lecture-series poster | Confirmed by the artwork itself (2023, Greenhill Center of the Arts). Was it an assignment or a commissioned poster? |
| PetWell | 2025, veterinary-care mark | Year; real client or spec |
| Travel Bird | 2023, minimal mark | Year; real client or spec |
| Field Studies | Ongoing personal work | Fine as-is unless you want a date range |

Also worth deciding: whether any piece should carry a "student work" or
"self-initiated" label. Right now the copy reads as though all six were client
engagements.

## 2. Social links — currently dead

`index.html`, in the footer:

```html
<a class="link" href="#" data-placeholder-link>Instagram</a>
<a class="link" href="#" data-placeholder-link>LinkedIn</a>
<a class="link" href="#" data-placeholder-link>Behance</a>
```

All three point at `#`. Replace the `href`s with real profile URLs and delete
the `data-placeholder-link` attribute, or delete the whole `<nav>` if you'd
rather the footer stayed email-only.

## 3. Source artwork: typo on the anniversary poster

`maggio's anniversary poster.pdf` reads **"FEBUARY 8TH AND 9TH"**. That is in the
original artwork, not something the site introduced. It appears on the site at
`maggios-poster-*.webp`. If you fix the PDF, re-run `tools/prep-assets.mjs` and
the site picks it up.

## 4. Personal contact details on the Maggio's card backs

`Maggio's BC - Back - Large Leaf.pdf` and `Maggio's BC - Back - Andy.png` carry a
legible personal Gmail address and mobile number.

Those flat files are **deliberately not used**. The Maggio's case study shows
`maggios-cards` instead — the wood-background mockup, where both card faces
appear but the contact details are too small to read. If you would rather show
the flat back-of-card artwork, add it to the asset table in
`tools/prep-assets.mjs` — but consider that a public portfolio page makes those
details scrapeable.

## 5. Deliberately left out

- **`Adisa with Kenna.jpg`** — a casual arcade snapshot, sideways in EXIF, under
  purple lighting, and it includes another person. It fights the tone the side
  profile sets. Say the word if you want it in About anyway.
- **Résumé PDF** — no download link. Drop a PDF in `assets/` and the Contact
  section can carry a link.

## 6. Canonical / Open Graph URLs

`index.html` assumes `https://adisaparris.github.io/Adisa-Parris-Portfolio/`.
If the site ends up on a custom domain, update `<link rel="canonical">` and
`<meta property="og:image">` — Open Graph will not accept a relative URL.
