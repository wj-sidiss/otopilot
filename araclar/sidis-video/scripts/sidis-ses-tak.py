"""Sidis uzun videosu: yeni sesi (ses-ham/NN-MM.wav) render ETMEDEN mevcut videoya takar.

Her cümle, videonun render edildiği zaman çizelgesindeki (zaman-video.json) eski başlangıcına oturur.
Önce bütün sese hafif bir genel hız verilir (GENEL). Cümle hâlâ yerine sığmıyorsa en çok %25'e kadar ek hızlanır.
Sığmayan kısım bir sonraki cümleyi iter; kayma raporlanır.
Kullanım: .venv/Scripts/python scripts/sidis-ses-tak.py "<eski video>" "<yeni video>"
"""
import json
import subprocess
import sys

import numpy as np
import soundfile as sf

sys.stdout.reconfigure(encoding="utf-8")
K = "assets/sidis-uzun"
SR = 48000
GENEL = 1.08
ZINCIR = ("highpass=f=70,equalizer=f=3500:t=q:w=1:g=1.5,"
          "acompressor=threshold=-20dB:ratio=2.5:attack=10:release=150:makeup=1.5")
eski, yeni = sys.argv[1], sys.argv[2]


def oku(yol, tempo):
    af = f"{ZINCIR},atempo={tempo:.4f}"
    a = subprocess.run(["ffmpeg", "-v", "error", "-i", yol, "-af", af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                       capture_output=True, check=True).stdout
    return np.frombuffer(a, np.float32)


z = json.load(open(f"{K}/zaman-video.json", encoding="utf-8"))
sira = [(b["no"], c) for b in z["bolumler"] for c in b["cumleler"]]
toplam = z["toplamSn"]
tam = np.zeros(int((toplam + 3) * SR), np.float32)
imlec, kayma, ekhiz = 0.0, [], 0
for i, (bn, c) in enumerate(sira):
    yol = f"{K}/ses-ham/{bn:02d}-{c['no']:02d}.wav"
    sure = sf.info(yol).duration / GENEL
    sonraki = sira[i + 1][1]["bas"] if i + 1 < len(sira) else toplam - 0.5
    yer = sonraki - c["bas"] - 0.12
    tempo = GENEL
    if sure > yer > 0.3:
        tempo = GENEL * min(sure / yer, 1.25)
        ekhiz += 1
    a = oku(yol, tempo)
    t = max(c["bas"], imlec)
    if t > c["bas"] + 0.05:
        kayma.append((f"{bn:02d}-{c['no']:02d}", round(t - c["bas"], 2)))
    k = int(t * SR)
    tam[k:k + len(a)] += a[: len(tam) - k]
    imlec = t + len(a) / SR + 0.12
sf.write(f"{K}/anlatim-tok-ham.wav", tam[: int(toplam * SR)], SR)
print(f"{len(sira)} cümle, {ekhiz} cümle ek hızlandı, {len(kayma)} cümle kaydı; en büyük kayma",
      max([k[1] for k in kayma], default=0), "sn")
print("kaymalar:", kayma[:15])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", eski, "-i", f"{K}/anlatim-tok-ham.wav", "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                "-shortest", "-movflags", "+faststart", yeni], check=True)
print("yazıldı", yeni)
