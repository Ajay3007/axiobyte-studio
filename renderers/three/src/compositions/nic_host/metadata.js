/**
 * What the composition says about itself: the asset instances as wholes, its two routes and
 * its DMA interaction — in the same shape as part metadata (name, designator, category, summary,
 * description, details), so the page shows them like any part. Part metadata stays the assets' own.
 */
export const INSTANCE_METADATA = {
  nic: {
    name: 'Network interface card',
    designator: 'Asset · nic',
    category: 'The card',
    summary: 'A PCIe network card: packets arrive on its ports, and its controller writes them into host memory by DMA.',
    description:
      'The same NIC asset as its own page, seated in the PCIe slot: its edge connector mates with the slot, contact 1 on ' +
      'pin 1. Its controller holds the DMA engine; the descriptors that tell it where to write live in host memory.',
    details: [
      ['Connects by', 'pcie_connector ↔ pcie.endpoint (mate)'],
      ['Page', '/axiobyte/networking/nic/'],
    ],
    page: '../nic/',
  },
  pcie: {
    name: 'PCI Express (PCIe)',
    designator: 'Asset · pcie',
    category: 'The link',
    summary: 'The host side of the card’s link: an x8 slot and its eight lanes, routed toward the CPU.',
    description:
      'The slot takes any add-in card; here the composition seats the NIC in it. The eight lanes leave the board at the via ' +
      'field and continue, as the PCIe x8 route, to the CPU’s root complex.',
    details: [
      ['Connects by', 'endpoint ↔ the NIC (mate); root_complex ↔ the CPU (route)'],
      ['Page', '/axiobyte/io/pcie/'],
    ],
    page: '../../io/pcie/',
  },
  cpu: {
    name: 'Central Processing Unit (CPU)',
    designator: 'Asset · cpu',
    category: 'The host',
    summary: 'The processor: its root complex ends the PCIe link, and its memory controller drives the memory channels.',
    description:
      'Both interfaces leave the package through its contact lands: PCIe on one side, memory on the other. A DMA write from ' +
      'the NIC arrives at the root complex and is passed to the memory controller — hardware inside the package; no core ' +
      'executes a copy.',
    details: [
      ['Connects by', 'pcie_root_complex ↔ PCIe (route); memory_interface ↔ host memory (route)'],
      ['Page', '/axiobyte/computing/cpu/'],
    ],
    page: '../../computing/cpu/',
  },
  memory: {
    name: 'Host memory',
    designator: 'Asset · host_memory',
    category: 'The destination',
    summary: 'The computer’s main memory: the modules, and the map of what software has allocated in them.',
    description:
      'The driver allocated the descriptor ring and the packet buffers here, in ordinary DRAM. Every packet the NIC receives ' +
      'ends in one of these buffers. The map in front of the modules is a logical view, not to scale; the ring that resides ' +
      'in its descriptor region and the mempool that resides in its packet-buffer region are drawn as their own models, in ' +
      'front of the map.',
    details: [
      ['Connects by', 'memory_interface ↔ the CPU (route)'],
      ['Page', '/axiobyte/memory/host-memory/'],
    ],
    page: '../../memory/host-memory/',
  },
  rx_ring: {
    name: 'RX descriptor ring',
    designator: 'Asset · descriptor_ring',
    category: 'In host memory',
    summary: 'The receive ring the driver allocated for the NIC: descriptors holding the addresses of packet buffers, never the bytes.',
    description:
      'The same descriptor-ring asset as its own page. It resides in host memory’s descriptor region, and its descriptors refer ' +
      'to buffers in the packet-buffer region — both declared by the composition, neither drawn as a link. It is drawn at its ' +
      'own size in front of the memory map, not inside the region: residence says where it lives, not where it is drawn. The ' +
      'DMA path does not pass through it; how the NIC reads descriptors and writes status back is not drawn.',
    details: [
      ['Resides in', 'memory.descriptor-region (residence)'],
      ['Refers to', 'memory.packet-buffer-region (reference)'],
      ['Page', '/axiobyte/memory/descriptor-ring/'],
    ],
    page: '../../memory/descriptor-ring/',
  },
  pool: {
    name: 'Mempool',
    designator: 'Asset · mempool · prototype',
    category: 'In host memory',
    summary: 'The pool the packet buffers come from: identical elements allocated once, up front, each an mbuf with its buffer.',
    description:
      'A prototype asset: the mempool’s Three.js model, which has no page of its own yet. It resides in host memory’s ' +
      'packet-buffer region — declared by the composition, not drawn as a link — and is drawn at its own size beside the ' +
      'map, not inside the region. Each element ' +
      'pairs an mbuf, the metadata whose buf_addr holds its buffer’s address, with the buffer that holds the packet bytes. ' +
      'The descriptors refer to the buffers in that region and the NIC’s DMA writes into it; neither ends on the pool. No ' +
      'individual mbuf or buffer is picked out, and which elements are free or in use is not shown.',
    details: [
      ['Resides in', 'memory.packet-buffer-region (residence)'],
      ['Elements drawn', '12, each an mbuf and its buffer'],
      ['Status', 'prototype — shown in this system, not released as an asset'],
    ],
  },
};

export const LINK_METADATA = {
  'route.pcie': {
    name: 'PCIe x8',
    designator: 'Connection · route',
    category: 'Composition · structural link',
    summary: 'The eight lanes of the link, from the PCIe asset’s via field to the CPU’s PCIe contact field — one connection.',
    description:
      'On a real board the lanes run as differential pairs across the motherboard to the CPU socket. That board is not an asset ' +
      'here, so the composition draws the connection schematically: the eight lane anchors meet the CPU’s single land field ' +
      'as one x8 bundle. It is structure, not traffic.',
    details: [
      ['Ports', 'pcie.root_complex ↔ cpu.pcie_root_complex'],
      ['Anchors', '8 lane vias → 1 land field (bundle)'],
      ['Drawn', 'schematically — no traces, no socket'],
    ],
  },
  'route.memory': {
    name: 'Memory channels',
    designator: 'Connection · route',
    category: 'Composition · structural link',
    summary: 'The memory channels from the CPU’s memory controller to both modules — one connection, fanning out.',
    description:
      'The memory controller inside the CPU drives the channels; they leave the package through its memory land field and ' +
      'run across the motherboard to the DIMM slots. The composition draws that as one connection that fans out to both ' +
      'modules’ edge contacts — not as two separate CPU-to-DIMM ports.',
    details: [
      ['Ports', 'cpu.memory_interface ↔ memory.memory_interface'],
      ['Anchors', '1 land field → 2 module edges (bundle)'],
      ['Drawn', 'schematically — no traces, no slots'],
    ],
  },
  'interaction.dma': {
    name: 'DMA',
    designator: 'Interaction · dma',
    category: 'Composition · interaction',
    summary: 'The NIC writes each received packet straight into a packet buffer in host memory. No core copies it.',
    description:
      'The NIC’s DMA engine reads a descriptor to learn a free buffer’s address, then sends the packet up the PCIe link as ' +
      'memory writes. The CPU’s root complex passes them to its memory controller, which writes them to DRAM — into the ' +
      'buffer the descriptor named. The cores are not involved; software finds the packet where it landed. DMA is an ' +
      'interaction between the card and memory, not a port and not a part of any asset.',
    details: [
      ['From', 'nic (its controller’s DMA engine)'],
      ['To', 'memory.packet-buffer-region'],
      ['Via', 'PCIe → CPU root complex → memory controller'],
      ['Concept', 'dma (interaction)'],
    ],
  },
};
