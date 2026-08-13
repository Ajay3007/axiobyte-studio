# Setting up AxioByte Studio on a second machine

Written for **Windows**, with the macOS and Linux differences noted inline. The engine
itself is platform-agnostic; only three things differ, and all three are listed in
[§4](#4-what-actually-differs-on-windows).

---

## 1. What you need

| | Version | Why | Optional? |
|---|---|---|---|
| **Python** | 3.12+ | `requires-python = ">=3.12"`; the code uses 3.12 syntax | required |
| **Git** | any | | required |
| **DejaVu fonts** | any | the first-choice faces in `design/tokens/type.yaml` | **strongly recommended** — see §4.3 |
| **Blender** | 3.6+ | baking Tier-2 plates only | optional |
| **LaTeX** | — | **not needed.** Nothing uses `MathTex` | no |

Manim's own binary dependencies (cairo, pango, ffmpeg) arrive as wheels on
Windows and macOS. Only Linux needs system packages — see §4.5.

---

## 2. Get it running

Everything below is PowerShell, from the directory you want the repo in.

```powershell
git clone https://github.com/Ajay3007/axiobyte-studio.git
cd axiobyte-studio

py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -e ".[dev,manim]"
```

If `Activate.ps1` is blocked by execution policy:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

> **Install `[dev,manim]`, not `[dev]`.** `mypy` type-checks the Manim backend, so
> without Manim present it reports 14 phantom import errors on a perfectly healthy
> tree. This is exactly what CI got wrong on its first run.

**macOS / Linux:** `python3 -m venv .venv && source .venv/bin/activate`, then the same
`pip install`.

---

## 3. Verify the install

Run the same five gates CI runs. All five must pass before you write any code.

```powershell
ruff check src tests
ruff format --check src tests
mypy
lint-imports
pytest
```

Expected, as of the last commit on `main`:

```
All checks passed!
78 files already formatted
Success: no issues found in 59 source files
Contracts: 3 kept, 0 broken.
471 passed
```

Then confirm the CLI resolved:

```powershell
abs --version
abs targets
abs concept stats
abs plan episodes/s01e02-zero-copy --concepts
```

`abs targets` should print three profiles — `16x9`, `1x1`, `9x16`. `abs concept stats`
should report 20 concepts and a 0.4 interaction ratio.

Finally, prove rendering works end to end:

```powershell
abs render episodes/s01e02-zero-copy --still
```

A second identical run should skip entirely — that is the content-hash cache doing its
job, not a failure. `--no-cache` forces it.

---

## 4. What actually differs on Windows

Four of these are handled for you. The fifth is on you.

### 4.1 Executables live in `Scripts\`, not `bin/`

The README's commands are written as `.venv/bin/abs …`. On Windows that path is
`.venv\Scripts\abs.exe`. **Activate the venv** and drop the prefix entirely — every
command in this document assumes an activated venv, which is why none of them carry one.

### 4.2 Manim discovery — handled

`RenderJob.command` locates Manim with `shutil.which(path=<venv scripts dir>)`, which
understands both `bin/manim` and `Scripts\manim.exe`. Nothing to configure.

### 4.3 Fonts — **your one manual step**

`design/tokens/type.yaml` declares:

```yaml
sans: ["DejaVu Sans", "Helvetica Neue", "Helvetica"]
mono: ["DejaVu Sans Mono", "Menlo", "Andale Mono"]
```

First available wins. **DejaVu is first on purpose** — it is the cross-platform anchor,
and it is what the reference episodes render with. But Windows ships none of these
three, so without DejaVu every fallback misses and Pango substitutes something
arbitrary.

The golden tests use a 16×16 perceptual hash that is deliberately tolerant of font
*hinting* differences across platforms — but not of a different typeface. Skip this step
and the perceptual goldens will drift for a reason that has nothing to do with your code.

Install DejaVu (free, ~2 MB): download from
[dejavu-fonts.github.io](https://dejavu-fonts.github.io/), select all `.ttf` files,
right-click → **Install for all users**. Then confirm Pango sees them:

```powershell
python -c "from manim import Text; print(Text('x', font='DejaVu Sans'))"
```

### 4.4 Blender discovery — handled

`blender_binary()` checks `PATH`, then the macOS app bundle, then both Program Files
roots (`Blender Foundation\Blender X.Y\blender.exe`), newest version first. The Windows
installer adds nothing to `PATH`, which is why the lookup exists.

Only needed for `abs asset bake`. **Episodes that merely use already-baked plates never
need Blender installed** — that is the entire point of Tier 2, and `assets/plates/` is
committed.

### 4.5 Linux only — system packages

```bash
sudo apt install libcairo2-dev libpango1.0-dev ffmpeg   # Debian/Ubuntu
```

---

## 5. Keeping the two laptops in sync

The repo is **private** under `Ajay3007`. On the second machine, authenticate once:

```powershell
gh auth login          # choose Ajay3007
git config user.name  "Ajay Gupt"
git config user.email "ajaymaddheshiya33@gmail.com"
```

Set the identity **per-repo** as above rather than globally, so a second GitHub account
on that machine cannot quietly author commits here. All 18 original commits are authored
`Ajay Gupt <ajaymaddheshiya33@gmail.com>`; keep it that way.

### What is and isn't committed

`.gitignore` encodes a rule from `ARCHITECTURE.md` §6: **renders are never committed,
because they are reproducible by definition.** So `out/`, `media/`, `*.mp4`, and most
`*.png` stay local.

Three categories are deliberately exempt, and you *do* get them on clone:

- `docs/previews/*.svg` and `docs/previews/render/*.png` — how a shot gets reviewed in
  every format
- `assets/plates/**/*.png` — baked Tier-2 plates, so Blender stays optional

This means **the second laptop will not have your local `episodes/*/out/` renders**, and
should not. Re-render them; if a render differs, that is a real signal, not noise.

### Working across two machines

`git pull --rebase` before starting, push before stopping. CI runs the full gate on
**both Ubuntu and Windows** for every push, so a change that only works on one platform
fails on the commit that introduced it rather than the next time you open the other
laptop.

---

## 6. Where to pick up

Current state: 471 tests, 60 source files, ~10.5k LOC, all gates green, 23 subsystems
built. `ROADMAP.md` has the full phase plan. What is open, in the order worth doing:

| | Work | Why this order |
|---|---|---|
| 1 | **Full `ep02` reproduction** | This is *Phase 0's* gate and it is still unchecked while Phase 1 and 2 work is largely done. It is the proof the extraction lost nothing — and per `ROADMAP.md`, far cheaper to learn now than in month six. Do this before Phase 3. |
| 2 | **Educational Grammar** | Last unbuilt subsystem in the semantic layer (`CONCEPT-ARCHITECTURE.md`) |
| 3 | Phase 2 leftovers | phrase library v1, actors +12, 3D asset kit v2, publishing (encodes/captions/thumbnails), docs site |
| 4 | **3D Tier 3** — live Blender + camera track bridge | `ROADMAP.md` flags it as most likely to overrun; deliberately last, since Tiers 1–2 already carry the 3D look |

Start on the Windows laptop with §3's verification. If all five gates pass and
`abs render` produces a still, the environment is correct and the difference between the
machines is nil.
