#!/usr/bin/env python3
"""The brief for a helper: the task, plus the kit's rules for that kind of task, quoted from the references as they
stand today (Python 3 stdlib). A helper starts cold and reads nothing on its own; what is not in its brief does not
exist for it, so the rules travel inside the brief.

  python3 tools/brief.py sound --task "Mix v2: the layered sound for B01-B08" --writes "audio/sfx/*,review/sound-v2.md" \
      --reads "shots.json,review/sound-audit.md" --done "every event in the audit has its sound; mix -16 to -14 LUFS" \
      --out logs/brief-sound.md        # --out, not > : PowerShell 5.1's > writes UTF-16
  python3 tools/brief.py list                    # the kinds and what each one carries
  python3 tools/brief.py overlap --task "<the user's first message>"   # also writes research/past-films.md
  python3 tools/brief.py wait research/predict.md                     # a helper waits for a file another one writes

Pass the whole output as the helper's prompt (Claude Code: the Agent tool; Cursor: Task). In a Film mode project the
guard stops a helper started without one.
"""
import argparse
import os
import re
import sys

def find_kit():
    """The kit this script came from, or, for the copy in a film's tools/, the kit its AGENTS.md names."""
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.path.isdir(os.path.join(here, "references")):
        return here
    agents = os.path.join(here, "AGENTS.md")
    if os.path.isfile(agents):
        with open(agents, encoding="utf-8") as f:
            m = re.search(r"`([^`\n]+?)[\\/]SKILL\.md`", f.read())   # any form: C:\Kit, /My Kit, ~/kit
        kit = os.path.expanduser(m[1]) if m else ""
        if kit and os.path.isdir(os.path.join(kit, "references")):
            return kit
    if os.environ.get("CINECODE_KIT"):
        return os.environ["CINECODE_KIT"]
    sys.exit(f"brief: the kit is not found from {here} (AGENTS.md names no kit with a references/ folder); "
             f"run init_film.py <this film> --update-tools, or set CINECODE_KIT to the kit folder")


KIT = find_kit()


def film_folder():
    """The film this brief is for: the folder it runs in, or the film whose tools/ hold this copy; None outside a film."""
    for d in (os.getcwd(), os.path.dirname(os.path.dirname(os.path.abspath(__file__)))):
        if os.path.isfile(os.path.join(d, "STATE.md")):
            return d
    return None

# Each piece: (file, the line it starts with, the line it stops before; "" = the next heading of the same level).
SOUND_EVENTS = ("references/sound.md", "**What the picture does, the sound does**", "**Accents, not a sound per cut**")
ACCENTS = ("references/sound.md", "**Accents, not a sound per cut**", "")
MASTER = ("references/sound.md", "## 0. Master principles", "")
VOICE = ("references/sound.md", "## 4b. The film's own voice", "")
MUSIC = ("references/sound.md", "## 8. Music: genre, harmony, groove", "")
LONG = ("references/writing.md", "## 13. Long films", "")
SKELETON = ("references/writing.md", "## 14. Structure by length", "")
FACTS = ("references/writing.md", "## 16. Real people and events", "")
KEYS = ("references/writing.md", "## 15. Key moments", "")
COLD = ("references/writing.md", "## 8. First-time viewer check", "")
HALF = ("references/quick-mode.md", "**Half size, never half detail.**", "**Sound is built like the picture")
FINISH = ("references/finish.md", "", "")
PREDICT = ("references/writing.md", "**The prediction test (independent).**", "**The overlap check (independent).**")
OVERLAP = ("references/writing.md", "**The overlap check (independent).**", "The 10 angles stay private")
PICTURE = ("references/film-mode.md", "2. **Picture:**", "3. **Sound:**")
NOTES = ("references/film-mode.md", "## Notes from the user", "")
DRAFT = ("references/film-mode.md", "1. **Draft cut first:**", "2. **Picture:**")
WRITER = ("references/writer-prompt.md", "", "")
WORDS = ("references/writing.md", "## 5. Words: budget and lines", "")
SPECIFIC = ("references/writing.md", "## 12. Specificity test", "")
STEP2 = ("references/film-mode.md", "## Step 2: Roadmap", "")
STEP3 = ("references/film-mode.md", "## Step 3: Script and text", "")
STEP4 = ("references/film-mode.md", "## Step 4: Style frame", "")
SEARCH = ("references/assets-and-licences.md", "## 2. Searching", "")
LICLOG = ("references/assets-and-licences.md", "## 3. The licence log", "")
NEVER = ("references/assets-and-licences.md", "## 6. Never", "")
SOUND_ID = ("references/sound.md", "## 1. Sound identity", "")
LAYERS = ("references/sound.md", "## 3. Layers", "")

# kind: (what it covers, the rules it carries, the model, the effort). Taste and judgement stay on the chat's own model
# ("inherit"); work with a fixed recipe goes lower; counting, validating and measuring are scripts, never a helper.
KINDS = {
    "sound": ("sound design, foley, mix", [SOUND_EVENTS, MASTER, LAYERS, ACCENTS], "inherit", ""),
    "music": ("the score or a found recording", [MUSIC, ACCENTS], "inherit", ""),
    "voice": ("rendering narration takes (the user picks the voice)", [VOICE], "sonnet", "low"),
    "picture": ("building shots, the style frame", [PICTURE, STEP4, HALF, FINISH], "inherit", ""),
    "sourcing": ("finding real material and stock, logging its licence", [SEARCH, LICLOG, NEVER, PICTURE, FACTS], "sonnet", "medium"),
    "files": ("moving, renaming and listing files; licence rows from search results", [LICLOG], "haiku", "low"),
    "script": ("the script and its lines", [STEP3, WRITER, WORDS, LONG, KEYS, COLD, FACTS], "inherit", ""),
    "roadmap": ("structure, the curiosity map, the beat table", [STEP2, SPECIFIC, LONG, SKELETON, KEYS, SOUND_ID], "inherit", ""),
    "review": ("the cold comprehension test or an independent look", [COLD, DRAFT], "inherit", ""),
    "predict": ("the prediction test: the films the user's first message makes anyone expect, five lines, from that message alone", [PREDICT], "sonnet", "low"),
    "overlap": ("the overlap check: each candidate idea against the expected films and this user's own films, judged by someone who did not write them", [OVERLAP], "sonnet", "low"),
    "revision": ("a notes round: fixes and re-plans", [NOTES, HALF, FINISH], "inherit", ""),
}
MARK = "<!-- cinecode brief: {} -->"
DEFAULTS = {"predict": {"writes": "research/predict.md",
                        "reads": "nothing: the user's first message is quoted in the task, and it is all you get",
                        "done": "research/predict.md holds five lines, one expected film each: its subject, key images "
                                "and form"},
            "overlap": {"writes": "research/overlap.md",
                        "reads": "research/candidates.md (the ideas to judge), research/predict.md (the films anyone "
                                 "would expect; not there yet: python3 tools/brief.py wait research/predict.md), "
                                 "research/past-films.md (this user's own films)",
                        "done": "research/overlap.md holds one line per candidate: its number, then CLEAR, SHARES (one "
                                "element repeats: which, and with what) or OVERLAP (the idea itself repeats: with "
                                "what); a prediction by its number, a film by its title"}}
SHARED = ("STATE.md", "shots.json", "audio/mix.json", "LICENSES.csv")    # one owner: the main chat
VERDICT = ("End your report with these lines, exactly:\nVerdict: APPROVE | FIX | UNVERIFIABLE\nRed items: none, or one "
           "\"- \" line each (broken, must not reach a final)\nPolish: what would make it better (never a reason for "
           "another round)\nEvidence: the frames, strips and numbers you looked at\nUNVERIFIABLE when you could not see or "
           "measure what decides it (no film, no frames, a sound question only an ear answers): never APPROVE then.")


def piece(rel, start, stop):
    path = os.path.join(KIT, rel)
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    if not start:                                               # the whole file
        return "\n".join(lines).strip()
    at = next((i for i, l in enumerate(lines) if l.startswith(start)), None)
    if at is None:
        raise SystemExit(f"brief: '{start[:40]}' is no longer in {rel}; update brief.py")
    level = len(start) - len(start.lstrip("#")) if start.startswith("#") else 0
    out = [lines[at]]
    for l in lines[at + 1:]:
        if stop and l.startswith(stop):
            break
        if not stop and level and l.startswith("#") and len(l) - len(l.lstrip("#")) <= level:
            break
        if not stop and not level and (l.startswith("## ") or (l[:2].rstrip(".").isdigit() and l[1:3] == ". ")):
            break
        out.append(l)
    return "\n".join(out).strip()


def wait(path, most):
    """Until a file another helper writes is there (or the time is up): one call instead of a loop of sleeps."""
    import time
    end = time.time() + most
    while time.time() < end:
        if os.path.isfile(path) and os.path.getsize(path) > 0:
            print(f"{path} is there")
            return 0
        time.sleep(3)
    print(f"{path} is not there after {most:g} s: go on without it and say so in the report")
    return 1


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "wait":
        ap = argparse.ArgumentParser(description="wait for a file another helper writes")
        ap.add_argument("cmd", choices=["wait"])
        ap.add_argument("file")
        ap.add_argument("--max", type=float, default=90, help="seconds at most (default 90)")
        a = ap.parse_args()
        return wait(a.file, a.max)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", help="list, or one of: " + ", ".join(KINDS))
    ap.add_argument("--task", help="what this helper does")
    ap.add_argument("--writes", help="the only files it may write, comma separated (globs, relative to the film)")
    ap.add_argument("--reads", help="the files it reads first, comma separated")
    ap.add_argument("--done", help="when it is done, measurably")
    ap.add_argument("--out", help="write the brief here (UTF-8) instead of stdout; use this on Windows, where > from "
                                  "PowerShell 5.1 would write UTF-16")
    a = ap.parse_args()
    if a.kind == "list":
        for k, (what, parts, model, effort) in KINDS.items():
            print(f"{k:<9} {model + (' ' + effort if effort else ''):<14} {what} · "
                  + ", ".join(f"{os.path.basename(f)} {s[:28].strip('#* ')}" for f, s, _ in parts))
        return 0
    if a.kind not in KINDS:
        sys.exit(f"brief: unknown kind {a.kind} (brief.py list)")
    for k, v in DEFAULTS.get(a.kind, {}).items():   # a kind with one fixed job: only --task (the material) is needed
        if not getattr(a, k):
            setattr(a, k, v)
    missing = [f"--{k}" for k in ("task", "writes", "reads", "done") if not getattr(a, k)]
    if missing:
        sys.exit("brief: " + ", ".join(missing) + " missing: a helper is told what it does, the only files it may "
                 "write, what it reads first and when it is done")
    shared = [w for w in a.writes.split(",") if w.strip() in SHARED]
    if shared:
        sys.exit(f"brief: {', '.join(shared)} belong to the main chat; the helper writes its own files and reports")
    film = film_folder()
    if a.kind in ("predict", "overlap") and not film:
        sys.exit("brief: run it in the film's folder (after init_film.py), so the helper writes into the film")
    if a.kind == "overlap":
        if not os.path.isfile(os.path.join(film, "research", "candidates.md")):
            sys.exit("brief: write the candidates first: research/candidates.md, numbered, each with its logline, key "
                     "images, worlds or places, form and seed (writing.md §1, The overlap check)")
        import dice
        n = dice.write_past(film, os.path.join("research", "past-films.md"))
        print(f"research/past-films.md: {n} films of this user", file=sys.stderr)
        a.task = ("Judge each candidate in research/candidates.md against the predictions and this user's own films. "
                  "The user's first message, quoted, so an overlap it asks for (a sequel, the same subject on purpose) "
                  "is known and counts as CLEAR: " + a.task)
    what, parts, model, effort = KINDS[a.kind]
    print("start it with: model " + model + (f", effort {effort}" if effort else "") + " (Claude Code: the Agent "
          "call's model and effort; inherit = the chat's own model)", file=sys.stderr)
    body = [MARK.format(a.kind), f"# Task ({what})\n\n{a.task}\n", "# Files\n",
            (f"PROJECT: {film} (the film's folder; every path below is inside it)\n" if film else "") +
            f"WRITES: {a.writes}\nREADS: {a.reads}\nDO NOT TOUCH: {', '.join(SHARED)} (the main chat owns them) and every "
            f"file not under WRITES\nDONE WHEN: {a.done}\n",
            "# The kit's rules for this task (quoted; they are not optional)\n"]
    body += [piece(*p) + "\n" for p in parts]
    body.append("# Report\n\nAt most 25 tool calls. Details go in the file under WRITES; reply in 10 lines or fewer: what "
                "was done, the files written, what was measured (the command and its result, not a claim), what is still "
                "open, and anything you saw that is outside your task." + ("\n\n" + VERDICT if a.kind == "review" else ""))
    text = "\n".join(body)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
        print(f"brief written to {a.out}", file=sys.stderr)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
