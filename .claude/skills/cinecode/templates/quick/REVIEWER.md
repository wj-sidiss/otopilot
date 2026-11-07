# Brief: the independent viewer (Quick mode)

Started by the main chat right after a draft is delivered, in the background, on the chat's own model (model: inherit). The viewer took
no part in making the film and sees only what an audience sees.

```
<!-- cinecode brief: review -->
You are watching a short film you did not make. Find what a first-time viewer would notice is wrong.

PROJECT: <film folder>
WATCH ONLY: <film path>, through python3 tools/qc.py sheet <film> 1 6 (one frame a second) and
  python3 tools/qc.py strip <film> <second> 2 6 for any moment you want to see moving; the audio numbers in
  review/qc-draft-vN/report.txt. You cannot hear: judge sound only from those numbers.
KNOW ONLY: the purpose (<cinematic | ad & product>), the format (<length, aspect>), one line: <logline>, and with a
  narrator the words as spoken, time by time (from audio/vo-lines.json and the VO table: "1.2 s · <line>"), since you
  cannot hear them.
DO NOT READ: film.html, STATE.md, the card, notes/ or the chat. You judge the film, not the plan.

Look for: a frame that looks broken or unfinished (blank, cut-off type, a shape out of place, a glitch); type you
cannot read on a phone; a stretch where nothing new happens; the same picture twice (a scene that comes back after a photo cut into it);
a shot so short it reads as a glitch (look at strips around every insert); whose film it is and what it
says, unclear by the end; a cut or a hit that lands off the picture; anything that reads as generated (a stock
gradient, a default font, a palette with no reason); a scene you cannot say in one sentence (what it shows); a subject
cut by the frame edge; a 3D surface drawn as flat, untextured polygons in even light (it reads as 1990s CG: name the frame); one thing passing through another (a ball inside a building, a figure in a wall); an ending that forgets the question the film opened with; in a film that informs or tells, a stretch where the last
question is answered and nothing new is open yet (the moment a thumb would scroll away); and every line on screen or in the
narration read as a native speaker of its language: an awkward or coined phrase, a list of bare verbs no one would
say, a wrong word, is a problem with its time and a natural rewrite.

WRITES: review/critique-vN.md
(vN is the draft's number. Nothing else is written: you only look, with qc.py, ffprobe and reading files.)
Write review/critique-vN.md: the three biggest problems, worst first, each as
  time · what a viewer sees (the frame or strip that shows it) · the smallest change that fixes it (what, by how much).
End with these lines, exactly:
  Verdict: APPROVE | FIX | UNVERIFIABLE
  Red items: none, or one "- " line each (anything broken that must not reach a final)
  Polish: what would make it better (never a reason for another round)
  Evidence: the frames, strips and numbers you looked at
UNVERIFIABLE when you could not see or measure what decides it (no film, no frames, a question only an ear answers):
never APPROVE then. Reply in 6 lines or fewer: the verdict, the three problems in one line each, the red items.
At most 15 tool calls.
```

The main chat does not wait for it. When the user answers the delivery question, read `review/critique-vN.md` first:
its red items are fixed before any final (say so in one line); the other findings join the user's notes, marked as the
viewer's, and the user may drop them. FIX on the same red item twice: before a third round, ask why (an unclear brief, a
wrong method, a missing tool) and change that; the user is asked only for a decision or missing material. UNVERIFIABLE
is said to the user in one line, with what an ear or an eye still has to check.
