# s02e02 — final review record

**Status: published, 2026-10-15, on Instagram Reels and YouTube Shorts** (copy and settings:
`social/publishing-package.md`). Approved by the creator after full playback, then corrected for
branding (below) and re-approved. As a published episode it is not rewritten retroactively.

## The deliverable

| | |
|---|---|
| File | `episodes/s02e02-different-answers/out/s02e02-different-answers.mp4` (local render output, gitignored) |
| sha256 | `d2fdedc6839b6c0496b29306aa35407574c922c1601d6c7fe51d44f1f599da79` |
| Picture | H.264 High, 1080×1920, 30 fps, 4080 frames, 136.00 s — 131.00 s of narration, a 1.5 s hold, the 3.5 s portrait end card |
| Sound | AAC 48 kHz mono: the source voiceover, unprocessed, then silence under the card |
| End card | Platform-neutral (`brandEndCard({ target: '9x16', handle: false })`): one master serves Reels (@axiobyte) and Shorts (@theaxiobytes) |
| Rebuild | `abs render episodes/s02e02-different-answers --target 9x16 --headless` then `abs compose episodes/s02e02-different-answers --target 9x16` |

Earlier versions, kept in the same folder:

- `s02e02-master-branding.mp4` — the same bytes as the master (the file validated under that name).
- `s02e02-review-candidate.mp4` (sha256 `bf979ca9…a1d2`) — the master as first approved, with the
  opening kicker `AI MADE VISUAL · 02` and the closing kicker `NEXT · AI MADE VISUAL 03`.
- `s02e02-review-candidate-v1.mp4`, `-pre.mp4` — the review candidates before the final polish.
- `s02e02-review-b09-b16.mp4`, `-r1.mp4` — the approved review slice (31.0–72.7 s) and its first cut.

## Production inputs — unchanged

| Input | sha256 | Recorded in |
|---|---|---|
| `audio/s02ep02.mpeg` (local, gitignored; kept under its delivered name) | `409b46c6fffed08e7b7460edeb87e30284d6082baa5437c9a54e1d4ae439c38a` | `episode.yaml` (`audio.sha256`) |
| `timeline/timeline.json` | `57d4b51fb5b1cd697959dddf352c6164453248ab5be89ed7ef90ce71db3a06c7` | `episode.yaml` (`voiceover_sha256`), checked by `abs plan` |
| `script.txt` (approved) | `e843b18f707cbcf9d1437cb69e9b74563431c96ddc6d6e2464f98f92c726c37e` | `notes/visual-plan.md` |

The timeline transcribes two spoken numbers as numerals ("30%", "26"); the script spells them out.
That is formatting, not a mismatch, and the cues use the transcript's spelling.

## Validation (2026-10-15)

- The MP4 decodes end to end without error; picture and sound as above.
- Its voiceover is the source recording: 0 ms offset at 2, 30, 60, 90, 120 and 128 s, correlation 1.0;
  silence after the narration.
- It is built from the current source: every shot clip's recorded fingerprint matches the current
  source, timeline and settings, except for `three/determinism.baseline`, whose two branding frames
  were re-recorded after the render. The next `abs render` therefore re-renders, to identical pixels.
- Determinism: 11/11 frames match `three/determinism.baseline`; s02e01 matches its baseline 10/10 and
  s01e03 6/6.
- Mobile-safe: `node episodes/s02e02-different-answers/three/check-safe-zones.mjs` — no readable text in
  the Reels/Shorts interface zones (every 0.1 s, the whole film).
- Tests: pytest 883 passed (873 + 10 skipped without the reference episodes); vitest 488 passed
  (`renderers/three/test/s02e02-film.test.js`, `ml-probability.test.js`); ruff, mypy and import
  contracts clean; the experiences build and pass; `abs plan` ready, its input check passing.

## Branding correction (2026-10-15)

The first approved master opened on `AI MADE VISUAL · 02` and closed on `NEXT · AI MADE VISUAL 03`,
which read as a claim that the video was made by AI. They now read `ONE QUESTION, TWO ANSWERS` and
`NEXT QUESTION`, in the same place, size and timing (`docs/brand/AXIOBYTE_BRAND.md`, *On-screen
wording*). Nothing else changed:

- the narration is bit-identical to the first master's;
- B09–B16 (35.3–72.1 s) is pixel-identical, all 1105 frames;
- the other encoded frames that differ (to 29.9 s, from 122.7 s) are the encoder's propagation to the
  next keyframe and its look-ahead, at 54–60 dB PSNR; baseline frame 795 (26.5 s) renders identically;
- the baseline changed only at frames 540 and 3825, the two kickers.

The film tests reject any on-screen production claim (*branding*), checked against the old labels.

## Accuracy and disclosure

- Every value is illustrative, and every stretch that shows one carries an `ILLUSTRATIVE` or
  `DEMONSTRATION` kicker (enforced by the film tests).
- Staged outcomes, disclosed: the replay's two spins (`SAME PROBABILITIES · DEMONSTRATION`), the
  branches completing the opening's two answers (`DEMONSTRATION · ILLUSTRATIVE`), and the spin onto
  "banana" (a caption, "A staged spin: an unlikely token"). The sample spins at B10, B23 and B25 are
  seeded draws from the distribution on screen, the seeds chosen for typical counts.
- Temperature is computed exactly: probabilities = softmax(scores ÷ T), T > 0. The temperature
  section uses its own decision (after "The sky looks blue because"), not the first wheel's, because
  the first wheel's narrated 30 % / 26 % pair is too close to show concentration honestly.
- Low temperature is shown as far more repeatable, never identical; sampling as one reason among
  several; nothing depicts ChatGPT's internals or settings.

## Departures from `notes/visual-plan.md`, as approved

1. Temperature uses its own decision, as above.
2. The tree does not react to temperature; seeded dots on the wheel show the same contrast.
3. B06's callback is the token row, its glowing last position and a beam, without s02e01's layers.
4. B20's "strays" walk uses a seed chosen because it leaves a bright path; B19's two walks are plain
   seeded draws.
5. B27 spotlights the "Chance: the draw" chip (with its wheel icon) rather than the wheel itself.
6. B29's card fills with placeholder lines, so it makes no claim.
7. The model silhouette appears on "same model" only, not from "AI".

## Known limitations

- Kickers are the series size (about 9 px tall in a 360×640 preview), as in s02e01.
- In the widest shots (B26–B28) the input chips and answer panels carry the film's smallest text.
- B09–B16 is not byte-identical to the original slice clip: adding the opening's camera shots shifted
  the camera's breathing phase (SSIM 0.968, sub-pixel edges only).
- The live preview tool (`tools/preview.mjs`) runs silent for this episode: it finds `voiceover.*`
  only, and the recording keeps its delivered name.
