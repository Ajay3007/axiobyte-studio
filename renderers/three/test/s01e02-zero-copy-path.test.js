// s01e02, milestone 2 (sentences 17–46): zero copy — THE BUFFER STAYS, THE BYTES STAY, THE HANDLE
// MOVES. Built for real: the NIC as the film places it, the episode's stage with the real CPU,
// packet buffers, mbuf and Mempool, and the storyboard against the immutable voiceover.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import words from '../../../episodes/s01e02-zero-copy/timeline/words.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';
import { FIRST, bufferRect, elementRect, mbufRect } from '../src/domains/memory/mempool/layout.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EPISODE = path.join(HERE, '../../../episodes/s01e02-zero-copy');
const SOURCES = ['stage.js', 'act2.js', 'scene.js', 'storyboard.js', 'video-main.js'].map((f) => fs.readFileSync(path.join(EPISODE, 'three', f), 'utf8')).join('\n');

const RED = new THREE.Color('#ff5c55');
const BLUE = new THREE.Color('#4aa8ff');
const YELLOW = new THREE.Color('#f5d14f');
const CYAN = new THREE.Color('#34d8e8');
const sameHue = (c, hue) => {
  const n = (x) => {
    const s = x.r + x.g + x.b || 1;
    return [x.r / s, x.g / s, x.b / s];
  };
  const [a, b] = [n(c), n(hue)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.03;
};

let timeline;
let registry;
let stage;
let story;

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
  timeline = new TimelineParser(words);
  ({ registry, stage, story } = await build());
});

const S = (i) => timeline.sentenceStart(i);
const E = (i) => timeline.sentenceEnd(i);
const at = (t) => {
  stage.update(t, story.lanes);
  stage.root.updateWorldMatrix(true, true);
};
const worldOf = (o) => o.getWorldPosition(new THREE.Vector3());
/** Every visible object's world position at t, by its path in the scene graph. */
const positions = (t) => {
  at(t);
  const out = new Map();
  const walk = (o, p) => {
    const key = `${p}/${o.name}#${o.parent ? o.parent.children.indexOf(o) : 0}`;
    // An unnamed piece (a glow, a cell) answers to the named object it belongs to.
    if (o.visible) out.set(key, { name: o.name || o.parent?.name, p: worldOf(o) });
    o.children.forEach((c) => walk(c, key));
  };
  walk(stage.root, '');
  return out;
};
/** The objects whose world position changed between two moments (both visible at both). */
const movedBetween = (t1, t2, mutate = null) => {
  const a = positions(t1);
  const b = positions(t2);
  if (mutate) {
    mutate();
    stage.root.updateWorldMatrix(true, true);
    for (const [k, v] of b) v.p = null;
    const fresh = new Map();
    const walk = (o, p) => {
      const key = `${p}/${o.name}#${o.parent ? o.parent.children.indexOf(o) : 0}`;
      if (o.visible) fresh.set(key, { name: o.name || o.parent?.name, p: worldOf(o) });
      o.children.forEach((c) => walk(c, key));
    };
    walk(stage.root, '');
    for (const [k, v] of fresh) b.set(k, v);
  }
  const moved = new Set();
  for (const [k, v] of a) {
    const w = b.get(k);
    if (w?.p && v.p.distanceTo(w.p) > 1e-6) moved.add(v.name || k);
  }
  return [...moved];
};
const visibleRed = (t) => {
  at(t);
  const red = [];
  stage.root.traverse((o) => {
    let v = o;
    while (v) {
      if (!v.visible) return;
      v = v.parent;
    }
    const m = o.material;
    if (!m || (m.opacity != null && m.transparent && m.opacity < 0.02)) return;
    if ([m.color, m.emissive].some((c) => c && c.r + c.g + c.b > 0.05 && sameHue(c, RED))) red.push(o.name);
  });
  return red;
};

// ---------------------------------------------------------------------------------- coverage

describe('s01e02 — every sentence is scored, on the voiceover', () => {
  it('gives each of the 47 sentences at least one visual beat starting inside it', () => {
    const events = [...story.shots.map((s) => s.at), ...story.cues.map((c) => c.start)];
    const walk = (v) => {
      if (typeof v === 'number') events.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(story.lanes);
    const bare = [];
    for (let i = 0; i < 47; i++) if (!events.some((t) => t >= S(i) - 0.6 && t <= E(i))) bare.push(i);
    expect(bare).toEqual([]);
  });

  it('runs the whole voiceover and puts the zero-copy beats on their words', () => {
    expect(story.end).toBe(E(46));
    const L = story.lanes;
    expect(L.act2).toBe(S(17));
    expect(L.zdma.from).toBeGreaterThanOrEqual(S(21));
    expect(L.zdma.to).toBeLessThanOrEqual(E(21));
    L.stage.forEach((t, i) => {
      expect(t).toBeGreaterThanOrEqual(S(24 + i));
      expect(t).toBeLessThanOrEqual(E(24 + i));
    });
    expect(L.edit.from).toBeGreaterThanOrEqual(S(30));
    expect(L.transmit.from).toBeGreaterThanOrEqual(S(40));
  });
});

// ---------------------------------------------------------------------------------- the mempool

describe('s01e02 — the Mempool and one representative element', () => {
  it('1. uses the real Mempool asset, registered as the pool’s one part', () => {
    expect(stage.act2.pool.root.name).toBe('mempool');
    expect(registry.has('pool.elements')).toBe(true);
    expect(SOURCES).toMatch(/from '@axiobyte\/three\/domains\/memory\/mempool\/Mempool\.js'/);
  });

  it('2. marks exactly one element: an outline on the pool’s first tile, and one on its enlargement', () => {
    const names = stage.act2.rep.children.map((c) => c.name).sort();
    expect(names).toEqual(['e02-representative-enlarged', 'e02-representative-ray', 'e02-representative-ray', 'e02-representative-tile']);
    const tile = new THREE.Box3().setFromObject(stage.act2.rep.children.find((c) => c.name === 'e02-representative-tile'));
    const r = elementRect(FIRST);
    const holder = stage.instances.pool.holder;
    holder.updateWorldMatrix(true, false);
    const centre = new THREE.Vector3((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2).applyMatrix4(holder.matrixWorld);
    expect(Math.abs(tile.getCenter(new THREE.Vector3()).x - centre.x)).toBeLessThan(0.1);
  });

  it('3. says it is illustrative — one element, shown enlarged — and shows it only as long as needed', () => {
    const cue = story.cues.find((c) => c.id === 'callout:ONE REPRESENTATIVE ELEMENT');
    expect(cue).toBeTruthy();
    expect(story.lanes.representative.from).toBeGreaterThanOrEqual(S(19));
    expect(story.lanes.representative.to).toBeLessThanOrEqual(E(41));
    at(E(42) + 1);
    expect(stage.act2.rep.children.every((c) => !c.visible)).toBe(true);
  });

  it('shows no runtime state anywhere: no free, in-use, returned, allocated or released', () => {
    const titles = story.cues.map((c) => c.id).join(' ');
    expect(titles).not.toMatch(/\b(FREE|IN USE|RETURNED|ALLOCATED|RELEASED)\b/);
    stage.root.traverse((o) => expect(o.name).not.toMatch(/free|in-use|returned|released|allocated/i));
  });
});

// ---------------------------------------------------------------------------------- dma into the buffer

describe('s01e02 — the NIC’s DMA writes the BUFFER, with no CPU', () => {
  it('4–5. ends the zero-copy DMA on buffer A’s dma_target — the element’s BUFFER — never the mbuf or the pool', () => {
    const end = stage.trails.dma.curve.getPoint(1);
    expect(end.distanceTo(registry.anchorWorld('buffer_a.payload', 'dma_target'))).toBeLessThan(1e-6);
    for (const id of ['mbuf.fields', 'pool.elements']) expect(registry.worldBox(id).containsPoint(end), id).toBe(false);
    // In the pool, the lit half is the element's BUFFER half, not its MBUF half.
    const half = stage.act2.bufferHalf.position;
    const holder = stage.instances.pool.holder;
    const local = holder.worldToLocal(half.clone());
    const b = bufferRect(FIRST);
    const m = mbufRect(FIRST);
    expect(local.x).toBeGreaterThan(b.x0);
    expect(local.x).toBeLessThan(b.x1);
    expect(local.x).toBeGreaterThan(m.x1);
  });

  it('6. involves no CPU: no copy carrier, copy trail or CPU glow while the DMA runs, and its bytes land', () => {
    const L = story.lanes;
    for (const t of [L.zdma.from + 0.2, (L.zdma.from + L.zdma.to) / 2, L.zdma.to + 0.5, (S(22) + E(22)) / 2]) {
      at(t);
      expect(stage.cpuPulse.visible, `halo at ${t}`).toBe(false);
      expect(stage.carriers.carrier1.visible || stage.carriers.carrier2.visible).toBe(false);
      expect(stage.trails.copy1.mesh.visible || stage.trails.copy2.mesh.visible).toBe(false);
    }
    at(L.zdma.to + 1.5);
    expect(stage.bytes.buffer_a.every((m) => m.visible)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------- the invariant

describe('s01e02 — THE BUFFER STAYS, THE BYTES STAY, THE HANDLE MOVES', () => {
  const stageTimes = () => story.lanes.stage.map((t) => t + 0.6);

  it('7–8. keeps buffer A and every one of its bytes exactly where the DMA put them, to the end', () => {
    const A = stage.instances.buffer_a;
    const ref = positions(story.lanes.zdma.to + 1.5);
    const bytes = stage.bytes.buffer_a;
    const where = () => [worldOf(A.holder), ...bytes.map(worldOf)];
    const base = where();
    for (const t of [...stageTimes(), S(29), story.lanes.edit.to + 1, S(33), S(37) + 3, story.lanes.transmit.to, E(46)]) {
      at(t);
      where().forEach((p, i) => expect(p.distanceTo(base[i]), `t=${t} #${i}`).toBeLessThan(1e-9));
    }
    expect(ref.size).toBeGreaterThan(0);
  });

  it('9. moves only the handle (and its line) from stage to stage', () => {
    const [p, c, f, r] = stageTimes();
    for (const [a, b] of [
      [p, c],
      [c, f],
      [f, r],
    ]) {
      const moved = movedBetween(a, b);
      expect(moved.length).toBeGreaterThan(0);
      for (const name of moved) expect(name, name).toMatch(/^e02-handle/);
    }
  });

  it('MUTATION: a buffer moved between parser and classifier would be caught', () => {
    const [p, c] = stageTimes();
    const holder = stage.instances.buffer_a.holder;
    const moved = movedBetween(p, c, () => holder.position.x += 1);
    holder.position.x -= 1;
    expect(moved.some((n) => !/^e02-handle/.test(n))).toBe(true);
  });

  it('MUTATION: packet bytes travelling between stages would be caught', () => {
    const [p, c] = stageTimes();
    const byte = stage.bytes.buffer_a[0];
    const moved = movedBetween(p, c, () => byte.position.z += 0.5);
    byte.position.z -= 0.5;
    expect(moved).toContain('packet-buffer-header-byte');
  });

  it('10. draws the handle in the pointer’s yellow, never the mbuf’s cyan', () => {
    const chip = stage.act2.handle.getObjectByName('e02-handle-chip');
    expect(sameHue(chip.material.color, YELLOW)).toBe(true);
    expect(sameHue(chip.material.color, CYAN)).toBe(false);
    expect(sameHue(chip.material.emissive, CYAN)).toBe(false);
  });

  it('11. keeps the four stages episode-local: named e02, presentation only, no asset domain', () => {
    expect(stage.act2.stages.map((s) => s.group.name)).toEqual(['e02-stage-parser', 'e02-stage-classifier', 'e02-stage-firewall', 'e02-stage-routing']);
    for (const s of stage.act2.stages) expect(registry.get(`e02.stage.${s.name}`).meta.presentation).toBe(true);
    expect(SOURCES).not.toMatch(/domains\/[a-z-]+\/(parser|classifier|firewall|routing)/);
  });

  it('12. lights a stage only while the handle is at it — nothing stays lit once it leaves', () => {
    const lit = () => stage.act2.stages.filter((s) => s.lit.visible).map((s) => s.name);
    story.lanes.stage.forEach((t, i) => {
      at(t + 0.6);
      expect(lit()).toEqual([stage.act2.stages[i].name]);
    });
    at(story.lanes.stage[3] + 0.2); // mid-hop: no stage lit
    expect(lit()).toEqual([]);
  });

  it('13. leaves the mbuf as metadata: still, and nothing of it in the packet’s colour', () => {
    const before = worldOf(stage.instances.mbuf.holder);
    for (const t of stageTimes()) {
      at(t);
      expect(worldOf(stage.instances.mbuf.holder).distanceTo(before)).toBeLessThan(1e-9);
    }
    stage.instances.mbuf.asset.root.traverse((o) => {
      if (o.material?.color) expect(sameHue(o.material.color, BLUE), o.name).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------------- in place

describe('s01e02 — the header is edited in place', () => {
  it('14–15. recolours buffer A’s own header cells: the same meshes, the same places, no new buffer', () => {
    const cells = stage.instances.buffer_a.asset.header.cells;
    expect(stage.act2.headerCells).toBe(cells);
    const L = story.lanes;
    at(L.edit.from - 0.5);
    const before = cells.map((c) => ({ color: c.material.color.clone(), p: worldOf(c) }));
    at(L.edit.to + 1);
    cells.forEach((c, i) => {
      expect(worldOf(c).distanceTo(before[i].p)).toBeLessThan(1e-9);
      const changed = !c.material.color.equals(before[i].color);
      expect(changed, `cell ${i}`).toBe(stage.act2.EDITED.includes(i));
    });
    // No buffer appears: the two packet buffers are the first half's A and B, and B is gone.
    let buffers = 0;
    stage.root.traverse((o) => (buffers += o.name === 'packet-buffer' ? 1 : 0));
    expect(buffers).toBe(2);
    expect(stage.instances.buffer_b.holder.visible).toBe(false);
  });

  it('16. shows no red anywhere in the zero-copy half', () => {
    for (const t of [S(17) + 2, S(21) + 3, S(22) + 1, ...story.lanes.stage, story.lanes.edit.to, S(36) + 2, S(38) + 2, story.lanes.transmit.from + 1, S(45) + 2]) {
      expect(visibleRed(t), `t=${t}`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------------- transmit, payoff

describe('s01e02 — transmit from the same buffer, and the payoff', () => {
  it('17. reads buffer A for transmit: the DMA read starts at its read anchor and ends at the NIC’s port', () => {
    const c = stage.act2.tx.curve;
    expect(c.getPoint(0).distanceTo(registry.anchorWorld('buffer_a.payload', 'read'))).toBeLessThan(1e-6);
    expect(c.getPoint(1).distanceTo(registry.anchorWorld('rj45-1', 'in'))).toBeLessThan(0.6);
    expect(sameHue(stage.act2.tx.mesh.material.color, RED)).toBe(false);
  });

  it('18–20. no descriptor ring, no host memory, no SmartNIC', () => {
    const ids = registry.all().map((e) => e.id);
    expect(ids.some((id) => /ring|descriptor|memory\.|host/.test(id))).toBe(false);
    expect(SOURCES).not.toMatch(/descriptor-ring|host-memory|compositions\/nic_host/);
    expect(SOURCES).not.toMatch(/smart\s*nic/i);
    expect(story.cues.map((c) => c.id).join(' ')).not.toMatch(/smart\s*nic/i);
  });

  it('21. ends on the same buffer A: the handle’s line lands on its header, its bytes in place', () => {
    at(E(46));
    const tip = stage.root.getObjectByName('e02-handle-line-tip');
    expect(tip.visible).toBe(true);
    const header = registry.anchorWorld('buffer_a.header', 'header');
    expect(Math.hypot(tip.position.x - header.x, tip.position.z - header.z)).toBeLessThan(0.3);
    expect(stage.bytes.buffer_a.every((m) => m.visible)).toBe(true);
    const payoff = story.cues.find((c) => c.id === 'callout:A PACKET IS A POINTER TO ITS BYTES');
    expect(payoff.end).toBeGreaterThanOrEqual(story.audioEnd);
  });

  it('22. is deterministic: a rebuilt world gives the same frames, seeking any way', async () => {
    const again = await build();
    const snap = (st, t) => {
      st.update(t, story.lanes);
      const out = [];
      st.root.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6))]));
      return out;
    };
    for (const t of [75, 92, 100, 110.5, 117, 131, 150, 160, 188, 210, 217]) expect(snap(again.stage, t)).toEqual(snap(stage, t));
    const forward = snap(stage, 131);
    snap(stage, 200);
    expect(snap(stage, 131)).toEqual(forward);
  });
});
