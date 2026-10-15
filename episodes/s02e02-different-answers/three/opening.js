import * as THREE from 'three';
import { ramp } from '@axiobyte/three/video/overlay/draw.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { ANSWER_A, ANSWER_B, HUE, OPEN, XC } from './look.js';
import { additive, halo, makePanel, makeText } from './objects.js';

/**
 * B01–B05: the same question asked twice, two different answers, neither a
 * mistake — then the camera goes looking at the first word. Built once; posed
 * from the time alone.
 *
 * The answers stream on the words that speak them (the narration reads both
 * openings aloud), and the "same question" proof is the replay's language
 * introduced early: a ghost of one prompt slides onto the other and matches it.
 */

const win = (t, a, b, fade = 0.3) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));
const VIS = 0.004;
const QUESTION_WORDS = ['Why', 'is', 'the', 'sky', 'blue?'];
const ANSWERS = [
  [...ANSWER_A.slice(0, -1), `${ANSWER_A.at(-1)}…`],
  [...ANSWER_B.slice(0, -1), `${ANSWER_B.at(-1)}…`],
];

function wordsInto(scene, words, { h, x0, inner, y, lead = 1.3, color = C.ink, weight = 500 }) {
  const planes = words.map((w) => makeText(w, { h, color, weight }));
  const space = h * 0.06;
  let x = 0;
  let line = 0;
  planes.forEach((p, k) => {
    if (k > 0 && x + p.width > inner) {
      x = 0;
      line++;
    }
    p.lx = x;
    p.line = line;
    x += p.width + space;
  });
  const lines = line + 1;
  planes.forEach((p) => {
    p.mesh.position.set(x0 + p.lx + p.width / 2, y + ((lines - 1) / 2 - p.line) * h * lead, 0.01);
    scene.add(p.mesh);
  });
  return planes;
}

export function buildOpening(scene) {
  const left = XC - OPEN.w / 2;
  const chats = OPEN.chats.map((c, s) => {
    const prompt = makePanel(OPEN.w, OPEN.promptH);
    prompt.mesh.position.set(XC, c.prompt, 0);
    const placeholder = makeText('Ask anything', { h: OPEN.promptTextH, color: C.muted, weight: 500 });
    placeholder.mesh.position.set(left + 0.25 + placeholder.width / 2, c.prompt, 0.01);
    const caret = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.28), new THREE.MeshBasicMaterial({ color: HUE.token, transparent: true, opacity: 0, toneMapped: false }));
    scene.add(prompt.mesh, placeholder.mesh, caret);
    const typed = wordsInto(scene, QUESTION_WORDS, { h: OPEN.promptTextH, x0: left + 0.25, inner: OPEN.w - 0.5, y: c.prompt, weight: 600 });

    const card = makePanel(OPEN.w, OPEN.cardH, C.lineStrong, { round: 0.1 });
    card.mesh.position.set(XC, c.card, 0);
    const glow = halo(HUE.ink, OPEN.w * 1.35, OPEN.cardH * 2.2);
    glow.position.set(XC, c.card, -0.05);
    scene.add(card.mesh, glow);
    const words = wordsInto(scene, ANSWERS[s], { h: OPEN.textH, x0: left + 0.2, inner: OPEN.w - 0.4, y: c.card });
    return { prompt, placeholder, caret, typed, card, glow, words };
  });

  // The "same question" proof: run B's prompt, as outline and lettering, rising onto run A's.
  const ghost = {
    bar: makePanel(OPEN.w, OPEN.promptH, C.muted),
    words: wordsInto(scene, QUESTION_WORDS, { h: OPEN.promptTextH, x0: left + 0.25, inner: OPEN.w - 0.5, y: 0, color: C.muted, weight: 600 }),
  };
  ghost.bar.mesh.material.depthTest = false;
  scene.add(ghost.bar.mesh);
  ghost.offsets = ghost.words.map((p) => p.mesh.position.x);

  // One model, faint behind both chats: a stack of thin plates in ink, s02e01's layers in silhouette.
  const M = OPEN.model;
  const plates = Array.from({ length: M.plates }, (_, k) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(M.w, M.d), additive(HUE.ink, 0));
    mesh.material.side = THREE.DoubleSide;
    mesh.rotation.x = -Math.PI / 2.35;
    mesh.position.set(XC, M.y + (k - (M.plates - 1) / 2) * M.gap, M.z);
    scene.add(mesh);
    return mesh;
  });
  // Its two feeds: one into each answer.
  const beams = OPEN.chats.map((c) => {
    const from = new THREE.Vector3(XC + OPEN.w / 2 - 0.2, M.y, M.z);
    const to = new THREE.Vector3(XC + OPEN.w / 2 - 0.25, c.card, -0.02);
    const curve = new THREE.QuadraticBezierCurve3(from, new THREE.Vector3(from.x + 0.35, (from.y + to.y) / 2, (from.z + to.z) / 2), to);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 6, false), additive(HUE.ink, 0));
    scene.add(mesh);
    return mesh;
  });

  // Where the two first words sit: the list's "The" and "Sunlight" tiles appear here (animate.js).
  const firstAt = chats.map((c) => ({ x: c.words[0].mesh.position.x, y: c.words[0].mesh.position.y }));
  return { chats, ghost, plates, beams, firstAt };
}

/** The opening's overall presence: full until B05's push, then gone as s02e01's world comes back (B06). */
export const openingPresence = (t, T) => 1 - ramp(t, T.asWeSaw - 0.15, T.asWeSaw + 0.6);

export function poseOpening(o, t, T) {
  const present = openingPresence(t, T);
  const dimRest = 1 - 0.9 * ramp(t, T.look, T.look + 0.7); // B05: everything but the first words dims away
  const promptIn = [ramp(t, T.ask - 0.1, T.ask + 0.35), ramp(t, T.twice, T.twice + 0.35)];
  const cardIn = [ramp(t, T.twoAnswers - 0.05, T.twoAnswers + 0.4), ramp(t, T.different - 0.05, T.different + 0.4)];
  const speaking = [win(t, T.oneBegins - 0.1, T.otherBegins, 0.25), win(t, T.otherBegins - 0.1, T.neither + 0.2, 0.25)];
  const steady = win(t, T.neither, T.sameQ0 + 0.2, 0.5); // B03: both settle to the same calm glow
  const firstLit = ramp(t, T.changed - 0.05, T.changed + 0.3); // B04: the first words are where they differ
  // While B's prompt rises across answer A, that card steps back so the two never collide.
  const crossing = 1 - 0.75 * win(t, T.sameQ0, T.sameQ0 + 0.8, 0.15);

  o.chats.forEach((c, s) => {
    const p = promptIn[s] * present;
    c.prompt.mat.opacity = p * dimRest;
    c.prompt.mesh.visible = p > VIS;
    const typing = T.typed[0];
    c.placeholder.mat.opacity = p * (1 - ramp(t, typing - 0.15, typing));
    c.placeholder.mesh.visible = c.placeholder.mat.opacity > VIS;
    c.typed.forEach((w, k) => {
      w.mat.opacity = p * dimRest * ramp(t, T.typed[k] - 0.02, T.typed[k] + 0.12);
      w.mesh.visible = w.mat.opacity > VIS;
    });
    // The caret blinks at the end of what has been typed, until the question is complete.
    const done = c.typed.filter((_, k) => t >= T.typed[k]).at(-1);
    const cx = done ? done.mesh.position.x + done.width / 2 + 0.03 : c.placeholder.mesh.position.x - c.placeholder.width / 2 - 0.02;
    c.caret.position.set(cx, c.prompt.mesh.position.y, 0.02);
    const blink = Math.sin(t * Math.PI * 2 * 1.1) > -0.2 ? 1 : 0;
    c.caret.material.opacity = p * blink * (1 - ramp(t, T.typed.at(-1) + 0.4, T.typed.at(-1) + 0.6));
    c.caret.visible = c.caret.material.opacity > VIS;

    const k = cardIn[s] * present;
    c.card.mesh.scale.y = Math.max(1e-3, cardIn[s]);
    c.card.mat.opacity = 0.95 * k * dimRest;
    c.card.mesh.visible = k > VIS;
    c.glow.material.opacity = k * dimRest * (0.12 * Math.max(speaking[s], 0) + 0.1 * steady);
    c.glow.visible = c.glow.material.opacity > VIS;
    const times = s === 0 ? T.aWords : T.bWords;
    c.words.forEach((w, j) => {
      const shown = ramp(t, times[j] - 0.02, times[j] + 0.15);
      // The first word hands over to its token tile (animate.js) as it lights up.
      const keep = j === 0 ? 1 - firstLit : dimRest;
      w.mat.opacity = k * shown * keep * (s === 0 ? crossing : 1);
      w.mesh.visible = w.mat.opacity > VIS;
    });
  });

  // "Same question": B's prompt rises onto A's and matches it letter for letter.
  const rise = ramp(t, T.sameQ0 + 0.05, T.sameQ0 + 0.65);
  const g = win(t, T.sameQ0, T.sameModel + 0.1, 0.2) * present;
  const [A, B] = OPEN.chats;
  const y = B.prompt + (A.prompt - B.prompt) * rise;
  o.ghost.bar.mesh.position.set(XC, y, 0.06);
  o.ghost.bar.mat.opacity = 0.8 * g;
  o.ghost.bar.mesh.visible = g > VIS;
  o.ghost.words.forEach((w, k) => {
    w.mesh.position.set(o.ghost.offsets[k], y, 0.07);
    w.mat.opacity = 0.9 * g;
    w.mesh.visible = g > VIS;
  });
  const lock = win(t, T.sameQ0 + 0.6, T.sameQ0 + 1.0, 0.12);
  o.chats[0].glow.material.opacity += 0.25 * lock * present;

  // "Same model": the silhouette, faint since "AI", firms up and feeds both answers.
  const model = present * 0.12 * win(t, T.sameModel - 0.1, T.look + 0.3, 0.3);
  o.plates.forEach((m) => {
    m.material.opacity = model;
    m.visible = model > VIS;
  });
  o.beams.forEach((b) => {
    b.material.opacity = 0.55 * present * win(t, T.sameModel + 0.05, T.look, 0.3);
    b.visible = b.material.opacity > VIS;
  });
}
