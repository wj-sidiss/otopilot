#!/usr/bin/env node
// 3B MODEL BUL: acik lisansli 3B modeller (Poly Haven CC0, NASA kamu mali, Smithsonian Open Access, Sketchfab CC0/CC BY).
//   node model-bul.js ara "ship" [--kaynak polyhaven,nasa,smithsonian,sketchfab] [--sayi 8]
//   node model-bul.js indir 3 [--arama "ship"] [--is <studyo-isi>] [--cozunurluk 1k|2k]
//   node model-bul.js kaynaklar
// indir: uretim/_modeller/<kaynak>-<ad>-<kod>/model.glb + KAYNAK.txt (lisans ve hazir atif). --is verilirse model studyo isinin
// girdi/ klasorune kopyalanir, atif ATIF.txt'ye eklenir; sonra: node studyo.js 3b <is> urun --glb <ad>.glb
// Ingilizce arama daha cok sonuc verir (kaynaklarin adlari Ingilizce).
"use strict";
const M = require("./lib/model-bul.js");

const ACIKLAMA = {
  polyhaven: "Poly Haven: ~520 model (mobilya, bina, araç, doğa), CC0, anahtar gerekmez",
  nasa: "NASA 3D Resources: ~260 model (uzay araçları, gezegenler, roketler), kamu malı, anahtar gerekmez",
  smithsonian: "Smithsonian 3D: müze taramaları (uçak, fosil, heykel, eşya), Open Access, anahtar gerekmez",
  sketchfab: "Sketchfab: on binlerce model; yalnız CC0 ve CC BY; indirmek için ücretsiz SKETCHFAB_TOKEN",
};

function ayristir(argv) {
  const b = {}, konum = [];
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith("--")) { const n = x.slice(2); if (["kaynak", "sayi", "arama", "is", "cozunurluk"].includes(n)) b[n] = argv[++i]; else b[n] = true; }
    else konum.push(x);
  }
  return { b, konum };
}

async function ana(argv) {
  const { b, konum } = ayristir(argv);
  const komut = konum[0];
  if (komut === "kaynaklar") { for (const k of M.KAYNAKLAR) console.log("  " + k.padEnd(12) + ACIKLAMA[k]); return 0; }
  if (komut === "ara") {
    const q = konum.slice(1).join(" ");
    const r = await M.ara(q, { kaynaklar: b.kaynak ? String(b.kaynak).split(",").map(s => s.trim()) : undefined, sayi: b.sayi });
    if (!r.sonuclar.length) console.log("  sonuç yok. İngilizce, daha genel bir kelime dene (ör. \"boat\", \"car\", \"chair\").");
    for (const x of r.sonuclar)
      console.log("  " + String(x.no).padStart(2) + ". [" + x.kaynak + "] " + x.ad + "  · " + x.lisans + (x.boyutMB ? " · " + x.boyutMB + " MB" : "") + (x.kaynak === "sketchfab" ? " · indirme anahtarı gerekir" : ""));
    r.uyarilar.forEach(u => console.log("  ! " + u));
    console.log("\n  İndir: node model-bul.js indir <no> [--is <stüdyo-işi>]");
    return 0;
  }
  if (komut === "indir") {
    const nolar = konum.slice(1).flatMap(s => String(s).split(",")).map(Number).filter(Boolean);
    if (!nolar.length) throw Object.assign(new Error("Hangi sonuç? node model-bul.js indir <no>"), { cikis: 2 });
    for (const no of nolar) {
      const r = await M.indir(no, { arama: b.arama, is: b.is, cozunurluk: b.cozunurluk });
      console.log("✓ " + r.sonuc.ad + " (" + r.boyutMB + " MB): " + r.glb);
      console.log("  lisans: " + r.sonuc.lisans + " · atıf: " + r.atif);
      if (r.kopya) console.log("  stüdyoya kopyalandı: " + r.kopya + "\n  sahne: node studyo.js 3b " + b.is + " urun --glb " + require("path").basename(r.kopya));
    }
    return 0;
  }
  console.error("Kullanım:\n  node model-bul.js ara \"ship\"\n  node model-bul.js indir 2 [--is <stüdyo-işi>]\n  node model-bul.js kaynaklar");
  return 2;
}

if (require.main === module) ana(process.argv.slice(2)).then(k => { process.exitCode = k; }, e => {
  console.error("✗ " + e.message + (e.cozum ? "\n  → " + e.cozum : ""));
  process.exitCode = e.cikis || 1;
});
module.exports = { ana };
