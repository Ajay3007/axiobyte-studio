# AxioByte — brand system

The common layer every AxioByte video, short and page shares. It covers the name, the words, the logo, the palette discipline, typography roles, the end card and watermark rules.

It does not prescribe an episode's look. A DSA short can stay 2D, a DPDK film can be 3D, a future piece can be Manim. Each keeps its own visual language, and the brand layer is what makes them all recognisably AxioByte.

**Implementation:**

- `renderers/three/src/brand/data.js`: the shared brand policy data (handles by platform, the legacy handle, the default CTA, the logo's metadata and colours). It is data only. `axiobyte.js` reads its policy values from it (name, tagline, CTA, the YouTube handle, the logo's metadata), and `endCard.js` gets them through `axiobyte.js`. The rendering colours stay local to `axiobyte.js`. Tests: `test/brand-data.test.js`, `test/brand-layer.test.js`.
- `renderers/three/src/brand/axiobyte.js`: canonical values, colours and the logo asset.
- `renderers/three/src/brand/endCard.js`: the reusable end card.
- `renderers/three/src/brand/assets/`: the logo's transparent rendering asset and the script that derives it.
- Colours come from `src/axiobyte_studio/design/themes/systems.yaml`, the studio's single source of colour truth. A test holds the JS values equal to it.

## Canonical values

| | |
|---|---|
| Brand | **AxioByte** |
| Tagline | **Every concept has an axiom.** |
| Handles | **per platform**: see *Platform handles* below |
| Default call to action | **FOLLOW AXIOBYTE FOR MORE** |
| Positioning | **Systems that power the Internet — explained from first principles.** (short: *Systems explained from first principles.*) |
| Core topics | Linux Kernel · DPDK · Networking · Distributed Systems · Performance Engineering |

### Platform handles

The handle depends on the platform. There is no single handle for every platform.

| Platform | Canonical handle |
|---|---|
| **YouTube** | **@theaxiobytes** |
| **Instagram** | **@axiobyte** |
| **LinkedIn** | **@axiobyte** |
| *Legacy / reference only* | *@axiobyte.systems*: appears in the reference Manim episodes and the old Systems profile. **Never use it in a new CTA, caption or card unless explicitly requested.** |

- This policy is forward-looking: it governs **new** AxioByte content.
- Older content is never rewritten to match it. That covers the LeetCode covers, the reference episodes, the old Manim brand kit and `episodes/s01e02-zero-copy/social/caption.txt`.
- The E02 caption already follows the policy: `@axiobyte` heads its Instagram section and `@theaxiobytes` its YouTube section.
- The current Three.js brand layer holds **one** handle, `BRAND.handle = '@theaxiobytes'`. That is the YouTube handle, and it is correct for the 16:9 YouTube end card (E02).
- The Three.js end card chooses the handle by platform (`brandEndCard({ …, platform })`, default `youtube`). See *End card → Call to action and handle*.
- One master published to platforms with different handles (a 9:16 master for Reels **and** Shorts) uses the **platform-neutral** card, `brandEndCard({ …, handle: false })`: the logo and the call, no handle. It accepts no platform, so it can never show the wrong one.

## Logo — canonical source

**The supplied AxioByte logo is the canonical logo:** `assets/axiobyte-logo`, a 1080×1080 JPEG. It contains:

- **the mark**: the **∀ symbol** (U+2200, "for all", the universal quantifier), in cyan, **apex down**, with two translucent echoes behind it.
  - The echoes are scaled copies of the same ∀, not separate shapes.
  - **The mark is ∀, not a stylized letter A.** Never "correct" it into an upright A, never redraw it, and never replace it with a newly designed mark.
- **the wordmark**: "Axio" in cyan and "Byte" in amber, in the logo's own monospace lettering;
- **a thin rule**;
- **the tagline**: *Every concept has an axiom.*, in amber.

**The logo's own colours** (from `docs/brand/BRAND_SYSTEM_AUDIT.md` §2, §7):

- **cyan `#5DE8F5`**, for the ∀ and "Axio";
- **amber `#F0B429`**, for "Byte" and the tagline.

These are not the colour tokens the current Three.js brand layer uses. See *Colour discipline*.

The source file is never edited.

**Provenance (reference only):**

- The supplied logo is a render of `ProfilePhoto` in `my_manim_projects/axiobyte_assets.py`, which uses `brand_kit.py` (audit §2, §6).
- That code is frozen legacy material. It is not part of this brand system, is never imported by it, and never replaces the supplied file as the authority.

**Rendering asset:** `renderers/three/src/brand/assets/axiobyte-logo-transparent.png`, 588×749 RGBA.

- It is the **current Three.js rendering derivative** of the supplied logo, not a separate logo.
- It is valid on dark grounds only.

It is made by `renderers/three/src/brand/assets/extract_logo.py`:

- The script un-blends the supplied pixels from their background. It estimates the background (a dark radial disc with lighter corners), then sets alpha from each pixel's brightest-channel rise over it and recovers the colour by unpremultiplying.
- The mark, its echoes, the wordmark, the rule and the tagline are kept exactly. Only the background and its grid dots are removed.
- Composited on a dark ground it reproduces the original: mean difference 0.4 / 255 on the logo pixels.
- It is deterministic: re-running the script gives the same bytes.
- `LOGO_ASSET` (`renderers/three/src/brand/axiobyte.js`) records it, including the lockup's clearly visible extent (`visible`). The large outer echo around that extent is faint, at 5 % opacity or less.

**Rules:**

- **The logo is never recreated in an episode's typography**, or in any typeface. The wordmark and tagline are part of the artwork.
- Episode typography may set the **supporting** text around the logo (a call to action, a handle). It never replaces the logo.
- Never recolour, stretch, crop into or rearrange the logo. Never repeat its tagline beside it.
- Give the visible lockup clear space of at least half its width.

| Usage | Asset | Status |
|---|---|---|
| **Primary logo**: end cards, website, banner, documentation | the canonical logo (rendering asset above) | **Available**, in use on the end card |
| **Avatar / profile image** | the full canonical logo (the supplied 1080×1080 file is square and was made as the profile photo) | **Available.** It is already usable as the avatar |
| **Mark only**: small avatar, favicon, corner mark | the ∀ on its own | **Future task. It does not exist yet as a canonical asset.** The audit (§6) found that the solid ∀ can be extracted from the transparent PNG without redrawing. Any future mark-only asset must keep the actual ∀, apex down. It must never be reinterpreted as an A or redrawn |
| **Video watermark** | the ∀ mark on its own, small | As above. Until it exists, videos carry no watermark |

## Colour discipline

| Role | Value | Source (`systems.yaml`) |
|---|---|---|
| Background | `#090C13` | `ground.bg` |
| Surface / border | `#141B27` / `#26344A` | `ground.surface` / `ground.border` |
| Primary text | `#EAF0F6` (near-white) | `ink.primary` |
| Secondary text | `#9AA6BC` | `ink.secondary` |
| Brand primary (current Three.js token) | `#34D8E8` (cyan): supporting brand accents, such as the handle's "@" | `roles.mbuf.hue` |
| Brand secondary (current Three.js token) | `#F0A431` (amber) | `roles.cpu.hue` |

**Logo colours vs current tokens:**

- The logo itself is drawn in **`#5DE8F5`** (cyan) and **`#F0B429`** (amber); see *Logo*.
- The two brand tokens above are **not** the logo's colours. They are what `BRAND_COLOR` in `axiobyte.js` uses today, and that is unchanged and frozen with E02.
- **A future brand consolidation must decide** whether the logo's colours become the canonical brand palette. Until then, both are recorded and neither is changed.

Cyan and amber are a pair: cyan leads (the mark, the first half of the name) and amber answers (the second half, the tagline). Supporting text is near-white. A brand accent marks only a detail, such as the handle's "@".

**Brand colours and semantic colours are two separate systems.**

- **Brand colours** identify AxioByte: the logo, the end card, a title card, a watermark.
- **Semantic colours** carry meaning inside an episode's technical scenes. They are owned by the theme's roles (`systems.yaml` `roles`) and the episode's visual language. The E02 meanings are frozen:
  - **red** = copy and the CPU's copying cost;
  - **blue** = bytes and DMA;
  - **yellow** = the handle / reference.
- Today the two Three.js brand tokens *borrow* their values from two semantic roles (`mbuf`, `cpu`), as the table above shows.
  - That is an implementation coincidence, not a shared meaning.
  - The brand system must never become a source of semantic or hardware colours.
  - A semantic role must never be recoloured "to be on brand".
  - The planned consolidation gives the brand its own colour data, separate from the roles (see *Planned consolidation*).

**The brand sits above an episode's semantics, never inside them.**

- Inside a technical scene, colour means what the episode's visual language says. In E02: blue for bytes and DMA, yellow for pointers and handles, red for copy and its cost, violet for buffers and memory, cyan for the mbuf.
- Brand colours appear only where no technical object is on screen: the end card, a title card, a watermark.
- Never recolour a technical object to "be on brand".
- Readable text is near-white or light. An accent marks a card, a rule or the handle's "@"; it is never the only ink.

## Typography roles

All sizes are pixels on a 1920×1080 frame. They are designed to survive a landscape phone (×0.44) and to stay legible on a portrait phone (×0.20).

| Role | Spec | Where |
|---|---|---|
| Brand / logo | **the canonical logo image**, never type. On an end card its visible lockup is about 456 px tall (scale 0.91) | logo only |
| End-card call | 72 px bold, near-white, tracked | `FOLLOW AXIOBYTE FOR MORE` |
| End-card handle | 58 px semibold; cyan "@", near-white name | the platform's handle (YouTube 16:9: `@theaxiobytes`) |
| Technical annotation | the episode's own system. E02: `episodes/s01e02-zero-copy/three/typography.js` (52 / 38 / 28 px) | in-scene cards |
| Chapter labels | the episode's own system. E02: 26 px, accent index + light label, in a corner the shot keeps clear | chapter identifiers |

Typeface: **Barlow Semi Condensed** (500–700) for everything readable. The mono face is for code only.

## End card (`brandEndCard`)

A closing card **after** a film, never over its last scene. **Every AxioByte video that needs a branded end card uses this component** (`renderers/three/src/brand/endCard.js`). Don't build a new one per episode.

**Using it:**

1. `await loadBrandAssets()` before the first frame. In E02 this sits next to the font loading, in the episode's `video-main.js`.
2. Append `brandEndCard({ start: filmEnd, end: filmEnd + 3.5 })` to the storyboard's cues.

**Layout:** ONE group, centred on the frame. The group runs from the top of everything the logo shows (its faint outer echo included, since it reads on a dark ground) down to the handle, with equal room above and below. The logo is centred horizontally, and the internal spacing is fixed: the call 56 px below the logo's lockup, the handle 76 px below the call.

```
     [ the canonical AxioByte logo ]      ∀ mark · wordmark · tagline (the hero)
       FOLLOW AXIOBYTE FOR MORE           call (dominant text)
          the platform handle             handle (YouTube 16:9: @theaxiobytes)
```

The logo carries the tagline, so the card does not repeat it. The ground is the brand background with a faint cyan grid and a vignette. There is no hardware, no episode objects and no episode semantic colours.

**Timing,** from the film's end:

| Element | Window |
|---|---|
| Ground fades up over the film's last frame | 0–0.5 s |
| Logo | 0.5–1.1 s |
| Call | 0.9–1.5 s |
| Handle | 1.2–1.8 s |
| Hold | to 3.5 s |

It is silent, with no audio and no voiceover.

**Call to action and handle:**

- The default call for every new AxioByte educational video is **FOLLOW AXIOBYTE FOR MORE**. The wording doesn't change per platform.
- The handle line shows the handle **of the platform the video is published on**:

  | Platform | Handle |
  |---|---|
  | 16:9 YouTube | `@theaxiobytes` |
  | Instagram | `@axiobyte` |
  | LinkedIn | `@axiobyte` |

- Handles are chosen for the deliverable. They are never all shown together, and a platform's handle never appears automatically in every video.
- **In Three.js:**
  - `brandEndCard({ start, end, platform })` takes `platform`, one of `PLATFORMS` (`youtube`, `instagram`, `linkedin`), and draws `platformHandle(platform)`, which reads `BRAND_DATA.handles`. Callers choose the platform, never the handle text.
  - Without `platform` the card is the 16:9 YouTube one (`@theaxiobytes`), so E02's existing call is unchanged.
  - An unknown platform is an error, never a fallback handle.
  - `@axiobyte.systems` is not a platform and cannot be selected.
  - The platform is independent of the aspect ratio: it is never inferred from the frame.
  - The `brand` record parameter is a seam for checks. Its handle must be one of the platform handles, and it can't be combined with `platform`.

**Format (`target`):**

- `brandEndCard({ start, end, platform, target })` takes `target`, one of `'16x9'` or `'9x16'` (the studio's target ids). The default is `'16x9'`, so existing calls (E02) are unchanged.
- The format is chosen explicitly. It is never guessed from the canvas, and it is independent of `platform`: any platform's handle can go on either format.
- An unknown target is an error.
- **16x9** is the approved landscape card (`END_CARD_LAYOUT` in `endCard.js`), frozen with E02.
- **9x16** is the portrait card. Its geometry lives in `renderers/three/src/brand/endCardLayout.js` (`portraitEndCardLayout(width, height)`). It is composed for 1080×1920 and resolved proportionally for any 9:16 frame. A frame that isn't 9:16 is refused, never stretched.

**Portrait safe area** (`PORTRAIT_SAFE`, held equal to `design/targets/9x16.yaml` by a test):

| Edge | Fraction | At 1080×1920 | Source |
|---|---|---|---|
| top | 0.05 | 96 px | the target's `safe.top` (no platform UI is declared at the top) |
| bottom | 0.20 | 384 px | the largest `platform_safe.*.bottom` (Reels 0.18, Shorts 0.14, TikTok 0.20) |
| left and right | 0.16 | 173 px each | the largest `platform_safe.*.right` (Reels 0.14, Shorts 0.12, TikTok 0.16), applied to both sides so the card stays centred |

- The safe area is the same for every platform, so the card never depends on the platform.
- The logo's lockup, the call and the handle stay inside the safe box. Everything the logo shows, its faint outer echo included, stays inside the frame.

**Portrait layout** (fractions of the frame width; the pixel values are at 1080×1920):

```
     [ the canonical AxioByte logo ]     everything it shows 0.64 W wide (691 px, scale ≈ 1.22); lockup ≈ 482 × 611 px
            FOLLOW AXIOBYTE              call, 0.074 W (80 px), 700, on two balanced lines
               FOR MORE                  line step 1.1 × size
             @theaxiobytes               handle, 0.056 W (60 px), 600; cyan "@"
```

- Gaps: the lockup to the call's cap height is 0.06 W (65 px). The last call baseline to the handle baseline is 0.085 W (92 px).
- One group, from the top of the logo's outer echo to the handle's descender. It is centred horizontally on the frame and vertically in the safe band (96–1536 px), so its centre is at y ≈ 816. It therefore sits above the platform's bottom UI rather than on the frame's centre line.
- The call is the same wording on two lines: "FOLLOW AXIOBYTE" / "FOR MORE".
  - The break is the word boundary that makes the longer line shortest.
  - On one line it would have to shrink to about 56 px to clear the side zones.
  - Measured in Chrome with Barlow, the lines are 655 and 348 px wide, against 734 px of safe width.
- The ground, grid, vignette, colours, fonts and arrival timing are the landscape card's. The grid scales with the frame, and the vignette is centred on the group.

**Rules:**

- One call only. Never stack "like, comment, share, subscribe, notifications".
- No platform chrome and no follower counts.
- It is appended: an episode's film ends exactly as approved, and the card follows it.
- The card refuses to draw if the logo isn't loaded. It never falls back to typed lettering.

## Watermark rules (for when a mark variant exists)

- The ∀ mark only (cut from the canonical logo, apex down, never redrawn), never the wordmark.
- About 48 px tall, at 60 % opacity, in one fixed corner. Choose a corner the episode's chapter labels don't use.
- Never over a technical object, a path or a card. Episodes may omit it in dense shots.
- Off during the end card, which carries the brand itself.

## Renderer status

| Renderer | Brand layer | Status |
|---|---|---|
| **Three.js** | `renderers/three/src/brand/axiobyte.js`, `endCard.js`, `assets/axiobyte-logo-transparent.png` | **Reusable today.** It holds no E02 IDs, scenes, timing, cameras or semantics (audit §3). A new 16:9 episode needs only `await loadBrandAssets()` and `brandEndCard({ start: filmEnd, end: filmEnd + 3.5 })` |
| **Three.js (legacy)** | `renderers/three/src/video/overlay/widgets/titles.js`: `brandMark` and the generic `endCard` set "AXIOBYTE" in type | **Legacy. Do not use for new work.** It recreates the brand in type, against the logo rules. It stays in place for now. **E03 (`s01e03-what-is-a-nic`) uses it and must migrate to `brandEndCard` before E03 ships.** That migration is a future task |
| **Manim (studio backend)** | none | **No reusable brand layer yet.** A future Manim brand layer will use the same canonical logo asset and the same shared brand data as Three.js |
| **Manim (legacy)** | `my_manim_projects/axiobyte_assets.py`, `brand_kit.py`, `axiobyte_brand.md` | **Frozen legacy / reference material.** Not modified, and never imported into the studio's brand system |

## Planned consolidation (not yet implemented)

There will be **one shared brand data definition**, renderer-neutral and read by every renderer, holding:

- the canonical logo asset and its rendering derivatives;
- brand colours (after the logo-colour decision above);
- platform handles (the table above);
- the default call to action;
- typography rules and logo usage rules;
- end-card defaults (16:9, and 9:16 once it exists).

It stays **separate** from:

- semantic colours (`systems.yaml` `roles`);
- asset colours;
- episode-specific colours;
- animation meaning;
- domain concepts.

The brand data never supplies a semantic or hardware colour.

Future tasks, in `docs/brand/BRAND_SYSTEM_AUDIT.md` §13:

1. the shared brand data file;
2. the logo-colour decision;
3. ~~a platform-aware handle on the end card~~ (done for Three.js: `platform` on `brandEndCard`);
4. ~~the 9:16 end card~~ (done for Three.js: `target: '9x16'` on `brandEndCard`; no episode uses it yet);
5. the E03 migration to `brandEndCard`;
6. the Manim brand layer;
7. the mark-only ∀ asset.

None of these changes E02.
