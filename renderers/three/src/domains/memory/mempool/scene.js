import * as THREE from 'three';
import { createMempool } from './Mempool.js';
import { ELEMENT, FIRST, TRAY, elementRect } from './layout.js';

const FLOAT = 0.6; // hovers above the floor like the other assets

/** The pool's one semantic part. */
export const PARTS = ['elements'];

/**
 * Scene module for the Mempool asset: registers its part and defines its camera presets — the whole
 * pool, the pool seen from above, and one element up close (the first, where the concept's
 * first_slot anchor is). The pool has no modes and nothing moves: it shows structure, not state.
 */
export function createMempoolScene({ engine, registry, camera }) {
  const pool = createMempool();
  const holder = new THREE.Group();
  holder.name = 'mempool-holder';
  holder.add(pool.root);
  engine.scene.add(holder);

  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(pool.root);
  const center = box.getCenter(new THREE.Vector3());
  pool.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  pool.components.forEach((c) => registry.register(c));

  const modelBox = () => new THREE.Box3().setFromObject(pool.root);
  /** The first element, in the world: what the Element view frames — a camera choice, not a part. */
  const elementBox = () => {
    const r = elementRect(FIRST);
    const pad = 0.1;
    const local = new THREE.Box3(new THREE.Vector3(r.x0 - pad, TRAY.h, r.z0 - pad), new THREE.Vector3(r.x1 + pad, TRAY.h + ELEMENT.h, r.z1 + pad));
    return local.applyMatrix4(pool.root.matrixWorld);
  };

  camera.definePreset('overview', () =>
    engine.aspect < 1
      ? { box: modelBox(), direction: new THREE.Vector3(0, 1.7, 0.7), padding: 1.06 }
      : { box: modelBox(), direction: new THREE.Vector3(-0.22, 0.9, 1), padding: 1.1 },
  );
  camera.definePreset('top', () => ({ box: modelBox(), direction: new THREE.Vector3(0, 1, 0.1), padding: 1.1 }));
  camera.definePreset('element', () => ({
    box: elementBox(),
    direction: new THREE.Vector3(0.1, 1, 0.62),
    padding: engine.aspect < 1 ? 1.9 : 2.4,
    minDistance: 3,
  }));

  // Clicking: keep the current viewing angle, drift toward what was picked and zoom in slightly. The
  // elements are the whole grid, so — as on the descriptor ring — the camera may also back out until
  // the selection fits, and centres it fully when it does.
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
    pool,
    holder,
    modelBox,
    elementBox,
    actions: {},
    isActionActive: () => false,
    update() {},
    dispose() {
      holder.removeFromParent();
      pool.dispose();
    },
  };
}
