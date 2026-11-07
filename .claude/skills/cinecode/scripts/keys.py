#!/usr/bin/env python3
"""API keys, entered once and used by every film (Python 3 standard library).

  python3 tools/keys.py open GEMINI_API_KEY       # opens the key file in the user's text editor with an empty
                                                  # GEMINI_API_KEY= line: they paste the key, save, close (no terminal)
  python3 tools/keys.py set GEMINI_API_KEY        # asks for the key without showing it (in a terminal)
  python3 tools/keys.py set ELEVENLABS_API_KEY
  python3 tools/keys.py list                       # which keys exist and where (values are never shown)
  python3 tools/keys.py remove GEMINI_API_KEY
  python3 tools/keys.py import ~/old-film/.env     # move keys from an older film's .env into the store (values not shown)

Where a key is looked up, first match wins: the environment, then the film's own .env (to override one film), then
the user's key store ~/.cinecode/keys.env (CINECODE_KEYS sets another path). The store is a KEY=value file only its
owner can read (0600), outside every film folder and repository. Nothing in the kit prints a key or writes it into
a film folder. When there is no terminal (a key pasted into the chat), the value can come on stdin:
printf %s "<key>" | python3 tools/keys.py set GEMINI_API_KEY  (PowerShell: '<key>' | py -3 tools/keys.py set GEMINI_API_KEY;
then suggest rotating it, since the chat keeps a copy).
"""
import argparse
import getpass
import os
import re
import sys

KNOWN = {
    "GEMINI_API_KEY": "Gemini TTS narration · free key at aistudio.google.com/apikey",
    "ELEVENLABS_API_KEY": "ElevenLabs narration (optional) · elevenlabs.io > Profile > API keys",
    "PIXABAY_API_KEY": "Pixabay stock photos and videos · free key at pixabay.com/api/docs",
}


def store_path():
    return os.environ.get("CINECODE_KEYS") or os.path.join(os.path.expanduser("~"), ".cinecode", "keys.env")


def read_env(path):
    out = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as source:
            for line in source:
                m = re.match(r"\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$", line)
                if m and not line.lstrip().startswith("#"):
                    v = "" if m.group(2).startswith("#") else re.sub(r"\s+#.*$", "", m.group(2))   # .env.example comments
                    out[m.group(1)] = v.strip("'\"")
    return out


def get(name):
    """The key's value from the environment, the film's .env or the user's store; None when it is nowhere."""
    return os.environ.get(name) or read_env(".env").get(name) or read_env(store_path()).get(name) or None


def where(name):
    if os.environ.get(name):
        return "environment"
    if read_env(".env").get(name):
        return "this film's .env"
    if read_env(store_path()).get(name):
        return f"key store ({store_path()})"
    return None


def write_store(values):
    path = store_path()
    os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
    fd = os.open(path + ".tmp", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("# cinecode API keys: paste each key right after its = sign, save and close. Used by every film.\n"
                "# Never commit or share this file.\n")
        for k in sorted(values):
            f.write(f"{k}={values[k]}\n")
    os.replace(path + ".tmp", path)
    os.chmod(path, 0o600)


def cmd_set(a):
    name = a.name.upper()
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
        raise SystemExit("key names look like GEMINI_API_KEY")
    value = getpass.getpass(f"{name} ({KNOWN.get(name, 'API key')}): ") if sys.stdin.isatty() else sys.stdin.read()
    value = value.strip()
    if not value or re.search(r"\s", value):
        raise SystemExit("no key given (or it contains spaces); nothing saved")
    values = read_env(store_path())
    values[name] = value
    write_store(values)
    print(f"{name} saved for every film ({store_path()}, readable only by you).")


def cmd_open(a):
    import subprocess
    name = a.name.upper()
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
        raise SystemExit("key names look like GEMINI_API_KEY")
    values = read_env(store_path())
    if values.get(name):
        print(f"{name} is already set ({store_path()}); nothing to do.")
        return
    values[name] = ""
    write_store(values)
    path = store_path()
    opener = (["open", "-t", path] if sys.platform == "darwin" else ["notepad", path] if os.name == "nt"
              else ["xdg-open", path])
    try:
        subprocess.Popen(opener, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"opened {path} in the text editor: paste the key after {name}= , save and close. "
              f"Where to get it: {KNOWN.get(name, 'the service settings')}.")
    except OSError:
        print(f"open {path} in any text editor, paste the key after {name}= and save.")


def cmd_list(a):
    names = sorted(set(KNOWN) | set(read_env(store_path())) | set(read_env(".env")))
    for n in names:
        w = where(n)
        print(f"{n:<20} {'set · ' + w if w else 'not set'}" + (f"  ({KNOWN[n]})" if n in KNOWN else ""))


def cmd_import(a):
    found = {k: v for k, v in read_env(os.path.expanduser(a.file)).items() if v and k.endswith(("_KEY", "_TOKEN"))}
    if not found:
        raise SystemExit(f"no keys with a value in {a.file}")
    values = read_env(store_path())
    values.update(found)
    write_store(values)
    print(f"imported {', '.join(sorted(found))} into the key store ({store_path()}); every film uses them now. "
          f"The old file can be deleted.")


def cmd_remove(a):
    values = read_env(store_path())
    if values.pop(a.name.upper(), None) is None:
        raise SystemExit(f"{a.name} is not in the key store")
    write_store(values)
    print(f"{a.name.upper()} removed from the key store")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("set")
    p.add_argument("name")
    p.set_defaults(fn=cmd_set)
    p = sub.add_parser("open")
    p.add_argument("name")
    p.set_defaults(fn=cmd_open)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    p = sub.add_parser("import")
    p.add_argument("file")
    p.set_defaults(fn=cmd_import)
    p = sub.add_parser("remove")
    p.add_argument("name")
    p.set_defaults(fn=cmd_remove)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
