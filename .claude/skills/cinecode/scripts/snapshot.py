#!/usr/bin/env python3
"""A silent snapshot of the film's text files (film.html, STATE.md, shots.json…), so a bad edit can be undone
(Python 3 standard library + git, when installed).

  python3 tools/snapshot.py "gate 2: beats approved"

The film folder has its own local git history (made by init_film.py): nothing is uploaded anywhere, media
(renders, audio, frames) stays out of it (.gitignore). A snapshot is taken only when the film folder is the root of
its own repository: a film made inside another project's repository (a website, the kit itself) is never committed
into that project. Without git, or with nothing changed, it does nothing. It never asks for a git identity: the
snapshot carries a local one. Prints one line; the user is never told about git.
"""
import os
import shutil
import subprocess
import sys

TEXT = ("*.md", "*.html", "*.json", "*.mjs", "*.js", "*.py", "*.sh", "*.csv", "*.txt", "*.srt", "*.lrc", "*.gitignore")


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)


def main():
    msg = " ".join(sys.argv[1:]).strip() or "snapshot"
    if msg in ("-h", "--help"):
        print(__doc__)
        return 0
    if not shutil.which("git"):
        print("snapshot: skipped (no git)")
        return 0
    top = git("rev-parse", "--show-toplevel").stdout.strip()
    if not top or os.path.realpath(top) != os.path.realpath(os.getcwd()):
        print("snapshot: skipped (this folder is not the film's own repository)")
        return 0
    # only text: the film's code, plans and notes; images, audio, video and fonts never enter the history
    git("add", "-A")                                             # .gitignore keeps media out of the first pass
    text_ends = tuple(e[1:] for e in TEXT)
    media = [f for f in git("ls-files", "-z").stdout.split("\0") if f and not f.endswith(text_ends)]   # -z: names as they are (ışık.png)
    if media:                                                    # anything else (a forced add) leaves
        r = git("rm", "-q", "--cached", "--", *media)
        if r.returncode != 0:
            print(f"snapshot: not taken (could not keep media out of the history: {r.stderr.strip()[:80]})")
            return 1
    if git("diff", "--cached", "--quiet").returncode == 0:      # untracked media (an .mp3) is not a change
        print("snapshot: nothing changed")
        return 0
    r = subprocess.run(["git", "-c", "user.name=cinecode", "-c", "user.email=cinecode@localhost", "commit", "-q",
                        "-m", msg], capture_output=True, text=True)
    print(f"snapshot: {msg}" if r.returncode == 0 else f"snapshot: skipped ({r.stderr.strip()[:80]})")
    return 0


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
