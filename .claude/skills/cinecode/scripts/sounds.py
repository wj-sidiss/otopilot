#!/usr/bin/env python3
"""Ready sound effects for the film: Kenney's CC0 audio packs (525 designed and recorded sounds: impacts on wood,
glass, metal and plates, footsteps on five grounds, clicks, toggles, pops, book pages, doors, cloth, cards, chips,
dice, lasers, engines), searched by words, kept in one cache every film shares, never the same few again
(Python 3 stdlib + ffmpeg).

  python3 tools/sounds.py search "glass light"              # ids, length, and the ones your last films used
  python3 tools/sounds.py search "cam kırılma" --n 8         # Turkish words work for the common materials
  python3 tools/sounds.py get impact/impactGlass_light_002 --dest assets/sound   # 48 kHz WAV + its LICENSES.csv row
  python3 tools/sounds.py packs                              # the packs and what they hold

The packs (about 12 MB, CC0: no credit owed, commercial use free) are downloaded the first time a search needs them
into ~/.cinecode/cache/sounds (CINECODE_SOUNDS_CACHE); every later film reads them from there. Each get is remembered
with the film's folder in ~/.cinecode/shown-sounds.json (CINECODE_SHOWN_SOUNDS), and so is every sound
asset_search.py fetches: a search lists what your last three films used after the rest, marked, so a shared cache
never turns into the same sounds. Long real recordings (a place's bed, a long event) come from
asset_search.py search --type sound; sounds that follow the picture continuously or sit in the music's key are code
(references/sound.md §5, Where each sound comes from).
"""
import argparse
import csv
import datetime
import io
import json
import os
import re
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

CACHE = Path(os.environ.get("CINECODE_SOUNDS_CACHE") or Path.home() / ".cinecode" / "cache" / "sounds")
SHOWN = Path(os.environ.get("CINECODE_SHOWN_SOUNDS") or Path.home() / ".cinecode" / "shown-sounds.json")
UA = "cinecode-sounds/1.0 (open-licence film sound; low volume)"
PACKS = {   # id prefix: (Kenney page slug, what it holds)
    "impact": ("impact-sounds", "impacts on wood, glass, metal, plates, tin, bells, soft and punch; footsteps on carpet, concrete, grass, snow, wood"),
    "interface": ("interface-sounds", "clicks, ticks, toggles, switches, select, confirm, error, open and close, drop, glass, pluck, scratch, scroll"),
    "ui": ("ui-audio", "switches, clicks, mouse click and release, rollovers"),
    "digital": ("digital-audio", "tones, power-ups, phasers, lasers, zaps, rising and falling bleeps"),
    "rpg": ("rpg-audio", "book open, flip and close, cloth, belt, door open and close, creak, footsteps, knife, coins, metal latch and pot"),
    "casino": ("casino-audio", "cards dealt, slid, shuffled and fanned, chips stacked and collided, dice shaken and thrown"),
    "scifi": ("sci-fi-sounds", "computer noise, sci-fi doors, engines, thrusters, force field, lasers, explosions, slime"),
}
FIELDS = ["file", "title", "author", "source_url", "licence", "licence_url", "attribution_text", "modifications",
          "downloaded_at", "used_in", "notes"]
WORDS = {   # Turkish (and a few loose English) words to the words in the file names
    "cam": "glass", "kırılma": "glass", "bardak": "glass", "ahşap": "wood", "tahta": "wood plank", "odun": "wood",
    "metal": "metal", "demir": "metal", "teneke": "tin", "tabak": "plate", "zil": "bell", "çan": "bell",
    "adım": "footstep", "ayak": "footstep", "halı": "carpet", "beton": "concrete", "çimen": "grass", "kar": "snow",
    "yumuşak": "soft", "ağır": "heavy", "hafif": "light", "orta": "medium", "yumruk": "punch", "darbe": "impact",
    "vuruş": "impact", "çarpma": "impact", "tık": "click tick", "tıklama": "click", "düğme": "click switch toggle",
    "anahtar": "switch", "onay": "confirmation", "hata": "error", "aç": "open", "açılma": "open", "kapa": "close",
    "kapanma": "close", "bırak": "drop", "düşme": "drop", "kaydır": "scroll", "seç": "select", "kazı": "scratch",
    "kitap": "book", "sayfa": "book flip", "kâğıt": "book flip", "kagit": "book flip", "kumaş": "cloth",
    "kapı": "door", "gıcırtı": "creak", "bıçak": "knife", "para": "coins", "bozuk": "coins", "kart": "card",
    "fiş": "chip chips", "zar": "dice die", "lazer": "laser", "patlama": "explosion", "motor": "engine",
    "bip": "tone", "güç": "power", "pop": "pluck drop", "page": "book flip", "paper": "book flip", "footsteps": "footstep",
    "step": "footstep", "button": "click switch toggle", "whoosh": "", "riser": "", "swoosh": "", "hit": "impact",
    "knock": "wood impact",
}


def project_name():
    return Path.cwd().name


def load_shown():
    try:
        return json.loads(SHOWN.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def remember(key, project=None):
    """One sound used in one film (sounds.py get and asset_search.py fetch of a sound)."""
    shown = load_shown()
    uses = [u for u in shown.get(key, []) if u.get("project") != (project or project_name())]
    shown[key] = uses + [{"project": project or project_name(), "at": datetime.date.today().isoformat()}]
    SHOWN.parent.mkdir(parents=True, exist_ok=True)
    SHOWN.write_text(json.dumps(shown, ensure_ascii=False, indent=1), encoding="utf-8")


def recent(films=3):
    """The sounds the last few other films used: {key: film}."""
    shown, here = load_shown(), project_name()
    order = sorted({(u["at"], u["project"]) for uses in shown.values() for u in uses if u["project"] != here}, reverse=True)
    last = []
    for _, p in order:
        if p not in last:
            last.append(p)
    last = set(last[:films])
    return {k: u["project"] for k, uses in shown.items() for u in uses if u["project"] in last}


def download(prefix):
    slug = PACKS[prefix][0]
    page = urllib.request.urlopen(urllib.request.Request(f"https://kenney.nl/assets/{slug}", headers={"User-Agent": UA}),
                                  timeout=30).read().decode("utf-8", "replace")
    m = re.search(r'https://kenney\.nl/media/pages/assets/[^"]+\.zip', page)
    if not m:
        raise RuntimeError(f"no download link on kenney.nl/assets/{slug}")
    data = urllib.request.urlopen(urllib.request.Request(m[0], headers={"User-Agent": UA}), timeout=120).read()
    dest = CACHE / "kenney" / slug
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for name in z.namelist():
            base = os.path.basename(name)
            if base.lower().endswith((".ogg", ".wav")) and not base.lower().startswith("preview") or base.lower() == "license.txt":
                dest.mkdir(parents=True, exist_ok=True)
                (dest / base).write_bytes(z.read(name))


def library(fetch=True):
    """{id: path} of every cached sound; missing packs are downloaded first (about 12 MB in all, once)."""
    missing = [p for p, (slug, _) in PACKS.items() if not (CACHE / "kenney" / slug).is_dir()]
    if missing and fetch:
        print(f"sound packs: downloading {len(missing)} once into {CACHE} (Kenney, CC0, about 12 MB in all)")
        for p in missing:
            try:
                download(p)
            except Exception as e:
                print(f"  {p}: not downloaded ({str(e)[:80]})")
    lib = {}
    for prefix, (slug, _) in PACKS.items():
        folder = CACHE / "kenney" / slug
        for f in sorted(folder.rglob("*")) if folder.is_dir() else []:
            if f.suffix.lower() in (".ogg", ".wav") and not f.stem.lower().startswith("preview"):
                lib[f"{prefix}/{f.stem}"] = f
    return lib


def words_of(sound_id):
    prefix, stem = sound_id.split("/", 1)
    parts = re.sub(r"([a-z])([A-Z])", r"\1 \2", stem).replace("_", " ").replace("-", " ").lower().split()
    return [w for w in parts if not w.isdigit()] + [prefix]


def query_words(q):
    out = []
    for w in q.lower().split():
        out += (WORDS.get(w, w) or "").split()
    return [w for w in out if w]


def length(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       stdout=subprocess.PIPE, text=True)
    try:
        return float(p.stdout.strip())
    except ValueError:
        return 0.0


def search(a):
    lib, want = library(), query_words(a.q)
    if not want and any(w in ("whoosh", "riser", "swoosh") for w in a.q.lower().split()):
        print("whooshes and risers are code: the template's whoosh and riser, timed to land on the cut (sound.md §5)")
        return 1
    if not want:
        sys.exit("search: give a few words (a material and an action: 'glass light', 'wood heavy', 'book flip')")
    scored = []
    for sid in lib:
        have = words_of(sid)
        score = sum(any(h.startswith(w) or w.startswith(h) for h in have) for w in want)
        if score:
            scored.append((score, sid))
    used = recent()
    scored.sort(key=lambda s: (f"kenney:{s[1]}" in used, -s[0], s[1]))
    if not scored:
        print(f"no sound for '{a.q}': try the material in English (glass, wood, metal, plate, book, cloth, door), or "
              f"asset_search.py search --q \"{a.q}\" --type sound for real recordings")
        return 1
    for score, sid in scored[:a.n]:
        mark = f" · used in {used[f'kenney:{sid}']}" if f"kenney:{sid}" in used else ""
        print(f"{sid} · {length(lib[sid]):.2f} s{mark}")
    print(f"{len(scored)} match; get one with: sounds.py get <id> --dest assets/sound (each a separate take: listen, "
          f"pick by ear; vary the take for a repeated event)")
    return 0


def get(a):
    lib = library()
    if a.id not in lib:
        sys.exit(f"get: no sound {a.id} (sounds.py search \"<words>\" lists the ids)")
    dest = Path(a.dest)
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / f"{a.id.replace('/', '-')}.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(lib[a.id]), "-ac", "1", "-ar", "48000",
                    "-c:a", "pcm_s24le", str(out)], check=True)
    lic = Path(a.licenses)
    new = not lic.exists() or lic.stat().st_size == 0
    header = FIELDS if new else next(csv.reader(lic.open(encoding="utf-8")))
    row = {"file": str(out), "title": a.id.split("/", 1)[1], "author": "Kenney (kenney.nl)",
           "source_url": f"https://kenney.nl/assets/{PACKS[a.id.split('/')[0]][0]}", "licence": "cc0",
           "licence_url": "https://creativecommons.org/publicdomain/zero/1.0/", "attribution_text": "",
           "modifications": "converted to 48 kHz WAV", "downloaded_at": datetime.date.today().isoformat(),
           "used_in": "", "notes": "type=sound; source=kenney; sounds.py"}
    with lic.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
        if new:
            w.writeheader()
        w.writerow(row)
    remember(f"kenney:{a.id}")
    print(f"{out} · {length(out):.2f} s · CC0 (logged in {lic})")
    return 0


def packs(a):
    for prefix, (slug, what) in PACKS.items():
        here = "cached" if (CACHE / "kenney" / slug).is_dir() else "not downloaded yet"
        print(f"{prefix:<9} {what} ({here})")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search", help="sounds for a few words")
    s.add_argument("q")
    s.add_argument("--n", type=int, default=10)
    g = sub.add_parser("get", help="one sound into the film as a 48 kHz WAV, with its LICENSES.csv row")
    g.add_argument("id")
    g.add_argument("--dest", default="assets/sound")
    g.add_argument("--licenses", default="LICENSES.csv")
    sub.add_parser("packs", help="the packs and what they hold")
    a = ap.parse_args()
    return {"search": search, "get": get, "packs": packs}[a.cmd](a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
