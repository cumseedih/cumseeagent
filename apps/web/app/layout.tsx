import type { Metadata } from "next";
import { BRANDING } from "../branding.config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BRANDING.PRODUCT_NAME} — AI Coding Agent`,
  description: `Chat with ${BRANDING.PRODUCT_NAME} and build projects through a secure VPS terminal.`,
  icons: { icon: BRANDING.FAVICON_PATH },
  openGraph: {
    title: `${BRANDING.PRODUCT_NAME} — AI Coding Agent`,
    description: `Autonomous coding agent workspace powered by ${BRANDING.PRODUCT_NAME}`,
    url: `https://${BRANDING.PRODUCT_DOMAIN}`,
    siteName: BRANDING.PRODUCT_NAME,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0b0e14] text-[#e6e8ee] antialiased">
        <style>{`:root{--primary:${BRANDING.PRIMARY_COLOR};--accent:${BRANDING.ACCENT_COLOR}}`}</style>
        {children}
      </body>
    </html>
  );
}
