// YENI IS CEKIRDEGI — panelin /api/yeni ucu ve `node yeni-is.js` ayni kodu kullanir (SOZLESME 6.6 / 6.8).
// Klasoru acar, konu.json'u eksiksiz yazar. Girdi dogrulanir; hatali girdide klasor ACILMAZ.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak");

const FORMATLAR = ["long", "short", "reels", "tiktok"];
const ACILIS = ["hizli", "sinematik"];
// acilis stili -> [geriSayim, intro, konuKarti, outro]
function acilisSureleri(fmt, acilis) {
  if (fmt === "long") return acilis === "sinematik" ? [5, 10, 3, 12] : [0, 0, 0, 12];
  if (fmt === "short") return [0, 1.5, 0, 3];
  return [0, 1.5, 0, 0];
}

class GirdiHatasi extends Error {
  constructor(hatalar, kod) {
    super(hatalar.map(h => h.mesaj).join(" "));
    this.kod = kod || "girdi"; this.alanlar = hatalar; this.cikis = 2;
  }
}

const metinMi = v => typeof v === "string";
// kullaniciya gorunen hata metinlerinde alan adi Turkce etiketle yazilir ("baslik en cok..." degil)
const ALAN_ETIKET = { baslik: "Başlık", nis: "Konu notu", kaynakMetin: "Kaynak metin", kisiselKatki: "Kişisel katkı", ton: "Ton", kanal: "Kanal adı", slogan: "Slogan", ad: "İş adı" };
// Girdiyi dogrular ve temizler. {temiz, hatalar, uyarilar}
function girdiDogrula(g, ayar) {
  g = g || {};
  ayar = ayar || ortak.ayarOku();
  const hatalar = [], uyarilar = [];
  const h = (alan, mesaj) => hatalar.push({ alan, mesaj });
  const t = {};
  const oku = (alan, maks, zorunlu) => {
    const v = g[alan];
    if (v === undefined || v === null || v === "") { if (zorunlu) h(alan, zorunlu); return undefined; }
    if (!metinMi(v)) { h(alan, (ALAN_ETIKET[alan] || alan) + " metin olmalı."); return undefined; }
    const s = v.trim();
    if (s.length > maks) { h(alan, (ALAN_ETIKET[alan] || alan) + " en çok " + maks + " karakter olabilir (şu an " + s.length + ")."); return undefined; }
    if (!s && zorunlu) h(alan, zorunlu);
    return s || undefined;
  };
  t.baslik = oku("baslik", 300, "Başlık gerekli.");
  t.nis = oku("nis", 5000);
  t.kaynakMetin = oku("kaynakMetin", 20000);
  t.kisiselKatki = oku("kisiselKatki", 1500);
  t.ton = oku("ton", 200);
  t.kanal = oku("kanal", 60);
  t.slogan = oku("slogan", 120);
  t.ad = oku("ad", 120);
  t.format = g.format === undefined || g.format === "" ? "long" : g.format;
  if (!FORMATLAR.includes(t.format)) h("format", "Biçim şunlardan biri olmalı: " + FORMATLAR.join(", ") + ".");
  t.acilisStili = g.acilisStili === undefined || g.acilisStili === "" ? "hizli" : g.acilisStili;
  if (!ACILIS.includes(t.acilisStili)) h("acilisStili", "Açılış stili hizli ya da sinematik olmalı.");
  if (g.sureDk !== undefined && g.sureDk !== null && g.sureDk !== "") {
    const n = typeof g.sureDk === "number" || typeof g.sureDk === "string" ? Number(g.sureDk) : NaN;     // nesne ({"toString":"x"}) Number()'i patlatmasin
    if (!Number.isFinite(n) || n <= 0) h("sureDk", "Süre (dakika) pozitif bir sayı olmalı.");
    else if (n * 60 < 15 || n * 60 > 3600) h("sureDk", "Süre 15 saniye ile 60 dakika arasında olmalı.");
    else t.sureDk = n;
  }
  t.dil = g.dil === undefined || g.dil === "" ? (ayar.dil || "en") : g.dil;
  if (!(metinMi(t.dil) && /^[a-z]{2}$/.test(t.dil))) h("dil", "Dil iki küçük harf olmalı (en, tr, es…).");
  if (g.ses !== undefined && g.ses !== "") {
    // Edge/Azure adi ya da VoxCPM2 sesi (voxcpm:tok_anlatici; lib/ses-motor-voxcpm.js)
    if (!(metinMi(g.ses) && (/^[A-Za-z0-9._-]{1,80}$/.test(g.ses) || ortak.VOXCPM_SES_ADI.test(g.ses))))
      h("ses", "Ses adı geçersiz (örn. en-US-ChristopherNeural ya da voxcpm:tok_anlatici).");
    else t.ses = g.ses;
  }
  if (g.sesHizi !== undefined && g.sesHizi !== "") {
    if (!(metinMi(g.sesHizi) && /^[+-]\d{1,2}%$/.test(g.sesHizi) && Math.abs(parseInt(g.sesHizi, 10)) <= 50)) h("sesHizi", "Konuşma hızı +7% ya da -10% gibi olmalı (−50..+50).");
    else t.sesHizi = g.sesHizi;
  }
  t.altyaziDili = g.altyaziDili === undefined || g.altyaziDili === "" ? t.dil : g.altyaziDili;
  if (!(metinMi(t.altyaziDili) && /^[a-z]{2}$/.test(t.altyaziDili))) h("altyaziDili", "Altyazı dili iki küçük harf olmalı.");
  if (g.sesMotoru !== undefined && g.sesMotoru !== "") {
    if (!ortak.SES_MOTORLARI.includes(g.sesMotoru)) h("sesMotoru", "Ses motoru otomatik, edge, azure, piper ya da voxcpm olmalı.");
    else t.sesMotoru = g.sesMotoru;
  }
  if (g.tur !== undefined && g.tur !== "") {
    if (!ortak.TURLER.includes(g.tur)) h("tur", "Tür şunlardan biri olmalı: " + ortak.TURLER.join(", ") + ".");
    else t.tur = g.tur;
  }
  if (g.onay !== undefined && g.onay !== null) {
    if (!ortak.duzNesne(g.onay)) h("onay", "onay bir nesne olmalı ({senaryo, gorsel}).");
    else {
      t.onay = {};
      for (const k of ["senaryo", "gorsel"]) if (g.onay[k] !== undefined) {
        if (typeof g.onay[k] !== "boolean") h("onay." + k, "true/false olmalı.");
        else t.onay[k] = g.onay[k];
      }
    }
  }
  // trend/viral raporundan "Bu konuda video yap": senaryo istemine hook/sure kaliplari ornek yapi olarak girer
  // (lib/senaryo-ortak.js trendReferansi). Yalniz kok-goreli trend/ ve viral-analiz/ altindaki .json raporlari.
  if (g.trendRapor !== undefined && g.trendRapor !== null && g.trendRapor !== "") {
    if (!(metinMi(g.trendRapor) && /^(trend|viral-analiz)\/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.json$/.test(g.trendRapor) && !g.trendRapor.includes("..")))
      h("trendRapor", "Trend raporu 'trend/<ad>.json' ya da 'viral-analiz/<ad>.json' biçiminde olmalı.");
    else t.trendRapor = g.trendRapor;
  }
  t.uret = g.uret === true;
  return { temiz: t, hatalar, uyarilar };
}

// Temiz girdiden konu.json nesnesi. Sureler HER ZAMAN acik yazilir (eski isler degismesin diye
// konuEtkin varsayilanlari ayri; yeni isler kendi degerini tasir).
function konuKur(t, ayar) {
  ayar = ayar || ortak.ayarOku();
  const fmt = t.format;
  const dikey = fmt !== "long";
  const [gs, intro, kk, outro] = acilisSureleri(fmt, t.acilisStili);
  const hedef = t.sureDk ? Math.round(t.sureDk * 60) : ortak.formatSiniri(fmt).oneriSn;
  const ses = t.ses || ortak.sesSec(t.dil, ayar.ses);
  const k = { surum: 1, baslik_en: t.baslik };
  if (t.kanal) k.kanal = t.kanal;
  if (t.slogan) k.slogan = t.slogan;
  k.format = fmt; k.aspect = dikey ? "9:16" : "16:9";
  k.dil = t.dil; k.altyaziDili = t.altyaziDili;
  k.ses = ses; k.sesHizi = t.sesHizi || ayar.sesHizi || "+7%";
  if (t.sesMotoru) k.sesMotoru = t.sesMotoru;
  if (t.tur) k.tur = t.tur;
  if (t.ton) k.ton = t.ton;
  if (t.kaynakMetin) k.arastirma = t.kaynakMetin;
  if (t.kisiselKatki) k.kisiselKatki = t.kisiselKatki;
  if (t.trendRapor) k._trendRapor = t.trendRapor;
  k.onay = Object.assign({ senaryo: true, gorsel: false }, ayar.onay || {}, t.onay || {});
  k.acilisStili = t.acilisStili;
  k.geriSayim = gs; k.intro = intro; k.konuKarti = kk; k.outro = outro;
  if (fmt === "long" && t.acilisStili === "hizli") k.markaKose = 2;
  // 0.40 olculen deger: muzik orta bandi sesin 6.5 dB altinda kaliyor (bkz. video-yap.js muzik bolumu)
  k.muzikSeviyesi = 0.4;
  k.hedefSaniye = hedef;
  if (t.nis) k._not = t.nis;
  return k;
}

function adAdaylari(t) {
  const taban = ortak.slugla(t.ad || t.baslik, { maks: 48 }) || "is";
  // Windows'ta CON, NUL, AUX, PRN, COM1, LPT1... klasor adi olamaz (guvenliAd de reddeder): "Con" ya da "Nul" diye
  // baslayan bir video "gecerli bir ada cevrilemedi" diye acilmiyordu. Sonuna "-is" eklenir.
  return ortak.guvenliAd(taban) ? taban : taban + "-is";
}

// Klasoru acar. secenek: { ayar, uretim }. Hata: GirdiHatasi / OrtakHata.
function yeniIs(g, secenek) {
  secenek = secenek || {};
  const ayar = secenek.ayar || ortak.ayarOku();
  const uretim = secenek.uretim || ortak.uretimDizini();
  const { temiz, hatalar, uyarilar } = girdiDogrula(g, ayar);
  if (hatalar.length) throw new GirdiHatasi(hatalar);
  const konu = konuKur(temiz, ayar);
  const d = ortak.konuDogrula(konu);
  if (!d.gecerli) throw new GirdiHatasi(d.hatalar.map(x => ({ alan: x.alan, mesaj: x.alan + ": " + x.mesaj })), "konu_gecersiz");

  const etkinKanal = temiz.kanal || ayar.kanal || "KANALIM";
  if (etkinKanal === "KANALIM")
    uyarilar.push({ kod: "kanal_varsayilan", mesaj: "Kanal adı hâlâ KANALIM; videoda bu yazı çıkar. Kanal ayarından değiştir." });
  const sinir = ortak.formatSiniri(temiz.format);
  if (konu.hedefSaniye > sinir.teknikMaxSn && temiz.format !== "long")
    uyarilar.push({ kod: "sure_sinir", mesaj: "Hedef süre bu biçimin teknik sınırını (" + sinir.teknikMaxSn + " sn) aşıyor." });

  fs.mkdirSync(uretim, { recursive: true });
  const taban = adAdaylari(temiz);
  const acik = !!temiz.ad;
  let ad = null, dizin = null;
  for (let i = 1; i <= 99 && !ad; i++) {
    const aday = i === 1 ? taban : taban.slice(0, 60) + "-" + i;
    if (!ortak.guvenliAd(aday)) throw new GirdiHatasi([{ alan: "ad", mesaj: "İş adı geçerli bir ada çevrilemedi." }]);
    try { fs.mkdirSync(path.join(uretim, aday)); ad = aday; dizin = path.join(uretim, aday); }
    catch (e) {
      if (e.code === "EEXIST") {
        if (acik) { const x = new GirdiHatasi([{ alan: "ad", mesaj: "Bu isimde bir iş zaten var." }], "is_var"); x.durum = 409; throw x; }
        continue;
      }
      if (e.code === "ENOSPC") throw new ortak.OrtakHata("disk_dolu", "Diskte boş yer kalmadı.", { cikis: 5 });
      throw e;
    }
  }
  if (!ad) throw new GirdiHatasi([{ alan: "ad", mesaj: "Bu başlık için boş bir iş adı bulunamadı." }], "is_var");
  try {
    fs.mkdirSync(path.join(dizin, "Voice"), { recursive: true });
    ortak.atomikJsonYaz(path.join(dizin, "konu.json"), konu);
    ortak.atomikYaz(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), "");
  } catch (e) {
    try { fs.rmSync(dizin, { recursive: true, force: true }); } catch (e2) {}
    throw e;
  }
  return { ad, dizin, konu, uyarilar, uret: temiz.uret };
}

module.exports = { yeniIs, girdiDogrula, konuKur, GirdiHatasi, acilisSureleri, FORMATLAR };
