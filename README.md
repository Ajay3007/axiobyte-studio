# AxioByte Studio

**A systems visualization framework.** Not an animation library that happens to cover systems
topics — a machine for turning a computer-science idea into the specific sequence of images that
makes that idea unavoidable.

```
An animation framework asks          A systems visualization framework asks
────────────────────────────         ─────────────────────────────────────
Does it look good?                   Did the viewer understand?
Is the motion smooth?                Does the motion mean something?
Can I animate this?                  Is this composition true to the system?
What's on screen?                    What misconception is this frame destroying?
```

Every subsystem exists to make the right-hand column mechanically checkable.

**Renderer-agnostic.** The Studio generates educational video; **Manim, Three.js and Blender are
peer backends**, chosen *per shot* — the simplest one that achieves the shot, and Blender only
when its capabilities are genuinely needed ([`ARCHITECTURE.md`](ARCHITECTURE.md) §8). One episode
can mix renderers; the composer assembles the clips. Three.js also has a **web target**: the same
scene that renders a film can be served as an interactive page.

### One ecosystem, two repositories

| Repository | Role |
|---|---|
| **axiobyte-studio** (this repo) | Everything that *makes* things: the engine, concepts, renderers, episodes, and the source of every interactive representation (`experiences/`) |
| [**Ajay3007.github.io**](https://github.com/Ajay3007/Ajay3007.github.io) | Everything that *shows* things: the public site. It pins a release of `experiences/` and serves it at `https://ajay3007.github.io/axiobyte/<domain>/<concept>/` — e.g. [`/axiobyte/networking/nic/`](https://ajay3007.github.io/axiobyte/networking/nic/). It holds no engine source. |

Deployment is described in [`docs/deployment.md`](docs/deployment.md).

---

## Read these first

| Document | What it covers |
|---|---|
| [`CONCEPT-ARCHITECTURE.md`](CONCEPT-ARCHITECTURE.md) | **The semantic layer** (L7–L3): concepts, actors, actions, motion, camera, educational grammar. No renderer is mentioned in it. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | **The rendering layer** (L2–L1): Shot IR, format-agnostic layout, themes, assets, the 3-tier 3D strategy, backends. |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Coding standards, naming, and the rules CI enforces. |
| [`ROADMAP.md`](ROADMAP.md) | Phased plan and the acceptance gate for each phase. |
| [`SETUP.md`](SETUP.md) | Getting the Studio running on a new machine — Windows, macOS, Linux. |

---

## Three rules the whole system rests on

**THE ONE RULE — nothing is eyeballed.** Every beat is anchored to a word start in the voiceover,
and the whole cue table resolves *before anything renders*. A re-cut voiceover fails loudly instead
of drifting an episode silently out of sync.

**THE ONE PICTURE — every episode has a visual thesis.** Written before the storyboard, and
partly machine-checkable. *"The bytes sit still for two minutes while a yellow arrow does all the
travelling"* is not a caption; it is the literal state of the screen.

**COLOUR IS MEANING — one hue per idea, and nothing borrows a hue it does not own.** Roles live in
`design/language.yaml`; values live in `design/themes/`. Red means *bytes actually moved*, which is
why the absence of red is the argument in the zero-copy episode.

---

## Status

**Phase 0 — extracting the idiom from the reference episodes.**

| Subsystem | State |
|---|---|
| Core errors | ✅ |
| Timeline Engine (cue resolution, fail-fast) | ✅ |
| Design System (theme, visual language registry) | ✅ |
| Layout System (relations, targets, density budgets) | ✅ |
| Typography (the type ladder) | ✅ |
| Chrome (keyword bar, caption bar, platform-safe) | ✅ |
| SVG preview backend | ✅ |
| Motion Language (signatures, inheritance) | ✅ |
| Actor System (state machines, anchors, salience) | ✅ |
| Action System (invariants, costs, negation) | ✅ |
| Manim backend (shapes, chrome, easing, cue-driven scene) | ✅ |
| Components (glow, pill, tag, link, meters, title cards) | ✅ |
| Cue-driven acts (`at`, `until`, `window`) | ✅ |
| Concept SDK (atomic / interaction / composite) | ✅ |
| Episode scaffolding, derived from concepts | ✅ |
| Storyboard Engine (picture, beats, plan cascade) | ✅ |
| `abs` CLI | ✅ |
| Render pipeline (plan-gated) + contact sheet | ✅ |
| Content-hash render cache + reproducibility manifest | ✅ |
| Generated scenes — a new format costs no episode change | ✅ |
| Golden tests (semantic · layout · perceptual) | ✅ |
| 3D Tier 1 — isometric solids (no renderer) | ✅ |
| 3D Tier 2 — baked Blender plates | ✅ |
| 3D Tier 3 — live Blender + camera bridge | ⬜ |
| Three.js backend — video target (deterministic frames → clip) | ✅ |
| Three.js backend — web target (interactive representations) | ✅ |
| Per-shot renderer selection (`renderer:` on a shot) | ✅ |
| Composer v0 — concatenate per-shot clips + voiceover | ✅ |
| Educational Grammar | ⬜ |
| Full ep02 reproduction (Phase 0 gate) | ⬜ |

Open `docs/previews/index.html` for one shot solved to 16:9, 9:16 (Reels) and 1:1, and
`docs/previews/render/` for the same shot actually rendered through Manim in two formats.

Three episodes are authored. `s01e01-kernel-slow` and `s01e02-zero-copy` (Manim) are anchored
to the reference episodes' own voiceovers. `s01e03-what-is-a-nic` is an 11:59 film on the
**Three.js backend** whose scene is also the interactive NIC at
[`/axiobyte/networking/nic/`](https://ajay3007.github.io/axiobyte/networking/nic/).

```bash
# a Three.js episode: shot by shot, then assembled with its voiceover
.venv/bin/abs render  episodes/s01e03-what-is-a-nic --headless
.venv/bin/abs compose episodes/s01e03-what-is-a-nic
.venv/bin/abs preview episodes/s01e03-what-is-a-nic --open   # live, with the voiceover

# the interactive experiences
.venv/bin/abs web dev        # → http://localhost:5173/networking/nic/
.venv/bin/abs web build && .venv/bin/abs web test
```

```bash
# scaffold the next episode from the concepts it will teach
.venv/bin/abs new episode s01e05-false-sharing \
    --concept false_sharing --concept padded_variables

# validate an episode — renders nothing
.venv/bin/abs plan episodes/s01e02-zero-copy --concepts
.venv/bin/abs concept show zero_copy
.venv/bin/abs concept stats

# what a re-cut voiceover did to this episode's beats
.venv/bin/abs timeline drift episodes/s01e02-zero-copy --since old-words.json

# the board you approve before animating
.venv/bin/abs storyboard sheet episodes/s01e02-zero-copy

# validate, then render every declared target — refuses if the plan fails
.venv/bin/abs render episodes/s01e02-zero-copy --still
# a second identical render does not happen at all; --no-cache forces it

# a still, both formats from one shot
.venv/bin/manim -s -ql --format=png examples/zero_copy_shot.py ZeroCopyWide
.venv/bin/manim -s -ql --format=png examples/zero_copy_shot.py ZeroCopyTall

# a real act, timed off Episode 02's own voiceover
.venv/bin/manim -qh --fps 60 examples/ep02_act_zerocopy.py ActZeroCopyWide
.venv/bin/manim -qh --fps 60 examples/ep02_act_zerocopy.py ActZeroCopyTall
```

The reference episodes (`axiobyte-system/ep01`, `ep02`) are the specification, and Phase 0's gate is
re-rendering `ep02` frame-identically from this engine.

---

## Development

On a new machine — including Windows — follow [`SETUP.md`](SETUP.md) instead.

```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[dev,manim]"

.venv/bin/pytest                    # unit tests
.venv/bin/pytest -m reference       # tests against the reference episodes
.venv/bin/ruff check src tests
.venv/bin/mypy
.venv/bin/lint-imports              # the architecture's load-bearing contracts
```

The JavaScript half (`renderers/three`, `experiences/`) is an npm workspace at the root:

```bash
npm ci
npm test -w @axiobyte/three          # vitest
npm run build && npm test -w @axiobyte/experiences   # build + smoke test under /axiobyte/
```

Tests marked `reference` run against the real episode files and skip when absent. Point
`AXIOBYTE_REFERENCE_ROOT` at them to run those; everything else passes without them, and
running with it unset is how a portability regression gets caught before CI does.

CI runs the whole Python gate on Ubuntu **and** Windows (`ci.yml`), and the JavaScript checks
(`three.yml`), which also release the experiences — see [`docs/deployment.md`](docs/deployment.md).

---

MIT · Ajay Gupt
