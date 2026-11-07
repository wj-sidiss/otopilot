# Characters: a stylised cast

Read when a film needs a person or a creature on screen. Code draws realistic people badly (`steering.md` §1), so a
story with people gets a **stylised cast** instead: round heads, bean bodies, rubber-hose limbs and mitt hands, drawn by
the Quick template's `character()`. Realistic people stay out unless the user insists, with the honest cost.

## 1. Design the cast once

- One design per actor in `CAST` (the FILM section of `film.html`): skin, hair and its style (short, bob, long, bun,
  curly, cap, bald), top, bottom, shoes, outline, build (0.8 slim to 1.3 broad). Colours come from the film's palette;
  each actor owns one colour that no one else wears.
- **The silhouette test:** two actors side by side must differ as shapes (height, build, hair), not only in colour.
- Heights in a scene follow one ratio (a child about 0.7 of an adult) and never change between shots.

## 2. The model sheet before any scene

`node tools/capture.mjs --url film.html --frames 0 --format jpeg --out review/cast-<name> --params "w=1920&h=1080&modelsheet=<name>"`
draws every view (front, three-quarter, side, back), all 16 emotions as busts and the actions on one frame. Read it
like a product's hero still (`quick-mode.md` §3): proportions consistent across views, every emotion readable at
phone size, colours separate from the film's grounds. Send it to the user (`SendUserFile`, render) with the first
stills; a design that reads wrong is fixed here, never in the scenes.

## 3. Acting

- **One feeling per beat,** changed on its cue: `emotion` is one of neutral, happy, laugh, sad, cry, angry, surprised,
  scared, proud, shy, thinking, tired, determined, love, disgusted, confused.
- **The eyes lead:** `look` turns toward the next thing a few frames before the head or body moves.
- **Anticipation and settle:** a big action winds up first (`jump` spends its first fifth crouching; a wave starts
  with the arm rising) and lands with a squash; hold a reaction 0.5–1 s before the next.
- **Actions:** `idle` (breathing, blinks), `walk`, `run`, `wave`, `cheer`, `jump` (p 0..1 across the jump), `point`,
  `nod`, `shake`, `dance`, `sit`; `p` is seconds into a cycle (use `t - start`), or 0..1 for the jump.
- **Talking:** `talk` 0..1 opens the mouth; drive it from the `VO` table during a line
  (`talk: 0.5 + 0.5 * Math.sin(TAU * 6 * t)` inside the line, 0 outside); no lip shapes beyond open and closed.
- **Moving across the frame (side view, no sliding feet):** a walk covers about 0.65 × height per second, a run about
  1.8 × height per second; `face` turns the actor (1 right, -1 left).
- **Line boil** (`boil: true`) for a hand-drawn feel; the look's texture (paper, halftone) sits on top as for
  everything else.

## 4. Limits, said honestly

- Hands are mitts (no fingers); faces are simple (dots, brows, a mouth); no realistic features.
- A face needs about 120 px of character height to read; smaller, use silhouettes or backs.
- Crowds: a few actors with varied designs in the front, silhouettes behind; never the same design copied in a row.
- A creature (a dog, a bird) is drawn for the film as its own shapes; the rig is for people.
