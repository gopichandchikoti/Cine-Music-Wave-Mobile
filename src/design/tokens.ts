// Design tokens ported value-for-value from the web app's CSS (src/App.css, Music.css, Watch.css, Glass.css, Auth.css).
//
// Music and Watch have a dark theme (the approved design, unchanged) and a light theme. `music`, `watch` and `glass` are live objects: the
// theme provider copies the active palette into them before the tree renders, and every component reads them while it renders, so a theme
// change is one re-render from the app root. Surfaces that sit on video or artwork (the full-screen player, Watch's player and title page)
// read `musicDark` and `watchDark` instead and stay dark in both themes.

export type ThemeMode = 'dark' | 'light';

/** Sign-in / account screens and the profile menu (web: :root[data-theme='dark'] in App.css). */
export const paper = {
  paper: '#111917',
  raised: '#182321',
  ink: '#ebefe5',
  muted: '#91a19a',
  line: 'rgba(235, 239, 229, 0.1)',
  lineStrong: 'rgba(235, 239, 229, 0.18)',
  accent: '#ef825a',
  accentSoft: 'rgba(239, 130, 90, 0.14)',
  teal: '#6bb7a4',
  tealSoft: 'rgba(107, 183, 164, 0.13)',
  shadow: '0 30px 90px rgba(0, 0, 0, 0.28)',
} as const;

export type MusicPalette = {
  bg: string;
  ink: string;
  muted: string;
  line: string;
  surface: string;
  surfaceHover: string;
  accent: string;
  /** text and icons that sit on a `solid` fill */
  accentInk: string;
  /** the strong fill of primary controls: white on dark, near-black on light */
  solid: string;
  /** the colour of ordinary text (Txt's default) */
  text: string;
  /** a pressed menu row, and a quiet button inside a menu */
  pressed: string;
  quiet: string;
  /** text-field fill, slider track, dimmer behind dialogs */
  field: string;
  track: string;
  dimmer: string;
  /** the ring behind a spinner, and the small chevron on a menu button */
  ring: string;
  chevron: string;
  /** a row being dragged to a new place */
  lift: string;
  /** the full-screen player's page colour, and the track of a spinner drawn on a `solid` fill */
  stage: string;
  onSolidTrack: string;
  /** the shadows under the player's cover, a small cover beside text, and the round play button */
  shadowArt: string;
  shadowThumb: string;
  shadowButton: string;
  /** destructive text */
  danger: string;
  /** toast and floating chips */
  float: string;
  floatBorder: string;
  /** the shadows under covers, hero art and floating play buttons */
  shadowCover: string;
  shadowHero: string;
  shadowPlay: string;
  /** the wash behind everything, as three radial gradients (cover-coloured glows) */
  glowPink: string;
  glowViolet: string;
  glowTeal: string;
  /** the rounded panel that holds a page */
  panel: string;
};

const musicDark: MusicPalette = {
  bg: '#090a10',
  ink: '#f6f6fb',
  muted: 'rgba(246, 246, 251, 0.64)',
  line: 'rgba(255, 255, 255, 0.12)',
  surface: 'rgba(255, 255, 255, 0.06)',
  surfaceHover: 'rgba(255, 255, 255, 0.11)',
  accent: '#ff5c8a',
  accentInk: '#1a0610',
  solid: '#ffffff',
  text: '#ffffff',
  pressed: 'rgba(255, 255, 255, 0.14)',
  quiet: 'rgba(255, 255, 255, 0.1)',
  field: 'rgba(0, 0, 0, 0.25)',
  track: 'rgba(255, 255, 255, 0.22)',
  dimmer: 'rgba(4, 4, 10, 0.55)',
  ring: 'rgba(255, 255, 255, 0.2)',
  chevron: '#cccccc',
  lift: 'rgba(60, 62, 80, 0.95)',
  stage: '#07070b',
  onSolidTrack: 'rgba(26, 6, 16, 0.25)',
  shadowArt: '0 30px 80px rgba(0, 0, 0, 0.6)',
  shadowThumb: '0 8px 20px rgba(0, 0, 0, 0.5)',
  shadowButton: '0 6px 20px rgba(0, 0, 0, 0.4)',
  danger: '#ff8a9c',
  float: 'rgba(30, 32, 44, 0.92)',
  floatBorder: 'rgba(255, 255, 255, 0.2)',
  shadowCover: '0 10px 26px rgba(0, 0, 0, 0.4)',
  shadowHero: '0 24px 60px rgba(0, 0, 0, 0.5)',
  shadowPlay: '0 8px 20px rgba(0, 0, 0, 0.45)',
  glowPink: 'rgba(255, 92, 138, 0.28)',
  glowViolet: 'rgba(110, 90, 255, 0.26)',
  glowTeal: 'rgba(40, 190, 170, 0.2)',
  panel: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
};

// Light: a tinted neutral page (never pure white). Measured contrast on the page: ink 16.6:1, muted text 5.6:1, the accent #d6215d 4.5:1
// (the dark theme's #ff5c8a is too pale for a light page), text on the accent 4.8:1, danger text 5.4:1.
const musicLight: MusicPalette = {
  bg: '#f4f4f8',
  ink: '#14151f',
  muted: 'rgba(20, 21, 31, 0.66)',
  line: 'rgba(20, 21, 31, 0.12)',
  surface: 'rgba(20, 21, 31, 0.05)',
  surfaceHover: 'rgba(20, 21, 31, 0.09)',
  accent: '#d6215d',
  accentInk: '#fafafd',
  solid: '#14151f',
  text: '#14151f',
  pressed: 'rgba(20, 21, 31, 0.08)',
  quiet: 'rgba(20, 21, 31, 0.07)',
  field: 'rgba(20, 21, 31, 0.05)',
  track: 'rgba(20, 21, 31, 0.16)',
  dimmer: 'rgba(20, 21, 31, 0.38)',
  ring: 'rgba(20, 21, 31, 0.16)',
  chevron: 'rgba(20, 21, 31, 0.55)',
  lift: 'rgba(255, 255, 255, 0.98)',
  stage: '#eceef5',
  onSolidTrack: 'rgba(250, 250, 253, 0.3)',
  shadowArt: '0 24px 60px rgba(20, 21, 31, 0.3)',
  shadowThumb: '0 6px 16px rgba(20, 21, 31, 0.22)',
  shadowButton: '0 5px 16px rgba(20, 21, 31, 0.28)',
  danger: '#c4153c',
  float: 'rgba(255, 255, 255, 0.97)',
  floatBorder: 'rgba(20, 21, 31, 0.12)',
  shadowCover: '0 8px 22px rgba(20, 21, 31, 0.2)',
  shadowHero: '0 20px 48px rgba(20, 21, 31, 0.24)',
  shadowPlay: '0 6px 16px rgba(20, 21, 31, 0.28)',
  glowPink: 'rgba(255, 92, 138, 0.16)',
  glowViolet: 'rgba(110, 90, 255, 0.13)',
  glowTeal: 'rgba(40, 190, 170, 0.11)',
  panel: 'linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42))',
};

export type WatchPalette = {
  bg: string;
  raised: string;
  surface: string;
  surface2: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  accentHover: string;
  accentInk: string;
  warn: string;
  /** r, g, b of the veil that fades pictures into the page (the page colour itself) */
  veil: string;
  /** search box, icon buttons and the mode switch */
  field: string;
  /** the selected section tab */
  chip: string;
  /** the ring behind a spinner, and the unplayed part of a progress bar */
  track: string;
  /** floating notices */
  float: string;
  shadow: string;
  /** quiet button fills (rest, pressed) and the softer fill of an empty-state action */
  fill: string;
  fillPressed: string;
  fillSoft: string;
  /** an icon-only round button's fill, and a ghost button's rim */
  round: string;
  rim: string;
  /** the two green glows behind the page */
  glowA: string;
  glowB: string;
};

/** Watch: every background is a shade of green (web: .watch-shell variables). */
const watchDark: WatchPalette = {
  bg: '#03110a',
  raised: '#072216',
  surface: '#0d3322',
  surface2: '#14472f',
  line: 'rgba(140, 255, 190, 0.15)',
  ink: '#ecfdf3',
  muted: '#9bc4ad',
  accent: '#34e58a',
  accentHover: '#6cf2ab',
  accentInk: '#022312',
  warn: '#f3d27a',
  veil: '3, 17, 10',
  field: 'rgba(7, 34, 22, 0.78)',
  chip: 'rgba(140, 255, 190, 0.12)',
  track: 'rgba(236, 253, 243, 0.25)',
  float: 'rgba(10, 42, 27, 0.96)',
  shadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  fill: 'rgba(236, 253, 243, 0.16)',
  fillPressed: 'rgba(236, 253, 243, 0.26)',
  fillSoft: 'rgba(236, 253, 243, 0.12)',
  round: 'rgba(3, 17, 10, 0.55)',
  rim: 'rgba(255, 255, 255, 0.22)',
  glowA: 'rgba(52, 229, 138, 0.13)',
  glowB: 'rgba(25, 194, 109, 0.1)',
};

// Light: pale green paper. Measured contrast on the page: ink 14.8:1, muted 5.9:1, the accent #0b7a42 4.9:1 (the dark theme's #34e58a is
// too pale for paper), text on the accent 5.4:1, warning text 5.0:1.
const watchLight: WatchPalette = {
  bg: '#eef5f0',
  raised: '#fbfdfb',
  surface: '#e1ede5',
  surface2: '#d3e4d9',
  line: 'rgba(8, 60, 36, 0.16)',
  ink: '#0b2417',
  muted: '#456554',
  accent: '#0b7a42',
  accentHover: '#0a6a39',
  accentInk: '#ffffff',
  warn: '#8a6100',
  veil: '238, 245, 240',
  field: 'rgba(255, 255, 255, 0.86)',
  chip: 'rgba(11, 122, 66, 0.12)',
  track: 'rgba(11, 36, 23, 0.2)',
  float: 'rgba(255, 255, 255, 0.97)',
  shadow: '0 8px 24px rgba(11, 36, 23, 0.18)',
  fill: 'rgba(11, 36, 23, 0.08)',
  fillPressed: 'rgba(11, 36, 23, 0.14)',
  fillSoft: 'rgba(11, 36, 23, 0.06)',
  round: 'rgba(255, 255, 255, 0.78)',
  rim: 'rgba(11, 36, 23, 0.2)',
  glowA: 'rgba(11, 122, 66, 0.1)',
  glowB: 'rgba(11, 122, 66, 0.07)',
};

export type GlassPalette = {
  /** r, g, b of the pane's light and the three opacities along its 140deg gradient */
  tint: readonly [number, number, number];
  alphas: readonly [number, number, number];
  /** colour used when the device cannot blur, so text stays readable */
  solid: string;
  border: string;
  rim: number;
  shadow: string;
  /** the darker pane of menus, dialogs and popovers */
  menuAlphas: readonly [number, number, number];
  menuBase: string;
  menuSolid: string;
};

const glassDark: GlassPalette = {
  tint: [255, 255, 255],
  alphas: [0.17, 0.05, 0.09],
  solid: 'rgba(28, 30, 40, 0.94)',
  border: 'rgba(255, 255, 255, 0.2)',
  rim: 0.42,
  shadow: '0 14px 44px rgba(0, 0, 0, 0.38)',
  menuAlphas: [0.14, 0.03, 0.07],
  menuBase: 'rgba(16, 18, 28, 0.58)',
  menuSolid: 'rgba(28, 30, 40, 0.97)',
};

const glassLight: GlassPalette = {
  tint: [255, 255, 255],
  alphas: [0.82, 0.62, 0.7],
  solid: 'rgba(255, 255, 255, 0.96)',
  border: 'rgba(20, 21, 31, 0.1)',
  rim: 0.9,
  shadow: '0 10px 30px rgba(20, 21, 31, 0.14)',
  menuAlphas: [0.86, 0.7, 0.78],
  menuBase: 'rgba(255, 255, 255, 0.5)',
  menuSolid: 'rgba(255, 255, 255, 0.98)',
};

/** Music: dark and colourful (web: .music-shell variables). Live: holds the active theme's values. */
export const music: MusicPalette = { ...musicDark };
/** Watch, live. */
export const watch: WatchPalette = { ...watchDark };
/** The glass panes, live. */
export const glass: GlassPalette = { ...glassDark, tint: [...glassDark.tint] };

/** The dark palettes, for surfaces that sit on video or artwork and never change with the theme. */
export const musicDarkPalette: Readonly<MusicPalette> = musicDark;
export const watchDarkPalette: Readonly<WatchPalette> = watchDark;
export const glassDarkPalette: Readonly<GlassPalette> = glassDark;

export const theme: { mode: ThemeMode } = { mode: 'dark' };

/** Makes `mode` the active theme. Call it before the tree renders; the palettes above change in place. */
export function applyTheme(mode: ThemeMode): void {
  if (theme.mode === mode) return;
  theme.mode = mode;
  Object.assign(music, mode === 'dark' ? musicDark : musicLight);
  Object.assign(watch, mode === 'dark' ? watchDark : watchLight);
  Object.assign(glass, mode === 'dark' ? glassDark : glassLight);
}

/** The ink colour at `alpha`: white on dark (exactly the old rgba(255, 255, 255, a) strings), the light theme's ink on light. */
export const inkAlpha = (alpha: number): string => (theme.mode === 'dark' ? `rgba(255, 255, 255, ${alpha})` : `rgba(20, 21, 31, ${alpha})`);

/** The compact (phone) layout of Music applies at this width and below, exactly like the web's useMediaQuery('(max-width: 860px)'). */
export const MUSIC_COMPACT_MAX = 860;
/** Watch switches to its phone layout at 640 and its tablet layout at 1000 (Watch.css media queries). */
export const WATCH_PHONE_MAX = 640;
export const WATCH_TABLET_MAX = 1000;
/** The account chip drops its "Good afternoon, name" text at this width and below (Auth.css: `@media (max-width: 760px)`). */
export const GREETING_HIDDEN_MAX = 760;

/** CSS clamp(min, preferred, max) for responsive sizes. */
export const clamp = (min: number, preferred: number, max: number): number => Math.min(Math.max(preferred, min), max);
