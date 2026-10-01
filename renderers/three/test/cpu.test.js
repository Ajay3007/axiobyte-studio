import { describe, expect, it } from 'vitest';
import { CENTER, DIE, IHS, LANDS, PKG, REGIONS } from '../src/domains/computing/cpu/layout.js';
import { CPU_METADATA } from '../src/domains/computing/cpu/metadata.js';
import { MODES, MODE_OF, PICKABLE } from '../src/domains/computing/cpu/scene.js';

const PARTS = ['ihs', 'substrate', 'lands', 'die', 'cores', 'cache', 'memory-controller', 'io'];
const PHYSICAL = ['ihs', 'substrate', 'lands', 'die'];
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('computing/cpu — the package is built in the right order', () => {
  it('the heat spreader covers the die and sits inside the substrate, leaving a margin for capacitors', () => {
    expect(IHS.size).toBeGreaterThan(Math.max(DIE.w, DIE.d) + 0.4);
    expect((PKG.L - IHS.size) / 2).toBeGreaterThan(0.25);
  });

  it('the die is taller than nothing but lower than the heat spreader above it', () => {
    expect(DIE.h).toBeGreaterThan(0);
    expect(DIE.h).toBeLessThan(IHS.height - IHS.bead);
  });
});

describe('computing/cpu — the conceptual regions are a clean layout on the die', () => {
  const ids = Object.keys(REGIONS);

  it('has exactly the four regions the asset declares: cores, cache, memory controller, I/O', () => {
    expect(ids.sort()).toEqual(['cache', 'cores', 'io', 'memory-controller']);
  });

  it('keeps every region inside the die', () => {
    for (const r of Object.values(REGIONS)) {
      expect(r.x0).toBeGreaterThanOrEqual(0);
      expect(r.z0).toBeGreaterThanOrEqual(0);
      expect(r.x1).toBeLessThanOrEqual(DIE.w);
      expect(r.z1).toBeLessThanOrEqual(DIE.d);
      expect(r.x1).toBeGreaterThan(r.x0);
      expect(r.z1).toBeGreaterThan(r.z0);
    }
  });

  it('never lets two regions overlap', () => {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) expect(overlaps(REGIONS[ids[i]], REGIONS[ids[j]])).toBe(false);
  });
});

describe('computing/cpu — the two interfaces leave through separate groups of lands', () => {
  const { memory, pcie } = LANDS.fields;
  const grid = { x0: LANDS.margin, z0: LANDS.margin, x1: PKG.L - LANDS.margin, z1: PKG.L - LANDS.margin };
  const keepOut = { x0: CENTER - LANDS.keepOut / 2, z0: CENTER - LANDS.keepOut / 2, x1: CENTER + LANDS.keepOut / 2, z1: CENTER + LANDS.keepOut / 2 };

  it('puts memory and PCIe on opposite sides of the package, apart from each other', () => {
    expect(overlaps(memory, pcie)).toBe(false);
    expect((memory.x0 + memory.x1) / 2).toBeLessThan(CENTER);
    expect((pcie.x0 + pcie.x1) / 2).toBeGreaterThan(CENTER);
  });

  it('keeps both fields on the land grid and out of the capacitor keep-out', () => {
    for (const f of [memory, pcie]) {
      expect(f.x0).toBeGreaterThanOrEqual(grid.x0);
      expect(f.x1).toBeLessThanOrEqual(grid.x1);
      expect(f.z0).toBeGreaterThanOrEqual(grid.z0);
      expect(f.z1).toBeLessThanOrEqual(grid.z1);
      expect(overlaps(f, keepOut)).toBe(false);
    }
  });
});

describe('computing/cpu — every part is described and shown in a mode that can see it', () => {
  it('describes every part', () => {
    for (const id of PARTS) {
      expect(CPU_METADATA[id]?.name).toBeTruthy();
      expect(CPU_METADATA[id]?.summary).toBeTruthy();
    }
  });

  it('marks the four regions as conceptual, never as physical hardware', () => {
    for (const id of Object.keys(REGIONS)) expect(CPU_METADATA[id].designator).toBe('Conceptual');
    for (const id of PHYSICAL) expect(CPU_METADATA[id].designator).not.toBe('Conceptual');
  });

  it('inspects the regions with the lid lifted and the lands with the package turned over', () => {
    for (const id of PARTS) expect(MODES[MODE_OF[id]]).toBeTruthy();
    for (const id of Object.keys(REGIONS)) expect(MODES[MODE_OF[id]]).toMatchObject({ open: 1, regions: true });
    expect(MODES[MODE_OF.lands]).toMatchObject({ flip: 1, fields: true });
    expect(MODES[MODE_OF.ihs]).toMatchObject({ open: 0, flip: 0 });
  });

  it('can pick every part in the mode it is inspected in, and no region or land where it is hidden', () => {
    for (const id of PARTS) expect(PICKABLE[MODE_OF[id]]).toContain(id);
    for (const [mode, ids] of Object.entries(PICKABLE)) {
      for (const id of Object.keys(REGIONS)) if (!MODES[mode].regions) expect(ids).not.toContain(id);
      if (!MODES[mode].flip) expect(ids).not.toContain('lands');
    }
  });
});
