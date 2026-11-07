#!/usr/bin/env python3
"""Two-pass LINEAR loudness normalisation with ffmpeg (Python 3 standard library only).

Pass 1 measures, pass 2 applies one fixed gain (linear=true), so the mix's dynamics stay intact.
The LRA target defaults to 20: if the measured LRA is above the target, ffmpeg silently switches
loudnorm to dynamic mode (a compressor) and changes your mix. This script reports which mode ran.

Usage:
  master_audio.py mix.wav master.wav                      # audio only (writes 24-bit WAV)
  master_audio.py mix.wav film.mp4 --video picture.mp4    # mux: copy video, encode AAC 320k 48 kHz
Options: --I -14  --TP -1 (with --video the loudness is aimed at -2 dBTP, since AAC raises peaks; the check stays -1)  --LRA 20
         --limit   if the linear gain would push peaks over the ceiling, first apply that gain and a lookahead
                   limiter (ffmpeg alimiter, 1.5 dB under the ceiling), then normalise linearly (Quick mode default)
Tip: bring the mix near the target and below the peak ceiling first (for example a -2 dBTP limiter),
so the linear gain does not need to push peaks over the ceiling.
"""
import argparse
import json
import os
import re
import subprocess
import sys


def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        sys.exit(f"ffmpeg failed:\n{p.stderr[-3000:]}")
    return p.stderr


def last_json(text):
    blocks = re.findall(r"\{[^{}]*\}", text, re.S)
    if not blocks:
        sys.exit("could not find loudnorm JSON in ffmpeg output")
    return json.loads(blocks[-1])


def ebur128(path):
    err = run(["ffmpeg", "-hide_banner", "-nostdin", "-i", path, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"])
    summary = err[err.rfind("Summary:"):]
    get = lambda key: re.search(rf"{key}:\s+(-?[\d.]+|-inf)", summary)
    vals = {k: (get(k).group(1) if get(k) else "?") for k in ("I", "LRA", "Peak")}
    return vals


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mix")
    ap.add_argument("output")
    ap.add_argument("--video", help="picture file to mux with (video stream is copied)")
    ap.add_argument("--I", type=float, default=-14.0)
    ap.add_argument("--TP", type=float, default=None)
    ap.add_argument("--LRA", type=float, default=20.0)
    ap.add_argument("--limit", action="store_true", help="limit peaks first when a linear gain cannot reach the target")
    a = ap.parse_args()

    ceiling_check = a.TP if a.TP is not None else -1.0
    a.TP = a.TP if a.TP is not None else (-2.0 if a.video else -1.0)   # AAC encoding lifts true peak by ~0.5-0.7 dB
    target = f"I={a.I}:TP={a.TP}:LRA={a.LRA}"
    measure = lambda pre: last_json(run(["ffmpeg", "-hide_banner", "-nostdin", "-i", a.mix, "-af",
                                         f"{pre}loudnorm={target}:print_format=json", "-f", "null", "-"]))
    pre = ""
    m = measure(pre)
    print(f"pass 1: I={m['input_i']} LUFS  TP={m['input_tp']} dBTP  LRA={m['input_lra']} LU  thresh={m['input_thresh']}")
    try:
        silent = not float(m["input_i"]) > -70                        # -inf for digital silence
    except ValueError:
        silent = True
    if silent:                                                        # nothing to normalise: keep the length, say why
        if a.video:
            cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-y", "-i", a.video, "-i", a.mix, "-map", "0:v:0",
                   "-map", "1:a:0", "-c:v", "copy", "-af", "apad", "-c:a", "aac", "-b:a", "128k", "-shortest", a.output]
        else:
            cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-y", "-i", a.mix, "-c:a", "pcm_s24le", a.output]
        subprocess.run(cmd, check=True)
        print("SILENT SOUNDTRACK (no sound above -70 LUFS): fine for a film silent by choice; otherwise write the score, "
              "the effects or the ambience. The picture keeps its silent track.\nOK")
        sys.exit(0)
    gain = a.I - float(m["input_i"])
    ceiling = a.TP - 1.5

    def limited(gain, ceiling):
        """Gain into a lookahead limiter; measured again, the gain still owed must fit under TP."""
        for _ in range(4):
            pre = (f"volume={gain:.2f}dB,alimiter=limit={10 ** (ceiling / 20):.4f}:attack=5:release=60:"
                   f"level=0:latency=1,")
            m = measure(pre)
            print(f"limit: +{gain:.2f} dB then a lookahead limiter at {ceiling:.1f} dBFS -> "
                  f"I={m['input_i']} LUFS  TP={m['input_tp']} dBTP  LRA={m['input_lra']} LU")
            over = float(m["input_tp"]) + (a.I - float(m["input_i"])) - (a.TP - 0.3)
            if over <= 0:
                break
            ceiling -= over + 0.3
            gain += over + 0.3
        return pre, m, gain, ceiling

    if a.limit and float(m["input_tp"]) + gain > a.TP - 0.5:
        pre, m, gain, ceiling = limited(gain, ceiling)
    for attempt in range(4):                     # an encoder can lift sharp peaks well past the limiter: measure, lower
        if float(m["input_lra"]) > a.LRA:
            print(f"WARNING: measured LRA {m['input_lra']} > target {a.LRA}: loudnorm will run in DYNAMIC mode. Raise --LRA.")
        af = (f"{pre}loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
              f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:"
              f"linear=true:print_format=json")
        if a.video:
            dur = lambda f: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                                                  "csv=p=0", f], capture_output=True, text=True).stdout.strip() or 0)
            vd, md = dur(a.video), dur(a.mix)
            if attempt == 0 and abs(vd - md) > 0.1:
                print(f"WARNING: the mix is {md:.2f} s and the picture {vd:.2f} s; the picture keeps its length "
                      f"({'silence pads the end' if md < vd else 'the audio is cut at the last frame'})")
            af += ",apad"                            # the picture decides the length; a short mix never trims it
            cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", a.video, "-i", a.mix, "-map", "0:v:0", "-map", "1:a:0",
                   "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart",
                   "-shortest", a.output]
        else:
            cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", a.mix, "-af", af, "-ar", "48000",
                   "-c:a", "pcm_s24le", a.output]
        r = last_json(run(cmd))
        mode = r.get("normalization_type", "?")
        print(f"pass 2: normalization_type={mode}  output I={r['output_i']}  TP={r['output_tp']}  LRA={r['output_lra']}")
        if mode != "linear":
            print("WARNING: dynamic mode ran; the mix was compressed. Lower the peaks before mastering or raise --LRA.")
        v = ebur128(a.output)
        print(f"re-measured from {a.output}: I={v['I']} LUFS  LRA={v['LRA']} LU  true peak={v['Peak']} dBFS")
        try:
            loud_ok, peak = abs(float(v["I"]) - a.I) <= 1.0, float(v["Peak"])
        except ValueError:
            break
        if loud_ok and peak <= ceiling_check:
            break
        if not loud_ok or attempt == 3:
            print("FAIL: outside target (I +/- 1 LU, true peak <= TP). Lower the mix peaks and run again.")
            sys.exit(1)
        over = peak - ceiling_check + 0.3
        print(f"the encoded peak is {over - 0.3:.1f} dB over: the limiter goes {over:.1f} dB lower and it is encoded again")
        pre, m, gain, ceiling = limited(gain + over, ceiling - over)
    print("OK")


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()
