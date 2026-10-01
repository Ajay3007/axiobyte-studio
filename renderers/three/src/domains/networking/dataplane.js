/**
 * Networking-concept layer. Stages describe where a packet is, independent
 * of any 3D model. On-card stages map to registered component ids; host
 * stages (host: true) will get their own scenes (memory, CPU cores) later.
 */
export const STAGES = {
  cable: { name: 'Cable', host: false, components: [], summary: 'Four twisted pairs carrying PAM-16 symbols.' },
  rj45: { name: 'RJ45 port', components: ['rj45-1', 'rj45-2'], summary: 'Physical entry point of the frame.' },
  magnetics: { name: 'Magnetics', components: ['magnetics-1', 'magnetics-2'], summary: 'Galvanic isolation and common-mode rejection.' },
  phy: { name: 'PHY', components: ['phy'], summary: 'DSP turns line symbols back into bits.' },
  controller: { name: 'MAC / controller', components: ['nic-controller'], summary: 'Frame checks, RSS hashing, queue selection.' },
  dma: { name: 'DMA engine', components: ['nic-controller'], anchor: 'dma', summary: 'Writes the packet into a host buffer with no CPU copy.' },
  pcie: { name: 'PCIe', components: ['pcie-connector'], summary: 'Memory-write TLPs to host RAM.' },
  'descriptor-ring': { name: 'Descriptor ring', host: true, components: [], summary: 'Circular array of buffer pointers shared with the NIC.' },
  mempool: { name: 'DPDK mempool', host: true, components: [], summary: 'Pre-allocated mbufs in hugepage memory.' },
  'worker-core': { name: 'Worker core', host: true, components: [], summary: 'Polls with rte_eth_rx_burst(), no interrupts.' },
  application: { name: 'Application', host: true, components: [], summary: 'Forwarding, filtering, or your packet logic.' },
};

export const RX_PATH = ['cable', 'rj45', 'magnetics', 'phy', 'controller', 'dma', 'pcie', 'descriptor-ring', 'mempool', 'worker-core', 'application'];
export const TX_PATH = ['application', 'worker-core', 'mempool', 'descriptor-ring', 'pcie', 'dma', 'controller', 'phy', 'magnetics', 'rj45', 'cable'];

export function stageForComponent(componentId) {
  for (const [key, s] of Object.entries(STAGES)) {
    if (key !== 'dma' && s.components.includes(componentId)) return key;
  }
  return null;
}

/** Previous / next stage around a component on a path (used by the info panel). */
export function neighbors(componentId, path = RX_PATH) {
  const stage = stageForComponent(componentId);
  const i = path.indexOf(stage);
  if (i < 0) return null;
  const pick = (j) => (j >= 0 && j < path.length ? { key: path[j], ...STAGES[path[j]] } : null);
  return { stage: { key: stage, ...STAGES[stage] }, prev: pick(i - 1), next: pick(i + 1) };
}

/** Resolve a path into on-card stops for PacketAnimator.animateRoute(). */
export function hardwareRoute(path = RX_PATH, { port = 1 } = {}) {
  const stops = [];
  for (const key of path) {
    const s = STAGES[key];
    if (s.host || !s.components.length) continue;
    const id = s.components.length > 1 ? s.components[Math.min(port, s.components.length) - 1] : s.components[0];
    stops.push(s.anchor ? { id, anchor: s.anchor } : { id });
  }
  return stops;
}
