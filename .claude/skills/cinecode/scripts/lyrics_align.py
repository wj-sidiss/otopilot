#!/usr/bin/env python3
"""Lyric timings from the song itself: the user gives the words, Whisper hears the times (Python 3 stdlib).

  python3 tools/lyrics_align.py cmd song.mp3 --lang tr      # the Whisper command for word timings (installed with OK)
  python3 tools/lyrics_align.py align lyrics.txt song.json --json audio/lyrics.json --lrc audio/song.lrc

lyrics.txt is the user's lyrics, one sung line per line (blank lines and [Chorus]-style labels are skipped). song.json
is Whisper's output with word timestamps. Sung words are often misheard, so the user's text is the truth and Whisper
only lends its clock: the two word sequences are matched (folded: case, accents, punctuation), each matched lyric word
takes the heard word's time, and the words between matches are spread over the gap. A line whose words mostly found
no match is marked "check by ear", with the second to listen at.

The .lrc goes straight into beat_grid.py (--lrc) for each line's beat and bar; the JSON keeps every word's time for
karaoke type and word-level cues. For a dense mix, a vocal stem aligns better (any separation tool, with the user's OK).
"""
import argparse
import difflib
import json
import os
import re
import sys
import unicodedata


def fold(w):
    w = w.replace("İ", "i").replace("I", "ı").lower()
    w = "".join(c for c in unicodedata.normalize("NFKD", w) if not unicodedata.combining(c)).replace("ı", "i")
    return re.sub(r"[^\w]", "", w)


def heard_words(path):
    data = json.load(open(path, encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("words") or [w for s in data.get("segments", []) for w in s.get("words", [])]
    out = []
    for w in data:
        text, a, b = (w[0], w[1], w[2]) if isinstance(w, (list, tuple)) else (w.get("word", w.get("text", "")), w["start"], w["end"])
        if fold(text):
            out.append({"w": text.strip(), "f": fold(text), "t0": float(a), "t1": float(b)})
    return out


def lyric_lines(path):
    lines = []
    for raw in open(path, encoding="utf-8"):
        line = raw.strip()
        if not line or re.fullmatch(r"[\[(].*[\])]", line):
            continue
        words = [w for w in line.split() if fold(w)]
        if words:
            lines.append({"text": line, "words": [{"w": w, "f": fold(w)} for w in words]})
    return lines


def align(lines, heard):
    flat = [w for line in lines for w in line["words"]]
    sm = difflib.SequenceMatcher(a=[w["f"] for w in flat], b=[h["f"] for h in heard], autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            w, h = flat[blk.a + k], heard[blk.b + k]
            w.update(t0=h["t0"], t1=h["t1"], matched=True)
    for i, w in enumerate(flat):                 # near misses: a heard word in the same gap that is close in spelling
        if "t0" in w:
            continue
        prev = next((flat[j]["t1"] for j in range(i - 1, -1, -1) if flat[j].get("matched")), 0.0)
        nxt = next((flat[j]["t0"] for j in range(i + 1, len(flat)) if flat[j].get("matched")), float("inf"))
        near = [h for h in heard if prev <= h["t0"] < nxt and difflib.SequenceMatcher(a=w["f"], b=h["f"]).ratio() >= 0.75]
        if near:
            w.update(t0=near[0]["t0"], t1=near[0]["t1"], matched=True)
    i = 0
    while i < len(flat):                         # spread the rest evenly over the gap between timed neighbours
        if "t0" in flat[i]:
            i += 1
            continue
        j = i
        while j < len(flat) and "t0" not in flat[j]:
            j += 1
        left = flat[i - 1]["t1"] if i > 0 else (flat[j]["t0"] - 0.4 * (j - i) if j < len(flat) else 0.0)
        right = flat[j]["t0"] if j < len(flat) else left + 0.4 * (j - i)
        step = max(right - left, 0.05 * (j - i)) / (j - i)
        for k in range(i, j):
            flat[k].update(t0=round(left + step * (k - i), 3), t1=round(left + step * (k - i + 1), 3), matched=False)
        i = j
    out = []
    for line in lines:
        ws = line["words"]
        conf = sum(1 for w in ws if w["matched"]) / len(ws)
        out.append({"text": line["text"], "t0": round(ws[0]["t0"], 3), "t1": round(ws[-1]["t1"], 3), "conf": round(conf, 2),
                    "words": [{"w": w["w"], "t0": round(w["t0"], 3), "t1": round(w["t1"], 3), "matched": w["matched"]} for w in ws]})
    return out


def lrc_time(t):
    return f"[{int(t // 60):02d}:{t % 60:05.2f}]"


def cmd_align(a):
    lines, heard = lyric_lines(a.lyrics), heard_words(a.words)
    if not lines or not heard:
        sys.exit("lyrics_align: no lyric lines or no heard words")
    out = align(lines, heard)
    weak = [l for l in out if l["conf"] < a.min_conf]
    matched = sum(1 for l in out for w in l["words"] if w["matched"]) / sum(len(l["words"]) for l in out)
    if a.json:
        json.dump({"lines": out}, open(a.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if a.lrc:
        open(a.lrc, "w", encoding="utf-8").write("".join(f"{lrc_time(l['t0'])}{l['text']}\n" for l in out))
    print(f"{len(out)} lines, {matched:.0%} of the words heard" + (f" -> {a.json}" if a.json else "") + (f", {a.lrc}" if a.lrc else ""))
    for l in out[: a.show]:
        print(f"  {l['t0']:7.2f}  {l['text'][:60]}" + ("" if l["conf"] >= a.min_conf else f"   (check by ear: {l['conf']:.0%} heard)"))
    if weak:
        print(f"{len(weak)} line(s) to check by ear: " + ", ".join(f"{l['t0']:.1f} s" for l in weak[:8])
              + " (the time there is spread between heard neighbours; ask the user or move it to the nearest bar)")


def cmd_cmd(a):
    print("Word timings of the song (once, needs Whisper; install only with the user's OK):")
    import shlex
    print(f"  whisper {shlex.quote(a.song)} --language {shlex.quote(a.lang)} --word_timestamps True --output_format json --output_dir audio")
    print(f"  mlx_whisper {shlex.quote(a.song)} --language {shlex.quote(a.lang)} --word-timestamps True --output-format json "
          f"--output-dir audio   # Apple Silicon")
    print("then: python3 tools/lyrics_align.py align lyrics.txt audio/<song>.json --json audio/lyrics.json --lrc audio/song.lrc")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("cmd", help="print the Whisper command for the song")
    c.add_argument("song")
    c.add_argument("--lang", default="tr")
    c.set_defaults(fn=cmd_cmd)
    p = sub.add_parser("align", help="the user's lyrics on Whisper's clock")
    p.add_argument("lyrics", help="the user's lyrics, one sung line per line")
    p.add_argument("words", help="Whisper's JSON with word timestamps")
    p.add_argument("--json")
    p.add_argument("--lrc")
    p.add_argument("--min-conf", type=float, default=0.5, help="below this share of heard words a line is checked by ear")
    p.add_argument("--show", type=int, default=12, help="lines printed")
    p.set_defaults(fn=cmd_align)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
