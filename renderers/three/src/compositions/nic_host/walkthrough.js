import * as THREE from 'three';
import { BASE as RING_BASE, RING, SLOT, cardRect } from '../../domains/memory/descriptor-ring/layout.js';
import { ELEMENT, FIRST, TRAY, bufferRect, elementRect, mbufRect } from '../../domains/memory/mempool/layout.js';

/**
 * The illustrative receive-path walkthrough: presentation over the nic_host composition, never part
 * of it. It reads the composed system and adds transient outlines, highlights and camera moves; it
 * writes nothing to the contract, registers nothing, draws no link between assets and never
 * retargets the DMA path, which still ends in host memory's packet-buffer region.
 *
 * Illustrative only: the ring's representative slot and the pool's first element are the pair this
 * walkthrough shows. They are the assets' existing representative anchors (the ring's `slot`, the
 * pool's `first_slot`); the pairing is chosen for the explanation and does not represent a static
 * descriptor-to-element binding — the contract's reference stays rx_ring.descriptors →
 * memory.packet-buffer-region, and any descriptor could name any free buffer.
 */
export const PICKS = Object.freeze({ slot: RING.representative, element: FIRST });

/**
 * The steps. `outline` names transient frames (slot, buffer, element, mbuf, region); `highlight` is
 * an existing component the Highlighter brightens; `view` is what the camera frames; `dma` shows the
 * composition's existing DMA flow for that step.
 */
export const STEPS = Object.freeze([
  {
    id: 'descriptor',
    objective: 'RING-1',
    caption: 'Before a packet arrives, a descriptor holds the address of a free buffer.',
    outline: ['slot'],
    highlight: 'rx_ring.descriptors',
    view: 'ring',
  },
  {
    id: 'buffer',
    objective: 'HMEM-1',
    caption: 'Before arrival, that buffer waits in host memory’s packet-buffer region — here, one of the mempool’s buffers.',
    outline: ['slot', 'buffer', 'region'],
    highlight: 'memory.packet-buffer-region',
    view: 'memory',
  },
  {
    id: 'element',
    objective: 'POOL-1',
    caption: 'Set up in advance, the buffers come from a mempool: each with its mbuf.',
    outline: ['element'],
    highlight: 'pool.elements',
    view: 'pool',
  },
  {
    id: 'dma',
    objective: 'DMA-1',
    caption: 'A packet arrives: the NIC’s DMA writes its bytes into the buffer the descriptor named, in this region — no core copies them.',
    outline: ['buffer', 'region'],
    highlight: 'interaction.dma',
    view: 'dma',
    dma: true,
  },
  {
    id: 'mbuf',
    objective: 'MBUF-1',
    caption: 'The descriptor is the NIC-facing record; the mbuf is software’s metadata record for the same buffer, holding its address. The bytes stay put.',
    outline: ['mbuf'],
    highlight: 'pool.elements',
    view: 'element',
  },
  {
    id: 'done',
    objective: 'RING-1',
    caption: 'The NIC marks the descriptor done; software finds the packet where it landed.',
    outline: ['slot'],
    highlight: 'rx_ring.descriptors',
    view: 'ring',
  },
]);

const HUE = 0xfff1c2; // a warm emphasis, distinct from the DMA blue and the role hues
const STROKE = 0.06; // outline width, cm
const LIFT = 0.025; // just above the surface it frames

/** A flat rectangular frame — four thin strips — around { x0, x1, z0, z1 } at height y. */
function frame(r, y) {
  const strips = [
    [r.x1 - r.x0 + STROKE, STROKE, (r.x0 + r.x1) / 2, r.z0],
    [r.x1 - r.x0 + STROKE, STROKE, (r.x0 + r.x1) / 2, r.z1],
    [STROKE, r.z1 - r.z0, r.x0, (r.z0 + r.z1) / 2],
    [STROKE, r.z1 - r.z0, r.x1, (r.z0 + r.z1) / 2],
  ].map(([w, d, x, z]) => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y + LIFT, z);
    return g;
  });
  const merged = new THREE.BufferGeometry();
  const pos = strips.flatMap((g) => Array.from(g.toNonIndexed().attributes.position.array));
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  strips.forEach((g) => g.dispose());
  return merged;
}

/**
 * The walkthrough over a built nic_host system. `camera` and `highlighter` are the world's (any
 * object with `solve`/`animateTo` and `setSelected` will do); both are only driven, never extended.
 */
export function createReceiveWalkthrough(system, { camera = null, highlighter = null, reducedMotion = false } = {}) {
  let group = null;
  let material = null;
  let index = -1;
  let time = 0;
  const dmaGroup = system.root.getObjectByName('interaction.dma');
  let dmaBefore = true;

  const assetRoot = (inst) => system.instances[inst].asset.root;
  /** A transform from an asset's own frame to the composition root's. */
  const toRoot = (inst) => {
    system.root.updateMatrixWorld(true);
    return system.root.matrixWorld.clone().invert().multiply(assetRoot(inst).matrixWorld);
  };
  const regionBox = () => {
    const c = system.components.find((x) => x.id === 'memory.packet-buffer-region');
    system.root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(c.boundsObject ?? c.object).applyMatrix4(system.root.matrixWorld.clone().invert());
  };
  const elementTop = TRAY.h + ELEMENT.h;
  const slotTop = RING_BASE.h + SLOT.h;

  /** Each outline: the asset whose frame it is drawn in (or the root), and its rectangle there. */
  const TARGETS = {
    slot: () => ({ inst: 'rx_ring', rect: cardRect(PICKS.slot), y: slotTop }),
    element: () => ({ inst: 'pool', rect: elementRect(PICKS.element), y: elementTop }),
    mbuf: () => ({ inst: 'pool', rect: mbufRect(PICKS.element), y: elementTop }),
    buffer: () => ({ inst: 'pool', rect: bufferRect(PICKS.element), y: elementTop }),
    region: () => {
      const b = regionBox();
      return { inst: null, rect: { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z }, y: b.max.y };
    },
  };

  function clearOutlines() {
    if (!group) return;
    group.children.forEach((m) => m.geometry.dispose());
    group.clear();
  }

  function outline(name) {
    const { inst, rect, y } = TARGETS[name]();
    const mesh = new THREE.Mesh(frame(rect, y), material);
    mesh.name = `walkthrough-outline:${name}`;
    mesh.renderOrder = 9;
    mesh.raycast = () => {}; // never picked: presentation, not a part
    if (inst) {
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(toRoot(inst));
    }
    group.add(mesh);
  }

  /** What each view frames, in world space. */
  const worldBox = (...objects) => objects.reduce((b, o) => b.union(new THREE.Box3().setFromObject(o)), new THREE.Box3());
  const worldRect = (inst, r, y) => {
    const m = assetRoot(inst).matrixWorld;
    const b = new THREE.Box3();
    for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) b.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(m));
    return b.expandByScalar(0.6);
  };
  const VIEWS = {
    ring: () => worldBox(system.instances.rx_ring.group),
    memory: () => worldBox(system.instances.memory.group, system.instances.rx_ring.group, system.instances.pool.group),
    pool: () => worldBox(system.instances.pool.group),
    dma: () => worldBox(dmaGroup, system.instances.pool.group),
    element: () => worldRect('pool', elementRect(PICKS.element), elementTop),
  };

  function frameView(name) {
    if (!camera) return;
    const view = camera.solve({ box: VIEWS[name](), direction: new THREE.Vector3(-0.32, 0.85, 1), padding: name === 'element' ? 1.6 : 1.12 });
    camera.animateTo(view.target, view.position, 900);
  }

  function apply() {
    const step = STEPS[index];
    clearOutlines();
    step.outline.forEach(outline);
    highlighter?.setSelected(step.highlight);
    if (dmaGroup) dmaGroup.visible = step.dma ? true : dmaBefore;
    frameView(step.view);
  }

  return {
    steps: STEPS,
    picks: PICKS,
    get active() {
      return index >= 0;
    },
    get index() {
      return index;
    },
    get step() {
      return index >= 0 ? STEPS[index] : null;
    },
    /** The transient outlines on screen now (empty when inactive). */
    get outlines() {
      return group ? [...group.children] : [];
    },
    start() {
      if (index < 0) {
        dmaBefore = dmaGroup ? dmaGroup.visible : true;
        material = new THREE.MeshBasicMaterial({ color: HUE, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
        group = new THREE.Group();
        group.name = 'walkthrough';
        system.root.add(group);
        time = 0;
      }
      index = 0;
      apply();
      return STEPS[index];
    },
    next() {
      if (index < 0) return null;
      index = Math.min(STEPS.length - 1, index + 1);
      apply();
      return STEPS[index];
    },
    back() {
      if (index < 0) return null;
      index = Math.max(0, index - 1);
      apply();
      return STEPS[index];
    },
    exit() {
      if (index < 0) return;
      clearOutlines();
      group.removeFromParent();
      material.dispose();
      group = null;
      material = null;
      index = -1;
      highlighter?.setSelected(null);
      if (dmaGroup) dmaGroup.visible = dmaBefore;
    },
    /** A gentle pulse on the outlines; steady with reduced motion. */
    update(dt) {
      if (!material) return;
      time += dt;
      material.opacity = reducedMotion ? 0.95 : 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(time * 4));
    },
  };
}
