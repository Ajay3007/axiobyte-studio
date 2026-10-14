import * as THREE from 'three';
import { ramp } from '@axiobyte/three/video/overlay/draw.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { BANANA, CANDIDATES, CHOSEN, DIM, HUE, PANEL, SPLIT } from './look.js';
import { additive, makeBar, makeText, makeTile } from './objects.js';

/**
 * The first next-token prediction, above the top layer: the last position's
 * numbers become a score for every token, the scores become probabilities, and
 * one token is picked by weighted chance — "The", not the likeliest.
 */

const win = (t, a, b, fade = 0.3) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));
const lerp = (a, b, u) => a + (b - a) * u;

/** Illustrative raw scores: close together, as raw scores are, before probabilities spread them apart. */
const SCORES = [4.1, 3.95, 3.3, 2.9, 2.4, 1.9];
const TAIL = 16;

const left = PANEL.x - PANEL.stripW / 2;
const rowY = (r) => PANEL.top - r * PANEL.row;
const barX = left + PANEL.labelW + 0.08;
const probLen = (p) => (p / CANDIDATES[0].p) * PANEL.barMax;

export function buildPrediction(scene) {
  const [, , , , FTOP] = DIM.floors;
  const from = new THREE.Vector3(SPLIT.at(-1).x, FTOP + 0.15, 0);
  const to = new THREE.Vector3(PANEL.x, rowY(CANDIDATES.length) - 0.1, 0);
  const curve = new THREE.QuadraticBezierCurve3(from, new THREE.Vector3(from.x, (from.y + to.y) / 2, 0.2), to);
  const beam = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.016, 6, false), additive(HUE.context, 0));
  scene.add(beam);

  const rows = [...CANDIDATES, BANANA].map((c, r) => {
    const tile = makeTile(c.text);
    tile.group.scale.setScalar(0.6);
    const bar = makeBar(HUE.prob, 0.17);
    const pct = makeText(c === BANANA ? '≈ 0%' : `${Math.round(c.p * 100)}%`, { h: 0.22, color: C.green, weight: 600 });
    scene.add(tile.group, bar.mesh, pct.mesh);
    return { c, r, tile, bar, pct };
  });

  // The rest of the vocabulary: a long list behind the shown candidates, fading into the dark.
  const tail = Array.from({ length: TAIL }, (_, k) => {
    const bar = makeBar(HUE.prob, 0.05);
    bar.mesh.position.set(barX, rowY(CANDIDATES.length) - 0.1 - k * 0.11, -0.3 - k * 0.12);
    bar.mesh.scale.x = 0.04 + 0.12 * Math.abs(Math.sin(k * 2.17));
    scene.add(bar.mesh);
    return bar;
  });

  // The pick: a strip cut in proportion to the probabilities, and a marker that comes to rest in one segment.
  const total = CANDIDATES.reduce((a, c) => a + c.p, 0);
  let sx = left;
  const segments = [...CANDIDATES, { text: 'rest', p: 1 - total }].map((c, k) => {
    const w = PANEL.stripW * c.p;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, w - 0.025), 0.2, 0.04), additive(HUE.prob, 0));
    mesh.position.set(sx + w / 2, PANEL.stripY, 0);
    sx += w;
    scene.add(mesh);
    return { mesh, mid: sx - w / 2, rest: k === CANDIDATES.length };
  });
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), new THREE.MeshBasicMaterial({ color: HUE.ink, transparent: true, opacity: 0, toneMapped: false }));
  marker.rotation.z = Math.PI;
  scene.add(marker);

  return { beam, rows, tail, segments, marker };
}

/** Where the chosen candidate's tile sits in the panel (generation flies it down from here). */
export const chosenAt = () => new THREE.Vector3(left + PANEL.labelW / 2, rowY(CHOSEN), 0);
/** Strip positions, for the overlay's "most likely" / "chosen" labels. */
export const stripAt = (k) => {
  const total = CANDIDATES.slice(0, k).reduce((a, c) => a + c.p, 0);
  return new THREE.Vector3(left + PANEL.stripW * (total + CANDIDATES[k].p / 2), PANEL.stripY + 0.5, 0);
};

export function posePrediction(o, t, T) {
  const shown = win(t, T.predicts - 0.3, T.again + 0.6, 0.5);
  o.beam.material.opacity = 0.7 * win(t, T.predicts - 0.3, T.again, 0.4);
  const toProb = ramp(t, T.turns, T.probabilities + 0.2);
  o.rows.forEach(({ c, r, tile, bar, pct }) => {
    const banana = c === BANANA;
    const arrive = banana ? ramp(t, T.banana - 0.25, T.banana + 0.15) : ramp(t, T.predicts + r * 0.08, T.predicts + 0.35 + r * 0.08);
    const y = banana ? rowY(CANDIDATES.length + 0.25) : rowY(r);
    const z = banana ? lerp(-2.2, 0, arrive) : 0;
    tile.group.position.set(left + PANEL.labelW / 2, y, z);
    const lit = banana ? win(t, T.banana - 0.1, T.chosen - 0.2) : c.text === 'The' ? win(t, T.theHigh - 0.1, T.again) : c.text === 'Sunlight' ? win(t, T.sunlightHigh - 0.1, T.chosen - 0.3) : 0;
    const picked = r === CHOSEN ? ramp(t, T.chosen, T.chosen + 0.3) : 0;
    const leaving = r === CHOSEN ? ramp(t, T.again, T.again + 0.2) : 0; // generation takes the tile from here
    const fade = r === CHOSEN ? 1 - leaving : 1 - 0.55 * ramp(t, T.chosen, T.chosen + 0.4);
    const o1 = shown * arrive * fade;
    tile.materials[0].opacity = 0.96 * o1;
    tile.materials[1].opacity = o1;
    tile.glow.material.opacity = o1 * (0.15 + 0.8 * Math.max(lit, picked));
    tile.body.visible = tile.face.visible = o1 > 0.004;
    // A raw score first (the bars sit close together), then its probability (they spread apart).
    const len = banana ? 0.012 : lerp((SCORES[r] / SCORES[0]) * PANEL.barMax * 0.9, probLen(c.p), toProb);
    bar.mesh.position.set(barX, y, z);
    bar.mesh.scale.x = Math.max(1e-3, len * ramp(t, T.scores + r * 0.06, T.scores + 0.4 + r * 0.06));
    bar.mat.opacity = o1 * (0.55 + 0.45 * Math.max(lit, picked));
    bar.mesh.visible = bar.mat.opacity > 0.004;
    pct.mesh.position.set(barX + Math.max(len, 0.02) + 0.1 + pct.width / 2, y, z);
    pct.mat.opacity = o1 * (banana ? ramp(t, T.noChance - 0.1, T.noChance + 0.3) : ramp(t, T.probabilities - 0.1, T.probabilities + 0.3));
    pct.mesh.visible = pct.mat.opacity > 0.004;
  });
  const every = ramp(t, T.everyToken - 0.1, T.everyToken + 0.6) * shown;
  o.tail.forEach((b, k) => {
    b.mat.opacity = every * 0.5 * (1 - k / o.tail.length);
    b.mesh.visible = b.mat.opacity > 0.004;
  });

  const strip = win(t, T.chosen - 0.7, T.again + 0.4, 0.35);
  const usually = win(t, T.usually - 0.1, T.likeliest + 0.6, 0.3);
  o.segments.forEach((s, k) => {
    const big = !s.rest && CANDIDATES[k].p >= 0.13;
    s.mesh.material.opacity = strip * (s.rest ? 0.18 : 0.45 + 0.4 * usually * (big ? 1 : 0) + (k === CHOSEN ? 0.4 * ramp(t, T.chosen, T.chosen + 0.2) : 0));
    s.mesh.visible = s.mesh.material.opacity > 0.004;
  });
  // The marker sweeps the strip, slowing, and stops inside "The" on "chosen". Deterministic: a damped sweep.
  const u = ramp(t, T.one - 0.1, T.chosen);
  const target = o.segments[CHOSEN].mid;
  const sweep = target + (1 - u) * Math.sin(u * 9.5) * 1.4;
  o.marker.position.set(sweep, PANEL.stripY + 0.24, 0);
  o.marker.material.opacity = strip;
  o.marker.visible = strip > 0.004;
}
