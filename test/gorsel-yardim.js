// GO testleri icin ortak yardimcilar (test dosyasi DEGIL: *.test.js degil).
// - Ortam: gercek .env / panel-ayar.json / uretim klasorune ASLA dokunmaz (OTOMASYON_* ile gecici klasore yonlendirir)
// - Sentetik gorsel: ffmpeg lavfi ile uretilir (kurulu degilse ilgili testler atlanir), tekil kopyalar ek bayt ile turetilir
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const artik = require("./artik-yardim");

const KOK = path.resolve(__dirname, "..");
// uretim/_test-gorsel-<pid>: sozlesme geregi test is klasoru; is adlari alt klasorlerdir
const KOKTEST = path.join(KOK, "uretim", "_test-gorsel-" + process.pid);
// onceki kosularin sahipsiz artiklari (surec disaridan oldurulmus, temizle calismamis): bkz. artik-yardim.js
artik.eskiArtiklariTemizle(path.join(KOK, "uretim"));
fs.mkdirSync(KOKTEST, { recursive: true });
const ENVDOSYA = path.join(KOKTEST, "_bos.env");
fs.writeFileSync(ENVDOSYA, "");
process.env.OTOMASYON_URETIM = path.join(KOKTEST, "isler");
process.env.OTOMASYON_ENV_DOSYASI = ENVDOSYA;
process.env.OTOMASYON_AYAR_DOSYASI = path.join(KOKTEST, "_ayar-yok.json");
delete process.env.PEXELS_KEY; delete process.env.PIXABAY_KEY;
fs.mkdirSync(process.env.OTOMASYON_URETIM, { recursive: true });

function temizle() {
  artik.sil(KOKTEST);      // antivirus kilidine karsi yeniden denemeli; kalirsa sonraki kosu siler
  // uretim/ bos kaldiysa (biz actiysak) dokunma; baska is varsa zaten silinmez
}

// ffmpeg var mi? (ff-yol.js bulamazsa surec oldurmez; varMi() ffmpeg + ffprobe'u gercekten cozer)
function ffmpegVarMi() { return require(path.join(KOK, "ff-yol.js")).varMi(); }
const ffmpegYolu = () => require(path.join(KOK, "ff-yol.js")).ffmpeg;

const _onbellek = new Map();
// tur: "jpg" | "png"; en/boy; tohum: icerigi degistirir
function gorselUret(tur, en, boy, tohum) {
  const k = [tur, en, boy, tohum || 0].join("x");
  if (_onbellek.has(k)) return _onbellek.get(k);
  const tmp = path.join(os.tmpdir(), "go-test-" + process.pid + "-" + crypto.randomBytes(4).toString("hex") + "." + tur);
  const arg = ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `testsrc2=s=${en}x${boy}:d=1`,
    "-vf", `noise=alls=25:allf=t:all_seed=${(tohum || 0) + 7}`, "-frames:v", "1",
    "-threads", "1"];       // tek kare icin cok is parcacigi gereksiz; az bellekli makinede paralel testlerde "Cannot allocate memory" veriyordu
  if (tur === "jpg") arg.push("-q:v", "4");
  arg.push(tmp);
  const r = spawnSync(ffmpegYolu(), arg, { stdio: "pipe", timeout: 60000 });
  if (r.status !== 0) throw new Error("ffmpeg gorsel uretemedi: " + String(r.stderr).slice(-300));
  const b = fs.readFileSync(tmp);
  try { fs.unlinkSync(tmp); } catch (e) {}
  _onbellek.set(k, b);
  return b;
}
// Ayni goruntunun BAYT olarak benzersiz kopyasi (JPEG/PNG sonuna ek bayt: baslik/boyut ayni, sha1 farkli)
const tekil = (b, n) => Buffer.concat([b, Buffer.from("\n#tekil-" + n)]);

function htmlSayfasi() { return Buffer.from("<html><body>" + "Erisim engellendi. ".repeat(400) + "</body></html>"); }

// is klasoru + senaryo (+ konu.json) kurar -> is dizini
function isKur(ad, secenek) {
  const o = secenek || {};
  const dizin = path.join(process.env.OTOMASYON_URETIM, ad);
  fs.mkdirSync(path.join(dizin, "Voice"), { recursive: true });
  if (o.senaryo !== undefined) fs.writeFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), o.senaryo, "utf8");
  if (o.konu !== undefined) fs.writeFileSync(path.join(dizin, "konu.json"), typeof o.konu === "string" ? o.konu : JSON.stringify(o.konu, null, 2), "utf8");
  return dizin;
}

// N paragraflik senaryo (her biri ~kelime kadar kelime). Kelimeler paragrafa ozgudur (otomatik arama ifadeleri
// birbirine karismasin): "terim<i>x<j>"
function senaryoUret(paragrafSayisi, kelime) {
  const l = [];
  for (let i = 0; i < paragrafSayisi; i++) {
    const k = [];
    for (let j = 0; j < (kelime || 30); j++) k.push("terim" + i + "x" + j);
    l.push(k.join(" ") + ".");
  }
  return l.join("\n\n");
}

const uyku0 = () => Promise.resolve();

module.exports = { KOK, KOKTEST, temizle, ffmpegVarMi, gorselUret, tekil, htmlSayfasi, isKur, senaryoUret, uyku0 };
