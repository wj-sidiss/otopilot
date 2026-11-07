# Your own music: songs, tracks and music videos

When the user brings the music (a song, a licensed track, their own composition), the picture follows the music's grid instead of the kit writing a score. Both modes; the sound answer is "own" with a file.

## 0. Order and what the song answers

The mode and purpose questions come first (one call; the purpose is ★ Cinematic for a music video, Ad & product only for a promo of the song or the artist). Then set the film up (`init_film.py`, so the tools are in `tools/`) and measure the song (§1). The song answers the sound question and, when the whole clip is used, the length; the idea, the style and the format are still asked (Quick: the remaining questions of `quick-mode.md` §1; Film: the interview without the music question).

## 1. Lock the grid
1. Ask for the file, and for a song with words the lyric timings: an `.lrc` file, or the time each line starts. Never guess line timings by feel; pop lines are often only 2–3 s long. **No timings?** Ask for the lyrics as text, one sung line per line, and take the times from the song itself: `python3 tools/lyrics_align.py cmd song.mp3 --lang <language>` prints the Whisper command (installed only with the user's OK), then `lyrics_align.py align lyrics.txt song.json --json audio/lyrics.json --lrc audio/song.lrc` puts the user's words on Whisper's clock (the user's text is the truth; misheard words still land) and writes the `.lrc` for step 2 and every word's time for karaoke type; lines it marks "check by ear" are played to the user before the cut. Without Whisper, cut the picture on the sections and bars only and put no word on screen.
2. Measure: `python3 tools/beat_grid.py song.mp3 --json audio/beats.json` (add `--lrc song.lrc` for the lines, `--from/--to` for the part you will use). It prints the BPM (measured on the whole song, so an intro in a dotted figure does not fool it), the first downbeat and the bar times, and each lyric line's bar, beat and film time (the time inside `audio/music.wav` as cut by the printed command). For a ballad the half-time pulse often reads better.
3. **Cut the clip on a bar line**, one or two bars before the first line you use, and fade the end: the printed `ffmpeg` command writes `audio/music.wav`. Film time 0 is then a downbeat (`BEAT0 = 0`).
4. A low downbeat confidence (under 1.15x) means the bar line is a guess: check it against the lyric lines (they usually start a fraction of a beat before a bar) or ask the user to confirm the first bar by ear.
5. One `LICENSES.csv` row for the music (the user's own, or the licence they hold). A commercial song on a social platform may be muted or claimed there; say so once, plainly.

## 2. Quick mode

- In `film.html`: `BPM` from the grid, `BEAT0 = 0`, `OWN_MUSIC = { file: 'audio/music.wav', gain: 0.8 }`. `score()` is skipped; ambience, `SFX` and the `ROOM` stay. The music runs through the same bus, so it ducks under narration and plays in the browser preview.
- `CUES` on `bar(n)` and `beat(n)`; scene boundaries on bar lines, hits on the beats the music already accents. Do not stack a synthetic kick on top of the song's.
- Sound effects stay sparse: the song already fills the spectrum. Picture-locked foley and a few accents, under the music.

## 3. Shaping a music video

- **One idea for the whole video**, one paragraph, before any shot: what world, what changes, how it ends.
- **Chapters are the song's sections** (intro, verse, chorus, bridge, outro). Each gets one setting and a small palette of its own inside the film's look.
- **A thread that ties it together:** a recurring set, a motif that changes, a palette arc or one rule for transitions.
- **One visual per lyric line**, 1.5–4 s; the shot table gets a lyric column and an **Out** column naming how each shot leaves. When an idea needs more time than its line, carry it into the next line instead of slowing the song.
- **Act the lyric, do not write it.** Each line becomes an action that shows its meaning; no signs or captions repeating the words (on-screen lyrics, if wanted, are a separate typographic layer).
- A handful of big sound moments across the whole video; the song does the rest.

## 4. Long videos

Chapters follow `quick-mode.md` §7 (one file, one function per scene, `chapter` on each scene) or Film mode (one shot list grouped by section). Write each chapter's beat times as a comment at its top (`// bar(8) = 15.74 s · bar(12) = 23.61 s`) so hits land exactly. In Film mode, chapters can go to parallel helpers with the same brief (`context-protocol.md`), after one chapter is finished as the reference; the seams between chapters are checked together at the end.

Method and lessons after [tuzhechen2005/opus-video-skills](https://github.com/tuzhechen2005/opus-video-skills) (MIT), which credits John Heibel's ClaudeAnimationBase and P(doom) video.
