import * as THREE from 'three';
import { sectionLabel, vignette } from '@axiobyte/three/video/overlay/widgets/titles.js';
import { callout, chipRow } from '@axiobyte/three/video/overlay/widgets/callouts.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { chapterLabel, costGroup, fixedCard, sectionTitle, stageTag, zonedCallout } from './composition.js';
import { brandEndCard } from '@axiobyte/three/brand/endCard.js';

/**
 * s01e02's score: sentences 0–16, the traditional path and the mbuf; 17–46, zero copy — the
 * Mempool, the DMA into the buffer, one buffer and one handle through the stages, transmit.
 *
 * Every time here comes from the recorded voiceover (timeline/words.json, byte-identical to the
 * episode's timeline.json): `S(i)` and `E(i)` are where sentence i begins and ends, `W(phrase)` the
 * moment a word is spoken. Nothing is transcribed from an older render.
 *
 * Returns what the director needs — camera shots, overlay cues, sections — and what the episode's
 * own animation needs: `lanes` (stage.js, act2.js) and `highlightsAt(t)` (the highlighter's levels).
 */
export const LAST_SENTENCE = 46;
export const MILESTONE_1_END = 16;
/** The AxioByte end card's length, after the film (seconds). */
export const END_CARD = 3.5;
const MBUF = '#34D8E8';

export function buildStoryboard({ timeline: tl, registry, tail = 1.5 }) {
  const S = (i) => tl.sentenceStart(i);
  const E = (i) => tl.sentenceEnd(i);
  const W = (phrase, i) => tl.wordTime(phrase, { after: S(i) - 0.01, before: E(i) });
  const audioEnd = tl.duration;
  const duration = audioEnd + tail;
  const END = E(LAST_SENTENCE);
  const M1 = E(MILESTONE_1_END);

  // ------------------------------------------------------------------ what happens, and when
  // The opening analogy (sentences 0–4, analogy.js), every beat on its word.
  const analogy = {
    enter: { from: S(0) + 0.2, to: S(0) + 3.6 }, // the truck drives in to the library
    single: W('single', 0), // "…to read a single book": the marked crate is pointed out
    load1: W('pack', 1), // "You pack all the books into a truck,"
    drive1: W('drive', 1), // "drive them to a new building,"
    unload1: W('unload', 1), // "unload them,"
    load2: W('repeat', 1), // "and repeat the same process again and again."
    drive2: W('repeat', 1) + 0.95,
    unload2: E(1) + 0.1,
    leave: { from: S(2) + 0.3, to: S(3) + 0.4 }, // the truck drives on: the trip repeats again
    focus: S(3), // "That's exactly what traditional packet processing does."
    toBytes: { from: W('packet', 3) - 0.2, to: E(3) },
    dissolve: { from: S(4) + 0.2, to: S(4) + 1.7 }, // the analogy folds into the technical floor
    nicRise: { from: S(4) + 1.3, to: S(4) + 3.0 }, // the real NIC rises where it stood
    cells: { from: S(4) + 1.7, to: S(4) + 3.9 }, // the bytes fly into the NIC's network port
  };
  const lanes = {
    analogy,
    // The packet — the crate's bytes, handed over at the port — crosses the card (sentence 4).
    arrival: { from: analogy.cells.to, to: analogy.cells.to + 1.9 },
    // The host side rises once the NIC is there: the buffers, the CPU, the application.
    host: { from: S(4) + 4.6, to: S(4) + 6.0 },
    // Sentence 5: "…the NIC, receives the packet into one buffer" — DMA, not a copy.
    dma: { from: W('receives', 5), to: E(5) },
    // Sentence 6: "Then those bytes are copied into another buffer" — the first CPU copy, from the
    // sentence's start, so the copy can leave buffer A, stop at the CPU and arrive in buffer B.
    copy1: { from: S(6) + 0.1, to: E(6) },
    // Sentence 7: "They may be copied again…" — the second CPU copy, buffer B to the application.
    copy2: { from: S(7) + 0.05, to: E(7) + 0.35 },
    // Sentence 8: every copy costs CPU, bandwidth, cache.
    cost: { from: S(8), to: E(8) },
    // Sentences 9–10: the copies recede as a different approach is announced.
    recede: { from: S(9), to: S(10) },
    // Sentence 10: "…it simply passes a reference to it."
    reference: { from: W('reference', 10), to: W('reference', 10) + 1.2 },
    // Sentence 13: "The answer is an mBuff."
    mbuf: { from: W('mbuff', 13) - 0.2, to: W('mbuff', 13) + 0.7 },
    // Sentence 15: "…the packet length, … the exact memory address…" — strip by strip. The
    // narration's "protocol details" has no strip of its own, so refcount is not singled out.
    fields: {
      data_len: { from: W('length', 15), to: W('importantly', 15) - 0.2 },
      refcount: null,
      // "…and most importantly, the exact memory address…": attention passes to buf_addr.
      buf_addr: { from: W('importantly', 15), to: M1 },
    },
    // buf_addr, followed to the buffer: on "address" the reference is TRACED from the mbuf's socket,
    // reaching the buffer's first byte on "payload begins"; it stays lit to sentence 16's end.
    // Nothing travels along it.
    pulse: { from: W('address', 15), reach: W('begins', 15), to: M1 },

    // ---- zero copy (sentences 17–46) ----
    // Sentence 17: "Before any packet even arrives…" — the copying path's extras leave, buffer A is
    // empty again, and the Mempool rises.
    act2: S(17),
    empty: { from: S(17) + 0.2, to: S(17) + 1.6 },
    // …on "allocates a large collection" the Mempool is set up: before any packet, never on arrival.
    pool: { from: W('allocates', 17) - 0.3, to: W('collection', 17) + 0.5 },
    // Sentence 19 ("…all ready to be used") → 41: one element of the pool, marked as the one shown
    // enlarged — cleared when the narration returns the buffer to the pool (an emphasis that ends,
    // never a state).
    representative: { from: W('ready', 19) - 0.3, to: W('returned', 41) },
    // Sentences 20–21: a packet crosses the card again, and the NIC's DMA writes buffer A — the
    // representative element's BUFFER. No CPU, no copy.
    arrival2: { from: S(20) + 0.4, to: W('stream', 21) },
    zdma: { from: W('stream', 21), to: W('mempool', 21) + 0.3 },
    bufferHalf: { from: W('mempool', 21) - 0.2, to: E(22) },
    zdmaFade: { from: S(23), to: S(23) + 1.6 },
    // Sentence 23: the stages appear. 24–27: the handle reaches each one on its name.
    stages: { from: S(23) + 0.3, to: S(23) + 1.6 },
    stage: [W('passer', 24), W('classifier', 25), W('firewall', 26), W('routing', 27)],
    // Sentences 34 and 44: "Only the pointer is" / "Only the mBuff … was passed": the handle runs the
    // stages again — the only thing that moves.
    runs: [W('pointer', 34), W('passed', 44) - 1.2],
    // Sentence 29, "The packet buffer never moves": the handle runs the pipeline once more while the
    // buffer stands still, arriving back at routing for sentence 30's "router".
    neverRun: W('never', 29) - 0.3,
    // Sentences 24–30: the overlay's tags name the stages (each appears on its name).
    stageTags: { from: W('passer', 24) - 0.3, to: E(30) + 0.4 },
    // …and from the moment the stages rise (sentence 23) the slabs carry no printed name: a stage is
    // unnamed until it is spoken, then named by its tag.
    stagePrintsOff: { from: S(23), to: duration + 1 }, // …and never come back (milestone 7)
    // Sentences 32–36: while the pipeline is the subject, the stages are named by tags again (in
    // sentence 31 the camera is on the NIC, and the stages, briefly unnamed, are context); from 37 (scale, benefits) the stages are context and the tags
    // step away. The slabs' small prints stay hidden throughout.
    stageTags2: { from: S(32) + 2.0, to: S(37) + 0.3 }, // once sentence 32's shot has settled
    // "This is the key idea… only the pointer… incredibly cheap…": the handle's line is traced — a
    // static glow laid along it — and stays so through sentence 36. Nothing travels along it.
    handleTrace: { from: W('key', 32) - 0.2, to: E(36) },
    // "…not as a collection of bytes, but as a pointer to those bytes" (45) — traced again, to the end.
    handleTrace2: { from: W('pointer', 45) - 0.3, to: duration + 1 },
    // Sentence 44, "…passed from one component to another": the stages are named again.
    stageTags3: { from: S(44) + 2.1, to: E(44) + 0.4 }, // once the shot has settled
    // Sentence 45, "…not as a collection of bytes, but as a pointer to those bytes": the pool and the stages
    // settle away, leaving the ending only what it needs — the mbuf, the buffer and its bytes, the handle.
    finale: { from: W('pointer', 45) - 0.6, to: W('pointer', 45) + 1.2 },
    // Sentences 23–30: the handle's line stays lit, and nothing travels along it.
    quietHandle: { from: S(23), to: duration + 1 }, // from 23 to the end: no bead on the handle's line
    handleOut: duration + 10,
    handlePulse: { from: W('handle', 28), to: duration },
    // Sentence 30: "…it modifies the bytes right there in place."
    edit: { from: W('modifies', 30), to: W('modifies', 30) + 0.9 },
    // Sentences 37–39: many packets — more handles stream through the stages.
    scale: { from: S(37), to: E(39) },
    // Sentence 40: "…the NIC transmits the packet using the exact same memory buffer."
    transmit: { from: W('transmits', 40), to: E(40) },
  };

  // ------------------------------------------------------------------ highlights
  const pulse = (t, a, b, rise = 0.35, fall = 0.6) => Math.min(Math.max(0, Math.min(1, (t - a + rise) / rise)), Math.max(0, Math.min(1, (b + fall - t) / fall)));
  const cardPath = ['rj45-1', 'magnetics-1', 'phy', 'nic-controller'];
  const step = (lanes.arrival.to - lanes.arrival.from) / cardPath.length;
  const highlightsAt = (t) => {
    const out = {};
    const put = (id, v) => {
      if (v > 0.01) out[id] = Math.max(out[id] ?? 0, v);
    };
    cardPath.forEach((id, i) => put(id, 0.8 * pulse(t, lanes.arrival.from + i * step, lanes.arrival.from + (i + 1) * step)));
    put('nic-controller', pulse(t, lanes.dma.from - 0.2, lanes.dma.from + 1.0));
    for (const part of ['header', 'payload']) {
      put(`buffer_a.${part}`, 0.7 * pulse(t, lanes.dma.to - 0.3, lanes.dma.to + 0.9));
      put(`buffer_b.${part}`, 0.7 * pulse(t, lanes.copy1.to - 0.3, lanes.copy1.to + 0.9));
      // The original bytes, as the first copy is taken from them; then, on sentence 8, all three
      // copies of the same bytes pulsing together (the application's pulse is the stage's).
      put(`buffer_a.${part}`, 0.55 * pulse(t, lanes.copy1.from - 0.1, lanes.copy1.from + 0.8));
      const together = 0.5 + 0.5 * Math.sin(t * 6.0) ** 2;
      put(`buffer_a.${part}`, 0.75 * together * pulse(t, lanes.cost.from, lanes.cost.to, 0.4, 0.6));
      put(`buffer_b.${part}`, 0.75 * together * pulse(t, lanes.cost.from, lanes.cost.to, 0.4, 0.6));
      put(`buffer_a.${part}`, 0.9 * pulse(t, S(16), M1));
      // Zero copy: buffer A as the DMA lands, as it is held still, and at the payoff.
      put(`buffer_a.${part}`, 0.7 * pulse(t, lanes.zdma.to - 0.3, lanes.zdma.to + 1.0));
      put(`buffer_a.${part}`, 0.7 * pulse(t, W('same', 23) - 0.3, E(23))); // "…the same packet buffer"
      put(`buffer_a.${part}`, 0.7 * pulse(t, S(29), E(29)));
      put(`buffer_a.${part}`, 0.7 * pulse(t, W('sitting', 31), E(31))); // "…exactly where the NIC originally placed them"
      put(`buffer_a.${part}`, 0.6 * pulse(t, S(33), E(33)));
      put(`buffer_a.${part}`, 0.7 * pulse(t, S(43), E(43)));
      put(`buffer_a.${part}`, 0.8 * pulse(t, W('pointer', 45), duration));
    }
    put('mbuf.fields', 0.6 * pulse(t, lanes.mbuf.to, E(14)));
    put('pool.elements', 0.5 * pulse(t, S(18), E(18)));
    put('pool.elements', 0.5 * pulse(t, S(42), E(42)));
    put('pool.elements', 0.6 * pulse(t, W('returned', 41), E(41))); // "…returned to the mempool, ready to be reused"
    put('nic-controller', pulse(t, lanes.zdma.from - 0.2, lanes.zdma.from + 1.0));
    put('nic-controller', pulse(t, lanes.transmit.to - 1.0, lanes.transmit.to + 0.4));
    return out;
  };

  // ------------------------------------------------------------------ camera
  // A framing box: parts' world boxes, or single anchors given as [id, anchor].
  const box = (...ids) => {
    const b = new THREE.Box3();
    for (const id of ids) {
      if (Array.isArray(id)) b.expandByPoint(registry.anchorWorld(id[0], id[1]));
      else b.union(registry.worldBox(id));
    }
    return b;
  };
  const nicParts = ['rj45-1', 'rj45-2', 'heatsink', 'nic-controller', 'pcie-connector', 'bracket'];
  const A = ['buffer_a.header', 'buffer_a.payload'];
  const B = ['buffer_b.header', 'buffer_b.payload'];
  const CPU = ['cpu.substrate', 'cpu.ihs'];
  const APP = ['e02.app'];
  const MB = ['mbuf.fields'];
  const POOL = ['pool.elements'];
  const STG = ['e02.stage.parser', 'e02.stage.classifier', 'e02.stage.firewall', 'e02.stage.routing'];
  const NICF = ['nic-controller', ['pcie-connector', 'out']];
  const view = (ids, direction, padding, extra = {}) => ({ view: { box: box(...ids), direction: new THREE.Vector3(...direction), padding }, ...extra });

  const AN = (k) => `e02.analogy.${k}`;
  const REF_END = ['buffer_a.header', 'pointer_target'];
  const REF_MID = ['e02.reference', 'center'];
  // Annotation zones (composition.js): the empty floor a shot keeps for its card.
  const ZONE = { cpuSide: ['e02.zone.cpu_side', 'center'], upstageRight: ['e02.zone.upstage_right', 'center'], left: ['e02.zone.left', 'center'], poolRight: ['e02.zone.pool_right', 'center'], poolLeft: ['e02.zone.pool_left', 'center'], cpuRight: ['e02.zone.cpu_right', 'center'], stagesRight: ['e02.zone.stages_right', 'center'] };
  const REP_TILE = ['e02.representative', 'center'];
  // Sentences 24–30: the stages' tags and the zones they stand in (composition.js).
  const STAGE_TAGS = [['e02.zone.stage_parser', 'PARSER'], ['e02.zone.stage_classifier', 'CLASSIFIER'], ['e02.zone.stage_firewall', 'FIREWALL'], ['e02.zone.stage_routing', 'ROUTING']];
  const TAGS = STAGE_TAGS.map(([zone]) => [zone, 'center']);
  const REP_SLOT = ['pool.elements', 'first_slot'];
  const shots = [
    // ---- the analogy: no hardware on screen ----
    // 0: wide and low, the truck driving in to the library.
    { at: 0, ...view([AN('library'), AN('new_building')], [0.55, 0.38, 1], 1.0), transition: 0, motion: { push: [1.08, 0.97], orbit: -0.004 } },
    // 1: closer on the crates as they are packed…
    { at: analogy.load1 - 0.5, ...view([AN('library')], [0.35, 0.5, 1], 1.15), transition: 1.6, motion: { push: [1.03, 0.97] } },
    // …travelling with the drive to the new building…
    { at: analogy.drive1 - 0.2, ...view([AN('library'), AN('new_building')], [0.05, 0.48, 1], 1.0), transition: 1.4 },
    // …the unload, and the repeat on to the next building.
    { at: analogy.unload1 - 0.3, ...view([AN('new_building')], [-0.2, 0.52, 1], 1.2), transition: 1.2 },
    { at: analogy.drive2 - 0.3, ...view([AN('new_building'), AN('next_building')], [-0.15, 0.5, 1], 1.02), transition: 1.4 },
    // 2: "Sounds ridiculously inefficient, right?" — high, over the whole repetition.
    { at: S(2), ...view([AN('scene')], [0, 1.25, 0.85], 0.98), transition: 2.0, motion: { orbit: 0.006 } },
    // 3: push into the marked crate, and into its bytes.
    { at: S(3), ...view([AN('marked_crate')], [-0.25, 1.35, 0.75], 3.2), transition: 2.2, motion: { push: [1.0, 0.8] } },
    // 4: pull back as the analogy folds away and the real NIC rises in its place…
    { at: S(4) + 0.9, ...view(nicParts, [-0.45, 0.66, 1], 1.0), transition: 2.4, motion: { push: [1.06, 0.98] } },
    // …follow the packet across the card…
    { at: analogy.cells.to - 0.3, ...view(['rj45-1', 'magnetics-1', 'phy', 'nic-controller'], [0.1, 0.95, 0.85], 1.25), transition: 1.6 },
    // …and reveal the host side, ready for sentence 5.
    { at: lanes.host.from - 0.2, ...view([...A, ...B, ...CPU, ...APP, 'pcie-connector'], [-0.3, 0.85, 1], 1.03), transition: 2.4, motion: { orbit: 0.006, push: [1.02, 0.96] } },
    { at: S(5) - 0.9, ...view(['nic-controller', ['pcie-connector', 'out'], ...A], [0.42, 0.85, 1], 1.18), transition: 2.0, motion: { push: [1.03, 0.97] } },
    // Sentences 6–8: the copies. The NIC is not their subject — it stands upstage, so each shot is
    // composed upwards (frame[1] > 0 slides the image up): the NIC leaves the top of the frame and
    // the floor in front of the buffers becomes the chapter label's corner.
    { at: S(6) - 0.4, ...view([...A, ...B, ...CPU, ...APP, ZONE.cpuSide], [0.1, 1.35, 1], 1.16), frame: [0, 0.13], transition: 1.6 },
    { at: S(7) - 0.3, ...view([...B, ...CPU, ...APP, ZONE.cpuSide], [-0.15, 1.15, 1], 1.08), frame: [0, 0.1], transition: 1.4 },
    { at: S(8), ...view([...A, ...B, ...CPU, ...APP, ZONE.upstageRight], [0.15, 1.35, 1], 1.0), frame: [0, 0.12], transition: 1.4, motion: { push: [1.0, 0.95] } },
    { at: S(10) - 0.5, ...view([...A, ...MB], [-0.2, 0.9, 1], 1.15), transition: 3.0, motion: { push: [1.04, 0.98] } },
    // Sentence 12, "But what exactly is being passed?": follow the reference back to its empty tail.
    { at: S(12), ...view([...MB, 'buffer_a.header'], [-0.35, 0.9, 0.9], 1.25), transition: 1.4 },
    // Sentences 13–16: follow the relationship. The mbuf is metadata — never framed as a hero: every
    // shot keeps its reference (and the buffer it points at) in view, so the record stays small.
    // 13: the answer appears at the reference's tail; hold on the tail and buffer A's header.
    { at: S(13), ...view([...MB, 'buffer_a.header'], [-0.2, 0.95, 1], 1.2), transition: 1.6, motion: { push: [1.0, 0.97] } },
    // 14: "a small metadata structure attached to the packet": a gentle push — the record, its reference, the buffer's address.
    { at: S(14) + 0.2, ...view([...MB, REF_END], [0, 1.05, 0.85], 1.25), transition: 2.0, motion: { push: [1.02, 0.96] } },
    // 15: closer on the fields as they are named…
    { at: W('information', 15) - 0.3, ...view([...MB, REF_END, 'buffer_a.header'], [0.05, 1.15, 0.8], 1.15), transition: 1.8, motion: { push: [1.0, 0.97] } },
    // …"most importantly": re-centre on the buf_addr strip and its socket…
    { at: W('importantly', 15) - 0.2, ...view([['mbuf.fields', 'refcount'], ['mbuf.fields', 'buf_addr'], REF_END, 'buffer_a.header'], [0.15, 1.1, 0.8], 1.2), frame: [0, -0.06], transition: 1.4 },
    // …"address": pan along the reference, arriving at the buffer's first byte on "payload begins".
    { at: W('address', 15) - 0.2, ...view([['mbuf.fields', 'buf_addr'], ...A], [0.15, 1.05, 0.85], 1.15), frame: [0, -0.06], transition: 1.6 },
    // 16: "where those bytes live": push into buffer A's payload; the mbuf stays at the left edge.
    { at: S(16), ...view([...A, ['mbuf.fields', 'buf_addr']], [0.12, 1.0, 0.85], 1.2), frame: [0.025, -0.03], transition: 1.8, motion: { push: [1.0, 0.98] } },
    // ---- zero copy ----
    // Sentences 17–22: storage first, then one element of it, then the DMA into that element's buffer.
    // 17: pull back from the buffer; the pool rises downstage of the mbuf and buffer A.
    { at: S(17) + 0.2, ...view([...MB, ...A, ...POOL, ZONE.poolRight], [0.05, 1.1, 0.85], 1.04), transition: 2.6, motion: { push: [1.03, 0.98] } },
    // 18: "…called a mempool": settle on the pool, its name beside it.
    { at: S(18), ...view([...POOL, ZONE.poolRight], [0.25, 1.05, 0.8], 1.1), transition: 1.6, motion: { orbit: 0.006 } },
    // 19: the warehouse — low and raking along the rows, the elements receding in depth.
    { at: S(19) - 0.1, ...view(POOL, [0.9, 0.45, 0.75], 1.0), frame: [0, -0.06], transition: 2.2, motion: { orbit: 0.005, push: [1.03, 0.97] } },
    // …"ready to be used": widen to the tile, the magnifier and the element it is shown enlarged as.
    { at: W('ready', 19) - 0.5, ...view([...POOL, ...MB, ...A, ZONE.poolRight], [0.25, 1.0, 0.85], 1.03), transition: 2.0 },
    // 20: "When the NIC receives a packet": the NIC, the enlarged element and its tile, together.
    { at: S(20) + 0.2, ...view([...NICF, ...A, ...MB, REP_TILE, REP_SLOT], [0.12, 1.0, 1], 1.06), transition: 2.2 },
    // 21: the DMA lands in the element's BUFFER — the tile stays in shot, lighting as the bytes land.
    { at: lanes.zdma.from - 0.9, ...view([...NICF, ...A, ...MB, REP_TILE, REP_SLOT], [0.3, 1.0, 1], 1.08), transition: 1.8, motion: { push: [1.01, 0.99] } },
    // 22: "no CPU…": the CPU, unlit, beside the filled buffer; the NIC kept to the top edge.
    { at: S(22), ...view([...A, ...CPU, ...MB, ZONE.cpuRight], [0.1, 1.3, 1], 1.03), frame: [0, 0.12], transition: 1.0, motion: { orbit: 0.003 } },
    // Sentences 23–30: one buffer, one steady composition, seen a little from the left (so the scene's
    // depth recedes to the upper right and the chapter title's corner stays clear). Buffer A — with its
    // bytes — and the whole pipeline stay in frame throughout; the handle moves, the buffer and the
    // camera hold.
    // 23: out of sentence 22 to the buffer, the mbuf and the stages rising beside them.
    { at: S(23), ...view([...A, ...MB, ...STG, ...TAGS, ZONE.cpuRight], [-0.15, 1.05, 1], 1.04), transition: 2.4 },
    // 24–27: held — each stage named in turn as the handle reaches it.
    { at: lanes.stage[0] - 0.6, ...view([...A, ...STG, ...TAGS, ZONE.cpuRight], [-0.15, 1.05, 1], 1.02), transition: 1.6, motion: { push: [1.0, 0.98] } },
    // 28: "a handle that points to the original packet buffer" — a gentle push toward the handle.
    { at: S(28), ...view([...A, ...STG, ...TAGS, ZONE.cpuRight], [-0.15, 1.05, 1], 1.02), transition: 1.8, motion: { push: [1.0, 0.97] } },
    // 29: "never moves" — static: the buffer still, the handle running the pipeline around it.
    { at: S(29), ...view([...A, ...STG, ...TAGS, ZONE.cpuRight], [-0.15, 1.05, 1], 1.02), transition: 1.6 },
    // 30: "…right there in place" — a slight push toward the buffer, the pipeline still in frame.
    { at: lanes.edit.from - 1.2, ...view([...A, ...STG, ...TAGS, ZONE.cpuRight], [-0.15, 1.05, 1], 1.02), transition: 1.8, motion: { push: [1.0, 0.98] } },
    // Sentences 31–39: the milestone 5 world carried on — the same buffer, the same handle, the same
    // stages — with as few moves as the narration needs.
    // 31: "…exactly where the NIC originally placed them": bring the NIC into frame beside the buffer.
    { at: S(31), ...view([...NICF, ...A, ...STG], [-0.15, 1.05, 1], 1.04), transition: 2.2 },
    // 32–34: the key idea, held — the buffer, its handle (traced), the stages.
    { at: S(32), ...view([...A, ...STG, ...TAGS, ZONE.cpuRight], [-0.15, 1.05, 1], 1.02), transition: 2.2 },
    // 35–36: "incredibly cheap": a slight push, the handle and the buffer side by side.
    { at: S(35), ...view([...A, ...STG, ...TAGS, ZONE.cpuRight], [-0.15, 1.05, 1], 1.02), transition: 1.0, motion: { push: [1.0, 0.985] } },
    // 37: "millions of packets every second": widen to the whole pipeline and the stream of handles.
    { at: S(37), ...view([...A, ...STG, ...TAGS, ...CPU, ZONE.cpuRight], [-0.1, 1.1, 1], 1.04), transition: 2.0 },
    // 38: "…instead of making forwarding decisions": the CPU with the stages (not a close-up).
    { at: S(38) + 0.3, ...view([...CPU, ...STG, ...TAGS, ZONE.cpuRight], [-0.3, 1.2, 1], 1.08), frame: [0, 0.08], transition: 2.0 },
    // 39: the payoff — the system, composed on the frame's centre, at the
    // scale of the shots before it: the NIC's controller and edge frame it, the rest of the card is context.
    { at: S(39), ...view([...NICF, ...A, ...STG, ...CPU, ...TAGS, ZONE.upstageRight], [-0.3, 1.2, 1], 1.02), frame: [0, 0.0], transition: 2.4, motion: { push: [1.0, 0.97] } },
    // Sentences 40–46 (milestone 7): the ending. Every shot centred on its subject, at sentence 39's scale.
    // 40: "…the NIC transmits the packet using the exact same memory buffer" — the NIC and the buffer.
    { at: lanes.transmit.from - 0.8, ...view([...nicParts, ...A], [-0.45, 1.2, 1], 1.04), frame: [0, 0.06], transition: 2.0 },
    // 41–43: "returned to the mempool… allocated only once… never copied" — the buffer, its mbuf, the pool.
    { at: S(41), ...view([...POOL, ...MB, ...A], [0.25, 1.1, 0.9], 1.04), frame: [0, 0.1], transition: 2.2 },
    // 44: "only the mBuff, the handle… was passed from one component to another" — the pipeline.
    { at: S(44), ...view([...A, ...STG, ...TAGS, ZONE.cpuRight], [-0.15, 1.05, 1], 1.02), transition: 2.0 },
    // 45–46: "a pointer to those bytes… the essence of zero copy" — the final composition: the mbuf, the
    // buffer with its bytes, and the handle whose traced line points at them.
    { at: S(45), ...view([...MB, ...A, STG[3]], [-0.15, 0.9, 1], 1.04), frame: [0, 0.04], transition: 2.4, motion: { push: [1.0, 0.98] } },
    // 46: "…the essence of zero copy" — the same composition, held, with a slow push to the end of the hold.
    { at: S(46), ...view([...MB, ...A, STG[3]], [-0.15, 0.9, 1], 1.04), frame: [0, 0.04], transition: 1.6, motion: { push: [1.0, 0.96] } },
  ];

  // ------------------------------------------------------------------ overlay
  const cues = [
    vignette({ start: 0, end: duration, strength: 0.38 }),
    // No labels during the analogy: the picture carries it. The first label names the NIC as it rises.
    fixedCard({ start: analogy.nicRise.to - 0.4, end: lanes.host.from, title: 'NIC', subtitle: 'the network interface card', anchorTo: { id: 'nic-controller', name: 'center' }, at: [118, 150] }),
    // Chapter 01's label lives in its own region, the lower-left corner — the NIC stands upstage in
    // every shot of the chapter, so the top-left is never free; it appears as the chapter's own shots
    // begin (sentence 4's reveal keeps buffer A in that corner).
    chapterLabel({ start: S(5) - 0.3, end: E(9), index: '01', label: 'TRADITIONAL PACKET PATH' }),
    zonedCallout({ zone: 'e02.zone.left', align: 'right', dy: -160, start: lanes.host.to - 0.4, end: E(4) - 0.1, title: 'BUFFER A', anchorTo: { id: 'buffer_a.header', name: 'header' } }),
    fixedCard({ start: lanes.host.to + 0.3, end: E(4) - 0.1, title: 'BUFFER B', anchorTo: { id: 'buffer_b.payload', name: 'payload' }, at: [760, 860] }),
    fixedCard({ start: lanes.host.to + 1.0, end: E(4) - 0.1, title: 'APPLICATION', anchorTo: { id: 'e02.app', name: 'center' }, at: [1802, 760], align: 'right' }),
    fixedCard({ start: lanes.host.to + 1.7, end: E(4) - 0.1, title: 'CPU', anchorTo: { id: 'cpu.ihs', name: 'top' }, at: [1802, 900], align: 'right' }),
    // Sentences 5–8: every card in an annotation zone — empty floor — never over the hardware.
    zonedCallout({ zone: 'e02.zone.left', align: 'right', valign: 'middle', start: lanes.dma.from + 0.3, end: E(5) + 0.1, title: 'DMA', subtitle: 'the NIC writes buffer A · no CPU', anchorTo: { id: 'e02.dma', name: 'center' } }),
    zonedCallout({ zone: 'e02.zone.cpu_side', align: 'right', valign: 'middle', dx: 70, start: lanes.copy1.from + 0.2, end: E(6) + 0.3, title: 'CPU COPY', subtitle: 'buffer A → buffer B', anchorTo: { id: 'e02.copy_a_b', name: 'center' }, color: C.red }),
    zonedCallout({ zone: 'e02.zone.cpu_side', align: 'right', valign: 'middle', dx: 130, start: lanes.copy2.from + 0.1, end: E(7) + 0.4, title: 'COPIED AGAIN', subtitle: 'buffer B → application', anchorTo: { id: 'e02.copy_b_app', name: 'center' }, color: C.red }),
    // The costs, each on its spoken word ("CPU cycles… memory bandwidth… cache"), once the wide shot has settled.
    costGroup({ zone: 'e02.zone.upstage_right', dy: -130, start: W('cpu', 8) - 0.2, end: E(8) + 0.4, heading: 'COST OF COPYING', items: ['CPU CYCLES', 'MEMORY BANDWIDTH', 'CACHE'], step: 1.05 }),
    zonedCallout({ zone: 'e02.zone.left', align: 'right', valign: 'middle', start: lanes.reference.from, end: E(10) + 0.3, title: 'A REFERENCE', subtitle: 'not a copy of the bytes', anchorTo: { id: 'e02.reference', name: 'center' }, color: C.gold }),
    sectionTitle({ start: S(11), end: M1, index: '02', label: 'ZERO COPY · THE MBUF' }),
    // Sentences 13–16: small cards in annotation zones — never over the mbuf, the buffer, the reference or the bytes.
    zonedCallout({ zone: 'e02.zone.behind_mbuf', align: 'right', valign: 'middle', start: lanes.mbuf.to, end: E(14) + 0.3, title: 'MBUF', subtitle: 'metadata — not the packet’s bytes', anchorTo: { id: 'mbuf.fields', name: 'center' }, color: MBUF }),
    zonedCallout({ zone: 'e02.zone.below_ref', start: W('address', 15), end: E(15) + 0.3, title: 'buf_addr', subtitle: 'the address of the bytes', anchorTo: { id: 'mbuf.fields', name: 'buf_addr' }, color: C.gold }),
    zonedCallout({ zone: 'e02.zone.before_a', valign: 'middle', start: S(16), end: M1 + 0.3, title: 'THE PACKET’S BYTES', subtitle: 'they live in the buffer', anchorTo: { id: 'buffer_a.payload', name: 'payload' } }),
    // ---- zero copy ----
    sectionTitle({ start: S(17), end: E(22), index: '03', label: 'THE MEMPOOL' }),
    // Sentences 17–22: cards in annotation zones beside the pool and the buffer — never on them.
    zonedCallout({ zone: 'e02.zone.pool_right', valign: 'middle', start: lanes.pool.from + 0.6, end: E(17), title: ['BEFORE ANY', 'PACKET ARRIVES'], subtitle: 'storage prepared in advance', anchorTo: { id: 'pool.elements', name: 'center' } }),
    zonedCallout({ zone: 'e02.zone.pool_right', valign: 'middle', start: S(18), end: E(18) + 0.4, title: 'MEMPOOL', subtitle: 'each element: an mbuf + its buffer', anchorTo: { id: 'pool.elements', name: 'center' }, color: C.violet }),
    zonedCallout({ zone: 'e02.zone.pool_right', valign: 'middle', start: lanes.representative.from + 0.8, end: S(20) + 0.8, title: ['ONE REPRESENTATIVE', 'ELEMENT'], subtitle: 'shown enlarged for clarity', anchorTo: { id: 'e02.representative', name: 'center' }, color: C.gold }),
    zonedCallout({ zone: 'e02.zone.left', align: 'right', valign: 'above', start: lanes.zdma.from + 0.2, end: E(21) + 0.3, title: 'DMA → BUFFER', subtitle: 'the NIC writes the element’s buffer', anchorTo: { id: 'e02.dma', name: 'center' } }),
    // Sentence 22 answers sentence 8: beside the CPU that takes no part, the opposite list — appearing once
    // the shot has settled, a chip near each spoken "no".
    costGroup({ zone: 'e02.zone.cpu_right', align: 'right', dy: -60, start: W('cpu', 22) + 0.4, end: E(22) + 0.4, heading: 'ZERO COPY', items: ['NO CPU', 'NO ALLOCATION', 'NO COPY'], color: C.accent, step: 1.6 }),
    // Chapter 04's identifier in the lower-right corner: in this chapter's composition the NIC stands
    // in the top-left and the Mempool in the lower-left.
    chapterLabel({ start: S(23) + 1.0, end: E(31), index: '04', label: 'ONE BUFFER · EVERY STAGE', corner: 'bottom-right' }),
    // Sentences 23–30: cards and stage tags in the episode's typography, in annotation zones — every card
    // of the chapter in the same place, the open floor upstage-right of the CPU.
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: W('same', 23) - 0.4, end: E(23) + 0.3, title: ['THE SAME', 'BUFFER'], subtitle: 'every stage works with it', anchorTo: { id: 'buffer_a.payload', name: 'payload' } }),
    ...STAGE_TAGS.map(([zone, label], i) => stageTag({ zone, label, start: lanes.stage[i] - 0.2, end: lanes.stageTags.to })),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: W('handle', 28) - 0.3, end: E(28) + 0.3, title: 'A HANDLE', subtitle: 'an address — not the bytes', anchorTo: { id: 'e02.handle', name: 'center' }, color: C.gold }),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: S(29), end: E(29) + 0.3, title: ['THE BUFFER', 'NEVER MOVES'], anchorTo: { id: 'buffer_a.payload', name: 'payload' } }),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: lanes.edit.from + 0.3, end: E(30) + 0.3, title: 'EDITED IN PLACE', subtitle: 'same buffer · same bytes · no copy', anchorTo: { id: 'buffer_a.header', name: 'header' } }),
    // Sentences 31–39 (milestone 6): every annotation in the episode's typography and zones.
    chapterLabel({ start: S(32), end: E(39), index: '05', label: 'WHY IT IS CHEAP', corner: 'bottom-right' }),
    ...STAGE_TAGS.map(([zone, label]) => stageTag({ zone, label, start: lanes.stageTags2.from, end: lanes.stageTags2.to })),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: W('key', 32) - 0.3, end: E(32) + 0.3, title: ['THE KEY', 'IDEA'], subtitle: 'the bytes stay where the NIC put them', anchorTo: { id: 'e02.handle', name: 'center' }, color: C.gold }),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: S(33), end: E(33) + 0.3, title: ['THE PACKET ISN’T', 'TRAVELLING'], anchorTo: { id: 'buffer_a.payload', name: 'payload' } }),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: S(34), end: E(34) + 0.6, title: ['ONLY THE', 'POINTER IS'], anchorTo: { id: 'e02.handle', name: 'center' }, color: C.gold }),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'above', start: W('8byte', 36), end: E(36), title: '≈ 8 BYTES', subtitle: 'an address, on a 64-bit system', anchorTo: { id: 'e02.handle', name: 'center' }, color: C.gold }),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'top', dy: 30, start: W('hundreds', 36), end: E(36), title: ['100s–1000s', 'OF BYTES'], subtitle: 'the packet — which stays put', anchorTo: { id: 'buffer_a.payload', name: 'payload' } }),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: S(37), end: E(37) + 0.3, title: ['MILLIONS OF', 'PACKETS A SECOND'], subtitle: 'illustrated: each one a handle', anchorTo: { id: 'e02.stage.classifier', name: 'center' }, color: C.gold }),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: S(38) + 0.6, end: E(38) + 0.3, title: ['THE CPU', 'DECIDES'], subtitle: 'instead of moving bytes', anchorTo: { id: 'cpu.ihs', name: 'top' }, color: '#A9BCCF' }),
    // Sentence 39: exactly the benefits the narration names, each near its word — in the place where
    // sentence 8's costs stood.
    costGroup({ zone: 'e02.zone.upstage_right', dy: -60, start: W('reduces', 39) - 0.3, end: E(39) + 0.4, heading: 'THE PAYOFF', items: ['LESS CPU OVERHEAD', 'LESS MEMORY BANDWIDTH', 'BETTER CACHE EFFICIENCY', 'TENS–HUNDREDS OF GBIT/S'], color: C.accent, step: 2.4 }),
    // Sentences 40–46 (milestone 7): every annotation in the episode's typography and zones.
    chapterLabel({ start: S(40), end: E(41) + 0.3, index: '06', label: 'TRANSMIT', corner: 'bottom-right' }),
    chapterLabel({ start: S(42), end: duration, index: '07', label: 'A PACKET IS A POINTER', corner: 'bottom-right' }),
    zonedCallout({ zone: 'e02.zone.left', align: 'right', valign: 'above', start: lanes.transmit.from + 0.4, end: E(40) + 0.4, title: 'TRANSMIT', subtitle: 'the NIC reads the same buffer · no copy', anchorTo: { id: 'e02.transmit', name: 'center' } }),
    zonedCallout({ zone: 'e02.zone.pool_right', valign: 'middle', start: W('returned', 41) - 0.3, end: E(41) + 0.3, title: ['BACK TO', 'THE MEMPOOL'], subtitle: 'reused for the next packet', anchorTo: { id: 'pool.elements', name: 'first_slot' }, color: C.violet }),
    zonedCallout({ zone: 'e02.zone.pool_right', valign: 'middle', start: S(42), end: E(42) + 0.3, title: 'SET UP ONCE', subtitle: 'before any packet arrived', anchorTo: { id: 'pool.elements', name: 'center' }, color: C.violet }),
    zonedCallout({ zone: 'e02.zone.pool_right', valign: 'middle', start: S(43), end: E(43) + 0.4, title: 'NEVER COPIED', anchorTo: { id: 'buffer_a.payload', name: 'payload' } }),
    ...STAGE_TAGS.map(([zone, label]) => stageTag({ zone, label, start: lanes.stageTags3.from, end: lanes.stageTags3.to })),
    zonedCallout({ zone: 'e02.zone.cpu_right', valign: 'middle', start: S(44) + 2.1, end: E(44) + 0.2, title: ['ONLY THE HANDLE', 'WAS PASSED'], anchorTo: { id: 'e02.handle', name: 'center' }, color: C.gold }),
    zonedCallout({ zone: 'e02.zone.pool_right', valign: 'middle', dy: -120, start: W('pointer', 45) - 0.3, end: duration, title: ['A PACKET IS A POINTER', 'TO ITS BYTES'], subtitle: 'the essence of zero copy', anchorTo: { id: 'e02.handle', name: 'center' }, color: C.gold }),
  ];

  const sections = [
    { index: '00', label: 'THE LIBRARY ANALOGY', from: 0, to: S(4) },
    { index: '01', label: 'TRADITIONAL PACKET PATH', from: S(4), to: S(10) },
    { index: '02', label: 'ZERO COPY · THE MBUF', from: S(10), to: S(17) },
    { index: '03', label: 'THE MEMPOOL', from: S(17), to: S(23) },
    { index: '04', label: 'ONE BUFFER · EVERY STAGE', from: S(23), to: S(32) },
    { index: '05', label: 'WHY IT IS CHEAP', from: S(32), to: S(40) },
    { index: '06', label: 'TRANSMIT', from: S(40), to: S(42) },
    { index: '07', label: 'A PACKET IS A POINTER', from: S(42), to: duration },
  ];

  // ------------------------------------------------------------------ the AxioByte end card
  // APPEND-ONLY: the approved film ends at `duration` (the voiceover plus its hold) and nothing above
  // changes; the brand's end card (renderers/three/src/brand) starts exactly there and runs after it.
  // Inside this storyboard `duration` keeps meaning the film's end; the video's length is `total`.
  const filmEnd = duration;
  const total = filmEnd + END_CARD;
  cues.push(brandEndCard({ start: filmEnd, end: total }));
  sections.push({ index: '', label: 'AXIOBYTE', from: filmEnd, to: total });

  return { duration: total, filmEnd, audioEnd, end: END, shots, cues, sections, lanes, highlightsAt };
}
