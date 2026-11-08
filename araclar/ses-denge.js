#!/usr/bin/env node
// Ses dengesi: bitmis videonun ses efekti/muzik patlamalarini bulur ve -14 LUFS'a hizalar. Ayrinti: lib/ses-denge.js
//   node araclar/ses-denge.js analiz <video|ses> [--esik 6]      seviye (LUFS), tepe (dBTP), LRA ve konusmanin ustune cikan patlamalar (zaman damgali)
//   node araclar/ses-denge.js duzelt <girdi> [cikti] [--esik 6] [--oran 4] [--lra 9]
//        patlamalari tutar + iki gecisli -14 LUFS hizalama; goruntu aynen kopyalanir; girdiye dokunmaz (varsayilan cikti: <ad>-dengeli.<uzanti>)
// Cikis kodlari: 0 tamam (analizde sorun yok), 1 analizde sorun var / hata, 2 girdi
"use strict";
const path = require("path");
const ortak = require("../lib/ortak");
const D = require("../lib/ses-denge");
const bayrak = (a, ad, v) => { const i = a.indexOf(ad); return i === -1 ? v : parseFloat(a[i + 1]); };
function yaz(ad, r) {
  console.log(`  ${ad}: ${r.I.toFixed(1)} LUFS · tepe ${r.TP === null ? "?" : r.TP.toFixed(1)} dBTP · LRA ${r.LRA === null ? "?" : r.LRA.toFixed(1)} LU · tipik düzey ${r.taban === null ? "?" : r.taban.toFixed(1)}`);
  for (const t of r.tepeler.slice(0, 12)) console.log(`      patlama ${t.bas.toFixed(1)}–${t.son.toFixed(1)} sn  +${t.fazlaLU} LU`);
  if (r.tepeler.length > 12) console.log(`      … ve ${r.tepeler.length - 12} patlama daha`);
}
function main(argv) {
  const [komut, girdi, cikti0] = argv;
  if (!komut || !girdi) { console.log("Kullanım:\n  node araclar/ses-denge.js analiz <dosya> [--esik 6]\n  node araclar/ses-denge.js duzelt <girdi> [çıktı] [--esik 6] [--oran 4] [--lra 9]"); return 2; }
  const esik = bayrak(argv, "--esik", 6);
  if (komut === "analiz") {
    const r = D.analiz(girdi, { esik }); yaz("ses", r);
    if (r.dengeli) console.log("  dengeli (hedef " + D.HEDEF.I + " LUFS)"); else for (const s of r.sorunlar) console.log("  ! " + s);
    return r.dengeli ? 0 : 1;
  }
  if (komut === "duzelt") {
    const cikti = cikti0 && !cikti0.startsWith("--") ? cikti0 : girdi.replace(/(\.[^.\/]+)$/, "-dengeli$1");
    const r = D.duzelt(girdi, cikti, { esik, oran: bayrak(argv, "--oran", 4), lra: bayrak(argv, "--lra", 9) });
    yaz("önce ", r.once); yaz("sonra", r.sonra); console.log("  " + r.cikti); return 0;
  }
  console.error("  Bilinmeyen komut: " + komut + " (analiz | duzelt)"); return 2;
}
if (require.main === module) { try { process.exitCode = main(process.argv.slice(2)); } catch (e) { ortak.bitir(e); } }
module.exports = { main };
