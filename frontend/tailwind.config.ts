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
        brand: {
          DEFAULT: "#24695c", // Viho --theme-deafult
          dark: "#17433b", // its own hover shade
          darker: "#10302a",
          light: "#236559",
          // Brand text/icons on a DARK surface must not use the base brand:
          // #24695c on the #111727 card is 2.83:1 and fails AA outright. This is
          // Viho's own light teal — it uses it for the primary button's focus
          // ring (`0 0 0 .2rem #5ec8b4`) — and it scores 9.03:1 on that card.
          // Use `dark:text-brand-on-dark` wherever brand text sits on night.card.
          "on-dark": "#5ec8b4",
        },
        accent: {
          DEFAULT: "#ba895d", // Viho --theme-secondary
          dark: "#a07044",
          light: "#d1b093",
        },
        surface: {
          page: "#f5f7fb",
          card: "#ffffff",
          border: "#e6edef", // one border colour for the whole light system
          divider: "#efefef",
          wash: "#eaf0ef", // brand at 10% flattened over white
          tile: "#eff3f2", // brand at 8% — social tiles
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
          border: "#142831", // brand at 20% over the dark card
          muted: "#98a6ad",
        },
        // The six semantic tones double as Viho's categorical palette. Adopted
        // as-is including the two odd ones: `success` is a dark primary shade
        // rather than a green, and `info` is grey rather than blue. Both pass
        // contrast; see VIHO_ADOPTION_PLAN.md for why fidelity won here.
        tone: {
          success: "#1b4c43",
          danger: "#d22d3d",
          warning: "#e2c636",
          info: "#717171",
          light: "#e6edef",
          dark: "#2c323f",
        },
      },
      // NOTE: no `boxShadow.brand` token. `app.css` declares a brand-tinted
      // shadow for `.btn-primary`, but it never renders — the pixels below a real
      // Viho button are pure #ffffff. Viho separates surfaces with borders, not
      // elevation. Don't reintroduce it from the CSS without checking a render.
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { 
            opacity: "1",
            boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.7)",
          },
          "50%": { 
            opacity: "0.8",
            boxShadow: "0 0 0 6px rgba(16, 185, 129, 0)",
          },
        },
        // Retinted from orange rgba(249,115,22) to brand teal with the palette.
        "pulse-ring": {
          "0%": {
            boxShadow: "0 0 0 0 rgba(36, 105, 92, 0.4)",
          },
          "70%": {
            boxShadow: "0 0 0 6px rgba(36, 105, 92, 0)",
          },
          "100%": {
            boxShadow: "0 0 0 0 rgba(36, 105, 92, 0)",
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
