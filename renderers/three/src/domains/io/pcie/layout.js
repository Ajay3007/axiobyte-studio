/**
 * Single source of truth for the PCIe asset's geometry. Units are centimetres, as for every
 * hardware asset in the library, so assets compose at true scale.
 *
 * What is modelled: the HOST side of PCIe — a section of system board carrying an x8 slot and
 * the link's lanes, routed from the slot's contacts to vias that take them down toward the
 * CPU's root complex. The card's side (its edge connector) belongs to each card asset.
 *
 * Board-local frame:
 *   x  along the slot, pin 1 toward x = 0
 *   z  0 at the board edge behind the slot → BOARD.H toward the CPU
 *   y  0 at the board underside, TOP on the component side
 */
export const BOARD = { L: 8.8, H: 8.2, T: 0.16, r: 0.32 };
export const TOP = BOARD.T;

/**
 * The CEM card-edge contact layout for an x8 link, identical to every x8 card's fingers:
 * 1.0 mm pitch, contacts 1–11 before the key, 12–49 after it.
 */
export const CEM = {
  pitch: 0.1,
  perSide: 49,
  beforeKey: 11,
  /** Offset from contact 1 to contact 12: 11 positions and the key between them. */
  afterKeyOffset: 1.35,
  /** Card tab edges relative to contact 1's centre (from the x8 card outline). */
  tab: { x0: -0.155, x1: 5.135 },
  /** The card's key notch, relative to contact 1's centre. */
  notch: { x0: 1.035, x1: 1.255, depth: 0.65 },
};

/** Centre of contact `n` (1-based), relative to contact 1. */
export const contactX = (n) => (n <= CEM.beforeKey ? (n - 1) * CEM.pitch : CEM.afterKeyOffset + (n - 12) * CEM.pitch);

export const SLOT = {
  /** Board x of contact 1's centre. */
  pin1X: 1.62,
  z: 1.55,
  /** Housing: ~56 mm long for x8, 7.5 mm wide, 11.25 mm tall. */
  width: 0.75,
  height: 1.125,
  endWall: 0.113,
  /** The opening a 1.57 mm card slides into, and how deep it goes. */
  gap: 0.19,
  depth: 0.82,
  clearance: 0.05,
  /** The key rib, a little narrower than the card's notch. */
  keyW: 0.18,
  keyH: 0.6,
};

export const slotSpan = () => {
  const x0 = SLOT.pin1X + CEM.tab.x0 - SLOT.clearance;
  const x1 = SLOT.pin1X + CEM.tab.x1 + SLOT.clearance;
  return { open0: x0, open1: x1, x0: x0 - SLOT.endWall, x1: x1 + SLOT.endWall };
};

/**
 * Lane contacts from the CEM pinout: lane n uses PETp/PETn on side B and PERp/PERn on side A.
 * (Presence-detect PRSNT2# for an x8 card is B48; everything else between is ground or reserved.)
 */
export const LANES = [
  { lane: 0, b: 14, a: 16 },
  { lane: 1, b: 19, a: 21 },
  { lane: 2, b: 23, a: 25 },
  { lane: 3, b: 27, a: 29 },
  { lane: 4, b: 33, a: 35 },
  { lane: 5, b: 37, a: 39 },
  { lane: 6, b: 41, a: 43 },
  { lane: 7, b: 45, a: 47 },
];

/** Where the lanes leave the slot, fan out, run to the via field, and drop to inner layers. */
export const ROUTE = {
  exitZ: SLOT.z + SLOT.width / 2 + 0.06,
  neckZ: SLOT.z + SLOT.width / 2 + 0.34,
  fanZ: 3.05,
  viaZ: 7.05,
  /** Lane centres after the fan-out, spread across the board. */
  laneX0: 1.2,
  laneX1: 7.6,
  /** Differential pair: trace width and centre-to-centre spacing; the two pairs of a lane. */
  w: 0.026,
  pairPitch: 0.055,
  pairGap: 0.34,
};

export const HOLES = [
  { x: 0.45, z: 0.45, r: 0.16 },
  { x: BOARD.L - 0.45, z: BOARD.H - 0.45, r: 0.16 },
];
