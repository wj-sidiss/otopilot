// lib/telaffuz.js — Turkce telaffuz ve diksiyon paketi (yalniz SES metnine; altyazi ozgun kalir).
//
// NEDEN VAR: Edge ve yerel VoxCPM2 Turkce sesi yabanci marka/teknoloji adlarini Turkce harf kurallariyla okuyordu
// ("YouTube", "vidIQ", "ChatGPT", "iPhone"); kullanici senaryoya elle "Yutup", "vid-ay-kyu" yazmak zorunda kaliyordu,
// bu da ALTYAZIYI bozuyordu. Paket, okunusu yalniz TTS'e giden metinde degistirir (lib/ses-metin.js metniHazirla).
//
// Parcalar:
//   1. Yerlesik okunus sozlugu: data/telaffuz-tr.json (gruplu; yukleyici duzlestirir).
//      - Tamami buyuk harf/rakam olan anahtar (AI, GPU, 4K) buyuk/kucuk harf DUYARLI; digerleri duyarsiz.
//      - Kelime siniri gozetilir; kesmeli ek korunur ("YouTube'da" -> "Yutup'da", "YouTube'u" -> "Yutub'u", "ChatGPT'ye" -> "Çet Ci Pi Ti'ye").
//      - En az 5 harfli, kisaltma olmayan anahtarlarda bitisik Turkce ek de taninir ("promptlar", "Instagramda");
//        ek YALNIZ bilinen ek parcalarindan olusuyor VE kendi icinde kalin/ince uyumluysa (ekGecerli), yoksa
//        "Apple"/"updated"/"Discordia"/"Twitterati" gibi baska kelimeye dokunulmaz.
//      - Ilk harf buyukse okunusun ilk harfi de buyutulur (cumle basi).
//      - "_buyukHarf" listesindeki girisler (Turkce kelimeyle cakisanlar: "Gemini" ~ "gemini" = gemi+n+i) yalniz
//        buyuk harfle baslayan yazimda ve bitisik ek tanimadan eslesir.
//      - "_unluOnu": unluyle baslayan ekten (bitisik ya da kesmeli) once kullanilan bicim ("Yutup" ama "Yutub'u").
//   2. Kullanici sozlugu (konu.json "okunus") ONCE uygulanir ve ciktisi korunur. Kullanici anahtari bir yerlesik
//      girisle ayniysa (kisaltmada birebir, digerlerinde buyuk/kucuk harf farki gozetmeden) yerlesik giris atlanir ve
//      kullanici girisi de o yerlesik gibi duyarsiz uygulanir: {"youtube": "Yutup"} "YouTube"u da kapsar (EZER).
//   3. Diksiyon kurali (otomatik, anlami degistirmez): paragraf basinda "Merhaba"/"Merhabalar" yalniz basina ya da
//      tek noktalamayla ("Merhaba." / "Merhaba," / "Merhaba!") gelirse -> "Merhaba!" ve sonraki cumle buyuk harfle
//      baslar ("Merhaba, ben Efe." -> "Merhaba! Ben Efe."; motorlar "h"yi yutup "meraba" diyordu; unlem vurgu ve
//      duraklama verir). Kalan metin "önce" ile basliyorsa UYGULANMAZ (VoxCPM cumle basi "Önce"yi bozuyor; kural
//      bunu uretmemeli). Baska kural OTOMATIK UYGULANMAZ; emin olunmayan durumlar diksiyon raporuna uyari olarak
//      gider (lib/diksiyon-rapor.js).
//
// KURAL ya da SOZLUK DEGISIRSE: PAKET_SURUMU artirilir (sozluk dosyasi zaten ozete girer); ozet degisince eski
// Turkce sesler "guncel degil" sayilip yeniden uretilir (ses-metin.js hazirlikOzeti).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PAKET_SURUMU = 2;
const SOZLUK_DOSYASI = path.join(__dirname, "..", "data", "telaffuz-tr.json");

// Ozel kullanim alani isaretleri: kullanici okunusunun ciktisini yerlesik sozlukten korur (sonra silinir).
const KORU_AC = "", KORU_KAPA = "";
const KORU_TEMIZLE = /[]/g;

const reKacis = s => String(s).replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
const ON_SINIR = "(?<![\\p{L}\\p{N}_])";
const ARKA_SINIR = "(?![\\p{L}\\p{N}_])";
const buyukIlk = s => s ? s.charAt(0).toLocaleUpperCase("tr") + s.slice(1) : s;
const kisaltmaMi = k => /^[\p{Lu}\p{N}]+$/u.test(k) && /\p{Lu}/u.test(k);

// Bitisik ek: yalniz bu parcalarin art arda dizilisi (uzun parca once). "ing", "ed", "s" gecmez.
const EK_PARCA = [
  "ımız", "imiz", "umuz", "ümüz", "ınız", "iniz", "unuz", "ünüz", "ları", "leri", "yken",
  "lar", "ler", "dan", "den", "tan", "ten", "nın", "nin", "nun", "nün", "lık", "lik", "luk", "lük",
  "dır", "dir", "dur", "dür", "tır", "tir", "tur", "tür", "yla", "yle", "sız", "siz", "suz", "süz",
  "da", "de", "ta", "te", "ın", "in", "un", "ün", "yı", "yi", "yu", "yü", "ya", "ye", "ım", "im", "um", "üm",
  "sı", "si", "su", "sü", "ki", "cı", "ci", "cu", "cü", "çı", "çi", "çu", "çü", "la", "le", "ca", "ce", "ça", "çe",
  "mı", "mi", "mu", "mü", "dı", "di", "du", "dü", "tı", "ti", "tu", "tü", "lı", "li", "lu", "lü", "nı", "ni", "nu", "nü",
  "ı", "i", "u", "ü", "a", "e",
];
const EK_RE = new RegExp("^(?:" + EK_PARCA.join("|") + ")+$");
const KALIN = "aıou", INCE = "eiöü";
const unluleri = s => (String(s).toLocaleLowerCase("tr").match(/[aeıioöuü]/g) || []);
// Bitisik ek: bilinen parcalar + kendi icinde kalin/ince uyumu ("ki", "yken" uyuma girmez: "Instagramdaki").
function ekGecerli(ek) {
  if (!EK_RE.test(ek)) return false;
  const u = unluleri(ek.replace(/yken|ki/g, ""));
  return u.every(c => KALIN.includes(c)) || u.every(c => INCE.includes(c));
}

// ---------------------------------------------------------------------------
// Sozluk yukleme
// ---------------------------------------------------------------------------
let _ham = null, _kurallar = null;

// -> {ham (dosya metni), girisler: [[yazilis, okunus, grup]], buyukHarf: Set(yazilis), unluOnu: {yazilis: okunus}}
function sozlukYukle(dosya) {
  const metin = fs.readFileSync(dosya || SOZLUK_DOSYASI, "utf8").replace(/^﻿/, "");
  const o = JSON.parse(metin);
  const girisler = [];
  for (const [grup, deger] of Object.entries(o)) {
    if (grup.startsWith("_") || !deger || typeof deger !== "object" || Array.isArray(deger)) continue;
    for (const [k, v] of Object.entries(deger)) if (k && typeof v === "string" && v) girisler.push([k, v, grup]);
  }
  const buyukHarf = new Set(Array.isArray(o._buyukHarf) ? o._buyukHarf.filter(k => typeof k === "string") : []);
  const unluOnu = {};
  if (o._unluOnu && typeof o._unluOnu === "object" && !Array.isArray(o._unluOnu))
    for (const [k, v] of Object.entries(o._unluOnu)) if (typeof v === "string" && v) unluOnu[k] = v;
  return { ham: metin, girisler, buyukHarf, unluOnu };
}

function yerlesik() {
  if (!_ham) _ham = sozlukYukle();
  return _ham;
}

// Yerlesik girisler: {yazilis: okunus} (rapor ve testler icin)
function yerlesikSozluk() {
  return Object.fromEntries(yerlesik().girisler.map(([k, v]) => [k, v]));
}

function kuralDerle([k, v], buyukHarf, unluOnu) {
  const duyarli = kisaltmaMi(k);
  const buyukZorunlu = !!(buyukHarf && buyukHarf.has(k));
  const ekli = !duyarli && !buyukZorunlu && /^[\p{L}]{5,}$/u.test(k);
  // grup 1: eslesen yazilis, grup 2: bitisik ek (varsa)
  const kaynak = ON_SINIR + "(" + reKacis(k) + ")" + (ekli ? "([a-zçğıöşü]{1,12})?" : "") + ARKA_SINIR;
  return { anahtar: k, kucuk: k.toLocaleLowerCase("tr"), okunus: v, unluOnu: (unluOnu && unluOnu[k]) || null,
    re: new RegExp(kaynak, duyarli ? "gu" : "giu"), ekli, duyarli, buyukZorunlu };
}

function yerlesikKurallar() {
  if (!_kurallar) {
    const y = yerlesik();
    _kurallar = y.girisler.map(g => kuralDerle(g, y.buyukHarf, y.unluOnu)).sort((a, b) => b.anahtar.length - a.anahtar.length);
  }
  return _kurallar;
}

// Bir yerlesik kural eslesmesini coz: null (dokunma) ya da {okunus (bitisik ek dahil)}.
//   tum/yazilis/arti: String.replace geri cagirma argumanlari (arti: [ek?, konum, metin]).
function eslesmeCoz(r, tum, yazilis, arti) {
  const ek = r.ekli ? arti[0] : undefined;                     // eksiz kuralda arti[0] eslesme konumudur (sayi)
  if (ek && !ekGecerli(ek)) return null;                       // "Apples", "updated", "Discordia": dokunma
  if (r.buyukZorunlu && !/^\p{Lu}/u.test(yazilis)) return null; // "gemini" (gemi+n+i) Turkce kelime
  let okunus = r.okunus;
  if (r.unluOnu) {
    const konum = arti[arti.length - 2], metin = arti[arti.length - 1];
    const sonra = typeof metin === "string" ? metin.slice(konum + tum.length) : "";
    const kesme = /^['’](\p{L})/u.exec(sonra);
    const ilk = ek ? ek.charAt(0) : (kesme ? kesme[1].toLocaleLowerCase("tr") : "");
    if (ilk && "aeıioöuü".includes(ilk)) okunus = r.unluOnu;
  }
  if (/^\p{Lu}/u.test(yazilis)) okunus = buyukIlk(okunus);
  return { okunus: okunus + (ek || "") };
}

// Kullanici anahtari hangi yerlesik kurallari ezer? Kisaltma (duyarli) kurali yalniz birebir ayni anahtarla,
// digerleri buyuk/kucuk harf farki gozetmeden. -> {ezilen: Set(kural.anahtar), duyarsiz: Set(kullanici anahtari)}
function ezmeCoz(kullanici) {
  const ezilen = new Set(), duyarsiz = new Set();
  const anahtarlar = Object.keys(kullanici && typeof kullanici === "object" ? kullanici : {});
  if (!anahtarlar.length) return { ezilen, duyarsiz };
  for (const r of yerlesikKurallar()) for (const k of anahtarlar) {
    if (r.duyarli ? k === r.anahtar : k.toLocaleLowerCase("tr") === r.kucuk) {
      ezilen.add(r.anahtar);
      if (!r.duyarli) duyarsiz.add(k);
    }
  }
  return { ezilen, duyarsiz };
}
const kullaniciRe = (k, duyarsiz) => new RegExp(ON_SINIR + reKacis(k) + ARKA_SINIR, duyarsiz && duyarsiz.has(k) ? "giu" : "gu");

// Paket ozeti: surum + sozluk dosyasinin icerigi. hazirlikOzeti'ne girer.
function paketOzeti() {
  return "p" + PAKET_SURUMU + "-" + crypto.createHash("sha1").update(yerlesik().ham).digest("hex").slice(0, 8);
}

// ---------------------------------------------------------------------------
// Uygulama
// ---------------------------------------------------------------------------
// Korunan bolgelerin (KORU_AC..KORU_KAPA) DISINDA fn uygula.
function disindaUygula(metin, fn) {
  return metin.split(/([^]*)/).map(p => p.startsWith(KORU_AC) ? p : fn(p)).join("");
}

// Kullanici sozlugu (ses-metin okunusUygula ile ayni eslesme: buyuk/kucuk duyarli, uzun anahtar once, en cok 200;
// yalniz bir yerlesik girisi ezen anahtar o giris gibi duyarsiz), ciktisi korunur.
function kullaniciUygula(metin, sozluk) {
  if (!sozluk || typeof sozluk !== "object") return metin;
  const anahtarlar = Object.keys(sozluk).filter(k => k && typeof sozluk[k] === "string")
    .sort((a, b) => b.length - a.length).slice(0, 200);
  const { duyarsiz } = ezmeCoz(sozluk);
  let m = metin;
  for (const k of anahtarlar) {
    const re = kullaniciRe(k, duyarsiz);
    m = disindaUygula(m, p => p.replace(re, () => KORU_AC + sozluk[k] + KORU_KAPA));
  }
  return m;
}

// Yerlesik sozluk. kullanici: konu.json okunus (ezdigi yerlesik giris atlanir, bkz. ezmeCoz).
// kayit(fn) verilirse her degisiklik icin {yazilis, okunus} bildirilir (rapor).
function yerlesikUygula(metin, kullanici, kayit) {
  const { ezilen } = ezmeCoz(kullanici);
  let m = metin;
  for (const r of yerlesikKurallar()) {
    if (ezilen.has(r.anahtar)) continue;
    m = disindaUygula(m, p => p.replace(r.re, (tum, yazilis, ...arti) => {
      const c = eslesmeCoz(r, tum, yazilis, arti);
      if (!c) return tum;
      if (kayit) kayit({ yazilis: tum, okunus: c.okunus });
      return KORU_AC + c.okunus + KORU_KAPA;                   // ciktisi sonraki (kisa) girislerden korunur
    }));
  }
  return m;
}

// Diksiyon: paragraf basinda "Merhaba" -> "Merhaba!" (sonraki kelimenin ilk harfi buyutulur).
// Noktalama: tek virgul, tek nokta ya da unlem. "Merhaba..." / "Merhaba?" ve noktalamasiz "Merhaba arkadaşlar"
// (selam bir sozcuk obegine bagli) DEGISMEZ. Kalan "önce" ile basliyorsa da DEGISMEZ: "Merhaba! Önce ..." VoxCPM'in
// bozdugu cumle basi "Önce"yi uretirdi.
const MERHABA = /^(\s*)(Merhaba(?:lar)?)(?:\s*(,|\.(?!\.)|!+))?(?![\p{L}\p{N}_.?…])\s*([\s\S]*)$/u;
function diksiyonUygula(metin, kayit) {
  const e = MERHABA.exec(metin);
  if (!e) return metin;
  const [, bas, selam, nokta, kalan] = e;
  if (!nokta && kalan) return metin;
  if (/^önce(?![\p{L}\p{N}_])/u.test(kalan.toLocaleLowerCase("tr"))) return metin;
  const yeni = bas + selam + "!" + (kalan ? " " + buyukIlk(kalan) : "");
  if (yeni !== metin && kayit) kayit({ yazilis: selam + (nokta || ""), okunus: selam + "!" });
  return yeni;
}

// ANA: Turkce TTS metni icin kullanici + yerlesik sozluk + diksiyon kurali.
//   secenek.kayit(fn) : uygulanan degisiklikleri bildirir (rapor)
function uygula(metin, kullanici, secenek) {
  const kayit = secenek && secenek.kayit;
  let m = String(metin == null ? "" : metin).replace(KORU_TEMIZLE, "");
  m = kullaniciUygula(m, kullanici);
  m = yerlesikUygula(m, kullanici, kayit);
  m = m.replace(KORU_TEMIZLE, "");
  return diksiyonUygula(m, kayit);
}

// Rapor icin: sozluklerin (kullanici + paket aciksa yerlesik) kapsadigi bolgeleri AYNI UZUNLUKTA bosluga cevirir;
// konumlar korunur, kalan kelimeler "okunusu tanimsiz" sayilir.
function kapsananlariMaskele(metin, kullanici, paketAcik) {
  const bosluk = s => " ".repeat(s.length);
  let m = String(metin == null ? "" : metin).replace(KORU_TEMIZLE, " ");
  const k = kullanici && typeof kullanici === "object" ? kullanici : {};
  const { ezilen, duyarsiz } = paketAcik ? ezmeCoz(k) : { ezilen: new Set(), duyarsiz: new Set() };
  for (const a of Object.keys(k).filter(x => x && typeof k[x] === "string").sort((a, b) => b.length - a.length).slice(0, 200))
    m = m.replace(kullaniciRe(a, duyarsiz), bosluk);
  if (!paketAcik) return m;
  for (const r of yerlesikKurallar()) {
    if (ezilen.has(r.anahtar)) continue;
    m = m.replace(r.re, (tum, yazilis, ...arti) => (eslesmeCoz(r, tum, yazilis, arti) ? bosluk(tum) : tum));
  }
  return m;
}

module.exports = {
  PAKET_SURUMU, SOZLUK_DOSYASI, EK_RE, ekGecerli, unluleri, sozlukYukle, yerlesikSozluk, paketOzeti, uygula, diksiyonUygula,
  kullaniciUygula, kisaltmaMi, kapsananlariMaskele,
};
