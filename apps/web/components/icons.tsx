"use client";

/**
 * Inline stroke icon set (16–20px grid, currentColor).
 * Hand-authored simple geometry — keeps the bundle dependency-free and offline.
 */
type IconProps = { className?: string; size?: number; strokeWidth?: number };

function Base({
  children,
  className = "h-4 w-4",
  size,
  strokeWidth = 1.6,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconPlusChat = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 11.5a8.5 8.5 0 1 1-3.6-6.9" />
    <path d="M3.2 20.8l3.9-1a8.5 8.5 0 0 0 2.4.7" />
    <path d="M12 8.5v6M9 11.5h6" />
  </Base>
);

export const IconTrophy = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
    <path d="M8 5.5H5.5a2.5 2.5 0 0 0 2.5 4.5" />
    <path d="M16 5.5h2.5a2.5 2.5 0 0 1-2.5 4.5" />
    <path d="M12 13v3M9 20h6M10.5 16h3l.5 4h-4l.5-4z" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Base>
);

export const IconPanelLeft = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9.5 4v16" />
  </Base>
);

export const IconPaperclip = (p: IconProps) => (
  <Base {...p}>
    <path d="M20.5 11.5l-8 8a4.95 4.95 0 0 1-7-7l8.5-8.5a3.54 3.54 0 0 1 5 5l-8.5 8.5a2.12 2.12 0 0 1-3-3l7.5-7.5" />
  </Base>
);

export const IconCloudUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 13v8" />
    <path d="M8 17l4-4 4 4" />
    <path d="M5.2 18.4A4.6 4.6 0 0 1 6.4 9.4a6 6 0 0 1 11.5 1.5 4 4 0 0 1-.6 8" />
  </Base>
);

export const IconSendArrow = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12h18" />
    <path d="M13 4l8 8-8 8" />
  </Base>
);

export const IconStop = (p: IconProps) => (
  <Base {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.8" />
  </Base>
);

export const IconTerminal = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="M7.5 10l2.5 2.5-2.5 2.5M12.5 15h4" />
  </Base>
);

export const IconGitBranch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="7" cy="6" r="2.2" />
    <circle cx="7" cy="18" r="2.2" />
    <circle cx="17" cy="10" r="2.2" />
    <path d="M7 8.2v7.6M9.2 6.5h5.3a2.5 2.5 0 0 1 2.5 2.5v0" />
  </Base>
);

export const IconFolder = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2l1.8 2h8A2 2 0 0 1 20.5 9.5v7A2 2 0 0 1 18.5 18.5h-13a2 2 0 0 1-2-2v-9z" />
  </Base>
);

export const IconFile = (p: IconProps) => (
  <Base {...p}>
    <path d="M13.5 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10l-5.5-5.5z" />
    <path d="M13.5 4.5V10H19" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 13l4.5 4.5L19 7" />
  </Base>
);

export const IconX = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </Base>
);

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5l7 2.5v5.5c0 4.2-2.9 7.6-7 8.9-4.1-1.3-7-4.7-7-8.9V6l7-2.5z" />
    <path d="M9 12.2l2.1 2.1L15.2 10" />
  </Base>
);

export const IconSparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7L12 3.5z" />
    <path d="M18.5 16.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" />
  </Base>
);

export const IconCpu = (p: IconProps) => (
  <Base {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
    <rect x="10" y="10" width="4" height="4" rx="1" />
    <path d="M10 3.5v2.5M14 3.5v2.5M10 18v2.5M14 18v2.5M3.5 10H6M3.5 14H6M18 10h2.5M18 14h2.5" />
  </Base>
);

export const IconGithub = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.88 1.52 2.34 1.08 2.9.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.96 0-1.1.39-2 1.03-2.7-.1-.26-.45-1.29.1-2.68 0 0 .84-.27 2.75 1.03a9.4 9.4 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.39.2 2.42.1 2.68.64.7 1.03 1.6 1.03 2.7 0 3.86-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2.2z" />
  </svg>
);

export const IconBolt = (p: IconProps) => (
  <Base {...p}>
    <path d="M13.5 3.5L6 13.5h5l-.5 7L18 10.5h-5l.5-7z" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4.5l8.5 14.5h-17L12 4.5z" />
    <path d="M12 10v4M12 16.8v.2" />
  </Base>
);

export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 12a8 8 0 1 1-2.5-5.8" />
    <path d="M20 4.5V10h-5.5" />
  </Base>
);
