#!/usr/bin/env node
// Donanim raporu: bu makinede ne olculdu, hangi profil secildi, hangi ozellik acik/kapali.
//   node araclar/donanim.js          okunur rapor
//   node araclar/donanim.js --json   makine okur (hata bildirimlerine eklenebilir: kisisel veri yok, yalniz donanim)
// Esikler ve profillerin anlami: docs/DUSUK_DONANIM.md
"use strict";
const path = require("path");
const donanim = require(path.join(__dirname, "..", "lib", "donanim.js"));
let envOku = n => process.env[n];
try { envOku = require(path.join(__dirname, "..", "lib", "ortak.js")).envOku; } catch (e) { /* ortak yuklenemezse ortam degiskeni */ }

function rapor(argv) {
  const d = donanim.olc();
  const p = donanim.profilSec(d, envOku);
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ donanim: d, profil: { ad: p.ad, neden: p.neden, renderBellek: p.renderBellek, paralelMax: p.paralelMax, voxcpm: p.voxcpm } }, null, 2));
    return 0;
  }
  console.log("\nDonanım");
  console.log(`  İşlemci : ${d.cpu.ad || "?"} (${d.cpu.cekirdek} çekirdek)`);
  console.log(`  Bellek  : ${d.ram.toplamGB} GB (boş ${d.ram.bosGB} GB)`);
  if (!d.kartlar.length) console.log("  Ekran kartı: bulunamadı (sorun değil: ana hat işlemciyle çalışır)");
  for (const k of d.kartlar) {
    const vram = k.vramGB == null ? "bellek bilinmiyor" : `${k.vramGB} GB${k.vramKesin ? "" : " (yaklaşık; Windows 4 GB üstünü doğru göstermez)"}`;
    console.log(`  Ekran kartı: ${k.ad} — ${vram}${k.bosVramGB != null ? `, boş ${k.bosVramGB} GB` : ""}${k.surucu ? `, sürücü ${k.surucu}` : ""}`);
  }
  console.log(`\nProfil: ${p.ad.toUpperCase()}  (${p.neden})`);
  for (const s of p.ozet) console.log("  · " + s);
  console.log("\nEzmek için .env: DONANIM_PROFIL=cok-dusuk|dusuk|orta|yuksek · VOXCPM_ZORLA=1 · RENDER_DUSUK_BELLEK=0|1|2  (ayrıntı: docs/DUSUK_DONANIM.md)");
  return 0;
}
if (require.main === module) process.exitCode = rapor(process.argv.slice(2));
module.exports = { rapor };
