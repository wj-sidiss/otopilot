// Ceviri katalogunu (diller/<kod>.json) uygulamalara dagitir ve parcali ceviri ciktilarini katalogda birlestirir.
//   node lib/dil-yay.js                         -> her uygulamanin public/diller/<kod>.js dosyasini yeniden uretir
//   node lib/dil-yay.js --birlestir <klasor>    -> <klasor>/<kod>-<n>.json parcalarini dogrulayip diller/<kod>.json'a ekler, sonra yayar
// Dogrulama (birlestirirken): bos ceviri, yer tutucu kaybi («», <>, {}, `kod`, sayilar, .env/komut adlari) ve anlamsiz uzunluk reddedilir;
// reddedilen metin icin ceviri YAZILMAZ (Turkce kaynak gorunur) ve sayilir.
"use strict";
const fs = require("fs");
const path = require("path");
const { cikarDizin, KAYNAKLAR, DILLER } = require("./dil-cikar.js");

const KOK = path.join(__dirname, "..");
const DILLER_DIZINI = path.join(KOK, "diller");

function katalogOku(kod) {
  try { return JSON.parse(fs.readFileSync(path.join(DILLER_DIZINI, kod + ".json"), "utf8")); } catch (e) { return {}; }
}

// kaynaktaki "korunmasi gereken" parcalar (yer tutucu, kod, komut, ortam anahtari, sayi). «dugme adi» KORUNMAZ:
// tirnak ici ad baska bir arayuz metnidir ve o da cevrilir (Sil -> Delete); tirnak isareti dilin kendi bicimini alabilir.
function korunacaklar(kaynak) {
  const r = [];
  for (const m of kaynak.match(/<[^>]+>|\{[^}]*\}|`[^`]*`|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b\d+(?:[.,]\d+)?\b/g) || []) r.push(m);
  return r;
}
function gecerliMi(kaynak, ceviri) {
  if (typeof ceviri !== "string" || !ceviri.trim()) return "bos";
  if (ceviri.length > kaynak.length * 6 + 40) return "cok uzun";
  for (const k of korunacaklar(kaynak)) {
    if (/^\d/.test(k)) continue;                       // sayilar yazi dilinde (٣, 三) degisebilir: zorunlu degil
    if (!ceviri.includes(k)) return "korunacak parca kayip: " + k;
  }
  return "";
}

function birlestir(klasor) {
  const sonuc = {};
  for (const kod of DILLER) {
    const kat = katalogOku(kod);
    let eklenen = 0, red = 0;
    const redler = [];
    for (const f of fs.readdirSync(klasor).filter(x => x.startsWith(kod + "-") && x.endsWith(".json")).sort()) {
      let parca;
      try { parca = JSON.parse(fs.readFileSync(path.join(klasor, f), "utf8")); } catch (e) { redler.push(f + ": JSON bozuk"); continue; }
      for (const [k, v] of Object.entries(parca)) {
        const neden = gecerliMi(k, v);
        if (neden) { red++; if (redler.length < 5) redler.push(k.slice(0, 40) + " → " + neden); continue; }
        if (kat[k] !== v) eklenen++;
        kat[k] = String(v).trim();
      }
    }
    fs.mkdirSync(DILLER_DIZINI, { recursive: true });
    fs.writeFileSync(path.join(DILLER_DIZINI, kod + ".json"), JSON.stringify(Object.fromEntries(Object.entries(kat).sort(([a], [b]) => a.localeCompare(b))), null, 1));
    sonuc[kod] = { eklenen, red, ornek: redler };
  }
  return sonuc;
}

function yay() {
  const rapor = {};
  for (const d of KAYNAKLAR) {
    const kaynaklar = cikarDizin(d);
    const hedef = path.join(KOK, d, "diller");
    fs.mkdirSync(hedef, { recursive: true });
    for (const kod of DILLER) {
      const kat = katalogOku(kod), t = {};
      for (const k of kaynaklar) if (kat[k] && kat[k] !== k) t[k] = kat[k];
      const js = "window.__OTOPILOT_DIL=window.__OTOPILOT_DIL||{};window.__OTOPILOT_DIL[" + JSON.stringify(kod) + "]=" + JSON.stringify(t) + ";\n";
      fs.writeFileSync(path.join(hedef, kod + ".js"), js);
      (rapor[d] = rapor[d] || {})[kod] = Object.keys(t).length + "/" + kaynaklar.length;
    }
  }
  return rapor;
}

if (require.main === module) {
  const i = process.argv.indexOf("--birlestir");
  if (i >= 0) {
    const r = birlestir(process.argv[i + 1]);
    for (const [k, v] of Object.entries(r)) console.log(k + ": +" + v.eklenen + ", reddedilen " + v.red + (v.ornek.length ? " · " + v.ornek.join(" | ") : ""));
  }
  const r = yay();
  for (const [d, x] of Object.entries(r)) console.log(d + ": " + Object.entries(x).map(([k, v]) => k + " " + v).join(", "));
}
module.exports = { birlestir, yay, gecerliMi, korunacaklar };
