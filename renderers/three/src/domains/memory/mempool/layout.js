/**
 * Single source of truth for the Mempool asset's geometry. Units are centimetres, like every asset
 * in the library.
 *
 * A mempool is a logical structure — identical elements allocated once, up front, each an mbuf
 * with the buffer it describes — so it is drawn as a diagram, never as hardware: a schematic tray
 * holding a grid of identical element tiles, each divided into its mbuf half and its buffer half.
 *
 * Asset-local frame: the tray lies in the x–z plane with its top at y = TRAY.h, x to the right,
 * z toward the viewer. Elements run in reading order seen from the front: left to right, far row
 * first. Nothing here numbers them: the elements have no individual identity.
 */

/** Twelve elements: an illustrative count — real pools hold thousands. */
export const POOL = { cols: 4, rows: 3 };
export const COUNT = POOL.cols * POOL.rows;

/** One element: the mbuf half (metadata) on the left, the larger buffer half (bytes) on the right. */
export const ELEMENT = { mbufWidth: 0.55, gap: 0.08, bufferWidth: 1.45, depth: 1.0, h: 0.14 };
ELEMENT.width = ELEMENT.mbufWidth + ELEMENT.gap + ELEMENT.bufferWidth;

/** Space between neighbouring elements. */
export const SPACING = { x: 0.3, z: 0.25 };

/** The grid of elements: about 9.2 × 3.5. */
export const GRID = {
  width: POOL.cols * ELEMENT.width + (POOL.cols - 1) * SPACING.x,
  depth: POOL.rows * ELEMENT.depth + (POOL.rows - 1) * SPACING.z,
};

/**
 * The tray the elements lie on, about 10 × 5, centred on the origin: a caption band along its far
 * edge, the grid, and a footnote band along its near edge.
 */
export const TRAY = { width: 10, depth: 5, h: 0.1, radius: 0.18, caption: 0.78, footnote: 0.55 };

/** The grid's far-left corner, in the tray's frame. */
const X0 = -GRID.width / 2;
const Z0 = -TRAY.depth / 2 + TRAY.caption;

/** The first and last elements in layout order — the concept's first_slot and last_slot. */
export const FIRST = 0;
export const LAST = COUNT - 1;

/** Element i's rectangle, in the tray's frame: { x0, x1, z0, z1 }. */
export function elementRect(i) {
  const col = i % POOL.cols;
  const row = Math.floor(i / POOL.cols);
  const x0 = X0 + col * (ELEMENT.width + SPACING.x);
  const z0 = Z0 + row * (ELEMENT.depth + SPACING.z);
  return { x0, x1: x0 + ELEMENT.width, z0, z1: z0 + ELEMENT.depth };
}

/** Element i's mbuf half. */
export function mbufRect(i) {
  const r = elementRect(i);
  return { ...r, x1: r.x0 + ELEMENT.mbufWidth };
}

/** Element i's buffer half. */
export function bufferRect(i) {
  const r = elementRect(i);
  return { ...r, x0: r.x1 - ELEMENT.bufferWidth };
}

/** The tray's bands, in its frame: the caption along the far edge, the footnote along the near edge. */
export const CAPTION = { z0: -TRAY.depth / 2, z1: -TRAY.depth / 2 + TRAY.caption };
export const FOOTNOTE = { z0: TRAY.depth / 2 - TRAY.footnote, z1: TRAY.depth / 2 };

/** The grid's centre: [x, z]. */
export const GRID_CENTER = [X0 + GRID.width / 2, Z0 + GRID.depth / 2];

export const center = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
