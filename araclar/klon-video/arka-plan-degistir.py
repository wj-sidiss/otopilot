"""Konuşan kişiyi her karede arka plandan ayırıp yeni bir arka planın önüne koyar (rembg, u2net_human_seg).

Kullanım:
  .venv/Scripts/python scripts/arka-plan-degistir.py girdi.mp4 cikti.mp4 [--arka arka.jpg] [--genislik 720] [--ses ses.wav]

- --arka verilmezse koyu lacivert zemin + mor/pembe neon ışık süzmesi çizilir.
- Kenarlar 2 piksel yumuşatılır; ses verilirse çıktıya eklenir.
"""
import argparse
import glob
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")


def neon_arka(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    img = np.zeros((h, w, 3), np.float32)
    img[:] = (9, 15, 36)
    for cx, cy, r, renk in [(0.15 * w, 0.2 * h, 0.75 * w, (255, 79, 163)), (0.95 * w, 0.75 * h, 0.8 * w, (37, 116, 245)), (0.5 * w, 1.05 * h, 0.6 * w, (123, 108, 255))]:
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
        k = np.clip(1 - d, 0, 1) ** 2 * 0.55
        img += k[..., None] * np.array(renk, np.float32)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("girdi")
    ap.add_argument("cikti")
    ap.add_argument("--arka")
    ap.add_argument("--genislik", type=int, default=720)
    ap.add_argument("--ses")
    g = ap.parse_args()
    from rembg import new_session, remove
    oturum = new_session("u2net_human_seg")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", g.girdi, "-vf", f"scale={g.genislik}:-2", os.path.join(tmp, "%05d.png")], check=True)
        kareler = sorted(glob.glob(os.path.join(tmp, "*.png")))
        w, h = Image.open(kareler[0]).size
        arka = Image.open(g.arka).convert("RGB").resize((w, h)) if g.arka else neon_arka(w, h)
        os.makedirs(os.path.join(tmp, "o"), exist_ok=True)
        for i, k in enumerate(kareler):
            kare = Image.open(k).convert("RGB")
            maske = remove(kare, session=oturum, only_mask=True).filter(ImageFilter.GaussianBlur(1.2))
            Image.composite(kare, arka, maske).save(os.path.join(tmp, "o", f"{i + 1:05d}.jpg"), quality=92)
            if i % 30 == 0:
                print(f"{i + 1}/{len(kareler)}", flush=True)
        fps = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", g.girdi], capture_output=True, text=True).stdout.strip().strip(",").split(",")[0]
        komut = ["ffmpeg", "-v", "error", "-y", "-framerate", fps, "-i", os.path.join(tmp, "o", "%05d.jpg")]
        if g.ses:
            komut += ["-i", g.ses, "-c:a", "aac", "-b:a", "192k", "-shortest"]
        komut += ["-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", g.cikti]
        subprocess.run(komut, check=True)
    print("bitti:", g.cikti)


if __name__ == "__main__":
    main()
