"""Cümle cümle üretilmiş sesten (NN-MM.wav) zaman çizelgesi ve tek anlatım dosyası çıkarır.

Kullanım: .venv/Scripts/python scripts/zaman-yap.py assets/<ad> [--ses]
- assets/<ad>/anlatim.txt: satır = bölüm, '|' = cümle.
- assets/<ad>/ses-ham/NN-MM.wav varsa süresi ondan, yoksa kelime sayısından tahmin (0,42 sn/kelime + 0,3).
- Çıktı assets/<ad>/zaman.json: {fps, toplamSn, tahmini, bolumler:[{no, bas, son, cumleler:[{no, metin, bas, son}]}]}
- --ses: tüm cümleler hazırsa hafif temizleme zinciriyle işleyip assets/<ad>/anlatim.wav yazar.
Tempo 1,0; kalınlaştırma yok (7 Kas 2026). Boşluk: cümle arası 0,35 sn, bölüm arası 2 sn, baş 0,6 sn, son 2,5 sn.
"""
import json
import os
import subprocess
import sys

import soundfile as sf

sys.stdout.reconfigure(encoding="utf-8")
KOK = sys.argv[1].rstrip("/")
SES = "--ses" in sys.argv
CUMLE_ARA, BOLUM_ARA, BAS, SON, TEMPO = 0.35, 2.0, 0.6, 2.5, 1.0
# 7 Kas 2026: yeni klon (Kayit 2, "Deneme-2"). Kalinlastirma YOK; Efe eski zinciri boguk buldu.
ZINCIR = ("highpass=f=70,equalizer=f=3500:t=q:w=1:g=2,"
          "acompressor=threshold=-20dB:ratio=2.5:attack=10:release=150:makeup=1.5")

satirlar = [s.strip() for s in open(f"{KOK}/anlatim.txt", encoding="utf-8") if s.strip()]
t = BAS
bolumler, tahmini, dosyalar = [], False, []
for i, satir in enumerate(satirlar, 1):
    cumleler = []
    bb = t
    for j, metin in enumerate([c.strip() for c in satir.split("|") if c.strip()], 1):
        yol = f"{KOK}/ses-ham/{i:02d}-{j:02d}.wav"
        if os.path.exists(yol):
            sure = sf.info(yol).duration / TEMPO
        else:
            sure, tahmini = (0.46 * len(metin.split()) + 0.2) / TEMPO, True
        cumleler.append({"no": j, "metin": metin, "bas": round(t, 3), "son": round(t + sure, 3)})
        dosyalar.append((yol, t))
        t += sure + CUMLE_ARA
    t += BOLUM_ARA - CUMLE_ARA
    bolumler.append({"no": i, "bas": round(bb, 3), "son": round(cumleler[-1]["son"], 3), "cumleler": cumleler})
toplam = round(t - BOLUM_ARA + SON, 3)
json.dump({"fps": 30, "toplamSn": toplam, "tahmini": tahmini, "bolumler": bolumler},
          open(f"{KOK}/zaman.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"zaman.json: {toplam / 60:.1f} dk, {len(dosyalar)} cümle, tahmini={tahmini}")

if SES:
    if tahmini:
        sys.exit("ses eksik cümle var, anlatim.wav yazılmadı")
    import numpy as np
    sr = 48000
    tam = np.zeros(int(toplam * sr) + sr, dtype=np.float32)
    for yol, bas in dosyalar:
        ham = subprocess.run(["ffmpeg", "-v", "error", "-i", yol, "-af", ZINCIR, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                             capture_output=True, check=True).stdout
        a = np.frombuffer(ham, dtype=np.float32)
        k = int(bas * sr)
        tam[k:k + len(a)] += a[: len(tam) - k]
    gecici = f"{KOK}/anlatim-ham.wav"
    sf.write(gecici, tam[: int(toplam * sr)], sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", gecici, "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", str(sr),
                    f"{KOK}/anlatim.wav"], check=True)
    os.remove(gecici)
    print("anlatim.wav yazıldı")
