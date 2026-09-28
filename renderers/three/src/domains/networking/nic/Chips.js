import * as THREE from 'three';
import { boxAt, mergeAll } from '../../../core/geometry.js';
import { createIC } from '../../../core/hardware/parts/ic.js';
import { CONTROLLER, MAGNETICS, PHY, TOP } from './layout.js';

/** Main Ethernet controller: 120-lead QFP with a laser-etched top marking. */
export function createController(kit) {
  const c = CONTROLLER;
  const group = createIC(kit, {
    name: 'nic-controller',
    w: c.size,
    d: c.size,
    h: c.h,
    standoff: c.standoff,
    pins: { x: c.leadsPerSide, z: c.leadsPerSide },
    pitch: c.pitch,
    leadLen: c.leadLen,
    leadW: 0.03,
    label: ['AXIOBYTE', 'NIC CONTROLLER', 'AX550-T2  B1', '2638  TWN'],
    labelScale: 0.74,
  });
  group.position.set(c.x, TOP, c.z);
  const half = c.size / 2 + c.leadLen;
  return {
    group,
    anchors: {
      in: new THREE.Vector3(-half - 0.05, 0.12, 0),
      out: new THREE.Vector3(0, 0.12, half + 0.05),
      dma: new THREE.Vector3(0.35, c.standoff + c.h + 0.05, 0.45),
      center: new THREE.Vector3(0, c.standoff + c.h, 0),
    },
  };
}

/**
 * 10GBASE-T PHY as a flip-chip BGA: laminate substrate, exposed glossy die,
 * die-side capacitors and a thermal pad. It is normally hidden by the heatsink.
 */
export function createPHY(kit) {
  const group = new THREE.Group();
  group.name = 'phy';
  group.position.set(PHY.x, TOP, PHY.z);
  const s = PHY.size;

  const substrate = new THREE.Mesh(kit.geometry('phy-substrate', () => boxAt(s, 0.07, s, 0, 0.02 + 0.035, 0)), kit.material('substrate'));
  const balls = new THREE.Mesh(
    kit.geometry('phy-balls', () => {
      // Only the outer ring of solder balls is ever visible, so only that is modelled.
      const parts = [];
      const n = 16;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i > 0 && j > 0 && i < n - 1 && j < n - 1) continue;
          const g = new THREE.SphereGeometry(0.022, 6, 4);
          g.translate((i - (n - 1) / 2) * 0.1, 0.02, (j - (n - 1) / 2) * 0.1);
          parts.push(g);
        }
      }
      return mergeAll(parts);
    }),
    kit.material('tin'),
  );
  const die = new THREE.Mesh(kit.geometry('phy-die', () => boxAt(0.92, 0.05, 0.86, 0, 0.09 + 0.025, 0)), kit.material('moldGloss'));
  const pad = new THREE.Mesh(kit.geometry('phy-pad', () => boxAt(0.8, 0.012, 0.74, 0, 0.14 + 0.006, 0)), kit.material('ferrite'));
  const caps = new THREE.Mesh(
    kit.geometry('phy-caps', () => {
      const parts = [];
      for (let i = 0; i < 6; i++) {
        const o = -0.55 + i * 0.22;
        parts.push(boxAt(0.1, 0.035, 0.05, o, 0.09 + 0.0175, -0.66));
        parts.push(boxAt(0.1, 0.035, 0.05, o, 0.09 + 0.0175, 0.66));
        parts.push(boxAt(0.05, 0.035, 0.1, -0.7, 0.09 + 0.0175, o));
        parts.push(boxAt(0.05, 0.035, 0.1, 0.7, 0.09 + 0.0175, o));
      }
      return mergeAll(parts);
    }),
    kit.material('ceramic'),
  );
  [substrate, balls, die, pad, caps].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
  return {
    group,
    anchors: {
      in: new THREE.Vector3(-s / 2, 0.1, 0),
      out: new THREE.Vector3(s / 2, 0.1, 0),
      center: new THREE.Vector3(0, 0.12, 0),
    },
  };
}

/** Discrete LAN transformer (magnetics) behind each port. */
export function createMagnetics(kit, index, z) {
  const group = createIC(kit, {
    name: `magnetics-${index}`,
    w: MAGNETICS.w,
    d: MAGNETICS.d,
    h: MAGNETICS.h,
    standoff: 0.02,
    pins: { x: MAGNETICS.pins, z: 0 },
    pitch: MAGNETICS.pitch,
    leadLen: 0.12,
    leadW: 0.05,
    label: ['AXB', 'G10-2638', 'LAN XFMR'],
    labelScale: 0.7,
  });
  group.position.set(MAGNETICS.x, TOP, z);
  const half = MAGNETICS.w / 2 + 0.12;
  return {
    group,
    anchors: {
      in: new THREE.Vector3(-half, 0.2, 0),
      out: new THREE.Vector3(half, 0.2, 0),
      center: new THREE.Vector3(0, MAGNETICS.h, 0),
    },
  };
}
