import * as THREE from 'three';
import { createPacketBuffer } from './PacketBuffer.js';
import { CELL_TOP, HEADER_RECT } from './layout.js';

const FLOAT = 0.6; // hovers above the floor like the other assets

/** The buffer's two semantic parts, in byte order. */
export const PARTS = ['header', 'payload'];

/**
 * Scene module for the Packet Buffer asset: registers its parts and defines its camera presets —
 * the whole buffer, and its header up close (where an in-place edit is filmed). Nothing moves: it
 * shows where a packet's bytes are, not what happens to them.
 */
export function createPacketBufferScene({ engine, registry, camera }) {
  const buffer = createPacketBuffer();
  const holder = new THREE.Group();
  holder.name = 'packet-buffer-holder';
  holder.add(buffer.root);
  engine.scene.add(holder);

  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(buffer.root);
  const center = box.getCenter(new THREE.Vector3());
  buffer.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  buffer.components.forEach((c) => registry.register(c));

  const modelBox = () => new THREE.Box3().setFromObject(buffer.root);
  /** The header region, in the world: what the Header view frames. */
  const headerBox = () => {
    const r = HEADER_RECT;
    const local = new THREE.Box3(new THREE.Vector3(r.x0 - 0.2, 0, r.z0 - 0.2), new THREE.Vector3(r.x1 + 0.2, CELL_TOP, r.z1 + 0.6));
    return local.applyMatrix4(buffer.root.matrixWorld);
  };

  camera.definePreset('overview', () =>
    engine.aspect < 1
      ? { box: modelBox(), direction: new THREE.Vector3(0, 1.7, 0.75), padding: 1.08 }
      : { box: modelBox(), direction: new THREE.Vector3(-0.2, 0.9, 1), padding: 1.12 },
  );
  camera.definePreset('header', () => ({
    box: headerBox(),
    direction: new THREE.Vector3(0.2, 0.95, 0.8),
    padding: engine.aspect < 1 ? 1.5 : 1.8,
    minDistance: 2.5,
  }));

  return {
    buffer,
    holder,
    modelBox,
    headerBox,
    actions: {},
    isActionActive: () => false,
    update() {},
    dispose() {
      holder.removeFromParent();
      buffer.dispose();
    },
  };
}
