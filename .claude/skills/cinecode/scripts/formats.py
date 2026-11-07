#!/usr/bin/env python3
"""Saved formats: keep a finished film's look, type, sound and rhythm, and start the next film from it (Python 3 stdlib).

  python3 tools/formats.py save "<format name>" --rhythm "<beats and cuts>" \
      --hook "<the kind of opening move>" --ending "<the kind of ending>"   # after the final
  python3 tools/formats.py list
  python3 tools/formats.py show "<format name>"            # FORMAT.md: what the next film keeps
  python3 KIT/scripts/init_film.py . --quick --format "<format name>"     # a new film in the same format

A format is the film's **language**, never its content: the look and its medium, the palette's logic, the type's style,
the camera's grammar and form, the rhythm, the kind of hook and ending, the sound's genre and players, how depth is made.
The next film speaks that language about its own idea: its story, words, scenes, images, music (a new composition in
the same genre) and timing are new. The next film starts from the fresh template; the source film's code comes along
only as research/format-reference.html, to look up how a technique was drawn. Formats live in the user's folder
(~/.cinecode/formats, or CINECODE_FORMATS), never in the kit or a repo.

save copies film.html (Quick mode) or engine/looks.mjs, engine/scene.html and shots.json (Film mode), plus STATE.md
and ROADMAP.md as the source, and writes FORMAT.md from the STATE.md lines that describe the form plus the three
Structure lines given with --rhythm, --hook and --ending (read them from the beat table). A Film mode format is used
the same way: init_film.py without --quick, then the interview asks only the idea (references/film-mode.md).
"""
import argparse
import datetime
import os
import re
import shutil
import sys

ROOT = os.environ.get("CINECODE_FORMATS") or os.path.join(os.path.expanduser("~"), ".cinecode", "formats")
FILES = ["film.html", "engine/looks.mjs", "engine/scene.html", "shots.json", "STATE.md", "ROADMAP.md"]
FORM_LINES = ("Purpose", "Format", "Look", "Director card", "Type", "Sound", "Sound identity", "Sound design",
              "Finishing", "Chapters")


def slug(name):
    s = re.sub(r"[^\w-]+", "-", name.strip().lower(), flags=re.UNICODE).strip("-")
    if not s:
        raise SystemExit("give the format a name")
    return s


def form_lines(state):
    keep = []
    for line in state.splitlines():
        m = re.match(r"- \*\*([^:*]+):\*\*", line)
        label = m.group(1).split(" (")[0].strip() if m else ""
        if label in FORM_LINES or label.startswith("Look"):
            keep.append(line)
    return keep


def cmd_save(a):
    src = os.path.abspath(a.src)
    if not os.path.exists(os.path.join(src, "STATE.md")):
        raise SystemExit(f"no STATE.md in {src}: run save from the film's folder")
    dst = os.path.join(ROOT, slug(a.name))
    if os.path.exists(dst) and not a.force:
        raise SystemExit(f"format exists: {dst} (--force to replace)")
    if os.path.exists(dst):
        shutil.rmtree(dst)                           # a replaced format keeps nothing of the old one
    os.makedirs(os.path.join(dst, "source"), exist_ok=True)
    copied = []
    for f in FILES:
        p = os.path.join(src, f)
        if os.path.exists(p):
            out = os.path.join(dst, "source", f)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            shutil.copy2(p, out)
            copied.append(f)
    if os.path.isdir(os.path.join(src, "fonts")):              # a local brand or Fontshare font the look depends on
        shutil.copytree(os.path.join(src, "fonts"), os.path.join(dst, "source", "fonts"), dirs_exist_ok=True)
        copied.append("fonts/")
        lic = os.path.join(src, "LICENSES.csv")
        if os.path.exists(lic):                               # the font rows go with the fonts
            rows = [l for l in open(lic, encoding="utf-8") if l.startswith("fonts/")]
            if rows:
                open(os.path.join(dst, "source", "font-licences.csv"), "w", encoding="utf-8").writelines(rows)
    mode = "quick" if "film.html" in copied else "film"
    state = open(os.path.join(src, "STATE.md"), encoding="utf-8").read()
    body = [f"# Format: {a.name}", "",
            f"Saved {datetime.date.today().isoformat()} from `{src}` · mode: {mode} · files: {', '.join(copied)}", "",
            "## The language (kept, and adapted to the new subject)", "",
            "Each line is a way of making the film, not a value to paste: say on the new card how it meets the new idea. "
            "No line names an object, word or image of the source film: those are its content, never the format.", "",
            "- **Look and medium:** <the family or recipe, and how the medium marks the surfaces>",
            "- **Palette logic:** <the roles and the relations: ground, subject, one accent, warm against cold, the contrast; "
            "the new film may pick its own hex values by the same logic>",
            "- **Type style:** <the category and the voice of the face, case, weight, how words move; the same face or a sibling>",
            "- **Camera and form:** <one shot or cuts, perspective or flat planes, the kinds of move and transition>",
            f"- **Rhythm:** {a.rhythm or '<the beat pattern and shot lengths, e.g. 6 beats of 3-6 s, cuts on the bar>'}",
            f"- **Hook:** {a.hook or '<what kind of move or action opens frame 1>'}",
            f"- **Ending:** {a.ending or '<the kind of ending>'}",
            "- **Sound language:** <the genre, the tempo range, the family of players, the mix (sparse, dense, dry, roomy), "
            "the kind of signature sound>",
            "- **Atmosphere:** <how light and depth are made, as a technique>", "",
            "## From the source card (for reference: read as the language above, never as values to copy)", "",
            *form_lines(state), "",
            "## Kept on purpose (the format's signature, the user's choice)", "",
            *([f"- {k}" for k in a.keep] or ["- none: no object, word or image of the source film returns"]), "",
            "These return in every film of the format, fitted to the new subject; nothing else of the source's content does.", "",
            "## Always new", "",
            "The idea and the story, every word on screen and in the voice, every scene and image (the hook's subject, "
            "every shape and the ending's image come from the new idea), CUES and SFX timing, "
            "the music itself (a new progression, motif and arrangement in the same genre and tempo range), the title. "
            "Nothing of the source film's content or code is reused; research/format-reference.html is for looking up "
            "how a technique was drawn.", ""]
    open(os.path.join(dst, "FORMAT.md"), "w", encoding="utf-8").write("\n".join(body))
    print(f"saved: {dst} ({mode} mode; {len(copied)} files)")
    if not (a.rhythm and a.hook and a.ending):
        print("missing Structure lines: save again with --force --rhythm … --hook … --ending …")


def cmd_list(a):
    if not os.path.isdir(ROOT):
        print("(no saved formats)")
        return
    other = sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d))
                   and not os.path.exists(os.path.join(ROOT, d, "FORMAT.md"))
                   and any(f.endswith("FORMAT.md") for f in os.listdir(os.path.join(ROOT, d))))
    for n in other:
        print(f"{n} · saved by a different kit (cannot be opened here)")
    names = sorted(d for d in os.listdir(ROOT) if os.path.exists(os.path.join(ROOT, d, "FORMAT.md")))
    for n in names:
        with open(os.path.join(ROOT, n, "FORMAT.md"), encoding="utf-8") as fh:
            head = fh.read().splitlines()
        info = next((l for l in head if l.startswith("Saved ")), "")
        look = next((l for l in head if l.startswith("- **Look")), "")
        mode = "Quick (init_film.py --quick --format)" if os.path.exists(os.path.join(ROOT, n, "source", "film.html")) \
            else "Film (init_film.py --format)"
        print(f"{n} · {mode} · {info[:60]} · {look[:90]}")
    print(f"({len(names)} format(s) in {ROOT})")


def cmd_show(a):
    d = os.path.join(ROOT, slug(a.name))
    if os.path.isdir(d) and not os.path.exists(os.path.join(d, "FORMAT.md")) and any(f.endswith("FORMAT.md") for f in os.listdir(d)):
        raise SystemExit(f"{a.name} was saved by a different kit and cannot be opened here")
    p = os.path.join(ROOT, slug(a.name), "FORMAT.md")
    if not os.path.exists(p):
        raise SystemExit(f"no format named {a.name} (formats.py list)")
    print(open(p, encoding="utf-8").read())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("save")
    p.add_argument("name")
    p.add_argument("--src", default=".", help="the film folder (default: here)")
    p.add_argument("--force", action="store_true")
    p.add_argument("--rhythm", help="beat count and lengths, cut rhythm")
    p.add_argument("--hook", help="what kind of move or action opens frame 1")
    p.add_argument("--ending", help="the kind of ending and how it re-reads the opening")
    p.add_argument("--keep", action="append", default=[],
                   help="a signature the user chose to return in every film of this format (e.g. \"the film ends on the "
                        "same three-note motif\"); repeat for more; nothing else of the source's content returns")
    p.set_defaults(fn=cmd_save)
    p = sub.add_parser("list")
    p.set_defaults(fn=cmd_list)
    p = sub.add_parser("show")
    p.add_argument("name")
    p.set_defaults(fn=cmd_show)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
