# Line Boil: Style Prompt

> Hand-drawn cel animation that breathes: every outline trembles a little from drawing to drawing, poses hold on
> twos, fast moves stretch into a single smear frame, and small hand-drawn effects (smoke puffs, splashes, sparks)
> sit on top of clean shapes.
> References (grammar only, never copy): studio cel animation from the 1990s and 2000s, the hybrid vector-plus-cel
> work of motion studios such as Buck and Giant Ant. Grammar after the style notes of Vincentwei1021/mg-styles-15 (MIT).

## 1. Essence, and what it is not

- **The line is alive.** Three or four slightly different versions of every outline cycle every two or three frames,
  so even a held pose feels drawn by hand.
- **Timing by drawings, not by frames:** on twos for most motion, on ones for the fastest action, on threes for holds.
- **Smears sell speed:** one in-between stretched along the path (150–300 %) on the frame where the move is fastest.
- **Hand effects on top:** smoke, splash, dust, sparks, speed lines drawn as flat shapes in a few frames each.

Not Rubber Hose (no 1930s black-and-white and swinging limbs), not Mid-century Cartoon (no limited animation and
offset print): this is a contemporary, colourful, hand-made look.

## 2. Materials & rendering

- Flat fills in two or three tones per object (base, shadow, a small highlight), outlines 2–4 px at 1080, colour or
  dark brown, never pure black.
- **The boil:** each outline point gets a seeded offset of 0.6–1.5 px that changes every `hold` frames and cycles
  through 3–4 seeds (`rng(salt + Math.floor(frame / hold) % 4)`); fills follow the same offset so lines and colour stay
  together.
- A light paper grain over the frame (multiply, 8–15 %), static or held on threes.

## 3. Colour logic

- A bright, warm-leaning palette of 4–6 colours with one deep ink; shadows are a darker, cooler shade of the base,
  never grey.
- Effects (smoke, splash) are the palette's lightest colours, outlined in the same ink.

## 4. Type & subtitles

- Hand-lettered or rounded display type that boils with the drawings (the same seeded offset on its outline), or a
  clean grotesque that stays still as a counterpoint; never both in one film.

## 5. Motion quality

- `LOOK.hold = 12` for twos; switch a scene to ones for the fastest gesture, threes for a held beat.
- Strong anticipation (`MOTION.anticipate`) and overshoot (`MOTION.back`); squash on landings, stretch on take-offs.
- One smear frame on each fast move: draw the object stretched along its path on the fastest frame only.

## 6. Camera grammar

- Mostly locked or a slow truck, like a layout drawn for animation; a punch-in on the gag; camera shake drawn into
  the frame, not added as a filter.

## 7. Sound palette

- Recorded percussion and mallets carry the comedy (`samples.py get woodblock slapstick marimba`): a woodblock tick
  per step, a slapstick crack on the impact, a marimba run on the take; a light synth or piano bed under it.
- Every drawn effect has its sound on the same frame.

## 8. Native moves (shot types)

| Shot | Use it for |
|---|---|
| Take | A character reacts: squash, hold three frames, stretch into the reaction, effects pop around the head |
| Smear dash | Fast exit: anticipation, one smear frame, speed lines and a dust puff where they stood |
| Morph gag | One object turns into another through a few hand-drawn in-betweens |
| Effect hit | An impact told by a drawn splash or star burst on ones |

## 9. Pitfalls of the medium

- Too much boil reads as a bug: keep it under 1.5 px and the same on every object.
- Everything on ones looks like vector animation; everything on threes looks broken. Mix by action.
- Realistic anatomy breaks the style; keep characters simple and graphic.

## 10. Engine

Canvas 2D starter: draw each object as a point list (`poly`), apply the seeded boil offset per hold, fill and outline
with `inkLine()`; smears are the same shape scaled along the motion vector for one frame.

## 11. Variation space

- **Palette:** warm daylight, a dusk version, or a two-colour print look.
- **Line:** coloured lines (softer) or dark brown (classic).
- **Pace:** 10–16 beats for 30 s; one held pose per beat as a breath.
