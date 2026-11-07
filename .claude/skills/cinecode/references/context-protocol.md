# Context and revision protocol (binding)

Every message in a chat re-reads the whole chat. A short main chat and fresh helper agents briefed from files keep each step small, fast and cheap, however many rounds the film takes. These rules apply to **Film mode**, from the first message to the last note round, in every profile. Quick mode is the fast lane: its main chat builds, renders and revises itself, research runs in the background, and only the prediction test, the overlap check, the narration takes and the independent viewer of each draft go to helpers, briefed in the format of §1 (`quick-mode.md` §6).

## 1. Thin coordinator

The main chat is the **coordinator and the builder**. It talks with the user, keeps `STATE.md`, writes `notes/round-N.md`, and does the work whose context it already holds: a short film's roadmap, script and shot list, its picture and its revisions. A fresh helper starts cold (about 60 K tokens and minutes of reading before its first edit), so it takes a part only when that pays:

- **Independent and parallel:** the part runs beside the main chat's work without waiting for it: sound designed while the picture is made, voice takes recorded, footage or archive research, the independent viewer.
- **Large:** a chapter of a long film (over about 60 s) whose files this chat has not read, or any task once this chat is large (the guard reports 160 K tokens).
- **Never:** a task whose whole context this chat holds (a 3-second film's roadmap, script or shot list), a check a script answers (counting, validating, measuring: run the tool), or a revision of five targeted edits or fewer.
- **The size of the work sets the crew:** a short or one-shot film (under about 60 s): this chat alone, plus the background viewer; a longer film: this chat plus helpers for its independent parts, at most three at once, each owning its own files. Independent parts start together, never one after another.
- It does not read large files, logs, code or full-size images it does not need; a long reference is read by section.
- **One owner per shared file:** `STATE.md`, `shots.json`, `audio/mix.json` and `LICENSES.csv` are written by the main chat only. A helper writes only the files its brief gives it (`WRITES`) and reports what a shared file should change; the guard holds both.
- **A helper's word is not the proof:** its report names the command it ran and the result; the main chat runs the deciding check itself (`make.py check`, `make.py draft`) before a gate.
- **The viewer's verdict:** APPROVE, FIX (red items: fixed before any final) or UNVERIFIABLE (it could not see or measure what decides it; said to the user). Polish never starts a round. Two FIX rounds on the same red item: before a third, find why (an unclear brief, a wrong method, a missing tool) and change that; the user is asked only for a decision or missing material.
- It keeps in the chat only **decisions and file paths**. Details live in files.
- Images shown to the coordinator: **at most one downscaled contact sheet per gate** (`qc.py sheet` / `qc.py thumb … 768`, under a megapixel). Helpers look at small images too (≤ 4 per turn).
- **Small notes stay here:** a note that is up to five targeted edits (a colour, a constant, a cue time, a word) while this chat is under about 160 K tokens (the guard has not reported a large chat) is done by the coordinator itself, then one render or check call. A fresh helper starts at about 60 K tokens and must read the files first, so it pays off for bigger work or once this chat is large.
- **A helper is small and short:** one task, **at most 25 tool calls**, no chat history. A task that needs more is split; a helper that reaches the limit writes `review/<task>-handoff.md` (done, left, the next concrete step) and a fresh helper continues from it. In Claude Code the skill's guard (`scripts/guard.py`) enforces the limit, refuses images over 1.2 megapixels and reminds the coordinator to hand off when its chat passes 160 K and 260 K tokens.
- Tools without subagents: the same file discipline, one task per chat, and a handoff (§4) at every gate.

### The brief (built from files, never from chat history)

`python3 tools/brief.py <kind> --task "<one line>" --writes "<its own files>" --reads "<what it reads first>" --done "<measurable: frames, numbers, qc checks>" --out logs/brief-<task>.md` (`brief.py list` names the kinds) builds it with the kit's rules for that kind quoted inside; the whole file is the helper's prompt, started with the model it prints, and the guard stops a Film-mode helper started without one. `--reads` names only what the task needs: `STATE.md` "Resume here", the shot's row of `shots.json`, `notes/round-N.md` for its shots, one reference section, the engine lines it edits. The reply goes into the chat (10 lines or fewer); everything else stays in the files it wrote.

## 2. Notes protocol

1. **Save verbatim.** The user's notes go, exactly as written, into `notes/round-N.md` (one file per round), with timestamps and shot ids where given. Ask once, in one batch, for any note that has neither.
2. **Split per shot.** Under the verbatim block the coordinator writes the split table: note id · time · shot · layer (picture / text / sound / timing) · action · model · status. It lists the **unchanged shots** explicitly.
3. **Dispatch.** Up to five targeted edits the coordinator makes itself (§1); beyond that, one fresh subagent per affected shot (text and sound notes get their own). Independent shots run in parallel; heavy GPU renders run one at a time on the machine. Each brief cites the shot's row and its notes section only.
4. **Unaffected shots are never touched:** no edits, no re-renders. Re-encode only the changed shots and concat again.
5. **Reply note by note,** one line each: done / done differently because… / open because…. New version file; older versions are cleared only after the user's OK on the final (`SKILL.md` Hard rules: versions without clutter).
6. **A scope change is a re-plan.** A note that adds shots or scenes or changes the total length is not split per shot: the roadmap and shot list are updated, the user sees the new plan with one still per new or changed shot, and production starts again after the OK. In Quick mode a re-plan does not use one of the two revision rounds.

```markdown
# Notes round 2 · reviewed: renders/film-v1.mp4 · <date>
## Keep
- <what the user praised and must stay as it is, or "none">
## Verbatim
<the user's message, unchanged>
## Split
| Id | Time | Shot | Layer | Action | Model | Status |
|---|---|---|---|---|---|---|
| N1 | 0:12 | S04 | picture | sky two stops darker (look param) | fast | open |
Unchanged: S01 S02 S03 S05 S06
```

## 3. Diagnose before rebuild

For any defect (geometry, explosion or other VFX, reflection, screen direction, timing, audio):

1. **Reproduce cheaply.** A helper renders 1–3 test frames at the defect (`capture.mjs --start <f> --end <f>`) or takes the measurement (`qc.py`, `ffprobe`, parameter values logged at that frame) and writes `review/diag/<shot>-<issue>.md`: symptom, frames, **root cause** (the parameter or code lines that cause it), the smallest fix, confidence, the cost of the fix.
2. **Fix the smallest thing.** Parameter first, then the local code, a whole-shot rebuild last. Re-render the same test frames, compare, then render the shot window.
3. **No blind retries:** a fix that failed is diagnosed again before the next attempt; the next helper gets the diagnosis file, never the failed helper's chat.
4. **A second rebuild of the same issue needs the user's OK,** with the estimated cost stated first (§6).

Useful first measurements: geometry → positions and normals at the frame, a debug render without post; VFX → seed, particle count, emission origin and the timing curve at 3 frames; reflection → environment map, roughness and metalness, a reflections-only frame; direction → camera and subject heading per frame against the shot before; timing → frame numbers against `shots.json`, `qc.py cuts`; audio → loudness per window, onset times against frames.

## 4. Session handoff

The coordinator updates the **"Resume here"** block of `STATE.md` (phase, approved gates, open notes, next action, budget so far) **at every gate**, and also when the chat gets long: after about **15 user messages**, or when the guard reports a large chat (`python3 tools/usage.py --now` measures it). Then it saves a snapshot (`tools/snapshot.py`) and asks the handoff question from `templates/HANDOFF.md`: ★ "Yeni sohbette devam et" / "Continue in a new chat", which opens the new chat itself (the desktop app: `mcp__ccd_session__start_session`; elsewhere `python3 tools/handoff.py`), or "Burada devam et" / "Continue here".

The new chat reads `STATE.md` ("Resume here" first), then only the files it names, and continues. It never needs the old chat.

## 5. Models

Every helper starts with its **model named**, as `brief.py` prints it ("start it with: model …, effort …"): the work where taste and judgement decide (picture, script, roadmap, sound design, music, the independent viewer, revisions) on the chat's own model (`inherit`); rendering narration takes and sourcing on `sonnet`; moving and listing files on `haiku`. Counting, validating and measuring are scripts (`make.py`, `qc.py`, `validate_shots.py`), never a helper. A helper started without a model runs on the chat's model, the most costly; the guard notes it. A user may name other models; `STATE.md` records them.

- **Cursor:** a Task/subagent call without a model runs on the chat's model; custom subagents in `.cursor/agents/*.md` may set `model:`.
- **Claude Code:** the Agent tool runs on the session's model unless `model` is passed; agent files may set `model:` (`inherit` keeps the session's). A new session (or `/clear`) for the handoff.

## 6. Budget meter

`STATE.md` keeps the **profile's ceiling in words** (Economy / Balanced / Quality) and an **estimated running cost per phase**. The coordinator updates it at every gate from the helpers' replies.

- **Measure in tokens:** `python3 tools/usage.py` (Claude Code: every chat and its helpers on this film) or the tool's usage page. A run costs about turns × its average context, plus its output: the context size is the multiplier, since every turn re-reads the whole chat (a fresh helper re-reads tens of thousands of tokens per turn, a long chat hundreds of thousands).
- **Load, not raw tokens:** `usage.py` prints each chat's **load**: every turn weighed by its own model, with cache reads and writes at their own rates, where 1 is a typical 30-second Quick film. Raw token totals are mostly cache reads and say little. Load is for the kit's own budget: never quote money, API prices or dollar figures to the user (a subscription is not billed that way); speak in time, and in films when they ask how much is left.
- **Measured on real films (load):** Quick 20 s ≈ 0.4, 30 s ≈ 1, 60 s ≈ 0.8 to 1.2, 120 s ≈ 1.1; Film mode documentaries of many minutes ≈ 10 to 17.
- **Internal caps for a film under 60 s** (main chat and helpers together, in load): Economy ≈ 0.3 · Balanced ≈ 0.7 · Quality ≈ 1.3; a longer film adds about half of that per further minute. Recalibrate from `usage.py` as films are measured.
- **At 80%** of a phase share or of the total: stop and ask (simplify, accept a stated overrun, or cut scope).
- **Before any whole-shot rebuild** or a second rebuild of the same issue: state the estimated cost (a rough figure, labelled as an estimate, and its share of the ceiling) and wait for the user's OK.

## 7. Checklist for every coordinator turn

- [ ] The work went where §1 puts it: this chat for what it holds the context for, a fresh subagent (file brief, call budget) for an independent part or a chapter.
- [ ] Notes saved verbatim in `notes/round-N.md`; only affected shots dispatched.
- [ ] Defects diagnosed with test frames before any rebuild.
- [ ] Chat holds decisions and paths only; at most one contact sheet this gate.
- [ ] `STATE.md` "Resume here" and budget meter current; handoff offered at a gate or a long chat.
