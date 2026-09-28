/**
 * Visual language for the video overlay. Everything is expressed in 1920x1080
 * pixels: the composition is designed for 16:9 rather than scaled from the
 * website, so these numbers are absolute, not responsive.
 */
export const W = 1920;
export const H = 1080;

/** Keep meaningful content inside this box: clear of YouTube's chrome and any crop. */
export const SAFE = { x: 112, y: 76, w: W - 224, h: H - 152 };
export const safeR = SAFE.x + SAFE.w;
export const safeB = SAFE.y + SAFE.h;

export const C = {
  ink: '#ECE8DA',
  inkDim: 'rgba(236,232,218,0.62)',
  muted: '#98A1AB',
  accent: '#6EC1FF',
  accentDim: 'rgba(110,193,255,0.22)',
  amber: '#FFB454',
  amberDim: 'rgba(255,180,84,0.22)',
  gold: '#F0C060',
  green: '#5CFF8A',
  violet: '#B09BFF',
  red: '#FF7A6B',
  panel: 'rgba(11,14,18,0.80)',
  panelSolid: 'rgba(9,11,14,0.94)',
  line: 'rgba(236,232,218,0.16)',
  lineStrong: 'rgba(236,232,218,0.34)',
  bg0: '#222831',
  bg1: '#0E1116',
};

export const F = {
  display: "'Barlow Semi Condensed', 'Arial Narrow', Arial, sans-serif",
  mono: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
};

/** font(weight, size, [mono]) */
export const font = (weight, size, mono = false) => `${weight} ${size}px ${mono ? F.mono : F.display}`;

export const LAYER = {
  scrim: 0,
  diagram: 10,
  rail: 20,
  callout: 30,
  title: 40,
  caption: 50,
  brand: 60,
  fade: 90,
};

/** Letter-spacing helper: canvas2d letterSpacing is supported in Chrome. */
export const TRACK = { tight: '0px', normal: '0.5px', wide: '2.4px', xwide: '4.2px' };
