// gorsel-bul.js <is> [--yeniden] [--sahne <no> --ara "<ifade>"] [--limit-bekle <sn>] [--uretme] [--arsiv-temizle]
//
// KONU BAGIMSIZ gorsel bulucu. Spor, yemek, reklam, uzay — fark etmez.
//
// Arama kelimeleri (oncelik sirasiyla):
//   0. --sahne N --ara "ifade"                    (elle duzeltme, her seyden once; yalniz o sahne)
//   1. konu.json > sahneKelimeleri[sahne-1]       (elle; "uret: ..." = AI gorseli)
//   2. Voice/ARAMALAR.txt                         (senaryoyu yazan ajan: her paragraf icin bir satir INGILIZCE arama,
//                                                  sira paragraflarla ayni, "|" ile yedekler: "full moon | moon surface";
//                                                  satir sayisi tutmazsa uyarir, eslesen kadarini kullanir)
//   3. Voice/gorsel-aramalari.json                (senaryo motoru uretir; senaryo degistiyse yok sayilir)
//   4. otomatik cikarim                           (yalnizca yedek; dolgu kelimeleri secmez, Turkce somut isimleri ve gok
//                                                  cisimlerini Ingilizceye cevirir: "Ay'ın" -> Moon)
// ALAKA SUZGECI: Wikimedia/Openverse/NASA adayinin baslik/aciklama/etiketinde aramanin anlamli kelimelerinden hicbiri
// yoksa aday ancak alakali aday yetmezse (sahne bos kalmasin) alinir; manifestte "alakaZayif": true + uyari. Ingilizce
// olmayan aramada (metadata cogunlukla Ingilizce) eslesmemek kanit sayilmaz: sahne gerekirse eskisi gibi hedef adede dek dolar.
// --sahne N --ara ile elle aranan sahne sonraki calismalarda da kendi aramasini korur (dosyaya donmek: --sahne N).
//
// Kaynaklar: Pexels, Pixabay (anahtar varsa), Wikimedia Commons, Openverse, NASA (uzay konularinda ONCELIKLI).
// LISANS: kanal para kazanabilir; NC (ticari degil) ve ND (turetilemez) lisanslar ELENIR. Sira: CC0/kamu mali/NASA/
// Pexels/Pixabay > CC BY > CC BY-SA. Secim KAYNAK ALAKASIYLA yapilir (dosya boyutuyla degil).
// Inen dosya DOGRULANIR: JPEG/PNG sihirli bayti, 25 MB siniri, gercek cozunurluk (uzun kenar >=1280).
//
// Ciktilar: uretim/<is>/Visuals/NNN-kelime/NN.jpg, Visuals/manifest.json (gorsel->paragraf eslemesi, lisans, atif),
//           ATIF.txt (YouTube aciklamasina yapistirilacak atiflar), silinenler.json'daki gorseller bir daha gelmez.
// Artimli: yeterli sahneye dokunmaz, eksigi doldurur; senaryo degistiyse eskiyi Visuals/_eski-<damga>/ altina tasir;
//          --yeniden temizden baslar. Hic gorsel inmezse / sahnelerin %70'inden azi dolarsa adim BASARISIZ olur (exit 4).
// Arsivler (Visuals/_eski-*) KENDILIGINDEN SILINMEZ; yer acmak icin --arsiv-temizle (en yeni 2 arsiv kalir, gerisi silinir).
// --sahne N --ara "x": yeni arama sonuc vermezse sahnenin eski gorselleri geri konur (sahne bosalmaz).
// Cekirdek: lib/gorsel-akis.js
"use strict";
const ortak = require("./lib/ortak.js");
const sorgu = require("./lib/gorsel-sorgu.js");
const akis = require("./lib/gorsel-akis.js");
const man = require("./lib/gorsel-manifest.js");

// Testler ve diger betikler icin saf fonksiyonlar
module.exports = {
  calistir: akis.calistir,
  kelimeler: sorgu.kelimeler,
  ozelIsimler: sorgu.ozelIsimler,
  genelCapa: sorgu.genelCapa,
  ifadeCikar: sorgu.ifadeCikar,
  kozmikMi: sorgu.kozmikMi,
  sahnePlan: sorgu.sahnePlan,
  aramaSatirlariCoz: man.aramaSatirlariCoz,
};

// Degerli bayrak degersiz yazildiysa (argumanCoz bunu `true` yapar; sondaysa ya da sonraki bir "--bayrak" ise) ya da deger
// baska bir bayrak gibi gorunuyorsa ("--sahne --yeniden") sessizce 1'e/bayraga cevrilmesin.
function degerYok(v) { return v === true || /^--/.test(String(v)); }

if (require.main === module) {
  const { konum, bayrak } = ortak.argumanCoz(process.argv.slice(2), { deger: ["sahne", "ara", "limit-bekle"] });
  const is = konum[0];
  const hata = m => { console.error("✗ " + m); process.exit(ortak.CIKIS.GIRDI); };
  if (!is) hata('Kullanım: node gorsel-bul.js <iş-adı> [--yeniden] [--sahne <no> --ara "<ifade>"] [--arsiv-temizle]');

  let sahne = null;
  if (bayrak.sahne !== undefined) {
    if (degerYok(bayrak.sahne)) hata("--sahne için bir sahne numarası ver (1, 2, 3…): --sahne 3");
    sahne = Number(bayrak.sahne);
    if (!Number.isInteger(sahne) || sahne < 1) hata("--sahne bir sahne numarası (1, 2, 3…) olmalı.");
  }
  if (bayrak.ara !== undefined && (degerYok(bayrak.ara) || !String(bayrak.ara).trim())) hata('--ara için bir arama ifadesi ver: --ara "polar bear".');
  let limitBekleSn;
  if (bayrak["limit-bekle"] !== undefined) {
    if (degerYok(bayrak["limit-bekle"])) hata("--limit-bekle için saniye ver (örn. --limit-bekle 600).");
    limitBekleSn = Number(bayrak["limit-bekle"]);
    if (!Number.isFinite(limitBekleSn) || limitBekleSn < 0) hata("--limit-bekle saniye cinsinden bir sayı olmalı (örn. 600).");
  }

  akis.calistir({
    is, yeniden: !!bayrak.yeniden, sahne, ara: bayrak.ara !== undefined ? String(bayrak.ara).trim() : null,
    uretme: !!bayrak.uretme, limitBekleSn, arsivTemizle: !!bayrak["arsiv-temizle"],
  }).catch(ortak.bitir);
}
