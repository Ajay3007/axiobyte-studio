/**
 * Single source of truth for the Descriptor Ring asset's geometry. Units are centimetres, like
 * every asset in the library.
 *
 * A descriptor ring is a logical structure — a contiguous array of descriptors in host memory that
 * software and the NIC use circularly — so it is drawn as a diagram, never as hardware: labelled
 * descriptor slots arranged in a ring on a schematic base, with head and tail printed on the base.
 *
 * Asset-local frame: the ring lies in the x–z plane with its top at y = BASE.h + SLOT.h, x to the
 * right, z toward the viewer. Slot 0 is at the far side (−z) and the slots run clockwise seen from
 * above: D0 far, D2 right, D4 near, D6 left.
 */

/** Eight descriptors: an illustrative capacity — real rings hold hundreds to thousands. */
export const RING = {
  count: 8,
  inner: 2.0, // inner radius of the slots
  outer: 3.6, // outer radius of the slots
  gap: 0.12, // between neighbouring slots, along the mid-radius
  // Head and tail at illustrative positions — anchors for explanation, not runtime values.
  head: 2,
  tail: 6,
  // The representative descriptor the Descriptor view frames.
  representative: 0,
};

/** The schematic base the ring lies on, and what is printed on it. */
export const BASE = { radius: 4.45, h: 0.1 };

/** One descriptor slot: an annular sector, raised off the base. */
export const SLOT = { h: 0.16 };

/** The field card on each slot's top: upright to a viewer in front, sized to fit every slot. */
export const CARD = { w: 1.15, d: 0.78 };

/** Head and tail marks, printed on the base inside the ring, pointing out at their slots. */
export const MARK = { radius: 1.32, w: 1.3, d: 0.46 };

export const MID = (RING.inner + RING.outer) / 2;
const STEP = (2 * Math.PI) / RING.count;

/** The angle of slot i around the ring (0 at the far side, increasing clockwise from above). */
export const angleOf = (i) => i * STEP;

/** The half-angle a slot spans, leaving the gap to its neighbours at the mid-radius. */
export const HALF_SPAN = STEP / 2 - RING.gap / (2 * MID);

/** A point at radius r and angle a, in the ring's x–z plane: [x, z]. */
export const polar = (r, a) => [r * Math.sin(a), -r * Math.cos(a)];

/** Slot i's centre at the mid-radius: [x, z]. */
export const slotCenter = (i) => polar(MID, angleOf(i));

/** Slot i's field card, centred on the slot, axis-aligned: { x0, x1, z0, z1 }. */
export function cardRect(i) {
  const [x, z] = slotCenter(i);
  return { x0: x - CARD.w / 2, x1: x + CARD.w / 2, z0: z - CARD.d / 2, z1: z + CARD.d / 2 };
}

/** Whether a point [x, z] lies inside slot i's annular sector. */
export function inSlot(i, [x, z]) {
  const r = Math.hypot(x, z);
  if (r < RING.inner || r > RING.outer) return false;
  const a = Math.atan2(x, -z);
  const d = Math.atan2(Math.sin(a - angleOf(i)), Math.cos(a - angleOf(i)));
  return Math.abs(d) <= HALF_SPAN;
}

/** Where the head or tail mark sits: inside the ring, on the line to its slot. */
export const markCenter = (i) => polar(MARK.radius, angleOf(i));
