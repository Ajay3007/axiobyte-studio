/**
 * Part metadata for the Host Memory asset, keyed by part id — the same shape as the NIC's (name,
 * designator, category, summary, description, details, actions). Two layers: the modules are
 * physical parts; the address space and its regions are logical parts, marked as such everywhere.
 */
const module = (n) => ({
  name: 'Memory module (DIMM)',
  designator: `DIMM ${n}`,
  category: 'Physical · memory module',
  summary:
    'A dual in-line memory module: DRAM chips on a small board, plugged into a motherboard slot wired to one of the CPU’s memory channels.',
  description:
    'Each DRAM chip stores bits as charge in cells organised in banks, rows and columns. Together the chips present one ' +
    'wide data path to the memory controller — 64 data bits per channel, plus check bits on ECC modules; DDR5 splits it ' +
    'into two 32-bit subchannels. The gold contacts along the bottom edge are where the module meets its slot, and so the ' +
    'channel from the CPU: this asset’s memory_interface. The off-centre key notch lets a module fit only one way round, ' +
    'and only in slots of its own generation. The small chip in the middle holds the module’s SPD data — its size and ' +
    'timings, which firmware reads at boot.',
  details: [
    ['DRAM packages', '8 per face (illustrative)'],
    ['Edge contacts', '144 per face at 0.85 mm pitch'],
    ['Length', '133.35 mm, the standard DIMM outline'],
    ['Plugs into', 'a DIMM slot on the motherboard — not part of this asset'],
    ['Interface', 'memory_interface — the edge contacts'],
  ],
  actions: [],
});

export const HOST_MEMORY_METADATA = {
  'dimm-0': { ...module(0) },
  'dimm-1': { ...module(1) },

  'address-space': {
    name: 'Physical address space',
    designator: 'Logical view',
    category: 'Logical · address space',
    summary:
      'All of host memory as the CPU and devices address it: one range of physical addresses, from 0 upward, provided by every module together.',
    description:
      'The memory controller maps each physical address to a channel, a module, a bank, a row and a column, and interleaves ' +
      'consecutive blocks across channels so they work in parallel — so a region that looks contiguous on this map is spread ' +
      'across both modules. The operating system hands the space out in pages to the kernel, to applications and to drivers. ' +
      'This map is a logical view: it shows what the memory holds, not where bytes sit on the chips, and it is not to scale. ' +
      'Some physical addresses belong to devices rather than DRAM (memory-mapped I/O); they are left out here.',
    details: [
      ['Allocated in', 'pages — commonly 4 KB; 2 MB and 1 GB huge pages'],
      ['Addressed by', 'CPU cores, through their caches, and DMA-capable devices'],
      ['Drawn', 'logical view, not to scale'],
    ],
    actions: [],
  },

  'descriptor-region': {
    name: 'Descriptor region',
    designator: 'Allocated region',
    category: 'Logical · descriptor ring',
    summary:
      'Memory a driver allocates for a NIC’s descriptor ring: a circular array of fixed-size descriptors, each holding the address of a packet buffer.',
    description:
      'Software writes a free buffer’s address into each descriptor and tells the NIC how far the ring is filled by updating ' +
      'a tail register on the card. The NIC reads descriptors over PCIe, writes each arriving packet into the buffer a ' +
      'descriptor names, and writes status back into the descriptor. A descriptor holds addresses and status — never the ' +
      'packet bytes. The ring is circular only in how it is used: in memory it is an ordinary contiguous array, and after ' +
      'the last slot comes the first again.',
    details: [
      ['Slots drawn', '8 — real rings hold hundreds to thousands'],
      ['Descriptor size', 'typically 16 or 32 bytes'],
      ['Holds', 'buffer addresses and status, not packet bytes'],
      ['Head / tail', 'the NIC works from the head; software refills up to the tail'],
      ['Later', 'the descriptor ring becomes an asset of its own, placed here'],
    ],
    actions: [],
  },

  'packet-buffer-region': {
    name: 'Packet buffer region',
    designator: 'Allocated region',
    category: 'Logical · packet buffers',
    summary: 'Memory set aside for packet data: many fixed-size buffers, allocated in advance, waiting for the NIC to fill them.',
    description:
      'Software allocates the buffers up front — often as a pool of identical buffers — and posts their addresses into ' +
      'descriptors. When a packet arrives, the NIC writes its bytes straight into one of these buffers by DMA, without the ' +
      'CPU copying anything; software then reads the packet where it landed. Buffers a descriptor points at are marked ' +
      'posted; the rest are free for the next refill.',
    details: [
      ['Buffers drawn', '12, of which 8 are posted'],
      ['Typical size', 'about 2 KB — room for a full Ethernet frame'],
      ['Filled by', 'the NIC, by DMA (an interaction, not drawn here)'],
      ['Later', 'packet buffers (mbufs) and their pool become assets of their own'],
    ],
    actions: [],
  },

  'other-memory': {
    name: 'Other memory',
    designator: 'Everything else',
    category: 'Logical · memory',
    summary: 'Everything else host memory holds: the kernel, applications and their data, the page cache, and free pages.',
    description:
      'In a real system almost all of memory is here; rings and packet buffers are small allocations in a large space. It is ' +
      'drawn as two blocks only to show that those allocations sit among ordinary memory, not in a reserved hardware area — ' +
      'any page of DRAM can hold a ring or a buffer.',
    details: [
      ['Holds', 'kernel, applications, page cache, free pages'],
      ['Drawn', 'two blocks, not to scale'],
    ],
    actions: [],
  },
};
