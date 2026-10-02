"use client";

import { BRANDING } from "../branding.config";

/**
 * Brand mark — uses the supplied Delvin logo asset, with an inline glyph
 * fallback so the UI never breaks if the image is missing.
 *
 * The supplied Delvin portrait is cropped consistently at every responsive size
 * so the same identity carries through the app icons.
 */
export function Mark({ className = "h-6 w-6", square = false }: { className?: string; square?: boolean }) {
  return (
    <img
      src={BRANDING.LOGO_PATH}
      alt={`${BRANDING.PRODUCT_NAME} logo`}
      className={`${className} delvin-brand-portrait object-cover object-[50%_30%] ${
        square ? "rounded-md" : "rounded-full"
      } ring-1 ring-border-faint`}
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
  if (showName) {
    return (
      <span className={`inline-flex items-center text-text-primary ${className}`}>
        <img
          src="/assets/delvin-saturn-lockup.svg"
          alt={`${BRANDING.PRODUCT_NAME} logo`}
          className="h-8 w-auto max-w-[132px] object-contain object-left"
        />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 text-text-primary ${className}`}>
      <Mark className={`${glyphClass} ring-0`} />
      <span className={`sr-only ${textClass}`}>{BRANDING.PRODUCT_NAME}</span>
    </span>
  );
}

/**
 * Large mark shown above the hero headline.
 *
 * No glow behind it — the reference mark sits plain on the canvas, and a
 * coloured halo would fight the artwork.
 */
export function HeroMark({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Mark className="h-full w-full" square />
    </div>
  );
}
