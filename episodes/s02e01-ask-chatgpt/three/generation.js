import * as THREE from 'three';
import { ramp } from '@axiobyte/three/video/overlay/draw.js';
import { canvasTexture, glowTexture } from '@axiobyte/three/core/textures.js';
import { ALL, DIM, GEN, HUE, LIMIT_X, PICKED, SPLIT } from './look.js';
import { additive, makeArc, makeBar, makeNode, makeTile } from './objects.js';
import { BLOOM_LAYER } from './bloom.js';
import { chosenAt } from './prediction.js';

/**
 * Generation: each chosen token joins the sequence as a new position, its lane
 * climbs the layers, its links reach back to every earlier position (never
 * forward), and the top of its lane predicts the next token. Until END, or the
 * length limit.
 */

const win = (t, a, b, fade = 0.3) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));
const lerp = (a, b, u) => a + (b - a) * u;
const Q = SPLIT.length; // positions in the question
const CLIMB_FIRST = 1.4; // the first generated token climbs every layer, slowly enough to follow
const CLIMB = 0.35;

export function buildGeneration(scene) {
  const [F1, , , , FTOP] = DIM.floors;
  const positions = GEN.map((g, k) => {
    const end = k === GEN.length - 1;
    const tile = makeTile(g.text, end ? { hue: HUE.label } : undefined);
    scene.add(tile.group);
    const p = { g, k, end, tile, n: Q + k };
    if (end) return p;
    const feedH = F1 - DIM.tileH / 2;
    p.feed = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, feedH, 8), additive(HUE.vector, 0));
    p.feed.position.set(g.x, DIM.tileH / 2 + feedH / 2, 0);
    p.lane = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, FTOP - F1, 8), additive(HUE.vector, 0));
    p.nodes = DIM.floors.map(() => {
      const n = makeNode();
      scene.add(n.mesh, n.glow, n.ring);
      n.ring.layers.enable(BLOOM_LAYER);
      return n;
    });
    // Links back to every earlier position: on every layer for the first token, on the top layer after that.
    const floors = k === 0 ? DIM.floors.map((_, f) => f) : [DIM.floors.length - 1];
    p.arcs = floors.flatMap((f) =>
      ALL.slice(0, p.n).map((from, i) => {
        const y = DIM.floors[f];
        const arc = makeArc(new THREE.Vector3(from.x, y, 0), new THREE.Vector3(g.x, y, 0), 0.26 + 0.11 * Math.min(10, p.n - i));
        scene.add(arc.core, arc.glow, ...arc.sparks);
        [arc.core, arc.glow, ...arc.sparks].forEach((o) => o.layers.enable(BLOOM_LAYER));
        return { f, i, ...arc };
      }),
    );
    p.burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: HUE.prob, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    p.burst.scale.set(1.1, 1.1, 1);
    p.burst.position.set(g.x, FTOP + 0.45, 0);
    p.burst.layers.enable(BLOOM_LAYER);
    p.prob = makeBar(HUE.prob, 0.06);
    p.prob.mesh.position.set(g.x - g.width / 2 + 0.06, DIM.tileH / 2 + 0.14, 0);
    scene.add(p.feed, p.lane, p.burst, p.prob.mesh);
    return p;
  });

  // The layers widen to hold the new positions.
  const right = SPLIT.at(-1).x + SPLIT.at(-1).width / 2 + 0.7;
  const extW = LIMIT_X + 0.8 - right;
  const extensions = DIM.floors.map((y) => {
    const mat = new THREE.MeshBasicMaterial({ color: HUE.vector, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(extW, 2.4), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(right + extW / 2, y, 0.35);
    scene.add(mesh);
    return { mesh, mat };
  });

  // The length limit: where generation would stop even without END.
  const limitTex = canvasTexture(16, 512, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(236,232,218,0.9)';
    for (let y = 0; y < h; y += 28) ctx.fillRect(4, y, w - 8, 16);
  });
  const limit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.03, FTOP + 1.2),
    new THREE.MeshBasicMaterial({ map: limitTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  );
  limit.position.set(LIMIT_X, (FTOP + 1.2) / 2 - 0.6, 0);
  scene.add(limit);

  return { positions, extensions, limit };
}

export function poseGeneration(o, t, T, safe = () => 1) {
  const [F1, , , , FTOP] = DIM.floors;
  const from = chosenAt();
  o.positions.forEach((p) => {
    const land = T.gen[p.k];
    const climb = p.k === 0 ? CLIMB_FIRST : CLIMB;
    // Arrive: the first token flies down from the prediction panel; the rest drop from above their lane.
    let x = p.g.x;
    let y = 0;
    let scale = 1;
    let shown;
    if (p.k === 0) {
      const u = ramp(t, T.again, land);
      x = lerp(from.x, p.g.x, u);
      y = lerp(from.y, 0, u) + Math.sin(Math.PI * u) * 0.8;
      scale = lerp(0.6, 1, u);
      shown = t >= T.again ? 1 : 0;
    } else {
      const u = ramp(t, land - 0.3, land);
      y = (1 - u) * 2.2;
      shown = ramp(t, land - 0.3, land - 0.15);
    }
    p.tile.group.position.set(x, y, 0);
    p.tile.group.scale.setScalar(scale);
    const lit = win(t, land, land + 0.9, 0.2);
    shown *= 1 - 0.8 * ramp(t, T.nextTime - 0.5, T.nextTime + 0.5);
    const clear = shown > 0 ? safe(p.tile.group, p.g.width, DIM.tileH) : 1;
    shown *= clear;
    p.tile.materials[0].opacity = 0.96 * shown;
    p.tile.materials[1].opacity = shown;
    p.tile.glow.material.opacity = shown * (0.2 + 0.7 * lit);
    p.tile.body.visible = p.tile.face.visible = shown > 0.004;
    if (p.end) return;

    p.feed.material.opacity = 0.3 * ramp(t, land, land + 0.2) * (1 - ramp(t, T.nextTime - 0.5, T.nextTime + 0.5));
    const grow = ramp(t, land + 0.1, land + 0.1 + climb);
    p.lane.scale.y = Math.max(1e-3, grow);
    p.lane.position.set(p.g.x, F1 + ((FTOP - F1) * grow) / 2, 0);
    p.lane.material.opacity = 0.32 * grow;
    p.nodes.forEach((n, f) => {
      const reached = land + 0.1 + (f / 4) * climb;
      const formed = ramp(t, reached, reached + 0.15);
      n.mesh.position.set(p.g.x, DIM.floors[f], 0);
      n.glow.position.copy(n.mesh.position);
      n.ring.position.copy(n.mesh.position);
      n.mesh.scale.setScalar(Math.max(1e-3, formed));
      const color = HUE.vector.clone().lerp(HUE.context, f / 4);
      n.mat.color.copy(color);
      n.mat.opacity = formed;
      n.glow.material.color.copy(color);
      n.glow.material.opacity = 0.4 * formed;
      n.ring.material.opacity = 0.6 * win(t, reached, reached + 0.7, 0.15);
      n.mesh.visible = n.glow.visible = formed > 0.004;
    });
    p.arcs.forEach((a) => {
      const s = land + 0.1 + (a.f / 4) * climb + 0.05;
      const L = win(t, s, s + (p.k === 0 ? 1.0 : 0.6), 0.15);
      a.core.material.opacity = 0.85 * L;
      a.glow.material.opacity = 0.14 * L;
      a.core.visible = a.glow.visible = L > 0.004;
      a.sparks.forEach((sp, k) => {
        const u = (((t * 0.9 + k / 3 + a.i * 0.13) % 1) + 1) % 1;
        sp.position.copy(a.curve.getPoint(u));
        sp.material.opacity = L * Math.sin(Math.PI * u) * 0.9;
        sp.visible = sp.material.opacity > 0.004;
      });
    });
    // The top of the lane predicts the next token: a brief green burst, the next tile drops from it.
    const b = land + 0.1 + climb + 0.05;
    p.burst.material.opacity = 0.85 * win(t, b, b + 0.45, 0.12);
    p.burst.visible = p.burst.material.opacity > 0.004;
    // "Sound confident, and still be wrong": every word was a pick from a distribution, some far from certain.
    const pr = win(t, T.confident - 0.2 + p.k * 0.08, T.wrongEnd + 0.6, 0.3);
    p.prob.mesh.scale.x = Math.max(1e-3, (p.g.width - 0.12) * PICKED[p.k] * pr);
    p.prob.mat.opacity = 0.9 * pr * clear;
    p.prob.mesh.visible = pr > 0.004;
  });
  const widen = ramp(t, T.gen[0] - 0.4, T.gen[0] + 0.4);
  const learned = (f) => win(t, T.patterns - 0.1 + f * 0.12, T.text + 0.7, 0.35);
  o.extensions.forEach((e, f) => {
    e.mat.opacity = widen * (0.035 + 0.09 * learned(f));
  });
  o.limit.material.opacity = 0.7 * ramp(t, T.limit - 0.15, T.limit + 0.3) * (1 - ramp(t, T.wholeView + 1.5, T.wholeView + 2.5));
  o.limit.visible = o.limit.material.opacity > 0.004;
}
