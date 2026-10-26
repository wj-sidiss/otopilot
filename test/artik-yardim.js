// test/artik-yardim.js — test is klasoru artiklarini temizler (test dosyasi DEGIL: *.test.js degil).
//
// Testler is klasorlerini uretim/_test-(render|ses|gorsel)-<pid>[-<rastgele>] altinda acar ve dosya sonunda (test.after) siler.
// Test sureci DISARIDAN oldurulunce (Ctrl+C, ajanin komut zaman asimi, bellek yetmeyip cokme) after calismaz ve klasor KALIR:
// 25 Eki 2026'da uretim/ altinda sahibi olu 3 artik (~23 MB) vardi; panel "_" ile baslayan klasorleri gizledigi icin gorunmuyordu.
// Sonraki test kosusu bunlari siler. Yalniz sahibi OLU ve ESKI (varsayilan 10 dk) olanlar: ayni anda kosan baska test dosyasinin
// (canli pid) klasorune dokunulmaz. Gercek is adlari "_" ile baslayamaz (lib/ortak.js guvenliAd), yani gercek ise de dokunulmaz.
"use strict";
const fs = require("fs");
const path = require("path");

// _test-render-1234-ab12cd | _test-ses-1234-ab12cd | _test-gorsel-1234 (gorsel-yardim son ek koymaz)
const ARTIK = /^_test-(?:render|ses|gorsel)-(\d+)(?:-[a-z0-9]*)?$/;
const ESKI_MS = 10 * 60 * 1000;

// pid yasiyor mu? kill(pid, 0) sinyal gondermez, yalniz varligi sinar. EPERM = var ama baskasinin: yasiyor say (dokunma).
function yasiyorMu(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

// Klasor sil. Windows'ta antivirus yeni yazilan mp4/jpg'yi kisa sure tutabilir: EBUSY/EPERM/ENOTEMPTY'de Node kendisi yeniden dener
// (retryDelay her denemede dogrusal artar: 6 deneme en kotu ~3 sn). Firlatmaz; klasor kaldiysa sonraki kosu yeniden dener.
function sil(yol, secenek) {
  const o = Object.assign({ maxRetries: 6, retryDelay: 150 }, secenek || {});
  try { fs.rmSync(yol, { recursive: true, force: true, maxRetries: o.maxRetries, retryDelay: o.retryDelay }); } catch (e) { /* kilitli */ }
  return !fs.existsSync(yol);
}

// uretimDizini altindaki sahipsiz test artiklarini siler -> silinen klasor adlari.
// secenek (testte sahtelenir): { yasiyorMu(pid), simdi (ms), eskiMs }
function eskiArtiklariTemizle(uretimDizini, secenek) {
  const o = Object.assign({ yasiyorMu, simdi: Date.now(), eskiMs: ESKI_MS }, secenek || {});
  let girdiler = [];
  try { girdiler = fs.readdirSync(uretimDizini, { withFileTypes: true }); } catch (e) { return []; }   // uretim/ yok: is yok
  const silinen = [];
  for (const g of girdiler) {
    const m = g.isDirectory() ? ARTIK.exec(g.name) : null;
    const pid = m ? Number(m[1]) : 0;
    if (!pid || pid === process.pid) continue;
    const yol = path.join(uretimDizini, g.name);
    let mtime;
    try { mtime = fs.statSync(yol).mtimeMs; } catch (e) { continue; }          // bu arada baskasi silmis
    if (o.simdi - mtime < o.eskiMs) continue;                                // yeni: sahibi az once olmus/yeni baslamis olabilir
    if (o.yasiyorMu(pid)) continue;
    // tek yeniden deneme: kilitliyse sonraki kosu yeniden dener (her test dosyasinin basinda saniyelerce beklemeyelim)
    if (sil(yol, { maxRetries: 1, retryDelay: 100 })) silinen.push(g.name);
  }
  return silinen;
}

module.exports = { eskiArtiklariTemizle, sil, yasiyorMu, ARTIK, ESKI_MS };
