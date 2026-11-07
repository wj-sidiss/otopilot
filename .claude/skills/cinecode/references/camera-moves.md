# Camera moves and transitions: the named vocabulary

Every shot's camera is written as one **camera line**: **name, seconds, speed easing, target**.

```text
dolly in, 3 s, slow ease-in-out, toward the figure
whip pan, 0.3 s, ease-in-out, from the window to the door
dolly zoom, 3 s, slow ease-in-out, on the title
```

The line goes into `shots.json` (`camera.move.line`, Film mode) or the beat list and the scene function's first comment (Quick mode). Both engines implement every name: Quick mode in `film.html` (`CAM`, `retime`, `plane`, `TRANSITION`), Film mode in `starter/camera.mjs` for three.js. All of them are pure functions of time.

## Speed and easing words

| Word | Moves that change size (dolly, zoom, push) | Moves that sweep (pan, truck, orbit) |
|---|---|---|
| slow | subject size changes ≤ 10% per second | an object takes ≥ 6 s to cross the frame |
| medium | 10–25% per second | 3–6 s to cross |
| fast | > 25% per second | 1.5–3 s to cross (faster = whip pan) |

Easing: **linear** (machines, tracking at walking pace) · **ease-in** (gathering force; endings) · **ease-out** (fastest on frame 0: hook shots) · **ease-in-out** (deliberate, self-contained) · **inertia** (35% linear + 65% smoothstep: moving at frame 0 and still moving at the cut; the default inside a sequence). The first shot never starts with ease-in (hook rule).

One primary move per shot, plus at most one secondary (handheld, a small tilt). Every move has a reason: follow, reveal, tense (push), release (pull).

## Camera moves

| Name | What it does | What the viewer feels | Default | Start → end framing | Call (Quick · three.js) |
|---|---|---|---|---|---|
| **pan** | turns left/right on the spot; no parallax | scanning, following, linking two things | 3–6 s, slow–medium, inertia | thing A framed → thing B framed | `CAM.pan(c, e, 0, 0.4)` · `pan(pos, tgt, e, 0, 30)` |
| **tilt** | turns up/down on the spot | tilt up: awe, scale; tilt down: discovery, weight | 2–4 s, slow, ease-in-out | base → top (or back) | `CAM.tilt` · `tilt()` |
| **dolly in** | camera travels toward the subject; parallax | intimacy, tension, "this matters" | 3–6 s, slow, inertia (ease-out at the hook) | one shot size closer (WS → MS) | `CAM.dolly(c, e, 1.3, 0.8)` · `dolly(pos, tgt, e, 10, 6)` |
| **dolly out** | camera travels away | isolation, release, context | 3–6 s, slow, ease-in-out | one size wider | `CAM.dolly(c, e, 0.8, 1.3)` · `dolly()` |
| **zoom in** | focal length grows; no parallax | observation, surveillance, 70s documentary | 1–3 s, medium, linear or ease-in | wider → tighter, flat | `CAM.zoom(c, e, 1, 1.6)` · `zoom(e, 40, 22)` |
| **zoom out** | focal length shrinks | context arriving flat, detachment | 1–3 s, medium, ease-out | tight → wide | `CAM.zoom` · `zoom()` |
| **tracking / truck** | moves sideways, often with a subject | travel, companionship, depth from parallax | 3–8 s, walking pace (1–1.4 m/s), linear | subject held; background streams | `CAM.truck(c, e, -0.2, 0.2)` · `truck()` |
| **orbit / arc** | circles a target while facing it | importance, scrutiny; fast = heroic | 4–8 s, 5–30°, inertia | profile → three-quarter | `CAM.orbit(c, e, -10, 15, 0)` · `orbit(tgt, e, r, -10, 15, h)` |
| **crane / pedestal up** | rises, keeping the subject (tilt down) | hope, scale, a reveal over something | 3–6 s, slow, ease-in-out | eye level → high | `CAM.crane(c, e, 0, 0.3)` · `crane(pos, tgt, e, 0, 3)` |
| **crane / pedestal down** | descends | arrival, settling, gravity | 3–6 s, slow, ease-out | high → eye level | `CAM.crane(c, e, 0.3, 0)` · `crane()` |
| **dolly zoom (vertigo)** | distance and focal length change in opposite directions; the subject keeps its size, the background warps | realisation, dread, unreality | 2–4 s, slow, ease-in-out; once per film | same subject size; background grows or shrinks | `CAM.dollyZoom(c, e, 0.8, 1.8, 0)` · `dollyZoom(e, 5, 16, 50)` + `dolly()` |
| **push-in on detail** | dolly toward an off-centre detail, ending on it | "look here": a clue, an emotion | 2–4 s, slow, ease-in-out | MS → ECU of the detail | `CAM.pushTo(c, e, x, y, 1, 0.5)` · `pushTo(pos, tgt, detail, e, 0.8)` |
| **pull-back reveal** | starts on a detail, travels out to the context | surprise, irony, scale | 3–6 s, slow → medium, ease-in | ECU → WS | `CAM.dolly(c, e, 0.4, 1.6)` · `dolly()` |
| **FPV / fly-through** | fast forward flight through spaces, banking into turns | speed, exhilaration, immersion | 2–6 s, fast, linear with banking | through planes / along a path | `CAM.fpv(c, e, 2, -0.5)` · `fpv(points, e)` |
| **handheld** (subtle, seeded) | low-frequency wobble and drift, never per-frame jitter | presence, urgency, documentary truth | the whole shot; amount 0.5–1 subtle, 3+ for an impact | as the primary move | `CAM.handheld(c, t, 1)` · `handheld(t, 1)` |
| **slow motion / speed ramp** | time runs slower; a ramp changes speed inside the shot | weight, a moment stretched; a ramp punctuates | 0.25–0.5×; ramps over 0.3–0.6 s | — | `retime(t, [[1, 1], [1.4, 0.25]])` (both) |
| **time-lapse** | time runs much faster | time passing, change, the scale of nature | 2–6 s at 8–100× | — | `retime(t, [[0, 24]])` |
| **freeze frame** | time stops (the camera may keep moving) | punctuation, "remember this", a comic beat | 0.5–2 s | — | `retime(t, [[2, 1], [2, 0]])` |

## Focus

| Name | What it does | What the viewer feels | Default | Call |
|---|---|---|---|---|
| **rack focus** | focus jumps from one plane to another | attention moves; two things connect | 0.5–1.5 s, medium, ease-in-out | Quick: `CAM.rackFocus(c, e, 0, 1.2, 1)` (planes blur by depth) · three.js: `dof.cocMaterial.worldFocusDistance = rackFocus(e, 2.5, 9)` |
| **focus pull** | focus follows a subject moving in depth | attention stays on the movement | the move's length, linear | the same, with the focus distance following the subject |

## Transitions

| Name | What it does | What the viewer feels | Default | Call (Quick: the incoming scene's `in`) |
|---|---|---|---|---|
| **hard cut** | instant change | clarity, momentum | 0 frames | no `in` (or `{ type: 'cut' }`) |
| **match cut** | a shape, motion or colour carries across the cut | connection, poetry, a time jump | 0 frames, then 0.3–0.6 s settle | `{ type: 'match' }` + `CAM.matchFrom(c, e, dx, dy)` in B |
| **whip pan** | a very fast pan with streaks hides the change | energy, a jump in place or time, comedy | 0.2–0.35 s, ease-in-out | `{ type: 'whip', dur: 0.3, dir: 1 }` |
| **cross dissolve** | A fades into B | time passing, memory, softness | 0.4–1.5 s | `{ type: 'dissolve', dur: 0.6 }` |
| **iris** | B opens inside a growing circle (or shape) on one point | into the subject, a storybook or silent-film feel | 0.4–0.7 s, ease-in-out | `{ type: 'iris', dur: 0.5, at: [0.5, 0.4] }` |
| **wipe** | an edge sweeps B over A | a page turning; graphic, playful (use only when the style owns it) | 0.3–0.8 s, ease-in-out | `{ type: 'wipe', dur: 0.5, dir: 1 }` |
| **smash cut** | a hard cut between contrasting energy (loud → silent, calm → chaos) | shock, comedy | 0 frames; the sound changes on the same frame | `{ type: 'smash' }` + the sound change at the same cue in `score()` |
| **J-cut** | B's sound starts before B's picture | anticipation, being pulled forward | sound leads by 0.3–1.5 s | in `score()`, start B's sound at `cue − lead` |
| **L-cut** | A's sound continues over B's picture | continuity, reflection | tail of 0.5–2 s | in `score()`, let A's sound run past the cue |

**Vary them.** Never the same designed transition twice in a row (plain cuts are the default joint and may follow each other); graphic transitions (wipe, push, slats, zoom through) last 0.45–0.6 s. Let the picture choose: zoom **through** an element the eye is already on (a tile, a window, a label) into the next shot; let the next shot **grow out of** something that just lit up (a dot, a lamp, a node); **push** sideways for a change of topic at the same level; **sweep** when a scan or wipe is already moving across the frame; reveal in **slats** on a bar for a rhythmic beat. Name how each shot leaves in the beat table or shot list.

**Where the cut lands (cut seams).** A cut inside motion is invisible when the motion carries across it: cut at the move's fastest moment, not as it settles; keep the direction and the speed the same on both sides (a pan right at 400 px/s meets a pan right at about 400 px/s); a zoom keeps its sign across the cut (pushing in stays pushing in); the subject's position and the eye's resting point line up within a tenth of the frame. Never put a hard cut inside a motion-blurred frame: the blur stays on its own side of the cut (the Quick starter clamps its sub-frames to the scene).

Film mode (three.js shots encoded separately): hard, match and smash cuts are plain cuts in the concat; dissolves and wipes use ffmpeg `xfade` (`transition=fade`, `wipeleft`, `wiperight`); a whip pan is a fast `pan()` over the last 4–6 frames of shot A and the first 4–6 of shot B in the same direction, with motion blur from the look pipeline; J- and L-cuts are offsets in the mix.

## One continuous shot

The film is one unbroken move of the camera through one world. Choose it when the film is one place and one subject and its drama is a change of scale, a pursuit or a reveal. `python3 tools/moves.py form "<the brief>" --seconds N` reads the brief for it (a journey, "follows", "grows into", "close pass", "drone", "orbit", "tek plan", "takip") and names the form with its reasons; the card decides.

- **Build the world once** and draw every frame from it through one camera: one scene from 0 to the end, no cut, no transition. A camera that travels along or around the subject stands in it in perspective (`VIEW.of(CAM.path(keys, t), S)` with keys `{ t, x, y, z, tx, ty, tz, fov }`; hand-drawn things placed with `view.sprite`, ground and objects with `view.poly`, far things paled with `view.haze`); a frontal move can stay in flat depth planes (`plane()`).
- **The move is the story:** write it as 3–4 beats inside the move (establish wide · follow · the close pass or the push to the detail · pull away or reveal), each a key in `CAM.path(keys, t)`; the camera flows through the keys and never stops on one. A moving subject is chased with `CAM.follow` (the camera trails it a fraction of a second, like an operator).
- **What sells it:** real scale change (the subject from a few pixels to filling the frame), parallax (near planes sweep past fast, far ones barely move), foreground objects wiping across the lens at the closest moment, a speed ramp (`retime`) into the pass, a rack focus as the subject crosses the focus plane, a little low-passed drift (`CAM.handheld`, amount 0.2–0.4) for a drone or a hand.
- **Composition moves too:** the subject keeps a strong place in the frame (a third, the centre, leading the motion with space ahead) while its size changes; a horizon that tilts with the turn of the camera, never by accident.
- **Longer than about a minute,** a single move rarely holds: hide the joins inside it (a whip, the camera passing behind a foreground object or through a surface, a push into black) and keep one world.
- **In ads:** one orbit around the product while one light crosses it; a camera that travels through the product's world and arrives at the product; a pull-back from a detail to the whole. The end card may follow on its own as the only cut.

## Choosing

- **Reasons first:** push = tension or importance, pull = release or reveal, track = travel, crane = scale, orbit = scrutiny, handheld = presence, locked off = let the subject or light move.
- **Transitions belong to the idea:** cuts by default; a dissolve means time, a whip means energy, a match cut means connection. A generic transition used for decoration weakens the film.
- **Spend the big ones once:** dolly zoom, freeze frame, smash cut and speed ramps land because they are rare.
- **Consecutive shots differ** in move, size or direction while the film keeps one visual language (variety within unity: `quick-mode.md` §7, `craft.md`).
