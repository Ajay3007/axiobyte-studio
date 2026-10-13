// The relationship between the two assets, as the visual language states it: the mbuf is metadata
// and holds no bytes; the packet buffer holds the bytes; buf_addr is a reference a composition draws
// from one to the other — neither asset draws it, and neither contains the other.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';

// The theme's role hues (design/themes/systems.yaml).
const PACKET = new THREE.Color('#4aa8ff');
const MBUF = new THREE.Color('#34d8e8');
const POINTER = new THREE.Color('#f5d14f');

/** Whether a colour is a role hue at some brightness: same chromaticity, any intensity. */
const isHue = (c, hue) => {
  const n = (x) => {
    const s = x.r + x.g + x.b;
    return s > 0 ? [x.r / s, x.g / s, x.b / s] : [0, 0, 0];
  };
  const [a, b] = [n(c), n(hue)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.02;
};
const colours = (root) => {
  const out = [];
  root.traverse((o) => {
    if (o.isMesh && o.material?.color) out.push({ name: o.name, color: o.material.color });
  });
  return out;
};

let createMbuf;
let createPacketBuffer;
let createMempool;
beforeAll(async () => {
  const context = () =>
    new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => ((t[k] = v), true) });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: context }) };
  ({ createMbuf } = await import('../src/domains/memory/mbuf/Mbuf.js'));
  ({ createPacketBuffer } = await import('../src/domains/memory/packet-buffer/PacketBuffer.js'));
  ({ createMempool } = await import('../src/domains/memory/mempool/Mempool.js'));
});

describe('mbuf and packet buffer — metadata is not bytes', () => {
  it('the mbuf contains no packet bytes: nothing in it is drawn in the packet’s colour', () => {
    for (const { name, color } of colours(createMbuf().root)) expect(isHue(color, PACKET), name).toBe(false);
  });

  it('the packet buffer contains the bytes: its byte cells are drawn in the packet’s colour', () => {
    const buffer = createPacketBuffer();
    const bytes = [...buffer.header.cells, buffer.root.getObjectByName('packet-buffer-payload-bytes')];
    // The header's lighter blue and the payload's blue are both the packet's role, at different tints.
    const blueish = (c) => c.b > c.r && c.b > c.g * 0.9;
    for (const b of bytes) expect(blueish(b.material.color), b.name).toBe(true);
    expect(isHue(buffer.root.getObjectByName('packet-buffer-payload-bytes').material.color, PACKET)).toBe(true);
  });

  it('the packet buffer is not metadata: nothing in it is drawn in the mbuf’s or the pointer’s colour', () => {
    for (const { name, color } of colours(createPacketBuffer().root)) {
      expect(isHue(color, MBUF), name).toBe(false);
      expect(isHue(color, POINTER), name).toBe(false);
    }
  });

  it('neither asset contains the other', () => {
    const mbuf = createMbuf().root;
    const buffer = createPacketBuffer().root;
    expect(mbuf.getObjectByName('packet-buffer')).toBeUndefined();
    expect(buffer.getObjectByName('mbuf')).toBeUndefined();
  });
});

describe('mbuf and packet buffer — buf_addr can target the buffer', () => {
  it('composes: the mbuf’s buf_addr and the buffer’s pointer_target are both reachable in one registry', () => {
    // A composition places the two side by side and draws the reference itself; the assets only
    // offer the two ends. Parts do not collide: fields | header, payload.
    const mbuf = createMbuf();
    const buffer = createPacketBuffer();
    const scene = new THREE.Group();
    scene.add(mbuf.root, buffer.root);
    buffer.root.position.set(6, 0, 0);
    scene.updateWorldMatrix(true, true);
    const registry = new ComponentRegistry();
    [...mbuf.components, ...buffer.components].forEach((c) => registry.register(c));
    expect(registry.all().map((e) => e.id)).toEqual(['fields', 'header', 'payload']);

    const from = registry.anchorWorld('fields', 'buf_addr');
    const to = registry.anchorWorld('header', 'pointer_target');
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    // The address end faces the mbuf: a straight reference from buf_addr reaches the buffer's
    // first byte from outside, without passing through the buffer's bytes.
    // (The base plate's 0.015 bevel is the only thing further out than the frame's face.)
    const bufferBox = new THREE.Box3().setFromObject(buffer.root);
    expect(Math.abs(to.x - bufferBox.min.x)).toBeLessThan(0.02);
    const firstByte = new THREE.Box3().setFromObject(buffer.header.cells[0]);
    expect(to.x).toBeLessThan(firstByte.min.x);
    expect(from.x).toBeLessThan(to.x);
  });

  it('leaves the existing Mempool as it is: its elements are still one part with its three anchors', () => {
    const [elements] = createMempool().components;
    expect(elements.id).toBe('elements');
    expect(Object.keys(elements.anchors).sort()).toEqual(['center', 'first_slot', 'last_slot']);
  });
});
