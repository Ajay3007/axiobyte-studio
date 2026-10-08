// Descriptor Ring asset: the layout's invariants, and the built model — no browser, no WebGL. Canvas
// textures are drawn into a stub context, so the real model builds here exactly as on the page.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { Highlighter } from '../src/core/Highlighter.js';
import { CARD, MARK, RING, cardRect, inSlot, markCenter, slotCenter } from '../src/domains/memory/descriptor-ring/layout.js';
import { ANCHOR_METADATA, DESCRIPTOR_RING_METADATA } from '../src/domains/memory/descriptor-ring/metadata.js';
import { ANCHORS, PARTS, createDescriptorRingScene } from '../src/domains/memory/descriptor-ring/scene.js';

const corners = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]];

let createDescriptorRing;
beforeAll(async () => {
  // A 2D context that accepts every drawing call: enough for canvasTexture() outside a browser.
  const context = () =>
    new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => ((t[k] = v), true) });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: context }) };
  ({ createDescriptorRing } = await import('../src/domains/memory/descriptor-ring/DescriptorRing.js'));
});

describe('descriptor-ring — the layout is a clean ring', () => {
  it('puts every field card wholly inside its own slot, and no part of it in another', () => {
    for (let i = 0; i < RING.count; i++) {
      for (const c of corners(cardRect(i))) {
        expect(inSlot(i, c)).toBe(true);
        for (let j = 0; j < RING.count; j++) if (j !== i) expect(inSlot(j, c)).toBe(false);
      }
    }
  });

  it('orders the slots clockwise seen from above, starting at the far side', () => {
    const [x0, z0] = slotCenter(0);
    expect(Math.abs(x0)).toBeLessThan(1e-9);
    expect(z0).toBeLessThan(0); // D0 far
    expect(slotCenter(RING.count / 4)[0]).toBeGreaterThan(0); // a quarter round: right
    expect(slotCenter(RING.count / 2)[1]).toBeGreaterThan(0); // half round: near
  });

  it('marks head and tail at two different slots, inside the ring, on opposite sides', () => {
    expect(RING.head).not.toBe(RING.tail);
    for (const i of [RING.head, RING.tail]) {
      const [x, z] = markCenter(i);
      expect(Math.hypot(Math.abs(x) + MARK.w / 2, Math.abs(z) + MARK.d / 2)).toBeLessThan(RING.inner);
    }
    expect(Math.sign(markCenter(RING.head)[0])).toBe(-Math.sign(markCenter(RING.tail)[0]));
    expect(CARD.w).toBeGreaterThan(CARD.d);
  });
});

describe('descriptor-ring — the built model', () => {
  it('has one part, the descriptors, and head and tail as anchors beside it, never as parts', () => {
    const { components, marks } = createDescriptorRing();
    expect(components.map((c) => c.id)).toEqual(PARTS);
    expect(PARTS).toEqual(['descriptors']);
    expect(Object.keys(DESCRIPTOR_RING_METADATA)).toEqual(PARTS);
    expect(marks.map((m) => m.id)).toEqual(ANCHORS);
    for (const m of marks) {
      expect(m.meta).toBe(ANCHOR_METADATA[m.id]);
      expect(m.meta.designator).toBe('Anchor');
      expect(m.meta.category).toMatch(/not a part/);
    }
  });

  it('anchors head, tail and one representative slot on the descriptors, at their slots', () => {
    const [descriptors] = createDescriptorRing().components;
    const at = (i) => slotCenter(i);
    for (const [name, i] of [['head', RING.head], ['tail', RING.tail], ['slot', RING.representative]]) {
      const a = descriptors.anchors[name];
      expect(a.x).toBeCloseTo(at(i)[0], 9);
      expect(a.z).toBeCloseTo(at(i)[1], 9);
    }
    expect(Object.keys(descriptors.anchors).sort()).toEqual(['center', 'head', 'slot', 'tail']);
  });

  it('draws no buffers, mbufs, packets or hardware: only the ring, its base and its marks', () => {
    const { root } = createDescriptorRing();
    root.traverse((o) => expect(o.name, o.name).not.toMatch(/buffer|mbuf|mempool|packet|nic|pcie|cpu|dma/i));
  });

  it('builds the same geometry every time, and nothing moves', () => {
    const fingerprint = () => {
      const ring = createDescriptorRing();
      let h = 0;
      ring.root.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 7) h = (h * 31 + p[i] * 1000) % 1e9;
      });
      ring.update(5);
      ring.root.updateMatrixWorld(true);
      return h;
    };
    expect(fingerprint()).toBe(fingerprint());
  });

  it('owns every geometry through its kit, so dispose() releases all of it', () => {
    const { root, kit } = createDescriptorRing();
    const owned = new Set(kit.geometries.values());
    root.traverse((o) => {
      if (o.isMesh) expect(owned.has(o.geometry), o.name).toBe(true);
    });
  });

  it('highlights the descriptors and a mark when selected, and returns them to rest', () => {
    const { components, marks } = createDescriptorRing();
    const registry = new ComponentRegistry();
    [...components, ...marks].forEach((c) => registry.register(c));
    const highlighter = new Highlighter(registry);
    highlighter.prepareAll();
    const cards = components[0].object.getObjectByName('descriptor-ring-cards');
    for (const [id, mat] of [['descriptors', cards.material], ['head', marks[0].object.material]]) {
      highlighter.setSelected(id);
      for (let i = 0; i < 30; i++) highlighter.update(0.1);
      expect(mat.color.r).toBeGreaterThan(1);
      highlighter.setSelected(null);
      for (let i = 0; i < 30; i++) highlighter.update(0.1);
      expect(mat.color.r).toBeCloseTo(1, 5);
    }
  });
});

describe('descriptor-ring — the scene: picking and camera presets', () => {
  function scene({ aspect = 1.6 } = {}) {
    const presets = new Map();
    const engine = { scene: new THREE.Scene(), aspect, controls: { target: new THREE.Vector3() } };
    const camera = { definePreset: (name, fn) => presets.set(name, fn), addResolver: () => {} };
    const registry = new ComponentRegistry();
    const s = createDescriptorRingScene({ engine, registry, camera });
    return { s, registry, presets };
  }

  it('registers the descriptors and the head and tail marks, all pickable', () => {
    const { registry } = scene();
    expect(registry.all().map((e) => e.id).sort()).toEqual(['descriptors', 'head', 'tail']);
    for (const e of registry.all()) expect(e.enabled).toBe(true);
  });

  it('defines the overview, ring and descriptor presets, each framing what it names', () => {
    const { s, registry, presets } = scene();
    expect([...presets.keys()].sort()).toEqual(['descriptor', 'overview', 'ring']);
    const contains = (box, id) => box.containsBox(registry.worldBox(id));
    for (const name of ['overview', 'ring']) for (const id of [...PARTS, ...ANCHORS]) expect(contains(presets.get(name)().box, id)).toBe(true);
    const ring = presets.get('ring')();
    expect(ring.direction.y).toBeGreaterThan(5 * ring.direction.z); // looks straight down
    const one = presets.get('descriptor')().box;
    const slot = s.ring.root.localToWorld(registry.get('descriptors').anchors.slot.clone());
    expect(one.containsPoint(slot)).toBe(true);
    expect(one.getSize(new THREE.Vector3()).x).toBeLessThan(registry.worldBox('descriptors').getSize(new THREE.Vector3()).x / 3);
  });

  it('has a portrait overview that looks further down, so the ring fits an upright screen', () => {
    const wide = scene({ aspect: 1.6 }).presets.get('overview')();
    const tall = scene({ aspect: 0.5 }).presets.get('overview')();
    const tilt = (d) => d.y / Math.hypot(d.x, d.z);
    expect(tilt(tall.direction)).toBeGreaterThan(tilt(wide.direction));
  });
});

describe('descriptor-ring — a standalone asset', () => {
  it('imports nothing from another asset, a composition or another domain', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const roots = [path.join(here, '../src/domains/memory/descriptor-ring'), path.join(here, '../../../experiences/memory/descriptor-ring')];
    const files = roots.flatMap((r) => fs.readdirSync(r).filter((f) => f.endsWith('.js')).map((f) => path.join(r, f)));
    expect(files.length).toBeGreaterThan(6);
    for (const f of files) {
      const imports = [...fs.readFileSync(f, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec).not.toMatch(/compositions\//);
        expect(spec).not.toMatch(/host-memory|domains\/(networking|io|computing)\//);
      }
    }
  });
});
