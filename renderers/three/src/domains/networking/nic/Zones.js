import * as THREE from 'three';
import { boxAt, mergeAll } from '../../../core/geometry.js';
import { TOP, ZONES } from './layout.js';

const ACCENT = 0x6ec1ff;

/**
 * Educational overlay for a queue area: an accent frame, a fill that brightens
 * on hover/selection, and 8 slot plates that later packet animations can
 * light up individually (setSlot) to show descriptors being consumed.
 */
export function createZone(kit, key) {
  const zn = ZONES[key];
  const group = new THREE.Group();
  group.name = `${key}-queue`;
  const w = zn.x1 - zn.x0;
  const d = zn.z1 - zn.z0;
  const cx = (zn.x0 + zn.x1) / 2;
  const cz = (zn.z0 + zn.z1) / 2;
  const y = TOP + 0.008;

  const noHL = (m) => {
    m.userData.noHighlight = true;
    return kit.own(m);
  };

  const fillMat = noHL(new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.035, depthWrite: false, toneMapped: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), fillMat);
  fill.position.set(cx, y, cz);
  fill.renderOrder = 2;

  const frameMat = noHL(new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false }));
  const e = 0.018;
  const frame = new THREE.Mesh(
    mergeAll([
      boxAt(w, 0.002, e, cx, y, zn.z0),
      boxAt(w, 0.002, e, cx, y, zn.z1),
      boxAt(e, 0.002, d, zn.x0, y, cz),
      boxAt(e, 0.002, d, zn.x1, y, cz),
    ]),
    frameMat,
  );
  frame.renderOrder = 2;

  const slotH = (d - 0.2) / 8;
  const slots = [];
  for (let i = 0; i < 8; i++) {
    const mat = noHL(new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.44, slotH - 0.05).rotateX(-Math.PI / 2), mat);
    slot.position.set(zn.x0 + 0.14 + (w - 0.44) / 2, y + 0.001, zn.z0 + 0.1 + (i + 0.5) * slotH);
    slot.renderOrder = 3;
    slots.push(slot);
    group.add(slot);
  }

  const hitMat = kit.own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), hitMat);
  hit.position.set(cx, TOP + 0.07, cz);
  hit.userData.hitOnly = true;

  group.add(fill, frame, hit);

  const slotLevels = new Array(8).fill(0);
  let highlight = 0;
  const render = () => {
    fillMat.opacity = 0.035 + 0.16 * highlight;
    frameMat.opacity = 0.28 + 0.6 * highlight;
    slots.forEach((s, i) => (s.material.opacity = Math.min(0.85, slotLevels[i] * 0.7 + highlight * 0.12)));
  };

  return {
    group,
    hitObjects: [hit],
    slots,
    setHighlight(level) {
      highlight = level;
      render();
    },
    /** 0..1 fill for one descriptor slot (used by future packet-flow mode). */
    setSlot(i, level) {
      slotLevels[i] = level;
      render();
    },
    anchors: {
      in: new THREE.Vector3(zn.x0, TOP + 0.08, cz),
      out: new THREE.Vector3(zn.x1, TOP + 0.08, cz),
      center: new THREE.Vector3(cx, TOP + 0.05, cz),
    },
  };
}
