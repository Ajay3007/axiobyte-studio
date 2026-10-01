// Host Memory asset: the layout's invariants, and the built model — no browser, no WebGL. Canvas
// textures are drawn into a stub context, so the real model builds here exactly as on the page.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { Highlighter } from '../src/core/Highlighter.js';
import { ADDRESS_ORDER, BUFFERS, DIMM, MAP, MODULES, POINTER_LANDING, POSTED, REGIONS, RING, STRIPS, bufferRect, keyNotch, slotRect } from '../src/domains/memory/host-memory/layout.js';
import { HOST_MEMORY_METADATA } from '../src/domains/memory/host-memory/metadata.js';
import { LOGICAL, MODES, MODE_OF, PHYSICAL, PICKABLE, createHostMemoryScene } from '../src/domains/memory/host-memory/scene.js';

const PARTS = [...PHYSICAL, ...LOGICAL];
const inside = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.z0 >= b.z0 && a.z1 <= b.z1;
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const MAP_RECT = { x0: 0, z0: 0, x1: MAP.w, z1: MAP.d };
const ALL_REGIONS = Object.values(REGIONS).flat();

let createHostMemory;
beforeAll(async () => {
  // A 2D context that accepts every drawing call: enough for canvasTexture() outside a browser.
  const context = () =>
    new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })), set: (t, k, v) => ((t[k] = v), true) });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: context }) };
  ({ createHostMemory } = await import('../src/domains/memory/host-memory/HostMemory.js'));
});

describe('host-memory — the address map is a clean, ordered layout', () => {
  it('keeps every region, strip and tile on the map, with no two overlapping', () => {
    for (const r of ALL_REGIONS) expect(inside(r, MAP_RECT)).toBe(true);
    for (let i = 0; i < ALL_REGIONS.length; i++) for (let j = i + 1; j < ALL_REGIONS.length; j++) expect(overlaps(ALL_REGIONS[i], ALL_REGIONS[j])).toBe(false);
    for (const s of Object.values(STRIPS)) for (const r of ALL_REGIONS) expect(s.z1 <= r.z0 || s.z0 >= r.z1).toBe(true);
  });

  it('lays the regions out along the address axis: other memory, the ring, the buffers, then free memory', () => {
    const rects = ADDRESS_ORDER.map(([id, i]) => REGIONS[id][i]);
    expect(rects).toHaveLength(ALL_REGIONS.length);
    for (let i = 1; i < rects.length; i++) expect(rects[i].x0).toBeGreaterThan(rects[i - 1].x1);
    expect(ADDRESS_ORDER.map(([id]) => id)).toEqual(['other-memory', 'descriptor-region', 'packet-buffer-region', 'other-memory']);
  });

  it('keeps every descriptor slot in the ring and every buffer in the buffer region', () => {
    const ring = REGIONS['descriptor-region'][0];
    const buffers = REGIONS['packet-buffer-region'][0];
    for (let i = 0; i < RING.slots; i++) expect(inside(slotRect(i), ring)).toBe(true);
    for (let j = 0; j < BUFFERS.cols * BUFFERS.rows; j++) expect(inside(bufferRect(j), buffers)).toBe(true);
    for (let i = 1; i < RING.slots; i++) expect(slotRect(i).z0).toBeGreaterThan(slotRect(i - 1).z1);
    expect(RING.head).not.toBe(RING.tail);
  });

  it('points each descriptor at its own buffer, leaving some free, with no two pointers crossing', () => {
    expect(POSTED).toHaveLength(RING.slots);
    expect(new Set(POSTED).size).toBe(POSTED.length);
    expect(POSTED.length).toBeLessThan(BUFFERS.cols * BUFFERS.rows);
    const seg = (i) => {
      const s = slotRect(i);
      const b = bufferRect(POSTED[i]);
      return [s.x1, (s.z0 + s.z1) / 2, b.x0, b.z0 + (b.z1 - b.z0) * POINTER_LANDING];
    };
    const cross = ([ax, ay, bx, by], [cx, cy, dx, dy]) => {
      const d = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
      return d(ax, ay, bx, by, cx, cy) * d(ax, ay, bx, by, dx, dy) < 0 && d(cx, cy, dx, dy, ax, ay) * d(cx, cy, dx, dy, bx, by) < 0;
    };
    for (let i = 0; i < RING.slots; i++) for (let j = i + 1; j < RING.slots; j++) expect(cross(seg(i), seg(j))).toBe(false);
  });

  it('keys each module off-centre and stands both behind the map, lifted clear of it', () => {
    const [k0, k1] = keyNotch();
    expect(k0).toBeGreaterThan(0);
    expect(k1).toBeLessThan(DIMM.L);
    expect(Math.abs((k0 + k1) / 2 - DIMM.L / 2)).toBeGreaterThan(0.05);
    for (const m of MODULES) expect(m.z + DIMM.T).toBeLessThan(MAP.z0);
    expect(DIMM.lift).toBeGreaterThan(0);
  });
});

describe('host-memory — the built model', () => {
  it('registers exactly the declared parts, each with metadata in the right layer', () => {
    const { components } = createHostMemory();
    expect(components.map((c) => c.id).sort()).toEqual([...PARTS].sort());
    for (const c of components) {
      expect(c.meta).toBe(HOST_MEMORY_METADATA[c.id]);
      expect(c.meta.name && c.meta.summary && c.meta.description).toBeTruthy();
      expect(c.anchors.center).toBeInstanceOf(THREE.Vector3);
    }
    for (const id of PHYSICAL) expect(HOST_MEMORY_METADATA[id].category).toMatch(/^Physical/);
    for (const id of LOGICAL) expect(HOST_MEMORY_METADATA[id].category).toMatch(/^Logical/);
  });

  it('puts memory_interface on each module’s contact edge — the lowest edge of the module, centred along it', () => {
    const { root, components } = createHostMemory();
    root.updateWorldMatrix(true, true);
    for (const id of PHYSICAL) {
      const c = components.find((x) => x.id === id);
      const edge = c.object.localToWorld(c.anchors.edge.clone());
      const box = new THREE.Box3().setFromObject(c.object);
      expect(Math.abs(edge.y - box.min.y)).toBeLessThan(0.02); // the board's bevel rounds the edge
      expect(edge.x).toBeCloseTo((box.min.x + box.max.x) / 2, 1);
    }
  });

  it('places the ring and buffer anchors inside their regions, and every region on the address-space plate', () => {
    const { root, components } = createHostMemory();
    root.updateWorldMatrix(true, true);
    const get = (id) => components.find((x) => x.id === id);
    const plate = new THREE.Box3().setFromObject(get('address-space').object);
    for (const id of ['descriptor-region', 'packet-buffer-region', 'other-memory']) {
      const box = new THREE.Box3().setFromObject(get(id).boundsObject ?? get(id).object);
      expect(box.min.x).toBeGreaterThanOrEqual(plate.min.x);
      expect(box.max.x).toBeLessThanOrEqual(plate.max.x);
      expect(box.min.z).toBeGreaterThanOrEqual(plate.min.z);
      expect(box.max.z).toBeLessThanOrEqual(plate.max.z);
    }
    const within = (id, anchor) => {
      const c = get(id);
      const p = c.object.localToWorld(c.anchors[anchor].clone());
      const box = new THREE.Box3().setFromObject(c.boundsObject ?? c.object);
      expect(p.x).toBeGreaterThanOrEqual(box.min.x);
      expect(p.x).toBeLessThanOrEqual(box.max.x);
      expect(p.z).toBeGreaterThanOrEqual(box.min.z);
      expect(p.z).toBeLessThanOrEqual(box.max.z);
    };
    within('descriptor-region', 'head');
    within('descriptor-region', 'tail');
    within('packet-buffer-region', 'buffer');
  });

  it('builds the same geometry every time', () => {
    const fingerprint = () => {
      const { root } = createHostMemory();
      root.updateWorldMatrix(true, true);
      let h = 0;
      root.traverse((o) => {
        if (!o.isMesh) return;
        h = (h * 31 + o.matrixWorld.elements.reduce((a, v) => a + v, 0)) % 1e9;
        const p = o.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 7) h = (h * 31 + p[i] * 1000) % 1e9;
        if (o.isInstancedMesh) for (const v of o.instanceMatrix.array) h = (h * 31 + v * 1000) % 1e9;
      });
      return h;
    };
    expect(fingerprint()).toBe(fingerprint());
  });

  it('owns every geometry through its kit, so dispose() releases all of it', () => {
    const { root, kit } = createHostMemory();
    const owned = new Set(kit.geometries.values());
    root.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh) expect(owned.has(o.geometry), o.name).toBe(true);
    });
  });

  it('folds the map away and lays it out again exactly as it was', () => {
    const { root, setMap } = createHostMemory();
    const map = root.getObjectByName('host-memory-map');
    map.updateMatrix();
    const before = map.matrix.clone();
    setMap(0);
    expect(map.visible).toBe(false);
    setMap(1);
    map.updateMatrix();
    expect(map.visible).toBe(true);
    expect(map.matrix.equals(before)).toBe(true);
  });

  it('highlights a logical region when selected and returns it to rest when cleared', () => {
    const { components } = createHostMemory();
    const registry = new ComponentRegistry();
    components.forEach((c) => registry.register(c));
    const highlighter = new Highlighter(registry);
    highlighter.prepareAll();
    const tile = components.find((c) => c.id === 'descriptor-region').object.children.find((o) => o.isMesh && Array.isArray(o.material));
    const top = tile.material[2];
    highlighter.setSelected('descriptor-region');
    for (let i = 0; i < 30; i++) highlighter.update(0.1);
    expect(top.color.r).toBeGreaterThan(1);
    highlighter.setSelected(null);
    for (let i = 0; i < 30; i++) highlighter.update(0.1);
    expect(top.color.r).toBeCloseTo(1, 5);
  });
});

describe('host-memory — the scene: modes, picking and camera presets', () => {
  function scene({ aspect = 1.6 } = {}) {
    const presets = new Map();
    const engine = { scene: new THREE.Scene(), aspect, tweens: { add: () => ({ cancel() {} }) }, controls: { target: new THREE.Vector3() } };
    const camera = { definePreset: (name, fn) => presets.set(name, fn), addResolver: () => {} };
    const registry = new ComponentRegistry();
    const s = createHostMemoryScene({ engine, registry, camera, reducedMotion: true });
    return { s, registry, presets, engine };
  }

  it('shows the map, and lets every part be picked, in the allocation mode it opens in', () => {
    const { s, registry } = scene();
    expect(s.mode).toBe('allocation');
    for (const id of PARTS) expect(registry.get(id).enabled).toBe(true);
  });

  it('keeps the modules pickable in every mode, and the map’s parts only while it is laid out', () => {
    for (const id of PHYSICAL) for (const m of Object.keys(MODES)) expect(PICKABLE[m]).toContain(id);
    for (const id of LOGICAL) {
      expect(MODES[MODE_OF[id]].map).toBe(1);
      expect(PICKABLE[MODE_OF[id]]).toContain(id);
      for (const [m, cfg] of Object.entries(MODES)) if (!cfg.map) expect(PICKABLE[m]).not.toContain(id);
    }
    const { s, registry } = scene();
    s.setMode('physical');
    for (const id of LOGICAL) expect(registry.get(id).enabled).toBe(false);
    expect(s.memory.root.getObjectByName('host-memory-map').visible).toBe(false);
    s.setMode('allocation');
    for (const id of PARTS) expect(registry.get(id).enabled).toBe(true);
  });

  it('defines the overview, modules and map presets, each framing what it names', () => {
    const { s, registry, presets } = scene();
    expect([...presets.keys()].sort()).toEqual(['map', 'modules', 'overview']);
    const contains = (box, id) => box.containsBox(registry.worldBox(id));
    const overview = presets.get('overview')();
    for (const id of PARTS) expect(contains(overview.box, id)).toBe(true);
    const modules = presets.get('modules')();
    for (const id of PHYSICAL) expect(contains(modules.box, id)).toBe(true);
    const map = presets.get('map')();
    for (const id of LOGICAL) expect(contains(map.box, id)).toBe(true);
    expect(map.direction.y).toBeGreaterThan(map.direction.z); // looks down onto the map
    s.setMode('physical');
    const physical = presets.get('overview')();
    for (const id of PHYSICAL) expect(contains(physical.box, id)).toBe(true);
    expect(physical.box.max.z).toBeLessThan(overview.box.max.z); // the folded map is not framed
  });

  it('has a portrait overview that looks further down, so the wide asset fits an upright screen', () => {
    const wide = scene({ aspect: 1.6 }).presets.get('overview')();
    const tall = scene({ aspect: 0.5 }).presets.get('overview')();
    const tilt = (d) => d.y / Math.hypot(d.x, d.z);
    expect(tilt(tall.direction)).toBeGreaterThan(tilt(wide.direction));
  });
});

describe('host-memory — independent of the legacy stand-in', () => {
  it('never imports the v1.1 networking/HostMemory.js, or anything from another domain', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const roots = [path.join(here, '../src/domains/memory/host-memory'), path.join(here, '../../../experiences/memory/host-memory')];
    const files = roots.flatMap((r) => fs.readdirSync(r).filter((f) => f.endsWith('.js')).map((f) => path.join(r, f)));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec).not.toMatch(/networking/);
        expect(spec).not.toMatch(/domains\/(networking|io|computing)\//);
        expect(spec).not.toMatch(/^\.\.\/\.\.\/(networking|io|computing)\b/);
      }
      expect(src).not.toMatch(/networking\/HostMemory/);
    }
  });
});
