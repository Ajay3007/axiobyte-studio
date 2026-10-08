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
let createDescriptorRing;
let createHostMemory;
let createMempool;

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  ({ createNicHostComposition: build, resolveAnchors, axis } = await import('../src/compositions/nic_host/composition.js'));
  ({ createCPU } = await import('../src/domains/computing/cpu/CPU.js'));
  ({ createDescriptorRing } = await import('../src/domains/memory/descriptor-ring/DescriptorRing.js'));
  ({ createHostMemory } = await import('../src/domains/memory/host-memory/HostMemory.js'));
  ({ createMempool } = await import('../src/domains/memory/mempool/Mempool.js'));
});

describe('nic_host — instances', () => {
  it('builds exactly the instances of the contract, each at scale 1 and at its declared place', () => {
    const s = build();
    expect(Object.keys(s.instances).sort()).toEqual(['cpu', 'memory', 'nic', 'pcie', 'pool', 'rx_ring']);
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
    const pairs = [['nic', 'cpu'], ['nic', 'memory'], ['pcie', 'cpu'], ['pcie', 'memory'], ['cpu', 'memory'], ...['nic', 'pcie', 'cpu', 'memory'].map((i) => [i, 'rx_ring'])];
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

  it('runs from the NIC’s DMA engine into the packet-buffer region, through the CPU’s PCIe and memory sides', () => {
    const s = build();
    const first = s.dmaPath[0];
    const last = s.dmaPath[s.dmaPath.length - 1];
    expect(first.distanceTo(s.anchor('nic', 'nic-controller.dma'))).toBeLessThan(1e-6);
    // A resident mempool replaces host memory's drawn buffers, so the path ends at the region itself.
    expect(last.distanceTo(s.anchor('memory', 'packet-buffer-region.center'))).toBeLessThan(1e-6);
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

describe('nic_host — the RX descriptor ring: resident and referring, drawn as nothing between', () => {
  // The contract without the ring: what nic_host was before it, to compare against.
  const withoutRing = () => {
    const c = structuredClone(CONTRACT);
    delete c.instances.rx_ring;
    delete c.placement.rx_ring;
    delete c.residence.rx_ring;
    delete c.references;
    return c;
  };
  // nic_host as released in v1.2.0: no ring and no pool, so host memory draws both illustrations.
  const released = () => {
    const c = withoutRing();
    delete c.instances.pool;
    delete c.placement.pool;
    delete c.residence;
    return c;
  };
  const fingerprint = (root) => {
    let h = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 7) h = (h * 31 + p[i] * 1000) % 1e9;
    });
    return h;
  };

  it('has one descriptor ring, residing in the descriptor region and referring to the packet buffers', () => {
    expect(Object.values(CONTRACT.instances).filter((a) => a === 'descriptor_ring')).toHaveLength(1);
    expect(CONTRACT.residence).toEqual({ rx_ring: 'memory.descriptor-region', pool: 'memory.packet-buffer-region' });
    expect(CONTRACT.references).toEqual([{ from: 'rx_ring.descriptors', to: 'memory.packet-buffer-region' }]);
  });

  it('builds the ring exactly as on its own page', () => {
    const ring = build().instances.rx_ring.asset.root;
    expect(ring.position.toArray()).toEqual([0, 0, 0]);
    expect(fingerprint(ring)).toBe(fingerprint(createDescriptorRing().root));
  });

  it('draws host memory without its illustrative ring only where the real ring resides', () => {
    const pointers = (root) => root.getObjectByName('host-memory-descriptor-pointers');
    const region = (s) => s.components.find((c) => c.id === 'memory.descriptor-region');
    const composed = build();
    expect(pointers(composed.instances.memory.asset.root)).toBeUndefined();
    expect(Object.keys(region(composed).anchors)).toEqual(['center']);
    expect(region(composed).meta.details.map(([k]) => k)).toContain('Resident ring');
    // The mechanism follows the residence: with no ring residing there, the illustration is back —
    // and the standalone asset always has it.
    const alone = build({ contract: released() });
    expect(pointers(alone.instances.memory.asset.root)).toBeDefined();
    expect(Object.keys(region(alone).anchors).sort()).toEqual(['center', 'head', 'tail']);
    expect(pointers(createHostMemory().root)).toBeDefined();
  });

  it('draws no link for residence or references: the same routes and DMA as without the ring', () => {
    const s = build();
    const drawn = (sys) => sys.root.children.filter((o) => !o.name.startsWith('instance:') && !o.isMesh).map((o) => o.name).sort();
    expect(drawn(s)).toEqual(['interaction.dma', 'route.memory', 'route.pcie']);
    expect(drawn(s)).toEqual(drawn(build({ contract: withoutRing() })));
    expect(s.connections.map((c) => [c.kind, c.a, c.b])).toEqual(build({ contract: withoutRing() }).connections.map((c) => [c.kind, c.a, c.b]));
    expect(s.components.some((c) => /^(residence|reference)/.test(c.id))).toBe(false);
  });

  it('leaves the DMA path exactly as it was: the ring is not on it', () => {
    const s = build();
    expect(s.dmaPath.map((p) => p.toArray())).toEqual(build({ contract: withoutRing() }).dmaPath.map((p) => p.toArray()));
    expect(CONTRACT.interactions).toEqual([{ concept: 'dma', from: 'nic', to: 'memory.packet-buffer-region', via: ['pcie', 'cpu.io', 'cpu.memory-controller'] }]);
    const ring = new THREE.Box3().setFromObject(s.instances.rx_ring.group);
    for (const p of s.dmaPath) expect(ring.containsPoint(p)).toBe(false);
  });

  it('makes the ring selectable as an asset and by its one part, with no per-descriptor parts', () => {
    const s = build();
    const ids = s.components.filter((c) => c.instance === 'rx_ring' || c.id === 'rx_ring').map((c) => c.id).sort();
    expect(ids).toEqual(['rx_ring', 'rx_ring.descriptors']);
    const part = s.components.find((c) => c.id === 'rx_ring.descriptors');
    expect(part.pickable).toBe(true);
    expect(part.meta.asset).toBe('RX descriptor ring');
    expect(s.components.find((c) => c.id === 'rx_ring').meta.designator).toBe('Asset · descriptor_ring');
  });
});

describe('nic_host — the mempool: resident in the packet-buffer region, drawn as itself', () => {
  const fingerprint = (root) => {
    let h = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 7) h = (h * 31 + p[i] * 1000) % 1e9;
    });
    return h;
  };
  // The contract without the pool: what nic_host was after the ring, before the pool.
  const withoutPool = () => {
    const c = structuredClone(CONTRACT);
    delete c.instances.pool;
    delete c.placement.pool;
    delete c.residence.pool;
    return c;
  };
  const named = (root, name) => {
    const found = [];
    root.traverse((o) => o.name === name && found.push(o));
    return found;
  };

  it('has exactly one mempool, `pool`, resident in memory.packet-buffer-region', () => {
    expect(Object.entries(CONTRACT.instances).filter(([, a]) => a === 'mempool')).toEqual([['pool', 'mempool']]);
    expect(CONTRACT.residence.pool).toBe('memory.packet-buffer-region');
    const s = build();
    expect(s.instances.pool.assetId).toBe('mempool');
  });

  it('places the pool explicitly and the same way every build, apart from every other instance', () => {
    const a = build();
    const b = build();
    expect(a.instances.pool.group.position.toArray()).toEqual(CONTRACT.placement.pool.position);
    expect(a.instances.pool.group.matrixWorld.equals(b.instances.pool.group.matrixWorld)).toBe(true);
    const box = (s, i) => new THREE.Box3().setFromObject(s.instances[i].group);
    for (const other of ['nic', 'pcie', 'cpu', 'memory', 'rx_ring']) expect(box(a, 'pool').intersectsBox(box(a, other)), other).toBe(false);
  });

  it('builds the pool exactly as its standalone model, once', () => {
    const s = build();
    expect(fingerprint(s.instances.pool.asset.root)).toBe(fingerprint(createMempool().root));
    expect(named(s.root, 'mempool-elements')).toHaveLength(1);
    expect(named(s.root, 'mempool-cards')).toHaveLength(1);
  });

  it('makes the pool selectable as an asset and by its one part, never tile by tile', () => {
    const s = build();
    const ids = s.components.filter((c) => c.instance === 'pool' || c.id === 'pool').map((c) => c.id).sort();
    expect(ids).toEqual(['pool', 'pool.elements']);
    expect(s.components.find((c) => c.id === 'pool.elements').pickable).toBe(true);
    expect(s.components.some((c) => /^pool\.(element|mbuf|buffer)/.test(c.id) && c.id !== 'pool.elements')).toBe(false);
  });

  it('draws host memory without its illustrative buffers only where a pool resides — and keeps the region', () => {
    const tiles = (sys) => sys.components.find((c) => c.id === 'memory.packet-buffer-region');
    const composed = build();
    expect(Object.keys(tiles(composed).anchors)).toEqual(['center']); // no drawn buffer to anchor to
    expect(tiles(composed).pickable).toBe(true);
    expect(tiles(composed).meta.details.map(([k]) => k)).toContain('Resident pool');
    expect(tiles(composed).meta.description).not.toMatch(/posted|free for/);
    // The ring's illustration stays hidden as before.
    expect(composed.instances.memory.asset.root.getObjectByName('host-memory-descriptor-pointers')).toBeUndefined();
    // Without the pool the buffers are back, and the standalone asset always has them.
    expect(Object.keys(tiles(build({ contract: withoutPool() })).anchors).sort()).toEqual(['buffer', 'center']);
    const alone = createHostMemory().components.find((c) => c.id === 'packet-buffer-region');
    expect(Object.keys(alone.anchors).sort()).toEqual(['buffer', 'center']);
  });

  it('ends the drawn DMA path in host memory’s packet-buffer region, never on the pool', () => {
    const s = build();
    const last = s.dmaPath[s.dmaPath.length - 1];
    expect(last.distanceTo(s.anchor('memory', 'packet-buffer-region.center'))).toBeLessThan(1e-6);
    const pool = new THREE.Box3().setFromObject(s.instances.pool.group);
    for (const p of s.dmaPath) expect(pool.containsPoint(p)).toBe(false);
    expect(CONTRACT.interactions).toEqual([{ concept: 'dma', from: 'nic', to: 'memory.packet-buffer-region', via: ['pcie', 'cpu.io', 'cpu.memory-controller'] }]);
  });

  it('keeps the descriptor reference on the region and draws no residence or reference link', () => {
    expect(CONTRACT.references).toEqual([{ from: 'rx_ring.descriptors', to: 'memory.packet-buffer-region' }]);
    const s = build();
    const drawn = (sys) => sys.root.children.filter((o) => !o.name.startsWith('instance:') && !o.isMesh).map((o) => o.name).sort();
    expect(drawn(s)).toEqual(['interaction.dma', 'route.memory', 'route.pcie']);
    expect(drawn(s)).toEqual(drawn(build({ contract: withoutPool() })));
  });

  it('instantiates no mbuf and no buffer: the pool’s halves are its own illustration', () => {
    expect(Object.values(CONTRACT.instances)).not.toContain('mbuf');
    expect(Object.values(CONTRACT.instances).some((a) => /buffer/.test(a))).toBe(false);
    expect(Object.keys(CONTRACT.instances).some((i) => /^(mbuf|buffer|packet_buffer)/.test(i))).toBe(false);
    const s = build();
    expect(named(s.root, 'mempool-mbuf-halves')).toHaveLength(1); // drawn, not suppressed
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
