// The receive-path walkthrough over nic_host: presentation only. It must leave the contract, the
// registry and the DMA path exactly as they are, pick only existing representative anchors, draw
// no link between assets, and take every overlay away on exit — no browser, no WebGL.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONTRACT from '../src/compositions/nic_host/contract.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let build;
let createReceiveWalkthrough;
let STEPS;
let PICKS;

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  ({ createNicHostComposition: build } = await import('../src/compositions/nic_host/composition.js'));
  ({ createReceiveWalkthrough, STEPS, PICKS } = await import('../src/compositions/nic_host/walkthrough.js'));
});

/** A camera and highlighter that only record what they are asked to do. */
function stubs() {
  const calls = { views: [], selected: [] };
  const camera = {
    solve: (v) => ({ target: v.box.getCenter(new THREE.Vector3()), position: v.box.getCenter(new THREE.Vector3()).add(v.direction) }),
    animateTo: (target, position) => calls.views.push([target.toArray(), position.toArray()]),
  };
  const highlighter = { setSelected: (id) => calls.selected.push(id) };
  return { camera, highlighter, calls };
}

function setup(options = {}) {
  const system = build();
  const { camera, highlighter, calls } = stubs();
  const walk = createReceiveWalkthrough(system, { camera, highlighter, ...options });
  return { system, walk, calls };
}

/** An outline's centre in the composition root's frame. */
const centreOf = (mesh) => {
  mesh.geometry.computeBoundingBox();
  const c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
  return mesh.matrixAutoUpdate ? c : c.applyMatrix4(mesh.matrix);
};
const anchorInRoot = (system, inst, ref) => system.root.worldToLocal(system.anchor(inst, ref));

describe('nic_host walkthrough — its steps and picks', () => {
  it('can be created, inactive, with the six receive-path steps in order', () => {
    const { walk } = setup();
    expect(walk.active).toBe(false);
    expect(walk.outlines).toEqual([]);
    expect(STEPS.map((s) => s.id)).toEqual(['descriptor', 'buffer', 'element', 'dma', 'mbuf', 'done']);
    expect(STEPS.map((s) => s.objective)).toEqual(['RING-1', 'HMEM-1', 'POOL-1', 'DMA-1', 'MBUF-1', 'RING-1']);
    for (const s of STEPS) expect(s.caption.length).toBeGreaterThan(20);
  });

  it('starts on the descriptor, outlining the ring’s representative slot — its existing `slot` anchor', () => {
    const { system, walk, calls } = setup();
    walk.start();
    expect(walk.index).toBe(0);
    const [slot] = walk.outlines;
    expect(slot.name).toBe('walkthrough-outline:slot');
    const at = anchorInRoot(system, 'rx_ring', 'descriptors.slot');
    expect(centreOf(slot).x).toBeCloseTo(at.x, 4);
    expect(centreOf(slot).z).toBeCloseTo(at.z, 4);
    expect(calls.selected.at(-1)).toBe('rx_ring.descriptors');
  });

  it('picks the pool’s first element — its existing `first_slot` anchor — for the buffer, element and mbuf', () => {
    const { system, walk } = setup();
    walk.start();
    walk.next();
    walk.next(); // element
    const element = walk.outlines.find((o) => o.name === 'walkthrough-outline:element');
    const at = anchorInRoot(system, 'pool', 'elements.first_slot');
    expect(centreOf(element).x).toBeCloseTo(at.x, 4);
    expect(centreOf(element).z).toBeCloseTo(at.z, 4);
    expect(PICKS).toEqual({ slot: 0, element: 0 });
  });

  it('tells setup from arrival: steps 1–3 come before the packet, step 4 writes into the buffer the descriptor named', () => {
    const [descriptor, buffer, element, dma, mbuf] = STEPS;
    expect(descriptor.caption).toMatch(/^Before a packet arrives/);
    expect(buffer.caption).toMatch(/^Before arrival/);
    expect(element.caption).toMatch(/in advance/);
    expect(dma.caption).toMatch(/^A packet arrives/);
    expect(dma.caption).toMatch(/the buffer the descriptor named/);
    expect(dma.caption).toMatch(/in this region/);
    // The DMA writes into a buffer — never into the pool, an mbuf or the descriptor.
    expect(dma.caption).not.toMatch(/mempool|mbuf|into the descriptor/);
    for (const s of STEPS.slice(0, 3)) expect(s.caption).not.toMatch(/arrives:/);
  });

  it('keeps the descriptor and the mbuf distinct: one NIC-facing, one software’s, both for the same buffer', () => {
    const mbuf = STEPS.find((s) => s.id === 'mbuf');
    expect(mbuf.caption).toMatch(/descriptor is the NIC-facing record/);
    expect(mbuf.caption).toMatch(/mbuf is software’s metadata record for the same buffer/);
    expect(mbuf.caption).toMatch(/bytes stay put/);
  });

  it('moves deterministically: the same steps, outlines, highlights and views every run', () => {
    const run = () => {
      const { walk, calls } = setup();
      const trace = [];
      walk.start();
      for (const move of ['next', 'next', 'next', 'next', 'next', 'next', 'back', 'back']) {
        walk[move]();
        trace.push([walk.index, walk.outlines.map((o) => o.name).join(',')]);
      }
      return { trace, calls };
    };
    const a = run();
    const b = run();
    expect(a.trace).toEqual(b.trace);
    expect(a.calls).toEqual(b.calls);
    expect(a.trace.map(([i]) => i)).toEqual([1, 2, 3, 4, 5, 5, 4, 3]); // next stops at the last step
  });
});

describe('nic_host walkthrough — presentation, never semantics', () => {
  it('leaves the contract exactly as it was, through every step and after exit', () => {
    const { system, walk } = setup();
    const before = JSON.stringify(system.contract);
    walk.start();
    for (let i = 0; i < STEPS.length; i++) walk.next();
    for (let i = 0; i < STEPS.length; i++) walk.back();
    walk.exit();
    expect(JSON.stringify(system.contract)).toBe(before);
    expect(system.contract).toEqual(CONTRACT);
  });

  it('adds no component and no registry entry; its outlines cannot be picked', () => {
    const { system, walk } = setup();
    const ids = system.components.map((c) => c.id);
    const registry = new ComponentRegistry();
    system.components.forEach((c) => registry.register(c));
    walk.start();
    for (let i = 0; i < STEPS.length; i++) {
      expect(system.components.map((c) => c.id)).toEqual(ids);
      expect(registry.all()).toHaveLength(ids.length);
      for (const o of walk.outlines) {
        const hits = [];
        o.raycast(new THREE.Raycaster(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -1, 0)), hits);
        expect(hits).toEqual([]);
        expect(registry.idFromObject(o)).toBeFalsy();
      }
      walk.next();
    }
    expect(ids.some((id) => /^(pool\.(element|mbuf|buffer)-|rx_ring\.slot-)/.test(id))).toBe(false);
  });

  it('draws no line: every outline frames one rectangle, never spanning two assets', () => {
    const { system, walk } = setup();
    const pool = new THREE.Box3().setFromObject(system.instances.pool.group).applyMatrix4(system.root.matrixWorld.clone().invert());
    walk.start();
    for (let i = 0; i < STEPS.length; i++) {
      const group = system.root.getObjectByName('walkthrough');
      group.traverse((o) => expect(o.isLine).toBeFalsy());
      for (const o of walk.outlines) {
        o.geometry.computeBoundingBox();
        const box = o.geometry.boundingBox.clone();
        if (!o.matrixAutoUpdate) box.applyMatrix4(o.matrix);
        // Each outline is one small frame: inside the pool, or the ring's slot, or the region.
        const size = box.getSize(new THREE.Vector3());
        expect(size.x).toBeLessThan(9);
        expect(size.z).toBeLessThan(6);
        // In plan: the outline lifts just above the tiles it frames.
        if (/buffer|element|mbuf/.test(o.name)) {
          expect(box.min.x).toBeGreaterThanOrEqual(pool.min.x);
          expect(box.max.x).toBeLessThanOrEqual(pool.max.x);
          expect(box.min.z).toBeGreaterThanOrEqual(pool.min.z);
          expect(box.max.z).toBeLessThanOrEqual(pool.max.z);
        }
      }
      walk.next();
    }
  });

  it('never retargets the DMA path: it ends in the packet-buffer region at every step', () => {
    const { system, walk } = setup();
    const before = system.dmaPath.map((p) => p.toArray());
    const end = system.anchor('memory', 'packet-buffer-region.center');
    walk.start();
    for (let i = 0; i < STEPS.length; i++) {
      expect(system.dmaPath.map((p) => p.toArray())).toEqual(before);
      expect(system.dmaPath.at(-1).distanceTo(end)).toBeLessThan(1e-6);
      walk.next();
    }
    expect(CONTRACT.interactions).toEqual([{ concept: 'dma', from: 'nic', to: 'memory.packet-buffer-region', via: ['pcie', 'cpu.io', 'cpu.memory-controller'] }]);
  });

  it('leaves the DMA path exactly as a system without a walkthrough draws it', () => {
    const plain = build().dmaPath.map((p) => p.toArray());
    const { system, walk } = setup();
    walk.start();
    for (let i = 0; i < STEPS.length; i++) {
      expect(system.dmaPath.map((p) => p.toArray())).toEqual(plain);
      walk.next();
    }
    walk.exit();
    expect(system.dmaPath.map((p) => p.toArray())).toEqual(plain);
  });

  it('shows the DMA flow only for its step, and restores it on exit', () => {
    const { system, walk } = setup();
    const dma = system.root.getObjectByName('interaction.dma');
    system.setDmaVisible(false);
    walk.start();
    expect(dma.visible).toBe(false);
    walk.next();
    walk.next();
    walk.next(); // dma
    expect(walk.step.id).toBe('dma');
    expect(dma.visible).toBe(true);
    walk.next();
    expect(dma.visible).toBe(false);
    walk.exit();
    expect(dma.visible).toBe(false);
  });

  it('takes every outline away on exit and clears its highlight, so normal selection resumes', () => {
    const { system, walk, calls } = setup();
    walk.start();
    walk.next();
    walk.exit();
    expect(walk.active).toBe(false);
    expect(walk.outlines).toEqual([]);
    expect(system.root.getObjectByName('walkthrough')).toBeUndefined();
    let named = 0;
    system.root.traverse((o) => (named += /^walkthrough/.test(o.name) ? 1 : 0));
    expect(named).toBe(0);
    expect(calls.selected.at(-1)).toBeNull();
    // Selection is the registry's, untouched: every part is still there and pickable.
    const registry = new ComponentRegistry();
    system.components.forEach((c) => registry.register(c));
    expect(registry.has('pool.elements') && registry.has('rx_ring.descriptors')).toBe(true);
  });

  it('runs with reduced motion: steady outlines, no errors', () => {
    const { walk } = setup({ reducedMotion: true });
    walk.start();
    for (let i = 0; i < 10; i++) walk.update(0.1);
    expect(walk.outlines[0].material.opacity).toBe(0.95);
    walk.exit();
    walk.update(0.1); // inactive: a no-op
  });

  it('keeps the walkthrough inside the composition: it imports only asset layouts, never a page', () => {
    const src = fs.readFileSync(path.join(HERE, '../src/compositions/nic_host/walkthrough.js'), 'utf8');
    const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports.every((s) => s === 'three' || /domains\/memory\/(descriptor-ring|mempool)\/layout\.js$/.test(s))).toBe(true);
    expect(src).not.toMatch(/contract\.(instances|residence|references|interactions)\s*[.=[]/);
  });

  it('keeps the illustrative disclaimer on every layout — a compact form where the bar is compact', () => {
    const page = path.join(HERE, '../../../experiences/networking/nic-host');
    const html = fs.readFileSync(path.join(page, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(page, 'nic-host.css'), 'utf8');
    expect(html).toMatch(/class="walk-note-full">Illustrative: one descriptor and one pool element, chosen to explain — not a fixed pairing\./);
    expect(html).toMatch(/class="walk-note-short">Illustrative — not a fixed pairing\./);
    const landscape = css.slice(css.indexOf('@media (max-height: 500px) and (orientation: landscape)'));
    expect(landscape.length).toBeLessThan(css.length);
    const rule = (sel) => landscape.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule('.walk-note')).not.toMatch(/display:\s*none/);
    expect(rule('.walk-note-short')).toMatch(/display:\s*inline/);
    expect(rule('.walk-note-full')).toMatch(/display:\s*none/);
  });
});
