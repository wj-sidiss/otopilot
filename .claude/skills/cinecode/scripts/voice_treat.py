#!/usr/bin/env python3
"""The film's own voice: a narration treatment designed from the story, never the raw TTS (Python 3 stdlib + ffmpeg).

  python3 tools/voice_treat.py list                                             # media and spaces, with when each fits
  python3 tools/voice_treat.py apply audio/vo/*.wav --medium tape --space room --out audio/vo-t
  python3 tools/voice_treat.py apply audio/vo/VO3.wav --medium close --space dry --imprint audio/<signature>.wav \
      --imprint-mix 0.25 --out audio/vo-t                 # the voice carries the film's signature sound inside it

Every narration line goes through three stages:
  1. clean    always: high-pass, de-ess, a little presence, gentle compression (no raw TTS ever reaches the mix)
  2. medium   what the voice comes through: the film's idea decides (`list`)
  3. space    where the voice stands: dry, a small room, a hall, a stone nave, open air
Optional imprint: convolve the voice with a short slice of the film's signature sound,
so the narration sounds made of the film's own material; --imprint-mix sets how much (0.15-0.35 is plenty).
No medium is the default: pick one from the story with a reason (references/sound.md §4b). A whisper is one choice
among many (the `whisper` layer of sound.md), never the house style.
Every line ends at the same dialogue level (--target, default -20 LUFS), whatever the medium, so a megaphone line is
not lost under the music and a close voice does not jump out. Outputs 48 kHz 24-bit WAVs with the same names in --out.
"""
import argparse
import glob
import os
import shutil
import subprocess
import sys

CLEAN = ("highpass=f=80,deesser=i=0.35,equalizer=f=300:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1:g=2,"
         "acompressor=threshold=-22dB:ratio=2.5:attack=8:release=150:makeup=3dB")
MEDIA = {
    "clean":      ("", "a neutral narrator over a picture that carries the film"),
    "close":      ("equalizer=f=150:t=q:w=1:g=2,equalizer=f=9000:t=q:w=1:g=1.5",
                   "an inner voice, a confession, a letter read to one person"),
    "tape":       ("highpass=f=120,lowpass=f=6500,vibrato=f=0.7:d=0.003,asoftclip=type=atan,volume=-1dB",
                   "memory, an archive, a voice from the past"),
    "radio":      ("highpass=f=350,lowpass=f=3200,acrusher=bits=10:mix=0.25:mode=lin,asoftclip=type=hard,volume=-2dB",
                   "news, a broadcast, a voice across a distance"),
    "phone":      ("highpass=f=400,lowpass=f=3000,acrusher=bits=8:mix=0.35:mode=lin,volume=-1dB",
                   "a call, a message left, someone not in the room"),
    "megaphone":  ("highpass=f=500,lowpass=f=4000,asoftclip=type=hard,volume=-3dB,aecho=0.8:0.5:120:0.2",
                   "a crowd, a protest, an announcement in a public space"),
    "underwater": ("lowpass=f=1100,chorus=0.6:0.9:40|55:0.4|0.3:0.25|0.35:1.5|0.9,volume=2dB",
                   "a dream, being submerged, a memory losing its edges"),
    "chorus":     ("chorus=0.5:0.9:20|33|47:0.45|0.35|0.3:0.3|0.4|0.5:1.2|0.9|1.5",
                   "a myth, many voices as one, a collective or a ritual"),
    "machine":    ("flanger=delay=2:depth=3:speed=0.5,acrusher=bits=12:mix=0.2:mode=lin,highpass=f=150",
                   "an AI, a system, a voice that is not quite human"),
    "uncanny":    ("aresample=48000,asetrate=48000*0.84,aresample=48000,atempo=1/0.84,"
                   "chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3,highpass=f=120,lowpass=f=6000",
                   "a creature, an old power, something wrong in a familiar voice"),
}
SPACES = {
    "dry":       ("", "in the ear: no room at all"),
    "room":      ("aecho=0.8:0.6:18|35:0.25|0.15", "a small room: kitchen, car, bedroom"),
    "hall":      ("aecho=0.8:0.7:60|120|190:0.35|0.25|0.15", "a hall, a station, a large interior"),
    "nave":      ("aecho=0.8:0.8:90|180|300|450:0.4|0.3|0.22|0.15,lowpass=f=9000", "stone, a church, a cave, a well"),
    "outdoors":  ("highpass=f=120,aecho=0.8:0.4:120:0.08", "open air: a faint slap from a far wall"),
}


def chain(medium, space):
    return ",".join(x for x in (CLEAN, MEDIA[medium][0], SPACES[space][0]) if x)


def lufs(path):
    d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True).stdout.strip()
    loop = ["-stream_loop", "8"] if d and float(d) < 1.5 else []   # a one-word line is shorter than the 400 ms gate
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *loop, "-i", path, "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    for line in reversed(r.splitlines()):
        if line.strip().startswith("I:"):
            return float(line.split()[1])
    return None


def peak(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    m = [l for l in r.splitlines() if "max_volume" in l]
    return m[0].split("max_volume:")[1].strip() if m else "?"


def cmd_list(a):
    print("MEDIUM (what the voice comes through; pick from the story, no default):")
    for k, (_, use) in MEDIA.items():
        print(f"  {k:<11} {use}")
    print("SPACE (where it stands):")
    for k, (_, use) in SPACES.items():
        print(f"  {k:<11} {use}")
    print("IMPRINT: --imprint <signature.wav> --imprint-mix 0.15-0.35 (the film's own material inside the voice)")


def expand(paths):
    """Wildcards are opened here: bash expands refs/*.* before Python sees it, PowerShell passes it as it is."""
    out = []
    for p in paths:
        hits = sorted(glob.glob(p)) if any(c in p for c in "*?[") else [p]
        if not hits:
            raise SystemExit(f"nothing matches {p}")
        out += hits
    return out


def cmd_apply(a):
    if not shutil.which("ffmpeg"):
        raise SystemExit("voice_treat needs ffmpeg")
    a.files = expand(a.files)
    missing = [f for f in a.files + ([a.imprint] if a.imprint else []) if not os.path.isfile(f)]
    if missing:
        raise SystemExit(f"voice_treat: no such file: {', '.join(missing)}")
    os.makedirs(a.out, exist_ok=True)
    af = chain(a.medium, a.space) + (f",{a.extra}" if a.extra else "")
    for src in a.files:
        dst = os.path.join(a.out, os.path.splitext(os.path.basename(src))[0] + ".wav")
        if a.imprint:
            mix = max(0.0, min(1.0, a.imprint_mix))
            graph = (f"[0:a]{af},asplit[d][w];[1:a]atrim=0:{a.imprint_len},aresample=48000,afade=t=out:st="
                     f"{a.imprint_len * 0.6:.2f}:d={a.imprint_len * 0.4:.2f}[ir];[w][ir]afir=dry=10:wet=10[c];"
                     f"[d]volume={1 - mix:.3f}[dd];[c]volume={mix:.3f}[cc];[dd][cc]amix=inputs=2:normalize=0:duration=first,"
                     f"alimiter=limit=0.89:level=false")
            cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-i", a.imprint, "-filter_complex", graph]
        else:
            cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-af", af + ",alimiter=limit=0.89:level=false"]
        tmp = dst + ".tmp.wav"
        r = subprocess.run(cmd + ["-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", tmp], capture_output=True, text=True)
        if r.returncode != 0:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise SystemExit(f"voice_treat: ffmpeg could not read {src}: "
                             + ((r.stderr or "").strip().splitlines() or ["unknown error"])[-1])
        level = lufs(tmp)                          # every medium lands at the same dialogue level, so the mix stays put
        gain = (a.target - level) if level is not None and level > -70 else 0.0
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.89:level=false",
                        "-ar", "48000", "-c:a", "pcm_s24le", dst], check=True)
        os.remove(tmp)
        level = lufs(dst)
        print(f"{dst} · {a.medium} in {a.space}{' + imprint' if a.imprint else ''} · "
              f"{'silent' if level is None else f'{level:.1f} LUFS'} · peak {peak(dst)}")


def cmd_audition(a):
    """The same raw line through 2-4 treatments, one file each, for the user to choose by ear."""
    pairs = [x.strip() for x in a.pairs.split(",") if x.strip()]
    for n, pair in enumerate(pairs, 1):
        medium, _, space = pair.partition("/")
        if medium not in MEDIA or space not in SPACES:
            print(f"{n}. skipped '{pair}': write medium/space from voice_treat.py list")
            continue
        out = os.path.join(a.out, f"{n}-{medium}-{space}")
        cmd_apply(argparse.Namespace(files=[a.file], medium=medium, space=space, imprint=None, imprint_mix=0.25,
                                     imprint_len=1.5, extra=None, target=a.target, out=out))
    print(f"{len(pairs)} separate treatments of the same line in {a.out}/<n>-<medium>-<space>/; play each on its own")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    p = sub.add_parser("audition")
    p.add_argument("file", help="one raw line (a few seconds)")
    p.add_argument("--pairs", required=True, help='2-4 treatments, "close/room,radio/dry,tape/hall"')
    p.add_argument("--target", type=float, default=-20.0)
    p.add_argument("--out", default="review/voice-treat")
    p.set_defaults(fn=cmd_audition)
    p = sub.add_parser("apply")
    p.add_argument("files", nargs="+")
    p.add_argument("--medium", required=True, choices=sorted(MEDIA))
    p.add_argument("--space", required=True, choices=sorted(SPACES))
    p.add_argument("--imprint", help="a short sound of the film (its signature) to convolve the voice with")
    p.add_argument("--imprint-mix", type=float, default=0.25)
    p.add_argument("--imprint-len", type=float, default=1.5, help="seconds of the imprint sound used (default 1.5)")
    p.add_argument("--extra", help="more ffmpeg filters for this film, appended to the chain")
    p.add_argument("--target", type=float, default=-20.0, help="dialogue level of every line, LUFS (default -20)")
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_apply)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())
