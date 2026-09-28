# `@axiobyte/three` — the Three.js backend

One of AxioByte Studio's three peer renderers (Manim, Three.js, Blender — chosen **per shot**,
[`ARCHITECTURE.md`](../../ARCHITECTURE.md) §8.0a). It has **two targets over one scene**:

```
src/core     engine (raf | manual clock) · CameraManager (presets, resolvers, exact frustum fit) ·
             Tweens (host-injected clock) · Lighting · Stage · ComponentRegistry · Highlighter ·
             PacketAnimator (flow tokens, seekable routes) · hardware kit (Kit, materials, parts/,
             LedController) · timeline/TimelineParser
   ├── src/video   VIDEO target — deterministic frames: VideoApp host, VideoDirector,
   │               CameraDirector, Compositor, 2D overlay + generic widgets, DebugOverlay
   │               → tools/render.mjs → ffmpeg → a clip per shot            (abs render)
   └── src/web     WEB target — InteractionManager (picking), shell styles
                   → experiences/<domain>/<concept>/ → the public site     (abs web build)

src/domains/<domain>/   the visual library of a domain, used by BOTH targets
   networking/          dataplane.js (RX/TX stages, independent of any model)
                        nic/ (the NIC model, world, scene, animation lanes, signal paths,
                              video scene) · widgets/ (RSS, DMA, ring, DPDK, PHY, PAM-16 …)
```

Layering is one-directional: `core` imports nothing else here; `video` and `web` import `core`;
a domain may import all three; nothing here imports an episode or an experience.

## The two targets share one world

A domain exposes a **world factory** — `domains/networking/nic/world.js` — and both targets
build through it: the interactive page adds OrbitControls, picking and the info panel; the video
target (`nic/video.js`) adds signal paths and animation lanes and drives it all from a
storyboard. One model, one set of camera presets, one packet system, no duplication.

## Determinism — the video target's hard rule

`renderFrame(i)` is a pure function of `i`. Nothing in the video target reads `Date.now()` or
`performance.now()`:

- `Tweens` has no clock of its own; the host pushes time in (realtime: `performance.now()`;
  renderer: `videoTime × 1000`).
- `Engine` runs on a **manual clock** (`engine.stepTo(t, { dt: 1/30 })`).
- Camera pose is computed from the shot list, not integrated; highlights go through
  `Highlighter.setLevels()`; packets use `PacketAnimator.buildRoute(...).seek(u)`.
- A segment that starts mid-film warms up (`--warmup`, default 45 frames), so a shot rendered on
  its own is frame-for-frame the stretch of a whole-film render. That is what makes per-shot
  rendering and composition seamless.

```bash
node renderers/three/tools/check-determinism.mjs --episode episodes/s01e03-what-is-a-nic \
  --expect episodes/s01e03-what-is-a-nic/three/determinism.baseline
```

renders the same frames in two browser sessions and compares SHA-256s — and, with `--expect`,
against the committed baseline (recorded on the Mac; another GPU stack may hash differently).

## Tools

| Tool | What it does |
|---|---|
| `tools/render.mjs --episode <dir>` | frames → ffmpeg. `--from/--to` (a shot), `--stills`, `--sheet auto`, `--probe`, `--headless`, `--no-audio`. Output: `<episode>/out/`. |
| `tools/preview.mjs --episode <dir>` | live preview with HUD and voiceover (`abs preview <episode>`) |
| `tools/check-determinism.mjs --episode <dir>` | two-session byte comparison, optional `--expect` baseline |
| `tools/prepare-audio.mjs --episode <dir>` | stream-copies the voiceover to a browser-playable mp3 in `out/` |
| `tools/render-full.sh <episode>` | a whole single-renderer film in two segments + audio (the quick path; `abs compose` is the general one) |

The Studio drives these through `backends/three/` — `abs render` calls `render.mjs` once per shot
window. They need Node ≥ 20.19, Chrome/Chromium (`PUPPETEER_EXECUTABLE_PATH` to override), and
ffmpeg for video.

## Performance notes (from the NIC)

- Passives are batched into `InstancedMesh`es, one per sub-part per package; geometries and
  materials are cached per build in `Kit`; traces merge into one mesh. The NIC is ~187 draw calls.
- Picking runs at most once per frame, only after the pointer or camera moves.
- `prefers-reduced-motion` makes camera moves instant and keeps LEDs steady.

## Adding a model to a domain

1. Build it from `core/hardware/parts` inside `domains/<domain>/<device>/`, using a `Kit`.
2. Return `{ root, components: [{ id, object, meta, anchors }] }` — the `ComponentRegistry`
   contract (`id`, `meta`, hit meshes, bounds for framing, named anchors like `in`/`out`/`dma`).
3. Add a `world.js` that registers the components and defines camera presets.

Hover, selection, the info panel, camera focus and packet animation then work unchanged. For
video, add a `video.js` scene next to it (see `networking/nic/video.js`); for the web, add an
entry under `experiences/`.

```bash
npm test -w @axiobyte/three     # vitest: pure modules, no browser
```
