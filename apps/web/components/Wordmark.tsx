"use client";

import { BRANDING } from "../branding.config";

/**
 * Brand mark — uses the supplied Delvin logo asset, with an inline glyph
 * fallback so the UI never breaks if the image is missing.
 */
export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <img
      src={BRANDING.LOGO_PATH}
      alt={`${BRANDING.PRODUCT_NAME} logo`}
      className={`${className} rounded-md object-cover object-center ring-1 ring-border-medium`}
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
    />
  );
}

export function Wordmark({
  className = "",
  glyphClass = "h-6 w-6",
  textClass = "text-[15px] tracking-tight",
  showName = true,
}: {
  className?: string;
  glyphClass?: string;
  textClass?: string;
  showName?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 text-text-primary ${className}`}>
      <Mark className={`${glyphClass} ring-0`} />
      {showName && (
        <span className={`font-display font-medium uppercase ${textClass}`} style={{ letterSpacing: "0.16em" }}>
          {BRANDING.PRODUCT_NAME}
        </span>
      )}
    </span>
  );
}

/** Large mark shown above the hero headline. */
export function HeroMark({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute inset-0 -z-10 rounded-full opacity-40 blur-2xl"
        style={{ background: "radial-gradient(closest-side, hsl(var(--highlight) / 0.5), transparent)" }}
      />
      <Mark className="h-full w-full rounded-2xl" />
    </div>
  );
}
