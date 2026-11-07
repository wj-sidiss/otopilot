# Variety Captions: Style Prompt

> Emotional, decorated captions straight out of TV variety-show editing: fat rounded letters with layered outlines
> pop onto the footage with a bounce, change colour and shape with the mood, and come with a sound effect every
> time; burst frames, sweat drops and sparkles comment on what just happened.
> References (grammar only, never copy): East Asian variety-show post-production and the vlog and pet-video editing
> it shaped. Grammar after the style notes of Vincentwei1021/mg-styles-15 (MIT).

## 1. Essence, and what it is not

- **The caption reacts, it does not transcribe.** Each one comments on a moment: surprise, shame, joy, "???".
- **Layered letters:** a fill (often a gradient), a thick white outline, a coloured outer outline, a drop shadow.
- **Pop entrance:** scale 0 to about 1.15 to 1 in about 8 frames, or letter by letter with a 2-frame stagger, a slight
  rotation, a gentle wiggle while it holds.
- **Every caption has its sound:** a pop, a boing, a ding, a record scratch, on the same frame.

Not word-locked talking-head captions (`typography.md` §8): those follow speech; these follow emotion.

## 2. Materials & rendering

- A footage layer underneath: the user's own clip, licensed photos with slow push-ins and small handheld drift, or a
  drawn scene; punch-in zooms on the moments.
- Decoration symbols drawn as flat shapes: a radial burst frame with speed lines, a sweat drop, sparkles, a question
  mark cluster, an anger mark.

## 3. Colour logic

- High-saturation pink, yellow, cyan and lime with white outlines; one colour per emotion and kept consistent (shock
  yellow, love pink, cold blue).

## 4. Type & subtitles

- A rounded heavy display face for the captions (with Turkish letters checked: Ğ İ Ş ı); a slanted hand-lettered face
  for asides; never more than two caption faces.
- Outlines are drawn as stacked strokes (outer first, then white, then fill) at sizes that read on a phone.

## 5. Motion quality

- `MOTION.back` with s 1.5–2 for the pop; `MOTION.stagger` for letters; a held wiggle of 2–4° and 2–3 % scale.
- Captions appear 2–3 frames after the moment they react to, never before.

## 6. Camera grammar

- Snap punch-ins (10–25 % in 3–4 frames) on the moment, a little handheld drift otherwise; the captions stay in screen
  space, unmoved by the camera.

## 7. Sound palette

- A bouncy bed (pizzicato, bass, claps); per caption a pop, boing, ding or slide whistle; a record scratch on a "???"
  (`samples.py get woodblock slapstick glock` for the hits and dings).

## 8. Native moves (shot types)

| Shot | Use it for |
|---|---|
| Title pop | The episode title: gradient fill, double outline, letter bounce |
| Shock burst | Surprise: the word inside a radial burst with speed lines and a zoom |
| Sweat drop | Awkward: a drop slides down beside the subject, a small caption in a cool colour |
| ??? cluster | Confusion: three question marks bounce in, offset in time |
| Sparkle | Cute or proud: sparkles twinkle around the subject |

## 9. Pitfalls of the medium

- Captions that only repeat the speech are subtitles, not this style.
- More than one caption fighting at a time; one reaction per moment.
- Thin outlines or small letters vanish on a phone.

## 10. Engine

Canvas 2D starter: captions drawn with `setType()` in stacked strokes and `typeReveal()` for the letter bounce; the
footage layer as images under a `CAM` push; decorations as `poly` shapes.

## 11. Variation space

- **Tone:** pet vlog (soft, cute), comedy sketch (loud), interview highlights (sparser, more irony).
- **Format:** 9:16 first; the captions sit above the bottom 20 % safe zone.
- **Density:** one reaction every 2–4 s.
