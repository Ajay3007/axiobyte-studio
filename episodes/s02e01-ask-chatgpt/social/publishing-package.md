# s02e01 — publishing package: Instagram Reels + YouTube Shorts

**Video (final, accepted, unchanged):** `episodes/s02e01-ask-chatgpt/out/s02e01-ask-chatgpt.mp4`
(sha256 `b9f2adf7…6440`) — 9:16, 1080×1920, 30 fps, 1:55 (114.7 s), voice narration only, no music.
The same master goes to both platforms. Status record: `notes/final-review.md`.

**Grounding:** every claim below is said in the approved narration (`script.txt`) or shown in the film.
The copy describes a *simplified, illustrative* explanation of how language models generate text; it
never claims to reveal ChatGPT's internals, and it says that the IDs and probabilities are examples.

**Handles:** Instagram **@axiobyte** · YouTube **@theaxiobytes** (`docs/brand/AXIOBYTE_BRAND.md`). The
film's end card is deliberately handle-free, so each caption names its own platform's handle.

---

## A. Instagram Reels

### Hook (the caption's first line, and the cover text)

```
What actually happens when you ask ChatGPT a question?
```

### Caption

```
What actually happens when you ask ChatGPT a question?

Before a single word comes back, your question stops being words. It's split into tokens. Each token becomes a number, its ID, and that ID unlocks a long list of learned numbers.

Those numbers flow through layer after layer, each token taking on context from the ones before it, until the model predicts the next token. Then it does it all again, one token at a time, until the answer is done.

Which is also why an answer can sound confident and still be wrong: it's predicted, not looked up.

A simplified, illustrative explanation of how language models generate text. The token IDs and probabilities on screen are examples, not values from ChatGPT itself.

Which step would you like to see up close next?

Follow @axiobyte for more ideas made visible.

#HowAIWorks #ChatGPT #LargeLanguageModels #MachineLearning #AxioByte
```

- **Call to action:** the closing question invites a real answer (which step to zoom into next), and the
  comments it draws feed the next episode choice. Then the follow line.
- **Hashtags:** five, all on-topic. Instagram now caps captions at five hashtags and recommends "fewer
  (up to 5) more targeted hashtags, rather than many generic ones"
  ([Social Media Today, quoting Instagram, Dec 2025](https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/)).
  `#ChatGPT` is there because the video names it; the rest describe the subject.

### Pinned comment

```
A note on accuracy: this is a simplified picture. Real language models use vocabularies of many thousands of tokens and many more layers, and the IDs and probabilities in the video are illustrative, not ChatGPT's actual values. Tokens, attention, or how the model learns — which should we make visible next?
```

### Cover

- **Frame:** 0:13.3, the question as glass tiles in two lines with the token seams lit
  (`out/review/04-0013.3s.png`). It reads instantly, shows the core idea (the sentence breaking into
  tokens) and leaves the top quarter clear for text.
- **Cover text** (added in Instagram's cover editor, top third, centred): `What happens when you ask ChatGPT a question?`
- Keep the text within the middle of the frame, and check the profile-grid preview in the app before
  posting: the grid shows a cropped version of the cover.

### Alt text

Instagram's reel flow offers alternate text alongside the caption on the screen after *Next*
([Instagram Help: Record a reel](https://help.instagram.com/2720958398006062); the Graph API's alt-text
field does not support reels, so add it in the app):

```
Animated explainer. The question "Why is the sky blue?" splits into glowing word tiles, each tagged with a number. The numbers become columns of bars, rise through stacked layers linked by golden arcs, and feed a bar chart of next-word probabilities. One word is chosen and added at a time until the answer appears.
```

### Instagram-specific settings and considerations

- **AI label — turn it on.** The narration is an AI-generated (ElevenLabs) voice. Meta requires people
  to use its disclosure and label tool when they post organic content with realistic-sounding,
  digitally created audio, and *"may apply penalties if they fail to do so"*
  ([Meta, Feb 2024, updated Apr 2025](https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/)).
  Use the AI label toggle in the reel's advanced settings. For a channel about AI, the label is also on-brand.
- **Captions:** turn on auto-generated closed captions ([Instagram Help](https://help.instagram.com/7487270478066359/))
  and check the transcript of technical words (token, ID, layers) before publishing.
- **Length:** 1:55 is within Instagram's 3-minute Reels limit
  ([Social Media Today, Jan 2025](https://www.socialmediatoday.com/news/instagram-officially-expands-reels-length-3-minutes/737766/)).
- **Audio:** voice only, no licensed music, so there are no music-rights restrictions.
- **The variance at 0:48.6:** the voice may say "token" where the script says "tokens" (recorded in
  `notes/final-review.md`). It is a minor grammatical variance; captions should follow what is heard.

---

## B. YouTube Shorts

### Title

```
What Actually Happens When You Ask ChatGPT a Question?
```

54 characters, the film's own opening line. **Alternatives:**

```
Why AI Answers Appear One Word at a Time
```
```
Your Question Becomes Numbers: How a Language Model Writes an Answer
```

### Description

```
Before a single word comes back, your question stops being words. Here's the whole journey: tokens, learned numbers, layers, and one prediction at a time.

The question is split into tokens: whole words, pieces of words, even a question mark. Each token becomes an ID, a label that unlocks a long list of learned numbers. Those numbers flow through layer after layer, each token looking back at the tokens before it, until the last one carries a picture of the whole question. From there the model scores every token it knows, turns the scores into probabilities, and picks one: usually a likely one, but not always the likeliest. The new token joins the sequence, and it all happens again, until the model predicts the answer is done or hits a limit.

On its own, the model isn't looking the answer up. It's predicting it, which is why an answer can sound confident and still be wrong.

This is a simplified, illustrative explanation of how language models generate text. The token IDs and probabilities shown are examples, not values from ChatGPT or any specific model.

AxioByte: complex systems, made visible. Every concept has an axiom.
Subscribe to @theaxiobytes for more · Instagram: @axiobyte

#HowAIWorks #ChatGPT #LargeLanguageModels
```

- **First two lines** carry the hook and the promise; the rest is behind "…more".
- **Hashtags:** three. YouTube shows up to three of a video's hashtags, the ones it considers most
  engaging, by the title ([YouTube Help: hashtags](https://support.google.com/youtube/answer/6390658?hl=en)).

### Pinned comment

```
To keep it accurate: real models have huge vocabularies and many more layers than the film shows, and the IDs and probabilities are illustrative, not ChatGPT's actual values. What should the next one make visible: how AI learns, why it gives different answers, or what GPUs have to do with it?
```

### Thumbnail

Choose a frame in the **YouTube app** during upload (*Edit* on the thumbnail) or afterwards from
*Your videos* → *Edit*; Shorts thumbnails are edited in the app, not in Studio
([YouTube Help: Create YouTube Shorts](https://support.google.com/youtube/answer/10343433/upload-shorts-on-youtube?hl=en)).
Use the same frame as Instagram, **0:13.3** (the two-line question breaking into tokens). Alternative:
**1:13.5**, the candidate list with its probability bars, which is more intriguing but shows illustrative
numbers without context, so it is the second choice.

### Upload settings

| Setting | Value |
|---|---|
| Format | Vertical, under 3 minutes: classified as a Short ([YouTube Help: three-minute Shorts](https://support.google.com/youtube/answer/15424877?hl=en)) |
| Audience | Not made for kids |
| Category | Education |
| Language | English (video and title) |
| Altered or synthetic content | **Not required** under YouTube's current rules, which ask for disclosure when content makes a real person appear to say or do something, alters real footage, generates a realistic scene that didn't happen, or creates music that is the video's focus. This film is animated and its synthetic narrator is not a real person ([YouTube Help: disclosing GenAI content](https://support.google.com/youtube/answer/14328491?hl=en)). Optional: add the line below to the description for transparency. |
| Captions | Auto-captions, checked for "token", "ID" and "layers"; or upload accurate captions made from `script.txt` and the timeline (follow what is heard at 0:48.6) |
| Comments | On, with the pinned comment |

Optional transparency line, if you choose to add it to the description:

```
Narration: AI-generated voice. Script and visuals: AxioByte.
```

### Shorts-specific considerations

- Thumbnails can only be picked from the video's frames in the app; a custom image may not be available
  for Shorts depending on the account (the help pages differ by date), so pick a frame.
- No licensed music, so the copyright limits on Shorts over a minute do not apply.

---

## C. Shared guidance

- **One core message:** *your question becomes tokens, numbers and predictions — and the answer is built
  one token at a time, predicted rather than looked up.* Both captions lead with E01's own opening line
  and end on the same honest framing.
- **Native to each platform:** Instagram's copy is a short story with a question to answer in the
  comments; YouTube's is a searchable, complete summary of the mechanism with its terms spelled out.
- **Always:** say *simplified and illustrative*; say the IDs and probabilities are examples; name
  ChatGPT as the hook and *language models* as the subject.
- **Never:** imply the film shows ChatGPT's real internals, stuff keywords, add unrelated trending
  hashtags, or promise reach.
- **Accuracy review:** no material accuracy problem was found in the final video. The one open item is
  the minor wording variance at 0:48.6, recorded in `notes/final-review.md`.
