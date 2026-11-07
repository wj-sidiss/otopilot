#!/usr/bin/env python3
"""Search 2,000+ open-licence fonts by the film's tone (Python 3 standard library; no key).

  python3 tools/fonts.py search "komik çizgi film"              # display faces that carry the tone
  python3 tools/fonts.py search "belgesel sakin" --role text     # text faces: readable, the same tone
  python3 tools/fonts.py search "korku" --category serif --n 12
  python3 tools/fonts.py role shrikhand                          # the TYPE role for film.html, version pinned

Sources: the Fontsource catalogue (every family with its licence, subsets and versions; files on the jsDelivr CDN
that the kit's type loader already uses) and the expressive tags of the Google Fonts repository (each family scored
0-100 for Playful, Calm, Rugged, Vintage, Sophisticated, Futuristic and more). Both are cached for 30 days in
~/.cinecode/cache/fonts. Only open licences, only families with Turkish letters (latin-ext) unless --latin-only.
The fonts every generated design overuses (Inter, Roboto, Montserrat, Poppins, Space Grotesk,
Instrument, Playfair, DM, Geist and the like) are left out unless --allow-common: a film's type is chosen, not
defaulted. The tone words may be Turkish or English; `fonts.py tones` lists them.
"""
import argparse
import csv
import json
import os
import sys
import time
import struct
import urllib.request
import zlib

CACHE = os.path.join(os.path.expanduser("~"), ".cinecode", "cache", "fonts")
CATALOGUE = "https://api.fontsource.org/v1/fonts"
TAGS = "https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv"
# Licences that allow any film, commercial included, with nothing owed on screen or in the description: the font is
# used, never sold or shared as a file. Attribution (CC-BY), share-alike and GPL licences are left out on purpose.
OPEN = {"OFL-1.1", "APACHE-2.0", "MIT", "CC0-1.0", "UFL-1.0", "UNLICENSE"}


def open_licence(lic):
    return str(lic or "").upper() in OPEN

# What every generated design defaults to; allowed only with --allow-common and a reason on the director card.
COMMON = {"inter", "roboto", "open-sans", "montserrat", "poppins", "lato", "raleway", "nunito", "nunito-sans",
          "space-grotesk", "instrument-sans", "instrument-serif", "dm-sans", "dm-serif-display", "dm-serif-text",
          "playfair-display", "geist", "geist-mono", "manrope", "plus-jakarta-sans", "outfit", "work-sans",
          "source-sans-3", "roboto-mono", "jetbrains-mono", "noto-sans", "noto-serif", "oswald", "bebas-neue",
          "lora", "merriweather", "rubik", "mulish", "figtree", "archivo", "sora", "urbanist", "libre-baskerville",
          "lobster", "pacifico", "dancing-script", "great-vibes", "comic-neue", "bangers", "abril-fatface", "cinzel"}

# Tone words (Turkish and English) -> the Google Fonts expressive or theme tags that carry them.
TONES = {
    ("komik", "comedy", "çizgi", "cartoon", "goofy", "slapstick", "eğlenceli", "fun", "playful", "oyunbaz"):
        ["/Expressive/Playful", "/Expressive/Happy", "/Expressive/Excited", "/Theme/Wacky", "/Theme/Blobby"],
    ("çocuk", "kids", "children", "oyuncak", "toy", "sevimli", "cute"):
        ["/Expressive/Childlike", "/Expressive/Cute", "/Expressive/Happy"],
    ("korku", "horror", "gerilim", "thriller", "karanlık", "dark", "ürpertici"):
        ["/Theme/Distressed", "/Expressive/Rugged", "/Expressive/Awkward", "/Seasonal/Halloween"],
    ("belgesel", "documentary", "tarih", "history", "haber", "news", "ciddi", "serious"):
        ["/Expressive/Sincere", "/Expressive/Competent", "/Expressive/Calm", "/Expressive/Business"],
    ("lüks", "luxury", "premium", "moda", "fashion", "zarif", "elegant", "sofistike"):
        ["/Expressive/Sophisticated", "/Expressive/Fancy"],
    ("teknoloji", "tech", "gelecek", "future", "bilimkurgu", "scifi", "uygulama", "app", "saas"):
        ["/Expressive/Futuristic", "/Expressive/Innovative", "/Theme/Techno"],
    ("retro", "nostalji", "nostalgic", "vintage", "eski", "western", "kovboy"):
        ["/Expressive/Vintage", "/Theme/Woodtype", "/Expressive/Rugged"],
    ("masal", "fairy", "folk", "halk", "efsane", "myth", "fable", "sanatsal", "artistic"):
        ["/Expressive/Artistic", "/Expressive/Sincere", "/Theme/Brush"],
    ("spor", "sport", "aksiyon", "action", "enerji", "energy", "hızlı", "fast"):
        ["/Expressive/Active", "/Expressive/Loud", "/Expressive/Excited"],
    ("romantik", "romance", "aşk", "love", "şiirsel", "poetic", "sakin", "calm", "huzur"):
        ["/Expressive/Calm", "/Expressive/Fancy", "/Expressive/Sincere"],
    ("piksel", "pixel", "oyun", "game", "arcade"): ["/Theme/Pixel", "/Expressive/Playful"],
    ("sert", "rugged", "endüstriyel", "industrial", "sokak", "street", "punk"):
        ["/Expressive/Rugged", "/Theme/Distressed", "/Expressive/Loud"],
    ("kurumsal", "corporate", "business", "güven", "trust"): ["/Expressive/Business", "/Expressive/Competent"],
    ("sıcak", "warm", "samimi", "cozy", "friendly", "dostça", "ev", "home"):
        ["/Expressive/Sincere", "/Expressive/Calm", "/Expressive/Happy"],
}


def fetch(url, dest, max_age_days=30):
    os.makedirs(CACHE, exist_ok=True)
    if os.path.exists(dest) and time.time() - os.path.getmtime(dest) < max_age_days * 86400:
        return dest
    req = urllib.request.Request(url, headers={"User-Agent": "cinecode-fonts/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r, open(dest + ".part", "wb") as f:
            f.write(r.read())
        os.replace(dest + ".part", dest)
    except OSError as e:
        if not os.path.exists(dest):
            sys.exit(f"fonts: cannot reach {url.split('/')[2]} ({e}); try again online")
    return dest


def catalogue():
    with open(fetch(CATALOGUE, os.path.join(CACHE, "fontsource.json")), encoding="utf-8") as f:
        return {x["id"]: x for x in json.load(f)}


def tags():
    out = {}
    with open(fetch(TAGS, os.path.join(CACHE, "gf-tags.csv")), encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) >= 4 and row[2].startswith("/"):
                try:
                    out.setdefault(row[0].lower(), {})[row[2]] = float(row[3])
                except ValueError:
                    pass
    return out


def fold(text):
    """İ, I and ı all match as i, so "ÇİZGİ", "çizgi" and "KIDS" find their tone."""
    return text.replace("İ", "i").lower().replace("ı", "i")


def tone_tags(words):
    ws = {fold(w.strip(" ,.;")) for w in words.split()}
    folded = {keys: {fold(k) for k in keys} for keys in TONES}
    found = [t for keys, ts in TONES.items() if ws & folded[keys] for t in ts]
    unknown = sorted(w for w in ws if w and not any(w in folded[keys] for keys in TONES))
    return list(dict.fromkeys(found)), unknown


TURKISH = {"latin-ext": (0x011E, 0x011F, 0x0130, 0x015E, 0x015F), "latin": (0x0131,)}   # Ğ ğ İ Ş ş, and ı


def cmap_codes(woff, wanted):
    """The wanted code points a WOFF 1.0 font really maps to a glyph (its cmap table; stdlib only)."""
    if woff[:4] != b"wOFF":
        return None
    n = struct.unpack(">H", woff[12:14])[0]
    for i in range(n):
        tag, off, comp, orig, _ = struct.unpack(">4sIIII", woff[44 + 20 * i:64 + 20 * i])
        if tag == b"cmap":
            t = woff[off:off + comp]
            cmap = zlib.decompress(t) if comp < orig else t
            break
    else:
        return None
    subs = {}
    for i in range(struct.unpack(">H", cmap[2:4])[0]):
        pid, eid, off = struct.unpack(">HHI", cmap[4 + 8 * i:12 + 8 * i])
        subs[(pid, eid)] = off
    found = set()
    for key in ((3, 10), (0, 4), (3, 1), (0, 3)):
        if key not in subs:
            continue
        o = subs[key]
        fmt = struct.unpack(">H", cmap[o:o + 2])[0]
        if fmt == 12:
            for g in range(struct.unpack(">I", cmap[o + 12:o + 16])[0]):
                lo, hi, _ = struct.unpack(">III", cmap[o + 16 + 12 * g:o + 28 + 12 * g])
                found |= {c for c in wanted if lo <= c <= hi}
            return found
        if fmt == 4:
            seg = struct.unpack(">H", cmap[o + 6:o + 8])[0] // 2
            ends = struct.unpack(f">{seg}H", cmap[o + 14:o + 14 + 2 * seg])
            base = o + 16 + 2 * seg
            starts = struct.unpack(f">{seg}H", cmap[base:base + 2 * seg])
            deltas = struct.unpack(f">{seg}h", cmap[base + 2 * seg:base + 4 * seg])
            ro_at = base + 4 * seg
            ranges = struct.unpack(f">{seg}H", cmap[ro_at:ro_at + 2 * seg])
            for c in wanted:
                for k in range(seg):
                    if starts[k] <= c <= ends[k]:
                        if ranges[k] == 0:
                            gid = (c + deltas[k]) & 0xFFFF
                        else:
                            at = ro_at + 2 * k + ranges[k] + 2 * (c - starts[k])
                            gid = struct.unpack(">H", cmap[at:at + 2])[0]
                            gid = (gid + deltas[k]) & 0xFFFF if gid else 0
                        if gid:
                            found.add(c)
                        break
            return found
    return found


def turkish_in_files(fid, f):
    """True / False from the font's own subset files (a latin-ext label can still lack Ğ İ Ş); None if unreadable."""
    weights = [int(w) for w in f.get("weights", [400])] or [400]
    w = 400 if 400 in weights else weights[0]
    for subset, codes in TURKISH.items():
        url = (f"https://cdn.jsdelivr.net/npm/@fontsource/{fid}@{f.get('npmVersion') or 'latest'}"
               f"/files/{fid}-{subset}-{w}-normal.woff")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "cinecode-fonts/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                found = cmap_codes(r.read(), codes)
        except (OSError, ValueError, struct.error, zlib.error):
            return None
        if found is None:
            return None
        if len(found) < len(codes):
            return False
    return True


def verify_turkish(cands):
    """{id: True/False/None} for (id, font) pairs, read in parallel, cached for good per version."""
    memo_path = os.path.join(CACHE, "turkish.json")
    try:
        with open(memo_path, encoding="utf-8") as fh:
            memo = json.load(fh)
    except (OSError, ValueError):
        memo = {}
    key = lambda fid, f: f"{fid}@{f.get('npmVersion') or 'latest'}"
    todo = [(fid, f) for fid, f in cands if key(fid, f) not in memo]
    if todo:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(8) as pool:
            for (fid, f), ok in zip(todo, pool.map(lambda c: turkish_in_files(*c), todo)):
                if ok is not None:
                    memo[key(fid, f)] = ok
        os.makedirs(CACHE, exist_ok=True)
        with open(memo_path, "w", encoding="utf-8") as fh:
            json.dump(memo, fh)
    return {fid: memo.get(key(fid, f)) for fid, f in cands}


def cmd_search(a):
    a.n = max(1, min(a.n, 40))                   # each result's font file is read for the Turkish check
    want, unknown = tone_tags(a.tone)
    if not want:
        sys.exit(f"fonts: no known tone in '{a.tone}'; see: python3 tools/fonts.py tones")
    cat, tg = catalogue(), tags()
    rows = []
    for fid, f in cat.items():
        if not open_licence(f.get("license")) or f.get("category") == "icons":
            continue
        other = {x for x in f.get("subsets", []) if x not in ("latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek",
                                                              "greek-ext", "vietnamese", "math", "symbols")}
        if f.get("defSubset") not in ("latin", "latin-ext") or any(x in fid for x in other) or \
                fid.endswith(("-jp", "-kr", "-sc", "-tc", "-hk", "-thai", "-arabic", "-hebrew", "-devanagari")) or \
                "hentaigana" in fid:
            continue                             # made for another script (Noto Sans Avestan, IBM Plex Sans Devanagari…)
        if not a.latin_only and "latin-ext" not in f.get("subsets", []):
            continue
        if fid in COMMON and not a.allow_common:
            continue
        if a.category and f.get("category") != a.category:
            continue
        if a.role == "text" and f.get("category") not in ("serif", "sans-serif"):
            continue
        t = tg.get(f["family"].lower(), {})
        score = sum(t.get(w, 0) for w in want) / len(want)
        if a.role == "text":                       # a text face must also read: calm, competent, business
            score = 0.6 * score + 0.4 * (t.get("/Expressive/Calm", 0) + t.get("/Expressive/Competent", 0)) / 2
            if len(f.get("weights", [])) < 2 and not f.get("variable"):
                continue
        if score > 0:
            rows.append((score, fid, f))
    rows.sort(key=lambda r: (-r[0], r[1]))
    seen, kept = set(), []                       # one face per family stem (Rubik Distressed, Rubik Wet Paint…)
    for r in rows:
        stem = r[2]["family"].split()[0].lower()
        if stem not in seen:
            seen.add(stem)
            kept.append(r)
    if not a.category:                           # spread the shortlist across categories, best first in each
        by = {}
        for r in kept:
            by.setdefault(r[2]["category"], []).append(r)
        top = kept[0][0] if kept else 0          # a category joins the spread only with a real fit (≥ 40% of the best)
        order = [c for c in sorted(by, key=lambda c: -by[c][0][0]) if by[c][0][0] >= 0.4 * top]
        mixed = []
        while any(by[c] for c in order) and len(mixed) < a.n:
            for c in order:
                if by[c] and len(mixed) < a.n:
                    mixed.append(by[c].pop(0))
        kept = sorted(mixed, key=lambda r: -r[0]) + [r for c in order for r in by[c]]
    rows = kept
    if unknown:
        print(f"(not a known tone word: {', '.join(unknown)})")
    print(f"tone: {', '.join(w.split('/')[-1] for w in want)} · {len(rows)} open fonts with a Turkish subset (each one shown checked for Ğ İ Ş ı)"
          + (" (fonts AI designs overuse left out)" if not a.allow_common else ""))
    shown, dropped = 0, []
    pool = rows[:3 * a.n]
    checked = {} if a.latin_only else verify_turkish([(fid, f) for _, fid, f in pool])
    for score, fid, f in pool:
        if shown >= a.n:
            break
        tr = True if a.latin_only else checked.get(fid)
        if tr is False:
            dropped.append(fid)
            continue
        var = "variable" if f.get("variable") else f"{len(f.get('weights', []))} weights"
        print(f"  {fid:<28} {f['category']:<11} {score:5.1f}  {var:<11} {f['license']}"
              + ("" if tr else "  (Turkish letters not verified)"))
        shown += 1
    if dropped:
        print(f"(left out, missing Ğ İ Ş in the font itself: {', '.join(dropped)})")
    print("next: python3 tools/fonts.py role <id>  (the TYPE role for film.html, version pinned)")


def cmd_role(a):
    req = urllib.request.Request(f"{CATALOGUE}/{a.id}", headers={"User-Agent": "cinecode-fonts/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            f = json.load(r)
    except OSError as e:
        sys.exit(f"fonts: cannot read {a.id} ({e})")
    if not open_licence(f.get("license")):
        sys.exit(f"fonts: {a.id} is {f.get('license')}, not an open licence")
    checked = verify_turkish([(a.id, f)])[a.id] if "latin-ext" in f.get("subsets", []) else False
    turkish = checked is not False
    have = [int(w) for w in f.get("weights", [400])]
    pick = [w for w in (400, 700, 900) if w in have] or have[:2]   # static cuts: every family ships them, pinned
    role = {"family": f["family"], "pkg": f["id"], "version": f.get("npmVersion"), "weights": pick,
            "subsets": ["latin", "latin-ext"] if turkish else ["latin"]}
    print(json.dumps(role, ensure_ascii=False))
    print(f"{f['family']} · {f.get('category')} · {f.get('license')} · {'Turkish letters' if checked else 'Turkish letters NOT VERIFIED (the font file could not be read)' if turkish else 'NO Turkish letters (latin only)'}"
          f" · source {f.get('source', 'fontsource')} · log it in LICENSES.csv")


def cmd_tones(a):
    for keys, ts in TONES.items():
        print(f"{' / '.join(keys[:4])} -> {', '.join(t.split('/')[-1] for t in ts)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("search")
    p.add_argument("tone", help="the film's tone in a few words (Turkish or English)")
    p.add_argument("--role", choices=["display", "text"], default="display")
    p.add_argument("--category", choices=["serif", "sans-serif", "display", "handwriting", "monospace"])
    p.add_argument("--n", type=int, default=10, help="how many (at most 40)")
    p.add_argument("--latin-only", action="store_true")
    p.add_argument("--allow-common", action="store_true", help="include the fonts AI designs overuse (needs a reason)")
    p.set_defaults(fn=cmd_search)
    p = sub.add_parser("role")
    p.add_argument("id", help="the Fontsource id from search, e.g. shrikhand")
    p.set_defaults(fn=cmd_role)
    sub.add_parser("tones").set_defaults(fn=cmd_tones)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()
