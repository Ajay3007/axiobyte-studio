# AxioByte Studio — Implementation Roadmap

**Status:** proposed, awaiting approval · Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`CONVENTIONS.md`](CONVENTIONS.md)

---

## The governing principle of this plan

> **Every phase ends in a publishable episode, not in infrastructure.**

The single largest risk is not bad architecture — it is eight weeks of engine work with no video at
the end, followed by a loss of momentum. Each phase is gated on shipping real content, and each
phase's engine work is scoped to exactly what that content needs.

The second principle, given what the reference episodes already prove:

> **The quality bar is already reachable by hand. The Studio exists to make it reachable
> repeatedly — in any format, with 3D, in a weekend.**

`ep02` is genuinely good and cost two ~97 KB files to produce. Nothing below is about raising the
ceiling. It is about removing the cost of hitting it again, and adding the one thing hand-authoring
could not reach: real hardware in 3D.

Durations assume solo, part-time work. Treat them as sequencing, not commitments.

---

## Phase 0 — Extract the idiom
**~2 weeks · Goal: everything `ep02` invented becomes engine code, and `ep02` still renders**

The reference episodes are the specification. Phase 0 is a careful extraction, not a rewrite.

| # | Work | Source |
|---|---|---|
| 0.1 | Repo skeleton, `src/` layout, `pyproject.toml`, `uv.lock`, `justfile` | — |
| 0.2 | CI: ruff, mypy, pytest, **import-linter contracts** | contracts before code — cheap now, expensive to retrofit |
| 0.3 | **Default theme** from the ep02 palette → `design/themes/systems.yaml` | `COLOUR IS MEANING` block: 8 semantic hues + canvas |
| 0.4 | **Type ladder + Z-ladder** → `type.yaml`, `depth.yaml` | `KEY_SIZE…MONO_S`, `Z_GLOW…Z_KEY` |
| 0.5 | **`design/language.yaml`** — the 9 concepts ep02 already owns, with `never:` rules | *"nothing borrows a hue it does not own"* |
| 0.6 | **Timeline Engine** — `Timeline`, `W(word, sentence)`, fail-fast, cue tables, `analysis.json` | ep01/ep02 `Timeline` class, verbatim in behaviour |
| 0.7 | **Layout System v0** — frame-relative units, safe zones, the solver's internal design space | ep02 canvas block, generalised |
| 0.8 | **Chrome** — `_Pinned`, `KeywordBar`, `CaptionBar`, `title_card`, scrim | ep02 pinned-chrome block |
| 0.9 | **Typography + primitives** — `T`, `M`, `box`, `pill`, `tag`, `node`, `glow`, `ptr_arrow`, `dim/undim` | ep02 drawing toolkit |
| 0.10 | `SYSTEMS_TRACKER.md` → `pillars/p01-high-performance-data-plane.yaml` | roadmap as data |

**Gate:** `ep02_video_16x9.py` is reduced to shot code + a cue table, importing everything else from
`axiobyte_studio`, and renders **frame-identical** to the current file. Golden-frame diff is the
proof. No new capability — proof that the extraction lost nothing.

This gate matters more than it looks: if the extracted engine cannot reproduce ep02 exactly, the
abstraction is wrong, and it is far cheaper to learn that in week two than in month six.

---

## Phase 1 — Format-agnostic, and real 3D
**~4 weeks · Goal: the two things hand-authoring could not do**

| # | Work | Notes |
|---|---|---|
| 1.1 | `core/ir/` — `Shot`, `Clip`, `ActorRef`, `CameraSpec`; `ir_version: 1` | thin-IR rule applies |
| 1.2 | `core/time.py` — anchored time algebra: `cue()`, `after()`, `until()` | generalises `scene.at("cue")` |
| 1.3 | `core/registry.py` + `core/plan.py` — validate before rendering | `abs plan` is the gate |
| 1.4 | `actors/base.py` — `Actor`, state, invariants, `@verb`, `@impl`; replaces `Stage` | |
| 1.5 | **Six actors**: `Packet`, `NIC`, `Memory`, `CPU`, `Mbuf`, `Pointer` | exactly ep02's cast |
| 1.6 | **Ten verbs**: travel, freeze, copy, drop, highlight, attach, detach, enqueue, dequeue, follow | |
| 1.7 | ★ **Layout System v1** — semantic relations (`chain`, `pair`, `cluster`, `anchor`, `focus`), the solver, density budgets, all-target lint | **no master ratio; format lives in the target** |
| 1.7b | ★ **Target profiles** — `16x9`, `9x16`, `1x1`, incl. platform-safe zones for Reels/Shorts UI | Studio infrastructure, not per-episode |
| 1.7c | ★ **Theme layer** — `themes/systems.yaml` as the default; `--theme` is generic from day one | style is data, not code |
| 1.8 | ★ **THE ONE PICTURE** — `picture.md` schema, and the two assertions that make it a test | §5.1; cheap, highest leverage |
| 1.9 | ★ **Tier-1 3D** — `backends/manim/iso/`: axonometric solids, face shading, edge light | zero render cost, fully animatable |
| 1.10 | ★ **Tier-2 3D** — `backends/blender/bake.py`: asset → RGBA sequence + depth; `plates/` actor | the WWDC-grade tier |
| 1.11 | ★ **3D asset kit v1** — `nic_board`, `cpu_die`, `dimm`, `pcie_slot`, each with `push_in` + `turntable_90` baked | lit from tokens, alpha, versioned |
| 1.12 | Auto-generated `Still*` / `Prev*` review scenes | ep02 writes these by hand |
| 1.13 | CLI: `abs new episode`, `abs plan`, `abs render` | |
| 1.14 | Tests: unit, contract, timing, first golden frames | |

**Gate — three deliverables, all visible:**

1. **`s01e02` rendered to 16:9 and 9:16 from one shot set**, neither derived from the other, with
   near-zero per-target overrides. Measured against today: 194 KB across two files → one shot set.
2. **A third format costs nothing.** `abs render --target 1x1` produces a legible square cut of the
   same episode **without editing a single file inside that episode.** This is the real proof of
   format-genericness, and it is cheap to test.
3. **A real 3D hero shot** — a lit, materialled NIC board with a push-in, alpha-composited under
   the yellow pointer arrow, at zero per-episode render cost, correct in every target.

If 1 or 2 slips, the relation vocabulary is under-expressive and gets fixed before Phase 2. If 3
slips, Tier 2 was underestimated and Tier 1 carries the 3D story forward.

---

## Phase 2 — Story and scale
**~4 weeks · Goal: three more episodes, each cheaper than the last**

| # | Work | Notes |
|---|---|---|
| 2.0 | ★ **Concept SDK**: three kinds (atomic / interaction / composite), schemas, loader, closure checks | the decision on W11; see CONCEPT-ARCHITECTURE.md §5 |
| 2.0a | ★ **Concept migration**: `language.yaml` restricted to atomic; `dma` and `copy` become interactions | §17.4 — the only change touching code already written |
| 2.0b | ★ **Salience + closure updates**: primaries == declared participants; an interaction may not precede its participants | §5.4, §12.5 |
| 2.1 | **Storyboard Engine**: `picture.md` → script → beats → shot list → contact-sheet PDF | enforces storyboard-before-animation |
| 2.2 | Shot templates: reveal, compare, journey, cost-column, recap | ep01's "two lanes" and ep02's "copy chain" become reusable |
| 2.3 | **Phrase library v1** — `dma_write_burst`, `context_switch`, `ring_produce_consume`, `cache_line_bounce`, `syscall_cross` | where compounding starts |
| 2.4 | Actors +12: `Mempool`, `Cache`, `CacheLine`, `HugePage`, `Ring`, `Descriptor`, `WorkerCore`, `Thread`, `Lock`, `KernelSpace`, `UserSpace`, `Queue` | driven by episodes 3–7 |
| 2.5 | 3D asset kit v2: `heatsink`, `ddr_module`, `switch_chassis`, exploded views | |
| 2.6 | **Asset registry** + `assets.lock` + contract tests + previews | |
| 2.7 | **Render cache** (content-hash) + render manifest | makes iteration bearable |
| 2.8 | `timeline drift` — re-cut safety | |
| 2.9 | **Publishing**: per-platform encodes, captions, thumbnails, metadata | formats already solved in §1.7; this is delivery only |
| 2.10 | Docs site (mkdocs): actor reference, phrase recipes, ADRs | |

**Gate:** Episodes 3 (Poll-mode), 4 (NUMA), 5 (False sharing) shipped, each in every declared
target from a single authoring pass. Measured: authoring time per episode trending **down**, and
per-episode layout overrides staying near zero.

These three episodes are the right gate for the concept hierarchy specifically, because all three
are **Interaction Concepts** — `polling` (contrast-defined), `numa` (core ↔ locality),
`false_sharing` (thread ↔ cache_line). If the hierarchy is going to fail, it fails here rather
than in a later pillar. Additional measure: episodes 4 and 5 should share the
`race` staging template and re-use `cache_line` and `core` without re-authoring either.

---

## Phase 3 — Live 3D
**~6 weeks · Goal: shots that baked plates cannot fake**

> **Revised 2026-09 — renderer selection (ARCHITECTURE.md §8.0a).** Live 3D arrived first through
> **Three.js**, not Blender: `s01e03-what-is-a-nic` is a full episode on the Three.js video
> backend, and the same scene is the NIC interactive page. 3D hero shots now default to
> Three.js. The Blender items below remain valid but are a **specialist** path, taken only for
> shots Three.js cannot reasonably produce — not the default route to 3D.

Only now, and only because Tier 2 has already been carrying the 3D look for two phases.

| # | Work | Notes |
|---|---|---|
| 3.1 | Blender backend, live path: headless `bpy`, per-shot RGBA + AOVs | Blender.app is installed; needs a CLI alias |
| 3.2 | ★ **Camera track bridge** — matrix export → Manim projection | §8.2; the make-or-break piece |
| 3.3 | `lighting/` — token-driven rigs, key/fill/rim, mood ramps | shared with Tier-2 bakes |
| 3.4 | `materials/` — semantic materials → Cycles/EEVEE node groups | "silicon", "copper trace", "data glow" |
| 3.5 | `compose/` — depth-aware layer stacking, LUT, audio mix | overlays occluded by 3D geometry |
| 3.6 | Blender impls for the hardware actors | Manim keeps diagrams and labels |
| 3.7 | Parallel / resumable render jobs | plates are minutes/frame |

**Gate:** one flagship episode where a label tracks a 3D board through a real camera move.
Candidate: **Ep 9 "RSS & multi-queue NICs"** or **Ep 15 "eBPF/XDP"**.

**Risk flag:** most likely phase to overrun. Placed third deliberately — by then the platform is
already producing videos *with* 3D, so a delay here costs polish, not output.

---

## Phase 4 — Production hardening
**Ongoing · Goal: the repo outlives its author's memory of it**

| # | Work |
|---|---|
| 4.1 | Deterministic re-render guarantee: nightly job re-renders the oldest episode, diffs the manifest |
| 4.2 | Render farm / parallel execution; remote cache |
| 4.3 | Contributor guide + actor-authoring kit + `abs new actor` scaffolder |
| 4.4 | Plugin API: third-party actor packs and backends without forking |
| 4.5 | Engine 1.0, semver discipline, deprecation policy live |
| 4.6 | Pillar 2 expansion (`actors/dist/`, `actors/db/`, `actors/cell/`) — **should require no engine redesign**, which is the architecture's final exam |

---

## Sequencing summary

```
 Phase 0  ██                extract idiom  →  ep02 renders frame-identical from the engine
 Phase 1  ████              formats + 3D   →  one source → any format, real hardware on screen
 Phase 2  ████              story + scale  →  Eps 3,4,5 shipped, all targets, cost trending down
 Phase 3  ██████            live 3D        →  flagship camera-tracked hybrid episode
 Phase 4  ~~~~~~~~~~        hardening      →  Pillar 2 with no redesign
```

The 3D ambition is deliberately spread across Phases 1 and 3 rather than deferred wholesale:
Tier 1 and Tier 2 deliver most of the visible quality for a fraction of the effort, and they arrive
while the catalogue is still small enough for every episode to benefit.

---

## Decision points that need your input before Phase 1

These do not block approval of the architecture, but they shape Phase 1:

1. ~~Primary format.~~ **Resolved: there is no primary format.** 16:9 and 9:16 are peer targets;
   1:1 and 4:5 ship as profiles from day one. Nothing derives from anything.
2. **Concept SDK before or after the storyboard engine.** I have placed it first in Phase 2
   (2.0–2.0b) because episodes 4 and 5 are both interactions and the storyboard engine will want
   to read concepts. Say if you would rather ship the storyboard engine first.
3. **Which targets are declared by default** for a new episode. I have assumed `[16x9, 9x16]`, with
   `1x1` opt-in per episode. Say if every episode should also produce square by default.
4. **Which episode is the Phase-1 proof.** I have assumed **re-cutting `s01e02`**, because you can
   diff it against a known-good result in both formats. The alternative is making Ep 3 the first
   Studio-native episode and leaving Ep 2 alone.
5. **3D source.** Tier 2 needs `.blend` sources for the hardware kit. Do you want to model these,
   commission/buy them, or should the kit start from parametric Blender scripts the Studio generates
   (lower fidelity, fully versionable, no external dependency)?
6. **Repo topology.** I have assumed `axiobyte-studio/` is a **new git repository**, with the
   `axiobyte-system/` episodes kept read-only as the specification until Phase 0's gate passes.

---

## The measure of success

Not lines of code, not subsystem count. Three numbers:

1. **Time to produce episode N** — must trend down, monotonically.
2. **Lines of episode-specific code** — `ep02` is ~2,000 *per format*. By Episode 10 a shot set
   should be a few hundred lines total, serving every format.
3. **Per-episode layout overrides** — must stay near zero. A climbing count means the relation
   vocabulary is too weak and the *engine* needs work, not the episode.

When Episode 20 is a `picture.md`, a script, an audio file, a cue table, and a shot list — and it
ships in every format, with 3D hardware in it, over a weekend — the architecture worked.
