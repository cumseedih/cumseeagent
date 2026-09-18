import type { Metadata, Viewport } from "next";
import { BRANDING } from "../branding.config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BRANDING.PRODUCT_NAME} — Agent Mode`,
  description: BRANDING.HERO_SUBTITLE,
  icons: { icon: BRANDING.FAVICON_PATH },
  openGraph: {
    title: `${BRANDING.PRODUCT_NAME} — Agent Mode`,
    description: BRANDING.HERO_SUBTITLE,
    url: `https://${BRANDING.PRODUCT_DOMAIN}`,
    siteName: BRANDING.PRODUCT_NAME,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#252522",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
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
