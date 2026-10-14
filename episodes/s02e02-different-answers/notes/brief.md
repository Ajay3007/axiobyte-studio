# s02e02 — Why Does AI Give a Different Answer Every Time?

**PLANNING DRAFT — not approved.** Strategy and scope only: no script, audio, timeline, storyboard or
scenes exist, and none should be created until this brief is approved. Series standards:
[`docs/pillars/p02-ai-made-visual.md`](../../../docs/pillars/p02-ai-made-visual.md); strategy:
[`docs/pillars/p02-ai-made-visual-strategy.md`](../../../docs/pillars/p02-ai-made-visual-strategy.md).

Statements marked **[fact]** were verified in the repository on 2026-10-14; everything else is
recommendation or creative judgment.

## 1. Workflow audit

### What already works [fact]

- **The whole pipeline, end to end, in 9:16.** s02e01 went from approved script → creator's audio and
  `timeline.json` → `abs plan` → `abs render` (7 Three.js shots, native 1080×1920) → `abs compose
  --target 9x16` with the voiceover hash check → final MP4. A Three.js episode renders exactly the
  target it declares (`render/jobs.py`).
- **Guards:** a determinism baseline per episode (s02e01 10/10, s01e03 6/6), a mobile-safe audit
  (`episodes/s02e01-ask-chatgpt/three/check-safe-zones.mjs`), tests that every overlay cue draws and
  that illustrative values are labelled, and a platform-neutral end card for one master on two platforms.
- **A visual world to build on:** token tiles, learned-number columns, layers with causal attention,
  the probability panel with its weighted-pick strip, and the generation loop — about 1,800 lines in
  `episodes/s02e01-ask-chatgpt/three/`, of which the generic parts are `objects.js`, `prediction.js`,
  `bloom.js` and `safe.js`.
- **Publishing:** a package convention (`social/publishing-package.md`) with sourced platform rules.

### What is missing or at risk

| # | Gap | Evidence | Impact on s02e02 |
|---|---|---|---|
| G1 | **No checkpoint.** s02e01, the 9:16 render support, the neutral end card and the strategy documents are all uncommitted. | [fact] `git status`: 6 modified files, 3 untracked paths; HEAD is still `3a26da2` | Building s02e02 on top — especially promoting shared code — has no safe point to return to. **Highest risk.** |
| G2 | **Reuse is undecided.** The series rule says visuals move into shared code "on their second use"; s02e02 is that second use. | [fact] `docs/pillars/p02-ai-made-visual.md` | Either promote the generic pieces to `renderers/three/src/domains/ml/` (E01's baseline proves nothing moved), or copy them (fast, duplicated). |
| G3 | **The input-integrity gate was never built.** `abs plan` does not check the timeline's hash or its sync with the audio. | [fact] no timeline-hash step in `storyboard/plan.py` | Intake stays a manual check, as for s02e01. Workable, and it is how the 48.6 s variance was caught. |
| G4 | **New visual capabilities** this concept needs: a branching tree of token paths, a temperature control, and distributions that morph by the real temperature formula. | design need | Procedural Three.js work, no external assets: no Blender, Canva or new imagery required. |
| G5 | **No audience signal yet:** s02e01 is not published. | [fact] | The brief rests on judgment, not response data. Acceptable, and worth saying. |
| G6 | **No AI concepts in the concept SDK;** `abs plan` warns but passes. | [fact] | Not a blocker. |

**Verdict: ready for scripting, with conditions.** The production workflow supports s02e02 without
changes. Before building scenes, G1 must be settled (a checkpoint commit, which only you can authorize)
and G2 decided. Neither blocks the script itself.

## 2. Content brief

### The viewer's question
*"I asked the same thing twice and got two different answers. Is it broken?"*

### The single takeaway
**The model doesn't hold one fixed answer. At every step it produces a spread of probabilities for the
next token and draws from it — so the same question can unfold into different, equally reasonable
answers. A setting called temperature controls how adventurous those draws are.**

### The mechanism to make understandable
1. For the next token, the model gives every candidate a probability (E01 showed this once).
2. One is **drawn by weighted chance** — likely candidates usually, not always.
3. **Choices compound.** The drawn token joins the sequence and changes the next distribution, so two
   runs that differ by one early token drift further apart with every step.
4. **Temperature reshapes the spread** before the draw: low makes the likeliest token dominate (answers
   become very repeatable); high flattens it (more variety, and more odd choices).

### Visual thesis: *one question, many futures*
The answer is not a line but a **branching tree of possible continuations**, and the draws decide which
branch you walk. The teaching motions:

- **Rewind and redraw** (the core): the same distribution, the same moment, drawn twice — the marker
  lands on a different token, and the answer forks. Seeing the identical setup produce two outcomes is
  the explanation; no caption has to carry it.
- **Divergence compounds:** each fork grows its own next distribution; the camera pulls back from one
  path to reveal a tree of light — bright, likely trunks and faint, unlikely twigs.
- **The temperature control:** turning it reshapes every distribution live (bars sharpen to a spike or
  melt to a plateau), and the tree answers — collapsing to almost a single trunk when cold, bursting
  into a bush when hot, with odd branches lighting up.

**Continuity:** it opens and closes on E01's prompt bar and question ("Why is the sky blue?"), and
reuses E01's tiles, probability panel and pick strip, so the series' world grows rather than restarts.
New in E02: the tree and the control. The reference `nn_explained.MP4` shows a next-word distribution
(*p(next word | words so far)*) but always takes the top bar [fact, inspected at 0:26–0:38]; s02e02
shows what that picture leaves out.

### Balance
- **Visuals carry the mechanism;** narration names what the motion already shows.
- **Labels:** candidate tokens on tiles; percentages only during the draw; the control labelled
  "TEMPERATURE" with an ILLUSTRATIVE kicker, as in E01.
- **Captions:** one per beat, at most two lines.
- **Cinematic:** depth and the subtle attention bloom on the active path; the tree seen from inside,
  then from far away. No decorative particles, no brains or robots.
- **Systems/performance:** none forced. (A natural later hook: every new token is another full pass
  through the model — that belongs to the GPU episode.)

### Technical boundaries
- **Illustrative numbers, exact maths.** The scores are made up and labelled so; the distributions'
  change with temperature should still follow the real formula (scores divided by temperature, then
  turned into probabilities), so the shapes are honest even when the values aren't.
- **Low temperature means "far more repeatable", not "always identical".** Real systems can still vary
  slightly; avoid promising determinism.
- **Sampling is one major reason, not the only one.** In a product like ChatGPT, answers also differ
  because of conversation history, memory, model updates or tools. Say "a big part of why".
- **Don't state ChatGPT's settings.** They are not public, and the app does not expose them; speak about
  language models in general.
- **Randomness isn't creativity or mood.** Say variety, chance, choice — not "it changes its mind".
- **Variety isn't error.** Most variation is harmless rewording. If the film shows a hot path going
  wrong, it must not imply that sampling is *the* cause of wrong answers — that is E03's subject, and
  its causes are several.
- **Public, conceptual level only:** no specific model's internals, accelerator details or proprietary
  specifications.

### Scope
- **In:** next-token distribution, weighted draw, compounding divergence, temperature.
- **Reserved:** why answers can be wrong (E03), where the probabilities come from (E04, learning),
  top-p/top-k and other selection methods, random seeds, hardware-level nondeterminism, the cost of
  each token (the GPU episode).

### Duration and format
- **One native 9:16 master** for Reels and Shorts (under 3 minutes), combined safe area,
  platform-neutral end card — as s02e01.
- **Target narration 70–85 s** (about 180–220 words at s02e01's measured 155–159 words a minute), so
  about **75–90 s** with the hold and end card. Deliberately shorter than s02e01's 1:55, as the strategy
  proposes, and a single mechanism rather than a survey.
- Episode id: **`s02e02-different-answers`** (this folder; `sNNeNN-kebab-slug`).

### Suggested arc (for the script, not a shot list)
1. *Hook:* the same question, asked twice, two different answers — neither a mistake.
2. *Into the moment of choice:* the probability spread for the first token (E01's panel).
3. *Rewind, redraw:* a different token wins; the answer forks.
4. *Compounding:* forks grow into a tree; small chances, big differences.
5. *Temperature:* the control reshapes the spread; cold → nearly one path, hot → a bush.
6. *Payoff:* back at the prompt bar — variety is the design, not a bug; optional tease for E03.

## 3. Editorial roadmap

Each episode answers a question the previous one raises, so AI and systems connections arrive when the
explanation needs them rather than by rotation:

1. **s02e02 — different answers:** answers are draws from a spread of probabilities. *Raises: what if a
   draw, or the spread itself, is wrong?*
2. **s02e03 — confident and still wrong:** fluency comes from likely-sounding tokens, not from checking
   facts; how sure a sentence sounds and how likely it is to be right are different things. *Raises:
   where do those probabilities come from?*
3. **s02e04 — how AI learns:** guess, measure the error, adjust billions of numbers; the spreads are
   learned. *Raises: what does it take to compute all that?*
4. **The machine, when it's earned — why GPUs:** each token is a full pass through those billions of
   numbers; the systems pillar's first natural crossover.
5. **Attention — "what does 'it' mean?":** a deeper look inside the layers, once viewers know the world.

The alternatives in the strategy (strawberry, memory, parameters) stay available as swaps when early
response suggests everyday-experience questions work best.

## 4. Approval checklist — before scripting

1. **Approve this brief:** takeaway, mechanism, visual thesis, scope and the 70–85 s target.
2. **Running example:** continue E01's "Why is the sky blue?" (continuity; the variation is rewording of
   a correct answer) — or use a question where variety is the point (for example a name or a first
   line)? Recommendation: continue E01's.
3. **The E03 tease:** end on a hot, unlikely path producing a fluent but wrong answer (for example
   "…because it reflects the ocean", a common misconception), or end without it? It bridges neatly but
   needs careful wording so it doesn't claim sampling is why answers go wrong. Recommendation: include
   it, worded as "a less likely path *can* end somewhere wrong", with E03 to explain.
4. **Checkpoint (G1):** authorize a commit of the current work — s02e01, the 9:16 support, the end
   card and the strategy documents — before s02e02 production begins.
5. **Reuse (G2):** promote E01's generic visuals to `renderers/three/src/domains/ml/` (recommended;
   s02e01's determinism baseline guards it), or copy them into this episode?
6. **Integrity gate (G3):** keep the manual intake check, or build the planned automatic check first?
7. **s02e01 publishing decisions** from the package (AI label, optional YouTube disclosure line, cover
   frame) — independent of this brief, but still open.
