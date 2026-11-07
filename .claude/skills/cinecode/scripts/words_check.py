#!/usr/bin/env python3
"""The film's own words, checked before any render: on-screen text, titles, labels, captions and narration lines.

  python3 tools/words_check.py                         # film.html (FILM section), audio/vo-lines.json, shots.json
  python3 tools/words_check.py film.html shots.json    # named files only
  python3 tools/words_check.py --line                  # one summary line (make.py prints it)

Hard rule (exit 1): no em dash (—) anywhere in the film's words, and no en dash (–) or double hyphen used as a dash;
an en dash between two numbers (1–3) is a range and stays. Replace a dash with a comma, a full stop, a colon or a
line break; a narrator reads them as pauses anyway.

Tells (warnings): phrases and shapes that make words read as generated, in Turkish and English: the stock clichés of
references/writing.md §6, "not X but Y", staged run-ups ("işte tam da", "gelin birlikte", "imagine"), sayings that
sound deep, inflated words ("adeta", "büyüleyici", "eşsiz", "tapestry", "vibrant"), sales language ("kaçırma",
"hemen keşfet", "breathtaking"), rhetorical questions, three-word abstract lists and stacked exclamation marks.
Turkish suffixes are matched by stem ("fısıld" finds "fısıldıyor", "fısıldayan"). A tell is a question, not a ban:
keep it with a reason on the director card when it is the film's own voice (a quote, a name, a character's line).

Pattern families after blader/humanizer (MIT) and Wikipedia's "Signs of AI writing", rewritten for film words.
"""
import json
import os
import re
import sys
from pathlib import Path

PROJECT = os.getcwd()

# (pattern, label). Turkish stems end without a boundary so every suffix matches; English words keep \b on both sides.
TELLS = [
    # stock clichés (writing.md §6)
    (r"\bin a world where\b|bir dünyada\b", "cliché: 'in a world where'"),
    (r"\bjourney\b|\byolculu[kğ]", "cliché: journey as a metaphor"),
    (r"\blittle did (they|he|she|we) know\b|habersizdi", "cliché: 'little did they know'"),
    (r"\bwhat if\b|\bya .{1,40} olsaydı", "cliché: 'what if'"),
    (r"\bevery moment counts\b|her an değerli", "cliché: 'every moment counts'"),
    (r"\bagainst all odds\b|tüm zorluklara rağmen", "cliché: 'against all odds'"),
    (r"\bnothing (would|will) ever be the same\b|hiçbir şey eskisi gibi olma", "cliché: 'nothing would be the same'"),
    (r"\bthe rest is history\b|gerisi tarih", "cliché: 'the rest is history'"),
    (r"\ba story of (hope|love|courage)\b|(umut|sevgi|cesaret) dolu bir hikâye|(umut|sevgi|cesaret) dolu bir hikaye",
     "cliché: 'a story of hope'"),
    (r"\bwhere \w+ meets \w+\b|ile .{1,20}buluştuğu yer", "cliché: 'where X meets Y'"),
    (r"\bmagic happens\b|sihir gerçekleş", "cliché: 'magic happens'"),
    (r"\bfollow your (dreams|heart)\b|(hayallerinin|kalbinin) peşinden", "cliché: 'follow your dreams'"),
    (r"\b(embark|unlock|dive into|delve)\b|kilidini aç|derinlerine dal", "cliché: 'embark / unlock / dive into'"),
    (r"\b(tapestry|testament)\b|\bdokusu\b|kanıtıdır", "inflated: 'a tapestry / testament of'"),
    (r"\bone thing is certain\b|kesin olan bir şey var", "cliché: 'one thing is certain'"),
    (r"\btimeless\b|\bbeyond time\b|zamansız|zamanın ötesinde", "cliché: 'timeless'"),
    (r"\bunforgettable\b|unutulmaz", "cliché: 'unforgettable'"),
    (r"\band then everything changed\b|(ve )?sonra her şey değişti", "cliché: 'then everything changed'"),
    # not X but Y
    (r"\bnot (just|only|merely|simply)\b|\bit'?s not\b.{1,40}\bit'?s\b", "shape: 'not X but Y'"),
    (r"\bsadece\b.{1,40}\bdeğil\b|\bdeğil\b[,;]?\s+(aksine|bilakis)\b|\bdeğil,\s+\S+", "shape: 'X değil, Y'"),
    # staged run-ups and sayings that sound deep
    (r"\bimagine\b|hayal edin|düşünsene|bir düşünün", "run-up: 'imagine'"),
    (r"\blet'?s\b|\bhere'?s the thing\b|gelin birlikte|işte tam da|işte o an", "run-up: staged opener"),
    (r"\b(the real question|at its core|what really matters)\b|asıl soru|asıl mesele|özünde|aslında mesele",
     "saying: sounds deep, says little"),
    (r"\b(peki ya|hiç düşündünüz mü|hiç merak ettiniz mi)\b|\bhave you ever\b", "run-up: question to the viewer"),
    # inflated words
    (r"\b(vibrant|pivotal|crucial|seamless(ly)?|elevate[sd]?|unleash(es|ed)?|realm|beacon|symphony|whisper(s|ed|ing)?"
     r"|dance[sd]?|dancing|breathtaking|stunning|nestled|game[- ]changer|revolutionary|groundbreaking|meticulous(ly)?)\b",
     "inflated word"),
    (r"\badeta\b|büyüleyici|eşsiz|benzersiz|nefes kesici|muhteşem|mükemmel|ilham verici|büyülü\b|sihirli|"
     r"fısıld|dans ed|senfoni|zamana meydan|sınırları zorla|devrim niteliğinde|\bkalbinde\b|\bsırrı\b",
     "inflated word"),
    # sales language
    (r"\b(don'?t miss|discover now|act now|level up|next level)\b|kaçırma\b|kaçırmayın|hemen keşfet|keşfetmeye hazır|"
     r"fark yarat|bir adım önde|ayrıcalığını yaşa|deneyimini yaşa", "sales language"),
]
DASH = re.compile(r"—|(?<!\d)\s*–\s*(?!\d)|(?<=\d)\s+–|–\s+(?=\d)|\s--\s")
TRIAD = re.compile(r"^\s*([A-Za-zÇĞİÖŞÜçğıöşüâîû]+),\s*([A-Za-zÇĞİÖŞÜçğıöşüâîû]+),?\s+(ve|and)\s+"
                   r"([A-Za-zÇĞİÖŞÜçğıöşüâîû]+)[.!]?\s*$", re.I)
JSON_KEYS = {"text", "vo", "line", "lines", "sub", "label", "title", "caption", "cta", "words", "w"}


def fold(text):
    """Lower case for matching; dotted and dotless i fold together, so an all-caps Turkish card (FISILDIYOR, whose I
    is a dotless ı) matches the same stems as its lower-case spelling."""
    return text.replace("İ", "i").lower().replace("ı", "i")


def js_strings(src):
    """String literals of a JS source, comments skipped (no full parser: enough for the FILM section)."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith("//", i):
            i = src.find("\n", i)
            i = n if i < 0 else i
        elif src.startswith("/*", i):
            i = src.find("*/", i + 2)
            i = n if i < 0 else i + 2
        elif c in "'\"`":
            j, buf = i + 1, []
            while j < n and src[j] != c:
                if src[j] == "\\" and j + 1 < n:
                    buf.append(src[j + 1])
                    j += 2
                    continue
                buf.append(src[j])
                j += 1
            out.append((src.count("\n", 0, i) + 1, "".join(buf)))
            i = j + 1
        else:
            i += 1
    return out


def film_words(path):
    src = Path(path).read_text(encoding="utf-8")
    start = src.find("// ============================== FILM")
    end = src.find("// ============================== HELPERS", start + 1)
    if start < 0:
        return []
    offset = src.count("\n", 0, start)
    words = []
    for line, s in js_strings(src[start:end if end > 0 else len(src)]):
        if not re.search(r"[A-Za-zÇĞİÖŞÜçğıöşü]", s) or re.fullmatch(r"#?[0-9a-fA-F]{3,8}", s) or \
                re.search(r"^(https?:|data:|\.{0,2}/)|\.(wav|mp3|mp4|png|jpe?g|svg|json|woff2?|ttf|otf)$|\d+px|rgba?\(", s):
            continue
        words.append((f"{os.path.basename(path)}:{line + offset}", s))
    return words


def json_words(path):
    found = []

    def walk(v, where, key=None):
        if isinstance(v, dict):
            for k, x in v.items():
                walk(x, f"{where}.{k}" if where else k, k)
        elif isinstance(v, list):
            for i, x in enumerate(v):
                walk(x, f"{where}[{i}]", key)
        elif isinstance(v, str) and key in JSON_KEYS:
            found.append((f"{os.path.basename(path)}:{where}", v))
    try:
        walk(json.loads(Path(path).read_text(encoding="utf-8")), "")
    except (OSError, ValueError):
        pass
    return found


def check(items):
    dashes, tells = [], []
    exclaims = sum(s.count("!") for _, s in items)
    for where, s in items:
        if DASH.search(s):
            dashes.append((where, s))
        low = fold(s)
        for pat, label in TELLS:
            if re.search(pat.replace("ı", "i"), low):
                tells.append((where, s, label))
        if s.strip().endswith("?") and len(s.split()) > 1:
            tells.append((where, s, "rhetorical question"))
        if TRIAD.match(s):
            tells.append((where, s, "three-word list"))
        if "!!" in s:
            tells.append((where, s, "stacked exclamation marks"))
    if exclaims > 2:
        tells.append(("all words", f"{exclaims} exclamation marks", "too many exclamation marks (≤ 2 in a film)"))
    return dashes, tells


def default_files():
    names = ["film.html", os.path.join("audio", "vo-lines.json"), "shots.json", os.path.join("audio", "captions.json")]
    return [os.path.join(PROJECT, n) for n in names if os.path.exists(os.path.join(PROJECT, n))]


def gather(files):
    items = []
    for f in files:
        items += film_words(f) if f.endswith((".html", ".htm")) else json_words(f)
    return items


def main(argv):
    if "-h" in argv or "--help" in argv:
        print(__doc__)
        return 0
    line_only = "--line" in argv
    files = [a for a in argv if not a.startswith("--")] or default_files()
    items = gather(files)
    dashes, tells = check(items)
    short = lambda s: (s[:38] + "…") if len(s) > 39 else s
    if line_only:
        parts = []
        if dashes:
            parts.append(f"DASH in {len(dashes)} line{'s' if len(dashes) > 1 else ''} (never in the film's words): "
                         + ", ".join(f"'{short(s)}'" for _, s in dashes[:3]))
        if tells:
            by = {}
            for _, s, label in tells:
                by.setdefault(s, []).append(label.split(":")[0])
            parts.append(f"{len(tells)} tell{'s' if len(tells) > 1 else ''}: "
                         + ", ".join(f"'{short(s)}' ({', '.join(dict.fromkeys(ls))})" for s, ls in list(by.items())[:3]))
        print(("words: " + "; ".join(parts) + " (tools/words_check.py)") if parts else "")
        return 1 if dashes else 0
    print(f"{len(items)} strings in {', '.join(os.path.basename(f) for f in files) or 'no files'}")
    for where, s in dashes:
        print(f"DASH  {where}  '{s}'  -> a comma, a full stop, a colon or a line break")
    for where, s, label in tells:
        print(f"TELL  {where}  '{s}'  ({label})")
    print(f"{len(dashes)} dash(es), {len(tells)} tell(s)" + ("" if dashes or tells else ": the words read as written"))
    return 1 if dashes else 0


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main(sys.argv[1:]))
