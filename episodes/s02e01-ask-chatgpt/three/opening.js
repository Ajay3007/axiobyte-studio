import * as THREE from 'three';
import { ramp } from '@axiobyte/three/video/overlay/draw.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { ANSWER, HUE, PICKED, PROMPT } from './look.js';
import { makeBar, makePanel, makeText } from './objects.js';

/**
 * The film's bookends: a generic prompt bar the question is typed into, and the
 * answer streaming above it, word by word. The opening types the question on
 * the words that speak it and lets the answer start; the ending streams the
 * answer again, each word over its own (illustrative) probability.
 */

const win = (t, a, b, fade = 0.3) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));


export function buildOpening(scene) {
  const bar = makePanel(PROMPT.width, PROMPT.height);
  bar.mesh.position.set(0, PROMPT.y, 0);
  const placeholder = makeText('Ask anything', { h: 0.32, color: C.muted, weight: 500 });
  const caret = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.38), new THREE.MeshBasicMaterial({ color: HUE.token, transparent: true, opacity: 0, toneMapped: false }));
  scene.add(bar.mesh, placeholder.mesh, caret);

  // The question, one plane per word, laid out on one line inside the bar.
  const words = ['Why', 'is', 'the', 'sky', 'blue?'].map((w) => makeText(w, { h: 0.34 }));
  const space = 0.07;
  let x = -PROMPT.width / 2 + 0.3;
  words.forEach((w) => {
    w.mesh.position.set(x + w.width / 2, PROMPT.y, 0.01);
    x += w.width + space;
    scene.add(w.mesh);
  });
  placeholder.mesh.position.set(-PROMPT.width / 2 + 0.3 + placeholder.width / 2, PROMPT.y, 0.01);

  // The answer, wrapped to the bar's width, one plane per word, each with a probability bar under it.
  const answer = ANSWER.map((w, k) => ({ text: makeText(w + (k === ANSWER.length - 1 ? '…' : ''), { h: 0.31, weight: 500 }), prob: makeBar(HUE.prob, 0.04) }));
  let ax = -PROMPT.width / 2 + 0.15;
  let row = 0;
  answer.forEach((a) => {
    if (ax + a.text.width > PROMPT.width / 2) {
      ax = -PROMPT.width / 2 + 0.15;
      row += 1;
    }
    a.text.mesh.position.set(ax + a.text.width / 2, PROMPT.answerY + 0.5 - row * 0.5, 0);
    a.prob.mesh.position.set(ax + 0.04, PROMPT.answerY + 0.5 - row * 0.5 - 0.2, 0);
    a.width = a.text.width;
    ax += a.text.width + 0.04;
    scene.add(a.text.mesh, a.prob.mesh);
  });

  return { bar, placeholder, caret, words, answer };
}

export function poseOpening(o, t, T) {
  // The bar: the opening, then away once the question has become tokens; back for the ending.
  const opening = 1 - ramp(t, T.butFirst + 0.2, T.stop + 0.4);
  const ending = ramp(t, T.nextTime - 0.6, T.nextTime + 0.3);
  const barOn = Math.max(opening, ending);
  o.bar.mat.opacity = barOn * (1 - 0.45 * win(t, T.enter + 0.4, T.butFirst + 0.6, 0.4));
  o.bar.mesh.visible = barOn > 0.004;

  o.placeholder.mat.opacity = 0.9 * (1 - ramp(t, T.follow, T.follow + 0.5));

  // Each word of the question appears as it is spoken; on "enter" the words leave the bar (they become the tiles).
  const sent = ramp(t, T.enter, T.enter + 0.35);
  o.words.forEach((w, k) => {
    const typed = ramp(t, T.typed[k] - 0.05, T.typed[k] + 0.08);
    w.mat.opacity = typed * (1 - sent) + ending * 0.75;
    w.mesh.visible = w.mat.opacity > 0.004;
  });
  const typedCount = T.typed.filter((tt) => t >= tt).length;
  const lastTyped = o.words[typedCount - 1];
  const caretX = lastTyped ? lastTyped.mesh.position.x + lastTyped.width / 2 + 0.04 : -PROMPT.width / 2 + 0.3;
  o.caret.position.set(caretX, PROMPT.y, 0.02);
  const blink = Math.floor(t * 2.2) % 2 === 0 ? 1 : 0.15;
  o.caret.material.opacity = (1 - sent) * opening * blink;
  o.caret.visible = o.caret.material.opacity > 0.004;

  // The answer streams on "appears, word by word", and is withdrawn on "But first".
  o.answer.forEach((a, k) => {
    const n = o.answer.length;
    const first = ramp(t, T.appears + k * 0.18, T.appears + k * 0.18 + 0.12) * (1 - ramp(t, T.butFirst + (n - 1 - k) * 0.06, T.butFirst + (n - 1 - k) * 0.06 + 0.15));
    const again = ramp(t, T.appearsAgain + k * 0.12, T.appearsAgain + k * 0.12 + 0.1);
    a.text.mat.opacity = Math.max(first, again);
    a.text.mesh.visible = a.text.mat.opacity > 0.004;
    // "You're watching it being predicted": every word was a pick, from a distribution.
    const p = ramp(t, T.predicted - 0.4 + k * 0.07, T.predicted + 0.1 + k * 0.07);
    a.prob.mesh.scale.x = Math.max(1e-3, a.width * PICKED[k] * p);
    a.prob.mat.opacity = 0.9 * p * again;
    a.prob.mesh.visible = a.prob.mat.opacity > 0.004;
  });
}

