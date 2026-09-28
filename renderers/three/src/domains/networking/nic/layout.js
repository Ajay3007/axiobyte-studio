/**
 * Single source of truth for the board layout. Units are centimetres.
 *
 * Board-local frame:
 *   x  0 at the bracket edge → PCB.L at the far end
 *   z  0 at the top edge     → PCB.H at the edge-connector side
 *   y  0 at the PCB underside, TOP on the component side
 */
export const PCB = { L: 16.8, H: 6.9, T: 0.16 };
export const TOP = PCB.T;

// Low-profile style x8 card; the corner cut next to the bracket clears the slot latch.
export const CORNER_CUT = { x: 0.55, z: 6.45 };

export const FINGERS = {
  pitch: 0.1,
  width: 0.07,
  z0: 6.99,
  z1: 7.62,
  segA: { x0: 4.45, count: 11 },
  segB: { x0: 5.8, count: 38 },
  tab: { x0: 4.33, x1: 9.62, z: 7.68 },
  notch: { x0: 5.52, x1: 5.74, z: 7.03 },
};

export const PORT = {
  w: 1.62,
  h: 1.36,
  depth: 2.15,
  front: -0.14,
  openW: 1.17,
  openH: 0.8,
  openY: 0.3,
  latchW: 0.62,
  latchH: 0.17,
  ledW: 0.2,
  ledV0: 1.19,
  ledV1: 1.31,
  ledU: 0.52,
};

export const PORTS = [
  { id: 'rj45-1', z: 2.0, index: 1 },
  { id: 'rj45-2', z: 3.8, index: 2 },
];

export const MAGNETICS = { x: 2.85, zs: [2.0, 3.8], w: 0.95, d: 1.3, h: 0.36, pins: 8, pitch: 0.15 };

export const PHY = { x: 5.3, z: 3.1, size: 1.75, h: 0.15 };

export const HEATSINK = {
  x: 5.3,
  z: 3.1,
  half: 1.75,
  baseT: 0.2,
  finH: 1.0,
  fins: 13,
  finT: 0.075,
  channel: 0.26,
  earR: 0.32,
  pins: [
    [3.3, 1.1],
    [7.3, 5.1],
  ],
  baseY: TOP + 0.16,
  lift: 1.6,
};

export const CONTROLLER = { x: 10.4, z: 3.0, size: 2.1, h: 0.2, standoff: 0.03, leadLen: 0.2, leadsPerSide: 30, pitch: 0.058 };

export const ZONES = {
  rx: { x0: 12.05, x1: 13.5, z0: 1.1, z1: 2.7 },
  tx: { x0: 12.05, x1: 13.5, z0: 3.3, z1: 4.9 },
  vrm: { x0: 13.75, x1: 16.6, z0: 0.3, z1: 4.25 },
};

export const VRM = {
  inductors: [1.1, 2.35, 3.6].map((z) => ({ x: 14.8, z })),
  inductorSize: 0.75,
  inductorH: 0.42,
  caps: [1.1, 1.95, 2.8, 3.65].map((z) => ({ x: 15.95, z })),
  capR: 0.3,
  capH: 0.55,
  fetX: 14.05,
  pwm: { x: 15.2, z: 4.75 },
};

export const HOLES = [
  { x: 0.55, z: 0.55, r: 0.16, kind: 'bracket' },
  { x: 0.55, z: 5.3, r: 0.16, kind: 'bracket' },
  { x: 16.35, z: 0.45, r: 0.17, kind: 'mount' },
  { x: 16.3, z: 6.4, r: 0.17, kind: 'mount' },
  { x: 3.3, z: 1.1, r: 0.12, kind: 'pin' },
  { x: 7.3, z: 5.1, r: 0.12, kind: 'pin' },
];

export const BRACKET = {
  x: -0.13,
  t: 0.08,
  y0: -0.3,
  y1: 1.56,
  z0: -0.95,
  z1: 7.1,
  tongueZ: 7.95,
  tongueY1: 0.42,
  foldX: 0.95,
  slotY: 0.62,
  slotW: 0.44,
  tabs: [0.55, 5.3],
  portHalf: 0.84,
  portY0: TOP - 0.03,
  portY1: TOP + 1.39,
  ventR: 0.095,
  ventBands: [
    [-0.62, 0.9],
    [4.95, 6.85],
  ],
};

export const PCIE = {
  pairs: Array.from({ length: 8 }, (_, i) => ({
    fingers: [3 + 4 * i, 4 + 4 * i],
    laneZ: 5.45 + 0.13 * i,
    targetX: 9.6 + 0.225 * i,
  })),
  capZ: 6.62,
  pairGap: 0.1,
};

export const MISC = {
  crystal: { x: 8.35, z: 1.25 },
  flash: { x: 12.6, z: 5.95 },
  jtag: { x: 14.5, z: 6.2 },
  boardLeds: [
    { x: 16.2, z: 5.35, label: 'PWR', color: 0x5cff8a },
    { x: 16.2, z: 5.75, label: 'HB', color: 0x5cc8ff },
  ],
  sticker: { x0: 1.25, x1: 3.05, z0: 5.25, z1: 6.35, mac: '02:A7:1B:3C:5E:10' },
};

/** Tip positions of the controller's gull-wing leads along one side. */
export function controllerLeadOffsets() {
  const n = CONTROLLER.leadsPerSide;
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * CONTROLLER.pitch);
}

export function fingerX(index) {
  const { segA, segB, pitch, width } = FINGERS;
  if (index < segA.count) return segA.x0 + index * pitch + width / 2;
  return segB.x0 + (index - segA.count) * pitch + width / 2;
}
