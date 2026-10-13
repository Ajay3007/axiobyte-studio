import * as THREE from 'three';
import { createMbuf } from './Mbuf.js';
import { FIELDS, fieldRect } from './layout.js';

const FLOAT = 0.6; // hovers above the floor like the other assets

/** The mbuf's one semantic part. */
export const PARTS = ['fields'];

/**
 * Scene module for the mbuf asset: registers its part and defines its camera presets — the whole
 * record, and its buf_addr field up close. Nothing moves: it shows what an mbuf is, not a state.
 */
export function createMbufScene({ engine, registry, camera }) {
  const mbuf = createMbuf();
  const holder = new THREE.Group();
  holder.name = 'mbuf-holder';
  holder.add(mbuf.root);
  engine.scene.add(holder);

  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(mbuf.root);
  const center = box.getCenter(new THREE.Vector3());
  mbuf.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  mbuf.components.forEach((c) => registry.register(c));

  const modelBox = () => new THREE.Box3().setFromObject(mbuf.root);
  /** The buf_addr row and its socket, in the world: what the buf_addr view frames. */
  const addrBox = () => {
    const r = fieldRect(FIELDS.indexOf('buf_addr'));
    const local = new THREE.Box3(new THREE.Vector3(r.x0, 0, r.z0 - 0.1), new THREE.Vector3(r.x1 + 0.25, 0.3, r.z1 + 0.1));
    return local.applyMatrix4(mbuf.root.matrixWorld);
  };

  camera.definePreset('overview', () =>
    engine.aspect < 1
      ? { box: modelBox(), direction: new THREE.Vector3(0, 1.6, 0.8), padding: 1.15 }
      : { box: modelBox(), direction: new THREE.Vector3(-0.25, 0.95, 1), padding: 1.25 },
  );
  camera.definePreset('buf_addr', () => ({
    box: addrBox(),
    direction: new THREE.Vector3(0.15, 1, 0.75),
    padding: engine.aspect < 1 ? 1.6 : 1.9,
    minDistance: 2,
  }));

  return {
    mbuf,
    holder,
    modelBox,
    addrBox,
    actions: {},
    isActionActive: () => false,
    update() {},
    dispose() {
      holder.removeFromParent();
      mbuf.dispose();
    },
  };
}
