/**
 * Single source of truth for the mbuf asset's geometry. Units are centimetres, like every asset in
 * the library.
 *
 * An mbuf is metadata — a small record of bookkeeping fields and buf_addr, the address of the buffer
 * that holds the packet's bytes — so it is drawn as a diagram, never as hardware: one raised record
 * with a title band and one row per field it shows. It holds no bytes, so nothing in it is drawn in
 * the packet's colour or shaped like the packet's byte cells.
 *
 * Asset-local frame: the record lies in the x–z plane with its base at y = 0 and its top at
 * y = BODY.h, x to the right, z toward the viewer. Rows run far to near: title, then the fields.
 */

/** The record: about 2.6 × 1.8, low and flat like the mempool's element tiles. */
export const BODY = { width: 2.6, depth: 1.8, h: 0.18, radius: 0.12 };

/** The band along the far edge that carries the record's title. */
export const TITLE = { depth: 0.5 };

/**
 * The fields the mbuf shows, far to near. buf_addr is last and nearest the viewer: the field the
 * mbuf exists for. `next` is an anchor of the concept but is not drawn — chaining is not modelled.
 */
export const FIELDS = ['data_len', 'refcount', 'buf_addr'];

/** One field row: a raised strip, inset from the record's sides. */
export const ROW = { inset: 0.14, gap: 0.08, h: 0.06 };
ROW.depth = (BODY.depth - TITLE.depth - ROW.inset - (FIELDS.length - 1) * ROW.gap) / FIELDS.length;

/** Field i's strip, in the record's frame: { x0, x1, z0, z1 }. */
export function fieldRect(i) {
  const z0 = -BODY.depth / 2 + TITLE.depth + i * (ROW.depth + ROW.gap);
  return { x0: -BODY.width / 2 + ROW.inset, x1: BODY.width / 2 - ROW.inset, z0, z1: z0 + ROW.depth };
}

/** The field strips' top face. */
export const FIELD_TOP = BODY.h + ROW.h;

export const center = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
