#!/usr/bin/env python3
"""A reference video taken apart into its form: "make it like this, but change …" (Python 3 stdlib + ffmpeg).

  python3 tools/ref_video.py analyze refs/reference.mp4 --out research/ref-video
  python3 tools/ref_video.py analyze refs/reference.mp4 --out research/ref-video --threshold 0.25   # softer cuts

Measured: format (length, aspect, fps) · the cuts (ffmpeg scene detection; flashes under 0.25 s merged) and every
shot's length · rhythm (shot count, average shot length, the tempo word: energetic ~4 s, standard ~6 s,
contemplative 8-12 s; the shortest and longest shot) · the look (palette, key, contrast, saturation, warmth, an
estimate of the key light, from one frame per shot, as direction.py measures) · the sound when there is any (BPM and
downbeats by beat_grid.py, integrated loudness, and how many cuts land on a beat).
Writes into --out: REFERENCE.md (the form, in the same shape as a saved format, with a block the agent fills from the
sheet: camera character, transitions, type, hook kind, ending kind), reference.json, thumbs/NN.img + results.json (one
frame per shot, readable by direction.py board and measure) and sheet.jpg (up to 24 frames, in order, numbered in
the printout).
The reference is studied for its form only: its frames, music, shots, characters and words never enter the film.
A link is not downloaded: ask the user for the file (their own export or screen recording) in refs/.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def probe(path):
    r = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                                   "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", path],
                                  capture_output=True, text=True).stdout)
    v = next((s for s in r["streams"] if s["codec_type"] == "video"), None)
    if not v:
        raise SystemExit("no video stream")
    num, den = (int(x) for x in v["r_frame_rate"].split("/"))
    return {"duration": float(r["format"]["duration"]), "width": v["width"], "height": v["height"],
            "fps": round(num / den, 3) if den else 0, "audio": any(s["codec_type"] == "audio" for s in r["streams"])}


def cuts(path, thr):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-an", "-vf",
                          f"scale=320:-2,select='gt(scene,{thr})',showinfo", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    out = []
    for t in sorted(float(x) for x in re.findall(r"pts_time:([0-9.]+)", err)):
        if not out or t - out[-1] >= 0.25:            # a flash or a fast wipe is one cut
            out.append(t)
    return out


def aspect(w, h):
    r = w / h
    for name, v in (("9:16", 9 / 16), ("4:5", 0.8), ("1:1", 1), ("16:9", 16 / 9), ("2.39:1", 2.39), ("4:3", 4 / 3)):
        if abs(r - v) / v < 0.03:
            return name
    return f"{r:.2f}:1"


def tempo_word(asl):
    return "energetic" if asl < 5 else "standard" if asl < 8 else "contemplative"


def lufs(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    for line in reversed(err.splitlines()):
        if line.strip().startswith("I:"):
            return float(line.split()[1])
    return None


def cmd_analyze(a):
    import direction
    info = probe(a.video)
    D = info["duration"]
    cs = [t for t in cuts(a.video, a.threshold) if 0.2 < t < D - 0.2]
    bounds = [0.0] + cs + [D]
    shots = [{"n": i + 1, "start": round(bounds[i], 3), "end": round(bounds[i + 1], 3),
              "dur": round(bounds[i + 1] - bounds[i], 3)} for i in range(len(bounds) - 1)]
    asl = D / len(shots)
    os.makedirs(os.path.join(a.out, "thumbs"), exist_ok=True)
    results = []
    for s in shots:                                     # one frame per shot, from its middle
        p = os.path.join(a.out, "thumbs", f"{s['n']:02d}.img")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{(s['start'] + s['end']) / 2:.3f}", "-i", a.video,
                        "-frames:v", "1", "-vf", "scale=480:-2", "-c:v", "mjpeg", "-f", "mjpeg", p], check=True)
        results.append({"n": s["n"], "source": "reference", "id": str(s["n"]), "title": f"shot {s['n']} at {s['start']:.1f} s",
                        "creator": "reference", "licence": "mood-only", "use": "mood-only", "page": a.video,
                        "file": None, "thumb": p, "type": "still", "year": ""})
    json.dump({"query": "reference video", "type": "image", "results": results},
              open(os.path.join(a.out, "results.json"), "w", encoding="utf-8"), indent=1)

    picks = shots if len(shots) <= 24 else [shots[round(i * (len(shots) - 1) / 23)] for i in range(24)]
    tmp = os.path.join(a.out, ".sheet")
    os.makedirs(tmp, exist_ok=True)
    for i, s in enumerate(picks, 1):
        shutil.copyfile(os.path.join(a.out, "thumbs", f"{s['n']:02d}.img"), os.path.join(tmp, f"{i:02d}.jpg"))
    cols = 6 if len(picks) > 8 else 4
    rows = (len(picks) + cols - 1) // cols
    cw = 240 if info["width"] >= info["height"] else 160      # cells in the video's own aspect, no padding bars
    ch = max(2, round(cw * info["height"] / info["width"] / 2) * 2)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-start_number", "1", "-i", os.path.join(tmp, "%02d.jpg"), "-vf",
                    f"scale={cw}:{ch},tile={cols}x{rows}:padding=4", "-frames:v", "1", "-q:v", "4",
                    os.path.join(a.out, "sheet.jpg")], check=True)
    shutil.rmtree(tmp)

    ms = [direction.measure_one(os.path.join(a.out, "thumbs", f"{s['n']:02d}.img")) for s in shots[:40]]
    P = direction.pool(ms)
    sound = None
    if info["audio"]:
        jpath = os.path.join(a.out, "beats.json")
        r = subprocess.run([sys.executable, os.path.join(HERE, "beat_grid.py"), a.video, "--json", jpath],
                           capture_output=True, text=True)
        loud = lufs(a.video)
        if r.returncode == 0 and os.path.exists(jpath):
            g = json.load(open(jpath, encoding="utf-8"))
            B, fb = g["beat"], g["first_beat"]
            near = [] if not g["bpm"] else [min(((t - fb) / B) % 1, 1 - ((t - fb) / B) % 1) * B < 0.08 for t in cs]
            if g.get("pulse", 9) < 2.0:                  # no clear beat: report the loudness only
                g["bpm"] = None
            sound = {"bpm": g["bpm"], "loudness": loud, "cuts_on_beat": round(sum(near) / len(near), 2) if near else None,
                     "chance": round(min(1, 0.16 / B), 2)}
        else:
            sound = {"bpm": None, "loudness": loud, "cuts_on_beat": None}

    ref = {"video": a.video, "duration": round(D, 2), "aspect": aspect(info["width"], info["height"]),
           "size": f"{info['width']}x{info['height']}", "fps": info["fps"], "shots": shots, "asl": round(asl, 2),
           "tempo": tempo_word(asl), "look": {"words": direction.words(P),
                                              "palette": [c["hex"] for c in P["palette"]]},
           "look_patch": direction.look_patch(P), "sound": sound,
           # the same keys as direction.py measure writes, so `direction.py compare --against reference.json` works
           "measured": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in P.items()},
           "per_still": [{k: round(m[k], 3) for k in ("p50", "contrast", "chroma", "warmth", "dark")} for m in ms],
           "words": direction.words(P)}
    json.dump(ref, open(os.path.join(a.out, "reference.json"), "w", encoding="utf-8"), indent=1)

    durs = sorted(s["dur"] for s in shots)
    if not sound:
        snd = "no sound"
    elif sound.get("bpm"):
        snd = f"{sound['bpm']:.1f} BPM" + (f" · {sound['loudness']:.1f} LUFS" if sound.get("loudness") is not None else "")
        if sound.get("cuts_on_beat") is not None:
            snd += f" · {sound['cuts_on_beat'] * 100:.0f}% of cuts on a beat (chance {sound['chance'] * 100:.0f}%)"
    else:
        snd = "sound without a clear beat" + (f" · {sound['loudness']:.1f} LUFS" if sound.get("loudness") else "")
    md = [f"# Reference: {os.path.basename(a.video)}", "",
          "Studied for its form only: its frames, music, shots, characters and words never enter the film.", "",
          "## Form (measured; kept unless the user changes it)", "",
          f"- **Format:** {D:.1f} s · {ref['aspect']} ({ref['size']}) · {info['fps']:g} fps",
          f"- **Rhythm:** {len(shots)} shots · average {asl:.1f} s ({ref['tempo']}) · shortest {durs[0]:.1f} s · longest {durs[-1]:.1f} s",
          f"- **Look:** {ref['look']['words']} · palette {' '.join(ref['look']['palette'])}",
          f"- **Sound:** {snd}", "",
          "## Read from the sheet (the agent fills, one line each)", "",
          "- **Camera character:** <held · flowing · handheld · graphic; its signature move>",
          "- **Transitions:** <kinds and how often>",
          "- **Type on screen:** <none · titles · captions · kinetic; its style>",
          "- **Hook:** <what moves in the first two seconds>",
          "- **Ending:** <how it ends and whether it rhymes with the opening>", "",
          "## Changes the user asked for", "", "- <the user's words, one line each; each overrides the line above it>", ""]
    open(os.path.join(a.out, "REFERENCE.md"), "w", encoding="utf-8").write("\n".join(md))

    print(f"{os.path.basename(a.video)}: {D:.1f} s · {ref['aspect']} · {len(shots)} shots · average {asl:.1f} s ({ref['tempo']})")
    print(f"look: {ref['look']['words']} · palette {' '.join(ref['look']['palette'])}")
    print(f"sound: {snd}")
    print(f"sheet: {os.path.join(a.out, 'sheet.jpg')} ({len(picks)} of {len(shots)} shots, row by row: "
          + ", ".join(str(s["n"]) for s in picks) + ")")
    print(f"form: {os.path.join(a.out, 'REFERENCE.md')} (fill the 'Read from the sheet' block after looking at the sheet)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("analyze")
    p.add_argument("video")
    p.add_argument("--out", default="research/ref-video")
    p.add_argument("--threshold", type=float, default=0.3, help="scene change threshold for cuts (0.2 soft … 0.4 hard)")
    p.set_defaults(fn=cmd_analyze)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
