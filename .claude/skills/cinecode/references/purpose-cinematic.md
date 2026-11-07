# Purpose: cinematic film

Chosen with the mode at the start (`SKILL.md` "First questions"): the mode decides how deep the work goes, the purpose decides what kind of film it is. A cinematic film is a story, mood or art piece that should look **filmed, not rendered**. The shared rules stay in their own files and apply unchanged: motion (`motion.md`), the camera vocabulary (`camera-moves.md`), type (`typography.md`), sound sync (`sound.md`), the hook, one action per shot and unity (`SKILL.md` Hard rules, `quick-mode.md` §7), checks (`engine.md` §4–5).

## 1. Defaults

| Item | Default for a cinematic film |
|---|---|
| Quick Q3 style ★ | the look the idea asks for, inside the chosen medium |
| Quick Q4 sound ★ | b) music + sound effects, no words (ambience-led); a narrator when the idea needs a voice |
| Film mode Q5 | a sound identity led by ambience and one signature sound |
| Idea test | the light world test (`writing.md` §12) |
| On-screen text | as the film needs (`writing.md` §15, `motion-design.md`) |
| Finishing | **off by default**; motion blur, gate weave and the print curve are offered one by one (Quick: the director card; Film: the style frame gate). When chosen: `FINISH` in `film.html` = `shutter: { deg: 180, samples: 8 }`, `weave: 0.6`, `tone: { lift: 0.035, … }`; Film mode = `post.print`, `post.weave` in the film's look and `samples` in the capture params of fast shots |

## 2. The cinematic pass

Four layers that remove the clean CG look. Each one is subtle on its own; together they make the frame read as photographed. The subject stays readable through all of them (`looks.md` §5).

**Three of them are the user's choice, off by default:** motion blur (a), the print curve (b) and gate weave (d). Quick mode shows them as one line of the director card (the user turns any on in plain words; no question). Film mode asks one multi-select question at the style frame, each with its cost in a few words: "Hareket bulanıklığı / Motion blur (hızlı planlarda; o planların render süresi × 6–8)" · "Baskı rengi / Print tone (yumuşak siyahlar, filmsi ton)" · "Film titremesi / Gate weave (projektör gibi hafif kayma)" · "Hiçbiri ★". Lens character (c), grain and the operator's inertia (d) are craft and stay in the look; fog only when the story has it (d).

### a. Motion blur, 180° shutter

- **What:** each frame is the average of 6–8 sub-frames spread across the half of the frame interval a 180° shutter is open, centred on the frame. Fast motion smears the way a film camera records it; slow motion stays sharp.
- **Only where something moves:** both starters compare the first and last sub-frame at 64 px first; a frame where nothing moves keeps one sharp draw, so blur costs render time only in the moving frames, not the whole scene or shot.
- **Where:** only where motion is fast: whips, impacts, fast pans and trucks, passing objects, rain, sparks. Quick mode: `blur: true` on the scene. Film mode: `samples=8` in that shot's capture params (or `render.motionSamples` in the film's look).
- **Render time:** each sample is one more draw, so a scene with 8 samples takes about 8× as long. **Test on one shot first:** render its fastest second with blur and without (`shutter=0` in Quick mode, `samples=1` in Film mode), compare on a strip (`qc.py strip`), write the time per frame into `STATE.md`, then set the count: 6 for moves that only need a soft smear, 8 for whips and impacts.
- Sub-frames stay inside their own scene, so a hard cut never blends two scenes. The whip transition already streaks its own copies.

### b. Film tonality

- A filmic tone curve plus a print-style curve made by the kit itself (no third-party LUT files): **lifted blacks** (the darkest values sit 3–4% above black), a **soft highlight roll-off** from about 72% so whites ease off instead of clipping, a little S-contrast, and a light split (warm highlights, cool shadows).
- Quick mode: `FINISH.tone` (a per-channel 1D table made in `film.html`, applied through an SVG filter). Film mode: `post.tone: 'AGX'` plus `post.print: { lift: 0.035, knee: 0.72, contrast: 0.12, split: 0.02 }` in the film's look (the same curve, `looks.mjs`).
- Palette: no pure black or pure white in the picture; the brightest element sits under the shoulder.
- Check on the poster thumb: the darkest areas read as deep grey-black with detail, the brightest highlight keeps its shape (`qc.py bright`).

### c. Lens character

- **Shallow depth of field, chosen per shot** from the shot's read: one plane sharp, a rack focus when attention moves (Quick: `plane()` with `CAM.rackFocus`; Film: pmndrs `DepthOfFieldEffect` with `camera.mjs` `rackFocus`).
- **Oval bokeh** (an anamorphic feel), as an option when the look asks for it: out-of-focus highlights drawn as ellipses about 1.3–1.6× taller than wide.
- **Subtle chromatic aberration** toward the edges (`post.chromatic` 0.3–0.8; in Canvas, an offset red and blue copy of at most 1 px near the borders), a **slight barrel distortion** (straight lines bow by no more than 0.5% at the corners), and **halation**: a warm red-orange glow only around the brightest edges (Film: a high-threshold bloom tinted warm; Quick: a blurred, warm, low-alpha copy of the brightest shapes).
- None of them should be noticed one by one.

### d. Imperfection layer

- **Animated grain:** seeded per frame, already in both starters (`grain()`, `post.grain`).
- **Gate weave:** the whole frame drifts by a fraction of a pixel up to about 1 px, new every frame and seeded (`FINISH.weave` in Quick mode, `post.weave` or the `weave` URL param in Film mode). On-screen text and labels are drawn in screen space and stay steady.
- **When the story has fog or volumetric light:** density modulated by slow noise, thicker low and in the distance, drifting slowly; never one flat, even haze. A film without them loses nothing.
- **A camera operator:** moves start with inertia and settle with a small overshoot (`EASE.inertia`, `MOTION.spring(τ, 0.7)`); handheld drift is low-passed (`CAM.handheld`, `camera.mjs` `handheld`), never per-frame jitter.

## 3. Camera vocabulary

Moves from `camera-moves.md` at the card's tempo: a slow push-in toward the reveal, a dolly with the subject, a crane up for scale, a rack focus to move attention, a held frame for weight. Each move has a reason in the shot's read. The big moves (dolly zoom, speed ramp, freeze) once each at most; whip and smash cuts only where the story jumps.

## 4. Sound identity

Ambience leads: a bed per space carries the film, foley is close and real, the music is what the card names, one signature sound returns changed (`sound.md` §1–3). A narrator only when the idea asks for one.

## 5. Gates and checks (added to the shared ones)

- **No template shortcuts:** a cinematic film is built for its story, so the kit's scaffolding never reaches the screen. The example scenes are deleted, the starter's test scene is only a look test, a preset or style recipe gets the film's own palette and motivated light, and abstract shapes never stand in for the subject (unless the user asked for an abstract film). Every still is checked against one question: could it belong to another film? If yes, it is rebuilt before the user sees it.
- **Stills:** the first progress stills (Quick) or the style frame (Film) show the subject in its own world, lit for the scene, with the chosen finishing.
- **Before the full render:** when motion blur is chosen, the one-shot motion blur test above, with its render time.
- **After the render:** strips of the fast scenes: smooth smear, no stutter, no double images.
- **Title card** (`typography.md` §8): shaped by Art of the Title references and the measured type direction; reveal on a music phrase; the type QC applies.
- **Documentary and explainer: every line stands on an image.** A narrated fact gets a picture of its place: law has a hall, a decision a building, a treaty its printed page, a number its object or its people. Ask of each abstract line "where does this happen?" and show that. Black screen is punctuation only: under 1 s, for emphasis (`make.py` flags longer black inside the film).
- **Each image once.** An archive photo, a map or a reference shown twice tells the viewer the material ran out; different records (each newspaper page with its own date) feel like research. A repeat is allowed only as a named callback on the card (the opening image returned at the end).
- **Cold review:** does it look filmed? Name any frame that still reads as clean CG (hard black, clipped white, an even haze, a robotic camera move) and fix it.
