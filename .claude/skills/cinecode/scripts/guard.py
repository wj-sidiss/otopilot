#!/usr/bin/env python3
"""Claude Code hooks that keep a film's chats small (standard library only; registered by the skill's header).

  guard.py prompt   UserPromptSubmit: when the chat's context passes 160 K and again at 260 K tokens, remind the
                    agent once to hand off to a new chat at the next gate (or now)
  guard.py tool     PreToolUse: the film's gates, checked before a tool runs: among them a large image into the chat
                    (over 1.2 megapixels), a helper past 25 tool calls, a question about something the user has not
                    seen, the key file, the ideas before the predictions and the overlap check, the board before the
                    medium, picture code before the card and the build rules
  guard.py stop     Stop: a delivered draft's turn ends on its question; an approved gate moves on in the same turn

Acts only inside a film project (a folder with STATE.md and tools/qc.py, or tools/qc.sh in an older film, at or
below the session folder, or above the file being read); anywhere else it exits 0 silently. Any internal error also exits 0: a guard never blocks work
because of its own fault.
"""
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

SOFT, FIRM = 160_000, 260_000
IMAGE_MAX_PIXELS = 1_200_000
HELPER_CALLS = 25
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
STATE_DIR = Path(tempfile.gettempdir()) / "cinecode-guard"
SEEN = Path(os.environ.get("CINECODE_GUARD_SEEN") or Path.home() / ".cinecode" / "guard-seen")


SHELLS = ("Bash", "PowerShell")              # Windows without Git Bash runs Claude's commands in PowerShell


def is_film(d):
    return (d / "STATE.md").is_file() and any((d / "tools" / q).is_file() for q in ("qc.py", "qc.sh"))


def film_near(cwd):
    d = Path(cwd)
    if is_film(d) or any(is_film(p) for p in list(d.parents)[:3]):
        return True
    try:                                 # the films folder may sit one level down: <cwd>/Filmler/<film>
        kids = [c for c in d.iterdir() if c.is_dir() and not c.name.startswith(".")][:200]
        return any(is_film(c) for c in kids) or any(is_film(g) for c in kids for g in list(c.iterdir())[:200]
                                                     if g.is_dir() and not g.name.startswith("."))
    except OSError:
        return False


def film_above(path):
    """The film a path is in, by its path as written first (a film's renders/ or review/ may be a link to another
    disk), then by its resolved path."""
    for chain in (Path(os.path.abspath(path)).parents, Path(path).resolve().parents):
        found = next((p for p in chain if is_film(p)), None)
        if found:
            return found
    return None


def film_dir(cwd):
    d = Path(cwd)
    return next((p for p in [d, *list(d.parents)[:3]] if is_film(p)), None)


def film_of_path(p, cwd):
    """The film holding one file the tool touches (its own film, wherever the session was opened)."""
    if not p:
        return None
    q = Path(str(p)) if os.path.isabs(str(p)) else Path(cwd) / str(p)
    return q if is_film(q) else film_above(q) if q.exists() or q.parent.exists() else None


def films_below(cwd):
    try:
        kids = [c for c in Path(cwd).iterdir() if c.is_dir() and not c.name.startswith(".")][:200]
        return [c for c in kids if is_film(c)] + [g for c in kids if not is_film(c)
                                                  for g in list(c.iterdir())[:200] if g.is_dir() and is_film(g)]
    except OSError:
        return []


def prompt_film(prompt, cwd):
    """The film a helper's prompt names: a path inside a film, else one film's folder name among the films below
    the session's folder or beside the film it was opened in."""
    for m in re.finditer(r"((?:[A-Za-z]:)?/[^\s`'\"]+)", prompt):
        f = film_of_path(m.group(1).rstrip(".,;:)"), cwd)
        if f:
            return f
    here = film_dir(cwd)
    pool = set(films_below(cwd)) | (set(films_below(here.parent)) if here else set())
    named = {f for f in pool if re.search(r"(^|[\s/`'\"])" + re.escape(f.name) + r"([\s/`'\".,:;)]|$)", prompt)}
    return named.pop() if len(named) == 1 else None


def film_for(ev, inp):
    """The film an event works on: the film holding the file it touches; else the film a helper's prompt names;
    else the session's folder or one above it; else the only film below it. Several films and no name: no guess."""
    cwd = ev.get("cwd", ".")
    for p in [inp.get("file_path"), *(inp.get("files") or [])]:
        f = film_of_path(p, cwd)
        if f:
            return f
    if inp.get("prompt"):
        f = prompt_film(str(inp["prompt"]), cwd)
        if f:
            return f
    film = film_dir(cwd)
    if film:
        return film
    found = films_below(cwd)
    return found[0] if len(found) == 1 else None


def notes_after(path, name, inp):
    """The notes file as it would read after this Write, Edit or MultiEdit."""
    if name == "Write":
        return str(inp.get("content", ""))
    try:
        text = Path(path).read_text(encoding="utf-8")
    except (OSError, ValueError):
        text = ""
    for e in (inp.get("edits") or []) if name == "MultiEdit" else [inp]:
        old, new = str(e.get("old_string", "")), str(e.get("new_string", ""))
        text = text.replace(old, new) if e.get("replace_all") else text.replace(old, new, 1)
    return text


def film_mode(film):
    return film is not None and ((film / "engine").is_dir() or not (film / "film.html").is_file())


def duration(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             capture_output=True, text=True, timeout=10).stdout
        return float(out or 0)
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0.0


BUILD_READ = ("never as a blockout to be dressed later", "Renderer: the film and the machine choose it",
              "| **Light** | one motivated key", "| **Post** | tone mapping")


PS_WRITE = ("set-content", "add-content", "out-file", "tee-object", "new-item")
PS_COPY = ("copy-item", "move-item", "rename-item")
PS_ALIAS = {"sc": "set-content", "ac": "add-content", "tee": "tee-object", "ni": "new-item", "cpi": "copy-item",
            "copy": "copy-item", "cp": "copy-item", "mi": "move-item", "move": "move-item", "mv": "move-item",
            "ren": "rename-item", "rni": "rename-item", "rnp": "rename-item"}
PS_SWITCH = {"force", "nonewline", "append", "noclobber", "passthru", "whatif", "confirm", "recurse", "container",
             "asbytestream", "raw", "usetransaction", "verbose", "debug"}
PS_HERE = re.compile(r"@(['\"])\r?\n.*?\r?\n\1@", re.S)           # a PowerShell here-string: text, never commands


def ps_written(cmd, powershell):
    """The paths a PowerShell command writes, bound the way PowerShell binds them: Set-Content, Add-Content, Out-File,
    Tee-Object and New-Item write their -Path, -LiteralPath or -FilePath, else the first bare argument; Copy-Item and
    Move-Item their -Destination, Rename-Item its -NewName, else the last bare argument. Quoted text and here-strings
    are values, never commands; an unambiguous start of a parameter name counts (`-Pa` is -Path); the short aliases
    count only in PowerShell, the one shell where they are aliases."""
    held = []

    def hold(text):
        held.append(text)
        return f" \0{len(held) - 1}\0 "
    text = PS_HERE.sub(lambda m: hold(""), cmd)
    text = re.sub(r"'([^']*)'|\"([^\"]*)\"", lambda m: hold(m[1] if m[1] is not None else m[2]),
                  re.sub(r"`\r?\n", " ", text))
    def unhold(w):                           # a held placeholder back to its text, anything else as it is
        w = w.strip()
        return held[int(w[1:-1])] if re.fullmatch(r"\0\d+\0", w) else w
    text = re.sub(r"@\(([^()]*)\)",          # an array literal @('a','film.html') is its elements, kept as one value
                  lambda m: hold(" ".join(unhold(w) for w in m[1].split(",") if w.strip())), text)
    out = []
    for seg in re.split(r"[;|&\n(){}]", text):
        words = [unhold(w) for w in seg.split()]
        if not words:
            continue
        verb = words[0].lower()
        verb = PS_ALIAS.get(verb, "") if verb in PS_ALIAS and powershell else verb
        if verb not in PS_WRITE + PS_COPY:
            continue
        named, bare, i = {}, [], 1
        while i < len(words):
            m = re.fullmatch(r"-([A-Za-z][\w-]*)(?::(.*))?", words[i])
            if not m:
                bare.append(words[i])
                i += 1
            elif m[2]:
                named[m[1].lower()], i = m[2], i + 1
            elif m[2] is not None or (m[1].lower() not in PS_SWITCH and i + 1 < len(words)
                                      and not re.match(r"-[A-Za-z]", words[i + 1])):
                named[m[1].lower()], i = (words[i + 1] if i + 1 < len(words) else ""), i + 2
            else:
                named[m[1].lower()], i = "", i + 1

        def given(*names):                       # a parameter by its name or an unambiguous start of it (two letters up)
            return next((v for k, v in named.items() for n in names if k == n or (len(k) >= 2 and n.startswith(k))), None)
        if verb in PS_WRITE:
            path = given("path", "literalpath", "filepath", "pspath", "lp")   # -LP is PowerShell 7's LiteralPath alias
            path = bare[0] if path is None and bare else path
            name = given("name") if verb == "new-item" else None
            out.append(f"{path.rstrip('/')}/{name}" if path and name else path or name or "")
        else:
            dest = given("destination", "newname")
            if dest is None:
                named_src = given("path", "literalpath", "pspath") is not None
                dest = bare[-1] if (named_src and bare) or len(bare) > 1 else ""
            out.append(dest)
    return [p for p in out if p]


def writes_picture(cmd, picture, powershell=False):
    """A shell command that writes the film's picture code: a redirect, tee, cp or mv onto it, sed -i on it, the same
    in PowerShell (Set-Content, Add-Content, Out-File, Tee-Object, New-Item, Copy-Item, Move-Item, Rename-Item and
    their aliases), or a Python or Node script that names it and writes a file. The picture name is matched without
    regard to case, since Windows and macOS open FILM.HTML as film.html."""
    if not re.search(picture, cmd, re.I):
        return False
    ends = lambda s: any(re.search(r"(?:" + picture + r")$", t, re.I) for t in s.split())
    # a Python or Node interpreter in command position (a stage start), or a here-string piped into one, running code
    # that writes a file: a note that merely quotes "python -c ..." is an argument, not a command, so it never matches
    runs_py = r"(?:^|[|;&\n]\s*|[({]\s*)(?:\S*[\\/])?(?:python3?|py)(?:\.exe)?\b[^\n|;&]*\s-c\b" \
              r"|['\"]@\s*\|\s*&?\s*(?:\S*[\\/])?(?:python3?|py)(?:\.exe)?\b"
    runs_node = r"(?:^|[|;&\n]\s*|[({]\s*)(?:\S*[\\/])?node(?:\.exe)?\b[^\n|;&]*\s(?:-e|--eval|-p)\b"
    # a script's own path is a whole string; the name inside a sentence it writes into STATE.md is not
    named = re.search(r"['\"`](?:[^'\"`\n]*[\\/])?(?:" + picture + r")\\?['\"`]", cmd, re.I)
    wrote = named and re.search(runs_py, cmd, re.I) and re.search(r"write_text|\.write\(|open\([^)]*['\"][wa]\+?['\"]", cmd)
    noded = named and re.search(runs_node, cmd, re.I) and re.search(r"writeFile|createWriteStream|fs\.write", cmd)
    if powershell:                               # PowerShell: quoted text and here-strings are values, never commands,
        for p in ps_written(cmd, True):          # so a note that quotes "cp a film.html" is not a write
            if ends(p):
                return True
        if wrote or noded:
            return True
        # a .NET write whose call is not itself inside a note's quotes; the picture is the write's target, ended there
        if re.search(r"(?<![\"'])\[(?:System\.)?IO\.File\]::(?:WriteAll|AppendAll)\w*\s*\(\s*['\"]?(?:[^'\")]*[\\/])?(?:" + picture + r")['\"]?\s*[,)]", cmd, re.I) or \
                re.search(r"(?<![\"'])\[(?:System\.)?IO\.File\]::(?:Copy|Move)\s*\([^,)]*,\s*['\"]?(?:[^'\")]*[\\/])?(?:" + picture + r")['\"]?\s*[,)]", cmd, re.I):
            return True
        if re.search(r"(?:^|[|;&\n]\s*|[({]\s*)(?:\S*[\\/])?(?:curl|wget|iwr|Invoke-WebRequest)(?:\.exe)?\b[^;&|\n]*?"
                     r"\s-(?:o|O|OutFile|-output)\s+['\"]?(?:[^\s'\"]*[\\/])?(?:" + picture + r")", cmd, re.I):  # downloaded onto it
            return True
        bare = PS_HERE.sub(" ", re.sub(r"'[^']*'|\"[^\"]*\"", " ", cmd))   # a > redirect, its quoted notes removed
        return bool(re.search(r"(?<![0-9&])>>?\s*['\"]?[^;&|\n]*?(?:" + picture + r")", bare, re.I))
    inline = r"(?<![\w.])(?:python3?|py)(?:\.exe)?\b[^\n]*(?:<<|\s-c\b)|['\"]@\s*\|\s*&?\s*(?:\S*[\\/])?(?:python3?|py)(?:\.exe)?\b"
    if named and re.search(inline, cmd) and re.search(r"write_text|\.write\(|open\([^)]*['\"][wa]\+?['\"]", cmd):
        return True
    if noded:
        return True
    if re.search(r"WriteAll(?:Text|Bytes|Lines)", cmd):
        return True
    seg = r"[^;&|\n]*"
    return any(re.search(p, cmd, re.I) for p in (
        r"(?<![0-9&])>>?\s*['\"]?" + seg + "(?:" + picture + ")",
        r"\btee\b" + seg + "(?:" + picture + ")",
        r"\b(?:cp|mv)\b" + seg + "(?:" + picture + r")['\"]?\s*(?:[;&|\n]|$)",
        r"(?:^|[|;&\n]\s*|[({]\s*)(?:\S*/)?(?:curl|wget)\b" + seg + r"\s-(?:o|O|-output)\s+['\"]?(?:[^\s'\"]*/)?(?:" + picture + r")['\"]?(?:[\s;&|]|$)",
        r"\bsed\s+-i" + seg + "(?:" + picture + ")"))


def card_unwritten(film):
    """Before a film's first picture code, its card names each scene's finishing and the motion design devices (or
    none, and why): finish.md and motion-design.md are choices made on the card, not after. Films with a render
    already are past this point. It checks that the choices are written, never whether they are good."""
    if not film or any(Path(film, "renders").glob("*.mp4")):
        return ""
    if film_mode(Path(film)):
        try:
            road = Path(film, "ROADMAP.md").read_text(encoding="utf-8", errors="replace")
        except OSError:
            return "ROADMAP.md is missing"
        line = re.search(r"^[-*\s]*\**Motion design\**[ \t]*:\**[ \t]*(.*)$", road, re.M | re.I)
        if not line or not line[1].strip():
            return "ROADMAP.md has no Motion design line (the devices and the job each does, or none and why)"
        return "ROADMAP.md's Motion design line is still the template" if "<the devices and the job each does" in line[1] else ""
    try:
        state = Path(film, "STATE.md").read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    card = re.search(r"^[-*\s]*\**Director card\**\s*:\**(.*?)(?=^[-*]\s+\*\*|^#|\Z)", state, re.M | re.S | re.I)
    if not card:
        return "the director card is missing in STATE.md"
    if "<code fit" in card[1]:
        return "the director card in STATE.md is still the template"
    lacks = [w for w, rx in (("each scene's finishing (finish.md)", r"finish|doku|bitiş|texture|grain|gren"),
                             ("the motion design devices and their jobs, or none and why (motion-design.md)",
                              r"motion|hareket"))
             if not re.search(rx, card[1], re.I)]
    return ("the director card in STATE.md does not name " + " or ".join(lacks)) if lacks else ""


def build_rules_unread(ev, name, inp):
    """The film's picture code is written by a chat that has read how a world is built (quick-mode.md: the renderer and
    Half size, never half detail; finish.md) and probed the GPU, as the tools answered it; a helper carries those rules
    in its brief (brief.py picture)."""
    path, cmd = str(inp.get("file_path", "")), str(inp.get("command", ""))
    picture = r"film\.html|engine[\\/](?:[^\s'\"]+[\\/])?[^\\/\s'\"]+\.(?:html|mjs)"
    if name in ("Write", "Edit", "MultiEdit"):
        if not re.search(r"(?:" + picture + r")$", path, re.I):
            return ""
    elif name in SHELLS:                         # the same code written from the shell: a heredoc, a script, a copy
        if not writes_picture(cmd, picture, name == "PowerShell"):
            return ""
    else:
        return ""
    if ev.get("agent_id"):
        brief = helper_text(ev)
        if brief is not None and all(m in brief for m in (BUILD_READ[0], BUILD_READ[2], BUILD_READ[3])):
            film = (film_of_path(path, ev.get("cwd", ".")) if path else None) or film_dir(ev.get("cwd", "."))
            why = card_unwritten(film)
            return ("cinecode: before the film's picture code, " + why + "; stop and report it, the main chat writes "
                    "the card.") if why else ""
        return ("cinecode: a helper that writes the film's picture carries the build rules in its brief: the main chat "
                "builds it with python3 tools/brief.py picture --task ... (it quotes Half size, never half detail and the "
                "finish toolbox); this brief does not, or cannot be read, so stop and report that.")
    answers = tool_results(ev.get("transcript_path", ""))
    missing = [m for m in BUILD_READ if m not in answers]
    probed = "[capture] renderer:" in answers
    if not missing and probed:
        cwd = ev.get("cwd", ".")
        film = (film_of_path(path, cwd) if path else None) or film_dir(cwd) or next(iter(films_here(cwd, cmd)), None)
        why = card_unwritten(film)
        return ("cinecode: before the film's picture code, " + why + ": write it there, then the code.") if why else ""
    return ("cinecode: before the film's picture code, " + ("" if probed else "probe the GPU (node KIT/scripts/capture.mjs "
            "--url KIT/starter/index.html --probe) and ") + "read how a world is built (it is not in the parts read so "
            "far): in KIT/references/quick-mode.md the paragraphs that start '- **Renderer:' and '**Half size, never half "
            "detail', and KIT/references/finish.md whole (the Read tool, or grep for the lines; KIT = this skill's folder). Then build every world at that detail, with "
            "the finishing devices each scene takes, and write the code.")


def tool_results(transcript):
    """The text the tools answered in this chat (never the model's own words): proof that a step ran, where the model's
    prose would only name it."""
    answers = []
    try:
        lines = Path(transcript).read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return ""
    for line in lines:
        try:
            c = (json.loads(line).get("message") or {}).get("content")
        except ValueError:
            continue
        for b in c if isinstance(c, list) else []:
            if isinstance(b, dict) and b.get("type") == "tool_result" and not b.get("is_error"):
                out = b.get("content")
                answers.append(" ".join(x.get("text", "") for x in out if isinstance(x, dict)) if isinstance(out, list)
                               else str(out or ""))
    return "\n".join(answers)


def films_here(cwd, cmd="", text=""):
    """The film a step works on: the one the command cds into, the one the chat is inside, the one the question or
    the user's last message names (folder or title), else the shelf's most recently active film; never every film."""
    for m in re.finditer(r"\b(?:cd|Set-Location|pushd)\s+(?:-Path\s+)?['\"]?([^'\";&|\s]+)", cmd or "", re.I):
        d = Path(m.group(1)).expanduser()
        d = d if d.is_absolute() else Path(cwd) / d
        found = film_dir(d)
        if found:
            return [found]
    here = film_dir(cwd)
    if here:
        return [here]
    shelf = [f for f in films_below(cwd) if (f / "STATE.md").is_file()]
    for part in (text.split("\n")[0], text):      # the question first, then the user's own words beside it
        low = plain(part)
        said = lambda w: len(w) >= 4 and re.search(r"(?<!\w)" + re.escape(w) + r"(?!\w)", low)
        refused = lambda w: re.search(r"\b(?:not|no|except|hariç)\s+" + re.escape(w) + r"(?!\w)|(?<!\w)" + re.escape(w) +
                                      r"\s+(?:değil|hariç|olmasın)\b", low)
        named = [f for f in shelf if low and any(said(w) and not refused(w) for w in (plain(f.name), plain(film_title(f))))]
        if len(named) == 1:
            return named
    low = plain(text)
    out = [f for f in shelf if any(re.search(r"\b(?:not|no|except|hariç)\s+" + re.escape(w) + r"(?!\w)|(?<!\w)" + re.escape(w) +
                                             r"\s+(?:değil|hariç|olmasın)\b", low) for w in (plain(f.name), plain(film_title(f))) if w)]
    shelf = [f for f in shelf if f not in out]   # never the film the user said "not" to
    return [max(shelf, key=lambda f: (f / "STATE.md").stat().st_mtime)] if shelf else []


def film_title(f):
    try:
        first = (Path(f) / "STATE.md").read_text(encoding="utf-8", errors="replace").splitlines()[0]
    except (OSError, IndexError):
        return ""
    return re.sub(r"^#\s*(State|Durum)\s*:\s*|\s*\(.*$", "", first).strip()


def session_start(transcript):
    """When this chat began: its first logged moment (0 when it cannot be read)."""
    try:
        with open(transcript, encoding="utf-8", errors="replace") as h:
            for line in h:
                stamp = (json.loads(line) or {}).get("timestamp")
                if stamp:
                    import datetime
                    return datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
    except (OSError, ValueError, AttributeError):
        pass
    return 0.0


def last_said(transcript):
    """The user's last typed message in this chat."""
    try:
        lines = Path(transcript).read_text(encoding="utf-8", errors="replace").splitlines()[-400:]
    except OSError:
        return ""
    for line in reversed(lines):
        try:
            said = typed(json.loads(line))
        except ValueError:
            continue
        if said:
            return said
    return ""


def dealt_at(d):
    import datetime
    try:
        return datetime.datetime.fromisoformat(str(d.get("at"))).timestamp()
    except ValueError:
        return float("inf")


def spark_round(f):
    """When the film's latest spark hand was dealt: the files of the ideas written after it belong to its round, also
    in a chat that resumed the film. None without a hand."""
    try:
        deals = json.loads((f / "history.json").read_text(encoding="utf-8")).get("deals", [])
        times = [dealt_at(d) for d in deals if d.get("category") == "spark" and d.get("dealt")]
    except (OSError, ValueError, AttributeError):
        return None
    return max(times) if times else None


def this_round(f, at, since):
    r = spark_round(f)
    return at >= since - 120 or (r is not None and r != float("inf") and at >= r - 120)


def dealt(films, category, since=0.0):
    """A hand of this category, with its cards, is logged in the film's history.json (deal.py writes it), in this
    chat when its start is known."""
    when = dealt_at
    for f in films:
        h = f / "history.json"
        try:
            if any(d.get("category") == category and d.get("dealt") and (when(d) >= since - 120 or not d.get("pick"))
                   for d in json.loads(h.read_text(encoding="utf-8")).get("deals", [])):
                return True
        except (OSError, ValueError, AttributeError):
            continue
    return False


IDEA_ASK = re.compile(r"\b(fiki?r\w*|yorum\w*|açı(dan|sı)\w*|angle|interpretation\w*|ideas?)\b", re.I)


def asked_text(inp):
    return " ".join(str(q.get("question", "")) + " " + str(q.get("header", "")) for q in inp.get("questions") or []) \
        + " " + str(inp.get("ask", ""))


IDEA_HEADER = re.compile(r"\b(fiki?r\w*|yorum\w*|idea|angle|hikâye\w*|hikaye\w*|story|omurga\w*)\b", re.I)
NOT_IDEA = re.compile(r"jüri|jury|format|taslak|draft|final|yazı|text|font|müzik|music|ses\b|sound|mevcut|existing|"
                      r"bu klasörde|aynı fikir\w*|sürdür\w*|already", re.I)


def offers_ideas(inp):
    """A question that offers the film's ideas: its header names them, or its first sentence asks for one."""
    qs = list(inp.get("questions") or []) + ([{"question": inp["ask"]}] if inp.get("ask") else [])
    for q in qs:
        text = str(q.get("question", ""))
        if NOT_IDEA.search(text.split("?")[0]):
            continue
        if IDEA_HEADER.search(str(q.get("header", ""))) and not NOT_IDEA.search(str(q.get("header", ""))):
            return True
        if IDEA_ASK.search(text.split("?")[0]) and not NOT_IDEA.search(text.split("?")[0]):
            return True
    return False


def ideas_unprepared(ev, inp):
    """The film's ideas are offered after the prediction test, the sparks and the overlap check (writing.md §1,
    quick-mode.md question 1), checked on disk: research/predict.md and research/overlap.md written by helpers, a
    spark deal in history.json."""
    if not offers_ideas(inp):
        return ""
    tp = ev.get("transcript_path", "")
    films = films_here(ev.get("cwd", "."), "", asked_text(inp) + "\n" + last_said(tp))
    if not films:
        return ""
    missing = idea_prep_missing(films, tp) or \
        ([] if any(overlap_checked(f, session_start(tp)) for f in films) else
         ["the overlap check (the candidates in research/candidates.md, then python3 tools/brief.py overlap --task "
          "\"<the user's first message, quoted>\"; a helper with that brief writes research/overlap.md after the "
          "latest candidates and predictions)"])
    if not missing:
        return ""
    return ("cinecode: the ideas come after " + " and ".join(missing) + ". Run them, write the candidates from the "
            "sparks, and offer none the overlap check marked OVERLAP.")


def overlap_checked(f, since):
    """research/overlap.md judged the latest candidates against the latest predictions, in this round."""
    o, c, p = (f / "research" / n for n in ("overlap.md", "candidates.md", "predict.md"))
    try:
        text, at = o.read_text(encoding="utf-8"), o.stat().st_mtime
    except OSError:
        return False
    if not re.search(r"\b(CLEAR|SHARES|OVERLAP)\b", text) or any(x.is_file() and x.stat().st_mtime > at for x in (c, p)):
        return False
    return this_round(f, at, since)


def idea_prep_missing(films, tp):
    """What a film's ideas still wait for: the prediction test on disk (research/predict.md) and a spark deal."""
    since = session_start(tp)

    def made(f):
        p = f / "research" / "predict.md"
        try:
            text, at = p.read_text(encoding="utf-8"), p.stat().st_mtime
        except OSError:
            return None
        return at if len([l for l in text.splitlines() if len(l.split()) >= 3]) >= 3 else None

    def carried(f):                    # a resumed chat: the hand and the predictions of a round an earlier chat began
        at = made(f)
        return at is not None and at < since - 120 and this_round(f, at, since)
    return ([] if any(made(f) is not None and this_round(f, made(f), since) for f in films) else
            ["the prediction test (python3 tools/brief.py predict --task \"<the user's first message, quoted>\"; a "
             "helper with that brief writes research/predict.md)"]) + \
           ([] if dealt(films, "spark", since) or any(carried(f) for f in films) else
            ["the sparks (python3 tools/deal.py deal spark)"])


HABIT_IMAGES = {   # images generated films reach for by habit: in a plan only when the user asked for them
    "a lighthouse or lanterns (fener)": r"lighthouse|lantern|\bfener(ler|leri|lerin|lerle|i|in|e|de|den|le)?\b",
    "neon": r"\bneon",
    "floating balloons": r"balloon|\bbalon(lar|ları|ların|u|un|la)?\b",
}


NOT_WANTED = re.compile(r"\b(olmas[ıi]n|olmayacak|olmasın|istemiyorum|istemem|istemedi\w*|kullanma\w*|koyma\w*|yok|"
                        r"değil|hariç|yasak|no|not|without|never|don'?t|avoid)\b", re.I)


def users_words(transcript):
    """What the user typed in this chat, and their answers to its questions."""
    try:
        lines = Path(transcript).read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return ""
    out = []
    for line in lines:
        try:
            r = json.loads(line)
        except ValueError:
            continue
        said = typed(r)
        if said and not said.lstrip().startswith("Base directory for this skill"):
            out.append(said)
        elif r.get("type") == "user":
            for b in (r.get("message") or {}).get("content") or []:
                if isinstance(b, dict) and b.get("type") == "tool_result" and "answered" in str(b.get("content"))[:200]:
                    out.append(str(b.get("content")))
    return "\n".join(out)


def habit_image_unasked(ev, name, inp):
    """A plan (STATE.md, ROADMAP.md, SCRIPT.md) never brings in an image generated films reach for by habit unless the
    user asked for it: the user's own words decide, never the model's default."""
    path = str(inp.get("file_path", ""))
    if name not in ("Write", "Edit", "MultiEdit") or Path(path).name not in ("STATE.md", "ROADMAP.md", "SCRIPT.md"):
        return ""
    p = Path(path) if os.path.isabs(path) else Path(ev.get("cwd", ".")) / path
    try:
        before = p.read_text(encoding="utf-8")
    except (OSError, ValueError):
        before = ""
    after = notes_after(str(p), name, inp)
    new = [k for k, rx in HABIT_IMAGES.items() if re.search(rx, after, re.I) and not re.search(rx, before, re.I)]
    if not new:
        return ""
    sentences = re.split(r"[.!?\n;]+", users_words(ev.get("transcript_path", "")))
    wanted = lambda rx: any(re.search(rx, s, re.I) and not NOT_WANTED.search(s) for s in sentences)
    reasons = "\n".join(l for l in after.splitlines() if re.search(r"\*\*Habit image", l, re.I))
    unasked = [k for k in new if not wanted(HABIT_IMAGES[k]) and not re.search(HABIT_IMAGES[k], reasons, re.I)]
    if not unasked:
        return ""
    return ("cinecode: this plan brings in " + ", ".join(unasked) + ", an image generated films reach for by habit, "
            "without a reason. Keep it when this story needs it: say why on the plan (- **Habit image:** <the image>: "
            "<why this story needs it>); otherwise draw this story's own image.")


IDEA_LINE = re.compile(r"^\s*-\s*\*\*Idea:\*\*[ \t]*[^\s<]", re.M)
USERS_OWN = re.compile(r"\((?:the )?user(?:'s)?(?: own| brief)?\b[^)]*\)|\(kullanıcı\w*[^)]*\)", re.I)


def idea_unprepared(ev, name, inp):
    """A film's idea is written into STATE.md only after the prediction test and the sparks, also when the user left
    the idea to the agent ("beni şaşırt"): skipping the ideas question must not skip what catches the obvious film."""
    path = str(inp.get("file_path", ""))
    if name not in ("Write", "Edit", "MultiEdit") or Path(path).name != "STATE.md":
        return ""
    p = Path(path) if os.path.isabs(path) else Path(ev.get("cwd", ".")) / path
    try:
        before = p.read_text(encoding="utf-8")
    except (OSError, ValueError):
        before = ""
    after = notes_after(str(p), name, inp)
    if IDEA_LINE.search(before) or not IDEA_LINE.search(after):
        return ""
    line = re.search(r"^\s*-\s*\*\*Idea:\*\*.*$", after, re.M)
    if line and USERS_OWN.search(line.group(0)):                 # a complete brief or an idea the user named
        return ""
    missing = idea_prep_missing([p.parent], ev.get("transcript_path", ""))
    if not missing:
        return ""
    return ("cinecode: an idea you chose is written after " + " and ".join(missing) + ", also when the user left the "
            "idea to you (\"beni şaşırt\", \"sen seç\"): the predictions catch the obvious film. Run them, then offer the "
            "ideas as a question (quick-mode.md §1). When the idea is the user's own (a complete brief, an idea they "
            "named), write it as they gave it and mark it so: - **Idea:** <their idea> (user).")


def board_unprepared(ev, name, inp):
    """The direction board starts from the dealt references (deal.py deal look), never from the same few names."""
    cmd = str(inp.get("command", ""))
    if name not in SHELLS or not re.search(r"direction\.py['\"]?\s+board", cmd):
        return ""
    try:
        log = Path(ev.get("transcript_path", "")).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    films = films_here(ev.get("cwd", "."), cmd, last_said(ev.get("transcript_path", "")))
    states = [(f / "STATE.md").read_text(encoding="utf-8", errors="replace") for f in films if (f / "STATE.md").is_file()]
    named = any(re.search(r"\*\*Look named:\*\*\s*\S", s) for s in states)
    if states and not named and not any(re.search(r"\*\*Medium:\*\*\s*[^\s<]", s) for s in states):
        return ("cinecode: the board is drawn inside the film's medium, and the medium is the user's choice: ask it in the "
                "first question call (Biçim / Medium: quick-mode.md §1, 1a; Film mode Q2), write the answer in STATE.md "
                "(- **Medium:** <in the user's words>), then deal the references and draw the board inside it.")
    if named or dealt(films, "look") or (not films and "deal look" in log):
        return ""
    return ("cinecode: the direction board starts from six dealt references: python3 tools/deal.py deal look; build the "
            "three rows that serve this idea from them (differing in kind and tone), then draw the board. When the user "
            "named the look, write it in STATE.md first (- **Look named:** <the name>) and board its readings.")


def script_sha(film):
    try:
        return hashlib.sha1((Path(film) / "SCRIPT.md").read_bytes()).hexdigest()
    except OSError:
        return ""


def note_script(film, which):
    """Remember the script's content when its cold read is about to be written ("cold", pending until the report
    really changes) or when it first reaches the user ("shown"), so the gate compares words, never file times."""
    try:
        (Path(film) / "review").mkdir(exist_ok=True)
        name = ".script-cold.pending" if which == "cold" else f".script-{which}.sha"
        (Path(film) / "review" / name).write_text(f"{script_sha(film)} {time.time():.3f}", encoding="utf-8")
    except OSError:
        pass


def noted(film, which):
    review = Path(film) / "review"
    if which == "cold":                          # a pending fingerprint counts once the report was written after it
        try:
            sha, at = (review / ".script-cold.pending").read_text(encoding="utf-8").split()
            if (review / "script-cold.md").stat().st_mtime >= float(at) - 1:
                (review / ".script-cold.sha").write_text(sha, encoding="utf-8")
                (review / ".script-cold.pending").unlink()
        except (OSError, ValueError):
            pass
    try:
        return (review / f".script-{which}.sha").read_text(encoding="utf-8").split()[0]
    except (OSError, IndexError):
        return ""


def shown_script(ev, inp):
    """A script question passed its gates: the user now reads this version (later edits follow their notes)."""
    if script_question(inp):
        for f in films_here(ev.get("cwd", "."), "", asked_text(inp)):
            if (f / "SCRIPT.md").is_file() and not noted(f, "shown"):
                note_script(f, "shown")


def cold_read_missing(ev, inp, shown=False, films=None):
    """Film mode: the script reaches the user (asked about or sent) after a cold read of this version
    (film-mode.md Step 3: review/script-cold.md): written after the script's last change, or in this chat with the
    script changed since when its verdict was FIX."""
    if not shown and not script_question(inp):
        return ""
    tp = ev.get("transcript_path", "")
    films = [f for f in (films or films_here(ev.get("cwd", "."), "", asked_text(inp) + "\n" + last_said(tp)))
             if (f / "SCRIPT.md").is_file() and film_mode(f)]
    since = session_start(tp)
    for f in films:
        cold, script = f / "review" / "script-cold.md", f / "SCRIPT.md"
        try:
            report, at, changed = cold.read_text(encoding="utf-8", errors="replace"), cold.stat().st_mtime, \
                script.stat().st_mtime
        except OSError:
            report, at, changed = "", 0.0, 0.0
        fix = re.search(r"verdict\W*\s*fix\b", report, re.I)
        read_of, now = noted(f, "cold"), script_sha(f)
        if read_of:                               # the words the cold reader read, against the words now
            current = len(report.encode("utf-8")) >= 200 and (
                (now == read_of and not fix) or (fix and now != read_of) or (bool(noted(f, "shown")) and not fix))
        else:
            current = len(report.encode("utf-8")) >= 200 and (
                (at >= changed - 1 and not fix) or (at >= since - 120 and (not fix or changed > at + 1)))
        text = script.read_text(encoding="utf-8", errors="replace")
        if not shown and not script_question(inp, text):
            continue
        if script_rows(text) and not current:
            return ("cinecode: in Film mode the script reaches the user after a cold read: a fresh helper (python3 "
                    "tools/brief.py review --task \"cold read of the script\" --writes review/script-cold.md ...) reads only "
                    "its lines and writes where it had to guess; fix those, then show the whole script and ask.")
    return ""


def gates(ev, name, inp):
    """The rules that a text alone did not carry: checked where the work happens."""
    film = film_for(ev, inp)
    if name in ("Agent", "Task") and film_mode(film) and not ev.get("agent_id") \
            and not ("<!-- cinecode brief:" in str(inp.get("prompt", ""))
                     and "# The kit's rules for this task" in str(inp.get("prompt", ""))
                     and re.search(r"^WRITES:", str(inp.get("prompt", "")), re.M)):
        return ("cinecode: a helper starts cold and reads nothing on its own, so the kit's rules travel in its brief. "
                "Build it with python3 tools/brief.py <kind> --task \"…\" --writes \"<its own files>\" --reads \"…\" --done \"…\" "
                "(kinds: python3 tools/brief.py list), pass the whole output as the prompt and the model it prints.")
    why = build_rules_unread(ev, name, inp) or board_unprepared(ev, name, inp) or idea_unprepared(ev, name, inp) \
        or habit_image_unasked(ev, name, inp)
    if why:
        return why
    keep = r"^#+\s*(Keep|Korunan)|^\*\*(Keep|Korunan)"
    notes = str(inp.get("file_path", ""))
    is_notes = bool(re.search(r"(^|[\\/])notes[\\/]round-\d+\.md$", notes))
    if is_notes and name in ("Write", "Edit", "MultiEdit") and not re.search(keep, notes_after(notes, name, inp), re.M | re.I):
        return ("cinecode: a notes round starts with the keep list: what the user praised, in their words (\"## Keep\", "
                "or \"## Keep\" with \"none\" when they praised nothing). Fixes and re-plans may not change those parts.")
    if name.endswith("SendUserFile"):
        for f in inp.get("files") or []:
            p = Path(f if os.path.isabs(f) else Path(ev.get("cwd", ".")) / f)
            film = film_of_path(p, ev.get("cwd", ".")) or film_dir(ev.get("cwd", "."))
            if not film_mode(film):
                continue
            if p.name == "SCRIPT.md":
                why = cold_read_missing(ev, inp, shown=True, films=[film])
                if why:
                    return why
                if not noted(film, "shown"):
                    note_script(film, "shown")
            if p.suffix.lower() in (".mp4", ".mov") and "draft" in p.name.lower() and p.is_file():
                report = film / "logs" / f"check-{p.stem}.txt"
                if not report.is_file() or report.stat().st_mtime < p.stat().st_mtime:
                    return (f"cinecode: a Film-mode cut is shown after its checks: python3 tools/make.py check "
                            f"renders/{p.name} (darkness, blank frames, the sound floor and sync, rhythm, the hook); fix "
                            "what it holds, or tell the user with the cut what was left and why, then show the cut.")
            if p.suffix.lower() in (".mp4", ".mov") and "draft" in p.name.lower() and p.is_file() and duration(p) > 180:
                v = re.search(r"-v(\d+)", p.name)
                tests = [t for t in (film / "review").glob(f"comprehension-v{v.group(1)}.md" if v else "comprehension-*.md")
                         if t.stat().st_size >= 400]
                if not any(t.stat().st_mtime >= p.stat().st_mtime for t in tests):
                    return ("cinecode: a story this long is shown after the cold comprehension test on this cut: a fresh "
                            "helper (python3 tools/brief.py review --task ...) that knows nothing gets the narration "
                            "transcript and the sheet and writes review/comprehension-vN.md (what happened, who, why, the "
                            "order, what stayed unclear); fix its red items, then show the draft.")
    return ""


def image_size(path):
    with open(path, "rb") as f:
        head = f.read(32)
        if head[:8] == b"\x89PNG\r\n\x1a\n":
            return struct.unpack(">II", head[16:24])
        if head[:6] in (b"GIF87a", b"GIF89a"):
            return struct.unpack("<HH", head[6:10])
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            kind = head[12:16]
            if kind == b"VP8X":
                return 1 + int.from_bytes(head[24:27], "little"), 1 + int.from_bytes(head[27:30], "little")
            f.seek(0)
            data = f.read(40)
            if kind == b"VP8 ":
                w, h = struct.unpack("<HH", data[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if kind == b"VP8L":
                b = int.from_bytes(data[21:25], "little")
                return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
        if head[:2] == b"\xff\xd8":
            f.seek(2)
            while True:
                marker = f.read(2)
                if len(marker) < 2 or marker[0] != 0xFF:
                    return None
                if marker[1] in (0xD8, 0x01) or 0xD0 <= marker[1] <= 0xD7:
                    continue
                length = struct.unpack(">H", f.read(2))[0]
                if 0xC0 <= marker[1] <= 0xCF and marker[1] not in (0xC4, 0xC8, 0xCC):
                    h, w = struct.unpack(">xHH", f.read(5))
                    return w, h
                f.seek(length - 2, 1)
    return None


def once(session, key):
    STATE_DIR.mkdir(exist_ok=True)
    mark = STATE_DIR / f"{session}-{key}"
    if mark.exists():
        return False
    mark.touch()
    return True


def seen(ev):
    """A trace that the hooks ran in this session (read when the session is reviewed; no content, just the id)."""
    STATE_DIR.mkdir(exist_ok=True)
    (STATE_DIR / f"active-{ev.get('session_id', 'x')}").touch()


def prompt(ev):
    if not film_near(ev.get("cwd", ".")):
        return 0
    seen(ev)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from usage import last_context
    ctx = last_context(ev.get("transcript_path", ""))
    session = ev.get("session_id", "x")
    if ctx >= FIRM and once(session, "firm"):
        print(f"cinecode: this chat is {ctx // 1000} K tokens and every step re-reads all of it. After answering this "
              "message, bring STATE.md up to date (phase, last output, open notes, next action; \"Resume here\" in Film "
              "mode), save a snapshot, and ask the handoff question (KIT/templates/HANDOFF.md): a new chat (Claude desktop app: mcp__ccd_session__start_session, which starts by itself; elsewhere tools/handoff.py), or continue here. "
              "Say it once; if the user prefers to stay, continue here.")
    elif SOFT <= ctx < FIRM and once(session, "soft"):
        print(f"cinecode: this chat is {ctx // 1000} K tokens. At the next gate (after a draft or a delivery), "
              "bring STATE.md up to date and offer the handoff to a new chat. Until then keep the work here, lean: "
              "tools/make.py, small images, logs in files (in Quick mode never hand a build or a revision to a helper).")
    return 0


TR_WORDS = {"ve", "bir", "bu", "için", "mi", "mı", "ne", "ya", "bana", "yap", "ile", "da", "de", "ama", "çok", "nasıl",
            "olsun", "istiyorum", "hangi", "hangisi", "mu", "değil", "gibi", "şu", "evet", "hayır", "lütfen", "neden",
            "tamam", "devam", "olur", "peki", "yapalım", "yapmak", "kısa", "reklam", "sonra", "önce", "biraz"}
EN_WORDS = {"the", "and", "you", "your", "which", "what", "should", "with", "for", "this", "that", "would", "is",
            "are", "of", "to", "a", "an", "do", "how", "make", "want", "film", "yes", "no", "please", "why", "or"}


def language(text):
    """'tr', 'en' or None: Turkish and English against each other by their small function words, so a Turkish name in
    an English line does not flip it. A Turkish letter counts as Turkish only in a lowercase
    word, never a Capitalised name; a short Turkish opener (a function word or a lowercase accented word, no English
    around it) is enough."""
    norm = text.replace("İ", "i").replace("I", "ı") if re.search(r"[çğıöşüÇĞİÖŞÜ]", text) else text
    raw = re.findall(r"[A-Za-zÇĞİÖŞÜçğıöşüâîû]+", norm)
    words = [w.lower() for w in raw]
    tr_fn = sum(w in TR_WORDS for w in words)
    en_fn = sum(w in EN_WORDS for w in words)
    tr_content = sum(1 for w in raw if len(w) >= 2 and w == w.lower()         # lowercase and real, so not a name and
                     and any(ch in "çğıöşü" for ch in w))                     # not a lone ı from an English "I"
    tr = tr_fn + tr_content
    if en_fn >= 3 and en_fn > tr:
        return "en"
    if tr >= 2 and tr >= en_fn:
        return "tr"
    if en_fn == 0 and tr >= 1:               # a short Turkish line with no English word in it
        return "tr"
    return None


NOT_THE_USER = ("Stop hook feedback", "Another Claude session sent a message", "Caveat:", "[Request interrupted",
                "PreToolUse", "PostToolUse", "UserPromptSubmit hook", "[Image", "[Subagent",
                "This session is being continued", "Background (from the session")   # hooks and helpers speak as "user" in the log
HANDOFF_OPENING = {"STATE.md'den devam et": "tr", "Continue from STATE.md": "en"}   # the lines handoff.py LINES sends


def user_language(transcript):
    """The language of the user's own latest message that shows one: their typed words, never a pasted brief, an image
    placeholder or a helper's hand-back."""
    try:
        lines = Path(transcript).read_text(encoding="utf-8", errors="replace").splitlines()[-400:]
    except OSError:
        return None
    for line in reversed(lines):
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if r.get("type") != "user" or r.get("isSidechain"):
            continue
        c = (r.get("message") or {}).get("content")
        if isinstance(c, list):
            if any(isinstance(x, dict) and x.get("type") == "tool_result" for x in c):
                continue
            c = " ".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text")
        if not isinstance(c, str):
            continue
        args = re.search(r"<command-args>(.*?)</command-args>", c, re.S)       # a slash command: its words are the user's
        if args:
            c = args.group(1)
        c = re.sub(r"<pasted_content[^>]*>.*?</pasted_content[^>]*>", " ", c, flags=re.S)
        c = re.sub(r"\[Image[^\]]*\]", " ", c)
        handed = next((lang for line, lang in HANDOFF_OPENING.items() if line in c), None)
        if handed:                           # a handoff prompt: the rest of it is the kit's English, its opening line is theirs
            return handed
        if c.strip() and not c.lstrip().startswith("<") and not c.lstrip().startswith(NOT_THE_USER) \
                and "Base directory for this skill" not in c:
            found = language(c[:2000])
            if found:
                return found
    return None


def question_language_check(ev, inp):
    """A question box in another language than the user writes in is stopped and asked again in theirs."""
    want = user_language(ev.get("transcript_path", ""))
    if not want:
        return 0
    # Only the question stems and headers: options carry names (films, styles, brands, places) in any language.
    # Capitalised words inside a sentence are names too (a film title, a brand), so they are left out.
    parts = []
    for q in inp.get("questions") or []:
        for s in (q.get("question", ""), q.get("header", "")):
            s = re.sub(r"[\"“”'‘’«»][^\"“”'‘’«»]*[\"“”'‘’«»]", " ", s)
            parts.append(re.sub(r"(?<![.!?:]\s)(?<!^)\b[A-ZÇĞİÖŞÜ][\wçğıöşü'’-]*", " ", s.strip()))
    got = language(" ".join(parts))
    if got and got != want:
        name = {"tr": "Turkish", "en": "English"}[want]
        print(f"cinecode: the user writes in {name}; this question box is not. Ask it again in {name}: the question, "
              f"the header and every option and description (names of styles, tools and films may stay as they are).",
              file=sys.stderr)
        return 2
    return 0


SHOWN_BY = re.compile(r"\s*(?:(?:cd|Set-Location|pushd)\s+\S+\s*)?(?:\w+=\S*\s+)*(?:&\s*)?"
                      r"(?:\"[^\"\n]*python3?(?:\.exe)?\"\s+|\S*python3?\S*\s+|py(?:\.exe)?(?:\s+-(?:3(?:\.\d+)?|V:\S+))?\s+)?"
                      r"\S*?(make\.py\s+(stills|draft|final|wait)"
                      r"|styles\.py\s+(board|suggest[^\n;&|]*--board)|asset_search\.py\s+board|direction\.py\s+board)")
HEREDOC = re.compile(r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?\n\s*\1\s*(?:\n|$)", re.S)


VIEWER = re.compile(r"\s*(?:\w+=\S*\s+)*(?:command\s+|cmd(?:\.exe)?\s+/c\s+)?(open|xdg-open|qlmanage|start|Start-Process"
                    r"|saps|Invoke-Item|ii|explorer(?:\.exe)?)\s+(?!-a\s+Terminal)[^;&|]*\."
                    r"(jpe?g|png|webp|gif|mp4|mov|m4v|html?|pdf|wav|mp3|mka|flac|ogg|oga|opus|aac|m4a)\b", re.I)


def unquoted(cmd):
    """A quoted word is one word: its spaces held, its quotes dropped ("C:/My Films/film/tools/make.py" draft)."""
    return re.sub(r"\"([^\"\n]*)\"|'([^'\n]*)'", lambda m: (m[1] if m[1] is not None else m[2]).replace(" ", "\x01"), cmd)


def shown_by(cmd):
    """The showing step a Bash command really runs: a heredoc's body or a line of text that names a tool is not a run."""
    for part in re.split(r"&&|\|\||[;\n|]", HEREDOC.sub("\n", cmd)):
        m = SHOWN_BY.match(part) or SHOWN_BY.match(unquoted(part))
        if m:
            return m.group(1).replace("\x01", " ")
    return ""


def unshown(transcript):
    """What a tool last made for the user's eyes (a board, stills, a draft) when it has not been sent with SendUserFile
    since. Empty when the app has no SendUserFile (then the path in the message is the way)."""
    try:
        text = Path(transcript).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    desktop = "desktop" in os.environ.get("CLAUDE_CODE_ENTRYPOINT", "") or \
        os.environ.get("CLAUDE_CODE_ENTRYPOINT", "") in ("local-agent", "local_agent")
    if not desktop and not re.search(r'"name":\s*"(mcp__[\w-]+__)?SendUserFile"', text):
        return ""
    pending, made, sends, reads, seen, cleared = "", {}, {}, set(), set(), set()
    for line in text.splitlines()[-800:]:
        try:
            content = (json.loads(line).get("message") or {}).get("content")
        except ValueError:
            continue
        for b in content if isinstance(content, list) else []:
            kind, name, inp = b.get("type"), str(b.get("name", "")), b.get("input") or {}
            if kind == "tool_use" and name.endswith("SendUserFile"):
                # retired when sent: a question in the same turn is checked before the send's result is in the log
                sends[b.get("id")] = (pending, cleared)
                pending, cleared = "", cleared | seen
            elif kind == "tool_use" and name in ("Read", "Grep") and MAKE_OUT.search(str(inp.get("file_path") or inp.get("path") or "")):
                reads.add(b.get("id"))              # a background render's summary file, read back for its marker
            elif kind == "tool_use" and name in SHELLS:
                what = shown_by(inp.get("command", ""))
                if what:
                    made[b.get("id")] = what
            elif kind == "tool_result":
                ref = b.get("tool_use_id")
                out = b.get("content")
                out = " ".join(x.get("text", "") for x in out if isinstance(x, dict)) if isinstance(out, list) else str(out)
                mark = deliverable(out, SHOWN_LINE)      # keyed by the output file, so a wait re-print is the same mark
                if ref in sends:
                    if b.get("is_error"):           # a send that failed shows nothing: what it retired is pending again
                        pending, cleared = sends[ref]
                elif ref in made:
                    what = made.pop(ref)
                    if mark and not (what.endswith("wait") and mark in cleared):   # a fresh making command always arms;
                        pending = what or "the draft"                              # only make.py wait can re-print a line
                        seen.add(mark)
                elif ref in reads and mark and mark not in cleared:   # a summary file read back, never a kit read
                    pending = pending or "the draft"
                    seen.add(mark)
    return pending


MAKE_OUT = re.compile(r"(?:last-make\.txt|run-\d+\.txt|make\.(?:out|running))$|\.output$", re.I)  # a render's summary file
SHOWN_LINE = re.compile(r"(?:show the user:|SHOW THIS DRAFT NOW:|^final v\d+:)[^\n]*", re.M)  # the whole marker line
DELIVERABLE = re.compile(r"[\w./\\-]+\.(?:mp4|mov|m4v|jpg|jpeg|png)", re.I)   # the output file names a deliverable


def deliverable(out, line_re):
    """A marker's deliverable, keyed by its output file (draft-v2.mp4, stills-1.jpg): stable across a wait re-print's
    extra note, different for v1 and v2. The line itself when it names no file, and '' on a failure."""
    m = line_re.search(out)
    if not m or re.search(r"FAILED|NOT DELIVERED|\(not delivered\)|Traceback", out):
        return ""
    f = DELIVERABLE.search(m.group(0))
    return f.group(0).rsplit("/", 1)[-1].rsplit("\\", 1)[-1] if f else m.group(0).strip()


SHOW_FIRST = ("cinecode: the user has not seen what `{}` made. Send it first with SendUserFile (display 'render', status "
              "'normal', a one-line caption in the user's language): the board, the stills sheet, or the draft and its poster, "
              "as the tool printed under \"show the user\". It opens big in the app's side panel; reading it yourself shows "
              "the user only a tiny thumbnail.")


def open_gate(transcript, cwd="."):
    """A delivered draft that no question has followed yet: "quick" (make.py said SHOW THIS DRAFT NOW, or a Quick
    film's draft was sent), "film" (a Film-mode draft was sent), or "" once a question was shown. A question tool
    that fails leaves the gate open."""
    try:
        lines = Path(transcript).read_text(encoding="utf-8", errors="replace").splitlines()[-800:]
    except OSError:
        return ""
    waiting, drafts, sends, reads, asks, seen, cleared = "", set(), {}, set(), {}, set(), set()
    unasked, sent = set(), {}              # sends no question has followed yet; sends whose result came back
    for line in lines:
        try:
            content = (json.loads(line).get("message") or {}).get("content")
        except ValueError:
            continue
        for b in content if isinstance(content, list) else []:
            kind, name, inp = b.get("type"), b.get("name", ""), b.get("input") or {}
            if kind == "tool_use" and (name in ("AskUserQuestion", "AskQuestion") or (name.endswith("wrap_up") and inp.get("ask"))):
                asks[b.get("id")] = (waiting, unasked)
                waiting, cleared, unasked = "", cleared | seen, set()   # a question retires what came before it
            elif kind == "tool_use" and name in SHELLS and re.search(r"make\.py['\"]?\s+(?:draft|wait)|last-make\.txt|make\.out",
                                                                     unquoted(inp.get("command", ""))):
                drafts.add(b.get("id"))
            elif kind == "tool_use" and name in ("Read", "Grep") and MAKE_OUT.search(str(inp.get("file_path") or inp.get("path") or "")):
                reads.add(b.get("id"))                       # a background render's summary file, read back
            elif kind == "tool_use" and name.endswith("SendUserFile"):
                cuts = [f for f in inp.get("files") or []
                        if "draft" in Path(str(f)).name.lower() and str(f).lower().endswith((".mp4", ".mov"))]
                if cuts:
                    film = film_of_path(cuts[0], cwd) or film_dir(cwd)
                    sends[b.get("id")] = "quick" if film is not None and not film_mode(film) else "film"
                    unasked.add(b.get("id"))
            elif kind == "tool_result":
                ref, failed = b.get("tool_use_id"), bool(b.get("is_error"))
                out = b.get("content")
                out = " ".join(x.get("text", "") for x in out if isinstance(x, dict)) if isinstance(out, list) else str(out)
                mark = deliverable(out, re.compile(r"SHOW THIS DRAFT NOW:[^\n]*"))   # keyed by the draft file
                if ref in asks and failed:
                    waiting, covered = asks[ref][0] or waiting, asks[ref][1]
                    unasked |= covered
                    for s in covered & set(sent):
                        waiting = "quick" if "quick" in (waiting, sent[s]) else "film"
                elif mark and (ref in drafts or ref in reads) and mark not in cleared:   # the render's own result, or
                    waiting = "quick"                                                    # its summary file read back,
                    seen.add(mark)                                                       # never a kit line that quotes it
                elif ref in sends and not failed:
                    sent[ref] = sends[ref]
                    if ref in unasked:                    # its question may already have followed the send itself
                        waiting = "quick" if "quick" in (waiting, sends[ref]) else "film"
    return waiting


JURY = re.compile(r"j[uü]r[iyı]|jury", re.I)


def delivery_choices(ev, name, inp):
    """The question that follows a delivered draft offers its three answers, the jury check among them, with the
    question tool: the desktop app's wrap_up box shows two buttons. A new-chat offer is one more choice, never in place
    of one, and only one choice carries the star."""
    if open_gate(ev.get("transcript_path", ""), ev.get("cwd", ".")) != "quick":
        return ""
    if name.endswith("wrap_up"):
        return ("cinecode: the delivery question after a draft has three choices, Final ★ · Notes · Jury check, and the "
                "app's wrap_up box shows two buttons and drops the rest, so the user would never see one. Ask it with "
                "AskUserQuestion, in the user's language (a new-chat offer is a fourth option).")
    labels = [str(o.get("label", "")) + " " + str(o.get("description", ""))
              for q in inp.get("questions") or [] for o in q.get("options") or []]
    if not labels:
        return ("cinecode: the delivery question after a draft offers its choices as buttons, in the user's language: "
                "Final ★ · Notes · Jury check. This one has none. Ask again.")
    problems = []
    if not any(JURY.search(l) for l in labels):
        problems.append("it has no jury check (jury.md: six pinpoint questions, two or three minutes)")
    if sum("★" in l.split(" ")[0:6] or "★" in l[:40] for l in labels) > 1:
        problems.append("more than one choice carries the star")
    if not problems:
        return ""
    return ("cinecode: the delivery question after a draft offers Final ★ · Notes · Jury check, in the user's language; a "
            "new-chat offer is one more choice, never instead of one. This one: " + "; ".join(problems) + ". Ask again.")


SHARED = ("STATE.md", "shots.json", "audio/mix.json", "LICENSES.csv")    # one owner: the main chat
NUM = r"\s+\d+(?:\.\d+)?"
LOOKING = re.compile(r"\s*(?:(?:cd|Set-Location|pushd)\s+\S+"                   # commands that cannot write a file
                     r"|(?:&\s*)?(?:bash\s+(?:\S*[/\\])?tools[/\\]qc\.sh"
                     r"|(?:\"[^\"\n]*python3?(?:\.exe)?\"|\S*(?:python3?|py)(?:\.exe)?(?:\s+-(?:3(?:\.\d+)?|V:\S+))?)\s+"
                     r"(?:\S*[/\\])?tools[/\\]qc\.py)"
                     r"\s+(?:sheet|strip|thumb)\s+[\w./\\:\x01-]+\.(?:mp4|mov|m4v)(?:" + NUM + r")*"
                     r"|ffprobe(?:\.exe)?(?:\s+(?!-o\b|-report\b)\S+)*"
                     r"|(?:ls|dir|cat|type|head|tail|wc|cut|grep|findstr|Get-Content|Get-ChildItem|Select-String"
                     r"|Measure-Object)(?:\s+\S+)*)\s*$", re.I)


def helper_brief(ev):
    """A helper's kind and the files its brief lets it write, read from its own first message (Claude Code keeps each
    helper's transcript beside the chat's: <chat>/subagents/agent-<id>.jsonl). (None, None) when it cannot be read."""
    agent, tp = str(ev.get("agent_id") or ""), ev.get("transcript_path") or ""
    if not agent or not tp:
        return None, None
    tp = Path(tp)
    for f in ([tp] if tp.name.startswith("agent-") else []) + \
             [tp.with_suffix("") / "subagents" / f"agent-{agent.removeprefix('agent-')}.jsonl"]:
        try:
            with f.open(encoding="utf-8") as h:
                for line in h:
                    msg = (json.loads(line).get("message") or {})
                    if msg.get("role") != "user":
                        continue
                    c = msg.get("content")
                    c = c if isinstance(c, str) else " ".join(x.get("text", "") for x in c or [] if isinstance(x, dict))
                    kind = re.search(r"<!-- cinecode brief: (\w+)", c)
                    writes = re.search(r"^WRITES:\s*(.+)$", c, re.M)
                    return (kind[1] if kind else None), (brief_writes(writes[1]) if writes else None)
        except (OSError, ValueError):
            continue
    return None, None


def brief_writes(line):
    """The paths of a brief's WRITES line: the comma list before any note in brackets or after a semicolon, an
    unfilled vN read as any draft's number. None when no path is left, so a wordy line never locks a helper out."""
    head = re.split(r"\s\(|;|\.\s", line, maxsplit=1)[0]
    paths = [re.sub(r"(?<=v)[NnX](?=[.\-_/]|$)", "*", w.strip()) for w in head.split(",")]
    return [p for p in paths if re.fullmatch(r"[\w.*?\[\]{}/\\~-]+", p)] or None


def helper_text(ev):
    """A helper's brief: the first message of its own transcript (None when it cannot be read)."""
    agent, tp = str(ev.get("agent_id") or ""), Path(ev.get("transcript_path") or "")
    for f in ([tp] if tp.name.startswith("agent-") else []) + \
             [tp.with_suffix("") / "subagents" / f"agent-{agent[6:] if agent.startswith('agent-') else agent}.jsonl"]:
        try:
            with f.open(encoding="utf-8") as h:
                for line in h:
                    msg = json.loads(line).get("message") or {}
                    if msg.get("role") == "user":
                        c = msg.get("content")
                        return c if isinstance(c, str) else " ".join(x.get("text", "") for x in c or [] if isinstance(x, dict))
        except (OSError, ValueError):
            continue
    return None


def helper_bounds(ev, name, inp):
    """A helper writes only the files its brief gives it, never the main chat's shared files; the viewer only looks."""
    if not ev.get("agent_id"):
        return ""
    kind, writes = helper_brief(ev)
    film = film_for(ev, inp)
    if name in ("Write", "Edit", "MultiEdit", "NotebookEdit") and film:
        target = Path(str(inp.get("file_path") or inp.get("notebook_path") or ""))
        target = target if target.is_absolute() else Path(ev.get("cwd", ".")) / target
        try:                                       # a folder of the film linked to another disk is still the film
            rel = Path(os.path.abspath(target)).relative_to(Path(os.path.abspath(film))).as_posix()
        except ValueError:
            rel = None
        if rel is None or rel.startswith(".."):
            try:
                rel = target.resolve().relative_to(film.resolve()).as_posix()
            except ValueError:
                rel = None
        if rel is None or ".." in Path(rel).parts:  # outside the film: a briefed helper writes only its own files
            return (f"cinecode: this helper writes only {', '.join(writes)} in its film; {target} is outside it."
                    if writes is not None else "")
        import fnmatch
        if rel in SHARED:
            return (f"cinecode: {rel} belongs to the main chat. Write what it should change into your report; the main "
                    "chat applies it.")
        if writes is not None and not rel.endswith("-handoff.md") and not any(fnmatch.fnmatch(rel, w) for w in writes):
            return f"cinecode: this helper writes only {', '.join(writes)} (its brief); {rel} is not one of them."
    if name in SHELLS and kind == "review":
        cmd = re.sub(r"\s*(?:2>&1|[0-9*]?>\s*(?:/dev/null|\$null))", "", str(inp.get("command", "")))  # quiet is not a write
        if re.search(r"<<|\$\(|`|<\(|>", cmd) or \
                not all(LOOKING.match(s) or not s.strip() for s in re.split(r"&&|\|\||[;\n|]", unquoted(cmd))):
            return ("cinecode: the independent viewer only looks: python3 tools/qc.py sheet|strip|thumb <video> <numbers> "
                    "(Windows: python or py -3), ffprobe, ls, cat, head, tail, wc, cut, grep (PowerShell: Get-ChildItem, "
                    "Get-Content, Select-String), or the Read and Grep tools. It writes nothing but its report.")
    return ""


KEYS_FILE = re.compile(r"keys\.env\b", re.I)                   # Windows and macOS open KEYS.ENV as keys.env
END = r"(?=$|[\s'\";|&)>,])"
KEYS_DIR = re.compile(r"\.cinecode/*" + END +                    # the folder itself, searched or read whole, or its
                      r"|\.cinecode/+[^\s/'\";|&)]*[*?\[{$`][^\s/'\";|&)]*" + END, re.I)   # files by wildcard or variable
LISTING = re.compile(r"\s*(?:&\s*)?(?:[\w.]+[\\/])?(?:ls|dir|Get-ChildItem|gci|Test-Path|du|tree|cd|Set-Location|pushd|"
                     r"mkdir|md|find(?!.*\s-(?:exec|execdir|ok|okdir|delete)\b))(?![\w-])", re.I)  # names and sizes only
# a later stage binds the piped file objects to a reader (PowerShell gc/Select-String, bash xargs cat): names alone
# (a bare cat/grep on the name stream) are left out, so a listing piped to a filter stays free
PIPE_READERS = (r"xargs|parallel|while|cat|type|gc|Get-Content|Select-String|sls|findstr|ForEach-Object|%|foreach|cp|"
                r"copy|cpi|Copy-Item|mv|move|mi|Move-Item|ren|rni|Rename-Item|tar|zip|Compress-Archive|Import-Csv|"
                r"ipcsv|Format-Hex|fhx|Get-FileHash|Invoke-Item|ii|Start-Process|saps|start")
# every reader that opens a file by name, for a command run inside the key folder after a cd
DIR_READERS = PIPE_READERS + r"|head|tail|less|more|sed|awk|strings|od|xxd|hexdump|nl|grep|egrep|fgrep|rg|ag|ack"
# a stage's start: a wrapper (sudo, env, (, $(...) and a path prefix are stepped over first
STAGE_OPEN = r"^[\s(${`&]*(?:(?:sudo|env|command|exec|time|nice|nohup|builtin)\s+)*(?:[\w.\\/-]*[\\/])?"
PIPED_READ = re.compile(STAGE_OPEN + r"(?:" + PIPE_READERS + r")(?![\w-])", re.I)
DIR_READ = re.compile(STAGE_OPEN + r"(?:" + DIR_READERS + r")(?![\w-])", re.I)
KEYS_CODE = re.compile(r"\b(?:from|import)\s+(?:tools\.)?keys\b|\bkeys\.(?:get|read_env|store_path|where)\s*\("
                       r"|exec\s*\(\s*open\([^)]*keys\.py"
                       r"|(?:\$\{?(?:env:)?|%)CINECODE_KEYS\b|CINECODE_KEYS['\"]?\s*[\])]", re.I)  # the store through code
HOME_AT = r"(?:(?<![\w'\"])~|\$HOME|\$\{HOME\}|\$env:(?:USERPROFILE|HOME)|%USERPROFILE%|/root|/(?:Users|home)/[^/\s'\";|&)]+)"
HOME_ROOT = re.compile(r"^" + HOME_AT + r"/*$", re.I)                       # the whole home, not a folder inside it
HOME_SEARCH = re.compile(r"(?:^|[;&|]|\s)(?:grep|egrep|fgrep|rg|ag|ack)\b\s+[^|;&\n]*?\s"  # a search whose target is the
                         r"" + HOME_AT + r"/*(?=[\s'\";|&)]|$)", re.I)   # whole home as one argument, not a file under it
KEYS_SAY = ("cinecode: the key file is never opened, printed, searched or written by the agent. Keys go through "
            "tools/keys.py: list (which are set), open <NAME> (the user's editor), set <NAME> (hidden input).")


def tidy(path_text):
    """Paths as the file system reads them: one slash, no ./ steps, a/b/../ as a/ (only to compare, never to run)."""
    s = re.sub(r"/+", "/", path_text.replace("\\", "/"))
    s = re.sub(r"/\.(?=/|" + END[3:], "", s)
    while True:
        t = re.sub(r"/(?!\.\.?/)[^/\s'\";|&)]+/\.\.(?=/|" + END[3:], "", s)
        if t == s:
            return s
        s = t


def key_touch(name, inp):
    """The keys stay out of every context: no tool call names the key file except keys.py itself, in any case or
    split by quotes; no search or wildcard reads the folder it is in (a listing shows names only), no search reads
    the whole home folder, and no inline code opens the store. A seatbelt, not a sandbox: shell code can always be
    written to get round a pattern; the kit's own route is keys.py."""
    fields = {"Read": ("file_path",), "Write": ("file_path",), "Edit": ("file_path",), "MultiEdit": ("file_path",),
              "NotebookEdit": ("notebook_path",), "Bash": ("command",), "PowerShell": ("command",),
              "Grep": ("pattern", "path", "glob"),
              "Glob": ("pattern", "path")}.get(name, ())
    for f in fields:                                                    # keys.py never names the file: no exception
        v = str(inp.get(f) or "")
        if KEYS_FILE.search(v) or KEYS_FILE.search(re.sub(r"['\"`^\\]", "", v)):
            return KEYS_SAY
    if name == "Grep":
        where = tidy(str(inp.get("path") or ""))
        if KEYS_DIR.search(where) or HOME_ROOT.match(where):          # the whole home grepped (a subfolder is fine)
            return KEYS_SAY
    cmd = str(inp.get("command") or "") if name in SHELLS else ""
    if KEYS_CODE.search(cmd):                                        # the store opened or printed through code
        return KEYS_SAY
    in_dir = False                                                   # a cd into the folder makes its later reads local
    for line in re.split(r"&&|\|\||[;\n]", tidy(cmd)):
        stages = line.split("|")
        at = [i for i, s in enumerate(stages) if KEYS_DIR.search(s)]
        if at and (not all(LISTING.match(stages[i]) for i in at) or any(PIPED_READ.match(s) for s in stages[at[0] + 1:])):
            return KEYS_SAY
        if HOME_SEARCH.search(line) and not re.search(r"\s--files\b", line):   # grep -r … ~  (a subfolder is fine)
            return KEYS_SAY
        if in_dir and any(DIR_READ.match(s) for s in stages):        # after cd ~/.cinecode, any read of a file there
            return KEYS_SAY
        cd = re.match(r"\s*(?:cd|Set-Location|pushd)\b\s*(?:-Path\s+|-LiteralPath\s+)?(\S+)", line, re.I)
        if cd:                                                       # a cd into the folder arms it, a cd elsewhere disarms
            in_dir = bool(re.search(r"\.cinecode[\\/]*$", cd[1].strip("'\"")))
    return ""


REFERENCES = Path(__file__).resolve().parent.parent / "references"
WHOLE_REF = 20_000


def whole_reference(name, inp):
    """A long reference read whole costs its full size on every later step of the chat; a step needs one section."""
    if name == "Read" and not (inp.get("offset") or inp.get("limit")):
        names = [Path(str(inp.get("file_path", ""))).name] if "references" in str(inp.get("file_path", "")) else []
    elif name in SHELLS:
        cmd = HEREDOC.sub("\n", str(inp.get("command", "")))
        tail = r"\s+[^;&|\n]*?references[\\/]([\w.-]+\.md)(?=[\s;&|)'\"]|$)"
        names = re.findall(r"(?:^|[;&|(]\s*|\s)(?:cat|less|more|bat)" + tail, cmd) + \
            [n for n in re.findall(r"(?:^|[;&|(]\s*)(?:type|gc|Get-Content)" + tail, cmd, re.I | re.M)   # PowerShell: a command,
             if not re.search(r"-(?:TotalCount|Tail|Head|First|Skip|Index)\b", cmd, re.I)]                # not a word; whole
    else:
        return ""
    for n in names:
        f = REFERENCES / n
        if f.exists() and f.stat().st_size > WHOLE_REF:
            return (f"cinecode: references/{n} is {f.stat().st_size // 1000} KB; read only the section the step names: "
                    f"the Grep tool for '^## ' in {f} gives the outline; then read that section with the Read tool's offset and limit.")
    return ""


SCRIPT_ASK = re.compile(r"senaryo|metn|metin|perde|script|kilitle|\block\b|narration", re.I)
NOT_THE_SCRIPT = re.compile(r"renk senaryo\w*|colou?r script|altyazı\w*|subtitles?|senaryo(?:ya|\s+adım\w*)\s+\w+|"
                            r"(?:to|on to|into)\s+the\s+script(?:\s+(?:and\s+text\s+)?step)?", re.I)
NOT_SCRIPT_ASK = re.compile(r"taslak|draft|kurgu|\bcut\b|anlatıcı|narrator|voice|ses işlemi", re.I)


def word_col(header):
    """A script table's column that holds the words (the line, the text on screen, the beat), read from its label."""
    label = plain(re.split(r"[(≥≤=<>:·]", header)[0]).lower().strip(" #*")
    if label.startswith(("what it", "what changes", "what steps", "words", "over shot", "placement")):
        return False
    return label == "what" or label.startswith(("line", "text", "narration", "on screen", "on-screen", "replik", "satır",
                                                 "metin", "söz", "dialogue", "beat", "vuruş", "ekran", "yazı", "dış ses"))


BEATS = re.compile(r"^(beat sheet|beats|vuruşlar|sahne akışı)", re.I)
INSTRUCTION = re.compile(r"^\**(word budget|estimate seconds|total words|wordless|sözsüz|none|yok)\b", re.I)
SCRIPT_PARTS = re.compile(r"^(lines|on.screen text|narration|dialogue|replik|metin|dış ses|ekran yaz)", re.I)
CLOCK = re.compile(r"^[\d:.,\s–-]+(s|sn)?$")


def script_rows(text):
    """The words the user approves: each row of the script's lines and on-screen text tables, as the texts it carries
    (whatever the rows are named: VO1, R1, a time); a wordless script's beats; prose inside those sections."""
    if "<working title>" in text:                 # the template init_film copied: nothing written yet
        return []
    text = re.sub(r"<!--.*?-->", " ", re.sub(r"<[^<>\n]{1,80}>", " ", text), flags=re.S)
    parts = re.split(r"^#+\s+", text, flags=re.M)

    def table_rows(want):
        rows = []
        for part in parts:
            if not want.match(part):
                continue
            body = part.splitlines()[1:]
            keep = None                          # the columns that hold the words, chosen by the table's header
            for k, line in enumerate(body):
                if not line.startswith("|") or re.match(r"^\|[\s:|-]+\|?\s*$", line):
                    continue
                raw = [c.strip() for c in line.strip().strip("|").split("|")]
                if k + 1 < len(body) and re.match(r"^\|[\s:|-]+\|?\s*$", body[k + 1]):
                    keep = [i for i, h in enumerate(raw) if word_col(h)] or None
                    continue
                cells = [plain(re.sub(r"\([^)]*\)", " ", c)) for i, c in enumerate(raw) if keep is None or i in keep]
                texts = [c for c in cells if len(c.split()) >= 2 and not CLOCK.match(c)
                         and not all(re.fullmatch(r"[a-z]{0,3}\d+[a-z]?", w) for w in c.split())]
                if texts:
                    rows.append(texts)
        header = {tuple(r) for r in rows if any(w in " ".join(r) for w in ("what it adds", "on screen", "placement",
                                                                             "what changes", "beat type"))}
        return [r for r in rows if tuple(r) not in header]

    try:                                         # words that are literally the template's are not the film's
        stock = plain((Path(__file__).resolve().parent.parent / "templates" / "SCRIPT.md").read_text(encoding="utf-8"))
    except OSError:
        stock = ""
    own = lambda rs: [r for r in rs if not (stock and all(x in stock for x in r))]
    rows = own(table_rows(SCRIPT_PARTS)) or own(table_rows(BEATS))
    if rows:
        return rows
    prose = []                                   # a script written as prose, inside its lines or narration sections
    for part in parts:
        if not SCRIPT_PARTS.match(part):
            continue
        for line in part.splitlines()[1:]:
            s = line.strip()
            if not s or s.startswith(("|", "Status:")) or INSTRUCTION.match(s) or re.match(r"^[-*]\s+\*\*[^*]+:\*\*", s):
                continue
            s = plain(re.sub(r"\([^)]*\)", " ", re.sub(r"^[-*>\d.\s]+", "", s)))
            if len(s.split()) >= 4 and not (stock and s in stock):
                prose.append([s])
    return prose


def plain(s):
    return re.sub(r"\W+", " ", s.lower()).strip()


def newest_script(cwd, named):
    """The script a chat works on when a command or a helper wrote it: among the films here (this folder, one above
    it, or the films below it), the ones the chat names, the newest SCRIPT.md changed in the last six hours."""
    here = film_dir(cwd)
    films = [f for f in [here] + films_below(cwd) if f and (f / "SCRIPT.md").is_file()
             and (f == here or re.search(r"(^|[\s/`'\"])" + re.escape(f.name) + r"([\s/`'\".,:;)]|$)", named))]
    if not films:
        return None
    newest = max(films, key=lambda f: (f / "SCRIPT.md").stat().st_mtime)
    return str(newest / "SCRIPT.md")


def script_question(inp, script_text=""):
    """A question about the script's words: a script approval or a look at its lines, never the step after it, a
    colour plan, subtitles, the narrator's voice or a draft. Once the script is LOCKED only a question that names
    the script (senaryo, script) reopens it."""
    asked = " ".join(str(q.get("question", "")) + " " + str(q.get("header", "")) for q in inp.get("questions") or [])
    asked = NOT_THE_SCRIPT.sub(" ", asked + " " + str(inp.get("ask", "")))
    named = re.search(r"senaryo|script", asked, re.I)
    roadmap = re.search(r"yol haritas|roadmap", asked, re.I) and re.search(r"geç\w*|move on|go on", asked, re.I) and \
        not re.search(r"senaryo\w*\s+(tamam|onay|nasıl|uygun)|script\s+(ok|approved)", asked, re.I)
    if roadmap or not SCRIPT_ASK.search(asked) or (not named and NOT_SCRIPT_ASK.search(asked)):
        return False
    return bool(named) or not re.search(r"^Status:\s*LOCKED", script_text, re.M | re.I)


def script_unread(transcript, inp, cwd="."):
    """A question about the script while most of its lines never reached the user (a link or "it is written" is not
    reading it): the SCRIPT.md this chat wrote last, its narration lines against what the chat has shown."""
    if not script_question(inp):
        return ""
    try:
        rows = [json.loads(x) for x in Path(transcript).read_text(encoding="utf-8", errors="replace").splitlines()[-3000:]
                if x.strip()]
    except (OSError, ValueError):
        return ""
    script, said, worked = None, [], []
    for r in rows:
        c = (r.get("message") or {}).get("content")
        for b in c if isinstance(c, list) and r.get("type") == "assistant" else []:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "text":
                said.append(b.get("text", ""))
            elif b.get("type") == "tool_use":
                inp_ = b.get("input") or {}
                worked.append(json.dumps(inp_, ensure_ascii=False))
                path = str(inp_.get("file_path") or inp_.get("path") or "")
                if path.endswith("SCRIPT.md") and b.get("name") in ("Write", "Edit", "MultiEdit"):
                    script = path if os.path.isabs(path) else str(Path(cwd) / path)
                if b.get("name") in ("AskUserQuestion", "AskQuestion") or str(b.get("name", "")).endswith("wrap_up"):
                    said.append(json.dumps(inp_, ensure_ascii=False))
    here = film_dir(cwd)
    if here and (here / "SCRIPT.md").is_file():  # the chat's own film, whatever was written elsewhere
        script = str(here / "SCRIPT.md")
    if not script:                               # written by a command, a helper or an earlier chat
        script = newest_script(cwd, " ".join(worked))
    if not script:
        return ""
    try:
        text = Path(script).read_text(encoding="utf-8")
    except OSError:
        return ""
    if not script_question(inp, text):              # a locked script is reopened only by name
        return ""
    rows = script_rows(text)
    shown = plain(" ".join(said) + " " + json.dumps(inp, ensure_ascii=False))
    seen = sum(any(x in shown for x in r) for r in rows)
    if not rows or seen >= len(rows) - (1 if len(rows) >= 8 else 0):   # every line; a long script may miss one
        return ""
    return ("cinecode: the user has not read the script: most of its lines never reached the chat. Put them in the "
            "message first, in order (narration and on-screen text, under the act headings for a long film, with the "
            "word count), then ask.")


SCOPED = re.compile(r"(?:bitti sayılır|bitmiş sayılır|tamam sayılır|done when|finished when|stop when|stop after|"
                    r"bitince dur)\W*:?", re.I | re.M)


def scoped_handoff(name, inp, cwd="."):
    """A new chat that continues a film gets the film, not a task: a done line makes it stop there."""
    prompt = str(inp.get("prompt", ""))
    dest = str(inp.get("cwd") or inp.get("directory") or "")
    in_film = (film_near(dest) if dest else film_near(cwd)) or re.search(r"STATE\.md|cinecode|init_film", prompt)
    if not name.endswith("start_session") or not in_film or not SCOPED.search(prompt):
        return ""
    return ("cinecode: this new chat continues the film, so its prompt is the handoff (KIT/templates/HANDOFF.md), never a "
            "helper's brief: drop the done line. Name the step it starts at; it carries the film on through "
            "the gates from there.")


def tool(ev):
    name, inp = ev.get("tool_name", ""), ev.get("tool_input") or {}
    cwd = ev.get("cwd", ".")
    cold = str(inp.get("file_path", "")) if name in ("Write", "Edit", "MultiEdit") else \
        (str(inp.get("command", "")) if name in SHELLS and re.search(r">|write_text|\.write\(|\btee\b|\bcp\b|\bmv\b|\binstall\b"
                                                                         r"|Set-Content|Out-File|Add-Content|Copy-Item|Move-Item"
                                                                         r"|WriteAll", str(inp.get("command", "")), re.I) else "")
    if re.search(r"(^|[\\/\s'\"])review[\\/]script-cold\.md", cold):
        film = film_of_path(re.search(r"\S*script-cold\.md", cold)[0].strip("'\""), cwd) or film_dir(cwd)
        if film:
            note_script(film, "cold")
    whole = key_touch(name, inp) or whole_reference(name, inp) or scoped_handoff(name, inp, cwd)
    if whole:
        print(whole, file=sys.stderr)
        return 2
    target = str(inp.get("file_path", ""))
    if target and not os.path.isabs(target):
        target = str(Path(cwd) / target)
    if not film_near(cwd) and not (target and film_above(target)):
        return 0                         # outside film projects the guard says nothing (its contract, in the docstring)
    why = gates(ev, name, inp)
    if why:
        print(why, file=sys.stderr)
        return 2
    if name.endswith("wrap_up") and len(inp.get("actions") or []) > 2:
        print("cinecode: the app's wrap_up box shows two reply buttons and drops the rest, so the user would never see "
              "them. A question with more choices goes to AskUserQuestion (up to four options); here, two at most.",
              file=sys.stderr)
        return 2
    if (name.endswith("wrap_up") and inp.get("ask")) or name in ("AskUserQuestion", "AskQuestion"):
        why = delivery_choices(ev, name, inp)
        if why:
            print(why, file=sys.stderr)
            return 2
    if name.endswith("wrap_up") and inp.get("ask"):
        what = unshown(ev.get("transcript_path", ""))
        if what:
            print(SHOW_FIRST.format(what) + " Then ask.", file=sys.stderr)
            return 2
        why = script_unread(ev.get("transcript_path", ""), inp, ev.get("cwd", ".")) or ideas_unprepared(ev, inp) \
            or cold_read_missing(ev, inp)
        if why:
            print(why, file=sys.stderr)
            return 2
        shown_script(ev, inp)
    if name.endswith("wrap_up") and not inp.get("ask") and open_gate(ev.get("transcript_path", ""), ev.get("cwd", ".")):
        print("cinecode: this turn delivered a draft, so it ends on the delivery question. Ask it with AskUserQuestion, "
              "in the user's language (\"Bu taslakla nasıl ilerleyelim?\"): Final ★ · Notes · Jury check, the first "
              "your pick, and a new-chat offer as a fourth option when it is due (on that answer "
              "mcp__ccd_session__start_session, which starts by itself). The app's wrap_up box shows two buttons and "
              "drops the rest, so this question never goes there. Never leave a gate's question as plain text.",
              file=sys.stderr)
        return 2
    if name in ("AskUserQuestion", "AskQuestion"):
        what = unshown(ev.get("transcript_path", ""))
        if what:
            print(SHOW_FIRST.format(what) + " Then ask.", file=sys.stderr)
            return 2
        why = script_unread(ev.get("transcript_path", ""), inp, ev.get("cwd", ".")) or ideas_unprepared(ev, inp) \
            or cold_read_missing(ev, inp)
        if why:
            print(why, file=sys.stderr)
            return 2
        shown_script(ev, inp)
        return question_language_check(ev, inp)
    if name in SHELLS and any(VIEWER.match(s) for s in re.split(r"&&|\|\||[;\n|]", HEREDOC.sub("\n", inp.get("command", "")))):
        print("cinecode: never open a picture, film or page in a window. Show it to the user instead: in Claude Code with "
              "SendUserFile (display 'render', status 'normal'), which opens it big in the side panel; elsewhere its path "
              "in your message.", file=sys.stderr)
        return 2
    if name == "Read":
        p = target
        if Path(p).suffix.lower() in IMAGE_EXT and os.path.isfile(p) and film_above(p):
            size = image_size(p)
            if size and size[0] * size[1] > IMAGE_MAX_PIXELS:
                film = film_above(p)
                width = min(1024, int((800_000 * size[0] / size[1]) ** 0.5) // 2 * 2)
                print(f"cinecode: {Path(p).name} is {size[0]}x{size[1]}. An image stays in the chat and is re-read on "
                      f"every later step. Look at a small copy instead: python3 tools/qc.py thumb \"{p}\" {width} in {film} "
                      f"(Windows: python or py -3), then read the thumb it prints. make.py already writes small sheets.",
                      file=sys.stderr)
                return 2
    agent = ev.get("agent_id")
    bound = helper_bounds(ev, name, inp)
    if bound:
        print(bound, file=sys.stderr)
        return 2
    if film_near(ev.get("cwd", ".")):
        seen(ev)
    if agent and film_near(ev.get("cwd", ".")):
        STATE_DIR.mkdir(exist_ok=True)
        count_file = STATE_DIR / f"{ev.get('session_id', 'x')}-{agent}.calls"
        n, last = (count_file.read_text().split() + ["0", ""])[:2] if count_file.exists() else ("0", "")
        call = ev.get("tool_use_id", "")
        n = int(n) + (0 if call and call == last else 1)
        count_file.write_text(f"{n} {call}")
        writing_report = name in ("Write", "Edit", "MultiEdit") and "review" in re.split(r"[\\/]", inp.get("file_path", ""))
        if n > HELPER_CALLS and not writing_report:
            print(f"cinecode: this helper has used its {HELPER_CALLS} tool calls; a long helper re-reads itself on "
                  "every step. Write what is done, what is left and the next concrete step to review/<task>-handoff.md, "
                  "then reply in 10 lines or fewer. The main chat starts a fresh helper for the rest.", file=sys.stderr)
            return 2
    if name in ("Agent", "Task") and not agent and not inp.get("model") \
            and str(inp.get("subagent_type") or "general-purpose") == "general-purpose":
        kind = re.search(r"<!-- cinecode brief: (\w+)", str(inp.get("prompt", "")))
        STATE_DIR.mkdir(exist_ok=True)
        with open(STATE_DIR / "model-unset.log", "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M')} {ev.get('session_id', '-')} {kind[1] if kind else 'no brief'}\n")
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext":
              "cinecode: this helper was started without a model, so it runs on the chat's own model, the most costly. "
              "Name it in the call (model, and effort where the brief gives one): brief.py prints it as \"start it with\"; "
              "taste and judgement stay on inherit."}}))
    return 0


APPROVAL = re.compile(r"★|\b(tamam|onay\w*|evet|devam|kur|ok|yes|approve\w*|go on|continue)\b", re.I)
NOT_GO = re.compile(r"\b(notlar\w*|notum\w*|notes?|değiş\w*|swap|change\w*|başka|revi[sz]\w*|düzelt\w*|fix|i'll|"
                    r"i will|let me|\w+(?:acağım|eceğim|ıcam|icem))\b", re.I)
BARE_NO = {"no", "hayır", "hayir", "wait", "bekle", "later", "sonra", "dur", "stop", "notyet", "henüzdeğil", "şimdilikhayır",
           "notnow", "şimdideğil"}
NOT_YET = re.compile(r"\b(hayır|dur|bekle|sonra|no|not|stop|wait|later)\b", re.I)   # in a picked line: its words
USER_STOPPED = re.compile(r"doesn't want to proceed|\[Request interrupted by user")
DENIED = re.compile(r"\b(onay\w*m[ıi]yor\w*|onaylama\w*|devam\s+etme\w*|kabul\s+etm[ei]\w*|"
                    r"(?:don'?t|do\s+not)\s+(?:continue|go\s+on|approve|proceed)|not\s+(?:ok|approved)|"
                    r"istemiyorum|istemem|kullanma|koyma|olmasın|ekleme|çıkar|kaldır)\b", re.I)
WORK = re.compile(r"(make\.py|capture\.mjs|animatic\.py|handoff\.py|asset_search\.py|direction\.py|styles\.py|tts\.py|"
                  r"deal\.py|qc\.py|qc\.sh|brief\.py|mix\.py|master_audio\.py|footage_cut\.py|captions\.py|beat_grid\.py|"
                  r"voice_treat\.py|validate_shots\.py|samples\.py|fonts\.py)")
BOOKKEEPING = ("STATE.md", "HANDOFF.md", "INTERVIEW.md", ".gitignore")


def typed(r):
    """What the user typed in this record (None for tool results, hooks, helpers and the system speaking as "user")."""
    c = (r.get("message") or {}).get("content")
    if r.get("type") != "user":
        return None
    if isinstance(c, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c):
            return None
        c = " ".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
    if not isinstance(c, str) or c.startswith("<") or c.lstrip().startswith(NOT_THE_USER):
        return None
    return c


def is_go(answers):
    """Every answer agrees to go on, and at least one says so: a note or a change anywhere is not a go, nor an
    approval word said in the negative ("Onaylamıyorum", "Devam etme"); a picked line of the film is not a decision."""
    bare = lambda a: re.sub(r"★|\((?:önerilen|recommended)\)|[\"'.!,\s]", "", a).lower() in BARE_NO
    return any(APPROVAL.search(a) for a in answers) and not any(
        DENIED.search(a) or NOT_GO.search(a) or bare(a) or ("★" not in a and NOT_YET.search(a)) for a in answers)


def approved_and_idle(transcript):
    """The newest answer to a question (a box, a reply button or a typed reply to a question) was a go, and nothing
    came after it that starts the next step: no new question, no delivery, no handoff, no work with the film's tools,
    no file written beyond the bookkeeping."""
    try:
        lines = Path(transcript).read_text(encoding="utf-8", errors="replace").splitlines()[-600:]
    except OSError:
        return False
    asks, answer, moved, asked, pending, waiting, running, boxes = set(), None, False, False, set(), set(), set(), set()
    for line in lines:
        try:
            r = json.loads(line)
        except ValueError:
            continue
        said = typed(r)
        if said is not None:                                  # the user's own turn: an answer if a question was open
            answer, moved, asked = (said if asked and is_go([said]) else None), False, False
            continue
        c = (r.get("message") or {}).get("content")
        for done in re.findall(r"<task-notification>.*?<tool-use-id>([^<]+)</tool-use-id>", json.dumps(c), re.S):
            running.discard(done)                         # a background helper finished
        for b in c if isinstance(c, list) else []:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "tool_result" and "Async agent launched successfully" in str(b.get("content")):
                running.add(b.get("tool_use_id"))        # a helper runs in the background: the turn waits for it
            if b.get("type") == "tool_result" and b.get("is_error") and USER_STOPPED.search(str(b.get("content"))):
                answer, waiting = None, set()            # the user turned the step down: theirs to lead now
                pending.discard(b.get("tool_use_id"))
                continue
            if b.get("type") == "tool_result" and b.get("tool_use_id") in boxes:
                waiting.discard(b.get("tool_use_id"))
                moved = moved or (answer is not None and not b.get("is_error"))   # asked: the film moved on
                continue
            if b.get("type") == "text" and USER_STOPPED.search(b.get("text", "")):
                answer, waiting = None, set()
            elif b.get("type") == "text" and r.get("type") == "assistant":
                if "?" in b.get("text", ""):                  # a question in plain words is the next step asked
                    asked, moved = True, answer is not None or moved
            elif b.get("type") == "tool_use":
                name, inp = str(b.get("name", "")), b.get("input") or {}
                path = str(inp.get("file_path") or inp.get("notebook_path") or "")
                if name.endswith("wrap_up") and inp.get("ask"):
                    boxes.add(b.get("id"))             # the app shows the question; the reply comes as the user's turn
                if name in ("AskUserQuestion", "AskQuestion") or (name.endswith("wrap_up") and inp.get("ask")):
                    asks.add(b.get("id"))
                    asked = True
                    if answer is not None:
                        waiting.add(b.get("id"))     # the next question, until its call failed
                elif answer is not None and (
                        name.endswith(("SendUserFile", "start_session")) or name in ("Agent", "Task", "SendMessage")
                        or inp.get("run_in_background") or "nohup " in str(inp.get("command", ""))
                        or WORK.search(str(inp.get("command", "")))
                        or (name in ("Write", "Edit", "MultiEdit", "NotebookEdit") and path
                            and not path.endswith(BOOKKEEPING))):
                    pending.add(b.get("id"))                  # it moved on once this step answered without an error
            elif b.get("type") == "tool_result" and b.get("tool_use_id") in pending:
                pending.discard(b.get("tool_use_id"))
                out = b.get("content")
                out = " ".join(x.get("text", "") for x in out if isinstance(x, dict)) if isinstance(out, list) else str(out)
                if not b.get("is_error") and not re.match(r"\s*(FAILED|error|Traceback|usage:)", out, re.I):
                    moved = True
            elif b.get("type") == "tool_result" and b.get("is_error") and USER_STOPPED.search(str(b.get("content"))):
                answer, waiting = None, set()            # the user turned the step down: theirs to lead now
            elif b.get("type") == "tool_result" and b.get("tool_use_id") in asks and b.get("is_error"):
                waiting.discard(b.get("tool_use_id"))
            elif b.get("type") == "tool_result" and b.get("tool_use_id") in asks and not b.get("is_error"):
                waiting.discard(b.get("tool_use_id"))
                out = b.get("content")
                out = " ".join(x.get("text", "") for x in out if isinstance(x, dict)) if isinstance(out, list) else str(out)
                picks = re.findall(r'"=("[^"]*")', out) or [out]
                answer, moved, asked = (" ".join(picks) if is_go(picks) else None), False, False
    return answer is not None and not moved and not waiting and not running


def film_done(cwd, transcript=""):
    """The film is delivered (STATE.md: Phase done or delivered, or no next action): an approved final has no next step.
    On a shelf the film is the one the chat's last tool calls worked in."""
    films = films_here(cwd)
    if not film_dir(cwd):
        try:
            recent = "\n".join(Path(transcript).read_text(encoding="utf-8", errors="replace").splitlines()[-200:])
        except OSError:
            recent = ""
        last = {f: max((m.start() for m in re.finditer(r"(?<![\w.-])" + re.escape(f.name) + r"(?![\w.-])", recent)),
                       default=-1) for f in films_below(cwd)}
        worked = max(last, key=last.get) if last and max(last.values()) >= 0 else None
        films = [worked] if worked else films
    for f in films:
        try:
            state = (f / "STATE.md").read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if re.search(r"^\W*\**Phase\**\W*:\W*(done|delivered|teslim|bitti)\b|^\W*\**Next action\**\W*:\W*(none|done|yok|bitti)\b",
                     state, re.I | re.M):
            return True
    return False


def stop(ev):
    if ev.get("stop_hook_active") or not film_near(ev.get("cwd", ".")):
        return 0
    what = unshown(ev.get("transcript_path", ""))
    if what:
        print(SHOW_FIRST.format(what) + " If it is still rendering in the background, say so in one line and end the turn "
              "again.", file=sys.stderr)
        return 2
    if approved_and_idle(ev.get("transcript_path", "")) and not film_done(ev.get("cwd", "."), ev.get("transcript_path", "")):
        print("cinecode: the user approved and the turn ends without moving on. An approved gate starts the next step "
              "now: begin it (or, when a background job runs, say in one line what and how long), and end the turn only "
              "with a question, a delivery or that note.", file=sys.stderr)
        return 2
    if open_gate(ev.get("transcript_path", ""), ev.get("cwd", ".")):
        print("cinecode: the draft was shown and the turn ends without its question. Ask it now with the question tool, "
              "in the user's language: Quick mode Final ★ · Notes · Jury check; Film mode final or notes (two choices, "
              "so the desktop app's wrap_up box may carry them as ask with two buttons).", file=sys.stderr)
        return 2
    return 0


def leave_trace(ev, mode):
    """A trace for the session's folder that the hooks run (init_film.py and make.py look for it, GUARD OFF)."""
    try:
        d = os.path.realpath(str(ev.get("cwd") or "."))
        key = hashlib.sha1(os.path.normcase(d).replace("\\", "/").encode()).hexdigest()[:16]
        if SEEN.is_file():
            SEEN.unlink()
        SEEN.mkdir(parents=True, exist_ok=True)
        (SEEN / key).write_text(f"{time.time():.0f} {ev.get('session_id', '')} {mode}\n", encoding="utf-8")
    except OSError:
        pass


def slashes(ev):
    """Windows paths arrive with backslashes; the patterns here are written with forward slashes (both work as paths)."""
    for k in ("cwd", "transcript_path", "agent_transcript_path"):
        if isinstance(ev.get(k), str):
            ev[k] = ev[k].replace("\\", "/")
    inp = ev.get("tool_input")
    for k in ("file_path", "path", "notebook_path", "command", "prompt"):
        if isinstance(inp, dict) and isinstance(inp.get(k), str):
            inp[k] = re.sub(r"\\+", "/", inp[k])   # an escaped double backslash is one separator too
    return ev


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    raw = ""
    try:
        raw = sys.stdin.read()
        ev = slashes(json.loads(raw)) if os.name == "nt" else json.loads(raw)
        leave_trace(ev, mode)
        return prompt(ev) if mode == "prompt" else tool(ev) if mode == "tool" else stop(ev) if mode == "stop" else 0
    except Exception:                    # never lock the user's session; leave a trace so a broken gate is found
        try:
            import traceback
            STATE_DIR.mkdir(exist_ok=True)
            with open(STATE_DIR / "errors.log", "a", encoding="utf-8") as f:
                f.write(f"--- {mode}\n{traceback.format_exc()}")
        except OSError:
            pass
        if mode == "tool" and KEYS_FILE.search(raw):
            print(KEYS_SAY, file=sys.stderr)  # a broken guard still never lets the key file through
            return 2
        return 0


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
