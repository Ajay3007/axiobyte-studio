// s01e03's receive path, host side (shots 0114 and 0116, sentences 68–88), filmed on the nic_host
// system: the storyboard built for real against the card and the nic_host video stage, as the film
// builds it — no browser, no WebGL. The voiceover is the clock; this checks the visuals follow it.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import words from '../../../episodes/s01e03-what-is-a-nic/timeline/timeline.json';
import CONTRACT from '../src/compositions/nic_host/contract.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let story;
let stage;
let timeline;
let registry;

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  const { createNIC } = await import('../src/domains/networking/nic/NIC.js');
  const { createNicHostVideoStage } = await import('../src/compositions/nic_host/video.js');
  const { buildStoryboard } = await import('../../../episodes/s01e03-what-is-a-nic/three/storyboard.js');
  // The film's world, as far as the score needs it: the card and the nic_host stage in one registry.
  const scene = new THREE.Scene();
  registry = new ComponentRegistry();
  const nic = createNIC();
  scene.add(nic.root);
  nic.components.forEach((c) => registry.register(c));
  stage = createNicHostVideoStage({ engine: { scene }, registry });
  timeline = new TimelineParser(words);
  story = buildStoryboard({ timeline, registry });
});

// Where a shot's cut falls: in the silence before the sentence that carries its first beat
// (src/axiobyte_studio/storyboard/windows.py). 0114 opens on sentence 68, 0116 on 77, 0120 on 89.
const cutBefore = (i) => (timeline.sentenceEnd(i - 1) + timeline.sentenceStart(i)) / 2;

describe('s01e03 receive path — the voiceover is the clock', () => {
  it('builds against the immutable voiceover: every anchor resolves in it', () => {
    expect(words.meta.duration).toBe(717.99);
    expect(words.sentences).toHaveLength(119);
    expect(words.words).toHaveLength(1852);
    expect(story.audioEnd).toBeCloseTo(717.99, 2);
  });

  it('shows the nic_host system exactly over shots 0114 and 0116: from the cut before 68 to the cut before 89', () => {
    expect(story.host.windows).toEqual([{ from: cutBefore(68), to: cutBefore(89) }]);
    const [{ from, to }] = story.host.windows;
    expect(cutBefore(77)).toBeGreaterThan(from); // the cut between 0114 and 0116 is inside
    expect(cutBefore(77)).toBeLessThan(to);
    for (const i of [68, 70, 74, 77, 80, 85, 88]) expect(stage.update(timeline.sentenceStart(i), story.host)).toBe(true);
    for (const t of [timeline.sentenceStart(67), timeline.sentenceStart(89), 0, 700]) expect(stage.update(t, story.host)).toBe(false);
  });
});

describe('s01e03 receive path — 0114 and 0116 film the system, the rest films the card', () => {
  it('cuts in and out: the window holds five camera shots of the system, entered and left without a blend', () => {
    const [{ from, to }] = story.host.windows;
    const inside = story.shots.filter((s) => s.at >= from && s.at < to);
    expect(inside.map((s) => s.label)).toEqual(['host-dma', 'host-pcie', 'host-ring', 'host-poll', 'host-pool']);
    expect(inside[0]).toMatchObject({ at: from, transition: 0 });
    const next = story.shots.find((s) => s.at >= to);
    expect(next).toMatchObject({ label: 'tx-queues', at: to, transition: 0 });
    // No system shot outside the window, and the card's shots keep their names.
    expect(story.shots.filter((s) => (s.at < from || s.at >= to) && /^host-/.test(s.label))).toEqual([]);
  });

  it('frames the system’s parts inside the window and only the card’s outside it', () => {
    const [{ from, to }] = story.host.windows;
    const system = (id) => /^(nic|pcie|cpu|memory|rx_ring|pool|route|interaction)(\.|$)/.test(id);
    for (const h of story.highlights) {
      const inWindow = h.from >= from && h.to <= to;
      expect(system(h.id), `${h.id} ${h.from.toFixed(1)}–${h.to.toFixed(1)}`).toBe(inWindow);
    }
    // The card's packet token is gone before the cut; the system's own DMA flow carries on.
    expect(story.flights.find((f) => f.route === 'rx').end).toBeLessThanOrEqual(from);
    for (const d of story.host.dma) expect(d.from >= from && d.to <= to).toBe(true);
    for (const o of story.host.outlines) expect(o.from >= from && o.to <= to).toBe(true);
  });

  it('draws none of the old receive-path widgets: no stateful ring, no host frame, no HOST RAM box', () => {
    const ids = story.cues.map((c) => c.id);
    expect(ids).not.toContain('descriptor-ring');
    expect(ids).not.toContain('dma');
    expect(ids.filter((id) => id.startsWith('host-frame'))).toEqual([]);
    const src = fs.readFileSync(path.join(HERE, '../../../episodes/s01e03-what-is-a-nic/three/storyboard.js'), 'utf8');
    expect(src).not.toMatch(/descriptorRing\(|dmaDiagram\(|hostFrame\(|slots: 16|DMA WRITING|pre-allocated mbufs/);
    // The poll-mode driver stays an overlay — without its own mempool panel: the pool is the system's.
    expect(src).toMatch(/dpdkDiagram\(\{[^}]*?pool: false/s);
  });

  it('leaks nothing into shot 0120: every overlay begun in the window ends at its cut', () => {
    const [{ from, to }] = story.host.windows;
    const begun = story.cues.filter((c) => c.start >= from && c.start < to);
    // The next chapter's title is announced over the last second of the window, as it always was.
    const leaking = begun.filter((c) => c.end > to && c.id !== 'section-title:HOW A PACKET IS TRANSMITTED');
    expect(leaking.map((c) => c.id)).toEqual([]);
    // Once the window is over the stage is gone: nothing of the system, no DMA, no outline.
    stage.update(to + 0.01, story.host);
    expect(stage.holder.visible).toBe(false);
    expect(stage.outlinesShown()).toEqual([]);
  });

  it('explains the pool element half by half, with the illustrative pairing disclosed', () => {
    const cue = (title) => story.cues.find((c) => c.id === `callout:${title}`);
    const [buffer, mbuf, pool] = ['BUFFER', 'MBUF', 'MEMPOOL'].map(cue);
    expect(buffer && mbuf && pool).toBeTruthy();
    // The mbuf stays up beside the pool long enough to read, not a one-second flash.
    expect(mbuf.end - mbuf.start).toBeGreaterThan(3);
    expect(mbuf.end).toBe(pool.end);
    const note = story.cues.find((c) => c.id.startsWith('chips:ILLUSTRATIVE'));
    expect(note).toBeTruthy();
    for (const o of story.host.outlines.filter((x) => ['slot', 'buffer', 'mbuf', 'element'].includes(x.name))) {
      expect(note.start).toBeLessThanOrEqual(o.from);
      expect(note.end).toBeGreaterThanOrEqual(o.to - 0.6);
    }
  });

  it('leaves the semantics as declared: DMA to the packet-buffer region, four kinds of relationship', () => {
    expect(stage.system.contract).toEqual(CONTRACT);
    expect(Object.keys(CONTRACT).filter((k) => ['connections', 'residence', 'references', 'interactions'].includes(k))).toHaveLength(4);
    expect(CONTRACT.interactions.map((i) => [i.from, i.to])).toEqual([['nic', 'memory.packet-buffer-region']]);
    expect(CONTRACT.residence).toEqual({ rx_ring: 'memory.descriptor-region', pool: 'memory.packet-buffer-region' });
    expect(CONTRACT.references).toEqual([{ from: 'rx_ring.descriptors', to: 'memory.packet-buffer-region' }]);
  });

  it('leaves the film’s scene cleanly: disposing the stage takes the system out of the world', () => {
    const scene = new THREE.Scene();
    const other = new (registry.constructor)();
    return import('../src/compositions/nic_host/video.js').then(({ createNicHostVideoStage }) => {
      const s = createNicHostVideoStage({ engine: { scene }, registry: other });
      expect(scene.getObjectByName('nic-host-video')).toBeTruthy();
      s.dispose();
      expect(scene.getObjectByName('nic-host-video')).toBeUndefined();
    });
  });
});
