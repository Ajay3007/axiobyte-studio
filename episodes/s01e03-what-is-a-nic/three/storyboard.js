import * as THREE from 'three';
import { Ease } from '@axiobyte/three/core/tween.js';
import { brandMark, sectionLabel, sectionTitle, titleCard, endCard, scrim, vignette, fade, dim, progressBar, backdrop } from '@axiobyte/three/video/overlay/widgets/titles.js';
import { callout, chipRow, statBlock, phraseStack, codeChip, noteList, cardRow } from '@axiobyte/three/video/overlay/widgets/callouts.js';
import { flowRail, laneActivity, doorbell } from '@axiobyte/three/video/overlay/widgets/flow.js';
import { duplexDiagram, pairsDiagram, pam16Diagram, isolationDiagram, dspChain, offloadDiagram, recapFigure } from '@axiobyte/three/domains/networking/widgets/diagrams.js';
import { rssDiagram, dmaDiagram, descriptorRing, dpdkDiagram, comparison, archStack, hostFrame } from '@axiobyte/three/domains/networking/widgets/dataplane.js';
import { captionTrack } from '@axiobyte/three/video/overlay/widgets/captions.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { ZONES, TOP } from '@axiobyte/three/domains/networking/nic/layout.js';

/**
 * The score.
 *
 * Every time in this file comes from the recorded voiceover: `W('RSS')` is the
 * moment that word is spoken, `S(64)` is when sentence 64 begins. Nothing is
 * transcribed from the markdown script's headings — those were written for a
 * ~16 minute read and the take is 11:58 — so the visuals follow the audio, not
 * the other way round.
 *
 * Returns what the director needs: camera shots; the on-card animation lists
 * (highlights, heatsink, packet flights, queue zones, signal paths); the
 * overlay cues; and the section table the debug HUD reads.
 */
export function buildStoryboard({ timeline: tl, registry, captions = false, tail = 1.5 }) {
  const W = (phrase, after, before) => tl.wordTime(phrase, { after, before });
  const S = (i) => tl.sentenceStart(i);
  const E = (i) => tl.sentenceEnd(i);
  const audioEnd = tl.duration;
  const duration = audioEnd + tail;

  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const boxOf = (...ids) => {
    const b = new THREE.Box3();
    ids.forEach((id) => b.union(typeof id === 'string' ? registry.worldBox(id) : id));
    return b;
  };
  // The board area beside the controller where the queue zones used to be drawn. The
  // queues are no longer on the card (they are rings in host memory), but shots that
  // merely framed this area keep exactly the framing they had.
  const cardRoot = registry.get('nic-controller').object.parent;
  cardRoot.updateWorldMatrix(true, false);
  const beside = (key) =>
    new THREE.Box3(v(ZONES[key].x0, TOP, ZONES[key].z0), v(ZONES[key].x1, TOP + 0.14, ZONES[key].z1)).applyMatrix4(cardRoot.matrixWorld);
  // Just beyond the card's PCIe edge, where the packet waits while it is in host memory
  // (the AnimationDirector parks it there): framed with the connector so it stays in view.
  const hostSide = boxOf('pcie-connector').expandByPoint(registry.anchorWorld('pcie-connector', 'out').clone().add(v(0, -0.45, 1.9)));
  /** A framed look at some components from a given direction. */
  const look = (ids, dir, padding, extra = {}) => ({ box: boxOf(...ids), direction: dir, padding, ...extra });

  // ---------------------------------------------------------------- sections
  const SEC = {
    open: { index: '00', label: 'COLD OPEN', from: 0, to: S(5) - 0.4 },
    what: { index: '01', label: 'WHAT IS A NIC?', from: S(5) - 0.4, to: E(13) + 0.3 },
    pcb: { index: '02', label: 'ANATOMY · PCB', from: E(13) + 0.3, to: E(17) + 0.6 },
    rj45: { index: '02', label: 'ANATOMY · RJ45 PORTS', from: E(17) + 0.6, to: E(22) + 0.6 },
    mag: { index: '02', label: 'ANATOMY · MAGNETICS', from: E(22) + 0.6, to: E(27) + 0.6 },
    phy: { index: '02', label: 'ANATOMY · PHY', from: E(27) + 0.6, to: E(32) + 0.6 },
    ctl: { index: '02', label: 'ANATOMY · CONTROLLER', from: E(32) + 0.6, to: E(36) + 0.6 },
    hs: { index: '02', label: 'ANATOMY · HEATSINK', from: E(36) + 0.6, to: E(39) + 0.6 },
    pcie: { index: '02', label: 'ANATOMY · PCIe + BRACKET', from: E(39) + 0.6, to: E(44) + 0.5 },
    why: { index: '03', label: 'WHY A DEDICATED NIC?', from: E(44) + 0.5, to: E(52) + 0.5 },
    rx: { index: '04', label: 'RECEIVE PATH', from: E(52) + 0.5, to: E(88) + 0.2 },
    tx: { index: '05', label: 'TRANSMIT PATH', from: E(88) + 0.2, to: E(103) + 0.4 },
    fast: { index: '06', label: 'WHY IT IS FAST', from: E(103) + 0.4, to: E(110) + 0.4 },
    where: { index: '07', label: 'WHERE THESE CARDS LIVE', from: E(110) + 0.4, to: E(113) + 0.4 },
    outro: { index: '08', label: 'THE WHOLE PATH', from: E(113) + 0.4, to: duration },
  };
  const sections = Object.entries(SEC).map(([key, s]) => ({ key, ...s }));

  // The receive path is one chapter told in four phases. Each phase begins where its shot
  // does (storyboard/shots.yaml): midway through the silence before its first sentence,
  // the rule storyboard/windows.py cuts on. The chapter label names the current phase.
  const cutBefore = (i) => (E(i - 1) + S(i)) / 2;
  const RX_PHASES = [
    { label: SEC.rx.label, from: SEC.rx.from + 2.6 },
    { label: 'RSS', from: cutBefore(63) },
    { label: 'DMA + PCIe', from: cutBefore(68) },
    { label: 'RING + DPDK', from: cutBefore(77) },
  ];

  // ------------------------------------------------------------------ camera
  const shots = [
    // Cold open: wide, breathing, then a slow push as the narration lands.
    { at: 0, view: 'overview', padding: 0.88, transition: 0, motion: { orbit: 0.013, push: [1.12, 1.0], phi: -0.05 }, label: 'cold-open' },
    { at: S(2) - 0.6, view: 'overview', padding: 0.84, transition: 3.4, motion: { orbit: 0.011, push: [1.03, 0.92] }, label: 'open-push' },
    // Title: composition shifts the card right so the type owns the left third.
    { at: S(4) - 0.3, view: look(['nic-controller', 'phy', 'heatsink'], v(-0.55, 0.52, 0.85), 3.3), frame: [-0.24, 0.02], transition: 3.2, motion: { orbit: 0.009, push: [1.0, 0.93] }, label: 'title' },

    // 01 — what is a NIC
    { at: S(5) - 0.7, view: 'overview', padding: 0.95, transition: 2.6, motion: { orbit: 0.01, push: [1.02, 0.96] }, label: 'overview' },
    { at: W("the card we're looking at", 40) - 0.8, view: look(['bracket', 'pcie-connector', 'nic-controller'], v(-0.5, 0.72, 0.62), 0.96), transition: 3.0, motion: { orbit: -0.008, pan: [3.6, 0, 0], push: [1.0, 0.98] }, label: 'card-pan' },
    { at: S(9) - 0.8, view: 'overview', padding: 1.46, frame: [0.24, 0], transition: 2.8, motion: { orbit: 0.011 }, label: 'duplex' },
    { at: W('10 gigabits per second', 60) - 1.2, view: 'overview', padding: 1.4, frame: [0.2, 0], transition: 2.6, motion: { orbit: 0.009, push: [1.0, 0.96] }, label: 'rate' },

    // 02.1 — PCB
    { at: E(13) - 0.9, view: 'top', padding: 1.16, transition: 2.6, motion: { orbit: 0.006, pan: [2.4, 0, 0], push: [1.02, 0.95] }, label: 'pcb-top' },
    { at: W('trace lengths and spacing', 92) - 1.4, view: look(['phy', 'nic-controller', 'magnetics-1'], v(0.05, 0.97, 0.22), 2.35), frame: [0.24, 0], transition: 3.0, motion: { orbit: 0.007, push: [1.02, 0.94] }, label: 'pcb-detail' },

    // 02.2 — RJ45
    { at: S(18) - 1.1, view: look(['rj45-1', 'rj45-2'], v(-0.86, 0.42, 0.5), 1.75), transition: 2.6, motion: { orbit: 0.008, push: [1.06, 0.96] }, label: 'ports' },
    { at: W('eight gold contacts', 110) - 0.9, view: look(['rj45-1'], v(-0.88, 0.34, 0.36), 3.6), frame: [0.26, 0], transition: 2.4, motion: { orbit: 0.006, push: [1.04, 0.95] }, label: 'port1-macro' },
    { at: W('PAM16', 125) - 3.2, view: look(['rj45-1', 'rj45-2'], v(-0.8, 0.5, 0.55), 2.65), frame: [0.26, 0], transition: 3.0, motion: { orbit: 0.007 }, label: 'ports-pam' },
    { at: W('two LEDs', 133) - 1.0, view: look(['rj45-1', 'rj45-2'], v(-0.95, 0.24, 0.18), 2.0), frame: [-0.08, 0], transition: 2.4, motion: { orbit: -0.006, push: [1.02, 0.92] }, label: 'leds' },

    // 02.3 — magnetics (viewed from above and the board side; the port shell
    // hides the transformers completely from the bracket side)
    { at: S(23) - 1.4, view: look(['magnetics-1'], v(0.12, 0.8, 0.5), 4.6), transition: 2.8, motion: { orbit: 0.008, push: [1.05, 0.95] }, label: 'magnetics' },
    { at: W('galvanically', 155) - 1.2, view: look(['magnetics-1', 'magnetics-2', 'rj45-1'], v(0.12, 0.86, 0.46), 2.3), frame: [0.26, 0], transition: 3.0, motion: { orbit: 0.007 }, label: 'magnetics-wide' },

    // 02.4 — PHY (heatsink lifts)
    { at: S(28) - 2.2, view: look(['heatsink', 'phy'], v(-0.62, 0.5, 0.72), 2.05), transition: 2.8, motion: { orbit: 0.007, push: [1.06, 0.98] }, label: 'heatsink-lift' },
    { at: S(28) + 1.4, view: look(['heatsink', 'phy'], v(-0.56, 0.3, 0.76), 1.62), transition: 3.0, motion: { orbit: 0.006, push: [1.05, 0.95] }, label: 'phy-macro' },
    { at: W('on receive', 180) - 0.8, view: look(['heatsink', 'phy'], v(-0.5, 0.34, 0.74), 2.5), frame: [0.26, 0], transition: 2.8, motion: { orbit: 0.006 }, label: 'phy-dsp' },
    { at: W('runs hot', 202) - 1.0, view: look(['phy', 'heatsink'], v(-0.72, 0.46, 0.6), 2.05), frame: [0.06, 0], transition: 2.6, motion: { orbit: -0.007, push: [1.0, 0.95] }, label: 'phy-thermal' },

    // 02.5 — controller
    { at: S(33) - 1.5, view: look(['nic-controller'], v(-0.35, 0.85, 0.55), 2.5), transition: 2.8, motion: { orbit: 0.008, push: [1.08, 0.97] }, label: 'controller' },
    { at: W("checks the frame's checksum", 219) - 1.0, view: look(['nic-controller'], v(-0.38, 0.8, 0.58), 3.5), frame: [0.26, 0], transition: 2.8, motion: { orbit: 0.006, push: [1.03, 0.95] }, label: 'controller-detail' },
    { at: W('offload logic', 234) - 1.2, view: look(['nic-controller', beside('rx'), beside('tx')], v(-0.36, 0.86, 0.5), 2.35), frame: [0.26, 0], transition: 2.8, motion: { orbit: 0.006 }, label: 'controller-offload' },

    // 02.6 — heatsink
    { at: S(37) - 1.2, view: look(['heatsink'], v(-0.78, 0.36, 0.56), 2.3), transition: 2.6, motion: { orbit: 0.009, push: [1.05, 0.94], phi: 0.08 }, label: 'heatsink' },
    { at: W('airflow moving', 263) - 1.0, view: look(['heatsink'], v(-0.95, 0.18, 0.28), 2.45), frame: [0.24, 0], transition: 2.6, motion: { orbit: 0.008 }, label: 'heatsink-fins' },

    // 02.7 — PCIe + bracket
    { at: S(40) - 1.3, view: 'pcie', padding: 2.0, transition: 2.8, motion: { orbit: 0.007, push: [1.1, 0.95] }, label: 'pcie' },
    { at: W('only connection', 274) - 1.0, view: look(['pcie-connector'], v(0.16, 0.58, 0.95), 2.25), frame: [0.26, 0], transition: 2.8, motion: { orbit: 0.005, push: [1.02, 0.95] }, label: 'pcie-macro' },
    { at: S(43) - 1.5, view: 'rear', padding: 1.2, transition: 2.8, motion: { orbit: 0.008, push: [1.06, 0.96] }, label: 'bracket' },

    // 03 — why a dedicated NIC
    { at: SEC.why.from - 0.6, view: 'overview', padding: 1.3, frame: [0, 0.16], transition: 3.0, motion: { orbit: 0.009, push: [1.02, 0.96] }, label: 'why' },
    { at: S(52) - 0.6, view: 'front', padding: 1.06, transition: 3.2, motion: { orbit: 0.008, push: [1.05, 0.97] }, label: 'to-rx' },

    // 04 — receive
    { at: S(54) - 1.6, view: look(['bracket', 'rj45-1'], v(-0.92, 0.34, 0.4), 1.42), transition: 3.0, motion: { orbit: 0.006, push: [1.08, 0.98], pan: [-0.6, 0, 0] }, label: 'rx-cable' },
    { at: S(56) - 1.2, view: look(['rj45-1', 'magnetics-1'], v(-0.74, 0.5, 0.5), 2.1), transition: 2.6, motion: { orbit: 0.006, push: [1.04, 0.95] }, label: 'rx-port' },
    { at: S(58) - 1.4, view: look(['phy', 'heatsink'], v(-0.6, 0.34, 0.72), 1.9), transition: 2.6, motion: { orbit: 0.006, push: [1.05, 0.95] }, label: 'rx-phy' },
    { at: S(60) - 1.2, view: look(['nic-controller'], v(-0.4, 0.78, 0.6), 2.8), transition: 2.6, motion: { orbit: 0.006, push: [1.05, 0.96] }, label: 'rx-mac' },
    { at: W('RSS', 385) - 3.0, view: look(['nic-controller', beside('rx')], v(-0.36, 0.84, 0.52), 2.6), frame: [0.26, 0], transition: 3.0, motion: { orbit: 0.005 }, label: 'rx-rss' },
    { at: S(68) - 1.6, view: look(['nic-controller', 'pcie-connector'], v(-0.3, 0.74, 0.7), 1.95), frame: [0.26, 0], transition: 3.0, motion: { orbit: 0.005, push: [1.03, 0.96] }, label: 'rx-dma' },
    { at: S(73) - 1.6, view: look(['pcie-connector'], v(0.18, 0.5, 0.96), 2.35), frame: [0.26, 0], transition: 3.0, motion: { orbit: 0.005, push: [1.05, 0.95] }, label: 'rx-pcie' },
    // The ring lives in host memory: look at where the data leaves the card for it.
    { at: S(77) - 1.8, view: look(['pcie-connector', 'nic-controller'], v(-0.42, 0.8, 0.58), 2.2), frame: [0.27, 0], transition: 3.2, motion: { orbit: 0.005 }, label: 'rx-ring' },
    { at: S(83) - 1.6, view: 'overview', padding: 1.6, frame: [0.27, 0], transition: 3.2, motion: { orbit: 0.008, push: [1.02, 0.97] }, label: 'rx-dpdk' },
    { at: S(87) - 1.4, view: 'overview', padding: 1.15, frame: [-0.14, 0], transition: 2.8, motion: { orbit: 0.009, push: [1.03, 0.95] }, label: 'rx-nocopy' },

    // 05 — transmit
    { at: S(89) - 1.2, view: look([beside('tx'), beside('rx'), 'nic-controller'], v(-0.4, 0.82, 0.55), 2.2), frame: [0.24, 0], transition: 3.0, motion: { orbit: 0.006, push: [1.06, 0.97] }, label: 'tx-queues' },
    // The TX ring is in host memory too: descriptors reach the card across PCIe.
    { at: S(93) - 1.2, view: look([hostSide], v(-0.4, 0.82, 0.55), 1.7), frame: [0.24, 0], transition: 2.6, motion: { orbit: 0.005, push: [1.04, 0.95] }, label: 'tx-ring' },
    { at: W('writes to a doorbell register', 545) - 1.6, view: look(['nic-controller', beside('tx')], v(-0.34, 0.82, 0.56), 2.4), frame: [0.24, 0], transition: 2.8, motion: { orbit: 0.005 }, label: 'tx-doorbell' },
    { at: S(95) - 1.2, view: look(['nic-controller', 'pcie-connector'], v(-0.3, 0.72, 0.72), 2.0), frame: [0.24, 0], transition: 2.8, motion: { orbit: 0.005, push: [1.03, 0.96] }, label: 'tx-dma' },
    { at: S(98) - 1.2, view: look(['phy', 'magnetics-1', 'rj45-1'], v(-0.78, 0.5, 0.5), 1.9), frame: [0.2, 0], transition: 2.8, motion: { orbit: 0.006, push: [1.04, 0.95] }, label: 'tx-phy' },
    { at: S(99) + 5.4, view: look(['bracket', 'rj45-1'], v(-0.94, 0.3, 0.38), 1.45), transition: 2.8, motion: { orbit: 0.006, push: [1.02, 0.97], pan: [-0.6, 0, 0] }, label: 'tx-cable' },
    { at: S(103) - 1.6, view: 'overview', padding: 1.5, frame: [0, 0.26], transition: 3.2, motion: { orbit: 0.008 }, label: 'tx-symmetry' },

    // 06 — why it is fast
    { at: SEC.fast.from - 0.8, view: 'overview', padding: 1.76, frame: [0.14, 0.23], transition: 3.2, motion: { orbit: 0.008, push: [1.02, 0.97] }, label: 'recap' },

    // 07 — where
    { at: SEC.where.from - 0.8, view: 'overview', padding: 1.44, frame: [0.26, 0], transition: 3.2, motion: { orbit: 0.009, push: [1.03, 0.96] }, label: 'where' },

    // 08 — outro
    { at: SEC.outro.from - 0.8, view: look(['nic-controller', 'phy', 'rj45-1'], v(-0.62, 0.55, 0.72), 2.7), frame: [0.28, 0], transition: 3.2, motion: { orbit: 0.007, push: [1.04, 0.96] }, label: 'outro-stack' },
    { at: W('all built', 703), view: 'overview', padding: 1.5, frame: [0.1, 0], transition: 4.0, motion: { orbit: 0.008, push: [1.0, 1.06] }, label: 'outro-wide' },
    { at: W('thanks for watching', 710) - 0.6, view: 'overview', padding: 2.35, frame: [0, -0.15], transition: 3.0, motion: { orbit: 0.006, push: [1.0, 1.05] }, label: 'end' },
  ];

  // --------------------------------------------------------- card animation
  const highlights = [
    { id: 'rj45-1', from: S(18), to: W('PAM16', 125) + 1.0, level: 0.9 },
    { id: 'rj45-2', from: W('squeeze 10 gigabits', 128), to: E(22), level: 0.85 },
    { id: 'rj45-1', from: W('two LEDs', 133), to: E(22), level: 0.8 },
    { id: 'magnetics-1', from: S(23), to: E(27), level: 1.0 },
    { id: 'magnetics-2', from: W('galvanically', 155), to: E(27), level: 0.55 },
    { id: 'heatsink', from: S(28) - 2.0, to: S(28) + 1.0, level: 0.45 },
    { id: 'phy', from: S(28) + 0.4, to: E(32), level: 1.0 },
    { id: 'nic-controller', from: S(33), to: E(36), level: 1.0 },
    { id: 'heatsink', from: S(37), to: E(39), level: 0.5 },
    { id: 'pcie-connector', from: S(40), to: E(42) + 0.4, level: 1.0 },
    { id: 'bracket', from: S(43), to: E(44), level: 0.45 },

    // Receive: each component lights as the packet reaches it.
    { id: 'rj45-1', from: S(56), to: S(58), level: 0.95 },
    { id: 'magnetics-1', from: S(56) + 2.6, to: S(58) + 0.5, level: 0.9 },
    { id: 'heatsink', from: S(58) - 1.6, to: S(58) + 0.6, level: 0.35 },
    { id: 'phy', from: S(58), to: S(60) + 0.6, level: 1.0 },
    { id: 'nic-controller', from: S(60), to: S(73), level: 1.0 },
    { id: 'pcie-connector', from: S(68) + 2.0, to: S(77), level: 1.0 },
    // The ring is in host memory: the card's gateway to it stays lit instead.
    { id: 'pcie-connector', from: S(77) - 1.0, to: S(83) + 1.0, level: 0.9 },

    // Transmit.
    { id: 'pcie-connector', from: S(93) + 0.4, to: S(95), level: 0.8 },
    { id: 'nic-controller', from: W('writes to a doorbell register', 545), to: S(98), level: 1.0 },
    { id: 'pcie-connector', from: S(95), to: S(97), level: 0.85 },
    { id: 'phy', from: S(98) - 0.6, to: S(99) + 5.0, level: 0.95 },
    { id: 'magnetics-1', from: S(99) + 3.0, to: S(99) + 6.0, level: 0.8 },
    { id: 'rj45-1', from: S(99) + 4.5, to: S(99) + 11.0, level: 0.95 },
  ];

  // Heatsink: lifts for the PHY section, again briefly on the receive path.
  const heatsink = [
    { t: S(28) - 2.6, v: 0 },
    { t: S(28) + 1.1, v: 1 },
    { t: W('runs hot', 202) + 1.6, v: 1 },
    { t: E(32) + 0.4, v: 0 },
    { t: S(58) - 2.2, v: 0 },
    { t: S(58) + 0.4, v: 1 },
    { t: S(60) - 1.4, v: 1 },
    { t: S(60) + 1.4, v: 0 },
  ];

  const flights = [
    {
      route: 'rx',
      travel: 1.6,
      stops: [
        { at: S(54) + 1.2, travel: 2.4 }, // out on the cable
        { at: S(56) + 1.6 }, // rj45-1
        { at: S(56) + 3.9, travel: 1.4 }, // magnetics-1
        { at: S(58) + 1.9 }, // phy
        { at: S(60) + 1.9, travel: 1.9 }, // controller
        { at: S(68) + 2.4, travel: 1.7 }, // dma engine
        { at: S(73) + 2.8, travel: 1.9 }, // pcie connector
        { at: S(77) + 2.8, travel: 2.1 }, // rx queue
      ],
      end: S(83) + 2.0,
    },
    {
      route: 'tx',
      travel: 1.6,
      stops: [
        { at: S(93) + 1.4, travel: 2.2 }, // tx queue
        { at: S(95) + 0.4, travel: 1.9 }, // pcie
        { at: S(95) + 2.4, travel: 1.4 }, // dma read
        { at: S(95) + 4.0, travel: 1.4 }, // controller
        { at: S(98) + 2.6, travel: 1.9 }, // phy
        { at: S(99) + 3.6, travel: 1.5 }, // magnetics
        { at: S(99) + 5.4, travel: 1.3 }, // rj45
        { at: S(99) + 8.0, travel: 1.9 }, // out on the cable
      ],
      end: S(99) + 11.5,
    },
  ];

  // No descriptor slots on the card: the rings are in host memory, and the film shows
  // them there (descriptorRing inside hostFrame), not on the PCB.
  const zones = [];

  const signals = [
    { from: W('every trace', 85), to: W('trace lengths and spacing', 92), keys: { front: 1 }, speed: 0.26, pulse: 1 },
    { from: W('trace lengths and spacing', 92), to: E(17), keys: { front: 0.45, core: 1, host: 0.8 }, speed: 0.3, pulse: 1 },
    { from: W('host computer\'s memory', 226), to: E(35), keys: { core: 0.5, host: 1 }, speed: 0.4, pulse: 1 },
    { from: S(40), to: E(42), keys: { host: 1 }, speed: 0.35, pulse: 1 },
    { from: S(56), to: S(60), keys: { front: 1 }, speed: 0.45, pulse: 1 },
    { from: S(60), to: S(68), keys: { core: 1, front: 0.3 }, speed: 0.4, pulse: 0.9 },
    { from: S(68), to: S(77), keys: { host: 1, core: 0.35 }, speed: 0.45, pulse: 1 },
    { from: S(95), to: S(98), keys: { host: 1, core: 0.6 }, speed: -0.42, pulse: 1 },
    { from: S(98), to: S(99) + 7.5, keys: { core: 0.7, front: 1 }, speed: -0.45, pulse: 1 },
  ];

  // ----------------------------------------------------------- overlay cues
  /**
   * Rail index at time t: hold on a stage, then ease across to the next one
   * over `travel` seconds, arriving exactly when the narration names it. Same
   * shape as the 3D packet's motion, so the pill and the token move together.
   */
  const railTravel = (times, travel = 1.5) => (t) => {
    if (t < times[0] - travel) return -1;
    for (let i = 0; i < times.length; i++) {
      if (t < times[i]) {
        if (i === 0) return 0;
        return i - 1 + Ease.inOutCubic(Math.min(1, Math.max(0, (t - (times[i] - travel)) / travel)));
      }
    }
    return times.length - 1;
  };

  const RX_RAIL = ['CABLE', 'RJ45', 'MAGNETICS', 'PHY', 'MAC', 'RSS', 'DMA', 'PCIe', 'RING', 'DPDK', 'APP'];
  const rxRailTimes = [
    S(54) + 1.4,
    S(56) + 1.8,
    S(56) + 4.1,
    S(58) + 2.1,
    S(60) + 2.1,
    W('RSS', 385) + 0.4,
    S(68) + 2.6,
    S(73) + 3.0,
    S(77) + 3.0,
    W('DPDK', 486) + 0.6,
    W('hands your application the packets', 504) + 0.8,
  ];

  const TX_RAIL = ['APP', 'TX RING', 'DOORBELL', 'PCIe', 'CONTROLLER', 'DMA READ', 'PHY', 'RJ45', 'CABLE'];
  const txRailTimes = [S(90) + 1.0, S(93) + 1.6, W('writes to a doorbell register', 545) + 0.9, S(95) + 0.6, S(95) + 2.6, S(95) + 4.2, S(98) + 2.8, S(99) + 5.6, S(99) + 8.2];

  // Right-hand content column and its backing card. Diagrams have to stay
  // readable over a brightly lit PCB, so every right-side block gets a
  // surface rather than relying on whatever happens to be behind it.
  const RX0 = 984;
  const rpanel = (start, end, y, h, { x = 950, w = 858, ...rest } = {}) => backdrop({ start, end, rect: [x, y, w, h], ...rest });
  const lpanel = (start, end, y, h, { x = 88, w = 620, ...rest } = {}) => backdrop({ start, end, rect: [x, y, w, h], ...rest });

  const cues = [
    fade({ start: 0, end: 1.6, hold: 'in' }),
    vignette({ start: 0.4, end: duration, strength: 0.44 }),
    brandMark({ start: 2.4, end: W('thanks for watching', 710) - 1.0 }),
    progressBar({ start: 3.0, end: W('thanks for watching', 710) - 1.0, duration: audioEnd }),

    // ------------------------------------------------------------ cold open
    callout({
      start: W('network interface card', 8) - 0.6,
      end: S(2) - 0.5,
      title: 'NETWORK INTERFACE CARD',
      subtitle: 'the part that puts a packet on a wire',
      at: [112, 812],
      width: 540,
    }),
    scrim({ start: 21.2, end: 31.2, side: 'left', strength: 0.82 }),
    titleCard({
      start: 21.8,
      end: 31.0,
      kicker: 'AXIOBYTE · HARDWARE',
      title: 'WHAT IS A NIC?',
      sub: 'From copper and transformers to DMA and DPDK',
    }),

    // --------------------------------------------------------- 01 what is it
    sectionLabel({ start: SEC.what.from + 0.6, end: SEC.what.to, index: SEC.what.index, label: SEC.what.label }),
    noteList({
      start: S(6) - 0.3,
      end: S(8) - 0.4,
      at: [112, 700],
      title: 'ALL OF THESE ARE NICs',
      items: ['a laptop Wi-Fi chip', 'the RJ45 jack on a desktop', 'this dual-port PCIe server card'],
      step: 2.9,
      width: 460,
    }),
    chipRow({
      start: W('PCIe expansion card', 44) - 0.4,
      end: S(9) - 0.5,
      at: [1520, 300],
      items: ['PCIe EXPANSION CARD', '2 × COPPER ETHERNET', 'BUILT FOR SERVERS'],
      step: 2.1,
      align: 'right',
    }),
    rpanel(S(9) - 0.3, W('10 gigabits per second', 60) - 0.6, 288, 296),
    duplexDiagram({ start: S(9) - 0.2, end: W('10 gigabits per second', 60) - 0.6, at: [RX0, 334] }),
    rpanel(W('10 gigabits per second', 60) - 0.5, E(12) + 0.4, 268, 330, { x: 1268, w: 540 }),
    statBlock({
      start: W('10 gigabits per second', 60) - 0.4,
      end: E(12) + 0.4,
      at: [1768, 344],
      align: 'right',
      items: [
        { value: '10', unit: 'Gb/s', label: 'per port, each direction' },
        { value: '14.88 M', label: 'packets per second, worst case' },
      ],
    }),

    // ------------------------------------------------------------ 02.1 PCB
    sectionTitle({ start: E(13) - 1.6, end: E(13) + 3.4, index: 'CHAPTER 02', title: 'ANATOMY OF THE CARD' }),
    sectionLabel({ start: SEC.pcb.from + 2.6, end: SEC.pcie.to, index: '02', label: 'ANATOMY OF THE CARD' }),
    callout({
      start: S(14) + 0.3,
      end: W('every trace', 85) - 0.3,
      title: 'PCB',
      subtitle: 'the signal path, not just a mounting surface',
      at: [112, 800],
      width: 520,
    }),
    rpanel(W('controlled impedance', 87) - 0.5, E(17) + 0.3, 292, 276),
    noteList({
      start: W('controlled impedance', 87) - 0.4,
      end: E(17) + 0.3,
      at: [RX0 + 26, 338],
      title: 'WHY THE COPPER MATTERS',
      items: ['controlled impedance on every pair', 'matched lengths inside a pair', 'reference planes and stitching vias'],
      step: 2.6,
      width: 560,
    }),

    // ----------------------------------------------------------- 02.2 RJ45
    callout({
      start: S(18) + 0.3,
      end: W('eight gold contacts', 110) - 0.4,
      title: 'RJ45 PORT',
      subtitle: 'shielded 8P8C jack',
      at: [112, 800],
      anchorTo: { id: 'rj45-1', name: 'center' },
      width: 400,
    }),
    rpanel(W('eight gold contacts', 110) - 0.6, W('PAM16', 125) - 2.6, 286, 350, { x: 1040, w: 768 }),
    pairsDiagram({ start: W('eight gold contacts', 110) - 0.5, end: W('PAM16', 125) - 2.6, at: [1104, 334] }),
    rpanel(W('PAM16', 125) - 2.5, W('two LEDs', 133) - 0.8, 256, 468, { x: 1040, w: 768 }),
    pam16Diagram({ start: W('PAM16', 125) - 2.4, end: W('two LEDs', 133) - 0.8, at: [1104, 300] }),
    callout({
      start: W('green for link', 137) - 0.4,
      end: E(22) + 0.3,
      title: 'LINK',
      subtitle: 'negotiated connection',
      at: [112, 700],
      color: C.green,
      width: 360,
    }),
    callout({
      start: W('amber flickering', 141) - 0.4,
      end: E(22) + 0.3,
      title: 'ACTIVITY',
      subtitle: 'frames actually moving',
      at: [112, 812],
      color: C.amber,
      width: 360,
    }),

    // ------------------------------------------------------ 02.3 magnetics
    callout({
      start: S(23) + 0.4,
      end: W('galvanically', 155) - 0.4,
      title: 'LAN MAGNETICS',
      subtitle: 'isolation transformers, one per pair',
      at: [112, 800],
      anchorTo: { id: 'magnetics-1', name: 'center' },
      width: 500,
    }),
    rpanel(W('galvanically', 155) - 0.6, E(27) + 0.3, 252, 372),
    isolationDiagram({ start: W('galvanically', 155) - 0.5, end: E(27) + 0.3, at: [RX0, 304] }),

    // ------------------------------------------------------------ 02.4 PHY
    callout({
      start: S(28) + 0.6,
      end: W('on receive', 180) - 0.5,
      title: 'PHY',
      subtitle: '10GBASE-T physical layer',
      at: [112, 800],
      anchorTo: { id: 'phy', name: 'center' },
      width: 420,
    }),
    rpanel(W('on receive', 180) - 0.5, W('on transmit', 194) - 0.5, 172, 566),
    dspChain({
      start: W('on receive', 180) - 0.4,
      end: W('on transmit', 194) - 0.5,
      at: [RX0, 218],
      title: 'PHY RECEIVE CHAIN',
      stages: [
        { title: 'ANALOG WAVEFORM', sub: 'off the cable', soft: true },
        { title: 'ECHO CANCELLATION', sub: 'same pair, both directions' },
        { title: 'CROSSTALK CANCELLATION', sub: 'pair to pair' },
        { title: 'ERROR-CORRECTING DECODE', sub: 'recover the symbols' },
        { title: 'CLEAN BITS', sub: 'handed to the MAC', soft: true },
      ],
    }),
    rpanel(W('on transmit', 194) - 0.5, W('runs hot', 202) - 0.6, 288, 390),
    dspChain({
      start: W('on transmit', 194) - 0.4,
      end: W('runs hot', 202) - 0.6,
      at: [RX0, 334],
      title: 'PHY TRANSMIT CHAIN',
      color: C.amber,
      stages: [
        { title: 'DIGITAL BITS', sub: 'from the MAC', soft: true },
        { title: 'PAM-16 SHAPING', sub: '16 levels per symbol' },
        { title: 'LINE DRIVER', sub: 'onto four pairs' },
      ],
    }),
    callout({
      start: W('runs hot', 202) - 0.2,
      end: E(32) + 0.3,
      title: 'RUNS HOT',
      subtitle: 'which is why it sits under the heatsink',
      at: [112, 800],
      color: C.amber,
      width: 520,
    }),

    // ----------------------------------------------------- 02.5 controller
    callout({
      start: S(33) + 0.4,
      end: W("checks the frame's checksum", 219) - 0.4,
      title: 'NIC CONTROLLER',
      subtitle: 'Ethernet MAC and packet engine',
      at: [112, 800],
      anchorTo: { id: 'nic-controller', name: 'center' },
      width: 520,
    }),
    rpanel(W('checksum', 220) - 0.5, W('offload logic', 234) - 0.5, 268, 244, { x: 1080, w: 728 }),
    chipRow({ start: W('checksum', 220) - 0.4, end: W('offload logic', 234) - 0.5, at: [1130, 300], items: ['FRAME CHECKSUM'], step: 0 }),
    chipRow({ start: W('receive queue', 222) - 0.4, end: W('offload logic', 234) - 0.5, at: [1130, 366], items: ['RX QUEUE SELECTION'], step: 0 }),
    chipRow({ start: W("host computer's memory", 226) - 0.4, end: W('offload logic', 234) - 0.5, at: [1130, 432], items: ['DMA TO HOST MEMORY'], step: 0 }),
    rpanel(W('offload logic', 234) - 0.5, E(36) + 0.3, 208, 452),
    offloadDiagram({
      start: W('offload logic', 234) - 0.4,
      end: E(36) + 0.3,
      at: [RX0, 254],
      items: ['CHECKSUM', 'SEGMENTATION', 'VLAN TAGGING'],
    }),

    // ------------------------------------------------------- 02.6 heatsink
    callout({
      start: S(37) + 0.3,
      end: W('airflow moving', 263) - 0.5,
      title: 'HEATSINK',
      subtitle: 'anodised aluminium, spring push pins',
      at: [112, 800],
      anchorTo: { id: 'heatsink', name: 'center' },
      width: 520,
    }),
    rpanel(W('airflow moving', 263) - 0.5, E(39) + 0.4, 342, 268),
    noteList({
      start: W('airflow moving', 263) - 0.4,
      end: E(39) + 0.4,
      at: [RX0 + 26, 388],
      title: 'PASSIVE COOLING',
      items: ['fins aligned with chassis airflow', 'constant pressure as the board flexes', 'no fan on the card'],
      step: 0.9,
      width: 520,
    }),

    // ---------------------------------------------------- 02.7 PCIe/bracket
    callout({
      start: S(40) + 0.4,
      end: W('only connection', 274) - 0.4,
      title: 'PCIe x8 EDGE CONNECTOR',
      subtitle: 'the card’s only link to the host',
      at: [112, 800],
      anchorTo: { id: 'pcie-connector', name: 'center' },
      color: C.gold,
      width: 560,
    }),
    rpanel(W('only connection', 274) - 0.4, E(42) + 0.3, 320, 248, { x: 1180, w: 628 }),
    laneActivity({ start: W('only connection', 274) - 0.3, end: E(42) + 0.3, at: [1290, 386], color: C.gold, width: 420 }),
    callout({
      start: S(43) + 0.4,
      end: E(44) + 0.3,
      title: 'I/O BRACKET',
      subtitle: 'chassis mount and shield ground',
      at: [112, 800],
      anchorTo: { id: 'bracket', name: 'center' },
      width: 480,
    }),

    // --------------------------------------------------- 03 why a real NIC
    sectionTitle({ start: SEC.why.from - 1.0, end: SEC.why.from + 3.4, index: 'CHAPTER 03', title: 'WHY A DEDICATED NIC?' }),
    sectionLabel({ start: SEC.why.from + 2.8, end: SEC.why.to, index: SEC.why.index, label: SEC.why.label }),
    scrim({ start: W('three reasons', 303) - 0.8, end: S(52) - 0.2, side: 'bottom', strength: 0.72 }),
    cardRow({
      start: W('three reasons', 303) - 0.5,
      end: S(52) - 0.3,
      at: [376, 700],
      step: 1.4,
      cards: [
        { title: 'THROUGHPUT', sub: 'far more traffic than an', sub2: 'onboard controller' },
        { title: 'OFFLOAD', sub: 'repetitive work moves into', sub2: 'the card’s silicon' },
        { title: 'CONTROL', sub: 'an application can drive it', sub2: 'directly, bypassing the stack' },
      ],
      activeAt: (t) => (t < W('a dedicated nic', 308) ? -1 : t < W('takes real work off', 313) ? 0 : t < W('driven directly by an application', 318) - 2.2 ? 1 : 2),
    }),

    // -------------------------------------------------------- 04 receive
    sectionTitle({ start: SEC.rx.from - 1.4, end: SEC.rx.from + 3.2, index: 'CHAPTER 04', title: 'HOW A PACKET IS RECEIVED' }),
    ...RX_PHASES.map((phase, i) =>
      sectionLabel({ start: phase.from, end: RX_PHASES[i + 1]?.from ?? SEC.rx.to, index: SEC.rx.index, label: phase.label }),
    ),
    flowRail({ start: S(54) - 0.4, end: E(88) + 0.1, stages: RX_RAIL, positionAt: railTravel(rxRailTimes, 1.5), label: 'RECEIVE PATH' }),

    callout({ start: S(54) + 0.3, end: S(56) - 0.4, title: 'THE CABLE', subtitle: 'four twisted pairs, analog waveform', at: [112, 700], width: 520 }),
    callout({ start: S(56) + 0.3, end: S(58) - 0.4, title: 'RJ45 → MAGNETICS', subtitle: 'through the isolation transformers', at: [112, 700], width: 520 }),
    callout({ start: S(58) + 0.3, end: S(60) - 0.4, title: 'PHY', subtitle: 'waveform decoded back into bits', at: [112, 700], anchorTo: { id: 'phy', name: 'center' }, width: 460 }),
    callout({
      start: S(60) + 0.3,
      end: W('multiple receive queues', 376) - 0.6,
      title: 'MAC / CONTROLLER',
      subtitle: 'validate the frame, then pick a queue',
      at: [112, 700],
      anchorTo: { id: 'nic-controller', name: 'center' },
      width: 540,
    }),
    chipRow({
      start: W('multiple receive queues', 376) - 0.4,
      end: W('RSS', 385) - 1.4,
      at: [112, 700],
      items: ['MANY RX QUEUES PER PORT', 'ONE QUEUE PER CPU CORE'],
      step: 1.9,
      size: 22,
    }),
    rpanel(W('RSS', 385) - 2.3, S(68) - 0.5, 124, 534),
    rssDiagram({
      start: W('RSS', 385) - 2.2,
      end: S(68) - 0.5,
      at: [RX0, 172],
      selected: 3,
      footerAt: W('same flow same hash', 398) - (W('RSS', 385) - 2.2),
    }),
    rpanel(S(68) + 1.3, S(73) - 0.5, 220, 440),
    dmaDiagram({ start: S(68) + 1.4, end: S(73) - 0.5, at: [RX0, 266] }),
    callout({
      start: W('direct memory access', 420) - 0.4,
      end: S(73) - 0.5,
      title: 'DMA',
      subtitle: 'Direct Memory Access',
      at: [112, 700],
      width: 420,
    }),
    callout({ start: S(73) + 0.6, end: S(77) - 0.5, title: 'PCIe MEMORY WRITES', subtitle: 'eight lanes, into host memory', at: [112, 668], color: C.gold, width: 540 }),
    rpanel(S(73) + 1.1, S(77) - 0.5, 196, 246, { x: 1150, w: 658 }),
    laneActivity({ start: S(73) + 1.2, end: S(77) - 0.5, at: [1258, 262], color: C.gold, width: 430 }),
    rpanel(W('7.9 gigabytes', 442) - 0.6, S(77) - 0.5, 546, 160, { x: 1150, w: 658 }),
    statBlock({
      start: W('7.9 gigabytes', 442) - 0.5,
      end: S(77) - 0.5,
      at: [1768, 618],
      align: 'right',
      items: [{ value: '≈7.9 GB/s', label: 'x8 PCIe 3.0, each direction', small: true }],
    }),
    rpanel(S(77) + 0.7, S(83) - 0.4, 236, 700, { x: 1132, w: 676, fill: 'rgba(9,12,16,0.84)' }),
    hostFrame({ start: S(77) + 0.7, end: S(83) - 0.4, rect: [1132, 236, 676, 700], label: 'HOST MEMORY · RX DESCRIPTOR RING', leaderUntil: W('empty pointer', 468) - 0.5 }),
    descriptorRing({ start: S(77) + 0.8, end: S(83) - 0.4, at: [1454, 486], radius: 172, slots: 16, rate: 0.85 }),
    lpanel(W('empty pointer', 468) - 0.5, S(83) - 0.4, 596, 254, { w: 580 }),
    noteList({
      start: W('empty pointer', 468) - 0.4,
      end: S(83) - 0.4,
      at: [112, 644],
      title: 'ONE DESCRIPTOR',
      items: ['a pointer to a free buffer', 'status bits the NIC writes back', 'length and flags'],
      step: 1.5,
      width: 470,
    }),
    rpanel(S(83) + 0.5, W('no interrupt', 511) - 0.6, 118, 592, { x: 852, w: 956, fill: 'rgba(9,12,16,0.86)' }),
    hostFrame({ start: S(83) + 0.5, end: W('no interrupt', 511) - 0.6, rect: [852, 118, 956, 592], label: 'HOST · MEMORY + CPU' }),
    // Built as the narration names each part, not all at once: the NIC's write and the
    // ring recap the last step; the worker arrives with "DPDK", its poll loop with
    // "polling", the application with rte_eth_rx_burst, the mbufs as the packets are handed
    // over, and the pool they came from with "pulled from a pre-allocated pool" (the word
    // "mempool" itself lands after this diagram has gone).
    dpdkDiagram({
      start: S(83) + 0.6,
      end: W('no interrupt', 511) - 0.6,
      at: [1118, 160],
      width: 596,
      timing: {
        nodes: [0, 0.55, W('DPDK', 486) - 0.2 - (S(83) + 0.6), W('rte', 494) - 0.2 - (S(83) + 0.6)],
        poll: W('polling', 490) - 0.2 - (S(83) + 0.6),
        mbufs: W('hands your application the packets', 504) - (S(83) + 0.6),
        mempool: W('pulled from', 509) - 0.3 - (S(83) + 0.6),
      },
    }),
    codeChip({
      start: W('rte', 494) - 0.5,
      end: W('no interrupt', 511) - 0.6,
      at: [112, 700],
      code: 'rte_eth_rx_burst()',
      caption: 'sweeps up a burst of completed descriptors',
    }),
    scrim({ start: W('no interrupt', 511) - 0.8, end: E(88) + 0.2, side: 'left', strength: 0.8 }),
    phraseStack({
      start: W('no interrupt', 511) - 0.2,
      end: W('the packet moved', 516) + 0.6,
      at: [160, 430],
      items: ['NO INTERRUPT', 'NO CONTEXT SWITCH', 'NO EXTRA COPY'],
      step: 0.9,
      size: 62,
    }),
    callout({
      start: W('the packet moved', 516) + 0.4,
      end: E(88) + 0.1,
      title: 'NO CPU COPY',
      subtitle: 'DMA put it in memory · the CPU reads it there',
      at: [160, 470],
      width: 560,
    }),

    // ------------------------------------------------------- 05 transmit
    sectionTitle({ start: SEC.tx.from - 0.9, end: SEC.tx.from + 3.6, index: 'CHAPTER 05', title: 'HOW A PACKET IS TRANSMITTED' }),
    sectionLabel({ start: SEC.tx.from + 3.0, end: SEC.tx.to, index: SEC.tx.index, label: SEC.tx.label }),
    flowRail({ start: S(90) - 0.6, end: S(103) - 0.4, stages: TX_RAIL, positionAt: railTravel(txRailTimes, 1.5), color: C.amber, label: 'TRANSMIT PATH' }),
    codeChip({
      start: S(90) + 0.6,
      end: S(93) - 0.4,
      at: [112, 700],
      code: 'rte_eth_tx_burst()',
      color: C.amber,
      caption: 'the application hands the driver a burst',
    }),
    callout({
      start: S(93) + 0.4,
      end: W('writes to a doorbell register', 545) - 0.4,
      title: 'TX DESCRIPTOR RING',
      subtitle: 'host memory · each points at a buffer holding the frame',
      at: [112, 700],
      color: C.amber,
      width: 640,
    }),
    rpanel(W('writes to a doorbell register', 545) - 0.7, S(95) - 0.3, 374, 208, { x: 1180, w: 628 }),
    doorbell({ start: W('writes to a doorbell register', 545) - 0.6, end: S(95) - 0.3, at: [1364, 424], ringAt: W('writes to a doorbell register', 545) + 1.4 }),
    callout({
      start: S(95) + 0.6,
      end: S(98) - 0.4,
      title: 'DMA READ',
      subtitle: 'the controller pulls the buffer out of host RAM',
      at: [112, 700],
      color: C.amber,
      width: 640,
    }),
    callout({ start: S(98) + 0.6, end: S(99) + 7.4, title: 'PHY → WIRE', subtitle: 'bits shaped back into PAM-16', at: [112, 700], color: C.amber, width: 500 }),
    callout({
      start: W('writes back a completion', 577) - 0.4,
      end: S(103) - 0.5,
      title: 'COMPLETION',
      subtitle: 'the mbuf goes back to the mempool',
      at: [112, 700],
      color: C.amber,
      width: 520,
    }),
    backdrop({ start: S(103) + 0.2, end: SEC.tx.to, rect: [152, 208, 1616, 296], fill: 'rgba(9,12,16,0.88)' }),
    comparison({
      start: S(103) + 0.3,
      end: SEC.tx.to,
      at: [200, 298],
      width: 1520,
      rows: [
        { label: 'RX', color: C.accent, stages: ['CABLE', 'NIC', 'DMA', 'MEMORY', 'APPLICATION'] },
        { label: 'TX', color: C.amber, stages: ['APPLICATION', 'MEMORY', 'DMA', 'NIC', 'CABLE'] },
      ],
    }),

    // ------------------------------------------------------ 06 why it's fast
    sectionTitle({ start: SEC.fast.from - 1.0, end: SEC.fast.from + 3.6, index: 'CHAPTER 06', title: 'WHY THIS DESIGN IS FAST' }),
    sectionLabel({ start: SEC.fast.from + 3.0, end: SEC.fast.to, index: SEC.fast.index, label: SEC.fast.label }),
    scrim({ start: W('Multi-Q plus RSS', 604) - 1.2, end: SEC.fast.to, side: 'bottom', strength: 0.74 }),
    recapFigure({ start: W('Multi-Q plus RSS', 604) - 0.5, end: SEC.fast.to - 0.4, at: [177, 654], kind: 'rss', title: 'RSS', sub: 'one NIC becomes N independent lanes' }),
    recapFigure({ start: W('DMA means', 613) - 0.5, end: SEC.fast.to - 0.4, at: [575, 654], kind: 'dma', title: 'DMA', sub: 'the controller talks to memory itself' }),
    recapFigure({ start: W('polling instead of interrupts', 622) - 0.5, end: SEC.fast.to - 0.4, at: [973, 654], kind: 'polling', title: 'POLLING', sub: 'no interrupt cost per packet' }),
    recapFigure({ start: W('hardware offloads', 637) - 0.5, end: SEC.fast.to - 0.4, at: [1371, 654], kind: 'offload', title: 'OFFLOAD', sub: 'repetitive work moves into silicon' }),
    rpanel(W('put together', 649) + 1.1, SEC.fast.to - 0.4, 140, 176, { x: 1180, w: 628 }),
    statBlock({
      start: W('put together', 649) + 1.2,
      end: SEC.fast.to - 0.4,
      at: [1768, 212],
      align: 'right',
      items: [{ value: 'tens of millions', label: 'packets per second, not hundreds of thousands', small: true }],
    }),

    // ------------------------------------------------------------- 07 where
    sectionTitle({ start: SEC.where.from - 1.0, end: SEC.where.from + 3.2, index: 'CHAPTER 07', title: 'WHERE THESE CARDS LIVE' }),
    sectionLabel({ start: SEC.where.from + 2.8, end: SEC.where.to, index: SEC.where.index, label: SEC.where.label }),
    rpanel(W('load balancers', 666) - 0.6, SEC.where.to - 0.3, 280, 604, { x: 1024, w: 784 }),
    noteList({
      start: W('load balancers', 666) - 0.5,
      end: SEC.where.to - 0.3,
      at: [1074, 336],
      title: 'BUILT FOR PACKET THROUGHPUT',
      items: ['load balancers', 'firewalls and security appliances', 'software routers and switches', 'telecom dataplanes', 'virtualised network functions'],
      step: 1.85,
      width: 600,
    }),
    chipRow({
      start: W('line rate', 679) - 0.6,
      end: SEC.where.to - 0.3,
      at: [1074, 704],
      items: ['LINE RATE', 'PACKET FORWARDING', 'DATAPLANE'],
      step: 1.25,
      size: 22,
    }),

    // ------------------------------------------------------------- 08 outro
    sectionLabel({ start: SEC.outro.from + 0.5, end: W('all built', 703) + 2.0, index: SEC.outro.index, label: SEC.outro.label }),
    rpanel(W('copper', 695) - 1.5, W('all built', 703) + 4.2, 62, 852, { x: 1166, w: 622, fill: 'rgba(9,12,16,0.86)' }),
    archStack({
      start: W('copper', 695) - 1.4,
      end: W('all built', 703) + 4.2,
      at: [1227, 118],
      layers: [
        { title: 'APPLICATION', sub: 'your packet logic', kind: 'sw' },
        { title: 'DPDK · mbufs', sub: 'poll-mode driver, mempool', kind: 'sw' },
        { title: 'RX / TX RINGS', sub: 'descriptors · host memory' },
        { title: 'DMA', sub: 'straight into host memory' },
        { title: 'NIC CONTROLLER', sub: 'MAC, RSS, offloads' },
        { title: 'PHY', sub: 'bits ↔ waveform' },
        { title: 'RJ45 + MAGNETICS', sub: 'isolated copper port' },
        { title: 'CABLE', sub: 'four twisted pairs' },
      ],
      // Built bottom-up, in the order the narration names each layer.
      delays: [
        W('your application', 705) - (W('copper', 695) - 1.4),
        W('all built', 703) - (W('copper', 695) - 1.4),
        W('queues', 702) - (W('copper', 695) - 1.4),
        W('DMA engine', 700) - (W('copper', 695) - 1.4),
        W('controller', 699) - (W('copper', 695) - 1.4),
        W('PHY', 698) - (W('copper', 695) - 1.4),
        W('transformer', 697) - (W('copper', 695) - 1.4),
        1.4,
      ],
    }),
    dim({ start: W('thanks for watching', 710) - 1.2, end: duration, alpha: 0.72, fadeIn: 2.0, fadeOut: 0.6 }),
    endCard({
      start: W('thanks for watching', 710) - 0.4,
      end: duration - 0.1,
      kicker: 'THANKS FOR WATCHING',
      title: 'AXIOBYTE',
      lines: ['3D NIC — the interactive model', 'link in the description'],
    }),
    fade({ start: duration - 1.3, end: duration, hold: 'out' }),
  ];

  if (captions) cues.push(captionTrack({ timeline: tl, start: 0, end: audioEnd }));

  return { duration, audioEnd, sections, shots, highlights, heatsink, flights, zones, signals, cues };
}
