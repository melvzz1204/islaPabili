import type { CSSProperties } from 'react';

/**
 * Minimal monochrome line-icon set for the admin console.
 * Every glyph is a 24×24 stroke drawing that inherits `currentColor`,
 * so icons tint to whatever text color sits around them — the backbone
 * of the premium, restrained look.
 */

const PATHS = {
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  receipt: (
    <>
      <path d="M7 3h10a1 1 0 0 1 1 1v16l-2.3-1.4-2.1 1.4-2.1-1.4-2.1 1.4L6 20V4a1 1 0 0 1 1-1z" />
      <path d="M9.5 8h5M9.5 11.5h5" />
    </>
  ),
  bike: (
    <>
      <circle cx="5.5" cy="17.5" r="3.3" />
      <circle cx="18.5" cy="17.5" r="3.3" />
      <circle cx="15" cy="5" r="1" />
      <path d="M12 17.5V13l-3-2.5 4-3 2.5 3.5H18" />
    </>
  ),
  store: (
    <>
      <path d="M3.5 9 4.6 4.4A1 1 0 0 1 5.6 3.6h12.8a1 1 0 0 1 1 .8L20.5 9" />
      <path d="M4.5 9v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9" />
      <path d="M3.5 9h17" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
      <circle cx="9.5" cy="7" r="3.6" />
      <path d="M21 20v-1.5a4 4 0 0 0-3-3.86" />
      <path d="M16 3.64a4 4 0 0 1 0 7.2" />
    </>
  ),
  user: (
    <>
      <path d="M19 20v-1.5a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V20" />
      <circle cx="12" cy="7.5" r="3.8" />
    </>
  ),
  wallet: (
    <>
      <path d="M19 8V6.5A1.5 1.5 0 0 0 17.5 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19h12a1.5 1.5 0 0 0 1.5-1.5V16" />
      <path d="M20.5 11h-4a2.5 2.5 0 0 0 0 5h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.6M12 18.9v2.6M4.2 4.2l1.9 1.9M17.9 17.9l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.2 19.8l1.9-1.9M17.9 6.1l1.9-1.9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4.5V9H16" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
      <path d="M16 16.5 20.5 12 16 7.5" />
      <path d="M20.5 12H9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevronRight: <path d="M9.5 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  peso: (
    <>
      <path d="M8 21V4h4.4a4.3 4.3 0 0 1 0 8.6H8" />
      <path d="M5 8.3h11" />
      <path d="M5 11.6h11" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  star: (
    <path d="M12 3l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.77 6.8 19l.99-5.78-4.21-4.1 5.82-.85z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18.5" r="2.8" />
      <circle cx="18" cy="5.5" r="2.8" />
      <path d="M8.8 18.5h8.2a3.3 3.3 0 0 0 0-6.6H7a3.3 3.3 0 0 1 0-6.6h8.2" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v4c0 1.66 2.69 3 6 3s6-1.34 6-3V7" />
      <path d="M9 14v4c0 1.66 2.69 3 6 3s6-1.34 6-3v-7" />
      <path d="M15 11c3.31 0 6-1.34 6-3s-2.69-3-6-3" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 7h16a1 1 0 0 1 1 1v2.4a1.6 1.6 0 0 0 0 3.2V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.4a1.6 1.6 0 0 0 0-3.2V8a1 1 0 0 1 1-1z" />
      <path d="M14 7.5v9" />
    </>
  ),
  swap: (
    <>
      <path d="M7 8.5h13M16.5 5l3.5 3.5-3.5 3.5" />
      <path d="M17 15.5H4M7.5 12 4 15.5 7.5 19" />
    </>
  ),
  box: (
    <>
      <path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5L12 2.5z" />
      <path d="M3.8 7.3 12 12l8.2-4.7" />
      <path d="M12 12v9.5" />
    </>
  ),
  message: (
    <path d="M20.5 14.5a2 2 0 0 1-2 2H8l-4.5 4V5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
  ),
  inbox: (
    <>
      <path d="M21.5 12H16l-2 3h-4l-2-3H2.5" />
      <path d="M5.6 5.1 2.5 12v6a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-6l-3.1-6.9A2 2 0 0 0 16.6 4H7.4a2 2 0 0 0-1.8 1.1z" />
    </>
  ),
  pause: <path d="M8.5 5v14M15.5 5v14" />,
  play: <path d="M7.5 5.5l11 6.5-11 6.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="2.5" width="8" height="4" rx="1.2" />
      <path d="M16 4.5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2" />
      <path d="M8.5 11h.01M12 11h3.5M8.5 15h.01M12 15h3.5" />
    </>
  ),
  spark: (
    <path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2" />
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
