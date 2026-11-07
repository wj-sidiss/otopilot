// Diksiyon raporu (ucretsiz, yerel, ag yok): seslendirmeden ONCE senaryodaki telaffuz risklerini satir numarasiyla listeler.
//   node diksiyon.js <is>                      uretim/<is>/Voice/SESLENDIRME-TAM-METIN.txt (dil, okunus, motor: konu.json)
//   node diksiyon.js <dosya.txt> [--dil tr]    herhangi bir metin dosyasi (varsayilan dil tr)
//   bayraklar: --motor voxcpm (cumle basi "Önce" denetimi) · --esik 28 (uzun cumle kelime siniri)
//              --telaffuz-kapali (yerlesik telaffuz paketi kapali sayilir) · --json (yalniz JSON cikti)
// Rapor: okunusu tanimsiz yabanci kelime, uzun cumle, sapka belirsizligi (hala/hâlâ...), VoxCPM'de cumle basi "Önce",
// okunus hazirligindan sonra kalan rakam/sembol, web adresi, okunusla unlu uyumu bozulan kesmeli ek ("API'ye"). Ayrica paketin OTOMATIK uygulayacagi degisiklikler
// (yalniz seste; altyazi degismez). Metin DEGISTIRILMEZ.
// Cikis: 0 risk yok · 1 risk bulundu (uyari; ai-kalip-kontrol.js ile ayni) · 2 girdi/ayar.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");
const D = require("./lib/diksiyon-rapor.js");

function ana(argv, cikti) {
  const yaz = cikti || (s => console.log(s));
  const { konum, bayrak } = ortak.argumanCoz(argv, { deger: ["dil", "motor", "esik"], mantik: ["json", "telaffuz-kapali"] });
  const hedef = konum[0];
  if (!hedef) {
    console.error("Kullanım: node diksiyon.js <iş-adı | dosya.txt> [--dil tr] [--motor voxcpm] [--esik 28] [--telaffuz-kapali] [--json]");
    return 2;
  }
  let dosya = hedef, konu = {};
  if (!(fs.existsSync(dosya) && fs.statSync(dosya).isFile())) {
    let d;
    try { d = ortak.isDizin(hedef); } catch (e) { console.error("✗ " + e.message); return 2; }
    dosya = path.join(d, "Voice", "SESLENDIRME-TAM-METIN.txt");
    if (!fs.existsSync(dosya)) {
      console.error("✗ Metin yok: " + dosya);
      console.error("  ↳ Önce senaryoyu yaz ya da bir metin dosyası ver: node diksiyon.js metin.txt");
      return 2;
    }
    try { konu = ortak.jsonOku(path.join(d, "konu.json"), {}) || {}; }
    catch (e) { console.error("✗ konu.json okunamadı: " + e.message); return 2; }
  }
  const esik = bayrak.esik !== undefined ? Number(bayrak.esik) : undefined;
  if (esik !== undefined && !(Number.isInteger(esik) && esik >= 5 && esik <= 200)) {
    console.error("✗ --esik 5 ile 200 arasında tam sayı olmalı."); return 2;
  }
  const motorKonu = konu.sesMotoru === "voxcpm" || ortak.voxcpmSesiMi(konu.ses) ? "voxcpm" : (konu.sesMotoru || null);
  const motor = typeof bayrak.motor === "string" ? bayrak.motor : motorKonu;
  const dil = typeof bayrak.dil === "string" ? bayrak.dil : (konu.dil || "tr");
  const r = D.rapor(fs.readFileSync(dosya, "utf8"), {
    dil, motor, esik,
    okunus: konu.okunus && typeof konu.okunus === "object" ? konu.okunus : {},
    telaffuzPaketi: bayrak["telaffuz-kapali"] ? false : konu.telaffuzPaketi !== false,
  });

  if (bayrak.json) { yaz(JSON.stringify(Object.assign({ dosya }, r), null, 2)); return r.riskler.length ? 1 : 0; }

  yaz("Diksiyon raporu: " + dosya);
  yaz("  dil " + r.dil + " · motor " + (r.motor || "otomatik") + " · telaffuz paketi " +
      (r.dil !== "tr" ? "yalnız Türkçede" : r.paket ? "açık" : "kapalı") + " · uzun cümle eşiği " + r.esik + " kelime");
  if (r.uygulanan.length) {
    const toplam = r.uygulanan.reduce((a, u) => a + u.adet, 0);
    yaz("Otomatik uygulanacak (yalnız seste; altyazı değişmez): " + toplam + " değişiklik");
    yaz("  " + r.uygulanan.slice(0, 40).map(u => u.yazilis + " → " + u.okunus + (u.adet > 1 ? " (" + u.adet + ")" : "")).join(" · ") +
        (r.uygulanan.length > 40 ? " · …" : ""));
  }
  if (!r.riskler.length) { yaz("✓ Diksiyon riski bulunmadı."); return 0; }
  yaz("! " + D.ozetSatiri(r) + ":");
  for (const k of r.riskler) {
    const ek = k.satirlar && k.satirlar.length > 1 ? " (satır " + k.satirlar.join(", ") + ")" : "";
    yaz("  satır " + k.satir + " [" + k.tur + "] \"" + k.parca + "\" — " + k.mesaj + ek);
    yaz("      ↳ " + k.oneri);
  }
  return 1;
}

if (require.main === module) {
  try { process.exitCode = ana(process.argv.slice(2)); }
  catch (e) { ortak.bitir(e); }
}
module.exports = { ana };
