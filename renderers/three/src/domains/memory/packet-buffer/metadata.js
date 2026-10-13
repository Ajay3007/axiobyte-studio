/**
 * Part metadata for the Packet Buffer asset, keyed by part id — the registry's `parts`. The buffer
 * has two semantic parts, the two regions its bytes are in: the header, then the payload.
 */
export const PACKET_BUFFER_METADATA = {
  header: {
    name: 'Header',
    designator: 'header',
    category: 'Logical · packet bytes',
    summary: 'The packet’s first bytes: the header, which says where the packet goes.',
    description:
      'The header is the first run of the packet’s bytes, at the start of the buffer — where the buffer’s address points. ' +
      'A stage that rewrites it — to change an address, say — changes these bytes where they lie: an in-place edit ' +
      'in the same buffer, not a copy into another.',
    details: [
      ['Holds', 'the packet’s header bytes'],
      ['Starts at', 'the buffer’s address (its first byte)'],
      ['Not shown', 'field values, protocols, lengths'],
    ],
    actions: [],
  },
  payload: {
    name: 'Payload',
    designator: 'payload',
    category: 'Logical · packet bytes',
    summary: 'The rest of the packet’s bytes: the payload, the data the packet carries.',
    description:
      'The payload follows the header in the same buffer. It is most of the packet’s bytes, and on a zero-copy path it is ' +
      'written once — by the NIC, by DMA — and read in place until the packet leaves.',
    details: [
      ['Holds', 'the packet’s payload bytes'],
      ['Follows', 'the header, in the same buffer'],
      ['Not shown', 'values, sizes, ownership, free/in-use'],
    ],
    actions: [],
  },
};
