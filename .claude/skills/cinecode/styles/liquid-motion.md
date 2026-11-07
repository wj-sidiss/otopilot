# Liquid Motion: Style Prompt

> Shapes that behave like thick, glossy liquid: drops fall and squash, blobs merge with stretched necks and snap
> apart, a wave floods the frame as the transition, and the final mark forms out of a single drop.
> References (grammar only, never copy): liquid logo reveals in beverage and music-video motion design. Grammar after
> the style notes of Vincentwei1021/mg-styles-15 (MIT).

## 1. Essence, and what it is not

- **One material: liquid.** Everything on screen is the same glossy substance with a highlight and a rim, so it reads
  as volume, not as flat blobs.
- **Merging and splitting:** two blobs approach, a neck stretches between them, they fuse; a drop separates with a
  thin thread that snaps and recoils.
- **Secondary drops follow 2–3 frames late,** and every landing ripples.
- **Organic curves only:** no straight edges, no hard corners, nothing moves in a line.

Not Glass Product (no rigid object), not a fluid simulation: it is designed motion that feels like liquid.

## 2. Materials & rendering

- A field of soft circles merged with a smooth minimum (metaballs), thresholded to a crisp edge; the field's gradient
  gives a normal for a fake light: a broad soft shade, one sharp specular highlight, a thin bright rim on the far side.
- A drop's tail is a tapered capsule along its path; a splash is 5–9 small drops thrown on arcs (`MOTION.arc`).
- A soft shadow or reflection under the liquid on a plain ground.

## 3. Colour logic

- One liquid colour or a warm-to-cool flow through two or three neighbours (orange to pink, teal to blue); the ground a
  deep complementary tone so the highlight pops. A brand film pours its own colour.

## 4. Type & subtitles

- The wordmark forms from the liquid: letters as a field the blobs flow into, then the edge sharpens. Supporting text is
  a clean, heavy sans that appears after the liquid has settled.

## 5. Motion quality

- Flung, never even: fast out of rest, a long settle (`EASE.out` with a spring on arrival, `MOTION.spring` with a low
  zeta for wobble).
- Squash on every landing (10–20 %), stretch on every fall; volume kept constant.
- Rebounds of 2–3 frames after a merge; a wobble that decays over half a second.

## 6. Camera grammar

- Mostly locked, close on the liquid; a push-in on the hero merge; the wave transition sweeps across with a slight
  camera follow.

## 7. Sound palette

- Gloops, pours, drips and splashes designed per event (filtered noise plus a falling sine for each drop); a deep bass
  swell under the wave; a glossy pluck or kalimba (`samples.py get kalimba`) for the drops in rhythm.

## 8. Native moves (shot types)

| Shot | Use it for |
|---|---|
| Drop and splash | The opening hit: one drop, a squash, a crown of drops |
| Merge | Two things become one: the neck, the snap, the rebound |
| Flood wipe | Transition: a wave with 3–5 bulges along its front crosses the frame |
| Pour into form | The reveal: liquid fills the shape of the product or the mark |
| Last drip | The ending: a drop falls from the mark and ripples |

## 9. Pitfalls of the medium

- Flat blobs without a highlight read as cheap vector art; always light the field.
- Uniform timing kills the liquid; no two drops move alike.
- Too many blobs become noise; 3–7 masses on screen at a time.

## 10. Engine

A small WebGL fragment pass for the field (smooth-min of seeded circles, gradient normal, specular and rim) inside the
Quick starter, or Canvas 2D with `fillShape()` on a marching-squares outline at draft quality; the field is a pure
function of time.

## 11. Variation space

- **Material:** water-clear (refraction tint), candy gloss, molten metal, ink in water.
- **Ground:** dark and dramatic or a pale studio ground with a soft shadow.
- **Pace:** 6–10 beats for 15–30 s; ideal for loops and logo stings.
