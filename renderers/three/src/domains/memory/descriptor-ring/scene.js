import * as THREE from 'three';
import { createDescriptorRing } from './DescriptorRing.js';
import { BASE, RING, SLOT, cardRect } from './layout.js';

const FLOAT = 0.6; // hovers above the floor like the other assets

/** The ring's one semantic part, and its two anchors — inspectable on the page, never parts. */
export const PARTS = ['descriptors'];
export const ANCHORS = ['head', 'tail'];

/**
 * Scene module for the Descriptor Ring asset: registers its part and its head and tail marks,
 * and defines its camera presets — the whole ring, the ring seen from above, and one
 * representative descriptor up close. The ring has no modes and nothing moves: it shows
 * structure, not runtime state.
 */
export function createDescriptorRingScene({ engine, registry, camera }) {
  const ring = createDescriptorRing();
  const holder = new THREE.Group();
  holder.name = 'descriptor-ring-holder';
  holder.add(ring.root);
  engine.scene.add(holder);

  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(ring.root);
  const center = box.getCenter(new THREE.Vector3());
  ring.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  ring.components.forEach((c) => registry.register(c));
  ring.marks.forEach((m) => registry.register(m));

  const modelBox = () => new THREE.Box3().setFromObject(ring.root);
  /** One descriptor's slot top, in the world: what the Descriptor view frames. */
  const descriptorBox = () => {
    const r = cardRect(RING.representative);
    const pad = 0.12;
    const local = new THREE.Box3(new THREE.Vector3(r.x0 - pad, BASE.h, r.z0 - pad), new THREE.Vector3(r.x1 + pad, BASE.h + SLOT.h, r.z1 + pad));
    return local.applyMatrix4(ring.root.matrixWorld);
  };

  camera.definePreset('overview', () =>
    engine.aspect < 1
      ? { box: modelBox(), direction: new THREE.Vector3(0, 1.6, 0.72), padding: 1.04 }
      : { box: modelBox(), direction: new THREE.Vector3(-0.24, 0.92, 1), padding: 1.1 },
  );
  camera.definePreset('ring', () => ({ box: modelBox(), direction: new THREE.Vector3(0, 1, 0.1), padding: 1.14 }));
  camera.definePreset('descriptor', () => ({
    box: descriptorBox(),
    direction: new THREE.Vector3(0.1, 1, 0.62),
    padding: engine.aspect < 1 ? 1.9 : 2.5,
    minDistance: 3.2,
  }));

  // Clicking: keep the current viewing angle, drift toward what was picked and zoom in slightly.
  // The descriptors are the whole ring, so — as in the nic_host world — the camera may also back
  // out until a large selection fits, and centres it fully when it does, clear of the panel.
  camera.addResolver((name, cm) => {
    if (!registry.has(name)) return null;
    const b = registry.worldBox(name);
    const dir = cm.currentDirection();
    const fit = cm.fitDistance(b, dir, 1.0);
    const current = cm.currentDistance();
    const distance = THREE.MathUtils.clamp(Math.max(fit * 1.9, current * 0.72), 4, Math.max(4, current, fit * 1.6));
    const target = engine.controls.target.clone().lerp(b.getCenter(new THREE.Vector3()), distance >= current ? 1 : 0.6);
    return { target, position: target.clone().addScaledVector(dir, distance) };
  });

  return {
    ring,
    holder,
    modelBox,
    descriptorBox,
    actions: {},
    isActionActive: () => false,
    update() {},
    dispose() {
      holder.removeFromParent();
      ring.dispose();
    },
  };
}

