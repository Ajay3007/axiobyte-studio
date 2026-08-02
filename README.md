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

---

## Read these first

| Document | What it covers |
|---|---|
| [`CONCEPT-ARCHITECTURE.md`](CONCEPT-ARCHITECTURE.md) | **The semantic layer** (L7–L3): concepts, actors, actions, motion, camera, educational grammar. No renderer is mentioned in it. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | **The rendering layer** (L2–L1): Shot IR, format-agnostic layout, themes, assets, the 3-tier 3D strategy, backends. |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Coding standards, naming, and the rules CI enforces. |
| [`ROADMAP.md`](ROADMAP.md) | Phased plan and the acceptance gate for each phase. |

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
| Layout System | ⬜ |
| Chrome (keyword bar, caption bar) | ⬜ |
| Actor / Action / Motion systems | ⬜ |
| Manim backend | ⬜ |

The reference episodes (`axiobyte-system/ep01`, `ep02`) are the specification, and Phase 0's gate is
re-rendering `ep02` frame-identically from this engine.

---

## Development

```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"

.venv/bin/pytest                    # unit tests
.venv/bin/pytest -m reference       # tests against the reference episodes
.venv/bin/ruff check src tests
.venv/bin/mypy
.venv/bin/lint-imports              # the architecture's load-bearing contracts
```

Tests marked `reference` run against the real episode files and skip when absent.

---

MIT · Ajay Gupt
