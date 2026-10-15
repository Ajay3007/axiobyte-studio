# s02e02 — publishing package: Instagram Reels + YouTube Shorts

**Video (approved master, unchanged):** `episodes/s02e02-different-answers/out/s02e02-different-answers.mp4`
(sha256 `d2fdedc6…da79`) — 9:16, 1080×1920, 30 fps, 2:16 (136.0 s), voice narration only, no music.
The same master goes to both platforms. Status record: `notes/final-review.md`.

**Grounding:** every claim below is said in the approved narration (`script.txt`) or shown in the film;
the pinned comments add only the accuracy caveats of the approved brief (`notes/brief.md`).
The copy describes a *simplified, illustrative* explanation of why language models can answer the same
question differently; it names no product and claims no product's settings, and it says that the
probabilities and outcomes on screen are examples.

**Branding:** the copy teaches the subject and never says how the video was made
(`docs/brand/AXIOBYTE_BRAND.md`, *On-screen wording*). AI is the topic, never the credit.

**Handles:** Instagram **@axiobyte** · YouTube **@theaxiobytes** (`docs/brand/AXIOBYTE_BRAND.md`). The
film's end card is deliberately handle-free, so each caption names its own platform's handle.

**Platform rules** cited below are the ones researched for s02e01's package on 2026-10-14
(`episodes/s02e01-ask-chatgpt/social/publishing-package.md`); they change, so recheck them on the day.

---

## Before posting: one decision

**How was the narration voiced?** The film does not say, and the recording's metadata does not record
it. If it is a synthetic voice (as s02e01's ElevenLabs narration was), turn on Instagram's AI label
(A, *Instagram-specific settings*). That label is a platform setting Meta requires for realistic,
digitally created audio — not on-screen wording — so it does not conflict with the branding rule.
If the narration is a human recording, leave the label off.

---

## A. Instagram Reels

### Hook (the caption's first line)

```
Ask an AI the same question twice, and you might get two different answers.
```

### Caption

```
Ask an AI the same question twice, and you might get two different answers. Neither one is a mistake.

For every next word, the model gives each candidate a probability, and then one is drawn by chance, like a wheel where every token gets a slice as wide as its probability. Wide slices win more often. But not every time.

One different word changes everything after it. The chosen word joins the sentence, the next prediction starts from there, and the two answers drift further apart with every step.

How far it strays is shaped by a setting called temperature. Low: answers become far more repeatable, though not always identical. High: answers vary more, sometimes wandering somewhere strange.

A simplified, illustrative explanation. The probabilities and outcomes on screen are examples, not values from any real model.

Have you ever asked the same thing twice and been surprised by the answer?

Follow @axiobyte for more ideas made visible.

#HowAIWorks #LargeLanguageModels #MachineLearning #AIExplained #AxioByte
```

- **Call to action:** the closing question asks about the viewer's own experience, the film's opening
  situation, so answers are easy to give; then the follow line.
- **Hashtags:** five, all on-topic (Instagram caps captions at five). No product hashtag: unlike
  s02e01, this film never names a product.

### Pinned comment

```
To keep it accurate: chance isn't the only reason answers differ. The conversation so far and the model version can matter too, and apps don't always let you see or change their settings. The numbers in the video are illustrative. Next up: how can an answer sound completely sure, and still be wrong?
```

### Cover

- **Frame:** 0:13.9, the same question asked twice, with its two different answers complete
  (`out/review/cover-013.9s.png`). It is the hook itself, readable at a glance, and shows no numbers
  that would need explaining.
- **Cover text** (Instagram's cover editor, in the clear band above the first question, centred):
  `Same question. Two answers. Why?`
- **Alternative frame:** 0:53.6, the replay: run 1's "The" beside run 2's "Sunlight" above the wheel
  (`out/review/cover-053.6s.png`). More intriguing, less instantly legible.
- Check the profile-grid preview in the app before posting: the grid crops the cover.

### Alt text

Add it in the app, on the screen after *Next* (the API's alt-text field does not support reels):

```
Animated explainer. The question "Why is the sky blue?" is typed into two chat boxes, and two different answers appear. The candidate first words become a list of probability bars, which curls into a wheel with one slice per word. Spun twice, the wheel lands on "The", then "Sunlight", and each word grows into its own branch of an answer. A temperature control then sharpens or flattens the wheel's slices.
```

### Instagram-specific settings and considerations

- **AI label:** on if the narration is synthetic; off if it is a human recording (see *Before posting*).
- **Captions:** turn on auto-generated closed captions and check the technical words: token,
  probabilities, temperature. The voice says "thirty percent" and "twenty-six"; captions should follow
  what is heard.
- **Length:** 2:16 is within Instagram's 3-minute Reels limit.
- **Audio:** voice only, no licensed music, so there are no music-rights restrictions.

---

## B. YouTube Shorts

### Title

```
Why Does AI Give a Different Answer Every Time?
```

47 characters, the episode's own question. **Alternatives:**

```
Ask an AI Twice, Get Two Answers. Here's Why.
```
```
How AI Picks Its Next Word, and Why It Changes
```

### Description

```
Ask an AI the same question twice and you might get two different answers. Neither is a mistake. Here's where the difference starts.

For the next word, the model gives every token it knows a probability, and then one is drawn by chance: a weighted draw, like a wheel where every token gets a slice as wide as its probability. Run it again with the same question and the same probabilities, and the draw can land somewhere else. The chosen token joins the sequence, so the next prediction starts from there, and two answers that differ by one early word drift further apart with every step. One question becomes a tree of possible answers; each time you ask, it walks one path.

How far it strays is shaped by temperature. Before the scores become probabilities, they're divided by the temperature. A low temperature stretches the gaps between them, so the top choices dominate and answers become far more repeatable, though not always identical. A high temperature shrinks the gaps, the probabilities flatten, and unlikely tokens get a real chance.

Chance isn't the only reason answers differ: the conversation so far and the model version can matter too. But much of the variety starts right here.

This is a simplified, illustrative explanation of how language models choose words. The probabilities and outcomes shown are examples, not values from any specific model.

AxioByte: complex systems, made visible. Every concept has an axiom.
Subscribe to @theaxiobytes for more · Instagram: @axiobyte

#HowAIWorks #LargeLanguageModels #AIExplained
```

- **First two lines** carry the hook and the promise; the rest is behind "…more".
- **Hashtags:** three; YouTube shows up to three, by the title.

### Pinned comment

```
To keep it accurate: the probabilities, the temperatures and the outcomes in the video are illustrative, and real apps don't always expose their settings. Low temperature makes answers far more repeatable, not guaranteed identical. Next question: how can an answer sound completely sure, and still be wrong?
```

### Thumbnail

Pick a frame in the **YouTube app** during upload or afterwards (Shorts thumbnails are chosen from the
video's frames in the app). Use the same frame as Instagram, **0:13.9**. Alternative: **0:53.6**, the
replay over the wheel.

### Upload settings

| Setting | Value |
|---|---|
| Format | Vertical, under 3 minutes: classified as a Short |
| Audience | Not made for kids |
| Category | Education |
| Language | English (video and title) |
| Altered or synthetic content | **Not required**: YouTube asks for disclosure when content makes a real person appear to say or do something, alters real footage, generates a realistic scene that didn't happen, or creates music that is the video's focus. This film is animated and makes none of those claims. |
| Captions | Auto-captions, checked for "token", "probabilities" and "temperature"; or upload accurate captions made from `script.txt` and the timeline |
| Comments | On, with the pinned comment |

### Shorts-specific considerations

- No licensed music, so the copyright limits on Shorts over a minute do not apply.
- The description carries no production credit; none is required, and the branding rule keeps the
  copy on the subject.

---

## C. Shared guidance

- **One core message:** *the model doesn't hold one fixed answer — at each step it draws the next token
  from a spread of probabilities, so the same question can unfold into different, equally reasonable
  answers; temperature shapes how adventurous those draws are.*
- **Native to each platform:** Instagram's copy is a short story with a question about the viewer's own
  experience; YouTube's is a searchable, complete summary of the mechanism with its terms spelled out.
- **Always:** say *simplified and illustrative*; say the probabilities and outcomes are examples; say
  low temperature means *far more repeatable*, not identical; keep chance as *one* reason among several.
- **Never:** claim any product's settings or internals, call different answers errors or "the AI
  changing its mind", present temperature as mood or creativity, say how the video was made, stuff
  keywords, or promise reach.
- **Series hand-off:** both pinned comments tease the next question the film ends on — sure, and still
  wrong — without naming an episode that is not yet made.
- **Accuracy review:** no accuracy problem was found in the approved master (`notes/final-review.md`).
