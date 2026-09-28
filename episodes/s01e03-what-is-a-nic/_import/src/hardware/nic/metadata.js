/**
 * Explanation layer data. Kept separate from geometry so the same text can
 * drive tooltips, the info panel, and future guided lessons.
 * Shape: { id, name, category, designator, summary, description, details, actions }
 */
export const NIC_METADATA = {
  'nic-controller': {
    name: 'NIC Controller',
    designator: 'U1',
    category: 'Silicon',
    summary: 'The Ethernet MAC and packet engine: it turns frames into PCIe transactions.',
    description:
      'The controller holds the MAC, the RX/TX queue contexts, the RSS hash engine, offload logic (checksum, TSO, VLAN) and the DMA engine. ' +
      'On receive it parses each frame, picks a queue, fetches the next free descriptor from host memory and writes the packet into the buffer that descriptor points to. ' +
      'A DPDK poll-mode driver talks to this chip directly from user space.',
    details: [
      ['Role', 'MAC, queues, RSS, offloads, DMA'],
      ['Host interface', 'PCIe 3.0 x8'],
      ['Queues', '128 RX / 128 TX per port (typical)'],
      ['Package', '120-lead QFP (simplified)'],
    ],
  },
  phy: {
    name: '10GBASE-T PHY',
    designator: 'U2',
    category: 'Silicon',
    summary: 'Converts analog signals on the copper pairs into digital symbols for the MAC.',
    description:
      '10GBASE-T sends PAM-16 symbols at 800 Mbaud over all four twisted pairs at once, so the PHY runs heavy DSP (echo and crosstalk cancellation, LDPC decoding). ' +
      'That is why it runs hot and sits under the heatsink. It hands decoded frames to the MAC over a serial interface.',
    details: [
      ['Line coding', 'PAM-16, LDPC'],
      ['Pairs used', '4 (full duplex)'],
      ['Package', 'Flip-chip BGA'],
    ],
  },
  heatsink: {
    name: 'Heatsink',
    designator: 'HS1',
    category: 'Thermal',
    summary: 'Finned aluminium heatsink held down by spring-loaded push pins.',
    description:
      'The heatsink spreads heat from the PHY into case airflow. Fins run along the card so air from the chassis fans moves through them. ' +
      'Use Lift heatsink to reveal the chip underneath.',
    details: [
      ['Material', 'Black anodised aluminium'],
      ['Mounting', '2 push pins with springs'],
      ['Cooling', 'Passive, needs chassis airflow'],
    ],
    actions: [{ id: 'toggle-heatsink', label: 'Lift heatsink', activeLabel: 'Lower heatsink' }],
  },
  'rj45-1': {
    name: 'RJ45 Port 1',
    designator: 'J1',
    category: 'Connector',
    summary: 'Shielded 8P8C jack where the copper cable plugs in. Port 0 to the driver.',
    description:
      'The eight gold contacts carry four differential pairs. The shield grounds the cable screen to the bracket. ' +
      'The green LED shows link and the amber LED blinks with activity; both are driven by the controller. ' +
      'In DPDK this appears as one ethdev port with its own RX and TX queues.',
    details: [
      ['Contacts', '8 (4 differential pairs)'],
      ['Speeds', '10G / 5G / 2.5G / 1G / 100M'],
      ['LEDs', 'Green link, amber activity'],
    ],
  },
  'rj45-2': {
    name: 'RJ45 Port 2',
    designator: 'J2',
    category: 'Connector',
    summary: 'Second copper port. Port 1 to the driver, with its own MAC address and queues.',
    description:
      'Identical to port 1 but fully independent: separate link, separate MAC address, separate queues. ' +
      'Dual-port cards are often used for forwarding, where one port receives and the other transmits.',
    details: [
      ['Contacts', '8 (4 differential pairs)'],
      ['MAC', 'Base MAC + 1'],
    ],
  },
  'magnetics-1': {
    name: 'LAN Magnetics',
    designator: 'T1',
    category: 'Signal integrity',
    summary: 'Isolation transformers between the cable and the PHY for port 1.',
    description:
      'Ethernet is transformer-coupled: the magnetics isolate the card from the cable (1500 V), reject common-mode noise and match impedance. ' +
      'Each of the four pairs gets its own transformer and choke.',
    details: [['Isolation', '1500 Vrms']],
  },
  'magnetics-2': {
    name: 'LAN Magnetics',
    designator: 'T2',
    category: 'Signal integrity',
    summary: 'Isolation transformers between the cable and the PHY for port 2.',
    description: 'Same function as T1, for the second port.',
    details: [['Isolation', '1500 Vrms']],
  },
  'pcie-connector': {
    name: 'PCIe Connector',
    designator: 'P1',
    category: 'Host interface',
    summary: 'x8 gold edge connector. Every packet reaches host memory through here.',
    description:
      'Eight lanes of PCIe 3.0 give about 7.9 GB/s per direction, enough for two 10G ports with plenty of headroom for descriptor traffic. ' +
      'The NIC is a bus master: it performs DMA reads (TX buffers, descriptors) and DMA writes (RX packets, write-backs) without the CPU copying anything.',
    details: [
      ['Lanes', 'x8, 8 GT/s per lane'],
      ['Bandwidth', '≈7.9 GB/s per direction'],
      ['Contacts', '49 per side, keyed'],
    ],
  },
  'rx-queue': {
    name: 'RX Queue Area',
    designator: 'RXQ',
    category: 'Concept',
    summary: 'Where received packets are lined up before software picks them up.',
    description:
      'Conceptual view. Each RX queue is a ring of descriptors in host memory plus a queue context inside the controller. ' +
      'The controller fills buffers and marks descriptors done; a DPDK worker core calls rte_eth_rx_burst() to collect up to a burst of packets as mbufs. ' +
      'RSS spreads flows across queues so each core owns its own queue with no locking.',
    details: [
      ['Software API', 'rte_eth_rx_burst()'],
      ['Backing memory', 'Descriptor ring + mempool mbufs'],
      ['Scaling', 'RSS: one queue per core'],
    ],
  },
  'tx-queue': {
    name: 'TX Queue Area',
    designator: 'TXQ',
    category: 'Concept',
    summary: 'Where outgoing packets wait for the controller to fetch them.',
    description:
      'Conceptual view. Software writes descriptors that point at packet buffers and bumps the tail pointer with rte_eth_tx_burst(). ' +
      'The controller DMA-reads the buffers, transmits them, and reports completion so the mbufs can return to the mempool.',
    details: [
      ['Software API', 'rte_eth_tx_burst()'],
      ['Doorbell', 'Tail register write over PCIe'],
    ],
  },
  bracket: {
    name: 'Mounting Bracket',
    designator: 'BRK',
    category: 'Mechanical',
    summary: 'Steel I/O bracket that fixes the card to the chassis and exposes the ports.',
    description: 'Low-profile L-bracket with port windows, vents and a U-slot for the case screw. It also bonds the port shields to chassis ground.',
    details: [['Material', 'Zinc-plated steel']],
  },
};
