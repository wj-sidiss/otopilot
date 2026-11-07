#!/usr/bin/env python3
"""Build a timed, low-resolution animatic with temp sound from shots.json (Python 3 stdlib + ffmpeg + Chrome).

  python3 tools/animatic.py shots.json --out renders/animatic-v1.mp4
  python3 tools/animatic.py shots.json --out renders/animatic-v2.mp4 --stills review/stills --clips renders/rough --vo audio/temp_vo.wav

Per shot, in this order of preference:
  --clips DIR/<id>.mp4    a rough render of the shot (scaled, trimmed or held to the shot length)
  --stills DIR/<id>.png   a still (png/jpg) drawn as a card with the shot's on-screen text and VO line
  neither                 a grey card with the shot id, timecode, description and reads
Cards are drawn on a canvas in headless Chrome by tools/capture.mjs (same folder), so text needs no ffmpeg fonts.
Temp sound: a seeded brown-noise bed and a soft tick on every cut; --vo mixes a temp narration on top.
Width defaults to 1/3 of the film width (--scale 0.333). Nothing is deleted; work files go to <out>.work/.
"""
import argparse
import base64
import hashlib
import json
import math
import os
import random
import shutil
import struct
import subprocess
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))


def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        sys.exit(f"failed: {' '.join(cmd[:4])} ...\n{p.stderr[-2000:]}{p.stdout[-1000:]}")
    return p.stdout


def find(dir_, sid, exts):
    if not dir_:
        return None
    for e in exts:
        p = os.path.join(dir_, sid + e)
        if os.path.exists(p):
            return p
    return None


def still_data_url(path, w, work):
    small = os.path.join(work, "still-" + os.path.basename(path) + ".jpg")
    run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", f"scale={w}:-2", "-q:v", "4", "-frames:v", "1", small])
    return "data:image/jpeg;base64," + base64.b64encode(open(small, "rb").read()).decode()


CARDS_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head>
<body><canvas id="c"></canvas><script>
const CARDS = %s, W = %d, H = %d, FPS = %s;
const c = document.getElementById('c'); c.width = W; c.height = H; const g = c.getContext('2d');
const imgs = CARDS.map((k) => { if (!k.img) return null; const i = new Image(); i.src = k.img; return i; });
function wrap(text, x, y, maxW, lh, maxLines) {
  const words = String(text || '').split(/\\s+/); let line = '', n = 0;
  for (const w of words) { const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) break; } else line = t; }
  if (line) g.fillText(line, x, y); return y + lh;
}
window.renderFrame = (i) => {
  const k = CARDS[i], u = Math.min(W, H) / 100;
  g.fillStyle = '#2a2d33'; g.fillRect(0, 0, W, H);
  const im = imgs[i];
  if (im) { const s = Math.max(W / im.width, H / im.height); g.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s); }
  g.textBaseline = 'top'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, u * 9);
  g.fillStyle = '#ffd36b'; g.font = `bold ${u * 4}px sans-serif`; g.fillText(`${k.id}  ${k.tc}  (${k.dur.toFixed(1)} s)`, u * 3, u * 2.5);
  if (!im) { g.fillStyle = '#e8e8e8'; g.font = `${u * 4.2}px sans-serif`; let y = wrap(k.desc, u * 5, H * 0.3, W - u * 10, u * 5.6, 6);
    g.fillStyle = '#9fb4c8'; g.font = `${u * 3.4}px sans-serif`; for (const r of k.reads) y = wrap('- ' + r, u * 5, y + u, W - u * 10, u * 4.4, 2); }
  k.text.forEach((t, j) => { g.fillStyle = '#ffffff'; g.font = `bold ${u * 6}px sans-serif`; g.textAlign = 'center';
    g.fillText(t, W / 2, H * 0.42 + j * u * 7.5); g.textAlign = 'left'; });   // several cards stack, never overlap
  if (k.vo) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, H - u * 16, W, u * 16); g.fillStyle = '#ffffff';
    g.font = `italic ${u * 3.8}px sans-serif`; g.textAlign = 'center'; wrap('VO: ' + k.vo, W / 2, H - u * 13, W - u * 8, u * 4.8, 2); g.textAlign = 'left'; }
};
window.captureFrame = (i, type = 'image/png', q = 0.95) => { window.renderFrame(i); return c.toDataURL(type, q); };
window.READY = Promise.all(imgs.filter(Boolean).map((i) => i.decode())).then(() => ({ frames: CARDS.length, fps: FPS, width: W, height: H, renderer: '2d canvas' }));
</script></body></html>
"""


def tc(frames, fps):
    s = frames / fps
    return f"{int(s // 60)}:{s % 60:04.1f}"


def temp_sound(path, total_s, cuts_s, seed, sr=48000):
    rng = random.Random(seed)
    n = int(total_s * sr)
    brown, out = 0.0, bytearray()
    ticks = [int(c * sr) for c in cuts_s]
    tick_len = int(0.03 * sr)
    for i in range(n):
        brown = 0.995 * brown + 0.02 * (rng.random() * 2 - 1)       # leaky brown noise: a soft room bed
        v = brown * 0.9
        for t0 in ticks:
            d = i - t0
            if 0 <= d < tick_len:
                v += 0.25 * math.sin(2 * math.pi * 1800 * d / sr) * math.exp(-d / (0.006 * sr))
        fade = min(1.0, i / (0.05 * sr), (n - i) / (0.3 * sr))
        out += struct.pack("<h", int(max(-1.0, min(1.0, v * fade)) * 32767 * 0.5))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(bytes(out))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("shots")
    ap.add_argument("--out", required=True)
    ap.add_argument("--stills")
    ap.add_argument("--clips")
    ap.add_argument("--vo", help="temp narration WAV, placed at 0 s (pre-timed)")
    ap.add_argument("--scale", type=float, default=0.333)
    a = ap.parse_args()

    film = json.load(open(a.shots, encoding="utf-8"))
    fps = float(film.get("fps", 24))
    W = max(160, int(film["width"] * a.scale) // 2 * 2)
    H = max(160, int(film["height"] * a.scale) // 2 * 2)
    work = a.out + ".work"
    os.makedirs(work, exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    if os.path.exists(a.out):
        sys.exit(f"{a.out} exists; animatics are versioned, choose a new name")

    shots = film["shots"]
    cards = []
    for s in shots:
        still = find(a.stills, s["id"], (".png", ".jpg", ".jpeg"))
        cards.append({"id": s["id"], "tc": tc(s["start"], fps), "dur": (s["end"] - s["start"]) / fps,
                      "desc": s.get("description", ""), "reads": [r.get("read", "") for r in s.get("reads", [])],
                      "text": [t.get("text", "") for t in s.get("text_on_screen", [])] + [      # the film's text track
                          t.get("text", "") for t in film.get("text_on_screen") or [] if isinstance(t.get("t"), list)
                          and len(t["t"]) == 2 and t["t"][0] < s["end"] / fps and t["t"][1] > s["start"] / fps],
                      "vo": s.get("vo", ""),
                      "img": still_data_url(still, W, work) if still else None})
    html = os.path.join(work, "cards.html")
    open(html, "w", encoding="utf-8").write(CARDS_HTML % (json.dumps(cards), W, H, json.dumps(fps)))
    cards_dir = os.path.join(work, "cards")
    if os.path.isdir(cards_dir):
        shutil.rmtree(cards_dir)                               # work files only, rebuilt every run
    run(["node", os.path.join(HERE, "capture.mjs"), "--url", html, "--out", cards_dir])

    segs = []
    for i, s in enumerate(shots):
        dur = (s["end"] - s["start"]) / fps
        seg = os.path.join(work, f"seg-{i:02d}.mp4")
        clip = find(a.clips, s["id"], (".mp4", ".mov", ".webm"))
        vf = f"scale={W}:{H}:force_original_aspect_ratio=increase:out_range=tv,crop={W}:{H},fps={fps},format=yuv420p"
        if clip:
            run(["ffmpeg", "-v", "error", "-y", "-i", clip, "-vf", vf + f",tpad=stop_mode=clone:stop_duration={dur}",
                 "-t", f"{dur}", "-an", "-c:v", "libx264", "-crf", "26", seg])
        else:
            run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", os.path.join(cards_dir, f"{i:06d}.png"),
                 "-vf", vf, "-t", f"{dur}", "-an", "-c:v", "libx264", "-crf", "26", seg])
        segs.append(seg)
    lst = os.path.join(work, "segments.txt")
    q = lambda p: os.path.abspath(p).replace("'", "'\\''")      # concat lists quote paths; a ' in a folder name is escaped
    with open(lst, "w", encoding="utf-8") as fh:
        fh.write("".join(f"file '{q(p)}'\n" for p in segs))
    picture = os.path.join(work, "picture.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", picture])

    total = shots[-1]["end"] / fps
    cuts = [s["start"] / fps for s in shots[1:]]
    bed = os.path.join(work, "temp_sound.wav")
    temp_sound(bed, total, cuts, film.get("seed", 7))
    if a.vo and not os.path.exists(a.vo):
        print(f"no temp narration at {a.vo}: the animatic keeps the temp bed only")
        a.vo = None
    if a.vo:
        run(["ffmpeg", "-v", "error", "-y", "-i", picture, "-i", bed, "-i", a.vo, "-filter_complex",
             "[1]volume=0.6[b];[2]aresample=48000[v];[b][v]amix=inputs=2:normalize=0:duration=first[a]",
             "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", a.out])
    else:
        run(["ffmpeg", "-v", "error", "-y", "-i", picture, "-i", bed, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
             "-c:a", "aac", "-b:a", "160k", "-shortest", a.out])
    record = os.path.join(os.path.dirname(os.path.abspath(a.out)), ".animatics.json")   # make.py check reads it
    try:
        with open(record, encoding="utf-8") as fh:
            made = json.load(fh)
    except (OSError, ValueError):
        made = {}
    with open(a.out, "rb") as fh:
        made[os.path.basename(a.out)] = hashlib.sha1(fh.read()).hexdigest()
    with open(record, "w", encoding="utf-8") as fh:
        json.dump(made, fh, indent=1)
    n_clips = sum(1 for s in shots if find(a.clips, s["id"], (".mp4", ".mov", ".webm")))
    n_stills = sum(1 for s, c in zip(shots, cards) if c["img"] and not find(a.clips, s["id"], (".mp4", ".mov", ".webm")))
    print(f"animatic: {a.out} ({W}x{H}, {len(shots)} shots, {total:.2f} s; "
          f"rough clips {n_clips}, stills {n_stills}, grey cards {len(shots) - n_clips - n_stills})")


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()
