# "What Is a NIC?" — the video build

This repo now has two front ends over the same 3D card:

| | Interactive | Video |
|---|---|---|
| Page | `index.html` | `video.html` |
| Entry | `src/main.js` → `src/app.js` | `src/video-main.js` → `src/video/VideoApp.js` |
| Clock | `requestAnimationFrame` | the voiceover, sampled at 30 fps |
| Camera | OrbitControls | `CameraDirector` (deterministic shots) |
| UI | buttons, tooltip, info panel | nothing but designed overlays |
| Output | a web page | `final/nic-video.mp4` |

Both build the NIC through **`src/scenes/nicWorld.js`** — same geometry, same
materials, same camera presets, same component registry, same packet system.
Nothing about the card is duplicated for the video.

---

## Quick start

```bash
npm install
npm run dev          # the interactive site, unchanged            → :5173
npm run video        # the video preview with transport + audio   → /video.html
npm run render       # the finished film                          → final/nic-video.mp4
```

`npm run render` takes about 12 minutes and needs `ffmpeg` on `PATH` and a
Chrome/Chromium install (it uses `puppeteer-core`, so nothing is downloaded;
set `PUPPETEER_EXECUTABLE_PATH` if yours is somewhere unusual).

Output: **1920×1080, 16:9, 30 fps, H.264 (High 4.2, CRF 17, yuv420p limited-range
bt709), AAC-LC 192 kb/s 48 kHz**,
11:59.5 long — the 11:57.99 voiceover plus a 1.5 s tail so the end card is not
cut off mid-word. `--tail 0` removes it.

---

## The four inputs

```
content/nic/voiceover.mpeg   the recorded narration — the master clock
content/nic/timeline.json    WhisperX word + sentence timings for that audio
scripts/nic-video-script.md  the storyboard / narrative source
src/ (nic-3d)                the 3D hardware engine
```

**The audio and `timeline.json` are the only sources of timing.** The markdown
script's section headings ("0:30–1:45", total ~16 min) were estimates written
before the take; the recorded read is 11:57.99. Every cue in the video resolves
through `TimelineParser`, so the visuals follow the voice, not the outline:

```js
W('RSS', 385)        // the moment the word "RSS" is spoken after t=385  → 389.15
S(68)                // the moment sentence 68 begins                    → 409.67
E(88)                // the moment sentence 88 ends                      → 524.75
```

`W()` throws if a phrase isn't in the transcript, so a mis-typed cue fails loudly
at build time rather than drifting silently.

### The voiceover file

`voiceover.mpeg` is an MPEG **program stream** wrapping MP3. ffmpeg reads it
directly (the renderer does), but a browser `<audio>` element cannot. `npm run
audio` stream-copies the MP3 out to `content/nic/voiceover.mp3` for the preview
page — no re-encode, so the timing is identical apart from ~12 ms of container
padding, which the preview HUD compensates for. The final mux always uses the
original `.mpeg`.

---

## Architecture

```
timeline.json ─┐
               ├─► storyboard.js ──► VideoDirector ──┬─► CameraDirector  ─► engine.camera
script.md    ──┘   (the score)                       ├─► AnimationDirector ─► NIC model
                                                     └─► Overlay          ─► 2D canvas
                                                              │
                                        engine.stepTo(t) ─────┤
                                                              ▼
                                                        Compositor ──► frame
                                                                        │
                                              scripts/render.mjs ──► ffmpeg ──► MP4
```

```
src/video/
  TimelineParser.js       words / sentences / phrase lookup out of timeline.json
  storyboard.js           THE SCORE: every shot, highlight, packet and overlay cue
  VideoDirector.js        binds one storyboard to one NIC world; update(t)
  CameraDirector.js       deterministic shots: blend, orbit, push, pan, frame-shift
  AnimationDirector.js    highlights, heatsink lift, packet routes, queue zones
  Compositor.js           background + WebGL + overlay → the output frame
  VideoApp.js             assembles it all; exposes window.__VIDEO__
  DebugOverlay.js         preview-only transport (never drawn into a frame)
  scene/SignalPaths.js    glowing routes over the real board routing
  overlay/
    theme.js              1920×1080 palette, type and safe area
    draw.js               canvas primitives (panel, chip, leader line, easings)
    Overlay.js            the cue list and its per-frame draw
    widgets/
      titles.js           title card, chapter markers, scrims, backdrops, end card
      callouts.js         callouts with 3D-anchored leader lines, chips, stats
      flow.js             the packet-path rail, PCIe lanes, doorbell
      diagrams.js         duplex, 8P8C pairs, PAM-16, isolation, DSP chain, offload
      dataplane.js        RSS, DMA, descriptor ring, DPDK, RX/TX comparison, stack
      captions.js         optional burned-in subtitles (off by default)
```

### Determinism

`renderFrame(i)` is a pure function of `i`. Nothing in video mode reads
`Date.now()` or `performance.now()`:

* `Tweens` has no clock of its own — the host pushes one in. Realtime passes
  `performance.now()`; the renderer passes `videoTime * 1000`.
* `Engine` runs on a **manual clock**: `engine.stepTo(t, { dt: 1/30 })`.
* Camera pose is computed from the shot list, not integrated.
* Highlight levels go through `Highlighter.setLevels()`, bypassing the
  interactive easing.
* The heatsink is driven by `heatsink.setLiftAmount(0..1)` from keyframes.
* Packets use `PacketAnimator.buildRoute(...).seek(u)` — the same stop lists and
  the same Bézier hops `demoRx()` / `demoTx()` play, made addressable by time.
* The LED "activity" blink is a hash of the time slot rather than accumulated
  state (this also removed frame-rate drift from the interactive site).
* Overlay cues carry no state between frames: each gets `local`, `u` and `a`
  derived from `t` and draws from scratch.

`npm run check:determinism` renders the same six timestamps in two separate
browser sessions and compares SHA-256 of the PNGs; they come out byte-identical,
including a cold jump to 11:36.

The one residual is the LED brightness *easing*, which integrates with `dt`. It
converges in ~0.2 s, so a backwards seek in the preview can differ from a
forward playthrough for a few frames. Renders always play forward from frame 0
(and segmented renders warm up — see `--warmup`), so the output is exact.

---

## How the timeline drives the visuals

`storyboard.js` returns five lists. All times come from `W()`, `S()` and `E()`.

**Camera shots** — resolved once through the existing `CameraManager`, so they
reuse the site's presets (`overview`, `front`, `top`, `rear`, `pcie`) and its
exact frustum fit:

```js
{ at: W('RSS', 385) - 3.0,
  view: look(['nic-controller', 'rx-queue'], v(-0.36, 0.84, 0.52), 2.6),
  frame: [0.26, 0],           // slide the image left; the diagram owns the right half
  transition: 3.0,            // seconds to blend out of the previous shot
  motion: { orbit: 0.005 } }  // radians/second of drift while we hold
```

`frame` is what keeps the composition honest: the model never moves off its own
axis to make room for a diagram, the rendered window shifts instead.

**Highlights**, **heatsink**, **packet flights**, **queue zones** and
**signal paths** are keyframe lists consumed by `AnimationDirector`:

```js
{ route: 'rx', stops: [{ at: S(54) + 1.2, travel: 2.4 }, …], end: S(83) + 2.0 }
```

Each stop is one component on `hardwareRoute(RX_PATH)`; the packet holds at a
stop and eases to the next over `travel` seconds, arriving exactly as the
narration names it. The bottom rail uses the same times, so pill and token move
together.

**Overlay cues** are `{ start, end, layer, draw(ctx, k) }`. `k.project(id,
anchor)` converts a component anchor to overlay pixels, which is how callout
leader lines stay attached to the part they name.

### Adding or moving a cue

1. Find the moment in the transcript: `node -e "…"` or the preview HUD's
   read-out, which shows the active section, shot and cue ids at any timestamp.
2. Add a cue to the list in `storyboard.js`, anchored with `W()` / `S()` / `E()`.
3. `npm run video`, jump to that chapter, step frames with `←`/`→`.
4. `node scripts/render.mjs --sheet auto` for a contact sheet of every shot.

---

## The preview page

`npm run video` opens `/video.html`. It renders the same composite canvas the
renderer captures, plus a transport strip underneath:

* `space` play / pause (with the real voiceover)
* `←` `→` one frame · `shift` one second · `alt` ten seconds
* `,` `.` previous / next chapter, or click a chapter chip
* `c` toggle burned-in captions
* `SYNC` shows audio-vs-video drift in ms — the fastest way to check a cue

Useful URL parameters: `?t=420` start position, `?captions=1`, `?ss=2`
supersampling, `?fps=30`, `?render=1` (strips the HUD — what the renderer loads).

**The HUD is DOM, not canvas.** It sits beside the composite canvas and is never
drawn into a frame, so it cannot leak into the output; `?render=1` doesn't even
construct it.

---

## Rendering

```bash
npm run render                                  # the whole film
npm run render:a                                # 0:00–0:32  cold open + title
npm run render:b                                # 6:15–8:45  RSS → DMA → PCIe → ring → DPDK
npm run sheet                                   # contact sheet of every camera shot
node scripts/render.mjs --from 7:15 --to 8:30   # any range
node scripts/render.mjs --sheet every:20        # contact sheet every 20 s
node scripts/render.mjs --stills 3:00,7:42      # full-size PNG stills
node scripts/render.mjs --probe                 # section table and durations
```

| flag | default | |
|---|---|---|
| `--from` / `--to` | whole video | accepts `435`, `7:15`, `7:15.5` |
| `--fps` | 30 | |
| `--ss` | 2 | supersampling: the WebGL buffer is 3840×2160, downsampled to 1920×1080 |
| `--crf` / `--preset` | 17 / medium | x264 |
| `--format` / `--quality` | jpeg / 0.97 | how frames cross into ffmpeg; `png` for lossless |
| `--captions` | off | burn in subtitles |
| `--normalize` | off | `loudnorm` on the voiceover |
| `--no-audio` | off | video only |
| `--tail` | 1.5 | seconds of end card after the last word |
| `--headless` | off | run Chrome headless (no window). The default is headful, which gets the GPU |
| `--warmup` | 45 when `--from > 0` | frames stepped but not written, so a mid-video segment matches a full playthrough |
| `--out` | `final/nic-video.mp4` | |

The pipeline starts a Vite dev server in-process on an OS-assigned port (so it
never collides with `npm run dev`), drives `video.html?render=1` with Chrome,
calls `__VIDEO__.encodeFrame(i)` per frame and pipes the result straight into
`ffmpeg` — nothing is written to disk except the finished file. Roughly 31 fps
of throughput, so about 12 minutes for 21 585 frames.

HMR and the file watcher are disabled on that server: editing a source file
during a render would otherwise hot-reload the page out from under the frame
loop. Interrupting the render (Ctrl-C) kills ffmpeg with it.

`scripts/render-full.sh` does the same job in two segments and joins them
losslessly, for environments with a per-command time limit.

---

## Changes to the existing code

All additive; the interactive demo behaves as before.

| file | change |
|---|---|
| `src/engine/tween.js` | clock injected by the host instead of `performance.now()`; more easings |
| `src/engine/Engine.js` | optional manual clock, fixed render size, pixel ratio, controls-free mode |
| `src/scenes/nicWorld.js` | **new** — the shared world builder both modes use |
| `src/app.js` | builds through `nicWorld` (same behaviour, same `__AXIOBYTE__` API) |
| `src/animation/PacketAnimator.js` | added `buildRoute()`, the seekable form of `animateRoute()` |
| `src/animation/LedController.js` | `activity` blinks are now a pure function of time |
| `src/interaction/Highlighter.js` | added `setLevels()` for absolute, seekable highlighting |
| `src/hardware/nic/Heatsink.js` | added `setLiftAmount(0..1)` |
| `vite.config.js` | production build stays `index.html` only — `video.html` is dev/render only |

Nothing in `hardware/`, `concepts/`, `ui/` or the component metadata was
rewritten; the video reads component ids, anchors, camera presets and the RX/TX
stage lists straight out of them.

---

## The cut

Section boundaries are derived from the recorded sentences, not the script:

| | | |
|---|---|---|
| 00 | 0:00 – 0:29 | Cold open → title card |
| 01 | 0:29 – 1:19 | What is a NIC? (duplex diagram, 10 Gb/s · 14.88 Mpps) |
| 02 | 1:19 – 4:58 | Anatomy — PCB, RJ45, magnetics, PHY, controller, heatsink, PCIe, bracket |
| 03 | 4:58 – 5:34 | Why a dedicated NIC? (throughput / offload / control) |
| 04 | 5:34 – 8:44 | **Receive path** — cable → RJ45 → magnetics → PHY → MAC → RSS → DMA → PCIe → ring → DPDK → app |
| 05 | 8:44 – 10:00 | **Transmit path** — app → TX ring → doorbell → DMA read → PHY → cable, then RX/TX symmetry |
| 06 | 10:00 – 11:02 | Why it is fast — RSS, DMA, polling, offload |
| 07 | 11:02 – 11:29 | Where these cards live |
| 08 | 11:29 – 11:59 | The whole path, then the end card |

`node scripts/render.mjs --probe` prints this from the live storyboard.
