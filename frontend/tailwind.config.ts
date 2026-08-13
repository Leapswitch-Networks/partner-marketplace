import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
      // ── Viho design tokens ────────────────────────────────────────────────
      // Adopted 2026-08-05. Every value is quoted from
      // documentation/design/VIHO_THEME_REFERENCE.md, which measured them from
      // the theme's own stylesheet and cross-checked against screenshots.
      //
      // Viho spells its own primary custom property `--theme-deafult` (sic).
      // Ours is spelled correctly — do not propagate the typo.
      colors: {
        // ── brand + accent are CSS custom properties, not literals ───────────
        //
        // Changed 2026-08-06 for runtime theming (DYNAMIC_BRANDING_PLAN phase 3).
        // The DEFAULTS still live in `app/globals.css` `:root` and are byte-for-byte
        // Viho's values, so nothing changed visually — verified by grep, since all
        // 261 `brand` call sites keep saying `bg-brand`.
        //
        // ⚠️ The channels must be SPACE-SEPARATED RGB (`36 105 92`), never a hex.
        // That is what makes `<alpha-value>` work, and **12 distinct opacity
        // variants are in use** — `bg-brand/[.04]` through `bg-brand/70`. Put a hex
        // in the variable and every one of them silently renders opaque.
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)",
          darker: "rgb(var(--brand-darker) / <alpha-value>)",
          light: "rgb(var(--brand-light) / <alpha-value>)",
          // Brand text/icons on a DARK surface must not use the base brand: the
          // teal on the #111727 card measures ~2.8:1 and fails AA outright, while
          // its light counterpart scores ~8.8:1. Every preset ships both values
          // contrast-checked — see `backend/app/core/theme.py`, which is the only
          // place a new one may be added.
          // Use `dark:text-brand-on-dark` wherever brand text sits on night.card.
          "on-dark": "rgb(var(--brand-on-dark) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dark: "rgb(var(--accent-dark) / <alpha-value>)",
          light: "rgb(var(--accent-light) / <alpha-value>)",
        },
        surface: {
          page: "#f5f7fb",
          card: "#ffffff",
          // ── border/wash/tile were brand-derived percentages flattened to hex
          // at adoption time (#e6edef / #eaf0ef / #eff3f2) — which is why every
          // card kept a GREEN wash under a crimson brand. Un-frozen 2026-08-13:
          // the backend now computes the same relationships per theme
          // (`core/theme.py css_variables`) and the defaults in `globals.css`
          // are byte-for-byte the old values, so the teal look is unchanged.
          border: "rgb(var(--surface-border) / <alpha-value>)", // was brand at 11% over white
          divider: "#efefef",
          wash: "rgb(var(--surface-wash) / <alpha-value>)", // brand at 10% over white
          tile: "rgb(var(--surface-tile) / <alpha-value>)", // brand at 8% — social tiles
        },
        ink: {
          DEFAULT: "#242934",
          label: "#59667a",
          // OURS, deliberately. Viho's #999999 is 2.85:1 on white and fails AA.
          // Exception E2 in VIHO_ADOPTION_PLAN.md.
          muted: "#6b7280",
        },
        night: {
          body: "#202938", // dark PAGE — lighter than the card, see below
          card: "#111727", // dark CARD — darker than the page. Inverted on purpose
          // was #142831 (brand at 20% over the dark card) — 132 dark-mode
          // borders stayed teal under every other theme. Un-frozen 2026-08-13.
          border: "rgb(var(--night-border) / <alpha-value>)",
          muted: "#98a6ad",
        },
        // The six semantic tones double as Viho's categorical palette. Adopted
        // as-is including the two odd ones: `success` is a dark primary shade
        // rather than a green, and `info` is grey rather than blue. Both pass
        // contrast; see VIHO_ADOPTION_PLAN.md for why fidelity won here.
        //
        // `success` FOLLOWS THE BRAND — owner's decision, 2026-08-13. It was
        // #1b4c43, which is literally the teal brand darkened 27% and frozen;
        // the backend now derives the same 27% from whichever brand is active,
        // so "Active" chips read as the app's own colour under every theme.
        // `light` was #e6edef, the same tint as surface.border — one variable
        // serves both, as one hex did.
        tone: {
          success: "rgb(var(--tone-success) / <alpha-value>)",
          danger: "#d22d3d",
          warning: "#e2c636",
          info: "#717171",
          light: "rgb(var(--surface-border) / <alpha-value>)",
          dark: "#2c323f",
        },

        // ── shadcn semantic aliases ─────────────────────────────────────────
        //
        // Added 2026-08-10 with the owner's approval, so the reference
        // implementation's `components/ui/*` and its DataTable can be used as
        // written. Those files reference shadcn's names, which did not exist here.
        //
        // **Aliases, not a second palette.** Every variable resolves to a Viho
        // value in `app/globals.css` — a copied component renders in our brand,
        // not shadcn's neutral grey. See that file for the mapping and for why
        // `accent` is deliberately missing from this block (Viho already owns
        // that name; redefining it would repaint StatCard and QuickActionsCard).
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
      },
      // NOTE: no `boxShadow.brand` token. `app.css` declares a brand-tinted
      // shadow for `.btn-primary`, but it never renders — the pixels below a real
      // Viho button are pure #ffffff. Viho separates surfaces with borders, not
      // elevation. Don't reintroduce it from the CSS without checking a render.
      keyframes: {
        // Both pulses read the live brand variable — they were frozen rgba()
        // literals (emerald 16,185,129 and teal 36,105,92) that stayed green
        // under every other theme, the exact leak shape the UI_PATTERNS guard
        // grep is blind to. Un-frozen 2026-08-13 with the rest of the tints.
        "pulse-glow": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 0 0 rgb(var(--brand) / 0.7)",
          },
          "50%": {
            opacity: "0.8",
            boxShadow: "0 0 0 6px rgb(var(--brand) / 0)",
          },
        },
        "pulse-ring": {
          "0%": {
            boxShadow: "0 0 0 0 rgb(var(--brand) / 0.4)",
          },
          "70%": {
            boxShadow: "0 0 0 6px rgb(var(--brand) / 0)",
          },
          "100%": {
            boxShadow: "0 0 0 0 rgb(var(--brand) / 0)",
          },
        },
        "bounce-slow": {
          "0%, 100%": { 
            transform: "translateY(0)",
            animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)",
          },
          "50%": {
            transform: "translateY(-4px)",
            animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
          },
        },
        shimmer: {
          "0%": {
            backgroundPosition: "-1000px 0",
          },
          "100%": {
            backgroundPosition: "1000px 0",
          },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s infinite",
        "pulse-ring": "pulse-ring 2s infinite",
        "bounce-slow": "bounce-slow 2s infinite",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
