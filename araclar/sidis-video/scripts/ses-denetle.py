"""Cümle seslerini Whisper ile döküp metinle karşılaştırır; benzerliği düşük olanları listeler.

Kullanım: .venv/Scripts/python scripts/ses-denetle.py assets/<ad> [esik=0.82]
Çıktı: assets/<ad>/ses-denetim.json  {"NN-MM": {"metin", "duyulan", "oran"}} ve ekrana kötüler.
"""
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
KOK = sys.argv[1].rstrip("/")
ESIK = float(sys.argv[2]) if len(sys.argv) > 2 else 0.82
DIZIN = sys.argv[3] if len(sys.argv) > 3 else "ses-ham"
from faster_whisper import WhisperModel

m = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=6)


def sade(s):
    s = s.lower().replace("â", "a").replace("î", "i").replace("û", "u")
    return re.sub(r"[^a-zçğıöşü0-9 ]", " ", s).split()


satirlar = [s.strip() for s in open(f"{KOK}/anlatim.txt", encoding="utf-8") if s.strip()]
sonuc, kotu = {}, []
for i, satir in enumerate(satirlar, 1):
    for j, metin in enumerate([c.strip() for c in satir.split("|") if c.strip()], 1):
        ad = f"{i:02d}-{j:02d}"
        yol = f"{KOK}/{DIZIN}/{ad}.wav"
        if not os.path.exists(yol):
            continue
        a = subprocess.run(["ffmpeg", "-v", "error", "-i", yol, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
        seg, _ = m.transcribe(np.frombuffer(a, np.float32), language="tr", beam_size=5)
        duyulan = " ".join(x.text for x in seg).strip()
        oran = difflib.SequenceMatcher(None, sade(metin), sade(duyulan)).ratio()
        sonuc[ad] = {"metin": metin, "duyulan": duyulan, "oran": round(oran, 3)}
        if oran < ESIK:
            kotu.append(ad)
            print(f"{ad} {oran:.2f} | {metin} || {duyulan}", flush=True)
json.dump(sonuc, open(f"{KOK}/ses-denetim-{DIZIN}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("KOTU:", ",".join(kotu))
