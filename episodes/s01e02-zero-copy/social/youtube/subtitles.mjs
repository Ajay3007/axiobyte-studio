#!/usr/bin/env node
/**
 * E02 Zero Copy: English closed captions (SRT) for YouTube, from the voiceover's word timings
 * (timeline/words.json). Output: episodes/s01e02-zero-copy/out/youtube/s01e02-zero-copy.en.srt
 *
 * The words are the narration, verbatim, except for the transcription errors below. Timing is the
 * spoken words' own. Deterministic: same input, same file. A publishing asset; it changes nothing in the film.
 *
 *   node episodes/s01e02-zero-copy/social/youtube/subtitles.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EPISODE = path.resolve(HERE, '../..');
const OUT = path.join(EPISODE, 'out/youtube/s01e02-zero-copy.en.srt');

/** Transcription errors in words.json (word → correct spelling); punctuation around a word is kept. */
const CORRECTIONS = {
  mBuff: 'mbuf', // the DPDK structure, spelled as in DPDK
  passer: 'parser', // "The parser receives the mbuf" (the parser, classifier, firewall, routing stages)
};
const MAX_LINE = 42; // characters per line (YouTube / broadcast convention), at most two lines per cue
const MAX_CUE = 2 * MAX_LINE;
const MAX_SECONDS = 6.5;
const MIN_SECONDS = 1.0;
const TAIL = 0.3; // hold after the last word, if the next cue allows
const GAP = 0.04; // never touch the next cue

const { words } = JSON.parse(fs.readFileSync(path.join(EPISODE, 'timeline/words.json'), 'utf8'));

/** A word, corrected; a sentence's first word is capitalised (one sentence starts "no CPU …"). */
function correct(word, isFirstInSentence) {
  const m = /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/.exec(word);
  let core = CORRECTIONS[m[2]] ?? m[2];
  if (isFirstInSentence) core = core.charAt(0).toUpperCase() + core.slice(1);
  return m[1] + core + m[3];
}

const sentences = [];
for (const w of words) {
  const s = (sentences[w.sentence_index] ??= []);
  s.push({ text: correct(w.word, s.length === 0), start: w.start, end: w.end });
}

/** Words a line or a cue should not end on: it would split a phrase from the word it belongs to. */
const WEAK = new Set(
  'a an the to of in into on at by for from with and or but as that than if when where which who its it every each this those these is are was be not just like'.split(' '),
);
const endsWeak = (text) => WEAK.has(text.split(' ').at(-1).toLowerCase());
/** The episode's technical terms: never split across a line or a cue. */
const TERMS = ['Direct Memory Access', 'packet processing', 'packet length', 'packet buffer', 'packet buffers', '64-bit system', 'memory address', 'memory bandwidth', 'cache efficiency', 'system boundaries', 'zero copy', 'CPU cycles'];
const PAIRS = new Set(TERMS.flatMap((t) => t.split(' ').slice(1).map((w, i) => `${t.split(' ')[i]} ${w}`.toLowerCase())));
const strip = (w) => w.toLowerCase().replace(/[^a-z0-9-]/g, '');
const splitsTerm = (left, right) => PAIRS.has(`${strip(left)} ${strip(right)}`);

/** One or two lines, balanced, never breaking straight after a weak word, preferring a break after a comma. */
function lines(text) {
  if (text.length <= MAX_LINE) return [text];
  const ws = text.split(' ');
  let best = null;
  for (let i = 1; i < ws.length; i++) {
    const a = ws.slice(0, i).join(' ');
    const b = ws.slice(i).join(' ');
    const fit = a.length <= MAX_LINE && b.length <= MAX_LINE ? 0 : 1000;
    const score = fit + Math.max(a.length, b.length) + (endsWeak(a) ? 12 : 0) + (splitsTerm(ws[i - 1], ws[i]) ? 30 : 0) - (/,$/.test(a) ? 6 : 0);
    if (!best || score < best.score) best = { a, b, score };
  }
  return [best.a, best.b];
}

const join = (ws) => ws.map((w) => w.text).join(' ');
/** A cue fits when it sets on at most two lines of MAX_LINE and is short enough to read. */
const fits = (ws) => lines(join(ws)).every((l) => l.length <= MAX_LINE) && ws.at(-1).end - ws[0].start <= MAX_SECONDS;

/**
 * A sentence's cues: the fewest that fit, then the most even lengths, preferring a break after a comma
 * (an exact search over the break points; sentences are short).
 */
function split(sentence) {
  const n = sentence.length;
  const best = Array(n + 1).fill(null); // best[i]: the best split of the first i words
  best[0] = { cues: 0, cost: 0, cuts: [] };
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j < i; j++) {
      if (!best[j]) continue;
      const ws = sentence.slice(j, i);
      if (!fits(ws)) continue;
      const last = ws.at(-1).text;
      const comma = i < n && /,$/.test(last) ? -900 : 0;
      const weak = i < n && (WEAK.has(last.toLowerCase()) || splitsTerm(last, sentence[i].text)) ? 4000 : 0;
      const cost = best[j].cost + (MAX_CUE - join(ws).length) ** 2 + comma + weak;
      const cand = { cues: best[j].cues + 1, cost, cuts: [...best[j].cuts, i] };
      if (!best[i] || cand.cues < best[i].cues || (cand.cues === best[i].cues && cand.cost < best[i].cost)) best[i] = cand;
    }
  }
  if (!best[n]) throw new Error(`no caption split fits: "${join(sentence)}"`);
  let from = 0;
  return best[n].cuts.map((to) => sentence.slice(from, (from = to)));
}

const cues = sentences.filter(Boolean).flatMap(split);

const ts = (t) => {
  const ms = Math.round(t * 1000);
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`;
};

const timed = cues.map((ws, i) => {
  const start = ws[0].start;
  const limit = i + 1 < cues.length ? cues[i + 1][0].start - GAP : Infinity;
  const end = Math.min(Math.max(ws.at(-1).end + TAIL, start + MIN_SECONDS), limit);
  return { start, end, lines: lines(join(ws)) };
});

const srt = timed.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.lines.join('\n')}\n`).join('\n');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, srt);
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${timed.length} cues, ${timed[0].start.toFixed(2)}–${timed.at(-1).end.toFixed(2)} s`);
