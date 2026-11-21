#!/usr/bin/env node
// SHA256 dogrulamasi.
//   node araclar/sha256.js              depodaki ikili dosyalari (ses ornekleri, fontlar, PDF, gorseller) SHA256SUMS'a karsi dogrular
//   node araclar/sha256.js --yaz        SHA256SUMS'u yeniden yazar (ikili dosya ekleyip/degistirdikten sonra; kapi farki yakalar)
//   node araclar/sha256.js --modeller   kurulu VoxCPM2 modelini ve motorunu data/model-sha256.json'daki sabit degerlere karsi dogrular
//                                      (ilk sefer ~3 GB okunur, 10-30 sn; sonra boyut+tarih ayniysa onbellekten)
//   ... --hizli                         modelde yalniz boyut kontrolu (saniyeler)
//   ... --json                          makine okur cikti
// Cikis: 0 dogru · 1 uyusmazlik/eksik · 2 kurulum yok / girdi hatasi
// Elle dogrulama (Otopilot olmadan): Windows `certutil -hashfile <dosya> SHA256`, macOS/Linux `shasum -a 256 -c SHA256SUMS`.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const B = require(path.join(__dirname, "..", "lib", "butunluk.js"));

const KOK = path.join(__dirname, "..");
const SUMS = path.join(KOK, "SHA256SUMS");
// Kapsam: incelemesi zor (diff'te okunmayan) IKILI dosyalar. Metin dosyalari kapsam disi: Windows'ta git satir sonunu
// (CRLF) degistirebilir ve sha256 bosuna tutmaz; onlari git kendi ozetiyle zaten korur.
const KAPSAM = /\.(wav|flac|mp3|ogg|m4a|png|jpe?g|gif|webp|ico|ttf|otf|woff2?|pdf|gguf|onnx|bin|zip|exe|dll|wasm|glb|gltf)$/i;

function kapsamDosyalari() {
  const cikti = execFileSync("git", ["ls-files", "-z"], { cwd: KOK, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return cikti.split("\0").filter(Boolean).filter(f => KAPSAM.test(f) && fs.existsSync(path.join(KOK, f))).sort();
}

async function yaz() {
  const liste = [];
  for (const yol of kapsamDosyalari()) liste.push({ yol, sha: await B.sha256Dosya(path.join(KOK, yol)) });
  fs.writeFileSync(SUMS, B.sumsYaz(liste));
  return liste;
}

// -> { tamam, hatali, eksik, yeni }  yeni = kapsamda olup SHA256SUMS'ta olmayan dosyalar
async function depoDogrula() {
  if (!fs.existsSync(SUMS)) return { hata: "SHA256SUMS yok (node araclar/sha256.js --yaz)" };
  const liste = B.sumsCoz(fs.readFileSync(SUMS, "utf8"));
  const s = await B.sumsDogrula(KOK, liste);
  let kapsam = [];
  try { kapsam = kapsamDosyalari(); } catch (e) { /* git yok (ZIP indirmesi): yalniz listedekiler dogrulanir */ }
  const bilinen = new Set(liste.map(x => x.yol));
  s.yeni = kapsam.filter(f => !bilinen.has(f));
  return s;
}

function modelListesi() { return JSON.parse(fs.readFileSync(path.join(KOK, "data", "model-sha256.json"), "utf8")); }

// -> { kurulu:bool, neden?, sonuclar:[{ad, yol, durum: dogru|yanlis|boyut-yanlis|boyut-dogru|bilinmeyen-surum|yok, beklenen, gelen}] }
async function modelDogrula(o) {
  const a = o || {};
  const ortak = require(path.join(KOK, "lib", "ortak.js"));
  const k = require(path.join(KOK, "lib", "ses-motor-voxcpm.js")).kurulumDenetle(a.env || ortak.envOku);
  if (!k.ok) return { kurulu: false, neden: k.neden, sonuclar: [] };
  const backend = String(k.ayar.backend || "cuda").toLowerCase();
  const tanim = modelListesi().voxcpm2.dosyalar;
  const ob = path.join(KOK, "uretim", ".sha256-onbellek.json");
  const sonuclar = [];
  for (const alan of ["model", "motor"]) {
    const v = String(k.ayar[alan] || "");
    const yol = path.isAbsolute(v) ? v : path.resolve(path.dirname(k.ayarDosyasi), v);
    const adaylar = tanim.filter(t => t.ayar === alan && (!t.backend || t.backend === backend));
    const t = adaylar[0];
    if (!t) continue;
    if (!fs.existsSync(yol)) { sonuclar.push({ ad: t.ad, yol, durum: "yok" }); continue; }
    const boyut = fs.statSync(yol).size;
    if (t.boyut && boyut !== t.boyut) { sonuclar.push({ ad: t.ad, yol, durum: "boyut-yanlis", beklenen: t.boyut, gelen: boyut }); continue; }
    if (a.hizli) { sonuclar.push({ ad: t.ad, yol, durum: t.boyut ? "boyut-dogru" : "atlandi" }); continue; }
    const { sha } = await B.sha256Onbellekli(yol, ob);
    if (sha === t.sha256) sonuclar.push({ ad: t.ad, yol, durum: "dogru", beklenen: t.sha256, gelen: sha });
    else if (alan === "motor") sonuclar.push({ ad: t.ad, yol, durum: "bilinmeyen-surum", beklenen: t.sha256, gelen: sha, not: t.not || "" });
    else sonuclar.push({ ad: t.ad, yol, durum: "yanlis", beklenen: t.sha256, gelen: sha });
  }
  return { kurulu: true, backend, sonuclar };
}

const ISARET = { dogru: "✔", "boyut-dogru": "✔", atlandi: "·", "bilinmeyen-surum": "!", yanlis: "✗", "boyut-yanlis": "✗", yok: "✗" };
async function main(argv) {
  const json = argv.includes("--json");
  if (argv.includes("--yaz")) {
    const l = await yaz();
    if (!json) console.log(`SHA256SUMS yazıldı: ${l.length} dosya`);
    return 0;
  }
  if (argv.includes("--modeller")) {
    const r = await modelDogrula({ hizli: argv.includes("--hizli") });
    if (json) { console.log(JSON.stringify(r, null, 2)); return r.kurulu ? (r.sonuclar.some(x => ["yanlis", "boyut-yanlis", "yok"].includes(x.durum)) ? 1 : 0) : 2; }
    if (!r.kurulu) { console.log("VoxCPM2 kurulu değil, doğrulanacak model yok: " + r.neden); return 2; }
    for (const x of r.sonuclar) {
      console.log(`  ${ISARET[x.durum] || "?"} ${x.ad}: ${x.durum}`);
      console.log(`      ${x.yol}`);
      if (x.durum === "yanlis") console.log("      → dosya bozuk ya da değiştirilmiş: sil ve kur.ps1'i yeniden çalıştır (sha256'yı indirirken doğrular)");
      if (x.durum === "boyut-yanlis") console.log(`      → boyut ${x.gelen}, beklenen ${x.beklenen}: eksik inmiş ya da farklı dosya; kur.ps1'i yeniden çalıştır`);
      if (x.durum === "bilinmeyen-surum") console.log("      → bu motor sabitlenen sürüm değil (kaynaktan derlendiyse normal). " + (x.not || ""));
    }
    return r.sonuclar.some(x => ["yanlis", "boyut-yanlis", "yok"].includes(x.durum)) ? 1 : 0;
  }
  const s = await depoDogrula();
  if (s.hata) { console.log(s.hata); return 2; }
  if (json) console.log(JSON.stringify(s, null, 2));
  else {
    console.log(`SHA256SUMS: ${s.tamam.length} dosya doğru`);
    for (const h of s.hatali) console.log(`  ✗ ${h.yol}  (beklenen ${h.beklenen.slice(0, 12)}…, gelen ${h.gelen.slice(0, 12)}…)`);
    for (const e of s.eksik) console.log(`  ✗ eksik: ${e}`);
    for (const y of s.yeni) console.log(`  ! listede yok: ${y}  (node araclar/sha256.js --yaz)`);
  }
  return s.hatali.length || s.eksik.length || s.yeni.length ? 1 : 0;
}
if (require.main === module) main(process.argv.slice(2)).then(k => { process.exitCode = k; }).catch(e => { console.error("HATA " + e.message); process.exitCode = 2; });
module.exports = { main, yaz, depoDogrula, modelDogrula, kapsamDosyalari, KAPSAM };
