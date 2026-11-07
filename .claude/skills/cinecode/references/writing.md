# Writing: clever, short, on target

A short film has room for one idea and very few words. This guide is the method behind the **WRITER PROMPT** (`writer-prompt.md`). Follow it every time a story, a script, narration or on-screen text is written or revised.

The target: **zekice, az anlatım, nokta atışı**: clever, little explanation, every line a direct hit.

## 1. Diverge, then converge (private)

The first ideas that come to mind are the ones everyone has. Get past them on purpose.

1. **Diverge.** Write 10 loglines or angles for the user's idea, one line each, starting from the three sparks (`deal.py deal spark`: the idea crossed with a real thing drawn by chance from outside, its seed, and a dealt place, form and medium). Vary the point of view (whose story?), the scale (tiny / vast), the time (one second / a hundred years), the genre (comedy / fable / documentary / thriller), the voice (none / unexpected narrator).
2. **Discard the first 3.** They are the obvious ones, whatever they are.
3. **Keep the 3 most surprising-yet-true.**
   - *Surprising:* a first-time viewer would not predict it from the premise, the prediction test below did not predict it, and the overlap check found it in none of this user's films.
   - *True:* it follows from the idea and the world; nothing is bent to make it work; the viewer would say "of course" afterwards.
4. **Pick 1**, with a one-line reason the user can read: what this angle does that the others do not.

**The prediction test (independent).** The maker cannot judge its own surprise. At the very start, where the tool has helpers, a fresh helper (`python3 tools/brief.py predict`) gets only the user's first message, quoted, and nothing else, and writes `research/predict.md`: the five films it would expect from that message, one line each (subject, key images, form). Write the 10 angles while it runs. A kept angle that shares its subject, key image or form with a predicted line is replaced by the next one on the list; each interpretation offered then says in a few words what it does that the predictions did not. One reply, about a minute, never waited on by the user.

**The overlap check (independent).** The maker cannot judge its own repeats either. Before the ideas reach the user, write the best five angles as candidates in `research/candidates.md` (numbered, each with its logline, key images, worlds or places, form, and the seed it grew from), then `python3 tools/brief.py overlap --task "<the user's first message, quoted>"`: it writes this user's own films into `research/past-films.md` (the memory `make.py` keeps, and the films on the same shelf) and prints the brief for a fresh helper, which reads the candidates beside `research/predict.md` and those films and writes `research/overlap.md`: one line per candidate, CLEAR; SHARES, when one element repeats while the idea is new (an ending, a form, a key image or a world; which one, and with what: a prediction by its number, a film by its title); or OVERLAP, when the idea itself repeats (its premise and key images, whatever the details; with what). What the message itself names (a brand, a product, a person, a place) is the user's and never an overlap on its own: a film about the same brand repeats only in its idea, images, worlds or form. About half a minute. The three strongest that are not OVERLAP are offered, a SHARES one with its shared element changed; an OVERLAP is dropped, never argued with, unless the user's own message asks for that film again (a sequel, the same subject on purpose); with fewer than three left, new candidates go through the check once more. The guard holds the ideas question until the check has read the latest candidates.

The 10 angles stay private (they cost the user attention). The user sees the pick and its reason. The 3 kept angles are the interpretations offered at the first questions (Film mode, for a bare idea: at the roadmap).

## 2. One turn

When the story turns, it turns on **one clear change or reversal**. Write it before anything else:

> Before: <…> / After: <…>

Kinds of turn, as vocabulary:

| Turn | Movement |
|---|---|
| **Reversal** | the roles swap: protector and protected, hunter and hunted, big and small |
| **Reveal** | a detail grows until the whole is understood, and the whole means something else |
| **Transformation** | one place or thing across time; the last state answers the first |
| **Threshold** | the moment before an event, then the event, then what it changed |
| **Mirror** | the last image repeats the first, changed in meaning |
| **Contrast** | the words say one thing, the picture another; the gap is the meaning |

A mood piece or a portrait may have no turn; it names what the viewer is left with instead, and keeps something new arriving so it never idles.

## 3. Ending first

Write the last image or last line first: where the film lands decides what it must set up. Check that everything the ending needs (an object, a rule, a referent, a count) is set up in the first third. The ending keeps its own seconds (§15).

## 4. Show, don't tell

- **Narration never describes what is on screen.** It adds what the picture cannot: subtext, contrast, the past, the inner voice, a count, a rule.
- **The caption test:** if a line could be a caption for its shot (it only names what the shot shows), cut it or flip it into something the picture does not say.
- **Never explain the moral.** If the ending needs a sentence to be understood, the ending is not finished; fix the image.
- **Wordless is valid:** sound and the cut tell the rest, and it travels across languages.

## 5. Words: budget and lines

| Runtime | Narration budget |
|---|---|
| 15 s | ≤ 20 words |
| 30 s | ≤ 40 words |
| 60 s | ≤ 80 words |
| 90 s | ≤ 120 words |

(About runtime × 4/3 up to 3 minutes; `validate_shots.py` checks it when lines are in `shots.json`.)

**Over 3 minutes, when a narrator carries the film** (a documentary, an explainer, a video essay), the short-film ceiling would leave it resting more than it speaks: write about 110–140 words a minute (runtime × 1.8–2.3), the holds and key-moment silences counted inside. A reference video in the niche gives its own measured pace and wins. `make.py check` reports a long narrated film whose voice speaks under half of it.

- **One idea per line.** Two ideas become two lines with a pause.
- **≤ 9 words per line.** The strongest line is often the shortest.
- **Concrete nouns and verbs:** the things and actions of this story beat the abstract words for them.
- **No adjective stacks.** At most one adjective per noun, and only one the picture does not already show.
- **No clichés** (§6).
- **On-screen text:** ≤ 6 words per card; on screen ≥ 0.6 s + 0.25 s per word; 1–3 cards in a short ad or mood piece; a film that informs (a documentary, an explainer, a film without a narrator) carries words and graphics wherever they tell (`motion-design.md`).
- **Pauses are part of the script.** Write them as numbers (0.6 s between lines, 1.5 s after a key line, 1–3 s of scripted silence before the biggest moment).
- **Placement:** leave the first 2 seconds to picture and sound; a line starts 0.3–0.6 s after a cut; the key word lands within 0.5 s of the image that answers it.

## 6. Banned list (clichés)

Never use these, or their close variants. When one appears in a draft, the line is usually saying nothing: replace it with a concrete image.

| English | Türkçe |
|---|---|
| in a world where… | …bir dünyada |
| journey (as a metaphor) | yolculuk (mecaz olarak) |
| little did they know | …den habersizdi |
| what if…? | ya … olsaydı? |
| more than just a… | sadece bir … değil |
| every moment counts | her an değerli |
| against all odds | tüm zorluklara rağmen |
| it's not about X, it's about Y | aslında mesele X değil, Y |
| nothing would ever be the same | hiçbir şey eskisi gibi olmayacaktı |
| the rest is history | gerisi tarih |
| a story of hope / love / courage | umut / sevgi / cesaret dolu bir hikâye |
| where X meets Y | X ile Y'nin buluştuğu yer |
| magic happens | sihir gerçekleşiyor |
| follow your dreams / your heart | hayallerinin / kalbinin peşinden git |
| embark on / unlock / dive into | … yolculuğuna çık / kilidini aç / derinlerine dal |
| a testament to / a tapestry of | … kanıtı / … dokusu (süs olarak) |
| one thing is certain | kesin olan bir şey var |
| beyond time / timeless | zamanın ötesinde / zamansız |
| an unforgettable experience | unutulmaz bir deneyim |
| and then everything changed | ve sonra her şey değişti |

Also avoid: rhetorical questions to the viewer, "imagine…" openings, lists of three abstract nouns, ending on a slogan.

**Words that read as generated** (checked by `tools/words_check.py` before every render; `make.py` prints one line):

- **Never a dash** in the film's words: no em dash (—), no en dash (–) or `--` used as one (a range such as 1–3 stays). A comma, a full stop, a colon or a line break says how two parts relate; a dash avoids deciding. A render stops on one.
- **"X değil, Y" / "not X but Y":** the first half denies something nobody claimed. Say the second half alone.
- **Sayings that sound deep:** "asıl mesele", "özünde", "at its core". Say the concrete thing.
- **Staged run-ups:** "işte tam da bu noktada", "gelin birlikte", "peki ya…?", "hayal edin", "let's", "here's the thing".
- **Inflated words:** adeta, büyüleyici, eşsiz, nefes kesici, fısıldıyor, dans ediyor, …in kalbinde, zamana meydan okuyan; vibrant, pivotal, seamless, tapestry, whispers, breathtaking.
- **Sales lines:** "Kaçırma!", "Hemen keşfet", "fark yarat", "bir adım önde"; a call to action names the thing, the place and the time.
- **Rhythm by rule:** three-word abstract lists ("Umut, cesaret ve sevgi."), more than two exclamation marks in a film.

A tell is a question, not a ban: a character's own line, a quote or a name keeps it, with the reason on the director card.

## 7. Two passes before the user sees it

1. **Read aloud and time it** at the chosen voice's pace (calm 2.0–2.5 words/s, energetic 2.6–3.2, storyteller 1.5–2.0). Lines that trip the tongue get rewritten.
2. **Cut 30%.** Remove three words in ten. Keep the cut version unless meaning breaks. Record "words before → after" in `SCRIPT.md`.

## 8. First-time viewer check (cold)

Read the script and shot list as someone who knows nothing about the idea, the references or the intentions:

- **Referents:** who is "I", "you", "we", "they"; what is "it" and "this" at every occurrence? Each has exactly one answer.
- **Causality:** every effect has a cause the viewer saw or heard. Which line relies on a reason never given?
- **Ending premise:** is everything the last line or image needs already in the film? Where?
- **Muted test:** with sound off, can the viewer say what happened in one sentence?
- **No line left hanging:** every line completes its meaning on its own; a line cut before the word that matters leaves the viewer waiting for it.

Fix the smallest thing where a break starts: reorder or retime first, then one short new line, and only then a rewrite.

## 9. Voice

Voice is a creative choice per story, not a house style, and so is its sound: every narrated film gets its own treatment (`sound.md` §4b), never the raw engine voice and never a default whisper. Options: none · warm documentary · playful · deadpan (calm voice, absurd picture) · intimate first person · storyteller · childlike · synthetic / robotic · chorus. Decide who speaks, from when, to whom; keep one register for the whole film.

Temp narration for timing: the operating system's voice (`say` on macOS, PowerShell `System.Speech` on Windows, `espeak-ng` on Linux), the user's own phone recording, or a voice service the user chooses and approves. Measure the real line lengths; they drive the shot timing.

## 10. The shape of a beat table: wordless (30 s, 9:16)

The shape only; the kit holds no sample film, since a sample is copied. Every film fills it from its own story.

**Idea:** <the user's idea, in their words>

**Logline:** <what moves in this film: a change, or what the viewer is left with>
**Turn** (when the story has one): Before: <…> / After: <…>
**Ending:** <the last image or sound, and what it leaves>

| # | Time | Beat | What changes |
|---|---|---|---|
| 1 | 0:00–0:03 | Hook: <what moves on frame 1> | <the question it opens> |
| 2 | 0:03–0:08 | <beat> | <what changes> |
| 3 | 0:08–0:14 | <beat> | <what changes> |
| 4 | 0:14–0:18 | <beat> | <what changes> |
| 5 | 0:18–0:22 | <beat> | <what changes> |
| 6 | 0:22–0:30 | <the ending, held for its seconds> | <what stays> |

**Lines:** none. **On-screen text:** none. **Signature sound:** <one sound that returns, changed>. The shot list's shape: `templates/shots.example.json`.

## 11. The shape of a narrated table: four lines (30 s)

**Idea:** <the user's idea, in their words>

**Diverge (private):** ten loglines; the first three are what anyone would write and go; keep the surprising-yet-true ones, pick one, and write the reason in a line.

**Turn** (when the story has one): Before: <…> / After: <…>
**Ending:** <the last image or line>

| # | Over | Line | Words | What it adds (never what we see) |
|---|---|---|---|---|
| VO1 | <the picture under it> | <the first line> | ≤ 9 | <what the picture cannot say> |
| VO2 | <…> | <…> | ≤ 9 | <…> |
| VO3 | <…> | <…> | ≤ 9 | <…> |
| VO4 | <…> | <…> | ≤ 9 | <…> |
| — | <the ending, held for its seconds> | — | — | the ending |

**Total:** <n> / 40 words. **The 30% cut pass:** every line is cut until a word more would add nothing. **First-time viewer:** the picture names the speaker on the first line; what the ending needs is visible before it; the moral is never said.

## 12. Specificity test

A good idea belongs to its subject. How strict the test is depends on what the film is for.

**Product, brand, ad or sponsor film: full test (mandatory, before the roadmap).**
1. **List 8–12 concrete things that belong only to this subject:** the name and what it means, the place, numbers (founding year, size, a count), one real constraint, materials, rituals and habits, printed objects (labels, tickets, packaging, signs), sounds.
2. **Write the concept in one sentence:** "[a subject-only thing] becomes [a visual device]".
3. **Swap test:** replace the subject's name with its closest competitor's. If the sentence still works, the idea belongs to the genre, not to the subject: go back to the list and build the concept on a thing the competitor does not have.
Write the list, the sentence and the swap result into `ROADMAP.md` (concept section).
4. **Identity on screen:** for a place, product, brand or promo piece, choose which of the listed things the viewer must be able to name, and name them on screen (labels or lower thirds in the film's typography, `craft.md` §4). The picture carries what only this subject has; the label makes sure the viewer knows whose it is.

**Story or cinema piece: light world test.** The imagery and the sound come from this story's own world: its materials, objects, textures and sounds that only this story has (the props of its place, its tools). Check every look choice and sound concept against that world; no competitor swap is needed.

## 13. Long films: the promise and the open question

From about 5 minutes on, a viewer stays for an answer they want. Within the first 30–60 s, plant the question the ending answers: a striking moment from later in the story shown first (a cold open), an expectation set up and then promised to break, or a contradiction the film will resolve. Name what is at stake and for whom, in a number and an image the viewer can hold (a distance as a number and a map, a deadline in hours), early. Then keep it open: each stretch answers part of it and opens a smaller one. The ending pays the promise off visibly; a promise the film cannot keep is never made. The skeletons by length are in §14.

- **The curiosity map** (5 min and up, a table in the roadmap): every question with the second it opens and the second it is paid. At most two big questions open at once; a reveal or reversal at least every 60–90 s; nothing paid before it was wanted.
- **Plant, do not tell.** What the viewer will need later (where the people are now, how it ended) goes in as a question or a single image, not as an information block that answers it early; an answer given before the question is wanted kills the curiosity it was meant to feed.
- **Length follows the material.** A longer cut adds events, never spreads the same ones thinner: when the runtime grows, the shot rhythm stays and the new seconds carry new information. If the material runs out at 7 minutes, the film is 7 minutes.
- **Form follows the niche, not a rule.** Chapter cards, act titles and returning to the opening image are options some channels use, not requirements; a reference video in the niche (`reference-video.md`) shows which form holds its viewers.

## 14. Structure by length

**A compass, not a mould.** Originality comes first; these skeletons serve clarity and attention only, and the idea decides the form. Bend one, combine two, or ignore them and say in one line what carries the film instead (a mood arc, one image transforming, a rhythm). Timings are starting points.

For a story film, five lines show whether the story is there: **situation** (the world) · **desire** (a concrete want) · **conflict** (what stands in the way) · **change** (the turn) · **result** (the new reality). Then look at the skeletons for the length and name what the film uses, one of them or its own, on the director card ("Yapı / Structure"):

| Length | Skeleton | Curiosity |
|---|---|---|
| 15–60 s | one turn; for poetic, abstract or loop films *kishōtenketsu* (introduce · develop · an unexpected turn · reconcile), which needs no conflict | one question, opened in the first seconds, closed at the end |
| 30–60 s that inform or tell (an explainer, a story reel, an ad with a story) | the same one turn at the end, reached through a chain of questions (below) | a chain: each answer opens the next question, a link every 15–20 s |
| 1–5 min | the story circle, in proportions: comfort 0–10 % · want 10–20 % · into the unfamiliar 20–30 % · trial 30–50 % · finds it 50–60 % · pays its price 60–75 % · returns 75–90 % · changed 90–100 % | one big question from the first 15 s, answered in the last 20 % |
| 5 min and up | the opening in two layers: 0–5 s a pattern break (a striking image or line, a contradiction, a moment from later), 5–30 s why it matters and one hard fact, the story moving before 30 s; with a narrator, the first line within 2 s; then stretches that each answer part of the question and open a smaller one (chapter cards only when the form uses them) | the promise (§13) answered near the end; usually no more than two big questions open at once; something new every 10–15 s |

**The chain of questions** (only that row: a cinematic, poetic or loop film, a product shot and anything under 30 s keep one question):
- **What can be lost, in a picture,** within the first 3 s when the film has a stake.
- **The question is never asked; something is held back:** the frame cuts it off, a drawing stops half way, a number freezes. A rhetorical question on screen is the weak form.
- **Small turns on the way to the big one:** each link answers the last question and turns it, never contradicting what the film showed; the film's one turn still comes last.
- **The hand-off is made with the picture, the cut and the sound** as much as with words: the answer's own image leaves something new missing, a cut lands on the next unknown, the music drops a beat and comes back changed. With a narrator, a short bridge line may carry it too.

**With a narrator, any film over a minute starts its first line within 2 s** (the 5-minute row's rule holds from one minute; a late voice loses the opening).

Cinematic films end on their image, never on a call to action; YouTube pieces end at full energy, never on "that is all". A skeleton serves the idea, never the other way round.

## 15. Key moments, the thesis line, the ending

A compass, like §14.

- **The hook is a question, not information.** Moving from frame 1 is the floor (`qc.py hook`); what holds a viewer is a question the film owes them. Ingredients to choose from, in any order: a contradiction, the question itself, 2–4 flashes from later in the film, an image left unanswered and paid off later, the thesis, the title. An opening that only sets the scene is information; give it a question.
- **Tempo is a map, not a setting.** Each chapter or stretch gets a tag on the beat table: **fast** (2–4 s cuts), **breath** (room for a line to land), **hold** (a long, still look). Never three of one tag in a row; the contrast is the rhythm.
- **Voice and picture take turns.** When the voice rests, the picture carries (an event, a reveal, a cut that lands on something new); when the picture holds, a line or a sound moment carries it. Both resting at once is a dead stretch unless it is a marked hold or a key moment. **Without a narrator** (or with a sparse one), what a narrator would say moves on screen: text in the film's type, numbers, maps, labels, diagrams and kinetic type in motion, at a steady rate through the film, so a wordless documentary still tells at every moment. `make.py check` reports where it happens (a report, never a rule on lengths).
- **Key moments, 2–4 per film:** the moments the film rests on, such as the thesis line, the hardest quote or fact, the turn when it has one, the last line or image. Mark them on the beat table and show them at the gate as their own short list. Each one gets: time on screen = reading time + 1.5 s; its own sound moment (the bed drops away, one low hit or a single held note, a tail); everything around it steps back (no new motion, no competing text). A fast film needs these stops; asking for more speed and for the key moments to slow down is contrast, not contradiction.
- **The thesis line is asked on its own.** At the gate, the thesis (and the last line) get a separate question with 2–3 wordings that differ in the verb or the stance ("this film follows…" / "…defends…" / "…doubts…"): the word choice is the film's moral position and must stand where the title stands. With a narrator, the key lines are played to the user on their own; a statement never ends rising like a question.
- **The ending is a creative decision.** Asked at the first questions or the gate, never left to default. Whatever it is, it ties back to the question the film opened with: it answers it, turns it, or leaves it open on purpose, but never forgets it. Sources and credits go in the description, never in a scrolling list over the ending. **The ending keeps its time:** after the last line it has its own seconds on the beat table (at least 2 s up to a minute, 4 s up to three minutes, 6–10 s beyond; `make.py` measures it) for what was chosen to play out: the image holding, the card, the silence, the last sound's tail. When the film runs long, earlier lines give way, or the film runs a few seconds over its length; the ending is never squeezed to fit (`make.py` holds a cut whose last line ends too close to the end).

## 16. Real people and events: every claim has its source

A film about a real person, place or event says nothing it cannot point to. `research/facts.md` holds one row per claim the film makes (a date, a number, a quote, what someone did): the claim · its source link · `confirmed` or `unconfirmed`. A claim no source confirms is cut, or said as what it is ("anlatılana göre", "iddiaya göre"); a number is never rounded into a stronger one. What happened and what the film reads into it stay apart: the narration may interpret, but never in the words of a fact. A source that cannot be reached is written down as unreachable, never filled in from memory.
