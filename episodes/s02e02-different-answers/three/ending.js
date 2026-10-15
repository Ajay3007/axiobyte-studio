import { ramp } from '@axiobyte/three/video/overlay/draw.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { CLOSE, HUE, XC } from './look.js';
import { halo, makeBar, makePanel, makeText } from './objects.js';

/**
 * B29–B30: the next question. A fresh answer card fills steadily, as if sure of
 * itself — its lines are placeholders, so it makes no claim and shows no error —
 * and a question mark is left open. s02e03 answers it; this film does not.
 */

const VIS = 0.004;

export function buildEnding(scene) {
  const card = makePanel(CLOSE.w, CLOSE.h, C.lineStrong, { round: 0.08 });
  card.mesh.position.set(XC, CLOSE.y, 0);
  const glow = halo(HUE.ink, CLOSE.w * 1.3, CLOSE.h * 1.8);
  glow.position.set(XC, CLOSE.y, -0.05);
  const inner = CLOSE.w - 0.4;
  const top = CLOSE.y + CLOSE.h / 2 - 0.28;
  const lines = CLOSE.lines.map((f, k) => {
    const bar = makeBar(HUE.ink, 0.075);
    bar.mesh.position.set(XC - inner / 2, top - k * 0.22, 0.01);
    scene.add(bar.mesh);
    return { bar, len: inner * f };
  });
  const q = makeText('?', { h: CLOSE.q.h, color: C.ink, weight: 600 });
  q.mesh.position.set(XC, CLOSE.q.y, 0.02);
  const qGlow = halo(HUE.ink, 1.2, 1.4);
  qGlow.position.set(XC, CLOSE.q.y, -0.02);
  scene.add(card.mesh, glow, q.mesh, qGlow);
  return { card, glow, lines, q, qGlow };
}

export function poseEnding(o, t, T) {
  const card = ramp(t, T.which + 0.5, T.which + 1.1);
  o.card.mat.opacity = 0.95 * card;
  o.card.mesh.visible = card > VIS;
  // "sound completely sure": the lines fill at an even, unhesitating pace.
  const fill0 = T.answer45;
  const fill1 = T.sure + 0.25;
  const per = (fill1 - fill0) / o.lines.length;
  o.lines.forEach(({ bar, len }, k) => {
    const u = ramp(t, fill0 + k * per, fill0 + (k + 1) * per);
    bar.mesh.scale.x = Math.max(1e-3, len * u);
    bar.mat.opacity = 0.55 * card * Math.min(1, u * 4);
    bar.mesh.visible = bar.mat.opacity > VIS;
  });
  o.glow.material.opacity = 0.18 * card * ramp(t, T.completely, T.sure + 0.3);
  o.glow.visible = o.glow.material.opacity > VIS;
  // "and still be wrong?" — posed, not answered.
  const qn = ramp(t, T.wrong - 0.1, T.wrong + 0.3);
  o.q.mat.opacity = qn;
  o.q.mesh.visible = qn > VIS;
  o.qGlow.material.opacity = 0.3 * qn;
  o.qGlow.visible = qn > VIS;
}
