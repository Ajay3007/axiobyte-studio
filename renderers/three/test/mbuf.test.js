// mbuf asset: the layout's invariants, and the built model — no browser, no WebGL. Canvas textures
// are drawn into a stub context, so the real model builds here exactly as on a page.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { BODY, FIELDS, FIELD_TOP, TITLE, center, fieldRect } from '../src/domains/memory/mbuf/layout.js';
import { MBUF_METADATA } from '../src/domains/memory/mbuf/metadata.js';
import { PARTS } from '../src/domains/memory/mbuf/scene.js';

const BODY_RECT = { x0: -BODY.width / 2, x1: BODY.width / 2, z0: -BODY.depth / 2, z1: BODY.depth / 2 };
const inside = (a, b) => a.x0 >= b.x0 - 1e-9 && a.x1 <= b.x1 + 1e-9 && a.z0 >= b.z0 - 1e-9 && a.z1 <= b.z1 + 1e-9;
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

let createMbuf;
beforeAll(async () => {
  // A 2D context that accepts every drawing call: enough for canvasTexture() outside a browser.
  const context = () =>
    new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => ((t[k] = v), true) });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: context }) };
  ({ createMbuf } = await import('../src/domains/memory/mbuf/Mbuf.js'));
});

describe('mbuf — the layout is one record of fields', () => {
  it('shows data_len, refcount and buf_addr, with buf_addr last, nearest the viewer', () => {
    expect(FIELDS).toEqual(['data_len', 'refcount', 'buf_addr']);
  });

  it('keeps every field strip on the record, below its title band, with none overlapping', () => {
    const rects = FIELDS.map((_, i) => fieldRect(i));
    for (const r of rects) {
      expect(inside(r, BODY_RECT)).toBe(true);
      expect(r.z0).toBeGreaterThanOrEqual(-BODY.depth / 2 + TITLE.depth - 1e-9);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBe(false);
  });
});

describe('mbuf — the built model', () => {
  it('has one semantic component, `fields`, and metadata keyed by exactly that part', () => {
    const { components } = createMbuf();
    expect(components.map((c) => c.id)).toEqual(['fields']);
    expect(PARTS).toEqual(['fields']);
    expect(Object.keys(MBUF_METADATA)).toEqual(['fields']);
    expect(components[0].meta).toBe(MBUF_METADATA.fields);
  });

  it('anchors center and buf_addr, and the strips of the fields it draws — never next', () => {
    const [fields] = createMbuf().components;
    expect(Object.keys(fields.anchors).sort()).toEqual(['buf_addr', 'center', 'data_len', 'refcount']);
    for (const name of ['data_len', 'refcount']) {
      const [x, z] = center(fieldRect(FIELDS.indexOf(name)));
      expect(fields.anchors[name].x).toBeCloseTo(x, 9);
      expect(fields.anchors[name].z).toBeCloseTo(z, 9);
      expect(fields.anchors[name].y).toBeCloseTo(FIELD_TOP, 9);
    }
  });

  it('puts buf_addr at the record’s edge, on the buf_addr row: where a reference to the buffer leaves', () => {
    const { components, root } = createMbuf();
    const a = components[0].anchors.buf_addr;
    const row = fieldRect(FIELDS.indexOf('buf_addr'));
    expect(a.x).toBeGreaterThan(BODY.width / 2);
    expect(a.z).toBeCloseTo((row.z0 + row.z1) / 2, 9);
    // The socket is there, drawn in the pointer's colour; the reference itself is not part of the mbuf.
    const socket = root.getObjectByName('mbuf-buf-addr-socket');
    expect(socket).toBeTruthy();
    const names = [];
    root.traverse((o) => names.push(o.name));
    expect(names.some((n) => /link|arrow|pointer-line|reference/.test(n))).toBe(false);
  });

  it('prints each field it shows, and the title that says it is metadata', () => {
    const { root } = createMbuf();
    for (const f of FIELDS) expect(root.getObjectByName(`mbuf-${f.replace('_', '-')}-print`), f).toBeTruthy();
    expect(root.getObjectByName('mbuf-title-print')).toBeTruthy();
  });

  it('registers one pickable part: every mesh of the record resolves to `fields`', () => {
    const { components } = createMbuf();
    const registry = new ComponentRegistry();
    components.forEach((c) => registry.register(c));
    expect(registry.all().map((e) => e.id)).toEqual(['fields']);
    for (const mesh of registry.pickables()) expect(registry.idFromObject(mesh)).toBe('fields');
  });

  it('names nothing after packet bytes, a runtime state, an owner or an address, and numbers nothing', () => {
    const { root } = createMbuf();
    root.traverse((o) => {
      expect(o.name, o.name).not.toMatch(/byte|payload|header|packet|free|pooled|attached|freed|in-use|in_use|owner|0x|allocated|\d/i);
    });
  });

  it('builds the same geometry every time', () => {
    const fingerprint = () => {
      let h = 0;
      createMbuf().root.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) h = (h * 31 + p[i] * 1000) % 1e9;
      });
      return h;
    };
    expect(fingerprint()).toBe(fingerprint());
  });

  it('is genuinely 3D: the record and its strips have depth, not one flat card', () => {
    const box = new THREE.Box3().setFromObject(createMbuf().root);
    const size = box.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(0.2);
    expect(size.x).toBeGreaterThan(BODY.width);
  });

  it('owns every geometry through its kit, so dispose() releases all of it', () => {
    const { root, kit } = createMbuf();
    const owned = new Set(kit.geometries.values());
    root.traverse((o) => {
      if (o.isMesh) expect(owned.has(o.geometry), o.name).toBe(true);
    });
  });
});
