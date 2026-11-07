# Editing the user's own footage (optional)

For ad and product films (`purpose-ad.md` §7) when the user brings a talking head, a selfie or a screen recording with voice. The edit comes **before** any motion graphics. Cut decisions come from **word times**, not from audio levels; the machine proposes, and **every cut that changes meaning is approved by the user.**

**Needs Whisper** on the machine for word timestamps, installed only with the user's OK (hard rule): for example faster-whisper or openai-whisper with word timestamps on. For Turkish and other non-English speech use a multilingual model (models ending in `.en` translate into English). Correct brand names in the transcript by hand.

## 1. Order

1. **Measure the source** (`ffprobe`: length, frame rate, audio). Phone recordings often have a variable frame rate: convert to a constant one first (`ffmpeg -i raw.mov -vf fps=30 -c:v libx264 -crf 16 -c:a copy raw-cfr.mp4`).
2. **Word-timed transcript** → `edit/words.json`.
3. **Pause trims and flags:** `python3 tools/footage_cut.py cut edit/words.json --out edit --duration <s>` (§2, §3).
4. **The user approves flags** in `edit/flags.md`; run again with `--apply F1,F3`.
5. **Tighten the story** (§4).
6. **Graphics on the words** (§5).
7. **Draft render and check:** the printed ffmpeg command renders the edit in one pass; check a strip at every join, lip sync, the face framing and the 0–2 s hook.
8. **Master** once, at the end (`master_audio.py`, −14 LUFS, ≤ −1 dBTP).

## 2. Pause trims (automatic)

- Silences shorter than **0.55 s** stay: they are the speech's own breath.
- Longer ones shrink to a short breath, never to zero: **0.20 s** after a sentence end (`. ! ?`), **0.24 s** after a pause longer than 2 s, **0.14 s** elsewhere; 55% of the kept breath stays after the previous word, 45% before the next.
- **0.22 s** before the first word and **0.34 s** after the last; pieces shorter than 0.04 s are dropped. When this footage opens the film, `--head 0` cuts the silence before the first word completely (the hook rule below).
- Fillers ("ıı", "ee", "hmm") under 0.1 s and words under 0.05 s are not trusted as words, so the pause trim treats them as silence.
- Joins are hard cuts with a 12 ms audio fade on each side (no clicks). A raw take usually gets 15–20% shorter here, and room noise or music under the voice does not affect the decisions.

## 3. Flags for approval

`flags.md` lists every candidate with its second, both texts, a confidence and the proposed cut. Nothing in it is cut until the user approves it.

- **Stutter:** the same word twice within 0.5 s → cut from the start of the first to the start of the second.
- **Retake:** the transcript is split into passages (at a pause over 0.85 s, at a sentence end after 7.5 s of speech, or at 16 s at most). Each passage keeps up to 18 meaningful words (no conjunctions, nothing of 2 letters or fewer, lower case, no punctuation). Two passages within 9 passages and 75 s of each other are a candidate when their shared-word ratio (intersection ÷ union) is 0.34 or more, or 0.24 or more with 2 of their first 4 words the same. Confidence: high from 0.45, medium from 0.34, "look" below. The cut runs from the start of the earlier take to the start of the later one: **the last take stays.**
- **False start:** a retake whose first attempt is under 6 s with the restart within 12 s.
- **Turkish (and other suffixing languages):** the same word returns in different forms ("videoyu / videonun"), so words are compared by their **first 5 letters**.
- An emphatic repeat ("never, never") looks like a stutter: that is why nothing is cut without approval. A clean take with no flags is normal.

## 4. Tighten the story

- The script's meaning leads (`SCRIPT.md`, or the beat list in Quick mode). Build the beats from the transcript: each beat tied to one transcript sentence (its first word and second) and carrying one visual idea.
- The hook starts on frame 1: the silence before the first word is cut completely, and something moves in the first 2 s.
- Where the same idea is said twice, keep the shorter, clearer one. Log every removed sentence in `edit/decisions.md` (what, why, who approved).

## 5. Graphics timed to the words

All times come from `edit/words-retimed.json` (the words after the edit).

- **Entry:** a card enters **0.2–0.6 s before** the word its topic starts on (acceptable range: 1.8 s before to 0.2 s after). `footage_cut.py cue edit/words-retimed.json "<word or phrase>"` finds the word (suffix-aware) and prints the entry time. **Exit:** 0.1–0.5 s before the next card.
- Put the important change on the first or last word of the sentence. Use Whisper's own word times; times estimated from a subtitle line are about 0.2 s off.
- One change per spoken beat, 0.4–1.2 s apart. A long topic's card can stay up while its points arrive with the speech, which reads better than cards blinking every 5–8 s.
- **Full-screen cutaways** 3–10 s, with at least 2 s of face between them; none in the hook's first second or on a personal or opinion line.
- **Density:** light 2–4 graphics per minute, medium 4–7, dense almost every sentence; short vertical pieces sit between medium and dense.
- Lower thirds never cover the face and stay inside the safe areas (`purpose-ad.md` §5).
- The graphics move by `motion.md`; each effect peaks on the frame its picture lands (`sound.md`), a whoosh 2–3 frames early.
- No invented numbers or claims: every figure on screen comes from the brief or the product.

## 6. Screen recordings

Record at a resolution that survives the closest shot's magnification (full Retina resolution; a 3× close-up needs a 3× capture). Film the interface as a UI hero shot (`craft.md` §8) instead of showing the flat recording.
