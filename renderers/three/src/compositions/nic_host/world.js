import * as THREE from 'three';
import { Engine } from '../../core/Engine.js';
import { createLighting } from '../../core/Lighting.js';
import { createStage } from '../../core/Stage.js';
import { CameraManager } from '../../core/CameraManager.js';
import { ComponentRegistry } from '../../core/ComponentRegistry.js';
import { Highlighter } from '../../core/Highlighter.js';
import { LedController } from '../../core/hardware/LedController.js';
import { createNicHostComposition } from './composition.js';

const FLOAT = 0.9; // the system hovers above the floor like the single assets

/**
 * The composition's world: the same services as each asset's world (engine, lights, stage,
 * registry, camera, highlighter) around the composed system, with the composition's own system
 * camera. The page's controls and UI live above it.
 */
export function createNicHostWorld({ container, reducedMotion = false, engine: engineOptions = {} } = {}) {
  const engine = new Engine(container, engineOptions);
  const lighting = createLighting();
  const stage = createStage();
  engine.scene.add(lighting.group, stage.group);

  const system = createNicHostComposition();
  const holder = new THREE.Group();
  holder.name = 'nic-host-holder';
  holder.add(system.root);
  engine.scene.add(holder);
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(system.root);
  const center = box.getCenter(new THREE.Vector3());
  system.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  const registry = new ComponentRegistry();
  system.components.forEach((c) => registry.register(c));
  system.components.forEach((c) => registry.setEnabled(c.id, c.pickable));

  const camera = new CameraManager(engine, { reducedMotion });
  const boxOf = (...objects) => {
    const b = new THREE.Box3();
    objects.forEach((o) => b.union(typeof o === 'string' ? registry.worldBox(o) : new THREE.Box3().setFromObject(o)));
    return b;
  };
  const group = (inst) => system.instances[inst].group;
  const systemBox = () => boxOf(...Object.keys(system.instances).map(group));
  // A short landscape screen (a phone on its side: 500 px tall or less, the pages' own threshold for
  // that layout) keeps the views and controls along its bottom edge, over the front of the system.
  // There the framed box reaches further toward the viewer, so the system sits higher in the frame,
  // clear of them.
  const shortLandscape = () => engine.aspect >= 1 && container.clientHeight <= 500;
  const SHORT_FRONT = 9.5; // cm of empty floor framed in front of the system
  camera.definePreset('system', () => {
    if (engine.aspect < 1) return { box: systemBox(), direction: new THREE.Vector3(-0.12, 1.5, 0.75), padding: 1.04 };
    const box = systemBox();
    if (shortLandscape()) box.max.z += SHORT_FRONT;
    return { box, direction: new THREE.Vector3(-0.32, 0.85, 1), padding: 1.04 };
  });
  camera.definePreset('pcie-path', () => ({ box: boxOf(group('nic'), group('pcie'), group('cpu'), 'route.pcie'), direction: new THREE.Vector3(-0.75, 0.7, 0.85), padding: 1.06 }));
  camera.definePreset('memory-path', () => ({ box: boxOf(group('cpu'), group('memory'), 'route.memory'), direction: new THREE.Vector3(0.3, 0.9, 1), padding: 1.06 }));
  camera.definePreset('dma', () => {
    const b = new THREE.Box3().setFromPoints(system.dmaPath.map((p) => system.root.localToWorld(p.clone())));
    return { box: b.union(registry.worldBox('memory.packet-buffer-region')), direction: new THREE.Vector3(-0.2, 1.3, 0.75), padding: 1.18 };
  });
  // Clicking a part: keep the viewing angle, drift toward the part and zoom in, as on the asset pages.
  // A selection can be as large as a whole asset or the DMA path, so the camera may also back out
  // until it fits, with room for a panel beside or below it.
  camera.addResolver((name, cm) => {
    if (!registry.has(name)) return null;
    const b = registry.worldBox(name);
    const dir = cm.currentDirection();
    const fit = cm.fitDistance(b, dir, 1.0);
    const current = cm.currentDistance();
    const distance = THREE.MathUtils.clamp(Math.max(fit * 2.0, current * 0.62), 6, Math.max(6, current, fit * 1.6));
    // A selection the camera backs out for is centred fully, so it clears a side panel too.
    const target = engine.controls.target.clone().lerp(b.getCenter(new THREE.Vector3()), distance >= current ? 1 : 0.7);
    return { target, position: target.clone().addScaledVector(dir, distance) };
  });
  lighting.fitShadow(systemBox());

  // LEDs flag their materials as noHighlight, so they are registered before highlight clones are made.
  const leds = new LedController({ reducedMotion });
  system.leds.forEach((l) => leds.add(l));
  const highlighter = new Highlighter(registry, { strength: 0.2 });
  highlighter.prepareAll();

  return {
    engine,
    lighting,
    stage,
    registry,
    camera,
    system,
    leds,
    highlighter,
    update(dt, elapsed) {
      leds.update(dt, elapsed);
      system.update(elapsed, { reducedMotion });
    },
    dispose() {
      camera.dispose();
      holder.removeFromParent();
      system.dispose();
      engine.dispose();
    },
  };
}
