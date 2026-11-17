import type { ReactNode } from "react";

/** The app's own small icon set: 24px, round 2px strokes. */
const paths = {
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
  bell: <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15zm4 4.5a2 2 0 0 0 4 0" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
    </>
  ),
  crown: <path d="m4 18 -1.2-9.5 5.4 4L12 5l3.8 7.5 5.4-4L20 18Z" />,
  enterFullscreen: <path d="M4 9V4h5m11 5V4h-5M4 15v5h5m11-5v5h-5" />,
  exitFullscreen: <path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5" />,
  external: (
    <path d="M14 5h5v5m0-5-8.5 8.5M11 7H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  minus: <path d="M5 12h14" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" />,
  plus: <path d="M12 5v14M5 12h14" />,
  soundOff: <path d="M4 10v4h3l5 4V6l-5 4zm12-.5 5 5m0-5-5 5" />,
  soundOn: <path d="M4 10v4h3l5 4V6l-5 4zm12-1a4 4 0 0 1 0 6m2.5-8.5a8 8 0 0 1 0 11" />,
  trash: (
    <path d="M4 7h16M10 11v6m4-6v6M6 7l1 11.5a2 2 0 0 0 2 1.5h6a2 2 0 0 0 2-1.5L18 7M9 7V4h6v3" />
  ),
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  className,
}: {
  readonly name: IconName;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
