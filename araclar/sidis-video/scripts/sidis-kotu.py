"""ses-denetim-ses-ham.json'dan gerçekten bozuk cümleleri seçer (rakamlar yazıya çevrilir, harf düzeyinde karşılaştırma). Çıktı: assets/sidis-uzun/kotu.txt"""
import difflib, json, re, sys
from num2words import num2words
sys.stdout.reconfigure(encoding="utf-8")
K = "assets/sidis-uzun"
d = json.load(open(f"{K}/ses-denetim-ses-ham.json", encoding="utf-8"))
def sade(s):
    s = s.lower().replace("â", "a").replace("î", "i").replace("û", "u")
    s = re.sub(r"(\d+),(\d+)", lambda m: m.group(1) + " buçuk", s)
    s = re.sub(r"\d+", lambda m: " " + num2words(int(m.group()), lang="tr") + " ", s)
    return "".join(re.sub(r"[^a-zçğıöşü ]", " ", s).split())
kotu = []
for k, v in sorted(d.items()):
    r = difflib.SequenceMatcher(None, sade(v["metin"].replace("W.J.", "dabılyu cey")), sade(v["duyulan"])).ratio()
    if r < 0.85:
        kotu.append(k); print(k, round(r, 2), "|", v["metin"], "||", v["duyulan"])
        d[k]["oran"] = round(r, 3)
json.dump(d, open(f"{K}/ses-denetim-ses-ham.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open(f"{K}/kotu.txt", "w").write(",".join(kotu)); print("KOTU", len(kotu))
