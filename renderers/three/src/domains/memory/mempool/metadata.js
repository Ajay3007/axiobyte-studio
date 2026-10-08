/**
 * Part metadata for the Mempool asset, keyed by part id — the registry's `parts`. The pool has one
 * semantic part, its elements; the twelve tiles drawn are that one part, not twelve parts.
 */
export const MEMPOOL_METADATA = {
  elements: {
    name: 'Elements',
    designator: 'elements',
    category: 'Logical · allocation elements',
    summary: 'The pool’s allocation elements, each pairing an mbuf with its buffer.',
    description:
      'A mempool is allocated once, up front, as a set of identical elements, so the fast path never has to allocate. ' +
      'Each element is a pair: an mbuf, a small record of metadata whose buf_addr holds the address of its buffer, and ' +
      'the buffer itself, which holds the packet bytes. The mbuf is never the bytes; the two are handed out and returned ' +
      'together.',
    details: [
      ['Elements drawn', '12 — real pools hold thousands'],
      ['Each', 'an mbuf and its buffer'],
      ['Not shown', 'free/in-use, ownership, addresses'],
    ],
    actions: [],
  },
};
