// "Yapay zeka gibi" kalip kontrolu (ucretsiz, yerel): senaryoda/anlatimda "oyun degisti", "Here's the thing" gibi kaliplari bulur.
//   node ai-kalip-kontrol.js <is>                  uretim/<is>/Voice/SESLENDIRME-TAM-METIN.txt (dil: konu.json)
//   node ai-kalip-kontrol.js <dosya.txt> --dil tr  herhangi bir metin dosyasi
//   node ai-kalip-kontrol.js --kancalar tr         o dilin kanca (ilk cumle) kaliplari
// Cikis: 0 temiz · 1 kalip bulundu (uyari; metin degismez) · 2 girdi/ayar. Liste: data/ai-kaliplari.json (kaynak: motionforge, MIT).
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");
const K = require("./lib/ai-kalip.js");

function ana(args) {
  const i = args.indexOf("--dil"), dilArg = i >= 0 ? args[i + 1] : "";
  if (args[0] === "--kancalar") { for (const k of K.kancalar(args[1] || dilArg || "en")) console.log("  " + k); return 0; }
  const hedef = args.find((a, j) => !a.startsWith("--") && args[j - 1] !== "--dil");
  if (!hedef) { console.error("Kullanım: node ai-kalip-kontrol.js <iş-adı | dosya.txt> [--dil tr]"); return 2; }
  let dosya = hedef, dil = dilArg;
  if (!fs.existsSync(dosya)) {
    const d = ortak.isDizin(hedef);
    dosya = path.join(d, "Voice", "SESLENDIRME-TAM-METIN.txt");
    if (!fs.existsSync(dosya)) { console.error("✗ Metin yok: " + dosya); return 2; }
    if (!dil) { const konu = ortak.jsonOku(path.join(d, "konu.json"), {}) || {}; dil = konu.dil || ""; }
  }
  const bulunan = K.kalipBul(fs.readFileSync(dosya, "utf8"), dil || "en");
  if (!bulunan.length) { console.log("✓ Yapay zekâ kalıbı bulunmadı (" + K.dilKodu(dil || "en") + ")."); return 0; }
  console.log("! " + bulunan.length + " yapay zekâ kalıbı (" + K.dilKodu(dil || "en") + "): metni somut gerçekle (araç adı, rakam, ne değişti) yeniden yaz.");
  for (const b of bulunan) console.log("  satır " + b.satir + ": \"" + b.parca + "\"  ← " + b.kalip);
  return 1;
}

if (require.main === module) process.exitCode = ana(process.argv.slice(2));
module.exports = { ana };
