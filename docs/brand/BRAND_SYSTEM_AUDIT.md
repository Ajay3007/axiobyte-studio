# AxioByte brand system — audit

**Scope:** the brand infrastructure created during the E02 CTA work, and every other brand definition it has to coexist with.
**Status:** audit only. Nothing was changed except creating this file. E02 is final and frozen.
**Date:** 2026-10-11.
**Update:** the brand policy decisions that followed this audit are recorded in §15. The sections above are kept as found.

Priority classes used below:

- **P0:** must fix or decide before future production.
- **P1:** should fix during brand-system consolidation.
- **P2:** optional improvement.

Inconsistency classes:

- **A:** canonical and correct.
- **B:** legacy content that stays frozen.
- **C:** future content that must use the canonical brand.
- **D:** system-level duplication to fix eventually.

---

## 1. Executive verdict

**The Three.js brand layer is safe to reuse for the next 16:9 Three.js episode, but only after one P0 decision.**

- `renderers/three/src/brand/` (`axiobyte.js`, `endCard.js`, the transparent logo) contains no E02 IDs, scenes, timing, cameras, semantic logic or text. Another episode can call `brandEndCard({ start, end })` without knowing anything about Zero Copy.
- The transparent logo asset is a faithful, deterministic extraction. I regenerated it and the bytes are identical.

The audit also found that **the studio's brand system is not yet the only brand system**:

1. **A complete, older brand system exists outside the studio repo**, in `my_manim_projects/`:
   - `axiobyte_brand.md`, `brand_kit.py` (the `AXIOBYTE` class) and `axiobyte_assets.py`;
   - **the supplied logo is a render of `axiobyte_assets.py::ProfilePhoto`**. The pixel comparison against `media/images/axiobyte_assets/ProfilePhoto_ManimCE_v0.20.1.png` gives a mean difference of 1.64/255, which is JPEG noise.
   - That older system defines **different handles per platform**, **different brand colours** (the colours the logo actually uses), and a "∀ symbol only" avatar/watermark variant.
2. **The handle is not settled across sources.** Three variants exist:
   - `@theaxiobytes`: the studio, and YouTube in the legacy kit, where it is marked "confirmed handle";
   - `@axiobyte`: Instagram and LinkedIn in the legacy kit, and the E02 Instagram caption;
   - `@axiobyte.systems`: the Systems Instagram account, used in the reference Manim outros.

   **P0:** the owner must confirm which accounts exist on which platform before the next publication.
3. **The brand cyan and amber in the studio are not the logo's colours.**
   - The studio tokens are `#34D8E8` and `#F0A431`, borrowed from the semantic roles `mbuf` and `cpu`.
   - The logo is drawn in `#5DE8F5` and `#F0B429` (legacy `brand_kit.P.DATA` and `P.ACCENT`; measured `#5CE8F5` and `#EDB42C`).
4. **The Three.js renderer still contains an older, typographic brand.**
   - `video/overlay/widgets/titles.js`: `brandMark` writes "AXIOBYTE" in type, and the generic `endCard` sets the title 'AXIOBYTE'.
   - It uses an off-brand overlay palette.
   - E03 (`s01e03-what-is-a-nic`) uses it.
5. **The studio's Manim backend has no brand layer at all**, so a future Manim episode cannot yet use the brand without duplicating it.

None of this affects E02 as released on YouTube:

- its end card uses the real logo and the YouTube handle;
- its palette difference is subtle (section 12, I‑17).

---

## 2. Canonical brand sources

### 2.1 Where each brand element is defined today

| Element | Studio (current canonical intent) | Other definitions found | Verdict |
|---|---|---|---|
| **Logo (full lockup)** | `assets/axiobyte-logo`, a 1080×1080 progressive JPEG. Rendering asset: `renderers/three/src/brand/assets/axiobyte-logo-transparent.png` | The **generator**: `my_manim_projects/axiobyte_assets.py::ProfilePhoto` plus `brand_kit.py`. A **lossless render** of it: `my_manim_projects/media/images/axiobyte_assets/ProfilePhoto_ManimCE_v0.20.1.png` (1080×1080 RGBA) | Intentional: the JPEG is the designated authority, and the generator is its origin. **Undocumented** (I‑8) |
| **Mark** | Described in `AXIOBYTE_BRAND.md` as "a stylized A … two layered translucent echoes" | `brand_kit.AXIOBYTE.SYMBOL = "∀"` (U+2200, the universal quantifier), set in the `Monospace` font at 340, bold. The "echoes" are `_symbol_glow`: two copies of the same glyph scaled ×2.8 and ×1.65, at 5 % and 14 % opacity | The studio's description is **inaccurate** (I‑7). The mark is the ∀ glyph, apex down. It must never be "corrected" into an upright A |
| **Wordmark** | Only inside the logo image. `LOGO.wordmark` records the halves for alt text and checks | `brand_kit.AXIOBYTE.wordmark()` (Monospace bold, Axio cyan / Byte amber). Retyped in 25 LeetCode covers and theme v3 (DejaVu Sans bold). Three.js `brandMark`: "AXIOBYTE" in Barlow | Studio: A. Covers and theme v3: B. Three.js `brandMark`: **D** (I‑9) |
| **Tagline** | `BRAND.tagline = 'Every concept has an axiom.'`, also inside the logo | `brand_kit.AXIOBYTE.TAGLINE_PRIMARY`, the same text. Legacy also defines per-platform taglines (`TAGLINE_YOUTUBE`, `TAGLINE_INSTA`, `TAGLINE_LINKEDIN`, `TAGLINE_INTRO`) | Primary tagline is consistent (A). The per-platform taglines aren't mentioned by the studio (I‑10) |
| **Handle** | `BRAND.handle = '@theaxiobytes'`. The doc says "Instagram, YouTube" | `brand_kit.AXIOBYTE`: `INSTAGRAM = "@axiobyte"`, `LINKEDIN = "@axiobyte"`, `YOUTUBE = "@theaxiobytes"  # confirmed handle`. `axiobyte_brand.md` §1 and §8 add `@axiobyte.systems` | **Conflict. P0** (I‑1, I‑2) |
| **Palette** | `BRAND_COLOR` in `axiobyte.js`, which a test holds equal to `systems.yaml` (`ground.bg`, `ink.*`, `roles.mbuf.hue`, `roles.cpu.hue`) | `brand_kit.P` (v2): `DATA #5DE8F5`, `ACCENT #F0B429`, `BG #080d14`. **The logo is drawn in these.** `axiobyte_theme_v3.py` and the covers use `#34D8E8` / `#F0A431` / `#090C13`. The Three.js overlay `theme.js` `C` uses yet another set (`#ECE8DA`, `#6EC1FF`, `#FFB454`) | Two competing brand palettes plus an off-brand overlay palette. **D** (I‑5, I‑6, I‑9) |
| **Typography** | `AXIOBYTE_BRAND.md`: "Barlow Semi Condensed … for everything readable". `CTA_TYPE` in `axiobyte.js` | Studio Manim: `design/tokens/type.yaml` (DejaVu Sans / DejaVu Sans Mono). Legacy: the wordmark is always monospace, plus a Manim scale of 60/44/32/… | Renderer-specific faces, which is fine, but the doc states Barlow as universal (I‑11) |
| **Spacing / safe area** | `END_CARD_LAYOUT` (fixed gaps 56 and 76). The doc's clear-space rule is "at least half its width" | `design/targets/*.yaml` `safe` and `platform_safe` (Python). Three.js `video/overlay/theme.js` `SAFE` (112/76 px). Legacy: clear space equals the ∀ height | Three sources, and the doc's rule contradicts the end card's own layout (I‑12) |

### 2.2 Ownership today

| Owner | Files | Role |
|---|---|---|
| Studio brand layer (Three.js) | `renderers/three/src/brand/axiobyte.js`, `endCard.js`, `assets/axiobyte-logo-transparent.png`, `assets/extract_logo.py` | Canonical values and the reusable end card for Three.js |
| Studio brand documentation | `docs/brand/AXIOBYTE_BRAND.md` | Canonical intent |
| Studio theme | `src/axiobyte_studio/design/themes/systems.yaml` | Source of every studio hex. **It has no `brand` section.** The brand borrows `roles.mbuf.hue` and `roles.cpu.hue` |
| Supplied artwork | `assets/axiobyte-logo` | The authoritative logo pixels |
| Legacy brand system (outside the repo, frozen) | `my_manim_projects/axiobyte_brand.md`, `brand_kit.py`, `axiobyte_assets.py`, `media/images/axiobyte_assets/*` | Origin of the logo, the avatars and the banners. The Manim-era brand constants |
| Legacy renderer brand (inside the repo) | `renderers/three/src/video/overlay/widgets/titles.js` (`brandMark`, `endCard`), `renderers/three/src/video/overlay/theme.js` (`C`, `SAFE`) | The pre-brand typographic wordmark. Used by E03 |

**Accidental competing sources:** the handle, the palette, and the typographic wordmark in `titles.js`.

**Intentional renderer-specific representations:**

- `CTA_TYPE` and `END_CARD_LAYOUT` (Three.js, in pixels);
- `type.yaml` (Manim faces);
- the transparent PNG, which is a derived asset of the JPEG.

---

## 3. Three.js reusability audit

I checked `axiobyte.js`, `endCard.js` and the logo asset:

| Check | Result |
|---|---|
| E02 IDs | **None.** The only ID is `'brand:end-card'` |
| E02 scene references | **None.** `endCard.js` imports only `./axiobyte.js`. `axiobyte.js` imports nothing |
| E02 timing assumptions | **None.** `END_CARD_TIMING` is relative to the card's `start`, and `end` is the caller's. The 3.5 s length lives in E02's `storyboard.js`, not in the brand module |
| E02 semantic colours | **None used.** The module comments mention that brand cyan and amber *equal* the mbuf and CPU role hues, but the card draws no technical object. The conceptual coupling (brand palette sourced from semantic roles) is I‑6 |
| E02-specific text | **None.** `BRAND.cta` is generic |
| E02-specific camera | **None.** It is a 2D overlay cue drawn with `ctx`. It needs nothing from the 3D scene |
| E02-specific rendering state | **None.** `ctx.save()` and `ctx.restore()` are balanced. The logo image is a module singleton loaded by `loadBrandAssets()`. If the logo is missing, drawing throws, so it fails loudly |

**Verdict: clean.** A new Three.js episode needs exactly two lines:

1. `await loadBrandAssets()` in its `video-main.js`;
2. `brandEndCard({ start: filmEnd, end: filmEnd + 3.5 })` in its storyboard.

Gaps that are not E02 coupling (smallest change for each; none implemented):

1. **Font dependency is implicit (I‑13, P1).**
   - `CTA_TYPE` needs Barlow Semi Condensed 600/700. Each episode loads it through its own copy of `loadFonts()`; E02 and E03 each have one.
   - A new episode that forgets this gets Arial Narrow silently. The logo has a fail-loud check; the fonts don't.
   - **Smallest change:** have `loadBrandAssets()` also `document.fonts.load()` the two CTA faces and throw if they don't resolve.
2. **The layout is 16:9 only (I‑15, P1; P0 if the next deliverable is vertical).**
   - `END_CARD_LAYOUT` hard-codes the 960/540 centre and the 1920×1080 scale.
   - **Smallest change:** take `{ width, height }` (or a target id) and centre on that, plus a 9:16 layout that respects `design/targets/9x16.yaml` `platform_safe`.
3. **There is no minimum duration (P2).** With `end - start < 1.8` s the handle never reaches full opacity. A guard or warning would catch it.
4. **The brand tests live in an episode-named file (I‑14, P2).** `test/s01e02-end-card.test.js` holds both E02 integration checks and episode-independent brand checks. The latter belong in `test/brand.test.js`.

---

## 4. Manim compatibility audit

| Item | Studio Manim backend (`src/axiobyte_studio/`) | Legacy Manim (`my_manim_projects/`) |
|---|---|---|
| Logo / wordmark | **Nothing.** No brand, logo, tagline, handle or end-card code (searched `src/` for brand, logo, tagline, watermark, end card, outro, wordmark) | `brand_kit.AXIOBYTE.wordmark()`, `symbol_mark()`, `full_logo()`. These are **typeset reconstructions**, and `full_logo()` places ∀ beside the wordmark, which is a different lockup from the supplied logo |
| Palette | `systems.yaml`, the same file the Three.js brand mirrors. Consistent | `brand_kit.P`, the v2 palette. This is the logo's palette |
| Typography | `type.yaml`: DejaVu Sans / Mono, sizes 66…18 | Monospace wordmark; Sans for the rest |
| Tagline / handle | none | `AXIOBYTE.*` constants, with handles split per platform |
| End card | none | `outro_cta()` and `outro("Every concept has an axiom.")` in `brand_kit.py`. Reference episodes end on "Follow @axiobyte.systems" |

**Verdict: no coherent studio equivalent yet.** A future studio Manim episode would have to either:

- re-declare the handle, CTA and tagline (duplication); or
- import the legacy `brand_kit.py` (a second brand source, with a different handle, palette and lockup).

**Recommended shape (P1, not implemented):**

1. Move the renderer-neutral values (name, tagline, handle(s), CTA text, brand colours, logo path and metadata) into **one data file**, such as `src/axiobyte_studio/design/brand.yaml` or a `brand:` block in `systems.yaml`.
2. Have `axiobyte.js` held equal to it by a test, exactly as `BRAND_COLOR` is held to `systems.yaml` today.
3. Add a Manim end card that places the **same logo image** (`ImageMobject` of the transparent PNG; Manim supports RGBA). It must never use `brand_kit.full_logo()`.

The protected Manim E02 render and the reference episodes are untouched by this.

---

## 5. Social / content consistency audit

| # | Where | What | Class |
|---|---|---|---|
| S‑1 | `renderers/three/src/brand/axiobyte.js`, `endCard.js`, `docs/brand/AXIOBYTE_BRAND.md`, E02 end card (in the frozen render) | `@theaxiobytes`, "FOLLOW AXIOBYTE FOR MORE", tagline in the logo | **A** |
| S‑2 | `episodes/s01e02-zero-copy/social/caption.txt` | The Instagram section header reads `INSTAGRAM CAPTION (@axiobyte)`. The YouTube section reads `(@theaxiobytes / AxioByte)`. This matches the legacy per-platform handle map exactly | **B** (frozen with E02), **but see P0 I‑1.** If Instagram really is `@axiobyte`, this caption is correct and the end card's `@theaxiobytes` is wrong *for an Instagram post* |
| S‑3 | `AXIOBYTE_BRAND.md` line 24 says `caption.txt` "signs as `@axiobyte`" | Only partly true: its YouTube section already uses `@theaxiobytes` | **Doc factual error** (I‑4, P1) |
| S‑4 | 25 LeetCode cover scripts `my_manim_projects/manim-scripts/top-150-lc/lc-*/cover*_9x16.py`, plus rendered `axiobyte_*_cover_9x16.png` | Footer `@axiobyte · from first principles`. Wordmark retyped in DejaVu Sans. Background `#0B0E14` | **B** |
| S‑5 | `my_manim_projects/manim-scripts/axiobyte_theme_v3.py` | `@axiobyte · from first principles`. Retyped wordmark | **B** |
| S‑6 | Reference episodes `Ajay3007.github.io/_learning/manim-scripts/axiobyte-system/ep01`, `ep02` (and their copies in `my_manim_projects/manim-scripts/systems/`), plus `sys01` and its captions | `Follow @axiobyte.systems` in the outro pill. Retyped wordmark | **B.** The reference episodes are also the Phase 0 frame-identical gate and must never change |
| S‑7 | `my_manim_projects/brand_kit.py` (`AXIOBYTE`), `axiobyte_brand.md`, `axiobyte_assets.py` (`ProfilePhotoSystems` for `@axiobyte.systems`) | A complete parallel brand definition | **D** (and B as content) |
| S‑8 | `renderers/three/src/video/overlay/widgets/titles.js` `brandMark` / `endCard`; `episodes/s01e03-what-is-a-nic/three/storyboard.js` lines 349 and 867–872 (`title: 'AXIOBYTE'`, kicker `THANKS FOR WATCHING`, no handle) | A typographic brand in the studio renderer | **D** for the widget. **C** for E03, which should adopt `brandEndCard` before it ships |
| S‑9 | Any future caption, description, cover, end card | | **C.** Use `BRAND.*` and the per-platform handle map once I‑1 is decided |

Nothing in B should be edited.

---

## 6. Avatar / watermark assessment

**Correction to the earlier note "there is no avatar yet":**

- An avatar already exists. The supplied logo *is* the legacy `ProfilePhoto` (1080×1080). The legacy kit labels it "Main AxioByte profile photo — use for Instagram, LinkedIn, and YouTube".
- What does not exist is the **mark-only variant**, which the legacy doc lists as "∀ symbol only — Profile avatar, app icon, watermark".

### Can the mark be extracted without redrawing?

**Route 1 — raster cut from the transparent PNG.** No redrawing, but it has limits:

- **The solid ∀ separates cleanly.**
  - It is a single connected component (alpha > 0.6) at x 192–395, y 245–505 of the PNG: 204×261 px, 26,770 px.
  - There are 27 clear rows between it and the wordmark (the wordmark starts at y 533).
- **The echoes don't separate.**
  - The ×1.65 and ×2.8 glow copies continue *behind* the wordmark and the tagline. The wordmark is composited over them, so there is no source pixel for the echo there.
  - Cutting "mark + echoes" would either include part of the wordmark or crop the echoes mid-shape. Both break the rule "never crop into the logo", and filling them in would be redrawing.
- **Transparency is already available.** The solid ∀ has alpha ≈ 0.957, with recovered colour ≈ `#60F2FF`. This is valid on **dark grounds only** (see section 7).
- **Resolution:**
  - 261 px tall natively, from a JPEG;
  - **suitable** for a video watermark (about 48 px, the doc's rule) and a small corner mark;
  - **suitable** for a profile avatar up to about 300 px displayed size;
  - **not suitable** for an 800×800 YouTube upload or a 1080 avatar without upscaling, which softens the edges.

**Route 2 — re-render from the original generator.** This gives exact vector quality at any size.

- `axiobyte_assets.py` builds the mark as `_symbol_glow(Text("∀", font="Monospace", font_size=340, weight=BOLD, color=P.DATA), scales=(2.8, 1.65), opacities=(0.05, 0.14))`.
- Rendering only that group with a transparent background reproduces the mark and its echoes at any resolution, without redrawing.
- **Precondition:** the font alias `Monospace` resolves through fontconfig. On this Mac today `fc-match Monospace` gives *Andale Mono*, which may not be the face the logo was rendered with (its lettering looks like DejaVu Sans Mono Bold).
- So the generator must first be shown to reproduce the supplied logo: render `ProfilePhoto` and compare it with `assets/axiobyte-logo`, expecting only JPEG-level difference, with the font pinned.
- This also needs the **owner's explicit approval**, because it produces new pixels (from the original code, but new nonetheless).

### Future asset specification (do not create yet)

| Asset | Content | Spec |
|---|---|---|
| `axiobyte-mark.png` (master) | The ∀ with its two echoes, exactly as in the logo, **no wordmark** | Route 2 only (route 1 can't include the echoes). Square, transparent, at least 2048 px, mark optically centred. Dark-ground use only |
| `axiobyte-mark-solid.png` | The solid ∀ only, no echoes | Route 1 (exact pixels) or route 2. Transparent. Use for the watermark and favicon (the 5 % echoes vanish at small sizes anyway) |
| Avatar | Existing: the full logo (`ProfilePhoto`). Optional mark-only avatar | Square 1080 on the logo's own ground (`#080d14` with its vignette, exactly as `ProfilePhoto`). Mark inside the central circle (platforms crop to a circle), with at least 15 % padding. Route 2 needed above about 300 px |
| Video watermark | `axiobyte-mark-solid` | About 48 px tall, 60 % opacity, one fixed corner (as in `AXIOBYTE_BRAND.md`). Outside `platform_safe` zones on 9:16 |
| Light-ground variant | — | **Does not exist.** The legacy doc names darkened colours (`#0a6878` / `#b07a00`) but there is no asset. Don't place the transparent PNG on light grounds |

The orientation is part of the mark. It is **∀, apex down**, and must never be flipped into an upright "A".

---

## 7. Logo asset assessment

| Check | `assets/axiobyte-logo` | `axiobyte-logo-transparent.png` |
|---|---|---|
| Format | JPEG, JFIF 1.01, progressive, 3 components, no ICC profile, **no file extension** | PNG RGBA |
| Dimensions | 1080×1080 | 588×749 (crop x 246–834 and y 153–902 of the source, plus an 8 px margin) |
| Aspect ratio | 1:1 | 0.785, the logo's own extent. Not padded to the source aspect, which is correct for layout |
| Transparency | none: a dark radial ground (`#06090E` centre, `#080C15` corners) with a faint dot grid | 46.1 % fully transparent, 53.5 % partial, 0.4 % at alpha > 0.98 |
| Fidelity | Authoritative. It is itself a JPEG of the lossless `ProfilePhoto` PNG (mean difference 1.64) | On a dark ground it reproduces the source with a mean difference of 0.4/255 on logo pixels (`AXIOBYTE_BRAND.md`). Solid ∀ alpha 0.957, wordmark 0.933, tagline 0.53 |
| Cropping | — | Includes the full outer echo (`extent` 10–578 × 13–741). Nothing is cropped into the logo |
| Determinism | — | **Verified.** I ran `extract_logo.py` with output redirected to the scratchpad, and the result was **byte-identical** to the committed asset (sha256 `035e306ab0eae3b3…`) |
| Reuse | — | Good for any **dark** ground (the brand background and its neighbours). **Not valid on light grounds.** The alpha comes from un-blending against a dark background, so on light grounds the partial pixels would read as a dark halo and the solid mark would let 4 % of the ground through |

Notes:

- **Extraction depends on scipy** (`ndimage`). The system Python's scipy is broken against NumPy 2 on this Mac; the `.venv` works. P2: note this in the script's docstring.
- **A lossless source exists:** `my_manim_projects/media/images/axiobyte_assets/ProfilePhoto_ManimCE_v0.20.1.png`. Extracting from it would remove JPEG noise. That's an owner decision (P2): the JPEG remains authoritative until the owner says otherwise.

---

## 8. End-card abstraction assessment

```js
brandEndCard({ start, end, brand = BRAND, color = BRAND_COLOR })
```

| Owned by the brand system (in `endCard.js` / `axiobyte.js`) | Owned by the episode (in its storyboard) |
|---|---|
| logo image and scale (`LOGO_ASSET`, `CTA_LOGO_SCALE`) | `start` = where its film ends (`filmEnd`) |
| palette (`BRAND_COLOR`) | `end` = how long the card holds |
| CTA and handle type (`CTA_TYPE`) | holding the last film frame underneath (the card fades its own ground up over it) |
| layout and internal spacing (`END_CARD_LAYOUT`) | calling `loadBrandAssets()` (and, today, loading Barlow; I‑13) |
| arrival timing (`END_CARD_TIMING`) | a section entry for the card, if it wants one (E02 adds `'AXIOBYTE'`) |
| ground, grid and vignette | |

**Verdict: the separation is already good.** The brand side knows nothing about the episode, and the episode supplies only time. Overriding `brand` (for example a platform-specific handle) is already possible without code changes.

Missing for full reuse:

- I‑13 (font loading);
- I‑15 (9:16 layout);
- a per-platform handle selector once I‑1 is decided. `brand` override already makes this a data change, not a code change.

---

## 9. CTA standard assessment

The current card shows the logo (with its tagline), then **FOLLOW AXIOBYTE FOR MORE**, then **@theaxiobytes**.

**Suitable as the default AxioByte educational-video CTA:**

- It has one call, which is the brand doc's "one call only" rule.
- It is consistent with the legacy brand voice, which explicitly bans "Like and subscribe".
- It names the brand rather than a platform action, so it works on every platform.
- Its text is legible at 844 px landscape (call ≈ 32 px).
- The tagline isn't repeated.

Recommendations (report only):

- **R‑1 (P0, tied to I‑1):** the *handle* is the only platform-dependent part. Post a card with `@theaxiobytes` only where that handle is the account the post lives on.
- **R‑2 (P2):** keep "FOLLOW AXIOBYTE FOR MORE" as the default.
  - The legacy `CTA_FOLLOW` ("Follow AxioByte for the axiom behind every idea.") is on-voice but twice as long and weaker on a portrait phone, so it doesn't beat the current call.
  - If a variant is ever wanted, "FOLLOW AXIOBYTE FOR THE NEXT AXIOM" stays short and uses the brand idea. That's optional.

---

## 10. Mobile / safe-area standard

Values established by E02, and where each should live:

| Value | E02 | Scaled ×0.44 (844 px landscape) / ×0.203 (390 px portrait phone, 16:9 letterboxed) | Class |
|---|---|---|---|
| Design frame 1920×1080 | yes | — | **B** (renderer detail; the Python targets already define 16:9, 1:1, 9:16) |
| End-card logo scale 0.91 (visible lockup ≈ 456 px) | yes | 201 / 93 px | **A** global standard for a 16:9 end card |
| End-card call: 72 px, 700, track 3 | yes | 32 / 15 px | **A** |
| End-card handle: 58 px, 600, track 1.5, cyan "@" | yes | 26 / 12 px | **A** |
| Gaps: logo→call 56 px, call→handle 76 px | yes | — | **A** (16:9 end card) |
| Group centred on the frame, measured from the outer echo to the handle descender (y 144–932) | yes | — | **A** |
| Timing 0–0.5 / 0.5–1.1 / 0.9–1.5 / 1.2–1.8, hold to 3.5 s | yes | — | **A** |
| Tagline inside the logo (≈ 19 px at 1080) | yes | 8 / 4 px. Illegible on a portrait phone | **A** as a known limit. A text tagline for portrait is a future option, but the logo must not be altered |
| Annotation type 52 / 38 / 28 px, chapter 26 px | yes | 23 / 17 / 12 / 11 px (landscape) | **C** E02-specific values. A *minimum* ("no readable text below 26 px at 1080") is a candidate **A** rule |
| Watermark about 48 px, 60 % | doc only | — | **A** (when the mark exists) |
| Overlay `SAFE` 112/76 px (`video/overlay/theme.js`) | not used by the brand card | — | **B** |
| Python `targets/*.yaml` `safe` and `platform_safe` (Reels/Shorts/TikTok occlusion) | not used by the Three.js brand | — | **A** source for 9:16. The brand card should consume it (I‑15) |

---

## 11. Documentation gaps (`docs/brand/AXIOBYTE_BRAND.md`)

It is clear and nearly authoritative for Three.js. These sections are missing or inaccurate:

1. **The mark is ∀.** Name the glyph (U+2200), its meaning, its orientation (apex down) and "never flip". Replace "stylized A" (I‑7).
2. **Logo provenance:** the generator (`my_manim_projects/axiobyte_assets.py::ProfilePhoto`, `brand_kit.py`), the lossless render, and that the JPEG remains the authority (I‑8).
3. **Handles per platform:** a table of platform → handle, including `@axiobyte.systems`, with the owner's confirmation status. Today the doc asserts `@theaxiobytes` for Instagram, which the legacy kit contradicts (I‑1, I‑2).
4. **Logo colours vs brand tokens:** state which pair is canonical. Fix the claim that `#34D8E8` / `#F0A431` are "the A mark and Axio" / "Byte": the logo is drawn in `#5DE8F5` / `#F0B429` (I‑5).
5. **Line 24 correction:** `caption.txt` uses both handles (I‑4).
6. **Typography scope:** Barlow is the Three.js face. Manim uses `type.yaml` (DejaVu). The logo's lettering is part of the artwork (I‑11).
7. **Clear space:** "half its width" contradicts the end card's 56 px call gap. Define clear space as applying to *unrelated* elements, and the end card's internal spacing as the exception (I‑12).
8. **Ground restriction:** the transparent PNG is valid on dark grounds only, and there is no light-ground variant.
9. **Renderer responsibilities:** a Three.js section (exists), a Manim section (missing), and where the shared values will live (section 4).
10. **Font dependency:** the end card needs Barlow 600/700 loaded by the episode (I‑13).
11. **Aspect ratios:** the end card is 16:9 only. 9:16 and 1:1 are not yet supported.
12. **Legacy register:** a list of legacy brand sources (`brand_kit.py`, the covers, the reference outros, `titles.js` `brandMark`) with "frozen, not a source" status.
13. **Avatar:** the existing avatar is the full logo (`ProfilePhoto`). The "Not yet separate" row should say *mark-only* variant (section 6).

---

## 12. Exact inconsistencies found

| ID | Inconsistency | Evidence | Class | Priority |
|---|---|---|---|---|
| I‑1 | Instagram handle: `@theaxiobytes` (studio) vs `@axiobyte` (legacy kit, E02 Instagram caption) | `axiobyte.js:16`; `AXIOBYTE_BRAND.md:20`; `brand_kit.py` `AXIOBYTE.INSTAGRAM`/`LINKEDIN`/`YOUTUBE`; `caption.txt:19,42` | D | **P0**: owner confirms the platform → handle map |
| I‑2 | `@axiobyte.systems` exists and the studio doc doesn't mention it | `axiobyte_brand.md` §1 and §8; reference `ep01`/`ep02` outros; `ProfilePhotoSystems` | B (content) / D (undocumented) | P1 |
| I‑3 | `@axiobyte` in 25 LeetCode covers and theme v3 | `top-150-lc/lc-*/cover*_9x16.py`; `axiobyte_theme_v3.py:180` | B | — |
| I‑4 | The doc says `caption.txt` signs as `@axiobyte`, but it uses both | `AXIOBYTE_BRAND.md:24` vs `caption.txt:42` | doc error | P1 |
| I‑5 | Brand cyan/amber tokens ≠ the logo's colours | `BRAND_COLOR` `#34D8E8`/`#F0A431` vs logo `#5DE8F5`/`#F0B429` (measured `#5CE8F5`/`#EDB42C`); `LOGO.wordmark` claims the halves use `BRAND_COLOR` | D | P1: owner picks the canonical brand pair |
| I‑6 | The brand palette is sourced from semantic roles (`roles.mbuf.hue`, `roles.cpu.hue`). `systems.yaml` has no `brand` block. A future change to a semantic role would silently recolour the brand | `axiobyte.js:23`; `systems.yaml:53` ("the mbuf, and the AxioByte mark") | D | P1 |
| I‑7 | The mark is described as a "stylized A"; it is the ∀ glyph with two scaled glow copies | `AXIOBYTE_BRAND.md:30`; `brand_kit.py` `SYMBOL = "∀"`; `axiobyte_assets.py` `_symbol_glow` | doc error | P1 |
| I‑8 | The logo's generator and lossless render exist outside the repo, undocumented | the `ProfilePhoto` comparison (mean difference 1.64) | D | P1 |
| I‑9 | A typographic "AXIOBYTE" brand and an off-brand palette in the Three.js renderer, used by E03 | `titles.js:5–27`, `:152`; `overlay/theme.js` `C`; `s01e03…/storyboard.js:349,867–872` | D / C | **P0 before E03 (or any episode using these widgets) ships**; P1 otherwise |
| I‑10 | Legacy per-platform taglines and CTAs aren't reconciled | `brand_kit.py` `TAGLINE_*`, `CTA_*` | B / D | P2 |
| I‑11 | The doc makes Barlow universal; Manim uses DejaVu | `AXIOBYTE_BRAND.md:90`; `type.yaml` `faces` | doc scope | P1 |
| I‑12 | Clear-space rules conflict | `AXIOBYTE_BRAND.md:50` vs `END_CARD_LAYOUT` (56 px); legacy "height of ∀" | doc | P1 |
| I‑13 | The end card's font dependency is implicit and duplicated per episode | `loadFonts()` in `s01e02…/video-main.js:27` and `s01e03…/video-main.js:25` | D | P1 |
| I‑14 | Brand-generic tests sit in an episode-named file | `renderers/three/test/s01e02-end-card.test.js` | D | P2 |
| I‑15 | The end card is 16:9 only | `END_CARD_LAYOUT` (960/540) | C | P1 (P0 if the next deliverable is 9:16) |
| I‑16 | The studio Manim backend has no brand layer | search of `src/` | C | P1 |
| I‑17 | Two cyans on one card: the logo's `#5DE8F5`-ish and the handle "@" in `#34D8E8` | E02 end card | A in E02 (frozen; barely perceptible) | P2, resolved by I‑5 |

---

## 13. Recommended future cleanup (not implemented)

**P0 — before the next production:**

1. **Confirm the platform → handle map** (I‑1, I‑2): YouTube, Instagram, LinkedIn, Systems.
   - If Instagram is `@axiobyte`, add `handles: { youtube, instagram, linkedin, … }` to the brand data.
   - Make the end card's handle a parameter chosen per deliverable. This is a data change through the existing `brand` override.
2. **Before any episode using `titles.js` `brandMark`/`endCard` ships (E03 today):** switch its closing card to `brandEndCard` (I‑9).
3. **If the next deliverable is vertical (Reels/Shorts):** a 9:16 end-card layout bound to `targets/9x16.yaml` `platform_safe` (I‑15).

**P1 — brand-system consolidation:**

4. One renderer-neutral brand data file, held equal to `axiobyte.js` by a test:
   - name, tagline, handles, CTA, brand colours, logo path and metadata (I‑6, I‑16);
   - a `brand:` block **separate from semantic `roles`**.
5. The owner decides the canonical brand colour pair: the logo-native `#5DE8F5` / `#F0B429`, or the theme's `#34D8E8` / `#F0A431` (I‑5). Record the logo's measured colours either way.
6. Have `loadBrandAssets()` also load and verify the CTA fonts (I‑13).
7. A studio Manim end card that places the same logo PNG (`ImageMobject`), consuming the shared brand data (I‑16).
8. Retire `titles.js` `brandMark` and the 'AXIOBYTE' `endCard` title, or mark them deprecated (I‑9).
9. Correct and extend `AXIOBYTE_BRAND.md` per section 11.
10. Mark-only asset (section 6): route 1 for the solid ∀ watermark; route 2 only after a font-pinned reproduction check and owner approval.

**P2:**

11. Move brand-generic tests to `test/brand.test.js` (I‑14).
12. Guard against a minimum end-card duration.
13. Optionally re-extract from the lossless `ProfilePhoto` PNG (owner decision).
14. Note the scipy/`.venv` requirement in `extract_logo.py`.
15. Reconcile the legacy per-platform taglines and CTAs (I‑10).

---

## 14. Must remain frozen

- **E02 Zero Copy:**
  - `episodes/s01e02-zero-copy/three/**` (storyboard, scenes, composition, typography, `video-main.js`);
  - `episode.py`, `timeline/words.json`, `timeline.json`, the voiceover;
  - `social/caption.txt`;
  - every render in `episodes/s01e02-zero-copy/out/`, in particular `s01e02-zero-copy.three-final-cta-branded-v2.mp4` (the release candidate) and the protected Manim `s01e02-zero-copy.mp4`.
- **The brand modules as rendered into E02:** `renderers/three/src/brand/axiobyte.js`, `endCard.js`, `assets/axiobyte-logo-transparent.png`.
  - Any future change must keep E02's card byte-identical, or be explicitly re-approved.
  - The E02 tests in `s01e02-end-card.test.js` guard this.
- **`assets/axiobyte-logo`:** the supplied logo, never edited.
- **The legacy content (class B):**
  - LeetCode covers and their PNGs;
  - `axiobyte_theme_v3.py`;
  - `my_manim_projects/axiobyte_brand.md`, `brand_kit.py`, `axiobyte_assets.py` and their renders;
  - the reference episodes (also the Phase 0 frame-identical gate).
- **`systems.yaml` semantic roles:** the E02 meanings (red = copy, blue = bytes/DMA, yellow = handle/reference, violet = buffer/memory, cyan = mbuf) are episode and theme semantics, **not brand semantics**. A brand block must never reassign them.

---

## Validation

Run after writing this file:

| Check | Result |
|---|---|
| `npm test -w @axiobyte/three` | 371 / 371 passed |
| `pytest -o addopts="" -q` | 874 passed |
| `npm run build` | built |
| `git diff --check` | clean |
| `git status` | the only change compared with before the audit is this new untracked file, `docs/brand/BRAND_SYSTEM_AUDIT.md` |

Only this document was created. No production source, E02 content, approved render, voiceover, timeline, or brand asset was modified. The determinism check regenerated the logo PNG into the session scratchpad, not into the repository. Nothing was committed, pushed, tagged, released or published.

---

## 15. Policy decisions recorded after the audit (2026-10-11)

These decisions are adopted as forward-looking policy for **new** content. They are documented in `AXIOBYTE_BRAND.md` and not yet implemented in code. No older content is rewritten.

| ID | Decision | Status |
|---|---|---|
| I‑1 | Platform handles: **YouTube `@theaxiobytes`; Instagram `@axiobyte`; LinkedIn `@axiobyte`** | **Resolved by policy.** The P0 is closed. E02's 16:9 YouTube end card (`@theaxiobytes`) and its caption (Instagram `@axiobyte`, YouTube `@theaxiobytes`) both match the policy |
| I‑2 | `@axiobyte.systems` is **legacy / reference only**. Never used for new CTAs unless explicitly requested | **Resolved by policy** (documented) |
| I‑3 | The LeetCode covers' `@axiobyte` matches the Instagram handle | Stays B, frozen. Now also consistent |
| I‑4 | The `caption.txt` description corrected in `AXIOBYTE_BRAND.md` | **Fixed** (doc) |
| I‑5 | The logo's colours `#5DE8F5` / `#F0B429` are recorded. The Three.js tokens `#34D8E8` / `#F0A431` are unchanged | **Deferred.** The consolidation decides whether the logo colours become canonical |
| I‑6 | Brand colours and semantic colours are declared separate systems. The current borrowing from `roles.mbuf` / `roles.cpu` is documented as a coincidence. Semantic roles are frozen | **Documented.** The separate brand data comes with the consolidation |
| I‑7 | The mark is **∀ (apex down), not an A**. The echoes are scaled copies of it | **Fixed** (doc) |
| I‑8 | The legacy generator is recorded as provenance only, frozen, and never imported | **Documented** |
| I‑9 | `titles.js` `brandMark` / `endCard` are marked legacy. **E03 must migrate to `brandEndCard` before it ships** | **Documented.** Migration is a future task |
| I‑15 | The end card is 16:9 only. **9:16 is required before any vertical video** | **Documented.** Future task |
| I‑16 | Manim has no brand layer. A future one uses the same logo asset and shared brand data | **Documented.** Future task |
| CTA | The default call is **FOLLOW AXIOBYTE FOR MORE** on every platform. The handle line is platform-aware (intended behaviour) | **Policy.** The platform-aware handle is not implemented |
| Avatar | The full logo is already usable as the avatar. The mark-only ∀ asset is a future task | **Documented** |

Unchanged: I‑10–I‑14 and I‑17 remain open, with their priorities in §12 and §13.
