// ORTAK KUTUPHANE — betiklerin ve panelin paylastigi yardimcilar (SOZLESME v1, bolum 8).
// Sifir bagimlilik. Tum betikler .env okumayi, atomik yazmayi, konu.json okumayi,
// hata/cikis kodlarini ve konsol protokolunu BURADAN alir; kopya kod yok.
//
// Ortam gecersiz kilmalari (testler icin):
//   OTOMASYON_ENV_DOSYASI   .env yerine bu dosya okunur/yazilir
//   OTOMASYON_AYAR_DOSYASI  panel-ayar.json yerine
//   OTOMASYON_URETIM        uretim/ klasoru yerine
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const KOK =path.resolve(__dirname, "..");
const URETIM = process.env.OTOMASYON_URETIM
  ? path.resolve(process.env.OTOMASYON_URETIM) : path.join(KOK, "uretim");
const uretimDizini = () => process.env.OTOMASYON_URETIM
  ? path.resolve(process.env.OTOMASYON_URETIM) : path.join(KOK, "uretim");
const envDosyasi = () => process.env.OTOMASYON_ENV_DOSYASI
  ? path.resolve(process.env.OTOMASYON_ENV_DOSYASI) : path.join(KOK, ".env");
const ayarDosyasi = () => process.env.OTOMASYON_AYAR_DOSYASI
  ? path.resolve(process.env.OTOMASYON_AYAR_DOSYASI) : path.join(KOK, "panel-ayar.json");

// --- cikis kodlari (bolum 7.1) ---
// Adlar bilerek bol: her grup kendi sozcuguyle yazsa da ayni sayiya varsin.
const CIKIS = Object.freeze({
  BASARI: 0, TAMAM: 0,
  GENEL: 1, HATA: 1,
  GIRDI: 2, YAPILANDIRMA: 2, GIRDI_YAPILANDIRMA: 2,
  SERVIS: 3, DIS_SERVIS: 3,
  YETERSIZ: 4, YETERSIZ_SONUC: 4, SONUC: 4,
  DISK: 5, KAYNAK: 5, DISK_KAYNAK: 5,
  KILIT: 6,
  MALIYET: 7,
});

// ---------------------------------------------------------------- hata sinifi
const VARSAYILAN_MESAJ = {
  disk_dolu: "Diskte boş yer kalmadı.",
  disk_az: "Diskte yeterli boş yer yok.",
  bozuk: "JSON dosyası bozuk.",
  kilit: "Bu iş zaten çalışıyor.",
  font_yok: "Yazı tipi dosyası bulunamadı.",
  konu_bozuk: "konu.json bozuk.",
  konu_gecersiz: "konu.json geçersiz.",
  gecersiz_is: "Geçersiz iş adı.",
};
// "new" ile de, "new" olmadan da cagrilabilir; Error'dan turer.
function OrtakHata(kod, mesaj, secenek) {
  if (!(this instanceof OrtakHata)) return new OrtakHata(kod, mesaj, secenek);
  if (mesaj && typeof mesaj === "object" && secenek === undefined) { secenek = mesaj; mesaj = undefined; }
  secenek = secenek || {};
  const m = mesaj || VARSAYILAN_MESAJ[kod] || String(kod);
  this.message = m;
  this.name = "OrtakHata";
  this.kod = String(kod);
  this.cikis = Number.isInteger(secenek.cikis) ? secenek.cikis : 1;
  if (secenek.cozum) this.cozum = secenek.cozum;
  if (secenek.detay !== undefined) this.detay = secenek.detay;
  if (secenek.satir !== undefined) this.satir = secenek.satir;
  if (secenek.sutun !== undefined) this.sutun = secenek.sutun;
  if (Error.captureStackTrace) Error.captureStackTrace(this, OrtakHata);
}
OrtakHata.prototype = Object.create(Error.prototype, { constructor: { value: OrtakHata, writable: true, configurable: true } });
OrtakHata.prototype.toJSON = function () {
  return { kod: this.kod, mesaj: this.message, cikis: this.cikis, cozum: this.cozum, detay: this.detay,
           satir: this.satir, sutun: this.sutun };
};

// ---------------------------------------------------------------- kucuk yardimcilar
const bekle = ms => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) {} };
const duzNesne = o => o !== null && typeof o === "object" && !Array.isArray(o);
const sha1 = x => crypto.createHash("sha1").update(Buffer.isBuffer(x) ? x : String(x), "utf8").digest("hex");

function damga(d) {
  d = d || new Date();
  const p = (n, k = 2) => String(n).padStart(k, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

// ---------------------------------------------------------------- atomik yazma / JSON okuma
function diskDoluMu(e) { return e && (e.code === "ENOSPC" || e.code === "EDQUOT"); }
function diskDoluHatasi(e, dosya) {
  return new OrtakHata("disk_dolu", "Diskte boş yer kalmadı; dosya yazılamadı: " + path.basename(dosya), {
    cikis: CIKIS.DISK, cozum: "Disk alanı aç (panelde Disk bölümünden ara dosyaları temizle) ve tekrar dene.", detay: e.message });
}
// <dosya>.<pid>.tmp'ye yazip yeniden adlandirir: yarida kalan yazma hedefi bozmaz.
function atomikYaz(dosya, icerik) {
  const tmp = dosya + "." + process.pid + ".tmp";
  try {
    fs.mkdirSync(path.dirname(dosya), { recursive: true });
    fs.writeFileSync(tmp, icerik);
    let son;
    for (let i = 0; i < 6; i++) {
      try { fs.renameSync(tmp, dosya); son = null; break; }
      catch (e) {
        son = e;
        // Windows'ta hedef bir an baska surecte aciksa (antivirus, onizleme) kisa sure bekle
        if (!["EPERM", "EBUSY", "EACCES"].includes(e.code)) break;
        bekle(40 * (i + 1));
      }
    }
    if (son) throw son;
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (e2) {}
    if (diskDoluMu(e)) throw diskDoluHatasi(e, dosya);
    throw e;
  }
}
const atomikJsonYaz = (dosya, obj) => atomikYaz(dosya, JSON.stringify(obj, null, 2) + "\n");

// V8'in hata mesaji her zaman konum vermiyor; ilk soz dizimi hatasini kendimiz bulalim.
function jsonIlkHata(s) {
  let i = 0;
  const bosluk = () => { while (i < s.length && /[ \t\r\n]/.test(s[i])) i++; };
  const sabit = k => { if (s.startsWith(k, i)) { i += k.length; return true; } return false; };
  function deger() {
    bosluk();
    const c = s[i];
    if (c === "{") {
      i++; bosluk();
      if (s[i] === "}") { i++; return true; }
      for (;;) {
        bosluk(); if (s[i] !== '"') return false;
        if (!metin()) return false;
        bosluk(); if (s[i] !== ":") return false; i++;
        if (!deger()) return false;
        bosluk();
        if (s[i] === ",") { i++; continue; }
        if (s[i] === "}") { i++; return true; }
        return false;
      }
    }
    if (c === "[") {
      i++; bosluk();
      if (s[i] === "]") { i++; return true; }
      for (;;) {
        if (!deger()) return false;
        bosluk();
        if (s[i] === ",") { i++; continue; }
        if (s[i] === "]") { i++; return true; }
        return false;
      }
    }
    if (c === '"') return metin();
    if (sabit("true") || sabit("false") || sabit("null")) return true;
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i, i + 64));
    if (m) { i += m[0].length; return true; }
    return false;
  }
  function metin() {
    i++;
    while (i < s.length) {
      const c = s[i];
      if (c === '"') { i++; return true; }
      if (c === "\n" || c === "\r") return false;
      if (c === "\\") { i += 2; continue; }
      i++;
    }
    return false;
  }
  const ok = deger();
  if (ok) { bosluk(); if (i < s.length) return i; return -1; }
  return i;
}
// JSON.parse hatasindan satir/sutun cikar
function jsonKonum(metin, e) {
  const msg = String(e && e.message || "");
  let m = msg.match(/line (\d+) column (\d+)/);
  if (m) return { satir: +m[1], sutun: +m[2] };
  let poz = jsonIlkHata(metin);
  if (poz < 0) { m = msg.match(/position (\d+)/); poz = m ? +m[1] : 0; }
  poz = Math.min(poz, metin.length);
  const onceki = metin.slice(0, poz).split("\n");
  return { satir: onceki.length, sutun: onceki[onceki.length - 1].replace(/\r$/, "").length + 1 };
}
// V8'in Ingilizce JSON.parse mesajini Turkceye cevirir (konum satir/sutun olarak ayrica verilir; ham metin `detay`da kalir).
function jsonHataTurkce(msg) {
  const m = String(msg || "").split("\n")[0].replace(/\s*\(line \d+ column \d+\)\s*$/, "").replace(/\s+in JSON at position \d+\s*$/, "");
  let x;
  if (/^Unexpected end of JSON input/.test(m)) return "dosya beklenmedik yerde bitti (kapanmamış { [ ya da \" olabilir)";
  if (/^Unexpected non-whitespace character after JSON/.test(m)) return "JSON bittikten sonra fazladan karakter var";
  if ((x = /^Expected ',' or '([}\]])' after (?:property value|array element)/.exec(m))) return "değerden sonra virgül ya da '" + x[1] + "' bekleniyordu (virgül eksik olabilir)";
  if (/^Expected property name or '}'/.test(m)) return "özellik adı ya da '}' bekleniyordu (fazladan virgül olabilir)";
  if (/^Expected double-quoted property name/.test(m)) return "özellik adı çift tırnak içinde olmalı (fazladan virgül olabilir)";
  if (/^Expected ':' after property name/.test(m)) return "özellik adından sonra ':' bekleniyordu";
  if (/^Unterminated string/.test(m)) return "tırnak kapanmamış";
  if (/^Bad control character/.test(m)) return "metnin içinde satır sonu ya da denetim karakteri var (tırnak içinde \\n yaz)";
  if (/^Bad escaped character/.test(m)) return "geçersiz kaçış karakteri (ters eğik çizgi)";
  if ((x = /^Unexpected token '(.)'/.exec(m))) return "beklenmeyen karakter '" + x[1] + "'";
  if ((x = /^Unexpected (number|string)/.exec(m))) return "beklenmeyen " + (x[1] === "number" ? "sayı" : "metin") + " (virgül eksik olabilir)";
  if (/is not valid JSON|^No number after|^Exponent part|^Unterminated fractional/.test(m)) return "geçerli JSON değil";
  return "söz dizimi hatası";
}
function jsonCoz(metin, etiket) {
  const temiz = String(metin).replace(/^﻿/, "");
  try { return JSON.parse(temiz); }
  catch (e) {
    const k = temiz.trim() === "" ? { satir: 1, sutun: 1 } : jsonKonum(temiz, e);
    throw new OrtakHata("bozuk", (etiket || "JSON") + " bozuk (satır " + k.satir + ", sütun " + k.sutun + "): " +
      (temiz.trim() === "" ? "dosya boş" : jsonHataTurkce(e.message)),
      { cikis: CIKIS.GIRDI, satir: k.satir, sutun: k.sutun, detay: e.message });
  }
}
// Dosya yoksa varsayilan; var ama bozuksa OrtakHata('bozuk',{satir,sutun}).
function jsonOku(dosya, varsayilan) {
  let metin;
  try { metin = fs.readFileSync(dosya, "utf8"); }
  catch (e) { if (e.code === "ENOENT" || e.code === "ENOTDIR") return varsayilan; throw e; }
  return jsonCoz(metin, path.basename(dosya));
}

// ---------------------------------------------------------------- .env
function envSatiri(l) {
  const m = String(l).match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!m || /^\s*#/.test(l)) return null;
  let v = m[2];
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) v = v.slice(1, -1);
  return { ad: m[1], deger: v };
}
function envDosyaIcerik() {
  try { return fs.readFileSync(envDosyasi(), "utf8").replace(/^﻿/, ""); } catch (e) { return ""; }
}
// Dosyadaki tum anahtarlar (process.env'e BAKMAZ)
function envHepsi() {
  const o = {};
  for (const l of envDosyaIcerik().split(/\r?\n/)) { const s = envSatiri(l); if (s) o[s.ad] = s.deger; }
  return o;
}
// .env > process.env. Yoksa "" (dogruluk testi icin).
function envOku(ad) {
  const d = envHepsi()[ad];
  if (d) return d;
  return process.env[ad] ? String(process.env[ad]).trim() : "";
}
// ayarla:{AD:"deger"}, sil:["AD"]. Yorumlari ve bilinmeyen satirlari korur.
function envYaz(secenek) {
  const ayarla = (secenek && secenek.ayarla) || {}, sil = (secenek && secenek.sil) || [];
  for (const [k, v] of Object.entries(ayarla)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) throw new OrtakHata("env_ad", "Geçersiz anahtar adı: " + k, { cikis: CIKIS.GIRDI });
    if (typeof v !== "string" || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(v))
      throw new OrtakHata("env_deger", k + " değeri tek satırlık, kontrol karakteri içermeyen metin olmalı.", { cikis: CIKIS.GIRDI });
  }
  const eski = envDosyaIcerik();
  const crlf = /\r\n/.test(eski);
  const satirlar = eski === "" ? [] : eski.replace(/\r?\n$/, "").split(/\r?\n/);
  const yazildi = new Set();
  const silSet = new Set(sil);
  const yeni = [];
  for (const l of satirlar) {
    const s = envSatiri(l);
    if (!s) { yeni.push(l); continue; }
    if (silSet.has(s.ad)) continue;
    if (Object.prototype.hasOwnProperty.call(ayarla, s.ad)) {
      if (yazildi.has(s.ad)) continue;
      yazildi.add(s.ad); yeni.push(s.ad + "=" + ayarla[s.ad]);
    } else yeni.push(l);
  }
  for (const [k, v] of Object.entries(ayarla)) if (!yazildi.has(k)) yeni.push(k + "=" + v);
  atomikYaz(envDosyasi(), yeni.join(crlf ? "\r\n" : "\n") + (yeni.length ? (crlf ? "\r\n" : "\n") : ""));
}

// ---------------------------------------------------------------- ad / yol guvenligi
const REZERVE_AD = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const guvenliAd = s => typeof s === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(s) && !REZERVE_AD.test(s);
function isDizin(is, uretim) {
  if (!guvenliAd(is)) throw new OrtakHata("gecersiz_is", "Geçersiz iş adı: yalnızca harf, rakam, tire ve alt çizgi (en çok 64 karakter).", { cikis: CIKIS.GIRDI });
  return path.join(uretim || uretimDizini(), is);
}
// hedef, taban'in ICINDE mi (taban dahil). startsWith DEGIL: 'abc' ile 'abcd' karismaz.
function yolIcinde(taban, hedef) {
  const rel = path.relative(path.resolve(taban), path.resolve(hedef));
  if (rel === "") return true;
  if (path.isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(".." + path.sep);
}

// ---------------------------------------------------------------- metin yardimcilari
// KANONIK paragraf listesi: hicbir grup paragraf dusurmez / yeniden numaralamaz.
function paragraflaraBol(metin) {
  return String(metin == null ? "" : metin).replace(/\r\n/g, "\n").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}
function paragrafOzeti(paragraflar) {
  const liste = typeof paragraflar === "string" ? paragraflaraBol(paragraflar) : (paragraflar || []);
  return sha1(liste.map(p => String(p).normalize("NFC")).join("\n\n"));
}
const TR_HARITA = { "ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "İ": "i", "I": "i", "ö": "o", "Ö": "o",
  "ş": "s", "Ş": "s", "ü": "u", "Ü": "u", "â": "a", "Â": "a", "î": "i", "Î": "i", "û": "u", "Û": "u",
  "ß": "ss", "æ": "ae", "Æ": "ae", "ø": "o", "Ø": "o", "đ": "d", "Đ": "d", "ł": "l", "Ł": "l" };
function slugla(s, secenek) {
  const maks = (secenek && secenek.maks) || 60;
  const ham = String(s == null ? "" : s);
  const latinDisi = /(?![\p{Script=Latin}])\p{L}/u.test(ham);
  const ascii = ham.replace(/[çÇğĞıİIöÖşŞüÜâÂîÎûÛßæÆøØđĐłŁ]/g, c => TR_HARITA[c] || c)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let r;
  if (latinDisi) r = (ascii ? ascii + "-" : "n-") + sha1(ham).slice(0, 6);
  else r = ascii;
  if (!r) r = "n-" + sha1(ham).slice(0, 6);
  if (r.length > maks) r = r.slice(0, maks).replace(/-+$/, "");
  return r;
}

// ---------------------------------------------------------------- dil / format
const KELIME_HIZI = { en: 151, tr: 113 };         // 151 ve 113 OLCULDU; digerleri TAHMIN
const kelimeHizi = dil => KELIME_HIZI[String(dil || "en").toLowerCase().slice(0, 2)] || 140;
const FORMAT_SINIR = {
  long:   { oneriSn: 900, teknikMaxSn: 3600, dikey: false },
  short:  { oneriSn: 40,  teknikMaxSn: 180,  dikey: true },    // Ekim 2024'te 45 -> 180 sn; YouTube Yardim'dan teyit et
  reels:  { oneriSn: 180, teknikMaxSn: 1200, dikey: true },
  tiktok: { oneriSn: 60,  teknikMaxSn: 600,  dikey: true },
};
const formatSiniri = f => Object.assign({}, FORMAT_SINIR[f] || FORMAT_SINIR.long);
const SES_TABLO = { en: "en-US-ChristopherNeural", tr: "tr-TR-AhmetNeural", es: "es-ES-AlvaroNeural",
  de: "de-DE-ConradNeural", fr: "fr-FR-HenriNeural", it: "it-IT-DiegoNeural", pt: "pt-BR-AntonioNeural",
  ru: "ru-RU-DmitryNeural", nl: "nl-NL-MaartenNeural", pl: "pl-PL-MarekNeural", ja: "ja-JP-KeitaNeural",
  ko: "ko-KR-InJoonNeural", ar: "ar-SA-HamedNeural", hi: "hi-IN-MadhurNeural" };
const varsayilanSes = dil => SES_TABLO[String(dil || "en").toLowerCase().slice(0, 2)] || SES_TABLO.en;
// VoxCPM2 sesleri (yerel GPU motoru, lib/ses-motor-voxcpm.js): ses adi "voxcpm:<ad>" (sesler/voxcpm2/<ad>, depodaki
// hazir sesler) ya da "voxcpm:<ad>/<cesit>" (kullanicinin VoxCPM klasorunde kendi tasarladigi ses). Dile gore varsayilan:
const VOXCPM_SES_DIZINI = path.join(KOK, "sesler", "voxcpm2");
const VOXCPM_VARSAYILAN = Object.freeze({ tr: "tok_anlatici", en: "anlatici_en", de: "anlatici_de", es: "anlatici_es",
  fr: "anlatici_fr", ja: "anlatici_ja", ru: "anlatici_ru", zh: "anlatici_zh" });
const VOXCPM_SES_ADI = /^voxcpm:([a-z0-9_]{1,40})(?:\/([1-9]\d?))?$/;
const voxcpmSesiMi = s => typeof s === "string" && /^voxcpm:/i.test(s.trim());
// Hazir sesin dili (ses.json "dil"; Turkce seslerde alan yok -> "tr"). Ses yoksa null.
function voxcpmSesDili(ad) {
  if (!/^[a-z0-9_]{1,40}$/.test(String(ad || ""))) return null;
  try {
    const kart = JSON.parse(fs.readFileSync(path.join(VOXCPM_SES_DIZINI, ad, "ses.json"), "utf8").replace(/^\uFEFF/, ""));
    return String(kart.dil || "tr").toLowerCase();
  } catch (e) { return null; }
}
// "voxcpm:<ad>" hazir sesinin dili (Edge adindaki "tr-" onekinin karsiligi). Tasarlanan ses (<ad>/<cesit>) ya da
// bilinmeyen ad: null (dil bilinmiyor; cagiran kendi varsayilanini kullanir).
function voxcpmKimlikDili(ses) {
  if (!voxcpmSesiMi(ses)) return null;
  const m = VOXCPM_SES_ADI.exec(ses.trim());
  return m && !m[2] ? voxcpmSesDili(m[1]) : null;
}
// Ayardaki ses o dilin sesiyse onu kullan; degilse (ornegin dil tr yapilmis ama ses hala Ingilizce) dilin varsayilan sesi.
// VoxCPM sesi baska dilinse ayni motorun o dildeki varsayilan sesi (o dilde VoxCPM sesi yoksa Edge varsayilani).
function sesSec(dil, ayarSes) {
  const d = String(dil || "en").toLowerCase().slice(0, 2);
  if (voxcpmSesiMi(ayarSes)) {
    const m = VOXCPM_SES_ADI.exec(ayarSes.trim());
    if (m && (m[2] || voxcpmSesDili(m[1]) === d)) return ayarSes.trim();
    return VOXCPM_VARSAYILAN[d] ? "voxcpm:" + VOXCPM_VARSAYILAN[d] : varsayilanSes(d);
  }
  if (typeof ayarSes === "string" && ayarSes.toLowerCase().startsWith(d + "-")) return ayarSes;
  return varsayilanSes(d);
}

// ---------------------------------------------------------------- konu.json sozlesmesi (bolum 1)
const GECISLER = ["fade", "dissolve", "fadeblack", "fadewhite", "slideleft", "slideright", "slideup", "slidedown",
  "smoothleft", "smoothright", "wipeleft", "wiperight", "wipeup", "wipedown", "wipetl", "circleopen", "circleclose",
  "circlecrop", "rectcrop", "radial", "vertopen", "horzopen", "pixelize", "hblur", "distance", "squeezeh",
  "squeezev", "diagtl", "hlslice"];
const EFEKTLER = ["zoom", "yavas", "hizli", "kaydir", "yok"];
const RENKLER = ["sinematik", "sicak", "soguk", "canli", "siyahbeyaz", "yok"];
const TURLER = ["belgesel", "reklam", "haber-spor", "egitim", "hikaye", "tanitim"];
const MUZIK_RUHLARI = ["sakin", "gerilim", "umut", "enerjik", "otomatik"];
const FORMATLAR = ["long", "short", "reels", "tiktok"];
const SES_MOTORLARI = ["otomatik", "edge", "azure", "piper", "voxcpm"];
const KONU_BILINEN = new Set(["surum", "baslik_en", "_not", "kanal", "slogan", "format", "aspect", "hedefSaniye",
  "hedefDakika", "geriSayim", "intro", "konuKarti", "outro", "muzikSeviyesi", "gecis", "gecisSure", "efekt", "renk",
  "ses", "sesHizi", "sahneKelimeleri", "uretStil", "uretAdet", "formuller", "promptlar", "portreler", "sahneler",
  "aciklamaBrief", "arastirma", "ton", "dil", "altyaziDili", "altyazi", "altyaziStil", "sesMotoru", "okunus", "tur",
  "kanalSesi", "kisiselKatki", "onay", "acilisStili", "markaKose", "vurguRenk", "outroMetni", "muzikDosyasi",
  "muzikRuhu", "muzikDucking", "cesitlilik", "maliyetUstSinirUSD", "yayin"]);

function konuDogrula(o) {
  const hatalar = [], uyarilar = [];
  const h = (alan, mesaj) => hatalar.push({ alan, mesaj });
  if (!duzNesne(o)) { h("(kök)", "konu.json bir JSON nesnesi olmalı."); return { gecerli: false, hatalar, uyarilar }; }
  const var_ = a => o[a] !== undefined && o[a] !== null;
  const metin = (a, min, maks) => {
    if (!var_(a)) return;
    if (typeof o[a] !== "string") return h(a, "metin olmalı");
    const n = a === "baslik_en" ? o[a].trim().length : o[a].length;
    if (n < min || n > maks) h(a, min + "–" + maks + " karakter olmalı (şu an " + n + ")");
  };
  const sayi = (a, min, maks, tam) => {
    if (!var_(a)) return;
    if (typeof o[a] !== "number" || !Number.isFinite(o[a])) return h(a, "sayı olmalı");
    if (tam && !Number.isInteger(o[a])) return h(a, "tam sayı olmalı");
    if (o[a] < min || o[a] > maks) h(a, min + " ile " + maks + " arasında olmalı");
  };
  const secim = (a, liste) => { if (var_(a) && !liste.includes(o[a])) h(a, "şunlardan biri olmalı: " + liste.join(", ")); };
  const mantik = a => { if (var_(a) && typeof o[a] !== "boolean") h(a, "true/false olmalı"); };
  const nesne = a => { if (!var_(a)) return false; if (!duzNesne(o[a])) { h(a, "nesne olmalı"); return false; } return true; };

  if (var_("surum") && (typeof o.surum !== "number" || o.surum > 1)) uyarilar.push({ alan: "surum", mesaj: "Bilinmeyen/üst sürüm; alanlar yanlış yorumlanabilir." });
  metin("baslik_en", 1, 300); metin("_not", 0, 5000); metin("kanal", 0, 60); metin("slogan", 0, 120);
  secim("format", FORMATLAR); secim("aspect", ["16:9", "9:16"]);
  if (var_("format") && var_("aspect") && FORMATLAR.includes(o.format)) {
    const bek = o.format === "long" ? "16:9" : "9:16";
    if (o.aspect !== bek) uyarilar.push({ alan: "aspect", mesaj: "format '" + o.format + "' için beklenen oran " + bek + "." });
  }
  sayi("hedefSaniye", 15, 3600); sayi("hedefDakika", 0.25, 60);
  if (var_("geriSayim") && o.geriSayim !== 0 && o.geriSayim !== 5) h("geriSayim", "0 veya 5 olmalı");
  sayi("intro", 0, 30); sayi("konuKarti", 0, 30); sayi("outro", 0, 30);
  sayi("muzikSeviyesi", 0, 1); secim("gecis", GECISLER); sayi("gecisSure", 0.2, 4);
  secim("efekt", EFEKTLER); secim("renk", RENKLER);
  metin("ses", 0, 120);
  if (voxcpmSesiMi(o.ses) && !VOXCPM_SES_ADI.test(o.ses.trim()))
    h("ses", "VoxCPM sesi 'voxcpm:<ad>' biçiminde olmalı (ör. voxcpm:tok_anlatici; küçük harf, rakam, alt çizgi)");
  if (var_("sesHizi")) {
    if (typeof o.sesHizi !== "string" || !/^[+-]\d{1,2}%$/.test(o.sesHizi)) h("sesHizi", "+7% / -10% gibi olmalı");
    else if (Math.abs(parseInt(o.sesHizi, 10)) > 50) h("sesHizi", "-50% ile +50% arasında olmalı");
  }
  if (var_("sahneKelimeleri")) {
    if (!Array.isArray(o.sahneKelimeleri)) h("sahneKelimeleri", "liste olmalı");
    else o.sahneKelimeleri.forEach((e, i) => {
      const ok = typeof e === "string" || (Array.isArray(e) && e.every(x => typeof x === "string"));
      if (!ok) h("sahneKelimeleri[" + i + "]", "metin ya da metin listesi olmalı");
    });
  }
  metin("uretStil", 0, 300); sayi("uretAdet", 1, 6, true);
  const ADLI = /^[A-Za-z0-9 _-]{1,40}$/;
  for (const a of ["formuller", "promptlar", "portreler", "sahneler"]) {
    if (!var_(a)) continue;
    if (!Array.isArray(o[a])) { h(a, "liste olmalı"); continue; }
    o[a].forEach((e, i) => {
      if (!duzNesne(e)) return h(a + "[" + i + "]", "nesne olmalı");
      for (const k of ["n", "hedef"])
        if (e[k] !== undefined && (typeof e[k] !== "string" || !ADLI.test(e[k])))
          h(a + "[" + i + "]." + k, "yalnız harf, rakam, boşluk, tire ve alt çizgi (1–40 karakter); nokta ve eğik çizgi yasak");
    });
  }
  metin("aciklamaBrief", 0, 20000); metin("arastirma", 0, 20000); metin("ton", 0, 200);
  if (var_("dil") && !(typeof o.dil === "string" && /^[a-z]{2}$/.test(o.dil))) h("dil", "iki küçük harf olmalı (en, tr, es…)");
  if (var_("altyaziDili") && !(typeof o.altyaziDili === "string" && /^[a-z]{2}$/.test(o.altyaziDili))) h("altyaziDili", "iki küçük harf olmalı (en, tr, es…)");
  mantik("altyazi"); secim("altyaziStil", ["cumle", "kelime"]); secim("sesMotoru", SES_MOTORLARI);
  if (nesne("okunus")) {
    const ent = Object.entries(o.okunus);
    if (ent.length > 200) h("okunus", "en çok 200 giriş olabilir");
    for (const [k, v] of ent) if (!k || k.length > 60 || typeof v !== "string" || v.length > 120) { h("okunus", "'" + k + "' girişi geçersiz (anahtar ≤60, değer metin ≤120)"); break; }
  }
  secim("tur", TURLER);
  if (nesne("kanalSesi")) {
    const k = o.kanalSesi;
    if (k.tarif !== undefined && (typeof k.tarif !== "string" || k.tarif.length > 500)) h("kanalSesi.tarif", "metin, en çok 500 karakter");
    if (k.ornekParagraf !== undefined && (typeof k.ornekParagraf !== "string" || k.ornekParagraf.length > 1000)) h("kanalSesi.ornekParagraf", "metin, en çok 1000 karakter");
  }
  metin("kisiselKatki", 0, 1500);
  if (nesne("onay")) for (const k of ["senaryo", "gorsel"])
    if (o.onay[k] !== undefined && typeof o.onay[k] !== "boolean") h("onay." + k, "true/false olmalı");
  secim("acilisStili", ["hizli", "sinematik"]); sayi("markaKose", 0, 10);
  if (var_("vurguRenk") && !(typeof o.vurguRenk === "string" && /^[0-9A-Fa-f]{6}$/.test(o.vurguRenk))) h("vurguRenk", "6 haneli renk kodu olmalı (örn. 6FD8FF, # yok)");
  if (nesne("outroMetni")) for (const k of ["baslik", "alt", "altSlogan"])
    if (o.outroMetni[k] !== undefined && (typeof o.outroMetni[k] !== "string" || o.outroMetni[k].length > 80)) h("outroMetni." + k, "metin, en çok 80 karakter");
  metin("muzikDosyasi", 0, 400); secim("muzikRuhu", MUZIK_RUHLARI); mantik("muzikDucking"); mantik("cesitlilik");
  // yalniz ses dosyasi uzantisi: yol ffmpeg'e -i olarak gider; panelden .txt/.m3u8/.ffconcat gibi icerigi yorumlanan dosyalar (ffmpeg listesi) gosterilemesin
  if (typeof o.muzikDosyasi === "string" && o.muzikDosyasi.trim() !== "" && !/\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma|aif|aiff|mka)$/i.test(o.muzikDosyasi.trim()))
    h("muzikDosyasi", "ses dosyası olmalı (mp3, wav, m4a, aac, ogg, opus, flac, wma, aiff ya da mka)");
  sayi("maliyetUstSinirUSD", 0, 1e6);
  if (nesne("yayin")) {
    const y = o.yayin;
    if (y.hashtagler !== undefined && (!Array.isArray(y.hashtagler) || y.hashtagler.length > 15 || y.hashtagler.some(x => typeof x !== "string")))
      h("yayin.hashtagler", "en çok 15 metinlik liste olmalı");
    for (const k of ["aciklamaSablonu", "seri"]) if (y[k] !== undefined && typeof y[k] !== "string") h("yayin." + k, "metin olmalı");
  }
  for (const k of Object.keys(o)) if (!KONU_BILINEN.has(k) && !k.startsWith("_"))
    uyarilar.push({ alan: k, mesaj: "Bilinmeyen alan (yazım hatası olabilir); olduğu gibi korunur." });
  return { gecerli: hatalar.length === 0, hatalar, uyarilar };
}

function konuHam(is) {
  const dosya = path.join(isDizin(is), "konu.json");
  let metin;
  try { metin = fs.readFileSync(dosya, "utf8"); }
  catch (e) { if (e.code === "ENOENT" || e.code === "ENOTDIR") return null; throw e; }
  let o;
  try { o = jsonCoz(metin, "konu.json"); }
  catch (e) {
    if (e instanceof OrtakHata && e.kod === "bozuk")
      throw new OrtakHata("konu_bozuk", e.message, { cikis: CIKIS.GIRDI, satir: e.satir, sutun: e.sutun, detay: e.detay,
        cozum: "Panelde Ham ayarlar kutusunu aç ve JSON'u düzelt (virgül/tırnak hatası olabilir)." });
    throw e;
  }
  if (!duzNesne(o)) throw new OrtakHata("konu_gecersiz", "konu.json geçersiz: dosya bir JSON nesnesi olmalı.", { cikis: CIKIS.GIRDI });
  return o;
}

// konu.json > panel-ayar.json > varsayilan. Dosya yoksa null.
// gecis/efekt/renk/muzikRuhu VERILMEMISSE undefined kalir (cesitlilik rotasyonu bilmeli).
function konuBirlestir(konu, ayar, is) {
  const d = konuDogrula(konu);
  if (!d.gecerli)
    throw new OrtakHata("konu_gecersiz", "konu.json geçersiz: " + d.hatalar.map(x => x.alan + " — " + x.mesaj).join("; "),
      { cikis: CIKIS.GIRDI, detay: d.hatalar, cozum: "Panelde Ham ayarlar kutusundan ilgili alanları düzelt." });
  ayar = ayar || ayarOku();
  const k = konu;
  const fmt = FORMATLAR.includes(k.format) ? k.format : (k.aspect === "9:16" ? "short" : "long");
  const dikey = fmt !== "long";
  const sesOnek = typeof k.ses === "string" && /^[a-z]{2}[-_]/i.test(k.ses) ? k.ses.slice(0, 2).toLowerCase()
    : voxcpmKimlikDili(k.ses);                          // VoxCPM hazir sesi: dil ses kartindan (anlatici_en -> en)
  const dil = k.dil || sesOnek || ayar.dil || "en";
  const ses = k.ses || sesSec(dil, ayar.ses);
  const KS = { short: [0, 1.5, 0, 3], reels: [0, 1.5, 0, 0], tiktok: [0, 1.5, 0, 0], long: [5, 8, 2.5, 12] }[fmt];
  const num = (v, y) => (typeof v === "number" ? v : y);
  const enOutro = { baslik: "SUBSCRIBE", alt: "TURN ON NOTIFICATIONS", altSlogan: "New videos every week" };
  const trOutro = { baslik: "ABONE OL", alt: "BİLDİRİMLERİ AÇ", altSlogan: "Her hafta yeni videolar" };
  const dilOutro = dil === "tr" ? trOutro : enOutro;
  const outroMetni = {};
  for (const a of ["baslik", "alt", "altSlogan"])
    outroMetni[a] = (k.outroMetni && k.outroMetni[a]) || (ayar.outroMetni && ayar.outroMetni[a]) || dilOutro[a];
  const hedef = typeof k.hedefSaniye === "number" ? k.hedefSaniye
    : typeof k.hedefDakika === "number" ? Math.round(k.hedefDakika * 60) : FORMAT_SINIR[fmt].oneriSn;
  const e = Object.assign({}, k, {
    surum: 1, is: is || null, format: fmt, aspect: dikey ? "9:16" : "16:9", dikey,
    baslik_en: k.baslik_en || is || "", kanal: k.kanal || ayar.kanal || "KANALIM", slogan: k.slogan != null ? k.slogan : (ayar.slogan || ""),
    hedefSaniye: hedef, dil, altyaziDili: k.altyaziDili || dil, ses, sesHizi: k.sesHizi || ayar.sesHizi || "+7%",
    sesMotoru: k.sesMotoru || ayar.sesMotoru || "otomatik", okunus: k.okunus || {},
    geriSayim: num(k.geriSayim, KS[0]), intro: num(k.intro, KS[1]), konuKarti: num(k.konuKarti, KS[2]), outro: num(k.outro, KS[3]),
    markaKose: num(k.markaKose, 0), muzikSeviyesi: num(k.muzikSeviyesi, 0.4),
    muzikDucking: k.muzikDucking !== false, cesitlilik: k.cesitlilik !== false,
    altyazi: k.altyazi !== false, altyaziStil: k.altyaziStil || (dikey ? "kelime" : "cumle"),
    tur: k.tur || ayar.tur || "belgesel", ton: k.ton != null ? k.ton : (ayar.ton || ""),
    kanalSesi: Object.assign({ tarif: "", ornekParagraf: "" }, ayar.kanalSesi || {}, k.kanalSesi || {}),
    // ayar.vurguRenk elle bozulmus olabilir (ayarOku dogrulamaz) ve render filtre dizgisine girer: gecersizse varsayilan
    kisiselKatki: k.kisiselKatki || "", vurguRenk: (k.vurguRenk || (/^[0-9A-Fa-f]{6}$/.test(String(ayar.vurguRenk)) ? ayar.vurguRenk : "") || "6FD8FF").toUpperCase(),
    outroMetni, onay: Object.assign({ senaryo: true, gorsel: false }, ayar.onay || {}, k.onay || {}),
    yayin: Object.assign({ hashtagler: [], aciklamaSablonu: "", seri: "" }, k.yayin || {}),
    uretAdet: k.uretAdet || 2,
  });
  if (typeof k.maliyetUstSinirUSD !== "number") delete e.maliyetUstSinirUSD;
  return e;
}
function konuEtkin(is) {
  const k = konuHam(is);
  if (k === null) return null;
  return konuBirlestir(k, ayarOku(), is);
}

// ---------------------------------------------------------------- panel-ayar.json (bolum 6.1)
const AYAR_VARSAYILAN = Object.freeze({
  surum: 1, kanal: "KANALIM", slogan: "", dil: "en", ses: "en-US-ChristopherNeural", sesHizi: "+7%", sesMotoru: "otomatik", tur: "belgesel",
  // rozet: profil resmindeki harfler. BOS = kanal adinin bas harfleri (marka-yap.js); eskiden sabit "VS" idi ve her kanalin
  // profil resmi "VS" cikiyordu
  ton: "", kanalSesi: { tarif: "", ornekParagraf: "" }, vurguRenk: "6FD8FF", rozet: "", bannerAltMetin: "",
  outroMetni: { baslik: "", alt: "", altSlogan: "" }, senaryoMotoru: "otomatik", claudeModel: "claude-opus-5",
  fiyat: { "claude-opus-5": { giris: 5, cikis: 25 } }, maliyet: { gunlukUSD: null, aylikUSD: null, isBasinaUSD: null },
  onay: { senaryo: true, gorsel: false }, diskEsikGB: 5,
  kaynaklar: { nasa: true, wikimedia: true, openverse: true, pexels: true, pixabay: true, met: true, aic: true, cleveland: true },
});
const AYAR_ALT_NESNELER = ["kanalSesi", "outroMetni", "maliyet", "onay", "kaynaklar"];
const klon = o => JSON.parse(JSON.stringify(o));
function ayarBirlestir(taban, ek) {
  const s = klon(taban);
  if (!duzNesne(ek)) return s;
  for (const [k, v] of Object.entries(ek)) {
    if (k === "fiyat" && duzNesne(v)) { s.fiyat = Object.assign({}, s.fiyat, v); continue; }
    if (AYAR_ALT_NESNELER.includes(k) && duzNesne(v)) { s[k] = Object.assign({}, s[k], v); continue; }
    s[k] = v;
  }
  return s;
}
// Disk bozuksa/null ise varsayilanlara duser, ASLA firlatmaz (panel bunun yuzunden cokmesin).
function ayarOku() {
  let ham = null;
  try { ham = jsonOku(ayarDosyasi(), null); } catch (e) { ham = null; }
  if (!duzNesne(ham)) return klon(AYAR_VARSAYILAN);
  // eski bicim: ust duzeyde nasa/wikimedia
  const eski = {};
  for (const k of ["nasa", "wikimedia"]) if (typeof ham[k] === "boolean") eski[k] = ham[k];
  const s = ayarBirlestir(AYAR_VARSAYILAN, ham);
  if (Object.keys(eski).length) s.kaynaklar = Object.assign({}, s.kaynaklar, eski);
  for (const k of ["nasa", "wikimedia"]) delete s[k];
  return s;
}
function ayarDogrula(o) {
  const hatalar = [], uyarilar = [];
  const h = (alan, mesaj) => hatalar.push({ alan, mesaj });
  if (!duzNesne(o)) { h("(kök)", "Ayarlar bir JSON nesnesi olmalı."); return { gecerli: false, hatalar, uyarilar }; }
  const izinli = new Set(Object.keys(AYAR_VARSAYILAN));
  for (const k of Object.keys(o)) if (!izinli.has(k)) h(k, "Bilinmeyen ayar.");
  const metin = (a, maks) => { if (o[a] !== undefined && (typeof o[a] !== "string" || o[a].length > maks)) h(a, "metin, en çok " + maks + " karakter"); };
  metin("kanal", 60); metin("slogan", 120); metin("ses", 80); metin("ton", 200); metin("rozet", 6); metin("bannerAltMetin", 80);
  if (voxcpmSesiMi(o.ses) && !VOXCPM_SES_ADI.test(o.ses.trim())) h("ses", "VoxCPM sesi 'voxcpm:<ad>' biçiminde olmalı (ör. voxcpm:tok_anlatici)");
  if (o.dil !== undefined && !(typeof o.dil === "string" && /^[a-z]{2}$/.test(o.dil))) h("dil", "iki küçük harf olmalı");
  if (o.sesHizi !== undefined && !(typeof o.sesHizi === "string" && /^[+-]\d{1,2}%$/.test(o.sesHizi) && Math.abs(parseInt(o.sesHizi, 10)) <= 50)) h("sesHizi", "+7% / -10% gibi (−50..+50)");
  if (o.tur !== undefined && !TURLER.includes(o.tur)) h("tur", "şunlardan biri olmalı: " + TURLER.join(", "));
  if (o.sesMotoru !== undefined && !SES_MOTORLARI.includes(o.sesMotoru)) h("sesMotoru", "şunlardan biri olmalı: " + SES_MOTORLARI.join(", "));
  if (o.vurguRenk !== undefined && !(typeof o.vurguRenk === "string" && /^[0-9A-Fa-f]{6}$/.test(o.vurguRenk))) h("vurguRenk", "6 haneli renk kodu (# yok)");
  if (o.senaryoMotoru !== undefined && !["otomatik", "claude", "vidiq"].includes(o.senaryoMotoru)) h("senaryoMotoru", "otomatik, claude veya vidiq");
  if (o.claudeModel !== undefined && !(typeof o.claudeModel === "string" && /^[A-Za-z0-9._:-]{1,80}$/.test(o.claudeModel))) h("claudeModel", "geçerli bir model adı olmalı");
  if (o.diskEsikGB !== undefined && !(typeof o.diskEsikGB === "number" && o.diskEsikGB >= 0 && o.diskEsikGB <= 1000)) h("diskEsikGB", "0–1000 arası sayı");
  if (o.kanalSesi !== undefined) {
    if (!duzNesne(o.kanalSesi)) h("kanalSesi", "nesne olmalı");
    else {
      if (o.kanalSesi.tarif !== undefined && (typeof o.kanalSesi.tarif !== "string" || o.kanalSesi.tarif.length > 500)) h("kanalSesi.tarif", "metin, en çok 500");
      if (o.kanalSesi.ornekParagraf !== undefined && (typeof o.kanalSesi.ornekParagraf !== "string" || o.kanalSesi.ornekParagraf.length > 1000)) h("kanalSesi.ornekParagraf", "metin, en çok 1000");
    }
  }
  if (o.outroMetni !== undefined) {
    if (!duzNesne(o.outroMetni)) h("outroMetni", "nesne olmalı");
    else for (const a of ["baslik", "alt", "altSlogan"]) if (o.outroMetni[a] !== undefined && (typeof o.outroMetni[a] !== "string" || o.outroMetni[a].length > 80)) h("outroMetni." + a, "metin, en çok 80");
  }
  if (o.onay !== undefined) {
    if (!duzNesne(o.onay)) h("onay", "nesne olmalı");
    else for (const a of ["senaryo", "gorsel"]) if (o.onay[a] !== undefined && typeof o.onay[a] !== "boolean") h("onay." + a, "true/false");
  }
  if (o.kaynaklar !== undefined) {
    if (!duzNesne(o.kaynaklar)) h("kaynaklar", "nesne olmalı");
    else for (const [a, v] of Object.entries(o.kaynaklar)) {
      if (!["nasa", "wikimedia", "openverse", "pexels", "pixabay", "met", "aic", "cleveland"].includes(a)) h("kaynaklar." + a, "bilinmeyen kaynak");
      else if (typeof v !== "boolean") h("kaynaklar." + a, "true/false");
    }
  }
  if (o.maliyet !== undefined) {
    if (!duzNesne(o.maliyet)) h("maliyet", "nesne olmalı");
    else for (const a of ["gunlukUSD", "aylikUSD", "isBasinaUSD"])
      if (o.maliyet[a] !== undefined && o.maliyet[a] !== null && !(typeof o.maliyet[a] === "number" && o.maliyet[a] >= 0)) h("maliyet." + a, "boş ya da 0 ve üstü sayı");
  }
  if (o.fiyat !== undefined) {
    if (!duzNesne(o.fiyat)) h("fiyat", "nesne olmalı");
    else for (const [m, v] of Object.entries(o.fiyat))
      if (!duzNesne(v) || !(typeof v.giris === "number" && Number.isFinite(v.giris) && v.giris >= 0) || !(typeof v.cikis === "number" && Number.isFinite(v.cikis) && v.cikis >= 0)) h("fiyat." + m, "{giris, cikis} milyon token başına USD olmalı (sayı, 0 ve üstü)");
  }
  return { gecerli: hatalar.length === 0, hatalar, uyarilar };
}

// ---------------------------------------------------------------- komut satiri
// deger: degeri sonraki arguman olan bayraklar; mantik: acik/kapali bayraklar.
// --ad=deger de calisir (--onizleme=25). Tanimsiz bayrak: sonraki arguman -- ile baslamiyorsa ama deger
// listesinde degilse mantiksal sayilir.
function argumanCoz(argv, secenek) {
  const deger = new Set((secenek && secenek.deger) || []);
  const konum = [], bayrak = {};
  const liste = Array.from(argv || []);
  for (let i = 0; i < liste.length; i++) {
    const a = String(liste[i]);
    if (a === "--") { for (const r of liste.slice(i + 1)) konum.push(String(r)); break; }
    if (!a.startsWith("--") || a.length < 3) { konum.push(a); continue; }
    const eq = a.indexOf("=");
    if (eq > 0) { bayrak[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const ad = a.slice(2);
    if (deger.has(ad)) {
      if (i + 1 < liste.length) bayrak[ad] = String(liste[++i]);
      else bayrak[ad] = true;
    } else bayrak[ad] = true;
  }
  return { konum, bayrak };
}

// ---------------------------------------------------------------- konsol protokolu (bolum 7.2)
let _sonIlerleme = 0;
function ilerleme(asama, yuzde, ekstra) {
  const simdi = Date.now();
  if (yuzde < 100 && simdi - _sonIlerleme < 1000) return;       // en cok saniyede 1
  _sonIlerleme = simdi;
  const o = Object.assign({ asama }, ekstra || {});
  if (yuzde != null) o.yuzde = Math.max(0, Math.min(100, Math.round(yuzde)));
  process.stdout.write("@@ILERLEME " + JSON.stringify(o) + "\n");
}
const uyari = m => process.stdout.write("@@UYARI " + String(m).replace(/\r?\n/g, " ") + "\n");
const sonuc = obj => process.stdout.write("@@SONUC " + JSON.stringify(obj || {}) + "\n");

// ---------------------------------------------------------------- hata cevirisi
const AG_KODLARI = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN", "EPIPE", "ECONNABORTED", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT"];
// HTTP durum kodlari YALNIZ HTTP baglaminda aranir: "HTTP 429", "status 429", "(429)", "Error: 401 ...", satir basinda "429 {json}".
// Cunku ffmpeg ilerleme satiri hata degildir: "frame=  401 fps= 30" ya da "size=  429kB" eskiden 'API anahtari gecersiz' / 'servis siniri'
// diye cevrilirdi (hataCevir bu satirlari stderr kuyrugundan okur). Sayinin ardindan harf/rakam/=/% gelmemeli, birim ("fps", "kB") olmamali.
const httpKalibi = n => "(?:\\bHTTP\\D{0,8}|\\bstatus(?:Code)?\\W{0,3}|\\b(?:code|kod|durum)\\W{0,3}|\\bError:\\s*|\\(|^\\s*)" + n +
  "(?![\\w=%-])(?!\\.\\d)(?!\\s*(?:fps|kb|kib|mb|bytes|frames|ms)\\b)";
const HATA_TABLOSU = [
  { kod: "konu_bozuk", ya: /konu\.json (bozuk|geçersiz)/i, ozet: "konu.json okunamadı.", cozum: "Panelde Ham ayarlar kutusunu aç ve JSON'u düzelt." },
  { kod: "disk_dolu", ya: /ENOSPC|EDQUOT|No space left|disk dolu|boş yer kalmadı/i, ozet: "Diskte boş yer kalmadı.", cozum: "Disk alanı aç (panelde Disk bölümünden ara dosyaları temizle) ve tekrar dene." },
  { kod: "ffmpeg_yok", ya: /ffmpeg.*(bulunamad|not found|not recognized|ENOENT)|spawn ffmpeg ENOENT|spawn ffprobe ENOENT|ffprobe.*(bulunamad|ENOENT)/i, ozet: "ffmpeg bulunamadı.", cozum: "ffmpeg'i kur: Windows'ta 'winget install Gyan.FFmpeg', ardından PANEL.bat'ı kapatıp yeniden aç." },
  { kod: "kodlayici", ya: /Error while opening encoder|h264_nvenc|hevc_nvenc|_amf\b|_qsv\b|OpenEncodeSessionEx|nvenc/i, ozet: "Ekran kartı video kodlayıcısı hata verdi.", cozum: "Aynı anda başka bir program ekran kartını kullanıyor olabilir. Tekrar dene; sürerse sürücüyü güncelle (CPU ile otomatik denenir)." },
  { kod: "bozuk_gorsel", ya: /Invalid data found when processing input|moov atom not found|Error while decoding|görsel .*bozuk|Image .*corrupt/i, ozet: "Bozuk bir görsel dosyası var.", cozum: "Görseller listesinden bozuk görseli sil ve videoyu yeniden kur." },
  { kod: "kredi_bitti", ya: new RegExp(httpKalibi(402) + "|credit balance|insufficient (credit|funds|quota)|billing|payment required|kredi (bitti|yetersiz)", "im"), ozet: "Servis kredisi/bakiyesi bitmiş.", cozum: "İlgili hesaba kredi yükle veya Kaynaklar sekmesinden diğer senaryo motorunu seç." },
  { kod: "anahtar_gecersiz", ya: new RegExp(httpKalibi(401) + "|invalid.{0,20}api.?key|authentication_error|anahtar ge[cç]ersiz|unauthorized|anahtar.*(yok|girilmemi)", "im"), ozet: "API anahtarı geçersiz ya da girilmemiş.", cozum: "Kaynaklar sekmesinden anahtarı kontrol et, yeniden gir ve Test et düğmesine bas." },
  { kod: "limit", ya: new RegExp(httpKalibi(429) + "|rate.?limit|too many requests|" + httpKalibi(529) + "|overloaded|kota|quota", "im"), ozet: "Servis istek sınırına takıldı veya aşırı yüklü.", cozum: "Birkaç dakika bekleyip tekrar dene." },
  { kod: "internet_yok", ya: /ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|ETIMEDOUT|EHOSTUNREACH|fetch failed|socket hang up|getaddrinfo|network|zaman aşımı|timed? ?out/i, ozet: "İnternet bağlantısı kurulamadı ya da servis yanıt vermedi.", cozum: "Bağlantını kontrol edip tekrar dene (iş kaldığı yerden devam eder)." },
  { kod: "bagimlilik_eksik", ya: /Cannot find module|MODULE_NOT_FOUND/, ozet: "Gerekli bir paket kurulu değil.", cozum: "Proje klasöründe 'npm install' çalıştır (ya da PANEL.bat'ı yeniden aç)." },
];
function hataCevir(e) {
  if (e instanceof OrtakHata && e.kod && !["genel", "bozuk"].includes(e.kod)) {
    const tablo = HATA_TABLOSU.find(t => t.kod === e.kod);
    return { kod: e.kod, ozet: e.message, cozum: e.cozum || (tablo && tablo.cozum) || "", detay: e.detay !== undefined ? e.detay : undefined };
  }
  const ham = typeof e === "string" ? e : String((e && (e.stack || e.message)) || e || "");
  // sayisal durum "HTTP 429" olarak eklenir: httpKalibi bos sayilari (ffmpeg ilerleme satiri) degil, baglamli kodlari tanir
  const kodlar = [e && e.code, e && e.status != null ? "HTTP " + e.status : null, e && e.statusCode != null ? "HTTP " + e.statusCode : null]
    .filter(x => x !== undefined && x !== null).join(" ");
  const aranacak = kodlar + " " + ham;
  for (const t of HATA_TABLOSU) if (t.ya.test(aranacak)) return { kod: t.kod, ozet: t.ozet, cozum: t.cozum, detay: ham.slice(-1500) };
  const ilk = String((e && e.message) || ham).split("\n")[0].trim();
  return { kod: "genel", ozet: ilk || "Beklenmeyen bir hata oluştu.", cozum: "Ayrıntı için günlüğe (log) bak; sürerse işi baştan dene.", detay: ham.slice(-1500) };
}
function cikisKodu(e) {
  if (e instanceof OrtakHata) return e.cikis;
  if (diskDoluMu(e)) return CIKIS.DISK;
  if (e && (AG_KODLARI.includes(e.code) || [401, 402, 403, 404, 429, 529].includes(e.status) || (e.status >= 500 && e.status < 600))) return CIKIS.SERVIS;
  if (e && /fetch failed|socket hang up|getaddrinfo|network/i.test(String(e.message))) return CIKIS.SERVIS;
  return CIKIS.GENEL;
}
// Tum betiklerin .catch(ortak.bitir): stderr'e Turkce ozet + @@HATA, uygun cikis kodu.
function bitir(e) {
  const kod = cikisKodu(e);
  const c = hataCevir(e);
  const ozet = String(c.ozet).replace(/\s*\r?\n\s*/g, " ").trim();
  const satirlar = [];
  satirlar.push("@@HATA " + JSON.stringify({ kod: c.kod, mesaj: ozet, cozum: c.cozum || "" }));
  satirlar.push("✗ " + ozet);
  if (c.cozum) satirlar.push("  ↳ " + c.cozum);
  if (c.detay !== undefined && c.kod === "genel") {
    const d = (typeof c.detay === "string" ? c.detay : JSON.stringify(c.detay)).split("\n").slice(0, 8);
    for (const l of d) if (l.trim()) satirlar.push("    " + l.trim());
  }
  const cik = () => { try { kilitleriBirak(); } catch (e2) {} process.exit(kod); };
  const t = setTimeout(cik, 1500);
  if (t.unref) t.unref();
  try { process.stderr.write(satirlar.join("\n") + "\n", cik); } catch (e2) { cik(); }
}

// ---------------------------------------------------------------- is kilidi (uretim/<is>/.kilit)
const tutulanKilitler = new Map();     // is -> kilit dosyasi
function pidCanliMi(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

// ---- kilit sahibini DOGRULA (PID yeniden kullanimina karsi)
// Elektrik kesintisi ya da cokme sonrasi .kilit dosyasi kalir; PID'ler (ozellikle Windows'ta) cok cabuk baska programlara
// verilir. "PID canli" tek basina o betigin yasadigini KANITLAMAZ: panel sahte bir "yetim is" gosterir, isi baslatmayi 409 ile
// engeller, betik "zaten calisiyor" (cikis 6) der ve Durdur'a basilirsa ALAKASIZ bir programin surec agaci olur. Bu yuzden
// sahip uc seyle dogrulanir:
//   1) PID'deki programin adi node olmali (betikler process.execPath ile calisir),
//   2) o surec kilitten SONRA baslamissa baska bir surectir (sahip kilidi yazdiktan sonra dogamaz),
//   3) surecin baslangici olculemediyse yedek olarak: kilit bilgisayar acilmadan ONCE yazildiysa (acilis = simdi - os.uptime) sahibi
//      bu acilista yasayamaz. (Yalniz yedek: uyku/hazirda bekletme suresi uptime'a dahil edilmeyen bir sistemde "acilis" ileri kayar,
//      canli bir sahibi yanlislikla olu saymamak icin kesin olan baslangic zamani her zaman once gelir.)
// Olculemeyen oge (arac yok, zaman asimi, yetki) "bilinmiyor" sayilip atlanir: yalniz KANITLANAN uyusmazlik kilidi bayat yapar.
const NODE_ADLARI = new Set(["node", "nodejs", path.basename(process.execPath).replace(/\.exe$/i, "").toLowerCase()]);
const ACILIS_PAYI_MS = 120000;        // os.uptime() olcum payi (Windows'ta tick sayaci, hizli baslatma vb.)
const BASLANGIC_PAYI_MS = 5000;       // surecin baslangici ile kilit yazimi arasindaki saat/yuvarlama payi
function kisaKos(komut, argv, ms) {
  try {
    const r = spawnSync(komut, argv, { encoding: "utf8", windowsHide: true, timeout: ms });
    return r.error || r.status === null ? null : { kod: r.status, cikti: String(r.stdout || ""), hata: String(r.stderr || "") };
  } catch (e) { return null; }
}
const etimeSn = m => (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) + Number(m[3]) * 60 + Number(m[4]);
// {var: true|false|null, ad: "node"|null, baslangicMs: sayi|null}; null = olculemedi.
// baslangicIste: surec baslangicini da olc (Windows'ta PowerShell ~2 sn surer; yalniz ad node ise calisir).
function surecBilgisi(pid, baslangicIste) {
  const b = { var: null, ad: null, baslangicMs: null };
  if (!Number.isInteger(pid) || pid <= 0) { b.var = false; return b; }
  if (process.platform === "win32") {
    const t = kisaKos("tasklist", ["/FI", "PID eq " + pid, "/FO", "CSV", "/NH"], 5000);
    if (!t) return b;
    const m = new RegExp('^"([^"]+)","' + pid + '"', "m").exec(t.cikti);       // eslesen satir yoksa (yerellestirilmis "bilgi" satiri) surec yok
    if (!m) { b.var = false; return b; }
    b.var = true; b.ad = m[1].replace(/\.exe$/i, "").toLowerCase();
    if (baslangicIste && NODE_ADLARI.has(b.ad)) {
      const ps = kisaKos("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "try{$p=Get-Process -Id " + pid + " -ErrorAction Stop;[string][DateTimeOffset]::new($p.StartTime).ToUnixTimeMilliseconds()}catch{}"], 8000);
      const ms = ps && /^\d{12,}/m.exec(ps.cikti);
      if (ms) b.baslangicMs = Number(ms[0]);
    }
    return b;
  }
  const r = kisaKos("ps", ["-o", "etime=", "-o", "comm=", "-p", String(pid)], 5000);
  if (!r) return b;
  const m = /^\s*(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)\s+(\S.*?)\s*$/m.exec(r.cikti);
  if (!m) { if (r.kod === 1 && !r.cikti.trim() && !r.hata.trim()) b.var = false; return b; }   // procps: eslesme yoksa sessiz cikis 1
  b.var = true;
  b.ad = path.basename(m[5]).replace(/\.exe$/i, "").toLowerCase();
  if (baslangicIste) b.baslangicMs = Date.now() - etimeSn(m) * 1000;
  return b;
}
// m: kilit dosyasinin icerigi {pid, baslangic, komut}. Sahibi gercekten o betik sureci mi?
function kilitSahibiCanliMi(m) {
  if (!m || !pidCanliMi(m.pid)) return false;
  if (m.pid === process.pid) return true;
  const kilitMs = Date.parse(m.baslangic);
  const zamanVar = Number.isFinite(kilitMs);
  const b = surecBilgisi(m.pid, zamanVar);
  if (b.var === false) return false;
  if (b.ad && !NODE_ADLARI.has(b.ad)) return false;
  if (zamanVar) {
    if (b.baslangicMs) { if (b.baslangicMs > kilitMs + BASLANGIC_PAYI_MS) return false; }
    else if (kilitMs < Date.now() - os.uptime() * 1000 - ACILIS_PAYI_MS) return false;
  }
  return true;
}
let _kilitKancalari = false;
function kilitKancalari() {
  if (_kilitKancalari) return; _kilitKancalari = true;
  process.on("exit", () => { try { kilitleriBirak(); } catch (e) {} });
  for (const [sig, kod] of [["SIGINT", 130], ["SIGTERM", 143]])
    process.on(sig, () => { try { kilitleriBirak(); } catch (e) {} process.exit(kod); });
}
function kilitleriBirak() {
  for (const is of Array.from(tutulanKilitler.keys())) kilitBirak(is);
}
function kilitAl(is, etiket) {
  const dosya = path.join(isDizin(is), ".kilit");
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  const icerik = JSON.stringify({ pid: process.pid, baslangic: new Date().toISOString(), komut: etiket || path.basename(process.argv[1] || "") });
  for (let deneme = 0; deneme < 3; deneme++) {
    try {
      const fd = fs.openSync(dosya, "wx");
      try { fs.writeSync(fd, icerik); } finally { fs.closeSync(fd); }
      tutulanKilitler.set(is, dosya); kilitKancalari();
      return;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let mevcut = null;
      try { mevcut = JSON.parse(fs.readFileSync(dosya, "utf8")); } catch (e2) {}
      const pid = mevcut && mevcut.pid;
      // ayni surec (ic ice cagri) ya da kilidi tutan surecin cocugu: sorun yok
      if (pid === process.pid || (pid && pid === process.ppid && pidCanliMi(pid))) return;
      if (mevcut && kilitSahibiCanliMi(mevcut)) {
        throw new OrtakHata("kilit", "Bu iş zaten çalışıyor (PID " + pid + (mevcut.komut ? ", " + mevcut.komut : "") + ").", {
          cikis: CIKIS.KILIT, cozum: "Çalışan işin bitmesini bekle ya da panelden Durdur'a bas.", detay: mevcut });
      }
      try { fs.unlinkSync(dosya); } catch (e2) {}       // olu surecin bayat kilidi
    }
  }
  throw new OrtakHata("kilit", "İş kilidi alınamadı.", { cikis: CIKIS.KILIT });
}
function kilitBirak(is) {
  const dosya = tutulanKilitler.get(is);
  if (!dosya) return;
  tutulanKilitler.delete(is);
  try {
    const m = JSON.parse(fs.readFileSync(dosya, "utf8"));
    if (m && m.pid === process.pid) fs.unlinkSync(dosya);
  } catch (e) {}
}

// ---------------------------------------------------------------- disk
function varOlanUst(yol) {
  let p = path.resolve(yol);
  for (let i = 0; i < 64 && !fs.existsSync(p); i++) { const u = path.dirname(p); if (u === p) break; p = u; }
  return p;
}
// Bos alan (GB); olculemezse null.
function diskBosGB(yol) {
  try {
    const s = fs.statfsSync(varOlanUst(yol || KOK));
    return Math.round(Number(s.bavail) * Number(s.bsize) / (1024 ** 3) * 100) / 100;
  } catch (e) { return null; }
}
function diskKontrol(yol, minGB) {
  const bos = diskBosGB(yol);
  if (bos !== null && bos < minGB)
    throw new OrtakHata("disk_az", "Diskte yeterli boş yer yok: " + bos + " GB boş, en az " + minGB + " GB gerekli.", {
      cikis: CIKIS.DISK, cozum: "Disk alanı aç (panelde Disk bölümünden ara dosyaları temizle) ve tekrar dene.", detay: { bosGB: bos, minGB } });
  return { bosGB: bos, minGB };
}
// Yarim kalan dosyalari siler: *.part, *.part.*, *.<pid>.tmp ve _tmp icindeki 0 baytlilar.
// Silinen dosya sayisini dondurur. Sembolik baglantiyi izlemez.
function partTemizle(dizin) {
  let silinen = 0;
  const yuru = (d, tmpIci) => {
    let girdiler;
    try { girdiler = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const g of girdiler) {
      const p = path.join(d, g.name);
      if (g.isSymbolicLink()) continue;
      if (g.isDirectory()) { yuru(p, tmpIci || g.name === "_tmp"); continue; }
      let sil = /\.part$/i.test(g.name) || /\.part\.[A-Za-z0-9]+$/i.test(g.name) || /\.\d+\.tmp$/i.test(g.name);
      if (!sil && tmpIci) { try { sil = fs.statSync(p).size === 0; } catch (e) {} }
      if (sil) { try { fs.unlinkSync(p); silinen++; } catch (e) {} }
    }
  };
  yuru(dizin, path.basename(dizin) === "_tmp");
  return silinen;
}

module.exports = {
  KOK, URETIM, CIKIS, uretimDizini, envDosyasi, ayarDosyasi,
  OrtakHata, envOku, envHepsi, envYaz, atomikYaz, atomikJsonYaz, jsonOku, jsonCoz,
  guvenliAd, isDizin, yolIcinde,
  paragraflaraBol, sha1, paragrafOzeti, slugla,
  konuHam, konuEtkin, konuDogrula, konuBirlestir, ayarOku, ayarDogrula, ayarBirlestir, AYAR_VARSAYILAN,
  kelimeHizi, formatSiniri, varsayilanSes, sesSec, GECISLER, EFEKTLER, RENKLER, TURLER, MUZIK_RUHLARI, SES_MOTORLARI,
  VOXCPM_SES_DIZINI, VOXCPM_VARSAYILAN, VOXCPM_SES_ADI, voxcpmSesiMi, voxcpmSesDili, voxcpmKimlikDili,
  argumanCoz, ilerleme, uyari, sonuc, bitir, hataCevir,
  kilitAl, kilitBirak, kilitSahibiCanliMi, surecBilgisi, pidCanliMi,
  diskBosGB, diskKontrol, partTemizle, damga, duzNesne,
};
