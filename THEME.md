# Theming — and the beauty bonus

Your whole site's look flows from one file: [`src/theme.ts`](./src/theme.ts).
You never have to write CSS. You have three dials:

## 1. The palette (one word)

```ts
export const paletteChoice = "regatta";
```

| Palette | Feel |
|---|---|
| `regatta` | Deep navy accent on warm paper — nautical, collegiate |
| `dune` | Warm sand and terracotta — desert light |
| `orchard` | Cool greens on off-white — botanical, calm |
| `noir` | Near-black with a hot gold accent — gallery at night |

Each palette is a complete scheme: page background, card surfaces, two text
tones, hairline borders, and one accent, with contrast that passes
accessibility checks. Or invent your own: copy a palette in `theme.ts`,
change the colors, give it a name, and set `paletteChoice` to it.

## 2. The font pairing (one word)

```ts
export const fontChoice = "editorial";
```

| Pairing | Headings | Feel |
|---|---|---|
| `editorial` | Fraunces | Expressive serif — magazine |
| `geometric` | Space Grotesk | Modern grotesk — tech/startup |
| `classic` | Lora | High-contrast serif — timeless |

Body text is Inter in all three: readable body + characterful headings is
the classic pairing move.

## 3. The accent (optional)

```ts
export const accentOverride = "#c2410c"; // or null to use the palette's
```

One accent color, used consistently: links, buttons, highlights. One is a
choice; five is a kindergarten.

---

## What the professor looks for (the beauty bonus)

The beauty bonus is awarded by a human looking at your live site, and it
gates the top of the ladder: **without it the highest grade is A-**; Lane 5
complete *plus* the bonus is an A. It can be earned at any point in the
semester, so make your site yours early.

What earns it is **evidence of choices**, not effort or complexity:

- **Distinctive but coherent color.** A palette that feels picked for *you*,
  applied consistently. Switching `paletteChoice` is the floor; tuning a
  palette (or building one) around a photo you love is the move.
- **Typography someone chose on purpose.** A heading font with character
  that fits your palette's mood, sizes that form a scale, line lengths that
  are comfortable to read.
- **Real imagery.** Your actual photo (not the placeholder), and any other
  images cropped and placed with intent.
- **Not defaults.** The unedited template is tasteful, but the professor has
  seen it thirty times. Identical-to-the-template reads as "no choices made."

What does *not* earn it: animations, gradients everywhere, five fonts, or
anything that makes the site harder to read. Restraint is a choice too. The
most common winning move is one good palette, one good pairing, one good
photo, applied everywhere.

The course teaches the underlying eye in Chapter 4 (Make It Yours) and
Chapter 16 (The Four Stages of Visualization).
