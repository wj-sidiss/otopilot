#!/usr/bin/env python3
"""Open a fresh chat on this film, already told to continue from STATE.md (the user picked "new chat" at a handoff).

  python3 tools/handoff.py                 # the film folder is the current folder; the line in Turkish
  python3 tools/handoff.py --lang en       # "Continue from STATE.md"
  python3 tools/handoff.py --dry-run       # print what it would open, open nothing

Where the chat runs decides how (CLAUDE_CODE_ENTRYPOINT):
  Claude desktop app   opens nothing: the chat starts the child session itself with mcp__ccd_session__start_session,
                       which begins working at once (--link: claude://code/new, the line in its box, one Enter)
  Claude Code terminal (macOS) a new Terminal window: cd <film> && claude "<line>"
  anything else        the line is copied to the clipboard; the reply tells the user to open a new chat in the film's
                       folder and paste it
Prints one line saying which of these happened. Python 3 stdlib.
"""
import argparse
import os
import shlex
import shutil
import subprocess
import sys
import urllib.parse

LINES = {"tr": "STATE.md'den devam et", "en": "Continue from STATE.md"}


def copy(text):
    for cmd in (["pbcopy"], ["wl-copy"], ["xclip", "-selection", "clipboard"], ["clip"]):
        if shutil.which(cmd[0]):
            try:
                subprocess.run(cmd, input=text.encode("utf-8"), check=True)
                return True
            except (OSError, subprocess.CalledProcessError):
                continue
    return False


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", default="tr")
    ap.add_argument("--folder", default=os.getcwd())
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--link", action="store_true", help="desktop app without the session tool: a prefilled new session")
    a = ap.parse_args(argv)
    folder = os.path.abspath(a.folder)
    if not os.path.isfile(os.path.join(folder, "STATE.md")):
        sys.exit(f"handoff: no STATE.md in {folder}; run it from the film's folder")
    line = LINES.get(a.lang, LINES["en"])
    entry = os.environ.get("CLAUDE_CODE_ENTRYPOINT", "")
    mac = sys.platform == "darwin"

    if ("desktop" in entry or entry in ("local-agent", "local_agent")) and not a.link:
        print("handoff: in the Claude desktop app start the new chat with mcp__ccd_session__start_session (initiation "
              f"user_asked, context fresh, cwd {folder}, a title, and a prompt that begins \"{line}.\" and says: load the "
              "skill named in STATE.md with the Skill tool, read STATE.md and the notes it names, the user's choices "
              "verbatim, reply in their language). It starts working by itself; nothing was opened here. Without that "
              "tool: handoff.py --link")
        return 0
    if mac and ("desktop" in entry or entry in ("local-agent", "local_agent")):
        url = "claude://code/new?" + urllib.parse.urlencode({"folder": folder, "q": line, "source": "cinecode"})
        if a.dry_run:
            print(f"would open {url}")
            return 0
        if subprocess.run(["open", url]).returncode == 0:
            print(f"opened a new Claude Code session in {folder} with \"{line}\" (press Enter there if it waits)")
            return 0
    if mac and entry == "cli" and shutil.which("osascript"):
        cmd = f"cd {shlex.quote(folder)} && claude {shlex.quote(line)}"
        script = f'tell application "Terminal" to do script "{cmd.replace(chr(92), chr(92) * 2).replace(chr(34), chr(92) + chr(34))}"'
        if a.dry_run:
            print(f"would run in a new Terminal window: {cmd}")
            return 0
        if subprocess.run(["osascript", "-e", script, "-e", 'tell application "Terminal" to activate']).returncode == 0:
            print(f"opened a new Terminal window with a fresh chat in {folder}; it starts from STATE.md")
            return 0
    copied = not a.dry_run and copy(line)
    print(f"{'copied' if copied else 'line'}: \"{line}\". Open a new chat in {folder} and "
          f"{'paste it' if copied else 'type it'} (Cursor: a new Agent chat in that folder).")
    return 0


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
