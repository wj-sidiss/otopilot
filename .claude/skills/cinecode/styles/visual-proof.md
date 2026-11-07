# Visual Proof: Style Prompt

> Mathematics and science explained the way a good teacher draws it: one idea built on screen from shapes, every
> quantity keeping its own colour, the equation assembling out of the shapes it describes, one label at a time, the
> camera gliding with the thought. The viewer sees why, not only what.
> References (grammar only, never copy): visual mathematics channels and the animation grammar of programmatic math
> explainers (shapes that become symbols, a calm dark ground, colour as meaning).

## 1. Essence, and what it is not

- **One idea per scene, built, never shown whole.** A square grows on each side of a triangle before anyone says
  "a squared"; the area is seen before it is named.
- **Colour is meaning:** each quantity has one colour for the whole film (a in teal, b in amber, the sum in white);
  the symbol, the shape and the label share it.
- **The equation comes out of the picture:** the term flies from the shape it measures into its place in the line;
  the line is never typed on from nowhere.
- **One thing moves at a time;** the rest waits, slightly dimmed.

Not a Data Storytelling chart (no axes-first charts of real data), not Vox Explainer (no clippings or collage), not
Whiteboard (no hand, no marker): calm geometry and typeset math.

## 2. Materials & rendering

- A deep ground (charcoal blue or warm black, never pure black) with a faint grid only where coordinates matter.
- Shapes as clean strokes 2–3 px at 1080 p with flat translucent fills (20–35 %); points as small filled circles.
- Formulas typeset as TeX (`FORMULAS` and `formula()` in the Quick template: real fractions, powers, roots and sums,
  tinted per quantity, revealed left to right); plain words with `text()` and `label()`.
- Curves and graphs drawn by their own equation, sampled densely; a traced point leaves a fading trail.

## 3. Colour logic

- 4–6 colours, each owned by one quantity or idea; the ground and the neutral line colour carry the rest.
- A quantity keeps its colour across every scene; a new idea gets a new colour, never a reused one.
- Emphasis by brightening the owner's colour, never by a new accent.

## 4. Type & subtitles

- Formulas in TeX (Computer Modern by default, or a matching math font); labels in one humanist sans, small, set
  beside what they name, entering after it.
- One label on screen at a time where possible; an equation stays until the next idea replaces it.

## 5. Motion quality

- `EASE.inOut` everywhere, unhurried (0.8–1.5 s per change); staggered starts (`MOTION.stagger`, 0.1–0.2 s) when
  several parts move.
- A shape becomes a symbol by moving and shrinking into its place in the formula (`morphShape` for outlines, a
  position tween for the term), never by a cut.
- Transforms keep identity: a term that rearranges moves as itself to its new place.

## 6. Camera grammar

- A slow glide that follows the thought: pan to the next part of the board, push in on the term being discussed,
  pull back to show the whole proof at the end. No handheld, no fast moves.

## 7. Sound palette

- A soft pad or a single sustained piano; a quiet tick or a soft mallet note (`samples.py get glock vibraphone`) when
  a term lands; silence before the key step; one warm chord when the result appears. A narrator usually leads.

## 8. Native moves (shot types)

| Shot | Use it for |
|---|---|
| Build | A figure appears piece by piece in the order of the argument |
| Shape to symbol | A length, area or count flies into its term in the equation |
| Rearrange | Terms slide to their new places; a cancelled pair fades together |
| Trace | A point moves along a curve and draws it |
| Zoom to infinity | Pushing in on a pattern that repeats at every scale |
| Result | The final line, framed, with one warm chord |

## 9. Pitfalls of the medium

- Too much on screen: one idea per scene, old ones dimmed or gone.
- Colours that change meaning between scenes: keep the table of quantity to colour in `STATE.md`.
- Formulas typed letter by letter: typeset with `formula()` and reveal by its k, or build terms from shapes.
- A wrong step: check every equation and number on screen; a visual proof that is false is worse than none.

## 10. Engine

Canvas 2D starter: `FORMULAS` and `formula()` for typeset math (MathJax, pinned, Apache-2.0, loaded only when the film
has formulas; add its `LICENSES.csv` row), `poly` and `morphShape` for shapes, `text()` and `label()` for words,
`CAM` for the glide; graphs sampled from their own functions inside `draw`.

## 11. Variation space

- **Ground:** charcoal blue, warm black, or a light paper ground for a print feel.
- **Subject:** a proof, a physics law, an algorithm, a statistic explained, a chemistry reaction.
- **Length:** 30–60 s for one idea; 2–3 min chapters for a chain of ideas.
