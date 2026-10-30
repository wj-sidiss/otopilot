"""Kendi sesinle metin okutur (VoxCPM2, ses klonlama). SADECE kendi sesin ya da yazılı izin verilen ses için.

Kullanım: .venv/Scripts/python seslendir.py metin.txt cikti.wav --ornek ornek.wav --ornek-metin "örnek kayıtta söylenen cümle"
- Metin satır satır okunur; her satır ayrı üretilip aralarına kısa sessizlik konur.
"""
import argparse
import os
import sys

import numpy as np
import soundfile as sf

sys.stdout.reconfigure(encoding="utf-8")

ap = argparse.ArgumentParser()
ap.add_argument("metin")
ap.add_argument("cikti")
ap.add_argument("--ornek", required=True)
ap.add_argument("--ornek-metin", required=True)
ap.add_argument("--bosluk", type=float, default=0.25)
g = ap.parse_args()

import torch
import torchaudio


# torchaudio.load Windows'ta torchcodec DLL'ini yükleyemiyor; sesi soundfile ile oku
def _yukle(yol, *a, **k):
    veri, oran = sf.read(yol, dtype="float32", always_2d=True)
    return torch.from_numpy(veri.T.copy()), oran


torchaudio.load = _yukle
# Modeli ağırlıksız olarak doğrudan ekran kartında bf16 kur (32 bit işlemci kurulumu çöküyordu);
# ağırlıkları sonra tek tek kopyala: 4,6 GB'ı topluca belleğe almak Windows'ta kartın ayırmasını da düşürüyordu
import glob
import voxcpm.model.voxcpm2 as _v2

_YOL = glob.glob(os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub", "models--openbmb--VoxCPM2", "snapshots", "*", "model.safetensors"))[0]
_v2.load_file = lambda yol, *a, **k: {}
torch.set_default_dtype(torch.bfloat16)
torch.set_default_device("cuda")

from voxcpm import VoxCPM

model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, optimize=False)
# Kurulum bitti: üretim sırasında varsayılan cihaz modu bazı işlemleri bozuyor, geri al
torch.set_default_device(None)
torch.set_default_dtype(torch.float32)
_durum = model.tts_model.state_dict()
# safe_open dosyayı belleğe eşliyor, sayfa dosyası küçük olunca düşüyor (os error 1455): başlığı oku, her tensörü ayrı oku
import json
import struct

_TIP = {"BF16": torch.bfloat16, "F16": torch.float16, "F32": torch.float32}
with torch.no_grad(), open(_YOL, "rb") as f:
    _uzun = struct.unpack("<Q", f.read(8))[0]
    _baslik = json.loads(f.read(_uzun))
    for ad, bilgi in _baslik.items():
        if ad == "__metadata__":
            continue
        bas, son = bilgi["data_offsets"]
        f.seek(8 + _uzun + bas)
        veri = torch.frombuffer(bytearray(f.read(son - bas)), dtype=_TIP[bilgi["dtype"]]).reshape(bilgi["shape"])
        _durum[ad].copy_(veri)
del _durum
torch.cuda.empty_cache()
sr = model.tts_model.sample_rate
parcalar = []
for satir in [s.strip() for s in open(g.metin, encoding="utf-8") if s.strip()]:
    ses = model.generate(text=satir, prompt_wav_path=g.ornek, prompt_text=g.ornek_metin, reference_wav_path=g.ornek, cfg_value=2.0, inference_timesteps=10)
    parcalar += [ses, np.zeros(int(sr * g.bosluk), dtype=ses.dtype)]
    print(f"{len(ses) / sr:.1f} sn · {satir[:50]}", flush=True)
sf.write(g.cikti, np.concatenate(parcalar), sr)
print("bitti:", g.cikti)
