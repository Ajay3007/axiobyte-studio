import * as THREE from 'three';
import { boxAt, extrudeAlongY, mergeAll, roundedRect } from '../../geometry.js';

/** Chip package sizes in cm: [length, height, width]. */
export const PACKAGES = {
  '0201': [0.06, 0.023, 0.03],
  '0402': [0.1, 0.035, 0.05],
  '0603': [0.16, 0.045, 0.08],
  '0805': [0.2, 0.055, 0.125],
  '1206': [0.32, 0.06, 0.16],
};

function chipParts(bodyMaterial, capFraction) {
  return (pkg) => {
    const [l, h, w] = PACKAGES[pkg];
    const cap = l * capFraction;
    return [
      { material: bodyMaterial, build: () => boxAt(l - 2 * cap + 0.002, h * 0.96, w * 0.96, 0, h * 0.48, 0) },
      {
        material: 'tin',
        build: () => mergeAll([boxAt(cap, h, w, -(l - cap) / 2, h / 2, 0), boxAt(cap, h, w, (l - cap) / 2, h / 2, 0)]),
      },
    ];
  };
}

/**
 * Each kind maps a size key to the sub-meshes that make up the part. A part is
 * rendered as one InstancedMesh per sub-mesh, so 300 resistors cost 2 draw calls.
 */
const KINDS = {
  resistor: chipParts('resistor', 0.16),
  capacitor: chipParts('ceramic', 0.18),

  inductor: (key) => {
    const [s, h] = key.split('x').map(Number);
    return [
      {
        material: 'ferrite',
        build: () => extrudeAlongY(roundedRect(new THREE.Shape(), -s / 2, -s / 2, s / 2, s / 2, s * 0.08), h, 0.018, 4),
      },
      {
        material: 'tin',
        build: () => mergeAll([boxAt(s * 0.16, 0.03, s * 0.72, -s / 2 + 0.02, 0.015, 0), boxAt(s * 0.16, 0.03, s * 0.72, s / 2 - 0.02, 0.015, 0)]),
      },
    ];
  },

  polymerCap: (key) => {
    const [r, h] = key.split('x').map(Number);
    return [
      {
        material: 'aluminum',
        build: () => {
          const can = new THREE.CylinderGeometry(r, r, h - 0.06, 32, 1);
          can.translate(0, 0.06 + (h - 0.06) / 2, 0);
          const rim = new THREE.TorusGeometry(r * 0.93, 0.012, 6, 32);
          rim.rotateX(Math.PI / 2);
          rim.translate(0, h - 0.07, 0);
          return mergeAll([can, rim]);
        },
      },
      { material: 'capMark', build: () => boxAt(r * 2.1, 0.06, r * 2.1, 0, 0.03, 0) },
      {
        material: 'capMark',
        build: () => {
          // Polarity band printed on the top of the can.
          const band = new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.004, 32, 1, false, -0.7, 1.4);
          band.translate(0, h + 0.002, 0);
          return band;
        },
      },
    ];
  },

  powerFet: () => [
    { material: 'mold', build: () => boxAt(0.5, 0.1, 0.6, 0.03, 0.05, 0) },
    {
      material: 'tin',
      build: () => mergeAll([boxAt(0.5, 0.015, 0.1, 0.03, 0.0075, 0.33), ...[-0.19, -0.063, 0.063, 0.19].map((x) => boxAt(0.05, 0.015, 0.09, x, 0.0075, -0.33))]),
    },
  ],

  sot23: () => [
    { material: 'mold', build: () => boxAt(0.29, 0.1, 0.13, 0, 0.06, 0) },
    {
      material: 'tin',
      build: () => mergeAll([boxAt(0.04, 0.012, 0.1, -0.095, 0.006, -0.1), boxAt(0.04, 0.012, 0.1, 0.095, 0.006, -0.1), boxAt(0.04, 0.012, 0.1, 0, 0.006, 0.1)]),
    },
  ],
};

export class PartBatch {
  constructor(kit, { surfaceY = 0 } = {}) {
    this.kit = kit;
    this.surfaceY = surfaceY;
    this.buckets = new Map();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._up = new THREE.Vector3(0, 1, 0);
  }

  add(kind, key, x, z, rot = 0) {
    const id = `${kind}|${key}`;
    if (!this.buckets.has(id)) this.buckets.set(id, { kind, key, matrices: [] });
    this._q.setFromAxisAngle(this._up, rot);
    this._m.compose(this._p.set(x, this.surfaceY, z), this._q, this._s);
    this.buckets.get(id).matrices.push(this._m.clone());
    return this;
  }

  // The create* vocabulary requested for the model; they all feed the batch.
  resistor(x, z, { pkg = '0402', rot = 0 } = {}) {
    return this.add('resistor', pkg, x, z, rot);
  }

  capacitor(x, z, { pkg = '0402', rot = 0 } = {}) {
    return this.add('capacitor', pkg, x, z, rot);
  }

  inductor(x, z, { size = 0.75, height = 0.42, rot = 0 } = {}) {
    return this.add('inductor', `${size}x${height}`, x, z, rot);
  }

  polymerCap(x, z, { r = 0.3, height = 0.55 } = {}) {
    return this.add('polymerCap', `${r}x${height}`, x, z, 0);
  }

  mosfet(x, z, { rot = 0 } = {}) {
    return this.add('powerFet', 'pp56', x, z, rot);
  }

  sot23(x, z, { rot = 0 } = {}) {
    return this.add('sot23', 'sot23', x, z, rot);
  }

  get count() {
    let n = 0;
    this.buckets.forEach((b) => (n += b.matrices.length));
    return n;
  }

  build(name = 'smd') {
    const group = new THREE.Group();
    group.name = name;
    for (const { kind, key, matrices } of this.buckets.values()) {
      KINDS[kind](key).forEach((part, i) => {
        const geo = this.kit.geometry(`smd:${kind}:${key}:${i}`, part.build);
        const mesh = new THREE.InstancedMesh(geo, this.kit.material(part.material), matrices.length);
        matrices.forEach((m, k) => mesh.setMatrixAt(k, m));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        mesh.name = `${kind}-${key}-${i}`;
        group.add(mesh);
      });
    }
    return group;
  }
}
