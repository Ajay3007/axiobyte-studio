import * as THREE from 'three';
import { Ease } from '../../../core/tween.js';
import { createCPU } from './CPU.js';

const FLOAT = 0.9; // hovers above the floor like the other assets, with room to turn over

/** What each mode shows, and which parts can be picked in it. */
export const MODES = {
  package: { open: 0, flip: 0, regions: false, fields: false },
  inside: { open: 1, flip: 0, regions: true, fields: false },
  underside: { open: 0, flip: 1, regions: false, fields: true },
};
export const PICKABLE = {
  package: ['ihs', 'substrate'],
  inside: ['ihs', 'substrate', 'die', 'cores', 'cache', 'memory-controller', 'io'],
  underside: ['substrate', 'lands'],
};
/** The mode a part is inspected in. */
export const MODE_OF = {
  ihs: 'package',
  substrate: 'package',
  die: 'inside',
  cores: 'inside',
  cache: 'inside',
  'memory-controller': 'inside',
  io: 'inside',
  lands: 'underside',
};

/**
 * Scene module for the CPU asset: registers its parts, defines its camera presets and runs its
 * three modes — the package as it ships, the lid lifted to show the die and its regions, and the
 * package turned over to show its lands.
 */
export function createCPUScene({ engine, registry, camera, reducedMotion = false }) {
  const cpu = createCPU();
  const holder = new THREE.Group();
  holder.name = 'cpu-holder';
  holder.add(cpu.root);
  engine.scene.add(holder);

  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(cpu.root);
  const center = box.getCenter(new THREE.Vector3());
  cpu.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  cpu.components.forEach((c) => registry.register(c));

  const modelBox = () => new THREE.Box3().setFromObject(cpu.root);
  const boxOf = (...ids) => {
    const b = new THREE.Box3();
    ids.forEach((id) => b.union(registry.worldBox(id)));
    return b;
  };

  camera.definePreset('overview', () =>
    engine.aspect < 1
      ? { box: boxOf('substrate'), direction: new THREE.Vector3(-0.45, 1, 0.8), padding: 1.18 }
      : { box: boxOf('substrate'), direction: new THREE.Vector3(-0.6, 0.72, 0.8), padding: 1.12 },
  );
  camera.definePreset('top', () => ({ box: boxOf('substrate'), direction: new THREE.Vector3(0, 1, 0.02), padding: 1.08 }));
  camera.definePreset('side', () => ({ box: boxOf('substrate', 'ihs'), direction: new THREE.Vector3(-1, 0.16, 0.2), padding: 1.12 }));
  camera.definePreset('die', () => ({ box: boxOf('die'), direction: new THREE.Vector3(-0.2, 1, 0.62), padding: 1.35 }));

  // Clicking a part: keep the current viewing angle, drift toward the part and zoom in slightly.
  camera.addResolver((name, cm) => {
    if (!registry.has(name)) return null;
    const b = registry.worldBox(name);
    const dir = cm.currentDirection();
    const fit = cm.fitDistance(b, dir, 1.0);
    const current = cm.currentDistance();
    const distance = THREE.MathUtils.clamp(Math.max(fit * 2.6, current * 0.7), 4, Math.max(4, current));
    const target = engine.controls.target.clone().lerp(b.getCenter(new THREE.Vector3()), 0.6);
    return { target, position: target.clone().addScaledVector(dir, distance) };
  });

  let mode = 'package';
  const state = { open: 0, flip: 0 };
  let tween = null;
  const apply = () => {
    cpu.setOpen(state.open);
    cpu.setFlip(state.flip);
  };
  const enable = (m) => {
    const on = new Set(PICKABLE[m]);
    cpu.components.forEach((c) => registry.setEnabled(c.id, on.has(c.id)));
  };
  enable(mode);

  /** Switch mode; `onDone` runs when the motion has finished (at once with reduced motion). */
  function setMode(next, { duration = 1000, onDone } = {}) {
    if (!MODES[next]) throw new Error(`Unknown CPU mode "${next}"`);
    mode = next;
    const target = MODES[next];
    tween?.cancel();
    cpu.setRegionsVisible(false);
    cpu.setFieldsVisible(false);
    enable(next);
    const from = { ...state };
    const done = () => {
      cpu.setRegionsVisible(target.regions);
      cpu.setFieldsVisible(target.fields);
      onDone?.();
    };
    if (reducedMotion || duration === 0) {
      state.open = target.open;
      state.flip = target.flip;
      apply();
      done();
      return;
    }
    tween = engine.tweens.add({
      duration,
      ease: Ease.inOutCubic,
      onUpdate: (k) => {
        state.open = from.open + (target.open - from.open) * k;
        state.flip = from.flip + (target.flip - from.flip) * k;
        apply();
      },
      onComplete: done,
    });
  }

  return {
    cpu,
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
      cpu.dispose();
    },
  };
}
