# AI Made Visual — series standards

Pillar id `p02-ai-made-visual`. Approachable, visually rich AI explainers for a general
audience, technically accurate. Episodes are `s02eNN-kebab-slug` (s01 is the systems pillar,
`p01-high-performance-data-plane`; the season number distinguishes the pillar).

This file holds what every episode of the series shares. An episode's own direction lives in
its `notes/brief.md`; the studio's architecture and conventions apply unchanged.

## The quality bar

Three videos in `reference/` (gitignored, local) set it. They are complementary, not
templates.

| Reference | What it contributes | Where to look |
|---|---|---|
| `earth.MP4` | Scale, light, the camera as guide: a lit subject on a dark ground, the camera travelling *into* it to reveal structure | 40–52 s: globe → cutaway → true-scale crust → mantle |
| `gravity.MP4` | Abstract ideas as geometry that means something; glow as activity and relationship; no hard cuts | 20–32 s: one lattice separates into two, threads grow between them |
| `nn_explained.MP4` | Precision built step by step: each stage grows out of the last; colour and type stay consistent | 4–16 s: weighted sum → neuron → layer |

All three are native 9:16, open on the subject, keep it in the middle band of the frame, and
change something on screen every second or two.

## Visual principles

1. **One world per episode.** Objects persist and transform rather than being replaced. A cut
   is allowed when it makes the idea clearer, never by default.
2. **Every element stands for something.** If a shape, thread or glow cannot be named as a
   concept, it does not belong. Glow marks activity or relationship, never decoration. No
   generic "AI" imagery: no brains, robots, circuit-board backdrops, or particles that mean
   nothing.
3. **Depth puts the idea in focus.** Foreground subject, supporting context behind it, a quiet
   ground. Light tells the viewer where to look.
4. **Precision appears when it is spoken.** Numbers, labels and formulas arrive on the word
   that names them, and only if the narration names them.
5. **Build, then carry forward.** Each stage grows from the previous one; a finished stage
   compresses into a token that stays visible.
6. **One meaning per colour** within an episode. Values live in the theme
   (`src/axiobyte_studio/design/themes/`), never in episode code.
7. **The narration sets the pace.** Motion lands on cue words; a pause may hold, with slow
   drift. There is no movement quota.
8. **Abstractions say so.** An illustrative visual (an embedding space, invented numbers) is
   marked as illustrative, usually in the kicker.
9. **Every format is composed for itself.** Nothing is cropped from another format.

## Typography

Brand faces only (`docs/brand/AXIOBYTE_BRAND.md`). Per frame, at most:

- one **kicker**: small, letter-spaced capitals at the top, naming the concept on screen — never a
  production claim (`docs/brand/AXIOBYTE_BRAND.md`, *On-screen wording*);
- one **caption** of up to two lines, with one keyword in an accent colour;
- three **labels**, each a thin leader line to the thing it names.

Text supports the picture. A muted viewing should still show the mechanism.

## Technical accuracy

- The explanation is of the general mechanism, not a depiction of any product's proprietary
  internals. Say what is illustrative.
- Use the precise distinction even when the narration simplifies: a token ID is an identifier,
  not a meaning; a learned representation is not a literal map; causal attention looks at the
  current and earlier positions only; probabilities form a distribution and the pick is not
  always the top one.
- Never imply that fluent output is correct output.
- Example numbers (token IDs, probabilities) are either verified against a public source or
  shown as illustrative.

## Production

- **Narration first.** Claude drafts `script.txt` (spoken text only); the creator approves it,
  produces the audio with ElevenLabs, and supplies the audio and its `timeline.json`. Both are
  immutable: never regenerated, edited, reordered or retimed. A mismatch between them is
  reported to the creator, and work stops.
- **Inputs** follow s01e03: `audio/voiceover.<ext>` (gitignored, sha256 pinned in
  `episode.yaml`) and `timeline/timeline.json` (committed as delivered, named by
  `voiceover:`). The loaders read the WhisperX-style layout (`meta`, `words`, `sentences`,
  optional `pauses`).
- **Formats.** Under 3 minutes: one native 9:16 master for Reels and Shorts
  (`platforms: {9x16: reels}`; the Reels safe area contains the Shorts one). 3 minutes or
  longer: a full 16:9 film, then concept-complete 9:16 parts, each under 3 minutes.
- **Renderer.** Chosen per episode for the visual result. Three.js is the starting point (depth,
  light, continuous camera); Manim when the episode is flat, typeset explanation; Blender only
  for what neither can do, with the reason written down.
- **Reuse.** Visual elements start in the episode and move into `renderers/three/src/` on
  their second use. Concepts, colour roles and assets are added when an episode needs them.

## Review gates

A result is rejected early, not just checked at the end.

1. **Script** — accurate, narration only, approved.
2. **Intake** — audio and timeline hashes recorded; layout valid; durations agree with the
   probed audio (±0.1 s); sentences match `script.txt`.
3. **Look-dev** — representative frames and short clips at 1080×1920, beside reference frames at
   the same display height on a phone-sized view, before full production.
4. **Storyboard** — every beat cued to a word in the timeline; `abs plan` green; a contact sheet
   at beat times shows no slide-like frames.
5. **Accuracy and comprehension** — the accuracy rules above hold on screen; a muted viewing
   still explains each step.
6. **Format** — text inside the safe area and clear of platform UI; legible at phone size.
7. **Sync** — events land on their cue words; output length is audio plus tail (±1 frame);
   audio unprocessed.
8. **Regression** — the episode's determinism holds across two runs; existing baselines
   (s01e03) are unchanged; every suite is green.
9. **Final** — a contact sheet of one frame per beat, a full watch on a phone, creator sign-off.
