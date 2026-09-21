import type { Config } from "tailwindcss";

/**
 * Tailwind theme wired to the CSS custom properties in app/globals.css.
 * Tokens are stored as bare "H S% L%" channels so opacity modifiers work
 * (e.g. bg-surface-secondary/60) and so branding can retheme at runtime.
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          primary: "hsl(var(--surface-primary) / <alpha-value>)",
          secondary: "hsl(var(--surface-secondary) / <alpha-value>)",
          tertiary: "hsl(var(--surface-tertiary) / <alpha-value>)",
          floating: "hsl(var(--surface-floating) / <alpha-value>)",
          raised: "hsl(var(--surface-raised) / <alpha-value>)",
          "raised-tertiary": "hsl(var(--surface-raised-tertiary) / <alpha-value>)",
          skeleton: "hsl(var(--surface-skeleton) / <alpha-value>)",
          highlight: "hsl(var(--surface-highlight) / <alpha-value>)",
        },
        text: {
          primary: "hsl(var(--text-primary) / <alpha-value>)",
          secondary: "hsl(var(--text-secondary) / <alpha-value>)",
          tertiary: "hsl(var(--text-tertiary) / <alpha-value>)",
          muted: "hsl(var(--text-muted) / <alpha-value>)",
          placeholder: "hsl(var(--text-placeholder) / <alpha-value>)",
        },
        border: {
          faint: "hsl(var(--border-faint) / <alpha-value>)",
          medium: "hsl(var(--border-medium) / <alpha-value>)",
          strong: "hsl(var(--border-strong) / <alpha-value>)",
        },
        interactive: {
          normal: "hsl(var(--interactive-normal) / <alpha-value>)",
          active: "hsl(var(--interactive-active) / <alpha-value>)",
          link: "hsl(var(--interactive-link) / <alpha-value>)",
          positive: "hsl(var(--interactive-positive) / <alpha-value>)",
          negative: "hsl(var(--interactive-negative) / <alpha-value>)",
          warning: "hsl(var(--interactive-warning) / <alpha-value>)",
          cta: "hsl(var(--interactive-cta) / <alpha-value>)",
          "cta-hover": "hsl(var(--interactive-cta-hover) / <alpha-value>)",
          "on-cta": "hsl(var(--interactive-on-cta) / <alpha-value>)",
          "cta-secondary": "hsl(var(--interactive-cta-secondary) / <alpha-value>)",
          "cta-secondary-hover": "hsl(var(--interactive-cta-secondary-hover) / <alpha-value>)",
        },
        highlight: {
          DEFAULT: "hsl(var(--highlight) / <alpha-value>)",
          foreground: "hsl(var(--highlight-text) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          accent: "hsl(var(--sidebar-accent) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        primary: "hsl(var(--primary) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
        ui: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        xs: "3px",
        sm: "4px",
        composer: "14px",
        panel: "10px",
      },
      boxShadow: {
        floating: "0 18px 40px -18px rgb(0 0 0 / 0.75)",
        card: "0 1px 0 0 rgb(255 255 255 / 0.03) inset",
        glow: "0 0 0 1px hsl(var(--border-medium)), 0 12px 32px -16px rgb(0 0 0 / 0.9)",
      },
      keyframes: {
        shimmer: {
          "0%": { opacity: "0.45" },
          "50%": { opacity: "0.9" },
          "100%": { opacity: "0.45" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "slide-up": "slide-up 180ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
