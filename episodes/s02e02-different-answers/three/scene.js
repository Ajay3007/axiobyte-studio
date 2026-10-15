import * as THREE from 'three';
import { Engine } from '@axiobyte/three/core/Engine.js';
import { CameraManager } from '@axiobyte/three/core/CameraManager.js';
import { ComponentRegistry } from '@axiobyte/three/core/ComponentRegistry.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import {
  AFTER_SUNLIGHT,
  AFTER_THE,
  ANSWER_A,
  ANSWER_B,
  BRANCH,
  DIM,
  FIRST,
  HUE,
  LABELLED,
  LIFT,
  LIST,
  PANELS,
  QUESTION,
  ROW,
  SAMPLES,
  WHEEL,
  XC,
  branchAt,
  rowLayout,
  stepVocabulary,
  tileWidth,
} from './look.js';
import { additive, halo, makeBar, makeGround, makePanel, makeText, makeTile } from './objects.js';
import { buildOutline, buildWheel, makeDot, makePointer } from './wheel.js';
import { createAnimator } from './animate.js';
import { buildOpening } from './opening.js';
import { buildTree } from './tree.js';
import { buildTemperature } from './temperature.js';
import { buildEnding } from './ending.js';

/**
 * s02e02's world, for createVideoApp({ createScene }). Every object is built
 * once, here; createAnimation(story) returns the poser, a pure function of time.
 *
 * Implemented so far: the B09–B16 review slice (the strip becomes a wheel, the
 * sample spins, the controlled replay, the fork and the compounding branches),
 * entered from B07's candidate list and B08's strip.
 */
export function createEpisodeScene({ container, engine: engineOptions }) {
  const engine = new Engine(container, engineOptions);
  const camera = new CameraManager(engine);
  const registry = new ComponentRegistry();
  const scene = engine.scene;

  scene.fog = new THREE.Fog(C.bg1, 26, 64);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-4, 8, 10);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(5, 3, -8);
  scene.add(key, rim, makeGround());

  // ---------------------------------------------------------- the question
  const rowAt = rowLayout();
  const row = QUESTION.map((w) => {
    const tile = makeTile(w);
    tile.group.scale.setScalar(ROW.scale);
    scene.add(tile.group);
    return tile;
  });
  // Its ghost, from the first run: compared with the live row in the replay.
  const ghostRow = QUESTION.map((w) => {
    const tile = makeTile(w, { hue: HUE.ghost, ink: C.muted });
    tile.group.scale.setScalar(ROW.scale);
    scene.add(tile.group);
    return tile;
  });

  // ------------------------------------------------- B07's candidate list
  const list = FIRST.tokens.slice(0, FIRST.named).map((text, r) => {
    const tile = makeTile(text);
    tile.group.scale.setScalar(LIST.scale);
    const bar = makeBar(HUE.prob, 0.17);
    const pct = makeText(`${Math.round(FIRST.probs[r] * 100)}%`, { h: 0.2, color: C.green });
    scene.add(tile.group, bar.mesh, pct.mesh);
    return { r, tile, bar, pct };
  });
  // The rest of the vocabulary, faint behind the list (it becomes the tail's slivers).
  const listTail = Array.from({ length: 14 }, (_, k) => {
    const bar = makeBar(HUE.prob, 0.05);
    scene.add(bar.mesh);
    return { k, bar };
  });

  // ------------------------------------------------------------ the wheel
  const wheel = buildWheel(scene, FIRST, { ...WHEEL, labels: LABELLED, pct: true, labelH: 0.19 });
  wheel.group.position.set(XC, WHEEL.y, 0);
  // Its ghost from the first run: the same probabilities object, drawn as an outline in front.
  const ghostWheel = buildOutline(scene, FIRST, WHEEL);
  ghostWheel.group.position.set(XC, WHEEL.y, 0.05);
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), additive(HUE.ink, 0));
  scene.add(hub);
  const pointer = makePointer();
  scene.add(pointer.mesh, pointer.glow);

  const dots = SAMPLES.map(() => {
    const d = makeDot();
    scene.add(d.mesh, d.glow);
    return d;
  });

  // ---------------------------------------------------- the drawn tiles
  const drawn = {
    the: makeTile('The'),
    sunlight: makeTile('Sunlight'),
    ghostThe: makeTile('The', { hue: HUE.ghost, ink: C.muted }),
  };
  Object.values(drawn).forEach((t) => {
    t.group.scale.setScalar(LIFT.scale);
    scene.add(t.group);
  });

  // ---------------------------------------------------------- the branches
  // Step 0 of each branch is the drawn tile itself ("The", "Sunlight").
  const sides = [
    { side: -1, words: ANSWER_A, first: AFTER_THE },
    { side: 1, words: ANSWER_B, first: AFTER_SUNLIGHT },
  ].map(({ side, words, first }) => {
    const steps = words.map((w, k) => {
      const at = branchAt(side, k);
      const tile = k === 0 ? null : makeTile(w);
      if (tile) {
        tile.group.scale.setScalar(BRANCH.scale);
        tile.group.position.set(at.x, at.y, 0);
        scene.add(tile.group);
      }
      // The empty slot the step will fill: "changes everything after it".
      const slotW = tileWidth(w) * BRANCH.scale;
      const slot = k === 0 ? null : makePanel(slotW, 0.66 * BRANCH.scale, C.lineStrong, { round: 0.16 });
      if (slot) {
        slot.mesh.position.set(at.x, at.y, -0.01);
        scene.add(slot.mesh);
      }
      // The prediction that picks this step's word: a wheel where its tile will be.
      let spinner = null;
      if (k >= 1) {
        const vocab = k === 1 ? first : stepVocabulary(w, k);
        const big = k === 1;
        const r = big ? BRANCH.miniR : BRANCH.stepR;
        spinner = buildWheel(scene, vocab, { rIn: r * 0.24, rOut: r, labels: big ? [0] : [], labelH: 0.21, gap: 0.004 });
        spinner.group.position.set(at.x, at.y, 0.05);
        spinner.pointer = makePointer();
        spinner.pointer.mesh.scale.setScalar(big ? 0.6 : 0.42);
        scene.add(spinner.pointer.mesh);
      }
      // The link from the previous step (or the question) to this one.
      const half = (DIM.tileH * BRANCH.scale) / 2;
      const from = k === 0 ? { x: XC, y: ROW.y + (DIM.tileH * ROW.scale) / 2 - half } : branchAt(side, k - 1);
      const edge = makeEdge(from, at, half);
      scene.add(edge.mesh);
      return { k, word: w, at, tile, slot, spinner, edge };
    });
    return { side, words, steps };
  });

  // ------------------------------------------------- the two answers
  const panels = [-1, 1].map((side, s) => {
    const words = s === 0 ? ANSWER_A : ANSWER_B;
    const x = XC + side * PANELS.dx;
    const card = makePanel(PANELS.w, PANELS.h, C.lineStrong, { round: 0.12 });
    card.mesh.position.set(x, PANELS.y, -0.02);
    const glow = halo(HUE.ink, PANELS.w * 1.4, PANELS.h * 2.2);
    glow.position.set(x, PANELS.y, -0.06);
    scene.add(card.mesh, glow);
    // One plane per word, wrapped to the card, appearing as its branch reaches it.
    const planes = [...words, '…'].map((w) => makeText(w, { h: PANELS.textH, color: C.ink, weight: 500 }));
    const space = 0.0;
    const inner = PANELS.w - 0.2;
    let lx = 0;
    let line = 0;
    planes.forEach((p, k) => {
      if (k > 0 && lx + p.width > inner) {
        lx = 0;
        line++;
      }
      p.lineX = lx;
      p.line = line;
      lx += p.width + space;
    });
    const lines = line + 1;
    planes.forEach((p) => {
      const y = PANELS.y + ((lines - 1) / 2 - p.line) * PANELS.textH * 1.25;
      p.mesh.position.set(x - inner / 2 + p.lineX + p.width / 2, y, 0.01);
      scene.add(p.mesh);
    });
    return { side, card, planes, glow };
  });

  // B01–B05, B06's callback beam, B17–B30.
  const opening = buildOpening(scene);
  const beamFrom = new THREE.Vector3(rowAt.at(-1).x, ROW.y + (DIM.tileH * ROW.scale) / 2, 0);
  const beamTo = new THREE.Vector3(LIST.barX, LIST.top - (FIRST.named - 0.4) * LIST.row, -0.1);
  const beamGeo = new THREE.CylinderGeometry(0.01, 0.01, 1, 6);
  beamGeo.translate(0, 0.5, 0);
  const beam = new THREE.Mesh(beamGeo, additive(HUE.ink, 0));
  beam.position.copy(beamFrom);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamTo.clone().sub(beamFrom).normalize());
  beam.userData.len = beamTo.distanceTo(beamFrom);
  scene.add(beam);
  const tree = buildTree(scene);
  const temp = buildTemperature(scene);
  const ending = buildEnding(scene);

  const objects = { rowAt, row, ghostRow, list, listTail, wheel, ghostWheel, hub, pointer, dots, drawn, sides, panels, opening, callback: { beam }, tree, temp, ending };
  const world = { engine, camera, registry, scene };

  return {
    world,
    createAnimation(story) {
      return createAnimator(objects, story.T, engine.camera);
    },
    dispose() {
      engine.dispose();
    },
  };
}

/** A straight link from the top of one step to the bottom of the next; scale.y is how much of it is drawn. */
function makeEdge(from, to, half) {
  const start = new THREE.Vector3(from.x, from.y + half, 0);
  const end = new THREE.Vector3(to.x, to.y - half, 0);
  const dir = end.clone().sub(start);
  const geo = new THREE.CylinderGeometry(0.011, 0.011, 1, 6);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.Mesh(geo, additive(HUE.ink, 0));
  mesh.position.copy(start);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const len = dir.length();
  mesh.scale.set(1, 1e-3, 1);
  return { mesh, len };
}
