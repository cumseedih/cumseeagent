// Central branding config — change only here + env
export const BRANDING = {
  PRODUCT_NAME: process.env.NEXT_PUBLIC_PRODUCT_NAME || process.env.PRODUCT_NAME || "Delvin",
  PRODUCT_DOMAIN: process.env.NEXT_PUBLIC_PRODUCT_DOMAIN || process.env.PRODUCT_DOMAIN || "delvin.local",
  LOGO_PATH: process.env.NEXT_PUBLIC_LOGO_PATH || process.env.LOGO_PATH || "/assets/delvin-logo.jpg",
  FAVICON_PATH: process.env.NEXT_PUBLIC_FAVICON_PATH || process.env.FAVICON_PATH || "/assets/delvin-logo.jpg",
  PRIMARY_COLOR: process.env.NEXT_PUBLIC_PRIMARY_COLOR || process.env.PRIMARY_COLOR || "#2e2b29",
  ACCENT_COLOR: process.env.NEXT_PUBLIC_ACCENT_COLOR || process.env.ACCENT_COLOR || "#ffc800",
} as const;
