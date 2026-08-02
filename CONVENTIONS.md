# AxioByte Studio — Coding Standards & Naming Conventions

**Status:** proposed, awaiting approval · Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md)

These are the rules that keep a five-year repository from decaying. Where a rule can be enforced by
a tool, it is — a convention that relies on memory is a convention that expires.

---

## Part I — Coding Standards

### 1. Language and baseline

| | |
|---|---|
| Python | **3.12+** (matches your local 3.12.7) |
| Style | `ruff format` (Black-compatible), line length **100** |
| Lint | `ruff` — pycodestyle, pyflakes, isort, bugbear, comprehensions, pyupgrade, pydocstyle |
| Types | `mypy --strict` on `src/axiobyte_studio/`; `basic` on `episodes/` |
| Tests | `pytest` + `pytest-xdist`; coverage gate on `core/`, `actors/`, `timeline/` |
| Env | `uv` for dependency resolution and locking (`uv.lock` committed) |
| Task runner | `just` — every workflow has a one-line entry point |

Every module starts with `from __future__ import annotations`. Every public function, class, and
verb is fully annotated. `Any` requires a comment explaining why.

### 2. The import contracts (mechanically enforced)

These are checked by `import-linter` in CI. They are the load-bearing rules of the architecture —
if only one thing from this document survives, it should be this table.

| # | Contract | Rationale |
|---|---|---|
| 1 | `manim`, `bpy`, `ffmpeg` importable **only** under `backends/` (and `compose/` for ffmpeg) | The tool-agnostic guarantee |
| 2 | `core/` imports nothing from the rest of the engine | Keeps the IR portable and tests fast |
| 3 | `actors/`, `design/`, `animation/` never import `backends/` | Dependency direction is one-way |
| 4 | Nothing in `src/` imports from `episodes/` | Episodes are leaves |
| 5 | `design/tokens/`, `design/themes/`, `design/targets/` import nothing | They are data, not code |
| 6 | No cross-imports between backend packages | Backends are peers, not a hierarchy |
| 7 | `layout/` never imports `design/themes/` | Layout is theme-blind; theme is layout-blind |

### 3. Determinism

Non-determinism in a render pipeline is a slow-motion disaster: you cannot cache it, test it, or
reproduce it.

- Every random draw goes through `core.rng.seeded(shot_id)`. Bare `random` / `np.random` is
  lint-banned in `src/`.
- No wall-clock time, no `os.environ` reads, no network access inside a render.
- Dict iteration order is relied upon only where insertion order is meaningful and documented.
- Every render writes a manifest: engine version, token version, backend versions, asset hashes,
  seed, tool versions.

### 4. Fail fast, fail loud, fail early

The most valuable property of your existing `ep01_video.py` is that a bad cue name raises **at
import**, not silently 40 seconds into a 6-minute render. Generalised into three rules:

1. **Validate at plan time.** Cue resolution, actor invariants, missing verb impls, missing assets,
   token lookups — all resolved before a single frame renders. `abs plan` is the gate.
2. **No silent fallbacks.** A missing token is an error, not a default grey. A missing verb impl is
   an error, not a no-op. Defaults hide breakage until it ships.
3. **Errors carry the fix.** One exception family in `core/errors.py`; every message names the
   offending symbol, the file, and the concrete next action.

```
CueNotFound: cue 'zerocopy.dma.write' not in episodes/s01e02-zero-copy/timeline/cues.yaml
  The word 'DMA' appears at sentence 4 word 11 (t=18.42s).
  Fix: add   zerocopy.dma.write: {word: "DMA", sentence: 4}
```

### 5. Code shape

- **Pure functions for layout and planning; side effects only in backends and `render/`.**
  Everything above the backend line should be testable without rendering anything.
- **Composition over inheritance.** Actors gain `Labelable`/`Highlightable`/`Activatable`-style
  capabilities from protocols, not from deep class trees.
- **A shot may not know its format.** No coordinates, no canvas size, no aspect ratio, no
  `if portrait:`. Shots state relations (`chain`, `pair`, `cluster`); the target profile supplies
  the axis. Lint-enforced in `episodes/*/shots/` — this is what makes every format a peer.
- **A shot may not know its theme.** No hex, no `#`, no colour name. Roles only.
- **Dataclasses for state**, frozen where possible. State transitions return new instances.
- **No module-level side effects** except registry registration via decorators.
- **Functions under ~40 lines; files under ~400.** A 97 KB, 2,039-line episode file — and its
  near-identical 97 KB sibling — is exactly the failure mode this repo exists to prevent.
- **No magic numbers in `src/` or `episodes/`.** Every duration, size, colour, and offset resolves
  through a token. Lint-enforced for hex colours; reviewed for the rest.

### 6. Documentation

- Google-style docstrings. `mkdocstrings` builds the API reference; a public symbol without a
  docstring fails the docs build.
- **Every actor docstring states four things:** the concept it represents, its visual identity
  (link into `language.yaml`), its verbs, and its invariants.
- Every phrase ships a recipe page with a rendered GIF.
- Architectural decisions that change §1–§8 of `ARCHITECTURE.md` get an ADR in `docs/adr/`.

### 7. Versioning and compatibility

- The engine is **semver**. `ir_version` is versioned separately and independently.
- Themes carry a version. A theme change that alters an existing actor's look is a **major** bump
  and requires golden-frame re-approval, per theme.
- Target profiles carry a version. Adding a target is **minor** (nothing existing changes);
  altering an existing target's safe zones or density budget is **major** — it re-lays every
  episode ever made, so it needs a full-catalogue layout-lint pass before it lands.
- **Deprecation policy:** deprecated symbols warn for two minor versions, then are removed.
  Deprecations are listed in `CHANGELOG.md` with the migration.
- **Old episodes must keep rendering.** `episode.yaml` pins the engine version it was authored
  against; CI re-renders one canonical frame from the oldest episode on every release. If that
  breaks, the release is blocked. This is the concrete mechanism behind "usable in five years".

### 8. Git

- Conventional commits: `feat(actors): add Mempool actor`, `fix(timeline): …`, `docs(…)`,
  `refactor(…)`, `chore(…)`.
- Branches: `feat/…`, `fix/…`, `ep/s01e02-zero-copy`, `spike/…`.
- Renders, `media/`, `__pycache__`, `out/`, `venv/` never committed. (Your current repo has all of
  these tracked — Phase 0 fixes it.)
- One PR = one capability, with tests and, if visual, a golden frame.

### 9. Performance budgets

Not premature optimisation — these are the numbers that decide whether the tool is pleasant to use:

| Operation | Budget |
|---|---|
| `abs plan` on a full episode | < 2 s |
| Draft render of one shot (`-ql`) | < 20 s |
| Full unit + contract + lint suite | < 60 s |
| Cache hit on unchanged shot | < 1 s |
| Full-episode 1080p60 re-render, all cached but one shot | ≈ one shot's cost |

---

## Part II — Naming Conventions

### 10. Python

| Kind | Convention | Example |
|---|---|---|
| Package / module | `snake_case`; plural for collections, singular for concepts | `actors/`, `core/registry.py` |
| Semantic actor class | Bare `PascalCase` domain noun — **no prefix** | `Packet`, `NIC`, `Mempool`, `Pointer` |
| Backend implementation | Backend-prefixed | `ManimPacket`, `BlenderNIC` |
| Style / preset enum | `<Actor>Style` | `NICStyle.FLAT`, `NICStyle.ISO` |
| Layout relation | lowercase noun, no axis in the name | `chain`, `pair`, `cluster` — never `row`, `column` |
| Verb | lowercase imperative — **never** `animate_` / `do_` | `travel`, `drop`, `attach`, `evict` |
| Phrase | `verb_noun` describing the set-piece | `dma_write_burst`, `context_switch` |
| Protocol | `PascalCase`, no `I` prefix | `Backend`, `Renderable` |
| Constant | `UPPER_SNAKE` | `DEFAULT_FPS` |
| Private | leading underscore, never exported | `_resolve_anchor` |

**The prefix rule, stated once:** the semantic name is bare; every backend-specific type carries its
backend as a prefix. This is what lets `Packet` mean the same thing in 2026 and in 2031, while
`ManimPacket` is free to be replaced.

> Migration note: where `manim-cs` geometry is harvested, the `M`-prefix (`MCPU`, `MNIC`) does not
> come with it — the code is re-skinned to ep02 tokens and renamed `ManimCPU`, `ManimNIC`.

### 11. Concepts, tokens, and cues

| Kind | Convention | Example |
|---|---|---|
| Atomic concept id | `snake_case` singular noun — a *thing* | `packet`, `cache_line`, `huge_page` |
| Interaction concept id | `snake_case`, names the *phenomenon*, never the pair | `false_sharing`, `zero_copy` — never `thread_cache_line` |
| Composite concept id | `snake_case`, names the *story* | `ngfw_fast_path`, `dpdk_rx_pipeline` |
| Design token | dotted, `category.role.variant` — **role, never appearance** | `color.packet`, `motion.packet.travel` |
| Motion token | `motion.<concept>.<verb>` | `motion.pointer.snap` |
| Depth band | `depth.<band>` — the ep02 Z-ladder, named | `depth.node`, `depth.pkt`, `depth.key` |
| Cue name | `<act>.<beat>.<event>`, all `snake_case` | `arrival.irq.fire`, `zerocopy.payoff.pointer` |
| Beat id | `<act>.<beat>` | `arrival.irq` |
| Layout slot | `snake_case` noun, the *thing*, not its position | `buffer`, `mbuf`, `copy_chain` |
| Target profile | `<w>x<h>.yaml`, ratio not resolution | `16x9.yaml`, `9x16.yaml`, `4x5.yaml` |
| Theme | `snake_case` noun naming the *domain*, not the colours | `systems.yaml`, not `blue_dark.yaml` |
| Plate asset | `<subject>__<move>@<semver>` | `nic_board__push_in@1.0.0` |

**Colour tokens name roles, not colours.** `color.packet`, never `color.blue`. The day the palette
is revised, `blue` becomes a lie in a thousand places; `packet` stays true. The reference episodes
already name by role in comments (`PKT`, `MEM`, `PTR`, `MBUF_C`) while binding to bare hexes at
module scope — tokens finish the job those comments started.

**Layout names must contain no direction and no format.** `buffer`, never `left_box`; `chain`,
never `row`; `pipeline`, never `horizontal_flow`. A name that encodes a position is a name that lies
in the other aspect ratio — which is precisely the bug the Layout System exists to remove. The same
applies to themes: `systems`, not `blue_dark`, because a theme renamed by its colours cannot be
recoloured.

### 12. Episodes, shots, and files

| Kind | Convention | Example |
|---|---|---|
| Episode id | `sNNeNN-kebab-slug` | `s01e02-zero-copy` |
| Shot file | `shot_NNNN_snake_slug.py` — 4 digits, **step 10** | `shot_0120_pointer_not_copy.py` |
| Shot id (IR) | `<episode>.<shot_file_stem>` | `s01e02.shot_0120_pointer_not_copy` |
| Pillar file | `pNN-kebab-slug.yaml` | `p01-high-performance-data-plane.yaml` |
| Asset id | `<domain>/<name>@<semver>` | `models/nic_smartnic@2.1.0` |
| Asset file | `snake_case`, **never** episode-named | `nic_smartnic.blend` |
| Docs / YAML | `kebab-case.md`, `kebab-case.yaml` | `getting-started.md` |
| Test | `test_<unit>_<expected_behavior>` | `test_cue_missing_word_raises` |
| Golden frame | `<concept_or_phrase>@<token_version>.png` | `packet@1.2.0.png` |

**Shot numbering steps by 10** so a shot can be inserted between 0120 and 0130 without renumbering
the episode. Small thing; saves real pain around edit time.

### 13. CLI

One binary, `abs`, verb-first and discoverable:

```
abs new episode s01e03-poll-mode --pillar p01
abs new actor mempool --domain memory
abs timeline transcribe episodes/s01e03-poll-mode
abs timeline drift    episodes/s01e03-poll-mode   # after a voiceover re-cut
abs storyboard build  episodes/s01e03-poll-mode   # → contact sheet, approve before animating
abs plan              episodes/s01e03-poll-mode   # validate everything; renders nothing
abs render            episodes/s01e03-poll-mode --shot 0120 --quality draft
abs compose           episodes/s01e03-poll-mode
abs publish           episodes/s01e03-poll-mode --target youtube,reels
abs lint | abs test | abs docs serve
```

Rules: every command is idempotent; every command that writes says where; every command that could
take more than a few seconds shows progress; `--dry-run` is available on anything destructive.

**An interaction is named for what it is, not for what it joins.** `false_sharing`,
never `thread_cache_line_interaction`. A name built from its participants is a name
that stops making sense the moment a third participant joins — and `tcp_congestion`
already has three. It also reads as plumbing rather than as a concept a viewer could
name, which is the actual test: **if a learner would not say the name out loud, it
is the wrong name.**

**When a name reads naturally as both an interaction and a composite, it is a
composite** (§17.2 of `CONCEPT-ARCHITECTURE.md`). `consensus` is a composite;
the interaction inside it is `leader_election`. A vague name at the interaction tier
produces a vague, forgettable episode.

### 14. The five naming rules that matter most

1. **Name by role, not by appearance.** `color.packet`, not `color.blue`.
2. **Name by concept, not by episode.** `nic_smartnic`, not `ep01_nic`.
3. **Name by meaning, not by tool.** `Packet`, not `PacketVGroup`.
4. **Name by relationship, not by orientation.** `chain`, not `row`.
5. **Name a relationship for the phenomenon, not its participants.** `false_sharing`,
   not `thread_cache_line`.

Each of these is the thing that, done wrong, forces a rename across the whole repo two years later.
Rule 4 is the newest and the one most easily lost: every `row`, `column`, `left`, `top`, `wide`, or
`tall` that reaches the semantic layer silently reintroduces a master aspect ratio.

---

## 15. What is enforced where

| Rule | Enforced by | When |
|---|---|---|
| Import contracts (§2) | `import-linter` | CI + pre-commit |
| Types | `mypy --strict` | CI + pre-commit |
| Format / lint / docstrings | `ruff` | CI + pre-commit |
| No raw hex outside themes | `design/lint.py` | CI |
| No format/orientation words in shot code | `layout/lint.py` | CI + `abs plan` |
| Layout valid in **every** declared target | `layout/lint.py` | `abs plan` |
| No unregistered concepts | `design/lint.py` | CI |
| Actor implements declared verbs | contract tests | CI |
| Visual language stability | golden frames | CI |
| Cue integrity, no drift | timing tests | CI + `abs plan` |
| Old episodes still render | release job | on release |
| Determinism | manifest diff on double render | nightly |
