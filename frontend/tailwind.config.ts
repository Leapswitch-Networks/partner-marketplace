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
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#F97316",
          dark: "#EA6C0A",
        },
      },
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
        "pulse-ring": {
          "0%": {
            boxShadow: "0 0 0 0 rgba(249, 115, 22, 0.4)",
          },
          "70%": {
            boxShadow: "0 0 0 6px rgba(249, 115, 22, 0)",
          },
          "100%": {
            boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)",
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
