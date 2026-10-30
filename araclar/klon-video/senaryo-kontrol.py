"""Videonun sesini yazıya döküp senaryoyla kelime kelime karşılaştırır; eksik, fazla ve TEKRAR eden kelimeyi bulur.

Kullanım: python senaryo-kontrol.py video.mp4 senaryo.txt [--model small]
- Yapay zekâ konuşan klipler araya kelime ekleyebilir ya da tekrarlayabilir ("video, video"); teslimden önce çalıştır.
- Çıkış kodu 0 = eşleşme %100 ve tekrar yok, 1 = fark var.
- Bilgi: Whisper kısa/sesli ifadelerde de yanılabilir; farkı kulakla da doğrula.
"""
import argparse
import difflib
import re
import subprocess
import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")


def norm(k):
    return re.sub(r"[^a-zçğıöşü0-9]", "", k.lower().replace("â", "a").replace("İ", "i"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("senaryo")
    ap.add_argument("--model", default="small")
    ap.add_argument("--dil", default="tr")
    g = ap.parse_args()
    from faster_whisper import WhisperModel
    ham = subprocess.run(["ffmpeg", "-v", "error", "-i", g.video, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
    ses = np.frombuffer(ham, dtype=np.float32)
    try:   # ekran kartı kütüphaneleri yoksa (cublas) işlemciye düş
        seg, _ = WhisperModel(g.model, device="auto", compute_type="int8").transcribe(ses, language=g.dil)
        duyulan = [w for s in seg for w in s.text.split()]
    except RuntimeError:
        seg, _ = WhisperModel(g.model, device="cpu", compute_type="int8").transcribe(ses, language=g.dil)
        duyulan = [w for s in seg for w in s.text.split()]
    beklenen = open(g.senaryo, encoding="utf-8").read().split()
    sm = difflib.SequenceMatcher(None, [norm(x) for x in duyulan], [norm(x) for x in beklenen], autojunk=False)
    print(f"eşleşme %{sm.ratio() * 100:.0f}")
    sorun = sm.ratio() < 0.999
    for tag, a0, a1, b0, b1 in sm.get_opcodes():
        if tag != "equal":
            print(f"  {tag}: duyulan={duyulan[a0:a1]} beklenen={beklenen[b0:b1]}"); sorun = True
    for a, b in zip(duyulan, duyulan[1:]):
        if norm(a) == norm(b):
            print("  TEKRAR:", a, b); sorun = True
    sys.exit(1 if sorun else 0)


if __name__ == "__main__":
    main()
