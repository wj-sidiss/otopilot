# Sound

Half of "cinematic" is sound. The craft below stays the same from film to film; the **palette** comes from the film's **sound identity**, chosen in the interview (Q5). Every number is a starting point: tune by ear and by measurement.

Tools: ffmpeg (generation, effects, mixing), `tools/mix.py` (layers → one WAV), `tools/master_audio.py` (−14 LUFS), `tools/qc.py loud` and `spec` (measure). Recordings come from open sources with a licence row (`assets-and-licences.md`).

## 0. Master principles

Read these before any sound work; the sections below are the means.

**The voice leads.**
1. Clarity first, atmosphere around it: the narrator dry and close (compression, a gentle presence lift near 3 kHz); room, choir and texture sit beside the voice, never on it. While a line plays the voice stays 8–10 dB above everything else: measured, not guessed.
2. Duck by density: a short line gets a deep duck; a stretch that is mostly talk gets a shallow one (about 6 dB) or only the speech band (1–4 kHz) carved, or the music lies buried for minutes. Layers that must keep sounding under the words bypass the duck.
3. The voice is chosen by ear, by the user: a native speaker of the language (or a designed voice), 2–3 candidates reading the same line as separate short files. The delivery follows this film's voice line on the card; a whisper only on chosen lines. Raw TTS never ships (§4b).
4. Vary the reading: emotion per line and different endings (a question, a line left open, a breath); lines that all end on one falling tone tire the most. Let lines run across cuts (J-cuts); keep the ending's timing elastic, since slower readings push fixed title times.

**Sound carries the structure.**
5. Time the narration first, then place hits from the line timings: before a line, after it, or on its meaningful word, never at fixed seconds.
6. Music runs as one continuous piece per section; it never stops abruptly: short crossfades, fades tied to picture transitions.
7. A motif changes each time it returns (sparse, falling, rising); a long talk-heavy stretch gets an ostinato that grows; one diegetic signature sound can be the score's spine and answer a line.
8. Silence is an event, not a gap: something ends it (quickening hits, a last hit, a tail), then a faint room tone; the reverb returns go quiet with it; never digital zero. A hard silence reads as a fault.
9. Chapters carry a sound signature (a rise, a hit, a shimmer); the hook's hit lands on the same frame as its picture.
10. Hits sit 6–8 dB above the section's loudest bed, not 15.

**Truth.**
11. **Recorded first:** every physical event (water, birds, stone, steps, wind, engines, cloth, glass) takes a recording from the first draft on; code makes only what follows the motion or the score (risers, whooshes, tonal hits). `make.py` holds a draft whose event sounds are mostly made in code. Real before cinematic: an instrument, a ritual, a place is researched for how it really sounds; cinematic exaggeration (sub boom, long tails) is a choice the user makes. Layer real open recordings (texture), generated events and synthesis (glue); synthesis alone sounds thin. Each recording's origin (culture, ritual, place) goes into `LICENSES.csv`; a recording from the wrong culture is removed.
12. Generators get physical descriptions (material, how it is played, what rattles, the recording: close, dry, field, no sub), and their files are measured before they are judged (they often arrive quiet).
13. Ambience follows the scene's kind (inside or outside, the place), tagged per scene, never fixed times; picture-locked foley (every small contact and movement the picture shows) is cheap and brings the picture to life.

**Measured, not heard.**
14. Every sound note becomes a second, a layer and a measurable target ("kısık" → +4 dB at 0:12–0:18 against the bed).
15. Map loudness per section and in 4 s windows, the score alone and the mix (`qc.py sceneloud`); check the last 15 s; a spectrogram before and after each sound revision (`qc.py spec`).
16. Sound-only revisions never re-render the picture (`make.py draft --sound-only` or `make.py final --sound-only`; video and subtitles are copied). Masters aim below the delivery ceiling because AAC raises true peak (`master_audio.py` does this with `--video`).
17. Generated speech is checked: with a local speech-to-text tool when the user has one (installing it needs their OK), pauses measured on the raw takes, not on reverb-treated ones.
18. Every shot answers "where are we?" in sound: each place gets its own bed. Silences are marked on purpose in the beat table; everywhere else is full, never a bare narrator over nothing.
19. Sound respects its subject: no spectacle (explosions, risers, whooshes) over civilians, victims or grief; room tone or silence carries those images.
20. Key moments get their own sound moment (`writing.md` §15): the bed drops away, one low hit or a single held note, then a tail.

## 1. Sound identity (light)

**Film mode:** before building, propose **three one-line sound concepts tailored to the idea**; the user picks or edits one. **Quick mode:** one identity line on the director card, chosen from the idea and changeable in plain words (no separate question). Each concept names, in one line: the core idea, the palette, one signature sound. Make the three differ in at least two of: source family (recorded / synthesised / instruments / voice), music yes or no, whose ears we hear through, how silence is used. Write each from the story's own material (its objects, its place, its physics), so it could not be pasted onto another film.

After the pick, expand it in `ROADMAP.md` §4: palette, signature sound and when it returns, where the silence is, voice, music.

## 2. Principles

1. **Every sound comes from the picture,** in frame or just outside it. Generic cues with no source (heartbeats, risers, stingers) stay out.
2. **The hook sounds from frame 1.** No silent opening; the first sound is born with the first motion.
3. **Silence before the biggest moment.** Drop the room 0.3–1.5 s before the peak (shorter in 9:16), then let the peak be the loudest moment.
4. **Big things sound big:** mass and long tails for scale; quiet moments get one precise detail.
5. **Transitions breathe with the picture:** build them from the picture's own motion (wind that brightens as the camera falls) rather than stock whooshes.
6. **Keep design layers unpitched** unless the identity has music; pitched drones quickly turn a scene "musical".
7. **Seed every generated layer** separately, so changing one leaves the others identical.
8. **Sound design from version 1,** in both modes: every version the user sees has an ambience bed per scene, effects locked to the picture's events, and one shared reverb space that places them all in the same world. Music alone is a draft, never a version.
9. **Leads stay easy on the ear.** Harsh synthetic winds and brass and bright raw saw or square leads fatigue the ear within seconds. Prefer plucked or percussive timbres for melodic leads, or soften the lead: low-pass at 2–3 kHz, a gentle attack (≥ 20 ms), less resonance. Check the 2–5 kHz share per scene (`qc.py sceneloud`).
10. **Sync the sound's peak, not its start.** An impact's transient sits on the picture's contact frame; a sample with a soft attack starts early by its attack time, so its peak lands on the cue. A whoosh peaks 2–3 frames before the move it carries arrives, a riser ends on the cue, a click lands on the press frame. With music, pick a tempo whose beat is a whole number of frames (`fps × 60 / BPM`): at 24 fps 80, 90, 96, 120 or 144 BPM (18, 16, 15, 12, 10 frames); at 30 fps 90, 100, 120 or 112.5 BPM (20, 18, 15, 16 frames). Every cue on the beat grid then falls exactly on a frame.

## 3. Layers

| # | Layer | Job | Level (relative to voice) |
|---|---|---|---|
| 1 | Space bed (room tone) | where are we? crosses cuts; changes when the space changes | −20 to −30 dB |
| 2 | Low body + harmonics | weight and scale; audible on phones through 70–250 Hz harmonics | drops before big moments |
| 3 | Textures | the space is alive: sparse seeded events (drips, crackles, leaves) | −30 to −40 dB |
| 4 | Foley | contacts locked to the picture's contact frames | by distance |
| 5 | Hero events | the story's big moments | loudest (momentary ≈ −10 LUFS) |
| 6 | Voice (if any) | the story; everything makes room for it | 0 dB |
| 7 | Signature / motif | the identity's recurring sound | as the identity says |
| 8 | Music (if any) | its own bus | −4 dB bus |

`mix.py` adds bus offsets: dialogue 0, foley −1, sfx −2, ambience −3, music −4 dB.

**Arrangement table (music).** Before rendering any music, write a table of sections × instruments or tracks (who plays where) and read it once against the timeline:

| Section | Time | Pad | Bass | Lead | Drums | Signature |
|---|---|---|---|---|---|---|
| intro | 0:00–0:08 | ● | | | | ● |
| build | 0:08–0:20 | ● | ● | | ● | |
| peak | 0:20–0:26 | ● | ● | ● | ● | ● |

Check it for overlaps and double layers: a sustained part runs once across neighbouring sections instead of restarting at each line; a looped part ends where its next section starts (half-open), so the boundary beat plays once; two parts never share a role and register in one section. In Quick mode the table is `ARRANGEMENT` in `film.html` (`checkArrangement()` runs before every render); in Film mode it sits in `ROADMAP.md` §4.

## 4. Recipes with ffmpeg (tested)

```
# Space bed: seeded pink noise, band-limited, a short room echo (change seed per space)
ffmpeg -f lavfi -i "anoisesrc=color=pink:seed=5:amplitude=0.3:duration=30" -af "highpass=f=200,lowpass=f=3000,aecho=0.8:0.7:40|90:0.3|0.2" audio/bed-room.wav

# Low body: unpitched noise 22-90 Hz plus its own 70-250 Hz harmonics (what phone speakers can play)
ffmpeg -f lavfi -i "anoisesrc=color=brown:seed=21:amplitude=0.6:duration=30" -af "highpass=f=22,lowpass=f=90,asplit[a][b];[b]volume=6,asoftclip=type=tanh,highpass=f=70,lowpass=f=250,volume=-8dB[h];[a][h]amix=inputs=2:normalize=0" audio/lowbody.wav

# A falling mass hit (75 -> 36 Hz sweep with a fast decay)
ffmpeg -f lavfi -i "aevalsrc='0.4*sin(2*PI*(75-39*t)*t)*exp(-6*t)':d=1:s=48000" audio/hit.wav

# Scale a real recording: slow it down (0.5x = one octave lower, bigger)
ffmpeg -i assets/sound/creak.ogg -af "aresample=48000,asetrate=48000*0.5,aresample=48000" audio/creak-big.wav

# Narration chain: high-pass, presence, gentle compression (voice_treat.py's clean stage does this and more)
ffmpeg -i audio/vo/VO1.wav -af "highpass=f=90,equalizer=f=300:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1:g=2,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=150:makeup=3dB" audio/vo/VO1-eq.wav

# Duck the bed under the voice (sidechain), keeping the voice in the result
ffmpeg -i audio/bed-room.wav -i audio/vo/VO1-eq.wav -filter_complex "[1]apad[v];[v]asplit[vk][vm];[0][vk]sidechaincompress=threshold=0.03:ratio=8:attack=30:release=600[d];[d][vm]amix=inputs=2:normalize=0:duration=first" audio/bed-ducked.wav
```

## 4b. The film's own voice (narration is never the raw TTS)

A synthetic voice straight from the engine sounds raw and belongs to no film. Every narrated film designs its own voice, the way it designs its signature sound, and no treatment is the default.

0. **The voice, chosen by ear:** one line of the script read by 2–3 candidate voices (native speakers of the language), each its own short file: `python3 tools/tts.py --audition "gemini:Charon,gemini:Kore,elevenlabs:<id>" --text "<one line>" --style "<delivery>" --out review/voices`. Send them to the user one by one, numbered, and ask which; never a joined compilation. The treatment (Film mode always; Quick mode when the user asks, else the card's treatment line the user approved) is chosen the same way: `python3 tools/voice_treat.py audition review/voices/<picked>.wav --pairs "close/room,radio/dry,tape/hall"`, one file per treatment.
1. **Ask the story** who speaks, from where and to whom: a memory, a broadcast, an inner voice, a myth, a machine, a crowd. That answer picks the **medium** (what the voice comes through) and the **space** (where it stands): `python3 tools/voice_treat.py list`.
2. **Treat every line:** `python3 tools/voice_treat.py apply audio/vo/*.wav --medium <medium> --space <space> --out audio/vo-t` (clean stage always: high-pass, de-ess, presence, gentle compression; then the medium, then the space; every line lands at the same dialogue level). The mix uses `audio/vo-t/`.
3. **Make it this film's own** with one idea that could only belong here, for example:
   - **imprint:** the voice convolved with a slice of the film's signature sound (`--imprint audio/sig.wav --imprint-mix 0.2`): the voice carries a trace of the film's own sound;
   - **a voice event:** the treatment changes once, on the turn (the radio clears when the truth arrives; the chorus thins to one voice; the room disappears and the voice goes dry and close);
   - **a layer made from the voice itself,** only when the story is about it: reversed whispers for a secret or a myth (recipe below), a delayed second voice for a divided mind, the last word left ringing in the space.
4. **Performance matches the treatment:** the TTS style prompt carries pace, distance and breath ("speak close and slow, almost to yourself"; "announce it, clipped, as if through a speaker"); the post only finishes what the performance began.
5. **State it** on the director card or roadmap in one line: "Dış ses / Voice: <medium> in <space> (+ <imprint>), because <a reason from this story>" and name the voice in the listening note.

**Layers made from the voice** (only when the story asks for them):

```bash
# Reversed whispers: the narrator's own line, reversed, band-limited, distant (in gaps between lines only)
ffmpeg -i audio/vo/VO1.wav -af "areverse,highpass=f=300,lowpass=f=3000,afade=t=in:d=0.4,areverse,afade=t=in:d=0.4,aecho=0.8:0.9:120|260:0.4|0.3,volume=-24dB" audio/whisper1.wav

# Uncanny voice chain: slightly lower pitch at the same speed, chorus, trimmed band
ffmpeg -i audio/vo/VO1.wav -af "aresample=48000,asetrate=48000*0.84,aresample=48000,atempo=1/0.84,chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3,highpass=f=120,lowpass=f=6000" audio/vo/VO1-uncanny.wav
```

## 5. Transitions

**What the picture does, the sound does** (this is not the accent budget below). Every physical event on screen gets its own synced sound: a cup set down, a key turned, a door, a page, a step, a car boot, a glass set down. A film with action in the picture and silence under it reads as unfinished. The budget below limits *designed* sounds (whooshes, risers, hits on cuts), never these.
- **Impacts are layered**, each layer its own file, peaks aligned on the contact frame: transient (the crack, 0–20 ms) · body (the object's own sound, from a real recording) · room (the space it happens in: the shared ROOM or a recorded reflection) · tail (the decay, 0.5–3 s; outdoors longer) · sub (a 40–80 Hz thump for weight, only on the heaviest). An iron gate slammed shut is all five; a cup set on a table is transient, body and a small room; a door is body and room.
- **The picture-event audit, before the draft:** go through the shot list's action column and the stills and list every on-screen event in `review/sound-audit.md` (time · event · its sound · layers); none is left silent unless the silence is a choice written there. The draft report states the coverage ("events 42 · sounded 41 · silent by choice 1").

**Where each sound comes from.** A sound that should be real or sound designed comes ready, never synthesised:
- **Designed and short** (a word that slams, a click, a pop, a toggle, a shutter, a knock, glass, metal, a plate, a
  footstep, a page, a door, cloth, cards, coins, dice): `python3 tools/sounds.py search "<material and action>"`, then
  `get <id>` (Kenney's CC0 packs, cached for every film; vary the take when the event repeats).
- **Recorded and long** (rain, a room, a street, a crowd, a machine running, paper handled, water): `asset_search.py
  search --q "<what and where>" --type sound`, fetched once into the shared cache.
- **Code** only where a ready sound cannot follow the picture: a sound shaped by the motion as it happens (a tone that
  rises as a line draws, a sweep that follows the camera), a whoosh or riser timed to land exactly on the cut, a ping
  or chime in the score's key, an abstract sound with no real counterpart (data, a hologram), a film synthetic by
  choice (8-bit, retro game), and the sub under a recorded impact. Layering is the strongest: a recorded body with a
  code sub and a code riser timed to the frame.
- Both libraries remember what each film used; a search lists what your last films used after the rest, marked:
  choose by the event, not by habit.

**Accents, not a sound per cut** (measured on professional launch films: their designed sounds sit on the moments that carry meaning, and sound on the cuts is no more frequent than chance; the music carries the motion). `make.py` holds a draft as SOUND SLOP when it breaks these:
- **Whooshes:** at most 2 per 30 s. A whoosh is a **low swell, not air**: a body under 150 Hz with its harmonics, a faint air layer 20–30 dB down, 0.5–1 s, swelling to its peak on the cut and gone 0.25 s after (`whoosh` in the template). Filtered-noise air sweeps and oscillator zaps read as cheap; `air` is only for a real rush of air past the camera.
- **The big moment:** riser into a stop-down (everything out for 0.1–0.5 s) into an impact on the reveal frame, once or twice a film, at most one riser per 30 s.
- **Cuts:** a designed sound on at most 70 % of the cuts; most cuts ride on the music, and a film with sparse music scores its cuts with the picture's own sounds (a door, a page, the room changing).
- **Priority:** the reveal, the logo or name, the key action and the section changes get a designed sound; small motion rides on the music.
- **Small sounds low:** ticks, taps and UI clicks sit 10–15 dB under the music's peaks, short and soft, panned toward where they happen; never a bright click louder than the beat.
- **Leave room:** more sounds is not better; a stop-down or a breath before the name is part of the design.


- **Beds cross cuts** (0.8 s crossfade); dry sounds cut with the picture (10–20 ms).
- **A new space starts early** (J-cut, 0.3–1.5 s before the cut); tails spill after it (L-cut).
- **Bed jumps at a cut ≤ 4 LU** unless scripted (a hard cut to silence or to a loud space can be the point).
- **Start long layers away from cuts** (`mix.py` flags layers within 0.3 s of a cut).
- If narration starts within 0.6 s after a cut, start the duck before the cut.
- **No noise whoosh on every transition.** A whoosh is striking twice and tiring by the fifth; across a film, use it for a real rush of air only. Score the cuts instead: a reversed pad that swells and stops dead on a chapter cut (in the chord of the music), a soft bell bloom when the next shot grows out of a point, a quiet glide up for a push or zoom through, a quick pluck run for a rhythmic reveal, a short rising hat roll for a sweep, and **nothing at all for about half the cuts**: the downbeat and the next shot's own entrance sound carry them.
- **Never the same transition sound twice in a row,** and a full impact (hit with a noise tail) for about five structural moments in a film; softer hits for the rest.
- **Energy by section:** a serious or quiet chapter can drop to half-time and sit about 5 dB lower than the lead chapter (check with `qc.py sceneloud`).
- **Tie small sounds to the picture's units:** a tick per letter or tile, a blip on a label landing, a roll under a counting number, a low buzz on a rejection.

## 6. Mix and master

1. Build each layer as its own file in `audio/` (seeded, versioned).
2. Write `audio/mix.json` and run `python3 tools/mix.py audio/mix.json` (peak-limited to −2 dBFS). Aim the mix near −16 to −14 LUFS before mastering.
3. Master and mux: `python3 tools/master_audio.py audio/mix-v1.wav renders/film-v1.mp4 --video renders/picture-v1.mp4 --limit` (two-pass loudnorm, **−14 LUFS integrated, true peak ≤ −1 dBTP**, AAC 320k 48 kHz). The script reports whether the linear mode ran; if it reports dynamic mode, lower the loudest peaks and run again.
4. Measure the final file: `python3 tools/qc.py loud renders/film-v1.mp4` and `python3 tools/qc.py spec renders/film-v1.mp4` (persistent horizontal lines in the spectrogram = an unintended pitched layer).
5. **Measure per scene:** `python3 tools/qc.py sceneloud renders/film-v1.mp4 <boundaries>`. An integrated −14 LUFS can hide a scene much louder or brighter than the rest; flag a scene more than 3 LU from the median scene and any harshness outlier (2–5 kHz share more than 3 dB above the median), then fix it or name it as intentional.
6. **Ask the user to listen.** You can measure audio but cannot hear it. Every delivery says so in one line and asks the user to listen once on headphones and once on a phone speaker, naming the seconds that matter: each transition, the loudest scene, the narration lines, any flagged scene.

| Target | Value |
|---|---|
| Web / social | −14 LUFS ±1, true peak ≤ −1 dBTP |
| Per scene | within 3 LU of the median scene, 2–5 kHz share within 3 dB of the median (or the exception named) |
| Narration over the bed | clearly on top (≈ 15 dB above the bed in the speech band while speaking) |
| Silences | every silence is scripted |
| Identity check | would this mix fit any other film unchanged? If yes, it is a template: go back to §1 |

## 7. Adaptations

- **Vertical short (9:16):** sound starts with the picture; silence before the peak shrinks to 0.3–0.5 s; the film still works muted (picture and on-screen text carry it).
- **Music-led:** the song is the clock; cut picture to it; design sits in its gaps.
- **Product / brand:** clicks and UI sounds lock to on-screen events; one hero moment with a drop before it.

## 8. Music: genre, harmony, groove

The score is chosen like the look: from the story, the purpose and the tempo, named on the director card's **Music**
line with numbers (genre, BPM, key, progression, groove, lead, arc). The slow bed with a drone, an arpeggio and a
glockenspiel is one genre among fifteen, never the default; `make.py` names the instruments and the chord loop your last films used (Quick mode's code score) and a
music too thin for the card's tempo.

**Tools in the Quick template:** `hz('A3')`, `chord('Am7', 3)`, `chordAt(prog, t)`, `grid(part, 'X...x...X...x...')`
(16 steps a bar, X accent, `{ swing }`), synthesised `kick`, `snare`, `hat`, `clap`, `sub808`, `bass`, `stab`, `pad`,
`pluck`, `lead`, and recorded instruments (`samples.py list`; `INSTRUMENTS` and `sample()`).

### Genre cards (a starting point; the film bends them)

| Genre | BPM | Groove (16 steps) | Bass | Harmony | Lead and colour | Fits |
|---|---|---|---|---|---|---|
| Cinematic tension, ambient | 60–90 | none, or a soft pulse `x.......x.......` | a held low note | one chord or i–VI | pads, low strings, piano, swells | mystery, night, investigation |
| Orchestral epic, sports anthem | 84–100 | toms and kick `X...x.x.X...x...`, snare rolls into peaks | cellos and basses on the roots, eighths | i–VI–III–VII, I–V–vi–IV | horns and trumpets carry the tune, strings ostinato, timpani | tributes, legacy, sport, victory |
| Minimal piano, neoclassical | 60–80 | none | the piano's left hand | I–V–vi–IV in open voicing, i–VI–iv–v | piano arpeggios, a cello line | memory, longing, quiet tributes |
| Baroque chamber, whimsical | 100–132 | none, or woodblock on beats | pizzicato walking on eighths | I–IV–V–I and sequences | harpsichord, pizzicato strings, recorder, glock accents | craft, period, Wes Anderson, rituals |
| Jazz, swing | 120–180 | 12 steps a bar (eighth-note triplets): ride `x..x.xx..x.x`, hi-hat foot `...x.....x..`, a soft snare comping off the beat | walking quarters on `bass-pizz` | ii–V–I with sevenths (Dm7 G7 Cmaj7) | saxophone, piano, vibes | comedy, retro, cafés, cities at night |
| Lo-fi hip-hop, boom-bap | 70–92 | kick `X......x..X.....`, snare steps 4 and 12, hats on eighths, swing 0.2 | a soft sub on the roots | m7 and m9 (Dm9 G7 Cmaj7 Am7) | FM piano, vibes, a dusty pad | study, everyday life, warmth |
| House, disco | 118–126 | kick `X...X...X...X...`, clap 4 and 12, open hat `..x...x...x...x.` | octaves or a syncopated line | m7 stabs (Am7 Dm7) | chord stabs, piano chords, strings | launches, fashion, upbeat ads |
| Synthwave, 80s | 84–110 | big snare on 4 and 12, hats on eighths | saw bass on sixteenths, the root | i–VI–III–VII | saw lead, pads, a gated drum | retro tech, cars, night drives |
| UK garage, drum and bass | 130–134, 170–174 | 2-step `X.....x...X.....` with shuffled hats, or the DnB break `X.........X.....` | `sub808` with glides | m7 and m9 | stabs, plucks, a bell | phones, apps, sport highlights |
| Minimal techno | 124–130 | four on the floor, sixteenth hats low, a sparse clap | one-note pulse | one chord, modal | clicks, blips, a filtered stab | precision, watches, engineering |
| Afrobeat, Latin | 100–115 (reggaeton 90–100 `X..x..x.X..x..x.`) | congas, bongos, shaker, cowbell | syncopated on the off-beats | I–IV–V, i–iv | marimba, kalimba, brass stabs | food, travel, joy, summer |
| Folk, acoustic | 80–110 | foot-stomp kick, claps, shaker | on the roots | I–V–vi–IV, I–IV | harp or strumstick strums, harmonica, recorder | craft, nature, home, makers |
| Anatolian, Turkish | 2/4, 4/4 (`X..x..x.X.x.x...`), 9/8 aksak 2+2+2+3 | darbuka, frame drum | on the roots, sparse | makam colour: Hicaz (A Bb C# D E F G), Kürdi, Uşşak; a drone under the tune | plucked psaltery or dan tranh, recorder like a ney, strings | Istanbul, history, Turkish stories |
| Playful, kids, quirky | 110–140 | woodblock, claps, slapstick accents | bouncy pizzicato or tuba | I–IV–V | glockenspiel, xylophone, plucks, a whistle | explainers for kids, toys, comedy |
| Trap, modern hip-hop | 130–150 half-time | hats in sixteenths with rolls, clap on step 8 | `sub808` with glides | i–VI, Phrygian | bells, plucks, a dark pad | streetwear, gaming, bold launches |

Swing: `{ swing }` delays the off sixteenths (lo-fi, house, garage). Jazz, shuffle and blues swing the eighths: write
those patterns in 12 steps (triplets), where the swung note sits on the third step of each beat. Odd meters: `bar()` holds four beats, so for 9/8 set BPM to the eighth-notes per minute × 4/9 and write 9-step
patterns. A film may mix two cards on purpose (orchestral strings over a house kick); say so on the card.

**Recorded players per card** (`samples.py list`; the synth voices fill the rest):
orchestral: violins, violins-spic (ostinato), cellos, contrabass, horn, trumpet, trombone, timpani-roll, snare-drum, gong ·
neoclassical: upright or piano, cellos, violin · baroque: harpsichord, violins-pizz, cellos-pizz, recorder, flute ·
jazz: ride, hihat-foot, bass-pizz, upright, sax (sax-stac for fast lines), trumpet-muted, vibes · lo-fi: fm-piano, upright, vibes, bass-pizz ·
house and disco: violins-spic, clavi, trumpet-stac, claps, tambourine · Afrobeat and Latin: conga, bongos, agogo,
cowbell, shaker, balafon, mbira, trumpet-stac · folk: strumstick, folk-harp, harmonica, recorder, frame-drum ·
Anatolian: darbuka, frame-drum, zither or psaltery for the plucked tune, recorder or flute for the ney, violins ·
playful: clarinet-stac, bassoon-stac, tuba-stac, xylophone, violins-pizz, claves · tension: cellos, violins-trem,
contrabass, tubular-bells, gong.

### A real recording (the ★ for music)
Search the open archives with the genre and the players: `asset_search.py search --q "<genre and instruments>" --type music
--max-wait 12 --out research/music-a` (released CC0 and CC BY tracks from the Internet Archive's Jamendo and netlabel
collections, where genre words work, and Jamendo through Openverse when it answers; every search started at once) and `--type sound --sources
wikimedia` (public-domain recordings: U.S. military
bands such as Airmen of Note, Army Blues, Navy Band Commodores for jazz and big band; university and archive recordings
for classical and folk). Fetch three to six candidates with `fetch --preview 30` (the first 30 s each, nothing more),
send them to the user to hear, fetch only the pick in full, measure it (`beat_grid.py`), cut it on bar lines and set
`OWN_MUSIC` (`music-video.md`). Its LICENSES.csv row and its credit line come with the full fetch.
**The safest first:** search public-domain and CC0 recordings first (`--licence cc0,pd`), CC BY when none fits; never
NC, ND or an unknown licence (the tool drops them). Open the pick's source page once: the uploader must be the maker.
On the Internet Archive the licence is the uploader's claim: a famous or commercial recording marked "public domain" is
left out, and the pick's LICENSES.csv row says whose upload it is.
At the pick, say in one line that a CC BY track needs its credit in the description (`<title>-credits.txt`), and that
YouTube's Content ID can still flag a CC BY track whose artist also registered it: the credit file and the licence link
settle that dispute; a CC0 or public-domain recording avoids it.

### Harmony that is not the same four chords

- Major and bright: I–V–vi–IV (C G Am F), I–vi–IV–V, I–IV (two chords can carry a film).
- Minor and serious: i–VI–III–VII (Am F C G), i–iv–v, the Andalusian descent i–VII–VI–V (Am G F E).
- Modal colour: Dorian i–IV (Dm G), Mixolydian I–bVII–IV (D C G), Phrygian i–bII (Em F) for tension.
- Jazz: ii–V–I with sevenths; the 12-bar blues I7–IV7–V7.
- One chord for a long stretch and a melody that moves is often stronger than a busy progression.
- Change the progression at the turn: a new key a step up, or the minor of the major the film began in.

### Melody and arc

- **A motif of 3–5 notes** with its own rhythm, stated early, answered (call and response), varied when it returns
  (higher, slower, on another instrument); the film's signature can be this motif.
- **Leave room:** while a narrator speaks, the melody rests or sits low; it speaks between lines.
- **Build by adding:** one element in the intro, a new part every 4–8 bars, a breakdown (drums out) before the
  payoff, everything at the turn or the peak, the motif changed at the end, and an ending on the home chord or a held
  one, never a fade that just stops.
- **Short notes on short takes:** a line faster than about 0.4 s a note plays the `-stac` or `-pizz` takes
  (`sax-stac`, `trumpet-stac`, `violins-pizz`); the sustained takes are for held notes. Fast lines on sustained takes
  sound like a keyboard demo. A held note longer than its 4 s take plays again under a fade, or sits on a pad.
- **Inside the player's range:** a note more than 4 semitones from a recorded take stops the render (`samples.py list`
  gives each range); write it an octave over or give the line to another player.
- **Real players where the tune lives:** the motif and the bass sound better recorded (`samples.py`), the drums
  and pads can stay synthesised.
