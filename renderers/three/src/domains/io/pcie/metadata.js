import { LANES } from './layout.js';

/**
 * Explanation layer for the PCIe asset, keyed by part id — the same shape as the NIC's, so
 * tooltips, the inspect panel and future lessons read it the same way.
 * Shape: { name, designator, category, summary, description, details, actions }
 */
const lane = (n) => {
  const { b, a } = LANES[n];
  return {
    name: `Lane ${n}`,
    designator: `B${b}–${b + 1} · A${a}–${a + 1}`,
    category: 'Data lane',
    summary: 'One lane: two differential pairs, one for each direction, so data flows both ways at once.',
    description:
      `Lane ${n} is four wires: the PETp${n}/PETn${n} pair on side B of the slot and the PERp${n}/PERn${n} pair on side A. ` +
      'Each pair carries one direction as a differential signal — the receiver reads the difference between the two wires, which cancels noise picked up by both. ' +
      "The two traces of a pair run side by side and are length-matched (the small serpentines), and the lane drops through vias on its way to the CPU's root complex.",
    details: [
      ['Wires', '4 — two differential pairs'],
      ['Contacts', `B${b}–B${b + 1}, A${a}–A${a + 1}`],
      ['PCIe 3.0', '8 GT/s each way ≈ 985 MB/s'],
      ['PCIe 4.0', '16 GT/s each way ≈ 1.97 GB/s'],
      ['Coupling', 'AC-coupled at each transmitter'],
    ],
  };
};

export const PCIE_METADATA = {
  slot: {
    name: 'PCIe x8 slot',
    designator: 'PCIE1',
    category: 'Connector',
    summary: "The socket a card plugs into: 49 contacts on each side of the card's edge, split by a key.",
    description:
      "A card's edge connector slides into the slot and meets two rows of spring contacts, side A and side B, 1.0 mm apart. " +
      'The short section before the key carries power and control; the long section after it carries the lanes. ' +
      'The key is a plastic rib that fits the notch in the card, so a card cannot go in backwards or into the wrong kind of slot. ' +
      'The connector is the same from PCIe 1.0 to 5.0 — only the signalling rate changes.',
    details: [
      ['Width', 'x8 — 98 contacts, 49 per side'],
      ['Pitch', '1.0 mm'],
      ['Key', 'after contact 11'],
      ['Accepts', 'x1, x4 and x8 cards'],
      ['Length', '≈ 56 mm'],
    ],
  },
  sideband: {
    name: 'Power and sideband',
    designator: 'Contacts 1–11',
    category: 'Power & control',
    summary: 'The short section before the key: power for the card, plus reset, wake and management signals — no data.',
    description:
      'Contacts 1–11 deliver +12 V and +3.3 V to the card, and +3.3 V auxiliary power that stays on in standby. ' +
      'They also carry PERST#, the reset that holds the card until its power and clock are stable, plus WAKE#, SMBus and JTAG. ' +
      "PRSNT1# pairs with a PRSNT2# contact at the far end of the card's edge, which is how the board knows a card is present. " +
      'The 100 MHz reference clock that both ends time their lanes against arrives just after the key, on A13–A14.',
    details: [
      ['Power', '+12 V, +3.3 V, +3.3 Vaux'],
      ['Reset', 'PERST#'],
      ['Clock', 'REFCLK± 100 MHz (A13–A14)'],
      ['Management', 'SMBus, JTAG, WAKE#'],
      ['Presence', 'PRSNT1# ↔ PRSNT2#'],
    ],
  },
  'lane-0': { ...lane(0) },
  'lane-1': { ...lane(1) },
  'lane-2': { ...lane(2) },
  'lane-3': { ...lane(3) },
  'lane-4': { ...lane(4) },
  'lane-5': { ...lane(5) },
  'lane-6': { ...lane(6) },
  'lane-7': { ...lane(7) },
  link: {
    name: 'PCIe link (x8)',
    designator: 'Logical',
    category: 'Link',
    summary: "The eight lanes together: one point-to-point link between the CPU's root complex and the card.",
    description:
      'A link joins exactly two devices — the root complex in the CPU at one end, whatever card sits in the slot at the other. ' +
      "Its width is the number of lanes it uses: x8 here. Data is striped across the lanes byte by byte, so eight lanes carry about eight times one lane's bandwidth. " +
      'When a card comes up, both ends train the link to the widest width and fastest rate they share: an x4 card in this slot runs x4; an x8 card, such as the AxioByte NIC, uses all eight lanes.',
    details: [
      ['Width', 'x8'],
      ['PCIe 3.0 x8', '≈ 7.9 GB/s each way'],
      ['PCIe 4.0 x8', '≈ 15.8 GB/s each way'],
      ['Topology', 'point-to-point, one link per slot'],
      ['Ends', 'root complex ↔ endpoint'],
    ],
  },
};
