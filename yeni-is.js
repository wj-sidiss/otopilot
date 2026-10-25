// YENI IS ACAR (panelsiz) — paneldeki "Yeni video" ile ayni cekirdegi kullanir.
//
// Kullanim:
//   node yeni-is.js <is-adi> --baslik "Video basligi" [--nis "konu notu"] [--format long|short|reels|tiktok]
//                    [--sure 15] [--dil tr] [--ses tr-TR-AhmetNeural] [--sesHizi +7%] [--altyaziDili en]
//                    [--tur belgesel] [--ton "..."] [--kanal "AD"] [--slogan "..."] [--acilis hizli|sinematik]
//                    [--kaynak "araştırma metni"] [--katki "kişisel katkı"] [--sesMotoru otomatik|edge|azure|piper|voxcpm]
//                    [--trendRapor trend/<ad>.json]   (trend/viral raporunun hook ve süre kalıpları senaryoya örnek olur)
//
// Sonra: node senaryo-claude.js <is-adi>  (ya da senaryo-yaz.js)  ->  gorsel-bul.js  ->  seslendir.js  ->  video-yap.js
"use strict";
const ortak = require("./lib/ortak");
const { yeniIs, GirdiHatasi } = require("./lib/panel-yeni-is");

function yardim() {
  console.log("Kullanım: node yeni-is.js <is-adi> --baslik \"Başlık\" [--nis \"not\"] [--format long|short|reels|tiktok] [--sure dakika]");
  console.log("          [--dil tr] [--ses ...] [--sesHizi +7%] [--altyaziDili en] [--tur belgesel] [--ton \"...\"]");
  console.log("          [--kanal \"AD\"] [--slogan \"...\"] [--acilis hizli|sinematik] [--kaynak \"metin\"] [--katki \"metin\"]");
  console.log("          [--sesMotoru otomatik|edge|azure|piper|voxcpm] [--trendRapor trend/<ad>.json]");
}

function ana() {
  const { konum, bayrak } = ortak.argumanCoz(process.argv.slice(2), {
    deger: ["baslik", "nis", "format", "sure", "dil", "ses", "sesHizi", "altyaziDili", "tur", "ton", "kanal", "slogan", "acilis", "kaynak", "katki", "sesMotoru", "trendRapor"],
    mantik: ["yardim", "uret"],
  });
  if (bayrak.yardim || bayrak.h) { yardim(); return; }
  const ad = konum[0];
  if (!ad && !bayrak.baslik) {
    yardim();
    throw new ortak.OrtakHata("arguman", "İş adı ya da --baslik gerekli.", { cikis: ortak.CIKIS.GIRDI });
  }
  const v = x => (x === true ? undefined : x);       // "--baslik" degersiz verilmisse yok say
  const sonuc = yeniIs({
    ad, baslik: v(bayrak.baslik) || ad, nis: v(bayrak.nis), format: v(bayrak.format), sureDk: v(bayrak.sure),
    dil: v(bayrak.dil), ses: v(bayrak.ses), sesHizi: v(bayrak.sesHizi), altyaziDili: v(bayrak.altyaziDili),
    tur: v(bayrak.tur), ton: v(bayrak.ton), kanal: v(bayrak.kanal), slogan: v(bayrak.slogan),
    acilisStili: v(bayrak.acilis), kaynakMetin: v(bayrak.kaynak), kisiselKatki: v(bayrak.katki),
    sesMotoru: v(bayrak.sesMotoru), trendRapor: v(bayrak.trendRapor),
  });
  console.log("✓ İş oluşturuldu: uretim/" + sonuc.ad);
  console.log("  Biçim: " + sonuc.konu.format + " · dil: " + sonuc.konu.dil + " · hedef: " + sonuc.konu.hedefSaniye + " sn");
  for (const u of sonuc.uyarilar) ortak.uyari(u.mesaj);
  console.log("\n  Sıradaki adımlar:");
  console.log("    node senaryo-claude.js " + sonuc.ad + "   (ya da senaryo-yaz.js; senaryoyu kendin yazacaksan Voice/SESLENDIRME-TAM-METIN.txt dosyasına yapıştır)");
  console.log("    node gorsel-bul.js " + sonuc.ad);
  console.log("    node seslendir.js " + sonuc.ad);
  console.log("    node video-yap.js " + sonuc.ad);
  ortak.sonuc({ ad: sonuc.ad, dizin: "uretim/" + sonuc.ad });
}

if (require.main === module) {
  try { ana(); }
  catch (e) {
    if (e instanceof GirdiHatasi) {
      console.error("✗ " + e.message);
      process.exit(ortak.CIKIS.GIRDI);
    }
    ortak.bitir(e);
  }
}
module.exports = { ana };
