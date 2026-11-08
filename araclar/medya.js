#!/usr/bin/env node
// Ucretsiz medya araclari (yalniz ffmpeg). Ayrinti ve atif: docs/KAYNAKLAR.md
//   node araclar/medya.js sessizlik <video|ses> [--cikti x.mp4] [--esik -35] [--sure 0.4] [--pay 0.08] [--rapor]
//        konusma kaydindaki sessiz bosluklari keser; --rapor yalniz ne keseceğini yazar
//   node araclar/medya.js sahneler <video> [--esik 0.3] [--en-az 1] [--kes <klasor>] [--json]
//        plan/sahne degisimlerini bulur (zaman damgalari); --kes her sahneyi ayri klip yapar
//   node araclar/medya.js yukselt <resim|video> [--olcek 2|3|4] [--cikti x.png]
//        lanczos + hafif keskinlestirme; REALESRGAN_KOK tanimliysa resimde Real-ESRGAN (kendi kurulumun)
// Cikis kodlari: 0 tamam, 2 girdi/ayar, 1 genel hata
"use strict";
const ortak = require("../lib/ortak");
const M = require("../lib/medya-arac");

function bayrak(argv, ad, varsayilan) { const i = argv.indexOf(ad); return i === -1 ? varsayilan : argv[i + 1]; }
const say = (v, ad) => { const n = parseFloat(v); if (!Number.isFinite(n)) throw new ortak.OrtakHata("arguman", ad + " sayı olmalı", { cikis: ortak.CIKIS.GIRDI }); return n; };

function main(argv) {
  const [komut, girdi] = argv;
  if (!komut || !girdi) {
    console.log("Kullanım:\n  node araclar/medya.js sessizlik <dosya> [--rapor] [--esik -35] [--sure 0.4] [--pay 0.08] [--cikti x]\n  node araclar/medya.js sahneler <video> [--esik 0.3] [--en-az 1] [--kes klasör] [--json]\n  node araclar/medya.js yukselt <dosya> [--olcek 2|3|4] [--cikti x]");
    return 2;
  }
  if (komut === "sessizlik") {
    const r = M.sessizlikKes(girdi, { esik: say(bayrak(argv, "--esik", -35), "--esik"), sure: say(bayrak(argv, "--sure", 0.4), "--sure"), pay: say(bayrak(argv, "--pay", 0.08), "--pay"), sadeceRapor: argv.includes("--rapor"), cikti: bayrak(argv, "--cikti", null) });
    console.log(`  ${r.once} sn → ${r.sonra} sn (${r.kesilen} sn kesildi, ${r.sessizlik} sessizlik)` + (r.cikti ? "\n  " + r.cikti : "  (yalnız rapor)"));
    return 0;
  }
  if (komut === "sahneler") {
    const r = M.sahneBul(girdi, { esik: say(bayrak(argv, "--esik", 0.3), "--esik"), enAz: say(bayrak(argv, "--en-az", 1), "--en-az"), kes: bayrak(argv, "--kes", null) });
    if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
    else { console.log(`  ${r.sahneler.length} sahne (${r.sure} sn, eşik ${r.esik})`); for (const s of r.sahneler) console.log(`  ${String(s.no).padStart(3)}  ${s.bas.toFixed(2)} → ${s.son.toFixed(2)}  (${s.sure.toFixed(2)} sn)` + (s.dosya ? "  " + s.dosya : "")); }
    return 0;
  }
  if (komut === "yukselt") {
    const r = M.yukselt(girdi, { olcek: say(bayrak(argv, "--olcek", 2), "--olcek"), cikti: bayrak(argv, "--cikti", null) });
    console.log(`  x${r.olcek} (${r.yontem}) → ${r.cikti}`); return 0;
  }
  console.error("  Bilinmeyen komut: " + komut + " (sessizlik | sahneler | yukselt)"); return 2;
}

if (require.main === module) { try { process.exitCode = main(process.argv.slice(2)); } catch (e) { ortak.bitir(e); } }
module.exports = { main };
