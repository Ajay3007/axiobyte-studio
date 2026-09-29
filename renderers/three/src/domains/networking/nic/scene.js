import * as THREE from 'three';
import { createNIC } from './NIC.js';
import { HEATSINK } from './layout.js';
import { createHostMemory, HOST_METADATA, HOST_PANEL } from '../HostMemory.js';

const FLOAT = 0.5; // model hovers slightly above the floor for a product-shot feel

/**
 * Scene module for the NIC. This is the only place that knows both the
 * hardware model and the engine services (registry, camera, tweens).
 *
 * `hostMemory` draws the host side of the dataplane beside the card — descriptor
 * rings, packet buffers and the polling CPU core in a HOST MEMORY region, joined to
 * the card's PCIe connector by a DMA link — instead of queue zones on the PCB.
 * The interactive page uses it. `queuesOnCard: false` alone removes the on-board
 * queue zones without drawing a 3D host region: the film does that, and shows the
 * host side in its own diagram column instead.
 */
export function createNicScene({ engine, registry, camera, hostMemory = false, queuesOnCard = !hostMemory }) {
  const nic = createNIC({ queuesOnCard });
  const holder = new THREE.Group();
  holder.name = 'nic-holder';
  holder.add(nic.root);
  engine.scene.add(holder);

  // Centre the card in x/z and rest its lowest point just above the floor.
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(nic.root);
  const center = box.getCenter(new THREE.Vector3());
  nic.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  nic.components.forEach((c) => registry.register(c));

  // The host region sits on the floor beyond the card's far end — outside the card,
  // and inside the empty part of the Overview on desktop and portrait alike, so the
  // Overview (still framed on the card) shows both without moving the camera.
  let host = null;
  if (hostMemory) {
    host = createHostMemory(nic.kit);
    const hx = box.max.x - center.x + 3.9;
    const hz = box.min.z - center.z - 3.5;
    host.group.position.set(hx, 0, hz);
    engine.scene.add(host.group);
    host.group.updateWorldMatrix(true, true);
    host.components.forEach((c) => registry.register({ ...c, meta: HOST_METADATA[c.id] }));

    // PCIe / DMA: out of the edge connector, along the card's near edge, round its far
    // end and into host memory — a bus leaving the card, not a line through it.
    const out = registry.anchorWorld('pcie-connector', 'out');
    const card = new THREE.Box3().setFromObject(nic.root);
    const lane = card.max.z + 0.7;
    const turn = card.max.x + 1.0;
    const floor = 0.05;
    const hostEdge = hz + HOST_PANEL.d / 2;
    host.link = host.createLink(
      [
        new THREE.Vector3(out.x, out.y, out.z),
        new THREE.Vector3(out.x, floor, lane),
        new THREE.Vector3(turn, floor, lane),
        new THREE.Vector3(turn, floor, hostEdge),
      ],
      new THREE.Vector3((out.x + turn) / 2, 0.6, lane),
    );
    engine.scene.add(host.link);
  }

  const modelBox = () => new THREE.Box3().setFromObject(nic.root);
  const boxOf = (...ids) => {
    const b = new THREE.Box3();
    ids.forEach((id) => b.union(registry.worldBox(id)));
    return b;
  };

  // A portrait screen (a phone, a tablet held upright) cannot fit the card's long side from the
  // landscape angle without shrinking it to a sliver, so it looks from the bracket end and a
  // little higher, and the card runs up the screen instead. Landscape — desktop, and the 16:9
  // film — keeps exactly the view it always had. Presets are evaluated when used, so this
  // follows the viewport at the moment the camera moves.
  camera.definePreset('overview', () =>
    engine.aspect < 1
      ? { box: modelBox(), direction: new THREE.Vector3(-0.9, 0.8, 0.3), padding: 1.1 }
      : { box: modelBox(), direction: new THREE.Vector3(-0.62, 0.6, 0.8), padding: 1.06 },
  );
  camera.definePreset('front', () => ({ box: modelBox(), direction: new THREE.Vector3(0, 0.25, 1), padding: 1.06 }));
  camera.definePreset('top', () => ({ box: modelBox(), direction: new THREE.Vector3(0, 1, 0.02), padding: 1.06 }));
  camera.definePreset('rear', () => ({ box: boxOf('bracket'), direction: new THREE.Vector3(-1, 0.2, 0.15), padding: 1.15 }));
  camera.definePreset('pcie', () => ({ box: boxOf('pcie-connector'), direction: new THREE.Vector3(0.2, 0.55, 1), padding: 1.8 }));

  // Named focus targets: cameraManager.focus('rj45' | 'controller' | <component id>)
  const aliases = { rj45: ['rj45-1', 'rj45-2'], controller: ['nic-controller'], heatsink: ['heatsink'], pcie: ['pcie-connector'] };
  camera.addResolver((name) => {
    if (name === 'rj45') return { box: boxOf(...aliases.rj45), direction: new THREE.Vector3(-0.85, 0.45, 0.45), padding: 1.5 };
    if (name === 'controller') return { box: boxOf('nic-controller'), direction: new THREE.Vector3(-0.35, 0.85, 0.55), padding: 2.2 };
    return null;
  });
  // Clicking a part: keep the current viewing angle, drift toward the part and zoom in slightly.
  camera.addResolver((name, cm) => {
    if (!registry.has(name)) return null;
    const b = registry.worldBox(name);
    const dir = cm.currentDirection();
    const fit = cm.fitDistance(b, dir, 1.0);
    const current = cm.currentDistance();
    // A gentle push-in: never more than ~40% closer than the current view.
    const distance = THREE.MathUtils.clamp(Math.max(fit * 3.2, current * 0.62), 10, Math.max(10, current));
    const target = engine.controls.target.clone().lerp(b.getCenter(new THREE.Vector3()), 0.6);
    return { target, position: target.clone().addScaledVector(dir, distance) };
  });

  const actions = {
    'toggle-heatsink': () => {
      const lifted = nic.heatsink.toggle(engine.tweens);
      // Frame the heatsink together with the chip it covers, including where the heatsink will end up.
      const b = boxOf('heatsink').union(boxOf('phy'));
      if (lifted) b.max.y += HEATSINK.lift;
      const view = camera.solve({ box: b, direction: camera.currentDirection(), padding: 1.9 });
      camera.animateTo(view.target, view.position, 950);
      return lifted;
    },
  };

  return {
    nic,
    holder,
    modelBox,
    actions,
    isActionActive: (id) => (id === 'toggle-heatsink' ? nic.heatsink.lifted : false),
    update(dt, elapsed) {
      nic.update(elapsed);
      host?.fitLabels(engine.camera, engine.size.height);
    },
    dispose() {
      holder.removeFromParent();
      host?.group.removeFromParent();
      host?.link?.removeFromParent();
      nic.dispose();
    },
  };
}
