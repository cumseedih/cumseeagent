import type { Metadata, Viewport } from "next";
import { BRANDING } from "../branding.config";
import "./globals.css";

const SITE_URL = "https://agentdelv.in";
const SITE_DESCRIPTION =
  "Delvin is an approval-first coding agent for GitHub repositories. Connect a repository, plan work, run commands, and ship changes with confidence.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Delvin Agent — Approval-first coding agent",
    template: "%s | Delvin Agent",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Delvin Agent",
  keywords: ["coding agent", "AI coding agent", "GitHub coding agent", "repository automation", "developer tools"],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: {
    icon: [
      { url: BRANDING.FAVICON_PATH, sizes: "any" },
      { url: "/assets/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: BRANDING.APPLE_ICON_PATH, sizes: "180x180" }],
  },
  openGraph: {
    title: "Delvin Agent — Approval-first coding agent",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Delvin Agent",
    type: "website",
    locale: "en_US",
    images: [{ url: "/assets/og.png", width: 1200, height: 630, alt: "Delvin Agent coding workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Delvin Agent — Approval-first coding agent",
    description: SITE_DESCRIPTION,
    images: ["/assets/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FCFAF8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Delvin Agent",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    image: `${SITE_URL}/assets/og.png`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-primary text-text-primary antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
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
