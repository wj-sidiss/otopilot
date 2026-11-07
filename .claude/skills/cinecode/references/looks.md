# Looks

A look is a **parameter preset**, not hand-written effects: a palette, a lighting setup, a material style and a finishing chain for **pmndrs/postprocessing** (Zlib) on **three.js** (MIT). The presets live in `starter/looks.mjs`; `starter/scene.html` renders any of them with `?look=<id>`. Every preset is a **starting point**: each film changes what its idea and references ask for.

## 1. The eight families

| Preset id | Family | In one line | Suggested formats |
|---|---|---|---|
| `cinematic-realistic` | cinematic realistic | low warm key, filmic tone curve (AgX), gentle bloom, grain, vignette | 16:9, 2.39:1, 9:16 |
| `anime-cel` | anime / cel | toon shading in 3 steps, dark outlines, saturated daylight skies | 16:9, 9:16 |
| `pastel-storybook` | pastel storybook | soft frontal light, 4-step toon, lifted pastels, lower contrast | 16:9, 1:1, 9:16 |
| `claymation` | claymation | rough matte materials, tilt-shift miniature focus, characters on twos | 16:9, 1:1 |
| `papercut-collage` | papercut / collage | 2-step toon, thin edges, static paper grain, 12 fps | 16:9, 1:1, 9:16 |
| `retro-synthwave-vhs` | retro / synthwave / VHS | unlit neon shapes, heavy bloom, chromatic fringe, scanlines, 30 fps | 16:9, 9:16, 4:3 |
| `glossy-commercial` | glossy commercial | bright sweep, low roughness, crisp highlights, clean colour | 16:9, 1:1, 9:16 |
| `handmade-ink` | hand-made traditions | paper tones, near-monochrome, ink outlines, halftone dots, 12 fps | 16:9, 9:16 |

The format always follows the deliverable (16:9, 9:16, 1:1, 4:5, 2.39:1). No preset adds a letterbox.

## 2. What each parameter does

| Group | Parameter | Effect |
|---|---|---|
| `palette` | `[background, ground, main, secondary, accent]` | the colours the test scene uses; the film's own palette replaces them |
| `materials` | `shading: pbr / toon / unlit`, `steps` (toon), `roughness` (pbr) | how surfaces respond to light; toon steps = number of flat tones |
| `light` | `azimuthDeg` (0 = backlight, ±90 side, 180 from camera), `elevationDeg`, `intensity`, `ambient`, `fog`, `exposure` | key light direction and strength, sky fill, depth haze; `exposure` scales all lights |
| `post.tone` | `AGX`, `ACES_FILMIC`, `NEUTRAL` | tone curve: AgX for natural highlights, ACES for punchier contrast, NEUTRAL keeps flat colours exact (toon, flat design) |
| `post.saturation`, `hue`, `brightness`, `contrast` | −1…1 (hue in radians) | the grade, after tone mapping |
| `post.bloom` | `threshold`, `smoothing`, `intensity`, `radius` | glow from bright areas; low threshold = neon, high = only the sun |
| `post.chromatic` | pixels at 1080p | colour fringe at the edges (lens, VHS) |
| `post.outline` | `color`, `strength` | ink lines on every mesh except those with `userData.noOutline` (the ground) |
| `post.tiltShift` | `focusArea`, `feather` | miniature focus band (claymation, dioramas) |
| `post.dotScreen` | `scale`, `angle`, `opacity` | halftone print dots |
| `post.scanline` | `density`, `opacity` | video lines |
| `post.pixelation` | granularity in pixels | chunky pixels |
| `post.vignette` | `offset`, `darkness` | darker corners |
| `post.grain` | `intensity`, `size`, `chroma`, `hold` | film grain (kit effect); `hold: 1000` = static paper fibre |
| `render` | `fps`, `hold` (characters on twos = 2), `aspects` | frame rate and stepping; keep the camera on ones (`heldTime()` in looks.mjs) |

## 3. Choosing and changing a look

1. Start from the base family of the direction picked at the style question (or the nearest preset to the references).
2. Render the test scene at a small size to see the preset (`--params "look=<id>&w=960&h=540"`), then render the film's own first shot with it.
3. Change **one group at a time**, in this order: light → palette → materials → finish. Re-render one frame after each change.
4. Write the film's look as its own object in `engine/looks.mjs` (copy a preset, give it a new id, change values), so the kit's presets stay untouched.
5. The approved style frame is the bar for every later frame.

## 4. Custom look from references (the "from my references" path)

When the user drops images into `refs/`:

1. **Look at them small and measure them in one step:**
   ```bash
   python3 tools/asset_search.py board --refs refs --out research/refs-board      # one numbered sheet of refs/ (any image type)
   python3 tools/direction.py measure refs/*.* --out research/direction          # palette, key, contrast, saturation, warmth, a look patch
   ```
2. **Use the measure:** the palette (dark to light, accent last) and the look patch in `research/direction/direction.json` are the starting values for the preset (`direction.py` is the same tool as the direction board, §10).
3. **Read the light:** where the key comes from (azimuth, elevation), how hard the shadows are, how dark the darkest area is, whether highlights glow.
4. **Read the finish:** grain or clean, edges or none, saturation high or muted, contrast high or lifted, any print or video texture.
5. **Write the preset** from those readings (start from the nearest family and change values).
6. **Compare side by side** (style frame first, references at the same height) and adjust one group at a time:
   ```bash
   ffmpeg -v error -i review/style-v1.png -i refs/a.jpg -i refs/b.jpg -filter_complex "[0]scale=-2:540[s];[1]scale=-2:540[a];[2]scale=-2:540[b];[s][a][b]hstack=3" -frames:v 1 review/style-v1-vs-refs.jpg
   ```
Copyrighted films and images are **mood references only**: studied and compared, never placed in frames.

## 5. Code fit: how things are shown (and how to handle people)

This decides how a thing is shown, never what the film is about: any subject, place, hour or light can be the film.

**What reads as old CG.** A realistic person, building, ship, vehicle, room or product shown whole, in the middle distance, in clean even light reads as an old render however long it is worked on. The same thing reads well as a part or a macro, in motion, with real material and a light that has a direction, in a stylised medium that draws it on purpose (linocut, ink, paper, toon), as real material (photographs, archive, footage the licence allows), or partly in shadow. The card names each such thing and its route. Low-poly with flat, untextured faces is not a medium: it is the old-CG look itself, however stylish the palette. A 3D world never has its texture off: every surface carries material (edges, wear, print or brush texture), the light has a direction and falls off, and depth separates near and far.

**The realistic-render standard.** When the look is realistic or material (`shading: pbr`; the `cinematic-realistic` or `glossy-commercial` families; a world meant to read as real), every scene meets this bar before it is shown. A stylised look (toon, cel, paper, ink, pixel, clay) is held to its own style's craft instead, and none of this is applied to it — PBR, grain and photoreal post would break it.

- **Real material, from real sources.** No surface seen in light is flat or untextured: albedo + roughness + normal/micro-detail + fresnel, a motivated key, real shadow + ambient occlusion + bounce. Reach for a real scanned texture or HDRI before a hand-made one (`asset_search.py search --type texture` / `--type hdri`, Poly Haven CC0; `--type image` for a real map or plate where it beats a shader — a planet's surface, a telescope sky, a seabed); hand-made only when no scan fits. **Only where it is seen:** in dark, fog or silhouette the surface is not read, so the lever there is light and air, not texture, and no scan is fetched for it.
- **Depth in every frame.** Near, mid and far layers, the far separated by value or colour; micro-variation on every lit surface even in the brightest light. An outdoor view that reaches far (a landscape, a city, a horizon) carries the thin aerial perspective real air always gives, a clear noon included: `fog` low and its colour the sky's, so the far pales and cools; that is physics, not mood, and a vista without it reads as CG. Haze, mist or weather as a mood only when the story has them.
- **Film finish.** ≥1.5× supersampling to a half-float buffer for clean edges (set `post.msaa: 0` so it does not stack with the default MSAA), one combined post pass (ACES or AgX tone, grade, measured bloom, fine grain). Real shutter motion blur stays the user's finishing choice, off by default (its render cost is ×6–8 on fast shots, `purpose-cinematic.md` §2): taken only when the card or the style frame turns it on, and then only where something moves.
- **One material language; every scene, not the test one.** The same light and material logic across the film; each scene built for itself, never one automatic pass over all; the bar is met by **every** scene before the film is called done — pro for the first worlds and flat after is not finished.

**Fast is not the cost of quality; waste is.** Material and light are cheap — texture and HDRI are lookups, so use them freely. The cost is the per-frame multipliers: a reflection that re-renders the scene each frame (bake the environment once, or screen-space), many shutter sub-frames (few, only on motion), high-sample ambient occlusion (screen-space, low, baked into the static texture), a shadow light per object (one or two, one shadow map). Build one full-size test frame of the heaviest scene, print its milliseconds, and keep it near or under a second a frame at full size; over that, name the costly effect and cut it without lowering the look. The approved frame and its time are the bar for the rest.

Harder: realistic human faces and hands at close range. When the story needs a person: stylised characters (toon, clay, paper), silhouettes, figures at a distance, hands and objects instead of faces, or a hybrid with filmed or generated footage the user provides. Faces are allowed; for close-ups suggest stylisation or silhouette.

**The code-fit check, before the style is picked.** Ask of the idea: what must the viewer see up close? A realistic human body or face in motion (walking, dancing, playing a sport, hair and hands) is the one thing code draws badly, however long it works on it. Then the ★ keeps the idea and its subject and shows the people in a way this medium does well (a stylised cast, `characters.md`). The realistic option stays on the list with one honest line ("insan figürleri kodla kaba görünür").

**A hard request gets the route that works.** When the idea asks for something code does badly (realistic people, crowds, sport, dance, animals in close-up), the ★ is the nearest style that does it well, said in one line with the reason; three.js builds objects, architecture and landscapes in depth, lit and placed as What reads as old CG says; realistic characters are not its ★, but a user who wants them gets them, told the cost once and then helped fully. The kit never spends an hour on a drawing that does not work and then shows it: the first two scenes are the test (`quick-mode.md` §3), and a failed test switches to the ★ route with one line to the user. A connected image or video generator is not one of these routes unless the user asks for it (`SKILL.md`: Generated pictures only when the user asks).

**Style serves the subject.** Put the heaviest stylisation (halftone, glitch, paint strokes, heavy grain, posterisation, colour shifts) on backgrounds and secondary layers. The subject keeps a clean silhouette, its key features (the shape of a landmark, a product's logo side, an animal's head and ears) and enough contrast against what is behind it. Do the one-second read on the subject: on a 96 px thumb (`qc.py thumb … 96`) the viewer still says what it is. When the look and the subject compete, lower the effect on the subject's layer before changing the look.

## 6. Libraries, versions and offline use

| Library | Licence | Pinned version | Role |
|---|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | MIT | 0.186.1 | renderer, scenes, materials |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | Zlib | 6.39.5 | effect chain |
| `starter/looks.mjs` FilmGrain effect | MIT (this kit) | — | grain with size, hold and luminance response |
| [Fontsource](https://fontsource.org) font files | each family's own licence (most are SIL OFL 1.1; check the package's `LICENSE`) | the package version, e.g. `@fontsource/inter@5.2.8` | the film's typeface, the same on every machine |

- The kit installs nothing. `scene.html` loads the pinned versions from the jsDelivr CDN with an import map (first render needs the network).
- **Offline renders:** download the two module files once into `engine/vendor/` and point the import map there:
  ```bash
  mkdir -p engine/vendor
  curl -L -o engine/vendor/three.module.js https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js
  curl -L -o engine/vendor/postprocessing.js https://cdn.jsdelivr.net/npm/postprocessing@6.39.5/build/index.js
  ```
  (`three/addons/` is not needed by the starter.) Ask the user before downloading.
- `starter/index.html` needs no libraries at all (one fragment shader): use it when the network is unavailable or a shader-only world fits.
- Licences of both libraries are already rows in the project's `LICENSES.csv`.
- **Type:** system fonts differ between machines and often lack Turkish or other Latin diacritics. Pick one open-licence family that fits the era and tone (two at most: display and text), load it from Fontsource on the pinned CDN, `https://cdn.jsdelivr.net/npm/@fontsource/<pkg>@<version>/files/<pkg>-<subset>-<weight>-normal.woff2`, with both the `latin` and `latin-ext` subsets as `FontFace`s with their unicode ranges (Quick mode: set `TYPE` in `film.html`; Film mode: set `TYPE` in `engine/scene.html`, which already imports `loadType()` from `./type.mjs`; the full method is `typography.md`), and wait for them before `READY`. Write one `LICENSES.csv` row per family (name, version, licence from the package's `LICENSE`). Test every box with `İĞÜŞÖÇ ÉÅ Ñ`. Offline: download the woff2 files once into `engine/vendor/fonts/` and point `base` there (ask first).
- Do not ship code from Shadertoy unless its header states a permissive licence (the site default is non-commercial share-alike), and never anything marked NC or ND.

## 7. Determinism

- Time comes from the frame index only (`t = frame / fps`); `buildLook` sets every effect's time and renders with delta 0.
- All randomness is seeded (grain hashes `(frame, seed)`); no `Math.random`, `Date`, `performance.now` or `Clock` in a capture.
- Seeded data built once (a star field, scattered props) is created lazily, after the seed is read from the URL: a small cache such as `const lazy = (make) => { let v; return () => (v ??= make()); };` filled on first use inside `renderFrame`, never at module top level before `SEED` exists.
- Load every asset (textures, fonts: `await document.fonts.ready`) before `READY` resolves.
- `node tools/capture.mjs --url engine/scene.html --verify` must say IDENTICAL.

## 8. Visual clichés (as of October 2026)

**The gallery average, measured (October 2026, 300 frames from 703 public films made with Opus 5.5 in code, and 948 titles):** 56 % carry no saturated colour on more than 3 % of the frame: an off-white or charcoal ground with one small accent; where there is an accent it is most often orange-red (16 %), then amber (9 %); a purple-blue ground is rare (3 %), and the cream-and-terracotta "assistant" look about 2 %. The most requested film is a product or app launch with floating UI cards, counters and kinetic type, then games, explainers, comparisons and history timelines. A film reads as that average when it sits on a neutral ground with one small accent and floating cards: make at least one colour decision the viewer sees (the palette's colour owning part of the frame at the key moments), unless the look is monochrome by choice and the card says so. `make.py` prints a `colour:` line for a film that barely uses colour.

`make.py` reads the film's own code at every render and prints a `cliché:` line for a particle burst, RGB split, lens flare, neon glow, glitch or elastic easing that the director card does not name with its reason.

**AI-overused choices first.** The kit has no default font or palette, but generated design drifts to the same few choices: the look family's untouched palette; warm cream with terracotta, indigo or violet gradients, slate navy, bright Tailwind blue; Inter, Roboto, Montserrat, Poppins, Space Grotesk, Instrument, Playfair, DM, Geist. A film's palette comes from its own references (the board's measured colours, the place, the material, the era) and its type from its tone (`fonts.py search "<tone>"` over 2,000+ open fonts, or the curated pairings). `make.py` prints a **taste** line at every stills and draft when one of them is still there; it is answered with a reason on the director card or a change, never ignored.

Code- and AI-made videos share a set of visual habits that viewers now spot at once. Use this table as a checklist at the style frame and at every self-review. Any item can still be the right choice when the film's idea asks for it: write the reason into the look notes and use it on purpose.

| Tell | Why it reads as generic | Do instead |
|---|---|---|
| Purple-to-cyan gradient backgrounds | the out-of-the-box palette of countless tools and templates; it says "no colour decision was made" | build the palette from the film's world and references: one dominant hue, one accent with a job |
| Glowing particle soup | thousands of sparkles fill space without meaning; the eye finds nothing to read | a few particles with a physical cause (dust in a light shaft, pollen, rain, embers), seeded, sized by depth |
| Perfect symmetry in every shot | real places and objects are uneven; constant symmetry looks computed | keep symmetry for one deliberate shot; elsewhere place the subject off-centre and vary spacing with seeded offsets |
| Lens flares everywhere | flares with no light in frame read as decoration | a flare only from a visible bright source, matching the lens, at the hero moment |
| RGB split and glitch on every cut | a filter that says "digital" without a reason; it smears type and faces | a glitch only where the story breaks (a signal lost, a memory failing), once |
| Neon glow on everything | a heavy glow on every edge flattens depth and reads as a template thumbnail | glow only where there is a light source; the rest keeps its edges |
| Elastic and bounce easing | the springy overshoot of UI libraries; it makes serious subjects feel like an app | the spring words of `motion.md` §5 chosen per subject; bounce only for a playful film |
| Everything in slow motion | removes rhythm and stretches the runtime; slow means "important" only by contrast | real time by default; slow down the one moment that earns it; vary speed from shot to shot |
| Floating bokeh orbs | out-of-focus circles with no lights behind them belong to no scene | bokeh from real practical lights behind the subject, sized by the focus distance |
| Centred title on black | a still, interchangeable opening that breaks the hook rule | open on motion; put type inside the world (on a surface, in the light) or bring it in after the hook |
| Consecutive shots that look the same | same size, angle and speed give no sense of progress | change at least two of size, angle, direction and speed at each cut |
| Heavy teal-and-orange grade | a worn-out preset that pushes every sky and skin tone the same way | grade from the film's own palette; set saturation per hue on purpose |
| Procedural noise nebulae and clouds | the default look of shader tutorials: soft, formless, scale-less | give atmosphere structure: a light direction, layers at depth, scale cues; study real photographs for shape and colour |
| Floating UI cards and glass panels | a tech-template trope that replaces a world with an interface | when an interface is the story, ground it on a device, desk or hand; otherwise show the thing itself |
| Default fonts | system or tool default type signals no typographic choice | pick a typeface that fits the era and tone (OFL or another open licence), set size, tracking and line length deliberately |
| Bloom on every surface | glow everywhere flattens contrast; nothing feels special | high bloom threshold; glow only on real light sources |
| Camera drifting with no reason | an endless slow orbit reads as a screensaver | motivate each move: reveal, follow, push in on a beat; let some shots hold |
| Spotless, uniform surfaces | flat CG cleanliness reads as plastic | add wear, roughness variation, dust and edge detail taken from the references |

## 9. The style library (58 recipes) and the Quick mode looks

The eight families above are the base. On top of them sits a **library of 58 detailed style recipes** in `KIT/styles/` (51 by LemoLab, seven the kit's own, `source: cinecode` in `styles/index.json`) (woodcut, ukiyo-e, shadow puppetry, risograph, 80s cel anime, silent film, Swiss motion, dark keynote, glass product, data storytelling…), each mapped to its nearest base family. A recipe holds what stays true for every film in that style: essence and what it is not, materials and rendering, colour logic, type and subtitles, motion quality, camera grammar, sound palette, native moves, pitfalls and a variation space. Section 10 (Engine) of each recipe that has one describes the source project's demo engine, which is not part of this kit: build the same grammar in `film.html` or the scene pages.

**Cheap by design.** Never read the library whole:

1. **Find candidates** from the idea's words or the fitting family: `python3 tools/styles.py list --q "<2-4 words>"` or `--base <family>` (one short line each). A style the user names after a studio, channel or film ("Vox gibi", "Ghibli", "Wes Anderson", "Apple reklamı") is looked up the same way: the known-names table (`KIT/styles/aliases.json`, `styles.py names`) puts the nearest recipes first, or names the family when no recipe fits. A name means its grammar, never copying the studio's work.
2. **The library rows** of Quick mode's board when no look was named (the authored rows come first, `quick-mode.md` §1, question 3; Film mode shows three authored directions, `film-mode.md` Step 1): candidates that differ from each other (family, era, material), base families or recipes. Start from `python3 tools/styles.py suggest "<idea>" --board research/style-board.jpg` (six different candidates, ordered by the idea) and swap any weak one with `styles.py board <1> … <6>`; show them by eye before asking, on that one numbered board (the recipes' demo posters, downloaded and tiled in seconds; for choosing only, never in the film).
3. **Read only the chosen recipe** (`styles.py show <id>` prints its path). Take from it: the colour logic into `PALETTE`, the materials and texture into the draw functions, the motion quality (on ones or twos, the reveal grammar) into `MOTION` use, the camera grammar into the camera lines, the type rules into the type direction, the sound palette into the sound identity, the pitfalls into the preview check. Its references are grammar only: never copy their works or name them in the film.
4. Log the pick in `STATE.md` (look line) with the user's reason.

**Quick mode looks.** `templates/quick/film.html` carries the eight families as `LOOKS`, applied to the whole frame by the look pass: grade, bloom on highlights, texture (`paper` fibre, `scanlines`, `halftone` dots), vignette, grain (moving or static fibre) and the drawing rate (`hold: 12` draws on twos while the camera, captions and sound stay at 24). Draw functions use `shade(hex, light)` (smooth light, or toon bands from `steps`) and `inkLine(g, S)` (the look's outline width) so a family change carries through the drawings. `?look=<id>` swaps the family for a preview, so a style change at the director card costs one `make.py stills` (seconds). A recipe starts from its base family's entry and adds its own grammar in the draw functions.

Recipes: [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) by LemoLab, MIT (`styles/LICENSE-lemo-opuscar`), pinned in `styles/index.json`.

## 10. The direction board (Film mode)

In Film mode the style question is answered by eye, from real films. As soon as the idea is known, before the style question:

1. **Three directions**, each a different visual answer to this idea (not three shades of one), authored for this story: a base family as its ground (one row at most may be a library recipe that truly fits, `film-mode.md` Step 1), built from the six references `deal.py deal look` deals, with the films or artists whose look carries it. Each direction gets a short label in the user's language ("<label>").
2. **Stills, mood only:** `python3 tools/asset_search.py search --q "<film title>" --sources filmgrab --n 6 --max-wait 12 --out research/dir-a1` (or `--q "cat:<cinematographer>"`), the 3–4 that show the direction kept. FilmGrab is copyrighted film stills: a link and a thumbnail each, for choosing and measuring only (`assets-and-licences.md`).
3. **One image:** `python3 tools/direction.py board --row "A|<label>|<style id>|research/dir-a1,research/dir-a2" --row "B|…" --row "C|…" --out review/directions.jpg`. Each row: the recipe's poster (only on a recipe row), the stills, the measured palette below; the printout gives one line of measured words per row (key, contrast, saturation, warmth, an estimate of the key light). Show the image and ask the style question with A, B, C (★ with a reason) and "own".
4. **Measure the pick** (at the style frame, `film-mode.md` Step 4): `python3 tools/direction.py measure --dirs <the row's folders> --out research/direction` writes `direction.json` with a **look patch** for the film's own look in `engine/looks.mjs`: the palette (dark to light, accent last), the light (`azimuthDeg`, `elevationDeg` as an estimate, `ambient`, `exposure`) and the post values (contrast, saturation, vignette). Copy the chosen preset, apply the patch, then build the still.
5. **Check the still against the direction:** `python3 tools/direction.py compare review/style-v1.png --against research/direction/direction.json` checks key, contrast, saturation, warmth and the dark share against the span of the direction's stills. Each "off" is fixed, or named as intentional at the gate.

**Long films (`craft.md` §0):** the board stays three rows; the coverage grows after the pick. Over 60 s, each chapter gets 2–3 more stills from the picked direction that match its light, searched in the same films or the same cinematographer's page and measured per chapter (`direction.py measure --dirs … --out research/direction-C3`); over 3 min, per act. The film keeps one look; a chapter's patch only moves light, warmth and key within it, and each chapter's still is compared with its own measure.

The board costs a few requests and one image; a direction is a starting point for the film's own world, never a copy of the films in it (no shots, characters, sets or titles of theirs).

## 11. Light and lens vocabulary

Names for the light the director card's **Atmosfer / Atmosphere** and **Işığın hikâyesi / Light arc** lines use, with how each is built. Three.js: `look.light` (`azimuthDeg` 0 = backlight, ±90 side, 180 from camera; `elevationDeg`; `intensity`; `ambient`). Canvas 2D: gradients and `shade()` on the subject, additive (`'lighter'`) glows, `plane()` depth. Use one light idea per scene, motivated by a source the viewer can believe (the sun, a window, a lamp, a screen). Vocabulary after showheyohtaki/motion-prompt (MIT).

| Name | What it is · what it feels like | Build |
|---|---|---|
| **Backlight** | the source behind the subject: a glowing outline, a hazy halo · longing, arrival | three.js azimuth 0–20°, haze up; 2D: a bright radial bloom behind, the subject a shade darker with an additive edge glow |
| **Rim light** | a thin bright edge on the subject's far side · separation, drama, product shine | three.js a second light behind (azimuth 160–200° from the key); 2D: an offset copy of the silhouette in the light colour under the subject, or `shadowBlur` in `'lighter'` |
| **Silhouette** | a dark shape against a bright sky · mystery, iconic shape | no fill: ambient near 0, a bright gradient ground; the shape must read in black alone |
| **Split** | side light, half the face lit · conflict, a double nature | three.js azimuth ±90°; 2D: a hard-edged gradient across the subject, clipped to it |
| **Rembrandt** | key high at 45°, a small triangle of light on the shadow cheek · classic portrait, gravity | azimuth ±45°, elevation 35–45°, fill low; 2D: the lit side plus one small triangular highlight on the dark side |
| **Butterfly** | high frontal key, a small shadow under nose and chin · glamour, beauty products | azimuth 180°, elevation 55–65°, soft |
| **High-key** | bright, shadows lifted, little contrast · clean, hopeful, medical, beauty | ambient high, ground near white, LOOK grade lift up, contrast down |
| **Low-key** | mostly dark, one pool of light · tension, noir, luxury | ambient near 0, one narrow key; keep the subject's key features inside the pool |
| **Golden hour** | low warm sun, long shadows, warm key and cool shadows · nostalgia, warmth, endings | elevation 5–15°, key about 3,000 K (warm orange), shadows toward blue, long shadow shapes |
| **Blue hour** | no direct sun, deep blue sky, warm practical lights · calm, melancholy, a city waking or sleeping | ambient blue, no hard shadows, small warm sources (windows, lamps) as accents |
| **Bokeh** | out-of-focus points of light become soft discs · intimacy, night, depth | discs sized by depth with soft edges, additive; behind the subject only |
| **Tilt-shift** | blur above and below a sharp band: a real place as a miniature · play, overview | the claymation family's miniature focus, or a depth blur band with `plane()` |
| **Long exposure** | moving lights become lines · time, flow, a city's pulse | draw each light's path over a window of 0.5–2 s as one stroke, fading toward the past |
| **Panning shot** | subject sharp, background streaked · speed, focus on one thing | the camera follows the subject; the background drawn as several offset copies along the motion (directional smear) |
| **Lens flare** | rings and ghosts from a bright source · heat, sun, sci-fi | ghosts along the line from the light through the frame centre, low alpha, `'lighter'`; once, from a light that is in the frame |
| **Fisheye** | ultra-wide bulge · skate, surveillance, comedy | a barrel-distortion shader pass (three.js); avoid in Canvas 2D |
| **Chromatic aberration** | colour fringes toward the edges · lens character, glitch, VHS | the retro family's fringe; keep it at the edges, never on body text |
| **Vignette** | darker corners · focus on the centre, an old lens | LOOK `vignette` |
| **Black and white** | brightness only · memory, document, timeless | grayscale grade; separate subject and ground by value, since colour no longer does it |
| **Duotone** | darks in one ink, lights in another · graphic, brand, poster | a luminance-to-two-colours table (the tone-curve filter in the Quick starter, two stops) |
| **Teal and orange** | cool shadows, warm skin and highlights · blockbuster, energy | a split-tone grade: shadows toward teal, highlights toward orange; keep skin natural |
| **Film grain** | fine moving texture · film, warmth | LOOK `grain` (reseeded per frame or on twos) |
| **Light leak** | a warm translucent glow drifting in from an edge · nostalgia, a transition | an additive warm blob at a frame edge for 0.3–1 s, often across a cut |
| **Double exposure** | two images in one: a landscape inside a person's silhouette · memory, identity | the silhouette as a mask, the second image inside it with `'screen'`, the ground light |
