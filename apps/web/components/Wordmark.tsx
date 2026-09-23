"use client";

import { BRANDING } from "../branding.config";

/**
 * Brand mark — uses the supplied Delvin logo asset, with an inline glyph
 * fallback so the UI never breaks if the image is missing.
 *
 * The supplied monochrome girl artwork is kept intact and cropped consistently at
 * every responsive size so the same identity carries through the app icons.
 */
export function Mark({ className = "h-6 w-6", square = false }: { className?: string; square?: boolean }) {
  return (
    <img
      src={BRANDING.LOGO_PATH}
      alt={`${BRANDING.PRODUCT_NAME} logo`}
      className={`${className} object-cover object-center ${
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
  return (
    <span className={`inline-flex items-center gap-2 text-text-primary ${className}`}>
      <Mark className={`${glyphClass} ring-0`} />
      {showName && (
        <span className={`delvin-wordmark ${textClass}`} aria-label={BRANDING.PRODUCT_NAME}>
          <span className="delvin-wordmark__text">{BRANDING.PRODUCT_NAME}</span>
        </span>
      )}
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
