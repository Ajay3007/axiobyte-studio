import { describe, expect, it } from 'vitest';
import { CEM, LANES, SLOT, contactX } from '../src/domains/io/pcie/layout.js';
import { PCIE_METADATA } from '../src/domains/io/pcie/metadata.js';
import { FINGERS } from '../src/domains/networking/nic/layout.js';

// The NIC's contact 1, measured the way its fingers are laid out (left edge + half a width).
const nicPin1 = FINGERS.segA.x0 + FINGERS.width / 2;

describe('io/pcie — the slot is the CEM x8 connector every x8 card fits', () => {
  it("mates with the NIC's x8 edge connector: same pitch, same count each side of the key", () => {
    expect(CEM.pitch).toBeCloseTo(FINGERS.pitch, 6);
    expect(CEM.beforeKey).toBe(FINGERS.segA.count);
    expect(CEM.perSide).toBe(FINGERS.segA.count + FINGERS.segB.count);
  });

  it('puts every contact exactly under the matching finger of the NIC', () => {
    for (let n = 1; n <= CEM.perSide; n++) {
      const nic = n <= FINGERS.segA.count ? FINGERS.segA.x0 + (n - 1) * FINGERS.pitch : FINGERS.segB.x0 + (n - 12) * FINGERS.pitch;
      expect(contactX(n)).toBeCloseTo(nic + FINGERS.width / 2 - nicPin1, 6);
    }
  });

  it('keys where the NIC is notched, and opens wide enough for its tab', () => {
    expect(CEM.notch.x0).toBeCloseTo(FINGERS.notch.x0 - nicPin1, 6);
    expect(CEM.notch.x1).toBeCloseTo(FINGERS.notch.x1 - nicPin1, 6);
    expect(CEM.tab.x0).toBeCloseTo(FINGERS.tab.x0 - nicPin1, 6);
    expect(CEM.tab.x1).toBeCloseTo(FINGERS.tab.x1 - nicPin1, 6);
    // The key rib is narrower than the notch, and shorter than the notch is deep.
    expect(SLOT.keyW).toBeLessThan(CEM.notch.x1 - CEM.notch.x0);
    expect(SLOT.keyH).toBeLessThan(CEM.notch.depth);
  });
});

describe('io/pcie — lanes follow the CEM x8 pinout', () => {
  it('has eight lanes, each a side-B pair and a side-A pair after the key', () => {
    expect(LANES.map((l) => l.lane)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const { b, a } of LANES) {
      for (const n of [b, b + 1, a, a + 1]) {
        expect(n).toBeGreaterThan(CEM.beforeKey + 1); // never in power/sideband or on REFCLK (A13–A14)
        expect(n).toBeLessThanOrEqual(CEM.perSide);
      }
    }
  });

  it('matches the published contacts for lane 0 and lane 7', () => {
    expect(LANES[0]).toMatchObject({ b: 14, a: 16 });
    expect(LANES[7]).toMatchObject({ b: 45, a: 47 });
  });

  it('never shares a contact between lanes on the same side', () => {
    const sideB = LANES.flatMap(({ b }) => [b, b + 1]);
    const sideA = LANES.flatMap(({ a }) => [a, a + 1]);
    expect(new Set(sideB).size).toBe(sideB.length);
    expect(new Set(sideA).size).toBe(sideA.length);
  });

  it('describes every lane, the slot, the sideband and the link', () => {
    const ids = ['slot', 'sideband', 'link', ...LANES.map((l) => `lane-${l.lane}`)];
    for (const id of ids) {
      expect(PCIE_METADATA[id]?.name).toBeTruthy();
      expect(PCIE_METADATA[id]?.summary).toBeTruthy();
    }
  });
});
