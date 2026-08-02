# AxioByte Studio — Architecture

**Status:** proposed, awaiting approval · **Version:** 0.1 (draft) · **Author:** Lead Architect
**Companion documents:** [`CONCEPT-ARCHITECTURE.md`](CONCEPT-ARCHITECTURE.md) (**the semantic layer above this one** — concepts, actors, actions, grammar) · [`CONVENTIONS.md`](CONVENTIONS.md) (coding + naming standards) · [`ROADMAP.md`](ROADMAP.md) (phased implementation)

> **Scope note.** This document describes layers **L2–L1**: the Shot IR, the layout and format
> system, assets, backends, rendering, and composition. It answers *how a described shot becomes
> pixels*. What a shot should contain, and why — concepts, actors, actions, motion, camera, and the
> educational grammar that connects them — is [`CONCEPT-ARCHITECTURE.md`](CONCEPT-ARCHITECTURE.md).

---

## 0. The reference standard, and what this replaces

**The production standard for this Studio is `Ajay3007.github.io/_learning/manim-scripts/axiobyte-system/ep01` and `ep02`** — not `brand_kit.py`, not `manim-cs`. Those episodes
are ~2,000-line, ~97 KB single files, and they are *good*: the quality bar, the palette, the
authoring idiom, and the discipline all come from there. The Studio's job is to keep everything
those files got right while removing the three things that make them unscalable, and to add the 3D
tier they are currently reaching for and missing.

### What the reference episodes get right — all of it is preserved

| Principle | As practised in `ep02_video_16x9.py` | Where it lands in Studio |
|---|---|---|
| **THE ONE RULE** | Every beat is a word start via `W(word, sentence)`; the whole `CUE` table resolves at import; a typo or a re-cut voiceover fails immediately | **Timeline Engine** (§2.5). Non-negotiable, generalised to every episode |
| **THE ONE PICTURE** | A single controlling visual thesis — *"the bytes sit still for two minutes while a yellow arrow does all the travelling"* | **§5.1** — promoted to a required, reviewed, *testable* artifact |
| **COLOUR IS MEANING** | *"one hue per idea, and nothing borrows a hue it does not own"* — blue bytes, purple memory, yellow pointer, cyan mbuf, green NIC, orange CPU, red copy, grey idle | **Visual Language Registry** (§5). The rule becomes generic; this palette becomes the *default theme* |
| **Design-space coordinates** | `P(px,py)`, `U(px)`, `X`, `Y`; 1920×1080 design space, 1 unit = 100 px | **Layout System** (§2.5a). Kept as the solver's internal space; shots no longer touch it |
| **Camera-pinned chrome** | `_Pinned`/`KeywordBar`/`CaptionBar` ride `camera.frame` via updaters, so a push-in neither crops nor doubles them | **Chrome System** (§2.11) |
| **Reviewable at every scale** | `Still*` scenes (geometry, no timing) and `Prev*` scenes (act previews that seed inherited state) | Generated automatically, not hand-written |
| **Z-order as a named ladder** | `Z_GLOW, Z_ZONE, Z_NODE, Z_LINE, Z_LABEL, Z_PKT, Z_CARD, Z_SCRIM, Z_TITLE, Z_KEY` | `design/tokens/depth.yaml` |
| **Narration in the source** | Every act is commented with the spoken line and its timestamp | Generated from the script + cue table, so it cannot drift |
| **One literal, reused** | `ADDR = "0x7f3a4c00"` — the pointer and the buffer visibly share an address | Episode-level constants, validated |

### The three things that do not scale — and what each costs today

**1. Format is baked into the shot.** `ep02_video.py` (9:16) and `ep02_video_16x9.py` (16:9) are two
~97 KB files, 2,030 and 2,039 lines, differing by 429 lines. Same narration, same cue table, same
toolkit — only the coordinates differ, because layout is hardcoded as absolute pixels
(`P(640, 560)`, `P(1180, 560)`). Every fix must be made twice, the two cuts will drift, and a third
format means a third file.
→ **Layout System** (§2.5a) makes format a property of the *target*, never of the shot. 16:9 and
9:16 are peers; neither is derived from the other; adding 1:1 costs a 15-line profile.

**2. The toolkit is re-authored per episode.** `glow`, `node`, `pill`, `ptr_arrow`, `byte_cells`,
`packet_buffer`, `mbuf_card`, `mempool`, `cost_meter`, `Stage`, `Timeline`, `KeywordBar`,
`CaptionBar` are ~800 lines that live *inside* the episode file and get copied to the next one.
→ **Actor Library** + **Chrome** + **Timeline Engine** make them versioned, tested engine code.

**3. `Stage` is a manual state model.** A hand-rolled attribute bag exists solely so act previews
can rebuild the state they inherit. It works, but it is bookkeeping the author must maintain, and
nothing validates it.
→ **Actor state + invariants** (§4) give this for free, and additionally catch factual errors.

### The 3D gap

`ep02/nic_3d.png` is a flat-shaded isometric NIC on a white background — an experiment that is not
referenced anywhere in the episode code. It marks the current ceiling and the stated ambition:
*"adding more 3D elements."* The reference bar named in your own `prompt.md` — 3Blue1Brown,
ByteByteGo, Ben Eater, **Apple WWDC engineering presentations** — is a hardware-visual bar that 2D
primitives cannot reach alone. §8 answers this with a three-tier 3D strategy, and Tier 2 lands in
**Phase 1**, not in some distant Blender phase.

### The older material

`my_manim_projects/` (`brand_kit.py`, `manim-cs/`, `axiobyte_brand.md`) is **reference only, not
foundation.** Its palette (`P.DATA`/`P.ACCENT`) is a different, earlier system and is superseded by
the ep02 palette. Two things are worth harvesting and nothing else:

- **`manim-cs` shape geometry** — `MCPU`, `MNIC`, `MMemory`, `MDMA`, `MCache` are useful drawing
  code for the Manim backend, *re-skinned* to ep02 tokens. Adopt selectively, per actor, on demand.
- **`axiobyte_brand.md`** — logo, voice, taglines, platform bios. Brand identity, not visual system.

`brand_kit.py` is not adopted. Its 45 KB single-file shape is the failure mode this repo prevents,
and its palette is superseded.

**Verdict:** the reference episodes prove the *quality bar is already reachable by hand*. The
Studio's entire justification is making that bar reachable **repeatedly, in any format, with 3D, in
a weekend** — and the evidence that it is needed is that Episode 2 cost two 97 KB files to reach it
in two formats.

---

## 1. The one decision everything else follows from

> **A shot is *described* independently of how it is *rendered*.**

Every failure mode this repository could suffer in five years traces back to one root cause:
Manim idioms leaking into the definition of what a scene *means*. The day you want a cinematic
Blender plate of a NIC board, or an interactive WebGL version, or a still for a thumbnail, you
would rewrite everything — because "the packet moves to memory" was never written down anywhere
except as a `self.play(MoveToTarget(...))` call.

So the engine splits into three strata:

```
   ┌──────────────────────────────────────────────────────────────────────┐
   │  SEMANTIC LAYER          "what happens and when"                     │
   │  Actors · Verbs · Cues · Layout relations · Visual language          │
   │  Pure Python + YAML.  ZERO rendering imports, ZERO aspect ratio,     │
   │  ZERO palette. The durable asset — it outlives Manim, Blender, this  │
   │  decade's platforms, and any restyling of the brand.                 │
   └───────────────────────────────┬──────────────────────────────────────┘
                                   │  Shot IR  (versioned, serialisable)
                                   │  + target profile + theme
                                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  BACKEND LAYER           "what it looks like"                        │
   │  manim/ · blender/ · raster/ · (future: web/, usd/)                  │
   │  Owns geometry, materials, easing implementation, frame emission.    │
   │  Swappable. Each registers impls for (concept, verb) pairs.          │
   └───────────────────────────────┬──────────────────────────────────────┘
                                   │  layers: RGBA sequences + camera track
                                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  COMPOSITION LAYER       "what ships"                                │
   │  compose/ (ffmpeg graph, depth-aware stacking, audio mix)            │
   │  publish/ (per-platform encodes, captions, thumbnails, metadata)     │
   └──────────────────────────────────────────────────────────────────────┘
```

**The honest tradeoff.** A tool-agnostic intermediate representation is the highest-risk part of
this design. Done badly it becomes an over-abstracted cathedral that is *slower* to author in than
just writing Manim. The mitigation is a rule I want held to for the life of the repo:

> **Thin IR, thick backends.** The IR describes *identity, intent, and timing* — never geometry,
> never pixels, never easing curves. Layout and look belong to the backend.

And the IR must earn its keep in Phase 1, before any second backend exists: it is what powers
cue-anchored timing, storyboard contact sheets, render caching, and visual regression tests.
If it only paid off when Blender arrived, it would be speculative and we should not build it.

Escape hatch, stated up front: if by end of Phase 1 the IR is measurably slowing authoring, we
degrade gracefully — keep the IR for *timeline + storyboard + caching*, and let shots be authored
as Manim-native Actor calls. Nothing else in the architecture changes.

---

## 2. Subsystems

Fifteen subsystems, each with one responsibility and an explicit contract. "Depends on" is
enforced mechanically (see `CONVENTIONS.md` §6, import contracts).

| # | Subsystem | Responsibility | Depends on | Must never |
|---|---|---|---|---|
| 1 | **Core / IR** | Scene graph, `Shot`, `Clip`, `ActorRef`, time model, registries, errors | — | import any renderer |
| 2 | **Design System** | Colour/type/space/motion/depth tokens; the **Visual Language Registry**; lint rules | core | contain drawing code |
| 3 | **Actor Library** | Semantic actors: state, verbs, invariants, concept identity | core, design | import manim/bpy |
| 4 | **Animation Engine** | Verb definitions, choreography combinators, motion language, easing vocabulary | core, design, actors | hardcode durations |
| 5 | **Timeline Engine** | Audio → word timeline → cues; beat model; drift detection; fail-fast resolution | core | guess a time |
| 5a | **Layout System** | Semantic relations → concrete positions per **target profile**; density budgets | core, design | let a shot know its aspect ratio |
| 6 | **Storyboard Engine** | THE ONE PICTURE, script → beats → shot list → contact sheet; shot templates | core, timeline, design | render final frames |
| 7 | **Camera System** | Rigs, moves, framing rules, follow logic, **the shared camera track** | core, design, layout | be backend-specific |
| 8 | **Lighting System** | Light rigs derived from tokens; key/fill/rim presets; mood ramps | core, design | be per-episode |
| 9 | **Material System** | Semantic materials ("silicon", "copper trace", "data glow") → backend materials | core, design | hardcode hex |
| 10 | **Effects System** | Glow, vignette, grid, trails, particles, depth haze — as declarative specs | core, design | be a Manim mixin |
| 11 | **Typography & Chrome** | Type ladder, labels, code panels; **KeywordBar, CaptionBar, title cards, scrims** — camera-pinned | core, design, layout | own its own palette |
| 12 | **Backends** | `manim/`, `blender/`, `raster/` — the only place tool APIs are touched | all of the above | leak upward |
| 13 | **Render Pipeline** | Plan → schedule → execute → **content-hash cache** → manifest | core, backends | re-render unchanged work |
| 14 | **Composition** | Layer stacking (with depth), audio mix, transitions, aspect adaptation | render | re-do animation |
| 15 | **Publishing** | Per-platform encode, captions, thumbnails, metadata, upload staging | compose | re-layout or re-animate |

Plus two cross-cutting concerns: **Asset Library** (§6) and **Testing Framework** (§9).

### 2.5a The Layout System — format-agnostic by construction

**There is no master aspect ratio.** 16:9 and 9:16 are peer targets, and 1:1 (and whatever a
platform invents in 2029) must cost nothing to add. A shot is not "a 16:9 shot reflowed to
portrait" — it is authored with no ratio in mind at all, and every target is a projection of it.

That is a stronger requirement than "two layout files," and it needs three tiers:

#### Tier A — Semantic relations (in the shot, ratio-free)

The shot never states positions. It states **relationships**, and relationships have no orientation:

```python
chain("copy_path", [nic, buf_a, buf_b, buf_c, app])   # a sequence — direction unspecified
pair("compare", left=traditional, right=zerocopy)      # two things, contrasted
cluster("pool", slots=16)                              # a group, shape unspecified
anchor(ptr, from_=mbuf.addr, to=buf.cells[0])          # a link between two things
focus(buf)                                             # what this beat is about
```

`chain` is the important one, and the reference episodes prove why: ep02's own docstring says *"the
vertical flows of the portrait cut run left→right here, stacked stages become a row."* That is not a
portrait hack — it is the observation that **a chain has no inherent axis**. Once the shot stops
claiming one, both targets are equally native.

This tier carries roughly 80% of layout, for every ratio, forever.

#### Tier B — Target profiles (in the Studio, generic and reusable)

A target profile is Studio infrastructure, written once, used by every episode ever made:

```yaml
# src/axiobyte_studio/design/targets/9x16.yaml
canvas:        { w: 1080, h: 1920 }
axis:          { chain: vertical, pair: stacked, cluster: grid_narrow }
safe:          { top: 0.06, bottom: 0.06, left: 0.05, right: 0.05 }
platform_safe:                       # where the platform's own UI sits
  reels:       { bottom: 0.18, right: 0.14 }
  shorts:      { bottom: 0.14, right: 0.12 }
text_max_width: 0.61                 # ep02 portrait: MAXW 6.6 of a 10.8-unit frame
density_budget: 4                    # max simultaneous top-level elements
chrome:        { keyword: top_pinned, caption: above_platform_safe }
```

```yaml
# src/axiobyte_studio/design/targets/16x9.yaml
canvas:        { w: 1920, h: 1080 }
axis:          { chain: horizontal, pair: side_by_side, cluster: grid_wide }
safe:          { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 }
text_max_width: 0.73                 # ep02 landscape: MAXW 14.0 of a 19.2-unit frame
density_budget: 7
chrome:        { keyword: top_pinned, caption: lower_third }
```

Adding 1:1, or 4:5 for an Instagram feed post, is a ~15-line file — no episode changes.

#### Tier C — Per-episode exceptions (rare, explicit, justified)

Only where a shot genuinely needs different staging in one target. Each override carries a reason,
and `abs plan` reports the override count per episode — a number that should stay near zero. If it
climbs, Tier A is under-expressive and the *engine* is what needs fixing.

#### The part reflow alone cannot solve: density

This is the honest limit, and it is why "just rotate the layout" fails. A wide frame holds seven
things legibly; a tall one holds four. When a beat exceeds a target's `density_budget`, the engine
does not silently shrink everything into mush. The shot must declare its fallback:

```python
chain("copy_path", [...], over_budget="split")   # portrait plays it as two sequential reveals
pair("compare", ..., over_budget="collapse")     # portrait shows one side, then the other
cluster("pool", ..., over_budget="crop_with_ellipsis")
```

The cue table is untouched — the split reveals share the beat's time window. This turns the one
genuinely hard difference between formats into a **declared, reviewable authoring decision** rather
than an accident discovered at render time.

#### What follows target profiles automatically

- **Type scale — corrected by the reference.** This document first assumed a narrow frame needs a
  per-target type multiplier. Checking both cuts disproves it: `ep02_video.py` (1080×1920) and
  `ep02_video_16x9.py` (1920×1080) declare *identical* constants (`KEY_SIZE = 38`, …). Because
  1 unit = 100 px in both, a 38 px keyword already occupies a larger share of a narrow frame, and
  scaling on top would double-count. **Type is absolute in design pixels and shared across
  formats.** What genuinely differs is `text_max_width` — how far a line may run before wrapping —
  0.73 of the frame in landscape, 0.61 in portrait.
- **Chrome geometry.** The caption bar clears Reels/Shorts UI in vertical targets and sits as a
  lower-third in wide ones — one Chrome subsystem, per-target placement.
- **Camera framing.** Rigs target a *subject bounding box with padding*, never absolute coordinates,
  so a push-in frames the board correctly in both without a second rig.
- **Layout lint.** Overflow, overlap, off-canvas anchors, platform-unsafe collisions, and density
  overruns are caught by `abs plan` **for every declared target at once** — before any render.

**The test of this design:** adding a new aspect ratio to a finished, shipped episode should require
editing nothing inside that episode.

### How they talk

Subsystems communicate through **data**, not through imports of each other's internals.
Three contracts carry almost all traffic:

**Contract A — Shot IR** (authoring → rendering). Versioned, serialisable, the ABI of the repo.

```yaml
ir_version: 1
shot: s01e02.shot_0120_pointer_not_copy
# NOTE: no aspect, no canvas, no coordinates. The shot does not know its format.
camera: { rig: follow_subject, subject: ptr, padding: 0.12 }
actors:
  nic:  { concept: nic,     params: { rx_queues: 8, label: SmartNIC } }
  pool: { concept: mempool, params: { size: 16 } }
  pkt:  { concept: packet,  params: { proto: tcp } }
  ptr:  { concept: pointer, params: {} }
layout:
  - { relation: chain,  id: pipeline, of: [nic, pool, app], over_budget: split }
  - { relation: anchor, of: [ptr, pool.cells[0]] }
  - { relation: focus,  of: pool }
clips:
  - { actor: pkt,  verb: travel,    to: pool, at: "cue:zerocopy.dma.write",  dur: 0.60 }
  - { actor: ptr,  verb: attach,    to: pkt,  at: "after:+0.10",             dur: 0.25 }
  - { actor: pkt,  verb: highlight, at: "cue:zerocopy.payoff.pointer",       dur: 0.40 }
  - { actor: cam,  verb: follow,    target: ptr, at: "after:0",              dur: 1.20 }
```

That YAML is the whole point of the project. It is **choreography, not programming**; it is equally
renderable by Manim today and Blender in Phase 3; and it is equally renderable at 16:9, 9:16, 1:1,
or a ratio that does not exist yet — because it never mentions one.

**Contract B — Cue Table** (timeline → everything). `cue_name → absolute seconds`, resolved once,
at plan time, fail-fast. A cue that does not exist is an error before a single frame renders.

**Contract C — Layer Manifest** (render → compose). Each render job emits RGBA frames plus
sidecar metadata: camera matrix per frame, depth AOV, object-ID mattes, colour space, frame range.

### Asset versioning, in one paragraph

Source assets live in `assets/` under semver, indexed by `assets/registry.yaml`, immutable once
published. Every episode pins exact versions in `assets.lock`. Every render writes a manifest
recording engine version, token version, backend version, asset hashes, and RNG seed. Re-rendering
`s01e01` three years from now reproduces it bit-for-bit, or fails loudly explaining which input
moved. Details in §6.

---

## 3. Folder hierarchy

Every directory below exists for a stated reason. Nothing is aspirational padding.

```
axiobyte-studio/
├── README.md                      # what this is, 60-second orientation
├── ARCHITECTURE.md                # this file — the constitution
├── CONVENTIONS.md                 # coding + naming standards
├── ROADMAP.md                     # phased plan, acceptance gates
├── CHANGELOG.md                   # engine semver history
├── pyproject.toml                 # src-layout, deps, ruff/mypy/pytest config
├── justfile                       # one-line entry points for every workflow
│
├── src/axiobyte_studio/           # ══ THE ENGINE ══ (pip-installable)
│   │
│   ├── core/                      # 1. Kernel. No rendering deps. Everything imports this.
│   │   ├── ir/                    #    Shot, Clip, ActorRef, CameraSpec, FrameSpec — the ABI
│   │   ├── time.py                #    Seconds, Cue, At (anchored time algebra)
│   │   ├── space.py               #    Units, Anchor, Path, coordinate contract
│   │   ├── registry.py            #    concept/verb/backend/impl registries
│   │   ├── plan.py                #    Shot IR → resolved RenderPlan
│   │   └── errors.py              #    one exception family, actionable messages
│   │
│   ├── design/                    # 2. Design System — the single source of visual truth
│   │   ├── language.yaml          #    ★ VISUAL LANGUAGE REGISTRY — concepts own roles (§5)
│   │   ├── themes/                #    ★ SWAPPABLE LOOK — roles → actual values
│   │   │   ├── systems.yaml       #      the ep02 palette: the DEFAULT, not the hardcoded one
│   │   │   └── _schema.yaml       #      every theme must supply exactly these roles
│   │   ├── targets/               #    ★ FORMAT PROFILES — one file per aspect ratio (§2.5a)
│   │   │   ├── 16x9.yaml  9x16.yaml  1x1.yaml  4x5.yaml
│   │   │   └── _schema.yaml       #      axis, safe, platform_safe, type_scale, density_budget
│   │   ├── tokens/                #    ratio- and theme-independent structure
│   │   │   ├── type.yaml          #      the ladder, frame-relative; targets supply the multiplier
│   │   │   ├── motion.yaml        #      per-concept signature curves + durations
│   │   │   └── depth.yaml         #      the ep02 Z-ladder, named
│   │   ├── brand.md               #    logo, voice, taglines — brand identity
│   │   └── lint.py                #    "no raw hex", "no unregistered concept", "no role theft"
│   │
│   ├── actors/                    # 3. Actor Library — semantic, tool-agnostic
│   │   ├── base.py                #    Actor, ActorState, Invariant, @verb
│   │   ├── compute/               #    CPU, Core, WorkerCore, Thread, Scheduler, Lock, Interrupt
│   │   ├── memory/                #    Memory, CacheLine, Cache, HugePage, TLB, PageTable,
│   │   │                          #      Mbuf, Mempool, Pointer, Arena, NumaNode
│   │   ├── io/                    #    NIC, PMD, DMA, Ring, Descriptor, Doorbell, PCIeBus
│   │   ├── net/                   #    Packet, Header, Flow, FiveTuple, FlowTable, ConnTrack,
│   │   │                          #      Router, Switch, Firewall, Tunnel, IPsecSA
│   │   ├── os/                    #    KernelSpace, UserSpace, Boundary, Syscall, SkBuff,
│   │   │                          #      Driver, Socket, XDPHook, ContextSwitch
│   │   └── abstract/              #    Meter, Graph, Table, CodePanel, Callout, Legend,
│   │                              #      StackDiagram, SequenceDiagram, Timeline
│   │
│   ├── animation/                 # 4. Animation Engine
│   │   ├── verbs/                 #    travel, freeze, copy, drop, encrypt, fragment,
│   │   │                          #      highlight, attach, detach, enqueue, dequeue, evict…
│   │   ├── choreography.py        #    sequence(), parallel(), stagger(), chain(), follow()
│   │   ├── phrases/               #    reusable multi-actor set-pieces (see §7)
│   │   ├── easing.py              #    named curves; no bare bezier literals in episodes
│   │   └── motion.py              #    resolves motion tokens → curve + duration
│   │
│   ├── timeline/                  # 5. Timeline Engine — your "ONE RULE", productised
│   │   ├── transcribe.py          #    audio → word-level timeline (WhisperX)
│   │   ├── analyze.py             #    pauses, emphasis, wpm, fast/slow regions
│   │   ├── cues.py                #    W(word, sentence) resolver; fail-fast; cue table
│   │   ├── beats.py               #    Beat model: act / beat / event hierarchy
│   │   └── drift.py               #    re-cut diffing: which cues moved, by how much
│   │
│   ├── layout/                    # 5a. Layout System — format-agnostic by construction
│   │   ├── relations.py           #    Tier A: chain, pair, cluster, anchor, focus — no axis
│   │   ├── solve.py               #    relations + target profile → concrete positions
│   │   ├── density.py             #    budget checks; split / collapse / crop strategies
│   │   ├── frame.py               #    frame-relative units; safe + platform-safe zones
│   │   └── lint.py                #    overflow, overlap, off-canvas, UI collision — ALL targets
│   │
│   ├── storyboard/                # 6. Storyboard Engine
│   │   ├── picture.py             #    ★ THE ONE PICTURE — the episode's visual thesis
│   │   ├── script.py              #    script.md → narration blocks
│   │   ├── beatmap.py             #    blocks + cues → beats
│   │   ├── shotlist.py            #    beats → shots (id, duration, actors, intent)
│   │   ├── templates/             #    shot archetypes: reveal, compare, journey, cost, recap
│   │   ├── previews.py            #    generates the Still*/Prev* review scenes
│   │   └── contact_sheet.py       #    one-page PDF/PNG board — approve before animating
│   │
│   ├── camera/                    # 7. Camera System — the Blender↔Manim bridge lives here
│   │   ├── rig.py                 #    named rigs: two_lane, wide_board, macro_die, orbit
│   │   ├── moves.py               #    push_in, pan, rack_focus, follow(actor), whip
│   │   ├── framing.py             #    safe zones, headroom, rule-of-thirds helpers
│   │   └── track.py               #    per-frame matrix export/import (§8)
│   │
│   ├── lighting/                  # 8. token-driven light rigs; mood ramps
│   ├── materials/                 # 9. semantic materials → backend materials
│   ├── effects/                   # 10. glow, vignette, grid, trails, particles, haze
│   ├── typography/                # 11. type ladder, labels, code panels, tags, pills
│   ├── chrome/                    # 11b. camera-pinned furniture — survives any push-in
│   │   ├── pinned.py              #      the updater that rides camera.frame
│   │   ├── keyword_bar.py         #      top chapter keyword, one at a time
│   │   ├── caption_bar.py         #      bottom caption
│   │   └── title_card.py          #      act titles + scrims
│   │
│   ├── backends/                  # 12. ══ THE ONLY PLACE TOOL APIs ARE IMPORTED ══
│   │   ├── base.py                #    Backend protocol: capabilities(), render(plan)
│   │   ├── manim/                 #    the primary backend
│   │   │   ├── shapes/            #      ManimNIC, ManimPacket, ManimMbuf…
│   │   │   ├── iso/               #      ★ Tier-1 pseudo-3D: axonometric solids, face shading
│   │   │   ├── plates/            #      ★ Tier-2: RGBA image-sequence actors with alpha
│   │   │   ├── impls/             #      @impl(backend="manim", concept=…, verb=…)
│   │   │   └── scene.py           #      the single generated Scene subclass
│   │   ├── blender/               #    ★ Tier-2 bake + Tier-3 live: headless bpy, alpha, AOVs
│   │   │   ├── bake.py            #      asset → RGBA sequence + depth, offline
│   │   │   ├── rig.py             #      lighting/material rigs from tokens
│   │   │   └── track.py           #      camera matrix export (§8.2)
│   │   └── raster/                #    stills, thumbnails, SVG, contact sheets
│   │
│   ├── render/                    # 13. plan → schedule → execute → cache → manifest
│   │   ├── cache.py               #    content-addressed artifact cache (§8)
│   │   ├── jobs.py                #    per-shot, per-layer job graph; parallel execution
│   │   └── manifest.py            #    reproducibility record
│   │
│   ├── compose/                   # 14. ffmpeg graph, depth-aware stacking, audio mix
│   ├── publish/                   # 15. per-platform encodes, captions, thumbs, metadata
│   └── cli/                       #    `abs` — one command, discoverable subcommands
│
├── assets/                        # ══ ASSET LIBRARY ══ (versioned, immutable)
│   ├── registry.yaml              #    index: id, version, sha256, license, provenance
│   ├── models/                    #    .blend sources: nic_board, cpu_die, dimm, pcie_slot
│   ├── plates/                    #    ★ BAKED 3D: RGBA sequences + depth, rendered once,
│   │                              #      reused across every episode forever
│   ├── materials/ hdri/ fonts/ audio/ icons/ luts/
│   └── previews/                  #    auto-generated thumbnail per asset
│
├── episodes/                      # ══ THE ONLY PLACE EPISODE LOGIC MAY EXIST ══
│   └── s01e02-zero-copy/
│       ├── episode.yaml           #    metadata, pillar ref, targets: [16x9, 9x16], theme
│       ├── picture.md             #    ★ THE ONE PICTURE — written and approved first
│       ├── script.md              #    voiceover script
│       ├── audio/vo.wav
│       ├── timeline/              #    words.json, analysis.json, cues.yaml
│       ├── storyboard/            #    beats.yaml, shots.yaml, board.pdf
│       ├── shots/                 #    shot_0010_hook.py … authored ONCE, format-agnostic
│       ├── overrides/             #    ★ Tier C: rare per-target exceptions, each with a reason
│       ├── assets.lock            #    exact asset versions
│       └── out/                   #    gitignored renders
│
├── pillars/                       # content roadmap as data, not prose
│   └── p01-high-performance-data-plane.yaml
│
├── tools/                         # scaffolders, migration scripts, doc generators
├── tests/                         # unit / contract / visual / timing / lint
│   └── golden/                    #    reference frames + perceptual hashes
└── docs/                          # mkdocs site: actor reference, phrase recipes, ADRs
```

### Why the boundaries fall where they do

- **`src/` layout** — prevents accidental "it works because I'm in the repo root" imports, and
  makes the engine genuinely pip-installable. Standard for a product, not a script folder.
- **`core/` has no dependencies** — this is what makes the IR portable and what makes tests fast.
- **`design/` is data, not code** — tokens as YAML means the brand can be versioned, diffed, and
  regenerated for any target (Manim colours, Blender node groups, CSS for a future site).
- **`actors/` mirrors the domains of the content roadmap**, not the tools. When Pillar 3
  (Distributed Systems) arrives, you add `actors/dist/` — no other directory changes.
- **`backends/` is a firewall.** One import-linter rule (`manim`/`bpy` importable only under
  `backends/`) preserves the entire architecture mechanically. Without it, this design rots in
  six months.
- **`episodes/` is a leaf.** Nothing in `src/` may import from `episodes/`. Enforced by lint.
- **`overrides/` exists on purpose.** Perfection is not achievable; an escape hatch that is
  *visible and auditable* is better than an escape hatch that gets smuggled into the engine.

---

## 4. The Actor model

### Actors are stateful, not decorative

```python
@actor(concept="packet", domain="net")
class Packet(Actor):
    """A single network packet.

    Visual identity : language.yaml#packet  (cyan capsule, header band, ease-out motion)
    Invariants      : a dropped packet cannot travel; a freed mbuf cannot be dereferenced.
    """
    proto: Proto = Proto.TCP
    size: Bytes = 1500
    location: ActorRef | None = None
    alive: bool = True
```

State is declared and validated because it lets the engine catch *lies about the system* — the
one class of bug an educational platform cannot afford. If a shot animates a packet being read
after `free()`, that is a factual error about DPDK, and the engine should refuse to render it.

### Verbs are declarations, not calls

```python
@verb(concept="packet", name="travel",
      params={"to": ActorRef, "along": PathRef | None, "dur": Seconds | None},
      motion="motion.packet.travel",            # duration + curve come from tokens
      requires=lambda s: s.alive and not s.frozen,
      effects=lambda s, p: replace(s, location=p.to))
def travel(): ...
```

A verb emits a `Clip` into the shot's timeline. It does not draw. The backend supplies the how:

```python
@impl(backend="manim", concept="packet", verb="travel")
def _(actor: ManimPacket, p: TravelParams, ctx: ManimCtx) -> Animation: ...
```

Missing implementations are detected at **plan** time — `abs plan` tells you
"blender backend has no impl for (packet, encrypt)" before you burn an hour of render.

### The verb vocabulary is deliberately small and shared

Verbs are defined once and reused across concepts wherever the meaning holds. `highlight`,
`travel`, `freeze`, `copy`, `drop` apply to many actors; `encrypt` applies only where it is
physically meaningful. A new episode that wants a new verb is a signal to extend the Studio —
which is exactly the workflow the brief asks for.

### Actors replace `Stage`, and do more

The reference episodes already needed a state model and built one by hand — the `Stage` attribute
bag, which exists so an act preview can rebuild exactly what it inherits. Actors subsume it: state
is declared rather than accumulated, previews reconstruct it automatically, and invariants catch
what `Stage` could not. The episode author stops maintaining bookkeeping.

The 3D tiers of §8 also attach here: an actor may declare `iso` (Tier-1 axonometric) or `plate`
(Tier-2 baked 3D) representations alongside its flat one, and the shot picks a fidelity. The same
`NIC` actor is a green rounded box in a diagram shot and a lit circuit board in a hero shot — same
identity, same colour role, same verbs.

---

## 5. The Visual Language Registry

The brief's strongest consistency requirement — *"when viewers see a glowing pointer they should
immediately recognise it"* — is the one that documentation alone cannot deliver. So it is data,
and it is enforced.

### Two separable things: the *mechanism* and the *theme*

"Generic, not based on a specific style" applies here as much as to aspect ratio. So the registry
splits:

- **The mechanism is generic and permanent.** Concepts own roles; roles resolve through a theme;
  nothing borrows a role it does not own; violations fail lint. This never changes.
- **The theme is data and swappable.** The ep02 palette ships as `design/themes/systems.yaml` — the
  **default**, not the hardcoded one. A future pillar (Databases, Cellular, Compilers) can register
  its own theme, and every existing actor re-skins with no code change.

A theme supplies hues, surfaces, glow parameters, stroke weights, and corner radii. It may **not**
add or remove concepts or change which role owns which meaning — that is the visual language, and
it is theme-independent. Switching theme changes what `packet` looks like; it can never make
`packet` mean something else.

`abs render --theme systems` is therefore a generic capability, and the ep02 look is simply the one
loaded by default.

### The default theme

The registry is the ep02 rule — *"one hue per idea, and nothing borrows a hue it does not own"* —
turned from a docstring into enforced data. **The reference episodes' palette ships as the default
theme, adopted as-is:**

| Role | Hue | Token | Owns |
|---|---|---|---|
| `packet` | `#4AA8FF` blue | `color.packet` | packet bytes, payload |
| `memory` | `#B79CF0` purple | `color.memory` | a buffer, the mempool |
| `pointer` | `#F5D14F` yellow | `color.pointer` | a pointer, the handle |
| `mbuf` | `#34D8E8` cyan | `color.mbuf` | the mbuf (and the AxioByte mark) |
| `nic` | `#4DE6A0` green | `color.nic` | the NIC, the wire |
| `cpu` | `#F0A431` orange | `color.cpu` | the CPU, the kernel |
| `copy` | `#FF5C55` red | `color.copy` | **bytes actually moving** — the sin |
| `idle` | `#65728A` grey | `color.idle` | idle, empty, unused |
| canvas | `#090C13` / `#141B27` / `#0F1420` / `#26344A` | `color.bg`/`surface`/`surf2`/`border` | ground |

`design/language.yaml`:

```yaml
packet:
  color: color.packet                # never a hex, always a role
  silhouette: byte_cells             # individual cells, so a copy has something to move
  motion: motion.packet.travel       # ease-out, never linear, never instant
  label: { style: type.mono_s, position: above }
  states: { in_flight: glow.soft, dropped: desaturate+fall, frozen: outline.dashed }
  never: [ "any hue but blue", "a single undivided block" ]   # lint-enforced

pointer:
  color: color.pointer
  silhouette: arrow_thin
  motion: motion.pointer.snap        # pointers snap; they do not glide
  signature: glow.pulse.slow         # the thing viewers learn to recognise
  never: [ "carrying bytes with it" ]  # a pointer that moves payload is a lie

copy:
  color: color.copy
  motion: motion.copy.translate      # red is reserved for bytes in motion; nothing else
  never: [ "decorative use", "error states" ]
```

That last entry is the load-bearing one for Pillar 1. Red means *bytes moved* and nothing else — so
when the copies stop in Episode 2, the absence of red **is** the argument. Reserving a hue that
strictly is exactly the kind of rule that survives in a document for two episodes and then quietly
dies; as a lint rule it survives for twenty.

Three things make this real rather than decorative:

1. **Actors declare their concept**, so an actor cannot render without a registry entry.
2. **`design/lint.py` fails CI** on raw hex outside `tokens/`, on unregistered concepts, and on
   `never:` violations where they are statically detectable.
3. **Golden-frame tests** catch the rest perceptually: if `packet` renders differently than it did
   in Episode 1, the diff fails and you must either accept it (a deliberate brand revision, which
   bumps the token version) or fix it.

Consistency of **motion** matters as much as colour and is usually neglected. Packets ease out.
Interrupts snap. DMA is continuous and unhurried. Locks stutter. Once viewers internalise those
rhythms, motion itself carries meaning — that is the 3Blue1Brown-grade layer.

### 5.1 THE ONE PICTURE — the artifact that produces 3B1B-grade episodes

The reference episodes contain something more valuable than any of their code, and it is a
docstring. Episode 2's reads:

> *"The whole episode is an argument about MOVEMENT, made by refusing to move one object… the
> closing line is not a caption. It is the literal state of the screen: the bytes have sat still
> for two minutes while a yellow arrow did all the travelling."*

That is why the episode is good. Not the toolkit — **the thesis.** 3Blue1Brown's actual method is
not beautiful animation; it is finding the one picture that makes a concept obvious, then refusing
to draw anything that dilutes it. A framework that industrialises drawing but leaves the thesis to
chance will produce twenty competent, forgettable videos.

So it becomes a **required, reviewed, first artifact**: `episodes/*/picture.md`, written before the
storyboard, and structurally checked by `abs storyboard build`:

```markdown
## The One Picture
The bytes never move. A yellow arrow does all the travelling.

## The counter-picture           # what the first act builds on purpose, to be destroyed
Bytes copied buffer-to-buffer in red — so that when the copies stop, the stillness reads.

## The payoff frame              # the single frame the whole episode exists to earn
Stationary blue cells, four stages, one yellow arrow. No red anywhere on screen.

## What must never happen        # the discipline, stated as prohibitions
The packet buffer moves. Red appears after t=42s. A stage redraws the payload.
```

Two of these are mechanically checkable, and that is the point of writing them down: the engine can
assert that the payload actor never receives a `travel` verb after the zero-copy act begins, and
that no actor bound to `color.copy` appears after `t=42`. **The episode's thesis becomes a test.**
A violation is not a style note in review — it fails the build, because a packet that moves in a
zero-copy episode is not an aesthetic problem, it is a factual one.

This is the single highest-leverage idea in the whole architecture, and it costs almost nothing to
build. It is Phase 1.

---

## 6. Asset architecture

### Two populations, governed differently

| | **Source assets** | **Derived artifacts** |
|---|---|---|
| Examples | models, HDRIs, fonts, LUTs, music beds | rendered frames, plates, encodes, contact sheets |
| Location | `assets/` | `episodes/*/out/`, cache dir |
| Git | tracked (LFS for binaries) | **never** tracked |
| Identity | `models/nic_smartnic@2.1.0` + sha256 | content hash of all inputs |
| Mutability | **immutable once published** | disposable, always reproducible |

### Rules

1. **Semver, and immutable.** Fixing a model's topology is `@2.1.1`. Re-silhouetting it is `@3.0.0`
   and requires a Visual Language review, because it changes what viewers recognise.
2. **Episodes pin, never float.** `assets.lock` records exact versions and hashes. This is what
   makes "re-render Episode 1 in 4K three years from now" a real capability rather than a hope.
3. **No episode names in asset names.** `nic_smartnic`, never `ep01_nic`. An asset named after an
   episode is a duplication bug waiting to happen.
4. **Every asset ships a contract test** — loads headless, sits at origin, unit-scaled, declares
   its sockets/material slots, renders a preview. A broken asset fails in CI, not at 2 a.m.
5. **Provenance is mandatory** — `registry.yaml` records source, licence, and author for every
   third-party asset. Non-negotiable for a public platform.
6. **Binaries via git-LFS**, with the sha256 recorded in the registry. The hash indirection means
   moving to an S3/R2 object store later is a config change, not a migration.

---

## 7. Animation architecture

Three tiers, each reusable at a different scale:

```
VERB      atomic, one actor          packet.travel(to=mempool, dur=0.6)
   ↓
PHRASE    choreography, many actors  dma_write_burst(nic, mem, n=32)
   ↓                                 context_switch(cpu, from_=app, to=kernel)
SHOT      framed, timed, cue-bound   shot_0120_pointer_not_copy
```

**Phrases are where the compounding happens.** `dma_write_burst`, `cache_line_bounce`,
`ring_produce_consume`, `syscall_boundary_cross`, `flow_table_lookup` — each is written once,
reviewed once, and every future episode that needs it gets a correct, on-brand, consistently
timed set-piece for one line of code. After ten episodes the phrase library is the real moat, and
Episode 20 genuinely is choreography rather than programming.

**Time is anchored, never absolute.** This is the ONE RULE, generalised:

```python
at=cue("zerocopy.dma.write")      # a word start in the voiceover
at=after(prev, +0.10)             # relative to the previous clip
at=until(cue("zerocopy.payoff"))  # stretch to land exactly on a word
```

There is no `wait(1.3)` anywhere in an episode. Ever. When the voiceover is re-cut, `abs timeline
drift` reports which cues moved and by how much, and every anchored clip follows automatically.
A cue that no longer exists is a hard error at plan time — the same fail-fast property your
`ep01_video.py` already has, now available to every episode for free.

**Durations come from tokens**, not from the author's fingers. `motion.packet.travel.duration`
is 0.6 s everywhere in the catalogue unless an episode explicitly overrides it with a reason.

---

## 8. The 3D strategy, Blender + Manim

### 8.0 Three tiers of 3D, ordered by value per unit of effort

"More 3D elements" is the right ambition and the wrong single decision — because *3D* covers three
completely different engineering costs. `nic_3d.png` is the evidence: flat-shaded, white
background, no alpha, unused. It failed not because 3D is hard but because it went straight to the
expensive tier without a pipeline.

The reference bar you named — **Apple WWDC engineering presentations** — is mostly Tier 1 and
Tier 2. Almost none of it is live 3D.

| | **Tier 1 — Isometric in Manim** | **Tier 2 — Baked plates (the workhorse)** | **Tier 3 — Live Blender** |
|---|---|---|---|
| What | Axonometric solids built from 2D primitives with correct face shading and edge light | Hero hardware rendered offline in Blender to **RGBA sequences + depth**, replayed as image actors | A real Blender scene rendered per shot, camera-tracked with Manim overlays |
| Looks like | Clean stacked memory planes, layered cache slabs, an angled board | A lit, materialled NIC board with DOF and a canned turntable/push-in | Anything |
| Cost per frame | zero | zero *at episode time* (rendered once, ever) | minutes |
| Cost to build | days | ~2 weeks incl. asset kit | ~6 weeks |
| Composites with 2D | perfectly | perfectly (alpha + depth) | needs the camera bridge |
| Arrives | **Phase 1** | **Phase 1–2** | **Phase 3** |

**Tier 2 is the answer to your actual request**, and it is the part most people skip. The insight:
*a hero hardware shot does not need interactivity — it needs one beautiful camera move, rendered
once, and reused for five years.* A NIC board with a 3-second push-in, baked to a 180-frame RGBA
sequence with a depth pass, is an **asset** — versioned in `assets/plates/`, dropped into any
episode by any actor, at zero render cost, forever. That is exactly the "reusable asset library"
the brief demands, applied to the thing that actually looks expensive.

Practical requirements that make Tier 2 work (and that `nic_3d.png` misses on all four):

1. **Transparent background, always.** RGBA PNG/EXR sequences, never a white plate.
2. **Lit from the token palette.** The PCB green is `color.nic`, the trace amber is `color.cpu`.
   3D that ignores the visual language breaks the language.
3. **Depth pass alongside.** So a yellow pointer arrow can pass *behind* a heatsink.
4. **Canonical camera moves, named and shared.** `push_in`, `turntable_90`, `tilt_reveal`,
   `exploded` — baked per asset, so every episode's hardware moves the same way.

Tier 1 handles the everyday depth — memory as stacked planes, cache as slabs, a board seen at an
angle — with no render cost and full animatability. Most "3D" in the catalogue should be Tier 1;
Tier 2 is for hero moments; Tier 3 is for when a shot genuinely cannot be faked.

### 8.1 Division of labour

| | **Blender** | **Manim** | **Raster** |
|---|---|---|---|
| Owns | hardware, boards, dies, cinematic motion, DOF, particles, realistic light | diagrams, equations, protocol stacks, labels, graphs, timelines, subtitles | stills, thumbnails, contact sheets |
| Outputs | RGBA plate + depth AOV + object-ID matte + camera track | RGBA overlay (`-t`) | PNG/SVG |
| Cost | minutes/frame | seconds/frame | instant |

Neither is forced. The Shot IR declares `backend: blender` per *layer*, and a single shot may have
both — that is the normal case for the cinematic episodes.

### 8.2 The camera is the seam

This is the part that is usually done wrong, so it is designed explicitly:

**A shot has exactly one camera, defined in `camera/rig.py`, and both backends are driven by it.**
Blender exports a per-frame `4×4` matrix + intrinsics to `camera/track.py`'s format. The Manim
backend consumes that track and projects overlay anchor points through it. Result: a label attached
to a 3D NIC port *stays on the port* through a push-in and an orbit, because both layers share one
projection. Without this, every hybrid shot degenerates into hand-matching keyframes, and hybrid
shots quietly stop getting made.

### 8.3 The other three contracts

- **Space.** 1 Studio unit = 1 Manim unit = 1 Blender metre. Y-up in the IR; the Blender adapter
  handles the Z-up conversion. Stated once, so it is never rediscovered per episode.
- **Colour.** Tokens are authored in linear sRGB. Blender renders linear → EXR; Manim renders
  display-referred; `compose/` converts and applies one shared LUT. One pipeline, one look.
- **Depth.** Blender's depth AOV travels with the plate, so a Manim overlay can be *occluded* by
  3D geometry — a packet label passing behind a heatsink. This is what separates "3D background
  with 2D stickers on top" from an integrated frame.

### 8.4 Adding a third renderer later

The backend protocol is: declare `capabilities()`, implement `(concept, verb)` impls, emit layers
conforming to the Layer Manifest. A WebGL or USD backend is additive — no change to `core/`,
`actors/`, `design/`, or any existing episode. That is the five-year test the brief sets, and it is
the only reason the IR exists.

### 8.5 Render pipeline and the cache

```
abs plan → resolve cues, validate invariants, check impls, compute hashes
abs render → schedule jobs (per shot × per layer), parallel, resumable
            → cache: key = hash(shot IR + tokens + assets.lock + backend + engine + seed)
abs compose → stack layers with depth, mix audio, apply LUT
abs publish → per-target encode (16:9 YouTube, 9:16 Reels, 1:1 feed), captions, thumbnail
```

The content-hash cache is what makes a 15-minute 4K episode iterable: change one shot, re-render
one shot. Every run writes a manifest with all input hashes and tool versions, which is what makes
reproducibility a guarantee rather than a wish.

**Every target renders from the same plan.** `abs render --target 16x9,9x16` runs the layout solver
once per target profile against one shot set and one cue table, producing genuinely native output
for each — not a crop, not a reframe of a master. Because timing is shared, the two cuts can never
drift out of sync with the narration. The render cache keys include the target, so re-rendering one
format leaves the other untouched.

This is Phase 1, not a later nicety: it is the reason a shot has no aspect ratio in the first place,
and it is what turns two 97 KB files into one authored shot set.

---

## 9. Testing framework

Five layers, all in CI, because a visual product with no visual tests regresses invisibly:

| Layer | Catches | Cost |
|---|---|---|
| **Unit** | IR, cue algebra, state transitions, token resolution | milliseconds |
| **Lint / import contracts** | `manim` imported outside backend; raw hex; episode refs in `src/` | seconds |
| **Contract** | every actor implements its declared verbs in every backend it claims | seconds |
| **Timing** | cues resolve; no drift; shot durations sum to audio duration ± tolerance | seconds |
| **Visual regression** | golden frames + perceptual hash per actor and per phrase | minutes |

The visual suite is the one that protects the Visual Language: it renders a canonical frame of every
actor and every phrase and compares against `tests/golden/`. A change to `packet` shows up as a diff
image in the PR. Accepting it is a deliberate act that bumps the token version.

---

## 10. How future contributors extend the framework

Four extension points, each a checklist — this is the contributor guide's spine:

**Add an actor** → declare concept in `language.yaml` → semantic class in `actors/<domain>/` →
state + invariants → backend impl(s) → golden frame → docs page → export.

**Add a verb** → `@verb` declaration with motion token → impl per backend → contract test →
add to the verb vocabulary table in docs.

**Add a phrase** → compose existing verbs in `animation/phrases/` → golden clip → docs recipe.
*Prefer this over adding actors; most new needs are new phrases.*

**Add a backend** → implement `Backend` protocol → `capabilities()` → impls for the concepts you
support → conform to Layer Manifest → run the contract suite.

**Add a pillar** → `pillars/pNN-*.yaml` → identify which actor domains are missing → extend the
Studio → then write episodes.

The governing rule from the brief, restated as process: **an episode may not add capability.** If a
shot needs something the Studio lacks, the Studio is extended first, in a separate commit, with
tests and a golden frame. This is the single discipline that keeps the repo from decaying into an
animation collection.

---

## 11. Risks, stated honestly

| Risk | Severity | Mitigation |
|---|---|---|
| IR becomes over-abstracted; authoring slows | **High** | Thin-IR rule; Phase-1 gate is a *real episode*; escape hatch in §1 |
| Live Blender is a much bigger lift than estimated | Medium | Deferred to Phase 3; Tiers 1–2 carry the 3D look from Phase 1, so a delay costs polish, not output |
| Tier-2 bakes look pasted-on rather than integrated | Medium | Alpha + depth pass + lighting driven by the same tokens as the 2D layer; golden frames compare composited results, not plates |
| Golden-frame tests become noisy and get disabled | Medium | Perceptual hash with tolerance, not pixel equality; small canonical frames |
| Layout System can't express a genuinely different portrait design | Medium | Layout files may override any slot; `flow:` handles the mechanical 80%, exceptions stay explicit |
| Tier-2 plates lock in a camera move that later feels wrong | Low | Plates are versioned assets; re-baking is a background job, not an episode rewrite |
| Extraction loses something ep02 got right | **High** | Phase 0's gate is a frame-identical re-render of ep02 from the engine — the abstraction must prove it lost nothing |
| Architecture is right but too slow to start | **High** | Phase 0 is extraction, not construction — the first milestone re-renders an episode that already exists |
| Solo maintainer, ambitious scope | High | Every phase ends in a shippable episode; nothing is built that a real episode has not needed |

The last three are the ones I would watch most closely. The roadmap in `ROADMAP.md` is deliberately
structured so that **every phase produces a publishable video**, not just infrastructure.

---

## 12. What I need approved

1. **`axiobyte-system/ep01`+`ep02` are the specification**; `brand_kit.py` is not adopted — §0.
2. **The three-layer split** (semantic / backend / composition) and the thin-IR rule — §1.
3. **The subsystem list and their boundaries** — §2.
4. ★ **The Layout System — no master aspect ratio.** Shots state semantic *relations*, never
   positions or formats; target profiles (16:9, 9:16, 1:1, …) are peers and live in the Studio;
   density budgets handle the one difference reflow cannot. This ends the two-file duplication and
   makes a future format a 15-line file — §2.5a.
5. **The folder hierarchy** — §3.
6. **Actors as stateful semantic objects with declarative verbs**, replacing `Stage` — §4.
7. **The Visual Language Registry as enforced data** — the *mechanism* is generic and permanent;
   the *theme* is swappable data, with the ep02 palette shipping as the default — §5.
8. ★ **THE ONE PICTURE as a required, testable artifact** — the thesis becomes a build gate. The
   highest-leverage idea here, and nearly free — §5.1.
9. **Asset versioning via immutable semver + per-episode lockfiles** — §6.
10. **Cue-anchored time as the only legal way to schedule** — §7.
11. ★ **The three-tier 3D strategy** — Tier 1 (isometric) and Tier 2 (baked plates) in Phase 1;
    Tier 3 (live Blender) in Phase 3. **Tier 2 is the direct answer to "more 3D elements"** — §8.0.
12. **The camera track as the Blender↔Manim seam** — §8.2.
13. **The phased roadmap** — [`ROADMAP.md`](ROADMAP.md).
14. **Coding and naming standards** — [`CONVENTIONS.md`](CONVENTIONS.md).

Items marked ★ are new since the first draft, added after reading the reference episodes.

No implementation begins until you say so.
