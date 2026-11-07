# Motion inside the frame: how things move

`camera-moves.md` covers the camera. This file covers what the camera looks at: the subject, objects, text, labels and UI. Most "made by a computer" motion comes from four habits: everything moves at once, moves run at constant speed, things start and stop dead, and every part stops on the same frame. The rules below remove them.

Times are in seconds, with frames at 24 fps in brackets (multiply by 1.25 for 30 fps). In Quick mode the helpers are `MOTION` in `film.html`; for Film mode the same functions are in §8.

## 1. Order: what moves first

- **One lead per moment.** In every beat one thing is the hero: it makes the biggest move, or the first one, and the eye follows it. Supporting elements move less far, less fast, and smaller.
- **Lead or reveal.** Pick one per beat. *Lead:* the hero moves first and the context answers it. *Reveal:* the context settles first and the hero arrives 0.1–0.2 s (3–5 f) later, as the payoff.
- **Cause before effect.** The thing that causes a change moves first: the hand before the cup, the gust before the leaves, the key press before the screen. Reactions follow 2–4 frames later, never on the same frame.
- **One trigger, one start.** When several things react to one event, they all start within one frame of each other and move away from where the event happened. They may land at different times.
- **One way in.** A group enters from one side or one shared origin; mixed directions read as noise.
- **A third at a time.** With three or more moving elements, at most about a third make their main move together. The first settles as the third starts.

## 2. Timing and spacing

| What moves | Typical duration |
|---|---|
| a small accent (a tick, a blink, a badge, a button press) | 0.12–0.2 s (3–5 f) |
| a label, card or word entering | 0.25–0.4 s (6–10 f) |
| an object crossing part of the frame | 0.5–1 s (12–24 f) |
| something large, heavy or solemn | 0.8–1.5 s (20–36 f) |
| ambient life (drift, breathing, flicker) | 2–20 s loops |

- **Longer distance, a little more time.** Twice the distance takes about 1.3× the time; a move across the whole frame about 1.8–2×. Equal durations for unequal distances look mechanical.
- **Weight is timing.** Heavy things start slowly and stop firmly; light things start quickly and drift into place. By material: rigid metal 1.2× the base time and no overshoot; rubber 0.8× with 15–25% overshoot; water 1.5× with about 5%; paper and cards 1.0× with 3–5%; smoke 2× and none; glass 0.9× and none.
- **Exits are shorter** than entrances: 65–75% of the entry time.
- **Hold after a landing.** Give 4–6 frames of stillness (only ambient life) after a main move before the next one starts, so the eye can register it. Text holds are in `craft.md` §4.
- **Spacing is the easing.** The distance an object travels between frames is what the viewer feels. Check it on a strip (§7).

## 3. Easing for things in the frame

- **Entrances ease out** (fast arrival, soft landing). **Exits ease in** (gentle start, fast departure). **Moves within the frame ease in and out.** **Loops use a sine.**
- **Linear only for machines:** a conveyor, a clock hand, a constant spin, a progress bar, a slow drift. A living, thrown or falling thing never moves linearly; that is the most common cause of stiff motion. (Camera moves have their own rules in `camera-moves.md`; a camera may drift linearly.)
- **No pops.** Nothing starts at full speed out of stillness or stops dead from full speed, unless the style is deliberately mechanical or the beat is a hard hit. Every start has an ease or an anticipation; every stop has a settle.
- **One easing family per group.** A staggered group shares one curve; only the start times differ.

## 4. The principles that remove stiffness

| Principle | What to do | Numbers |
|---|---|---|
| **Anticipation** | a small move the opposite way before the main move | 10–20% of the move, 0.1–0.2 s (3–5 f); skip it for accents under 0.15 s · `MOTION.anticipate` |
| **Follow-through and overlap** | parts hanging off a body (hair, cloth, a tail, a cable, a shadow, the rows inside a card) start after the body and stop after it, with a small overshoot | start 1–4 f later, stop 2–5 f later; the body and its parts never stop on the same frame · `MOTION.at(t - lag, …)` |
| **Secondary action** | a smaller reaction that supports the main one (dust after a landing, a shadow growing as a card lifts, a ripple after a tap) | 30–50% of the main move's size, starting 1–2 f after it, with its own easing |
| **Arcs** | living things travel on curves | bow a straight path by 5–20% of its length at the middle · `MOTION.arc`; machines and UI may move straight on purpose |
| **Squash and stretch** | only when the style owns it (cartoon, playful) | keep the volume (wider means shorter); impact 2–4 f, recovery 4–8 f; never in a realistic or premium look |
| **Overshoot by tone** | how far a landing passes its mark before settling | realistic or premium 0% · calm 2–5% · an accent 5–10% · playful 15–25%; the most elastic landing at most once per film · `MOTION.back`, `MOTION.spring` |
| **Counter-motion** | the background answers the hero | it moves 20–30% of the hero's distance the opposite way; layers move at about 1× (front), 0.5× (middle), 0.2× (back) |
| **Ambient life** | in a held shot something small keeps moving | breath, dust, a flicker, a sway: seeded, slow, near the edges; it never competes with the read |

## 5. Springs in words

`MOTION.spring(tau, zeta, f)` gives a damped spring's position after a release `tau` seconds ago. `zeta` (the damping ratio) sets the overshoot, `f` (in Hz) the speed.

| Word | `zeta` | Overshoot | Use |
|---|---|---|---|
| firm | 1.0 | none | weight, realism, premium |
| soft | 0.8 | ≈ 1.5% | calm landings |
| lively | 0.7 | ≈ 5% | the default for labels and cards |
| bouncy | 0.5 | ≈ 16% | playful accents |
| elastic | 0.4 | ≈ 25% | one punchline |
| rubber | 0.3 | ≈ 37% | cartoon only, once |

Frequency: 1–1.5 Hz for big or heavy things, 2–3 Hz as a standard, 4 Hz or more for small, snappy ones. The spring settles in about `0.64 / (zeta × f)` seconds (0.45 s for lively at 2 Hz).

## 6. Stagger

- **Delays:** 1 frame for a tight cascade (letters, particles), 2–3 frames as a standard (list rows, icons), 3–5 frames for a dramatic build. A set of small items should finish spreading within about 0.5 s; longer reads as a slow list, unless the build itself is the shot's action.
- **Order:** reading order for words and lists, centre-out for a burst around a hero, reverse for exits, seeded random for organic things (`MOTION.stagger`).
- **Punctuation:** the last item may land with a touch more overshoot than the rest.

## 7. On the beat, and the motion review

- **The landing sits on the cue.** The frame where a move arrives (the contact, the end of the ease) is the one on the beat, so the move starts its own duration before the cue, and an anticipation earlier still. Sound lead-ins and frame-exact tempos are in `sound.md` §2 (principle 10).
- **Review motion on strips, not stills.** For each key move: `python3 tools/qc.py strip <video> <start> <seconds> 12` (12 frames per second of the move), then a still at each cue + 0.3 s (the settle) with `qc.py thumb`. Check:
  1. One lead per moment; the eye finds it within half a second.
  2. Cause moves before effect.
  3. No living, thrown or falling thing moves linearly (equal gaps between frames on a strip).
  4. No pops: every start eases or anticipates; every stop settles.
  5. Attached parts overlap; nothing stops on the same frame as its body.
  6. Overshoot stays within the tone's budget.
  7. No more than a third of the elements make their main move together.
  8. A hold follows each landing; held shots still breathe.
  9. Landings sit on their cues.
- Write each finding as one line with the scene and the second, fix it, and re-check the strip. In the cold review (`engine.md` §4) the motion score is 2 only when all nine pass.

## 8. The helpers

**Shape, light and type moves** (in the Quick starter; copy them into a scene page for Film mode):
- **Shape morph:** `fillShape(g, morphShape(A, B, k), color)` turns one closed outline into another (one outline into another); outlines are point lists, `poly.circle`, `poly.rect`, `poly.star` or your own. Use it as a link between beats ("this becomes that", `craft.md` §3) with `k` from `MOTION.back` for a small settle.
- **Light sweep:** `lightSweep(g, x, y, w, h, k, { angle, width, strength, color: 'r,g,b', clip })` crosses a product, card or title with one soft band of light, once; the premium touch on a reveal, never on a loop.
- **Masked text:** `text(g, S, str, x, y, size, color, 1, null, { reveal: k, by: 'word', spread: 0 })` lifts a whole line from behind its own baseline; `by: 'char'` with a spread staggers it.
- **Iris:** the transition `{ type: 'iris', dur: 0.5, at: [x, y] }` opens the next scene inside a circle on a point (the subject's eye, a lamp, a button); its `shape: (g, cx, cy, r) => …` option draws another mask shape.

Quick mode has them in `film.html`. For Film mode, paste them into the engine page:

```js
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const MOTION = {
  at: (t, start, dur) => clamp((t - start) / dur),                       // 0..1 progress of a move
  back: (k, s = 1.7) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,    // ease-out with overshoot: s 1 ≈ 4%, 1.7 ≈ 10%, 2.2 ≈ 15%
  anticipate: (k, amount = 0.15, share = 0.25) => k < share             // wind back by `amount`, then release
    ? -amount * (1 - Math.cos(Math.PI * k / share)) / 2
    : -amount + (1 + amount) * (1 - (1 - (k - share) / (1 - share)) ** 3),
  spring: (tau, zeta = 0.7, f = 2) => {                                  // damped spring after a release tau s ago
    if (tau <= 0) return 0;
    const w = 2 * Math.PI * f;
    if (zeta >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * tau) * (Math.cos(wd * tau) + zeta * w / wd * Math.sin(wd * tau));
  },
  stagger: (i, n, spread, order = 'seq', rand) => {   // 'random' needs a seeded rand: frames are functions of time        // start delay of item i of n
    if (n < 2) return 0;
    const u = i / (n - 1);
    const p = order === 'reverse' ? 1 - u : order === 'center' ? Math.abs(2 * u - 1) : order === 'random' ? rand() : u;
    return p * spread;
  },
  arc: (k, ax, ay, bx, by, bend = 0.15) => {                             // point on a bowed path from a to b
    const dx = bx - ax, dy = by - ay, o = bend * Math.sin(Math.PI * k);
    return [ax + dx * k - dy * o, ay + dy * k + dx * o];
  },
};
```

Pass a seeded generator as `rand` so random staggers stay the same on every frame (Quick mode's version uses the seeded `hash1`).
