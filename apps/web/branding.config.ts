/**
 * Central branding config — change only here + env.
 *
 * The workspace uses Arena's restrained agent layout while every visible
 * identity token—artwork, type and the Earthy Minimal palette—belongs to Delvin.
 */
export const BRANDING = {
  PRODUCT_NAME: process.env.NEXT_PUBLIC_PRODUCT_NAME || process.env.PRODUCT_NAME || "Delvin",
  PRODUCT_TAGLINE: process.env.NEXT_PUBLIC_PRODUCT_TAGLINE || "Autonomous coding agent workspace",
  PRODUCT_DOMAIN: process.env.NEXT_PUBLIC_PRODUCT_DOMAIN || process.env.PRODUCT_DOMAIN || "delvin.local",
  LOGO_PATH: process.env.NEXT_PUBLIC_LOGO_PATH || process.env.LOGO_PATH || "/assets/logo.png",
  FAVICON_PATH: process.env.NEXT_PUBLIC_FAVICON_PATH || process.env.FAVICON_PATH || "/assets/favicon.ico",
  APPLE_ICON_PATH: "/assets/apple-touch-icon.png",
  OG_IMAGE_PATH: "/assets/og.png",

  // "H S% L%" channels consumed by the CSS custom properties in globals.css
  PRIMARY_COLOR: "125 12% 20%",
  ACCENT_COLOR: "16 53% 55%",
  HIGHLIGHT_COLOR: "35 34% 77%",

  // Hero copy — the highlight block renders HERO_TITLE_HIGHLIGHT
  HERO_TITLE_LEAD: process.env.NEXT_PUBLIC_HERO_TITLE_LEAD || "Experience",
  HERO_TITLE_TAIL: process.env.NEXT_PUBLIC_HERO_TITLE_TAIL || "the",
  HERO_TITLE_HIGHLIGHT: process.env.NEXT_PUBLIC_HERO_TITLE_HIGHLIGHT || "frontier",
  HERO_SUBTITLE:
    process.env.NEXT_PUBLIC_HERO_SUBTITLE ||
    "Connect a repository and let the agent plan, run commands and ship changes — every risky step gated by your approval.",

  SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "help@agentdelv.in",
} as const;

export type Branding = typeof BRANDING;
