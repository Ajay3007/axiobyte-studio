import * as THREE from 'three';
import { Ease } from '../../../core/tween.js';
import { createHostMemory } from './HostMemory.js';

const FLOAT = 0.6; // hovers above the floor like the other assets

export const PHYSICAL = ['dimm-0', 'dimm-1'];
export const LOGICAL = ['address-space', 'descriptor-region', 'packet-buffer-region', 'other-memory'];

/** What each mode shows: the modules alone, or the modules with the map of their address space. */
export const MODES = {
  physical: { map: 0 },
  allocation: { map: 1 },
};
/** Which parts can be picked in each mode. The modules are always there; the map only when shown. */
export const PICKABLE = {
  physical: [...PHYSICAL],
  allocation: [...PHYSICAL, ...LOGICAL],
};
/** The mode a logical part is inspected in. The modules are inspected in whichever mode is on. */
export const MODE_OF = Object.fromEntries(LOGICAL.map((id) => [id, 'allocation']));

/**
 * Scene module for the Host Memory asset: registers its parts, defines its camera presets and
 * runs its two modes — the physical modules alone, and the modules with the logical map of the
 * address space they provide unfolded in front of them.
 */
export function createHostMemoryScene({ engine, registry, camera, reducedMotion = false, mode: initial = 'allocation' }) {
  const memory = createHostMemory();
  const holder = new THREE.Group();
  holder.name = 'host-memory-holder';
  holder.add(memory.root);
  engine.scene.add(holder);

  memory.setMap(1);
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(memory.root);
  const center = box.getCenter(new THREE.Vector3());
  memory.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  memory.components.forEach((c) => registry.register(c));

  const boxOf = (...ids) => {
    const b = new THREE.Box3();
    ids.forEach((id) => b.union(registry.worldBox(id)));
    return b;
  };
  const shown = () => (MODES[mode].map ? [...PHYSICAL, ...LOGICAL] : PHYSICAL);
  const modelBox = () => boxOf(...shown());

  camera.definePreset('overview', () =>
    engine.aspect < 1
      ? { box: modelBox(), direction: new THREE.Vector3(-0.14, 1.3, 0.8), padding: 1.08 }
      : { box: modelBox(), direction: new THREE.Vector3(-0.3, 0.8, 1), padding: 1.16 },
  );
  camera.definePreset('modules', () => ({ box: boxOf(...PHYSICAL), direction: new THREE.Vector3(-0.22, 0.3, 1), padding: 1.16 }));
  camera.definePreset('map', () => ({ box: boxOf(...LOGICAL), direction: new THREE.Vector3(0, 1, 0.32), padding: 1.04 }));

  // Clicking a part: keep the current viewing angle, drift toward the part and zoom in slightly.
  camera.addResolver((name, cm) => {
    if (!registry.has(name)) return null;
    const b = registry.worldBox(name);
    const dir = cm.currentDirection();
    const fit = cm.fitDistance(b, dir, 1.0);
    const current = cm.currentDistance();
    const distance = THREE.MathUtils.clamp(Math.max(fit * 1.9, current * 0.72), 6, Math.max(6, current));
    const target = engine.controls.target.clone().lerp(b.getCenter(new THREE.Vector3()), 0.6);
    return { target, position: target.clone().addScaledVector(dir, distance) };
  });

  let mode = initial;
  const state = { map: MODES[mode].map };
  let tween = null;
  const enable = (m) => {
    const on = new Set(PICKABLE[m]);
    memory.components.forEach((c) => registry.setEnabled(c.id, on.has(c.id)));
  };
  memory.setMap(state.map);
  enable(mode);

  /** Switch mode; `onDone` runs when the motion has finished (at once with reduced motion). */
  function setMode(next, { duration = 800, onDone } = {}) {
    if (!MODES[next]) throw new Error(`Unknown Host Memory mode "${next}"`);
    mode = next;
    const target = MODES[next].map;
    tween?.cancel();
    enable(next);
    const from = state.map;
    const apply = (k) => {
      state.map = from + (target - from) * k;
      memory.setMap(state.map);
    };
    if (reducedMotion || duration === 0 || from === target) {
      apply(1);
      onDone?.();
      return;
    }
    tween = engine.tweens.add({ duration, ease: Ease.inOutCubic, onUpdate: apply, onComplete: () => onDone?.() });
  }

  return {
    memory,
    holder,
    modelBox,
    setMode,
    get mode() {
      return mode;
    },
    actions: {},
    isActionActive: () => false,
    update() {},
    dispose() {
      tween?.cancel();
      holder.removeFromParent();
      memory.dispose();
    },
  };
}
