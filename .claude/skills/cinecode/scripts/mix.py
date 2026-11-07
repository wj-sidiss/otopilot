#!/usr/bin/env python3
"""Mix sound layers into one WAV from a small JSON plan (Python 3 standard library + ffmpeg).

  python3 tools/mix.py audio/mix.json                  # writes the "out" file of the plan (24-bit, 48 kHz, stereo)
  python3 tools/mix.py audio/mix.json --list           # print the layer list only (check starts against cuts)

Plan (audio/mix.json):
  {"duration": 30.0, "out": "audio/mix-v1.wav", "shots": "shots.json",
   "layers": [
     {"file": "audio/<bed>.wav", "at": 0.0, "gain_db": -20, "fade_in": 0.4, "fade_out": 0.8, "bus": "ambience"},
     {"file": "audio/vo/VO1.wav", "at": 3.3, "gain_db": 0, "bus": "dialogue", "pan": 0},
     {"file": "audio/sfx/<effect>.wav", "at": 5.1, "trim": [0.0, 1.2], "gain_db": -8, "pan": -0.4, "bus": "sfx"}]}

Fields per layer: file, at (s), gain_db, trim [start, end] in the source, fade_in / fade_out (s), pan (-1..1),
loop (true: repeat the source to fill "length" seconds), length (s), bus (dialogue 0, foley -1, sfx -2,
ambience -3, music -4 dB are added on top of gain_db). Every layer's randomness lives in its own source file,
so changing one layer leaves the others identical.
The mix gets a -2 dBFS peak limiter; master it afterwards with master_audio.py (-14 LUFS, -1 dBTP).
With "shots" set, layers that start within 0.3 s of a cut are flagged (start long layers away from cuts,
or on purpose as a J/L-cut).
"""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

BUS_DB = {"dialogue": 0, "foley": -1, "sfx": -2, "ambience": -3, "music": -4}


def cuts_from(path):
    if not path or not os.path.exists(path):
        return []
    film = json.load(open(path, encoding="utf-8"))
    fps = float(film.get("fps", 24))
    return [s["start"] / fps for s in film.get("shots", [])[1:]]


def audit_missing(plan_path):
    """Film mode: the picture-event audit comes before the mix (references/sound.md §5), so no on-screen event is
    left silent by accident. Its coverage line: "events N · sounded M · silent by choice K", with M + K = N."""
    d = os.path.dirname(os.path.abspath(plan_path))
    film = next((p for p in [d, os.path.dirname(d), os.path.dirname(os.path.dirname(d))]
                 if os.path.isfile(os.path.join(p, "STATE.md"))), None)
    if not film or (os.path.isfile(os.path.join(film, "film.html")) and not os.path.isdir(os.path.join(film, "engine"))):
        return ""
    try:
        with open(plan_path, encoding="utf-8") as fh:
            layers = json.load(fh).get("layers", [])
    except (OSError, ValueError, AttributeError):
        layers = []
    if layers and all(isinstance(L, dict) and L.get("bus") == "dialogue" for L in layers):
        return ""                                # the animatic's temp narration: no picture events to sound yet
    audit = os.path.join(film, "review", "sound-audit.md")
    if not os.path.isfile(audit):
        return ("mix: first the picture-event audit (references/sound.md §5): review/sound-audit.md lists every on-screen "
                "event (time · event · its sound · layers) and ends with \"events N · sounded M · silent by choice K\"")
    m = re.search(r"events\s+(\d+)\s*·\s*sounded\s+(\d+)\s*·\s*silent by choice\s+(\d+)", Path(audit).read_text(encoding="utf-8"))
    if not m:
        return "mix: review/sound-audit.md needs its coverage line: \"events N · sounded M · silent by choice K\""
    n, s, k = map(int, m.groups())
    if s + k < n:
        return (f"mix: {n - s - k} of {n} on-screen events have no sound and no reason in review/sound-audit.md; give each "
                "its synced, layered sound, or write why it stays silent")
    return ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    plan = json.load(open(a.plan, encoding="utf-8"))
    layers, dur = plan["layers"], float(plan["duration"])
    cuts = cuts_from(plan.get("shots"))

    print(f"{'#':>2}  {'at':>6}  {'gain':>6}  {'bus':<9} file")
    for i, L in enumerate(layers):
        near = [c for c in cuts if abs(c - L.get("at", 0)) < 0.3 and L.get("at", 0) > 0]
        flag = f"  <- {near[0]:.2f} s cut" if near else ""
        print(f"{i:>2}  {L.get('at', 0):6.2f}  {L.get('gain_db', 0):6.1f}  {L.get('bus', '-'):<9} {L['file']}{flag}")
        if not os.path.exists(L["file"]):
            sys.exit(f"missing file: {L['file']}")
    if a.list:
        return
    why = audit_missing(a.plan)
    if why:
        sys.exit(why)

    cmd, parts = ["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-y"], []
    for i, L in enumerate(layers):
        if L.get("loop"):
            cmd += ["-stream_loop", "-1"]
        cmd += ["-i", L["file"]]
        f = ["aresample=48000", "aformat=channel_layouts=stereo"]
        if L.get("trim"):
            f.append(f"atrim={L['trim'][0]}:{L['trim'][1]},asetpts=PTS-STARTPTS")
        if L.get("loop") or L.get("length"):
            f.append(f"atrim=0:{L.get('length', dur)},asetpts=PTS-STARTPTS")
        if L.get("fade_in"):
            f.append(f"afade=t=in:d={L['fade_in']}")
        if L.get("fade_out"):
            f.append(f"areverse,afade=t=in:d={L['fade_out']},areverse")
        pan = float(L.get("pan", 0))
        if pan:
            f.append(f"pan=stereo|c0={min(1, 1 - pan):.3f}*c0|c1={min(1, 1 + pan):.3f}*c1")
        f.append(f"volume={L.get('gain_db', 0) + BUS_DB.get(L.get('bus'), 0)}dB")
        ms = int(round(float(L.get("at", 0)) * 1000))
        if ms > 0:
            f.append(f"adelay={ms}|{ms}")
        elif ms < 0:                                    # starts before 0: its head is cut, never a negative delay
            f.append(f"atrim=start={-ms / 1000},asetpts=PTS-STARTPTS")
        parts.append(f"[{i}:a]{','.join(f)}[l{i}]")
    mixin = "".join(f"[l{i}]" for i in range(len(layers)))
    graph = ";".join(parts) + f";{mixin}amix=inputs={len(layers)}:normalize=0:duration=longest," \
        f"apad=whole_dur={dur},alimiter=limit=0.794:level=false[out]"
    out = plan.get("out", "audio/mix.wav")
    if os.path.exists(out):
        sys.exit(f"{out} exists; mixes are versioned, set a new 'out' in the plan")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    cmd += ["-filter_complex", graph, "-map", "[out]", "-t", f"{dur}", "-ar", "48000", "-c:a", "pcm_s24le", out]   # -t, not atrim: atrim after amix drops late layers in ffmpeg 8
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        sys.exit(f"ffmpeg failed:\n{p.stderr[-2000:]}")
    print(f"mix: {out} ({dur:.2f} s, {len(layers)} layers, peak limited to -2 dBFS); next: master_audio.py")


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()
