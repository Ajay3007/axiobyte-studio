import * as THREE from 'three';
import { boxAt, extrudeAlongX, mergeAll, polygon } from '../../engine/geometry.js';
import { createPanScrew } from '../parts/misc.js';
import { BRACKET, PORTS, TOP } from './layout.js';

/** Plate profile in (u, v) = (-z, y), with port windows and hex vent pattern. */
function plateShape() {
  const b = BRACKET;
  const P = (z, y) => [-z, y];
  const shape = polygon(new THREE.Shape(), [
    P(b.z0, b.y0),
    P(b.z0, b.y1),
    P(b.z1, b.y1),
    P(b.z1, b.tongueY1),
    P(b.tongueZ - 0.18, b.tongueY1),
    P(b.tongueZ, b.tongueY1 - 0.24),
    P(b.tongueZ, b.y0 + 0.08),
    P(b.tongueZ - 0.08, b.y0),
  ]);

  PORTS.forEach(({ z }) => {
    shape.holes.push(
      polygon(new THREE.Path(), [
        P(z - b.portHalf, b.portY0),
        P(z + b.portHalf, b.portY0),
        P(z + b.portHalf, b.portY1),
        P(z - b.portHalf, b.portY1),
      ]),
    );
  });

  const pitchZ = 0.25;
  const pitchY = 0.22;
  b.ventBands.forEach(([za, zb]) => {
    let row = 0;
    for (let y = b.y0 + 0.2; y <= b.y1 - 0.18; y += pitchY, row++) {
      for (let z = za + (row % 2 ? pitchZ / 2 : 0); z <= zb; z += pitchZ) {
        const p = new THREE.Path();
        p.absarc(-z, y, b.ventR, 0, Math.PI * 2, true);
        shape.holes.push(p);
      }
    }
  });
  return shape;
}

/** Top fold with the open U-slot for the case screw; drawn in (x, y), extruded along +z. */
function foldGeometry() {
  const b = BRACKET;
  const x0 = b.x - b.t;
  const s0 = b.slotY - b.slotW / 2;
  const s1 = b.slotY + b.slotW / 2;
  const cx = b.foldX - 0.36;
  const shape = new THREE.Shape();
  shape.moveTo(x0, b.y0);
  shape.lineTo(b.foldX, b.y0);
  shape.lineTo(b.foldX, s0);
  shape.lineTo(cx, s0);
  shape.absarc(cx, b.slotY, b.slotW / 2, -Math.PI / 2, Math.PI / 2, true);
  shape.lineTo(b.foldX, s1);
  shape.lineTo(b.foldX, b.y1);
  shape.lineTo(x0, b.y1);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: b.t, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, b.z0);
  return g;
}

function bracketGeometry() {
  const b = BRACKET;
  const plate = extrudeAlongX(plateShape(), b.t, 0, 8);
  plate.translate(b.x - b.t, 0, 0);
  const tabs = b.tabs.map((z) => boxAt(0.98, b.t, 0.56, b.x + 0.49, -b.t / 2, z));
  return mergeAll([plate, foldGeometry(), ...tabs]);
}

export function createBracket(kit) {
  const group = new THREE.Group();
  group.name = 'bracket';
  const plate = new THREE.Mesh(kit.geometry('bracket', bracketGeometry), kit.material('steel'));
  plate.name = 'bracket-plate';
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  BRACKET.tabs.forEach((z) => {
    const screw = createPanScrew(kit, { r: 0.22, height: 0.11 });
    screw.position.set(0.55, TOP, z);
    group.add(screw);
  });

  const cz = (BRACKET.z0 + BRACKET.z1) / 2;
  return {
    group,
    anchors: {
      in: new THREE.Vector3(BRACKET.x - 0.6, TOP + 0.7, cz),
      out: new THREE.Vector3(BRACKET.x + 0.3, TOP + 0.7, cz),
      center: new THREE.Vector3(BRACKET.x, (BRACKET.y0 + BRACKET.y1) / 2, cz),
    },
  };
}
