import * as THREE from 'three';
import { Kit } from '../../core/hardware/Kit.js';
import { canvasTexture, CANVAS_FONT } from '../../core/textures.js';
import { mergeAll } from '../../core/geometry.js';
import { createNIC } from '../../domains/networking/nic/NIC.js';
import { createPCIe } from '../../domains/io/pcie/PCIe.js';
import { createCPU } from '../../domains/computing/cpu/CPU.js';
import { createHostMemory } from '../../domains/memory/host-memory/HostMemory.js';
import { createDescriptorRing } from '../../domains/memory/descriptor-ring/DescriptorRing.js';
import { createMempool } from '../../domains/memory/mempool/Mempool.js';
import CONTRACT from './contract.json';
import { INSTANCE_METADATA, LINK_METADATA } from './metadata.js';

/**
 * The first composition (docs/asset-library/composition.md): the NIC, PCIe, CPU and host-memory
 * assets, placed by the contract in assets/compositions/nic_host.yaml, connected through their
 * ports, with DMA drawn as an interaction over them.
 *
 * Composition-owned only: instances and their transforms, the two routes, the DMA flow and the
 * labels. Each asset is built from its own model entry exactly as on its page — nothing here edits
 * an asset — and its part ids are namespaced by instance (`cpu.die`, `memory.dimm-0`).
 *
 * The contract's `residence` and `references` are semantic and drawn as nothing: no connector, no
 * nesting. They change one thing here: a host-memory instance is built without its illustrative
 * ring where a descriptor_ring resides in its descriptor region, and without its illustrative
 * buffers where a mempool resides in its packet-buffer region — so the system shows each once, as
 * the real asset.
 */

/** Model entry per registry asset id, given the instance and the contract. */
const FACTORIES = {
  nic: () => createNIC(),
  pcie: () => createPCIe(),
  cpu: () => createCPU(),
  host_memory: (inst, contract) => {
    const m = createHostMemory({
      illustrativeRing: !resides('descriptor_ring', `${inst}.descriptor-region`, contract),
      illustrativeBuffers: !resides('mempool', `${inst}.packet-buffer-region`, contract),
    });
    m.setMap(1); // the map shows where the DMA lands
    return m;
  },
  descriptor_ring: () => createDescriptorRing(),
  mempool: () => createMempool(),
};

/** Whether the contract places an instance of `assetId` in the part `where` (`instance.part`). */
const resides = (assetId, where, { instances, residence = {} }) =>
  Object.entries(residence).some(([child, parent]) => instances[child] === assetId && parent === where);

/** Parts drawn only inside their own page's modes; present here but hidden, so never pickable. */
const HIDDEN_PARTS = new Set(['cpu.cores', 'cpu.cache', 'cpu.memory-controller', 'cpu.io', 'pcie.link']);

const HUE = { pcie: '#f0c060', memory: '#b09bff', dma: '#4aa8ff', label: '#e7e3d6' };
const LIFT = 0.03; // routes lie just above the plane the assets meet on

/** A signed axis ("+y", "-z") as a unit vector. */
export const axis = (s) => new THREE.Vector3(...['x', 'y', 'z'].map((a) => (s[1] === a ? (s[0] === '-' ? -1 : 1) : 0)));

/**
 * The contract's many-to-one rule: equal anchor counts pair in declared order; a single anchor on
 * one side bundles with every anchor on the other; anything else is an error.
 */
export function resolveAnchors(a, b) {
  if (a.length === b.length) return { kind: 'pairs', pairs: a.map((x, i) => [x, b[i]]) };
  if (a.length === 1) return { kind: 'bundle', pairs: b.map((y) => [a[0], y]) };
  if (b.length === 1) return { kind: 'bundle', pairs: a.map((x) => [x, b[0]]) };
  throw new Error(`Cannot connect ${a.length} anchors to ${b.length}: pair equal counts, or bundle to one`);
}

export function createNicHostComposition({ contract = CONTRACT } = {}) {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = contract.id;

  // ---------------------------------------------------------------- instances
  const instances = {};
  const components = [];
  for (const [inst, assetId] of Object.entries(contract.instances)) {
    const asset = FACTORIES[assetId](inst, contract);
    const { position, rotation } = contract.placement[inst];
    const group = new THREE.Group();
    group.name = `instance:${inst}`;
    group.position.fromArray(position);
    group.rotation.set(...rotation.map(THREE.MathUtils.degToRad), 'YXZ');
    group.add(asset.root);
    root.add(group);
    instances[inst] = { id: inst, assetId, asset, group };
    for (const c of asset.components) {
      const id = `${inst}.${c.id}`;
      components.push({ ...c, id, part: c.id, instance: inst, pickable: !HIDDEN_PARTS.has(id), meta: { ...c.meta, asset: INSTANCE_METADATA[inst].name } });
    }
  }
  root.updateWorldMatrix(true, true);

  const part = (inst, id) => components.find((c) => c.instance === inst && c.part === id);
  /** World position of `instance.part.anchor`, or of a registry port's `part.anchor` on an instance. */
  const anchor = (inst, ref) => {
    const [p, a] = ref.split('.');
    const c = part(inst, p);
    if (!c?.anchors?.[a]) throw new Error(`No anchor ${inst}.${ref}`);
    return c.object.localToWorld(c.anchors[a].clone());
  };
  /** A connection end `instance.port` → the port's registry definition and its world anchors. */
  const port = (end) => {
    const [inst, name] = end.split('.');
    const def = contract.ports[`${contract.instances[inst]}.${name}`];
    if (!def) throw new Error(`No port ${end}`);
    return { inst, name, def, points: def.at.map((ref) => anchor(inst, ref)) };
  };
  /** A port's facing in the composition frame. */
  const facing = (end) => {
    const p = port(end);
    return axis(p.def.facing).transformDirection(instances[p.inst].group.matrixWorld);
  };

  // -------------------------------------------------------------- connections
  const resolved = contract.connections.map((c) => {
    const a = port(c.a);
    const b = port(c.b);
    return { ...c, from: a, to: b, resolution: resolveAnchors(a.points, b.points) };
  });
  const [pcieRoute, memoryRoute] = resolved.filter((c) => c.kind === 'route');

  // PCIe x8: every lane via fans in to one bundle point off the board's edge, then one trunk to the
  // CPU's PCIe land field.
  const cpuPcie = pcieRoute.to.points[0];
  const pcieBundle = new THREE.Vector3(cpuPcie.x + 3.1, 0, cpuPcie.z);
  const cpuEdgeP = new THREE.Vector3(cpuPcie.x + 0.6, 0, cpuPcie.z);
  const pcieGroup = routeGroup(kit, 'route.pcie', HUE.pcie, [
    ...pcieRoute.resolution.pairs.map(([lane]) => ({ points: [lane, pcieBundle], width: 0.045 })),
    { points: [pcieBundle, cpuEdgeP, cpuPcie], width: 0.16 },
  ]);
  const pcieLabel = label(kit, ['PCIe x8'], HUE.pcie, 1.9, 0.5);
  pcieLabel.position.set((pcieBundle.x + cpuEdgeP.x) / 2, LIFT, cpuPcie.z + 0.55);
  pcieGroup.add(pcieLabel);

  // Memory channels: one trunk from the CPU's memory land field to a fan point, then a branch to
  // each module's edge contacts, rising the last 0.6 cm to meet them.
  const cpuMem = memoryRoute.from.points[0];
  const dimms = memoryRoute.resolution.pairs.map(([, edge]) => edge);
  const cpuEdgeM = new THREE.Vector3(cpuMem.x - 0.6, 0, cpuMem.z);
  const fan = new THREE.Vector3(cpuMem.x - 3.0, 0, (dimms[0].z + dimms[dimms.length - 1].z) / 2);
  const memoryGroup = routeGroup(kit, 'route.memory', HUE.memory, [
    { points: [cpuMem, cpuEdgeM, fan], width: 0.16 },
    ...dimms.map((d) => ({ points: [fan, new THREE.Vector3(fan.x - 0.8, 0, d.z), new THREE.Vector3(d.x, 0, d.z), d], width: 0.07 })),
  ]);
  const memoryLabel = label(kit, ['memory channels'], HUE.memory, 3.1, 0.5);
  memoryLabel.position.set(cpuEdgeM.x - 1.9, LIFT, cpuMem.z - 0.6);
  memoryGroup.add(memoryLabel);

  // ---------------------------------------------------------------------- DMA
  // Drawn over the structure, never as structure: from the NIC's DMA engine, out through its edge
  // connector and the slot, along the lanes and the PCIe x8 route, under the package from the root
  // complex side to the memory controller side, along the memory channels, and into host
  // memory's packet-buffer region — the interaction's target (see the end anchor below). It
  // passes under the package, not over the cores: no core touches the bytes.
  const [interaction] = contract.interactions;
  const target = interaction.to.split('.');
  // The drawn path ends in the interaction's target region: on its first drawn buffer while host
  // memory draws illustrative buffers, at the region's centre when a resident mempool replaces them.
  // Always host memory — never the pool, which the contract does not make a DMA target.
  const endAnchor = part(target[0], target[1])?.anchors?.buffer ? 'buffer' : 'center';
  const dmaPath = [
    anchor('nic', 'nic-controller.dma'),
    anchor('nic', 'pcie-connector.in'),
    anchor('nic', 'pcie-connector.out'),
    anchor('pcie', 'link.card'),
    anchor('pcie', 'link.host'),
    pcieBundle,
    cpuEdgeP,
    cpuPcie,
    cpuMem,
    cpuEdgeM,
    fan,
    new THREE.Vector3(fan.x - 0.8, 0, dimms[0].z),
    new THREE.Vector3(dimms[0].x, 0, dimms[0].z),
    dimms[0],
    anchor(target[0], `${target[1]}.${endAnchor}`),
  ].map((p, i, all) => (i > 2 && i < all.length - 2 ? p.clone().setY(Math.max(p.y, 0) + 0.12) : p));
  const dma = dmaFlow(kit, dmaPath);
  const dmaLabel = label(kit, ['DMA  ·  NIC → host memory', 'root complex → memory controller · no core copies the bytes'], HUE.dma, 7.2, 1.0);
  dmaLabel.position.set(0.3, LIFT, 4.7);
  dma.group.add(dmaLabel);

  root.add(pcieGroup, memoryGroup, dma.group);

  // -------------------------------------------------------- composition parts
  const linkComponent = (id, group, labelMesh) => ({
    id,
    object: group,
    hitObjects: group.children.filter((o) => o.isMesh),
    meta: LINK_METADATA[id],
    anchors: { center: new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3()) },
    setHighlight: (level) => {
      group.userData.setLevel(level);
      labelMesh.material.color.setScalar(1 + 0.5 * Math.min(1, level));
    },
    pickable: true,
  });
  components.push(linkComponent('route.pcie', pcieGroup, pcieLabel), linkComponent('route.memory', memoryGroup, memoryLabel));
  components.push({
    id: 'interaction.dma',
    object: dma.group,
    hitObjects: [dmaLabel],
    meta: LINK_METADATA['interaction.dma'],
    anchors: { from: dmaPath[0].clone(), to: dmaPath[dmaPath.length - 1].clone() },
    setHighlight: (level) => dma.setLevel(level),
    pickable: true,
  });

  // Asset names on the plane, in front of each asset; picking one selects the asset as a whole. The
  // ring's name says where it lives, since nothing is drawn between it and its region.
  const NAMES = {
    nic: [['NIC'], 12.4, 10.4],
    pcie: [['PCIe'], 9.6, 5.4],
    cpu: [['CPU'], 0.2, 3.0],
    memory: [['HOST MEMORY'], -12.1, 5.2],
    rx_ring: [['RX DESCRIPTOR RING', 'resides in host memory · descriptor region'], -2.55, 10.2, 6.0, 1.0],
    pool: [['MEMPOOL', 'resides in host memory · packet-buffer region'], -20.6, 6.35, 6.0, 1.0],
  };
  for (const [inst, [lines, x, z, w = lines[0].length > 4 ? 4.2 : 1.8, h = 0.62]] of Object.entries(NAMES)) {
    if (!instances[inst]) continue;
    const meta = INSTANCE_METADATA[inst];
    const mesh = label(kit, lines, HUE.label, w, h);
    mesh.position.set(x, LIFT, z);
    root.add(mesh);
    components.push({
      id: inst,
      object: mesh,
      boundsObject: instances[inst].group,
      meta,
      anchors: { center: new THREE.Vector3() },
      setHighlight: (level) => mesh.material.color.setScalar(1 + 0.5 * Math.min(1, level)),
      pickable: true,
      asset: true,
    });
  }

  const occluders = Object.values(instances).flatMap((i) => i.asset.occluders ?? []);

  return {
    root,
    kit,
    contract,
    instances,
    components,
    connections: resolved,
    occluders,
    dmaPath,
    facing,
    anchor,
    leds: instances.nic.asset.leds,
    /** Which parts belong to an instance (for selecting an asset as a whole). */
    partsOf: (inst) => components.filter((c) => c.instance === inst && c.pickable).map((c) => c.id),
    setDmaVisible(v) {
      dma.group.visible = v;
    },
    stats: { instances: Object.keys(instances).length, connections: resolved.length },
    update(elapsed, { reducedMotion = false } = {}) {
      instances.nic.asset.update?.(elapsed);
      dma.update(reducedMotion ? 0 : elapsed);
    },
    dispose() {
      Object.values(instances).forEach((i) => i.asset.dispose());
      kit.dispose();
    },
  };
}

// ------------------------------------------------------------------ drawing

/** Flat schematic ribbons along polylines, in one colour; brightens when highlighted. */
function routeGroup(kit, name, hue, strokes) {
  const group = new THREE.Group();
  group.name = name;
  const mat = kit.own(
    new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  const geos = strokes.flatMap(({ points, width }) => ribbon(points, width));
  const mesh = new THREE.Mesh(kit.geometry(`${name}-ribbons`, () => mergeAll(geos)), mat);
  mesh.renderOrder = 4;
  group.add(mesh);
  const base = new THREE.Color(hue);
  group.userData.setLevel = (level) => {
    const k = Math.min(1, level);
    mat.opacity = 0.78 + 0.22 * k;
    mat.color.copy(base).multiplyScalar(1 + 0.5 * k);
  };
  return group;
}

/** Quads along a polyline, lying flat where the run is level and standing where it climbs. */
function ribbon(points, width) {
  const geos = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i].clone().setY(points[i].y + LIFT);
    const b = points[i + 1].clone().setY(points[i + 1].y + LIFT);
    const d = b.clone().sub(a);
    const len = d.length();
    if (len < 1e-4) continue;
    const g = new THREE.PlaneGeometry(len, width);
    const level = Math.abs(d.y) < 0.5 * Math.hypot(d.x, d.z);
    if (level) {
      g.rotateX(-Math.PI / 2);
      g.rotateY(-Math.atan2(d.z, d.x));
    } else {
      g.rotateZ(Math.atan2(d.y, Math.hypot(d.x, d.z)));
      g.rotateY(-Math.atan2(d.z, d.x));
    }
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    geos.push(g);
    if (level && i > 0) {
      const joint = new THREE.CircleGeometry(width / 2, 12);
      joint.rotateX(-Math.PI / 2);
      joint.translate(a.x, a.y, a.z);
      geos.push(joint);
    }
  }
  return geos;
}

/** The DMA flow: a dashed guide along the path and packet-coloured pulses travelling it. */
function dmaFlow(kit, path) {
  const group = new THREE.Group();
  group.name = 'interaction.dma';
  const guideMat = kit.own(new THREE.LineDashedMaterial({ color: HUE.dma, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.55, toneMapped: false }));
  const guide = new THREE.Line(kit.geometry('dma-guide', () => new THREE.BufferGeometry().setFromPoints(path)), guideMat);
  guide.computeLineDistances();
  guide.renderOrder = 5;
  group.add(guide);

  // Arc length along the path, for placing pulses by distance.
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + path[i].distanceTo(path[i - 1]));
  const total = lengths[lengths.length - 1];
  const at = (s, out) => {
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < s) i++;
    const k = (s - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    return out.lerpVectors(path[i - 1], path[i], k);
  };

  const count = Math.max(8, Math.round(total / 2.4));
  const pulseMat = kit.own(new THREE.MeshBasicMaterial({ color: HUE.dma, toneMapped: false, transparent: true, opacity: 0.95 }));
  const pulses = new THREE.InstancedMesh(kit.geometry('dma-pulse', () => new THREE.SphereGeometry(0.13, 14, 10)), pulseMat, count);
  pulses.name = 'dma-pulses';
  pulses.renderOrder = 6;
  pulses.frustumCulled = false;
  group.add(pulses);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const SPEED = 4.5; // cm per second: slow enough to follow, like a packet walking the path
  const base = new THREE.Color(HUE.dma);

  return {
    group,
    length: total,
    update(elapsed) {
      for (let i = 0; i < count; i++) {
        const s = (((elapsed * SPEED + (i * total) / count) % total) + total) % total;
        pulses.setMatrixAt(i, m.makeTranslation(at(s, p)));
      }
      pulses.instanceMatrix.needsUpdate = true;
    },
    setLevel(level) {
      const k = Math.min(1, level);
      guideMat.opacity = 0.55 + 0.45 * k;
      pulseMat.color.copy(base).multiplyScalar(1 + 0.6 * k);
    },
  };
}

/** A flat text label lying on the plane, readable from the front. */
function label(kit, lines, color, w, h) {
  const px = 140;
  const tex = kit.texture(
    canvasTexture(Math.round(w * px), Math.round(h * px), (ctx, W, H) => {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const size = Math.min(H / (lines.length * 1.25), 64);
      lines.forEach((text, i) => {
        ctx.fillStyle = i === 0 ? color : 'rgba(231,227,214,0.72)';
        ctx.font = `${i === 0 ? 700 : 600} ${Math.round(i === 0 ? size : size * 0.82)}px ${CANVAS_FONT}`;
        ctx.fillText(text, 4, (H / lines.length) * (i + 0.5), W - 8);
      });
    }),
  );
  const mat = kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  const mesh = new THREE.Mesh(kit.geometry(`label:${lines.join('|')}`, () => new THREE.PlaneGeometry(w, h)), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 4;
  return mesh;
}
