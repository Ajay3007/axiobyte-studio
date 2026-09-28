// Pure-module tests for the Three.js backend's core — no browser, no WebGL.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Tweens, Ease } from '../src/core/tween.js';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';
import { RX_PATH, TX_PATH, STAGES, hardwareRoute, neighbors } from '../src/domains/networking/dataplane.js';

const words = (text, t0 = 0) =>
  text.split(' ').map((w, i) => ({ word: w, start: t0 + i * 0.5, end: t0 + i * 0.5 + 0.4, sentence_index: 0 }));

describe('Tweens — the clock is injected, which is what makes video deterministic', () => {
  it('advances only when the host pushes time in', () => {
    const tweens = new Tweens(0);
    const seen = [];
    tweens.add({ duration: 1000, ease: Ease.linear, onUpdate: (k) => seen.push(k) });
    tweens.update(250);
    tweens.update(1000);
    expect(seen).toEqual([0.25, 1]);
  });

  it('the same timestamps give the same values in a fresh runner', () => {
    const run = () => {
      const t = new Tweens(0);
      const out = [];
      t.add({ duration: 700, ease: Ease.inOutCubic, onUpdate: (k) => out.push(k) });
      [100, 350, 700].forEach((ms) => t.update(ms));
      return out;
    };
    expect(run()).toEqual(run());
  });
});

describe('TimelineParser — the voiceover is the master clock', () => {
  const tl = new TimelineParser({
    meta: { duration: 5 },
    words: [...words('The NIC writes the packet'), ...words('Same flow, same queue.', 3)],
    sentences: [{ start: 0, end: 2.4 }, { start: 3, end: 4.9 }],
  });

  it('finds a phrase at the moment it is spoken', () => {
    expect(tl.wordTime('the packet')).toBe(1.5);
    expect(tl.wordTime('same', { after: 3.4 })).toBe(4);
  });

  it('ignores punctuation and case', () => {
    expect(tl.wordTime('FLOW')).toBe(3.5);
  });

  it('refuses to guess when a phrase is not spoken', () => {
    expect(() => tl.wordTime('hugepage')).toThrow(/not found/);
  });

  it('reads the real NIC transcript, which is the same schema the Python engine reads', () => {
    const path = fileURLToPath(new URL('../../../episodes/s01e03-what-is-a-nic/timeline/words.json', import.meta.url));
    const nic = new TimelineParser(JSON.parse(fs.readFileSync(path, 'utf8')));
    expect(nic.duration).toBeCloseTo(717.99, 2);
    expect(nic.sentenceStart(64)).toBeGreaterThan(380);
    expect(nic.wordTime('RSS', { after: 385 })).toBeCloseTo(389.15, 1);
  });
});

describe('ComponentRegistry — the contract every model is built against', () => {
  it('resolves named anchors into world space', () => {
    const registry = new ComponentRegistry();
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    object.position.set(10, 0, 0);
    registry.register({ id: 'port', object, anchors: { in: new THREE.Vector3(0, 1, 0) } });
    expect(registry.anchorWorld('port', 'in').toArray()).toEqual([10, 1, 0]);
    expect(registry.idFromObject(object)).toBe('port');
  });

  it('refuses a duplicate id', () => {
    const registry = new ComponentRegistry();
    registry.register({ id: 'phy', object: new THREE.Group() });
    expect(() => registry.register({ id: 'phy', object: new THREE.Group() })).toThrow(/already registered/);
  });
});

describe('networking/dataplane — where a packet is, independent of any model', () => {
  it('RX and TX are the same road in opposite directions', () => {
    expect([...TX_PATH].reverse().filter((s) => s !== 'tx-queue')).toEqual(RX_PATH.filter((s) => s !== 'rx-queue'));
  });

  it('every stage on a path is defined', () => {
    [...RX_PATH, ...TX_PATH].forEach((s) => expect(STAGES[s], s).toBeDefined());
  });

  it('a hardware route keeps only on-card stops, on the requested port', () => {
    const route = hardwareRoute(RX_PATH, { port: 2 });
    expect(route[0]).toEqual({ id: 'rj45-2' });
    expect(route).toContainEqual({ id: 'nic-controller', anchor: 'dma' });
    expect(route.at(-1)).toEqual({ id: 'rx-queue' });
  });

  it('knows what comes before and after a part', () => {
    const n = neighbors('phy');
    expect(n.prev.key).toBe('magnetics');
    expect(n.next.key).toBe('controller');
  });
});
