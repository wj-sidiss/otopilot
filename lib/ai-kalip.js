// "Yapay zeka gibi" duran kaliplari yakalar (senaryo, anlatim, ekran yazisi). Liste: data/ai-kaliplari.json (10 dil).
// Kaynak: motionforge (github.com/aykutucesai/motionforge, MIT, (c) 2026 motionforge contributors) skills/script-and-hooks/i18n/*.md.
// Yalniz UYARIR; metni degistirmez, engellemez. ___ ve ... kalip icinde bosluk (joker) demektir.
"use strict";
const fs = require("fs");
const path = require("path");

const VERI = path.join(__dirname, "..", "data", "ai-kaliplari.json");
const DIL_ESLE = { "pt": "pt-BR", "zh": "zh-CN" };
let onbellek = null;

function veri() {
  if (!onbellek) onbellek = JSON.parse(fs.readFileSync(VERI, "utf8"));
  return onbellek;
}
function dilKodu(d) {
  const x = String(d || "en").trim();
  if (veri().diller[x]) return x;
  const kisa = x.toLowerCase().slice(0, 2);
  return veri().diller[DIL_ESLE[kisa] || kisa] ? (DIL_ESLE[kisa] || kisa) : "en";
}
const kacis = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// kalip metni -> kucuk harfe duyarsiz regex; ___, ... ve tek harfli X/Y joker olur
// sistem diline bagli olmasin: Turkce I/i kurali elle, digerleri toLowerCase
const kucuk = (s, kod) => (kod === "tr" ? String(s).replace(/İ/g, "i").replace(/I/g, "ı") : String(s)).toLowerCase();
function kalipRegex(kalip, kod) {
  let t = String(kalip).trim().replace(/[.!?。！？]+$/u, "");
  const parcalar = t.split(/\s*(?:___|…|\.\.\.)\s*|(?<=\s)[XY](?=[\s,]|$)/u).map(p => p.replace(/^[\s,]+|[\s,]+$/g, "")).filter(Boolean);
  if (!parcalar.length) return null;
  const govde = parcalar.map(p => kacis(kucuk(p, kod)).replace(/['’]/g, "['’]").replace(/\s+/g, "\\s+")).join(".{0,40}?");
  try { return new RegExp(govde, "u"); } catch (e) { return null; }
}

// Liste disi kurallar (cinecode references/writing.md fikri): uretilmis gibi okunan yazim aliskanliklari
function ekKurallar(metin, kod) {
  const b = [];
  const satirlar = String(metin || "").split(/\r?\n/);
  let unlem = 0;
  satirlar.forEach((satir, i) => {
    if (/—|\s–\s|\s--\s/.test(satir)) b.push({ kalip: "uzun çizgi (—): virgül, nokta ya da iki nokta kullan", parca: (/—|\s–\s|\s--\s/.exec(satir) || [""])[0].trim(), satir: i + 1 });
    unlem += (satir.match(/!/g) || []).length;
    if (unlem > 2 && /!/.test(satir) && !b.some(x => /ünlem/.test(x.kalip))) b.push({ kalip: "ikiden fazla ünlem: heyecanı kelime değil noktalama taşımasın", parca: "!", satir: i + 1 });
    if (kod === "tr") { const m = /\b\S+ değil,\s+\S+/i.exec(satir); if (m) b.push({ kalip: "'X değil, Y': ilk yarı kimsenin iddia etmediği şeyi yalanlıyor, Y'yi tek başına söyle", parca: m[0].slice(0, 60), satir: i + 1 }); }
  });
  return b;
}

// metin icinde gecen yasak kaliplar: [{kalip, parca, satir}] (satir 1'den)
function kalipBul(metin, dil) {
  const kod = dilKodu(dil);
  const bulunan = [];
  const satirlar = String(metin || "").split(/\r?\n/);
  const yasak = veri().diller[kod].yasak;
  const regexler = yasak.map(k => [k, kalipRegex(k, kod)]).filter(x => x[1]);
  satirlar.forEach((satir, i) => {
    const kucukSatir = kucuk(satir, kod);
    for (const [kalip, re] of regexler) {
      const m = re.exec(kucukSatir);
      if (m) bulunan.push({ kalip, parca: m[0].slice(0, 80), satir: i + 1 });
    }
  });
  return bulunan.concat(ekKurallar(metin, kod));
}

const kancalar = dil => veri().diller[dilKodu(dil)].kancalar.slice();

module.exports = { kalipBul, kancalar, dilKodu, kalipRegex };
