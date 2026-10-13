// The nic_host composition as a video stage: the same system, mounted into a film's world. It must
// leave the contract, the DMA interaction and the released assets exactly as they are, add no mbuf,
// buffer or descriptor identity, keep its outlines presentation-only, and be a pure function of
// time — no browser, no WebGL.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONTRACT from '../src/compositions/nic_host/contract.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let createNicHostVideoStage;
let createNicHostComposition;
let createNIC;
let createDescriptorRing;
let RING;

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  ({ createNicHostVideoStage } = await import('../src/compositions/nic_host/video.js'));
  ({ createNicHostComposition } = await import('../src/compositions/nic_host/composition.js'));
  ({ createNIC } = await import('../src/domains/networking/nic/NIC.js'));
  ({ createDescriptorRing } = await import('../src/domains/memory/descriptor-ring/DescriptorRing.js'));
  ({ RING } = await import('../src/domains/memory/descriptor-ring/layout.js'));
});

/** A film's world, as far as the stage needs one: an engine scene, a registry, a highlighter. */
function film({ withCard = false } = {}) {
  const engine = { scene: new THREE.Scene() };
  const registry = new ComponentRegistry();
  if (withCard) createNIC().components.forEach((c) => registry.register(c));
  const prepared = [];
  const highlighter = { prepare: (entry) => prepared.push(entry.id) };
  const stage = createNicHostVideoStage({ engine, registry, highlighter });
  return { engine, registry, prepared, stage };
}

/** The s01e03 lanes' shape: one window, DMA in parts of it, outlines inside it. */
const LANES = {
  windows: [{ from: 10, to: 30 }],
  dma: [{ from: 11, to: 15 }],
  outlines: [
    { name: 'region', from: 12, to: 14 },
    { name: 'slot', from: 16, to: 20 },
    { name: 'buffer', from: 18, to: 20 },
    { name: 'mbuf', from: 22, to: 24 },
    { name: 'element', from: 24, to: 26 },
  ],
};

/** Everything the stage changes at time t, as plain data. */
function stateAt(stage, t) {
  stage.update(t, LANES);
  const pulses = stage.system.root.getObjectByName('dma-pulses');
  return {
    visible: stage.holder.visible,
    dma: stage.system.root.getObjectByName('interaction.dma').visible,
    outlines: stage.outlinesShown(),
    pulses: Array.from(pulses.instanceMatrix.array).map((v) => Math.round(v * 1e6) / 1e6),
  };
}

const fingerprint = (root) => {
  const parts = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [o.material].flat().map((m) => `${m.type}:${m.color?.getHexString() ?? ''}`).join('+');
    parts.push(`${o.name}|${o.geometry.attributes.position.count}|${mats}`);
  });
  return parts.join('\n');
};

describe('nic_host video stage — the same system, in a film', () => {
  it('builds deterministically: the same parts, the same placement, the same outlines', () => {
    const a = film().stage;
    const b = film().stage;
    expect(a.system.components.map((c) => c.id)).toEqual(b.system.components.map((c) => c.id));
    expect(a.system.root.position.toArray()).toEqual(b.system.root.position.toArray());
    expect(fingerprint(a.holder)).toBe(fingerprint(b.holder));
    for (const t of [0, 10.5, 12.5, 17, 19, 23, 25, 29.9, 31]) expect(stateAt(a, t)).toEqual(stateAt(b, t));
  });

  it('mounts beside the card in one registry: every id instance-prefixed, none colliding', () => {
    const { registry, stage, prepared } = film({ withCard: true });
    const ids = stage.system.components.map((c) => c.id);
    expect(ids.every((id) => registry.has(id))).toBe(true);
    expect(prepared).toEqual(ids);
    expect(registry.has('nic-controller') && registry.has('nic.nic-controller')).toBe(true);
    // Mounting a second stage into the same world would collide, and says so.
    expect(() => createNicHostVideoStage({ engine: { scene: new THREE.Scene() }, registry })).toThrow(/already registered/);
  });

  it('leaves the contract exactly as declared, at every time', () => {
    const { stage } = film();
    const before = JSON.stringify(stage.system.contract);
    for (let t = 0; t < 32; t += 0.5) stage.update(t, LANES);
    expect(JSON.stringify(stage.system.contract)).toBe(before);
    expect(stage.system.contract).toEqual(CONTRACT);
  });

  it('keeps the DMA interaction NIC → packet-buffer region, on the path the page draws', () => {
    const { stage } = film();
    expect(CONTRACT.interactions).toEqual([{ concept: 'dma', from: 'nic', to: 'memory.packet-buffer-region', via: ['pcie', 'cpu.io', 'cpu.memory-controller'] }]);
    const page = createNicHostComposition().dmaPath.map((p) => p.toArray());
    for (const t of [0, 12, 19, 25]) {
      stage.update(t, LANES);
      expect(stage.system.dmaPath.map((p) => p.toArray())).toEqual(page);
    }
    // The path is in the composition root's frame; the anchor in the world's, where the stage
    // placed the root.
    const end = stage.system.root.worldToLocal(stage.system.anchor('memory', 'packet-buffer-region.center'));
    expect(stage.system.dmaPath.at(-1).distanceTo(end)).toBeLessThan(1e-6);
    // The flow is the composition's own, shown only when a lane says so, inside a window.
    expect(stateAt(stage, 12).dma).toBe(true);
    expect(stateAt(stage, 17).dma).toBe(false);
    expect(stateAt(stage, 5).dma).toBe(false);
  });

  it('films the released descriptor ring: its 8 descriptors and one part, built as on its page', () => {
    const { stage } = film();
    expect(CONTRACT.instances.rx_ring).toBe('descriptor_ring');
    expect(RING.count).toBe(8);
    const ringParts = stage.system.components.filter((c) => c.id.startsWith('rx_ring.')).map((c) => c.id);
    expect(ringParts).toEqual(['rx_ring.descriptors']);
    expect(fingerprint(stage.system.instances.rx_ring.asset.root)).toBe(fingerprint(createDescriptorRing().root));
  });

  it('films the mempool as its Model C asset: one part, every element an mbuf half and a buffer half', () => {
    const { stage } = film();
    expect(CONTRACT.instances.pool).toBe('mempool');
    const poolParts = stage.system.components.filter((c) => c.id.startsWith('pool.')).map((c) => c.id);
    expect(poolParts).toEqual(['pool.elements']);
    const pool = stage.system.instances.pool.asset.root;
    expect(pool.getObjectByName('mempool-mbuf-halves')).toBeTruthy();
    expect(pool.getObjectByName('mempool-buffer-halves')).toBeTruthy();
  });

  it('introduces no mbuf, no buffer and no descriptor identity', () => {
    const { registry, stage } = film();
    expect(Object.values(CONTRACT.instances)).not.toContain('mbuf');
    expect(Object.values(CONTRACT.instances).some((a) => /buffer/.test(a))).toBe(false);
    const ids = registry.all().map((e) => e.id);
    expect(ids.some((id) => /(^|\.)(mbuf|buffer|element|descriptor|slot)-?\d/.test(id))).toBe(false);
    for (let t = 0; t < 32; t += 1) stage.update(t, LANES);
    expect(registry.all().map((e) => e.id)).toEqual(ids);
  });

  it('models no descriptor state: the ring and the pool look the same at every time', () => {
    const { stage } = film();
    const ring = stage.system.instances.rx_ring.asset.root;
    const pool = stage.system.instances.pool.asset.root;
    const at = (t) => (stage.update(t, LANES), [fingerprint(ring), fingerprint(pool)]);
    const first = at(0);
    for (const t of [12, 17, 19, 23, 25, 29]) expect(at(t)).toEqual(first);
    // The film's storyboard draws no stateful ring and no descriptor states either.
    const story = fs.readFileSync(path.join(HERE, '../../../episodes/s01e03-what-is-a-nic/three/storyboard.js'), 'utf8');
    expect(story).not.toMatch(/descriptorRing\(|DMA WRITING|CONSUMED|slots: 16/);
    expect(story).not.toMatch(/pre-allocated mbufs/);
  });

  it('outlines only the walkthrough’s illustrative picks, as presentation: unregistered, unpickable', () => {
    const { registry, stage } = film();
    expect(stage.picks).toEqual({ slot: 0, element: 0 });
    const outlines = stage.system.root.getObjectByName('video-outlines').children;
    expect(outlines.map((o) => o.name)).toEqual(['slot', 'buffer', 'element', 'mbuf', 'region'].map((n) => `video-outline:${n}`));
    for (const o of outlines) {
      const hits = [];
      o.raycast(new THREE.Raycaster(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -1, 0)), hits);
      expect(hits).toEqual([]);
      expect(registry.idFromObject(o)).toBeFalsy();
      o.traverse((x) => expect(x.isLine).toBeFalsy());
    }
    expect(stateAt(stage, 19).outlines.map(([n]) => n)).toEqual(['slot', 'buffer']);
    expect(stateAt(stage, 23).outlines.map(([n]) => n)).toEqual(['mbuf']);
    expect(stateAt(stage, 27).outlines).toEqual([]);
    // Outside a window nothing of the stage shows.
    expect(stateAt(stage, 5)).toMatchObject({ visible: false, dma: false, outlines: [] });
  });

  it('is a pure function of time: any order of updates gives the same frame', () => {
    const { stage } = film();
    const times = [10.2, 12.5, 19.1, 23.4, 25, 29.9, 31];
    const forward = times.map((t) => stateAt(stage, t));
    const backward = [...times].reverse().map((t) => stateAt(stage, t)).reverse();
    expect(backward).toEqual(forward);
    const fresh = film().stage;
    expect(times.map((t) => stateAt(fresh, t))).toEqual(forward);
  });
});
