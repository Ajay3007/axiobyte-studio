# s02e01 — What Actually Happens When You Ask ChatGPT a Question?

AI Made Visual, episode 1. Series standards: [`docs/pillars/p02-ai-made-visual.md`](../../../docs/pillars/p02-ai-made-visual.md).

## Status

| Input | State |
|---|---|
| `script.txt` | Approved (sha256 `ff996513…5902`) |
| `audio/voiceover.mpeg` | Supplied, local only (gitignored). sha256 `17e1229c…2916`, MP3 stream, 109.714 s |
| `timeline/timeline.json` | Supplied and validated (sha256 `1deb6d91…9209`). WhisperX layout, 304 words, 33 sentences; matches `script.txt` word for word except three transcriber spellings ("It's ID", "Y signals", "token so far" at 48.6 s — kept as a recorded variance, see `notes/final-review.md`) |

`episode.yaml`, `picture.md` and `storyboard/` exist; every beat cues a word that was actually
spoken, with the transcript's spelling (`Y@16`, not `Why`). The word at 48.6 s ("token" or "tokens") cannot be settled from the recording; the audio is kept
as supplied and the variance recorded. Final status: `notes/final-review.md`.

## Goal

A general audience understands how a language model turns a question into an answer: text
becomes tokens, tokens become IDs, IDs unlock learned numbers, the numbers take on context
through the layers, and the answer is predicted one token at a time until a stop.

"Why is the sky blue?" is the running example. The episode explains generation, not
atmospheric physics.

## Audience

Curious non-experts. No jargon the narration does not define. Accurate enough that an
engineer has nothing to correct.

## Format

About 115 seconds of narration, so under 3 minutes: **one native 9:16 master** (1080×1920,
30 fps) for Reels and Shorts, laid out clear of the Reels UI (which contains Shorts'). Portrait
brand end card.

## Renderer

**Three.js**, one continuous world, rendered natively at 1080×1920 through `abs render` (a
Three.js episode renders the one frame its page is composed for) and joined by `abs compose
--target 9x16`. Bloom: subtle, on the attention links only (`three/bloom.js`), kept after an A/B
against `gravity.MP4`.

## The one picture

A sentence breaks apart, travels into a space of meaning, flows through the layers, and comes
back one token at a time. The machine never retrieves the answer; it builds it, piece by piece,
in front of you.

## Progression

A sequence of ideas, not a shot list. Final staging follows the timeline.

1. **The question.** Typed into a dark space. An answer starts to stream, then pulls back:
   first the question has to stop being words.
2. **Tokens.** The sentence fractures along its token seams; the question mark splits off. A
   brief aside shows a longer word breaking into pieces.
3. **IDs.** Each chunk is stamped with a number: a label, nothing more, kept visibly separate
   from what comes next.
4. **Learned numbers.** The label unlocks a column of numbers; the column becomes a point; the
   camera pulls back into a 3D field where "sky" sits near "cloud". Marked as an illustration.
5. **Through the layers.** The positions line up in depth; the camera travels through stacked
   layers. In each, threads run from every position to itself and earlier positions only.
   "blue" draws on "sky"; later positions draw on "Why". The last position brightens as it
   gathers the whole question.
6. **Prediction.** From the last position, candidate tokens rise as probability bars that add up
   to the whole. "The" and "Sunlight" stand tall; "banana" barely shows. A weighted pick, not
   simply the tallest bar.
7. **The loop.** The chosen token joins the end of the row; the cycle repeats and speeds up as
   "The sky looks blue because sunlight…" builds, until a stop token lights.
8. **Ending.** The camera pulls back to the finished answer as a user sees it, the machinery
   dimming behind it.

## Accuracy requirements

| Claim | On screen |
|---|---|
| Tokens can be words, pieces of words, or punctuation | The aside uses a word a public tokenizer genuinely splits; token boundaries and IDs are either verified against a public tokenizer or labelled illustrative |
| An ID is a label | The ID tag never carries meaning; the learned numbers are a separate object it unlocks |
| The space of meaning is an abstraction | Kicker marks it illustrative; it is a projection, not ChatGPT's internal state |
| Attention is causal | Threads go to the current and earlier positions only, never later ones |
| Context accumulates in each position | Every column changes layer by layer; the prediction comes from the last position |
| The output is a distribution | Bars visibly add up to a whole; the pick is weighted, not always the top bar |
| Generation is iterative and stops | One token appended per step; a stop token ends it (length limits also exist; not shown) |
| Fluent is not the same as correct | Narrated explicitly; no visual suggests verification or lookup |
| Not proprietary internals | Nothing implies the visuals show ChatGPT's actual architecture or weights |

## Acceptance

The series gates apply. Specific to this episode:

- Look-dev covers progression 2, 4 and 5, compared against `nn_explained.MP4` (build-up),
  `gravity.MP4` (threads, glow) and `earth.MP4` (camera into the subject) at the same display
  size.
- A muted viewing explains each of the eight steps from the picture alone.
- Every narrated term (token, I D, layer, probability, stop) has a visible counterpart on the
  word that names it.
