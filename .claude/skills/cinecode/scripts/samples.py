#!/usr/bin/env python3
"""Recorded instruments for the score, all CC0: the Versilian Community Sample Library (VCSL) and the Versilian Studios
Chamber Orchestra 2 Community Edition (VSCO 2 CE), pinned to one commit each. Nothing is installed and nothing is
downloaded until a film asks for an instrument: then only that instrument's chosen takes (about 12 notes across its
range, or a few hits), and of each only the first seconds a score uses, are fetched, turned into small mono FLAC files,
cached once in ~/.cinecode/cache/samples and copied into the film's audio/samples/ with one LICENSES.csv row each.

  python3 tools/samples.py list                        # instruments by family, the notes they cover, the download
  python3 tools/samples.py get violins cellos-pizz     # into audio/samples/ (+ audio/samples/index.json)
  python3 tools/samples.py get ... --yes               # a film whose new downloads pass 50 MB asks the user first

In film.html: INSTRUMENTS = ['violins', 'darbuka'] in the FILM section, then in score():
  sample(ctx, out, 'violins', bar(2), { note: 'E4', vel: 0.7 })      // pitched: the nearest take, re-pitched
  sample(ctx, out, 'darbuka', beat(3), { vel: 1 })                   // unpitched: a take chosen by velocity
Offline, or when the user declines a download: the synthesised voices (pad, pluck, lead, bass, stab, the drums).
"""
import argparse
import csv
import json
import math
import os
import re
import shutil
import statistics
import struct
import subprocess
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CACHE = os.environ.get("CINECODE_SAMPLES_CACHE") or os.path.join(os.path.expanduser("~"), ".cinecode", "cache", "samples")
NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
ASK_MB = 50                                      # new downloads for one film above this: the user says yes first
UA = {"User-Agent": "cinecode-samples/2.0"}

SOURCES = {
    "mg": {"repo": "Vincentwei1021/mg-styles-15", "commit": "49052d80bfaf9fa8412cc9710530e5e95a3b8d8c",
           "root": "lib/audio/samples/", "title": "Versilian Community Sample Library",
           "url": "https://github.com/sgossner/VCSL", "note": "packed by github.com/Vincentwei1021/mg-styles-15 (MIT)"},
    "vcsl": {"repo": "sgossner/VCSL", "commit": "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e", "root": "",
             "title": "Versilian Community Sample Library", "url": "https://github.com/sgossner/VCSL", "note": ""},
    "vsco": {"repo": "sgossner/VSCO-2-CE", "commit": "440300901dfe9275fd84e0b7763af1f8443ae62e", "root": "",
             "title": "Versilian Studios Chamber Orchestra 2 CE", "url": "https://github.com/sgossner/VSCO-2-CE", "note": ""},
}

# name: (source, folder, file filter or "", seconds kept per take, family). The families follow references/sound.md §8.
S, V = "vsco", "vcsl"
CATALOG = {
    "violins":        (S, "Strings/Violin Section/susVib", "", 4, "strings"),
    "violins-spic":   (S, "Strings/Violin Section/Spic", "", 1.5, "strings"),
    "violins-pizz":   (S, "Strings/Violin Section/Pizz", "", 2, "strings"),
    "violins-trem":   (S, "Strings/Violin Section/Trem", "", 4, "strings"),
    "violas":         (S, "Strings/Viola Section/susvib", "", 4, "strings"),
    "cellos":         (S, "Strings/Cello Section/susvib", "", 4, "strings"),
    "cellos-spic":    (S, "Strings/Cello Section/spic", "", 1.5, "strings"),
    "cellos-pizz":    (S, "Strings/Cello Section/pizzT", "", 2.5, "strings"),
    "contrabass":     (S, "Strings/Solo Contrabass/SusVib", "", 4, "strings"),
    "bass-pizz":      (S, "Strings/Solo Contrabass/Pizz", "", 2.5, "strings"),
    "violin":         (S, "Strings/Solo Violin/Arco Vib", "_(mf|f)\\.wav$", 4, "strings"),
    "horn":           (S, "Brass/F Horn/sus", "", 4, "brass"),
    "horn-stac":      (S, "Brass/F Horn/stac", "", 1.5, "brass"),
    "trumpet":        (S, "Brass/Trumpet/sus", "", 4, "brass"),
    "trumpet-stac":   (S, "Brass/Trumpet/stac", "", 1.5, "brass"),
    "trumpet-muted":  (S, "Brass/Trumpet/harmonM-sus", "", 4, "brass"),
    "trombone":       (S, "Brass/Tenor Trombone/sus", "", 4, "brass"),
    "tuba-stac":      (S, "Brass/Tuba/stac", "", 1.5, "brass"),
    "flute":          (S, "Woodwinds/Flute/susvib", "", 4, "woodwinds"),
    "flute-stac":     (S, "Woodwinds/Flute/stac", "", 1.5, "woodwinds"),
    "clarinet":       (S, "Woodwinds/Clarinet/susLong", "", 4, "woodwinds"),
    "clarinet-stac":  (S, "Woodwinds/Clarinet/stac", "", 1.5, "woodwinds"),
    "oboe":           (S, "Woodwinds/Oboe/Vib", "", 4, "woodwinds"),
    "bassoon":        (S, "Woodwinds/Bassoon/sus", "", 4, "woodwinds"),
    "bassoon-stac":   (S, "Woodwinds/Bassoon/stac", "", 1.5, "woodwinds"),
    "recorder":       (V, "Aerophones/Edge-blown Aerophones/Baroque Alto Recorder/SusVib", "", 4, "woodwinds"),
    "ocarina":        (V, "Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib", "", 4, "woodwinds"),
    "sax":            (V, "Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato", "", 4, "woodwinds"),
    "sax-stac":       (V, "Aerophones/Reed Aerophones/Tenor Saxophone/Staccato", "", 1.5, "woodwinds"),
    "harmonica":      (V, "Aerophones/Free Aerophones/Harmonica-Hohner-Special20-C/Sustains/Vib", "", 4, "woodwinds"),
    "upright":        (V, "Chordophones/Zithers/Upright Piano, Yamaha/Sustains", "", 4, "keys"),
    "harpsichord":    (V, "Chordophones/Zithers/Harpsichord, French/Sustains", "", 4, "keys"),
    "organ":          (V, "Aerophones/Edge-blown Aerophones/Pipe Organ/Quiet", "", 4, "keys"),
    "organ-full":     (V, "Aerophones/Edge-blown Aerophones/Pipe Organ/Loud", "", 4, "keys"),
    "chamber-organ":  (V, "Aerophones/Edge-blown Aerophones/Renaissance Organ/8'", "", 4, "keys"),
    "fm-piano":       (V, "Electrophones/TX81Z/FM Piano", "", 4, "keys"),
    "clavi":          (V, "Electrophones/TX81Z/Clavisynth", "", 2.5, "keys"),
    "strumstick":     (V, "Chordophones/Composite Chordophones/Strumstick/Finger", "", 3, "plucked"),
    "folk-harp":      (V, "Chordophones/Composite Chordophones/Folk Harp", "", 4, "plucked"),
    "concert-harp":   (V, "Chordophones/Composite Chordophones/Concert Harp", "", 4, "plucked"),
    "psaltery":       (V, "Chordophones/Zithers/Psaltery, Bowed and Plucked/Pluck", "", 3, "plucked"),
    "zither":         (V, "Chordophones/Zithers/Dan Tranh/Normal", "", 3, "plucked"),
    "mbira":          (V, "Idiophones/Plucked Idiophones/Mbira Mavembe (Gandanga), Zimbabwe, Low G", "", 3, "plucked"),
    "balafon":        (V, "Idiophones/Struck Idiophones/Balafon/Soft Mallet", "", 2, "mallets"),
    "xylophone":      (V, "Idiophones/Struck Idiophones/Xylophone/Medium Mallets", "", 2, "mallets"),
    "vibes":          (V, "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets", "", 4, "mallets"),
    "hand-chimes":    (V, "Idiophones/Struck Idiophones/Hand Chimes", "", 4, "mallets"),
    "tubular-bells":  (V, "Idiophones/Struck Idiophones/Tubular Bells 2", "", 4, "mallets"),
    "darbuka":        (V, "Membranophones/Struck Membranophones/Darbuka", "", 1, "percussion"),
    "frame-drum":     (V, "Membranophones/Struck Membranophones/Frame Drum", "", 1.5, "percussion"),
    "conga":          (V, "Membranophones/Struck Membranophones/Conga", "^Conga", 1, "percussion"),
    "bongos":         (V, "Membranophones/Struck Membranophones/Bongos", "", 1, "percussion"),
    "cajon":          (V, "Idiophones/Struck Idiophones/Cajon", "", 1, "percussion"),
    "shaker":         (V, "Idiophones/Struck Idiophones/Shaker, Large", "Hit", 1, "percussion"),
    "tambourine":     (V, "Idiophones/Struck Idiophones/Tambourine 1", "Hit", 1, "percussion"),
    "claps":          (V, "Idiophones/Struck Idiophones/Claps", "", 1, "percussion"),
    "hihat":          (V, "Idiophones/Struck Idiophones/Hi-Hat Cymbal", "HitC_", 1, "percussion"),
    "hihat-open":     (V, "Idiophones/Struck Idiophones/Hi-Hat Cymbal", "HitO_|HitLoose", 2, "percussion"),
    "hihat-foot":     (V, "Idiophones/Struck Idiophones/Hi-Hat Cymbal", "Close", 1, "percussion"),
    "ride":           (V, "Idiophones/Struck Idiophones/Suspended Cymbal 1", "hit_stick", 2.5, "percussion"),
    "ride-bell":      (V, "Idiophones/Struck Idiophones/Suspended Cymbal 1", "hit_bell", 2.5, "percussion"),
    "snare-drum":     (V, "Membranophones/Struck Membranophones/Snare Drum, Modern 1", "HitSN", 1.2, "percussion"),
    "tom-high":       (V, "Membranophones/Struck Membranophones/Tom 1/Stick", "", 1.5, "percussion"),
    "tom-low":        (V, "Membranophones/Struck Membranophones/Tom 2/Stick", "", 1.5, "percussion"),
    "bass-drum":      (V, "Membranophones/Struck Membranophones/Bass Drum 1", "", 2, "percussion"),
    "timpani-roll":   (V, "Membranophones/Struck Membranophones/Timpani 1/Roll", "", 4, "percussion"),
    "cowbell":        (V, "Idiophones/Struck Idiophones/Cowbells", "Hit", 1, "percussion"),
    "agogo":          (V, "Idiophones/Struck Idiophones/Agogo Bells", "", 1, "percussion"),
    "claves":         (V, "Idiophones/Struck Idiophones/Claves", "Hit", 1, "percussion"),
    "triangle":       (V, "Idiophones/Struck Idiophones/Triangles", "Hit_", 3, "percussion"),
    "sleigh-bells":   (V, "Idiophones/Struck Idiophones/Sleigh Bells", "", 1.5, "percussion"),
    "gong":           (V, "Idiophones/Struck Idiophones/Gong 1", "", 6, "percussion"),
    "anvil":          (V, "Idiophones/Struck Idiophones/Anvil", "", 1.5, "percussion"),
    "slit-drum":      (V, "Idiophones/Struck Idiophones/Slit Drum", "", 1, "percussion"),
}
FULLER = {"vibraphone": "vibes", "harp": "concert-harp"}     # the classic takes cover a few notes; these cover the range
MAX_NOTES, MAX_GAP, MAX_HITS = 16, 3, 6     # a take re-pitched by at most 1.5 semitones

NOTE_RX = re.compile(r"(?<![A-Za-z#])([A-G])(#|b)?(-?\d)(?=[_\-. ]|$)")
VEL_RX = re.compile(r"(?:^|[_\- ])(?:v|vl|dyn)(\d+)(?=[_.\- ]|$)", re.I)
DYN_RX = re.compile(r"(?:^|[_\-])(ppp|pp|p|mp|mf|f|ff|fff)(?=[_.\-\d]|$)")
RR_RX = re.compile(r"(?:rr|RR|_r)(\d+)")
DYN = {"ppp": 1, "pp": 2, "p": 3, "mp": 4, "mf": 5, "f": 6, "ff": 7, "fff": 8}


def raw_url(src, rel):
    s = SOURCES[src]
    return f"https://raw.githubusercontent.com/{s['repo']}/{s['commit']}/{urllib.parse.quote(s['root'] + rel)}"


def fetch(rel, src="mg"):
    dst = os.path.join(CACHE, rel) if src == "mg" else os.path.join(CACHE, src, rel)
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return dst
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(raw_url(src, rel), headers=UA), timeout=60) as r, \
            open(dst + ".part", "wb") as f:
        shutil.copyfileobj(r, f)
    os.replace(dst + ".part", dst)
    return dst


def tree(src):
    """The files the pinned commit holds, with their sizes (one GitHub API call per library, cached)."""
    s = SOURCES[src]
    path = os.path.join(CACHE, f"tree-{src}-{s['commit'][:7]}.json")
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        url = f"https://api.github.com/repos/{s['repo']}/git/trees/{s['commit']}?recursive=1"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
            t = json.load(r)
        files = {x["path"][len(s["root"]):]: x.get("size", 0) for x in t.get("tree", [])
                 if x.get("type") == "blob" and x["path"].startswith(s["root"])}
        json.dump(files, open(path + ".part", "w", encoding="utf-8"))
        os.replace(path + ".part", path)
    return json.load(open(path, encoding="utf-8"))


def parse(name):
    """Note (MIDI), velocity layer and round robin from a sample's file name."""
    base = os.path.basename(name)
    n = NOTE_RX.search(base)
    midi = NOTES.index(n[1]) + {"#": 1, "b": -1}.get(n[2] or "", 0) + 12 * (int(n[3]) + 1) if n else None
    v, d = VEL_RX.search(base), DYN_RX.search(base)
    vel = int(v[1]) if v else DYN[d[1]] if d else 0
    rr = RR_RX.search(base)
    return midi, vel, int(rr[1]) if rr else 1


def choose(files, filt=""):
    """The takes a film gets: pitched, one per note at a middle velocity, about MAX_NOTES spread over the range;
    unpitched, up to MAX_HITS spread over the velocities and kinds of hit."""
    files = {p: s for p, s in files.items() if p.lower().endswith(".wav") and (not filt or re.search(filt, os.path.basename(p)))}
    info = {p: parse(p) for p in files}
    pitched = [p for p in files if info[p][0] is not None]
    if len(pitched) >= max(3, len(files) // 2):
        by_note = {}
        for p in pitched:
            by_note.setdefault(info[p][0], []).append(p)
        def middle(ps):
            vels = sorted({info[p][1] for p in ps})
            want = vels[(len(vels) - 1) // 2] if len(vels) < 4 else vels[len(vels) // 2]
            return min(ps, key=lambda p: (abs(info[p][1] - want), info[p][2], p))
        notes = sorted(by_note)
        for gap in range(1, MAX_GAP + 1):
            keep = [notes[0]]
            for m in notes[1:]:
                if m - keep[-1] >= gap:
                    keep.append(m)
            if notes[-1] != keep[-1] and notes[-1] - keep[-1] >= gap / 2:
                keep.append(notes[-1])
            if len(keep) <= MAX_NOTES:
                break
        else:                                    # a wide range: its middle, where the parts are written, keeps the tight gap
            mid = notes[len(notes) // 2]
            while len(keep) > MAX_NOTES:
                keep.remove(max(keep[0], keep[-1], key=lambda m: abs(m - mid)))
        return [middle(by_note[m]) for m in keep]
    first = sorted((p for p in files if info[p][2] == 1), key=lambda p: (info[p][1], p)) or sorted(files)
    if len(first) <= MAX_HITS:
        return first
    step = (len(first) - 1) / (MAX_HITS - 1)
    return [first[round(i * step)] for i in range(MAX_HITS)]


def plan(name):
    src, folder, filt, secs, _ = CATALOG[FULLER.get(name, name)]
    files = {p[len(folder) + 1:]: s for p, s in tree(src).items() if os.path.dirname(p) == folder}
    takes = choose(files, filt)
    est = sum(min(files[t], 44 + int(secs * 44100 * 2 * 3)) for t in takes)    # at most 24-bit stereo for `secs`
    return [(f"{folder}/{t}", parse(t)[0]) for t in takes], est


def head_wav(src, rel, secs, dst):
    """The first `secs` of a WAV (a range request: the rest of the file is never downloaded), as a mono FLAC."""
    url = raw_url(src, rel)
    with urllib.request.urlopen(urllib.request.Request(url, headers={**UA, "Range": "bytes=0-65535"}), timeout=60) as r:
        head = r.read()
    i, rate, data = 12, 0, -1
    while i + 8 <= len(head):
        cid, size = head[i:i + 4], struct.unpack("<I", head[i + 4:i + 8])[0]
        if cid == b"fmt ":
            rate = struct.unpack("<I", head[i + 16:i + 20])[0]
        if cid == b"data":
            data = i + 8
            break
        i += 8 + size + (size & 1)
    if data < 0 or not rate:
        raise OSError(f"not a WAV file: {rel}")
    want = data + int(secs * rate)
    with urllib.request.urlopen(urllib.request.Request(url, headers={**UA, "Range": f"bytes=0-{want - 1}"}), timeout=120) as r:
        body = bytearray(r.read())
    body[data - 4:data] = struct.pack("<I", len(body) - data)
    body[4:8] = struct.pack("<I", len(body) - 8)
    tmp = dst + ".part.wav"
    open(tmp, "wb").write(body)
    fade = max(0.05, min(0.6, secs * 0.15))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-ac", "1", "-ar", "44100", "-sample_fmt", "s16",
                    "-af", f"afade=t=out:st={max(0, secs - fade):.2f}:d={fade:.2f}", "-c:a", "flac",
                    "-compression_level", "8", "-f", "flac", dst + ".part"], check=True)
    os.remove(tmp)
    os.replace(dst + ".part", dst)


def levels(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-t", "2", "-f", "f32le", "-"],
                         capture_output=True).stdout
    x = struct.unpack(f"{len(raw) // 4}f", raw) or (0.0,)
    return round(math.sqrt(sum(v * v for v in x) / len(x)), 5), round(max(abs(v) for v in x), 5)


def mg_catalogue():
    with open(fetch("index.json"), encoding="utf-8") as f:
        idx = json.load(f)
    have = set(tree("mg"))
    cat = {k: [t for t in v if t.get("file") in have] for k, v in idx.items() if v}
    return {k: v for k, v in cat.items() if v}


def energy(x, f, sr):
    """Goertzel power of frequency f in the samples x."""
    k = 2 * math.cos(2 * math.pi * f / sr)
    a = b = 0.0
    for v in x:
        a, b = v + k * a - b, a
    return a * a + b * b - k * a * b


def octave_shift(path, midi):
    """-1, 0 or +1: which octave of the labelled note the recording really sounds in (labels differ by library)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True).stdout
    x = struct.unpack(f"{len(raw) // 4}f", raw)[800:800 + 4800]     # 50-350 ms: past the strike, before the decay
    if len(x) < 1000:
        return 0
    f0 = 440 * 2 ** ((midi - 69) / 12)
    e = {sh: energy(x, f0 * 2 ** sh, 16000) for sh in (-1, 0, 1) if 30 < f0 * 2 ** sh < 7500}
    return max(e, key=e.get)


def note_name(m):
    return f"{NOTES[m % 12]}{m // 12 - 1}" if isinstance(m, int) else "-"


def cached(src, rel):
    return os.path.join(CACHE, src, os.path.splitext(rel)[0] + ".flac")


def local_name(name, path):
    """The take's path inside audio/samples/: the page loads it by URL, where # and spaces break it (F#3 -> Fs3)."""
    return f"{name}/" + re.sub(r"[^\w.-]", "_", os.path.basename(path).replace("#", "s"))


def cmd_list(a):
    rows = []
    for name, takes in mg_catalogue().items():
        if name in FULLER:
            continue
        midi = sorted(t["name_midi"] for t in takes if isinstance(t.get("name_midi"), int))
        rows.append(("classic", name, len(takes), midi, None))
    for name, (src, *_rest) in CATALOG.items():
        takes, est = plan(name)
        rows.append((CATALOG[name][4], name, len(takes), sorted(m for _, m in takes if m is not None),
                     0 if all(os.path.exists(cached(src, r)) for r, _ in takes) else est))
    family = None
    for fam, name, n, midi, est in sorted(rows, key=lambda r: (r[0], r[1])):
        if fam != family:
            print(f"\n{fam}")
            family = fam
        span = f"{note_name(midi[0])}–{note_name(midi[-1])}" if midi else "unpitched"
        size = "" if est is None else " · cached" if est == 0 else f" · {est / 1e6:.1f} MB to fetch"
        print(f"  {name:<14} {n:>2} takes · {span}{size}")


def cmd_get(a):
    known = lambda i: i in CATALOG or i in FULLER
    mg = mg_catalogue() if not all(known(i) for i in a.instruments) else {}
    unknown = [i for i in a.instruments if not known(i) and i not in mg]
    if unknown:
        sys.exit(f"samples: unknown instrument {', '.join(unknown)} (samples.py list)")
    entry = lambda i: CATALOG[FULLER.get(i, i)]
    plans = {i: plan(i) for i in a.instruments if known(i)}
    new = sum(est for i, (takes, est) in plans.items()
              if not all(os.path.exists(cached(entry(i)[0], r)) for r, _ in takes))
    if new > ASK_MB * 1e6 and not a.yes:
        print(f"samples: these take {new / 1e6:.0f} MB to download once (then cached): "
              + ", ".join(f"{i} {e / 1e6:.0f} MB" for i, (_, e) in plans.items())
              + f". Ask the user; with their yes: samples.py get {' '.join(a.instruments)} --yes; "
              "or fewer instruments, or the synthesised voices")
        sys.exit(2)
    out = os.path.join(a.project, "audio", "samples")
    os.makedirs(out, exist_ok=True)
    index_path = os.path.join(out, "index.json")
    index = json.load(open(index_path, encoding="utf-8")) if os.path.exists(index_path) else {}
    for name in a.instruments:
        takes = []
        if known(name):
            src, secs = entry(name)[0], entry(name)[3]
            todo = [rel for rel, _ in plans[name][0] if not os.path.exists(cached(src, rel))]
            for rel in todo:
                os.makedirs(os.path.dirname(cached(src, rel)), exist_ok=True)
            with ThreadPoolExecutor(6) as pool:
                list(pool.map(lambda rel: head_wav(src, rel, secs, cached(src, rel)), todo))
            for rel, midi in plans[name][0]:
                c = cached(src, rel)
                file = local_name(name, c)
                os.makedirs(os.path.join(out, name), exist_ok=True)
                shutil.copyfile(c, os.path.join(out, file))
                rms, peak = levels(c)
                takes.append({"file": file, "midi": midi, "rms": rms, "peak": peak})
        else:
            for t in mg[name]:
                file = local_name(name, t["file"])
                dst = os.path.join(out, file)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copyfile(fetch(t["file"]), dst)
                takes.append({"file": file, "midi": t.get("name_midi"), "rms": t.get("rms"), "peak": t.get("peak")})
        pitched = [t for t in takes if isinstance(t["midi"], int)]
        shift = round(statistics.median(octave_shift(os.path.join(out, t["file"]), t["midi"]) for t in pitched)) \
            if pitched else 0
        for t in pitched:                        # one correction per instrument: the label convention is the library's
            t["label_midi"], t["midi"] = t["midi"], t["midi"] + 12 * shift
        index[name] = takes
        print(f"{name}: {len(takes)} takes -> audio/samples/{name}/"
              + (f" (labels an octave {'low' if shift > 0 else 'high'}: corrected by measuring)" if shift else ""))
    json.dump(index, open(index_path, "w", encoding="utf-8"), indent=1)
    lic = os.path.join(a.project, "LICENSES.csv")
    if os.path.exists(lic):
        have = open(lic, encoding="utf-8").read()
        with open(lic, "a", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            for name in a.instruments:
                s = SOURCES[entry(name)[0] if known(name) else "mg"]
                if f"audio/samples/{name}/" not in have:
                    w.writerow([f"audio/samples/{name}/", f"{name} ({s['title']})", "Versilian Studios", s["url"],
                                "CC0-1.0", "https://creativecommons.org/publicdomain/zero/1.0/", "none required",
                                "none (re-pitched in the score)", "", "score",
                                (s["note"] + " " if s["note"] else "") + f"@ {s['commit'][:7]}"])
    print(f"index: audio/samples/index.json · INSTRUMENTS = {json.dumps(sorted(index))} in film.html")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    g = sub.add_parser("get")
    g.add_argument("instruments", nargs="+")
    g.add_argument("--project", default=".")
    g.add_argument("--yes", action="store_true", help="the user agreed to a download over 50 MB")
    g.set_defaults(fn=cmd_get)
    a = ap.parse_args()
    try:
        a.fn(a)
    except (OSError, subprocess.CalledProcessError) as e:
        sys.exit(f"samples: cannot reach the sample library ({e}); offline, the score uses the synthesised voices "
                 "(pad, pluck, lead, bass, stab, kick, snare, hat, clap)")


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()
