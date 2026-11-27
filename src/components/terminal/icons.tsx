import type { ReactNode, SVGProps } from "react";

// Thin-line icon set drawn on a 28px grid, in the style of the TradingView toolbars.
// Every icon inherits `currentColor`, so colours come from the surrounding CSS.

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function icon(name: string, body: ReactNode) {
  const Icon = ({ size = 28, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {body}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
}

const dot = (cx: number, cy: number, r = 1.5) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

// ---- cursors & drawing tools ----------------------------------------------

export const CursorIcon = icon("CursorIcon",
  <path d="M9.5 6.5v14.2l3.6-3.4 2.7 5.4 2.3-1.1-2.6-5.3 4.9-.2z" />);

export const CrosshairIcon = icon("CrosshairIcon", <>
  <path d="M14 5.5v6.5M14 16v6.5M5.5 14H12M16 14h6.5" />
  {dot(14, 14, 1.1)}
</>);

export const TrendLineIcon = icon("TrendLineIcon", <>
  <circle cx="7.5" cy="20.5" r="2.2" />
  <circle cx="20.5" cy="7.5" r="2.2" />
  <path d="M9.1 18.9 18.9 9.1" />
</>);

export const RectangleIcon = icon("RectangleIcon", <>
  <path d="M8 10.5h12v8H8z" />
  <path d="M6.5 9h3v3h-3zM18.5 17h3v3h-3z" fill="currentColor" />
</>);

export const FibonacciIcon = icon("FibonacciIcon", <>
  <path d="M6 7.5h16M6 12.5h16M6 17.5h16M6 22.5h16" />
  <path d="M9 22 19 7.5" />
  {dot(9, 22, 1.7)}
  {dot(19, 7.5, 1.7)}
</>);

export const EyeIcon = icon("EyeIcon", <>
  <path d="M4.5 14C7 9.5 10.3 7.5 14 7.5s7 2 9.5 6.5c-2.5 4.5-5.8 6.5-9.5 6.5S7 18.5 4.5 14z" />
  <circle cx="14" cy="14" r="3" />
</>);

export const EyeOffIcon = icon("EyeOffIcon", <>
  <path d="M4.5 14C7 9.5 10.3 7.5 14 7.5s7 2 9.5 6.5c-2.5 4.5-5.8 6.5-9.5 6.5S7 18.5 4.5 14z" />
  <circle cx="14" cy="14" r="3" />
  <path d="M6 22 22 6" />
</>);

export const TrashIcon = icon("TrashIcon", <>
  <path d="M7.5 9.5h13M11.5 9.5V7h5v2.5" />
  <path d="M9 9.5l.9 12h8.2l.9-12" />
  <path d="M12.3 12.5v6.5M15.7 12.5v6.5" />
</>);

export const BookmarkIcon = icon("BookmarkIcon",
  <path d="M9.5 6.5h9v15.2L14 18l-4.5 3.7z" />);

// ---- top toolbar ------------------------------------------------------------

export const SearchIcon = icon("SearchIcon", <>
  <circle cx="12.5" cy="12.5" r="5.5" />
  <path d="m16.6 16.6 5 5" />
</>);

export const PlusIcon = icon("PlusIcon", <path d="M14 7.5v13M7.5 14h13" />);

export const PlusCircleIcon = icon("PlusCircleIcon", <>
  <circle cx="14" cy="14" r="8" />
  <path d="M14 10.5v7M10.5 14h7" />
</>);

export const CandlesIcon = icon("CandlesIcon", <>
  <path d="M10 5.5v3.5M10 17v5.5M7.5 9h5v8h-5z" />
  <path d="M18 8v3.5M18 19.5V23M15.5 11.5h5v8h-5z" />
</>);

export const IndicatorsIcon = icon("IndicatorsIcon", <>
  <path d="M5 19c2.4-1.2 3.6-5.6 5.6-5.6S13 18 15.4 18c2.2 0 3-4.6 4.4-7.6" />
  <path d="M21.5 6v6M18.5 9h6" />
</>);

export const AlertIcon = icon("AlertIcon", <>
  <circle cx="14" cy="15" r="6.3" />
  <path d="M14 11.7V15l2.3 1.6" />
  <path d="m6.2 9.3 3-2.6M21.8 9.3l-3-2.6" />
  <path d="m9.5 21.2-1.4 1.8M18.5 21.2l1.4 1.8" />
</>);

export const ReplayIcon = icon("ReplayIcon", <>
  <path d="M13 8.5 6.5 14l6.5 5.5z" />
  <path d="M21.5 8.5 15 14l6.5 5.5z" />
</>);

export const UndoIcon = icon("UndoIcon", <>
  <path d="M10.5 9.5h7a4.5 4.5 0 0 1 0 9H11" />
  <path d="m13.5 6.5-3 3 3 3" />
</>);

export const RedoIcon = icon("RedoIcon", <>
  <path d="M17.5 9.5h-7a4.5 4.5 0 0 0 0 9H17" />
  <path d="m14.5 6.5 3 3-3 3" />
</>);

export const LayoutIcon = icon("LayoutIcon", <>
  <path d="M6.5 7.5h15v13h-15z" />
  <path d="M14 7.5v13M6.5 14h15" />
</>);

export const FullscreenIcon = icon("FullscreenIcon", <>
  <path d="M7 11V7h4M17 7h4v4M21 17v4h-4M11 21H7v-4" />
</>);

export const SettingsIcon = icon("SettingsIcon", <>
  <circle cx="14" cy="14" r="2.6" />
  <path d="M14 6.2v2.1M14 19.7v2.1M6.2 14h2.1M19.7 14h2.1M8.5 8.5l1.5 1.5M18 18l1.5 1.5M8.5 19.5 10 18M18 10l1.5-1.5" />
  <circle cx="14" cy="14" r="5.5" />
</>);

export const MoreIcon = icon("MoreIcon", <>
  {dot(7.5, 14, 1.4)}
  {dot(14, 14, 1.4)}
  {dot(20.5, 14, 1.4)}
</>);

export const CodeIcon = icon("CodeIcon", <>
  <path d="m11 9-5 5 5 5M17 9l5 5-5 5" />
  <path d="m15.4 7.5-2.8 13" />
</>);

// ---- small controls ----------------------------------------------------------

export const ChevronDownIcon = icon("ChevronDownIcon", <path d="m10 12 4 4 4-4" />);
export const ChevronLeftIcon = icon("ChevronLeftIcon", <path d="m16 9-5 5 5 5" />);
export const CloseIcon = icon("CloseIcon", <path d="m9.5 9.5 9 9M18.5 9.5l-9 9" />);
export const PlayIcon = icon("PlayIcon", <path d="M10.5 8v12l10-6z" fill="currentColor" />);

export const StarIcon = icon("StarIcon",
  <path d="m14 6.5 2.2 4.9 5.3.5-4 3.6 1.2 5.3L14 18l-4.7 2.8 1.2-5.3-4-3.6 5.3-.5z" />);

export const ClockIcon = icon("ClockIcon", <>
  <circle cx="14" cy="14" r="8" />
  <path d="M14 9.5V14l3 2" />
</>);

export const HelpIcon = icon("HelpIcon", <>
  <circle cx="14" cy="14" r="8" />
  <path d="M11.8 11.6a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 1.9" />
  {dot(14, 18.6, 0.9)}
</>);

// ---- right toolbar -----------------------------------------------------------

export const WatchlistIcon = icon("WatchlistIcon", <>
  {dot(7.5, 9, 1)}
  {dot(7.5, 14, 1)}
  {dot(7.5, 19, 1)}
  <path d="M11.5 9h10M11.5 14h10M11.5 19h10" />
</>);

export const ObjectTreeIcon = icon("ObjectTreeIcon", <>
  <path d="m14 6 8 4-8 4-8-4z" />
  <path d="m6 14 8 4 8-4M6 18l8 4 8-4" />
</>);

export const CalendarIcon = icon("CalendarIcon", <>
  <path d="M6.5 8.5h15v13h-15zM6.5 12.5h15M10.5 6v4M17.5 6v4" />
  {dot(10.5, 16, 0.9)}
  {dot(14, 16, 0.9)}
  {dot(17.5, 16, 0.9)}
</>);

export const GridIcon = icon("GridIcon",
  <path d="M7 7h5.5v5.5H7zM15.5 7H21v5.5h-5.5zM7 15.5h5.5V21H7zM15.5 15.5H21V21h-5.5z" />);

// ---- brand -------------------------------------------------------------------

export const BrandMark = icon("BrandMark", <>
  <path d="M9.5 5.5v3M9.5 17v5.5M7.5 8.5h4v8.5h-4z" />
  <path d="M18.5 7.5v3M18.5 18.5v3M16.5 10.5h4v8h-4z" />
</>);
