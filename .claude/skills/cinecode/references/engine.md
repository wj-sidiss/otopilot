# Engine: render, encode, check

Every film frame is a **pure function of time**: `frame = f(t, seed)`. Any frame renders alone, out of order, in parallel, with identical pixels. The GPU in headless Chrome draws each frame; `capture.mjs` saves them; ffmpeg encodes.

## 1. The frame contract

An engine page (`engine/scene.html`, `engine/index.html` or the film's own) exposes:

```js
window.READY          // Promise<{ frames, fps, width, height, renderer }>, resolves after every asset and font loads
window.renderFrame(i) // draws frame i (t = i / fps); no state carried between frames
window.captureFrame(i, type, quality) // renderFrame(i), then returns a PNG/JPEG data URL
```

URL parameters: `w`, `h`, `seed`, `look`, and `capture=1` (added by capture.mjs: no preview loop).

Two starters:
- `engine/scene.html` + `engine/looks.mjs`: three.js scene, look presets, text/subtitle overlay (loads three.js and postprocessing from a pinned CDN).
- `engine/index.html`: one fragment shader, no libraries, works offline.

One page per shot or one page for the whole film (a `shot` URL parameter choosing the scene) both work.

## 2. Capture

```bash
node tools/capture.mjs --url engine/scene.html --probe                       # which GPU? (warns on software rendering)
node tools/capture.mjs --url engine/scene.html --verify                      # deterministic? must say IDENTICAL
node tools/capture.mjs --url engine/scene.html --out review/frames/S01 --start 0 --end 0 --params "w=960&h=540"   # one still
node tools/capture.mjs --url engine/scene.html --out frames/S01 --start 0 --end 71 --workers 2 --params "w=1080&h=1920&shot=S01"
```

- More options: `--frames "0,48,96"` (only these frames, for previews), `--video out.mp4` (pipe frames into ffmpeg with the encode settings of §3, no frame files), `--audio out.wav` (export the page's `window.renderAudio()` soundtrack as a 32-bit float WAV; Quick mode, `quick-mode.md` §4).
- Local capture resumes only when the page, parameters and contents of the local files loaded before `READY` match the saved capture. This includes imported modules, fonts and review stills in any folder, even when file dates are preserved. Output and status files do not invalidate an unchanged job. `--fresh` regenerates the requested frames explicitly; old unstamped frames are regenerated automatically. HTTP pages render afresh; use `--fresh` for local pages after unpinned remote assets change.
- `--workers` is a positive integer; `--start`, `--end` and every `--frames` entry are non-negative integers. Invalid ranges fail without clearing an existing frame folder. The page's `READY` metadata must provide positive integer `frames`, `width` and `height`, and a positive `fps`.
- **Long jobs run in the background with a status file** and the agent ends its turn instead of waiting: start the command with the shell tool's background option (`run_in_background`, the same in bash and PowerShell):
  ```
  node tools/capture.mjs --url engine/scene.html --out frames/S03 --start 192 --end 335 --workers 2 --status renders/S03.status.json
  ```
  Record the job in `STATE.md` (Running jobs). Next turn: read the status file (`state`, `done`, `total`, `eta_s`).
- One heavy render at a time on the machine; 2–3 workers inside it.
- Drafts: half size and `--format jpeg --quality 0.9`. Finals: full size PNG.

## 3. Encode

Per shot, then join without re-encoding (each command on one line, the same in bash and PowerShell):

```
ffmpeg -framerate 24 -start_number 0 -i "frames/S01/%06d.png" -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv" -c:v libx264 -preset slow -crf 17 -maxrate 10M -bufsize 20M -g 48 -movflags +faststart renders/S01-v1.mp4
ffmpeg -f concat -safe 0 -i renders/list-v1.txt -c copy renders/picture-v1.mp4
```

- `renders/list-v1.txt` holds one line per shot in order (`file 'S01-v1.mp4'`), written with the Write tool.

- `-start_number` is the first frame number in the folder (a shot captured from frame 192 starts at 192).
- With grain, add `-tune grain`; keep the `-maxrate 10M` ceiling (1080p24 for the web needs about 8–10 Mbit/s; grain at CRF 17 alone can pass 25 Mbit/s and every platform re-encodes). Drop the ceiling only for an archive master the user asks for.
- A changed shot is re-encoded alone; the others stay bit-identical.
- Then add sound with `master_audio.py` (`sound.md` §6).

**Disk:** a full-size PNG is 2–6 MB; 30 s at 24 fps ≈ 720 frames ≈ 1.5–4 GB. Check the free disk before a render (`df -h .`; Windows: `Get-PSDrive`), job size + 3 GB free. After a shot is encoded and checked (frame count, `qc.py dup`), its frame folder may be deleted to free disk. Versions follow one policy (`SKILL.md` Hard rules: versions without clutter): before the final, every draft the user saw is kept; after the user's OK on the final, the clean-up is asked once (`SKILL.md` Hard rules).

## 4. Checks (`tools/qc.py`)

```bash
python3 tools/qc.py hook  renders/film-v1.mp4           # HOOK RULE (hard): motion in the first 2 s
python3 tools/qc.py all   renders/film-v1.mp4           # info, hook, contact sheet, black, freeze, duplicates, brightness, cuts, loudness, spectrogram
python3 tools/qc.py sheet renders/film-v1.mp4 2 6       # contact sheet: one tile every 2 s
python3 tools/qc.py strip renders/film-v1.mp4 12.0 1.2 5   # motion strip of a key moment
python3 tools/qc.py phone renders/film-v1.mp4 0.5,1.5,10    # frames at 390 px wide (phone readability)
python3 tools/qc.py thumb review/style-v1.png 768        # small copy to look at
python3 tools/qc.py thumb review/style-v1.png 96         # squint test: values and composition at a glance
python3 tools/qc.py action renders/film-v1.mp4 0,3,7.5,12   # subject action per shot (shot boundaries in seconds)
python3 tools/qc.py sceneloud renders/film-v1.mp4 0,3,7.5,12  # loudness and 2-5 kHz harshness per shot
python3 tools/qc.py pops renders/film-v1.mp4            # one-frame flashes: a frame unlike both neighbours (also in all)
python3 tools/qc.py loop renders/film-v1.mp4            # looping films: the last frame must flow into the first
python3 tools/scene_check.py action renders/film-v1.mp4 --shots shots.json   # the same, boundaries from shots.json
```

**Per-shot checks** (`scene_check.py`): `action` samples 4 frames per second, removes the best global shift and scale between samples (pan, tilt, truck, dolly, zoom) on a centre-weighted crop, and flags a shot whose remaining change is tiny or under 30% of the total (the camera carries the shot; the subject barely acts). `sound` measures each shot's integrated loudness and its 2–5 kHz share and flags a shot more than 3 LU from the median shot or more than 3 dB harsher than the median: an integrated −14 LUFS can hide one scene that is much louder or brighter. Each flag is fixed or named as intentional; flagged seconds are where to look and listen.

**Silent one-sentence test** (after the first draft, where the tool has helpers): a fresh helper that has seen nothing of the project gets only the draft's small contact sheet and one line, "say what this film is about in one sentence". Its sentence is set beside the logline in `STATE.md`. If it misses the subject or the turn, too much moves or the key image is missing: fix that before any other note. Cheap (one sheet, one reply) and it catches what the maker can no longer see.

**Self-review, cold:** after making something, review it as if someone else made it: look only at the contact sheet, strips, phone frames and the numbers, against the approved style frame and the roadmap. Score each shot 0–2 on composition, light and colour, style match, motion and reads (10 points); 8 means "ready to show". Motion is judged on strips with the nine checks in `motion.md` §7; it scores 2 only when all of them pass. Always report the **3 weakest shots** with timestamps.

## 5. Final checklist

- [ ] Hook check PASS; the strip shows real motion from frame 1, led by an action
- [ ] Every shot has its subject's action (`qc.py action`: no flag left unexplained)
- [ ] Motion review passed on the strips of the key moves (`motion.md` §7): one lead per moment, no linear living motion, no pops, overlap, landings on the cues
- [ ] Every shot matches the approved style frame (≥ 8/10 by the cold review); the subject reads at a glance
- [ ] Frame count = expected; no black, frozen (unless intended) or duplicate frames
- [ ] Key shapes and text readable at 390 px wide; text inside the safe areas
- [ ] −14 LUFS ±1, true peak ≤ −1 dBTP, measured on the final MP4; per shot within 3 LU of the median and no harshness outlier (`qc.py sceneloud`), or the exception named
- [ ] The delivery message says the sound was measured, not heard, and asks the user to listen at the named seconds
- [ ] H.264 yuv420p, BT.709 tags, AAC 48 kHz, faststart (`qc.py info`)
- [ ] Every external file has a row in `LICENSES.csv`; credits ready for the description
- [ ] A muted viewer can say what happened in one sentence

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `no Chrome/Chromium found` | set `CHROME_PATH=/path/to/chrome` |
| `--probe` says SwiftShader / llvmpipe | no GPU in headless mode: on Linux try `--flags "--use-angle=vulkan --enable-features=Vulkan"`; on Windows set Chrome to "High performance" in the graphics settings; or render on another machine |
| `page never defined window.READY` with an error, or `the page threw while loading` | a script or shader error, with its file and line: fix that line |
| `SyntaxError: Unary operator used immediately before exponentiation` | JavaScript refuses `-x ** 2`: write `-(x ** 2)` or `x * x` |
| module or texture fails on `file://` | serve the folder: `python3 -m http.server 8000`, then `--url http://localhost:8000/engine/scene.html` |
| `--verify` says DIFFERENT | wall-clock time, `Math.random`, state carried between frames, assets loading late |
| `READY` fails with "Cannot access 'SEED' before initialization", or seeded data comes out the same for every seed | seeded data built at the top level before `SEED` is set: build it lazily on first use (`lazy()`, `looks.md` §7) |
| diacritics or descenders cut off in a text box | size the box from the font's ascent and descent plus padding (`label()`); test with `İĞÜŞÖÇ ÉÅ Ñ` |
| black frames | draw and read in the same call; `preserveDrawingBuffer: true` |
| one object or a whole shader pass renders black | a NaN in the shader: GLSL `pow(x, y)` with `x < 0` (and `sqrt`, `log` of a negative) is undefined: `pow(max(x, 0.0), y)`, `x * x` |
| GLSL syntax error on a name | reserved word (`flat`, `sample`, `input`, `output`, `filter`): rename |
| `height not divisible by 2` | render even sizes |
| macOS long render sleeps | `caffeinate -dimsu &` during the job |
| Windows: `python3` not found | `py -3` (python.org's launcher) or `python`; every tool, `qc.py` included, runs on Windows Python and Node, no bash |
