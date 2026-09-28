# AxioByte Ecosystem — Migration Audit (Phase 0, revision 2)

*Rev 1 — 2026-09-28: read-only inspection of the three projects.*
*Rev 4 — 2026-09-28: D6 fully decided: interactive pages live at `Ajay3007.github.io/axiobyte/<domain>/<concept>/`, grouped under an AxioByte section, **never** in the personal `projects` collection. nic-3d stops existing as a separate project; its content ends up only in axiobyte-studio and Ajay3007.github.io (§12).*
*Rev 3 — 2026-09-28: D3 decided (voiceover not committed); D6 decided (site stays `Ajay3007.github.io`).*
*Rev 2 — 2026-09-28: revised for **Architectural Correction #2**. AxioByte Studio is a
renderer-agnostic educational video system. Manim, Three.js and Blender are peer backends,
chosen per shot or layer. The website is the AxioByte platform, not a host for standalone apps.*

Nothing in the three repositories has been modified. This file sits next to `role.md`, outside
all three. The Studio's own `ARCHITECTURE.md`, `README.md` and `ROADMAP.md` are **not edited
yet**. The changes they need are listed in §B and will be made as the first commit of Phase 2,
so they go through the Studio's normal review.

---

## A. WHAT CHANGED IN REVISION 2, AND WHY

Each row is an assumption in revision 1 that Correction #2 overturns, plus what replaces it.

| # | Rev 1 assumption | Rev 2 position | Consequence for the migration |
|---|---|---|---|
| **C1** | Three.js was "the web renderer", and NIC's video pipeline was a NIC-specific curiosity that stays a local task outside the Studio's render pipeline (rev 1 R4) | **Three.js is a first-class video backend** with two output targets, **video** (frames, via a manual clock, offscreen or headless) and **web** (the interactive browser experience), over one scene | NIC's `video/` host and `scripts/render.mjs` become the **Three.js video backend** (core, category A), not episode tooling. A Python adapter `backends/three/` lets `abs render` drive it like it drives Manim. |
| **C2** | The JS package was named `web/` (`@axiobyte/web`) and the Python side `backends/web/` | The renderer is **`three`**. `web` is one of its two targets, not its identity. | JS package `renderers/three/` (`@axiobyte/three`) with `src/core`, `src/video`, `src/web`. Python adapter `backends/three/`. |
| **C3** | The episode owned the NIC model, scenes and interactive app (rev 1 category D, inside `episodes/…/web/`) | The 3D NIC is the **visual representation of the Networking/NIC concept**. The NIC video, the NIC interactive page, and future DMA / RSS / DPDK / PCIe material all reuse it. | The NIC model, metadata, presets and networking diagrams move to a **domain library**: `renderers/three/src/domains/networking/`. The episode keeps only what is unique to the film: script, timeline, audio, storyboard score. |
| **C4** | The interactive page was "the NIC web experience", a standalone app published at `/projects/nic/` and shown as a project card | Interactive pages are **representations of concepts on the AxioByte platform**, organised by domain (Networking → NIC, Dataplane → Mempool …) | Interactive entries live in `experiences/<domain>/<concept>/` and are built together in **one multi-page build**, released as **one artifact** and fetched with **one pin**. There is no per-concept pipeline. The proposed URL is domain-shaped (decision D6). |
| **C5** | Renderer choice was implicitly per episode (the Studio's `render/jobs.py` requires `shots/episode.py` with a Manim `StudioScene`), and 3D implied Blender (ARCHITECTURE §8: Tier 2 = baked Blender plates, Tier 3 = live Blender) | **Renderer selection happens per shot, and eventually per layer.** The ladder is **Manim → Three.js → Blender**, with Blender only when its capabilities are needed. | Shots gain a `renderer:` field (default `manim`, so existing episodes are unchanged). The 3D tiers in ARCHITECTURE §8 are rewritten. A minimal **composer** is introduced (the Studio has no `compose/` today). |
| **C6** | The existing Blender `nic_board` plate was a second NIC model to be "unified" later | Per the selection principle, a NIC hero shot is **Three.js territory**, and Blender is not the default. | The Blender NIC plate is **kept** (tests use it, and it proves the Tier-2 path) but is no longer the NIC's canonical 3D form. Future NIC plates can be baked from the Three.js model with the same RGBA plate contract. Nothing gets deleted. |
| **C7** | NIC's film was one monolithic render, and it would stay that way | Episodes are sequences of shots, each rendered by its chosen backend, then composed | **Compatibility adapter first:** the NIC episode is declared as Three.js shots that map to its existing 9 sections (00–08). Each section renders as its own clip with the existing renderer's `--from/--to`, and the composer concatenates them and muxes the voiceover. Later, a Manim shot can replace any section without touching the others. |
| **C8** | Future domains were out of scope | NIC is the **first domain**. Networking and Dataplane topics must not each become their own app architecture. | The directory layout is domain-keyed from day one (`domains/networking/`, later `domains/dataplane/`). The experience build discovers entries by directory, so adding a concept adds a folder, not a pipeline. |
| **C9** | Website = `Ajay3007.github.io`, with NIC at `/projects/nic/` | The website is **the AxioByte learning and interactive-visualisation platform**. **Decided (rev 3): it stays `Ajay3007.github.io`. No rename is planned.** | Experience builds keep the relative `./` base anyway (it costs nothing and is what makes the subpath work). No rename-specific work is done. |

**Unchanged from rev 1:** the incremental order (NIC must still work after each phase), the
verbatim first import, the Python engine left untouched apart from additive changes, the
deploy-by-pinned-release-artifact mechanism (now one artifact for all experiences), and the
asset policy.

---

## B. RENDERER ARCHITECTURE (the part Correction #2 adds)

### B.1 The pipeline, as it will read in ARCHITECTURE.md

```
Concept ─► Narrative ─► Scene ─► Shot ─► Renderer selection ─► Backend ─► Rendered clip/layers ─► Composer ─► Final video
                                  │              │                 ├── manim   (exists)
                                  │              │                 ├── three   (NEW — adapter to renderers/three)
                                  │              │                 └── blender (exists — plates today; live later)
                                  │              └── per shot now; per layer later
                                  └── cue-anchored time (unchanged: THE ONE RULE)
```

### B.2 What exists vs what is added (smallest change that makes the principle real)

| Piece | Today in the Studio | Added in this migration | Deferred |
|---|---|---|---|
| Shot → renderer | Implicit: an episode = one Manim `shots/episode.py` | `renderer:` on a shot in `storyboard/beats.yaml` / shot list. **Default `manim`**, so s01e01 and s01e02 are byte-for-byte unaffected. `abs plan` validates the value against registered backends. | A per-layer `layers: [{renderer: three}, {renderer: manim, role: overlay}]` |
| Backend protocol | Manim scene generation in `render/jobs.py`; Blender bake in `backends/blender/` | A small `Backend` protocol (`name`, `capabilities()`, `render_shot(plan, shot, target) → clip`) with Manim wrapped behind it unchanged and `three` implemented as a subprocess call to `renderers/three` tooling | Blender *live* (ROADMAP Phase 3), unchanged |
| Three.js video | none | `renderers/three/src/video` (from NIC `video/`) plus `renderers/three/tools/render.mjs` (from NIC `scripts/render.mjs`, parameterised by entry and time range) | Driving Three.js directly from Shot IR. Today the Three.js score is hand-authored JS (`storyboard.js`). |
| Composer | none (ARCHITECTURE subsystem 14 is planned, not built) | `abs compose <episode>`: ffmpeg concat of per-shot clips in cue order, plus the episode voiceover mux. That is exactly what NIC's `render-full.sh` does today, generalised. | Layer stacking with alpha and depth, transitions, LUT |
| Import contracts | `manim`/`bpy` forbidden outside `backends/` | No Python import of JS is possible anyway. The Three.js adapter lives under `backends/three/` and shells out, so contract 3's layer stack is untouched. | — |
| Plates | Blender → RGBA sequence → Manim `plates` actor | Nothing now. Noted as possible: the Three.js renderer already clears to alpha, so it can emit the same plate format. | `abs asset bake --renderer three` |

### B.3 Renderer selection rule (goes into ARCHITECTURE §8, replacing "3D = Blender tiers")

1. **Manim** if the shot is diagrammatic, typographic, or Tier-1 isometric.
2. **Three.js** if it needs real 3D (lit hardware, orbiting cameras, depth, many instanced
   parts), or if the same scene also serves an interactive web representation.
3. **Blender** only for what Three.js cannot reasonably do: path-traced light, physically
   accurate DOF, heavy particles/volumes, film-grade materials. A Blender shot must state the
   reason in the shot definition. `abs plan` warns when it's missing.

### B.4 Three.js: one scene, two targets

```
renderers/three/src/core        Engine (raf | manual clock), CameraManager, Tweens, Lighting, Stage,
                                ComponentRegistry, Highlighter, FlowAnimator, hardware Kit + parts,
                                TimelineParser
        ├── src/video           manual clock · CameraDirector · AnimationDirector · Compositor ·
        │                       Overlay + generic widgets · DebugOverlay · VideoApp host
        │                       → tools/render.mjs → frames → ffmpeg → clip   (VIDEO TARGET)
        └── src/web             OrbitControls shell · InteractionManager · tooltip / info panel
                                → Vite multi-page build → static site      (WEB TARGET)
renderers/three/src/domains/networking
                                nic/ (model, metadata, presets, actions, signal paths)
                                dataplane.js (stages, RX/TX paths) · widgets/ (RSS, DMA, ring,
                                DPDK, PHY, duplex, PAM-16 …)
```

Both targets build the scene through the same world factory, like NIC's `nicWorld.js` already
does. Nothing is duplicated. That shared factory is the proof that the principle already works
in the NIC code.

---

## 0. The short version (rev 2)

| | Finding |
|---|---|
| **The biggest fact** | The Studio is a **Python** engine whose render pipeline is **bound to Manim per episode**. NIC-3D is a **JavaScript Three.js** app that already contains a working **deterministic Three.js video renderer**. Correction #2 turns that renderer into the Studio's second video backend. |
| **Shared contracts already present** | NIC's `timeline.json` has the **same WhisperX schema** as the Studio's `words.json`. Both treat the voiceover as the master clock and fail loudly on missing cues. |
| **Base-path risk** | Close to zero. The NIC is fully procedural (no GLB, textures, shaders, workers, WASM, `fetch`, or dynamic imports), and a `./` build served under a subpath loads every asset (verified). |
| **Studio health** | 471 tests pass run serially. `-n auto` hits a pre-existing Manim text-cache race (3–5 tests). |
| **Deploy** | A Studio CI build of **all** interactive experiences produces one versioned Release asset. The website pins the version and mounts it at build time. No secrets, no committed build output. |

---

## 1. CURRENT STATE

### 1.1 axiobyte-studio — `Ajay3007/axiobyte-studio` (public, `main`, clean, up to date)

- **Language / build:** Python ≥3.12, hatchling, `src/` layout, `axiobyte_studio` v0.1.0. CLI `abs`
  (`plan | render | storyboard sheet | new episode | asset bake | timeline drift | concept | targets`).
- **Gate (CI ubuntu + windows):** ruff, ruff format, mypy --strict, lint-imports (3 contracts), pytest.
- **Semantic layer** (renderer-free): concepts, actors, actions, timeline/cues, layout, storyboard,
  design tokens and themes, motion.
- **Backends:** `manim/` (primary; shapes incl. NIC, iso Tier-1, plates actor), `blender/`
  (Tier-2 bake, including a procedural `nic_board`), `svg/` (layout previews).
- **Renderer binding (important for C5):** `render/jobs.py` requires `episodes/<id>/shots/episode.py`
  defining Manim `StudioScene` subclasses and derives scene names from `backends.manim`. There is
  **no shot-level renderer field and no `compose/` package**.
- **Concepts already present for this domain:** `nic`, `nic_queue`, `packet`, `mbuf`, `mempool`,
  `worker_core`, `cpu`, `pointer`, `dma`, `polling`, `interrupt_driven`, `zero_copy`,
  `copy_based`, `dpdk_rx_pipeline`. **Missing:** `rss`, `pcie`, `descriptor_ring`, `phy`,
  `magnetics`, `doorbell`, `ethernet`.
- **Episodes:** `s01e01-kernel-slow`, `s01e02-zero-copy` (both Manim, both `assumed: [..., nic]`).
- **Assets:** `assets/plates/nic_board__turntable@1.0.0` (Blender, 16 frames). It is used by the
  Manim `plates` actor and tests, **not by any episode**.
- **Working model:** two machines, one at a time, directly on `main` (CLAUDE.md).
- **External coupling:** the reference episodes are read from
  `Ajay3007.github.io/_learning/manim-scripts/axiobyte-system`.

### 1.2 nic-3d (not a git repo)

- Vite 8 + three 0.186 + puppeteer-core. 8,139 lines of JS, **no tests**.
- **One world, two front ends.** `scenes/nicWorld.js` is shared by:
  - **Interactive:** `index.html → main.js → app.js`, OrbitControls, picking, info panel,
    5 presets, heatsink lift, `__AXIOBYTE__` API. This is the only production-build entry.
  - **Video:** `video.html → video-main.js → video/VideoApp.js`. A manual clock renders
    deterministic 1920×1080 frames, and `scripts/render.mjs` feeds Chrome's frames to ffmpeg to
    produce an 11:59 MP4 with the voiceover muxed in. It supports `--from/--to`, `--headless`,
    `--warmup` (seamless segments), stills, and contact sheets. `check-determinism.mjs` shows
    byte-identical frames across browser sessions.
- **Layering:** `engine → hardware(parts, nic) → interaction → concepts(dataplane) → animation → scenes → ui | video`.
- **Portability defects:** a hardcoded `/Users/...` root in `scripts/check-determinism.mjs:13`,
  and a root-relative `/content/nic/voiceover.mp3` in `video.html` (dev only).
- **Sizes:** renders 495 MB, stills about 40 MB, voiceover master 11.6 MB (+ derived mp3
  11.5 MB), raw takes 11.5 MB, timeline data 0.6 MB, build 0.7 MB.
- **Secrets:** none found.

### 1.3 Ajay3007.github.io (public, `master`, clean)

- **Astro 7 in production.** The Jekyll cutover is done, but the repo `CLAUDE.md` still says
  Jekyll. It is a user site at the root with no `base`, `trailingSlash: 'always'` and directory
  format.
- `deploy.yml`: validate → astro check → build → pagefind → **check-links (every internal link
  must resolve in `dist/`)** → deploy-pages. `astro-ci.yml` runs the same checks on PRs.
- **The platform already has the documentation arm:** a `concepts` collection served under
  `/learning/<domain>/…`, e.g. `/learning/data-plane/dpdk/`, plus `/learning/networking/…`.
  There is also a `projects` collection (`demo` field) and the tracks and editorials collections.
- Engine source still lives here: `_learning/manim-scripts/axiobyte-system/ep01, ep02`.

---

## 2. TARGET STATE (rev 2)

```
axiobyte-studio/
├── src/axiobyte_studio/                      Python engine — unchanged except additive:
│   ├── concepts/library/…                    + rss, pcie, descriptor_ring, phy, magnetics, doorbell, ethernet
│   ├── backends/
│   │   ├── manim/        (unchanged, wrapped behind the Backend protocol)
│   │   ├── blender/      (unchanged)
│   │   └── three/        NEW  thin adapter: plan/shot → renderers/three/tools/render.mjs → clip
│   ├── render/           + shot-level renderer dispatch (default manim)
│   └── compose/          NEW  minimal: concat clips in cue order + voiceover mux
│
├── renderers/three/                          NEW  @axiobyte/three  (npm workspace)
│   ├── src/core/         engine · camera · tween · lighting · stage · registry · highlight ·
│   │                     flow animator · hardware kit + parts · timeline parser
│   ├── src/video/        VIDEO TARGET: directors · compositor · overlay + generic widgets · host
│   ├── src/web/          WEB TARGET: interactive shell · picking · tooltip/info panel
│   ├── src/domains/
│   │   └── networking/   nic/ (model, metadata, presets, actions, signal paths),
│   │                     dataplane.js, widgets/ (RSS, DMA, ring, DPDK, PHY, duplex, PAM-16…)
│   ├── tools/            render.mjs · check-determinism.mjs · prepare-audio.mjs
│   └── test/             vitest (pure modules) + subpath smoke test
│
├── experiences/                              NEW  interactive representations, one multi-page build
│   ├── package.json · vite.config.js         discovers experiences/*/*/index.html
│   └── networking/
│       └── nic/          index.html + main.js + app.js (thin: domain world + web target)
│
└── episodes/
    ├── s01e01-kernel-slow/                   unchanged (Manim)
    ├── s01e02-zero-copy/                     unchanged (Manim)
    └── s01e03-what-is-a-nic/                 NEW (id: decision D1)
        ├── episode.yaml   picture.md   script.md
        ├── audio/voiceover.mpeg  (gitignored — local input, hash pinned in episode.yaml)
        ├── timeline/      words.json · analysis.json · captions.srt
        ├── storyboard/    beats.yaml   (the 00–08 sections as shots, renderer: three)
        ├── three/         video.html · video-main.js · storyboard.js (the score)
        └── out/           (ignored) clips, final mp4, stills

Ajay3007.github.io/
├── axiobyte.json                             pin: { release tag, asset, sha256 }
├── scripts/fetch-axiobyte.mjs                download → verify → extract into public/axiobyte/ (gitignored)
├── src/pages/axiobyte/index.astro            AxioByte hub, rendered in site style from the bundle's manifest.json
├── src/pages/axiobyte/[domain]/index.astro   domain index (Networking, later Dataplane …)
│                                             each concept card: interactive ↔ video ↔ /learning docs
└── public/axiobyte/<domain>/<concept>/       (fetched, not committed) the interactive pages themselves
                                              NOT in src/content/projects: AxioByte is not a personal project
└── .github/workflows/deploy.yml, astro-ci.yml   + one fetch step after `astro build`
```

---

## 3. COMPONENT CLASSIFICATION (rev 2)

**A** core renderer infrastructure · **B** domain library (semantic in Python, visual in
`domains/`) · **C** NIC episode (film only) · **D** interactive representation (thin entry) ·
**E** raw source · **F** generated. `R3` = `renderers/three`, `EP` = `episodes/s01e03-what-is-a-nic`,
`X` = `experiences/networking/nic`.

### 3.1 Core: `@axiobyte/three`

| Component | Current (nic-3d) | Destination | Class | Target | Risk |
|---|---|---|---|---|---|
| Engine (raf/manual clock, view shift, env lighting) | `src/engine/Engine.js` | `R3/src/core/Engine.js` | A | both | L |
| CameraManager | `src/engine/CameraManager.js` | `R3/src/core/` | A | both | L |
| Tweens/Ease, Lighting, Stage, textures, geometry, rng, dispose | `src/engine/*` | `R3/src/core/` | A | both | L |
| ComponentRegistry, Highlighter | `src/interaction/{ComponentRegistry,Highlighter}.js` | `R3/src/core/` | A | both | L |
| InteractionManager (picking) | `src/interaction/InteractionManager.js` | `R3/src/web/` | A | web | L |
| PacketAnimator → FlowAnimator (alias kept) | `src/animation/PacketAnimator.js` | `R3/src/core/` | A | both | L |
| LedController, Kit, materials, parts/* | `src/animation/LedController.js`, `src/hardware/{Kit,materials}.js`, `src/hardware/parts/*` | `R3/src/core/hardware/` | A | both | L |
| TimelineParser | `src/video/TimelineParser.js` | `R3/src/core/timeline/` | A | video (web can use it for narrated tours later) | L |
| VideoDirector, CameraDirector, Compositor, VideoApp, DebugOverlay | `src/video/*` | `R3/src/video/` (VideoApp takes a world factory, a storyboard and a timeline instead of importing NIC) | A | video | M |
| AnimationDirector | `src/video/AnimationDirector.js` | generic keyframe lanes → `R3/src/video/`; heatsink/zone lanes become callbacks provided by the domain | A + B | video | M |
| Overlay core + titles/callouts/captions/flow widgets | `src/video/overlay/**` | `R3/src/video/overlay/` | A | video | M |
| Offline renderer, determinism check, audio prep, segmented render | `scripts/*.mjs`, `render-full.sh` | `R3/tools/` (entry URL, time range and output passed in; the hardcoded path goes away) | A | video | M |
| Generic parts of the UI (tooltip, info panel, preset bar) | `src/ui/UI.js`, `styles.css` | Phase 4: `R3/src/web/ui/`. Phase 2 keeps them with the experience. | A | web | M |

### 3.2 Domain library: Networking

| Component | Current | Destination | Class | Risk |
|---|---|---|---|---|
| NIC model (layout, PCB, traces, RJ45, heatsink, chips, bracket, PCIe, silkscreen, zones, components) | `src/hardware/nic/*` | `R3/src/domains/networking/nic/` | B | L |
| Component metadata (educational text) | `src/hardware/nic/metadata.js` | same folder. Phase 4: data (YAML → JSON) shared with docs and video. | B | L |
| NIC world + scene (presets, resolvers, heatsink action) | `src/scenes/{nicWorld,nicScene}.js` | `R3/src/domains/networking/nic/world.js`, `scene.js` | B | L |
| Signal paths over board routing | `src/video/scene/SignalPaths.js` | `R3/src/domains/networking/nic/` | B | L |
| Dataplane stages / RX / TX paths | `src/concepts/dataplane.js` | `R3/src/domains/networking/dataplane.js`. Phase 4: generated from concept YAML. | B | M |
| RSS / DMA / ring / DPDK / comparison / stack diagrams | `src/video/overlay/widgets/dataplane.js` | `R3/src/domains/networking/widgets/` | B | M |
| Duplex / 8P8C / PAM-16 / isolation / DSP / offload diagrams | `src/video/overlay/widgets/diagrams.js` | `R3/src/domains/networking/widgets/` | B | M |
| New concept YAMLs | — | `src/axiobyte_studio/concepts/library/` | B | M |

### 3.3 NIC episode: the film only

| Component | Current | Destination | Class | Risk |
|---|---|---|---|---|
| Storyboard score | `src/video/storyboard.js` | `EP/three/storyboard.js` | C | L |
| Video page + entry | `video.html`, `src/video-main.js`, `src/video/video.css` | `EP/three/` (video.css → `R3/src/video/` if generic) | C | L |
| Section → shot table | inside `storyboard.js` | `EP/storyboard/beats.yaml` (9 shots, `renderer: three`, cue-anchored) | C | M |
| Script, timeline, analysis, captions | `scripts/nic-video-script.md`, `nic-voiceover.txt`, `content/nic/timeline.json`, `analysis.json`, `.srt`, `.csv` | `EP/script.md`, `EP/timeline/…` (CSV dropped as derivable) | C | L |
| Voiceover master | `content/nic/voiceover.mpeg` | `EP/audio/voiceover.mpeg`, **gitignored**. `episode.yaml` records its sha256 and duration. | E | L |
| Production prompts | `content/nic/role.md`, `claude_prompt.md` | `EP/notes/` (D4) | C | L |

### 3.4 Interactive representation

| Component | Current | Destination | Class | Risk |
|---|---|---|---|---|
| HTML shell + entry + app wiring | `index.html`, `src/main.js`, `src/app.js` | `X/` (~150 lines: builds the domain world, attaches the web target) | D | L |
| UI + styles | `src/ui/UI.js`, `src/styles.css` | `X/` in Phase 2 → `R3/src/web/ui/` in Phase 4 | D → A | M |
| Favicon, Vite config | `public/favicon.svg`, `vite.config.js` | `experiences/` (one multi-page config, `base: './'`) | D | L |
| Standalone Pages workflow | `.github/workflows/deploy.yml` | dropped | — | L |

### 3.5 Raw source and generated files (unchanged from rev 1)

| Component | Current | Treatment |
|---|---|---|
| Raw takes | `voiceovers/nic3d/*.mpeg` | not committed (E) |
| Renders, previews | `final/*.mp4` | never committed (F) → `EP/out/` |
| Stills | `final/stills/*.png` | never committed (F) → `EP/out/` |
| Browser mp3 | `content/nic/voiceover.mp3` | derived (F) → `EP/out/` |
| Build output, deps | `dist/`, `node_modules/` | not committed (F) |

---

## 4. MIGRATION MAP (rev 2)

Commit 1 is still a **verbatim import**, now into a quarantine path
`episodes/s01e03-what-is-a-nic/_import/`. Every later move is a `git mv` in its own commit, so
`git log --follow` reaches the import.

```
nic-3d/src/engine/**                      → renderers/three/src/core/
nic-3d/src/interaction/{Registry,Highlighter} → renderers/three/src/core/
nic-3d/src/interaction/InteractionManager → renderers/three/src/web/
nic-3d/src/animation/**                   → renderers/three/src/core/(hardware/)
nic-3d/src/hardware/{Kit,materials,parts} → renderers/three/src/core/hardware/
nic-3d/src/hardware/nic/**                → renderers/three/src/domains/networking/nic/
nic-3d/src/scenes/**                      → renderers/three/src/domains/networking/nic/
nic-3d/src/concepts/dataplane.js          → renderers/three/src/domains/networking/
nic-3d/src/video/{TimelineParser}         → renderers/three/src/core/timeline/
nic-3d/src/video/{directors,Compositor,VideoApp,DebugOverlay,overlay core,generic widgets}
                                          → renderers/three/src/video/
nic-3d/src/video/overlay/widgets/{diagrams,dataplane}.js → renderers/three/src/domains/networking/widgets/
nic-3d/src/video/scene/SignalPaths.js     → renderers/three/src/domains/networking/nic/
nic-3d/src/video/storyboard.js, video-main.js, video.html → episodes/s01e03-what-is-a-nic/three/
nic-3d/index.html, src/{main,app}.js, src/ui, src/styles.css → experiences/networking/nic/
nic-3d/scripts/*.mjs, render-full.sh      → renderers/three/tools/
nic-3d/content/nic/*, scripts/nic-video-script.md → episodes/s01e03-what-is-a-nic/{timeline,audio,notes,script.md}
nic-3d/voiceovers/, final/, dist/, node_modules/, .github/ → not migrated
```

**The order keeps NIC working at every step.** Phase 2 moves files but leaves the module graph
intact (import paths rewritten mechanically). Phase 3 adds the adapters (backend, composer,
episode manifest). Phase 4 generalises signatures (VideoApp taking a world factory, etc.).
Before and after each Phase 4 commit, the determinism check's six SHA-256 hashes must match.

**Old nic-3d:** untouched during the migration, with a tar.gz snapshot taken in Phase 1. It stops being a project: once every item in §12 is confirmed in its new home, the folder is retired (deleting it is your call). Nothing of it remains separate.

---

## 5. PHASE PLAN (rev 2)

| Phase | Work | Verification |
|---|---|---|
| **1 Safety** | Tags `pre-nic-migration` (Studio) and `pre-axiobyte-experiences` (site). Short branches per D2. nic-3d tar.gz snapshot. Nothing is pushed without your go. | clean `git status`; the snapshot lists |
| **2 Integrate** | (a) **Docs commit first:** ARCHITECTURE §1/§2/§3/§8 and README updated for the renderer-agnostic model (§B above). (b) Verbatim import. (c) `git mv` into `renderers/three`, `experiences/networking/nic`, and `EP`; rewrite import paths; npm workspaces root; `.gitignore`. | Interactive page builds and runs; `render.mjs --stills` for 3 timestamps matches pre-migration stills; determinism hashes; Python gate still 471 passed |
| **3 Adapters** | `renderer:` on shots (default `manim`) + `abs plan` validation; `Backend` protocol with Manim wrapped; `backends/three/` adapter; minimal `abs compose`; NIC `episode.yaml` + `picture.md` + `beats.yaml` (9 Three.js shots); new concept YAMLs; `abs render EP` → 9 clips → composed MP4. | s01e01/s01e02 `abs plan` and `abs render --still` unchanged (goldens untouched); the NIC composed MP4 matches the monolithic render in duration and frame count, with a spot-check of frames at section boundaries |
| **4 Extract** | Generalise VideoApp / AnimationDirector / UI; FlowAnimator naming; vitest for pure modules; metadata and dataplane to data. | Determinism hashes identical; unit tests; interactive smoke test at a subpath |
| **5 Website** | `axiobyte.json` pin; `fetch-axiobyte.mjs` (also supports `AXIOBYTE_LOCAL=<path to a local experiences build>` for offline dev); `/axiobyte/` hub and `/axiobyte/networking/` domain pages generated from the bundle manifest; one nav entry "AxioByte"; workflow steps; `.gitignore` for `public/axiobyte/`. **No** `projects` collection entry. | `npm run verify` green; `dist/` file list of existing pages unchanged; link check green |
| **6 CI/CD** | Studio `three.yml`: vitest + experiences build + subpath smoke on push; on tag `experiences-v*`, publish the release asset. Optional auto-bump PR (needs a PAT, D5). | Workflow green; the site CI fetches the pinned release |

---

## 6. ASSET STRATEGY (unchanged)

No binary web assets (everything is procedural). No LFS, no object storage. Renders are never
committed. The Blender plate stays as it is (C6).

**Voiceover (D3, decided in rev 3): not committed.** Checked against the repo:

- Neither existing episode commits audio. Both declare `voiceover: "timeline/words.json"`, and
  no Studio code reads an audio file. **Timing comes only from `words.json`**, which *is*
  committed.
- Everything except the final soundtrack works without the audio: `abs plan`, cue resolution,
  storyboards, every video frame (`render.mjs --no-audio`), stills, the determinism check, the
  interactive site, and CI.
- The audio is needed in exactly two places, both local and both on the Mac: the audio mux in
  `abs compose`, and playback in the video preview page.

So: `EP/audio/voiceover.mpeg` is **gitignored**. `episode.yaml` records
`audio: { path: audio/voiceover.mpeg, sha256: …, duration: 717.99 }`. `abs compose` fails with an
actionable message if the file is missing or its hash differs from the one `words.json` was
transcribed from. That is the same fail-loud rule as cues, and it catches a re-recorded take
that was never re-transcribed.

Backup: the file stays in the preserved `nic-3d/content/nic/` folder. It can optionally be
attached to a GitHub Release later, but that makes it public, which is fine once the video is on
YouTube anyway. Nothing is uploaded without your say.

---

## 7. DEPLOYMENT PLAN (rev 2)

```
axiobyte-studio   .github/workflows/three.yml
  push / PR (renderers/three/**, experiences/**)  → npm ci · vitest · vite build (all experiences)
                                                    · serve dist under /a/b/ and smoke-test each entry
  tag experiences-vX.Y.Z                           → same, then tar → axiobyte-experiences-X.Y.Z.tar.gz
                                                    + sha256 → gh release (GITHUB_TOKEN, contents: write)
          │ (public repo, so an anonymous download works)
          ▼
Ajay3007.github.io   axiobyte.json { tag, asset, sha256 }
  deploy.yml / astro-ci.yml:  node scripts/fetch-axiobyte.mjs → public/axiobyte/   (before the build, so the
                              hub pages can read manifest.json)
                              → astro build → pagefind → check-links → deploy
  result:  /axiobyte/  ·  /axiobyte/networking/  ·  /axiobyte/networking/nic/
```

- **One artifact for all experiences.** Adding the DMA or Mempool interactive page adds a folder
  under `experiences/`. There is no new workflow, pin or fetch step.
- **Videos are not deployed through this path.** Final MP4s are publishing output (YouTube, or a
  Release asset). The website embeds or links them.
- **Versioning:** the engine uses `pyproject` semver (`vX.Y.Z` tags). `@axiobyte/three` has its
  own `package.json` version. The experiences bundle uses `experiences-vX.Y.Z` tags (starting at
  `1.0.0`, carrying NIC's existing `1.0.0`). Episodes pin the engine version in `episode.yaml`,
  per CONVENTIONS §7.
- **Site name:** stays `Ajay3007.github.io` (D6). No rename work is planned. The pin file, fetch script and workflow step are portable to a
  new repo as is. The relative base means no rebuild. Old URLs can get Astro `redirects` entries.
- **Secrets:** none for the default path. Optional auto-bump needs a fine-grained PAT (website
  repo only; Contents + Pull requests read/write) stored as `SITE_REPO_TOKEN`. That is only
  needed if you choose it.

---

## 8. RISKS (rev 2)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Two languages. Semantic sharing is **data, not code** (concept YAML, words.json, tokens, metadata). Shot IR → Three.js is future work. | High (expectation) | Stated in ARCHITECTURE; a JSON export in Phase 4 |
| R2 | Studio's "direct on `main`" model vs a migration branch | Medium | Short branch through Phase 3 (D2) |
| R3 | **Three.js video in CI.** Headful Chrome with a GPU is what gives production speed (~31 fps). `--headless` (SwiftShader) works but is far slower, and ffmpeg is needed. | Medium | CI checks determinism on a few frames headless. Full renders stay local, the same policy as Blender. |
| R4 | **Composer correctness.** Concatenating per-shot clips must not introduce drift or seams. | Medium | The existing `--warmup` gives seamless segment joins (already proven by `render-full.sh`). Cut points go on cue times in pauses (`TimelineParser.gapAfter`). Frame count is compared to the monolithic render. |
| R5 | **Renderer dispatch touches `render/jobs.py`**, which the Manim goldens depend on | Medium | Default `manim`. No change to Manim code paths; goldens must stay byte-identical, and no `UPDATE_GOLDEN`. |
| R6 | Two palettes (NIC `theme.js` vs `themes/systems.yaml`), and mixed-renderer episodes make a mismatch visible **within one video** | Medium (↑ from rev 1) | Phase 4 generates JS tokens from YAML, mapped 1:1 to NIC's current values. Reconciling them is a visual change for Mac sign-off. |
| R7 | Blender NIC vs Three.js NIC | Low | C6: Three.js is canonical for NIC. The Blender plate is kept and not extended. |
| R8 | `abs plan` schema changes (`renderer`, `three/` score, no `shots/episode.py` for all-Three.js episodes) | Medium | Explicit schema tests. Manim episodes keep their current requirement. |
| R9 | Reference episodes live in the website repo | Medium, pre-existing | Not moved now; follow-up |
| R10 | Website `CLAUDE.md` is stale | Low | Fixed in Phase 5 |
| R11 | xdist Manim cache race | Low, pre-existing | Report only |

---

## 9. DOCUMENTATION CHANGES (planned, made during Phase 2)

| Document | Change |
|---|---|
| Studio `README.md` | Opening: "renderer-agnostic educational video system; Manim, Three.js and Blender are backends". Status table: + Three.js backend, + compose. Adds the website relationship. |
| Studio `ARCHITECTURE.md` | §1 backend box → `manim/ · three/ · blender/ · svg/`, with the per-shot/layer selection note. §2 subsystem 12 lists the three backends; subsystem 14 marked minimal-v0. §3 folder tree adds `renderers/three`, `experiences/`, `backends/three`, `compose/`. **§8 rewritten** from "Blender + Manim 3D tiers" to "Renderer selection" (B.3), with the Three.js video/web targets (B.4). §8.4 "adding a renderer" gets Three.js as its worked example. |
| Studio `ROADMAP.md` | Tier-2/Tier-3 items reframed: 3D hero shots default to Three.js. Blender live becomes an optional specialist phase. |
| Studio `CONVENTIONS.md` | JS conventions for `renderers/three` (ESM, no wall-clock reads in video code, relative asset URLs only). `renderer:` naming. |
| New | `renderers/three/README.md`, `experiences/README.md`, `EP/README.md`, `docs/deployment.md`, `MIGRATION.md` |
| Website | `CLAUDE.md` refreshed for Astro, plus a section on AxioByte experience mounting |

---

## 10. DEBT DELIBERATELY LEFT FOR LATER

1. Shot IR → Three.js without a hand-authored score. The NIC storyboard keeps `W()/S()/E()` JS cues.
2. Per-layer multi-renderer shots (a Three.js background plus a Manim overlay in one shot) need
   alpha/depth compositing in `compose/`.
3. Palette reconciliation (R6).
4. Three.js-baked plates (`abs asset bake --renderer three`).
5. Reference episodes out of the website repo (R9).
6. 9:16 NIC cut (the overlay is absolute 1920×1080).
7. Concept documentation generated from concept YAML into the website (the "Documentation" arm).

---

## 11. DECISIONS I NEED FROM YOU (rev 2)

| # | Decision | Recommendation |
|---|---|---|
| D1 | NIC episode ID | `s01e03-what-is-a-nic` (NIC is a prerequisite of s01e02; `s00e01-what-is-a-nic` is the alternative) |
| D2 | Branching | Short `feat/renderer-agnostic-nic` branch through Phase 3, then `main` |
| D3 | Voiceover storage | ✅ **Decided: not committed.** Gitignored and hash-pinned (§6) |
| D4 | NIC prompt files | Keep in `EP/notes/` |
| D5 | Deploy automation | Release + pin now; auto-bump PR later |
| **D6** | Website repo and URL | ✅ **Decided.** Repo stays `Ajay3007.github.io`. Interactive pages live at `/axiobyte/<domain>/<concept>/`; NIC is at **`/axiobyte/networking/nic/`**. All AxioByte pages are grouped under `/axiobyte/` and never listed as personal projects. |
| **D7** *(new)* | Where the renderer-agnostic doc changes land | As the first commit of Phase 2 in the Studio repo (recommended), or now as a separate docs-only PR before any code moves |

---

## 12. WHERE EVERY PART OF nic-3d ENDS UP (rev 4)

nic-3d is not kept as a project, a repo, a package name or a URL. Each part has exactly one home,
chosen by use.

| Use | Home | What goes there |
|---|---|---|
| **Making things** (engine, 3D model, video renderer, film, interactive source) | **axiobyte-studio** | `renderers/three/` (core, video, web, `domains/networking/nic`), `experiences/networking/nic/` (interactive entry), `episodes/s01e03-what-is-a-nic/` (script, timeline, storyboard score, notes; audio gitignored) |
| **Showing things** (the public interactive page, AxioByte hub, links to video and docs) | **Ajay3007.github.io** | Only the pin file, the fetch script, the `/axiobyte/` hub and domain pages, and a nav entry. The built NIC page arrives at deploy time from the pinned release and is never committed. |
| **Neither** | nowhere (stays in the retired folder / snapshot) | raw voiceover takes, rendered MP4s and stills, `dist/`, `node_modules/`, the standalone `deploy.yml` |

Names that disappear: the `nic-3d` package name (it becomes `@axiobyte/three` plus the
`experiences` workspace), the standalone GitHub Pages workflow, and the `/nic-3d/` and
`/projects/nic/` URL ideas.

*Assumption:* "axiobyte-system" in your message means the **axiobyte-studio** repository
(`Ajay3007/axiobyte-studio`). `axiobyte-system` is otherwise only the name of the reference-episode
folder inside the website repo (`_learning/manim-scripts/axiobyte-system`), and nothing from
nic-3d goes there.

---

**Status: Phase 0 (rev 2) complete. Nothing has been migrated.** I'm waiting for
**"Proceed with the migration"** and answers to D1–D7. Defaults are the recommendations above.
