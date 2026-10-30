"""Dudak senkronu ölçer: ağız bölgesindeki hareket ile sesin enerjisi arasındaki gecikmeyi bulur.

Kullanım: .venv/Scripts/python scripts/dudak-olc.py video.mp4 ses.wav [--bas 0] [--x 0.5 --y 0.41 --boy 0.16]
- ses, videonun 0. saniyesine hizalı olmalı (--bas: sesin kaçıncı saniyesinden başlanacağı).
- Çıktı: en iyi gecikme (ms, + = görüntü sesten geç) ve korelasyon.
"""
import argparse
import subprocess
import sys

import numpy as np
import soundfile as sf

sys.stdout.reconfigure(encoding="utf-8")
ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("ses")
ap.add_argument("--bas", type=float, default=0.0)
ap.add_argument("--x", type=float, default=0.5); ap.add_argument("--y", type=float, default=0.41); ap.add_argument("--boy", type=float, default=0.16)
g = ap.parse_args()
W, H = 360, 640
ham = subprocess.run(["ffmpeg", "-v", "error", "-i", g.video, "-vf", f"fps=30,scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
kare = np.frombuffer(ham, np.uint8).reshape(-1, H, W).astype(np.float32)
b = int(W * g.boy); x0 = int(W * g.x - b / 2); y0 = int(H * g.y - b / 3)
agiz = kare[:, y0:y0 + int(b * 0.66), x0:x0 + b]
hareket = np.r_[0, np.abs(np.diff(agiz, axis=0)).mean((1, 2))]
a, sr = sf.read(g.ses, dtype="float32"); a = a.mean(1) if a.ndim > 1 else a
a = a[int(g.bas * sr):]
n = len(kare); adim = sr / 30
enerji = np.array([np.sqrt((a[int(i * adim):int((i + 1) * adim)] ** 2).mean()) if int((i + 1) * adim) <= len(a) else 0 for i in range(n)])
enerji = np.r_[0, np.abs(np.diff(enerji))]  # ses değişimi ~ ağız açılıp kapanması
z = lambda v: (v - v.mean()) / (v.std() + 1e-9)
h, e = z(hareket), z(enerji)
en = max(range(-9, 10), key=lambda L: np.mean(h[max(0, L):n + min(0, L)] * e[max(0, -L):n - max(0, L)]))
kor = np.mean(h[max(0, en):n + min(0, en)] * e[max(0, -en):n - max(0, en)])
print(f"gecikme {en * 1000 / 30:+.0f} ms (görüntü {'geç' if en > 0 else 'erken'}), korelasyon {kor:.2f}")
