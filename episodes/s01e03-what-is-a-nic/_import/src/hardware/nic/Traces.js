import * as THREE from 'three';
import { mergeAll, offsetPolyline } from '../../engine/geometry.js';
import { CONTROLLER, FINGERS, MAGNETICS, PCB, PCIE, PHY, PORT, TOP, ZONES, controllerLeadOffsets, fingerX } from './layout.js';

const H = 0.004; // copper + mask build-up above the laminate

/**
 * Collects trace segments as thin boxes and merges them into a single mesh.
 * Routing is decorative but follows real conventions: differential pairs,
 * 45° jogs, fan-outs from fine-pitch parts, stitching and thermal vias.
 */
class TraceBuilder {
  constructor() {
    this.boxes = [];
    this.vias = [];
  }

  segment(x0, z0, x1, z1, w) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return;
    const g = new THREE.BoxGeometry(len + w * 0.9, H, w);
    g.rotateY(Math.atan2(-dz, dx));
    g.translate((x0 + x1) / 2, TOP + H / 2, (z0 + z1) / 2);
    this.boxes.push(g);
  }

  path(points, w = 0.03) {
    for (let i = 1; i < points.length; i++) this.segment(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], w);
    return this;
  }

  /** Differential pair: two offset copies of a centre line. */
  pair(centre, gap, w) {
    this.path(offsetPolyline(centre, gap / 2), w);
    this.path(offsetPolyline(centre, -gap / 2), w);
  }

  pour(x0, z0, x1, z1) {
    const g = new THREE.BoxGeometry(x1 - x0, H * 0.9, z1 - z0);
    g.translate((x0 + x1) / 2, TOP + H * 0.45, (z0 + z1) / 2);
    this.boxes.push(g);
  }

  via(x, z) {
    this.vias.push([x, z]);
  }

  build(kit) {
    const group = new THREE.Group();
    group.name = 'traces';
    const traces = new THREE.Mesh(mergeAll(this.boxes), kit.material('solderMaskTrace'));
    traces.name = 'trace-copper';
    traces.receiveShadow = true;
    group.add(traces);

    const viaGeo = kit.geometry('via', () => {
      const g = new THREE.CylinderGeometry(0.028, 0.034, 0.008, 12);
      g.translate(0, TOP + 0.004, 0);
      return g;
    });
    const vias = new THREE.InstancedMesh(viaGeo, kit.material('solderMaskTrace'), this.vias.length);
    const m = new THREE.Matrix4();
    this.vias.forEach(([x, z], i) => vias.setMatrixAt(i, m.makeTranslation(x, 0, z)));
    vias.instanceMatrix.needsUpdate = true;
    vias.receiveShadow = true;
    vias.computeBoundingSphere();
    vias.name = 'vias';
    group.add(vias);
    return group;
  }
}

export function createTraces(kit) {
  const t = new TraceBuilder();
  const leads = controllerLeadOffsets();
  const cHalf = CONTROLLER.size / 2 + CONTROLLER.leadLen;
  const cLeft = CONTROLLER.x - cHalf;
  const cRight = CONTROLLER.x + cHalf;
  const cTop = CONTROLLER.z - cHalf;
  const cBottom = CONTROLLER.z + cHalf;

  // PCIe lanes: fingers → AC-coupling caps → controller, routed as pairs on nested lanes.
  PCIE.pairs.forEach((p) => {
    const xc = (fingerX(FINGERS.segA.count + p.fingers[0]) + fingerX(FINGERS.segA.count + p.fingers[1])) / 2;
    const k = 0.12;
    const centre = [
      [xc, FINGERS.z0 + 0.02],
      [xc, p.laneZ + k],
      [xc + k, p.laneZ],
      [p.targetX - k, p.laneZ],
      [p.targetX, p.laneZ - k],
      [p.targetX, cBottom - 0.02],
    ];
    t.pair(centre, PCIE.pairGap, 0.034);
  });

  // Remaining fingers (power, ground, sideband) drop into vias just above the contacts.
  const pairFingers = new Set(PCIE.pairs.flatMap((p) => p.fingers.map((f) => f + FINGERS.segA.count)));
  const totalFingers = FINGERS.segA.count + FINGERS.segB.count;
  for (let i = 0; i < totalFingers; i++) {
    if (pairFingers.has(i)) continue;
    const x = fingerX(i);
    const zv = i % 2 ? 6.66 : 6.78;
    t.path(
      [
        [x, FINGERS.z0 + 0.02],
        [x, zv],
      ],
      0.045,
    );
    t.via(x, zv);
  }

  // PHY ↔ controller parallel bus with a 45° jog and series terminations.
  for (let k = 0; k < 14; k++) {
    const zp = 2.515 + 0.09 * k;
    const zc = 2.22 + 0.12 * k;
    const jx = 7.45;
    t.path(
      [
        [PHY.x + PHY.size / 2 - 0.1, zp],
        [jx, zp],
        [jx + Math.abs(zc - zp), zc],
        [cLeft + 0.02, zc],
      ],
      0.028,
    );
  }

  // Line side: RJ45 → magnetics (short hops) and magnetics → PHY (fan-in under the heatsink).
  const phyLeft = PHY.x - PHY.size / 2 + 0.05;
  MAGNETICS.zs.forEach((zm, m) => {
    const mLeft = MAGNETICS.x - MAGNETICS.w / 2 - 0.12;
    const mRight = MAGNETICS.x + MAGNETICS.w / 2 + 0.12;
    for (let i = 0; i < MAGNETICS.pins; i++) {
      const z = zm + (i - (MAGNETICS.pins - 1) / 2) * MAGNETICS.pitch;
      t.path(
        [
          [PORT.front + PORT.depth - 0.15, z],
          [mLeft + 0.03, z],
        ],
        0.03,
      );
      const zt = 2.3 + 0.1 * (m * MAGNETICS.pins + i);
      t.path(
        [
          [mRight - 0.03, z],
          [3.75, z],
          [4.2, zt],
          [phyLeft, zt],
        ],
        0.028,
      );
    }
  });

  // Controller → on-board queue buffers (fan-out from the right-hand lead row).
  const fan = (leadIdx, zone) => {
    const slotH = (zone.z1 - zone.z0 - 0.2) / 8;
    leadIdx.forEach((li, s) => {
      const zl = CONTROLLER.z + leads[li];
      const zs = zone.z0 + 0.1 + (s + 0.5) * slotH;
      t.path(
        [
          [cRight - 0.02, zl],
          [cRight + 0.07, zl],
          [zone.x0 - 0.07, zs],
          [zone.x0 + 0.14, zs],
        ],
        0.026,
      );
      t.via(zone.x0 - 0.02, zs);
    });
  };
  fan([0, 1, 2, 3, 4, 5, 6, 7], ZONES.rx);
  fan([22, 23, 24, 25, 26, 27, 28, 29], ZONES.tx);

  // Reference crystal to the controller's top lead row.
  t.path(
    [
      [8.5, 1.2],
      [9.66, 1.2],
      [9.74, 1.28],
      [9.74, cTop + 0.02],
    ],
    0.03,
  );
  t.path(
    [
      [8.5, 1.32],
      [9.56, 1.32],
      [9.62, 1.38],
      [9.62, cTop + 0.02],
    ],
    0.03,
  );

  // Port LED drive lines: nested so they never cross.
  for (let k = 0; k < 4; k++) {
    const zl = 0.22 + 0.08 * k;
    const xs = 10.2 - 0.1 * k;
    const xd = 2.21 + 0.08 * k;
    t.path(
      [
        [xs, cTop + 0.02],
        [xs, zl + 0.1],
        [xs - 0.1, zl],
        [xd + 0.1, zl],
        [xd, zl + 0.1],
        [xd, 1.25],
      ],
      0.026,
    );
  }

  // Core power rail from the VRM output to the controller.
  t.path(
    [
      [15.4, 3.9],
      [15.4, 0.55],
      [10.9, 0.55],
      [10.6, 0.85],
      [10.6, 1.35],
    ],
    0.25,
  );
  for (let x = 11.2; x < 15.2; x += 0.45) {
    t.via(x, 0.5);
    t.via(x + 0.1, 0.62);
  }

  // VRM copper pours: switch nodes under the chokes, output plane under the caps.
  [1.1, 2.35, 3.6].forEach((z) => t.pour(13.78, z - 0.34, 15.05, z + 0.34));
  t.pour(15.35, 0.72, 16.4, 4.05);
  for (let z = 0.95; z <= 4.05; z += 0.2) t.via(13.68, z);

  // Stitching vias along the board edges.
  for (let x = 1.2; x < 16.0; x += 0.3) t.via(x, 0.16);
  for (let x = 11.7; x < 15.9; x += 0.3) t.via(x, PCB.H - 0.16);
  for (let z = 0.9; z < 6.0; z += 0.3) t.via(PCB.L - 0.16, z);

  // Decoupling fields around the controller corners.
  for (const [cx, cz] of [
    [cLeft - 0.15, cTop - 0.15],
    [cLeft - 0.15, cBottom + 0.12],
  ]) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) t.via(cx + (i - 1) * 0.12 * Math.sign(cx - CONTROLLER.x), cz + j * 0.12 * Math.sign(cz - CONTROLLER.z));
  }

  return t.build(kit);
}
