# Shape Morph Chain: Style Prompt

> One hero shape keeps becoming the next meaningful thing, on the beat: a coffee cup becomes the sun, the sun a
> sunset over the sea, the wave a gull, the gull a paper plane, the plane a map pin, the pin the mark. The story is
> told by the outline itself.
> References (grammar only, never copy): keynote and high-end explainer morph sequences. Grammar after the style notes
> of Vincentwei1021/mg-styles-15 (MIT).

## 1. Essence, and what it is not

- **The outline never breaks.** Every change is continuous; nothing pops in or out.
- **A bridge shape between unlike shapes:** A becomes a simple form (circle, capsule) and then B, each half 8–12
  frames, so nothing tangles in between.
- **The morph moves:** a slight rotation and 10–15 % squash and stretch during the change hide the interpolation.
- **Sub-parts change together:** the cup's steam becomes the sun's rays, then the waves.

Not Swiss Motion (no grid or type-led layout), not Pictogram Motion (no sequence of separate icons on cards): one
shape, one story.

## 2. Materials & rendering

- Flat or softly shaded vector fills, one or two colours per shape, a clean edge; optional thin outline.
- Shapes as point lists (`poly`), resampled to the same count and aligned at the start point before blending
  (`morphShape`); check the mid-point of every morph for knots.
- The background changes colour with each new meaning, by a clean colour-block wipe.

## 3. Colour logic

- One colour per meaning (the cup warm brown, the sun orange, the sea blue), all from one palette of 5–6; the hero shape
  stays the brightest thing on screen.

## 4. Type & subtitles

- Few words: one label per meaning at most, set in a clean sans, entering after the shape settles; the final mark
  carries the brand name.

## 5. Motion quality

- `EASE.inOut` with soft cushions at both ends (3 frames); each morph lands on a beat (`beat(n)`).
- A small anticipation before each change and an overshoot as the new shape settles (`MOTION.back`, s about 1).

## 6. Camera grammar

- Locked, centred on the hero shape; a slow push across the whole chain; one pull-back at the end to reveal the mark.

## 7. Sound palette

- A plucky arpeggio or mallet line (`samples.py get marimba glock`, one note per morph on the chord), a pitched whoosh
  landing on each change, a warm bed; the last morph gets the biggest hit.

## 8. Native moves (shot types)

| Shot | Use it for |
|---|---|
| Bridge morph | Any A to unlike B: through a circle or capsule |
| Part morph | Details travel: steam to rays to waves |
| Colour wipe | The background follows the new meaning |
| Final lockup | The chain ends in the mark and the name |

## 9. Pitfalls of the medium

- Knots and self-crossing outlines in the middle of a morph: always bridge unlike shapes and check mid-frames.
- Morphs that do not mean anything: each step must say something about the subject.
- Same speed every time: vary the duration with the beat types.

## 10. Engine

Canvas 2D starter: `poly`, `morphShape`, `fillShape` and `TRANSITION` wipes; shapes drawn once as point lists and
reused; every frame a function of time.

## 11. Variation space

- **Finish:** flat, softly shaded, or line only.
- **Chain length:** 4–6 morphs for 15 s, 7–9 for 30 s.
- **Use:** product stories, brand values, a process in steps, a loop that returns to its first shape.
