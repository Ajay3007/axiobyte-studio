import { ramp, clamp01 } from '@axiobyte/three/video/overlay/draw.js';
import { DIM, HUE, PROMPT, SPLIT, twoLineLayout } from './look.js';
import { poseOpening } from './opening.js';
import { posePrediction } from './prediction.js';
import { poseGeneration } from './generation.js';
import { createSafeFade } from './safe.js';

/**
 * Poses every object for time t. A pure function of t and the cue table T:
 * no state carries between frames, so a seek lands on exactly the frame a
 * render that played into it would have produced.
 */

const SENTENCE = twoLineLayout(DIM.wordGap);
const LINES_SPLIT = twoLineLayout(DIM.splitGap);
const lerp = (a, b, u) => a + (b - a) * u;
const Ease3 = (u) => u * u * (3 - 2 * u);
/** 0 before a, up to 1 across [a, a+fade], held, back to 0 across [b-fade, b]. */
const win = (t, a, b, fade = 0.3) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));

function setTile(tile, opacity, glow) {
  tile.materials[0].opacity = 0.96 * opacity;
  tile.materials[1].opacity = opacity;
  tile.body.visible = tile.face.visible = opacity > 0.004;
  tile.glow.material.opacity = glow * opacity;
}

export function createAnimator(objects, T, camera) {
  // Context text fades as it drifts into the platform interface zones (safe.js).
  const safe = createSafeFade(camera);
  const { tiles, seams, aside, tags, columns, cloud, connectors, floors, lanes, feeds, pulses, nodes, arcs } = objects;
  const [F1, , , , FTOP] = DIM.floors;
  const flashAt = (f) => T.layerBy + 0.35 + (f - 1) * 0.62;

  function poseTokens(t) {
    const inLayers = ramp(t, T.flowIn, T.flowIn + 1.2);
    // The sentence reflows from two lines into one row of positions while the camera turns to "sky".
    const reflow = ramp(t, T.nothing - 0.4, T.nothing + 0.9);
    // In the layers, the tile a link is about lights up with it.
    const inFocus = [
      [win(t, T.blue - 0.15, T.blueEnd + 0.35), [3, 4]],
      [win(t, T.why - 0.15, T.whyEnd - 0.1), [0]],
      [ramp(t, T.last - 0.2, T.last + 0.4) * (1 - ramp(t, T.again, T.again + 0.8)), [5]],
    ];
    tiles.forEach((tile, i) => {
      const stag = Math.abs(i - 2.5) * 0.04;
      const us = ramp(t, T.split - 0.05 + stag, T.split + 0.85 + stag);
      const q = i === 5 ? win(t, T.mark - 0.1, T.each - 0.2) : 0;
      const lx = lerp(SENTENCE[i].x, LINES_SPLIT[i].x, us) + 0.16 * q;
      tile.group.position.x = lerp(lx, SPLIT[i].x, reflow);
      const rise = Ease3(ramp(t, T.enter + i * 0.04, T.enter + 0.85 + i * 0.04));
      tile.group.position.y = lerp(lerp(PROMPT.y, SENTENCE[i].y, rise), 0, reflow);
      tile.group.scale.setScalar(lerp(0.55, 1, rise));
      tile.group.position.z = 0.28 * Math.sin(Math.PI * us) * (i % 2 ? 1 : -1) * (1 - reflow);
      const turn = clamp01((t - (T.chunks + i * 0.08)) / 1.7);
      tile.group.rotation.y = 0.42 * Math.sin(Math.PI * turn);
      const whole = i < 5 ? win(t, T.whole - 0.1, T.part - 0.25) : 0;
      const compare = i === 3 ? 0 : win(t, T.skyCloud - 0.25, T.numbersEnd + 0.4, 0.4);
      const dim = i === 3 ? 1 : (1 - 0.7 * win(t, T.nothing - 0.2, T.capture + 0.2, 0.5)) * (1 - 0.92 * compare);
      const lit = Math.max(0, ...inFocus.map(([k, who]) => (who.includes(i) ? k : 0)));
      const others = Math.max(0, ...inFocus.map(([k, who]) => (who.includes(i) ? 0 : k)));
      const layered = 1 - inLayers * (0.2 + 0.4 * others * (1 - lit));
      const born = ramp(t, T.enter, T.enter + 0.4) * (1 - 0.8 * ramp(t, T.nextTime - 0.5, T.nextTime + 0.5));
      const clear = born > 0 ? safe(tile.group, tile.width, DIM.tileH) : 1;
      setTile(tile, born * dim * layered * clear, 0.2 + 0.55 * whole + 0.85 * q + 0.9 * lit * inLayers);
    });
    seams.forEach((s) => {
      s.mesh.material.opacity = 0.9 * ramp(t, T.stop, T.stop + 0.3) * (1 - ramp(t, T.split + 0.1, T.split + 0.6));
    });
    const a = win(t, T.part - 0.35, T.mark + 0.1, 0.3);
    const sp = ramp(t, T.part + 0.05, T.part + 0.55);
    setTile(aside.whole, a * (1 - sp), 0.3);
    const gap = 0.34 * sp;
    const total = aside.ray.width + aside.leigh.width + gap;
    aside.ray.group.position.x = -total / 2 + aside.ray.width / 2;
    aside.leigh.group.position.x = total / 2 - aside.leigh.width / 2;
    setTile(aside.ray, a * sp, 0.45);
    setTile(aside.leigh, a * sp, 0.45);
  }

  function poseTags(t) {
    const swing = ramp(t, T.locker - 0.5, T.locker) * (1 - ramp(t, T.nothing + 0.4, T.nothing + 1.2));
    tags.forEach((tag, i) => {
      const s0 = T.number - 0.2 + i * 0.08;
      const appear = ramp(t, s0, s0 + 0.4);
      const gone = i === 3 ? ramp(t, T.list - 0.1, T.list + 0.5) : ramp(t, T.unlocks - 0.4, T.unlocks + 0.2);
      const dim = i === 3 ? 1 : 1 - 0.7 * win(t, T.nothing - 0.2, T.capture, 0.5);
      const o = appear * (1 - gone) * dim;
      const tile = tiles[i].group.position;
      tag.pivot.position.set(tile.x, tile.y - DIM.tileH / 2 + (1 - appear) * 0.35, tile.z);
      tag.pivot.rotation.z = swing * 0.16 * Math.sin(2 * Math.PI * 0.85 * (t - T.locker) + i * 0.9);
      const bright = 0.72 + 0.28 * ramp(t, T.id - 0.1, T.id + 0.3) + (i === 3 ? 0.5 * win(t, T.unlocks - 0.1, T.list, 0.15) : 0);
      const clear = o > 0 ? safe(tag.plate, 0.94, 0.44) : 1;
      tag.plate.material.opacity = o * clear;
      tag.plate.material.color.setScalar(bright);
      tag.string.material.opacity = 0.7 * o * clear;
      tag.pivot.visible = o > 0.004;
    });
  }

  function poseColumn(col, t, start, { dim = 1, jitter = 0, condense = () => 0, boost = () => 0 } = {}) {
    col.cells.forEach((c, k) => {
      const u = condense(k);
      const g = ramp(t, start + k * 0.035, start + k * 0.035 + 0.25) * (1 - 0.7 * u) * (1 - ramp(u, 0.82, 1));
      const v = c.value + jitter * 0.7 * Math.sin(6.1 * t + k * 2.3);
      const w = Math.min(1, Math.abs(v)) * 0.62 + 0.05;
      c.mesh.scale.set(w, Math.max(1e-3, g), 1);
      c.mesh.position.x = Math.sign(v || 1) * w * 0.5;
      const rest = k * (DIM.cellH + DIM.cellGap) + DIM.cellH / 2;
      c.mesh.position.y = lerp(rest, F1 - DIM.columnBase, Ease3(u));
      c.mat.opacity = g * dim * (0.5 + 0.5 * Math.min(1, Math.abs(v)) + boost(k));
      c.mesh.visible = c.mat.opacity > 0.004;
    });
    col.spine.material.opacity = 0.35 * dim * ramp(t, start, start + 0.3) * (1 - condense(0));
  }

  function poseNumbers(t) {
    const compare = win(t, T.skyCloud - 0.25, T.numbersEnd + 0.4, 0.4);
    columns.forEach((col, i) => {
      col.group.position.set(tiles[i].group.position.x, tiles[i].group.position.y + DIM.columnBase, 0);
      const start = i === 3 ? T.unlocks + 0.15 : T.capture + [0, 0.14, 0.28, 0, 0.42, 0.56][i];
      const condense = (k) => {
        const s = T.flow - 0.3 + (DIM.cells - 1 - k) * 0.022 + i * 0.04;
        return ramp(t, s, s + 0.5);
      };
      poseColumn(col, t, start, {
        dim: i === 3 ? 1 : 1 - 0.95 * compare,
        jitter: i === 3 ? 1 - ramp(t, T.learned - 0.15, T.learned + 0.75) : 0,
        condense,
        boost: i === 3 ? (k) => 0.9 * win(t, T.similar - 0.1 + k * 0.04, T.similar + 0.6 + k * 0.04, 0.15) : undefined,
      });
    });
    const a = win(t, T.cloud - 0.3, T.numbersEnd + 0.8, 0.4);
    setTile(cloud.tile, 0.7 * a, 0.25);
    poseColumn(cloud.column, t, T.cloud - 0.15, {
      dim: a,
      boost: (k) => 0.9 * win(t, T.similar - 0.1 + k * 0.04, T.similar + 0.6 + k * 0.04, 0.15),
    });
    connectors.forEach((line, k) => {
      line.material.opacity = 0.8 * a * ramp(t, T.similar - 0.1 + k * 0.04, T.similar + 0.2 + k * 0.04);
    });
  }

  /** How strongly arc (i → j) on floor f is drawn at time t; above 1 means "in focus". */
  function arcLevel(f, a, t) {
    const { i, j, w } = a;
    if (f === 0) {
      let L = w * ramp(t, T.every + j * 0.33, T.every + j * 0.33 + 0.35);
      const fb = win(t, T.blue - 0.15, T.blueEnd + 0.35);
      L = i === 3 && j === 4 ? lerp(L, 1.7, fb) : lerp(L, L * 0.08, fb);
      const fw = win(t, T.why - 0.15, T.whyEnd - 0.1);
      L = i === 0 && j > 0 ? lerp(L, 1.3, fw) : lerp(L, L * 0.08, fw);
      return L * (1 - 0.85 * ramp(t, T.layerBy, T.layerBy + 0.8));
    }
    const s = flashAt(f);
    let L = w * (ramp(t, s, s + 0.25) - 0.85 * ramp(t, s + 0.35, s + 1.4));
    if (f === floors.length - 1) {
      const fl = ramp(t, T.last - 0.2, T.last + 0.4) * (1 - ramp(t, T.again, T.again + 0.8));
      L = j === 5 ? lerp(L, 0.45 + 0.8 * w, fl) : L * (1 - 0.85 * fl);
    }
    return Math.max(0, L);
  }

  function flowOf(f, t) {
    if (f === 0) return ramp(t, T.pulls - 0.1, T.pulls + 0.3) * (1 - ramp(t, T.layerBy + 0.2, T.layerBy + 0.8));
    const s = flashAt(f);
    const flash = win(t, s, s + 1.3, 0.25);
    return f === floors.length - 1 ? Math.max(flash, ramp(t, T.last - 0.2, T.last + 0.4) * (1 - ramp(t, T.again, T.again + 0.8))) : flash;
  }

  function poseLayers(t) {
    // "These numbers flow through layer after layer": the first layer is there to receive the
    // columns; then a front climbs every lane, and each layer appears as the front reaches it.
    const CLIMB = 1.1;
    const grow = ramp(t, T.layers, T.layers + CLIMB);
    const reached = (f) => T.layers + (f / (floors.length - 1)) * CLIMB;
    floors.forEach((fl, f) => {
      const a = f === 0 ? ramp(t, T.flowIn, T.flowIn + 0.5) : ramp(t, reached(f) - 0.1, reached(f) + 0.25);
      const s = flashAt(f);
      const active = f === 0 ? win(t, T.every - 0.5, T.layerBy + 0.3, 0.4) : win(t, s - 0.1, s + 1.2, 0.3);
      const learned = win(t, T.patterns - 0.1 + f * 0.12, T.text + 0.7, 0.35);
      fl.mat.opacity = a * (0.45 + 0.55 * Math.max(active, learned));
    });
    const ctx = ramp(t, T.layerBy, T.end);
    lanes.forEach((lane) => {
      lane.mesh.scale.y = Math.max(1e-3, grow);
      lane.mesh.position.y = F1 + ((FTOP - F1) * grow) / 2;
      lane.mesh.material.opacity = 0.32 * grow;
      lane.mesh.material.color.copy(HUE.vector).lerp(HUE.context, ctx);
    });
    feeds.forEach((feed) => {
      feed.mesh.material.opacity = 0.3 * ramp(t, T.flow - 0.3, T.flow + 0.3) * (1 - ramp(t, T.nextTime - 0.5, T.nextTime + 0.5));
    });
    pulses.forEach((p, i) => {
      // up the feed with the column's numbers, then up the lane with the front
      const up = ramp(t, T.flow - 0.2 + i * 0.04, T.flow + 0.55 + i * 0.04);
      const y = t < T.layers ? lerp(DIM.tileH / 2, F1, up) : lerp(F1, FTOP, grow);
      p.position.set(SPLIT[i].x, y, 0);
      const on = t < T.layers ? win(t, T.flow - 0.2, T.flow + 0.75, 0.2) : win(t, T.layers - 0.05, T.layers + CLIMB + 0.3, 0.2);
      p.material.opacity = 0.9 * on;
      p.visible = on > 0.004;
    });
    nodes.forEach((row, f) => {
      const reach = ramp(t, reached(f), reached(f) + 0.3);
      const mix = f === 0 ? 0.25 * ramp(t, T.pulls, T.lookEnd) : (f / 4) * ramp(t, flashAt(f), flashAt(f) + 0.5);
      const last = f === nodes.length - 1 ? ramp(t, T.last - 0.1, T.last + 0.5) * (1 - ramp(t, T.again, T.again + 0.8)) : 0;
      row.forEach((n, i) => {
        const formed = f === 0 ? ramp(t, T.flow + 0.05 + i * 0.04, T.flow + 0.6 + i * 0.04) : reach;
        const waiting = f === 0 ? 1 : 0.3 + 0.7 * ramp(t, flashAt(f) - 0.1, flashAt(f) + 0.3);
        const focus = (i === 5 ? 1 + 0.8 * last : 1 - 0.55 * last) * waiting;
        n.mesh.position.set(SPLIT[i].x, DIM.floors[f], 0);
        n.glow.position.copy(n.mesh.position);
        n.ring.position.copy(n.mesh.position);
        n.mesh.scale.setScalar(Math.max(1e-3, formed * (i === 5 ? 1 + 0.6 * last : 1)));
        const color = HUE.vector.clone().lerp(HUE.context, i === 5 ? Math.max(mix, last) : mix);
        n.mat.color.copy(color);
        n.mat.opacity = formed * Math.min(1, focus);
        n.glow.material.color.copy(color);
        n.glow.material.opacity = formed * 0.45 * focus;
        n.mesh.visible = n.glow.visible = formed > 0.004;
      });
    });
    arcs.forEach((list, f) => {
      const flow = flowOf(f, t);
      list.forEach((a) => {
        const L = arcLevel(f, a, t);
        if (a.self) {
          nodes[f][a.j].ring.material.opacity = 0.7 * Math.min(1, L);
          return;
        }
        a.core.material.opacity = 0.9 * Math.min(1, L);
        a.glow.material.opacity = 0.16 * L;
        a.core.visible = a.glow.visible = L > 0.004;
        a.sparks.forEach((sp, k) => {
          const u = (((t * 0.75 + k / 3 + a.i * 0.11) % 1) + 1) % 1;
          sp.position.copy(a.curve.getPoint(u));
          sp.material.opacity = flow * Math.min(1, L) * Math.sin(Math.PI * u) * 0.95;
          sp.visible = sp.material.opacity > 0.004;
        });
      });
    });
  }

  return {
    update(t) {
      poseTokens(t);
      poseTags(t);
      poseNumbers(t);
      poseLayers(t);
      poseOpening(objects.opening, t, T);
      posePrediction(objects.prediction, t, T);
      poseGeneration(objects.generation, t, T, safe);
    },
    /** Read by the debug HUD; this film has no component highlights. */
    levelsAt: () => ({}),
    dispose() {},
  };
}
