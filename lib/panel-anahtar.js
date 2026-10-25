// PANEL: API ANAHTARLARI — izinli adlar, maskeleme, kaydetme ve canli testler (SOZLESME 6.6).
// Testler ucretsiz uclar kullanir (Anthropic'te GET /v1/models: token harcamaz). Ag cagrilari enjekte edilebilir.
"use strict";
const fs = require("fs");
const path = require("path");
const nodeHttps = require("https");
const ortak = require("./ortak");
const { HttpHata } = require("./panel-http");

// UNSPLASH_KEY kaldirildi (hicbir betik okumuyordu).
const IZINLI = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "VIDIQ_KEY", "PEXELS_KEY", "PIXABAY_KEY", "SMITHSONIAN_KEY", "UNSPLASH_KEY", "EUROPEANA_KEY", "CF_ACCOUNT_ID", "CF_API_TOKEN",
  "TOGETHER_KEY", "HF_TOKEN", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "PIPER_YOL", "PIPER_MODEL"];
// Gizli olmayanlar: ekranda acik gosterilir
const ACIK = new Set(["ANTHROPIC_MODEL", "AZURE_SPEECH_REGION", "PIPER_YOL", "PIPER_MODEL"]);
// hangi anahtar degisince hangi test kosar
const TEST_ESLEME = { ANTHROPIC_API_KEY: "claude", ANTHROPIC_MODEL: "claude", VIDIQ_KEY: "vidiq", PEXELS_KEY: "pexels", PIXABAY_KEY: "pixabay" };
const DEGER_MAKS = 600;
// Kullanicidan gelen adla nesne aramasi YALNIZ kendi anahtarlariyla ("constructor", "toString" gibi miras ozellikler gecerli test sayilmaz)
const sahip = (nesne, anahtar) => typeof anahtar === "string" && Object.prototype.hasOwnProperty.call(nesne, anahtar);

const maskele =(ad, v) => !v ? "" : (ACIK.has(ad) ? v : "••••••" + v.slice(-4));

// .env'deki izinli anahtarlarin maskeli gorunumu (yoksa "")
function maskeliListe() {
  const hepsi = ortak.envHepsi();
  const o = {};
  for (const ad of IZINLI) o[ad] = maskele(ad, hepsi[ad] || "");
  return o;
}

// Komut/dosya yolu tasiyan ve sirlandirilmayan degerler: PIPER_YOL bir PROGRAM yoludur (seslendir.js onu calistirir), bu yuzden
// panelden yalniz var olan, mutlak yollu, beklenen turde bir dosya kabul edilir (kabuk metakarakteri tasiyan yol asla).
const PIPER_PROGRAM_UZANTILARI = [".exe", ".js", ".cjs", ".mjs", ".cmd", ".bat", ".sh", ""];
const TEHLIKELI_YOL = /["&|<>^%`$;\r\n\0]/;
function dosyaVarMi(yol) { try { return fs.statSync(yol).isFile(); } catch (e) { return false; } }
function degerDogrula(ad, v, h) {
  const fsx = (h && h.fs) || { isFile: dosyaVarMi };
  const hata = m => new HttpHata(400, "deger", ad + ": " + m, { alanlar: [{ alan: ad, mesaj: m }] });
  if (ad === "PIPER_YOL" || ad === "PIPER_MODEL") {
    if (!path.isAbsolute(v)) throw hata("tam (mutlak) yol olmalı, örn. C:\\piper\\piper.exe");
    if (TEHLIKELI_YOL.test(v)) throw hata("yolda şu karakterler olamaz: \" & | < > ^ % ` $ ;");
    if (!fsx.isFile(v)) throw hata("bu yolda dosya bulunamadı: " + v);
    const uz = path.extname(v).toLowerCase();
    if (ad === "PIPER_MODEL" && uz !== ".onnx") throw hata("ses modeli bir .onnx dosyası olmalı");
    if (ad === "PIPER_YOL" && !PIPER_PROGRAM_UZANTILARI.includes(uz)) throw hata("çalıştırılabilir bir program olmalı (.exe, .cmd, .bat, .js)");
    // PIPER_YOL'un stdin'ine anlatim metni verilir: cmd.exe / powershell.exe / node.exe gibi herhangi bir programa yönlendirilirse
    // metin komut olarak çalışırdı (API'den uzaktan komut çalıştırma). Bu yüzden dosya adı "piper" içermeli (piper.exe, piper-tr.cmd ...).
    if (ad === "PIPER_YOL" && !/piper/i.test(path.basename(v))) throw hata("dosya adı 'piper' içermeli (örn. C:\\piper\\piper.exe); başka bir program (cmd, powershell, node ...) seçilemez");
  } else if (ad === "AZURE_SPEECH_REGION") {
    if (!/^[A-Za-z0-9-]{2,40}$/.test(v)) throw hata("bölge adı harf, rakam ve tireden oluşmalı (örn. westeurope)");
  } else if (ad === "ANTHROPIC_MODEL") {
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(v)) throw hata("geçerli bir model adı olmalı (örn. claude-opus-5)");
  }
}

// {ayarla:{AD:"v"}, sil:["AD"]} ya da eski duz {AD:"v"} govdesi. {ayarla, sil} dondurur; gecersizse HttpHata.
function govdeCoz(b, h) {
  let ayarla = {}, sil = [];
  if (b && (b.ayarla !== undefined || b.sil !== undefined)) { ayarla = b.ayarla || {}; sil = b.sil || []; }
  else for (const [k, v] of Object.entries(b || {})) if (k !== "is") ayarla[k] = v;
  if (!ortak.duzNesne(ayarla) || !Array.isArray(sil)) throw new HttpHata(400, "gecersiz", "İstek biçimi geçersiz: {ayarla:{AD:\"değer\"}, sil:[\"AD\"]} olmalı.");
  const temiz = {};
  for (const [k, v] of Object.entries(ayarla)) {
    if (!IZINLI.includes(k)) throw new HttpHata(400, "anahtar_adi", "Bu ad izinli değil: " + k.slice(0, 60), { izinli: IZINLI });
    if (typeof v !== "string") throw new HttpHata(400, "deger", k + " değeri metin olmalı.");
    const t = v.trim();
    if (!t) continue;                                   // bos deger: dokunma (silmek icin sil listesi var)
    // satir sonu, NUL ve diger kontrol karakterleri (U+2028/2029 dahil): .env'e yarim/ayrisamayan satir yazdirir, silinemez hale getirir
    if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(t) || t.length > DEGER_MAKS) throw new HttpHata(400, "deger", k + " değeri tek satır, kontrol karakteri içermeyen ve en çok " + DEGER_MAKS + " karakterlik metin olmalı.");
    degerDogrula(k, t, h);
    temiz[k] = t;
  }
  for (const k of sil) if (!IZINLI.includes(k)) throw new HttpHata(400, "anahtar_adi", "Bu ad izinli değil: " + (typeof k === "string" ? k.slice(0, 60) : "(metin değil)"), { izinli: IZINLI });
  return { ayarla: temiz, sil: sil.filter(k => !Object.prototype.hasOwnProperty.call(temiz, k)) };
}

// ---------------------------------------------------------------- ag yardimcisi
function getir(secenek, h) {
  const https = (h && h.https) || nodeHttps;
  return new Promise(coz => {
    let bitti = false;
    const son = x => { if (!bitti) { bitti = true; coz(x); } };
    let r;
    try {
      r = https.request(Object.assign({ method: "GET", timeout: 15000 }, secenek), res => {
        const p = []; res.on("data", c => p.push(c));
        res.on("end", () => son({ durum: res.statusCode, govde: Buffer.concat(p).toString("utf8").slice(0, 4000) }));
        res.on("error", e => son({ durum: 0, hata: e.message }));
      });
    } catch (e) { return son({ durum: 0, hata: e.message }); }
    r.on("timeout", () => { r.destroy(); son({ durum: 0, hata: "yanıt vermedi" }); });
    r.on("error", e => son({ durum: 0, hata: e.message }));
    r.end();
  });
}

const testler = {
  async claude(anahtar, h) {
    if (!anahtar) return { ok: false, mesaj: "anahtar girilmemiş" };
    const bas = { "x-api-key": anahtar, "anthropic-version": "2023-06-01" };
    const r = await getir({ hostname: "api.anthropic.com", path: "/v1/models?limit=1", headers: bas }, h);
    if (r.durum === 200) {
      const model = (h && h.model) || ortak.envOku("ANTHROPIC_MODEL");
      if (model) {
        const m = await getir({ hostname: "api.anthropic.com", path: "/v1/models/" + encodeURIComponent(model), headers: bas }, h);
        if (m.durum === 404) return { ok: false, mesaj: "anahtar çalışıyor ama '" + model + "' adlı model bulunamadı — ANTHROPIC_MODEL adını düzelt" };
      }
      return { ok: true, mesaj: "çalışıyor — Claude senaryo motoru hazır (kredi bakiyesi bu testle görünmez)" };
    }
    if (r.durum === 401) return { ok: false, mesaj: "anahtar geçersiz — console.anthropic.com/settings/keys adresinden yenisini al" };
    if (r.durum === 403) return { ok: false, mesaj: "anahtarın bu işlem için izni yok" };
    if (r.durum === 429) return { ok: false, mesaj: "şu an istek sınırında — biraz sonra tekrar test et" };
    if (r.durum === 0) return { ok: false, mesaj: "Anthropic'e ulaşılamadı (" + (r.hata || "ağ hatası") + ")" };
    return { ok: false, mesaj: "HTTP " + r.durum };
  },
  async vidiq(anahtar, h) {
    if (!anahtar) return { ok: false, mesaj: "anahtar girilmemiş" };
    try {
      const v = (h && h.vidiq) || require("./vidiq");
      return await v.test(anahtar, h && h.https ? { https: h.https } : undefined);
    } catch (e) { return { ok: false, mesaj: "vidIQ testi yapılamadı: " + e.message }; }
  },
  async pexels(anahtar, h) {
    if (!anahtar) return { ok: false, mesaj: "anahtar girilmemiş (isteğe bağlı)" };
    const r = await getir({ hostname: "api.pexels.com", path: "/v1/search?query=test&per_page=1", headers: { Authorization: anahtar } }, h);
    if (r.durum === 200) return { ok: true, mesaj: "çalışıyor — yüksek kaliteli görseller açık" };
    if (r.durum === 401) return { ok: false, mesaj: "anahtar geçersiz" };
    if (r.durum === 0) return { ok: false, mesaj: "Pexels'e ulaşılamadı (" + (r.hata || "ağ hatası") + ")" };
    return { ok: false, mesaj: "HTTP " + r.durum };
  },
  async pixabay(anahtar, h) {
    if (!anahtar) return { ok: false, mesaj: "anahtar girilmemiş (isteğe bağlı)" };
    const r = await getir({ hostname: "pixabay.com", path: "/api/?key=" + encodeURIComponent(anahtar) + "&q=test&image_type=photo&per_page=3" }, h);
    if (r.durum === 200) return { ok: true, mesaj: "çalışıyor — geniş arşiv açık" };
    if (r.durum === 0) return { ok: false, mesaj: "Pixabay'a ulaşılamadı (" + (r.hata || "ağ hatası") + ")" };
    return { ok: false, mesaj: "anahtar geçersiz (HTTP " + r.durum + ")" };
  },
};
const ANAHTAR_ADI = { claude: "ANTHROPIC_API_KEY", vidiq: "VIDIQ_KEY", pexels: "PEXELS_KEY", pixabay: "PIXABAY_KEY" };

const testKapali = () => process.env.PANEL_ANAHTAR_TEST_KAPALI === "1";
async function testEt(ad, h) {
  if (testKapali()) return { ok: false, mesaj: "ağ testi kapalı" };
  if (!sahip(testler, ad)) return { ok: false, mesaj: "bu anahtar için test yok" };
  try { return await testler[ad](ortak.envOku(ANAHTAR_ADI[ad]), h); }
  catch (e) { return { ok: false, mesaj: "test yapılamadı: " + e.message }; }
}
// ad: "hepsi" ya da test adi (claude|vidiq|pexels|pixabay) ya da .env adi
async function testHepsi(ad, h) {
  let liste = Object.keys(ANAHTAR_ADI);
  if (ad && ad !== "hepsi") {
    const t = sahip(testler, ad) ? ad : (sahip(TEST_ESLEME, ad) ? TEST_ESLEME[ad] : undefined);
    if (!t) throw new HttpHata(400, "anahtar_adi", "Bu anahtar için test yok.", { testler: Object.keys(testler) });
    liste = [t];
  }
  const o = {};
  await Promise.all(liste.map(async t => { o[t] = await testEt(t, h); }));
  return o;
}
// Kaydedilen anahtarlara gore hangi testler kosmali
function testlerKaydedilenler(adlar) {
  const s = new Set();
  for (const a of adlar) if (TEST_ESLEME[a]) s.add(TEST_ESLEME[a]);
  return Array.from(s);
}

module.exports = { IZINLI, ACIK, maskele, maskeliListe, govdeCoz, degerDogrula, testler, testEt, testHepsi, testlerKaydedilenler, getir, ANAHTAR_ADI };
