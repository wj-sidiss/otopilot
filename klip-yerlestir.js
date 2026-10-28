// vidiq-klip.js ile indirilen AI klipleri SAHNE klasorlerine yerlestirir; video-yap.js onlari sahnenin basina koyar (dongulenir, kadraja kirpilir).
//   node klip-yerlestir.js <is>            Voice/KLIPLER.txt'in i. satiri -> Visuals/manifest.json'un i. sahnesi
//   node klip-yerlestir.js <is> --yeniden  ayni sahnedeki eski AI klibinin yerine yeniden kopyalar
// KREDI HARCAMAZ, ag kullanmaz. Klip yoksa o sahne atlanir; tekrar calistirmak guvenlidir (var olan dosyaya dokunmaz).
// Sahne sayisi ile KLIPLER.txt satir sayisi farkliysa YALNIZ ortak kisim yerlestirilir ve acikca uyarilir.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");
const K = require("./lib/vidiq-klip.js");

const hata = (m, c) => Object.assign(new Error(m), { cikis: 2, cozum: c });

// is: is adi; o: {yeniden, log}. -> {yerlestirilen, atlanan, eksik, uyarilar}
function yerlestir(is, o) {
  const opt = o || {};
  const log = opt.log || (m => console.log(m));
  const dizin = ortak.isDizin(is);
  const vis = path.join(dizin, "Visuals");
  const manifest = ortak.jsonOku(path.join(vis, "manifest.json"), null);
  if (!manifest || !Array.isArray(manifest.sahneler)) throw hata("Visuals/manifest.json yok.", "Önce gorsel-bul.js çalıştır (sahne klasörleri oradan gelir).");
  const klipDosya = path.join(dizin, "Voice", "KLIPLER.txt");
  if (!fs.existsSync(klipDosya)) throw hata("Voice/KLIPLER.txt yok.", "Klip istemleri bu dosyadan okunur (vidiq-klip.js ile aynı).");
  const liste = K.klipListesi(fs.readFileSync(klipDosya, "utf8"), K.VARSAYILAN.sure);
  const kayit = K.kayitOku(path.join(dizin, "Clips"));
  const klipler = (kayit.klipler || []).filter(k => k && k.dosya && fs.existsSync(path.join(dizin, "Clips", k.dosya)));

  const uyarilar = [];
  if (liste.length !== manifest.sahneler.length)
    uyarilar.push("KLIPLER.txt " + liste.length + " satır, manifestte " + manifest.sahneler.length + " sahne var: yalnız ilk " + Math.min(liste.length, manifest.sahneler.length) + " tanesi eşlenir.");
  let yerlestirilen = 0, atlanan = 0, eksik = 0;
  for (let i = 0; i < Math.min(liste.length, manifest.sahneler.length); i++) {
    const s = manifest.sahneler[i];
    if (!s.klasor) { eksik++; continue; }
    // en son indirilen eslesen klip (ayni istem + sure); yeni cekim varsa sonuncusu
    const e = klipler.filter(k => k.istem === liste[i].istem && Number(k.sure) === Number(liste[i].sure)).pop();
    if (!e) { eksik++; log("  sahne " + (i + 1) + ": klip henüz yok"); continue; }
    const hedefKlasor = path.join(vis, s.klasor);
    if (!fs.existsSync(hedefKlasor)) fs.mkdirSync(hedefKlasor, { recursive: true });
    const mevcut = fs.readdirSync(hedefKlasor).filter(f => /^00-ai-.*\.mp4$/i.test(f));
    const hedefAd = "00-ai-" + e.dosya;
    if (mevcut.includes(hedefAd) && !opt.yeniden) { atlanan++; continue; }
    if (mevcut.length && !opt.yeniden) { atlanan++; log("  sahne " + (i + 1) + ": zaten bir AI klip var (" + mevcut[0] + "), --yeniden ile değiştirilir"); continue; }
    for (const f of mevcut) { try { fs.unlinkSync(path.join(hedefKlasor, f)); } catch (x) { /* yok */ } }
    const gecici = path.join(hedefKlasor, hedefAd + ".part");
    fs.copyFileSync(path.join(dizin, "Clips", e.dosya), gecici);
    fs.renameSync(gecici, path.join(hedefKlasor, hedefAd));
    yerlestirilen++;
    log("  sahne " + (i + 1) + " (" + s.klasor + ") ← " + e.dosya);
  }
  for (const u of uyarilar) log("! " + u);
  log("\n✓ " + yerlestirilen + " klip yerleştirildi, " + atlanan + " zaten vardı, " + eksik + " sahnede klip yok." + (yerlestirilen ? " Sıradaki: node video-yap.js " + is + " --yeniden" : ""));
  return { yerlestirilen, atlanan, eksik, uyarilar };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const is = args.find(a => !a.startsWith("--"));
  try {
    if (!is) throw hata("Kullanım: node klip-yerlestir.js <iş-adı> [--yeniden]");
    yerlestir(is, { yeniden: args.includes("--yeniden") });
  } catch (e) { console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : "")); process.exit(e.cikis || 1); }
}
module.exports = { yerlestir };
