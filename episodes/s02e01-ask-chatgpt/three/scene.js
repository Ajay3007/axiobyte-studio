import * as THREE from 'three';
import { Engine } from '@axiobyte/three/core/Engine.js';
import { CameraManager } from '@axiobyte/three/core/CameraManager.js';
import { ComponentRegistry } from '@axiobyte/three/core/ComponentRegistry.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { glowTexture } from '@axiobyte/three/core/textures.js';
import { ASIDE, BLOOM, DIM, HUE, LINES, PAIRS, SPLIT, TOKENS, twoLineLayout } from './look.js';
import { makeArc, makeColumn, makeFloor, makeGround, makeNode, makeTag, makeTile, nodeAt, vectors } from './objects.js';
import { createAnimator } from './animate.js';
import { BLOOM_LAYER, createBloom } from './bloom.js';
import { buildOpening } from './opening.js';
import { buildPrediction } from './prediction.js';
import { buildGeneration } from './generation.js';

/**
 * s02e01's world, for createVideoApp({ createScene }): the sentence, its ID
 * tags, the learned numbers, and the layers stacked above them. The objects
 * are built once; createAnimation(story) returns the pure-function poser.
 */
export function createEpisodeScene({ container, engine: engineOptions }) {
  const engine = new Engine(container, engineOptions);
  const camera = new CameraManager(engine);
  const registry = new ComponentRegistry();
  const scene = engine.scene;

  // No scene background: the compositor's radial ground shows through, lit at the centre.
  // Depth falls off into the dark, so the far layers and the ground recede.
  scene.fog = new THREE.Fog(C.bg1, 26, 64);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-4, 8, 10);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(5, 3, -8);
  scene.add(key, rim, makeGround());

  // The sentence, then its token seams.
  const tiles = TOKENS.map((tok) => {
    const tile = makeTile(tok.text);
    scene.add(tile.group);
    return tile;
  });
  const sentence = twoLineLayout(DIM.wordGap);
  const neighbours = LINES.rows.flatMap((row) => row.slice(1).map((i, k) => [row[k], i]));
  const seams = neighbours.map(([a, b]) => {
    const prev = sentence[a];
    const r = sentence[b];
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.03, DIM.tileH * 1.3),
      new THREE.MeshBasicMaterial({ color: HUE.token, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    mesh.position.set((prev.x + prev.width / 2 + r.x - r.width / 2) / 2, r.y, DIM.tileD / 2 + 0.02);
    scene.add(mesh);
    return { mesh };
  });

  // The "part of a word" aside, floating above the row.
  const aside = { whole: makeTile(ASIDE.word), ray: makeTile(ASIDE.parts[0]), leigh: makeTile(ASIDE.parts[1]) };
  Object.values(aside).forEach((t) => {
    t.group.position.y = DIM.asideY;
    scene.add(t.group);
  });

  const tags = TOKENS.map((tok) => {
    const tag = makeTag(tok.id);
    scene.add(tag.pivot);
    return tag;
  });

  // Learned numbers: one column per token, and the "cloud" it is compared with.
  const vec = vectors();
  const columns = vec.tokens.map((values) => {
    const col = makeColumn(values);
    scene.add(col.group);
    return col;
  });
  const cloudAt = new THREE.Vector3(SPLIT[3].x + 1.15, 0, 0.3);
  const cloud = { tile: makeTile('cloud'), column: makeColumn(vec.cloud) };
  cloud.tile.group.position.copy(cloudAt);
  cloud.column.group.position.set(cloudAt.x, DIM.columnBase, cloudAt.z);
  scene.add(cloud.tile.group, cloud.column.group);
  const connectors = vec.cloud.map((_, k) => {
    const y = DIM.columnBase + k * (DIM.cellH + DIM.cellGap) + DIM.cellH / 2;
    // A thin rod from sky's k-th number to cloud's: the pairs the comparison is about.
    const a = new THREE.Vector3(SPLIT[3].x, y, 0);
    const b = new THREE.Vector3(cloudAt.x, y, cloudAt.z);
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, a.distanceTo(b), 6),
      new THREE.MeshBasicMaterial({ color: HUE.vector, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    rod.position.copy(a).add(b).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    scene.add(rod);
    return rod;
  });

  // The layers: floors, one lane per position through them, a node where each lane meets a floor.
  const span = SPLIT.at(-1).x + SPLIT.at(-1).width / 2 - (SPLIT[0].x - SPLIT[0].width / 2);
  const floors = DIM.floors.map((y) => {
    const fl = makeFloor(span + 1.4, 2.4);
    fl.mesh.position.set(0, y, 0.35);
    scene.add(fl.mesh);
    return fl;
  });
  const [F1, , , , FTOP] = DIM.floors;
  const lanes = SPLIT.map((r) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, FTOP - F1, 8),
      new THREE.MeshBasicMaterial({ color: HUE.vector.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    mesh.position.set(r.x, F1, 0);
    scene.add(mesh);
    return { mesh };
  });
  // The path the numbers took: from each token up to the first layer.
  const feeds = SPLIT.map((r) => {
    const h = F1 - DIM.tileH / 2;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, h, 8),
      new THREE.MeshBasicMaterial({ color: HUE.vector.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    mesh.position.set(r.x, DIM.tileH / 2 + h / 2, 0);
    scene.add(mesh);
    return { mesh };
  });
  // A bright front riding each lane upward as the layers form: numbers flowing through them.
  const pulses = SPLIT.map(() => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: HUE.vector.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    sprite.scale.set(0.7, 0.7, 1);
    scene.add(sprite);
    return sprite;
  });
  const nodes = DIM.floors.map(() =>
    SPLIT.map(() => {
      const n = makeNode();
      scene.add(n.mesh, n.glow, n.ring);
      n.ring.layers.enable(BLOOM_LAYER);
      return n;
    }),
  );

  // Attention on each floor: every position j links to itself and to every earlier position i, never to a later one.
  const arcs = DIM.floors.map((y, f) => {
    return PAIRS.map(({ i, j }) => {
      const w = weight(f, i, j);
      if (i === j) return { i, j, w, self: true };
      const arc = makeArc(nodeAt(i, y), nodeAt(j, y), 0.26 + 0.2 * (j - i));
      scene.add(arc.core, arc.glow, ...arc.sparks);
      [arc.core, arc.glow, ...arc.sparks].forEach((o) => o.layers.enable(BLOOM_LAYER));
      return { i, j, w, ...arc };
    });
  });

  const opening = buildOpening(scene);
  const prediction = buildPrediction(scene);
  const generation = buildGeneration(scene);
  const objects = { tiles, seams, aside, tags, columns, cloud, connectors, floors, lanes, feeds, pulses, nodes, arcs, opening, prediction, generation };

  // The engine renders the frame; the attention links' glow is added on top of it.
  const bloom = BLOOM.enabled ? createBloom(engine, BLOOM) : null;
  if (bloom) {
    const step = engine.stepTo.bind(engine);
    engine.stepTo = (time, opts) => {
      step(time, opts);
      bloom.render();
    };
  }
  const world = { engine, camera, registry, scene };

  return {
    world,
    createAnimation(story) {
      return createAnimator(objects, story.T, engine.camera);
    },
    dispose() {
      bloom?.dispose();
      engine.dispose();
    },
  };
}

/**
 * Illustrative attention weights, deterministic. Two links carry the
 * narration — "blue" draws on "sky" (3 → 4), and later positions draw on
 * "Why" (0 → j) — and on the top layer the last position draws on all of them.
 */
function weight(f, i, j) {
  if (i === j) return 0.5;
  if (i === 3 && j === 4) return 1;
  if (i === 0) return 0.7;
  if (f === DIM.floors.length - 1 && j === 5) return 0.75;
  return 0.22 + 0.3 * (((i * 7 + j * 13 + f * 5) % 10) / 10);
}
