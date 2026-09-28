import * as THREE from 'three';
import { FINGERS, TOP } from './layout.js';

/**
 * x8 edge connector: 11 + 38 contacts per side split by the key notch.
 * Presence-detect style contacts every few positions are slightly shorter,
 * as on real cards, which breaks up the otherwise perfect row.
 */
export function createPCIeConnector(kit) {
  const group = new THREE.Group();
  group.name = 'pcie-connector';

  const { pitch, width, z0, z1, segA, segB } = FINGERS;
  const xs = [];
  for (let i = 0; i < segA.count; i++) xs.push(segA.x0 + i * pitch + width / 2);
  for (let i = 0; i < segB.count; i++) xs.push(segB.x0 + i * pitch + width / 2);

  const len = z1 - z0;
  const t = 0.006;
  const geo = kit.geometry('pcie-finger', () => {
    const g = new THREE.BoxGeometry(width, t, len);
    g.translate(0, 0, len / 2);
    return g;
  });
  const fingers = new THREE.InstancedMesh(geo, kit.material('gold'), xs.length * 2);
  fingers.name = 'pcie-fingers';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let k = 0;
  xs.forEach((x, i) => {
    const short = i % 12 === 5 || i === 16 || i === xs.length - 2;
    const zs = short ? z0 + 0.09 : z0;
    const scaleZ = (z1 - zs) / len;
    for (const y of [TOP + t / 2, -t / 2]) {
      m.compose(p.set(x, y, zs), q, s.set(1, 1, scaleZ));
      fingers.setMatrixAt(k++, m);
    }
  });
  fingers.instanceMatrix.needsUpdate = true;
  fingers.receiveShadow = true;
  fingers.computeBoundingSphere();
  group.add(fingers);

  // Invisible, generous pick volume: individual 0.7 mm contacts are too thin to hover reliably.
  const x0 = FINGERS.tab.x0;
  const x1 = FINGERS.tab.x1;
  const hitGeo = new THREE.BoxGeometry(x1 - x0, TOP + 0.08, FINGERS.tab.z - z0 + 0.1);
  const hitMat = kit.own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.position.set((x0 + x1) / 2, TOP / 2, (z0 - 0.1 + FINGERS.tab.z) / 2);
  hit.userData.hitOnly = true;
  hit.name = 'pcie-hit';
  group.add(hit);

  const cx = (x0 + x1) / 2;
  return {
    group,
    hitObjects: [hit],
    anchors: {
      in: new THREE.Vector3(cx, TOP + 0.05, z0 - 0.05),
      out: new THREE.Vector3(cx, TOP / 2, FINGERS.tab.z + 0.2),
      center: new THREE.Vector3(cx, TOP / 2, (z0 + z1) / 2),
    },
  };
}
