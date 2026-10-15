import * as THREE from 'three';
import { ramp } from '@axiobyte/three/video/overlay/draw.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { mulberry32 } from '@axiobyte/three/core/rng.js';
import { pick } from '@axiobyte/three/domains/ml/probability.js';
import { AFTER_SUNLIGHT, AFTER_THE, ANSWER_A, ANSWER_B, BRANCH, DIM, FIRST, HUE, INPUTS, ROW, TREE, XC, branchAt, stepVocabulary } from './look.js';
import { additive, halo, makePanel, makeText } from './objects.js';
import { buildWheel } from './wheel.js';

/**
 * The tree of possible answers (B17–B19) and its return (B26–B28).
 *
 * Branches A and B — the two answers already drawn, as word tiles — are two
 * paths through a larger tree of possible continuations, drawn as dots. Each
 * node's step probability is illustrative and seeded; a path's probability is
 * the product of its steps, and its brightness follows that product.
 */

const win = (t, a, b, fade = 0.3) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));
const VIS = 0.004;
const TILE_HALF = (DIM.tileH * BRANCH.scale) / 2;
const ROOT = { x: XC, y: ROW.y + (DIM.tileH * ROW.scale) / 2 };

/** The tree as data: nodes with positions, step and path probabilities. Pure and deterministic. */
export function treeData() {
  const rand = mulberry32(TREE.seed);
  const nodes = [{ id: 0, k: -1, x: ROOT.x, y: ROOT.y, p: 1, P: 1, parent: null, path: null }];
  const add = (parent, k, x, p, extra = {}) => {
    const y = BRANCH.y0 + BRANCH.dy * k + (extra.word ? 0 : (rand() - 0.5) * 0.08);
    const node = { id: nodes.length, k, x, y, p, P: parent.P * p, parent: parent.id, path: null, ...extra };
    nodes.push(node);
    return node;
  };
  // The first token: the first wheel's named candidates, at their own probabilities.
  const firstX = [XC + 0.45, XC - 0.45, XC - 1.18, XC + 1.2, XC - 1.8, XC + 1.75];
  const level0 = FIRST.tokens.slice(0, FIRST.named).map((w, i) =>
    add(nodes[0], 0, firstX[i], FIRST.probs[i], i < 2 ? { word: w, path: i === 0 ? 'B' : 'A' } : {}),
  );
  let frontier = level0;
  for (let k = 1; k < TREE.levels; k++) {
    const next = [];
    for (const n of frontier) {
      const side = n.x >= XC ? 1 : -1;
      const words = n.path === 'A' ? ANSWER_A : n.path === 'B' ? ANSWER_B : null;
      if (words && k < words.length) {
        // The answer's own next word, at the probability its wheel gave it, plus the alternatives it passed over.
        const vocab = k === 1 ? (n.path === 'A' ? AFTER_THE : AFTER_SUNLIGHT) : stepVocabulary(words[k], k);
        const at = branchAt(n.path === 'A' ? -1 : 1, k);
        next.push(add(n, k, at.x, vocab.probs[0], { word: words[k], path: n.path }));
        // One alternative it passed over, set outward: enough to show a fork at every step.
        next.push(add(n, k, at.x + side * 0.4, (1 - vocab.probs[0]) * 0.35));
        continue;
      }
      // Any other node: two continuations near the root, one further out, drifting outward.
      // Each a single illustrative step probability, below the answers' own (0.38–0.52).
      const count = k === 1 ? 2 : 1;
      const base = n.x + (n.x - XC) * 0.1;
      for (let j = 0; j < count; j++) next.push(add(n, k, base + (j - (count - 1) / 2) * 0.34, 0.12 + 0.2 * rand()));
    }
    frontier = next;
  }
  // Brightness: path probability against the likeliest at the same depth, linear, with a visible floor.
  const maxAt = {};
  nodes.forEach((n) => (maxAt[n.k] = Math.max(maxAt[n.k] ?? 0, n.P)));
  nodes.forEach((n) => (n.b = n.k < 0 ? 1 : Math.max(TREE.floor, n.P / maxAt[n.k])));
  nodes.forEach((n) => (n.children = nodes.filter((c) => c.parent === n.id).map((c) => c.id)));
  return nodes;
}

/** One ask, as a walk from the root: at every node a seeded weighted draw among its children. */
export function walk(nodes, seed) {
  const rand = mulberry32(seed);
  const out = [0];
  let n = nodes[0];
  while (n.children.length) {
    const ps = n.children.map((c) => nodes[c].p);
    const sum = ps.reduce((a, b) => a + b, 0);
    n = nodes[n.children[pick(ps.map((p) => p / sum), rand())]];
    out.push(n.id);
  }
  return out;
}

/**
 * The three walks of B19–B20. The first two are the first two asks from one
 * seed. The third — "how far it strays" — is the first later ask from the same
 * seed that leaves a bright trunk for a faint branch; it is selected, and the
 * storyboard's kicker marks it as illustrative.
 */
export function walks(nodes) {
  const seed = (k) => 9000 + k;
  const strays = (w) => w.some((id, i) => i > 1 && nodes[id].b < 0.35 && nodes[w[i - 1]].b > 0.6);
  let k = 2;
  while (!strays(walk(nodes, seed(k))) && k < 500) k++;
  return [walk(nodes, seed(0)), walk(nodes, seed(1)), walk(nodes, seed(k))];
}

const pointOf = (n, top) => (n.k < 0 ? new THREE.Vector3(n.x, n.y, 0) : new THREE.Vector3(n.x, n.y + (n.word ? (top ? TILE_HALF : -TILE_HALF) : 0), 0));

export function buildTree(scene) {
  const nodes = treeData();
  const group = new THREE.Group();
  scene.add(group);
  // Paths A and B are already drawn (scene.js branches); only the other nodes and links are new.
  const items = nodes.slice(1).map((n) => {
    const parent = nodes[n.parent];
    const a = pointOf(parent, true);
    const b = pointOf(n, false);
    const dir = b.clone().sub(a);
    let edge = null;
    if (!(n.word && (parent.word || parent.k < 0))) {
      const geo = new THREE.CylinderGeometry(0.008, 0.008, 1, 5);
      geo.translate(0, 0.5, 0);
      edge = new THREE.Mesh(geo, additive(HUE.ink, 0));
      edge.position.copy(a);
      edge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      edge.userData.len = dir.length();
      group.add(edge);
    }
    let dot = null;
    if (!n.word) {
      dot = new THREE.Mesh(new THREE.CircleGeometry(TREE.nodeR, 14), additive(HUE.ink, 0));
      dot.position.set(n.x, n.y, 0.01);
      group.add(dot);
    }
    return { n, edge, dot, a, b };
  });

  // The pulse that walks one path per ask.
  const pulse = halo(HUE.token, 0.42, 0.42);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.05, 18), additive(HUE.token, 0));
  scene.add(pulse, core);

  // The other inputs (B26): chips under the question, each linked up to it.
  const inputs = INPUTS.items.map((it) => {
    const label = makeText(it.text, { h: INPUTS.textH, color: C.ink, weight: 600 });
    const iconW = it.row === 1 ? 0.36 : 0;
    const w = label.width + 0.34 + iconW;
    const chip = makePanel(w, INPUTS.h);
    const y = INPUTS.y - it.row * INPUTS.rowGap;
    chip.mesh.position.set(it.x, y, 0);
    label.mesh.position.set(it.x + iconW / 2, y, 0.01);
    scene.add(chip.mesh, label.mesh);
    let icon = null;
    if (it.row === 1) {
      icon = buildWheel(scene, FIRST, { rIn: 0.035, rOut: 0.14, gap: 0.004 });
      icon.group.position.set(it.x - w / 2 + 0.25, y, 0.02);
    }
    const from = new THREE.Vector3(it.x, y + INPUTS.h / 2, 0);
    const to = new THREE.Vector3(XC + (it.x - XC) * 0.25, ROW.y - (DIM.tileH * ROW.scale) / 2, 0);
    const dir = to.clone().sub(from);
    const geo = new THREE.CylinderGeometry(0.01, 0.01, 1, 5);
    geo.translate(0, 0.5, 0);
    const link = new THREE.Mesh(geo, additive(HUE.ink, 0));
    link.position.copy(from);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    link.userData.len = dir.length();
    scene.add(link);
    const glow = halo(HUE.token, w * 1.5, INPUTS.h * 3);
    glow.position.set(it.x, y, -0.03);
    scene.add(glow);
    return { ...it, chip, label, icon, link, glow };
  });

  return { nodes, items, walks: walks(nodes), pulse, core, inputs };
}

/** How present the tree's own nodes are: grown in B17, gone for temperature, back for B26–B28. */
export function treeShown(t, T) {
  if (t < T.chanceIsnt) return ramp(t, T.becomes - 0.1, T.becomes + 0.2) * (1 - ramp(t, T.howFar + 0.9, T.howFar + 1.7));
  if (t < T.which) return ramp(t, T.chanceIsnt + 0.2, T.chanceIsnt + 1.0);
  return 1 - ramp(t, T.which, T.which + 0.8);
}

/** The times each walk runs, root to leaf. */
export function walkTimes(T) {
  return [
    [T.walks - 0.1, T.path31 + 0.35],
    [T.path31 + 0.4, T.path31 + 0.85],
    [T.howFar, T.howFar + 0.95],
  ];
}

export function poseTree(o, t, T) {
  const shown = treeShown(t, T);
  // B18: until "likely", every link is drawn alike; then brightness follows path probability.
  const contrast = ramp(t, T.likely - 0.1, T.likely + 0.7);
  const shimmer = win(t, T.still - 0.1, T.there30 + 0.4, 0.2); // "but still there": the faint ones, briefly lifted
  const times = walkTimes(T);
  // A walk lights the links it passes and leaves a short trail.
  const lit = new Map();
  o.walks.forEach((w, j) => {
    const [a, b] = times[j];
    const u = (t - a) / (b - a);
    w.forEach((id, i) => {
      if (i === 0) return;
      const reached = (i - 0.5) / (w.length - 1);
      const k = u >= reached ? Math.max(0, 1 - (u - reached) * 1.2) : 0;
      lit.set(id, Math.max(lit.get(id) ?? 0, t > a && t < b + 0.8 ? k : 0));
    });
  });

  o.items.forEach(({ n, edge, dot }) => {
    const grow = ramp(t, T.becomes + 0.28 * n.k, T.becomes + 0.28 * n.k + 0.35);
    const level = 0.3 * (1 - contrast) + contrast * (0.07 + 0.8 * n.b) + 0.16 * shimmer * (n.b < 0.35 ? 1 : 0);
    const o1 = shown * grow * Math.min(1, level + 0.8 * (lit.get(n.id) ?? 0));
    if (edge) {
      edge.scale.y = Math.max(1e-3, grow * edge.userData.len);
      edge.material.opacity = o1;
      edge.visible = o1 > VIS;
    }
    if (dot) {
      dot.material.opacity = Math.min(1, o1 * 1.3);
      dot.visible = dot.material.opacity > VIS;
    }
  });

  // The pulse: one ask at a time, along its path.
  let pos = null;
  let on = 0;
  o.walks.forEach((w, j) => {
    const [a, b] = times[j];
    if (t < a || t > b + 0.15) return;
    const u = Math.min(1, Math.max(0, (t - a) / (b - a))) * (w.length - 1);
    const i = Math.min(w.length - 2, Math.floor(u));
    const f = u - i;
    const p0 = pointOf(o.nodes[w[i]], true);
    const p1 = pointOf(o.nodes[w[i + 1]], false);
    pos = p0.lerp(p1, f);
    on = Math.min(ramp(t, a, a + 0.1), 1 - ramp(t, b, b + 0.15));
  });
  const pv = on * Math.max(shown, t < T.howFar + 1.0 ? 1 : 0);
  if (pos) {
    o.pulse.position.set(pos.x, pos.y, 0.05);
    o.core.position.set(pos.x, pos.y, 0.06);
  }
  o.pulse.material.opacity = 0.9 * pv;
  o.core.material.opacity = pv;
  o.pulse.visible = o.core.visible = pv > VIS;

  // B26–B27: the other inputs, then the draw singled out as where much of the variety starts.
  const gone = 1 - ramp(t, T.so42, T.so42 + 0.6);
  const spot = win(t, T.but41 + 0.15, T.so42 + 0.1, 0.3);
  o.inputs.forEach((c) => {
    // The draw's chip waits for the camera to finish pulling back, so it never lands in the interface zone.
    const at = c.row === 1 ? T.chanceIsnt + 1.15 : c.x < XC ? T.conversation : T.version;
    const a = ramp(t, at, at + 0.4) * gone;
    const isChance = c.row === 1;
    const dim = isChance ? 1 : 1 - 0.6 * spot;
    c.chip.mat.opacity = a * dim;
    c.chip.mesh.visible = a > VIS;
    c.label.mat.opacity = a * dim;
    c.label.mesh.visible = a > VIS;
    const link = ramp(t, at + 0.15, at + 0.55) * gone;
    c.link.scale.y = Math.max(1e-3, link * c.link.userData.len);
    c.link.material.opacity = 0.5 * link * dim * (isChance ? 1 + 0.6 * spot : 1);
    c.link.visible = link > VIS;
    c.glow.material.opacity = isChance ? 0.5 * a * spot : 0;
    c.glow.visible = c.glow.material.opacity > VIS;
    if (c.icon) {
      // The icon is the first wheel in miniature; on "starts right here" it spins once.
      const turn = ramp(t, T.starts, T.here41 + 0.2) * Math.PI * 2;
      c.icon.group.rotation.z = -turn;
      c.icon.slices.forEach((s) => {
        s.mat.opacity = a * s.base * (1 + 0.6 * spot);
        s.mesh.visible = s.mat.opacity > VIS;
      });
    }
  });
}
