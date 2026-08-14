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

Expected clean state on Windows: **459 passed, 12 skipped, 0 failed** — the 10 reference
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
AXIOBYTE_REFERENCE_ROOT=/nonexistent pytest      # expect 461 passed, 10 skipped
```

(461, not 459, because Blender *is* installed here — only the reference tests skip.)

Expected clean state on macOS: **471 passed, 0 skipped, 0 failed.**

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

## Before you push, from either machine

```bash
ruff check src tests && ruff format --check src tests && mypy && lint-imports && pytest
```

All five, every time. Renders are never committed
([`ARCHITECTURE.md`](ARCHITECTURE.md) §6) — if `git status` offers you a `.png` under
`out/` or `media/`, something is wrong with the ignore rules, not with the file.
