# Vox Explainer: Style Prompt

> A documentary "why" film made of paper: torn cards, cut-out archive photos and documents laid on a warm desk, a marker that circles the one detail that matters, bold condensed type on paper strips, and a narrator who walks the viewer from a question to an answer, one sourced fact per shot.
> References (grammar only, never copy): the explainer videos of Vox (2014–) and the editorial-collage documentaries that followed them; newspaper clipping files; a researcher's desk with highlighters. Recipe written for cinecode; shot types and review lessons after charlie947/motion-graphics-skills (MIT).

## 1. Essence, and what it is not

- **A question, answered on paper.** The film opens on one "why" question a stranger half understands and closes on a takeaway of five words or fewer. Every shot proves something the line before it said.
- **Everything is a printed object:** photo cut-outs with a white border, document scans, charts on cream stock, sticky labels. Depth comes from paper layers and soft shadows, never from glow.
- **The facts are real.** Every name, date and number on screen comes from a source the user approved (`research/facts.md`, credited in the description, not on the frame); a similarity is said as "looks like", never "is".
- **The narrator leads.** Picture follows the voice line by line; a shot changes when the sentence changes.

Not Halftone Dossier (no comic stamps, mascots or gags; the tone is a calm investigation), not Archive Light Table (no backlit glass or loupe; paper lies on a desk), not Swiss Motion (no clean grid on white; the page is warm, layered and a little messy).

## 2. Materials & rendering

- **Desk and paper:** a warm cream ground with low mottling and fine grain, built once; every card is a flat fill with a torn edge (a seeded jagged polygon, 2–5 px teeth at 1080) and a soft drop shadow (offset 6–10 px, blur 12–18 px, 25–35 % ink).
- **Cut-outs:** photos and objects keep a white border of 8–14 px and the same shadow; real images only with a licence row, otherwise drawn in code as flat silhouettes.
- **Print texture:** a halftone screen on photos and large fills (dots 6–10 px, one angle), paper grain over the whole frame, fine film grain on top, all reseeded on twos.
- **Marker:** a felt-tip stroke that draws itself (stroke length driven by time), slightly wobbly, 6–10 px, round caps, used for circles, underlines and arrows.
- **Highlight:** a yellow bar laid behind a word, drawn left to right like a highlighter, slightly uneven at both ends.
- **Counters and charts** are drawn mark by mark from the real numbers, on cream cards.

## 3. Colour logic

- Paper cream ground, one navy ink for type and lines, one signal red for the marker and the key word, one yellow for the highlighter. Photos are toned toward the paper (a light warm wash) so they sit in one world.
- Default palette (label it as a default): red `#B8312A`, cream `#F1E6D0`, paper `#FBF7EE`, navy `#14213D`, yellow `#F2C230`. A brand film takes its own hex codes into the same roles.
- No gradients on type, no glow, no neon.

## 4. Type & subtitles

- **Statement type:** a bold condensed sans (Oswald, Anton, Bebas Neue, League Gothic) in upper case on a torn paper strip, three short lines at most.
- **Body and labels:** a sturdy text face (Source Serif, Newsreader, IBM Plex Sans) in navy; labels sit on small white tags with a pin or tape.
- **Sources** live in `research/facts.md` and the description, never as tags on the cards; a document the camera reads may show its own letterhead.
- Subtitles, when asked, sit on a cream bar at the bottom safe area; never over the marker.

## 5. Motion quality

- **Stepped, on twos:** each drawn pose holds two frames at 24 fps (`LOOK.hold = 12`). Smooth corporate easing reads wrong here.
- Cards drop in from just above with a small overshoot and settle; cut-outs slide in along the desk; nothing bounces twice.
- The marker and the highlighter are the only things that move at writing speed; while they draw, everything else holds.
- No typewriter text: a statement strip arrives whole and its words land one by one in weight, not letter by letter.

## 6. Camera grammar

- A slow push across the desk (5–10 % over a shot), a pan from one card to the next along the paper, a punch-in on the circled detail.
- The camera never rotates freely; it moves like a rostrum camera over a table, with depth from the paper layers.
- Transitions: a card slides over the old one, a paper tear wipes, a match from a circled detail to the next shot's subject.

## 7. Sound palette

- A low bed (soft pulse or piano with a little tape), a paper hit on each new shot (card drop, page flip, tape), a marker squeak under the circling, a lift under the last line.
- The voice sits on top: the score ducks under every line; effects never mask a word.
- A silent explainer feels unfinished; sound is built from version 1.

## 8. Native moves (shot types)

| Shot | Use it for |
|---|---|
| Kinetic statement | One sentence to remember: three short lines of condensed type on a torn strip |
| Paper cards | Several things at once (logos, products, quotes): cards drop in with shadows, equal sizes and gaps |
| Before / after | A change over time: the same card, a date chip flips |
| Label call-out | Naming one thing inside a picture: the marker circles it, then a tag lands |
| Counter | A number that grows, drawn from the real figure |
| Grid | "They all look the same": many equal tiles, then one breaks the pattern |
| Document zoom | A line in a real document: push in, highlighter, the source tag |
| Map | Where it happened: a paper map, the marker draws the route or the area |

## 9. Pitfalls of the medium

- A single line or bar moving across an empty card reads as static: every shot uses cards, images or objects in depth.
- Lopsided grids look like mistakes: equal card sizes and gaps.
- Logos fill their card and come from the real files; a small logo in a big box looks wrong.
- A small, quiet opening loses the viewer: say the question big and show the first surprise within five seconds.
- An unsourced number on screen breaks the genre; no source, no number.

## 10. Engine

Built in the kit's Canvas 2D starter (`templates/quick/film.html`) or a Film-mode scene page: a `paper` layer built once with `lazy()`, cards as seeded torn polygons with `shade()` shadows, `inkLine()` for the marker with its length driven by `k`, `LOOK.hold = 12` for twos, `text()` on strips for statements, `label()` for tags. The score and the paper hits go in `score()` and `SFX` on the `CUES`; the narrator lines in `VO` (sound.md §4b gives the voice its own treatment: a close, dry "desk" voice suits the genre).

## 11. Variation space

- **Palette:** the default red/cream/navy/yellow, or a brand's own four colours in the same roles; a darker "night desk" variant with a navy ground and cream type.
- **Texture:** clean (few photos, more type) to dense (clippings layered three deep).
- **Pace:** 8–14 shots for 30–60 s; a statement shot every 4–5 shots as a breath.
- **Formats:** 16:9 for YouTube, 4:5 for feeds, 9:16 with the statement strips stacked vertically.
