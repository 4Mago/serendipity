# Design direction — botanical & painterly

Derived from the 22 references in `design/references/`. This document is what
the code follows; the images are context.

## The read

The references are print, not app design. Across nearly all of them:

- **Food is the only graphic element**, sitting on white or paper-cream with no
  container, no card, no shadow. Backlit and translucent food recurs — the
  vegetable slices, the onion, the apple rounds.
- **Grids of objects**, often numbered, often with deliberately empty cells.
- **Colour comes only from produce.** There is no "brand colour" in the set;
  every hue is something you could buy.
- **Paper, not screen.** Cream grounds, visible grain, watercolour and
  risograph texture, hairline rules, small serif labels.

The chosen strand is the botanical and painterly one — the labelled apple
varieties plate, the pea pods, the tuna cross-section, the watermelon
woodblock, the grainy tomato print. Soft, warm, calm. It should read as a
well-made cookbook rather than a productivity app.

## Consequences for the interface

**No chrome.** Content sits directly on the ground. No cards, no boxes, no drop
shadows, no rounded-rect containers stacked on tinted backgrounds. Separation
comes from whitespace and hairline rules — the way a printed page does it.

**Ink is not black and ground is not white.** Both are warm. Pure `#000` on
pure `#fff` is the one thing that would break the whole feel.

**Produce colour is used sparingly and always means something** — a category, a
person, a state. Never decoration for its own sake.

**Numbers are set properly.** Quantities and money use tabular figures so
columns align, as they would in a printed table.

**Texture is present but nearly subliminal**: a fine grain over the ground at
very low opacity. It should be felt, not seen.

## Palette

Named after what they came from, because that is how the references work.

| Token | Light | Role |
|---|---|---|
| `--paper` | `#FAF6EE` | Page ground |
| `--paper-sunk` | `#F2EBDD` | Recessed areas, table stripes |
| `--ink` | `#2A2622` | Primary text |
| `--ink-soft` | `#6E655A` | Secondary text, labels |
| `--rule` | `#E2D9C7` | Hairlines |
| `--tomat` | `#C6443A` | Tomato red — meat/fish, overspend, primary accent |
| `--citrus` | `#DE8038` | Citrus orange — fruit, warnings |
| `--arta` | `#7C9A52` | Pea green — produce, done, under budget |
| `--lok` | `#9C4F84` | Onion magenta — dairy, one of the two people |
| `--hav` | `#4E9B9E` | Turquoise — frozen/drinks, the other person |
| `--plommon` | `#6A4763` | Plum — pantry, deep accent |

Dark mode keeps the warmth: ground `#1B1815`, ink `#EDE4D4`, accents lifted in
lightness and slightly desaturated so they don't glow.

## Type

- **Fraunces** for headings and numerals with presence — a soft, slightly odd
  serif that matches the botanical plates and the woodblock print.
- **Inter** for interface text and data, with `font-variant-numeric: tabular-nums`
  wherever figures line up in columns.

Both self-hosted via `@fontsource`, not loaded from Google's CDN — the app has
to work offline, and a cross-origin font request doesn't.

Headings are set generously with tight-ish leading; labels are small, letter-
spaced and in `--ink-soft`, echoing the serif captions on the apple plate.

## Layout

- 4px spacing base, but real breathing room — closer to a book margin than an
  app gutter.
- Strict grid. The meal planner is a week grid whose empty cells stay empty and
  white, the way the checkerboard reference leaves cells blank.
- Rows are separated by hairlines, not by gaps and borders.
- Images float on the ground, uncontained, ideally cut out.
