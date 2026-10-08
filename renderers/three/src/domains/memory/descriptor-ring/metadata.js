/**
 * Part metadata for the Descriptor Ring asset, keyed by part id — the registry's `parts`. The ring
 * has one semantic part, its descriptors; a single descriptor is a slot of that part, never an
 * asset or a part of its own.
 */
export const DESCRIPTOR_RING_METADATA = {
  descriptors: {
    name: 'Descriptors',
    designator: 'Ring storage',
    category: 'Logical · descriptor array',
    summary:
      'The ring’s storage: a contiguous array of fixed-size descriptors, used in a circle — after the last comes the first again.',
    description:
      'Each descriptor is a small, fixed-size record. On receive, software writes into it the address of an empty packet ' +
      'buffer; the NIC later writes the outcome back — the length it received and a status saying the descriptor is done. ' +
      'A descriptor holds a reference to a buffer, not the buffer: the packet bytes are never inside it. Descriptors never ' +
      'leave their ring; they are reused, slot after slot, around it.',
    details: [
      ['Descriptors drawn', '8 — real rings hold hundreds to thousands'],
      ['Size', 'typically 16 or 32 bytes each'],
      ['Holds', 'a buffer address, a length and status — schematic here, no real format'],
      ['Refers to', 'packet-buffer storage in host memory, by address'],
      ['Never holds', 'the packet bytes'],
    ],
    actions: [],
  },
};

/**
 * Head and tail are anchors — named positions on the ring — not parts: they are indices that say
 * which descriptor comes next, kept in NIC registers and driver variables, not memory the ring
 * consists of. They are inspectable on the page so the page can explain them; their positions are
 * illustrative, not runtime values.
 */
export const ANCHOR_METADATA = {
  head: {
    name: 'Head',
    designator: 'Anchor',
    category: 'Position on the ring · not a part',
    summary: 'Where the NIC works next: the next descriptor it will fill with a received packet.',
    description:
      'The head is an index, not a piece of the ring. The NIC advances it as it completes descriptors; software follows ' +
      'behind it, collecting the descriptors marked done. Its position here is illustrative — the page draws no runtime state.',
    details: [
      ['Kind', 'anchor — a named position, not a part'],
      ['Advanced by', 'the NIC, as it completes descriptors'],
      ['Shown', 'at an illustrative position; it does not move'],
    ],
    actions: [],
  },
  tail: {
    name: 'Tail',
    designator: 'Anchor',
    category: 'Position on the ring · not a part',
    summary: 'How far software has refilled the ring: the descriptors before the tail are ready for the NIC.',
    description:
      'The tail is an index, not a piece of the ring. Software writes fresh buffer addresses into descriptors and then moves ' +
      'the tail on, telling the NIC — through a register on the card — how far it may go. Its position here is illustrative.',
    details: [
      ['Kind', 'anchor — a named position, not a part'],
      ['Advanced by', 'software, as it refills descriptors'],
      ['Shown', 'at an illustrative position; it does not move'],
    ],
    actions: [],
  },
};
