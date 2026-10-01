// The first composition (docs/asset-library/composition.md): its contract, resolved against the real
// asset models — no browser, no WebGL. Canvas textures draw into a stub context.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONTRACT from '../src/compositions/nic_host/contract.json';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let build;
let resolveAnchors;
let axis;
let createCPU;

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  ({ createNicHostComposition: build, resolveAnchors, axis } = await import('../src/compositions/nic_host/composition.js'));
  ({ createCPU } = await import('../src/domains/computing/cpu/CPU.js'));
});

describe('nic_host — instances', () => {
  it('builds exactly the four instances of the contract, each at scale 1 and at its declared place', () => {
    const s = build();
    expect(Object.keys(s.instances).sort()).toEqual(['cpu', 'memory', 'nic', 'pcie']);
    expect(Object.fromEntries(Object.entries(s.instances).map(([k, v]) => [k, v.assetId]))).toEqual(CONTRACT.instances);
    for (const [inst, { group }] of Object.entries(s.instances)) {
      expect(group.scale.toArray()).toEqual([1, 1, 1]);
      expect(group.position.toArray()).toEqual(CONTRACT.placement[inst].position);
      expect(group.rotation.order).toBe('YXZ');
    }
  });

  it('namespaces every part by its instance, with no collisions and nothing left out', () => {
    const s = build();
    const ids = s.components.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [inst, { asset }] of Object.entries(s.instances)) {
      for (const c of asset.components) expect(ids).toContain(`${inst}.${c.id}`);
    }
    expect(ids.filter((id) => id.startsWith('nic.')).some((id) => /queue/.test(id))).toBe(false); // no legacy on-card queues
  });

  it('builds each asset exactly as it builds alone: composing never edits an asset', () => {
    const fingerprint = (root) => {
      let h = 0;
      root.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 11) h = (h * 31 + p[i] * 1000) % 1e9;
      });
      return h;
    };
    const composed = build().instances.cpu.asset.root;
    expect(composed.position.toArray()).toEqual([0, 0, 0]); // the composition moves the instance group, not the asset
    expect(fingerprint(composed)).toBe(fingerprint(createCPU().root));
  });

  it('keeps instances apart: only the card and its slot occupy the same space', () => {
    const s = build();
    const box = (i) => new THREE.Box3().setFromObject(s.instances[i].group);
    const pairs = [['nic', 'cpu'], ['nic', 'memory'], ['pcie', 'cpu'], ['pcie', 'memory'], ['cpu', 'memory']];
    for (const [a, b] of pairs) expect(box(a).intersectsBox(box(b)), `${a} and ${b}`).toBe(false);
    expect(box('nic').intersectsBox(box('pcie'))).toBe(true); // mated
  });

  it('is deterministic: the same transforms, routes and DMA path every build', () => {
    const a = build();
    const b = build();
    for (const i of Object.keys(a.instances)) expect(a.instances[i].group.matrixWorld.equals(b.instances[i].group.matrixWorld)).toBe(true);
    expect(a.dmaPath.map((p) => p.toArray())).toEqual(b.dmaPath.map((p) => p.toArray()));
  });
});

describe('nic_host — connections', () => {
  it('seats the card in the slot: mated anchors sit exactly the declared gap apart, along the slot’s facing', () => {
    const s = build();
    const mate = s.connections.find((c) => c.kind === 'mate');
    const [[card, slot]] = mate.resolution.pairs;
    expect(mate.a).toBe('nic.pcie_connector');
    expect(mate.b).toBe('pcie.endpoint');
    expect(card.distanceTo(slot)).toBeCloseTo(mate.gap, 3);
    const along = slot.clone().sub(card).normalize();
    expect(along.dot(s.facing(mate.b))).toBeCloseTo(1, 5);
  });

  it('turns the card to face the slot: the mated facings are opposed', () => {
    const s = build();
    expect(s.facing('nic.pcie_connector').dot(s.facing('pcie.endpoint'))).toBeCloseTo(-1, 5);
  });

  it('bundles eight PCIe lanes into the CPU’s one PCIe field, and the CPU’s memory field out to both modules', () => {
    const s = build();
    const [pcie, memory] = s.connections.filter((c) => c.kind === 'route');
    expect(pcie.resolution.kind).toBe('bundle');
    expect(pcie.resolution.pairs).toHaveLength(8);
    expect(new Set(pcie.resolution.pairs.map(([, b]) => b.toArray().join())).size).toBe(1);
    expect(memory.resolution.kind).toBe('bundle');
    expect(memory.resolution.pairs).toHaveLength(2);
    expect(new Set(memory.resolution.pairs.map(([a]) => a.toArray().join())).size).toBe(1);
  });

  it('resolves anchors by the contract’s rule: pairs, a bundle, or an error', () => {
    expect(resolveAnchors([1, 2], ['a', 'b'])).toEqual({ kind: 'pairs', pairs: [[1, 'a'], [2, 'b']] });
    expect(resolveAnchors([1], ['a', 'b']).kind).toBe('bundle');
    expect(resolveAnchors([1, 2, 3], ['a']).pairs).toHaveLength(3);
    expect(() => resolveAnchors([1, 2, 3], ['a', 'b'])).toThrow(/Cannot connect 3 anchors to 2/);
    expect(axis('-z').toArray()).toEqual([0, 0, -1]);
  });

  it('refuses a connection to a port the registry does not have', () => {
    const broken = structuredClone(CONTRACT);
    broken.connections[1] = { ...broken.connections[1], b: 'cpu.dma' };
    expect(() => build({ contract: broken })).toThrow(/No port cpu\.dma/);
  });
});

describe('nic_host — DMA is an interaction, drawn over the structure', () => {
  it('is declared as the dma concept and never as a port', () => {
    const [dma] = CONTRACT.interactions;
    expect(dma.concept).toBe('dma');
    expect(Object.keys(CONTRACT.ports).some((p) => /dma/.test(p))).toBe(false);
  });

  it('runs from the NIC’s DMA engine to a posted packet buffer, through the CPU’s PCIe and memory sides', () => {
    const s = build();
    const first = s.dmaPath[0];
    const last = s.dmaPath[s.dmaPath.length - 1];
    expect(first.distanceTo(s.anchor('nic', 'nic-controller.dma'))).toBeLessThan(1e-6);
    expect(last.distanceTo(s.anchor('memory', 'packet-buffer-region.buffer'))).toBeLessThan(1e-6);
    const near = (p) => s.dmaPath.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1e-6);
    expect(near(s.anchor('cpu', 'lands.pcie'))).toBe(true);
    expect(near(s.anchor('cpu', 'lands.memory'))).toBe(true);
  });

  it('passes under the package, never over the cores: no core copies the bytes', () => {
    const s = build();
    const cpu = new THREE.Box3().setFromObject(s.instances.cpu.group);
    const die = s.anchor('cpu', 'die.top');
    for (const p of s.dmaPath) {
      if (p.x > cpu.min.x && p.x < cpu.max.x && p.z > cpu.min.z && p.z < cpu.max.z) expect(p.y).toBeLessThan(die.y);
    }
  });
});

describe('nic_host — dependency direction', () => {
  const read = (dir) => fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));

  it('no asset imports a composition', () => {
    for (const src of read(path.join(HERE, '../src/domains'))) expect(src).not.toMatch(/compositions\//);
  });

  it('the NIC page shows the host through the one nic_host world; the retired stand-in is gone', () => {
    const page = path.join(HERE, '../../../experiences/networking/nic');
    expect(fs.readFileSync(path.join(page, 'host.js'), 'utf8')).toMatch(/from '@axiobyte\/three\/compositions\/nic_host\/world\.js'/);
    expect(fs.existsSync(path.join(HERE, '../src/domains/networking/HostMemory.js'))).toBe(false);
    for (const src of [...read(path.join(HERE, '../src')), ...read(page)]) expect(src).not.toMatch(/networking\/HostMemory|\.\.\/HostMemory\.js/);
  });

  it('the composition builds asset models, never an asset page’s scene or world, nor the legacy host memory', () => {
    for (const src of read(path.join(HERE, '../src/compositions/nic_host'))) {
      expect(src).not.toMatch(/networking\/HostMemory\.js/);
      expect(src).not.toMatch(/domains\/[^'"]+\/(scene|world)\.js/);
    }
  });
});
