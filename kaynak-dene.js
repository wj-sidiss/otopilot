// Gorsel kaynaklarini CANLI yoklar: her kaynakta gercek bir arama yapar, adaylari gercek hatla AYNI puanlamadan gecirir
// (cozunurluk/kara liste/alaka) ve elenmeyen ilk adaylari GERCEKTEN indirip dogrular (sihirli bayt, 1280 px, kadraj).
// "Arama calisiyor ama gorsel inmiyor" durumlari (ornek: gorsel sunucusu baslik ister -> HTTP 403; web gorseli 1280 px'in
// altinda -> hepsi elenir) gorsel isi ortasinda degil, burada gorunur. Bir servis API'sini degistirirse de burada yakalanir.
//   node kaynak-dene.js [arama ifadesi]       npm run kaynak-dene
// Anahtarli kaynaklar (.env) anahtar yoksa "atlandi" yazilir. Cikis 0: en az bir kaynaktan gorsel indi; 3: hicbirinden inmedi.
// Satir basi: "OK" gorsel indi, "!" arama calisiyor ama gorsel yok (neden yazilir), "?" sonuc yok, "X" arama hatasi, "-" atlandi
"use strict";
const ortak = require("./lib/ortak.js");
const ag = require("./lib/gorsel-ag.js");
const puanModul = require("./lib/gorsel-puan.js");
const { indirDene, ORAN_SINIRI } = require("./lib/gorsel-indir.js");
const { ISTEMCILER, ADLAR } = require("./lib/gorsel-kaynak.js");

const ANAHTAR = { pexels: "PEXELS_KEY", pixabay: "PIXABAY_KEY", smithsonian: "SMITHSONIAN_KEY", unsplash: "UNSPLASH_KEY", europeana: "EUROPEANA_KEY" };
const DENENECEK = 2;                  // elenmeyen en iyi 2 aday indirilmeyi dener (tek dosya gecici olarak inmeyebilir)

const sn = t0 => ((Date.now() - t0) / 1000).toFixed(1) + " sn";
const nedenMetni = say => Object.entries(say).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(", ");

// Tek kaynak -> {ad, durum: "ok"|"gorsel_yok"|"bos"|"hata"|"atlandi", satir}
// b: {getir, istemci, anahtar, bekle}
async function kaynakDene(ad, q, b) {
  const etiket = (ADLAR[ad] || ad).padEnd(26);
  const t0 = Date.now();
  let r;
  try { r = await b.istemci(q, { limit: 8 }, { getir: b.getir, anahtar: b.anahtar }, () => {}); }
  catch (e) { return { ad, durum: "hata", satir: "X  " + etiket + ag.hataOzeti(e) }; }
  r = r || [];
  if (!r.length) return { ad, durum: "bos", satir: "?  " + etiket + "0 aday (" + sn(t0) + ") — arama çalışıyor ama sonuç yok; farklı bir ifadeyle dene" };

  // gercek hatla ayni puanlama baglami (gorsel-akis adaylariPuanla: yatay video, Ingilizce arama, alaka suzgeci)
  const sorguTok = puanModul.sorguTokenleri(q, "en");
  const elenme = {}, gecen = [];
  for (const a of r) {
    const p = puanModul.puanla(a, { sorgu: q, sorguTok, aramaDili: "en", yon: "yatay", siraLimiti: 40, alakaSuzgeci: true });
    if (p.elendi) { const t = p.elendi.split(":")[0].split(" (")[0]; elenme[t] = (elenme[t] || 0) + 1; continue; }
    gecen.push(Object.assign({}, a, { puan: p.puan }));
  }
  gecen.sort((x, y) => y.puan - x.puan);
  const bas = etiket + "arama " + r.length + " aday · puanlama " + gecen.length + "/" + r.length;
  if (!gecen.length) return { ad, durum: "gorsel_yok", satir: "!  " + bas + " geçti (" + nedenMetni(elenme) + ") — görsel denenemedi, " + sn(t0) };

  // elenmeyen en iyi adaylari gercek indirme yoluyla (gorsel-indir: kaynak basliklari + yedek adresler + dogrulama) dene
  const reddedilen = {};
  for (const a of gecen.slice(0, DENENECEK)) {
    const sonuc = await indirDene(a, { getir: b.getir, reddedilen, gorulenSha: new Set(), indirmeHata: {}, bekle: b.bekle, oranSiniri: ORAN_SINIRI.yatay });
    if (sonuc) {
      return { ad, durum: "ok", satir: "OK " + bas + " · görsel " + sonuc.v.en + "x" + sonuc.v.boy + " indi (" + sn(t0) + ") · " +
        a.lisans + " · " + String(a.baslik || "").slice(0, 40) };
    }
  }
  return { ad, durum: "gorsel_yok", satir: "!  " + bas + " · görsel inmedi (" + (nedenMetni(reddedilen) || "bilinmeyen neden") + "), " + sn(t0) };
}

// secenek: {q, getir, istemciler, anahtarOku(envAdi), log, bekle} -> {calisan, aramaCalisan, sonuclar}
async function dene(secenek) {
  const o = secenek || {};
  const q = o.q || "windmill";
  const getir = o.getir || ag.istemciYap({ limitBekleSn: 0 });
  const istemciler = o.istemciler || ISTEMCILER;
  const anahtarOku = o.anahtarOku || (k => ortak.envOku(k));
  const log = o.log || (m => console.log(m));
  const sonuclar = [];
  log('Arama: "' + q + '"\n');
  for (const ad of Object.keys(istemciler)) {
    const anahtar = ANAHTAR[ad] ? anahtarOku(ANAHTAR[ad]) : "";
    if (ANAHTAR[ad] && !anahtar) {
      const s = { ad, durum: "atlandi", satir: "-  " + (ADLAR[ad] || ad).padEnd(26) + "atlandi (" + ANAHTAR[ad] + " yok)" };
      sonuclar.push(s); log(s.satir); continue;
    }
    const s = await kaynakDene(ad, q, { getir, istemci: istemciler[ad], anahtar, bekle: o.bekle });
    sonuclar.push(s); log(s.satir);
  }
  const calisan = sonuclar.filter(s => s.durum === "ok").length;
  const yarim = sonuclar.filter(s => s.durum === "gorsel_yok").length;
  log("\n" + calisan + " kaynaktan görsel indi" + (yarim ? "; " + yarim + " kaynakta arama çalışıyor ama görsel inmedi (satırdaki nedene bak)" : "") + ".");
  return { calisan, aramaCalisan: calisan + yarim, sonuclar };
}

async function calistir() {
  const r = await dene({ q: process.argv.slice(2).join(" ") || "windmill" });
  process.exit(r.calisan ? 0 : 3);
}

if (require.main === module) calistir();
module.exports = { calistir, dene, kaynakDene, ANAHTAR };
