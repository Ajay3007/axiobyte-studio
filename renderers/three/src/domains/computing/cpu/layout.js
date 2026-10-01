/**
 * Single source of truth for the CPU asset's geometry. Units are centimetres, like every hardware
 * asset in the library.
 *
 * What is modelled: a generic desktop land-grid-array (LGA) processor package — heat spreader,
 * substrate, silicon die and the contact lands underneath. It is not any vendor's part. In an LGA
 * design the pins are in the motherboard's socket, so the socket belongs to the board; this asset
 * ends at its lands. The regions drawn on the die (cores, cache, memory controller, PCIe/I/O) are
 * an educational layout, not a floorplan.
 *
 * Package-local frame:
 *   x, z  0 at one corner of the substrate → PKG.L on the opposite corner
 *   y     0 at the substrate underside (the land side), SUB_TOP on the die side
 */
export const PKG = { L: 4.0, r: 0.06 };
export const SUB_TOP = 0.12;

/** The two socket-key notches on opposite edges, and the pin-1 corner. */
export const NOTCHES = [
  { edge: 'z0', at: 1.1, w: 0.22, d: 0.14 },
  { edge: 'z1', at: 1.1, w: 0.22, d: 0.14 },
];
export const PIN1 = { x: 0.2, z: 0.2 };

/** Integrated heat spreader: footprint, height above the substrate, and how it opens. */
export const IHS = { size: 3.3, height: 0.27, bead: 0.03, lift: 1.25, slide: 3.9 };

/** The silicon die, centred under the heat spreader. */
export const DIE = { w: 1.8, d: 1.4, h: 0.07 };

/**
 * The conceptual regions drawn on the die, in die-local coordinates (0,0 at the die's corner,
 * x across DIE.w, z across DIE.d). A teaching layout: compute on top, the interfaces below it.
 */
export const REGIONS = {
  cores: { x0: 0.07, z0: 0.07, x1: 1.13, z1: 0.95 },
  cache: { x0: 1.19, z0: 0.07, x1: 1.73, z1: 0.95 },
  'memory-controller': { x0: 0.07, z0: 1.01, x1: 0.87, z1: 1.33 },
  io: { x0: 0.93, z0: 1.01, x1: 1.73, z1: 1.33 },
};
/** How many core tiles the core region shows. Illustrative, not a claim about any CPU. */
export const CORE_TILES = { cols: 2, rows: 2 };

/**
 * Land grid on the underside: ≈1 mm pitch, a keep-out in the centre for land-side capacitors, and
 * two labelled fields — where the memory channels and the PCIe lanes leave the package. The fields
 * are a teaching layout, not a real pinout.
 */
export const LANDS = {
  pitch: 0.1,
  margin: 0.25,
  pad: 0.058,
  keepOut: 1.3,
  fields: {
    memory: { x0: 0.25, z0: 0.45, x1: 0.95, z1: 3.55 },
    pcie: { x0: 3.05, z0: 0.45, x1: 3.75, z1: 3.55 },
  },
};

export const CENTER = PKG.L / 2;
