# Typography

How the film's type is chosen, set, moved and checked so it reads like a designer's work. The eye comes from three
places: real typography the user and the researcher collect (§9), measurements taken from those references (§9.2),
and the user's own picks and rejections remembered across films (§9.3). The rules below are the floor; the
references and the taste log decide the style.

Files: `type-library.json` (the curated fonts and pairings; the same library for people: `docs/type-library.md`), `starter/type.mjs` (the runtime,
inline in quick-mode `film.html`), `templates/type-specimen.html` (specimen cards), `scripts/type_deal.py` (via
`deal.py … type`), `scripts/type_refs.py`, `scripts/type_extract.py`, `scripts/captions.py`.

## 1. Pairing

- **One voice, two families at most, plus a mono** for data, code or timestamps. A superfamily (serif + sans + mono
  from one design, e.g. IBM Plex) counts as one voice.
- **Contrast of structure, not of mood**: pair a serif with a sans, a condensed with a normal width, a high-contrast
  display with a low-contrast text face. Two grotesques that differ only a little look like a mistake.
- **Shared proportions**: similar x-height (library `metrics.x`) and similar width rhythm, so the two sit on one line
  without one looking shrunken. Cap height ratios within about 10 % when they share a line.
- **Roles are fixed for the whole film**: `display` for titles and big words, `text` for subtitles, labels, lower
  thirds and legal lines, `mono` for numbers and data. A role never changes face mid-film (see §11 for the signature
  exception).
- Every pairing in the library carries a one-line reason (`why`) and a tested `setup` (weights and axis values).

## 2. Scale per format and phone minimums

A modular scale from the deliverable's short side (1080 px for 1080×1920, 1080×1080 and 1920×1080):

| Step | Use | Font size (share of the short side) |
|---|---|---|
| T1 | title card, one-word impact | 0.11–0.16 (9:16, 1:1) · 0.09–0.13 (16:9) |
| T2 | headline, price, CTA | 0.065–0.09 |
| T3 | subtitle, caption, lower-third name | 0.04–0.055 |
| T4 | label, role line | 0.034–0.04 |
| L | legal line (static, ≥ 3 s on screen) | ≥ the legal minimum below |

Neighbouring steps differ by a ratio of 1.25–1.6 (keep one ratio per film). **Phone minimums (hard rule)**, as cap
height in delivered pixels, checked by `typeCheck()` from the declared `TYPE.check.sizes`:

| Format | Text cap height | Legal cap height | Why |
|---|---|---|---|
| 9:16 and 1:1 (1080 wide) | ≥ 28 px (2.6 % of the short side) | ≥ 22 px | 1080 px fill a phone's ~390 pt width |
| 16:9 (1920×1080) | ≥ 40 px (3.7 %) | ≥ 32 px | watched inline on a phone it is ~0.56× as tall |

Font size = cap height / the font's `metrics.cap` (about 0.65–0.72). The specimen card sizes its own text this way.

## 3. Tracking, leading, line length

- **Tracking by size** (`autoTrack()`, share of the em): small text opens (+0.015 em under 2.5 % of the short side),
  display tightens (−0.01 to −0.02 em above 6 %); **all caps always open** (+0.08 small, +0.05 mid, +0.03 large).
  Never track lowercase display positively by more than +0.01 em unless it is the film's signature (§11).
- **Leading**: text 1.25–1.4; display 0.95–1.05; all-caps display 1.0–1.1 **plus diacritic headroom** (§7).
- **Line length**: ≤ 32 characters per line in 9:16, ≤ 42 in 16:9; on-screen cards ≤ 6 words. `wrap()` breaks
  lines; `balance` gives lines of similar length for titles.

## 4. Optical sizes and variable axes

- Use `opsz` where it exists (Fraunces, Bodoni Moda, Newsreader, Imbue, Piazzolla, Bricolage, Big Shoulders): high
  values for titles (finer hairlines, tighter spacing), low values for small lines (sturdier). Chrome applies `opsz`
  from the pixel size automatically; pin it with a stop when the look needs otherwise.
- **Animate axes on the music, not on a timer**: weight breathing (`breathe(t, BPM, lo, hi)`) peaks on the beat;
  a width change (Anybody, Archivo, Mona Sans) lands on a hit; SOFT/WONK (Fraunces), ELSH (Danfo), YEAR (Climate
  Crisis, tie it to a date counter), XROT/YROT (Tilt Warp), MONO/CASL (Recursive), BNCE (Shantell Sans) change on a
  cue or across a section. One animated axis at a time; settle before the line must be read.
- Canvas 2D facts (measured in headless Chrome): the weight axis is continuous through the `font` string (`650`
  works); width snaps to the stretch keywords in the shorthand; **any other axis and every OpenType feature works only
  through `FontFace` descriptors** (`variationSettings`, `featureSettings`) on detached canvases, so non-weight axes
  animate through **stops** (one face per stop, `TYPE.roles.x.stops`), nearest stop per frame.

## 5. OpenType features

Set per role in the TYPE block (`features: '"tnum", "ss01"'`), applied as `FontFace featureSettings`:

- `tnum` for counters, prices and timecodes (numbers must not jiggle while they change); `lnum` for prices in
  old-style serifs; `case` with all caps (raises dashes and brackets); `ss0x` stylistic sets as a look decision (Le
  Murmure ss01–ss10, Uncut-style alternates), named in the type spec; `frac` for recipes and specs.
- The Fontsource web files keep few features (`features` in the library = what renders). For a feature only the full
  font has (`features_full`), load the full file locally (`load.full`, into `fonts/`).
- `letterSpacing` and `fontKerning` are set by `setType()`; kerning stays on.

## 6. Typographic motion

With the kit's MOTION helpers and `typeReveal()`:

- **Units**: characters for titles of ≤ 2 words, words for lines; stagger spread 0.35–0.6 of the entrance, order `seq`
  (reading order) unless the idea says otherwise.
- **Masks and baseline shifts**: units rise 0.6–1.0 of the line height inside a mask whose top includes the diacritic
  headroom, so İ dots and Ğ breves never get clipped. Ease out on entrances (`EASE.out`, `MOTION.back` for a light
  overshoot), ease in on exits; nothing moves linearly.
- **Readability first**: a line holds still at least `0.4 s + 0.06 s × words` after it lands; one moving text layer
  at a time; motion stops before the eye needs to read.
- **Weight and axis motion** follows §4. Tracking animations (wide to normal) are allowed on titles only.
- **Kinetic devices** for ads, explainers and reels (one or two per film, each with a job): letters that drop in with a stagger and one letter recoloured as the accent; a headline ending in a coloured full stop; a one-word slam with outlined echoes above and below; numbers that roll or flip digit by digit, with a tick under the roll; labels (chips) that wipe in and lay out in a row; a diagonal tape of words scrolling across a chapter recap; corner micro-type framing the shot. One accent colour for the chosen thing.
- **Never invent real content** to fill a screen (fake emails, names, data): draw it as rounded blocks or blurred lines instead.
- **Layout check on a full-size still:** two stats never share one horizontal band at the same height; keep content out of the bottom 12 % when captions or a progress bar live there.

## 7. Grid, widows, Turkish

- **Grid**: one margin (≥ 7 % of the short side), one alignment per card (left or centred, never both), baselines on a
  shared rhythm (the text leading). Left alignment for information, centred for ceremony (title cards, end cards).
- **Widows and orphans**: no one-word last line (`wrap()` moves a word down), no line ending on a one-letter word, a
  number and its unit stay together with a no-break space (`24.990\u00A0₺`).
- **Turkish casing**: always `up(s, 'tr')` / `low(s, 'tr')` (`istanbul → İSTANBUL`, `IŞIK → ışık`); English words
  in a Turkish film are cased with `'en'`. `TYPE.lang` sets the default.
- **Diacritic headroom**: boxes, masks and line spacing are measured from `headroom()` (İ, Ğ, Ü above the cap height;
  Ş, Ç below the baseline), never from the cap height alone. Test every text box with `İĞÜŞÖÇ ığüşöç`.
- **Coverage**: every library font is verified for İıĞğŞşÇçÖöÜü; `typeCheck()` still measures each role's glyphs at
  load (the user's own fonts are not in the library) and stops the render on a missing glyph.

## 8. Cinematic titles, ad typography, talking-head tactics

**Cinematic** (Art of the Title is the reference shelf): one title card, centred or on a strong left edge, lots of
air, a slow reveal (1–2 s) on a music phrase, a restrained palette (ink on the film's darkest or lightest value),
credits in the text role at T4 with open caps tracking. Titles live in the world when they can (on a surface,
behind a foreground element), but the reading rules still hold.

**Ad** (Fonts In Use `format:advertising`, `posters-flyers`, `social-media`):
- **Lower third**: name in the text role (T3, weight 600) on a solid box or a scrim, role line under it (T4); left
  edge on the margin; in 9:16 above the bottom UI zone (lower 20 %).
- **Price and CTA**: price in display or mono with `tnum` (T2), CTA as a verb in caps on a contrasting pill, the
  same position in every variant; never more than one CTA.
- **Legal line**: text role, static, at least the legal minimum (§2), ≥ 3 s, contrast ≥ 4.5:1.

**Talking-head-inspired captions** (optional styles for narrated films and ads; never default):
- **Word-locked kinetic captions** (optional; needs Whisper, installed only with the user's OK; plain line subtitles need nothing, `craft.md` §5) from the narrator's word timings: transcribe our own TTS lines with Whisper word
  timestamps (`captions.py cmd`), build groups of 1–3 words (`captions.py build`, ≤ 18 characters, break on pauses
  > 0.25 s and punctuation), paste `CAPTIONS` into film.html; each word pops in on its own spoken time.
- **Accent word**: one word per group at most, in a contrasting face (e.g. an italic serif against a grotesque, an
  `accent` role) or the accent colour: the word that carries the meaning (the price, the benefit, the verb).
- **Punch-in on emphasis**: words marked with `!` in `--accent` push the frame 5–8 % in over 0.08 s and settle over
  0.5 s (`captionPunch()`); at most one per sentence, never two within 1.5 s.
- **Quick rhythm**: groups change on the speech, not on a timer; cuts and hits may land on caption changes.
- Captions sit in the safe area (9:16 centre band above the UI zone), use the display or text role at T2–T3, with a
  shadow or a box when the picture behind is busy; the type QC (§13) applies to every frame they appear on.

## 9. The designer's eye

### 9.1 Type references

Gathered per film (mood only: a link and a small thumbnail; never shipped):

- `asset_search.py search --type typography` (same as `type_refs.py`): **Fonts In Use** real uses by `format:` (film-video,
  advertising, posters-flyers, branding-identity, social-media, packaging …), `topic:` (film-and-television, music,
  food-beverage, technology, fashion-apparel, sports …) or a typeface page URL; its robots.txt asks for a 10 s crawl
  delay and rules out search, so the tool never searches; **Art of the Title** (`title:<slug>` or words, for the
  cinematic purpose); **Typewolf** (a family's page: specimen, suggested pairing, sites using it; `sotd`);
  **Are.na** public API (typography channels, image blocks; its Content-Signal allows reference use);
  **Typographic Posters** link only (pages render in the browser). Foundry specimens are linked from the library.
- **The user's own references in `refs/type/`**: screenshots, photos, scans. **Instagram workflow**: the user saves
  posts they like into an Instagram collection (e.g. "film type") and drops screenshots of them into `refs/type/`
  (AirDrop, Photos export or a screenshot folder); the kit never logs in to or scrapes Instagram. Ask for 3–8
  references; the user's own references outrank everything else.
- A **type board** (`asset_search.py board --dirs research/type-refs --refs refs/type --out research/type-board`): per reference what to
  take (case, weight contrast, layout, colour, motion) and what to avoid. Look at the contact sheets, not single images.

### 9.2 Measure from references

`type_extract.py measure refs/type/* research/type-refs/thumbs/0N.img --out type/direction-draft.json` estimates per
image: size hierarchy (largest/median line, size levels), all caps vs mixed case (`--case 1=caps` overrides), a
tracking proxy, alignment, text area share, type and paper colours, and a confidence; then a draft direction (case,
align, `title_share`, scale ratio, tracking, colours). It is a heuristic: write your own read of the downscaled
references into `visual_read` (what the type does, why it works for this film), show the user both, and only a
confirmed draft becomes the film's type spec. The specimen card takes it with `dir=direction-draft.json` (the path is relative to `type/specimen.html`).

### 9.3 Taste log

Every type decision is a taste record: `deal.py pick type` (like; the other dealt pairings: pass), `redeal type
--reason` (reject, with the user's reason), `taste type <pairing or font> --verdict like|reject --reason "…"` for a
reaction to a detail. Records hold the families, tags and the user's one-line reason, in the project's
`history.json` and (with `--user-taste`, or once `~/.cinecode/taste.json` exists; `CINECODE_TASTE` overrides
the path) in a user-level file shared by every film. Weights in the next deal (newest
first, decay 0.85 per event): liked pairing ×(1+0.5d), shared family ×(1+0.25d), shared tag ×(1+0.12d); rejected
pairing ×(1−0.6d), family ×(1−0.35d), tag ×(1−0.15d); passed tag ×(1−0.03d); look match ×1.6; clamped to
0.05–4, so nothing becomes impossible and the user's own answer (`pick type own --families "…"`) is always open.
`deal` prints what the log currently leans to and away from; quote it when presenting the hand.

## 10. TYPE DIRECTION step (both flows, after the look)

1. **References**, following the user's references answer: "search" = the user's `refs/type/` + 6–12 researched references for this purpose (§9.1); "only my own" = `refs/type/` alone; "skip" = none (go to step 3). One contact sheet.
2. **Measure**: `type_extract.py measure` on the 3–5 strongest; add your visual read; one-paragraph type direction.
3. **Deal** (the curated pairings come first): `deal.py deal type --purpose <cinematic|ad> --look <look or recipe id> --mood "<the film's tone in a few words>" --title "<the headline as it stands on screen>"` (plus `--sub`, `--cta`, `--still`: the cards show only the film's own words, on its frame) (the tone, "komik çizgi film", "korku", "belgesel", "lüks", picks only pairings that carry it; the look narrows them further) → 3 pairings filtered by purpose,
   Turkish coverage and taste; `type/specimens.json`, `type/specimen.html` and `type/type.mjs` are written.
   **Only when none of the three carries the film's voice** (or the user asks for others): `python3 tools/fonts.py search "<the film's tone>" [--role text]` ranks 2,000+ open-licence fonts with Turkish letters by tone (Google Fonts' expressive scores: playful, calm, rugged, vintage, sophisticated, futuristic…), leaving out the fonts AI designs overuse; `fonts.py role <id>` prints the pinned TYPE role.
4. **Specimen cards in the film's look** at the deliverable aspect, one per pairing (title, subtitle, label,
   numerals, a Turkish line, a lower third + price + CTA + legal line for ads; a title card shaped by the
   direction for cinematic): `node tools/capture.mjs --url type/specimen.html --frames 0 --format jpeg --out
   review/type-<n> --params "i=<n-1>&w=…&h=…&purpose=…&title=…&bg=…&ink=…&accent=…&still=../review/<frame>.jpg&dir=direction-draft.json"`.
   A local-file pairing needs its files in `fonts/` first (the user downloads them; GitLab and Fontshare files are
   never fetched automatically).
   For 2–4 title, chapter, CTA, cover or end cards with a mixed style, deal a second hand with `--mixed` (dominant +
   accent pairings, §12); its cards come from `type/specimens-mixed.json` (`--params "spec=specimens-mixed.json&i=…&acc=<accent word>"`).
5. **Ask** with the interactive question tool when available (options = the three pairings + "my own"), showing the
   three cards side by side; otherwise a numbered question. Log the pick with the user's reason; a "none" is a
   `redeal` with the reason.
6. **Type spec**: copy the role objects from `type/specimens.json` into the TYPE block (film.html or the scene pages)
   and the Type line of `STATE.md`, add `check.strings` (title, CTA, a Turkish line) and `check.sizes`; one
   LICENSES.csv row per family (role `font`, licence and URL from the library).

## 11. Rule tiers: hard rules and breakable style rules

**Hard rules: never broken**, checked by the reviewer and partly by code:
legibility (phone cap height minimums, contrast ≥ 4.5:1 for text and legal lines, 3:1 for large display, hold time);
no clipped diacritics or missing glyphs; licences (library or verified licence, LICENSES.csv row, brand and Fontshare
files never shared or committed); loudness (−14 LUFS, ≤ −1 dBTP); the hook (action on frame 0, no fade from black).

**Breakable style rules: defaults a film may break on purpose**: two families at most; script or decorative faces
for ≤ 3 words; effects (outline, shadow, texture, 3D) on one layer only; one alignment per card; tracking by size;
one animated axis at a time; centred titles for cinematic, left for ads.

A **deliberate rule break** is allowed when all three hold:
1. **Named in the plan** with a reason (STATE.md / ROADMAP.md: "rule break: <the rule>: <how>, because
   <a reason from this story>");
2. **Applied consistently** as the film's signature (every instance follows the same logic; not a one-off);
3. **Checked by the reviewer** as intentional: the reviewer finds the named break in the plan, confirms it is
   consistent across the film and that no hard rule is touched. An unnamed break is a mistake and gets fixed.

## 12. Stil karıştırma / Mixing styles

Mixed cards put **one dominant voice and one accent** on the same card (a heavy grotesque + a script, a condensed
sans + an italic serif). Every rule here is a **breakable style rule** (§11): break it only as a named, consistent
signature the reviewer confirms. Dealt with `deal.py deal type --mixed` (pairings tagged `mixed` in `type-library.json`); the accent is a fourth TYPE role, `accent`.

**Rules**
- **One dominant + one accent**: at most 2 families per card. A small mono label (≤ 11 px-equivalent at 1080, e.g. a
  date or a code) does not count.
- **Contrast on at most 2 axes**: width + weight (Archivo Expanded Black vs a brush hand), or structure + slope
  (Bricolage condensed vs Instrument Serif Italic). Never classification, width, weight and era all at once.
- **The accent is 1–3 words** and carries emotion, not information (the feeling, the verb, the twist); never body
  text, subtitles, sentences, prices or facts.
- **Size**: the dominant is about 2–3× the accent's x-height; the accent's cap height is 40–60 % of the dominant's.
- **Tuck the script** 15–30 % of its height into the bold's baseline (it overlaps the bottom of the dominant line).
- **Rotate only the accent**, at most 6°; the dominant stays on the grid.
- **Effects on one layer only**: outline, shadow, texture or 3D on the dominant *or* the accent, never both.
- **Colour hierarchy**: the dominant in the neutral or brand colour, the accent in one highlight colour; never both
  highlighted.
- **Text colour by role, varied, never random:** a long film does not set every word in one white. Give text three or four roles in the film's palette (body ink, an accent for the key figure or name, a quieter tone for secondary lines and dates, and the chapter card's colour), keep each role consistent, and let the chapter cards or acts carry their own tint so ten minutes never read as one card repeated. Contrast is checked on the busiest frame (`type_extract.py contrast`).
- **Animation order**: the dominant lands first; the accent writes or draws in 150–300 ms later (stroke reveal or
  `typeReveal` by character), on the music.
- **Where**: title, chapter, CTA, cover and end cards. **Not** for subtitles, legal lines, data, prices or long
  quotes. **How often**: 2–4 mixed cards per film at most; the rest of the film uses the plain TYPE roles.
- **Turkish render test (mandatory)**: render every accent with `İğneli Şükrü Çığlık Öğün` before choosing it
  (the specimen card does, and `typeCheck()` checks the accent role's glyphs); a font's `latin-ext` subset is not
  proof that script faces draw İ, ğ, ş, ı correctly.

**Overdone: signs to fix at review**
- more than 2 families on a card (plus the small mono);
- a script longer than 4 words, or a whole sentence in script;
- effects on both layers;
- every card mixed;
- dominant and accent at the same size, or in the same colour;
- the accent rotated more than 10°, or running on several lines;
- the font changing word by word.

**Mixed pairings in the bank** (all licence-clean, Turkish-verified from the font files): Archivo Expanded Black +
Caveat Brush + JetBrains Mono · Unbounded Black + Sedgwick Ave Display + Space Mono · Anton + Yellowtail · Big
Shoulders Display Black + Marck Script + IBM Plex Mono · Bricolage Grotesque ExtraBold (wdth 75) + Instrument Serif
Italic + Geist Mono · Anybody (wdth 150, Black) + Kalam Bold · Dela Gothic One + Mynerve · Syne ExtraBold + Square Peg
(subtitles in Figtree; Inter only as the user's own choice).

## 13. Type QC (review rubric)

Automated: `typeCheck()` at load (missing glyphs and contrast < 3:1 stop the render; cap height under the phone
minimum, contrast < 4.5:1, over-long lines go to the capture log as `qc:`); `type_extract.py contrast <frame> --box
… --ink …` for type over picture (frame only the type being checked); the specimen card's footer. Per review:

1. **Phone legibility**: watch the 9:16 export at phone size; every line readable in its hold time.
2. **Contrast vs background** on the busiest frame of each text moment (`type_extract.py contrast`), not just the palette.
3. **Line length and widows**: ≤ 32/42 characters, no one-word last lines, units kept with numbers.
4. **Clipped diacritics**: İ dots, Ğ breves, Ş/Ç cedillas intact in masks, boxes and line spacing (strip frames).
5. **Consistent families**: the roles never change face across the film (except a named signature, §11); mixed cards follow §12 (≤ 2–4 per film, none of its overdone signs).
6. **Casing**: Turkish casing correct (`İ`, `ı`), caps tracked open.
7. **Motion**: entrances ease out, one moving text layer at a time, lines hold still to be read.
8. **Licences**: one LICENSES.csv row per family; no brand or Fontshare file in git.
9. **Rule breaks**: each one named in the plan, consistent, and no hard rule touched.

## 14. Loading

The TYPE block (film.html, scene pages) loads every role through `FontFace` from the pinned
Fontsource CDN (`@fontsource/<pkg>@<version>` static cuts, `@fontsource-variable/<pkg>@<version>` variable files
`full` / `standard` / `wght`; latin + latin-ext ranges) or from local `fonts/` (gitignored: brand fonts, Fontshare
fonts, Velvetyne files downloaded at the pinned commit). A failed load stops the render (`READY` rejects). Copy the
woff2 files into `fonts/` or `engine/vendor/fonts/` for offline renders.
