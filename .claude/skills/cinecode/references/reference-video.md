# A reference video: "make it like this, but change …"

The user shows a video they like and says what to change. The kit measures the video's **form** (length, rhythm, look, sound), the user changes what they want, and the film is built new on that form. Both modes.

## 1. Get the file

- Ask for the file in `refs/` (their own export, a download they already have, or a screen recording). A link is not downloaded by the kit: no browser automation and no new tools without the user's OK.
- The reference is studied, never reused: its frames, music, shots, characters, logos and words never enter the film. A copyrighted reference is fine for this; say so once if the user worries.

## 2. Measure it

```bash
python3 tools/ref_video.py analyze refs/<video> --out research/ref-video
```

It prints four lines (format · rhythm with the shot count, the average shot length and the tempo word · look words and palette · sound: BPM, loudness and how many cuts land on a beat) and writes `research/ref-video/REFERENCE.md`, `reference.json` (with a look patch, as `direction.py measure` makes), `sheet.jpg` (a frame per shot, in order) and the frames in the direction board's format. Look at the sheet once and fill the five "Read from the sheet" lines: camera character, transitions, type on screen, hook, ending. A video with soft dissolves may need `--threshold 0.2`.

## 3. Ask what changes (one round)

Show the sheet and the measured form in one message, then one question: "Neyi değiştirelim? / What should change?" with the most likely three (★ none), multi-select, and "Other" for the user's own words, for example: the idea and subject (always new) · the look (colour, light, style) · the tempo · the sound or music · the length or format. Write the user's words into the "Changes the user asked for" block of `REFERENCE.md`; each one overrides its line.

The idea is never taken from the reference: if the user did not give one, ask for it (or offer 2-3 interpretations of the reference's form for a new subject).

## 4. Build on the form

- **Quick mode:** skip the questions the reference already answers (length and format, style, sound) unless changed. The director card shows every kept line as "ref: …" (tempo from its average shot length, palette and light from its look patch, BPM, the transition kinds), each still changeable in plain words. The beat table follows its rhythm: the same number of beats for the same length, the same hook kind and ending kind, new content.
- **Film mode:** the reference is a row of the direction board (`direction.py board --row "R|<label>|<nearest style>|research/ref-video" --row "A|…" --row "B|…"`), next to two alternatives; picking R uses its measured look patch at the style frame (`looks.md` §10), and its rhythm sets the roadmap's average shot length.
- **Music:** a reference with a song keeps its BPM and cut rhythm, not the song: the music is the kit's score in that tempo, the user's own track (`music-video.md`), or a CC track (`asset_search.py search --type music`).
- **Unchanged is not copied:** the same rhythm and palette, never the same shots. The template check applies: could a frame be mistaken for the reference's own? If yes, it is redone.

A saved format (`formats.py`) and a reference are the same idea from two sides: a format is the user's own film's form, a reference is someone else's.
