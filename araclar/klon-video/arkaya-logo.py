"""Konuşan kişinin ARKASINA (duvara) parlayan bir logo koyar: kişi rembg ile ayrılır, logo kişinin altında kalır.

Kullanım:
  .venv/Scripts/python scripts/arkaya-logo.py girdi.mp4 cikti.mp4 --logo logo.png [--x 0.73] [--y 0.2] [--genislik 0.34]
- x/y logonun ortası, genislik kare genişliğine oran. Ses girdiden aynen alınır.
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("girdi")
    ap.add_argument("cikti")
    ap.add_argument("--logo", required=True)
    ap.add_argument("--x", type=float, default=0.73)
    ap.add_argument("--y", type=float, default=0.2)
    ap.add_argument("--genislik", type=float, default=0.34)
    g = ap.parse_args()
    from rembg import new_session, remove
    oturum = new_session("u2net_human_seg")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", g.girdi, os.path.join(tmp, "%05d.png")], check=True)
        kareler = sorted(glob.glob(os.path.join(tmp, "*.png")))
        w, h = Image.open(kareler[0]).size
        logo = Image.open(g.logo).convert("RGBA")
        lw = int(w * g.genislik)
        logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        # neon hissi: logonun bulanık mavi halesi + logonun kendisi
        katman = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        konum = (int(w * g.x - lw / 2), int(h * g.y - logo.height / 2))
        hale = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        hale.paste(Image.new("RGBA", logo.size, (37, 116, 245, 255)), konum, logo)
        hale = hale.filter(ImageFilter.GaussianBlur(lw * 0.06))
        katman = Image.alpha_composite(katman, Image.fromarray((np.array(hale) * np.array([1, 1, 1, 0.9])).astype(np.uint8)))
        katman.alpha_composite(logo, konum)
        os.makedirs(os.path.join(tmp, "o"), exist_ok=True)
        for i, k in enumerate(kareler):
            kare = Image.open(k).convert("RGB")
            maske = remove(kare, session=oturum, only_mask=True).filter(ImageFilter.GaussianBlur(1.2))
            arka = Image.alpha_composite(kare.convert("RGBA"), katman).convert("RGB")
            Image.composite(kare, arka, maske).save(os.path.join(tmp, "o", f"{i + 1:05d}.jpg"), quality=93)
            if i % 60 == 0:
                print(f"{i + 1}/{len(kareler)}", flush=True)
        fps = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", g.girdi], capture_output=True, text=True).stdout.strip().strip(",").split(",")[0]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", fps, "-i", os.path.join(tmp, "o", "%05d.jpg"), "-i", g.girdi, "-map", "0:v", "-map", "1:a?", "-c:a", "copy", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", g.cikti], check=True)
    print("bitti:", g.cikti)


if __name__ == "__main__":
    main()
