# MIGRATION — nic-3d into AxioByte Studio (2026-09-28)

`nic-3d` was a standalone Three.js + Vite project: an interactive 3D NIC and a deterministic
12-minute film, *"What Is a NIC?"*, built on the same scene. It is now part of AxioByte Studio,
and it no longer exists as a separate project.

| nic-3d was… | …and is now |
|---|---|
| its own rendering engine | the Studio's **Three.js backend**, `renderers/three` (`@axiobyte/three`) |
| its NIC model and networking diagrams | the backend's **networking domain**, `renderers/three/src/domains/networking/` |
| its interactive page | an **experience**, `experiences/networking/nic/`, served at `ajay3007.github.io/axiobyte/networking/nic/` |
| its film and voiceover | a Studio **episode**, `episodes/s01e03-what-is-a-nic/`, planned by `abs plan`, rendered shot by shot by `abs render`, assembled by `abs compose` |
| its GitHub Pages workflow | `.github/workflows/three.yml` → a versioned release → pinned by the website |

The principles this follows are in `ARCHITECTURE.md` §8 (renderer-agnostic; per-shot selection;
Three.js has a video and a web target). The Phase 0 audit that planned it, with every
decision taken along the way, is [`docs/nic-migration-audit.md`](docs/nic-migration-audit.md).

## History

nic-3d was never a git repository, so its history starts here:

1. `chore(nic): import nic-3d verbatim` — every source file exactly as it was.
2. `refactor(nic): move every imported file to its home — renames only` — pure `git mv`s built
   from the imported blobs, so `git log --follow <file>` reaches the import for every file.
3. Everything after that edits files in their new homes.

A full snapshot of the original folder (without `node_modules/`, `dist/`, `final/`) is at
`~/Documents/dev/backups/nic-3d-snapshot-2026-09-28.tar.gz`. Tags `pre-nic-migration` (here)
and `pre-axiobyte-experiences` (website) mark both repositories' state before any change.

## What moved where

| nic-3d | Now |
|---|---|
| `src/engine/*` | `renderers/three/src/core/` |
| `src/interaction/{ComponentRegistry,Highlighter}.js` | `renderers/three/src/core/` |
| `src/interaction/InteractionManager.js`, `src/styles.css` | `renderers/three/src/web/` |
| `src/animation/PacketAnimator.js` | `renderers/three/src/core/` |
| `src/animation/LedController.js`, `src/hardware/{Kit,materials}.js`, `src/hardware/parts/*` | `renderers/three/src/core/hardware/` |
| `src/video/TimelineParser.js` | `renderers/three/src/core/timeline/` |
| `src/video/{VideoApp,VideoDirector,CameraDirector,Compositor,DebugOverlay}.js`, `video.css`, `overlay/{theme,draw,Overlay}.js`, `widgets/{titles,callouts,captions,flow}.js` | `renderers/three/src/video/` |
| `src/hardware/nic/*`, `src/scenes/{nicWorld,nicScene}.js` → `world.js`, `scene.js`, `src/video/scene/SignalPaths.js`, `src/video/AnimationDirector.js` | `renderers/three/src/domains/networking/nic/` |
| `src/concepts/dataplane.js`, `widgets/{diagrams,dataplane}.js` | `renderers/three/src/domains/networking/` |
| `scripts/{render,check-determinism,prepare-audio}.mjs`, `render-full.sh` | `renderers/three/tools/` |
| `index.html`, `src/{main,app}.js`, `src/ui/UI.js`, `public/favicon.svg` | `experiences/networking/nic/` |
| `video.html`, `src/video-main.js`, `src/video/storyboard.js` | `episodes/s01e03-what-is-a-nic/three/` |
| `content/nic/timeline.json`, `analysis.json`, `timeline.srt` | `episodes/s01e03-what-is-a-nic/timeline/{words.json,analysis.json,captions.srt}` |
| `scripts/nic-video-script.md`, `nic-voiceover.txt` | `episodes/s01e03-what-is-a-nic/{script.md,script.txt}` |
| `content/nic/{role,claude_prompt}.md` | `episodes/s01e03-what-is-a-nic/notes/` |
| `content/nic/voiceover.mpeg` | `episodes/s01e03-what-is-a-nic/audio/` — **local, gitignored**, sha256-pinned in `episode.yaml` |
| `content/nic/timeline.csv` | dropped (derivable from `words.json`) |
| `voiceovers/` (raw takes), `final/` (renders), `dist/`, `node_modules/`, `.github/` | not migrated |

## What was refactored, and what deliberately was not

**Changed:**

- **Layering.** The video host no longer imports the NIC or an episode: `createVideoApp` takes
  `createScene` (a domain's video scene, `nic/video.js`) and `buildStoryboard` (an episode's
  score). `AnimationDirector`, NIC-specific throughout, moved into the domain.
- **Tools** take `--episode <dir>`: no machine paths (`check-determinism.mjs` had one), outputs in
  `<episode>/out/`, audio only needed when encoding sound, `--expect` for a baseline.
- **The video preview** no longer downloads the voiceover in render mode.
- **The interactive page** links "AxioByte" back to the `/axiobyte/` hub, and its kicker names
  its domain ("AxioByte · Networking", was "AxioByte · Hardware").

**Not changed:** the NIC geometry, materials, camera presets, metadata, UI, the storyboard's
cues and choreography, every video frame. Verified, not assumed — see *Verification* below.

**Added to the Studio (Python):**

- `renderer:` on shots (default `manim`; an episode may set its own default) and the `renderers`
  plan step — unknown renderer or a Blender shot (no shot rendering yet) is an error; a Blender
  shot without a `reason:` warns; shots on per-window backends must tile the film.
- `storyboard/windows.py` — shot windows, cut in the silence between sentences.
- `backends/three/` — the adapter that renders one shot window through `render.mjs`.
- `render_episode` dispatch — Manim-only episodes render **exactly as before**; anything else
  renders shot by shot, with a per-shot content-hash cache.
- `compose/` — `abs compose` trims Manim windows, joins clips (stream copy when they match,
  one uniform re-encode when they do not), lays the pinned voiceover under them, and checks
  the frame count against the windows.
- CLI: `abs compose`, `abs preview`, `abs web {dev,build,preview,test}`, `abs render --headless`.
- Concepts `phy`, `magnetics`, `pcie`, `descriptor_ring` (atomic — each with an actor, a visual
  language entry and a flat Manim drawing, since atomic means drawable) and `rss` (interaction).
- Import contracts: `compose` added at the top of the layer stack and to the no-renderer rule.

## Verification

Against the untouched nic-3d, recorded before the first change:

| Check | Before | After |
|---|---|---|
| Video frames 90, 3600, 11670, 12330, 15480, 20880 (SHA-256 of PNG) | baseline | **byte-identical** |
| Frame count / section table | 21,585 / 15 sections | identical |
| Interactive at `/axiobyte/networking/nic/`: components, draw calls, triangles | 11 / 187 / 87,666 | identical, zero errors or 404s, phone viewport |
| Python gate (ruff, format, mypy, import contracts, pytest) | 471 passed | all pass, 471 → 512 tests |
| Composed film (15 per-shot clips + voiceover) vs the whole-film frame count | 21,585 | see `episodes/s01e03-what-is-a-nic/README.md` |

## Compatibility decisions

- **s01e01 and s01e02 are untouched.** Their shots default to `manim`, and a Manim-only episode
  takes the original render path; no golden moved.
- **The film's score stays hand-authored JS** (`W()/S()/E()` against the same `words.json`),
  not generated from the Shot IR. The episode's `beats.yaml` and `shots.yaml` declare what it
  teaches and how it is cut, so `abs plan` checks it like any other episode.
- **Three.js renders 16:9 only.** Its overlay is laid out in absolute 1920×1080 pixels; `abs render
  --target 9x16` refuses with a fix rather than producing a wrong frame.
- **The voiceover is not committed** (the Studio never has committed audio); `words.json` carries
  the timing, `episode.yaml` pins the recording's hash, and `abs compose` refuses anything else.
- **Two NIC models exist** — the Blender `nic_board` plate (kept; tests use it) and the Three.js
  NIC (canonical, per the renderer ladder).

## Remaining work

1. Drive Three.js from the Shot IR, so a Three.js shot is choreography rather than JS.
2. Per-**layer** renderers in one shot (a Three.js background under a Manim overlay): alpha and
   depth in `compose/`.
3. Generate the Three.js overlay palette from `design/themes/systems.yaml` (today the NIC keeps
   its own `overlay/theme.js` values; reconciling them is a visible change and needs sign-off).
4. Generic keyframe lanes out of `AnimationDirector`; generic tooltip/info panel out of the NIC
   page's `UI.js` into `renderers/three/src/web/`.
5. Component metadata and dataplane stages as data (YAML → JSON) shared with the concept SDK.
6. A 9:16 cut of the NIC film (the overlay needs layout-solved positions).
7. Three.js-baked plates (`abs asset bake --renderer three`) as an alternative to Blender plates.
8. The reference episodes still live in the website repository
   (`_learning/manim-scripts/axiobyte-system`); moving them here is follow-up work.
