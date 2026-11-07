#!/usr/bin/env python3
"""Per-scene checks of a render: subject action, loudness and harshness (Python 3 standard library + ffmpeg).

Usage:
  scene_check.py action <video> [--scenes b1,b2,...] [--fps 4] [--min 1.0] [--share 0.3]
  scene_check.py sound  <video|audio> [--scenes b1,b2,...] [--max-lu 3] [--max-harsh 3]
  scene_check.py pops   <video>                one-frame flashes and pops (a frame unlike both neighbours)
  scene_check.py loop   <video>                the loop seam: does the last frame flow into the first?

Scenes (pick one; the default is fixed windows of 2 s):
  --scenes 0,3,5.5,8     scene boundaries in seconds (the scene starts, then the end)
  --shots shots.json     start/end frames of every shot
  --every 2              fixed windows of N seconds

action  Subject action per scene: camera motion alone is not a scene. Frames are sampled (--fps), turned grey and
        downscaled; between consecutive samples the best global shift and scale (pan, tilt, truck, dolly, zoom) is
        searched on a centre-weighted crop, and what remains after it is the action. A scene is flagged when its
        median residual stays under --min (0-255 grey levels: nothing acts) or under --share of the total change
        (the camera carries the scene, the subject barely acts). Parallax between depth planes counts as residual,
        so a passing scene is still checked on its strip. The first and last 0.2 s of each scene are skipped.
sound   Per-scene integrated loudness (EBU R128) and the harsh-band ratio: energy in 2-5 kHz relative to the whole
        signal, in dB. Flags a scene more than --max-lu LU away from the median scene (a quiet scene before the
        peak can be intentional: say so) and a scene whose harsh-band ratio is more than --max-harsh dB above the
        median (fatiguing leads, bright synthetic winds or brass, raw saw waves).

pops    Every frame at 48 px wide in grey: frame n is a pop when it differs from both neighbours (each step >= 4 grey
        levels) while the neighbours match each other (their difference under 35 % of the smaller step): a stray
        frame, a one-frame flash or a glitch in an edit. A deliberate one-frame flash is fine; say so.
loop    For a film that loops: the step from the last frame to the first, against the steps beside it. A jump (more
        than twice the larger neighbouring step, at least 1.5 grey levels) shows as a hitch on every repeat; a seam
        of almost nothing between moving frames means the last frame repeats the first, so the loop stutters.

Exit code 1 when a scene or frame is flagged. Numbers measure; they do not listen: the flagged seconds are where to listen.
"""
import argparse
import json
import os
import re
import statistics
import subprocess
import sys

SAMPLE_W = 80          # analysis width in pixels (the height follows the aspect)
CROP = 0.8             # centre crop, as a share of the short side (weighted toward the centre)
SHIFTS = 6             # largest global shift searched per sample step, in analysis pixels
SCALES = (0.94, 0.97, 1.0, 1.03, 1.06)
EDGE_S = 0.2           # skipped at both ends of a scene
HARSH_BAND = (2000, 5000)


def run(cmd, binary=False):
    p = subprocess.run(cmd, capture_output=True)
    if p.returncode != 0:
        sys.exit(f"scene_check: command failed: {' '.join(cmd[:6])} ...\n{p.stderr.decode(errors='replace')[-600:]}")
    return p if binary else p.stderr.decode(errors="replace")


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                          "-of", "json", path], capture_output=True, text=True).stdout
    info = json.loads(out or "{}")
    video = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    audio = any(s.get("codec_type") == "audio" for s in info.get("streams", []))
    return float(info.get("format", {}).get("duration") or 0), video, audio


def scenes_from(args, duration):
    if args.scenes:
        b = [float(x) for x in args.scenes.split(",") if x.strip()]
        if b[0] > 0:
            b.insert(0, 0.0)
        if b[-1] < duration - 0.05:
            b.append(duration)
        return [(f"#{i + 1}", b[i], min(b[i + 1], duration)) for i in range(len(b) - 1) if b[i] < duration]
    if args.shots:
        film = json.load(open(args.shots, encoding="utf-8"))
        fps = float(film.get("fps", 24))
        return [(s.get("id", f"#{i + 1}"), s["start"] / fps, s["end"] / fps) for i, s in enumerate(film.get("shots", []))]
    n = max(1, round(duration / args.every))
    step = duration / n
    return [(f"#{i + 1}", i * step, min(duration, (i + 1) * step)) for i in range(n)]


def stamp(t):
    return f"{int(t // 60):02d}:{t % 60:05.2f}"


# ---------- action ----------

def grey_frames(path, fps, w, h):
    raw = run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-i", path, "-vf",
               f"fps={fps},scale={w}:{h}:flags=area,gblur=sigma=1.5,format=gray", "-f", "rawvideo", "-"], binary=True).stdout
    n = len(raw) // (w * h)
    return [raw[i * w * h:(i + 1) * w * h] for i in range(n)]


class Aligner:
    """Residual difference of frame B against frame A after the best global shift and scale."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        side = int(min(w, h) * CROP) // 2 * 2
        self.cx, self.cy = w / 2, h / 2
        x0, y0 = int(self.cx - side / 2), int(self.cy - side / 2)
        self.pix = [(x, y) for y in range(y0, y0 + side) for x in range(x0, x0 + side)]
        r = side / 2
        self.weight = [max(0.0, 1 - 0.7 * ((x + 0.5 - self.cx) ** 2 + (y + 0.5 - self.cy) ** 2) / (r * r)) for x, y in self.pix]
        self.full = [i for i, wt in enumerate(self.weight) if wt > 0]
        self.coarse = [i for i in self.full if (self.pix[i][0] + self.pix[i][1]) % 2 == 0 and self.pix[i][1] % 2 == 0]
        self.cache = {}

    def index(self, s, dx, dy, subset):
        key = (s, dx, dy, subset is self.coarse)
        if key not in self.cache:
            w, h, cx, cy = self.w, self.h, self.cx, self.cy
            idx = []
            for i in subset:
                x, y = self.pix[i]
                ax = min(w - 1, max(0, int(round(cx + (x + 0.5 - cx) / s - 0.5 + dx))))
                ay = min(h - 1, max(0, int(round(cy + (y + 0.5 - cy) / s - 0.5 + dy))))
                idx.append(ay * w + ax)
            self.cache[key] = idx
        return self.cache[key]

    def cost(self, a, b, s, dx, dy, subset):
        wt, pix, w = self.weight, self.pix, self.w
        idx = self.index(s, dx, dy, subset)
        num = sum(wt[i] * abs(b[pix[i][1] * w + pix[i][0]] - a[j]) for i, j in zip(subset, idx))
        return num / sum(wt[i] for i in subset)

    def fine(self, a, b, s, dx, dy):
        """Bilinear sampling for sub-pixel shifts and in-between scales."""
        w, h, cx, cy, wt, pix = self.w, self.h, self.cx, self.cy, self.weight, self.pix
        num = den = 0.0
        for i in self.full:
            x, y = pix[i]
            fx = min(w - 1.001, max(0.0, cx + (x + 0.5 - cx) / s - 0.5 + dx))
            fy = min(h - 1.001, max(0.0, cy + (y + 0.5 - cy) / s - 0.5 + dy))
            x0, y0 = int(fx), int(fy)
            u, v = fx - x0, fy - y0
            j = y0 * w + x0
            av = (a[j] * (1 - u) + a[j + 1] * u) * (1 - v) + (a[j + w] * (1 - u) + a[j + w + 1] * u) * v
            num += wt[i] * abs(b[y * w + x] - av)
            den += wt[i]
        return num / den

    def residual(self, a, b):
        raw = self.cost(a, b, 1.0, 0, 0, self.full)
        _, s0, dx0, dy0 = min((self.cost(a, b, s, dx, dy, self.coarse), s, dx, dy)
                              for s in SCALES for dx in range(-SHIFTS, SHIFTS + 1, 2) for dy in range(-SHIFTS, SHIFTS + 1, 2))
        k = SCALES.index(s0)
        _, s1, dx1, dy1 = min((self.cost(a, b, s, dx0 + i, dy0 + j, self.full), s, dx0 + i, dy0 + j)
                              for s in SCALES[max(0, k - 1):k + 2] for i in (-1, 0, 1) for j in (-1, 0, 1))
        res = min(self.fine(a, b, s1 + ds, dx1 + i, dy1 + j)
                  for ds in (-0.01, 0, 0.01) for i in (-0.5, 0, 0.5) for j in (-0.5, 0, 0.5))
        return raw, min(raw, res)


def do_action(args):
    duration, video, _ = probe(args.input)
    if not video:
        sys.exit("scene_check: no video stream")
    w = SAMPLE_W
    h = max(16, round(SAMPLE_W * int(video["height"]) / int(video["width"]) / 2) * 2)
    frames = grey_frames(args.input, args.fps, w, h)
    al = Aligner(w, h)
    flagged = 0
    print(f"== action per scene (camera move removed; flag when the median residual < {args.min} "
          f"or < {args.share:.0%} of the total; {args.fps:g} samples/s):")
    for name, a, b in scenes_from(args, duration):
        i0, i1 = int((a + EDGE_S) * args.fps + 0.999), int((b - EDGE_S) * args.fps)
        pairs = [(frames[i - 1], frames[i]) for i in range(max(1, i0 + 1), min(len(frames), i1 + 1))]
        if not pairs:
            print(f"  {name:>5} {stamp(a)}-{stamp(b)}  too short to measure")
            continue
        vals = [al.residual(p, q) for p, q in pairs]
        raw = statistics.median(v[0] for v in vals)
        res = statistics.median(v[1] for v in vals)
        flag = res < args.min or res < args.share * raw
        flagged += flag
        verdict = ("CHECK: nothing moves" if raw < args.min else "CHECK: camera-led, the subject barely acts") if flag else "ok"
        print(f"  {name:>5} {stamp(a)}-{stamp(b)}  residual {res:5.2f}  total {raw:5.2f}  {verdict}")
    print(f"  {flagged} scene(s) flagged" + ("; look at their strips (qc.py strip) and give each an action" if flagged else ""))
    return 1 if flagged else 0


# ---------- sound ----------

def loudness(path, a, d, band=None):
    af = f"highpass=f={band[0]},highpass=f={band[0]},lowpass=f={band[1]},lowpass=f={band[1]}," if band else ""
    err = run(["ffmpeg", "-hide_banner", "-nostdin", "-ss", f"{a:.3f}", "-t", f"{d:.3f}", "-i", path,
               "-vn", "-af", af + "ebur128=framelog=quiet,volumedetect", "-f", "null", "-"])
    lufs = re.findall(r"I:\s+(-?[\d.]+|-inf) LUFS", err)
    mean = re.search(r"mean_volume:\s*(-?[\d.]+|-inf) dB", err)
    to_f = lambda s: -120.0 if s in (None, "-inf") else float(s)
    return to_f(lufs[-1] if lufs else None), to_f(mean.group(1) if mean else None)


def do_sound(args):
    duration, _, audio = probe(args.input)
    if not audio:
        sys.exit("scene_check: no audio stream")
    rows = []
    for name, a, b in scenes_from(args, duration):
        if b - a < 0.4:
            continue
        lufs, full = loudness(args.input, a, b - a)
        _, harsh = loudness(args.input, a, b - a, HARSH_BAND)
        rows.append((name, a, b, lufs, harsh - full if full > -100 else None))
    live = [r for r in rows if r[3] > -60]
    if not live:
        print("== sound per scene: no audible scene")
        return 1
    med_l = statistics.median(r[3] for r in live)
    harsh_vals = [r[4] for r in live if r[4] is not None]
    med_h = statistics.median(harsh_vals) if harsh_vals else 0.0
    flagged = 0
    print(f"== sound per scene (median {med_l:.1f} LUFS, harsh-band median {med_h:+.1f} dB; "
          f"flag > {args.max_lu} LU or > {args.max_harsh} dB above):")
    for name, a, b, lufs, hr in rows:
        notes = []
        if lufs <= -60:
            notes.append("silent: scripted?")
        elif abs(lufs - med_l) > args.max_lu:
            notes.append(f"{'LOUDER' if lufs > med_l else 'QUIETER'} by {abs(lufs - med_l):.1f} LU")
        if hr is not None and lufs > -60 and hr - med_h > args.max_harsh:
            notes.append(f"HARSH: 2-5 kHz {hr - med_h:+.1f} dB over the median")
        flagged += bool(notes) and not (lufs <= -60)
        hs = f"{hr:+5.1f} dB" if hr is not None else "   n/a  "
        print(f"  {name:>5} {stamp(a)}-{stamp(b)}  {lufs:6.1f} LUFS  harsh {hs}  {'; '.join(notes) or 'ok'}")
    print(f"  {flagged} scene(s) flagged" + ("; listen to those seconds, then fix the level or soften the lead" if flagged else ""))
    return 1 if flagged else 0


def frames_small(path, w=48):
    """Every frame, grey, w px wide, streamed (the whole film is never held in memory)."""
    _, video, _ = probe(path)
    if not video:
        sys.exit("scene_check: no video stream")
    h = max(2, round(w * int(video["height"]) / int(video["width"]) / 2) * 2)
    proc = subprocess.Popen(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-i", path, "-vf",
                             f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    size = w * h
    while True:
        b = proc.stdout.read(size)
        if len(b) < size:
            break
        yield b
    proc.wait()


def mad(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def fps_of(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    num, _, den = out.partition("/")
    return float(num) / float(den or 1) if num else 24.0


def do_pops(args):
    fps = fps_of(args.input)
    pops, a, b = [], None, None
    for n, c in enumerate(frames_small(args.input)):
        if a is not None:
            into, out, skip = mad(a, b), mad(b, c), mad(a, c)
            if min(into, out) >= 4 and skip < 0.35 * min(into, out):
                pops.append((n - 1, min(into, out)))
        a, b = b, c
    print(f"== one-frame pops (a frame unlike both neighbours, 48 px grey): {len(pops)}")
    for f, d in pops[:12]:
        print(f"     frame {f} ({stamp(f / fps)})  step {d:.1f}")
    if pops:
        print("  look at each (qc.py strip <video> <t - 0.1> 0.3 24): a stray frame, or a flash on purpose?")
    return 1 if pops else 0


def do_loop(args):
    first = second = before = last = None
    steps = []
    for c in frames_small(args.input):
        if first is None:
            first = c
        elif second is None:
            second = c
        if last is not None:
            steps.append(mad(last, c))
        before, last = last, c
    if second is None or before is None:
        sys.exit("scene_check: the film is too short for a loop check")
    seam, step_in, step_out = mad(last, first), mad(before, last), mad(first, second)
    near = max(step_in, step_out)
    typical = statistics.median(steps)
    print(f"== loop seam (last frame -> first): {seam:.2f} · steps beside it {step_in:.2f} / {step_out:.2f} · "
          f"median step {typical:.2f}")
    if seam > max(1.5, 2 * near):
        print("  JUMP: the last frame does not flow into the first; end on the state frame 0 starts from")
        return 1
    if near > 1.0 and seam < 0.2 * near:
        print("  STUTTER: the last frame repeats the first; end one frame earlier (frame 0 is the next one)")
        return 1
    print("  ok: the seam moves like the frames around it")
    return 0


def do_repeats(args):
    """The same picture twice, far apart: one small grey frame per second, compared with every frame 6 s or more away.
    A deliberate callback is fine when the card names it; anything else reads as material running out."""
    fps = fps_of(args.input)
    step = max(1, round(fps))
    thumbs = [c for n, c in enumerate(frames_small(args.input, w=32)) if n % step == step // 2]
    gap, limit = 6, args.repeat_mad
    pairs = []
    for i in range(len(thumbs)):
        for j in range(i + gap, len(thumbs)):
            d = mad(thumbs[i], thumbs[j])
            if d < limit:
                pairs.append((i, j, d))
    # one line per later second, its closest earlier twin; runs of seconds folded into spans
    best = {}
    for i, j, d in pairs:
        if j not in best or d < best[j][1]:
            best[j] = (i, d)
    spans, prev = [], None
    for j in sorted(best):
        i = best[j][0]
        if prev and j == prev[1] + 1 and abs(i - prev[3] - 1) <= 1:
            prev[1], prev[3] = j, i
        else:
            prev = [j, j, i, i]
            spans.append(prev)
    seconds = sum(b - a + 1 for a, b, _, _ in spans)
    print(f"== repeated compositions (the same picture again, {gap} s or more later; 32 px grey): "
          f"{len(spans)} repeat{'s' if len(spans) != 1 else ''}, {seconds} s of {len(thumbs)}")
    for a, b, i, j in spans[:10]:
        print(f"     {stamp(a)}-{stamp(b + 1)} repeats {stamp(i)}-{stamp(j + 1)}")
    if spans:
        print("  each repeat is a new picture (another angle, scale, place or moment) unless the card names it a callback")
    return 1 if seconds > 0.1 * len(thumbs) else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["action", "sound", "pops", "loop", "repeats"])
    ap.add_argument("input")
    ap.add_argument("--scenes", help="boundaries in seconds, comma separated")
    ap.add_argument("--shots", help="shots.json")
    ap.add_argument("--every", type=float, default=2.0, help="fixed window length in seconds (default 2)")
    ap.add_argument("--fps", type=float, default=4.0, help="action: samples per second (default 4; 2 for long films)")
    ap.add_argument("--min", type=float, default=1.0, help="action: smallest median residual (default 1.0)")
    ap.add_argument("--share", type=float, default=0.3, help="action: smallest residual share of the total change (default 0.3)")
    ap.add_argument("--max-lu", type=float, default=3.0, help="sound: largest deviation from the median scene (LU)")
    ap.add_argument("--repeat-mad", type=float, default=5.0, help="repeats: largest mean grey difference (0-255)")
    ap.add_argument("--max-harsh", type=float, default=3.0, help="sound: largest harsh-band rise over the median (dB)")
    args = ap.parse_args()
    if not os.path.isfile(args.input):
        sys.exit(f"scene_check: no such file: {args.input}")
    sys.exit({"action": do_action, "sound": do_sound, "pops": do_pops, "loop": do_loop,
              "repeats": do_repeats}[args.cmd](args))


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()
