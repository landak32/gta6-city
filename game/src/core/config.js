// Vice Harbor — one place for the numbers and colours the whole game shares.
//
// The game draws into a fixed 1280x720 logical frame and the canvas is scaled to the window,
// so every distance below is in logical pixels and no rule depends on the display's size.
// The city is a grid of roads: an 8 by 6 lattice of intersections 450 px apart, with 92 px
// of asphalt, a 30 px sidewalk either side, and blocks of buildings filling the cells.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step: 60 updates a second, whatever the display runs at. */
export const STEP = 1 / 60;

/** The longest frame the loop replays; a longer stall (a hidden tab) is dropped, not caught up. */
export const MAX_FRAME = 0.25;

export const CITY = {
  cols: 8,
  rows: 6,
  cell: 450,
  road: 92,
  margin: 170,
  sidewalk: 30,
  blockInset: 16,
  /** South of the last road the land turns to sand, then water. */
  shoreY: 2470,
  beachDepth: 150,
  worldWidth: 3490,
  worldHeight: 2900,
};

/** Where the player starts on foot, in the commercial heart a block off the waterfront. */
export const START = { x: 1490, y: 1620 };

export const PLAYER = {
  radius: 11,
  walk: 118,
  run: 208,
  sprint: 288,
  accel: 1150,
  friction: 1400,
  maxHealth: 100,
  maxArmour: 100,
  respawnInvuln: 2.4,
  /** Money lost to a hospital bill, and to a night in the cells. */
  hospitalFee: 180,
  bailFee: 260,
};

export const WANTED = {
  max: 5,
  /** Seconds out of sight before a star starts to cool, per star held. */
  decayDelay: 11,
  decaySeconds: 9,
};

/** How far the camera may drift ahead of the player, and how fast it settles. */
export const CAMERA = { lead: 0.28, smooth: 5.2, lookAhead: 150 };

/** Day length in seconds; screenshots pin the clock instead of waiting. */
export const DAY_SECONDS = 210;

export const FONT = '"Inter", "Helvetica Neue", "Segoe UI", system-ui, -apple-system, sans-serif';
export const FONT_CONDENSED = '"Arial Narrow", "Helvetica Neue", system-ui, sans-serif';

/** Palette shared by the city art and the interface: a warm, sun-bleached harbour. */
export const UI = {
  ink: '#f7f1e3',
  inkDim: '#b9b0a1',
  panel: 'rgba(12, 16, 22, 0.82)',
  panelLight: 'rgba(24, 30, 38, 0.72)',
  edge: 'rgba(255, 236, 200, 0.22)',
  money: '#9fe07a',
  health: '#63d06a',
  armour: '#6fb7ff',
  wanted: '#ffcf4a',
  danger: '#e8503a',
  accent: '#ff8a3d',
  teal: '#3fb6a8',
  marker: '#ffd257',
};
