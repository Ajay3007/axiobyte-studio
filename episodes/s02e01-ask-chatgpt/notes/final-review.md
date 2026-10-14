# s02e01 — final review record

**Status: final-review copy complete, awaiting the creator's acceptance.** Not published.

## The deliverable

| | |
|---|---|
| File | `episodes/s02e01-ask-chatgpt/out/s02e01-ask-chatgpt.mp4` (local render output, gitignored) |
| sha256 | `b9f2adf77b48793d71df374895b37b2c5b96c61717aeece953d6354f9cee6440` |
| Picture | H.264, 1080×1920, 30 fps, 3441 frames, 114.70 s — 109.71 s of narration, a 1.5 s hold, the 3.5 s portrait end card |
| Sound | AAC 48 kHz: the source voiceover, unprocessed, then silence under the card |
| End card | Platform-neutral (`brandEndCard({ target: '9x16', handle: false })`): one master serves Reels (@axiobyte) and Shorts (@theaxiobytes), which share no handle |
| Rebuild | `abs render episodes/s02e01-ask-chatgpt --headless` then `abs compose episodes/s02e01-ask-chatgpt --target 9x16` |

Earlier versions, kept in the same folder for comparison: `s02e01-ask-chatgpt-rc1.mp4` (the first full
render), `lookdev-s02e01.mp4` and `lookdev-s02e01-v1.mp4` (look-development, 10.6–61.9 s).

## Production inputs — unchanged

| Input | sha256 | Recorded in |
|---|---|---|
| `audio/voiceover.mpeg` (local, gitignored) | `17e1229c33a73d9feac7f64e320e00c0b750fff819aa9462a46067560a102916` | `episode.yaml` |
| `timeline/timeline.json` | `1deb6d91919bf79e95df499263c9fc9c1bf1e742f961da5c47e424cc0e589209` | `episode.yaml` |
| `script.txt` (approved) | `ff9965138237d171b61d86251c2b3cfb69079801b9a0de362a577c4f33195902` | `notes/brief.md` |

## Validation (2026-10-14)

- The MP4 decodes end to end without error; picture and sound as above.
- Its voiceover is the source recording: 0 ms offset at 2, 30, 60, 90 and 104 s, correlation 1.0.
- It is built from the current source: `abs render` reuses all 7 shot clips from its content-addressed
  cache (0 rendered, 7 cached).
- Mobile-safe: `node episodes/s02e01-ask-chatgpt/three/check-safe-zones.mjs` — no readable text in the
  Reels/Shorts interface zones at any of 557 instants (every 0.2 s).
- Determinism: 10/10 frames match `three/determinism.baseline`; s01e03 matches its baseline 6/6.
- Tests: pytest 877 passed (867 + 10 skipped without the reference episodes); vitest 431 passed;
  ruff, mypy and import contracts clean; the experiences build and pass; `abs plan` ready on all four
  episodes.

## Known variance: the word at 48.6 s

The approved script reads "every token looks back over the **tokens** so far"; the supplied timeline
transcribes "**token**". Whether the voice says "token" or "tokens" cannot be established from the
recording: the word's length (0.320 s) matches the clear singular "token"s (0.30–0.34 s) and its
sibilant (125 ms) matches a lone /s/, which leans "token", but the sibilant's onset is slightly voiced,
which fits a /z/ as well as carry-over from the /n/.

Decision: **the audio is kept as supplied**, and this is recorded as a minor pronunciation /
transcription variance. The script, the audio and the timeline are unchanged, and no visual cue
depends on the word.

## Other notes

- Token IDs, attention weights, candidate probabilities and per-word probabilities are illustrative,
  and every stretch that shows them carries an "ILLUSTRATIVE" kicker (enforced by
  `renderers/three/test/s02e01-film.test.js`). Nothing depicts ChatGPT's actual internals.
- Token splits are not verified against a real tokenizer (none is installed); the example split
  ("Ray | leigh") is labelled illustrative.
