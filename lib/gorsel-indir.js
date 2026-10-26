// SIRALI ADAYLARI INDIRIP DOGRULAYARAK SAHNEYE YAZAR (GO grubu) — gorsel-bul, gorsel-cek, portre-cek ortak kullanir.
//
// Her aday: url + yedekUrl'ler sirayla denenir; inen dosya DOGRULANIR (sihirli bayt, 25 MB, gercek cozunurluk);
// ayni icerik (sha1) ya da silinmis gorsel ise atilir; basariliysa Visuals/<sahne>/NN.jpg yazilir ve manifest
// kaydi sahneye eklenir. `gorulen*` kumeleri YALNIZCA gercekten INDIRILENLERI isaretler (eski hata: indirilmeyenler
// isaretleniyor, indirilenler isaretlenmiyordu).
"use strict";
const ag = require("./gorsel-ag.js");
const { dogrula } = require("./gorsel-dogrula.js");
const { gorselYaz } = require("./gorsel-manifest.js");
const { kanonikUrl } = require("./gorsel-puan.js");

const uyku = ms => new Promise(r => setTimeout(r, ms));
const sayac = (o, k) => { o[k] = (o[k] || 0) + 1; };

// Ag hatasi aday icin KALICI mi (dosya yok/izinsiz/cok buyuk/yerel adres) yoksa gecici mi (zaman asimi, 5xx, kopma, 429)?
const KALICI_AG_KODLARI = ["cok_buyuk", "yerel_adres", "adres", "yonlendirme"];
function kaliciHataMi(e) {
  if (typeof e.kod === "number") return e.kod >= 400 && e.kod < 500 && e.kod !== 408 && e.kod !== 429;
  return KALICI_AG_KODLARI.includes(e.kod);
}
// Adaya ait anahtarlar: indirme adresi + kaynak sayfasi (ayni gorsel baska kaynaktan farkli adresle de gelebilir)
function adayAnahtarlari(g) {
  const l = [kanonikUrl(g.indirmeUrl || g.url)];
  if (g.kaynakUrl) l.push(kanonikUrl(g.kaynakUrl));
  return l;
}

// Aday GERCEKTEN kullanildiktan sonra kaynagin istedigi bildirim (Unsplash: links.download_location). Sonucu yok sayilir;
// hata indirmeyi/akisi asla bozmaz.
async function indirmeBildir(g) {
  if (!g || typeof g.indirmeBildir !== "function") return;
  try { await g.indirmeBildir(); } catch (e) { /* yalniz sayac: gorsel zaten yazildi */ }
}

// -> {buf, v} | null
// o.redUrl (Set, calisma boyunca paylasilir): ICERIGI yuzunden reddedilen adaylar (gorsel degil, cozunurluk dusuk, kadraja
// uymayan oran, ayni icerik, kalici 4xx) buraya girer; ayni aday sonraki sahnelerde/aramalarda bir daha INDIRILMEZ.
// Gecici ag hatalari girmez (aday sonra indirilebilir).
async function indirDene(g, o) {
  const indirmeHata = o.indirmeHata || {};
  if ((indirmeHata[g.kaynak] || 0) >= 6) return null;           // bu kaynagin gorsel sunucusu bu calismada yanit vermiyor
  const bekle = o.bekle || uyku;
  const kaliciRed = () => { if (o.redUrl) for (const k of adayAnahtarlari(g)) o.redUrl.add(k); };
  let gecici = false;
  // kaynaga ozgu indirme basligi (AIC IIIF sunucusu AIC-User-Agent olmadan 403 doner); kimlik bilgisi tasimaz
  const secenek = g.indirmeBasliklar ? { basliklar: Object.assign({}, g.indirmeBasliklar) } : undefined;
  for (const u of [g.url].concat(g.yedekUrl || [])) {
    try {
      const r = await o.getir.gorsel(u, secenek);
      const v = dogrula(r.govde, { maksBayt: ag.MAKS_GORSEL_BAYT, minUzunKenar: o.minUzunKenar });
      if (!v.tamam) { sayac(o.reddedilen, v.neden.split(" (")[0]); continue; }
      // GERCEK oran: kaynak boyut bildirmemisse (NASA, bazi Openverse) asiri dikey/yatay dosya kadraji yok eder
      if (o.oranSiniri) {
        const oran = v.en / v.boy;
        if (oran < o.oranSiniri[0] || oran > o.oranSiniri[1]) { sayac(o.reddedilen, "kadraja uymayan oran"); kaliciRed(); return null; }
      }
      if (o.gorulenSha.has(v.sha1) || (o.silinenSha && o.silinenSha.has(v.sha1))) { sayac(o.reddedilen, "aynı görsel zaten var"); kaliciRed(); return null; }
      indirmeHata[g.kaynak] = 0;
      return { buf: r.govde, v };
    } catch (e) {
      // 4xx (silinmis/izinsiz tek dosya) sunucunun coktugunu gostermez; yalniz zaman asimi/5xx/ag kopmasi sayilir
      if (!(typeof e.kod === "number" && e.kod >= 400 && e.kod < 500)) indirmeHata[g.kaynak] = (indirmeHata[g.kaynak] || 0) + 1;
      if (!kaliciHataMi(e)) gecici = true;
      sayac(o.reddedilen, "indirilemedi (" + ag.hataOzeti(e) + ")");
      if (e.kod === 429) await bekle(900);
    }
  }
  if (!gecici) kaliciRed();                                     // hicbir adres gecici hataya takilmadi: aday kullanilamaz
  return null;
}

// o: {P, S, adaylar (puana gore SIRALI), kac, getir, gorulenUrl:Set, gorulenSha:Set, silinen:{url,sha1}, reddedilen:{},
//     redUrl:Set (calisma boyunca paylasilan 'icerigi uygunsuz' adaylar), indirmeHata:{}, bekle, aralikMs, minUzunKenar,
//     oranSiniri:[min,max] (en/boy), klasorIfade, klasorAta(S,ifade), onKayit(aday,kayit)}
// oranSiniri icin ORAN_SINIRI.yatay / .dikey kullan. Yalnizca KADRAJDA YOK OLAN asiri oranlar (panorama/serit) reddedilir;
// yon uyumsuzlugu (2:3 portre fotografi 16:9 videoda gibi) sozlesme geregi RED degil CEZA'dir (gorsel-puan.js, yon cezasi).
// Iki taraf simetrik: yatay video icin 1/1.8 = 0.55 (9:16 telefon portresi gecer), dikey video icin 1.8 (16:9 gecer).
const ORAN_SINIRI = { yatay: [0.55, 4], dikey: [0.25, 1.8] };
// -> {eklenen, ilkArama, kaynaklar:{kaynak:n}}
async function adaylardanIndir(o) {
  const bekle = o.bekle || uyku;
  const klasorAta = o.klasorAta;
  let eklenen = 0, ilkArama = null;
  const kaynaklar = {};
  for (const g of o.adaylar) {
    if (eklenen >= o.kac) break;
    const k1 = kanonikUrl(g.indirmeUrl || g.url);
    if (o.gorulenUrl.has(k1)) continue;                         // ayni calismada baska sahne aldiysa
    if (o.redUrl && adayAnahtarlari(g).some(k => o.redUrl.has(k))) continue;   // bu calismada zaten reddedildi: tekrar indirme
    const r = await indirDene(g, { getir: o.getir, reddedilen: o.reddedilen, gorulenSha: o.gorulenSha, redUrl: o.redUrl,
      silinenSha: o.silinen && o.silinen.sha1, indirmeHata: o.indirmeHata, bekle, minUzunKenar: o.minUzunKenar, oranSiniri: o.oranSiniri });
    if (!r) { await bekle(100); continue; }
    if (klasorAta) klasorAta(o.S, o.klasorIfade);
    const kayit = gorselYaz(o.P, o.S, r.buf, r.v, g);
    o.gorulenUrl.add(k1);
    if (g.kaynakUrl) o.gorulenUrl.add(kanonikUrl(g.kaynakUrl));
    o.gorulenSha.add(r.v.sha1);
    sayac(kaynaklar, g.kaynak);
    eklenen++;
    if (!ilkArama) ilkArama = g.aramaIfadesi || null;
    await indirmeBildir(g);
    if (o.onKayit) o.onKayit(g, kayit);
    await bekle(o.aralikMs !== undefined ? o.aralikMs : 200);
  }
  return { eklenen, ilkArama, kaynaklar };
}

module.exports = { indirDene, adaylardanIndir, kaliciHataMi, indirmeBildir, ORAN_SINIRI };
