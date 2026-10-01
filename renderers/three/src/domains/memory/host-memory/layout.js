/**
 * Single source of truth for the Host Memory asset's geometry. Units are centimetres, like every
 * hardware asset in the library.
 *
 * The asset has two layers, kept visibly apart:
 *   physical  two memory modules (DIMMs) standing side by side — hardware, lit like hardware
 *   logical   the physical address space those modules provide, drawn as a map lying in front of
 *             them — a diagram, drawn as labelled tiles, never as a board or a chip
 *
 * Asset-local frame: x along the modules' length, y up, z toward the viewer. The modules stand
 * behind the map (z < MAP.z0), lifted clear of it; the map lies flat in front with its top at y = 0.
 */

/**
 * One generic DIMM. Built lying flat in its own frame — x along its length, z from the top edge
 * (0) to the contact edge (H), y out of the front face — then stood up on its contact edge.
 * Proportions follow the standard DIMM outline; chip count and placement are illustrative.
 */
export const DIMM = {
  L: 13.335, // the standard DIMM length, 133.35 mm
  H: 3.125,
  T: 0.127,
  // Gold edge contacts, both faces: 144 per face at 0.85 mm pitch, split by the key notch.
  contacts: { pitch: 0.085, w: 0.06, h: 0.3, left: 70, right: 74, notch: 0.3 },
  keyDepth: 0.36,
  // Retention notches on the short edges, where the slot's latches hold the module.
  latch: { z: 1.95, r: 0.12 },
  // DRAM packages: one row per face.
  chips: { count: 8, w: 0.95, d: 1.1, h: 0.1, z: 1.25, x0: 0.95, pitch: 1.62 },
  // The SPD chip — the module's identity and timings, read by firmware at boot.
  spd: { x: 6.62, z: 1.25, w: 0.34, d: 0.42, h: 0.06 },
  lift: 0.6, // how far the contact edge floats above the map's level
};

/** Where the key notch sits along the contact edge: [x0, x1]. */
export function keyNotch() {
  const { pitch, left, right, notch } = DIMM.contacts;
  const start = (DIMM.L - (left + right) * pitch - notch) / 2;
  return [start + left * pitch, start + left * pitch + notch];
}

/** The two modules, by the z of their back face. Two, to show memory is plural; not a channel count. */
export const MODULES = [
  { id: 'dimm-0', z: -0.35 },
  { id: 'dimm-1', z: -1.85 },
];

/** The address map: a plate in front of the modules, with its top face at y = 0. */
export const MAP = { x0: -0.03, z0: 0.9, w: 13.4, d: 6.2, h: 0.1, tile: 0.06 };

/**
 * Strips and regions in map-local coordinates (0,0 at the map's back-left corner; x across its
 * width, z toward the viewer). Address increases left to right. Nothing here is to scale.
 */
export const STRIPS = {
  caption: { z0: 0.14, z1: 0.62 },
  ruler: { z0: 5.52, z1: 6.08 },
};
const BAND = { z0: 0.8, z1: 5.35 };
export const REGIONS = {
  'other-memory': [
    { x0: 0.2, z0: BAND.z0, x1: 3.95, z1: BAND.z1 },
    { x0: 11.65, z0: BAND.z0, x1: 13.2, z1: BAND.z1 },
  ],
  'descriptor-region': [{ x0: 4.15, z0: BAND.z0, x1: 6.25, z1: BAND.z1 }],
  'packet-buffer-region': [{ x0: 6.45, z0: BAND.z0, x1: 11.45, z1: BAND.z1 }],
};
/** The regions along the address axis, low to high: [part id, index into REGIONS[id]]. */
export const ADDRESS_ORDER = [
  ['other-memory', 0],
  ['descriptor-region', 0],
  ['packet-buffer-region', 0],
  ['other-memory', 1],
];

/** Inside a tile: the title band, then the content. */
export const TILE = { header: 0.62, pad: 0.16 };

/** The descriptor ring: slots stacked in its tile, a margin on the left for head, tail and wrap. */
export const RING = { slots: 8, left: 0.62, right: 0.16, gap: 0.05, head: 2, tail: 6 };

/**
 * Packet buffers: a grid in their tile. POSTED[i] is the buffer descriptor i points at — the first
 * two columns, in order, so the pointers fan out without crossing; the third column is free.
 */
export const BUFFERS = { cols: 3, rows: 4, gap: 0.14 };
export const POSTED = [0, 1, 3, 4, 6, 7, 9, 10];
/**
 * Where a pointer lands on its buffer's left edge, as a fraction of the buffer's depth: mid-height,
 * which keeps every pointer clear of its neighbours. Buffer labels start to the right of the tip.
 */
export const POINTER_LANDING = 0.5;

/** Slot i's rectangle, in map-local coordinates. */
export function slotRect(i) {
  const r = REGIONS['descriptor-region'][0];
  const top = r.z0 + TILE.header;
  const h = (r.z1 - TILE.pad - top - RING.gap * (RING.slots - 1)) / RING.slots;
  const z0 = top + i * (h + RING.gap);
  return { x0: r.x0 + RING.left, x1: r.x1 - RING.right, z0, z1: z0 + h };
}

/** Buffer j's rectangle (row-major), in map-local coordinates. */
export function bufferRect(j) {
  const r = REGIONS['packet-buffer-region'][0];
  const top = r.z0 + TILE.header;
  const { cols, rows, gap } = BUFFERS;
  const w = (r.x1 - r.x0 - 2 * TILE.pad - gap * (cols - 1)) / cols;
  const h = (r.z1 - TILE.pad - top - gap * (rows - 1)) / rows;
  const c = j % cols;
  const row = Math.floor(j / cols);
  const x0 = r.x0 + TILE.pad + c * (w + gap);
  const z0 = top + row * (h + gap);
  return { x0, x1: x0 + w, z0, z1: z0 + h };
}

export const center = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
