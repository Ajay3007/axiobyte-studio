// s01e02, the opening (sentences 0–4): the library analogy — a truck carrying the same crates from
// building to building — before any hardware, then the marked crate opening into bytes that fly into
// the real NIC's port. Built for real, as the film builds it; no browser, no WebGL.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import words from '../../../episodes/s01e02-zero-copy/timeline/words.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '../../..');
const EPISODE = path.join(REPO, 'episodes/s01e02-zero-copy');
const ANALOGY = fs.readFileSync(path.join(EPISODE, 'three/analogy.js'), 'utf8');

let timeline;
let registry;
let stage;
let story;
let createNIC;

async function build() {
  const scene = new THREE.Scene();
  const reg = new ComponentRegistry();
  const { createNicScene } = await import('../src/domains/networking/nic/scene.js');
  createNicScene({ engine: { scene, aspect: 16 / 9 }, registry: reg, camera: { definePreset() {}, addResolver() {} } });
  scene.updateMatrixWorld(true);
  const { createZeroCopyStage } = await import('../../../episodes/s01e02-zero-copy/three/stage.js');
  const st = createZeroCopyStage({ engine: { scene }, registry: reg });
  const { buildStoryboard } = await import('../../../episodes/s01e02-zero-copy/three/storyboard.js');
  const sb = buildStoryboard({ timeline: new TimelineParser(words), registry: reg });
  return { registry: reg, stage: st, story: sb };
}

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  ({ createNIC } = await import('../src/domains/networking/nic/NIC.js'));
  timeline = new TimelineParser(words);
  ({ registry, stage, story } = await build());
});

const S = (i) => timeline.sentenceStart(i);
const E = (i) => timeline.sentenceEnd(i);
const at = (t) => {
  stage.update(t, story.lanes);
  stage.root.updateWorldMatrix(true, true);
  stage.nicHolder.updateWorldMatrix(true, true);
};
const worldOf = (o) => o.getWorldPosition(new THREE.Vector3());
const shown = (o) => {
  for (let v = o; v; v = v.parent) if (!v.visible) return false;
  return true;
};
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

describe('s01e02 opening — sentences 0–4 are the library analogy', () => {
  it('1. schedules every analogy beat inside sentences 0–4, each on its spoken word', () => {
    const A = story.lanes.analogy;
    const times = [A.enter.from, A.enter.to, A.single, A.load1, A.drive1, A.unload1, A.load2, A.drive2, A.unload2, A.focus, A.toBytes.from, A.toBytes.to, A.dissolve.from, A.dissolve.to, A.nicRise.from, A.nicRise.to, A.cells.from, A.cells.to];
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(S(0));
      expect(t).toBeLessThanOrEqual(E(4));
    }
    expect(A.load1).toBe(timeline.wordTime('pack', { after: S(1) - 0.01 }));
    expect(A.unload1).toBe(timeline.wordTime('unload', { after: S(1) - 0.01 }));
    expect(A.toBytes.from).toBeGreaterThanOrEqual(S(3) - 0.3);
    expect(A.dissolve.from).toBeGreaterThanOrEqual(S(4));
  });

  it('frames the analogy — not hardware — for every camera shot before sentence 4', () => {
    for (const shot of story.shots.filter((s) => s.at < S(4))) {
      const box = shot.view.box;
      expect(box.intersectsBox(registry.worldBox('e02.analogy.scene')), `shot at ${shot.at}`).toBe(true);
    }
  });

  it('puts no label on screen during the analogy: the picture carries it', () => {
    for (const cue of story.cues) {
      if (cue.id === 'vignette') continue;
      expect(cue.start, cue.id).toBeGreaterThanOrEqual(S(4));
    }
  });
});

describe('s01e02 opening — the truck and the crates are the episode’s own', () => {
  it('2. keeps all of the analogy in the episode: e02-named, presentation-only, nowhere in the library or the concepts', () => {
    stage.analogy.group.traverse((o) => {
      if (o.name) expect(o.name, o.name).toMatch(/^e02[-.]/);
    });
    for (const id of Object.keys(stage.analogy.markers)) expect(registry.get(id).meta.presentation).toBe(true);
    // The registry's asset ids: its top-level `  - id:` entries.
    const ids = [...fs.readFileSync(path.join(REPO, 'assets/library.yaml'), 'utf8').matchAll(/^ {2}- id: ([a-z_]+)$/gm)].map((m) => m[1]);
    // 7. no new global asset.
    expect(ids).toEqual(['nic', 'pcie', 'cpu', 'host_memory', 'descriptor_ring', 'mbuf', 'packet_buffer', 'mempool']);
    const concepts = fs.readdirSync(path.join(REPO, 'src/axiobyte_studio/concepts/library/atomic'));
    expect(concepts.some((f) => /truck|cargo|crate|package|library/.test(f))).toBe(false);
    expect(fs.existsSync(path.join(REPO, 'renderers/three/src/domains/transport'))).toBe(false);
  });

  it('builds a recognisable truck (cab, bed, wheels) and eight crates, one of them marked', () => {
    const names = [];
    stage.analogy.group.traverse((o) => names.push(o.name));
    for (const n of ['e02-analogy-truck-cab', 'e02-analogy-truck-bed', 'e02-analogy-truck-windscreen', 'e02-analogy-road']) expect(names).toContain(n);
    expect(names.filter((n) => n === 'e02-analogy-truck-wheel')).toHaveLength(6);
    expect(stage.analogy.crates).toHaveLength(8);
    expect(names.filter((n) => n === 'e02-analogy-crate-marked')).toHaveLength(1);
  });
});

describe('s01e02 opening — the NIC is the reveal, not the opening subject', () => {
  it('3. hides the NIC — and every host-side asset — while the analogy plays', () => {
    for (const t of [0, 2, 5, 8, 11, 13, 15, 17, S(4) + 0.5]) {
      at(t);
      expect(stage.nicHolder.visible, `NIC at ${t}`).toBe(false);
      for (const k of ['cpu', 'buffer_a', 'buffer_b', 'mbuf', 'pool']) expect(stage.instances[k].holder.visible, `${k} at ${t}`).toBe(false);
      expect(shown(stage.analogy.truck), `truck at ${t}`).toBe(true);
    }
  });

  it('4. raises the NIC only during the transition, after the analogy has folded away', () => {
    const A = story.lanes.analogy;
    expect(A.nicRise.from).toBeGreaterThan(A.dissolve.from);
    expect(A.nicRise.from).toBeGreaterThan(S(4));
    at(A.nicRise.to + 0.2);
    expect(stage.nicHolder.visible).toBe(true);
    expect(stage.nicHolder.position.y).toBeCloseTo(0, 9);
    at(A.dissolve.to + 0.1);
    expect(shown(stage.analogy.truck)).toBe(false);
  });

  it('6. reuses the existing NIC asset: the real card, as its own scene places it', () => {
    for (const id of createNIC().components.map((c) => c.id)) expect(registry.has(id), id).toBe(true);
    expect(ANALOGY).not.toMatch(/domains\/networking\/nic/);
  });
});

describe('s01e02 opening — cargo becomes bytes becomes the packet', () => {
  it('5. opens the marked crate into six byte cells — the packet’s own arrangement — and lands them at the port', () => {
    const A = story.lanes.analogy;
    at(A.toBytes.from - 0.1);
    expect(shown(stage.analogy.marked)).toBe(true);
    expect(shown(stage.analogy.cells)).toBe(false);
    at(A.toBytes.to);
    expect(shown(stage.analogy.cells)).toBe(true);
    expect(worldOf(stage.analogy.cells).distanceTo(stage.analogy.markedRest)).toBeLessThan(1.2);
    // Same shape as the film's packet token, so the hand-over is seamless.
    const cells = stage.analogy.cells.children.filter((c) => c.isMesh).map((c) => c.position.toArray());
    const token = stage.carriers.packet.children.filter((c) => c.isMesh).map((c) => c.position.toArray());
    expect(cells).toEqual(token);
    // At the hand-over the bytes are at the NIC's port, exactly where the packet token starts.
    at(A.cells.to - 1e-3);
    const port = stage.trails && worldOf(stage.analogy.cells);
    at(story.lanes.arrival.from + 1e-3);
    expect(shown(stage.analogy.cells)).toBe(false);
    expect(stage.carriers.packet.visible).toBe(true);
    expect(worldOf(stage.carriers.packet).distanceTo(port)).toBeLessThan(0.05);
  });
});

describe('s01e02 opening — nothing protected moved, and the scene stays pure', () => {
  it('8–9. leaves the voiceover and its timing untouched', () => {
    expect(sha(path.join(EPISODE, 'timeline/words.json'))).toBe('e8a05f4be6071274b2a0c3a3ca8cf8435e48512a37fe4a9c9879cc08dc42132e');
    const timelineJson = path.join(EPISODE, 'timeline.json');
    if (fs.existsSync(timelineJson)) expect(sha(timelineJson)).toBe(sha(path.join(EPISODE, 'timeline/words.json')));
    const voiceover = path.join(EPISODE, 'voiceover.mp3');
    if (fs.existsSync(voiceover)) expect(sha(voiceover)).toBe('b5d66919c8bd45a31c32aaa242ac1d4ceac3e0eaf566b440dc527d4e4024caa1');
  });

  it('10–11. is deterministic and seek-pure: a rebuilt world gives the same frames, in any order', async () => {
    const again = await build();
    const snap = (st, t) => {
      st.update(t, story.lanes);
      const out = [st.nicHolder.visible, ...st.nicHolder.position.toArray().map((v) => v.toFixed(6))];
      st.analogy.group.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6)), ...o.scale.toArray().map((v) => v.toFixed(6))]));
      return out;
    };
    const times = [0.5, 4, 6, 7.5, 9, 10.5, 12, 15, 16.8, 18.5, 19.5, 21, 22.5];
    for (const t of times) expect(snap(again.stage, t)).toEqual(snap(stage, t));
    const forward = snap(stage, 9);
    snap(stage, 21);
    snap(stage, 2);
    expect(snap(stage, 9)).toEqual(forward);
  });

  it('12. adds no DOM or UI dependency to the scene', () => {
    expect(ANALOGY).not.toMatch(/\bdocument\.|\bwindow\.|getElementById|addEventListener|innerHTML/);
  });
});
