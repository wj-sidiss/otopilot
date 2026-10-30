"""Yapay zekâ kliplerinin renk/parlaklık farkını ölçüp ortak bir hedefe eşler (klipler arası "solma"yı giderir).

Kullanım: python renk-esle.py klip1.mp4 klip2.mp4 ... --cikti klasor [--canlilik 1.12]
- Her klipte ortalama parlaklık (Y), doygunluk, U/V ölçülür (ffmpeg signalstats); hedef = klip ortalamalarının ortancası.
- Düzeltme: eq (gama + doygunluk) ve lutyuv (U/V kayması). Sonra "önce -> sonra" tablosu basılır: farkı SAYIYLA gör.
"""
import argparse
import math
import os
import re
import statistics
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")


def istatistik(yol):
    cikti = subprocess.run(["ffmpeg", "-v", "error", "-i", yol, "-vf", "signalstats,metadata=print:file=-", "-f", "null", "-"], capture_output=True, text=True).stdout
    ort = {}
    for ad, anahtar in (("Y", "YAVG"), ("SAT", "SATAVG"), ("U", "UAVG"), ("V", "VAVG")):
        d = [float(x) for x in re.findall(rf"lavfi.signalstats.{anahtar}=([\d.]+)", cikti)]
        ort[ad] = sum(d) / len(d)
    return ort


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("klipler", nargs="+")
    ap.add_argument("--cikti", required=True)
    ap.add_argument("--canlilik", type=float, default=1.12)
    g = ap.parse_args()
    os.makedirs(g.cikti, exist_ok=True)
    onceki = {k: istatistik(k) for k in g.klipler}
    hedef = {m: statistics.median(o[m] for o in onceki.values()) for m in ("Y", "SAT", "U", "V")}
    print("hedef:", {k: round(v, 1) for k, v in hedef.items()})
    for k in g.klipler:
        o = onceki[k]
        gama = math.log(o["Y"] / 255) / math.log(hedef["Y"] / 255)
        sat = hedef["SAT"] / o["SAT"] * g.canlilik
        vf = f"eq=gamma={gama:.3f}:saturation={sat:.3f}:contrast=1.04,lutyuv=u='val+({hedef['U'] - o['U']:.2f})':v='val+({hedef['V'] - o['V']:.2f})'"
        cikis = os.path.join(g.cikti, os.path.basename(k))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", k, "-vf", vf, "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "copy", cikis], check=True)
        s = istatistik(cikis)
        print(f"{os.path.basename(k)}: Y {o['Y']:.1f}->{s['Y']:.1f}  SAT {o['SAT']:.1f}->{s['SAT']:.1f}  U {o['U']:.1f}->{s['U']:.1f}  V {o['V']:.1f}->{s['V']:.1f}")


if __name__ == "__main__":
    main()
