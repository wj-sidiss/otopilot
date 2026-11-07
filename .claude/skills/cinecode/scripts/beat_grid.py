#!/usr/bin/env python3
"""The beat grid of the user's own song or track: tempo, beat phase, downbeats (bars) and where each lyric line lands
(Python 3 standard library + ffmpeg; no installs).

  python3 tools/beat_grid.py song.mp3                          # BPM, half-time, first beat, first downbeat, bars
  python3 tools/beat_grid.py song.mp3 --from 42 --to 102       # only that part of the song
  python3 tools/beat_grid.py song.mp3 --lrc song.lrc           # + each lyric line's beat and bar
  python3 tools/beat_grid.py song.mp3 --json audio/beats.json  # everything as JSON (bars, lines) for the cue table

The tempo is measured on the whole song (up to 6 minutes) even when --from/--to pick a part; the part only sets the
phase and the downbeat, and a note is printed when the part alone reads differently (an intro in a dotted figure).

Method: an onset envelope from the change in short-time energy (log, rectified, local mean removed), the tempo from
its autocorrelation between 70 and 170 BPM (interpolated lag), the beat phase from the comb of beats that collects
the most onset energy, and the downbeat from the low band (under 150 Hz: kick and bass) summed per beat position in
a bar of four. The pulse strength (how far the tempo's autocorrelation peak stands above its mean) says whether there is a beat
at all: noise, wind and drones measure about 1.1x, songs 3x and more, and audio without any sharp onset (a held
tone, silence) reads 0; under 2x the grid is not to be cut to. Songs in 3/4 or with a soft low end can get the downbeat wrong: check the printed bar times by ear
or against the lyric lines (lines usually start a fraction of a beat before a bar). For a ballad the half-time
pulse often reads better as BPM in film.html. Method after the beat grid of tuzhechen2005/opus-video-skills (MIT).

Then cut a clip that starts on a downbeat, so film time 0 is a bar line (the command is printed), set BPM and
BEAT0 = 0 in film.html, and put cues on beat(n) / bar(n) (references/music-video.md).
"""
import argparse
import array
import itertools
import json
import math
import os
import re
import subprocess
import sys

SR, HOP, WIN = 11025, 128, 512
FPS = SR / HOP
LAT = (WIN - HOP / 2) / SR                 # an onset shows when it enters the window's end: shift times back


def envelope(path, t0, t1, band):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(t0)] + (["-t", str(t1 - t0)] if t1 else []) + \
          ["-i", path, "-ac", "1", "-ar", str(SR), "-af", band, "-f", "s16le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = array.array("h")
    x.frombytes(raw[: len(raw) // 2 * 2])
    if sys.byteorder == "big":
        x.byteswap()
    pre = list(itertools.accumulate((v * v for v in x), initial=0))
    n = (len(x) - WIN) // HOP
    if n < FPS * 4:
        raise SystemExit("too short: give at least 4 seconds of music")
    loge = [math.log(1e-3 + (pre[i * HOP + WIN] - pre[i * HOP]) / WIN) for i in range(n)]
    flux = [0.0] + [max(0.0, loge[i] - loge[i - 1]) for i in range(1, n)]
    k = 32                                              # remove the local mean (about 0.4 s each side)
    pf = list(itertools.accumulate(flux, initial=0))
    return [max(0.0, flux[i] - (pf[min(n, i + k)] - pf[max(0, i - k)]) / (min(n, i + k) - max(0, i - k))) for i in range(n)]


def tempo(flux):
    lo, hi = int(FPS * 60 / 170) - 1, int(FPS * 60 / 70) + 2
    n = len(flux)
    ac = {l: sum(flux[i] * flux[i + l] for i in range(n - l)) / (n - l) for l in range(lo, hi + 1)}

    def score(bpm):
        lag = FPS * 60 / bpm
        l, f = int(lag), lag - int(lag)
        return ac[l] * (1 - f) + ac[l + 1] * f
    best = max((70 + 0.05 * i for i in range(2001)), key=score)
    mean = sum(ac.values()) / len(ac)
    return best, (max(ac.values()) / mean if mean > 0 else 0.0)   # tempo, and how far its peak stands out (pulse)


def comb(flux, beat, p):
    n, s, t = len(flux), 0.0, p
    while t * FPS < n - 1:
        i = int(round(t * FPS))
        s += max(flux[max(0, i - 1): i + 2])
        t += beat
    return s


def refine(flux, bpm):
    """Tempo and phase together: the autocorrelation lands within a lag step; the comb over the whole clip settles
    the last fraction of a BPM (0.3 % off drifts a beat in a minute)."""
    best = (0.0, bpm, 0.0)
    for j in range(-60, 61):
        b = bpm * (1 + j * 0.0002)
        beat = 60 / b
        for i in range(int(beat / 0.01)):
            sc = comb(flux, beat, 0.01 * i)
            if sc > best[0]:
                best = (sc, b, 0.01 * i)
    _, b, p = best
    beat = 60 / b
    p = max((p + 0.002 * k for k in range(-5, 6) if p + 0.002 * k >= 0), key=lambda q: comb(flux, beat, q))
    return b, p


def phase_for(flux, beat):
    return max((0.002 * i for i in range(int(beat / 0.002))), key=lambda q: comb(flux, beat, q))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio")
    ap.add_argument("--from", dest="t0", type=float, default=0.0, help="start (s) in the song")
    ap.add_argument("--to", dest="t1", type=float, default=0.0, help="end (s) in the song")
    ap.add_argument("--lrc", help="lyric timings ([mm:ss.xx] text per line)")
    ap.add_argument("--json", help="write the grid as JSON here")
    a = ap.parse_args()

    # The tempo comes from the whole song (up to 6 min): a part alone can read a dotted or triplet figure as the pulse
    # (4:3) or a half-time section as half the tempo. The phase and the downbeat come from the part itself.
    windowed = a.t0 > 0 or a.t1 > 0
    song = envelope(a.audio, 0, 360, "highpass=f=40")
    coarse, pulse = tempo(song)
    if max(song) < 0.5:                             # no onsets at all (a held tone, silence): no pulse to speak of
        pulse = 0.0
    bpm, phase = refine(song, coarse)
    full = envelope(a.audio, a.t0, a.t1 or None, "highpass=f=40") if windowed else song
    low = envelope(a.audio, a.t0, a.t1 or None, "lowpass=f=150")
    beat = 60 / bpm
    note = ""
    if windowed:
        phase = phase_for(full, beat)
        part = tempo(full)[0]
        if abs(part / bpm - 1) > 0.02:
            note = (f"note: this part alone reads as {part:.2f} BPM ({part / bpm:.2f}x the song's pulse: a dotted, "
                    f"triplet or half-time figure); the grid uses the song's {bpm:.2f}")
    n = len(full)
    peak = max(full)
    start = next((i for i, v in enumerate(full) if v > 0.1 * peak), 0) / FPS   # the music's first onset
    beats_t = []
    t = phase + beat * max(0, math.ceil((start - phase - beat / 2) / beat))
    phase = t
    while t * FPS < n - 1:
        beats_t.append(t)
        t += beat
    weight = [0.0] * 4                                    # which of four beat positions carries the low end
    for j, bt in enumerate(beats_t):
        i = int(round(bt * FPS))
        weight[j % 4] += max(low[max(0, i - 2): i + 3])
    down = max(range(4), key=lambda k: weight[k])
    first_beat = a.t0 + phase + LAT
    first_down = a.t0 + beats_t[down] + LAT
    bars = [round(a.t0 + bt + LAT, 3) for bt in beats_t[down::4]]
    conf = max(weight) / (sum(weight) / 4) if sum(weight) else 0

    print(f"bpm {bpm:.2f} (half-time {bpm / 2:.2f}) · beat {beat:.4f} s · bar {4 * beat:.3f} s · pulse {pulse:.2f}x"
          + ("" if pulse >= 2.0 else " (no clear beat: ambient, speech or a drone; do not cut to this grid)"))
    if note:
        print(note)
    print(f"first beat {first_beat:.3f} s · first downbeat {first_down:.3f} s "
          f"(low-end accent {conf:.2f}x the average; under 1.15x the downbeat is a guess)")
    print("bars: " + " ".join(f"{b:.2f}" for b in bars[:8]) + (" …" if len(bars) > 8 else ""))
    print(f"clip on a bar line: ffmpeg -ss {first_down:.3f} -t <length> -i \"{a.audio}\" "
          f"-af \"afade=t=out:st=<length-2>:d=2\" -ac 2 -ar 48000 audio/music.wav   (then BPM = {bpm:.2f}, BEAT0 = 0)")

    lines = []
    if a.lrc:
        for raw in open(a.lrc, encoding="utf-8"):
            m = re.match(r"\[(\d+):(\d+(?:\.\d+)?)\](.*)", raw.strip())
            if not m:
                continue
            t = int(m.group(1)) * 60 + float(m.group(2))
            b = round((t - first_down) / beat, 2)    # a line on a bar line reads bar n.1.00, not (n-1).5.00
            film = round(t - first_down, 3)         # time in audio/music.wav, cut at the first downbeat as printed
            lines.append({"t": round(t, 3), "film": film, "beat": round(b, 2), "bar": math.floor(b / 4) + 1,
                          "beat_in_bar": round(b % 4 + 1, 2), "text": m.group(3).strip()})
            print(f"{t:8.2f} s (film {film:7.2f} s) · beat {b:7.2f} · bar {math.floor(b / 4) + 1:>3}.{b % 4 + 1:4.2f}"
                  f" · {m.group(3).strip()}")
    if lines:
        print("film = the time in a clip cut at the first downbeat; a clip cut n bars later: film - n × bar")
    if a.json:
        json.dump({"audio": a.audio, "bpm": round(bpm, 3), "beat": round(beat, 5), "first_beat": round(first_beat, 3),
                   "first_downbeat": round(first_down, 3), "downbeat_confidence": round(conf, 2), "pulse": round(pulse, 2), "bars": bars,
                   "lines": lines}, open(a.json, "w", encoding="utf-8"), indent=1)
        print(f"grid -> {a.json}")


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
