// VS VIDEOSU GORSEL SECIMI (GO grubu) — vs-kur.js ve vs-gorsel-duzelt.js ortak kullanir.
//
// Eski sorunlar (bulgu B028): tur filtresi isteğe bagliydi (puan>0 yeterliydi, dikey oran tek basina +4 verdigi icin
// konu adini icermeyen her fotograf geciyordu), ilk sorguda aday varsa yedek sorgulara hic gecilmiyordu, yasak regex'inde
// kelime siniri yoktu ("part" -> "art"), anahtar yoksa hicbir yedek yoktu, yalnizca 5 eski is sabit yaziliydi.
//
// Simdi: zorunlu kelimelerden EN AZ BIRI aday metninde gecmeli (kelime sinirli), heykel/oyuncak/cizim/kostum vb. ELENIR,
// sorgular SIRAYLA denenir (hicbiri gecmezse sonrakine), Pexels/Pixabay anahtarsizsa Wikimedia + Openverse devreye girer,
// kadraj: her yari 1080x960 (~1.125:1) oldugu icin kareye/hafif yataya en yakin gorsel secilir, dikey boy ceza alir.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ortak = require("./ortak.js");
const ag = require("./gorsel-ag.js");
const puanModul = require("./gorsel-puan.js");
const sorgu = require("./gorsel-sorgu.js");
const { dogrula } = require("./gorsel-dogrula.js");
const { KaynakYonetici, MUZE } = require("./gorsel-kaynak.js");
const { kaliciHataMi, indirmeBildir } = require("./gorsel-indir.js");
const man = require("./gorsel-manifest.js");

// VS kapagi canli hayvan/nesne fotografi ister: NASA ve muze kaynaklari (Met/AIC/Cleveland/Rijks/Smithsonian/Europeana:
// gravur, tablo, heykel) hic sorgulanmaz (her sorguda Met 1+8, Rijks 1+6 bosa istek demekti)
const VS_HARIC = ["nasa"].concat(MUZE);
const HEDEF_ORAN = 1080 / 960;                        // vs-yap.js: her yari 1080x960
const ORAN_SINIRI = [0.62, 2.2];                      // bunun disi kadrajda yok olur
const MIN_BAYT = 20000;                               // var olan gorsel bu boyutun ustundeyse "kurulu" sayilir
const RENK = /^[0-9A-Fa-f]{6}$/;
const TARAFLAR = ["ust", "alt"];

// ---------------------------------------------------------------- tanim
// vs-tanim.json = vs.json bicimi + ust/alt: {ara, zorunlu?, sorgular?, yasak?}
function tanimDogrula(t, ad) {
  const hata = m => new ortak.OrtakHata("vs_tanim", (ad ? ad + ": " : "") + m, { cikis: ortak.CIKIS.GIRDI,
    cozum: "vs-tanim.json'u düzelt (panelde VS ekranından yeniden kaydet)." });
  if (!ortak.duzNesne(t)) throw hata("tanım bir JSON nesnesi olmalı.");
  if (typeof t.baslik !== "string" || !t.baslik.trim()) throw hata("'baslik' (metin) gerekli.");
  for (const k of TARAFLAR) {
    const x = t[k];
    if (!ortak.duzNesne(x)) throw hata("'" + k + "' bir nesne olmalı: {ad, renk, ara}.");
    if (typeof x.ad !== "string" || !x.ad.trim()) throw hata("'" + k + ".ad' gerekli.");
    if (typeof x.renk !== "string" || !RENK.test(x.renk)) throw hata("'" + k + ".renk' 6 haneli renk kodu olmalı (örn. 3BE07A, # yok).");
    const sorgular = Array.isArray(x.sorgular) ? x.sorgular.filter(s => typeof s === "string" && s.trim()) : [];
    if (!(typeof x.ara === "string" && x.ara.trim()) && !sorgular.length) throw hata("'" + k + ".ara' (arama ifadesi) gerekli.");
    for (const a of ["zorunlu", "sorgular", "yasak"])
      if (x[a] !== undefined && !(Array.isArray(x[a]) && x[a].every(s => typeof s === "string"))) throw hata("'" + k + "." + a + "' metin listesi olmalı.");
  }
  if (!Array.isArray(t.olculer) || !t.olculer.length) throw hata("'olculer' en az bir ölçü içermeli.");
  t.olculer.forEach((o, i) => {
    if (!ortak.duzNesne(o) || typeof o.ad !== "string") throw hata("olculer[" + i + "].ad gerekli.");
    for (const k of ["ustDeger", "altDeger"]) if (typeof o[k] !== "number" || !Number.isFinite(o[k])) throw hata("olculer[" + i + "]." + k + " sayı olmalı.");
    if (!["ust", "alt"].includes(o.kazanan)) throw hata("olculer[" + i + "].kazanan 'ust' ya da 'alt' olmalı.");
  });
  if (t.kazanan !== undefined && !["ust", "alt"].includes(t.kazanan)) throw hata("'kazanan' 'ust' ya da 'alt' olmalı.");
  return t;
}

// vs.json: arama alanlari cikarilir, varsayilan sureler eklenir
function vsJsonUret(t) {
  return {
    baslik: t.baslik, altBaslik: t.altBaslik !== undefined ? t.altBaslik : "WHO WINS?",
    ust: { ad: t.ust.ad, renk: t.ust.renk }, alt: { ad: t.alt.ad, renk: t.alt.renk },
    introSure: t.introSure || 4.0, olcuSure: t.olcuSure || 5.8, sonSure: t.sonSure || 7.0,
    olculer: t.olculer.map(o => ({ ad: o.ad, ustDeger: o.ustDeger, ustMetin: o.ustMetin, altDeger: o.altDeger, altMetin: o.altMetin,
      kazanan: o.kazanan, not: o.not })),
    kazanan: t.kazanan, sonuc: t.sonuc, sonuc2: t.sonuc2,
  };
}

// ---------------------------------------------------------------- sorgu / zorunlu kelimeler
function tarafSorgulari(taraf) {
  const sorgular = (Array.isArray(taraf.sorgular) ? taraf.sorgular : []).map(s => s.trim()).filter(Boolean);
  if (typeof taraf.ara === "string" && taraf.ara.trim() && !sorgular.includes(taraf.ara.trim())) sorgular.unshift(taraf.ara.trim());
  // zorunlu verilmediyse ilk sorgunun ilk 2 icerik kelimesi ("polar bear arctic snow" -> polar, bear)
  let zorunlu = (Array.isArray(taraf.zorunlu) ? taraf.zorunlu : []).map(s => s.trim()).filter(Boolean);
  if (!zorunlu.length) zorunlu = sorgu.kelimeler(sorgular[0] || "", "en").slice(0, 2);
  return { sorgular, zorunlu, yasak: (Array.isArray(taraf.yasak) ? taraf.yasak : []).filter(Boolean) };
}

// ---------------------------------------------------------------- kaynak.json
function kaynakJsonYolu(is) { return path.join(man.yollar(is).BASE, "Images", "kaynak.json"); }
function kaynakJsonOku(is) {
  try { const d = ortak.jsonOku(kaynakJsonYolu(is), null); return ortak.duzNesne(d) ? d : null; } catch (e) { return null; }
}

// ---------------------------------------------------------------- ffmpeg ile PNG -> JPEG (vs-yap ust.jpg/alt.jpg bekler)
// ff-yol.js ffmpeg yoksa surec OLDURMEZ (OrtakHata firlatir) ve getter'lari tembeldir: yalniz require etmek
// kontrol yapmaz. Bu yuzden varMi() kullanilir (ffmpeg + ffprobe gercekten cozulur, sonuc onbellekte).
let _ffmpegHazir = null;
function ffmpegHazir() {
  if (_ffmpegHazir === null) {
    try { _ffmpegHazir = require("../ff-yol.js").varMi(); } catch (e) { _ffmpegHazir = false; }
  }
  return _ffmpegHazir;
}
function jpegeCevir(buf) {
  if (!ffmpegHazir()) throw new Error("ffmpeg bulunamadı");
  const os = require("os");
  const { execFileSync } = require("child_process");
  const { ffmpeg } = require("../ff-yol.js");
  const tmp = path.join(os.tmpdir(), "vs-png-" + process.pid + "-" + crypto.randomBytes(4).toString("hex"));
  fs.writeFileSync(tmp + ".png", buf);
  try {
    execFileSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", tmp + ".png", "-q:v", "2", tmp + ".jpg"], { stdio: "pipe", timeout: 60000 });
    return fs.readFileSync(tmp + ".jpg");
  } finally {
    for (const x of [tmp + ".png", tmp + ".jpg"]) { try { fs.unlinkSync(x); } catch (e) {} }
  }
}

// ---------------------------------------------------------------- tek tarafin gorselini sec
// o: {taraf:{ad,ara,zorunlu,sorgular,yasak}, getir, yonetici, log, haric:{url:Set,sha1:Set}, bekle, jpegeCevirFn,
//     redUrl:Set (icerigi uygunsuz cikan adaylar; sorgular/taraflar arasi paylasilir: ayni aday yeniden indirilmez)}
// -> {buf(JPEG), v, aday, sorgu, elenme} | null
async function tarafGorseliSec(o) {
  const log = o.log || (() => {});
  const bekle = o.bekle || (ms => new Promise(r => setTimeout(r, ms)));
  const { sorgular, zorunlu, yasak } = tarafSorgulari(o.taraf);
  const haric = o.haric || { url: new Set(), sha1: new Set() };
  const elenme = {}, reddedilen = {}, indirmeHata = {};
  const cevir = o.jpegeCevirFn || jpegeCevir;
  const red = o.redUrl || new Set();
  const adayAnahtarlari = a => [puanModul.kanonikUrl(a.indirmeUrl || a.url), a.kaynakUrl ? puanModul.kanonikUrl(a.kaynakUrl) : ""].filter(Boolean);
  for (const q of sorgular) {
    if (o.yonetici.tumuKapaliMi()) break;
    const ham = await o.yonetici.hepsindeAra(q, { yon: "hepsi", limit: 40 }, { haric: VS_HARIC });
    const sorguTok = puanModul.sorguTokenleri(q, "en");
    const adaylar = [];
    for (const a of ham) {
      const k1 = puanModul.kanonikUrl(a.indirmeUrl || a.url), k2 = puanModul.kanonikUrl(a.kaynakUrl);
      if (haric.url.has(k1) || (k2 && haric.url.has(k2))) { elenme["mevcut görsel"] = (elenme["mevcut görsel"] || 0) + 1; continue; }
      if (adayAnahtarlari(a).some(k => red.has(k))) { elenme["daha önce reddedildi"] = (elenme["daha önce reddedildi"] || 0) + 1; continue; }
      const r = puanModul.puanla(a, { sorgu: q, sorguTok, aramaDili: "en", yon: "vs", hedefOran: HEDEF_ORAN, oranAgirlik: 60,
        vs: true, zorunlu, yasak, siraLimiti: 40 });
      if (r.elendi) { const t = r.elendi.split(":")[0]; elenme[t] = (elenme[t] || 0) + 1; continue; }
      adaylar.push(Object.assign({}, a, { puan: r.puan, aramaIfadesi: q }));
    }
    adaylar.sort((a, b) => b.puan - a.puan);
    let deneme = 0;
    for (const a of adaylar) {
      if (deneme >= 8) break;
      deneme++;
      // gecici: ag/kodlayici sorunu (aday sonra indirilebilir) · tarafaOzgu: yalniz BU tarafin mevcut gorseliyle eslesti
      let gecici = false, tarafaOzgu = false;
      const indirSecenek = a.indirmeBasliklar ? { basliklar: Object.assign({}, a.indirmeBasliklar) } : undefined;
      for (const u of [a.url].concat(a.yedekUrl || [])) {
        if ((indirmeHata[a.kaynak] || 0) >= 5) { gecici = true; break; }
        try {
          const r = await o.getir.gorsel(u, indirSecenek);
          let v = dogrula(r.govde, { maksBayt: ag.MAKS_GORSEL_BAYT });
          if (!v.tamam) { const t = v.neden.split(" (")[0]; reddedilen[t] = (reddedilen[t] || 0) + 1; continue; }
          if (haric.sha1.has(v.sha1)) { reddedilen["mevcut görsel"] = (reddedilen["mevcut görsel"] || 0) + 1; tarafaOzgu = true; break; }
          const oran = v.en / v.boy;
          if (oran < ORAN_SINIRI[0] || oran > ORAN_SINIRI[1]) { reddedilen["kadraja uymayan oran"] = (reddedilen["kadraja uymayan oran"] || 0) + 1; break; }
          let buf = r.govde;
          if (v.tur === "png") {
            try { buf = cevir(buf); v = Object.assign({}, v, dogrula(buf, { minUzunKenar: 0 }), { tur: "jpg", uzanti: ".jpg" }); }
            catch (e) { reddedilen["PNG→JPEG dönüştürülemedi"] = (reddedilen["PNG→JPEG dönüştürülemedi"] || 0) + 1; gecici = true; continue; }
          }
          indirmeHata[a.kaynak] = 0;
          await indirmeBildir(a);
          return { buf, v, aday: a, sorgu: q, elenme, reddedilen };
        } catch (e) {
          indirmeHata[a.kaynak] = (indirmeHata[a.kaynak] || 0) + 1;
          if (!kaliciHataMi(e)) gecici = true;
          const t = "indirilemedi (" + ag.hataOzeti(e) + ")";
          reddedilen[t] = (reddedilen[t] || 0) + 1;
        }
      }
      // icerigi uygunsuz cikan aday (gorsel degil/dusuk cozunurluk/kadraja uymayan oran/kalici 4xx): sonraki sorgularda ve
      // (paylasilan redUrl ile) diger tarafta yeniden indirilmez
      if (!gecici && !tarafaOzgu) for (const k of adayAnahtarlari(a)) red.add(k);
      await bekle(150);
    }
    log('    "' + q + '": uygun aday bulunamadı' + (adaylar.length ? " (" + adaylar.length + " aday indirilemedi/uymadı)" : "") + " → sonraki sorgu");
  }
  return { buf: null, elenme, reddedilen };
}

// ---------------------------------------------------------------- bir tarafi kur (dosya + kaynak.json)
// o: {is, tarafAd:"ust"|"alt", tanim, yeniden, getir, yonetici, log, redUrl?, ilerleme?:{asama, adim, toplam}}
//   ilerleme verilirse tarafa baslarken @@ILERLEME basilir (n = adim+1 / toplam; panel yuzdeyi buradan gosterir)
// -> {durum:"var"|"indi"|"yok", mesaj}
async function tarafKur(o) {
  const log = o.log || (() => {});
  if (o.ilerleme && o.ilerleme.toplam > 0)
    ortak.ilerleme(o.ilerleme.asama, o.ilerleme.adim / o.ilerleme.toplam * 100, { n: o.ilerleme.adim + 1, toplam: o.ilerleme.toplam, is: o.is, taraf: o.tarafAd });
  const P = man.yollar(o.is);
  const img = path.join(P.BASE, "Images");
  fs.mkdirSync(img, { recursive: true });
  const hedef = path.join(img, o.tarafAd + ".jpg");
  const taraf = o.tanim[o.tarafAd];
  const eskiVar = fs.existsSync(hedef) && fs.statSync(hedef).size > MIN_BAYT;
  if (eskiVar && !o.yeniden) return { durum: "var", mesaj: o.tarafAd + ".jpg zaten var" };

  // yeniden/duzeltme: su an kurulu olan gorsel tekrar secilmesin
  const haric = { url: new Set(), sha1: new Set() };
  if (eskiVar) {
    try { haric.sha1.add(crypto.createHash("sha1").update(fs.readFileSync(hedef)).digest("hex")); } catch (e) {}
    const kj = kaynakJsonOku(o.is);
    const k = kj && kj[o.tarafAd];
    if (k) { for (const u of [k.indirmeUrl, k.kaynakUrl]) if (u) haric.url.add(puanModul.kanonikUrl(u)); }
  }
  const r = await tarafGorseliSec({ taraf, getir: o.getir, yonetici: o.yonetici, log, haric, bekle: o.bekle, jpegeCevirFn: o.jpegeCevirFn, redUrl: o.redUrl });
  if (!r.buf) {
    const nedenler = Object.entries(Object.assign({}, r.elenme, r.reddedilen)).map(([k, v]) => k + " " + v).join(", ");
    return { durum: "yok", mesaj: '"' + (taraf.ara || (taraf.sorgular || [])[0]) + '" için uygun görsel bulunamadı' + (nedenler ? " (" + nedenler + ")" : "") };
  }
  ortak.atomikYaz(hedef, r.buf);
  // kaynak.json + ATIF.txt
  const kj = kaynakJsonOku(o.is) || { surum: 1, olusturma: new Date().toISOString() };
  const kayit = man.kayitOlustur("Images/" + o.tarafAd + ".jpg", r.aday, r.v);
  kayit.sorgu = r.sorgu;
  kj[o.tarafAd] = kayit; kj.surum = 1; kj.guncelleme = new Date().toISOString();
  ortak.atomikJsonYaz(kaynakJsonYolu(o.is), kj);
  const sahte = { sahneler: [{ gorseller: TARAFLAR.map(t => kj[t]).filter(Boolean) }] };
  man.atifYaz(o.is, sahte);
  return { durum: "indi", mesaj: o.tarafAd + ".jpg  \"" + r.sorgu + "\"  " + r.v.en + "x" + r.v.boy + " " + r.aday.kaynak + " (" + ((r.buf.length / 1024) | 0) + " KB)", kayit };
}

// Gorsel kaynak yoneticisi (Pexels/Pixabay anahtar varsa; Wikimedia + Openverse her zaman; NASA ve muzeler yok: VS_HARIC)
function yoneticiOlustur(bag, log, uyari) {
  bag = bag || {};
  const getir = bag.getir || ag.istemciYap({ limitBekleSn: 30 });
  const ayar = ortak.ayarOku();
  const etkin = Object.assign({}, ayar.kaynaklar, { nasa: false });
  const yonetici = bag.yonetici || new KaynakYonetici({ getir, anahtarlar: bag.anahtarlar || { pexels: ortak.envOku("PEXELS_KEY"), pixabay: ortak.envOku("PIXABAY_KEY") },
    etkin, istemciler: bag.istemciler, log, uyari, bekle: bag.bekleKaynak, aralik: bag.aralik });
  return { getir, yonetici };
}

module.exports = { tanimDogrula, vsJsonUret, tarafSorgulari, tarafGorseliSec, tarafKur, yoneticiOlustur, kaynakJsonOku, HEDEF_ORAN, TARAFLAR, VS_HARIC };
