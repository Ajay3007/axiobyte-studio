/**
 * Part metadata for the mbuf asset, keyed by part id — the registry's `parts`. The mbuf has one
 * semantic part, its fields, drawn as one record.
 */
export const MBUF_METADATA = {
  fields: {
    name: 'Fields',
    designator: 'fields',
    category: 'Logical · packet metadata',
    summary: 'The metadata a packet is handled by: bookkeeping fields and buf_addr, the address of its buffer.',
    description:
      'An mbuf is a small record of metadata. Its bookkeeping fields — the data length, the reference count — describe the ' +
      'packet; buf_addr holds the address of the buffer where the packet’s bytes are. The mbuf is never the bytes: whatever ' +
      'is handed an mbuf is handed the address of the bytes, not a copy of them.',
    details: [
      ['Fields shown', 'data_len, refcount, buf_addr'],
      ['buf_addr', 'the address of the packet buffer'],
      ['Not shown', 'values, next (chaining), pooled/attached/freed'],
    ],
    actions: [],
  },
};
