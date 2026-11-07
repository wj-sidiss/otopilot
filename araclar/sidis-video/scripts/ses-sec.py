"""ses-alt denetim puanı ses-ham'dan yüksekse alternatifi ses-ham'a kopyalar (eskisini ses-eski'ye taşır).

Kullanım: .venv/Scripts/python scripts/ses-sec.py assets/<ad>
"""
import json
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8")
K = sys.argv[1].rstrip("/")
ham = json.load(open(f"{K}/ses-denetim-ses-ham.json", encoding="utf-8"))
alt = json.load(open(f"{K}/ses-denetim-ses-alt.json", encoding="utf-8"))
os.makedirs(f"{K}/ses-eski", exist_ok=True)
for ad, a in sorted(alt.items()):
    h = ham.get(ad, {"oran": 0, "duyulan": ""})
    sec = a["oran"] > h["oran"]
    print(f"{ad} ham {h['oran']:.2f} alt {a['oran']:.2f} -> {'ALT' if sec else 'ham'} | {a['duyulan'] if sec else h['duyulan']}")
    if sec:
        shutil.move(f"{K}/ses-ham/{ad}.wav", f"{K}/ses-eski/{ad}.wav")
        shutil.copy(f"{K}/ses-alt/{ad}.wav", f"{K}/ses-ham/{ad}.wav")
        ham[ad] = a
json.dump(ham, open(f"{K}/ses-denetim-ses-ham.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
