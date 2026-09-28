import * as THREE from 'three';
import { boxAt, extrudeAlongY, HelixCurve, mergeAll, roundedRect } from '../../geometry.js';

function mesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/** 2.54 mm pin header (e.g. JTAG/debug): plastic carrier plus gold square posts. */
export function createHeader(kit, { cols = 5, rows = 2, pitch = 0.254 } = {}) {
  const group = new THREE.Group();
  group.name = 'header';
  const w = cols * pitch;
  const d = rows * pitch;
  const base = mesh(
    kit.geometry(`hdr-base:${cols}x${rows}`, () => extrudeAlongY(roundedRect(new THREE.Shape(), -w / 2, -d / 2, w / 2, d / 2, 0.02), 0.25, 0.012, 2)),
    kit.material('plastic'),
  );
  const pins = mesh(
    kit.geometry(`hdr-pins:${cols}x${rows}`, () => {
      const parts = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = (c - (cols - 1) / 2) * pitch;
          const z = (r - (rows - 1) / 2) * pitch;
          parts.push(boxAt(0.064, 0.58, 0.064, x, 0.29, z));
          const tip = new THREE.ConeGeometry(0.045, 0.04, 4, 1);
          tip.rotateY(Math.PI / 4);
          tip.translate(x, 0.6, z);
          parts.push(tip);
        }
      }
      return mergeAll(parts);
    }),
    kit.material('gold'),
  );
  group.add(base, pins);
  return group;
}

/** SMD crystal: ceramic base with a seam-welded metal lid. */
export function createCrystal(kit, { w = 0.32, d = 0.25 } = {}) {
  const group = new THREE.Group();
  group.name = 'crystal';
  const base = mesh(kit.geometry(`xtal-base:${w}`, () => boxAt(w, 0.03, d, 0, 0.015, 0)), kit.material('ceramic'));
  const lid = mesh(
    kit.geometry(`xtal-lid:${w}`, () =>
      extrudeAlongY(roundedRect(new THREE.Shape(), -w / 2 + 0.015, -d / 2 + 0.015, w / 2 - 0.015, d / 2 - 0.015, 0.03), 0.055, 0.01, 3).translate(0, 0.03, 0),
    ),
    kit.material('nickel'),
  );
  group.add(base, lid);
  return group;
}

/**
 * 0603 indicator LED. The lens material is returned separately so the
 * LedController can animate it; each LED gets its own lens material.
 */
export function createLedPackage(kit, color) {
  const group = new THREE.Group();
  group.name = 'led';
  const body = mesh(kit.geometry('led-body', () => boxAt(0.16, 0.035, 0.08, 0, 0.0175, 0)), kit.material('ledBody'));
  const lensMat = kit.own(
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 0.6, roughness: 0.25, transparent: true, opacity: 0.92 }),
  );
  const lens = mesh(kit.geometry('led-lens', () => boxAt(0.1, 0.03, 0.07, 0, 0.05, 0)), lensMat);
  lens.castShadow = false;
  group.add(body, lens);
  return { group, lensMat };
}

/** Pan-head Phillips screw with washer face, head top at y = height. */
export function createPanScrew(kit, { r = 0.16, height = 0.1 } = {}) {
  const group = new THREE.Group();
  group.name = 'screw';
  const head = mesh(
    kit.geometry(`screw-head:${r}`, () => {
      const pts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(r, 0),
        new THREE.Vector2(r, height * 0.35),
        new THREE.Vector2(r * 0.92, height * 0.78),
        new THREE.Vector2(r * 0.7, height),
        new THREE.Vector2(0, height),
      ];
      return new THREE.LatheGeometry(pts, 28);
    }),
    kit.material('steel'),
  );
  const slot = mesh(
    kit.geometry(`screw-slot:${r}`, () => mergeAll([boxAt(r * 1.1, 0.02, r * 0.2, 0, height, 0), boxAt(r * 0.2, 0.02, r * 1.1, 0, height, 0)])),
    kit.material('dimple'),
  );
  slot.rotation.y = Math.PI / 5;
  group.add(head, slot);
  return group;
}

/**
 * Heatsink push pin: plastic cap, compression spring and shaft whose split
 * tip passes through the PCB. Origin at the top of the heatsink ear.
 */
export function createPushPin(kit, { springHeight = 0.26, boardDepth = 0.62 } = {}) {
  const group = new THREE.Group();
  group.name = 'push-pin';
  const cap = mesh(
    kit.geometry('pin-cap', () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.2, 0),
          new THREE.Vector2(0.21, 0.04),
          new THREE.Vector2(0.18, 0.09),
          new THREE.Vector2(0, 0.1),
        ],
        28,
      ),
    ),
    kit.material('pushPin'),
  );
  cap.position.y = springHeight;
  const shaft = mesh(
    kit.geometry('pin-shaft', () => {
      const g = new THREE.CylinderGeometry(0.055, 0.055, springHeight + boardDepth, 12);
      g.translate(0, (springHeight - boardDepth) / 2, 0);
      const tip = new THREE.ConeGeometry(0.09, 0.12, 12);
      tip.rotateX(Math.PI);
      tip.translate(0, -boardDepth - 0.02, 0);
      return mergeAll([g, tip]);
    }),
    kit.material('pushPin'),
  );
  const spring = mesh(
    kit.geometry('pin-spring', () => new THREE.TubeGeometry(new HelixCurve(0.12, springHeight, 4.5), 90, 0.014, 5, false)),
    kit.material('spring'),
  );
  group.add(cap, shaft, spring);
  return group;
}
