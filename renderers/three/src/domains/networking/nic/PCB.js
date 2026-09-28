import * as THREE from 'three';
import { circlePath, extrudeAlongY, mergeAll, polygon, xz } from '../../../core/geometry.js';
import { CORNER_CUT, FINGERS, HOLES, PCB, TOP } from './layout.js';

export const FIDUCIALS = [
  [1.05, 4.75],
  [11.85, 0.3],
  [16.55, 6.62],
];

function outline() {
  const { L, H } = PCB;
  const { tab, notch } = FINGERS;
  const c = 0.08; // chamfer on the card-edge tab, as on real edge connectors
  const r = 0.12;
  const pts = [
    [0, 0],
    [L - r, 0],
    [L, r],
    [L, H - r],
    [L - r, H],
    [tab.x1, H],
    [tab.x1, tab.z - c],
    [tab.x1 - c, tab.z],
    [notch.x1, tab.z],
    [notch.x1, notch.z + 0.06],
    [notch.x1 - 0.05, notch.z],
    [notch.x0 + 0.05, notch.z],
    [notch.x0, notch.z + 0.06],
    [notch.x0, tab.z],
    [tab.x0 + c, tab.z],
    [tab.x0, tab.z - c],
    [tab.x0, H],
    [CORNER_CUT.x, H],
    [CORNER_CUT.x, CORNER_CUT.z],
    [0, CORNER_CUT.z],
  ].map(([x, z]) => xz(x, z));
  const shape = polygon(new THREE.Shape(), pts);
  HOLES.forEach((h) => {
    const [x, y] = xz(h.x, h.z);
    shape.holes.push(circlePath(x, y, h.r));
  });
  return shape;
}

export function createPCB(kit) {
  const group = new THREE.Group();
  group.name = 'pcb';

  const geo = extrudeAlongY(outline(), PCB.T, 0.012, 20);
  const board = new THREE.Mesh(geo, [kit.material('solderMask'), kit.material('pcbEdge')]);
  board.name = 'pcb-substrate';
  board.receiveShadow = true;
  board.castShadow = true;
  group.add(board);

  // Plated annular rings on both faces plus the dark hole barrel.
  const rings = [];
  const barrels = [];
  HOLES.forEach((h) => {
    const ringW = h.kind === 'pin' ? 0.06 : 0.1;
    for (const y of [TOP + 0.0015, -0.0015]) {
      const ring = new THREE.RingGeometry(h.r, h.r + ringW, 32);
      ring.rotateX(y > 0 ? -Math.PI / 2 : Math.PI / 2);
      ring.translate(h.x, y, h.z);
      rings.push(ring);
    }
    const barrel = new THREE.CylinderGeometry(h.r, h.r, PCB.T, 32, 1, true);
    barrel.translate(h.x, PCB.T / 2, h.z);
    barrels.push(barrel);
  });
  FIDUCIALS.forEach(([x, z]) => {
    const dot = new THREE.CircleGeometry(0.05, 20);
    dot.rotateX(-Math.PI / 2);
    dot.translate(x, TOP + 0.0015, z);
    rings.push(dot);
  });

  const plating = new THREE.Mesh(mergeAll(rings), kit.material('copper'));
  plating.name = 'pcb-plating';
  plating.receiveShadow = true;
  const holes = new THREE.Mesh(mergeAll(barrels), kit.material('hole'));
  holes.name = 'pcb-hole-barrels';
  group.add(plating, holes);

  return { group, board };
}
