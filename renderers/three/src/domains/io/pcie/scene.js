import * as THREE from 'three';
import { createPCIe } from './PCIe.js';

const FLOAT = 0.5; // the board hovers slightly above the floor, like the NIC

/**
 * Scene module for the PCIe asset: registers its parts and defines its camera presets. The
 * only place that knows both the model and the engine services.
 */
export function createPCIeScene({ engine, registry, camera }) {
  const pcie = createPCIe();
  const holder = new THREE.Group();
  holder.name = 'pcie-holder';
  holder.add(pcie.root);
  engine.scene.add(holder);

  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(pcie.root);
  const center = box.getCenter(new THREE.Vector3());
  pcie.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  pcie.components.forEach((c) => registry.register(c));

  const modelBox = () => new THREE.Box3().setFromObject(pcie.root);
  const boxOf = (...ids) => {
    const b = new THREE.Box3();
    ids.forEach((id) => b.union(registry.worldBox(id)));
    return b;
  };

  // Presets are evaluated when used, so they follow the viewport. On a portrait screen the
  // overview looks along the lanes, so the board's long run fills the tall frame.
  camera.definePreset('overview', () =>
    engine.aspect < 1
      ? { box: modelBox(), direction: new THREE.Vector3(-0.35, 0.95, 0.75), padding: 1.08 }
      : { box: modelBox(), direction: new THREE.Vector3(-0.55, 0.62, 0.82), padding: 1.02 },
  );
  camera.definePreset('top', () => ({ box: modelBox(), direction: new THREE.Vector3(0, 1, 0.02), padding: 1.04 }));
  camera.definePreset('slot', () => ({ box: boxOf('slot'), direction: new THREE.Vector3(-0.28, 0.9, 0.55), padding: 1.18 }));
  camera.definePreset('lanes', () => ({ box: boxOf('link', 'slot'), direction: new THREE.Vector3(0.25, 0.55, 1), padding: 1.02 }));
  camera.definePreset('side', () => ({ box: boxOf('slot'), direction: new THREE.Vector3(-1, 0.22, 0.12), padding: 1.5 }));

  // Clicking a part: keep the current viewing angle, drift toward the part and zoom in slightly.
  camera.addResolver((name, cm) => {
    if (!registry.has(name)) return null;
    const b = registry.worldBox(name);
    const dir = cm.currentDirection();
    const fit = cm.fitDistance(b, dir, 1.0);
    const current = cm.currentDistance();
    const distance = THREE.MathUtils.clamp(Math.max(fit * 3.2, current * 0.62), 6, Math.max(6, current));
    const target = engine.controls.target.clone().lerp(b.getCenter(new THREE.Vector3()), 0.6);
    return { target, position: target.clone().addScaledVector(dir, distance) };
  });

  return {
    pcie,
    holder,
    modelBox,
    actions: {},
    isActionActive: () => false,
    update() {},
    dispose() {
      holder.removeFromParent();
      pcie.dispose();
    },
  };
}
