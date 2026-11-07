# Sticker Explainer: Style Prompt

> A knowledge film on one huge calm canvas: cut-out photos with thick white borders like stickers, flat icons and
> exact charts laid side by side, and one continuous camera that glides and zooms from fact to fact.
> References (grammar only, never copy): the dense science and economics explainers of popular online knowledge
> channels. Grammar after the style notes of Vincentwei1021/mg-styles-15 (MIT).

## 1. Essence, and what it is not

- **One canvas, one camera path.** The whole film is a single large layout; the camera moves across it, so every new
  fact is physically next to the last.
- **Sticker photos:** real objects cut out with a thick white border (8–12 px) and a soft shadow, which makes photos
  from different sources look like one set.
- **Exact charts:** bars to scale, numbers that add up, counters that land on the real figure.
- **A new element on every beat:** density is the point; nothing is on screen just to fill it.

Not Vox Explainer (no torn paper or desk; a clean digital canvas), not Dark Keynote (light, calm ground, not a product
launch).

## 2. Materials & rendering

- A calm off-white or blue-grey ground with a faint grid; flat icons in two or three colours plus one accent.
- Stickers: real photos only with a licence row; otherwise objects drawn as flat illustrations with the same border.
- Leader lines with labels for parts; thin rules; rounded tags.

## 3. Colour logic

- Two neutrals (ground, slate ink), one or two supporting colours, one accent for the key number or the key part.

## 4. Type & subtitles

- One clean sans in two or three weights, strict alignment to the canvas grid; numbers in tabular figures; labels short.

## 5. Motion quality

- Long, smooth camera eases between points (`EASE.inOut`, 1–2 s); elements pop in with a small overshoot as the
  camera arrives (`MOTION.back`); counters count up on a tick.

## 6. Camera grammar

- One continuous move per section: glide, zoom into a detail, pull back to show how it connects; never a cut inside a
  section.

## 7. Sound palette

- A clean, light bed; a soft click per pop-in, ticks under a counter, a gentle whoosh on each long camera move
  (`samples.py get woodblock glock` for the clicks and the reveal notes).

## 8. Native moves (shot types)

| Shot | Use it for |
|---|---|
| Exploded view | What is inside: parts slide apart with leader-line labels |
| Grid light-up | Which ones: a grid of tiles, the relevant ones light up |
| Growing bar | How much: a bar grows to scale with a counter |
| Route map | Where from: a flat map, a route draws itself |
| Pull-back | How it all connects: the camera reveals the whole canvas |

## 9. Pitfalls of the medium

- Charts that are not to scale break trust at once.
- A camera that cuts instead of travelling loses the style.
- Too many colours turn the calm canvas into noise.

## 10. Engine

Canvas 2D starter: draw the whole canvas in world units and move `CAM` over it (`truck`, `pushTo`, `zoom`); stickers
as images with a drawn white border and a shadow; charts from the real numbers.

## 11. Variation space

- **Ground:** off-white, pale blue-grey, or a dark night version.
- **Density:** a fact every 2–3 s for social cuts, every 4–6 s for a calm explainer.
- **Formats:** 16:9 for long explainers, 9:16 with a vertical canvas path.
