// Central branding config — change only here + env
export const BRANDING = {
  PRODUCT_NAME: process.env.NEXT_PUBLIC_PRODUCT_NAME || process.env.PRODUCT_NAME || "My Agent",
  PRODUCT_DOMAIN: process.env.NEXT_PUBLIC_PRODUCT_DOMAIN || process.env.PRODUCT_DOMAIN || "localhost",
  LOGO_PATH: process.env.NEXT_PUBLIC_LOGO_PATH || process.env.LOGO_PATH || "/assets/logo.svg",
  FAVICON_PATH: process.env.NEXT_PUBLIC_FAVICON_PATH || process.env.FAVICON_PATH || "/assets/favicon.ico",
  PRIMARY_COLOR: process.env.NEXT_PUBLIC_PRIMARY_COLOR || process.env.PRIMARY_COLOR || "#0ea5e9",
  ACCENT_COLOR: process.env.NEXT_PUBLIC_ACCENT_COLOR || process.env.ACCENT_COLOR || "#06b6d4",
} as const;
