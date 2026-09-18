/**
 * Central branding config — change only here + env.
 *
 * Visual language follows the Arena agent workspace (dark editorial surfaces,
 * hero serif headline, highlight block); the palette keeps Delvin's brand
 * accent so the identity stays yours.
 */
export const BRANDING = {
  PRODUCT_NAME: process.env.NEXT_PUBLIC_PRODUCT_NAME || process.env.PRODUCT_NAME || "Delvin",
  PRODUCT_TAGLINE: process.env.NEXT_PUBLIC_PRODUCT_TAGLINE || "Autonomous coding agent workspace",
  PRODUCT_DOMAIN: process.env.NEXT_PUBLIC_PRODUCT_DOMAIN || process.env.PRODUCT_DOMAIN || "delvin.local",
  LOGO_PATH: process.env.NEXT_PUBLIC_LOGO_PATH || process.env.LOGO_PATH || "/assets/delvin-logo.jpg",
  FAVICON_PATH: process.env.NEXT_PUBLIC_FAVICON_PATH || process.env.FAVICON_PATH || "/assets/favicon.ico",

  // "H S% L%" channels consumed by the CSS custom properties in globals.css
  PRIMARY_COLOR: process.env.NEXT_PUBLIC_PRIMARY_COLOR || process.env.PRIMARY_COLOR || "24 5% 18%",
  ACCENT_COLOR: process.env.NEXT_PUBLIC_ACCENT_COLOR || process.env.ACCENT_COLOR || "48 100% 50%",
  HIGHLIGHT_COLOR: process.env.NEXT_PUBLIC_HIGHLIGHT_COLOR || process.env.HIGHLIGHT_COLOR || "48 100% 50%",

  // Hero copy — the highlight block renders HERO_TITLE_HIGHLIGHT
  HERO_TITLE_LEAD: process.env.NEXT_PUBLIC_HERO_TITLE_LEAD || "Experience",
  HERO_TITLE_TAIL: process.env.NEXT_PUBLIC_HERO_TITLE_TAIL || "the",
  HERO_TITLE_HIGHLIGHT: process.env.NEXT_PUBLIC_HERO_TITLE_HIGHLIGHT || "frontier",
  HERO_SUBTITLE:
    process.env.NEXT_PUBLIC_HERO_SUBTITLE ||
    "Connect a repository, pick a harness and model, then let the agent plan, run commands and ship changes — every risky step gated by your approval.",

  SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@delvin.local",
} as const;

export type Branding = typeof BRANDING;
