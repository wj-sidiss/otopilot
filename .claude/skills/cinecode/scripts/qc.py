#!/usr/bin/env python3
"""Numeric and visual checks for a film render. Needs ffmpeg/ffprobe (Python 3 standard library only).

  qc.py hook   <video> [min_mean=0.5]          HOOK RULE (hard): motion energy of 0-2 s; FAIL if the open is still
  qc.py info   <video>                         technical summary (size, fps, frames, codecs, colour tags, audio)
  qc.py sheet  <video> [every_s=2] [cols=6]    contact sheet (one frame every N seconds) + timestamp index
  qc.py strip  <video> <start_s> [dur=1.2] [fps=5]   motion strip of a key moment
  qc.py phone  <video> <t1,t2,...>             frames scaled to 390 px wide (phone check)
  qc.py thumb  <image|video> [width=768] [t_s] small JPEG for an agent to look at (saves context tokens)
  qc.py black  <video>                         black intervals (>= 0.1 s)
  qc.py freeze <video> [min_s=1.5]             frozen intervals (no change for >= min_s)
  qc.py dup    <video>                         exact duplicate consecutive frames
  qc.py bright <video> [crop]                  mean lightness L* (0-100) and % very dark samples (L* < 12)
                                               crop example for 2.39:1 inside 1920x1080: 1920:804
  qc.py cuts   <video> [threshold=0.3]         hard cut timestamps (dissolves are not detected)
  qc.py loud   <video|audio>                   integrated loudness, LRA, true peak, silences (< -50 dB, >= 0.5 s)
  qc.py spec   <video|audio>                   spectrogram image (log frequency)
  qc.py action <video> [b1,b2,...]             subject action per scene once the camera move is removed (scene_check.py)
  qc.py sceneloud <video|audio> [b1,b2,...]    loudness and 2-5 kHz harshness per scene; flags > 3 LU or > 3 dB outliers
                                               (b1,b2,... = scene boundaries in seconds; default: 2 s windows)
  qc.py pops   <video>                         one-frame flashes and pops (a frame unlike both neighbours)
  qc.py repeats <video>                        the same picture again 6 s or more later (one small frame a second)
  qc.py loop   <video>                         loop seam: does the last frame flow into the first? (looping films)
  qc.py all    <video>                         everything above that needs no extra arguments (loop only on request)

Output goes to $QC_OUT (default: ./review/qc-<video name>/ inside a film, a temp folder outside one). Nothing is ever deleted.
"""
import math
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
FF = ["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error"]


class Failed(Exception):
    """An ffmpeg step that a single command cannot go on without."""


def call(cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, r.stdout.replace("\r", ""), r.stderr.replace("\r", "")


def ff(args, say):
    rc, _, err = call(FF + args)
    if rc:
        say(err.rstrip())
        raise Failed()


def has_audio(path):
    return bool(call(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                      "-of", "csv=p=0", path])[1].strip())


def duration(path):
    return float(call(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])[1].strip())


def has_drawtext():
    return " drawtext " in call(["ffmpeg", "-hide_banner", "-filters"])[1]


def values(text, key):
    return [float(line.split("=")[1]) for line in text.splitlines() if f"{key}=" in line]


def hook(inp, out, say, min_mean="0.5"):
    # Mean luma difference between consecutive frames (160 px grey, 0-255) over the first 2 s.
    # Default mean >= 0.5 (grain or dust on a still frame measures about 0.2-0.3; a clear move 0.8-5).
    # A deliberately quiet long-form open (slow push-in, chosen by the user): min_mean=0.1. Every pair of steps has one
    # >= 0.02, so a look drawn on twos (each drawing held two frames) passes while a held still frame does not.
    say(f"== hook (first 2 s must move from frame 1; min mean {min_mean}, motion >= 0.02 in every 2 frames):")
    _, text, _ = call(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-t", "2", "-i", inp, "-vf",
                       "scale=160:-2,format=gray,tblend=all_mode=difference,signalstats,"
                       "metadata=print:key=lavfi.signalstats.YAVG:file=-", "-an", "-f", "null", "-"])
    v = values(text, "YAVG")
    if not v:
        say("  no frames measured: FAIL")
        return 1
    mean = sum(v) / len(v)
    low = min(max(v[i:i + 2]) for i in range(max(1, len(v) - 1)))
    ok = mean >= float(min_mean) and low >= 0.02
    say(f"  steps={len(v)} mean={mean:.2f} min={low:.3f} first_step={max(v[:2]):.3f}")
    say("  PASS" if ok else "  FAIL: open on the motion itself (camera move or action from frame 1); no still title, "
        "no fade from black")
    say("  (also look at the strip: qc.py strip <video> 0 2 12, so grain or flicker is not mistaken for motion)")
    return 0 if ok else 1


def info(inp, out, say):
    say(f"== info: {inp}")
    say(call(["ffprobe", "-v", "error", "-show_entries", "format=duration,size,bit_rate", "-of", "default=nw=1", inp])[1].rstrip())
    video = call(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
                  "stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_packets,color_range,color_space,"
                  "color_primaries,color_transfer", "-of", "default=nw=1", inp])[1]
    say(re.sub(r"^nb_read_packets=", "frames=", video.rstrip(), flags=re.M))
    if has_audio(inp):
        audio = call(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                      "stream=codec_name,sample_rate,channels,bit_rate", "-of", "default=nw=1", inp])[1]
        say(re.sub(r"^", "audio_", audio.rstrip(), flags=re.M))
    else:
        say("audio: none")
    return 0


def sheet(inp, out, say, every="2", cols="6"):
    n = max(1, math.ceil(duration(inp) / float(every)))
    cols = min(int(cols), n)
    rows = math.ceil(n / cols)
    label = (",drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5"
             if has_drawtext() else "")

    def build(lbl):
        return ["-y", "-i", inp, "-vf", f"select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,{every}-0.001)',"
                f"scale=320:-2{lbl},tile={cols}x{rows}:padding=4:margin=4", "-fps_mode", "vfr", "-frames:v", "1",
                "-update", "1", f"{out}/sheet.jpg"]
    rc, _, err = call(FF + build(label))
    if rc and label:                             # a Windows ffmpeg can have drawtext but find no font: drop the label
        rc, _, err = call(FF + build(""))
    if rc:
        say(err.rstrip())
        raise Failed()
    step = float(every)
    lines = [f"row {i // cols + 1} col {i % cols + 1}: {int(i * step // 60):02d}:{i * step % 60:05.2f}" for i in range(n)]
    Path(out, "sheet-index.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    say(f"== sheet: {out}/sheet.jpg (index: {out}/sheet-index.txt, one tile every {every}s)")
    return 0


def strip(inp, out, say, start=None, dur="1.2", fps="5"):
    if start is None:
        say("qc: strip needs <start_s>")
        return 2
    n = max(1, math.ceil(float(dur) * float(fps)))
    ff(["-y", "-ss", start, "-t", dur, "-i", inp, "-vf", f"fps={fps},scale=270:-2,tile={n}x1:padding=2",
        "-frames:v", "1", "-update", "1", f"{out}/strip-{start}s.jpg"], say)
    say(f"== strip: {out}/strip-{start}s.jpg ({n} frames, every {round(1 / float(fps), 3)} s)")
    return 0


def phone(inp, out, say, times=None):
    if not times:
        say("qc: phone needs <t1,t2,...>")
        return 2
    for t in times.split(","):
        ff(["-y", "-ss", t, "-i", inp, "-frames:v", "1", "-vf", "scale=390:-2", "-update", "1", f"{out}/phone-{t}s.png"], say)
    say(f"== phone frames (390 px wide): {out}/phone-*.png")
    return 0


def thumb(inp, out, say, width="768", t=""):
    dst = f"{out}/thumb-{Path(inp).stem}{f'-{t}s' if t else ''}-{width}.jpg"
    ff(["-y"] + (["-ss", t] if t else []) + ["-i", inp, "-frames:v", "1", "-vf", f"scale='min({width},iw)':-2",
                                            "-q:v", "4", "-update", "1", dst], say)
    size = call(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", dst])[1].strip()
    say(f"== thumb: {dst} ({size})")
    return 0


def black(inp, out, say):
    say("== black intervals (>= 0.1 s, 98% of pixels dark):")
    _, so, se = call(["ffmpeg", "-hide_banner", "-nostdin", "-i", inp, "-vf", "blackdetect=d=0.1:pic_th=0.98:pix_th=0.10",
                      "-an", "-f", "null", "-"])
    hits = re.findall(r"black_start:\S* black_end:\S* black_duration:\S*", se + so)
    say("\n".join(hits) if hits else "none")
    return 0


def freeze(inp, out, say, least="1.5"):
    say(f"== frozen intervals (>= {least} s):")
    _, so, se = call(["ffmpeg", "-hide_banner", "-nostdin", "-i", inp, "-vf", f"freezedetect=n=-60dB:d={least}",
                      "-map", "0:v", "-f", "null", "-"])
    hits = re.findall(r"lavfi\.freezedetect\.freeze_[a-z]*: [0-9.]*", se + so)
    say("\n".join(hits) if hits else "none")
    say("(grain hides freezes from this detector; also check strips and duplicates)")
    return 0


def dup(inp, out, say):
    say("== exact duplicate consecutive frames:")
    _, text, _ = call(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-i", inp, "-map", "0:v",
                       "-f", "framemd5", "-"])
    prev, dups, i = None, [], 0
    for line in text.splitlines():
        if line.startswith("#"):
            continue
        h = line.strip().split(",")[-1].strip()
        if h == prev:
            dups.append(i)
        prev, i = h, i + 1
    say(f"frames: {i}, duplicates: {len(dups)}")
    if dups:
        say("duplicate frame indices (0-based): " + ", ".join(map(str, dups[:50])) + (" ..." if len(dups) > 50 else ""))
    return 0


def bright(inp, out, say, crop=""):
    say(f"== brightness (4 samples/s{f', crop {crop}' if crop else ''}):")
    vf = "fps=4," + (f"crop={crop}," if crop else "") + "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-"
    vals = values(call(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-i", inp, "-vf", vf,
                        "-an", "-f", "null", "-"])[1], "YAVG")
    if not vals:
        say("no samples")
        return 0

    def lstar(yavg):                                 # limited-range luma -> approx. CIE L*
        y = min(max((yavg - 16) / 219, 0), 1) ** 2.4
        return 116 * y ** (1 / 3) - 16 if y > 0.008856 else 903.3 * y

    lum = [lstar(v) for v in vals]
    dark = sum(1 for x in lum if x < 12) / len(lum) * 100
    say(f"samples: {len(lum)}, mean L*: {sum(lum) / len(lum):.1f}, min: {min(lum):.1f}, max: {max(lum):.1f}, "
        f"very dark (L*<12): {dark:.1f}%")
    return 0


def cuts(inp, out, say, th="0.3"):
    say(f"== hard cuts (scene score > {th}):")
    text = call(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-i", inp, "-vf",
                 f"select='gt(scene,{th})',metadata=print:file=-", "-an", "-f", "null", "-"])[1]
    ts = [float(x) for x in re.findall(r"pts_time:([0-9.]+)", text)]
    say(f"cuts: {len(ts)}")
    for t in ts:
        say(f"  {int(t // 60):02d}:{t % 60:06.3f}")
    return 0


def loud(inp, out, say):
    if not has_audio(inp):
        say("== loudness: no audio stream")
        return 0
    say("== loudness (EBU R128, true peak):")
    _, so, se = call(["ffmpeg", "-hide_banner", "-nostdin", "-i", inp, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"])
    summary = False
    for line in (se + so).splitlines():
        summary = summary or "Summary:" in line
        if summary and re.search(r"I:|LRA:|Peak:|Threshold:", line):
            say("  " + line)
    say("== silences (< -50 dB, >= 0.5 s):")
    _, so, se = call(["ffmpeg", "-hide_banner", "-nostdin", "-i", inp, "-af", "silencedetect=n=-50dB:d=0.5", "-vn",
                      "-f", "null", "-"])
    hits = re.findall(r"silence_start: [0-9.]*|silence_end: [0-9.]* \| silence_duration: [0-9.]*", se + so)
    say("\n".join(hits) if hits else "  none")
    say("targets for web: I = -14 LUFS (+/-1), true peak <= -1 dBTP; every silence must be scripted")
    return 0


def spec(inp, out, say):
    if not has_audio(inp):
        say("== spectrogram: no audio stream")
        return 0
    ff(["-y", "-i", inp, "-lavfi", "showspectrumpic=s=1600x512:scale=log:fscale=log:legend=1", "-frames:v", "1",
        "-update", "1", f"{out}/spectrogram.png"], say)
    say(f"== spectrogram: {out}/spectrogram.png (look for persistent horizontal lines = pitched layers)")
    return 0


def scene(kind):
    def check(inp, out, say, bounds=""):
        rc, so, se = call([sys.executable, HERE / "scene_check.py", kind, inp] + (["--scenes", bounds] if bounds else []))
        text = (so + se).rstrip()
        if text:
            say(text)
        return rc
    return check


COMMANDS = {"hook": hook, "info": info, "sheet": sheet, "strip": strip, "phone": phone, "thumb": thumb, "black": black,
            "freeze": freeze, "dup": dup, "bright": bright, "cuts": cuts, "loud": loud, "spec": spec,
            "action": scene("action"), "sceneloud": scene("sound"), "pops": scene("pops"), "repeats": scene("repeats"),
            "loop": scene("loop")}


def everything(inp, out, say, bounds=""):
    # qc.py all <video> [0,b1,b2,…,end]: the scene or shot boundaries make the per-scene checks real; exit 1 when the
    # hook (a hard rule) fails, so a script or an agent cannot read a failed film as passed.
    report = []

    def tee(text):
        say(text)
        report.append(text)

    held = []
    hook_ok = hook(inp, out, held.append) == 0
    steps = [lambda: info(inp, out, tee), lambda: tee("\n".join(held)),
             lambda: sheet(inp, out, tee, os.environ.get("QC_SHEET_EVERY", "2"), os.environ.get("QC_SHEET_COLS", "6")),
             lambda: black(inp, out, tee), lambda: freeze(inp, out, tee), lambda: dup(inp, out, tee),
             lambda: scene("pops")(inp, out, tee), lambda: scene("repeats")(inp, out, tee), lambda: bright(inp, out, tee),
             lambda: cuts(inp, out, tee), lambda: scene("action")(inp, out, tee, bounds), lambda: loud(inp, out, tee),
             lambda: has_audio(inp) and scene("sound")(inp, out, tee, bounds), lambda: spec(inp, out, tee)]
    for run in steps:
        try:
            run()
        except Failed:
            pass
    Path(out, "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    say(f"== report: {out}/report.txt")
    if not hook_ok:
        say("== HOOK FAILED (hard rule)")
        return 1
    return 0


def main(argv):
    if argv[:1] in (["-h"], ["--help"], ["help"]):
        print(__doc__.strip())
        return 0
    if len(argv) < 2:
        print(__doc__.strip())
        return 2
    cmd, inp, rest = argv[0], argv[1], argv[2:]
    if cmd != "all" and cmd not in COMMANDS:
        print(f"qc: unknown command {cmd}", file=sys.stderr)
        return 2
    if not os.path.isfile(inp):
        print(f"qc: no such file: {inp}", file=sys.stderr)
        return 2
    name = Path(inp).stem
    out = os.environ.get("QC_OUT", "")
    # outside a film (no STATE.md here or above) the output goes to a temp folder, never into a shelf of films
    if not out and not any(os.path.isfile(p) for p in ("STATE.md", "../STATE.md", "../../STATE.md")):
        out = os.path.join(tempfile.gettempdir(), "cinecode-qc", name)
    out = out or f"./review/qc-{name}"
    os.makedirs(out, exist_ok=True)

    def say(text):
        print(text, flush=True)

    try:
        return (everything if cmd == "all" else COMMANDS[cmd])(inp, out, say, *rest)
    except Failed:
        return 1


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    sys.exit(main(sys.argv[1:]))
