# s02e02 — word-by-word visual plan and storyboard

**PLANNING — awaiting approval.** No scenes, assets or renders exist. Sources of truth: the approved
`script.txt`, the creator's audio and `timeline/timeline.json` (all unchanged), and the approved
`notes/brief.md`. Statements marked **[fact]** were verified on 2026-10-14; the rest is the proposed design.

The inventory (§2) and beat timings (§3) are generated from the timeline by
`out/inventory.py` and `out/build_plan.py` (git-ignored working files), so no time in this document is
typed by hand.

---

## 1. Timeline integrity report [fact]

| | |
|---|---|
| Audio | `episodes/s02e02-different-answers/audio/s02ep02.mpeg` — MP3 stream, mono, 44.1 kHz, ~129 kbps, **131.004 s**; decodes end to end without error; gitignored (`episodes/*/audio/`). sha256 `409b46c6fffed08e7b7460edeb87e30284d6082baa5437c9a54e1d4ae439c38a` |
| Timeline | `episodes/s02e02-different-answers/timeline/timeline.json` — WhisperX layout (`meta`, `words`, `sentences`, `pauses`), as s02e01. **331 words, 47 sentences, 53 pauses.** sha256 `57d4b51fb5b1cd697959dddf352c6164453248ab5be89ed7ef90ce71db3a06c7` |
| Script | `episodes/s02e02-different-answers/script.txt` — approved, 332 words. sha256 `e843b18f707cbcf9d1437cb69e9b74563431c96ddc6d6e2464f98f92c726c37e` (unchanged) |
| Duration | `meta.duration` 131.004 s = the audio's probed duration exactly. First word 0.031 s; last word ends 130.832 s (inside the audio). |
| Timing quality | Word-level start/end for every word; starts only increase; no overlaps; every word inside its sentence; sentence indices increase. Per-word `importance`, `confidence`, `loudness_db`, `pitch_hz` present. |
| Script vs. transcript | Over 99 % identical (word-sequence match). The only differences are numerals: the script's "thirty percent" is transcribed **"30%."** (one word, 29.42 s) and "twenty-six" **"26."** (30.88 s) — transcription formatting of the spoken numbers, which explains 332 vs 331 words. **No material mismatch**: no word omitted, added or reordered. |
| Implications | Cues use the transcript's spelling. In the JS storyboard, `TimelineParser` reduces "30%." to `30`; in `beats.yaml`, Python's `normalise` keeps the `%`, so a beat cue is `30%@10`. The audio file is not named `voiceover.*`: `abs compose` reads `episode.yaml`'s `audio.path`, so set it to `audio/s02ep02.mpeg` (no rename); a full-length `render.mjs` encode with sound needs `--audio`. |

Narration 2:11; with the 1.5 s hold and 3.5 s end card the film is about **2:16** — inside the approved
2–2.5 minutes.

## 2. Complete word-level visual inventory

Every spoken word, in order, with its timeline times. **Phrase** names the beat and word range whose
visual carries it. **Class:** `direct` — a deliberate visual for this word; `phrase` — conveyed by its
phrase's visual (grammatical or dependent words); `non-literal` — deliberately not depicted (§5).
**Silent?** says whether the meaning survives with the sound off.

### 2a. Phrases

| Phrase | Beat | Words | Time | Visual |
|---|---|---|---|---|
| 0–6 | B01 | Ask an AI the same question twice. | 0.03–2.56 | A generic prompt bar; on 'twice' a second, identical bar appears beneath it |
| 7–11 | B01 | Why is the sky blue? | 3.46–4.40 | The question types itself into both bars at once, word by word |
| 12–17 | B02 | You might get two different answers. | 5.32–6.80 | Each bar opens an answer panel beneath it: two panels, side by side in depth |
| 18–19 | B02 | One begins, | 7.49–8.03 | Panel A brightens: it is speaking |
| 20–24 | B02 | the sky looks blue because… | 8.45–9.89 | Answer A streams into panel A, word by word |
| 25–27 | B02 | The other begins, | 10.57–11.27 | Panel B brightens |
| 28–33 | B02 | sunlight is made of every color. | 11.89–13.60 | Answer B streams into panel B, word by word |
| 34–38 | B03 | Neither one is a mistake. | 13.64–16.06 | Purposeful hold: both panels settle to the same steady, neutral glow (no ticks, no crosses) |
| 39–40 | B04 | Same question, | 16.54–17.18 | The two prompt lines slide together and overlap exactly: identical |
| 41–42 | B04 | same model. | 17.56–18.16 | One model block (E01's layer stack, in silhouette) feeds both panels |
| 43–45 | B04 | So what changed? | 18.68–19.41 | The first words of the answers light up as the point of difference: 'The' vs 'Sunlight' |
| 46–50 | B05 | Look at the first word. | 20.11–21.55 | Camera pushes into the first-word slot; the rest of both answers dims away |
| 51–55 | B06 | As we saw last time, | 21.55–22.65 | Callback: E01's world fades in around the slot (token row, last position, layers) |
| 56–62 | B06 | the model scores every token it knows | 22.69–24.93 | From the last position, a score bar rises for every candidate token; a long tail recedes behind |
| 63–68 | B06 | and turns those scores into probabilities. | 25.13–26.96 | The scores turn into probabilities: bars re-form in green, now adding up to a whole |
| 69–71 | B07 | In this example, | 27.58–28.26 | 'ILLUSTRATIVE VALUES' kicker appears; the two top rows step forward |
| 72–74 | B07 | sunlight gets 30%. | 28.74–29.74 | Row 'Sunlight' highlights; its 30% label appears |
| 75–76 | B07 | The 26. | 29.92–31.42 | Row 'The' highlights; its 26% label appears |
| 77–83 | B08 | Then one token is drawn, by chance. | 32.46–34.73 | The candidate list compresses into E01's pick strip; the marker hovers, ready to draw |
| 84–87 | B09 | Think of a wheel | 35.33–36.03 | The strip curls into a wheel: the key transformation |
| 88–93 | B09 | where every token gets a slice | 36.11–37.69 | Every segment becomes a slice; the top candidates are labelled |
| 94–98 | B09 | as wide as its probability. | 37.97–39.29 | Each slice's arc visibly matches its probability bar (a brief linked highlight) |
| 99–103 | B10 | Wide slices win more often. | 39.89–41.31 | Rapid hypothetical spins drop dots on the slices; wide slices collect most of them |
| 104–107 | B10 | But not every time. | 41.89–43.34 | One dot lands in a narrow slice |
| 108–112 | B11 | This spin lands on the. | 43.34–45.00 | The real spin: the pointer whirls and stops on 'The'; the tile lifts out |
| 113–118 | B12 | Now, rewind and hold everything fixed. | 45.68–48.02 | Rewind: the tile flies back, the wheel reverses to rest; everything freezes under a 'DEMONSTRATION' kicker; the first outcome stays as a ghost |
| 119–122 | B13 | Same question, same probabilities. | 48.50–50.40 | Ghost overlays prove it: the prompt and every slice match the first run exactly |
| 123–124 | B14 | Spin again. | 50.94–51.40 | The second spin starts |
| 125–128 | B14 | This time, sunlight wins. | 51.46–53.48 | It stops on 'Sunlight'; its tile lifts beside the ghosted 'The' |
| 129–135 | B15 | One different word changes everything after it. | 54.15–56.45 | The two first tiles become two branch starts; empty slots extend ahead of each |
| 136–141 | B15 | The chosen token joins the sequence | 56.91–58.69 | The chosen tile docks onto the end of the question row: it joins the sequence |
| 142–148 | B15 | and the next prediction starts from there. | 58.87–60.47 | A new, smaller wheel grows at the tip of each branch |
| 149–153 | B15 | After the, sky is likely. | 61.05–62.91 | Branch A's wheel: 'sky' has the widest slice |
| 154–156 | B15 | After sunlight, is. | 63.40–64.70 | Branch B's wheel: 'is' has the widest slice |
| 157–165 | B16 | Each new word brings new probabilities and another spin. | 65.32–68.36 | Along both branches, tile docks → new wheel → spin, repeating |
| 166–174 | B16 | The two answers drift further apart with every step. | 68.94–72.12 | The branches grow, and the angle between them widens with every new token; their words complete the two hook answers |
| 175–176 | B17 | Zoom out. | 72.12–72.70 | Camera pulls back |
| 177–184 | B17 | One question becomes a tree of possible answers. | 73.25–75.77 | From the root (the question), a whole tree of possible answers appears |
| 185–188 | B18 | Likely paths glow bright. | 76.37–77.77 | Brightness of each branch = its probability: likely paths glow |
| 189–195 | B18 | Unlikely ones are faint, but still there. | 78.27–80.21 | Unlikely branches stay faint but visible |
| 196–203 | B19 | Each time you ask, it walks one path. | 80.81–83.56 | A light pulse leaves the root and travels one path to a leaf; a second ask takes another |
| 204–207 | B20 | How far it strays | 83.58–84.58 | The pulse is shown drifting off the bright trunk onto a faint branch |
| 208–214 | B20 | is shaped by a setting called temperature. | 84.60–86.50 | Camera returns to the first wheel; a temperature control appears beside it |
| 215–219 | B21 | Before the scores become probabilities, | 87.02–88.80 | The pipeline is laid out: score bars above, probability bars and wheel below |
| 220–224 | B21 | they're divided by the temperature. | 89.00–90.36 | Each score is visibly divided by T (÷ T); the probabilities and slices update from the real formula |
| 225–227 | B22 | A low temperature | 90.92–91.70 | The control moves low (illustrative T value shown) |
| 228–232 | B22 | stretches the gaps between them, | 91.72–93.27 | Divided scores spread apart: the gaps stretch |
| 233–237 | B22 | so the top choices dominate. | 93.55–94.91 | The top slice swells; the rest thin out; the tree's faint branches fade |
| 238–242 | B23 | Answers become far more repeatable, | 95.45–97.13 | Several spins at low T: nearly all land on the top slice; the tree narrows to one bright trunk |
| 243–246 | B23 | though not always identical. | 97.37–99.29 | One spin still lands on the second slice: repeatable, not identical |
| 247–255 | B24 | A high temperature shrinks the gaps between the scores. | 99.29–101.84 | The control moves high; divided scores pull together: the gaps shrink |
| 256–258 | B24 | The probabilities flatten. | 102.30–103.50 | Bars level out; slices approach equal widths |
| 259–264 | B25 | Unlikely tokens get a real chance, | 104.04–106.06 | Narrow slices widen; the pointer lands in one |
| 265–268 | B25 | and answers vary more, | 106.08–107.16 | The tree bursts into many branches of similar brightness |
| 269–272 | B25 | sometimes wandering somewhere strange. | 107.54–109.25 | One branch wanders to an odd token (E01's 'banana', illustrative) |
| 273–279 | B26 | Chance isn't the only reason answers differ. | 109.83–112.05 | Pull back: the wheel becomes one of several inputs feeding the two answers |
| 280–290 | B26 | The conversation so far and the model version can matter too. | 112.55–115.57 | Other inputs appear as labelled chips: earlier conversation stacked above the prompt; the model block's version tag |
| 291–298 | B27 | But much of the variety starts right here. | 116.09–118.20 | Spotlight returns to the wheel: this is where most of the variety begins |
| 299–307 | B28 | So when an answer comes out differently, nothing broke. | 118.86–121.68 | Back to the two answer panels, intact and steady (nothing breaks) |
| 308–312 | B28 | It just took another path. | 122.06–123.16 | Answer B's branch lights as the path it took |
| 313–317 | B29 | Which raises a bigger question. | 123.72–125.69 | Transition: the tree and panels recede; a single fresh answer card remains |
| 318–328 | B29 | How can an answer sound completely sure and still be wrong? | 125.69–129.53 | That card fills steadily and confidently; a question is posed, not answered (the next episode) |
| 329–330 | B30 | That's next. | 130.21–130.83 | Hand-off to the 'next' hold and the portrait end card |

### 2b. Every word

| # | Word | Start | End | Sent. | Phrase | Role | Class | Visual / reason | Action | Relation | Silent? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Ask | 0.03 | 0.41 | S00 | B01·0–6 | imperative: the act of asking | direct | Prompt bar activates; caret blinks | idle → focused | opens phrase | yes — visual |
| 1 | an | 0.45 | 0.51 | S00 | B01·0–6 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 2 | AI | 0.73 | 1.03 | S00 | B01·0–6 | subject: the model | direct | Model silhouette, faint, behind the bar | appears | within phrase | yes — visual |
| 3 | the | 1.07 | 1.21 | S00 | B01·0–6 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 4 | same | 1.29 | 1.51 | S00 | B01·0–6 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 5 | question | 1.63 | 2.04 | S00 | B01·0–6 | object: the question | direct | Prompt bar | establishes | within phrase | yes — visual |
| 6 | twice. | 2.12 | 2.56 | S00 | B01·0–6 | frequency: repeated | direct | A second, identical prompt bar | duplicates | closes phrase; 0.90s pause follows | yes — visual |
| 7 | Why | 3.46 | 3.60 | S01 | B01·7–11 | question word (typed) | direct | Word appears in both bars | typed | opens phrase | yes — visual |
| 8 | is | 3.66 | 3.74 | S01 | B01·7–11 | question word (typed) | direct | Word appears in both bars | typed | within phrase | yes — visual |
| 9 | the | 3.76 | 3.86 | S01 | B01·7–11 | question word (typed) | direct | Word appears in both bars | typed | within phrase | yes — visual |
| 10 | sky | 3.88 | 4.12 | S01 | B01·7–11 | question word (typed) | direct | Word appears in both bars | typed | within phrase | yes — visual |
| 11 | blue? | 4.18 | 4.40 | S01 | B01·7–11 | question word (typed) | direct | Word appears in both bars | typed | closes phrase; 0.92s pause follows | yes — visual |
| 12 | You | 5.32 | 5.42 | S02 | B02·12–17 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 13 | might | 5.48 | 5.66 | S02 | B02·12–17 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 14 | get | 5.70 | 5.84 | S02 | B02·12–17 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 15 | two | 5.86 | 6.08 | S02 | B02·12–17 | count | direct | Two answer panels | open | within phrase | yes — visual |
| 16 | different | 6.14 | 6.40 | S02 | B02·12–17 | contrast | direct | Panels outlined differently | differentiate | within phrase | yes — visual |
| 17 | answers. | 6.46 | 6.80 | S02 | B02·12–17 | object: answers | direct | Answer panels | open | closes phrase; 0.68s pause follows | yes — visual |
| 18 | One | 7.49 | 7.58 | S03 | B02·18–19 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 19 | begins, | 7.64 | 8.03 | S03 | B02·18–19 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | closes phrase | yes — via phrase visual |
| 20 | the | 8.45 | 8.53 | S03 | B02·20–24 | answer A text | direct | Word streams into panel A | typed | opens phrase | yes — visual |
| 21 | sky | 8.57 | 8.83 | S03 | B02·20–24 | answer A text | direct | Word streams into panel A | typed | within phrase | yes — visual |
| 22 | looks | 8.85 | 9.05 | S03 | B02·20–24 | answer A text | direct | Word streams into panel A | typed | within phrase | yes — visual |
| 23 | blue | 9.13 | 9.39 | S03 | B02·20–24 | answer A text | direct | Word streams into panel A | typed | within phrase | yes — visual |
| 24 | because… | 9.49 | 9.89 | S03 | B02·20–24 | answer A text | direct | Word streams into panel A | typed | closes phrase; 0.68s pause follows | yes — visual |
| 25 | The | 10.57 | 10.67 | S04 | B02·25–27 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 26 | other | 10.73 | 10.87 | S04 | B02·25–27 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 27 | begins, | 10.91 | 11.27 | S04 | B02·25–27 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | closes phrase; 0.62s pause follows | yes — via phrase visual |
| 28 | sunlight | 11.89 | 12.27 | S04 | B02·28–33 | answer B text | direct | Word streams into panel B | typed | opens phrase | yes — visual |
| 29 | is | 12.35 | 12.41 | S04 | B02·28–33 | answer B text | direct | Word streams into panel B | typed | within phrase | yes — visual |
| 30 | made | 12.45 | 12.61 | S04 | B02·28–33 | answer B text | direct | Word streams into panel B | typed | within phrase | yes — visual |
| 31 | of | 12.65 | 12.69 | S04 | B02·28–33 | answer B text | direct | Word streams into panel B | typed | within phrase | yes — visual |
| 32 | every | 12.73 | 13.23 | S04 | B02·28–33 | answer B text | direct | Word streams into panel B | typed | within phrase | yes — visual |
| 33 | color. | 13.29 | 13.60 | S04 | B02·28–33 | answer B text | direct | Word streams into panel B | typed | closes phrase | yes — visual |
| 34 | Neither | 13.64 | 15.20 | S05 | B03·34–38 | negation over both | non-literal | Not depicted — a 'no' icon would read as a judgement. Meaning carried by: equal, steady treatment of both panels. | — | opens phrase | by design — equal, steady treatment of both panels |
| 35 | one | 15.32 | 15.40 | S05 | B03·34–38 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 36 | is | 15.46 | 15.52 | S05 | B03·34–38 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 37 | a | 15.54 | 15.58 | S05 | B03·34–38 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 38 | mistake. | 15.62 | 16.06 | S05 | B03·34–38 | evaluation: mistake | non-literal | Not depicted — ticks or crosses would imply grading answers; the point is that both are fine. Meaning carried by: the hold: both panels stay intact and equal. | — | closes phrase | by design — the hold: both panels stay intact and equal |
| 39 | Same | 16.54 | 16.74 | S06 | B04·39–40 | identity | direct | Overlap is exact | match | opens phrase | yes — visual |
| 40 | question, | 16.80 | 17.18 | S06 | B04·39–40 | object: the question | direct | Prompt lines overlap | align | closes phrase | yes — visual |
| 41 | same | 17.56 | 17.78 | S06 | B04·41–42 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 42 | model. | 17.86 | 18.16 | S06 | B04·41–42 | object: the model | direct | Single model block feeding both | connects | closes phrase; 0.52s pause follows | yes — visual |
| 43 | So | 18.68 | 18.79 | S07 | B04·43–45 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 44 | what | 18.84 | 18.96 | S07 | B04·43–45 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 45 | changed? | 19.02 | 19.41 | S07 | B04·43–45 | the difference | direct | First words highlighted: 'The' / 'Sunlight' | highlight | closes phrase; 0.70s pause follows | yes — visual |
| 46 | Look | 20.11 | 20.27 | S08 | B05·46–50 | imperative: attend | direct | Camera push | move | opens phrase | yes — visual |
| 47 | at | 20.29 | 20.33 | S08 | B05·46–50 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 48 | the | 20.35 | 20.45 | S08 | B05·46–50 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 49 | first | 20.51 | 20.75 | S08 | B05·46–50 | ordinal | direct | First-word slot | focus | within phrase | yes — visual |
| 50 | word. | 20.81 | 21.55 | S08 | B05·46–50 | object | direct | First-word slot | focus | closes phrase | yes — visual |
| 51 | As | 21.55 | 21.73 | S09 | B06·51–55 | discourse: callback | non-literal | Not depicted — 'as we saw' needs no object. Meaning carried by: E01's visual world returning. | — | opens phrase | by design — E01's visual world returning |
| 52 | we | 21.79 | 21.87 | S09 | B06·51–55 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 53 | saw | 21.91 | 22.03 | S09 | B06·51–55 | verb: saw | non-literal | Not depicted — an eye icon would be decoration. Meaning carried by: the callback. | — | within phrase | by design — the callback |
| 54 | last | 22.07 | 22.37 | S09 | B06·51–55 | time reference | non-literal | Not depicted — a calendar would be decoration. Meaning carried by: the callback. | — | within phrase | by design — the callback |
| 55 | time, | 22.43 | 22.65 | S09 | B06·51–55 | time reference | non-literal | Not depicted — as above. Meaning carried by: the callback. | — | closes phrase | by design — the callback |
| 56 | the | 22.69 | 22.95 | S09 | B06·56–62 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 57 | model | 23.01 | 23.29 | S09 | B06·56–62 | subject: the model | direct | E01 layer stack / last position | returns | within phrase | yes — visual |
| 58 | scores | 23.33 | 23.61 | S09 | B06·56–62 | action: scoring | direct | Score bars rise | grow | within phrase | yes — visual |
| 59 | every | 23.63 | 24.11 | S09 | B06·56–62 | quantifier | direct | Long tail of score bars | extend | within phrase | yes — visual |
| 60 | token | 24.17 | 24.49 | S09 | B06·56–62 | object: tokens | direct | Candidate rows | list | within phrase | yes — visual |
| 61 | it | 24.53 | 24.57 | S09 | B06·56–62 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 62 | knows | 24.63 | 24.93 | S09 | B06·56–62 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | closes phrase | yes — via phrase visual |
| 63 | and | 25.13 | 25.21 | S09 | B06·63–68 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 64 | turns | 25.27 | 25.52 | S09 | B06·63–68 | action: transform | direct | Bars re-form | transform | within phrase | yes — visual |
| 65 | those | 25.57 | 25.71 | S09 | B06·63–68 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 66 | scores | 25.75 | 26.05 | S09 | B06·63–68 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 67 | into | 26.09 | 26.23 | S09 | B06·63–68 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 68 | probabilities. | 26.32 | 26.96 | S09 | B06·63–68 | result: probabilities | direct | Green probability bars | become | closes phrase; 0.62s pause follows | yes — visual |
| 69 | In | 27.58 | 27.64 | S10 | B07·69–71 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 70 | this | 27.68 | 27.80 | S10 | B07·69–71 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 71 | example, | 27.88 | 28.26 | S10 | B07·69–71 | hedge: illustrative | direct | 'ILLUSTRATIVE VALUES' kicker | label | closes phrase | yes — visual |
| 72 | sunlight | 28.74 | 29.18 | S10 | B07·72–74 | candidate token | direct | Row 'Sunlight' | highlight | opens phrase | yes — visual |
| 73 | gets | 29.26 | 29.40 | S10 | B07·72–74 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 74 | 30%. | 29.42 | 29.74 | S10 | B07·72–74 | probability value | direct | Label '30%' | label | closes phrase | yes — visual |
| 75 | The | 29.92 | 30.86 | S11 | B07·75–76 | candidate token | direct | Row 'The' | highlight | opens phrase | yes — visual |
| 76 | 26. | 30.88 | 31.42 | S11 | B07·75–76 | probability value | direct | Label '26%' | label | closes phrase; 1.04s pause follows | yes — visual |
| 77 | Then | 32.46 | 32.64 | S12 | B08·77–83 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 78 | one | 32.66 | 33.12 | S12 | B08·77–83 | count: one | direct | Marker selects one | select | within phrase | yes — visual |
| 79 | token | 33.20 | 33.48 | S12 | B08·77–83 | object: token | direct | Marker over the strip | hover | within phrase | yes — visual |
| 80 | is | 33.56 | 33.60 | S12 | B08·77–83 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 81 | drawn, | 33.66 | 33.98 | S12 | B08·77–83 | action: drawing | direct | Marker motion | draw | within phrase | yes — visual |
| 82 | by | 34.24 | 34.34 | S12 | B08·77–83 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 83 | chance. | 34.41 | 34.73 | S12 | B08·77–83 | manner: chance | direct | Marker jitter before rest | randomise | closes phrase; 0.60s pause follows | yes — visual |
| 84 | Think | 35.33 | 35.47 | S13 | B09·84–87 | discourse: invitation | non-literal | Not depicted — an imperative to imagine. Meaning carried by: the strip→wheel transformation. | — | opens phrase | by design — the strip→wheel transformation |
| 85 | of | 35.53 | 35.57 | S13 | B09·84–87 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 86 | a | 35.63 | 35.65 | S13 | B09·84–87 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 87 | wheel | 35.73 | 36.03 | S13 | B09·84–87 | metaphor object: wheel | direct | Strip curls into a wheel | transform | closes phrase | yes — visual |
| 88 | where | 36.11 | 36.25 | S13 | B09·88–93 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 89 | every | 36.41 | 36.61 | S13 | B09·88–93 | quantifier | direct | All segments become slices | map | within phrase | yes — visual |
| 90 | token | 36.67 | 36.97 | S13 | B09·88–93 | object: token | direct | Slice labels | label | within phrase | yes — visual |
| 91 | gets | 37.01 | 37.15 | S13 | B09·88–93 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 92 | a | 37.23 | 37.25 | S13 | B09·88–93 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 93 | slice | 37.33 | 37.69 | S13 | B09·88–93 | object: slice | direct | Slice outline highlight | highlight | closes phrase | yes — visual |
| 94 | as | 37.97 | 38.03 | S13 | B09·94–98 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 95 | wide | 38.17 | 38.43 | S13 | B09·94–98 | property: width | direct | Slice arc vs bar | compare | within phrase | yes — visual |
| 96 | as | 38.47 | 38.53 | S13 | B09·94–98 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 97 | its | 38.59 | 38.67 | S13 | B09·94–98 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 98 | probability. | 38.73 | 39.29 | S13 | B09·94–98 | property: probability | direct | Linked bar highlight | compare | closes phrase; 0.60s pause follows | yes — visual |
| 99 | Wide | 39.89 | 40.15 | S14 | B10·99–103 | property: wide | direct | Wide slices | highlight | opens phrase | yes — visual |
| 100 | slices | 40.17 | 40.55 | S14 | B10·99–103 | object: slices | direct | Slices | highlight | within phrase | yes — visual |
| 101 | win | 40.63 | 40.79 | S14 | B10·99–103 | outcome: win | direct | Dots land | accumulate | within phrase | yes — visual |
| 102 | more | 40.81 | 40.97 | S14 | B10·99–103 | frequency | direct | Dot tally grows | accumulate | within phrase | yes — visual |
| 103 | often. | 41.07 | 41.31 | S14 | B10·99–103 | frequency | direct | Dot tally | accumulate | closes phrase; 0.58s pause follows | yes — visual |
| 104 | But | 41.89 | 41.99 | S15 | B10·104–107 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 105 | not | 42.05 | 42.23 | S15 | B10·104–107 | negation | direct | Dot in a narrow slice | exception | within phrase | yes — visual |
| 106 | every | 42.41 | 42.63 | S15 | B10·104–107 | quantifier | direct | Dot in a narrow slice | exception | within phrase | yes — visual |
| 107 | time. | 42.69 | 43.34 | S15 | B10·104–107 | frequency | direct | Dot in a narrow slice | exception | closes phrase | yes — visual |
| 108 | This | 43.34 | 43.59 | S16 | B11·108–112 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 109 | spin | 43.66 | 43.92 | S16 | B11·108–112 | event: spin | direct | Wheel spins | spin | within phrase | yes — visual |
| 110 | lands | 43.98 | 44.24 | S16 | B11·108–112 | event: landing | direct | Pointer decelerates | stop | within phrase | yes — visual |
| 111 | on | 44.34 | 44.42 | S16 | B11·108–112 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 112 | the. | 44.46 | 45.00 | S16 | B11·108–112 | result token 'The' | direct | Pointer on 'The'; tile lifts | select | closes phrase; 0.68s pause follows | yes — visual |
| 113 | Now, | 45.68 | 45.84 | S17 | B12·113–118 | discourse marker | non-literal | Not depicted — a beat, not an object. Meaning carried by: the rewind motion that follows. | — | opens phrase | by design — the rewind motion that follows |
| 114 | rewind | 46.12 | 46.64 | S17 | B12·113–118 | action: rewind | direct | Tile returns; wheel reverses | reverse | within phrase | yes — visual |
| 115 | and | 46.66 | 46.82 | S17 | B12·113–118 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 116 | hold | 46.88 | 47.04 | S17 | B12·113–118 | action: hold | direct | Freeze | lock | within phrase | yes — visual |
| 117 | everything | 47.08 | 47.62 | S17 | B12·113–118 | scope: everything | direct | Whole frame frozen | lock | within phrase | yes — visual |
| 118 | fixed. | 47.70 | 48.02 | S17 | B12·113–118 | state: fixed | direct | 'DEMONSTRATION' kicker; ghost of run 1 | label | closes phrase | yes — visual |
| 119 | Same | 48.50 | 48.70 | S18 | B13·119–122 | identity | direct | Prompt ghost matches | match | opens phrase | yes — visual |
| 120 | question, | 48.76 | 49.16 | S18 | B13·119–122 | object: question | direct | Prompt ghost | match | within phrase | yes — visual |
| 121 | same | 49.50 | 49.72 | S18 | B13·119–122 | identity | direct | Slice ghosts match | match | within phrase | yes — visual |
| 122 | probabilities. | 49.78 | 50.40 | S18 | B13·119–122 | object: probabilities | direct | Slice ghosts | match | closes phrase; 0.54s pause follows | yes — visual |
| 123 | Spin | 50.94 | 51.14 | S19 | B14·123–124 | event: spin | direct | Second spin | spin | opens phrase | yes — visual |
| 124 | again. | 51.18 | 51.40 | S19 | B14·123–124 | repetition | direct | Second spin | spin | closes phrase | yes — visual |
| 125 | This | 51.46 | 52.14 | S20 | B14·125–128 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 126 | time, | 52.20 | 52.44 | S20 | B14·125–128 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 127 | sunlight | 52.77 | 53.16 | S20 | B14·125–128 | result token 'Sunlight' | direct | Pointer on 'Sunlight' | select | within phrase | yes — visual |
| 128 | wins. | 53.23 | 53.48 | S20 | B14·125–128 | outcome: win | direct | Tile lifts beside ghost 'The' | select | closes phrase; 0.66s pause follows | yes — visual |
| 129 | One | 54.15 | 54.27 | S21 | B15·129–135 | count: one | direct | Two first tiles side by side | compare | opens phrase | yes — visual |
| 130 | different | 54.35 | 54.63 | S21 | B15·129–135 | contrast | direct | Two first tiles | compare | within phrase | yes — visual |
| 131 | word | 54.67 | 54.91 | S21 | B15·129–135 | object: word | direct | Two first tiles | compare | within phrase | yes — visual |
| 132 | changes | 54.97 | 55.29 | S21 | B15·129–135 | action: change | direct | Branches start | fork | within phrase | yes — visual |
| 133 | everything | 55.59 | 55.97 | S21 | B15·129–135 | scope | direct | Empty slots ahead | extend | within phrase | yes — visual |
| 134 | after | 56.09 | 56.31 | S21 | B15·129–135 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 135 | it. | 56.39 | 56.45 | S21 | B15·129–135 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | closes phrase | yes — via phrase visual |
| 136 | The | 56.91 | 56.99 | S22 | B15·136–141 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 137 | chosen | 57.05 | 57.39 | S22 | B15·136–141 | state: chosen | direct | Chosen tile | highlight | within phrase | yes — visual |
| 138 | token | 57.43 | 57.75 | S22 | B15·136–141 | object: token | direct | Chosen tile | move | within phrase | yes — visual |
| 139 | joins | 57.83 | 58.11 | S22 | B15·136–141 | action: join | direct | Tile docks on the row | dock | within phrase | yes — visual |
| 140 | the | 58.15 | 58.25 | S22 | B15·136–141 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 141 | sequence | 58.29 | 58.69 | S22 | B15·136–141 | object: sequence | direct | Question row | extend | closes phrase | yes — visual |
| 142 | and | 58.87 | 58.95 | S22 | B15·142–148 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 143 | the | 58.97 | 59.03 | S22 | B15·142–148 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 144 | next | 59.13 | 59.33 | S22 | B15·142–148 | next step | direct | Branch tip | focus | within phrase | yes — visual |
| 145 | prediction | 59.37 | 59.75 | S22 | B15·142–148 | object: prediction | direct | New mini wheel | spawn | within phrase | yes — visual |
| 146 | starts | 59.81 | 60.05 | S22 | B15·142–148 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 147 | from | 60.09 | 60.21 | S22 | B15·142–148 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 148 | there. | 60.23 | 60.47 | S22 | B15·142–148 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | closes phrase; 0.58s pause follows | yes — via phrase visual |
| 149 | After | 61.05 | 61.27 | S23 | B15·149–153 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 150 | the, | 61.31 | 61.69 | S23 | B15·149–153 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 151 | sky | 62.05 | 62.37 | S23 | B15·149–153 | candidate token 'sky' | direct | Widest slice on branch A | label | within phrase | yes — visual |
| 152 | is | 62.45 | 62.51 | S23 | B15·149–153 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 153 | likely. | 62.57 | 62.91 | S23 | B15·149–153 | property: likely | direct | Slice width | emphasise | closes phrase | yes — visual |
| 154 | After | 63.40 | 63.58 | S24 | B15·154–156 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 155 | sunlight, | 63.68 | 64.10 | S24 | B15·154–156 | context token 'Sunlight' | direct | Branch B tip | focus | within phrase | yes — visual |
| 156 | is. | 64.54 | 64.70 | S24 | B15·154–156 | candidate token 'is' | direct | Widest slice on branch B | label | closes phrase; 0.62s pause follows | yes — visual |
| 157 | Each | 65.32 | 65.48 | S25 | B16·157–165 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 158 | new | 65.58 | 65.70 | S25 | B16·157–165 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 159 | word | 65.76 | 65.98 | S25 | B16·157–165 | object: word | direct | Tile docks | dock | within phrase | yes — visual |
| 160 | brings | 66.04 | 66.26 | S25 | B16·157–165 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 161 | new | 66.28 | 66.54 | S25 | B16·157–165 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 162 | probabilities | 66.62 | 67.24 | S25 | B16·157–165 | object: probabilities | direct | New wheel | spawn | within phrase | yes — visual |
| 163 | and | 67.62 | 67.72 | S25 | B16·157–165 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 164 | another | 67.80 | 68.04 | S25 | B16·157–165 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 165 | spin. | 68.08 | 68.36 | S25 | B16·157–165 | event: spin | direct | Wheel spins | spin | closes phrase; 0.58s pause follows | yes — visual |
| 166 | The | 68.94 | 69.02 | S26 | B16·166–174 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 167 | two | 69.08 | 69.22 | S26 | B16·166–174 | count: two | direct | Two branches | grow | within phrase | yes — visual |
| 168 | answers | 69.34 | 69.64 | S26 | B16·166–174 | object: answers | direct | Branch texts | grow | within phrase | yes — visual |
| 169 | drift | 69.68 | 69.92 | S26 | B16·166–174 | action: drift | direct | Angle widens | diverge | within phrase | yes — visual |
| 170 | further | 70.06 | 70.40 | S26 | B16·166–174 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 171 | apart | 70.46 | 70.76 | S26 | B16·166–174 | result: apart | direct | Angle widens | diverge | within phrase | yes — visual |
| 172 | with | 70.80 | 70.90 | S26 | B16·166–174 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 173 | every | 71.10 | 71.32 | S26 | B16·166–174 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 174 | step. | 71.36 | 72.12 | S26 | B16·166–174 | unit: step | direct | Each new tile | step | closes phrase | yes — visual |
| 175 | Zoom | 72.12 | 72.52 | S27 | B17·175–176 | action: zoom | direct | Camera pulls back | move | opens phrase | yes — visual |
| 176 | out. | 72.54 | 72.70 | S27 | B17·175–176 | direction | direct | Camera pulls back | move | closes phrase; 0.54s pause follows | yes — visual |
| 177 | One | 73.25 | 73.36 | S28 | B17·177–184 | count: one | direct | Root node | focus | opens phrase | yes — visual |
| 178 | question | 73.44 | 73.81 | S28 | B17·177–184 | object: question | direct | Root node = the prompt | focus | within phrase | yes — visual |
| 179 | becomes | 73.87 | 74.17 | S28 | B17·177–184 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 180 | a | 74.25 | 74.27 | S28 | B17·177–184 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 181 | tree | 74.37 | 74.75 | S28 | B17·177–184 | metaphor object: tree | direct | Branching tree | reveal | within phrase | yes — visual |
| 182 | of | 74.81 | 74.85 | S28 | B17·177–184 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 183 | possible | 74.93 | 75.33 | S28 | B17·177–184 | property: possible | direct | Many branches | reveal | within phrase | yes — visual |
| 184 | answers. | 75.43 | 75.77 | S28 | B17·177–184 | object: answers | direct | Leaves | reveal | closes phrase; 0.60s pause follows | yes — visual |
| 185 | Likely | 76.37 | 76.67 | S29 | B18·185–188 | property: likely | direct | Bright branches | glow | opens phrase | yes — visual |
| 186 | paths | 76.73 | 77.07 | S29 | B18·185–188 | object: paths | direct | Branches | glow | within phrase | yes — visual |
| 187 | glow | 77.19 | 77.45 | S29 | B18·185–188 | action: glow | direct | Brightness ∝ probability | glow | within phrase | yes — visual |
| 188 | bright. | 77.49 | 77.77 | S29 | B18·185–188 | property: bright | direct | Brightness ∝ probability | glow | closes phrase; 0.50s pause follows | yes — visual |
| 189 | Unlikely | 78.27 | 78.65 | S30 | B18·189–195 | property: unlikely | direct | Faint branches | dim | opens phrase | yes — visual |
| 190 | ones | 78.75 | 78.87 | S30 | B18·189–195 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 191 | are | 78.93 | 79.01 | S30 | B18·189–195 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 192 | faint, | 79.09 | 79.39 | S30 | B18·189–195 | property: faint | direct | Faint branches | dim | within phrase | yes — visual |
| 193 | but | 79.57 | 79.67 | S30 | B18·189–195 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 194 | still | 79.73 | 79.93 | S30 | B18·189–195 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 195 | there. | 79.99 | 80.21 | S30 | B18·189–195 | persistence | direct | Faint branches stay visible | persist | closes phrase; 0.60s pause follows | yes — visual |
| 196 | Each | 80.81 | 80.97 | S31 | B19·196–203 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 197 | time | 81.01 | 81.19 | S31 | B19·196–203 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 198 | you | 81.23 | 81.33 | S31 | B19·196–203 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 199 | ask, | 81.47 | 81.65 | S31 | B19·196–203 | action: ask | direct | Pulse leaves the root | emit | within phrase | yes — visual |
| 200 | it | 81.87 | 81.91 | S31 | B19·196–203 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 201 | walks | 81.97 | 82.23 | S31 | B19·196–203 | action: walk | direct | Pulse travels | travel | within phrase | yes — visual |
| 202 | one | 82.47 | 82.59 | S31 | B19·196–203 | count: one | direct | One lit path | travel | within phrase | yes — visual |
| 203 | path. | 82.66 | 83.56 | S31 | B19·196–203 | object: path | direct | One lit path | travel | closes phrase | yes — visual |
| 204 | How | 83.58 | 83.72 | S32 | B20·204–207 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 205 | far | 83.80 | 83.98 | S32 | B20·204–207 | extent | direct | Distance off the trunk | drift | within phrase | yes — visual |
| 206 | it | 84.04 | 84.12 | S32 | B20·204–207 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 207 | strays | 84.16 | 84.58 | S32 | B20·204–207 | action: stray | direct | Pulse onto a faint branch | drift | closes phrase | yes — visual |
| 208 | is | 84.60 | 84.74 | S32 | B20·208–214 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 209 | shaped | 84.78 | 85.04 | S32 | B20·208–214 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 210 | by | 85.08 | 85.20 | S32 | B20·208–214 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 211 | a | 85.24 | 85.28 | S32 | B20·208–214 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 212 | setting | 85.34 | 85.60 | S32 | B20·208–214 | object: setting | direct | Control appears | appear | within phrase | yes — visual |
| 213 | called | 85.66 | 85.88 | S32 | B20·208–214 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 214 | temperature. | 85.98 | 86.50 | S32 | B20·208–214 | term: temperature | direct | Control labelled 'TEMPERATURE' | label | closes phrase; 0.52s pause follows | yes — visual |
| 215 | Before | 87.02 | 87.30 | S33 | B21·215–219 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 216 | the | 87.34 | 87.42 | S33 | B21·215–219 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 217 | scores | 87.44 | 87.72 | S33 | B21·215–219 | object: scores | direct | Score bars | layout | within phrase | yes — visual |
| 218 | become | 87.78 | 88.06 | S33 | B21·215–219 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 219 | probabilities, | 88.12 | 88.80 | S33 | B21·215–219 | object: probabilities | direct | Probability bars + wheel | layout | closes phrase | yes — visual |
| 220 | they're | 89.00 | 89.16 | S33 | B21·220–224 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 221 | divided | 89.18 | 89.62 | S33 | B21·220–224 | operation: divide | direct | '÷ T' on each score | compute | within phrase | yes — visual |
| 222 | by | 89.68 | 89.80 | S33 | B21·220–224 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 223 | the | 89.82 | 89.90 | S33 | B21·220–224 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 224 | temperature. | 89.94 | 90.36 | S33 | B21·220–224 | term: temperature | direct | T readout | compute | closes phrase; 0.56s pause follows | yes — visual |
| 225 | A | 90.92 | 90.96 | S34 | B22·225–227 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 226 | low | 91.04 | 91.22 | S34 | B22·225–227 | value: low | direct | Control moves low | move | within phrase | yes — visual |
| 227 | temperature | 91.28 | 91.70 | S34 | B22·225–227 | term: temperature | direct | Control | move | closes phrase | yes — visual |
| 228 | stretches | 91.72 | 92.27 | S34 | B22·228–232 | action: stretch | direct | Score gaps widen | stretch | opens phrase | yes — visual |
| 229 | the | 92.31 | 92.39 | S34 | B22·228–232 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 230 | gaps | 92.45 | 92.71 | S34 | B22·228–232 | object: gaps | direct | Gap markers | stretch | within phrase | yes — visual |
| 231 | between | 92.77 | 93.09 | S34 | B22·228–232 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 232 | them, | 93.13 | 93.27 | S34 | B22·228–232 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | closes phrase | yes — via phrase visual |
| 233 | so | 93.55 | 93.63 | S34 | B22·233–237 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 234 | the | 93.67 | 93.75 | S34 | B22·233–237 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 235 | top | 93.79 | 94.03 | S34 | B22·233–237 | rank: top | direct | Top slice | grow | within phrase | yes — visual |
| 236 | choices | 94.07 | 94.41 | S34 | B22·233–237 | object: choices | direct | Slices | grow | within phrase | yes — visual |
| 237 | dominate. | 94.49 | 94.91 | S34 | B22·233–237 | outcome: dominate | direct | Top slice swells | grow | closes phrase; 0.54s pause follows | yes — visual |
| 238 | Answers | 95.45 | 95.71 | S35 | B23·238–242 | object: answers | direct | Repeated spins | repeat | opens phrase | yes — visual |
| 239 | become | 95.75 | 96.01 | S35 | B23·238–242 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 240 | far | 96.05 | 96.39 | S35 | B23·238–242 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 241 | more | 96.45 | 96.59 | S35 | B23·238–242 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 242 | repeatable, | 96.63 | 97.13 | S35 | B23·238–242 | property: repeatable | direct | Same landing; tree narrows | converge | closes phrase | yes — visual |
| 243 | though | 97.37 | 97.57 | S35 | B23·243–246 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 244 | not | 97.59 | 97.85 | S35 | B23·243–246 | negation | direct | One different landing | exception | within phrase | yes — visual |
| 245 | always | 97.99 | 98.29 | S35 | B23·243–246 | frequency | direct | One different landing | exception | within phrase | yes — visual |
| 246 | identical. | 98.35 | 99.29 | S35 | B23·243–246 | property: identical | direct | One different landing | exception | closes phrase | yes — visual |
| 247 | A | 99.29 | 99.43 | S36 | B24·247–255 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 248 | high | 99.49 | 99.69 | S36 | B24·247–255 | value: high | direct | Control moves high | move | within phrase | yes — visual |
| 249 | temperature | 99.75 | 100.15 | S36 | B24·247–255 | term: temperature | direct | Control | move | within phrase | yes — visual |
| 250 | shrinks | 100.27 | 100.61 | S36 | B24·247–255 | action: shrink | direct | Score gaps narrow | shrink | within phrase | yes — visual |
| 251 | the | 100.66 | 100.73 | S36 | B24·247–255 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 252 | gaps | 100.80 | 101.03 | S36 | B24·247–255 | object: gaps | direct | Gap markers | shrink | within phrase | yes — visual |
| 253 | between | 101.08 | 101.36 | S36 | B24·247–255 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 254 | the | 101.40 | 101.46 | S36 | B24·247–255 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 255 | scores. | 101.50 | 101.84 | S36 | B24·247–255 | object: scores | direct | Score bars | shrink | closes phrase | yes — visual |
| 256 | The | 102.30 | 102.38 | S37 | B24·256–258 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 257 | probabilities | 102.42 | 103.00 | S37 | B24·256–258 | object: probabilities | direct | Probability bars | flatten | within phrase | yes — visual |
| 258 | flatten. | 103.02 | 103.50 | S37 | B24·256–258 | action: flatten | direct | Bars level; slices equalise | flatten | closes phrase; 0.54s pause follows | yes — visual |
| 259 | Unlikely | 104.04 | 104.44 | S38 | B25·259–264 | property: unlikely | direct | Narrow slices | widen | opens phrase | yes — visual |
| 260 | tokens | 104.48 | 104.80 | S38 | B25·259–264 | object: tokens | direct | Narrow slices | widen | within phrase | yes — visual |
| 261 | get | 104.84 | 104.94 | S38 | B25·259–264 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 262 | a | 104.98 | 105.00 | S38 | B25·259–264 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 263 | real | 105.16 | 105.42 | S38 | B25·259–264 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 264 | chance, | 105.48 | 106.06 | S38 | B25·259–264 | outcome: chance | direct | Pointer lands in a narrow slice | select | closes phrase | yes — visual |
| 265 | and | 106.08 | 106.16 | S38 | B25·265–268 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 266 | answers | 106.28 | 106.56 | S38 | B25·265–268 | object: answers | direct | Tree branches | multiply | within phrase | yes — visual |
| 267 | vary | 106.64 | 106.92 | S38 | B25·265–268 | action: vary | direct | Tree bursts | multiply | within phrase | yes — visual |
| 268 | more, | 106.96 | 107.16 | S38 | B25·265–268 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | closes phrase | yes — via phrase visual |
| 269 | sometimes | 107.54 | 107.92 | S38 | B25·269–272 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 270 | wandering | 107.96 | 108.40 | S38 | B25·269–272 | action: wander | direct | Odd branch | drift | within phrase | yes — visual |
| 271 | somewhere | 108.44 | 108.74 | S38 | B25·269–272 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 272 | strange. | 108.81 | 109.25 | S38 | B25·269–272 | property: strange | direct | Odd token at the leaf ('banana', illustrative) | label | closes phrase; 0.58s pause follows | yes — visual |
| 273 | Chance | 109.83 | 110.13 | S39 | B26·273–279 | subject: chance | direct | Wheel | recontextualise | opens phrase | yes — visual |
| 274 | isn't | 110.15 | 110.45 | S39 | B26·273–279 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 275 | the | 110.47 | 110.59 | S39 | B26·273–279 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 276 | only | 110.77 | 110.99 | S39 | B26·273–279 | restriction: only | direct | Wheel joins other inputs | recontextualise | within phrase | yes — visual |
| 277 | reason | 111.05 | 111.33 | S39 | B26·273–279 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 278 | answers | 111.43 | 111.69 | S39 | B26·273–279 | object: answers | direct | Two answers | recontextualise | within phrase | yes — visual |
| 279 | differ. | 111.75 | 112.05 | S39 | B26·273–279 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | closes phrase; 0.50s pause follows | yes — via phrase visual |
| 280 | The | 112.55 | 112.63 | S40 | B26·280–290 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 281 | conversation | 112.67 | 113.27 | S40 | B26·280–290 | factor: conversation | direct | Earlier messages above the prompt | appear | within phrase | yes — visual |
| 282 | so | 113.33 | 113.49 | S40 | B26·280–290 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 283 | far | 113.57 | 113.85 | S40 | B26·280–290 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 284 | and | 114.03 | 114.13 | S40 | B26·280–290 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 285 | the | 114.17 | 114.23 | S40 | B26·280–290 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 286 | model | 114.31 | 114.55 | S40 | B26·280–290 | factor: model | direct | Model block | appear | within phrase | yes — visual |
| 287 | version | 114.59 | 114.87 | S40 | B26·280–290 | factor: version | direct | Version tag changes | change | within phrase | yes — visual |
| 288 | can | 114.93 | 115.05 | S40 | B26·280–290 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 289 | matter | 115.09 | 115.33 | S40 | B26·280–290 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 290 | too. | 115.37 | 115.57 | S40 | B26·280–290 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | closes phrase; 0.52s pause follows | yes — via phrase visual |
| 291 | But | 116.09 | 116.19 | S41 | B27·291–298 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 292 | much | 116.37 | 116.55 | S41 | B27·291–298 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 293 | of | 116.59 | 116.63 | S41 | B27·291–298 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 294 | the | 116.67 | 116.75 | S41 | B27·291–298 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 295 | variety | 116.79 | 117.23 | S41 | B27·291–298 | object: variety | direct | Tree, briefly | recall | within phrase | yes — visual |
| 296 | starts | 117.30 | 117.56 | S41 | B27·291–298 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 297 | right | 117.73 | 117.96 | S41 | B27·291–298 | deixis: here | direct | Spotlight on the wheel | focus | within phrase | yes — visual |
| 298 | here. | 118.00 | 118.20 | S41 | B27·291–298 | deixis: here | direct | Spotlight on the wheel | focus | closes phrase; 0.66s pause follows | yes — visual |
| 299 | So | 118.86 | 119.00 | S42 | B28·299–307 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 300 | when | 119.14 | 119.26 | S42 | B28·299–307 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 301 | an | 119.30 | 119.34 | S42 | B28·299–307 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 302 | answer | 119.48 | 119.70 | S42 | B28·299–307 | object: answer | direct | Answer panels | return | within phrase | yes — visual |
| 303 | comes | 119.76 | 119.92 | S42 | B28·299–307 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 304 | out | 120.00 | 120.08 | S42 | B28·299–307 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 305 | differently, | 120.16 | 120.60 | S42 | B28·299–307 | manner: differently | direct | Two different answers | compare | within phrase | yes — visual |
| 306 | nothing | 120.64 | 121.26 | S42 | B28·299–307 | negation: nothing | non-literal | Not depicted — a 'broken' icon would introduce error imagery. Meaning carried by: panels intact and steady. | — | within phrase | by design — panels intact and steady |
| 307 | broke. | 121.34 | 121.68 | S42 | B28·299–307 | state: broke | non-literal | Not depicted — showing breakage contradicts the message. Meaning carried by: panels intact and steady. | — | closes phrase | by design — panels intact and steady |
| 308 | It | 122.06 | 122.12 | S43 | B28·308–312 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 309 | just | 122.16 | 122.30 | S43 | B28·308–312 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 310 | took | 122.36 | 122.52 | S43 | B28·308–312 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 311 | another | 122.56 | 122.78 | S43 | B28·308–312 | contrast: another | direct | Answer B's branch | highlight | within phrase | yes — visual |
| 312 | path. | 122.84 | 123.16 | S43 | B28·308–312 | object: path | direct | Answer B's branch | highlight | closes phrase; 0.56s pause follows | yes — visual |
| 313 | Which | 123.72 | 123.84 | S44 | B29·313–317 | connective | non-literal | Not depicted — a transition word. Meaning carried by: the recession of the tree. | — | opens phrase | by design — the recession of the tree |
| 314 | raises | 123.92 | 124.22 | S44 | B29·313–317 | verb: raises | non-literal | Not depicted — abstract. Meaning carried by: a single fresh card coming forward. | — | within phrase | by design — a single fresh card coming forward |
| 315 | a | 124.24 | 124.30 | S44 | B29·313–317 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 316 | bigger | 124.44 | 124.72 | S44 | B29·313–317 | property: bigger | non-literal | Not depicted — a scale gag would undercut the tease. Meaning carried by: the camera settling on the card. | — | within phrase | by design — the camera settling on the card |
| 317 | question. | 124.78 | 125.69 | S44 | B29·313–317 | object: question | non-literal | Not depicted — a '?' icon would be literal filler. Meaning carried by: the card itself. | — | closes phrase | by design — the card itself |
| 318 | How | 125.69 | 125.95 | S45 | B29·318–328 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | opens phrase | yes — via phrase visual |
| 319 | can | 125.99 | 126.13 | S45 | B29·318–328 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 320 | an | 126.15 | 126.21 | S45 | B29·318–328 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 321 | answer | 126.35 | 126.59 | S45 | B29·318–328 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 322 | sound | 126.67 | 126.87 | S45 | B29·318–328 | verb: sound | non-literal | Not depicted — audio is already sounding. Meaning carried by: the card's steady, confident fill. | — | within phrase | by design — the card's steady, confident fill |
| 323 | completely | 126.95 | 127.68 | S45 | B29·318–328 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 324 | sure | 127.80 | 128.08 | S45 | B29·318–328 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 325 | and | 128.10 | 128.16 | S45 | B29·318–328 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase; 0.56s pause follows | yes — via phrase visual |
| 326 | still | 128.72 | 128.98 | S45 | B29·318–328 | content (phrase) | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 327 | be | 129.04 | 129.12 | S45 | B29·318–328 | grammatical | phrase | Phrase visual (see column 'Phrase') | — | within phrase | yes — via phrase visual |
| 328 | wrong? | 129.20 | 129.53 | S45 | B29·318–328 | evaluation: wrong | non-literal | Not depicted — showing an error here would suggest sampling causes wrong answers (out of scope; E03's subject). Meaning carried by: withheld: the question is left open. | — | closes phrase; 0.68s pause follows | by design — withheld: the question is left open |
| 329 | That's | 130.21 | 130.43 | S46 | B30·329–330 | deixis | non-literal | Not depicted — a hand-off. Meaning carried by: the next-episode hold. | — | opens phrase | by design — the next-episode hold |
| 330 | next. | 130.51 | 130.83 | S46 | B30·329–330 | next | non-literal | Not depicted — a hand-off. Meaning carried by: the next-episode hold, then the end card. | — | closes phrase | by design — the next-episode hold, then the end card |

**Totals:** 331 words — direct 162, phrase-level 151, intentionally non-literal 18.

## 3. Sentence and phrase storyboard

One continuous world, no hard cuts until the end card. Times and word ranges are computed from the
timeline.

| Beat | Time | Words | Title | Composition (9:16) | Transition in | Purpose |
|---|---|---|---|---|---|---|
| B01 | 0.03–4.40 | 0–11 | Same question, twice | Upper third: two identical prompt bars stacked; model silhouette faint behind | Fade up from the dark ground | Establish the surprising setup: one question, asked twice |
| B02 | 5.32–13.60 | 12–33 | Two answers | Middle: two answer panels under their bars; text streams in sync with the narration | Panels unfold from the bars | Show the surprising outcome concretely, in the viewer's own experience |
| B03 | 13.64–16.06 | 34–38 | Neither is a mistake | Hold the two panels, equal and steady | Purposeful hold (1.7 s gap inside the sentence) | Reframe variety as normal before explaining it |
| B04 | 16.54–19.41 | 39–45 | Same question, same model, what changed? | Prompt lines overlap; one model block feeds both; first words highlighted | Prompts slide together | Isolate the variable: the difference starts at the first word |
| B05 | 20.11–21.55 | 46–50 | Into the first word | Camera push into the first-word slot; answers dim | Continuous push | Move from experience to mechanism without a cut |
| B06 | 21.55–26.96 | 51–68 | Scores become probabilities | E01's last position at the bottom; score bars rise above it, then turn green | E01 world fades in around the slot | Recall E01's mechanism in one motion |
| B07 | 27.58–31.42 | 69–76 | Illustrative values | Candidate list in the middle; kicker top-left; two rows step forward | Rows settle | Ground the idea in two named candidates — clearly labelled as an example |
| B08 | 32.46–34.73 | 77–83 | A draw | List compresses into E01's strip; marker above | List → strip | Introduce chance as a physical draw |
| B09 | 35.33–39.29 | 84–98 | The wheel | Strip curls into a wheel, centred; slices labelled | Strip → wheel (key transformation) | Make 'weighted' tangible: slice width = probability |
| B10 | 39.89–43.34 | 99–107 | Often, not always | Wheel centred; hypothetical dots drop and accumulate | Dots fall | Show frequency, then the exception, before the real spin |
| B11 | 43.34–45.00 | 108–112 | Spin 1 → 'The' | Wheel spins; pointer stops on 'The'; tile lifts | Spin | First outcome |
| B12 | 45.68–48.02 | 113–118 | Rewind and freeze | Reverse motion; freeze; 'DEMONSTRATION' kicker; ghost of run 1 remains | Reverse spin | Set up a controlled comparison honestly |
| B13 | 48.50–50.40 | 119–122 | Proof of sameness | Ghost overlays align exactly with prompt and slices | Ghost alignment | Prove nothing but the draw changes |
| B14 | 50.94–53.48 | 123–128 | Spin 2 → 'Sunlight' | Second spin; tile lifts beside ghost 'The' | Spin (1 s pause before the result) | Different draw, different token |
| B15 | 54.15–64.70 | 129–156 | The fork | Two tiles become branch starts; chosen tile docks; mini wheels at tips with 'sky' / 'is' | Tiles slide apart into branches | Causality: the chosen token changes the next prediction |
| B16 | 65.32–72.12 | 157–174 | Compounding | Both branches grow upward-outward; angle widens; text completes the hook answers | Continuous growth | Divergence compounds — and pays off the opening answers |
| B17 | 72.12–75.77 | 175–184 | Zoom out: the tree | Camera pulls back; full tree from the root | Pull back | One question, many possible futures |
| B18 | 76.37–80.21 | 185–195 | Bright and faint | Branch brightness proportional to probability | Brightness settles | Read probability from the picture |
| B19 | 80.81–83.56 | 196–203 | One walk per ask | Pulse travels one path; a second ask takes another | Pulse | Each answer is one path through the tree |
| B20 | 83.58–86.50 | 204–214 | Introducing temperature | Back to the first wheel; control appears beside it | Camera returns | Name the control over how far the walk strays |
| B21 | 87.02–90.36 | 215–224 | Scores ÷ T | Pipeline: score bars → ÷ T → probability bars → wheel | Pipeline assembles | Show the real formula, step by step |
| B22 | 90.92–94.91 | 225–237 | Low T sharpens | Control low; gaps stretch; top slice swells; faint branches fade | Control moves | Low temperature concentrates probability |
| B23 | 95.45–99.29 | 238–246 | Repeatable, not identical | Repeated spins; nearly all land on top; one does not | Spins | Accuracy: low T is not a guarantee |
| B24 | 99.29–103.50 | 247–258 | High T flattens | Control high; gaps shrink; bars level; slices even out | Control moves | High temperature spreads probability |
| B25 | 104.04–109.25 | 259–272 | More variety, some strange | Narrow slices win; tree bursts; one branch reaches an odd token | Spins and growth | Consequence of a flat distribution |
| B26 | 109.83–115.57 | 273–290 | Not the only reason | Wheel joins other inputs: conversation history, model version | Pull back to the two answers | Accuracy: sampling is one source among several |
| B27 | 116.09–118.20 | 291–298 | Variety starts here | Spotlight back on the wheel | Spotlight | Restate the takeaway visually |
| B28 | 118.86–123.16 | 299–312 | Nothing broke | Two panels intact; answer B's branch lights | Return to the opening framing | Close the loop with the opening |
| B29 | 123.72–129.53 | 313–328 | The next question | A single fresh answer card fills confidently; the question is left open | Tree and panels recede | Tease E03 without implying sampling causes errors |
| B30 | 130.21–130.83 | 329–330 | Hand-off | Next-episode hold, then the portrait end card | Fade to card | End |

### Key demonstrations, in detail

- **B09, strip → wheel.** E01's horizontal pick strip bends into a ring, segment by segment, keeping
  every segment's proportion; the marker becomes the pointer. During "as wide as its probability", one
  slice and its bar highlight together, so width = probability is seen, not told.
- **B10, frequency.** About 20 hypothetical spins drop small dots onto the rim, from a seeded,
  correctly weighted draw: most land in the wide slices; on "but not every time" one lands in a narrow
  slice. The dots clear before the real spin.
- **B11–B14, the controlled replay.** Spin 1 lands on "The" exactly on the spoken "the." (44.46 s).
  "Rewind" reverses the motion; "hold everything fixed" freezes the frame under a
  **DEMONSTRATION** kicker, and run 1 stays as a desaturated ghost. On "same question, same
  probabilities" the ghosts of the prompt and every slice line up exactly with the live ones. Spin 2
  lands on "Sunlight" on the spoken word (52.77 s), after the narration's natural pause. The two spins
  are *staged* to land on the narrated tokens — that is what the DEMONSTRATION label discloses — and
  both outcomes are plausible draws from the shown distribution.
- **B15–B16, the fork.** The two tiles become two branches; on "joins the sequence" the chosen tile
  docks onto the end of the question row; each tip grows a smaller wheel whose widest slice is "sky"
  (branch A) and "is" (branch B). Growth then repeats along both branches, the angle between them
  widening, until their words complete the two answers from the opening (B02): the hook is explained.
- **B17–B19, the tree.** Pulling back reveals many branches from the same root; each branch's
  brightness is proportional to its path probability (illustrative values), so "likely paths glow
  bright" is literally true of the picture. A pulse walks one path per ask.
- **B21–B25, temperature.** Laid out as a pipeline: score bars → **÷ T** → probability bars → wheel.
  Moving the control recomputes everything from the real formula (§4). Low T: the divided scores
  spread apart, the top slice swells, the tree's faint branches fade; repeated spins land on the top
  slice — except one (B23). High T: the divided scores pull together, bars level, slices even out, the
  tree bursts, and one branch reaches an odd token.

## 4. Visual system specification

### Recurring objects and states

| Object | Represents | States | Inherited from |
|---|---|---|---|
| Prompt bar | The question being asked | idle, focused (caret), typed, duplicated | s02e01 opening |
| Answer panel | A generated answer | empty, streaming, complete, steady | s02e01 opening (streaming text) |
| Token tile | A token (cyan) | resting, chosen (glow), ghost, docked | s02e01 |
| Score bar | A raw score (neutral ink) | rising, divided by T | s02e01 (raw scores before probabilities) |
| Probability bar | A probability (green) | forming, highlighted, sharpening, flattening | s02e01 |
| Pick strip → wheel | The weighted draw | strip, curling, wheel at rest, spinning, landed | s02e01 strip (new: the wheel) |
| Ghost | A previous run, for comparison | desaturated, ~35 % opacity, never interactive | new |
| Branch tree | Possible continuations | growing; brightness ∝ path probability; pulse | new |
| Temperature control | The setting | value readout, moving | new |
| Model block | The same model, both times | silhouette of s02e01's layer stack | s02e01 layers |
| Context chips | Other inputs (conversation, model version) | appear, feed in | new |

### Colour (one meaning per hue, as s02e01)

Cyan = tokens · green = probabilities · neutral ink = raw scores, the temperature control and ghosts ·
violet (learned numbers) and amber (attention) appear only inside the s02e01 callback (B06), keeping
their s02e01 meanings. The chosen state is a cyan glow, never a new colour.

### The mathematics behind the visuals

- Illustrative scores (logits) are fixed per decision. **Probabilities = softmax(scores ÷ T)**, with T
  strictly positive (the control's range, for example 0.3–2.0, never reaches 0).
- At T = 1 the two named candidates must read **30 %** ("Sunlight") and **26 %** ("The"), as narrated.
- **The tail is modelled as many separate low-score tokens (for example 200), not one aggregate bar.**
  Temperature does not act on a pooled bucket the way it acts on its members, so a single "everything
  else" bar would make the temperature demonstration wrong.
- Sampled outcomes (the B10 dots, the B23 repeated spins, the B25 spins) come from seeded draws using
  the shown probabilities, so their proportions are honest; the two narrated spins (B11, B14) are
  staged and disclosed as a demonstration.
- Path brightness in the tree = the product of the step probabilities along the path (illustrative).

### Typography and labels

Brand faces only. Per frame at most one kicker, one caption of up to two lines, three labels. Kickers:
"ILLUSTRATIVE VALUES" whenever percentages or scores are on screen; "SAME PROBABILITIES ·
DEMONSTRATION" during the replay; "TEMPERATURE · ILLUSTRATIVE" during B20–B25. Captions name the
idea rather than repeating the narration (for example "Slice width = probability", "Low temperature:
sharper", "High temperature: flatter"). Tile text at least the s02e01 two-line opening's size
(~22 pt cap height at phone width).

### Camera language

One world. Pushes move *into* a detail (B05); pull-backs reveal consequence (B17, B26); returns
re-establish (B20, B28). No arbitrary orbits; slow drift only on holds. The tree grows upward,
which suits the vertical frame.

### Transition rules

Objects transform rather than cut: list → strip → wheel; tile → branch; branch → tree. A ghost is the
only way a previous state stays on screen. The end card is the only cut.

### Safe zones

All readable text clear of the Reels/Shorts interface zones (right 14 %, bottom 18 %); context text
fades as it drifts in (s02e01 `safe.js`); the whole film is audited with the s02e01 tool pattern.

## 5. Visual coverage audit

**Intentionally non-literal words** — each deliberately not depicted, and how its meaning still
reaches a viewer without sound:

| # | Word | Time | Why not literal | Meaning carried by |
|---|---|---|---|---|
| 34 | Neither | 13.64 | a 'no' icon would read as a judgement | equal, steady treatment of both panels |
| 38 | mistake. | 15.62 | ticks or crosses would imply grading answers; the point is that both are fine | the hold: both panels stay intact and equal |
| 51 | As | 21.55 | 'as we saw' needs no object | E01's visual world returning |
| 53 | saw | 21.91 | an eye icon would be decoration | the callback |
| 54 | last | 22.07 | a calendar would be decoration | the callback |
| 55 | time, | 22.43 | as above | the callback |
| 84 | Think | 35.33 | an imperative to imagine | the strip→wheel transformation |
| 113 | Now, | 45.68 | a beat, not an object | the rewind motion that follows |
| 306 | nothing | 120.64 | a 'broken' icon would introduce error imagery | panels intact and steady |
| 307 | broke. | 121.34 | showing breakage contradicts the message | panels intact and steady |
| 313 | Which | 123.72 | a transition word | the recession of the tree |
| 314 | raises | 123.92 | abstract | a single fresh card coming forward |
| 316 | bigger | 124.44 | a scale gag would undercut the tease | the camera settling on the card |
| 317 | question. | 124.78 | a '?' icon would be literal filler | the card itself |
| 322 | sound | 126.67 | audio is already sounding | the card's steady, confident fill |
| 328 | wrong? | 129.20 | showing an error here would suggest sampling causes wrong answers (out of scope; E03's subject) | withheld: the question is left open |
| 329 | That's | 130.21 | a hand-off | the next-episode hold |
| 330 | next. | 130.51 | a hand-off | the next-episode hold, then the end card |

**Phrase-level words** are the grammatical and dependent words (articles, prepositions, auxiliaries,
pronouns, connectives) and content words whose meaning only exists in their phrase (for example "might
get", "is made of", "starts from there"). Each belongs to exactly one phrase in §2a, and that phrase's
visual carries it; the generator refuses a word that is in no phrase or in two.

**Coverage check [fact, generated]:** all 331 timeline words appear exactly once, in timeline order;
every word has a class; no word is both direct and non-literal; every phrase's beat is described in §3.

## 6. Technical implementation map

### Reusable today [fact]

| Capability | Where |
|---|---|
| 9:16 Three.js rendering, compose, determinism, end card | `abs render` / `abs compose --target 9x16`; `renderers/three/tools/check-determinism.mjs`; `brandEndCard({ target: '9x16', handle: false })` |
| Video director with portrait overlay | `renderers/three/src/video/` |
| Tiles, bars, text planes, panels, glow sprites | `episodes/s02e01-ask-chatgpt/three/objects.js` (episode-local) |
| Palette, layout helpers, frame and safe-zone constants | `…/s02e01-ask-chatgpt/three/look.js` (episode-local) |
| Prompt bar and streaming answer | `…/three/opening.js` (episode-local; one answer) |
| Candidate panel, pick strip, marker | `…/three/prediction.js` (episode-local) |
| Bloom on selected objects | `…/three/bloom.js` (episode-local) |
| Safe-zone fade and whole-film audit | `…/three/safe.js`, `check-safe-zones.mjs` (episode-local) |

### New for s02e02

| Component | Notes |
|---|---|
| Probability maths: softmax with temperature, seeded weighted sampling | Pure functions; unit-testable without a browser |
| Wheel, with strip → wheel morph and a landing pointer | Deterministic spin curves that end on a given slice at a given time |
| Ghost / replay | Desaturated snapshot of a prior state; exact alignment |
| Dot tally | Seeded hypothetical spins |
| Branch tree | Procedural layout; brightness from path probability; travelling pulse |
| Temperature control and pipeline | Control, ÷ T operator, recomputed bars and slices |
| Two-answer layout | Two prompt bars and panels (generalises s02e01's single answer) |
| Context chips | Simple labelled inputs feeding the model block |

### Proposed ownership

- **Shared, in a new `renderers/three/src/domains/ml/`:** the probability maths, the generic primitives
  (tile, bar, text, panel), the strip and wheel, bloom, and the safe-zone fade. A generic safe-zone audit
  under `renderers/three/tools/`.
- **Episode-specific (`episodes/s02e02-different-answers/three/`):** the storyboard, scene composition,
  tree data and all timing.
- **s02e01 stays untouched in this episode's work.** The shared modules start as copies of s02e01's
  generic code, and s02e01 keeps its own copies. Moving s02e01 onto the shared modules would be a
  separate, approved migration, proven by its determinism baseline (10/10 frames identical). This
  avoids destabilising an accepted film; the cost is temporary duplication.

### Production files still needed (at implementation, after approval)

`episode.yaml` (targets `[9x16]`, `platforms: {9x16: reels}`, `renderer: three`, `voiceover:
timeline/timeline.json`, `audio: {path: audio/s02ep02.mpeg, sha256: 409b46c6…}`, `tail: 5.0`),
`picture.md`, `storyboard/beats.yaml` and `shots.yaml`, `three/`, tests, and a determinism baseline.

## 7. Acceptance checklist

**Synchronisation**
- [ ] Every visual event resolves from a word in `timeline/timeline.json` (transcript spelling, including `30%`/`26`); no hand-typed times.
- [ ] Key landings on their words: spin 1 on "the." (44.46 s), spin 2 on "Sunlight" (52.77 s), the zoom-out on "Zoom" (72.12 s), the control on "temperature" (85.98 s).
- [ ] Output audio identical to `audio/s02ep02.mpeg`; picture length = audio + tail (±1 frame).

**Semantic coverage**
- [ ] Every one of the 331 words is covered as specified in §2 (direct, phrase, or deliberately non-literal).
- [ ] With the sound off, each beat in §3 still communicates its purpose.

**Accuracy**
- [ ] "ILLUSTRATIVE VALUES" whenever percentages or scores show; 30 % and 26 % at T = 1.
- [ ] The replay disclosed as a DEMONSTRATION; ghosts align exactly.
- [ ] Probabilities = softmax(scores ÷ T), T > 0; the tail modelled as many tokens.
- [ ] Low T shown as "far more repeatable", with at least one differing outcome; never "identical".
- [ ] Sampling shown as one source of variation among several (B26).
- [ ] No mood or creativity imagery for temperature; no ticks or crosses on the answers; the E03 tease shows no error.

**Composition and quality**
- [ ] One continuous world, no cuts before the end card; objects transform.
- [ ] Text limits per frame respected; captions name ideas rather than repeating narration.
- [ ] Safe-zone audit: no readable text in the platform zones.
- [ ] Determinism: frames byte-identical across sessions; s01e03 and s02e01 baselines unchanged.
- [ ] All test suites green; `abs plan` ready.
- [ ] Early review of B09–B16 (the wheel, replay and fork) before full production.
