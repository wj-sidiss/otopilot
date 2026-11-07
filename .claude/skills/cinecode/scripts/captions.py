#!/usr/bin/env python3
"""Word-locked kinetic captions from narration word timings (talking-head style; Python 3 stdlib).

  python3 tools/captions.py cmd audio/vo/VO1.wav                       # the Whisper command for word timings
  python3 tools/captions.py build audio/vo/VO1.json@0.6 audio/vo/VO2.json@3.4 --accent "<word>,<number>" \
      --out audio/captions.json                                        # prints the CAPTIONS object for film.html

Our own TTS lines are aligned by transcribing them with Whisper word timestamps (the text is known, so check the
words against the script line); each file's words are shifted by the line's start in the film (@seconds = VO.at).
Word formats: [["word", start, end, prob], ...] · [{"word", "start", "end"}, ...] · {"segments": [{"words": [...]}]}
(openai-whisper --word_timestamps True) · {"words": [...]}.

Groups: a new caption group starts after --max-words words or --max-chars characters, after a pause longer than
--gap seconds, or after a word ending a sentence or clause. Accent words: the --accent list (Turkish suffix-aware: the
first 5 letters match, so "bedava" also marks "bedavaya"), plus numbers and prices automatically (one per group);
a trailing "!" in --accent also marks the word as a punch-in. KIT/references/typography.md §8.
"""
import argparse
import json
import os
import re
import sys


def load_words(path, offset=0.0):
    data = json.load(open(path, encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("words") or [w for s in data.get("segments", []) for w in s.get("words", [])]
    out = []
    for w in data:
        if isinstance(w, (list, tuple)):
            text, a, b = w[0], float(w[1]), float(w[2])
        else:
            text, a, b = w.get("word", w.get("text", "")), float(w["start"]), float(w["end"])
        text = text.strip()
        if text and b > a:
            out.append({"w": text, "t0": round(a + offset, 3), "t1": round(b + offset, 3)})
    return out


def stem(s):
    return re.sub(r"[^\wçğıöşüâîû]", "", s.replace("İ", "i").replace("I", "ı").lower())[:5]   # Turkish casing before lower()


def build(a):
    words = []
    for spec in a.files:
        path, _, at = spec.partition("@")
        words += load_words(path, float(at or 0))
    words.sort(key=lambda w: w["t0"])
    marks = {}
    for item in [x.strip() for x in (a.accent or "").split(",") if x.strip()]:
        marks[stem(item.rstrip("!"))] = item.endswith("!")
    groups, cur = [], []
    for i, w in enumerate(words):
        gap = w["t0"] - words[i - 1]["t1"] if i else 0
        chars = sum(len(words[j]["w"]) + 1 for j in cur) + len(w["w"])
        if cur and (len(cur) >= a.max_words or chars > a.max_chars or gap > a.gap or re.search(r"[.!?;:,…]$", words[i - 1]["w"])):
            groups.append(cur); cur = []
        cur.append(i)
    if cur:
        groups.append(cur)
    out_groups = []
    for gi, idx in enumerate(groups):
        auto = next((j for j in idx if re.search(r"\d", words[j]["w"])), None)
        for j in idx:
            w = words[j]
            w["group"] = gi
            st = stem(w["w"])
            w["accent"] = st in marks or j == auto
            w["punch"] = bool(marks.get(st))
        out_groups.append({"t0": words[idx[0]]["t0"], "t1": words[idx[-1]]["t1"], "words": idx})
    cap = {"words": words, "groups": out_groups}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(cap, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    shortest = min((w["t1"] - w["t0"] for w in words), default=0)
    print(f"{len(words)} words in {len(out_groups)} groups -> {a.out}; accents: "
          f"{', '.join(w['w'] for w in words if w['accent']) or '-'}; punch: {', '.join(w['w'] for w in words if w['punch']) or '-'}")
    if shortest and shortest < 0.12:
        print(f"note: a word lasts {shortest:.2f} s: the 0.12 s pop will overlap the next word there (fine for quick rhythm)")
    print("paste into film.html:\nconst CAPTIONS = " + json.dumps(cap, ensure_ascii=False, separators=(",", ":")) + ";")


def cmd(a):
    import shlex
    q = shlex.quote                                          # paths with spaces, apostrophes and Turkish letters
    base = os.path.splitext(a.wav)[0]
    lang, out = a.language, os.path.dirname(a.wav) or "."
    print("one of (whichever is installed):")
    print(f"  whisper {q(a.wav)} --language {q(lang)} --word_timestamps True --output_format json --output_dir {q(out)}")
    print(f"  mlx_whisper {q(a.wav)} --language {q(lang)} --word-timestamps True --output-format json --output-dir {q(out)}")
    code = (f"from faster_whisper import WhisperModel as M; import json; s,_=M('small').transcribe({a.wav!r}, language={lang!r}, "
            f"word_timestamps=True); json.dump([[w.word,w.start,w.end,w.probability] for x in s for w in x.words], "
            f"open({base + '.json'!r},'w'))")
    print(f"  python3 -c {q(code)}")
    print(f"then: python3 tools/captions.py build {q(base + '.json')}@<VO.at> --out audio/captions.json")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("files", nargs="+", help="words.json[@start seconds in the film]")
    b.add_argument("--accent", help="comma list; a trailing ! also punches in")
    b.add_argument("--max-words", type=int, default=3)
    b.add_argument("--max-chars", type=int, default=18)
    b.add_argument("--gap", type=float, default=0.25)
    b.add_argument("--out", required=True)
    c = sub.add_parser("cmd")
    c.add_argument("wav")
    c.add_argument("--language", default="tr")
    a = ap.parse_args()
    build(a) if a.cmd == "build" else cmd(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
