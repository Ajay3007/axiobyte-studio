import * as THREE from 'three';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { cumulative } from '@axiobyte/three/domains/ml/probability.js';
import { HUE } from './look.js';
import { additive, halo, makeText } from './objects.js';
import { TAU } from './spin.js';

/**
 * The weighted draw as an object: one slice per token, each exactly as wide as
 * its probability. It starts life as s02e01's pick strip and curls into a wheel
 * (bend), so the viewer watches the same proportions change shape rather than
 * being shown a new picture.
 *
 * Slice i covers the fraction [cdf[i-1], cdf[i]) of the strip, left to right,
 * and of the ring, clockwise from the bottom. Every slice is its own mesh: the
 * named tokens and each of the many tail tokens, never one pooled "rest".
 */

const lerp = (a, b, u) => a + (b - a) * u;

/**
 * A point of the strip-to-ring bend, in the wheel's own frame (its centre at
 * the origin once it is a ring). `f` runs along the strip (0..1), `a` across it
 * (-1 inner edge, +1 outer edge), `m` is the bend (0 strip, 1 ring). The strip's
 * centre line keeps its top at y = rc throughout, so the slice under the
 * pointer never moves while the rest curls down around it.
 */
export function bendPoint(f, a, m, g) {
  const rc = (g.rIn + g.rOut) / 2;
  const L = lerp(g.stripW, TAU * rc, m);
  const h = lerp(g.stripH, g.rOut - g.rIn, m);
  const s = (f - 0.5) * L;
  if (m < 1e-5) return [s, rc + (a * h) / 2];
  const R = L / (TAU * m);
  const th = s / R;
  const r = R + (a * h) / 2;
  return [r * Math.sin(th), rc - R + r * Math.cos(th)];
}

/**
 * @param {THREE.Object3D} parent
 * @param {{ tokens: string[], probs: number[], named: number }} vocab
 * @param {{ rIn, rOut, stripW?, stripH?, gap?, labels?: number[], labelH?, pct?: boolean, hue?, ghost?: boolean }} g
 */
export function buildWheel(parent, vocab, g) {
  const geo = { stripW: TAU * ((g.rIn + g.rOut) / 2), stripH: g.rOut - g.rIn, gap: 0.002, labelH: 0.2, ...g };
  const group = new THREE.Group();
  parent.add(group);
  const cdf = cumulative(vocab.probs);
  const hue = g.ghost ? HUE.ghost : HUE.prob;

  const slices = vocab.probs.map((p, i) => {
    const named = i < vocab.named;
    const f0 = (i === 0 ? 0 : cdf[i - 1]) + (named ? geo.gap / 2 : 0);
    const f1 = cdf[i] - (named ? geo.gap / 2 : 0);
    const n = Math.max(g.minSegments ?? 1, Math.ceil(p * 160));
    const positions = new Float32Array((n + 1) * 2 * 3);
    const index = [];
    for (let j = 0; j < n; j++) {
      const k = j * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bg.setIndex(index);
    const mat = additive(hue.clone(), 0);
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(bg, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    // Named slices are solid; the tail's many slivers alternate, so they read as many tokens.
    const base = named ? 0.4 : i % 2 ? 0.14 : 0.26;
    return { i, p, f0, f1, n, mesh, mat, positions, base, named };
  });

  // Labels: upright text placed at the slice's middle, inside the ring (the animator keeps them upright).
  const labels = (g.labels ?? []).map((i) => {
    const name = makeText(vocab.tokens[i], { h: geo.labelH, color: C.ink, weight: 600 });
    const pct = g.pct ? makeText(`${Math.round(vocab.probs[i] * 100)}%`, { h: geo.labelH * 0.9, color: C.ink, weight: 600 }) : null;
    parent.add(name.mesh);
    if (pct) parent.add(pct.mesh);
    const mid = ((i === 0 ? 0 : cdf[i - 1]) + cdf[i]) / 2;
    return { i, name, pct, mid };
  });

  let bent = -1;
  /** Shape every slice for bend m (0 strip … 1 ring). Recomputed only when m changes. */
  function bend(m) {
    if (Math.abs(m - bent) < 1e-6) return;
    bent = m;
    for (const s of slices) {
      for (let j = 0; j <= s.n; j++) {
        const f = s.f0 + ((s.f1 - s.f0) * j) / s.n;
        const [xi, yi] = bendPoint(f, -1, m, geo);
        const [xo, yo] = bendPoint(f, 1, m, geo);
        const k = j * 6;
        s.positions[k] = xi;
        s.positions[k + 1] = yi;
        s.positions[k + 2] = 0;
        s.positions[k + 3] = xo;
        s.positions[k + 4] = yo;
        s.positions[k + 5] = 0;
      }
      s.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }
  bend(1);

  /** A label's position in the wheel's frame, at bend m: just above the strip, or inside its slice on the ring. */
  function labelPoint(label, m) {
    const [sx, sy] = bendPoint(label.mid, 1, 0, geo);
    const strip = [sx, sy + geo.labelH * 0.9];
    const r = geo.rIn + (geo.rOut - geo.rIn) * 0.6;
    const th = (label.mid - 0.5) * TAU;
    const ring = [r * Math.sin(th), r * Math.cos(th)];
    return [lerp(strip[0], ring[0], m), lerp(strip[1], ring[1], m)];
  }

  /**
   * Re-proportion every slice to new probabilities (the temperature wheel, B20–B25):
   * each slice stays exactly as wide as its probability. The approved wheels never call this.
   */
  function setProbs(probs) {
    let acc = 0;
    probs.forEach((p, i) => {
      const s = slices[i];
      const named = i < vocab.named;
      s.p = p;
      s.f0 = acc + (named ? geo.gap / 2 : 0);
      acc += p;
      s.f1 = acc - (named ? geo.gap / 2 : 0);
      cdf[i] = acc;
    });
    labels.forEach((l) => (l.mid = ((l.i === 0 ? 0 : cdf[l.i - 1]) + cdf[l.i]) / 2));
    const m = bent;
    bent = -1;
    bend(m);
  }

  return { group, slices, labels, bend, labelPoint, setProbs, geo, cdf, vocab };
}

/**
 * A wheel's outline: the boundaries between its named slices and its rim, as
 * thin lines. The replay's ghost of run 1 is drawn this way, in front of the
 * live wheel, so its slice edges can be seen landing on the live ones. It is
 * built from the same probabilities, so where it lands is exact.
 */
export function buildOutline(parent, vocab, g) {
  const group = new THREE.Group();
  parent.add(group);
  const cdf = cumulative(vocab.probs);
  const mats = [];
  const line = (mesh) => {
    mats.push(mesh.material);
    group.add(mesh);
  };
  const w = 0.016;
  for (const f of [0, ...cdf.slice(0, vocab.named)]) {
    const th = (f - 0.5) * TAU;
    const len = g.rOut - g.rIn;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, len), additive(HUE.ink, 0));
    const r = (g.rIn + g.rOut) / 2;
    bar.position.set(r * Math.sin(th), r * Math.cos(th), 0);
    bar.rotation.z = -th;
    line(bar);
  }
  for (const r of [g.rIn, g.rOut]) line(new THREE.Mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 128), additive(HUE.ink, 0)));
  return { group, mats };
}

/** The pointer: E01's marker, a small downward triangle in ink. */
export function makePointer() {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.22, 3),
    new THREE.MeshBasicMaterial({ color: HUE.ink, transparent: true, opacity: 0, toneMapped: false }),
  );
  mesh.rotation.z = Math.PI;
  const glow = halo(HUE.ink, 0.5, 0.5);
  return { mesh, glow };
}

/** A drawn outcome in a sample: a small cyan dot. */
export function makeDot() {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.042, 20), additive(HUE.token, 0));
  const glow = halo(HUE.token, 0.26, 0.26);
  return { mesh, glow };
}
