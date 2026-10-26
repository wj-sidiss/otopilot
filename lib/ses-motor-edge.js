// lib/ses-motor-edge.js — Microsoft Edge "sesli oku" motoru. VARSAYILAN motor. Kendi kucuk WebSocket istemcimiz.
//
// UYARI: Bu, Microsoft'un sozlesmeli resmi bir API'si DEGIL; Edge tarayicisinin sesli okuma ucunu taklit eder.
// Ucretsiz ve anahtarsiz ama garantisiz: Microsoft ucu, belirteci ya da IP sinirini degistirirse calismayabilir.
// Ticari kanalda hak durumu belirsizdir. Bu yuzden motor soyutlandi (azure resmi REST, piper yerel, sistem) ve
// "otomatik" modda yedege gecilir.
//
// NEDEN KENDI ISTEMCIMIZ (26 Ekim 2026 olcumu, 64 baslik kombinasyonu x 2 uc):
//  - api.msedgeservices.com: el sikismada User-Agent + Origin + Accept-Encoding + Accept-Language DORDU birden yoksa
//    101 yerine BOS HTTP 200 donuyor ("Unexpected server response: 200"). msedge-tts 2.1.0 yalniz ilk ikisini yolluyordu
//    ve baslik listesi disaridan degistirilemiyor (node_modules yamasi da npm ci ile kaybolur).
//  - speech.platform.bing.com: Sec-MS-GEC v2 belirteci + User-Agent ister (v1 -> 403). Acilir AMA Turkce varsayilan ses
//    tr-TR-AhmetNeural denemelerin ~%80'inde turn.start'tan sonra susup ~3,8 sn'de 1006 ile kopuyor (msedge-tts 2.1.1 bu uca gecti).
//  => Uc sirasi: msedgeservices (tam tarayici basligi) -> bing (v2). Calisan uc surec boyunca hatirlanir; biri duserse AYNI
//     cagrida digeri denenir. Her istek KENDI baglantisini acar: iptal edilen istege gec gelen kare baska istegi bozamaz
//     (eski kutuphanedeki "silinmis istege gec kare" cokmesi bu tasarimda olusmaz).
//
// Arayuz (tum motorlar ayni):
//   olustur({ses, hiz, log?}) -> { ad, kelimeZamani, ses, sentez(metin,{sinyal}), sifirla(), kapat() }
//   sentez -> Promise<{buf: Buffer(mp3), kelimeler: [{t,d,w}]}>   (t/d ms, parcaya gore goreli; WordBoundary'den)
// Test enjeksiyonu: WebSocket (sinif: 'ws' paketi ya da Node'un yerlesik WebSocket'i), uclar (yerel sahte sunucu),
//   sessizlikMs, getir (saat kontrolu icin fetch). msedge: msedge-tts uyumlu kutuphane verilirse ESKI akis yolu
//   kullanilir (testlerin sahte kutuphanesi; uretimde kullanilmaz).
"use strict";
const crypto = require("crypto");
const { xmlKacis } = require("./ses-metin.js");

const SES_ADI = /^[A-Za-z0-9-]{3,80}$/;
const HIZ = /^[+-]?\d{1,3}%$/;
// Edge'in herkese acik istemci belirteci: tum Edge sesli okuma istemcilerinde ayni (edge-tts, msedge-tts); gizli DEGIL.
const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM = "143.0.3650.75";                 // surum denetlenmiyor; sunucu yalniz Sec-MS-GEC-Version'in "2-" onekine bakiyor
const WIN_EPOCH = 11644473600;                    // 1601-01-01 -> 1970-01-01 (sn)
// Sec-MS-GEC v2 ozet tuzu: Edge'in yerel kodunda gomulu telif satiri (edge-tts drm.py, msedge-tts 2.1.1 ile ayni girdi)
const ON_EK = "Copyright (C) Microsoft Corporation. All rights reserved.";
const UCLAR = Object.freeze([
  Object.freeze({ ad: "msedgeservices", url: "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1", anahtar: "Ocp-Apim-Subscription-Key" }),
  Object.freeze({ ad: "bing", url: "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1", anahtar: "TrustedClientToken" }),
]);
const SURUM_ANA = CHROMIUM.split(".")[0];
// DORDU birden sart (User-Agent, Origin, Accept-Encoding, Accept-Language); Pragma/Cache-Control tarayiciyla ayni olsun diye
const BASLIKLAR = Object.freeze({
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + SURUM_ANA +
    ".0.0.0 Safari/537.36 Edg/" + SURUM_ANA + ".0.0.0",
  "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9",
  "Pragma": "no-cache",
  "Cache-Control": "no-cache",
});
const FORMAT = "audio-24khz-96kbitrate-mono-mp3";  // sentetik test sesi ve eski ciktilarla ayni bicim
const SESSIZLIK_MS = 8000;                         // bu kadar sure hic kare gelmezse uc takildi sayilir, digerine gecilir

// Surec geneli durum: saat kaymasi (belirtec 5 dk'lik pencereye bagli) ve son calisan uc (her paragrafta yeniden kesfetmemek icin)
let saatKaymasiMs = 0, tercihUc = null;

const kimlik = () => crypto.randomUUID().replace(/-/g, "");
const kontrolTemizle = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
const rol16 = v => ((v << 16) | (v >>> 16)) >>> 0;

// ---------------------------------------------------------------------------
// Sec-MS-GEC v2 = "<CS64 16 hex>-<SHA256 64 hex>" ; girdi = ON_EK + ticks + TOKEN
//   ticks: (unix_sn + WIN_EPOCH) 300 sn'lik pencereye asagi yuvarlanir, x 10^7 (100 ns). Vektorler testte.
// ---------------------------------------------------------------------------
function ticksMetni(unixSn) {
  let t = Number(unixSn) + WIN_EPOCH;
  t -= t % 300;
  t *= 1e7;
  return t.toFixed(0);
}

// CS64: mesaj kucuk-endian 32 bit kelime ciftleri (8 bayta sifirla doldurulur); anahtarlar ozetin ilk iki LE kelimesi |1
function cs64(mesaj, ozet) {
  const k1 = (ozet.readUInt32LE(0) | 1) >>> 0, k2 = (ozet.readUInt32LE(4) | 1) >>> 0;
  const d = Buffer.alloc(Math.ceil(mesaj.length / 8) * 8);
  mesaj.copy(d);
  const takas = (w, k, a, b, c) => {
    const q = Math.imul(rol16((Math.imul(w, k) + Math.imul(rol16(w), a)) >>> 0), b) >>> 0;
    return (Math.imul(rol16(q), c) + q) >>> 0;
  };
  const karistir = (v, carpanlar) => { for (const c of carpanlar) v = Math.imul(rol16(v), c) >>> 0; return v; };
  let takasTop = 0, sonTakas = 0, kar = 0, karTop = 0;
  for (let o = 0; o < d.length; o += 8) {
    const w1 = d.readUInt32LE(o), w2 = d.readUInt32LE(o + 4);
    const a = takas(w1, k1, 0xEF0569FB, 0x76F50F34, 0xC3EFEA97);
    sonTakas = takas(w2, k2, 0xC31713DB, 0x1881CE3C, 0x35BD1EC9);
    takasTop = (takasTop + a + sonTakas) >>> 0;
    kar = karistir(Math.imul((kar + w1) >>> 0, k1) >>> 0, [0xCF98B111, 0x87085B9F, 0x12CEB96D, 0x257E1D83]);
    karTop = (karTop + kar) >>> 0;
    kar = karistir(Math.imul((kar + w2) >>> 0, k2) >>> 0, [0xA27416F5, 0xD38396FF, 0x7C932B89, 0xBFA49F69]);
    karTop = (karTop + kar) >>> 0;
  }
  const c = Buffer.alloc(8);
  c.writeUInt32LE((sonTakas ^ kar) >>> 0, 0);
  c.writeUInt32LE((takasTop ^ karTop) >>> 0, 4);
  return c;
}

function secMsGec(unixSn) {
  const mesaj = Buffer.from(ON_EK + ticksMetni(unixSn) + TOKEN, "ascii");
  const ozet = crypto.createHash("sha256").update(mesaj).digest();
  return cs64(mesaj, ozet).toString("hex").toUpperCase() + "-" + ozet.toString("hex").toUpperCase();
}

// Edge'in X-Timestamp bicimi: "Mon Oct 26 2026 02:15:00 GMT+0000 (Coordinated Universal Time)"
function zamanDamgasi() {
  return new Date().toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) ([\d:]+) GMT$/, "$1 $3 $2 $4 $5") +
    " GMT+0000 (Coordinated Universal Time)";
}

// WebSocket secimi: 'ws' paketi (kuruluysa; el sikisma reddinde HTTP durum kodu + Date basligi verir) ya da Node'un
// yerlesik WebSocket'i (Node 22+, undici; ozel baslik destekli). Enjekte edilen sinifin turu prototipten anlasilir.
function wsSec(enjekte) {
  if (enjekte) return { tur: enjekte.prototype && typeof enjekte.prototype.on === "function" ? "ws" : "yerlesik", WS: enjekte };
  try { return { tur: "ws", WS: require("ws") }; } catch (e) { /* yok: yerlesik */ }
  if (typeof globalThis.WebSocket === "function") return { tur: "yerlesik", WS: globalThis.WebSocket };
  const h = new Error("Edge sesi için WebSocket bulunamadı (Node 22 ya da üstü gerekir)");
  h.kalici = true;
  throw h;
}

// -> {ok} | {ok:false, neden}   (motor secimi icin: ag yoklamaz)
function hazirMi() {
  try { wsSec(); return { ok: true }; } catch (e) { return { ok: false, neden: e.message }; }
}

// ---------------------------------------------------------------------------
// Kendi istemcimiz
// ---------------------------------------------------------------------------
function istemci(ayar) {
  const hiz = HIZ.test(String(ayar.hiz || "")) ? String(ayar.hiz) : "+0%";
  const { tur, WS } = wsSec(ayar.WebSocket);
  const uclar = ayar.uclar || UCLAR;
  const log = ayar.log || (() => {});
  const sessizlikMs = ayar.sessizlikMs || SESSIZLIK_MS;
  const getir = ayar.getir || (typeof fetch === "function" ? fetch : null);
  const xmlDil = (/^[a-z]{2,3}-[A-Z]{2}/.exec(ayar.ses) || ["en-US"])[0];
  const acik = new Set();                  // kapat() icin canli soketler
  let nesil = 0;                           // kapat() sonrasi suren sentez baska uca gecmesin (kapatma ariza degildir)

  const soketKes = ws => { try { if (typeof ws.terminate === "function") ws.terminate(); else ws.close(); } catch (e) { /* zaten kapali */ } };

  // Tek baglanti = tek istek. -> {buf, kelimeler} ; hata: {acildi, durum?, sunucuTarihi?, kapanisKodu?, takildi?}
  function tekIstek(uc, metin, sinyal) {
    const url = uc.url + "?" + uc.anahtar + "=" + TOKEN + "&ConnectionId=" + kimlik() +
      "&Sec-MS-GEC=" + secMsGec((Date.now() + saatKaymasiMs) / 1000) + "&Sec-MS-GEC-Version=2-" + CHROMIUM;
    const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" + xmlDil + "'>" +
      "<voice name='" + ayar.ses + "'><prosody pitch='+0Hz' rate='" + hiz + "' volume='+0%'>" +
      xmlKacis(kontrolTemizle(metin)) + "</prosody></voice></speak>";
    return new Promise((coz, red) => {
      const parcalar = [], kelimeler = [];
      let bitti = false, acildi = false, sessizlik = null, ws;
      function son(hata, deger) {
        if (bitti) return;
        bitti = true;
        clearTimeout(sessizlik);
        if (sinyal) sinyal.removeEventListener("abort", iptal);
        if (ws) { acik.delete(ws); soketKes(ws); }     // dinleyiciler KALIR: gec gelen hata/kare yutulur (bitti)
        if (hata) { hata.acildi = acildi; red(hata); } else coz(deger);
      }
      function iptal() { son((sinyal && sinyal.reason) || new Error("iptal edildi")); }
      const bekci = () => {
        clearTimeout(sessizlik);
        sessizlik = setTimeout(() => son(Object.assign(new Error(uc.ad + ": " + Math.round(sessizlikMs / 100) / 10 +
          " sn veri gelmedi"), { takildi: true })), sessizlikMs);
      };
      if (sinyal) {
        if (sinyal.aborted) return iptal();
        sinyal.addEventListener("abort", iptal, { once: true });
      }
      try { ws = new WS(url, { headers: BASLIKLAR }); }
      catch (e) { return son(new Error(uc.ad + ": bağlantı açılamadı: " + e.message)); }
      if (tur !== "ws") ws.binaryType = "arraybuffer";
      acik.add(ws);
      bekci();

      const ac = () => {
        if (bitti) return;
        acildi = true;
        bekci();
        ws.send("X-Timestamp:" + zamanDamgasi() + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},' +
          '"outputFormat":"' + FORMAT + '"}}}}\r\n');
        ws.send("X-RequestId:" + kimlik() + "\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:" + zamanDamgasi() +
          "Z\r\nPath:ssml\r\n\r\n" + ssml);
      };
      const mesaj = (veri, ikili) => {
        if (bitti) return;
        bekci();
        if (!ikili) {
          const s = Buffer.isBuffer(veri) ? veri.toString("utf8") : String(veri);
          const i = s.indexOf("\r\n\r\n");
          const yol = (/(?:^|\r\n)Path:([^\r\n]*)/.exec(i < 0 ? s : s.slice(0, i)) || [])[1];
          if (yol === "audio.metadata") {
            try {
              for (const m of JSON.parse(s.slice(i + 4)).Metadata || []) {
                if (m && m.Type === "WordBoundary" && m.Data) {
                  kelimeler.push({
                    t: Math.round(m.Data.Offset / 10000),                 // 100 ns -> ms
                    d: Math.round((m.Data.Duration || 0) / 10000),
                    w: (m.Data.text && m.Data.text.Text) || "",
                  });
                }
              }
            } catch (e) { /* tek bozuk paket: sesDogrula kelime sayisiyla yakalar */ }
          } else if (yol === "turn.end") {
            if (!parcalar.length) return son(new Error(uc.ad + ": ses gelmedi (ses adı geçersiz olabilir: " + ayar.ses + ")"));
            // turn.end'den sonra kare gelmez: metadata sesten once/arada gelir
            son(null, { buf: Buffer.concat(parcalar), kelimeler });
          }
          return;                                            // turn.start / response: bilgi
        }
        // ikili kare: 2 bayt (big-endian) baslik uzunlugu + baslik + mp3 verisi
        const b = Buffer.from(veri);
        if (b.length < 2) return;
        const hl = b.readUInt16BE(0);
        const bas = b.subarray(2, 2 + hl).toString("latin1");
        if (!/(?:^|\r\n)Path:audio(?:\r\n|$)/.test(bas)) return;
        const v = b.subarray(2 + hl);
        if (v.length) parcalar.push(v);                     // akis sonu karesi bos ve icerik turu yok (beklenen)
      };

      if (tur === "ws") {
        ws.on("unexpected-response", (q, r) => {
          const e = Object.assign(new Error(uc.ad + ": el sıkışma reddedildi (HTTP " + r.statusCode + ")"),
            { durum: r.statusCode, sunucuTarihi: r.headers && r.headers.date });
          try { r.resume(); q.destroy(); } catch (x) { /* yoksay */ }
          son(e);
        });
        ws.on("open", ac);
        ws.on("message", (d, ikiliMi) => mesaj(d, ikiliMi));
        ws.on("error", e => son(new Error(uc.ad + ": " + ((e && e.message) || "bağlantı hatası"))));
        ws.on("close", k => son(Object.assign(new Error(uc.ad + ": bağlantı ses bitmeden kapandı (kod " + k + ")"), { kapanisKodu: k })));
      } else {
        ws.onopen = ac;
        ws.onmessage = ev => mesaj(ev.data, typeof ev.data !== "string");
        ws.onerror = () => son(new Error(uc.ad + ": bağlantı hatası" + (acildi ? "" : " (el sıkışma reddedildi)")));
        ws.onclose = ev => son(Object.assign(new Error(uc.ad + ": bağlantı ses bitmeden kapandı (kod " + ev.code + ")"), { kapanisKodu: ev.code }));
      }
    });
  }

  // El sikisma reddi saat yanlisligindan mi? (belirtec 5 dk'lik pencereye bagli; yanlis saatte iki uc da 403 + Date verir)
  // 'ws' Date'i el sikisma yanitindan verir; yerlesik WebSocket vermez: ayni sunucuya HEAD istegiyle sorulur.
  async function saatDenetle(e, uc, sinyal) {
    let sunucu = e.sunucuTarihi ? Date.parse(e.sunucuTarihi) : NaN;
    if (!Number.isFinite(sunucu) && tur !== "ws" && getir) {
      try {
        const r = await getir(uc.url.replace(/^ws/, "http"), { method: "HEAD", signal: sinyal });
        sunucu = Date.parse((r && r.headers && r.headers.get && r.headers.get("date")) || "");
      } catch (x) { /* ag yok: duzeltme yok */ }
    }
    if (!Number.isFinite(sunucu)) return false;
    const yeni = sunucu - Date.now();
    if (Math.abs(yeni - saatKaymasiMs) < 60000) return false;   // pencere 5 dk: 1 dk alti fark red sebebi olamaz
    log("Edge: bilgisayarın saati " + Math.round((saatKaymasiMs - yeni) / 1000) + " sn kaymış; belirteç sunucu saatine göre düzeltildi.");
    saatKaymasiMs = yeni;
    return true;
  }

  // Son calisan uc en basta; sonra tanimli sira
  function siraliUclar() {
    const i = uclar.findIndex(u => u.ad === tercihUc);
    return i <= 0 ? uclar.slice() : [uclar[i]].concat(uclar.filter((u, k) => k !== i));
  }

  async function sentez(metin, secenek) {
    const sinyal = secenek && secenek.sinyal;
    const iptalHatasi = () => (sinyal && sinyal.reason) || new Error("iptal edildi");
    if (sinyal && sinyal.aborted) throw iptalHatasi();
    const hatalar = [], kodlar = [], benim = nesil;
    for (const uc of siraliUclar()) {
      for (let saatDenemesi = 0; saatDenemesi < 2; saatDenemesi++) {
        if (sinyal && sinyal.aborted) throw iptalHatasi();
        if (benim !== nesil) throw new Error("Edge bağlantısı kapatıldı");
        try {
          const r = await tekIstek(uc, metin, sinyal);
          if (tercihUc !== uc.ad) {
            if (tercihUc !== null || uc !== uclar[0]) log("Edge: '" + uc.ad + "' ucu kullanılıyor.");
            tercihUc = uc.ad;
          }
          return r;
        } catch (e) {
          if (sinyal && sinyal.aborted) throw iptalHatasi();
          if (benim !== nesil) throw new Error("Edge bağlantısı kapatıldı");
          hatalar.push(e.message);
          kodlar.push(e.kapanisKodu);
          if (saatDenemesi === 0 && !e.acildi && (e.durum === 403 || e.durum == null) && await saatDenetle(e, uc, sinyal)) continue;
          break;                                            // bu uc olmadi: siradakine gec
        }
      }
    }
    const h = new Error("Edge sesi alınamadı: " + hatalar.join(" | "));
    // Tum uclar 1007 (gecersiz veri) ile kapadiysa sorun girdidedir (ses adi/SSML): ayni girdiyle tekrar denemek bosuna.
    if (kodlar.length && kodlar.every(k => k === 1007)) {
      h.tekrarsiz = true;
      h.message += " (ses adı ya da metin reddedildi)";
      h.cozum = "Ses adını kontrol et (örnek: tr-TR-AhmetNeural, en-US-ChristopherNeural).";
    }
    throw h;
  }

  function kapat() {
    nesil++;
    for (const ws of acik) soketKes(ws);
    acik.clear();
  }

  return { ad: "edge", kelimeZamani: true, ses: ayar.ses, sentez, sifirla: async () => { kapat(); }, kapat };
}

// ---------------------------------------------------------------------------
// ESKI akis yolu: msedge-tts uyumlu kutuphane ENJEKTE edilirse (testlerin sahte kutuphanesi). Uretimde kullanilmaz.
// ---------------------------------------------------------------------------
// Iptal edilen isteğin SOKETINI hemen kes: kutuphane yok edilen akisin kaydini siler, sunucu sonradan kare yollarsa
// onmessage icinde TypeError firlatirdi. t._streams/_ws/_retiredSockets kutuphanenin ozel alanlari; yoksa atlanir.
function sokettiKes(t, istekNo) {
  if (!t) return;
  const soketler = new Set();
  try {
    const akis = istekNo && t._streams && t._streams[istekNo];
    if (akis && akis.socket) soketler.add(akis.socket);
    if (t._ws) soketler.add(t._ws);
    for (const s of (t._retiredSockets || [])) soketler.add(s);
  } catch (e) { /* ozel alanlar okunamadi: yoksay */ }
  for (const s of soketler) {
    try {
      if (typeof s.terminate === "function") s.terminate();
      else if (typeof s.close === "function") s.close();
    } catch (e) { /* zaten kapali */ }
  }
}

function kutuphaneIle(ayar, kutuphane) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = kutuphane;
  let tts = null;
  let nesil = 0;          // sifirla/kapat sonrasi gec kalan baglantilarin sizmamasi icin

  function kapat() {
    nesil++;
    const t = tts; tts = null;
    try { if (t && typeof t.close === "function") t.close(); } catch (e) { /* yoksay */ }
  }

  async function baglan() {
    kapat();
    const benim = nesil;
    const yeni = new MsEdgeTTS();
    await yeni.setMetadata(ayar.ses, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
      sentenceBoundaryEnabled: false,
    });
    if (benim !== nesil) {                 // baglanirken iptal edildi: baglantiyi birak
      try { yeni.close(); } catch (e) { /* yoksay */ }
      throw new Error("bağlantı iptal edildi");
    }
    tts = yeni;
  }

  async function sentez(metin, secenek) {
    const sinyal = secenek && secenek.sinyal;
    const iptalHatasi = () => (sinyal && sinyal.reason) || new Error("iptal edildi");
    if (sinyal && sinyal.aborted) throw iptalHatasi();
    if (!tts) await baglan();
    if (sinyal && sinyal.aborted) throw iptalHatasi();      // baglanirken zaman asimi: istek hic yollanmasin
    const t = tts;
    const r = await t.toStream(xmlKacis(metin), { rate: ayar.hiz });
    const audioStream = r && r.audioStream, metadataStream = r && r.metadataStream;
    if (!audioStream) throw new Error("Edge ses akışı açılamadı");
    const istekNo = r.requestId;

    return new Promise((coz, red) => {
      const parcalar = [], kelimeler = [];
      let bitti = false;
      const iptal = () => {
        sokettiKes(t, istekNo);                  // ONCE soketi kes, sonra akislari yok et (gec kare cokertmesin)
        try { audioStream.destroy(); } catch (e) { /* yoksay */ }
        try { if (metadataStream) metadataStream.destroy(); } catch (e) { /* yoksay */ }
        bitir((sinyal && sinyal.reason) || new Error("iptal edildi"));
      };
      function bitir(hata, deger) {
        if (bitti) return;
        bitti = true;
        if (sinyal) sinyal.removeEventListener("abort", iptal);
        if (hata) red(hata); else coz(deger);
      }
      if (sinyal) {
        if (sinyal.aborted) return iptal();
        sinyal.addEventListener("abort", iptal, { once: true });
      }

      if (metadataStream) metadataStream.on("data", d => {
        try {
          // metadata Buffer olarak gelir (string degil): cozulmeden JSON.parse atlanirsa kelime zamanlari HIC yakalanmaz
          const obj = Buffer.isBuffer(d) ? JSON.parse(d.toString("utf8"))
                    : typeof d === "string" ? JSON.parse(d) : d;
          const liste = obj.Metadata || (Array.isArray(obj) ? obj : [obj]);
          for (const m of liste) {
            if (m && m.Type === "WordBoundary" && m.Data) {
              kelimeler.push({
                t: Math.round(m.Data.Offset / 10000),                 // 100ns -> ms
                d: Math.round((m.Data.Duration || 0) / 10000),
                w: (m.Data.text && m.Data.text.Text) || "",
              });
            }
          }
        } catch (e) { /* tek metadata paketi bozuksa yoksay; sayi kontrolu eksigi yakalar */ }
      });
      if (metadataStream) metadataStream.on("error", () => { /* ses akisi hatasi esastir */ });

      audioStream.on("data", c => parcalar.push(c));
      // 'end' normal bitis. Bir tick bekle: son metadata paketleri sesten sonra gelebilir.
      audioStream.on("end", () => setImmediate(() => bitir(null, { buf: Buffer.concat(parcalar), kelimeler })));
      audioStream.on("error", e => bitir(e));
      // 'end' gelmeden kapanirsa (turn.end yok) ses kesiktir.
      audioStream.on("close", () => setImmediate(() =>
        bitir(new Error("Edge bağlantısı ses bitmeden kapandı (ses kesik olabilir)"))));
    });
  }

  return {
    ad: "edge",
    kelimeZamani: true,
    ses: ayar.ses,
    sentez,
    sifirla: async () => { kapat(); },     // bir sonraki sentez YENI baglanti + setMetadata acar
    kapat,
  };
}

function olustur(ayar) {
  if (!SES_ADI.test(String(ayar.ses || ""))) {
    const e = new Error("Geçersiz ses adı: '" + ayar.ses + "' (örnek: en-US-ChristopherNeural)");
    e.kalici = true;
    throw e;
  }
  return ayar.msedge ? kutuphaneIle(ayar, ayar.msedge) : istemci(ayar);
}

module.exports = {
  olustur, hazirMi, secMsGec, ticksMetni, UCLAR, BASLIKLAR, FORMAT,
  _durum: () => ({ saatKaymasiMs, tercihUc }),
  _sifirla: () => { saatKaymasiMs = 0; tercihUc = null; },          // testler: surec geneli durumu sifirla
};
