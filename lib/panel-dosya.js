// PANEL: IS DOSYALARI — konu.json / senaryo / altyazi okuma-yazma, gorunum, gorsel silme, disk, arsiv, rapor, VS tanimi.
// Yazan her yer ATOMIKTIR; konu.json yazmadan once .bak yedegi alinir; bozuk dosyanin ustune yazilmaz (SOZLESME 6.4-6.6).
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak");
const isler = require("./panel-isler");
const { HttpHata } = require("./panel-http");

const DOSYA_MAKS = 2 * 1024 * 1024;
const YAZILABILIR = ["konu", "senaryo", "altyazi", "kaynakmetin"];
const OKUNABILIR = {
  iddia: ["IDDIA-RAPORU.md", "IDDIA-RAPORU.json"], baslik: ["BASLIK-VE-ETIKETLER.md", "baslik.json"], atif: ["ATIF.txt", null],
  yayin: ["YAYIN-PAKETI.md", "yayin.json"], bolumler: ["bolumler.txt", null], srt: [null, null], renderSonuc: ["render-sonuc.json", "render-sonuc.json"],
  // yayin-durum.json: panelin "yuklendi/planli" isaretleri (Yayin sekmesi acilisinda okunur)
  yayinDurum: [null, "yayin-durum.json"],
  // senaryo-claude.js / senaryo-yaz.js hedef suresine ulasamazsa metni bu dosyaya kaydeder ve cikis 4 verir
  senaryoyarim: ["Voice/SESLENDIRME-TAM-METIN-yarim.txt", null],
};
const oku = isler.oku;

// Hangi ALTYAZI-XX.txt render tarafindan KULLANILIYOR? (lib/render-altyazi.js altyaziMetni ile ayni karar)
//   altyaziDili != dil            -> ALTYAZI-<altyaziDili>.txt  (altyazi-cevir.js bunu yazar)
//   konu.json'da altyaziDili YOK + dil != tr -> eski isler: ALTYAZI-TR.txt varsa Turkce altyazi olur
//   aksi halde ceviri dosyasi kullanilmaz (altyazi senaryo metninin kendisidir) -> null
function altyaziDosyaAdi(is) {
  try {
    const e = ortak.konuEtkin(is);
    if (!e) return null;
    if (e.altyaziDili && e.altyaziDili !== e.dil) return "ALTYAZI-" + e.altyaziDili.toUpperCase() + ".txt";
    const ham = ortak.konuHam(is) || {};
    if (ham.altyaziDili === undefined && e.dil !== "tr") return "ALTYAZI-TR.txt";
  } catch (e) { /* konu bozuksa: ceviri dosyasi bilinemez */ }
  return null;
}

function konuMetniCoz(icerik) {
  if (ortak.duzNesne(icerik)) return icerik;
  if (typeof icerik !== "string") throw new HttpHata(400, "icerik", "icerik metin (JSON) olmalı.");
  let o;
  try { o = ortak.jsonCoz(icerik, "konu.json"); }
  catch (e) {
    if (e instanceof ortak.OrtakHata && e.kod === "bozuk")
      throw new HttpHata(400, "konu_bozuk", e.message, { satir: e.satir, sutun: e.sutun, cozum: "Virgül, tırnak ve süslü parantezleri kontrol et; kaydedilmedi." });
    throw e;
  }
  if (!ortak.duzNesne(o)) throw new HttpHata(400, "konu_gecersiz", "konu.json bir JSON nesnesi olmalı ({ ... }).");
  return o;
}
function konuDogrulaFirlat(o) {
  const d = ortak.konuDogrula(o);
  if (!d.gecerli)
    throw new HttpHata(400, "konu_gecersiz", "konu.json geçersiz: " + d.hatalar.slice(0, 3).map(h => h.alan + " — " + h.mesaj).join("; "), { alanlar: d.hatalar });
  return d;
}
// Mevcut konu.json'u yedekleyip yeni nesneyi atomik yazar.
function konuYaz(is, nesne) {
  const d = konuDogrulaFirlat(nesne);
  const p = path.join(ortak.isDizin(is), "konu.json");
  try { if (fs.existsSync(p)) fs.copyFileSync(p, p + ".bak"); } catch (e) { /* yedek alinamadiysa yazmayi engelleme */ }
  ortak.atomikJsonYaz(p, nesne);
  isler.boyutuSifirla(ortak.isDizin(is));
  return d;
}
// Var olan konu.json'u OKU; bozuksa 409 (uzerine yazma). Yoksa null.
function konuOkuKati(is) {
  try { return ortak.konuHam(is); }
  catch (e) {
    if (e instanceof ortak.OrtakHata && (e.kod === "konu_bozuk" || e.kod === "konu_gecersiz"))
      throw new HttpHata(409, e.kod, "Bu işin konu.json dosyası bozuk; önce Ham ayarlar kutusundan düzelt. " + e.message, { satir: e.satir, sutun: e.sutun });
    throw e;
  }
}

// altyaziDosyaAdi() null donerse (altyazi dili = anlatim dili) bu isin ayri bir ceviri dosyasi YOKTUR: yolVe null doner,
// okuma bos icerik + "kullanilmiyor" bayragi, yazma acik bir 400 verir (eskiden path.join(..., null) TypeError → 500 'sunucu').
const ALTYAZI_KULLANILMIYOR = "Altyazı dili anlatım diliyle aynı; ayrı bir çeviri dosyası kullanılmıyor (altyazı senaryo metninden kurulur).";
function yolVe(is, tur) {
  const b = ortak.isDizin(is);
  if (tur === "konu") return path.join(b, "konu.json");
  if (tur === "senaryo") return path.join(b, "Voice", "SESLENDIRME-TAM-METIN.txt");
  if (tur === "altyazi") {
    konuOkuKati(is);                         // bozuk konu.json'da "kullanilmiyor" demek yaniltici olur: 409 konu_bozuk
    const ad = altyaziDosyaAdi(is);
    return ad ? path.join(b, "Voice", ad) : null;
  }
  return null;
}

function dosyaOku(is, tur) {
  const b = ortak.isDizin(is);
  if (tur === "konu") {
    let metin = ""; try { metin = fs.readFileSync(path.join(b, "konu.json"), "utf8").replace(/^﻿/, ""); } catch (e) {}
    return { icerik: metin };
  }
  if (tur === "altyazi") {
    const p = yolVe(is, tur);
    if (!p) return { icerik: "", kullanilmiyor: true, mesaj: ALTYAZI_KULLANILMIYOR };
    return { icerik: oku(p), dosya: path.basename(p) };
  }
  if (tur === "senaryo") return { icerik: oku(yolVe(is, tur)) };
  if (tur === "kaynakmetin") { const k = konuOkuKati(is); return { icerik: (k && k.arastirma) || "" }; }
  if (tur === "srt") {
    const a = path.join(b, "Videos", is + ".srt"), c = path.join(b, "altyazi.srt");
    return { icerik: isler.var_(a) ? oku(a) : oku(c) };
  }
  // yalniz kendi anahtarlari ("constructor", "__proto__" gecerli tur sayilmaz)
  const e = Object.prototype.hasOwnProperty.call(OKUNABILIR, tur) ? OKUNABILIR[tur] : null;
  if (!e) throw new HttpHata(400, "gecersiz_tur", "Geçersiz dosya türü.");
  const o = { icerik: e[0] ? oku(path.join(b, e[0])) : "" };
  if (!o.icerik && e[1]) o.icerik = oku(path.join(b, e[1]));
  if (e[1]) o.json = isler.jsonSessiz(path.join(b, e[1]), null);
  return o;
}

function dosyaYaz(is, tur, icerik) {
  if (!YAZILABILIR.includes(tur)) throw new HttpHata(400, "yalniz_okuma", "Bu dosya türü panelden yazılamaz.");
  if (tur === "altyazi" && !yolVe(is, tur))
    throw new HttpHata(400, "altyazi_kullanilmiyor", ALTYAZI_KULLANILMIYOR, { cozum: "Çeviri altyazısı istiyorsan Görünüm/Ses ayarlarından altyazı dilini anlatım dilinden farklı seç." });
  if (tur === "konu") {
    if (Buffer.byteLength(typeof icerik === "string" ? icerik : JSON.stringify(icerik || {})) > DOSYA_MAKS) throw new HttpHata(413, "cok_buyuk", "Dosya en çok 2 MB olabilir.");
    const o = konuMetniCoz(icerik);
    const d = konuYaz(is, o);
    return { ok: true, uyarilar: d.uyarilar };
  }
  if (typeof icerik !== "string") throw new HttpHata(400, "icerik", "icerik metin olmalı.");
  if (Buffer.byteLength(icerik) > DOSYA_MAKS) throw new HttpHata(413, "cok_buyuk", "Dosya en çok 2 MB olabilir.");
  if (tur === "kaynakmetin") {
    if (icerik.length > 20000) throw new HttpHata(400, "cok_uzun", "Kaynak metin en çok 20000 karakter olabilir.");
    const k = konuOkuKati(is);
    if (!k) throw new HttpHata(404, "konu_yok", "Bu işin konu.json dosyası yok.");
    if (icerik.trim()) k.arastirma = icerik; else delete k.arastirma;
    konuYaz(is, k);
    return { ok: true };
  }
  const p = yolVe(is, tur);
  const eski = oku(p);
  // degismisse eskisini Voice/yedek/ altina kopyala (hicbiri silinmez)
  if (eski.trim().length > 50 && eski !== icerik) {
    try {
      const yd = path.join(path.dirname(p), "yedek"); fs.mkdirSync(yd, { recursive: true });
      const ad = path.basename(p).replace(/\.txt$/, "").replace("SESLENDIRME-TAM-METIN", "SESLENDIRME");
      fs.writeFileSync(path.join(yd, ad + "-" + ortak.damga() + ".txt"), eski, "utf8");
    } catch (e) { /* yedek alinamadiysa yazmayi engelleme */ }
  }
  ortak.atomikYaz(p, icerik);
  isler.boyutuSifirla(ortak.isDizin(is));
  return { ok: true };
}

// ---------------------------------------------------------------- gorunum (konu.json'daki gorunum alanlari)
// Sozlesmedeki gorunum alanlari + ses/dil/tur alanlari (Ses karti: motor secimi, dil, hiz; Yayin/uslup: tur, ton, kisisel katki)
const GORUNUM = { gecis: "s", gecisSure: "n", efekt: "s", renk: "s", muzikSeviyesi: "n", muzikRuhu: "s", muzikDosyasi: "t", muzikDucking: "b",
  intro: "n", outro: "n", konuKarti: "n", geriSayim: "n", markaKose: "n", kanal: "s", slogan: "t", outroMetni: "o", altyazi: "b", altyaziStil: "s", vurguRenk: "s",
  ses: "s", sesHizi: "s", sesMotoru: "s", telaffuzPaketi: "b", dil: "s", altyaziDili: "s", tur: "s", ton: "t", kisiselKatki: "t" };
function sayiCevir(a, v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  throw new HttpHata(400, "konu_gecersiz", a + " sayı olmalı.", { alanlar: [{ alan: a, mesaj: "sayı olmalı" }] });
}
function mantikCevir(a, v) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true; if (v === "false") return false;
  throw new HttpHata(400, "konu_gecersiz", a + " true/false olmalı.", { alanlar: [{ alan: a, mesaj: "true/false olmalı" }] });
}
function gorunumUygula(is, b) {
  const k = konuOkuKati(is);
  if (!k) throw new HttpHata(404, "konu_yok", "Bu işin konu.json dosyası yok.");
  const yoksayilan = [];
  for (const a of Object.keys(b)) if (a !== "is" && !GORUNUM[a]) yoksayilan.push(a);
  for (const [a, tip] of Object.entries(GORUNUM)) {
    const v = b[a];
    if (v === undefined) continue;
    if (v === null) { delete k[a]; continue; }
    if (tip === "n") { if (v === "") continue; k[a] = sayiCevir(a, v); }
    else if (tip === "b") { if (v === "") continue; k[a] = mantikCevir(a, v); }
    else if (tip === "o") {
      if (!ortak.duzNesne(v)) throw new HttpHata(400, "konu_gecersiz", a + " nesne olmalı.");
      const o = Object.assign({}, ortak.duzNesne(k[a]) ? k[a] : {});
      for (const alt of ["baslik", "alt", "altSlogan"]) if (v[alt] !== undefined) { if (v[alt] === "" || v[alt] === null) delete o[alt]; else o[alt] = v[alt]; }
      if (Object.keys(o).length) k[a] = o; else delete k[a];
    } else if (tip === "t") { if (v === "") delete k[a]; else k[a] = v; }
    else { if (v === "") continue; k[a] = v; }
  }
  const d = konuYaz(is, k);
  return { ok: true, konu: k, uyarilar: d.uyarilar, yoksayilan };
}

function baslikSec(is, baslik) {
  if (typeof baslik !== "string" || !baslik.trim() || baslik.trim().length > 300) throw new HttpHata(400, "baslik", "Başlık 1–300 karakter olmalı.");
  const k = konuOkuKati(is);
  if (!k) throw new HttpHata(404, "konu_yok", "Bu işin konu.json dosyası yok.");
  k.baslik_en = baslik.trim();
  konuYaz(is, k);
  return { ok: true, baslik: k.baslik_en };
}

// ---------------------------------------------------------------- gorsel sil
function gorselSil(is, sahne, ad) {
  if (typeof sahne !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(sahne) || sahne.includes("..")) throw new HttpHata(400, "sahne", "Geçersiz sahne klasörü.");
  if (typeof ad !== "string" || path.basename(ad) !== ad || ad.startsWith(".") || !isler.GORSEL_UZ.test(ad)) throw new HttpHata(400, "ad", "Geçersiz görsel adı.");
  const vis = path.join(ortak.isDizin(is), "Visuals");
  const p = path.join(vis, sahne, ad);
  if (!ortak.yolIcinde(vis, p) || path.dirname(p) !== path.join(vis, sahne)) throw new HttpHata(400, "yol", "Geçersiz yol.");
  let buf;
  try { buf = fs.readFileSync(p); } catch (e) { throw new HttpHata(404, "yok", "Görsel bulunamadı."); }
  const sha = ortak.sha1(buf);
  const man = path.join(vis, "manifest.json");
  const m = isler.jsonSessiz(man, null);
  let kayit = null;
  if (m && Array.isArray(m.sahneler)) {
    for (const s of m.sahneler) {
      if (s.klasor !== sahne) continue;
      const i = (s.gorseller || []).findIndex(g => path.basename(String(g.dosya || "")) === ad);
      if (i >= 0) {
        kayit = s.gorseller.splice(i, 1)[0];
        if (!s.gorseller.length) s.durum = "eksik";
      }
    }
    m.toplamGorsel = m.sahneler.reduce((t, s) => t + (s.gorseller || []).length, 0);
  }
  fs.unlinkSync(p);
  if (kayit && m) {
    try { ortak.atomikJsonYaz(man, m); } catch (e) { /* manifest yazilamadi: dosya yine de silindi */ }
    // ATIF.txt silinen gorselin atfini tasimasin (silinen gorsel icin YouTube aciklamasina atif yazmak yanlis olur);
    // yayin paketi/yayin.json bir sonraki "Yayin paketi" adiminda manifestten yeniden kurulur.
    try { require("./gorsel-manifest").atifYaz(is, m); } catch (e) { /* atif dosyasi yenilenemedi: gorsel yine de silindi */ }
  }
  // silinenler.json: GO bu adresi/sha1'i tum sahnelerde disarida birakir
  const sp = path.join(ortak.isDizin(is), "silinenler.json");
  const s = isler.jsonSessiz(sp, null);
  const sl = s && ortak.duzNesne(s) && Array.isArray(s.silinenler) ? s : { surum: 1, silinenler: [] };
  sl.surum = 1;
  sl.silinenler.push({ sahne, ad, kaynakUrl: (kayit && (kayit.kaynakUrl || kayit.indirmeUrl)) || null, sha1: (kayit && kayit.sha1) || sha, zaman: new Date().toISOString() });
  try { ortak.atomikJsonYaz(sp, sl); } catch (e) {}
  isler.boyutuSifirla(ortak.isDizin(is));
  return { ok: true };
}

// ---------------------------------------------------------------- disk / arsiv
function araDosyalariTemizle(is) {
  const b = ortak.isDizin(is);
  const tmp = path.join(b, "_tmp");
  const once = isler.dizinBoyutu(tmp);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { throw new HttpHata(500, "silinemedi", "Ara dosyalar silinemedi (başka bir program kullanıyor olabilir)."); }
  ortak.partTemizle(b);
  isler.boyutuSifirla(b); isler.boyutuSifirla(tmp);
  return { ok: true, serbestMB: Math.round(once / 1048576 * 10) / 10 };
}
function arsivle(is) {
  const b = ortak.isDizin(is);
  if (!fs.existsSync(b)) throw new HttpHata(404, "is_yok", "Böyle bir iş yok.");
  const ar = path.join(ortak.uretimDizini(), "_arsiv");
  fs.mkdirSync(ar, { recursive: true });
  const hedef = path.join(ar, is + "-" + ortak.damga());
  try { fs.renameSync(b, hedef); }
  catch (e) { throw new HttpHata(500, "arsiv", "İş arşivlenemedi: " + (e.code === "EBUSY" || e.code === "EPERM" ? "dosyalar başka bir programda açık olabilir." : e.message)); }
  return { ok: true, arsiv: "_arsiv/" + path.basename(hedef) };
}
function diskOzeti() {
  const liste = [];
  let adlar = [];
  try { adlar = fs.readdirSync(ortak.uretimDizini(), { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith("_") && ortak.guvenliAd(d.name)).map(d => d.name); } catch (e) {}
  let toplam = 0;
  for (const ad of adlar) {
    const b = path.join(ortak.uretimDizini(), ad);
    const mb = isler.boyutMB(b), tmpMB = isler.boyutMB(path.join(b, "_tmp"), 20000);
    liste.push({ ad, mb, tmpMB }); toplam += mb;
  }
  liste.sort((a, b) => b.mb - a.mb);
  // uretim/_onbellek: isten bagimsiz ortak onbellek (geri sayim karti, cozunurluge gore ~10 MB). Is listesinde gorunmez,
  // ama diskte yer tutar; bu yuzden ayri raporlanir ve ayri temizlenir.
  const onbellekMB = isler.boyutMB(path.join(ortak.uretimDizini(), "_onbellek"), 20000);
  toplam += onbellekMB;
  return { bosGB: ortak.diskBosGB(ortak.uretimDizini()), uretimGB: Math.round(toplam / 1024 * 100) / 100, isler: liste, onbellekMB };
}
function onbellekTemizle() {
  const d = path.join(ortak.uretimDizini(), "_onbellek");
  const once = isler.dizinBoyutu(d);
  try { fs.rmSync(d, { recursive: true, force: true }); }
  catch (e) { throw new HttpHata(500, "silinemedi", "Ortak önbellek silinemedi (başka bir program kullanıyor olabilir)."); }
  isler.boyutuSifirla(d);
  return { ok: true, serbestMB: Math.round(once / 1048576 * 10) / 10 };
}

// ---------------------------------------------------------------- raporlar (trend / viral)
const raporDizini = tur => path.join(process.env.OTOMASYON_RAPOR_KOKU ? path.resolve(process.env.OTOMASYON_RAPOR_KOKU) : ortak.KOK, tur === "viral" ? "viral-analiz" : "trend");
function raporTuru(tur) { if (tur !== "trend" && tur !== "viral") throw new HttpHata(400, "tur", "Rapor türü trend ya da viral olmalı."); return tur; }
function raporListe(tur) {
  const d = raporDizini(raporTuru(tur));
  let out = [];
  try {
    for (const x of fs.readdirSync(d)) {
      if (!/\.md$/i.test(x)) continue;
      const st = fs.statSync(path.join(d, x));
      out.push({ ad: x.replace(/\.md$/i, ""), tarih: new Date(st.mtimeMs).toISOString(), mb: Math.round(st.size / 1048576 * 100) / 100 });
    }
  } catch (e) {}
  return out.sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
}
function raporOku(tur, ad) {
  const d = raporDizini(raporTuru(tur));
  const temiz = String(ad || "").replace(/\.(md|json)$/i, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/.test(temiz) || temiz.includes("..")) throw new HttpHata(400, "ad", "Geçersiz rapor adı.");
  const md = path.join(d, temiz + ".md");
  if (!ortak.yolIcinde(d, md) || !fs.existsSync(md)) throw new HttpHata(404, "yok", "Rapor bulunamadı.");
  return { md: oku(md), json: isler.jsonSessiz(path.join(d, temiz + ".json"), null) };
}

// ---------------------------------------------------------------- VS tanimi
function vsDogrula(g) {
  const hatalar = [];
  const h = (alan, mesaj) => hatalar.push({ alan, mesaj });
  const m = (v, min, maks) => typeof v === "string" && v.trim().length >= min && v.trim().length <= maks;
  if (!m(g.baslik, 1, 120)) h("baslik", "Başlık 1–120 karakter olmalı.");
  for (const t of ["ust", "alt"]) {
    const x = g[t];
    if (!ortak.duzNesne(x)) { h(t, "Taraf bilgisi (ad, renk, ara) gerekli."); continue; }
    if (!m(x.ad, 1, 40)) h(t + ".ad", "Ad 1–40 karakter olmalı.");
    if (x.renk !== undefined && !(typeof x.renk === "string" && /^[0-9A-Fa-f]{6}$/.test(x.renk))) h(t + ".renk", "6 haneli renk kodu olmalı (örn. 3BE07A).");
    if (!m(x.ara, 1, 80)) h(t + ".ara", "Görsel arama kelimesi 1–80 karakter olmalı.");
    for (const l of ["zorunlu", "sorgular", "yasak"]) if (x[l] !== undefined && (!Array.isArray(x[l]) || x[l].length > 6 || x[l].some(e => !m(e, 1, 80)))) h(t + "." + l, "en çok 6 kısa metinlik liste olmalı.");
  }
  if (!Array.isArray(g.olculer) || g.olculer.length < 1 || g.olculer.length > 8) h("olculer", "1–8 ölçü gerekli.");
  else g.olculer.forEach((o, i) => {
    const p = "olculer[" + i + "]";
    if (!ortak.duzNesne(o)) return h(p, "nesne olmalı");
    if (!m(o.ad, 1, 24)) h(p + ".ad", "Ölçü adı 1–24 karakter.");
    for (const a of ["ustDeger", "altDeger"]) if (typeof o[a] !== "number" || !Number.isFinite(o[a]) || o[a] < 0) h(p + "." + a, "0 ve üstü sayı olmalı.");
    for (const a of ["ustMetin", "altMetin"]) if (!m(o[a], 1, 24)) h(p + "." + a, "Ekranda görünen metin 1–24 karakter.");
    if (!["ust", "alt"].includes(o.kazanan)) h(p + ".kazanan", "ust ya da alt olmalı.");
    if (o.not !== undefined && !m(o.not, 0, 80)) h(p + ".not", "En çok 80 karakter.");
  });
  if (!["ust", "alt"].includes(g.kazanan)) h("kazanan", "ust ya da alt olmalı.");
  for (const a of ["sonuc", "sonuc2"]) if (g[a] !== undefined && !m(g[a], 0, 120)) h(a, "En çok 120 karakter.");
  return hatalar;
}
function vsYeni(g) {
  const hatalar = vsDogrula(g);
  if (hatalar.length) throw new HttpHata(400, "vs_gecersiz", "VS tanımı geçersiz: " + hatalar.slice(0, 3).map(x => x.alan + " — " + x.mesaj).join("; "), { alanlar: hatalar });
  const ad = ortak.slugla(typeof g.ad === "string" && g.ad.trim() ? g.ad : g.baslik, { maks: 48 });
  if (!ortak.guvenliAd(ad)) throw new HttpHata(400, "ad", "İş adı geçerli bir ada çevrilemedi.");
  const dizin = ortak.isDizin(ad);
  if (fs.existsSync(path.join(dizin, "konu.json")) && !fs.existsSync(path.join(dizin, "vs-tanim.json")))
    throw new HttpHata(409, "is_var", "Bu isimde bir video işi zaten var; başka bir ad seç.");
  const taraf = t => { const o = { ad: t.ad.trim(), renk: (t.renk || "FFFFFF").toUpperCase(), ara: t.ara.trim() }; if (t.zorunlu) o.zorunlu = t.zorunlu; if (t.sorgular) o.sorgular = t.sorgular; if (t.yasak) o.yasak = t.yasak; return o; };
  const tanim = {
    surum: 1, id: ad, baslik: g.baslik.trim(), altBaslik: "WHO WINS?", ust: taraf(g.ust), alt: taraf(g.alt),
    olculer: g.olculer.map(o => ({ ad: o.ad.trim(), ustDeger: o.ustDeger, ustMetin: o.ustMetin.trim(), altDeger: o.altDeger, altMetin: o.altMetin.trim(), kazanan: o.kazanan, not: (o.not || "").trim() })),
    kazanan: g.kazanan, sonuc: (g.sonuc || "").trim(), sonuc2: (g.sonuc2 || "").trim(),
  };
  fs.mkdirSync(dizin, { recursive: true });
  ortak.atomikJsonYaz(path.join(dizin, "vs-tanim.json"), tanim);
  return { ok: true, ad };
}

module.exports = { dosyaOku, dosyaYaz, konuYaz, konuOkuKati, gorunumUygula, baslikSec, gorselSil, araDosyalariTemizle, onbellekTemizle, arsivle, diskOzeti,
  raporListe, raporOku, vsYeni, vsDogrula, altyaziDosyaAdi, YAZILABILIR, OKUNABILIR, GORUNUM, konuMetniCoz };
