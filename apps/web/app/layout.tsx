import type { Metadata, Viewport } from "next";
import { BRANDING } from "../branding.config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (BRANDING.PRODUCT_DOMAIN === "localhost" ? "http://localhost:3000" : `https://${BRANDING.PRODUCT_DOMAIN}`)
  ),
  title: `${BRANDING.PRODUCT_NAME} Agent`,
  description: BRANDING.HERO_SUBTITLE,
  icons: {
    icon: [
      { url: BRANDING.FAVICON_PATH, sizes: "any" },
      { url: "/assets/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: BRANDING.APPLE_ICON_PATH, sizes: "180x180" }],
  },
  openGraph: {
    title: `${BRANDING.PRODUCT_NAME} Agent`,
    description: BRANDING.HERO_SUBTITLE,
    url: `https://${BRANDING.PRODUCT_DOMAIN}`,
    siteName: BRANDING.PRODUCT_NAME,
    type: "website",
    images: [{ url: BRANDING.OG_IMAGE_PATH, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [BRANDING.OG_IMAGE_PATH] },
};

export const viewport: Viewport = {
  themeColor: "#FCFAF8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-primary text-text-primary antialiased">
        {/* Brand channels + font stacks are injected once; components read CSS vars only. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{
  --primary:${BRANDING.PRIMARY_COLOR};
  --accent:${BRANDING.ACCENT_COLOR};
  --highlight:${BRANDING.HIGHLIGHT_COLOR};
}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
