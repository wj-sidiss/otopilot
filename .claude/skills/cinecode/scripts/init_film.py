#!/usr/bin/env python3
"""Set up a film project folder from the kit (Python 3 standard library only). Never overwrites a file.

  python3 <KIT>/scripts/init_film.py .                 # Film mode, in the current (empty) folder
  python3 <KIT>/scripts/init_film.py my-film --title "<working title>"
  python3 <KIT>/scripts/init_film.py . --quick         # Quick mode: one film.html, a short STATE.md
  python3 <KIT>/scripts/init_film.py <film> --to-film  # a Quick film moves to Film mode; its files are kept in research/
  python3 <KIT>/scripts/init_film.py . --quick --format <format name>   # start from a saved format (formats.py)

Film mode creates: STATE.md, INTERVIEW.md, ROADMAP.md, SCRIPT.md, HANDOFF.md, LICENSES.csv (from templates/), tools/
(the scripts), engine/ (starter scenes + looks.mjs), refs/ (the user's references), notes/ (verbatim note rounds),
assets/, audio/, research/, review/, renders/, logs/, a .gitignore, an AGENTS.md pointer to the kit, and a git
repository if there is none and git is installed (the agent's silent version history).
Quick mode creates: STATE.md (short), film.html (picture + sound starter), LICENSES.csv, tools/ (the scripts a Quick
film uses, with the type tools' data: type-library.json, type-specimen.html, type.mjs), refs/ (refs/type/ for type
references), research/, audio/, review/, renders/, logs/, notes/, assets/, a .gitignore, an AGENTS.md pointer, and git.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def skill_name():
    try:
        with open(os.path.join(KIT, "SKILL.md"), encoding="utf-8") as fh:
            head = fh.read(400)
        return re.search(r"^name:\s*(\S+)", head, re.M).group(1)
    except (OSError, AttributeError):
        return "cinecode"


SKILL = skill_name()
TEMPLATES = ["STATE.md", "INTERVIEW.md", "ROADMAP.md", "SCRIPT.md", "HANDOFF.md", "LICENSES.csv"]
TOOLS = ["sparks.json", "seeds.json", "make.py", "capture.mjs", "qc.py", "scene_check.py", "master_audio.py", "mix.py", "animatic.py", "validate_shots.py",
         "asset_search.py", "deal.py", "dice.py", "footage_cut.py", "type_deal.py", "type_refs.py", "type_extract.py",
         "captions.py", "styles.py", "moves.py", "formats.py", "direction.py", "beat_grid.py", "lyrics_align.py", "voice_treat.py", "ref_video.py",
         "keys.py", "tts.py", "snapshot.py", "usage.py", "fonts.py", "words_check.py", "handoff.py", "samples.py", "sounds.py", "brief.py"]
ENGINE = ["index.html", "scene.html", "looks.mjs", "camera.mjs", "type.mjs"]
TYPE_KIT = [("references", "type-library.json"), ("templates", "type-specimen.html"), ("starter", "type.mjs")]   # into tools/ for deal.py type
DIRS = ["refs", "refs/type", "notes", "assets", "audio", "research", "review", "renders", "logs", "tools", "engine"]
# direction.py in Quick mode too: the measuring library ref_video.py uses
QUICK_TOOLS = ["sparks.json", "seeds.json", "capture.mjs", "qc.py", "scene_check.py", "master_audio.py", "mix.py", "deal.py", "dice.py", "asset_search.py",
               "footage_cut.py", "type_deal.py", "type_refs.py", "type_extract.py", "captions.py", "styles.py", "moves.py",
               "formats.py", "beat_grid.py", "lyrics_align.py", "voice_treat.py", "ref_video.py", "direction.py", "keys.py", "tts.py", "snapshot.py",
               "make.py", "usage.py", "fonts.py", "words_check.py", "handoff.py", "samples.py", "sounds.py", "brief.py"]
QUICK_DIRS = ["refs", "refs/type", "research", "audio", "review", "renders", "logs", "tools", "notes", "assets"]
GITIGNORE = """# media and render output (kept on disk, out of git)
renders/
frames/
review/qc-*/
research/.cache/
*.mp4
*.mov
*.wav
*.aiff
*.flac
*.mp3
*.ogg
*.opus
*.png
*.jpg
*.jpeg
*.webp
*.gif
*.img
*.woff2
*.otf
*.ttf
.env
.DS_Store
__pycache__/
# brand fonts supplied by the user stay local
fonts/
"""
AGENTS = """# Film project

This folder is a short film made with code. When the user asks about the film (or says "continue", "devam"),
load the {skill} skill (in Claude Code through the Skill tool, which also starts its context guard; elsewhere read
`{kit}/SKILL.md` once). State lives in `STATE.md`; read it first ("Resume here").
The main chat builds what it holds the context for and makes small revisions (up to five targeted edits) itself;
independent parts and larger revisions go to fresh subagents briefed from files (`{kit}/references/context-protocol.md` §1).
"""
AGENTS_QUICK = """# Film project (Quick mode)

This folder is a short film made with code in one file, `film.html` (picture and sound). When the user asks about
the film (or says "continue", "devam"), load the {skill} skill (in Claude Code through the Skill tool, which also
starts its context guard; elsewhere read `{kit}/SKILL.md` once), read `STATE.md`, then follow
`{kit}/references/quick-mode.md`. Renders go through `tools/make.py`; the main chat builds and revises itself (quick-mode.md §6).
"""


def copy(src, dst, made):
    if os.path.exists(dst):
        return
    shutil.copy2(src, dst)
    made.append(shown(dst))


def update_tools(root):
    if not os.path.isdir(os.path.join(root, "tools")):
        raise SystemExit(f"{root} has no tools/ folder; it is not a film made by this kit")
    quick = os.path.exists(os.path.join(root, "film.html")) and not os.path.isdir(os.path.join(root, "engine"))
    n = 0
    for t in QUICK_TOOLS if quick else TOOLS:
        shutil.copy2(os.path.join(KIT, "scripts", t), os.path.join(root, "tools", t)); n += 1
    for folder, t in TYPE_KIT:
        shutil.copy2(os.path.join(KIT, folder, t), os.path.join(root, "tools", t)); n += 1
    data = json.loads(Path(os.path.join(KIT, "styles", "index.json")).read_text(encoding="utf-8"))
    data["dir"] = os.path.join(KIT, "styles")
    json.dump(data, open(os.path.join(root, "tools", "styles-index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    kept = write_agents(os.path.join(root, "AGENTS.md"), (AGENTS_QUICK if quick else AGENTS).format(kit=KIT, skill=SKILL))
    print(f"tools refreshed: {n} files from the kit ({'Quick' if quick else 'Film'} mode); AGENTS.md: the kit's block "
          f"updated{', your own lines kept' if kept else ''}; the film's own files untouched")


BEGIN, END = "<!-- cinecode: kit block, replaced by --update-tools -->", "<!-- cinecode: end of kit block -->"


def write_agents(path, text):
    """Write the kit's pointer between markers; everything outside them (the user's own rules) stays. An older file
    without markers keeps all its lines below the new block. Returns True when the user's lines were kept."""
    block = f"{BEGIN}\n{text.rstrip()}\n{END}\n"
    old = Path(path).read_text(encoding="utf-8") if os.path.exists(path) else ""
    if BEGIN in old and END in old:
        head, rest = old.split(BEGIN, 1)
        new, tail = head + block.rstrip("\n") + rest.split(END, 1)[1], (head + rest.split(END, 1)[1]).strip()
    elif old.strip():
        new, tail = block + "\n## Kept from the earlier AGENTS.md (the block above wins where they differ)\n\n" + old, old
    else:
        new, tail = block, ""
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)
    return bool(tail.strip())


def is_film(path):
    return os.path.isfile(os.path.join(path, "STATE.md")) and (
        os.path.isfile(os.path.join(path, "film.html")) or os.path.isdir(os.path.join(path, "engine")))


def film_title(path):
    try:
        with open(os.path.join(path, "STATE.md"), encoding="utf-8") as f:
            m = re.match(r"#\s*State:\s*(.+?)\s*(\((Quick|Film) mode\))?\s*$", f.readline())
        title = m.group(1).strip() if m else ""
    except OSError:
        title = ""
    if not title or title.startswith("<"):
        mp4 = sorted(f for f in os.listdir(path) if f.endswith(".mp4") and not f.endswith(("-draft.mp4", "-x.mp4")))
        title = os.path.splitext(mp4[0])[0] if mp4 else "film"
    return title


def slug(title):
    t = title.translate(str.maketrans("çğıöşüÇĞİÖŞÜâîû", "cgiosuCGIOSUaiu")).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:40] or "film"


def shelve(shelf):
    """A film made at the root of the chat's folder moves into its own subfolder (git history, files and all), so the
    folder becomes a shelf of films again. Films already in subfolders and the folder's .claude settings stay."""
    shelf = os.path.abspath(shelf)
    if not is_film(shelf):
        raise SystemExit(f"{shelf} holds no film at its root; nothing to move")
    name = base = slug(film_title(shelf))
    n = 2
    while os.path.exists(os.path.join(shelf, name)):
        name, n = f"{base}-{n}", n + 1
    dest = os.path.join(shelf, name)
    os.makedirs(dest)
    moved = 0
    for entry in os.listdir(shelf):
        src = os.path.join(shelf, entry)
        if entry in (name, ".claude", ".DS_Store") or (os.path.isdir(src) and is_film(src)):
            continue
        shutil.move(src, os.path.join(dest, entry))
        moved += 1
    print(f"moved \"{film_title(dest)}\" into {name}/ ({moved} items, its git history with it); "
          f"the folder is a shelf of films again")


def films_folder(cwd, name):
    """Where a new film goes when only a short name is given: the chat's folder when it is empty or already a shelf of
    films; otherwise its films folder (created once), so films never spread over a home folder, a desktop or a
    code project."""
    if "/scratch-workspaces/" in cwd.replace("\\", "/") + "/":
        cwd = os.path.expanduser("~")         # the Claude app's throwaway chat folder: films go where the user finds them
    for cand in dict.fromkeys((name, "Filmler", "Films")):
        if os.path.isdir(os.path.join(cwd, cand)):
            return os.path.join(cwd, cand)
    empty = lambda p: os.path.isdir(p) and all(empty(os.path.join(p, e)) for e in os.listdir(p) if not e.startswith("."))
    entries = [e for e in os.listdir(cwd) if not e.startswith(".") and not empty(os.path.join(cwd, e))
               and not predealt(os.path.join(cwd, e))]           # a hand dealt for the film about to be set up
    if is_film(cwd) or film_above(cwd) or all(os.path.isdir(os.path.join(cwd, e)) and is_film(os.path.join(cwd, e))
                                              for e in entries):
        return cwd
    return os.path.join(cwd, name)


def outside_chat(root, cwd):
    """The film opened outside the chat's own folder (the app's throwaway chat folder sends it home). The Claude app
    shows, plays and previews only files inside the chat's folders, so the chat moves into the film first."""
    r, c = os.path.abspath(root), os.path.abspath(cwd)
    if r == c or r.startswith(c.rstrip("\\/") + os.sep):
        return ""
    return (f"OUTSIDE THIS CHAT: the film is in {r}, outside this chat's folder ({c}). The Claude app shows, plays and "
            f"previews only files inside the chat's folders, so boards, stills, music and drafts would reach the user "
            f"as bare file cards. Before any question, move the film's chat there: in the Claude desktop app "
            f"mcp__ccd_session__start_session with cwd {r}, a short title and, as its prompt, the user's first message "
            f"word for word plus \"The film's folder is set up here; load the cinecode skill and carry on from the first "
            f"questions.\"; then tell the user in one line where the film continues, and stop. Elsewhere, tell the user "
            f"in one line to open a new chat in {r} and send their message there again.")


def predealt(root):
    """A folder deal.py made before the film was set up (the hand dealt at the first message): only the deal's history
    and the research a helper wrote, no film yet."""
    try:
        names = {n for n in os.listdir(root) if not n.startswith(".")}
    except OSError:
        return False
    return bool(names) and names <= {"history.json", "research"}


def film_above(path):
    """The film folder that holds path (path itself or up to three levels up), or None."""
    p = os.path.abspath(path)
    for _ in range(4):
        if is_film(p):
            return p
        up = os.path.dirname(p)
        if up == p:
            break
        p = up
    return None


def to_film(root, title):
    """A Quick film moves to Film mode in place: nothing is deleted. Its film.html and STATE.md are kept in research/ as
    the plan the roadmap starts from (the beats and the director card); Film mode's templates, engine and tools are
    added beside them."""
    if os.path.isdir(os.path.join(root, "engine")):
        raise SystemExit(f"{root} is already a Film mode film")
    if not os.path.isfile(os.path.join(root, "film.html")):
        raise SystemExit(f"{root} is not a Quick film (no film.html)")
    made = []
    for d in DIRS:
        os.makedirs(os.path.join(root, d), exist_ok=True)
    for f, to in (("film.html", "research/quick-film.html"), ("STATE.md", "research/quick-STATE.md")):
        src, dst = os.path.join(root, f), os.path.join(root, to)
        if os.path.exists(src):
            if os.path.exists(dst):
                raise SystemExit(f"{to} exists already; move it aside first")
            os.rename(src, dst)
            made.append(f"{f} -> {to}")
    for t in TEMPLATES:
        if not os.path.exists(os.path.join(root, t)):
            copy(os.path.join(KIT, "templates", t), os.path.join(root, t), made)
    for e in ENGINE:
        copy(os.path.join(KIT, "starter", e), os.path.join(root, "engine", e), made)
    for t in TOOLS:
        shutil.copyfile(os.path.join(KIT, "scripts", t), os.path.join(root, "tools", t))
    write_agents(os.path.join(root, "AGENTS.md"), AGENTS.format(kit=KIT, skill=SKILL))
    state = os.path.join(root, "STATE.md")
    s = Path(state).read_text(encoding="utf-8")
    old = Path(os.path.join(root, "research", "quick-STATE.md")).read_text(encoding="utf-8", errors="replace")
    m = re.search(r"^#\s*State:\s*(.+?)\s*(\(|$)", old, re.M)
    s = s.replace("<working title>", m[1] if m and title == "Untitled" else title).replace("<kit path>", KIT) \
        .replace("<skill name>", SKILL)
    open(state, "w", encoding="utf-8").write(s)
    print(f"film project: {root} (now Film mode)")
    print("moved and added: " + ", ".join(made[:8]) + (" ..." if len(made) > 8 else ""))
    print("next: the roadmap starts from research/quick-STATE.md (its beats and director card); the Quick picture in "
          "research/quick-film.html is a reference for the shots")


STARTED = time.time()


def guard_off():
    """In a Claude Code session the guard leaves a trace for the session's folder each time it runs (guard.py); none
    for this folder or the folders above it in the last half hour means its hooks do not run here."""
    if not os.environ.get("CLAUDECODE"):
        return ""
    seen = Path(os.environ.get("CINECODE_GUARD_SEEN") or Path.home() / ".cinecode" / "guard-seen")
    d = os.path.realpath(os.getcwd())
    for _ in range(5):
        key = hashlib.sha1(os.path.normcase(d).replace("\\", "/").encode()).hexdigest()[:16]
        try:
            if (seen / key).stat().st_mtime >= STARTED - 1800:   # the hook that ran this command, however long it ran
                return ""
        except OSError:
            pass
        d = os.path.dirname(d)
    return ("GUARD OFF: the cinecode guard has not run in this Claude Code session, so the kit's checks will not hold. "
            "Its hooks need Node.js and Python (on Windows: Python from python.org), then a new session. Tell the user in "
            "one line before going on.")


def shown(path):
    """A path as the summary prints it: relative to here, or whole when it is on another drive (Windows)."""
    try:
        return os.path.relpath(path)
    except ValueError:
        return path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dir")
    ap.add_argument("--title", default="Untitled")
    ap.add_argument("--quick", action="store_true", help="Quick mode: one film.html and a short STATE.md")
    ap.add_argument("--format", help="a saved format (formats.py): its look, type, sound and rhythm files come first")
    ap.add_argument("--films-folder", default="Films",
                    help="the films folder's name in the user's language (Filmler), made when the chat's folder holds "
                         "other things")
    ap.add_argument("--shelve", action="store_true",
                    help="dir is a folder with a film at its root: move that film into its own subfolder (ask first)")
    ap.add_argument("--to-film", action="store_true",
                    help="an existing Quick film: add Film mode's files; film.html and the Quick STATE.md move to "
                         "research/ (kept as the plan the roadmap starts from)")
    ap.add_argument("--update-tools", action="store_true",
                    help="an existing film: replace its tools/ copies with the kit's current ones (the film's own files "
                         "are never touched)")
    a = ap.parse_args()
    root = os.path.abspath(a.dir)
    short = "/" not in a.dir and "\\" not in a.dir           # a short name on either platform, never a path
    dealt_here = os.path.isdir(root) and predealt(root)       # the spark deal made it, before the film was set up
    staged = root if short and dealt_here else None
    if not (a.update_tools or a.shelve) and short and a.dir not in (".", "..") and (staged or not os.path.exists(root)):
        root = os.path.join(films_folder(os.getcwd(), a.films_folder), a.dir)
        os.makedirs(os.path.dirname(root), exist_ok=True)
    if a.update_tools:
        return update_tools(root)
    if a.to_film:
        return to_film(root, a.title)
    if a.shelve:
        return shelve(root)
    if os.path.isfile(os.path.join(root, "STATE.md")) and not os.environ.get("CINECODE_REINIT"):
        files = [os.path.join(root, f) for f in ("STATE.md", "film.html")] + \
            [os.path.join(root, "logs", f) for f in (os.listdir(os.path.join(root, "logs")) if os.path.isdir(os.path.join(root, "logs")) else [])]
        mins = (time.time() - max(os.path.getmtime(f) for f in files if os.path.exists(f))) / 60
        if mins < 15:
            raise SystemExit(f"IN USE: the film \"{film_title(root)}\" in {root} changed {mins:.0f} min ago, so another chat "
                             f"is probably working on it now. Never step into it: create this film under another short "
                             f"name ({os.path.basename(root)}-2 or a new title)")
        raise SystemExit(f"EXISTS: {root} already holds the film \"{film_title(root)}\" (last changed {mins / 60:.1f} h ago). "
                         f"Ask the user once: continue that film (load STATE.md) or start a new one under another short name")
    if dealt_here or staged or not os.path.exists(root):
        shelf = os.path.dirname(root)
        holder = film_above(shelf)
        at_root = holder and os.path.abspath(holder) == os.path.abspath(shelf)
        own = holder and slug(os.path.basename(holder)).startswith(slug(film_title(holder))[:20])
        shelf_of_films = at_root and any(os.path.isdir(os.path.join(shelf, e)) and is_film(os.path.join(shelf, e))
                                         for e in os.listdir(shelf))
        if at_root and not own and not shelf_of_films:
            raise SystemExit(f"WHICH FOLDER: {shelf} is the film \"{film_title(shelf)}\". Ask the user once: is this the "
                             f"film's own folder (then start the chat in the folder above it, their films folder), or "
                             f"the folder where they keep their films (then init_film.py {shelf} --shelve moves this film "
                             f"into {slug(film_title(shelf))}/ and the new one opens beside it)?")
        if at_root and shelf_of_films:
            raise SystemExit(f"FILM AT THE ROOT: {shelf} itself holds the film \"{film_title(shelf)}\" beside other films. "
                             f"Ask the user once (\"move it into its own folder, {slug(film_title(shelf))}/?\"); after "
                             f"the OK run init_film.py {shelf} --shelve, then create the new film again")
        if holder:
            raise SystemExit(f"INSIDE A FILM: {shelf} is inside the film \"{film_title(holder)}\" ({holder}). A new film "
                             f"goes beside it, never inside: tell the user in one line to start the chat in "
                             f"{os.path.dirname(holder)} (their films folder) and ask again there")
        if staged and staged != root:              # the spark deal made the folder where the chat stands: move it
            if os.path.exists(root):
                raise SystemExit(f"EXISTS: {root} is already there; the spark deal's folder {staged} stays as it is")
            shutil.move(staged, root)
    fmt = None
    if a.format:
        fmt_root = os.environ.get("CINECODE_FORMATS") or os.path.join(os.path.expanduser("~"), ".cinecode", "formats")
        fmt = os.path.join(fmt_root, a.format)
        if not os.path.exists(os.path.join(fmt, "FORMAT.md")) and os.path.isdir(fmt) and any(
                f.endswith("FORMAT.md") for f in os.listdir(fmt)):
            raise SystemExit(f"{a.format} was saved by a different kit and cannot be opened here; "
                             f"save a format from a cinecode film")
        if not os.path.exists(os.path.join(fmt, "FORMAT.md")):
            raise SystemExit(f"no saved format named {a.format} in {fmt_root} (tools/formats.py list)")
        saved_mode = "quick" if os.path.exists(os.path.join(fmt, "source", "film.html")) else "film"
        if saved_mode != ("quick" if a.quick else "film"):
            raise SystemExit(f"the format {a.format} was saved from a {saved_mode} mode film: "
                             f"run init_film.py {'with' if saved_mode == 'quick' else 'without'} --quick")
    os.makedirs(root, exist_ok=True)
    made, pending_font_rows = [], ""
    for d in QUICK_DIRS if a.quick else DIRS:
        os.makedirs(os.path.join(root, d), exist_ok=True)
    if fmt:
        copy(os.path.join(fmt, "FORMAT.md"), os.path.join(root, "FORMAT.md"), made)
        if os.path.isdir(os.path.join(fmt, "source", "fonts")) and not os.path.exists(os.path.join(root, "fonts")):
            shutil.copytree(os.path.join(fmt, "source", "fonts"), os.path.join(root, "fonts"))
            made.append("fonts/")
            rows = os.path.join(fmt, "source", "font-licences.csv")
            if os.path.exists(rows):
                pending_font_rows = Path(rows).read_text(encoding="utf-8")
        # The language comes as FORMAT.md; the source film's code only as a reference to look techniques up in. The new
        # film starts from the fresh template (a copied film.html carried its score and scenes into the next film).
        refs = [("film.html", "research/format-reference.html")] if a.quick else \
            [("engine/scene.html", "research/format-reference-scene.html")]
        for f, to in refs:
            if os.path.exists(os.path.join(fmt, "source", f)):
                copy(os.path.join(fmt, "source", f), os.path.join(root, to), made)
        if not a.quick and os.path.exists(os.path.join(fmt, "source", "engine/looks.mjs")):
            copy(os.path.join(fmt, "source", "engine/looks.mjs"), os.path.join(root, "engine/looks.mjs"), made)
    if a.quick:
        copy(os.path.join(KIT, "templates", "quick", "STATE.md"), os.path.join(root, "STATE.md"), made)
        copy(os.path.join(KIT, "templates", "quick", "film.html"), os.path.join(root, "film.html"), made)
        copy(os.path.join(KIT, "templates", "LICENSES.csv"), os.path.join(root, "LICENSES.csv"), made)
    else:
        for t in TEMPLATES:
            copy(os.path.join(KIT, "templates", t), os.path.join(root, t), made)
        for e in ENGINE:
            copy(os.path.join(KIT, "starter", e), os.path.join(root, "engine", e), made)
    for t in QUICK_TOOLS if a.quick else TOOLS:
        copy(os.path.join(KIT, "scripts", t), os.path.join(root, "tools", t), made)
    for folder, t in TYPE_KIT:
        copy(os.path.join(KIT, folder, t), os.path.join(root, "tools", t), made)
    styles_index = os.path.join(root, "tools", "styles-index.json")
    if not os.path.exists(styles_index):
        data = json.loads(Path(os.path.join(KIT, "styles", "index.json")).read_text(encoding="utf-8"))
        data["dir"] = os.path.join(KIT, "styles")          # the recipes stay in the kit; styles.py show prints the path
        json.dump(data, open(styles_index, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        made.append(shown(styles_index))
    if pending_font_rows:                     # the saved format's font licence rows, after the fresh LICENSES.csv
        with open(os.path.join(root, "LICENSES.csv"), "a", encoding="utf-8") as f:
            f.write(pending_font_rows)
    agents = (AGENTS_QUICK if a.quick else AGENTS).format(kit=KIT, skill=SKILL)
    p = os.path.join(root, ".gitignore")
    if not os.path.exists(p):
        open(p, "w", encoding="utf-8").write(GITIGNORE)
        made.append(".gitignore")
    if not os.path.exists(os.path.join(root, "AGENTS.md")):
        write_agents(os.path.join(root, "AGENTS.md"), agents)
        made.append("AGENTS.md")
    state = os.path.join(root, "STATE.md")
    s = Path(state).read_text(encoding="utf-8")
    if "<working title>" in s:
        open(state, "w", encoding="utf-8").write(s.replace("<working title>", a.title).replace("<kit path>", KIT).replace("<skill name>", SKILL))
    if shutil.which("git"):                 # silent version history for the agent; the user never has to touch git
        inside = subprocess.run(["git", "-C", root, "rev-parse", "--is-inside-work-tree"], capture_output=True, text=True)
        if inside.returncode != 0:
            subprocess.run(["git", "init", "-q", root], check=False)
            made.append(".git")
        else:                               # inside another project's repository: no history of its own, no snapshots
            print("note: this folder is inside another git repository; the film keeps no history of its own "
                  "(snapshot.py skips itself)")
    print(f"film project: {root}")
    print(f"kit: {KIT}")
    print(f"created {len(made)} item(s)" + (": " + ", ".join(made[:12]) + (" ..." if len(made) > 12 else "") if made else " (all present)"))
    if guard_off():
        print(guard_off())
    away = outside_chat(root, os.getcwd())
    if away:
        print(away)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()
