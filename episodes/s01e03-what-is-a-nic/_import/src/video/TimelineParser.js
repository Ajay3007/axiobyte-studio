/**
 * Turns the WhisperX export in content/nic/timeline.json into something a
 * storyboard can address: sentences, word lookup by phrase, and a set of
 * named concepts (NIC, PCIe, RSS, DMA, descriptor ring, …) with the exact
 * moment they are spoken.
 *
 * The recorded voiceover is the master clock, so every visual cue in the
 * video resolves through this file. Nothing reads times out of the markdown
 * script — those were estimates for a ~16 min read and the real take is 11:58.
 */

// Each spoken word collapses to a bare alphanumeric token, so punctuation and
// hyphenation in the transcript ("PAM16.", "Multi-Q", "computer's", "7.9")
// never decide whether a phrase matches.
const token = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const tokens = (s) => s.split(/\s+/).map(token).filter(Boolean);

export class TimelineParser {
  constructor(data) {
    this.meta = data.meta ?? {};
    this.words = data.words ?? [];
    this.sentences = data.sentences ?? [];
    this.pauses = data.pauses ?? [];
    this.duration = this.meta.duration ?? this.words.at(-1)?.end ?? 0;
    this._norm = this.words.map((w) => token(w.word));
  }

  /** Index of the sentence containing `t`, or the next one starting after it. */
  sentenceIndexAt(t) {
    for (let i = 0; i < this.sentences.length; i++) {
      if (t <= this.sentences[i].end) return i;
    }
    return this.sentences.length - 1;
  }

  sentence(i) {
    return this.sentences[i] ?? null;
  }

  /** Start time of sentence i (throws loudly in dev if the script drifts). */
  sentenceStart(i) {
    const s = this.sentences[i];
    if (!s) throw new Error(`TimelineParser: no sentence ${i}`);
    return s.start;
  }

  sentenceEnd(i) {
    const s = this.sentences[i];
    if (!s) throw new Error(`TimelineParser: no sentence ${i}`);
    return s.end;
  }

  /**
   * Locate a spoken phrase. Returns { start, end, index } of the match, or
   * null. `after` / `before` bound the search so a common word like "cable"
   * resolves inside the section that asked for it.
   */
  findPhrase(phrase, { after = -Infinity, before = Infinity, occurrence = 1 } = {}) {
    const needle = tokens(phrase);
    if (!needle.length) return null;
    let hits = 0;
    for (let i = 0; i + needle.length <= this._norm.length; i++) {
      const w0 = this.words[i];
      if (w0.start < after || w0.start > before) continue;
      let ok = true;
      for (let k = 0; k < needle.length; k++) {
        if (this._norm[i + k] !== needle[k]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (++hits < occurrence) continue;
      return { start: w0.start, end: this.words[i + needle.length - 1].end, index: i, words: needle.length };
    }
    return null;
  }

  /** findPhrase() that refuses to silently fall back — the storyboard depends on real hits. */
  wordTime(phrase, opts = {}) {
    const hit = this.findPhrase(phrase, opts);
    if (!hit) {
      const where = opts.after ? ` after ${opts.after}s` : '';
      throw new Error(`TimelineParser: phrase "${phrase}" not found${where} in the voiceover`);
    }
    return hit.start;
  }

  /** Same, but tolerant: returns `fallback` instead of throwing. */
  wordTimeOr(phrase, fallback, opts = {}) {
    const hit = this.findPhrase(phrase, opts);
    return hit ? hit.start : fallback;
  }

  /** Words overlapping a window, for caption rendering and debug read-outs. */
  wordsBetween(t0, t1) {
    return this.words.filter((w) => w.end > t0 && w.start < t1);
  }

  /** The longest silence inside a window — a good place to hide a hard cut. */
  longestPause(t0, t1) {
    let best = null;
    for (const p of this.pauses) {
      if (p.start < t0 || p.end > t1) continue;
      if (!best || p.duration > best.duration) best = p;
    }
    return best;
  }

  /** Mid-point of the gap between two sentences — where transitions belong. */
  gapAfter(sentenceIndex) {
    const a = this.sentences[sentenceIndex];
    const b = this.sentences[sentenceIndex + 1];
    if (!a) return 0;
    if (!b) return a.end;
    return (a.end + b.start) / 2;
  }
}
