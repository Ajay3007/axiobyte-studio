# Working on AxioByte Studio

This project is developed on **two machines, one at a time** — a Windows laptop and a
Mac. They have different capabilities, so **the first thing to establish in a session is
which machine you are on.**

```bash
python -c "import platform; print(platform.system())"    # Windows | Darwin
```

Coding standards live in [`CONVENTIONS.md`](CONVENTIONS.md) and apply on both machines.
This file covers only what differs between them.

---

## The rule that protects everything else

Work happens on **one machine at a time**, directly on `main`. There is no parallel work
and therefore no merge conflicts — *provided* the handoff is clean. The handoff is the
only fragile part of this setup, so treat both halves as non-negotiable:

```bash
git pull --rebase origin main    # FIRST thing, every session, before reading any code
# ... work ...
git push origin main             # LAST thing, before switching machines
```

**Starting work without pulling is the failure mode.** Unpushed work on the other laptop
plus new commits here is exactly the divergence the one-at-a-time model exists to avoid,
and it is silent until it isn't. If `git status` shows the branch behind or ahead
unexpectedly, stop and reconcile before writing anything.

CI runs the full gate on **both Ubuntu and Windows** for every push, so a platform break
fails on the commit that caused it.

---

## Windows — writing and enhancing code

**Can:** write and refactor engine code, add tests, run the full unit suite, run
`ruff` / `mypy` / `lint-imports` / `pytest`, use the `abs` CLI for `plan`, `concept`,
`storyboard`, `timeline`, `new episode`.

**Cannot, and must not attempt:**

| Unavailable | What it means for you |
|---|---|
| **Blender** is not installed | Never run `abs asset bake`. Write bake code, then leave verification to the Mac. 2 tests in `test_plates.py` skip. |
| **The reference episodes** are not cloned | 10 tests in `test_timeline.py` skip. **This is correct — not a problem to fix.** |
| **Visual verification** | You cannot judge a render. There is no committed pixel baseline, so nothing red will tell you a frame is wrong. |

**Never run `UPDATE_GOLDEN=1 pytest` on Windows.** It rewrites the committed contract
between the two machines. The goldens are deterministic text, so it would *appear* to
work — but you would be deciding a visual change is correct while unable to see a render
or the reference episodes. That decision belongs on the Mac.

Expected clean state on Windows: **500 passed, 12 skipped, 0 failed** — the 10 reference
tests plus the 2 Blender ones. This is exactly what CI's `windows-latest` job reports, so
if your numbers differ, compare against the latest green run rather than guessing.

**Fonts:** DejaVu Sans and DejaVu Sans Mono must be installed
([`SETUP.md`](SETUP.md) §4.3). They are the first faces in `design/tokens/type.yaml` and
Windows ships none of the declared fallbacks. No test catches their absence — the two
machines would simply start producing different-looking output, silently.

When you finish something that changes what appears on screen, **say so explicitly in
the commit message**, so the Mac session knows to look at it.

---

## macOS — testing and verification

Everything Windows can do, plus the three things only this machine can:

1. **The reference episodes** at `AXIOBYTE_REFERENCE_ROOT`
   (default `~/Documents/dev/projects/Ajay3007.github.io/_learning/manim-scripts/axiobyte-system`).
   Run `pytest -m reference`. This machine alone can attempt **Phase 0's gate** —
   re-rendering `ep02` frame-identically, still the project's oldest open commitment.
2. **Blender** at `/Applications/Blender.app` — `abs asset bake` for Tier-2 plates.
3. **Visual sign-off** — actually rendering and looking at the output.

This machine owns golden updates. When a change is *supposed* to move a golden:

```bash
UPDATE_GOLDEN=1 pytest          # then read the diff before committing it
```

Read the diff. A golden that updates without being examined is not a test.

Verify portability before pushing, since a green run here can still be Mac-only:

```bash
AXIOBYTE_REFERENCE_ROOT=/nonexistent pytest      # expect 502 passed, 10 skipped
```

(502, not 500, because Blender *is* installed here — only the reference tests skip.)

Expected clean state on macOS: **512 passed, 0 skipped, 0 failed.**

---

## The Three.js backend and the experiences (JavaScript)

`renderers/three/`, `experiences/` and each Three.js episode's `three/` folder are an npm
workspace at the repository root (`npm ci` once). Node ≥ 20.19 on both machines.

| | Windows | macOS |
|---|---|---|
| `npm test -w @axiobyte/three` (vitest), `abs web build` | ✅ | ✅ |
| `abs web test` (smoke test under `/axiobyte/`) | ✅ with Chrome installed | ✅ |
| `abs render` / `abs compose` a Three.js episode | needs Chrome **and** ffmpeg | ✅ |
| `check-determinism --expect <episode>/three/determinism.baseline` | ❌ the baseline is the Mac's | ✅ owns it |
| Judging a frame | ❌ | ✅ |

`abs render` runs Chrome **headful** by default (it gets the GPU and is faster) — a browser
window appears per shot. Pass `--headless` when working at the machine. A Three.js shot's
cache key includes the backend source, so editing `renderers/three/src/` during a render
invalidates the shots already written; don't edit it mid-render.

The voiceover (`episodes/*/audio/`) is never committed. Copy it in from wherever it is kept;
`abs compose` refuses a file whose sha256 differs from the one in `episode.yaml`.

---

## Portability rules, learned the hard way

Every one of these shipped as a bug that only appeared on the second machine.

**No absolute paths. Ever.** Two `episode.yaml` files pointed at one Mac's filesystem and
produced 29 failures and 44 errors on a fresh clone. Resolve from `Path(__file__)` or the
episode root. An episode carries its own `timeline/words.json`.

**`.gitignore` exceptions go *below* the pattern they override.** Git applies the last
matching rule, so `!assets/plates/**/*.png` written above `*.png` is silently inert —
which is how the baked plates shipped a manifest with none of its 16 frames. Verify with
`git check-ignore -v <path>`.

**A test that skips is not a test that passes.** `test_drift.py` guarded a hardcoded Mac
path with `pytest.skip`, so it never ran anywhere else and nobody noticed for months. If
you add a skip, make sure its condition is one the other machine actually meets.

**Locate executables with `shutil.which`, not `.exists()`.** It is `bin/manim` here and
`Scripts\manim.exe` there.

---

## What to work on next, and where

[`ROADMAP.md`](ROADMAP.md) has the full plan but predates the two-machine split, so it
does not say which work can happen where. Roughly half the remaining work needs
capabilities Windows does not have.

| Open work | Machine | Why |
|---|---|---|
| **Educational Grammar** (`CONCEPT-ARCHITECTURE.md` §11) | **Windows** | Pure semantic layer, no renderer. Fully specified, and `storyboard/scaffold.py` already implements §11.4's scaffold-then-refine half. |
| Phrase library v1 (ROADMAP 2.3) | **Windows** | Composition over existing actors and actions |
| Actors +12 (ROADMAP 2.4) | **Windows** | Pure code and unit tests |
| Docs site, mkdocs (ROADMAP 2.10) | **Windows** | |
| **Phase 0 gate — `ep02` frame-identical** | **macOS only** | Needs the reference episodes |
| 3D asset kit v2 (ROADMAP 2.5) | **macOS only** | Needs Blender |
| Tier 3 — live Blender (ROADMAP 3.x) | **macOS only** | Needs Blender |
| Publishing (ROADMAP 2.9) | **macOS** | Needs real renders to encode |

**Educational Grammar is the recommended next Windows task.** It is described as *"the
centre of the architecture — the compiler pass that turns what you want to teach into
what appears on screen"*, its five clauses (`WHEN` / `GIVEN` / `THEN` / `ASSERT` /
`NARRATION_CONTRACT`) are specified precisely enough to implement directly, and the
`ASSERT` layer is exactly the kind of thing unit tests can verify without ever rendering
a frame. What is missing is the rule engine: rule definitions, priority ordering,
conflict detection as a plan-time error (§11.5), and `abs stage <shot>`.

**Phase 0's gate remains the project's oldest open commitment** and cannot be done on
Windows. Plan a Mac session for it rather than discovering that mid-task.

---

## Before you push, from either machine

```bash
ruff check src tests && ruff format --check src tests && mypy && lint-imports && pytest
npm test -w @axiobyte/three && npm run build && npm test -w @axiobyte/experiences   # if JS changed
```

All five (and the JS three when it changed), every time. Renders are never committed
([`ARCHITECTURE.md`](ARCHITECTURE.md) §6) — if `git status` offers you a `.png` under
`out/` or `media/`, something is wrong with the ignore rules, not with the file.
