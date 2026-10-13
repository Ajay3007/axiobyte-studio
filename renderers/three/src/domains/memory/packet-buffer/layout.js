/**
 * Single source of truth for the Packet Buffer asset's geometry. Units are centimetres, like every
 * asset in the library.
 *
 * A packet buffer is the memory buffer that holds one packet's bytes — its header, then its payload
 * — so it is drawn as the visual language draws a memory buffer: a frame in memory's colour HOLDING
 * byte cells in the packet's colour. The frame is an open tray; the bytes sit inside it, the header's
 * few first, the payload's many after, with a low divider between the two regions. Nothing here is
 * an address, a count of anything real, or a state.
 *
 * Asset-local frame: the tray lies in the x–z plane with its base at y = 0, x to the right (byte
 * order: the first byte, where the buffer's address points, is at the left), z toward the viewer.
 * Both printed bands run along the near edge — the region labels, then the caption — because the
 * frame's walls would hide anything printed behind it.
 */

/** One byte cell: an abstract byte, not a literal one — the asset shows occupancy, not values. */
export const CELL = { size: 0.34, h: 0.22, gap: 0.08, radius: 0.05 };

/** The two regions' cells: a few header bytes first, then the payload. Illustrative counts. */
export const HEADER = { cols: 3, rows: 2 };
export const PAYLOAD = { cols: 10, rows: 2 };

/** The frame: base plate, rim walls, the divider, and the padding between walls and cells. */
export const FRAME = { base: 0.08, wall: 0.1, rim: 0.3, pad: 0.15, divider: 0.06, radius: 0.08 };

/** The bands printed on the base plate in front of the frame: region labels, then the caption. */
export const BAND = { caption: 0.42, labels: 0.4 };

const span = (n) => n * CELL.size + (n - 1) * CELL.gap;

/** The inside of each region, between the walls (and the divider): { x0, x1, z0, z1 }. */
const HEADER_W = span(HEADER.cols) + 2 * FRAME.pad;
const PAYLOAD_W = span(PAYLOAD.cols) + 2 * FRAME.pad;
const INNER_D = span(Math.max(HEADER.rows, PAYLOAD.rows)) + 2 * FRAME.pad;

/** The frame's outside: about 6.3 × 1.3. */
export const OUTER = {
  width: HEADER_W + FRAME.divider + PAYLOAD_W + 2 * FRAME.wall,
  depth: INNER_D + 2 * FRAME.wall,
};

/** The base plate, under the frame and both bands: about 6.3 × 2.1, centred on the origin. */
export const BASE = { width: OUTER.width, depth: OUTER.depth + BAND.caption + BAND.labels };

/** The frame's far edge, in the base's frame: the frame runs to the plate's far edge. */
const FRAME_Z0 = -BASE.depth / 2;
const X0 = -OUTER.width / 2;

export const FRAME_RECT = { x0: X0, x1: X0 + OUTER.width, z0: FRAME_Z0, z1: FRAME_Z0 + OUTER.depth };

export const HEADER_RECT = {
  x0: X0 + FRAME.wall,
  x1: X0 + FRAME.wall + HEADER_W,
  z0: FRAME_Z0 + FRAME.wall,
  z1: FRAME_Z0 + FRAME.wall + INNER_D,
};
export const DIVIDER_RECT = { ...HEADER_RECT, x0: HEADER_RECT.x1, x1: HEADER_RECT.x1 + FRAME.divider };
export const PAYLOAD_RECT = { ...HEADER_RECT, x0: DIVIDER_RECT.x1, x1: DIVIDER_RECT.x1 + PAYLOAD_W };

/** The bands, in the base's frame: labels just in front of the frame, the caption nearest. */
export const LABEL_RECT = { x0: X0, x1: -X0, z0: FRAME_RECT.z1, z1: FRAME_RECT.z1 + BAND.labels };
export const CAPTION_RECT = { x0: X0, x1: -X0, z0: LABEL_RECT.z1, z1: BASE.depth / 2 };

/** Heights: the floor inside the frame, the cells' tops, the rim's top. */
export const FLOOR = FRAME.base;
export const CELL_TOP = FLOOR + CELL.h;
export const RIM_TOP = FLOOR + FRAME.rim;

/** Cell (col, row) of a region, as its rectangle: rows run far to near, columns left to right. */
export function cellRect(region, col, row) {
  const x0 = region.x0 + FRAME.pad + col * (CELL.size + CELL.gap);
  const z0 = region.z0 + FRAME.pad + row * (CELL.size + CELL.gap);
  return { x0, x1: x0 + CELL.size, z0, z1: z0 + CELL.size };
}

/** Every cell of a region, in byte order: row by row, left to right. */
export function cells(region, grid) {
  const out = [];
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) out.push(cellRect(region, col, row));
  return out;
}

/** The byte area: both regions and the divider between them. */
export const BYTES_RECT = { ...HEADER_RECT, x1: PAYLOAD_RECT.x1 };

export const center = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
