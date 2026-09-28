# s01e03 — *What Is a NIC?*

An 11:59 film that opens a dual-port 10GBASE-T PCIe card part by part, then sends one packet
through exactly those parts — and the first episode on AxioByte Studio's **Three.js backend**.
The same 3D world is the interactive page
[`/axiobyte/networking/nic/`](https://ajay3007.github.io/axiobyte/networking/nic/)
(`experiences/networking/nic/`): one model, one set of camera presets, one packet system.

## Make the film

```bash
abs plan    episodes/s01e03-what-is-a-nic            # validate: cues, concepts, thesis, renderers
abs render  episodes/s01e03-what-is-a-nic --headless # 15 shots → out/shots/*.mp4 (cached per shot)
abs compose episodes/s01e03-what-is-a-nic            # join + voiceover → out/s01e03-what-is-a-nic.mp4
```

Output: 1920×1080, 30 fps, H.264 High, AAC-LC 48 kHz; **21,585 frames, 11:59.5** — the
11:57.99 voiceover plus a 1.5 s tail so the end card is not cut mid-word.

- `abs render` needs Node ≥ 20.19 (`npm ci` at the repo root), Chrome/Chromium, and ffmpeg.
  Headful (the default) uses the GPU and a window per shot; `--headless` renders at ~24 fps on
  software GL — about 15 minutes for the whole film. Change one shot, re-render one shot:
  `abs render … --shot 0110`.
- `abs compose` needs the voiceover at `audio/voiceover.mpeg`. It is **not in git**: copy it in.
  It must be the recording `timeline/words.json` was transcribed from — its sha256 is pinned in
  `episode.yaml`, and anything else is refused.

## What is in this folder

| Path | What |
|---|---|
| `episode.yaml` | id, target (16:9), `renderer: three`, the pinned `audio`, `tail` |
| `picture.md` | THE ONE PICTURE — the thesis, the counter-picture, the payoff frame, and the prohibitions `abs plan` checks |
| `storyboard/beats.yaml` | 17 acts, 32 beats, each landing on a spoken word, naming the concept it teaches |
| `storyboard/shots.yaml` | 15 shots — one per chapter — and the renderer of each |
| `timeline/` | `words.json` (WhisperX word + sentence timings — the master clock), `analysis.json`, `captions.srt` |
| `three/` | the Three.js score: `storyboard.js` (every camera move, highlight, packet flight and overlay cue), `video.html` + `video-main.js` (the video target's page), `determinism.baseline` |
| `script.md`, `script.txt` | the narration as written (its timings were estimates; the take is the clock) |
| `notes/` | the prompts the film was made from |
| `audio/` | the voiceover — local only, gitignored |
| `out/` | everything rendered — gitignored |

The model is not here: it is the networking domain of the Three.js backend,
[`renderers/three/src/domains/networking/nic/`](../../renderers/three/src/domains/networking/nic/).

## The cut

Shot windows come from `shots.yaml`: each shot starts in the silence before the sentence of its
first beat, so every cut lands between words (`abs render --dry-run` prints them).

| Shot | Window | Chapter |
|---|---|---|
| `shot_0010_cold_open` | 0:00.0 – 0:29.7 | Cold open → title |
| `shot_0020_what_is_a_nic` | 0:29.7 – 1:19.6 | What is a NIC? (duplex, 10 Gb/s · 14.88 Mpps) |
| `shot_0030_pcb` … `shot_0090_pcie` | 1:19.6 – 4:59.3 | Anatomy — PCB, RJ45, magnetics, PHY, controller, heatsink, PCIe + bracket |
| `shot_0100_why` | 4:59.3 – 5:32.0 | Why a dedicated NIC? |
| `shot_0110_receive_path` | 5:32.0 – 8:45.0 | **Receive path** — cable → RJ45 → magnetics → PHY → MAC → RSS → DMA → PCIe → ring → DPDK → app |
| `shot_0120_transmit_path` | 8:45.0 – 10:00.3 | **Transmit path**, then RX/TX symmetry |
| `shot_0130_why_fast` | 10:00.3 – 11:02.6 | Why it is fast — RSS, DMA, polling, offload |
| `shot_0140_where` | 11:02.6 – 11:29.7 | Where these cards live |
| `shot_0150_whole_path` | 11:29.7 – 11:59.5 | The whole path, then the end card |

Every shot is `three` today. Re-staging one in Manim is a one-word change in `shots.yaml` plus a
`stage_<act>` function in `shots/episode.py`; the composer joins clips from both.

## How the voiceover drives the visuals

**The audio and `words.json` are the only sources of timing.** Every cue in `three/storyboard.js`
resolves through `TimelineParser`, and fails loudly if the phrase is not spoken:

```js
W('RSS', 385)   // the moment "RSS" is spoken after t=385  → 389.15
S(68)           // the moment sentence 68 begins           → 409.67
E(88)           // the moment sentence 88 ends             → 524.75
```

The Studio side reads the same file: `beats.yaml` cues like `RSS@64` (word @ sentence) are
resolved by `abs plan` against it.

`storyboard.js` returns the camera shots (through the backend's `CameraManager`, so they reuse the
interactive presets and exact frustum fit), keyframe lists for highlights, the heatsink, packet
flights, queue zones and signal paths (consumed by the NIC's `AnimationDirector`), and overlay
cues `{ start, end, layer, draw(ctx, k) }` — `k.project(id, anchor)` keeps callout leader lines
attached to the part they name.

```js
{ at: W('RSS', 385) - 3.0,
  view: look(['nic-controller', 'rx-queue'], v(-0.36, 0.84, 0.52), 2.6),
  frame: [0.26, 0],           // slide the image left; the diagram owns the right half
  transition: 3.0,
  motion: { orbit: 0.005 } }
```

### Adding or moving a cue

1. `abs preview episodes/s01e03-what-is-a-nic --open` — the composite canvas plus a transport:
   `space` play/pause with the real voiceover · `←`/`→` one frame · `shift` one second ·
   `alt` ten · `,`/`.` chapter · `c` captions · `SYNC` shows audio-vs-video drift in ms.
   URL parameters: `?t=420`, `?captions=1`, `?ss=2`. The HUD is DOM, never drawn into a frame.
2. Add the cue in `three/storyboard.js`, anchored with `W()` / `S()` / `E()`.
3. `node renderers/three/tools/render.mjs --episode episodes/s01e03-what-is-a-nic --sheet auto`
   for a contact sheet of every camera shot, `--stills 3:00,7:42` for full-size stills.
4. `abs render … --shot <n>` re-renders only the shot that changed.

## Determinism

Every frame is a pure function of its index (see `renderers/three/README.md`). The six frames in
`three/determinism.baseline` were hashed from the original nic-3d before the migration; after it:

```bash
node renderers/three/tools/check-determinism.mjs --episode episodes/s01e03-what-is-a-nic \
  --expect episodes/s01e03-what-is-a-nic/three/determinism.baseline
```

reports all six byte-identical (on the Mac, which owns the baseline).
