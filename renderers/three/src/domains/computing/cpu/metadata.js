/**
 * Explanation layer for the CPU asset, keyed by part id — the NIC's shape, so tooltips, the inspect
 * panel and future lessons read it the same way.
 * Shape: { name, designator, category, summary, description, details, actions }
 *
 * Physical parts describe the real package. The four die regions are conceptual, and say so: they
 * are a teaching layout, with no claim about core counts, cache sizes or any vendor's floorplan.
 */
export const CPU_METADATA = {
  ihs: {
    name: 'Integrated heat spreader',
    designator: 'IHS',
    category: 'Thermal',
    summary: 'The metal lid over the die: it protects the silicon and spreads its heat to the cooler pressed on top.',
    description:
      'A nickel-plated copper lid, bonded to the substrate around its edge and to the die through a thin thermal interface material. ' +
      "The cooler never touches the silicon; it presses on this lid, which spreads the die's concentrated heat over a larger area. " +
      'The laser marking on top identifies the part.',
    details: [
      ['Material', 'Nickel-plated copper'],
      ['Joined to die', 'Thermal interface material'],
      ['Heat path', 'die → TIM → IHS → cooler'],
    ],
  },
  substrate: {
    name: 'Package substrate',
    designator: 'Substrate',
    category: 'Package',
    summary: "The layered circuit board the die sits on: it fans the die's microscopic bumps out to the millimetre-scale contacts underneath.",
    description:
      'A multi-layer organic laminate. The die is flip-chip bonded to its top through thousands of tiny solder bumps; its layers route every signal out to the lands on the underside. ' +
      'Capacitors on both sides keep the supply steady as the load changes. The notches in its edges meet keys in the socket, so the package fits only one way, and a gold triangle marks pin 1.',
    details: [
      ['Build', 'Multi-layer organic laminate'],
      ['Die side', 'Flip-chip solder bumps'],
      ['Land side', 'Contacts at ≈ 1 mm pitch'],
      ['Also carries', 'Decoupling capacitors'],
    ],
  },
  lands: {
    name: 'Contact lands (LGA)',
    designator: 'Land grid',
    category: 'Interface',
    summary: "Flat gold contacts on the underside that press onto the socket's spring pins: every connection into and out of the CPU is made here.",
    description:
      'In a land grid array the pins are in the motherboard socket, not on the CPU. Most contacts carry power and ground; groups of them carry the memory channels, the PCIe lanes and control signals. ' +
      'Turned over, this model marks where its memory and PCIe groups sit — the two structural interfaces of this asset. The layout and contact count are a teaching layout, not a real pinout.',
    details: [
      ['Type', 'Land grid array (pins in the socket)'],
      ['Contacts', 'Well over a thousand on desktop CPUs'],
      ['Pitch', '≈ 1 mm'],
      ['Most contacts', 'Power and ground'],
      ['Interfaces', 'memory_interface, pcie_root_complex'],
    ],
  },
  die: {
    name: 'Silicon die',
    designator: 'Die',
    category: 'Silicon',
    summary: 'The chip itself: billions of transistors on a thin piece of silicon, bonded face down to the substrate.',
    description:
      'In a flip-chip package the circuits face the substrate and the bare back of the silicon faces the heat spreader. ' +
      'Some processors put everything on one die; others combine several dies (chiplets) on one substrate. The regions shown on top are drawn on the back for teaching — the real circuits are on the underside.',
    details: [
      ['Bonding', 'Flip-chip, circuits facing down'],
      ['Shown here', 'One die, with an educational layout'],
    ],
  },
  cores: {
    name: 'CPU cores',
    designator: 'Conceptual',
    category: 'Compute',
    summary: 'Each core is a complete processor: it fetches, decodes and executes its own stream of instructions, with its own private caches.',
    description:
      'A CPU with several cores runs several instruction streams truly at once. Each core has private L1 caches for instructions and data, and usually a private L2. ' +
      'The number of tiles shown is illustrative: CPUs range from a handful of cores to well over a hundred. In a DPDK data plane, a core is often dedicated to one job — polling one NIC queue — so its caches stay warm.',
    details: [
      ['Runs', 'Its own instruction stream (or two, with SMT)'],
      ['Private caches', 'L1 instruction + L1 data, usually L2'],
      ['Shown', 'Illustrative count, not a floorplan'],
    ],
  },
  cache: {
    name: 'Shared cache',
    designator: 'Conceptual',
    category: 'Memory hierarchy',
    summary: 'The last-level cache all cores share: recently used memory kept on the die, so most loads never wait for DRAM.',
    description:
      "A core looks in its own L1 and L2 first, then in this shared cache, and only on a miss goes out through the memory controller to DRAM — much further away and far slower. " +
      'Data moves between cache and memory in fixed-size cache lines, typically 64 bytes.',
    details: [
      ['Shared by', 'All cores on the die'],
      ['Unit', 'Cache line, typically 64 bytes'],
      ['On a miss', 'Memory controller → DRAM'],
    ],
  },
  'memory-controller': {
    name: 'Memory controller',
    designator: 'Conceptual',
    category: 'Memory interface',
    summary: 'Where the CPU talks to DRAM: it drives the memory channels that run from the CPU to the DIMM slots.',
    description:
      'Built into modern CPUs, it turns cache misses into DRAM reads and writes over one or more memory channels. ' +
      "Its signals leave the package through their own group of lands underneath — this asset's memory_interface.",
    details: [
      ['Serves', 'Cache misses and write-backs'],
      ['Connects to', 'DRAM over memory channels'],
      ['Leaves via', 'The memory group of lands'],
    ],
  },
  io: {
    name: 'PCIe root complex and I/O',
    designator: 'Conceptual',
    category: 'I/O',
    summary: "The CPU's end of every PCIe link: it turns a card's memory reads and writes into accesses to memory, and the CPU's accesses into transactions to the card.",
    description:
      'Its PCIe lanes leave the package through their own group of lands and run across the motherboard to the slots — the pcie_root_complex interface, where the PCIe asset connects. ' +
      "When a NIC writes a packet into host RAM by DMA, the write travels up its PCIe link to this root complex, which passes it on to memory; the cores do not copy it.",
    details: [
      ['Root ports', 'Several, each to a slot or device'],
      ['Traffic', 'Memory reads/writes, configuration, MSI interrupts'],
      ['Leaves via', 'The PCIe group of lands'],
    ],
  },
};
