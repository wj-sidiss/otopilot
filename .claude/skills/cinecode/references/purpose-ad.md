# Purpose: ad and product

Chosen with the mode at the start (`SKILL.md` "First questions"): brand, product, launch, promo, explainer and sponsor films. The film belongs to this one subject, the viewer knows whose it is, and the end says what to do next. The shared rules stay in their own files and apply unchanged: motion (`motion.md`), the camera vocabulary (`camera-moves.md`), type (`typography.md`), sound sync (`sound.md`), the hook, one action per shot and unity (`SKILL.md` Hard rules, `quick-mode.md` §7), checks (`engine.md` §4–5).

## 1. Defaults

| Item | Default for an ad or product film |
|---|---|
| Quick Q3 style ★ | the brand's own look, or the one the idea asks for |
| Quick Q4 sound ★ | a) narrator + music |
| Film mode Q5 | narrator + music, with a sound identity built from the brand |
| Idea test | the full specificity and competitor test, mandatory |
| On-screen text | identity labels and lower thirds, an end card with a call to action |
| Deliverables | 9:16, 1:1 and 16:9 variants |
| Finishing | off by default, offered like the cinematic film's (`purpose-cinematic.md` §2); for an ad recommend at most 6-sample motion blur on fast `blur: true` scenes; gate weave and the print curve soften type and UI, so only on request |

## 2. Inputs (asked in the first round)

Film mode asks for these with Step 1 (`film-mode.md`). Quick mode asks only one plain line (the name, two or three differences, optional assets; `quick-mode.md` §1) and derives the specificity facts itself, showing them at the beat gate for a yes or a correction:

- **Facts for the specificity test:** 8–12 things only this subject has (`writing.md` §12).
- **Brand colours** (hex) and **fonts.** Open fonts load from Fontsource (`TYPE` in `film.html`, `typography.md`). A brand font the user supplies stays local: it goes in the project's `fonts/` folder (git-ignored), loads through `TYPE.files`, is never uploaded or served from a CDN, and gets a `LICENSES.csv` row with its licence.
- **Logo** (SVG or PNG, local), the **call to action** in one line and the URL or handle.
- **Their own footage or screen recordings,** if any (§7).

## 3. Specificity and competitor test (mandatory)

`writing.md` §12 in full, before the beats (Quick) or the roadmap (Film): the 8–12 facts, the one-sentence concept "[subject-only thing] becomes [visual device]", and the swap test with the closest competitor's name. Write all three into `STATE.md` (Quick) or `ROADMAP.md` (Film) and show the concept and the swap result at the gate. Every number and claim on screen comes from the brief or the product itself.

## 4. Picture

- **One continuous shot is a premium form:** an orbit around the product while one light crosses it, a move through the product's world that arrives at it, a pull-back from a detail to the whole (`camera-moves.md`, One continuous shot). Choose it when the product is one object in one place; the end card may follow as the only cut.

- **Identity on screen:** the product, brand, place and people are named with `label()` lower thirds (`craft.md` §4) in the brand type, inside the safe areas, on screen for at least 0.6 s plus 0.25 s per word.
- **Brand colour:** the product's own colour leads; the rest of the frame is the film's palette, chosen so the product reads.
- **The product is shown by what it makes or does for the viewer,** never by its spec sheet: a feature list, counts of what it contains or its code on screen are not a benefit.
- **The product reads from the first seconds,** whole or as details that are unmistakably this product (its mark, its shape, its colour). Two structures, chosen on the card by where the film runs:
  - **Feed ad** (Reels, TikTok, Shorts, YouTube pre-roll; ★ for a vertical ad): the product and the brand within the first 2–3 s, the mark on the product rather than a floating logo; then the story; the brand again at the end. Measured by the platforms: Meta found return on spend 2.3× higher when the product appears within the first 2 s; Google finds the brand in the first 5 s lifts conversions and recall (with slightly more skips), best when the logo sits on the product.
  - **Launch or prestige film** (a brand's own channel, a launch, a showcase; the way Ferrari and Apple make them): details first, the full reveal late (Ferrari's 45 s 296 GT Modificata film: light-traced details from the first frame, studio turntable, cockpit, track run, the model's name; Apple: the product in use doing its one thing, then a clean product shot and the mark). It only works when the details read as this product from the start (a badge, an unmistakable shape or colour); anonymous parts that become the product only at the end lose the viewer.
- **Words in fragments:** on-screen copy arrives a few words at a time, split around what the product does ("<a fragment>" · <what it does> · "<a fragment>" · <the product> · <its name>), never a sentence dropped whole; each fragment holds long enough to read and drifts a little instead of freezing; stretches of pure picture sit between fragments; one soft sound per fragment, never a loud one. A crisp, faster rhythm when the brief asks for energy.
- **The one thing only this brand has** (from the specificity facts: an engraving, a shape, a material, a number) fills the frame once and holds long enough to read (at least 1.5 s), lit to be seen.
- **UI hero shots** for software (`craft.md` §8): the interface as a lit plane tilted back in a dark space, a thin band of focus that rack-focuses with attention, a soft neutral light trailing the subject by a beat, the UI acting on its own with no cursor, hard cuts between UI shots, a quiet ending.
- **One shot per beat from the catalog** (§9): the beat's job picks the shot (hook, problem, turn, input, output, proof, close).
- **Product hero:** one slow orbit or push on the product with a clean key and rim light, and one reveal moment.
- **End card:** the last 2.5–4 s: logo or product name, one call-to-action line of at most 6 words, the URL or handle. It holds still enough to read (motion only in a slow drift or the light), the music resolves on it, and it sits inside the safe areas of every variant.

## 5. Deliverables: 9:16, 1:1, 16:9

- Master in the platform's main format (★ 9:16). Compose so the subject and text sit in the centre zone all three formats share; scene code uses fractions of `S.u`, `W` and `H`, so one file renders every variant: `make.py final` for the main format, then `make.py final --size 1080x1080` and `--size 1920x1080`; each lands as its own file (`<Title>-1x1.mp4`, `<Title>-16x9.mp4`) with its own checks and poster.
- **Safe areas:** 9:16 keeps the top 12%, the bottom 20% and the right 10% free of text (platform buttons and captions); 1:1 and 4:5 keep a 6% margin; 16:9 a 5% margin. Labels and the end card get a position per format (`const V = W > H ? 'wide' : W === H ? 'square' : 'tall'`).
- Check every variant: `make.py` runs the hook and the poster per variant; add `qc.py phone` on each (each variant moves from frame 1); no text cut off, the subject never under the platform UI.
- Film mode: render every variant from the same shots with the framing re-checked per aspect.

## 6. Voice and music

Narrator + music by default: the voice options and word budget from `quick-mode.md` §1 and the writer prompt; the score ducks under every line; hits fall between lines; a brand sting only on the end card.

## 7. Optional: the user's own footage

Talking head, selfie or screen recordings are cut from a word-timed transcript before any graphics go on: `footage-edit.md` (needs Whisper on the machine, installed with the user's OK). Screen recordings can also become UI hero shots (§4).

## 8. Gates and checks (added to the shared ones)

- The concept sentence and the swap result are shown at the beat or roadmap gate.
- The card names the structure (feed ad or launch film) and the second the product first reads; the brand-only thing has its full-frame beat on the beat table.
- **Identity read:** a muted first-time viewer can name the brand or product and the call to action.
- Every number on screen is traced to the brief or the product.
- **Type** (`typography.md` §8, §13): lower thirds, price + CTA and the legal line at the phone minimums, contrast checked on the busiest frame (`type_extract.py contrast`); talking-head captions only when chosen.
- The end card holds at least 2.5 s and reads at phone size in every variant.
- Every variant passes `qc.py phone` and `qc.py hook`.
- The listening note names the narration lines: every word clear over the music on a phone speaker.

## 9. Shot catalog for product and launch films

Fourteen shots that carry most product films, chosen by the job of the beat. Pick one per beat from the table, then build it for this product (its real interface, object and numbers); the catalog names a grammar, never a finished look. After AbubakrChan/product-launch-motion (MIT), rewritten for this kit.

| Beat | Shot | Suits |
|---|---|---|
| Cold open / hook | 1 Kinetic list | anything; strongest when the pain is a list of chores |
| Cold open, physical goods | 12 Hero object | devices, packaged goods, apparel, furniture |
| The problem grows | 2 Crowding | many steps, many tools, manual hand-offs |
| The problem, in numbers | 14 Chart | only with real numbers |
| The turn | 3 Held thesis | every film with a positioning line |
| The input | 4 Prompt | search, chat, command line, forms, checkout |
| The output | 5 Results | lists, grids, tables, feeds, catalogues |
| The work | 6 Workspace | inbox, editor, dashboard, CRM, console |
| Operations | 7 Tracker | orders, shipments, builds, approvals |
| Developer proof | 13 Terminal | SDKs, CLIs, APIs, agents |
| Reach | 14 Map | logistics, marketplaces, travel, coverage |
| Proof, numbers | 8 Count-up | any product with an approved figure |
| Proof, a person | 9 Testimonial | a real, named, consenting customer |
| Objection | 10 Comparison | crowded categories, before/after |
| Close | 11 End card | every film |

1. **Kinetic list** (3.5–5 s): 3–5 short lines stacking in place, one accent word each (usually the verb); a hairline and a tick per line light on the beat and stay lit. Says: there is more manual work than you think. Needs no product footage.
2. **Crowding** (3.5–4.5 s): 6–9 labelled chips on three depth planes (near: big, sharp, bright; far: small, soft, dim) close in on the viewer; the shot is the move from spread to crowded.
3. **Held thesis** (1.8–2.5 s, the shortest shot): the positioning line in two halves, the second quieter (same size, about 80 % opacity); one accent on one hinge word; locked camera.
4. **Prompt** (2–3 s): one wide card with the field and a caret that types; the button's pressed state starts the next shot.
5. **Results** (3.5–4.5 s): a tilted hero card; rows arrive as skeletons that resolve into real content in the same boxes, one state pill per row turning from idle to done.
6. **Workspace** (4–5 s, often the longest): two panes, the left one acting, the right pane answering live; one slow turn and one push, never both on the same layer at once (camera move and tilt each on their own transform).
7. **Tracker** (3–4 s): the status card on one side, the evidence (the real product, the parcel, the build output) on the other; three state rows complete one by one along a connector.
8. **Count-up** (3 s for one figure, 5–7 s for two): a fixed-width numeral box (tabular figures, so nothing reflows), a small label, one honest supporting bar or ring; bright ground; only an approved figure.
9. **Testimonial** (3.5–4.5 s): one sentence of quote, then face · name and role · company mark; the customer's own photo only, never a stock face.
10. **Comparison** (4.5–5.5 s): a table at about 80 % of the frame width, 5–8 rows in the buyer's words; the alternatives by category, never by brand; partial coverage shown honestly (an all-dash column is a straw man).
11. **End card** (3–4 s, holds ≥ 2.5 s): the mark draws then fills, one headline line, one solid CTA, the URL; rhymes with the opening register.
12. **Hero object** (4–6 s, once per film): the product turning under a raking rim light (three.js, or layered planes in 2D for a flat object).
13. **Terminal** (3–5 s): rebuilt, never screen-recorded: window, prompt, typed command, output, a final status line, paced to the voice.
14. **Map or chart** (3–4.5 s): a flat stylised map (no live map tiles) with routes drawing on; a chart whose line or bars draw from the real data; ground plus one accent.

**Composing them:**
- Never the same camera move on two adjacent shots (alternate locked, turn, locked, push).
- Alternate dense and still: a title, a stat or a quote between two busy product shots; for 45 s about three dense shots, four still ones and the two type frames at the ends.
- Change the register (ground colour, light or dark) at the story's turns (problem → product → proof), not inside them.
- **Real product only:** the real interface (screenshots or the live site captured with the user's OK) or a recreation labelled as illustrative; no invented feature, screen or number (`research/facts.md` lists each figure with its source).
