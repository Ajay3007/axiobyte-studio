import * as THREE from 'three';
import { createNicHostComposition } from './composition.js';
import { OUTLINES, PICKS, createOutline } from './walkthrough.js';

const FLOAT = 0.9; // as in world.js: the system hovers above the floor like the single assets
const OPACITY = 0.95; // the walkthrough's steady outline (its reduced-motion value)

/**
 * The nic_host composition as a VIDEO stage: the same system the page builds
 * (createNicHostComposition, its contract, its assets, its DMA path), mounted into a film's world
 * — that world's engine, registry and highlighter — so a storyboard can frame it, highlight its
 * parts and outline the walkthrough's illustrative picks, all as a pure function of time.
 *
 * It adds nothing to the system. Its components keep their instance-prefixed ids
 * (`rx_ring.descriptors`, `memory.packet-buffer-region`, `interaction.dma`), so they register
 * beside an asset's own without colliding. The outlines are the walkthrough's frames
 * (createOutline): presentation, never picked, never registered, and the pairing they show is
 * illustrative (PICKS), not a binding the contract makes.
 *
 * lanes = {
 *   windows:  [{ from, to }]           when the system is on screen
 *   dma:      [{ from, to }]           when its DMA flow shows (inside a window)
 *   outlines: [{ name, from, to }]     an outline (OUTLINES) on screen, faded in and out
 * }
 */
export function createNicHostVideoStage({ engine, registry, highlighter = null }) {
  const system = createNicHostComposition();
  const holder = new THREE.Group();
  holder.name = 'nic-host-video';
  holder.add(system.root);
  engine.scene.add(holder);
  // Placed exactly as the page's world places it: centred, resting just above the floor.
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(system.root);
  const center = box.getCenter(new THREE.Vector3());
  system.root.position.set(-center.x, FLOAT - box.min.y, -center.z);
  holder.updateWorldMatrix(true, true);

  for (const c of system.components) {
    if (registry.has(c.id)) throw new Error(`nic_host video stage: "${c.id}" is already registered in this world`);
    registry.register(c);
    highlighter?.prepare(registry.get(c.id));
  }

  // One outline per name, each with its own material so each fades on its own.
  const outlineGroup = new THREE.Group();
  outlineGroup.name = 'video-outlines';
  system.root.add(outlineGroup);
  const outlines = Object.fromEntries(
    OUTLINES.map((name) => {
      const material = new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const mesh = createOutline(system, name, material);
      mesh.name = `video-outline:${name}`;
      mesh.visible = false;
      outlineGroup.add(mesh);
      return [name, { mesh, material }];
    }),
  );

  holder.visible = false;
  system.setDmaVisible(false);

  const within = (list = [], t) => list.some((w) => t >= w.from && t < w.to);
  const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)));
  const levelOf = (list = [], name, t) =>
    list
      .filter((o) => o.name === name)
      .reduce((v, o) => Math.max(v, Math.min(ramp(t, o.from - 0.4, o.from + 0.2), 1 - ramp(t, o.to - 0.1, o.to + 0.5))), 0);

  return {
    system,
    holder,
    picks: PICKS,
    /** The whole system's world box, for framing and for fitting the shadow. */
    systemBox() {
      const b = new THREE.Box3();
      Object.values(system.instances).forEach((i) => b.union(new THREE.Box3().setFromObject(i.group)));
      return b;
    },
    /** The outlines on screen at the last update: [name, opacity]. */
    outlinesShown() {
      return Object.entries(outlines)
        .filter(([, o]) => o.mesh.visible)
        .map(([name, o]) => [name, o.material.opacity]);
    },
    /** Put the stage at time t. A pure function of t and the lanes; returns whether it shows. */
    update(t, lanes = {}) {
      const on = within(lanes.windows, t);
      holder.visible = on;
      system.setDmaVisible(on && within(lanes.dma, t));
      for (const [name, o] of Object.entries(outlines)) {
        const level = on ? levelOf(lanes.outlines, name, t) : 0;
        o.material.opacity = OPACITY * level;
        o.mesh.visible = level > 0.01;
      }
      system.update(t);
      return on;
    },
    dispose() {
      Object.values(outlines).forEach((o) => {
        o.mesh.geometry.dispose();
        o.material.dispose();
      });
      holder.removeFromParent();
      system.dispose();
    },
  };
}
