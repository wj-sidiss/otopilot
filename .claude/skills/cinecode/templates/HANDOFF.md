# Handoff

<!--
For the coordinator: hand off at every gate, after about 15 user messages, or when the context is large
(references/context-protocol.md §4). Do the checklist, then send the message in the user's language.
-->

## Before the message
- [ ] `STATE.md` "Resume here" filled: phase, approved gates, open notes, next action, budget so far
- [ ] Open notes saved verbatim in `notes/round-N.md`, split per shot
- [ ] Running jobs recorded in `STATE.md` (command, status file, log)
- [ ] Silent snapshot saved (`python3 tools/snapshot.py "handoff: <phase>"`; never mentioned to the user)

## Ask, one question (the question tool), in the user's language

**Türkçe:** "Bu aşama kaydedildi. Sohbet büyüdü; yeni sohbette devam etmek daha hızlı ve ucuz."
- ★ **Yeni sohbette devam et**: start the new chat so that it begins working by itself (below). Then say in one line what happened and stop here.
- **Burada devam et**: go on in this chat.

**English:** "This step is saved. The chat has grown; a new chat is faster and cheaper." ★ **Continue in a new chat** (`tools/handoff.py --lang en`) · **Continue here**.

## Starting the new chat
- **Claude desktop app:** `mcp__ccd_session__start_session` with `initiation: "user_asked"`, `context: "fresh"`, `cwd`: the film's folder, `title`: the film and the step in the user's language, `name`: a short slug, and `prompt`: "STATE.md'den devam et." / "Continue from STATE.md." followed by: load the skill named at the top of `STATE.md` with the Skill tool; run `python3 KIT/scripts/init_film.py . --update-tools` silently; read `STATE.md` ("Resume here" first) and the notes it names; the user's choices at this handoff, verbatim; reply in the user's language; and carry the film on through its gates: the step named here is where to start, never where to stop. This prompt is a handoff, never a helper's brief: no task line, no "done when" line (`brief.py` is for helpers only). The child session opens under this one and starts at once: the user presses nothing.
- **Claude Code in a terminal, or a desktop app without that tool:** `python3 tools/handoff.py --lang tr` (a new Terminal window already continuing, or a new session with the line in its box).
- **Anywhere else:** `handoff.py` copies the line; the reply says where to paste it.
Never leave the user a prefilled box to send, or a line to paste, when a tool can start the chat.

## For the new chat
1. Load the skill named at the top of `STATE.md` (Claude Code: the Skill tool), run `python3 KIT/scripts/init_film.py . --update-tools` silently, then read `STATE.md`, the "Resume here" block first.
2. Read only the files it names; never ask for the old chat.
3. Carry the film on from there, gate after gate: the step a handoff names is where this chat starts, never where it stops.
4. Continue with "Next action", following `KIT/SKILL.md` and `KIT/references/context-protocol.md`.
