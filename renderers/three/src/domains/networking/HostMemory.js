import * as THREE from 'three';
import { canvasTexture, CANVAS_FONT } from '../../core/textures.js';

// Existing meanings, reused: queue slots in the accent blue the on-card zones used,
// memory and mbufs in the film's violet, the CPU in its muted grey, PCIe in its gold.
const ACCENT = 0x6ec1ff;
const MEMORY = 0xb09bff;
const CPU = 0x98a1ab;
const PCIE = 0xf0c060;
const INK = '#ece8da';

/** Panel footprint, in scene units (the card is 16.8 × 6.9). */
export const HOST_PANEL = { w: 8.4, d: 4.2 };

/**
 * The host side of the dataplane, as a conceptual region beside the card:
 *
 *   HOST MEMORY ─ RX descriptor ring · TX descriptor ring · packet buffers (mbufs)
 *   CPU core    ─ DPDK polls the rings and processes the packets
 *
 * It is deliberately a flat, labelled region rather than a motherboard: the point
 * is *where things live*. Descriptor rings and mbufs are software-visible
 * structures in host RAM; the NIC reaches them only through PCIe, by DMA.
 *
 * Built in its own frame (centred on the origin, lying on the floor); the scene
 * places it. The rings keep the ids `rx-queue` / `tx-queue`, so packet routes,
 * the dataplane stages and the inspect panel address them unchanged.
 */
export function createHostMemory(kit) {
  const group = new THREE.Group();
  group.name = 'host-memory';
  const { w, d } = HOST_PANEL;
  const y = 0.03;
  const own = (m) => {
    m.userData.noHighlight = true;
    return kit.own(m);
  };
  const basic = (color, opacity) =>
    own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  const flat = (geometry, material, x, z, dy = 0) => {
    const m = new THREE.Mesh(geometry.rotateX(-Math.PI / 2), material);
    m.position.set(x, y + dy, z);
    m.renderOrder = 2;
    return m;
  };
  // Labels face the camera (sprites), so they read upright from the desktop and the
  // portrait Overview alike, on a dark backing like the page's other panels.
  const measure = document.createElement('canvas').getContext('2d');
  const labels = [];
  const tag = (text, { size = 0.5, weight = 600, color = INK, at }) => {
    const px = 112;
    const font = `${weight} ${Math.round(size * px)}px ${CANVAS_FONT}`;
    measure.font = font;
    const tw = measure.measureText(text).width;
    const pad = size * px * 0.45;
    const cw = Math.ceil(tw + pad * 2);
    const ch = Math.ceil(size * px * 1.55);
    const tex = kit.texture(
      canvasTexture(cw, ch, (ctx) => {
        ctx.fillStyle = 'rgba(14, 17, 22, 0.78)';
        ctx.beginPath();
        ctx.roundRect(0, 0, cw, ch, ch * 0.18);
        ctx.fill();
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, cw / 2, ch / 2 + 1);
      }),
    );
    const sprite = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })));
    sprite.scale.set(cw / px, ch / px, 1);
    sprite.position.copy(at);
    sprite.renderOrder = 4;
    // Kept between a readable size (~10px text) and one that does not swamp a close-up.
    labels.push({ sprite, w: cw / px, h: ch / px, minPx: 16 * (size / 0.42), maxPx: 34 * (size / 0.42) });
    return sprite;
  };

  // The region itself: a dim violet field with a firmer frame — memory, not a board.
  group.add(flat(new THREE.PlaneGeometry(w, d), basic(MEMORY, 0.06), 0, 0));
  const frame = new THREE.Shape();
  frame.moveTo(-w / 2, -d / 2).lineTo(w / 2, -d / 2).lineTo(w / 2, d / 2).lineTo(-w / 2, d / 2).lineTo(-w / 2, -d / 2);
  frame.holes.push(new THREE.Path().moveTo(-w / 2 + 0.05, -d / 2 + 0.05).lineTo(w / 2 - 0.05, -d / 2 + 0.05).lineTo(w / 2 - 0.05, d / 2 - 0.05).lineTo(-w / 2 + 0.05, d / 2 - 0.05));
  group.add(flat(new THREE.ShapeGeometry(frame), basic(MEMORY, 0.55), 0, 0, 0.001));
  group.add(tag('HOST MEMORY', { size: 0.62, weight: 700, color: '#cdbfff', at: new THREE.Vector3(-w / 2 + 2.0, 0.55, -d / 2 - 0.1) }));

  const components = [];
  const hitMat = kit.own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  const hitBox = (x, z, bw, bd) => {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.3, bd), hitMat);
    hit.position.set(x, 0.15, z);
    hit.userData.hitOnly = true;
    return hit;
  };

  // A descriptor ring: 8 slots around a circle. Three are "done" (a packet is waiting
  // in the buffer each one points at); the rest are empty descriptors, ready for DMA.
  const ring = (id, name, cx, cz, filled) => {
    const g = new THREE.Group();
    g.name = id;
    const r0 = 0.62;
    const r1 = 0.98;
    const slots = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
      const mat = basic(ACCENT, i < filled ? 0.75 : 0.18);
      const seg = flat(new THREE.RingGeometry(r0, r1, 10, 1, a + 0.05, Math.PI / 4 - 0.1), mat, cx, cz, 0.002);
      slots.push({ mat, base: mat.opacity });
      g.add(seg);
    }
    g.add(tag(name, { size: 0.42, at: new THREE.Vector3(cx, 0.3, cz + 1.35) }));
    const hit = hitBox(cx, cz, 2.2, 2.2);
    g.add(hit);
    group.add(g);
    components.push({
      id,
      object: g,
      hitObjects: [hit],
      anchors: {
        in: new THREE.Vector3(cx, 0.3, cz - r1),
        out: new THREE.Vector3(cx, 0.3, cz + r1),
        center: new THREE.Vector3(cx, 0.2, cz),
      },
      setHighlight: (level) => slots.forEach((s) => (s.mat.opacity = Math.min(0.95, s.base + 0.35 * level))),
    });
  };
  ring('rx-queue', 'RX ring', -2.75, 0.05, 3);
  ring('tx-queue', 'TX ring', -0.25, 0.05, 2);

  // Packet buffers (mbufs): what the descriptors point at. Three hold packets.
  {
    const g = new THREE.Group();
    g.name = 'host-mbufs';
    const cells = [];
    for (let i = 0; i < 6; i++) {
      const mat = basic(MEMORY, i < 3 ? 0.7 : 0.2);
      const col = i % 3;
      const row = Math.floor(i / 3);
      g.add(flat(new THREE.PlaneGeometry(0.62, 0.5), mat, 1.72 + col * 0.78, -0.34 + row * 0.66, 0.002));
      cells.push({ mat, base: mat.opacity });
    }
    g.add(tag('packet buffers', { size: 0.42, at: new THREE.Vector3(2.5, 0.3, 1.2) }));
    const hit = hitBox(2.5, 0, 2.6, 1.8);
    g.add(hit);
    group.add(g);
    components.push({
      id: 'host-mbufs',
      object: g,
      hitObjects: [hit],
      anchors: { in: new THREE.Vector3(1.4, 0.3, 0), out: new THREE.Vector3(3.6, 0.3, 0), center: new THREE.Vector3(2.5, 0.2, 0) },
      setHighlight: (level) => cells.forEach((c) => (c.mat.opacity = Math.min(0.95, c.base + 0.3 * level))),
    });
  }

  // The CPU core that runs DPDK sits OUTSIDE memory, beside it: part of the host, not
  // of RAM. It reaches the rings and buffers through the memory system (the grey tie)
  // and polls the RX ring for work.
  {
    const g = new THREE.Group();
    g.name = 'host-cpu';
    const cx = w / 2 + 1.35;
    const chipMat = basic(CPU, 0.35);
    g.add(flat(new THREE.PlaneGeometry(1.5, 1.5), chipMat, cx, 0, 0.002));
    g.add(flat(new THREE.PlaneGeometry(0.62, 0.62), basic(CPU, 0.55), cx, 0, 0.004));
    g.add(flat(new THREE.PlaneGeometry(0.55, 0.05), basic(CPU, 0.6), w / 2 + 0.3, 0, 0.002));
    g.add(tag('CPU · DPDK', { size: 0.42, color: '#c9d0d8', at: new THREE.Vector3(cx, 0.3, 1.25) }));
    const hit = hitBox(cx, 0, 1.7, 1.7);
    g.add(hit);
    group.add(g);
    components.push({
      id: 'host-cpu',
      object: g,
      hitObjects: [hit],
      anchors: { in: new THREE.Vector3(cx - 0.75, 0.3, 0), out: new THREE.Vector3(cx + 0.75, 0.3, 0), center: new THREE.Vector3(cx, 0.2, 0) },
      setHighlight: (level) => (chipMat.opacity = 0.35 + 0.4 * level),
    });
  }

  const _p = new THREE.Vector3();
  return {
    group,
    components,
    /**
     * Keep every label legible: it keeps its scene size while that falls between a
     * minimum and a maximum height in pixels, and is scaled to the nearer limit
     * otherwise — larger on a small phone, smaller in a close-up. The desktop and
     * portrait Overviews sit inside the band, so they are unchanged. Call once per frame.
     */
    fitLabels(camera, viewportHeight) {
      const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / viewportHeight;
      for (const l of labels) {
        const px = l.h / (perPx * l.sprite.getWorldPosition(_p).distanceTo(camera.position));
        const k = px < l.minPx ? l.minPx / px : px > l.maxPx ? l.maxPx / px : 1;
        l.sprite.scale.set(l.w * k, l.h * k, 1);
      }
    },
    /**
     * The PCIe / DMA link, from the card's edge connector to the host region, routed
     * around the card like a bus. Points are in world space; call after placement.
     */
    createLink(points, labelAt) {
      const link = new THREE.Group();
      link.name = 'pcie-dma-link';
      const curve = new THREE.CurvePath();
      for (let i = 0; i < points.length - 1; i++) curve.add(new THREE.LineCurve3(points[i], points[i + 1]));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.045, 6, false), basic(PCIE, 0.75));
      tube.renderOrder = 2;
      link.add(tube);
      link.add(tag('PCIe · DMA', { size: 0.5, weight: 700, color: '#f0c060', at: labelAt }));
      return link;
    },
  };
}

/** What the inspect panel says about the host side — ownership first, then mechanism. */
export const HOST_METADATA = {
  'rx-queue': {
    name: 'RX Descriptor Ring',
    designator: 'RXQ',
    category: 'Host memory',
    summary: 'A ring of descriptors in host RAM — not on the card. Each points at an empty buffer the NIC can fill.',
    description:
      'Software prepares the ring in host memory in advance: every descriptor points at a free packet buffer (an mbuf). ' +
      "The NIC's DMA engine writes a received packet into the next free buffer over PCIe and marks that descriptor done. " +
      'A DPDK worker core polls the ring with rte_eth_rx_burst() to collect the completed packets. ' +
      "What lives on the card is only the queue's hardware context — head/tail state and the DMA engine that follows it.",
    details: [
      ['Lives in', 'Host memory (RAM)'],
      ['Written by', 'NIC DMA engine, over PCIe'],
      ['Read by', 'DPDK worker core — rte_eth_rx_burst()'],
      ['On the NIC', 'Queue context + DMA engine'],
    ],
  },
  'tx-queue': {
    name: 'TX Descriptor Ring',
    designator: 'TXQ',
    category: 'Host memory',
    summary: 'A ring of descriptors in host RAM that point at packets waiting to be sent.',
    description:
      'Software writes descriptors that point at buffers already holding outgoing packets, then rings the doorbell — a tail-register write to the NIC over PCIe (rte_eth_tx_burst()). ' +
      'The NIC DMA-reads the packets from host memory, transmits them, and reports completion so the buffers can return to the mempool.',
    details: [
      ['Lives in', 'Host memory (RAM)'],
      ['Written by', 'DPDK worker core — rte_eth_tx_burst()'],
      ['Read by', 'NIC DMA engine, over PCIe'],
      ['Doorbell', 'Tail-register write to the NIC'],
    ],
  },
  'host-mbufs': {
    name: 'Packet Buffers (mbufs)',
    designator: 'MBUF',
    category: 'Host memory',
    summary: 'Pre-allocated buffers in host RAM where packet bytes actually land.',
    description:
      'A DPDK mempool allocates these buffers up front. On receive, the NIC writes the packet bytes straight into one by DMA — the CPU does not copy them in. ' +
      'The CPU then reads and processes the packet in place, and returns the buffer to the pool when it is done.',
    details: [
      ['Lives in', 'Host memory (RAM)'],
      ['Filled by', 'NIC DMA (receive)'],
      ['Allocated by', 'DPDK mempool'],
    ],
  },
  'host-cpu': {
    name: 'CPU Core · DPDK',
    designator: 'CPU',
    category: 'Host CPU',
    summary: 'A worker core that polls the rings and processes each packet.',
    description:
      'Instead of waiting for an interrupt, a DPDK worker core keeps polling the RX ring and picks up completed descriptors in batches. ' +
      'The CPU does real work here — parsing, lookups, forwarding, your application logic. What it does not do is copy packet bytes between the NIC and memory: that transfer is DMA.',
    details: [
      ['Runs', 'DPDK poll-mode driver + your application'],
      ['Receive API', 'rte_eth_rx_burst()'],
      ['Copies packet bytes?', 'No — the NIC DMAs them into mbufs'],
    ],
  },
};
