#!/usr/bin/env python3
"""Transcript-based edit of the user's own footage (talking head, selfie, screen recording with voice).
Python 3 standard library only. Input: word timestamps from Whisper (any of the formats below).

  python3 tools/footage_cut.py cut words.json --out edit            # pause trims + flags for approval
  python3 tools/footage_cut.py cut words.json --out edit --apply F2,F5   # after the user approves F2 and F5
  python3 tools/footage_cut.py cue edit/words-retimed.json "videoyu indir" [--lead 0.4]

cut writes into --out:
  cut-list.json       the kept [in, out] seconds of the source, source and edited length
  words-retimed.json  every kept word with its time in the edited video (captions and graphics are timed from it)
  flags.md            stutters, retakes and false starts with seconds, both texts, confidence and the proposed cut;
                      nothing in it is cut until the user approves it (--apply)
  filter.txt          an ffmpeg filter graph; the printed command renders the edit in one pass
cue finds a word or phrase (Turkish suffix-aware: words compared by their first 5 letters, so "videoyu" finds
"videonun") and prints the time a graphic should enter: lead seconds before the word (0.2-0.6 s).

Word formats: [["word", start, end, prob], ...] (faster-whisper list) · [{"word", "start", "end"}, ...] ·
{"segments": [{"words": [...]}]} (openai-whisper --word_timestamps True) · {"words": [...]}.
Method and numbers: KIT/references/footage-edit.md.
"""
import argparse
import json
import os
import re
import subprocess
import sys

BREATH_MIN_GAP = 0.55          # shorter silences are the speech's own breath: untouched
BREATH_SENTENCE, BREATH_LONG, BREATH_OTHER = 0.20, 0.24, 0.14
LONG_PAUSE = 2.0
BEFORE_SHARE = 0.55            # share of the kept breath that stays after the previous word
HEAD, TAIL, MIN_PIECE = 0.22, 0.34, 0.15    # a piece under ~4 frames reads as a jump and a click: dropped
FILLERS = {"ıı", "ıı.", "ee", "eee", "hmm", "hm", "ım", "um", "uh", "erm", "ah"}
STOP = {"ve", "ama", "fakat", "çünkü", "ile", "için", "gibi", "bir", "bu", "şu", "da", "de", "ki", "ya", "ne",
        "the", "and", "but", "for", "with", "that", "this", "you", "are", "was", "not", "then"}


def norm(w):
    w = w.replace("I", "ı").replace("İ", "i").lower()
    return re.sub(r"[^\wçğıöşü]", "", w)


def key(w):
    return norm(w)[:5]


def load_words(path):
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
        if not text or b <= a:
            continue
        if norm(text) in FILLERS and b - a < 0.1:
            continue                                    # too short to trust; the pause trim removes it
        if b - a < 0.05:
            continue
        out.append({"word": text, "start": round(a, 3), "end": round(b, 3)})
    out.sort(key=lambda w: w["start"])
    if not out:
        sys.exit("no usable words in " + path)
    return out


def keep_intervals(words, duration, head=HEAD):
    keep, a = [], max(0.0, words[0]["start"] - head)
    for prev, nxt in zip(words, words[1:]):
        gap = nxt["start"] - prev["end"]
        if gap < BREATH_MIN_GAP:
            continue
        breath = BREATH_LONG if gap > LONG_PAUSE else BREATH_SENTENCE if prev["word"][-1:] in ".!?" else BREATH_OTHER
        keep.append([a, prev["end"] + breath * BEFORE_SHARE])
        a = nxt["start"] - breath * (1 - BEFORE_SHARE)
    end = words[-1]["end"] + TAIL
    keep.append([a, min(end, duration) if duration else end])
    return keep


def subtract(keep, cuts):
    for c0, c1 in sorted(cuts):
        nxt = []
        for a, b in keep:
            if c1 <= a or c0 >= b:
                nxt.append([a, b])
                continue
            if c0 > a:
                nxt.append([a, c0])
            if c1 < b:
                nxt.append([c1, b])
        keep = nxt
    return [[round(a, 3), round(b, 3)] for a, b in keep if b - a >= MIN_PIECE]


def chunks(words):
    out, cur, spoken = [], [], 0.0
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        spoken = cur[-1]["end"] - cur[0]["start"]
        if (nxt is None or nxt["start"] - w["end"] > 0.85 or (spoken > 7.5 and w["word"][-1:] in ".!?")
                or spoken >= 16):
            out.append(cur)
            cur = []
    return out


def meaningful(chunk):
    ws = [key(w["word"]) for w in chunk if len(norm(w["word"])) > 2 and norm(w["word"]) not in STOP]
    return ws[:18]


def find_flags(words):
    flags = []
    for a, b in zip(words, words[1:]):
        if norm(a["word"]) and norm(a["word"]) == norm(b["word"]) and b["start"] - a["start"] <= 0.5:
            w = norm(a["word"])
            doubled = len(w) >= 4 and w not in STOP     # "adım adım", "yavaş yavaş": a reduplication is meant
            flags.append({"kind": "doubled word (a reduplication is often meant)" if doubled else "stutter",
                          "at": a["start"], "cut": [a["start"], b["start"]], "first": a["word"], "second": b["word"],
                          "confidence": "look" if doubled else "high"})
    cs = chunks(words)
    for i, A in enumerate(cs):
        ma = meaningful(A)
        for j in range(i + 1, min(len(cs), i + 10)):
            B = cs[j]
            if B[0]["start"] - A[0]["start"] > 75:
                break
            mb = meaningful(B)
            if not ma or not mb:
                continue
            sa, sb = set(ma), set(mb)
            score = len(sa & sb) / len(sa | sb)
            same_open = len(set(ma[:4]) & set(mb[:4])) >= 2
            if score >= 0.34 or (score >= 0.24 and same_open):
                # the failed take starts where the retake's opening words were first said, not at the chunk's start
                opening = {key(w["word"]) for w in B[:2]}
                at = next((k for k in range(len(A) - 1, -1, -1) if key(A[k]["word"]) in opening
                           and (k + 1 >= len(A) or key(A[k + 1]["word"]) in {key(w["word"]) for w in B[:4]})), 0)
                A = A[at:]
                false_start = A[-1]["end"] - A[0]["start"] < 6 and B[0]["start"] - A[0]["start"] <= 12
                flags.append({"kind": "false start" if false_start else "retake", "at": A[0]["start"],
                              "cut": [A[0]["start"], B[0]["start"]], "first": " ".join(w["word"] for w in A),
                              "second": " ".join(w["word"] for w in B), "score": round(score, 2),
                              "confidence": "high" if score >= 0.45 else "medium" if score >= 0.34 else "look"})
                break
    flags.sort(key=lambda f: f["at"])
    for n, f in enumerate(flags, 1):
        f["id"] = f"F{n}"
    return flags


def retime(words, keep):
    out, offset = [], 0.0
    for a, b in keep:
        for w in words:
            if a <= w["start"] and w["end"] <= b + 1e-6:
                out.append({"word": w["word"], "start": round(offset + w["start"] - a, 3),
                            "end": round(offset + w["end"] - a, 3), "source": w["start"]})
        offset += b - a
    return out


def filter_graph(keep, audio):
    parts, labels = [], []
    for i, (a, b) in enumerate(keep):
        d, f = b - a, min(0.012, (b - a) / 4)
        parts.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{i}]")
        if audio:
            parts.append(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,"
                         f"afade=t=in:d={f:.3f},afade=t=out:st={d - f:.3f}:d={f:.3f}[a{i}]")
        labels.append(f"[v{i}]" + (f"[a{i}]" if audio else ""))
    out = "[v][a]" if audio else "[v]"
    parts.append("".join(labels) + f"concat=n={len(keep)}:v=1:a={1 if audio else 0}{out}")
    return ";\n".join(parts) + "\n"


def cmd_cut(args):
    if args.source and not args.duration:
        try:
            args.duration = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                                                  "csv=p=0", args.source], capture_output=True, text=True).stdout)
        except (OSError, ValueError):
            sys.exit(f"cannot read the length of {args.source} (ffprobe)")
    words = load_words(args.words)
    flags = find_flags(words)
    approved = {s.strip().upper() for s in (args.apply or "").split(",") if s.strip()}
    unknown = approved - {f["id"] for f in flags}
    if unknown:
        sys.exit("unknown flag ids: " + ", ".join(sorted(unknown)))
    cuts = [f["cut"] for f in flags if f["id"] in approved]
    keep = subtract(keep_intervals(words, args.duration, args.head), cuts)
    os.makedirs(args.out, exist_ok=True)
    src = args.duration or words[-1]["end"]
    edited = sum(b - a for a, b in keep)
    json.dump({"source_duration": round(src, 3), "edited_duration": round(edited, 3), "applied": sorted(approved),
               "keep": keep}, open(os.path.join(args.out, "cut-list.json"), "w"), indent=1)
    json.dump(retime(words, keep), open(os.path.join(args.out, "words-retimed.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=0)
    with open(os.path.join(args.out, "flags.md"), "w", encoding="utf-8") as f:
        f.write("# Flags for approval\n\nNothing here is cut until approved: `footage_cut.py cut ... --apply F1,F3`.\n\n")
        f.write("| Id | Second | Kind | Confidence | First take | Kept take | Proposed cut | Applied |\n|---|---|---|---|---|---|---|---|\n")
        for g in flags:
            f.write(f"| {g['id']} | {g['at']:.2f} | {g['kind']} | {g['confidence']} | {g['first'][:80]} | "
                    f"{g['second'][:80]} | {g['cut'][0]:.2f}-{g['cut'][1]:.2f} | {'yes' if g['id'] in approved else 'no'} |\n")
    with open(os.path.join(args.out, "filter.txt"), "w") as f:
        f.write(filter_graph(keep, not args.no_audio))
    print(f"words {len(words)} · pieces {len(keep)} · {src:.2f} s -> {edited:.2f} s ({100 * (1 - edited / src):.0f}% shorter)"
          f" · flags {len(flags)} ({', '.join(g['id'] + ' ' + g['kind'] for g in flags) or 'none'}) · applied {len(cuts)}")
    maps = "-map '[v]'" + ("" if args.no_audio else " -map '[a]' -c:a aac -b:a 192k")
    if not args.duration:
        print("note: without --source (or --duration) the last piece may run past the source's end; the edit and its "
              "retimed words then disagree at the end")
    import shlex
    src, graph = shlex.quote(args.source) if args.source else "<source>", shlex.quote(os.path.join(args.out, "filter.txt"))
    print(f"render: ffmpeg -i {src} -/filter_complex {graph} {maps} -c:v libx264 -crf 18 "
          f"-pix_fmt yuv420p -movflags +faststart renders/edit-v1.mp4   (ffmpeg 7+; ffmpeg 6 and older: "
          f"-filter_complex_script {graph})")


def cmd_cue(args):
    words = json.load(open(args.words, encoding="utf-8"))
    q = [key(w) for w in args.phrase.split() if norm(w)]
    hits = 0
    for i in range(len(words) - len(q) + 1):
        if all(key(words[i + k]["word"]) == q[k] for k in range(len(q))):
            t = words[i]["start"]
            hits += 1
            print(f"{t:8.2f}  {' '.join(w['word'] for w in words[i:i + len(q)])}  -> graphic in at {max(0, t - args.lead):.2f}"
                  f" (window {max(0, t - 0.6):.2f}-{max(0, t - 0.2):.2f})")
    if not hits:
        print("no match for: " + args.phrase)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("cut")
    c.add_argument("words")
    c.add_argument("--out", default="edit")
    c.add_argument("--apply", help="approved flag ids, e.g. F1,F3")
    c.add_argument("--source", help="the footage itself: its length caps the tail, and the render line names it")
    c.add_argument("--duration", type=float, help="source length in seconds (ffprobe), caps the tail")
    c.add_argument("--no-audio", action="store_true", help="silent screen recording")
    c.add_argument("--head", type=float, default=HEAD, help="silence kept before the first word (0 when this footage opens the film: the hook starts on frame 1)")
    c.set_defaults(fn=cmd_cut)
    q = sub.add_parser("cue")
    q.add_argument("words", help="words-retimed.json")
    q.add_argument("phrase")
    q.add_argument("--lead", type=float, default=0.4)
    q.set_defaults(fn=cmd_cue)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()
