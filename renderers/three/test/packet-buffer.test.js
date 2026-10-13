// Packet Buffer asset: the layout's invariants, and the built model — no browser, no WebGL. Canvas
// textures are drawn into a stub context, so the real model builds here exactly as on a page.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import {
  BYTES_RECT,
  CELL_TOP,
  FRAME_RECT,
  HEADER,
  HEADER_RECT,
  PAYLOAD,
  PAYLOAD_RECT,
  RIM_TOP,
  cells,
  center,
} from '../src/domains/memory/packet-buffer/layout.js';
import { PACKET_BUFFER_METADATA } from '../src/domains/memory/packet-buffer/metadata.js';
import { PARTS } from '../src/domains/memory/packet-buffer/scene.js';

const inside = (a, b) => a.x0 >= b.x0 - 1e-9 && a.x1 <= b.x1 + 1e-9 && a.z0 >= b.z0 - 1e-9 && a.z1 <= b.z1 + 1e-9;
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const ANCHORS = ['center', 'dma_target', 'pointer_target', 'read'];

let createPacketBuffer;
beforeAll(async () => {
  const context = () =>
    new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => ((t[k] = v), true) });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: context }) };
  ({ createPacketBuffer } = await import('../src/domains/memory/packet-buffer/PacketBuffer.js'));
});

describe('packet buffer — the layout: a frame holding a header, then a payload', () => {
  it('puts the header first (left, where the address points) and the payload after it', () => {
    expect(HEADER_RECT.x1).toBeLessThanOrEqual(PAYLOAD_RECT.x0);
    expect(overlaps(HEADER_RECT, PAYLOAD_RECT)).toBe(false);
    expect(HEADER.cols * HEADER.rows).toBeLessThan(PAYLOAD.cols * PAYLOAD.rows);
  });

  it('keeps every byte inside its region, inside the frame, with no two overlapping', () => {
    const header = cells(HEADER_RECT, HEADER);
    const payload = cells(PAYLOAD_RECT, PAYLOAD);
    for (const r of header) expect(inside(r, HEADER_RECT)).toBe(true);
    for (const r of payload) expect(inside(r, PAYLOAD_RECT)).toBe(true);
    for (const r of [...header, ...payload]) expect(inside(r, FRAME_RECT)).toBe(true);
    const all = [...header, ...payload];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i], all[j])).toBe(false);
  });

  it('holds the bytes below the rim: they are in the buffer, not on it', () => {
    expect(CELL_TOP).toBeLessThan(RIM_TOP);
  });
});

describe('packet buffer — the built model', () => {
  it('has two semantic components, `header` and `payload`, with metadata keyed by exactly those parts', () => {
    const { components } = createPacketBuffer();
    expect(components.map((c) => c.id)).toEqual(['header', 'payload']);
    expect(PARTS).toEqual(['header', 'payload']);
    expect(Object.keys(PACKET_BUFFER_METADATA)).toEqual(['header', 'payload']);
    for (const c of components) expect(c.meta).toBe(PACKET_BUFFER_METADATA[c.id]);
  });

  it('anchors center, dma_target, read and pointer_target on both parts, plus each region’s own', () => {
    const [header, payload] = createPacketBuffer().components;
    expect(Object.keys(header.anchors).sort()).toEqual([...ANCHORS, 'header'].sort());
    expect(Object.keys(payload.anchors).sort()).toEqual([...ANCHORS, 'payload'].sort());
    for (const a of ANCHORS) expect(header.anchors[a].equals(payload.anchors[a]), a).toBe(true);
  });

  it('points pointer_target at the buffer’s address: its first byte, on the frame’s outside at the header', () => {
    const [header] = createPacketBuffer().components;
    const p = header.anchors.pointer_target;
    expect(p.x).toBeCloseTo(FRAME_RECT.x0, 9); // the start of the buffer
    expect(p.z).toBeGreaterThanOrEqual(HEADER_RECT.z0);
    expect(p.z).toBeLessThanOrEqual(HEADER_RECT.z1);
  });

  it('lands dma_target and read on the bytes, through the frame’s opening', () => {
    const [header] = createPacketBuffer().components;
    const [cx, cz] = center(BYTES_RECT);
    for (const a of ['dma_target', 'read']) {
      expect(header.anchors[a].x).toBeCloseTo(cx, 9);
      expect(header.anchors[a].z).toBeCloseTo(cz, 9);
      expect(header.anchors[a].y).toBeCloseTo(RIM_TOP, 9);
    }
  });

  it('draws the bytes as part of the buffer: one mesh per header byte, the payload’s on one mesh', () => {
    const buffer = createPacketBuffer();
    expect(buffer.header.cells).toHaveLength(HEADER.cols * HEADER.rows);
    // Each header byte has its own material, so a film can edit the header in place.
    expect(new Set(buffer.header.materials).size).toBe(buffer.header.cells.length);
    buffer.header.cells.forEach((c, i) => expect(c.material).toBe(buffer.header.materials[i]));
    const payload = buffer.root.getObjectByName('packet-buffer-payload-bytes');
    expect(payload).toBeTruthy();
    // Every byte is inside the buffer's object tree.
    for (const c of [...buffer.header.cells, payload]) {
      let o = c;
      while (o.parent) o = o.parent;
      expect(o).toBe(buffer.root);
    }
  });

  it('registers two pickable parts; every byte mesh resolves to its region', () => {
    const buffer = createPacketBuffer();
    const registry = new ComponentRegistry();
    buffer.components.forEach((c) => registry.register(c));
    expect(registry.all().map((e) => e.id)).toEqual(['header', 'payload']);
    for (const c of buffer.header.cells) expect(registry.idFromObject(c)).toBe('header');
    expect(registry.idFromObject(buffer.root.getObjectByName('packet-buffer-payload-bytes'))).toBe('payload');
  });

  it('names nothing after metadata, a runtime state, an owner or an address, and numbers nothing', () => {
    const { root } = createPacketBuffer();
    root.traverse((o) => {
      expect(o.name, o.name).not.toMatch(/mbuf|buf-addr|buf_addr|field|free|in-use|in_use|owner|0x|allocated|returned|posted|\d/i);
    });
  });

  it('builds the same geometry every time', () => {
    const fingerprint = () => {
      let h = 0;
      createPacketBuffer().root.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) h = (h * 31 + p[i] * 1000) % 1e9;
      });
      return h;
    };
    expect(fingerprint()).toBe(fingerprint());
  });

  it('is genuinely 3D: walls and raised bytes, not one flat card', () => {
    const box = new THREE.Box3().setFromObject(createPacketBuffer().root);
    expect(box.getSize(new THREE.Vector3()).y).toBeGreaterThanOrEqual(RIM_TOP - 1e-6); // float32 vertices
  });

  it('owns every geometry through its kit, so dispose() releases all of it', () => {
    const { root, kit } = createPacketBuffer();
    const owned = new Set(kit.geometries.values());
    root.traverse((o) => {
      if (o.isMesh) expect(owned.has(o.geometry), o.name).toBe(true);
    });
  });
});
