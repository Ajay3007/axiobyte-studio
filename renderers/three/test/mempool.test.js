// Mempool asset: the layout's invariants, and the built model — no browser, no WebGL. Canvas
// textures are drawn into a stub context, so the real model builds here exactly as on a page.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { Highlighter } from '../src/core/Highlighter.js';
import { COUNT, ELEMENT, FIRST, GRID_CENTER, LAST, POOL, TRAY, bufferRect, center, elementRect, mbufRect } from '../src/domains/memory/mempool/layout.js';
import { MEMPOOL_METADATA } from '../src/domains/memory/mempool/metadata.js';
import { PARTS, createMempoolScene } from '../src/domains/memory/mempool/scene.js';

const inside = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.z0 >= b.z0 && a.z1 <= b.z1;
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const TRAY_RECT = { x0: -TRAY.width / 2, x1: TRAY.width / 2, z0: -TRAY.depth / 2, z1: TRAY.depth / 2 };
const ALL = Array.from({ length: COUNT }, (_, i) => i);

let createMempool;
beforeAll(async () => {
  // A 2D context that accepts every drawing call: enough for canvasTexture() outside a browser.
  const context = () =>
    new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => ((t[k] = v), true) });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: context }) };
  ({ createMempool } = await import('../src/domains/memory/mempool/Mempool.js'));
});

describe('mempool — the layout is a clean grid of identical elements', () => {
  it('has twelve elements, never fewer than four (the visual rule: a pool reads as plural)', () => {
    expect(COUNT).toBe(12);
    expect(POOL.cols * POOL.rows).toBe(COUNT);
    expect(COUNT).toBeGreaterThanOrEqual(4);
  });

  it('keeps every element on the tray, with no two overlapping', () => {
    for (const i of ALL) expect(inside(elementRect(i), TRAY_RECT)).toBe(true);
    for (const i of ALL) for (const j of ALL) if (i < j) expect(overlaps(elementRect(i), elementRect(j))).toBe(false);
  });

  it('divides each element into an mbuf half and a larger buffer half, inside it and apart', () => {
    for (const i of ALL) {
      const e = elementRect(i);
      const m = mbufRect(i);
      const b = bufferRect(i);
      expect(inside(m, e)).toBe(true);
      expect(inside(b, e)).toBe(true);
      expect(overlaps(m, b)).toBe(false);
      expect(m.x1 - m.x0).toBeLessThan(b.x1 - b.x0);
    }
    expect(ELEMENT.mbufWidth).toBeLessThan(ELEMENT.bufferWidth);
  });

  it('puts FIRST and LAST at the first and last places in layout order', () => {
    expect(FIRST).toBe(0);
    expect(LAST).toBe(COUNT - 1);
    const key = (i) => [elementRect(i).z0, elementRect(i).x0];
    const order = [...ALL].sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1]);
    expect(order[0]).toBe(FIRST);
    expect(order[order.length - 1]).toBe(LAST);
  });
});

describe('mempool — the built model', () => {
  it('has one semantic component, `elements`, and metadata keyed by exactly that part', () => {
    const { components } = createMempool();
    expect(components.map((c) => c.id)).toEqual(['elements']);
    expect(PARTS).toEqual(['elements']);
    expect(Object.keys(MEMPOOL_METADATA)).toEqual(['elements']);
    expect(components[0].meta).toBe(MEMPOOL_METADATA.elements);
  });

  it('anchors first_slot, last_slot and center on the elements: the first and last tiles, and the grid', () => {
    const [elements] = createMempool().components;
    expect(Object.keys(elements.anchors).sort()).toEqual(['center', 'first_slot', 'last_slot']);
    const at = (a, [x, z]) => {
      expect(a.x).toBeCloseTo(x, 9);
      expect(a.z).toBeCloseTo(z, 9);
    };
    at(elements.anchors.first_slot, center(elementRect(FIRST)));
    at(elements.anchors.last_slot, center(elementRect(LAST)));
    at(elements.anchors.center, GRID_CENTER);
  });

  it('registers no tile, mbuf half or buffer half as a component of its own', () => {
    const { components } = createMempool();
    const registry = new ComponentRegistry();
    components.forEach((c) => registry.register(c));
    expect(registry.all().map((e) => e.id)).toEqual(['elements']);
    // Every pickable mesh resolves to the one part.
    for (const mesh of registry.pickables()) expect(registry.idFromObject(mesh)).toBe('elements');
    expect(components.some((c) => /^(element|mbuf|buffer)-\d/.test(c.id))).toBe(false);
  });

  it('names nothing after a runtime state, an owner or an address, and numbers nothing', () => {
    const { root } = createMempool();
    root.traverse((o) => {
      expect(o.name, o.name).not.toMatch(/free|posted|in-use|in_use|owner|0x|allocated|\d/i);
    });
  });

  it('builds the same geometry every time', () => {
    const fingerprint = () => {
      let h = 0;
      createMempool().root.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 5) h = (h * 31 + p[i] * 1000) % 1e9;
      });
      return h;
    };
    expect(fingerprint()).toBe(fingerprint());
  });

  it('owns every geometry through its kit, so dispose() releases all of it', () => {
    const { root, kit } = createMempool();
    const owned = new Set(kit.geometries.values());
    root.traverse((o) => {
      if (o.isMesh) expect(owned.has(o.geometry), o.name).toBe(true);
    });
  });

  it('highlights the elements as one and returns them to rest, leaving the geometry untouched', () => {
    const { components, root } = createMempool();
    const registry = new ComponentRegistry();
    components.forEach((c) => registry.register(c));
    const highlighter = new Highlighter(registry);
    highlighter.prepareAll();
    const cards = root.getObjectByName('mempool-cards');
    const before = Array.from(cards.geometry.attributes.position.array);
    highlighter.setSelected('elements');
    for (let i = 0; i < 30; i++) highlighter.update(0.1);
    expect(cards.material.color.r).toBeGreaterThan(1);
    highlighter.setSelected(null);
    for (let i = 0; i < 30; i++) highlighter.update(0.1);
    expect(cards.material.color.r).toBeCloseTo(1, 5);
    expect(Array.from(cards.geometry.attributes.position.array)).toEqual(before);
  });
});

describe('mempool — the scene: camera presets', () => {
  function scene({ aspect = 1.6 } = {}) {
    const presets = new Map();
    const engine = { scene: new THREE.Scene(), aspect, controls: { target: new THREE.Vector3() } };
    const camera = { definePreset: (name, fn) => presets.set(name, fn), addResolver: () => {} };
    const registry = new ComponentRegistry();
    const s = createMempoolScene({ engine, registry, camera });
    return { s, registry, presets };
  }

  it('defines overview, top and element, framing the pool, the pool from above, and the first tile', () => {
    const { s, registry, presets } = scene();
    expect([...presets.keys()].sort()).toEqual(['element', 'overview', 'top']);
    const pool = registry.worldBox('elements');
    expect(presets.get('overview')().box.containsBox(pool)).toBe(true);
    const top = presets.get('top')();
    expect(top.box.containsBox(pool)).toBe(true);
    expect(top.direction.y).toBeGreaterThan(5 * top.direction.z); // looks straight down
    const one = presets.get('element')().box;
    const first = s.pool.root.localToWorld(registry.get('elements').anchors.first_slot.clone());
    expect(one.containsPoint(first)).toBe(true);
    expect(one.getSize(new THREE.Vector3()).x).toBeLessThan(pool.getSize(new THREE.Vector3()).x / 3);
  });

  it('has a portrait overview that looks further down, so the pool fits an upright screen', () => {
    const wide = scene({ aspect: 1.6 }).presets.get('overview')();
    const tall = scene({ aspect: 0.5 }).presets.get('overview')();
    const tilt = (d) => d.y / Math.hypot(d.x, d.z);
    expect(tilt(tall.direction)).toBeGreaterThan(tilt(wide.direction));
  });
});

describe('mempool — a standalone asset', () => {
  it('imports nothing from another asset, a composition or another domain', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const dir = path.join(here, '../src/domains/memory/mempool');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
    expect(files.length).toBe(5);
    for (const f of files) {
      const imports = [...fs.readFileSync(f, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec).not.toMatch(/compositions\//);
        expect(spec).not.toMatch(/host-memory|descriptor-ring|domains\/(networking|io|computing)\//);
      }
    }
  });
});
