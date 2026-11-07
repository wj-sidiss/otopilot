# Shots, editing and text on screen

## 0. Scale with the length

Every count in the kit follows the film's length; nothing is fixed at the 30-second size. One table, used by both modes:

| Length | Shots or beats | Chapters (internal) | Key elements to research | Open references (research board) | Film stills after the direction pick (Film mode) |
|---|---|---|---|---|---|
| 15–30 s | 4–8 | none | 2–3 | 5–8, one board | 3 (the picked row) |
| ~60 s | 5–15 | 2–3 | 3–5 | 8–12, one board | 3 + 2 per chapter |
| 1–3 min | 5–45 | 4–8 of 15–30 s | 2 per chapter | 3–4 per chapter (12–30), one board per chapter | 3 + 2–3 per chapter |
| 3–8 min (Film mode) | 15–120 | 8–20, grouped in 3–5 acts | 2 per chapter | 3–4 per chapter (30–70), one board per act | 2–3 per chapter, measured per act |

- **Shots = runtime ÷ the average shot length**, chosen from the film's tempo: energetic about 4 s (8 min ≈ 120 shots), standard about 6 s (≈ 80), contemplative 8–12 s (≈ 40–60). The ranges in the table run from 12 s down to 4 s; state the chosen average in the roadmap. A long film breathes: its average can sit longer than a 30-second piece's, with faster stretches where the story runs.
- **The direction board stays three rows** at any length: it chooses one visual language for the whole film, so it never grows; what grows is the coverage after the pick (per chapter, per act).
- **Cost stays flat per decision:** boards are made per chapter or act, each at most 12 thumbnails; only one-line summaries are read, and the user sees the board of the chapter under discussion. A long film spends more references, never a bigger context.
- Over 3 minutes is Film mode (Quick mode tops out at about 3 minutes, `quick-mode.md` §7).

## 1. Shots

- **Shots by length** (§0; 4–8 for 15–30 s). Each shot has one job (a read) and one action: its subject does something, written in the shot's `action`. Camera motion alone is not a scene; the camera moves with the action. `qc.py action <video> <boundaries>` flags a shot whose frames barely change once the camera move is removed.
- **One important read at a time.** Give each read time: ≥ 0.5 s for a simple shape, 1.5–3 s for something new.
- **A fresh framing at every cut:** change size (wide / medium / close), angle or lens. Repeat a framing only on purpose (a motif, `"motif": true`).
- **Lenses:** 18–24 mm for space and scale, 35–50 mm for natural scenes, 85 mm+ for isolation and compression. Keep a small set (2–3) per film.
- **Camera line per shot:** name, seconds, speed easing, target ("dolly in, 3 s, slow ease-in-out, toward the figure"); names, feelings and defaults in `camera-moves.md`.
- **Moves are already moving on frame 0** of a shot and still moving at the cut, unless the stillness is the point. Real 3D moves (dolly, crane, orbit) give parallax; zooms flatten.
- **Light motivates attention:** the brightest, sharpest, most saturated area is where the eye goes; put the read there.

## 2. The hook (hard rule)

The first 2 seconds move from frame 1 and lead with an action: the subject does something on frame 1 and the camera moves with it. Open on the motion itself; titles, logos and fades come after it (or never). Sound starts with the picture.

Check it: `python3 tools/qc.py hook <video>` (motion energy of 0–2 s; default threshold 0.5, a deliberately quiet long-form open chosen by the user: 0.1) and look at the strip `python3 tools/qc.py strip <video> 0 2 12` so grain is not mistaken for motion. Run it on rendered picture (rough clips or the final); an animatic made only of still cards fails it by design.

## 3. Rhythm

| Format | Typical shot length |
|---|---|
| 9:16 social, 15–30 s | 4–8 shots (§0); something new every 2–3 s |
| 16:9 cinematic, 60–120 s | 3–8 s; longer holds where the image keeps revealing |

- **Cut on action** (a motion that starts in one shot finishes in the next) or on a sound.
- **The ending keeps its own seconds** after the last line (`writing.md` §15).
- **Cut picture to sound:** lock narration and music timing first (temp VO is fine), then cut.

**Long films may show their chapters** (5 minutes and up: YouTube documentaries, explainers, video essays), when the form uses them (many strong documentaries flow without a card; the niche's reference decides, `writing.md` §13). Then the arc stays one and the viewer gets signposts: at each act or chapter boundary a **chapter card** of 2–3 s (a number and a short title in the film's display type, a palette tint of its own, motion in and out, a sound sting or a hit in the score), never a silent black still. The card restates the open question in a new form or names what this chapter answers, so it re-hooks. List the same chapters with timestamps in the video description (YouTube chapters). Short films (up to about 3 minutes) keep chapters invisible.

**Beat types.** Each beat in the beat table (Quick) or the roadmap (Film) gets one type; the type sets its pace, cuts and sound level. The order varies from film to film; the types and their pace recur. After cth9191/animate (MIT), measured on its pieces.

| Type | What it does | Pace | Cuts per second | Sound | Length |
|---|---|---|---|---|---|
| start | the subject at rest, the world before | hold | 0 | quiet | 1–1.5 s |
| build | one framing; detail gathers | hold, small moves | 0–1 | rising | 3–6 s |
| change | the subject's form or state changes | steps on the eighth notes | 1–5 | a hit on the change | 2–3 s |
| travel | getting there | one continuous camera move | steps of that move | a building pad or groove | 2–4 s |
| journey | many places, the world | steps, then a montage that speeds up on the grid | 3–8 | a flat groove | 5–9 s |
| turn | it could go wrong, or everything gathers | builds slowly, then changes in 1–3 frames | 0 → 2 | a drop, then the loudest hit | 1–3 s |
| quiet | alone, still | hold | 0 | the lowest | 1–1.5 s |
| connection | the subject meets what it was for | held, slow movement | 0–1 | warm, swelling | 3–7 s |
| time passes | later | a flicker on twos, or the light changes on one framing | steps | no onsets | about 1 s |
| ending | the title, the last image, the loop back | held | 0 | fading or held | 2–4 s |

- **The loudest hit marks a turn,** not the connection.
- **Fast is mostly steps of one move, not many shots:** a "quick cut" run is often one camera move stepped on twos.
- **Every cut has a reason you could say out loud:** the next step of a process · the subject holds its place while the world changes · this becomes that (shape morph) · into or out of the subject (iris) · inside it or everything around it (the same subject 5–20× bigger or smaller) · what the subject sees · this caused that · later (a time cut) · back to an earlier image, changed (a callback). A cut with no reason is the one to remove.
- **Measured:** `validate_shots.py` warns when shot lengths are too even (spread under 0.30), when five or more shots in a row run about the same length, and when every act or chapter keeps one pace.

## 4. On-screen text

- ≤ 6 words per card; on screen ≥ 0.6 s + 0.25 s per word; 1–3 cards in a short ad or mood piece; a film that informs (a documentary, an explainer, a film without a narrator) carries words and graphics wherever they tell (`motion-design.md`).
- Set in the film's TYPE roles (`typography.md`: pairing, scale, phone minimums, tracking, Turkish casing); placed where the composition leaves room.
- Draw it in the engine (`OVERLAY` in `engine/scene.html`, `drawOverlay` in `looks.mjs`), so it is part of the deterministic frame.
- **9:16 safe areas** (1080×1920): keep text and key action out of the top 12 % (230 px), the bottom 20 % (384 px) and the right 10 % (108 px); platform buttons and captions sit there. 1:1 and 4:5 keep a 6 % margin, 16:9 a 5 % margin (`purpose-ad.md`).
- **Identity on screen.** In a place, product, brand or promo piece, name the key elements on screen when identity matters (the landmark, the product, the maker, the street): short labels or lower thirds in the film's typeface, held long enough to read. They complete the specificity test (`writing.md` §12): the picture shows what only this subject has, the label makes sure the viewer knows whose it is.
- **Headroom for every letter.** A text box or plate is sized from the font's ascent and descent and the string's own ink, plus padding, never from the font size alone; test new type and every box with `İĞÜŞÖÇ ÉÅ Ñ` so dots, breves, cedillas and rings stay inside (`label()` in the Quick mode starter does this).

## 5. Subtitles (only when the user asks)

- At most **two languages**, stacked: primary on top, the second smaller, italic and slightly dimmer below.
- In a safe area: above the bottom UI zone in 9:16; in the lower band in 16:9.
- ≤ 42 characters per row, ≤ 17 characters per second in the primary language.
- Timed from the narration itself, never from script estimates: one subtitle per `VO` line at its measured `at` and `dur` (`film.html` `VO` table or `shots.json`), split at a pause when a line is long. No extra tool is needed; word-level timing (the kinetic captions below) is the only part that needs Whisper, installed only with the user's OK.
- Draw them in the engine (`{ t: [a, b], sub: ['primary', 'second'] }` in `OVERLAY`) and also write one `.srt` per language for upload.
- Do not subtitle design sounds (reversed whispers, distant echoes).

## 6. Animatic

A timed video at low resolution from the same `shots.json` as the final: grey cards, stills or rough renders, the real on-screen text and narration line per shot, temp sound, real cut points.

```bash
python3 tools/animatic.py shots.json --out renders/animatic-v1.mp4 [--stills review/stills] [--clips renders/rough] [--vo audio/temp_vo.wav]
```

Ask the user one question: "Is the pacing right? Any shot too long or too short?"

## 7. Platforms

| Platform | Format | Notes |
|---|---|---|
| Reels / Shorts / TikTok | 1080×1920, 9:16, 24–30 fps | hook in 2 s, works muted, safe areas |
| YouTube | 1920×1080 or 3840×2160, 16:9 | longer holds possible; a thumbnail-worthy poster frame |
| Feed post | 1080×1080 (1:1) or 1080×1350 (4:5) | centre-weighted composition |

**The cover on X, Slack and Discord.** These show the first frame as the thumbnail and ignore an uploaded cover; frame 0 moves (the hook rule), so it may be a blur. Quick mode: `make.py final` writes it when STATE.md's **Delivered to:** names X, Slack or Discord. Film mode: write a second file whose frame 0 is the poster (the frame `make.py` picked) and keep the main file as it is:

```
ffmpeg -i "<Title>.mp4" -i review/qc-film-vN/thumb-<…>-768.jpg -filter_complex "[1:v][0:v]scale2ref[p][v];[v][p]overlay=0:0:enable='eq(n,0)'" -c:a copy -pix_fmt yuv420p "<Title>-x.mp4"
```

## 8. Software on screen: UI hero shots

When the subject is an app, a website or a tool, film the interface the way a camera would film a product, not as a flat screen recording.

- **Story first:** the 4–7 things that happen on screen in order, the one payoff where the product visibly does something remarkable, believable demo content (real-looking names, numbers and text; sparse grey placeholders read as a mockup), and one line of copy at the end.
- **The UI is a lit object in a dark space.** Put the real interface (a high-resolution capture, rendered at the magnification the shot needs so text stays sharp) on one plane, tilted back 30–50°, rotated 10–20° in-plane so lines of text run diagonally, with a little yaw. Near text ends up about 1.5× the size of far text. Flip the diagonal at every cut. Keep a quarter of the frame or more near black.
- **Scale rhythm:** extreme close-ups (one button, one tab) and close-ups (a line of typing, a few rows) carry the film; medium shots carry longer processes; save the one near-frontal wide shot of the whole window for the payoff, then return to a close-up.
- **Shot length follows the action:** process shots (typing, an answer streaming in, a document writing itself) 5–9 s, accents (a tab, a press) 2–3.5 s, alternating. The action starts within 0.3–0.8 s of the cut, the result holds 0.5–1 s, and the cut comes while the camera still drifts.
- **Focus does the pointing.** Depth of field follows depth on the tilted plane, so only a band one to four lines deep is sharp (`plane()` with `rackFocus` in Quick mode; the depth-of-field effect in Film mode). Rack the focus when attention moves (0.4–0.8 s).
- **Light follows the subject, a beat late.** A soft, neutral pool lies on the UI plane, longer along the line of action, its hot spot nudged toward one side; it trails the subject by about 0.3–0.5 s (an average of the subject's recent positions, so it stays a pure function of time), and opens wider for the payoff. No sweeping sheens, no coloured light: the only colour is the product's own.
- **The UI acts on its own.** No pointer travelling between targets: the tab's highlight slides over, the button shows its pressed state, text types at 12–13 characters per second, generated text resolves line by line about 0.1 s apart. Hard cuts between UI shots; no dissolves.
- **Quiet ending:** one line of copy un-blurs on black, then the still logo holds 2.5–4 s (the end card, `purpose-ad.md`). No animated logo, no shake or flash at the payoff; the wide shot is the impact.
- **Sound:** close, tactile foley on every visible action (key ticks, soft clicks, a send whoosh, a faint texture under streaming text) over near-silence, or the film's music very low.
- **Check like a camera operator:** a still at the middle of every shot and at each action's peak: one sharp subject the eye finds in half a second, both near and far blur, readable text at half size, consecutive shots differing in scale or diagonal.
