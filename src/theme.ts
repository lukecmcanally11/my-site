/**
 * ═══════════════════════════════════════════════════════════════════════
 *  YOUR THEME — pick a look with three small choices, no CSS required.
 *  See THEME.md for how this relates to the beauty bonus.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The whole site's color and type flow from this file. You never have to
 * touch CSS: pick a palette, pick a font pairing, optionally set your own
 * accent color. Beauty comes from CHOICES. Make some.
 */

/** ── 1. Pick your palette ──────────────────────────────────────────────
 * One word from: "regatta" | "dune" | "orchard" | "noir"
 * (Or invent your own: copy a palette below, change the colors, name it.)
 */
export const paletteChoice = "regatta";

/** ── 2. Pick your font pairing ─────────────────────────────────────────
 * One word from: "editorial" | "geometric" | "classic"
 *   editorial — expressive serif headings, clean body (magazine feel)
 *   geometric — modern grotesk headings (tech/startup feel)
 *   classic   — high-contrast serif headings (timeless feel)
 */
export const fontChoice = "editorial";

/** ── 3. (Optional) Override the accent ─────────────────────────────────
 * Set to any CSS color (e.g. "#c2410c" or "rebeccapurple") to replace the
 * palette's accent with your own. Leave as null to use the palette's.
 */
export const accentOverride: string | null = null;

// ───────────────────────────────────────────────────────────────────────
// The palettes. Each is a complete, coherent scheme with accessible
// contrast (ink on paper and accentInk on accent both pass WCAG AA).
// ───────────────────────────────────────────────────────────────────────

export interface Palette {
  /** Page background. */
  paper: string;
  /** Slightly raised surfaces (cards, header). */
  surface: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** Hairline borders. */
  line: string;
  /** The one accent — links, buttons, highlights. */
  accent: string;
  /** Text ON the accent (buttons). */
  accentInk: string;
}

export const PALETTES: Record<string, Palette> = {
  /** Deep navy accent on warm paper — nautical, collegiate. */
  regatta: {
    paper: "#faf8f4",
    surface: "#ffffff",
    ink: "#1c2733",
    muted: "#5b6b7b",
    line: "#e3ddd2",
    accent: "#155e8f",
    accentInk: "#ffffff",
  },
  /** Warm sand and terracotta — desert light. */
  dune: {
    paper: "#faf6ef",
    surface: "#fffdf8",
    ink: "#37302a",
    muted: "#7c6f5f",
    line: "#eadfcd",
    accent: "#b4552d",
    accentInk: "#ffffff",
  },
  /** Cool greens on off-white — botanical, calm. */
  orchard: {
    paper: "#f6f8f4",
    surface: "#ffffff",
    ink: "#20301f",
    muted: "#5d705b",
    line: "#dde5d8",
    accent: "#3a6b35",
    accentInk: "#ffffff",
  },
  /** Near-black with a hot accent — gallery at night. */
  noir: {
    paper: "#141417",
    surface: "#1d1d21",
    ink: "#f2f0eb",
    muted: "#a3a09a",
    line: "#2c2c31",
    accent: "#e8b04b",
    accentInk: "#1a1508",
  },
};

/** Font pairings map to the fonts loaded in src/app/fonts.ts. */
export const FONT_PAIRINGS: Record<string, { heading: string; body: string }> = {
  editorial: { heading: "var(--font-fraunces)", body: "var(--font-inter)" },
  geometric: { heading: "var(--font-space-grotesk)", body: "var(--font-inter)" },
  classic: { heading: "var(--font-lora)", body: "var(--font-inter)" },
};

/** The resolved theme the layout applies. You don't need to edit below. */
export function resolvedTheme() {
  const palette = PALETTES[paletteChoice] ?? PALETTES.regatta;
  const fonts = FONT_PAIRINGS[fontChoice] ?? FONT_PAIRINGS.editorial;
  return {
    ...palette,
    accent: accentOverride ?? palette.accent,
    headingFont: fonts.heading,
    bodyFont: fonts.body,
  };
}
