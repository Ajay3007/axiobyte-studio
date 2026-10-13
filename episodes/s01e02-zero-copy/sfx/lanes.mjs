#!/usr/bin/env node
/**
 * E02 SFX: dump the storyboard's event times (its `lanes`) to JSON, so every SFX cue is placed on the
 * animation's own timing — not on a subtitle. Read-only: it builds the storyboard exactly as the E02
 * end-card test does (a NIC scene and the E02 stage in Node, no WebGL) and changes nothing.
 *
 *   node episodes/s01e02-zero-copy/sfx/lanes.mjs   →   episodes/s01e02-zero-copy/out/sfx/lanes.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EPISODE = path.resolve(HERE, '..');
const REPO = path.resolve(EPISODE, '../..');
const OUT = path.join(EPISODE, 'out/sfx/lanes.json');

// The scene modules touch a 2D canvas for labels; in Node a stand-in is enough (nothing is drawn).
const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };

const { ComponentRegistry } = await import(path.join(REPO, 'renderers/three/src/core/ComponentRegistry.js'));
const { TimelineParser } = await import(path.join(REPO, 'renderers/three/src/core/timeline/TimelineParser.js'));
const { createNicScene } = await import(path.join(REPO, 'renderers/three/src/domains/networking/nic/scene.js'));
const { createZeroCopyStage } = await import(path.join(EPISODE, 'three/stage.js'));
const { buildStoryboard } = await import(path.join(EPISODE, 'three/storyboard.js'));

const scene = new THREE.Scene();
const registry = new ComponentRegistry();
createNicScene({ engine: { scene, aspect: 16 / 9 }, registry, camera: { definePreset() {}, addResolver() {} } });
scene.updateMatrixWorld(true);
createZeroCopyStage({ engine: { scene }, registry });
const words = JSON.parse(fs.readFileSync(path.join(EPISODE, 'timeline/words.json'), 'utf8'));
const tl = new TimelineParser(words);
const story = buildStoryboard({ timeline: tl, registry });

const sentences = words.sentences.map((s, i) => ({ index: i, start: tl.sentenceStart(i), end: tl.sentenceEnd(i), text: s.text }));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ filmEnd: story.filmEnd, duration: story.duration, audioEnd: story.audioEnd, lanes: story.lanes, sentences }, null, 1));
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
