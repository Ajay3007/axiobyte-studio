# AI Made Visual — content strategy review (after E01)

A recommendation, not a commitment. Written 2026-10-14, after `s02e01-ask-chatgpt` was accepted as
final and before it was published. Production standards live in
[`p02-ai-made-visual.md`](p02-ai-made-visual.md); this document is about *what* to make next and why.

## What this rests on

**Evidence (inspected):**

- The brand positions AxioByte as *"Systems that power the Internet — explained from first
  principles"*, with Linux kernel, DPDK, networking, distributed systems and performance as core topics
  (`docs/brand/AXIOBYTE_BRAND.md`). AI Made Visual (`p02`) is new; the systems pillar
  (`p01-high-performance-data-plane`) has three episodes in the repository: s01e01 (kernel), s01e02
  (zero copy, with a YouTube package), s01e03 (NIC, 12 min, in progress).
- E01 is a **survey**: in 115 s it touches tokens, IDs, learned numbers, layers and attention,
  probabilities, sampling, iterative generation and stopping, and ends on *"an answer can sound confident,
  and still be wrong"*.
- E01's world is reusable code: token tiles, learned-number columns, layers with causal attention arcs,
  the probability panel and the generation loop (`episodes/s02e01-ask-chatgpt/three/`). The studio
  also has **released** 3D assets for a CPU, host memory and PCIe (`assets/library.yaml`).

**Not available:** channel analytics, audience data, subscriber counts, or any performance history. A
public search found no indexed information about the channel. Nothing below claims otherwise.

Everything else is **inference** (reasoning from the evidence) or **creative judgment** (taste), and is
marked as such where it matters.

## 1. Assessment of the proposed strategy

**Strong:**

- The three pillars name real viewer questions — *how does it work, what does it run on, where does it
  fail* — rather than engineering categories.
- Every proposed episode zooms into one beat of E01. That is the right shape: E01 is the map; each
  episode is a destination. It also lets the same visual world recur, which is how a recognisable look is
  built (judgment).
- "Understand the Machine" is AxioByte's natural advantage: few AI explainers can show the hardware
  underneath with systems depth, and this studio already has the assets and the identity for it.

**Weak or out of order:**

- **"Understand the Machine" overlaps the existing systems pillar.** CPUs, memory and networking are
  already `p01`. Inside AI Made Visual, the machine strand should be specifically *the machine behind
  AI* (GPUs, memory bandwidth, why inference costs what it does), and act as the bridge to `p01` — not
  a second systems series.
- **"Understand the Limits" works better as a lens than a pillar.** As a separate bucket it risks a run
  of cautionary episodes; as a lens, every mechanism episode ends on where it breaks (E01 already does
  this). Dedicated limits episodes still belong, when the limit *is* the mechanism.
- **E03 (similarity) repeats E01** more than any other proposal: E01 already says *"similar use, similar
  numbers"* and shows sky and cloud side by side. It needs a new idea, not a deeper version of that one.
- **E06 (attention) is framed for engineers.** "How does attention connect the words" is the mechanism's
  name, not the viewer's question. The same episode framed around *"how does AI know what 'it' means?"*
  is a question people actually have (judgment).
- **E04 is in the wrong place.** E01 *ends* on "confident, and still be wrong" — the strongest
  cliffhanger it has. Waiting three episodes to pay it off wastes it.
- **Missing: the questions general users already ask.** Why do I get a different answer each time? Does
  it remember me? Why can't it count letters? These come straight out of E01's mechanism and are cheap to
  produce in E01's world (inference).

**Are these videos people want to watch, or topics engineers find interesting?** Mostly the former, but
the titles drift toward the second. A useful test (judgment): *would someone who has never heard the word
"token" click this because it names something they've noticed?* "Why can AI sound confident and still be
wrong?" passes. "How does attention connect the words in a sentence?" does not, as written.

**Is E01 a good opening?** Yes, as a map: it establishes the world, the visual language and the honest
"illustrative" framing. Its limit is that a survey cannot have one big *aha* — every idea gets about ten
seconds. **E02 should deliver what E01 did not: one mechanism, one central visual transformation, one
takeaway**, shorter (about 60–90 s) and deeper.

## 2. Recommended pillars

Keep the brand's two series, and make the three questions *lenses* inside AI Made Visual:

| Series | What it covers |
|---|---|
| **Systems** (`p01`, existing) | How the infrastructure of computing and the Internet works |
| **AI Made Visual** (`p02`) | How AI works, made visible — through three recurring lenses: |
| ↳ *How it works* | the mechanism (tokens, learning, attention, generation) |
| ↳ *What it runs on* | the machine behind AI — the deliberate bridge to `p01` |
| ↳ *Where it breaks* | limits, as the closing beat of every episode, and as whole episodes when the limit is the mechanism |

This is the proposal's structure with two changes: the machine lens is scoped to *AI's* machine, and
limits are a lens first and a pillar second.

## 3. Ranked slate: the next five episodes

Ranked for order of release, balancing audience pull, technical build-up and production effort.

### 1. E02 — "Why Does AI Give a Different Answer Every Time?"
- **Hook:** You asked the same question twice and got two answers. Neither was a mistake.
- **Takeaway:** The model produces a probability for every possible next token and *samples* from it;
  the "temperature" setting sharpens or flattens that distribution.
- **Visual potential:** High. The same distribution drawn twice, diverging into two different sentences;
  one dial (temperature) morphing the distribution from a spike to a plateau. Motion carries the idea.
- **Relationship:** Zooms into E01's *"one is chosen, usually a likely one, but not always the
  likeliest"*; reuses E01's probability panel and generation loop almost directly.
- **Why first:** A universal, already-noticed experience; one clean mechanism; the lowest production
  cost of any candidate; and it builds the probability intuition E03 needs.

### 2. E03 — "Why Can AI Sound Confident and Still Be Wrong?"
- **Hook:** It never says "I'm not sure". Here is why fluent is not the same as true.
- **Takeaway:** The model picks plausible next tokens; fluency comes from that, not from checking facts.
  How sure it *sounds* and how likely it is to be *right* are different things.
- **Visual potential:** Medium-high. A fluent sentence building token by token while, underneath, some
  picks come from tall peaks and others from flat, uncertain spreads that look identical once written.
  Risk: drifting into text if the distributions are not the star.
- **Relationship:** Pays off E01's closing line directly; builds on E02's distributions.
- **Why second:** The strongest general-audience relevance in the slate (judgment), and it should follow
  E01 while that cliffhanger is fresh. Needs careful wording: the causes of errors are several, and the
  script must not reduce them to one.

### 3. E04 — "How Does AI Actually Learn?"
- **Hook:** Nobody programs the answers. It starts out wrong about everything, and gets nudged.
- **Takeaway:** Training is guessing the next token, measuring how wrong the guess was, and adjusting
  billions of numbers a tiny step to be less wrong — repeated across enormous amounts of text.
- **Visual potential:** The highest in the slate: the learned numbers from E01 starting as noise and
  settling; a 3D error landscape with a path descending into a valley.
- **Relationship:** Delivers E01's twice-repeated promise, *"learned in training"* and *"patterns learned
  from enormous amounts of text"*.
- **Why third:** Essential, and visually spectacular, but more abstract and more heavily covered by
  established explainers; it lands better once the audience trusts the series (judgment). Heavier
  production: a new 3D landscape.

### 4. E05 — "Why Are GPUs So Good at AI?"
- **Hook:** The chip that made modern AI possible was designed to draw video games.
- **Takeaway:** AI is mostly huge numbers of small, independent multiply-and-add operations; a GPU runs
  thousands of them at once, and feeding it data fast enough matters as much as raw speed.
- **Visual potential:** High: a few large cores against thousands of small ones lighting at once; a
  matrix multiplication breaking into tiles; data streaming from memory.
- **Relationship:** The bridge from AI Made Visual to the systems pillar; reuses E01's "learned numbers"
  as the matrices and the studio's released CPU and host-memory assets for the contrast.
- **Why fourth:** The clearest expression of what makes AxioByte different, but new hardware assets make
  it the most expensive; by now E02–E04 will have shown what the audience responds to.

### 5. E06 — "How Does AI Know What 'It' Means?"
- **Hook:** *"The trophy didn't fit in the suitcase because it was too big."* What is "it"? You knew
  instantly. So does the model — here is how.
- **Takeaway:** Attention lets each token pull information from earlier tokens, weighted by relevance,
  so the same word takes on different meanings in different contexts.
- **Visual potential:** High: E01's attention arcs re-weighting live as one word of the sentence changes
  ("too big" → "too small"), and "it" moving to the other object.
- **Relationship:** The proposal's attention episode, reframed around a question people have; a deep zoom
  into E01's layers.
- **Why fifth:** It completes the mechanism arc, and by now the audience knows the layer world well
  enough for a deeper look. Accuracy note: real attention spreads over many heads and layers; the film
  should present one illustrative pattern and say so.

### Compared with the proposal

| Proposed | Recommended | Why |
|---|---|---|
| E02 How does AI learn? | → E04 | Essential but more abstract and heavily covered; better after two high-pull episodes |
| E03 Similarity | Dropped from the five (see alternatives) | Most repetitive of E01 |
| E04 Confident and wrong | → E03 | Pays off E01's last line; should come early |
| E05 GPUs | E05, unchanged | The right bridge; deliberately not earlier because of asset cost |
| E06 Attention | E06, reframed | Same mechanism, framed around a question people actually ask |
| — | **New E02: different answer every time** | Universal hook, one mechanism, cheapest to produce |

## 4. Alternatives that could outperform the slate

1. **"Why Can't AI Count the R's in 'Strawberry'?"** — tokenization, through a famous failure. A short
   (under 60 s), high-curiosity episode in E01's world. Accuracy caveat: newer models often get this
   right, so the honest framing is *why it's hard* for a model that sees tokens, not letters.
2. **"Does ChatGPT Remember You?"** — the context window: the model itself keeps nothing between
   conversations; it rereads what fits in its window, and anything beyond falls out. Strong hook, simple
   visuals (the token row with a window sliding over it). Accuracy caveat: product "memory" features
   exist and work differently (stored notes put back into the context), and the script must say so.
3. **"What Does '70 Billion Parameters' Actually Mean?"** — the learned numbers made physical, at scale.
   Bridges learning and hardware, and demystifies a number people see in headlines.

Each could replace a slot in the five; (1) or (2) is the strongest candidate to swap with E06 if early
episodes suggest the audience prefers everyday-experience questions (judgment).

## 5. Differentiation, balance and what to avoid

**What should make AxioByte different** (judgment):

- **Mechanism over metaphor.** Show the actual process — tokens, numbers, distributions, cores — not
  brains, robots or glowing circuits.
- **Visible honesty.** "ILLUSTRATIVE" labels and precise wording, as a feature of the brand rather than a
  disclaimer.
- **One continuous visual world.** The same tiles, layers and probability panel recur, so each episode
  extends something the viewer already knows.
- **The machine underneath.** The systems identity gives AI Made Visual a depth generic explainers lack.

**Balance:** Keep accuracy and visual clarity fixed; let length and spectacle flex. Build episodes in the
existing world first (E02 and E03 should cost far less than E01), and promote shared pieces —
the token tiles, the probability panel, the layers — into a reusable `renderers/three/src/domains/ml/` at
E02, per the series rule "promote on second use". Save new 3D builds for the episodes where the
visual *is* the idea (the learning landscape, the GPU).

**Strongest visual transformations, in order:** learning (noise settling into structure; descending a
landscape) · sampling (one distribution, many futures; the temperature dial) · GPU parallelism (thousands
of cores at once) · attention re-weighting as context changes · confidence (peaked versus flat — the one
at most risk of becoming text).

**Avoid in the next five:**

- Another survey. Each episode gets one idea.
- Anthropomorphic framing — "thinks", "understands", "knows" as literal claims. Titles can use everyday
  words as hooks only when the episode then explains what is really happening.
- Claims about any specific product's internals, or presenting illustrative numbers as real ones.
- "ChatGPT" in every title. It earned its place in E01; the series is about how language models work in
  general.
- Fear or hype framing about AI.
- Assuming longer is better: E01 runs 1:55; test 60–90 s for E02 and compare (a hypothesis to measure,
  not a known result).

## 6. The next 30 days

| Week | Work |
|---|---|
| 1 | Publish E01 on Reels and Shorts (package: `episodes/s02e01-ask-chatgpt/social/`). Start a simple per-episode log of the metrics each platform reports (views, average watch time or retention, shares, saves, comments) and, more useful early on, the questions people ask in comments. Draft the E02 script. |
| 2 | E02 script approval → your ElevenLabs audio and timeline → production in E01's world, promoting the shared components to `domains/ml/`. |
| 3 | Publish E02. Draft the E03 script, taking care with how errors are explained. |
| 4 | Produce and publish E03. Review what E01–E03's numbers and comments suggest (qualitatively; three data points are not a trend), then choose between E04 (learning) and an alternative, and scope the GPU assets for E05. |

That is roughly one episode every one to two weeks — sustainable at this quality bar. The in-progress
systems episode (s01e03, NIC) can continue alongside; whether to publish it in this window is a
separate decision.

## 7. Decisions for the creator

1. Adopt the two-series structure with three lenses inside AI Made Visual, or keep three pillars?
2. Approve the slate order — especially *different answers* as E02 and *confident and wrong* as E03?
3. Replace "similarity" with one of the alternatives (strawberry, memory, parameters)?
4. Target 60–90 s for E02 as a deliberate test against E01's 1:55?
5. Publish the systems episode s01e03 within these 30 days, or keep the focus on AI Made Visual?
