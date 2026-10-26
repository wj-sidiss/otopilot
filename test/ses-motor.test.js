// test/ses-motor.test.js — motor katmani: zaman asimi, yeniden deneme, kesik ses, bolme, motor secimi,
// Azure/Piper istemcileri. Ag SAHTELENIR; ses gercek ffmpeg (lavfi) ile sentetiktir.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./ses-sahte.js");

const ortam = S.ortamiYalitla();
const testF = S.ffmpegTesti(test);          // ffmpeg yoksa (CI) atlanir
const M = require("../lib/ses-motor.js");
const edge = require("../lib/ses-motor-edge.js");
const azure = require("../lib/ses-motor-azure.js");
const piper = require("../lib/ses-motor-piper.js");
const ortak = require("../lib/ortak.js");

const ara = fs.mkdtempSync(path.join(os.tmpdir(), "ses-motor-test-"));
test.after(() => { fs.rmSync(ara, { recursive: true, force: true }); ortam.temizle(); });

const METIN = "Bu bir deneme cümlesidir ve beş kelimeden uzundur.";    // 8 kelime
const edgeMotor = (karar, ek) => {
  const sahte = S.sahteEdge(karar);
  return { sahte, motor: edge.olustur(Object.assign({ ses: "tr-TR-AhmetNeural", hiz: "+7%", msedge: sahte }, ek || {})) };
};

testF("Edge: ilk denemede basari, kelime zamanlari ve sure olculur", async () => {
  const { sahte, motor } = edgeMotor();
  const r = await M.denemeliSentez(motor, METIN, { araDizin: ara, dil: "tr", hiz: "+7%", ayar: S.hizliAyar() });
  assert.equal(r.denemeler, 1);
  assert.equal(r.kelimeler.length, 8);
  assert.equal(r.kelimeler[0].w, "Bu");
  assert.ok(r.sureSn > 2 && r.sureSn < 4, "sure ffprobe ile olculur: " + r.sureSn);
  assert.equal(sahte.durum.baglanti, 1);
  assert.equal(sahte.durum.istekler[0].rate, "+7%");
  motor.kapat();
  assert.equal(sahte.durum.kapatilan, 1, "kapat() baglantiyi kapatmali");
});

testF("Edge: hata sonrasi YENI baglanti + setMetadata, 2/5 sn ustel bekleme, sonunda basari", async () => {
  const beklemeler = [];
  const { sahte, motor } = edgeMotor((no) => (no <= 2 ? "hata" : "tam"));
  const r = await M.denemeliSentez(motor, METIN, { araDizin: ara, dil: "tr", hiz: "+7%",
    ayar: S.hizliAyar({ bekle: async ms => { beklemeler.push(ms); } }) });
  assert.equal(r.denemeler, 3);
  assert.deepEqual(beklemeler, [2000, 5000]);
  assert.equal(sahte.durum.baglanti, 3, "her yeniden denemede yeni baglanti");
  assert.equal(sahte.durum.setMetadata, 3);
  assert.equal(sahte.durum.kapatilan, 2, "eski baglantilar kapatilmali");
});

test("denemeler tukenirse hata (5 deneme, 2/5/10/20 sn)", async () => {
  const beklemeler = [];
  const { sahte, motor } = edgeMotor(() => "hata");
  await assert.rejects(
    M.denemeliSentez(motor, METIN, { araDizin: ara, dil: "tr", hiz: "+7%", ayar: S.hizliAyar({ bekle: async ms => { beklemeler.push(ms); } }) }),
    /Edge WebSocket koptu/);
  assert.equal(sahte.durum.istekler.length, 5);
  assert.deepEqual(beklemeler, [2000, 5000, 10000, 20000]);
});

testF("takilan baglanti zaman asimiyla iptal edilir, sonraki deneme basarili", async () => {
  const { sahte, motor } = edgeMotor((no) => (no === 1 ? "asili" : "tam"));
  const t0 = Date.now();
  const r = await M.denemeliSentez(motor, METIN, { araDizin: ara, dil: "tr", hiz: "+7%", ayar: S.hizliAyar({ zamanAsimiMs: 150 }) });
  assert.equal(r.denemeler, 2);
  assert.ok(Date.now() - t0 < 3000);
  assert.equal(sahte.durum.istekler.length, 2);
});

testF("kesik ses (%70'ten az kelime) basarisiz sayilir ve yeniden denenir", async () => {
  const { sahte, motor } = edgeMotor((no) => (no === 1 ? "kesik" : "tam"));
  const r = await M.denemeliSentez(motor, METIN, { araDizin: ara, dil: "tr", hiz: "+7%", ayar: S.hizliAyar() });
  assert.equal(r.denemeler, 2);
  assert.equal(r.kelimeler.length, 8);
  assert.equal(sahte.durum.istekler.length, 2);
});

testF("yarida kapanan akis ve bos ses basarisiz sayilir", async () => {
  for (const kotu of ["yaridaKapan", "bos"]) {
    const { motor } = edgeMotor((no) => (no === 1 ? kotu : "tam"));
    const r = await M.denemeliSentez(motor, METIN, { araDizin: ara, dil: "tr", hiz: "+7%", ayar: S.hizliAyar() });
    assert.equal(r.denemeler, 2, kotu);
  }
});

testF("kelime zamani hic gelmezse ses kabul edilir ama uyari isaretlenir", async () => {
  const { motor } = edgeMotor(() => "kelimesiz");
  const r = await M.denemeliSentez(motor, METIN, { araDizin: ara, dil: "tr", hiz: "+7%", ayar: S.hizliAyar() });
  assert.equal(r.kelimeler.length, 0);
  assert.equal(r.uyari, "kelime zamanı gelmedi");
});

test("kalici hata (gecersiz ses adi) bosuna denenmez", async () => {
  assert.throws(() => edge.olustur({ ses: "kotu ses adi!", hiz: "+0%", msedge: S.sahteEdge() }), /Geçersiz ses adı/);
  const motor = { kelimeZamani: false, sifirla: async () => {}, sentez: async () => { const e = new Error("anahtar yanlis"); e.kalici = true; throw e; } };
  let denemeSayisi = 0;
  const sarmal = { ...motor, sentez: async () => { denemeSayisi++; return motor.sentez(); } };
  await assert.rejects(M.denemeliSentez(sarmal, METIN, { araDizin: ara, dil: "en", hiz: "+0%", ayar: S.hizliAyar() }), /anahtar yanlis/);
  assert.equal(denemeSayisi, 1);
});

test("sesDogrula: kelime zamani olmayan motorda cok kisa sure reddedilir", () => {
  const ayar = { kelimeOrani: 0.7, dil: "en", hiz: "+0%", kelimeZamani: false };
  assert.throws(() => M.sesDogrula({ kelimeler: [], sureSn: 0.5 }, "one two three four five six seven eight nine ten", ayar), /çok kısa/);
  assert.deepEqual(M.sesDogrula({ kelimeler: [], sureSn: 5 }, "one two three four five six seven eight nine ten", ayar), {});
  assert.throws(() => M.sesDogrula({ kelimeler: [], sureSn: 0.05 }, "hi", ayar), /çok kısa/);
});

test("sesDogrula: son kelime ses suresinin disinda kalirsa ses yarida kesilmistir", () => {
  const ayar = { kelimeOrani: 0.7, dil: "en", hiz: "+0%", kelimeZamani: true };
  const kel = [{ t: 0, d: 300, w: "one" }, { t: 400, d: 300, w: "two" }, { t: 9000, d: 300, w: "three" }];
  assert.throws(() => M.sesDogrula({ kelimeler: kel, sureSn: 2 }, "one two three", ayar), /yarıda kesilmiş/);
  const kucukTasma = [{ t: 0, d: 300, w: "one" }, { t: 400, d: 300, w: "two" }, { t: 1500, d: 900, w: "three" }];   // 2.4 sn, ses 2.0 sn
  assert.deepEqual(M.sesDogrula({ kelimeler: kucukTasma, sureSn: 2 }, "one two three", ayar), {}, "kucuk tasma normal sayilir");
});

testF("uzun paragraf >1500 karakterde parcalanir, mp3'ler birlestirilir, kelime zamanlari kaydirilir", async () => {
  const { sahte, motor } = edgeMotor();
  const cumle = "Bu cümle uzun paragrafı bölmek için tekrarlanır ve sayılabilir kalır. ";
  const metin = cumle.repeat(55).trim();                          // ~3900 karakter -> en az 3 parca
  assert.ok(metin.length > 3000);
  const hedef = path.join(ara, "uzun.mp3");
  const r = await M.parcaUret(motor, metin, { hedef, araDizin: ara, dil: "tr", hiz: "+7%", ayar: S.hizliAyar({ zamanAsimiMs: 20000 }) });
  assert.ok(r.parcaSayisi >= 3);
  assert.equal(sahte.durum.istekler.length, r.parcaSayisi);
  for (const i of sahte.durum.istekler) assert.ok(i.metin.length <= 1500);
  assert.ok(fs.existsSync(hedef) && !fs.existsSync(hedef + ".part"));
  const beklenenKelime = metin.split(/\s+/).length;
  assert.equal(r.kelimeler.length, beklenenKelime);
  assert.ok(Math.abs(r.sureSn - beklenenKelime * S.SN_KELIME) < 1.5, "birlesik sure ~ parcalarin toplami: " + r.sureSn);
  for (let i = 1; i < r.kelimeler.length; i++) assert.ok(r.kelimeler[i].t >= r.kelimeler[i - 1].t, "zamanlar artan olmali");
  const son = r.kelimeler[r.kelimeler.length - 1];
  assert.ok(son.t > r.sureSn * 1000 * 0.9 - 600, "son kelime sona yakin");
  assert.deepEqual(fs.readdirSync(ara).filter(f => /^_/.test(f)), [], "gecici parcalar silinmeli");
});

test("motorSirasi: otomatik = hazir motorlar; acik motor hazir degilse yapilandirma hatasi (exit 2)", () => {
  const sahte = S.sahteEdge();
  const env = o => ({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "westeurope" })[o];
  const SISTEM = M.motorHazirMi("sistem").ok ? ["sistem"] : [];        // isletim sistemi sesi: makineye gore hazir, hep EN SONDA
  assert.deepEqual(M.motorSirasi("otomatik", env, { msedge: sahte }), ["edge", "azure"].concat(SISTEM));
  assert.deepEqual(M.motorSirasi("otomatik", () => "", { msedge: sahte }), ["edge"].concat(SISTEM));
  assert.deepEqual(M.motorSirasi("piper", o => ({ PIPER_YOL: "x", PIPER_MODEL: "y" })[o], {}), ["piper"]);
  try { M.motorSirasi("azure", () => "", { msedge: sahte }); assert.fail("hata bekleniyordu"); }
  catch (e) { assert.equal(e.cikis, 2); assert.match(e.message, /azure/); assert.match(e.message, /AZURE_SPEECH_KEY/); }
  try { M.motorSirasi("elevenlabs", () => "", {}); assert.fail("hata bekleniyordu"); }
  catch (e) {
    assert.equal(e.cikis, 2); assert.match(e.message, /Bilinmeyen/);
    for (const m of ["otomatik"].concat(M.MOTORLAR)) assert.ok(e.cozum.includes(m), "cozum tum motorlari saymali (" + m + "): " + e.cozum);
  }
});

test("Edge hazir mi: kendi istemcimiz yalniz WebSocket ister (paket/ag yoklamasi yok); enjekte edilen sinif da yeter", () => {
  assert.equal(M.motorHazirMi("edge", () => "", {}).ok, true, "Node 22+ yerlesik WebSocket ya da ws");
  assert.equal(M.motorHazirMi("edge", () => "", { edgeWs: class {} }).ok, true);
  assert.deepEqual(M.motorSirasi("edge", () => "", {}), ["edge"]);
});

test("motorOlustur('edge'): enjeksiyonsuz uretim yolu kendi istemcimiz (msedge-tts kullanilmaz), enjekte sinifla baglanir", async () => {
  const acilan = [];
  class SahteWS { constructor(url, o) { acilan.push({ url, basliklar: o && o.headers }); setImmediate(() => this.onerror && this.onerror({})); } close() {} }
  const motor = M.motorOlustur("edge", { ses: "tr-TR-AhmetNeural", hiz: "+0%", dil: "tr",
    enjekte: { edgeWs: SahteWS, edgeUclar: [{ ad: "yerel", url: "ws://127.0.0.1:9/x", anahtar: "TrustedClientToken" }], edgeGetir: async () => ({ headers: { get: () => null } }) } });
  await assert.rejects(motor.sentez("merhaba", {}), /Edge sesi alınamadı/);
  assert.equal(acilan.length, 1);
  assert.match(acilan[0].url, /^ws:\/\/127\.0\.0\.1:9\/x\?TrustedClientToken=/);
  assert.equal(acilan[0].basliklar["Accept-Language"], edge.BASLIKLAR["Accept-Language"]);
});

// ---------------------------------------------------------------------------
// Azure
// ---------------------------------------------------------------------------
testF("Azure: SSML'i dogru kurar (kacis, ses, hiz, bolge) ve mp3 doner", async () => {
  let gorulen = null;
  const getir = async (url, o) => { gorulen = { url, ...o }; return { durum: 200, basliklar: {}, govde: S.sentetikMp3(2) }; };
  const m = azure.olustur({ ses: "en-US-ChristopherNeural", hiz: "+7%", anahtar: "GIZLI", bolge: "westeurope", getir });
  const r = await m.sentez("Tom & <Jerry>");
  assert.equal(r.kelimeler.length, 0);
  assert.ok(r.buf.length > 1000);
  assert.equal(gorulen.url, "https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
  assert.equal(gorulen.headers["Ocp-Apim-Subscription-Key"], "GIZLI");
  assert.equal(gorulen.headers["Content-Type"], "application/ssml+xml");
  assert.match(gorulen.govde, /xml:lang="en-US"/);
  assert.match(gorulen.govde, /<voice name="en-US-ChristopherNeural"><prosody rate="\+7%">Tom &amp; &lt;Jerry&gt;<\/prosody>/);
  assert.equal(m.kelimeZamani, false);
});

test("Azure: 401 kalici (anahtar_gecersiz), 400 kalici, 429 beklemeli, 5xx gecici", async () => {
  const yap = durum => azure.olustur({ ses: "tr-TR-AhmetNeural", hiz: "+0%", anahtar: "k", bolge: "westeurope",
    getir: async () => ({ durum, basliklar: { "retry-after": "3" }, govde: Buffer.from("x") }) });
  await assert.rejects(yap(401).sentez("a"), e => e.kalici === true && e.kod === "anahtar_gecersiz");
  await assert.rejects(yap(400).sentez("a"), e => e.kalici === true);
  await assert.rejects(yap(429).sentez("a"), e => !e.kalici && e.beklemeMs === 3000);
  await assert.rejects(yap(503).sentez("a"), e => !e.kalici && /503/.test(e.message));
});

test("Azure: gecersiz bolge/ses/anahtar yapilandirma hatasi (kalici)", () => {
  const kal = ek => azure.olustur(Object.assign({ ses: "tr-TR-AhmetNeural", hiz: "+0%", anahtar: "k", bolge: "westeurope", getir: async () => ({}) }, ek));
  assert.throws(() => kal({ bolge: "evil.com/x?" }), /AZURE_SPEECH_REGION/);
  assert.throws(() => kal({ bolge: "" }), /AZURE_SPEECH_REGION/);
  assert.throws(() => kal({ anahtar: "" }), /AZURE_SPEECH_KEY/);
  assert.throws(() => kal({ ses: 'x"><evil' }), /Geçersiz ses/);
});

testF("Azure ile denemeli sentez: 429 sonrasi basari (kelime zamani yok, sure makullugu denetlenir)", async () => {
  let n = 0;
  const getir = async () => (++n === 1 ? { durum: 429, basliklar: {}, govde: Buffer.from("") } : { durum: 200, basliklar: {}, govde: S.sentetikMp3(3) });
  const m = azure.olustur({ ses: "en-US-ChristopherNeural", hiz: "+0%", anahtar: "k", bolge: "westeurope", getir });
  const beklemeler = [];
  const r = await M.denemeliSentez(m, "This is a short test sentence here.", { araDizin: ara, dil: "en", hiz: "+0%",
    ayar: S.hizliAyar({ bekle: async ms => beklemeler.push(ms) }) });
  assert.equal(r.denemeler, 2);
  assert.equal(r.kelimeler.length, 0);
  assert.deepEqual(beklemeler, [2000]);
});

// ---------------------------------------------------------------------------
// Piper
// ---------------------------------------------------------------------------
testF("Piper: length_scale hiza gore, metin stdin'e, WAV -> mp3", async () => {
  assert.equal(piper.uzunlukOlcegi("+0%"), 1);
  assert.equal(piper.uzunlukOlcegi("+7%"), 0.935);
  assert.equal(piper.uzunlukOlcegi("-10%"), 1.111);
  assert.equal(piper.uzunlukOlcegi(undefined), 1);
  const { calistir, durum } = S.sahtePiperCalistir();
  const m = piper.olustur({ yol: "piper", model: "C:\\m\\tr_TR-dfki-medium.onnx", hiz: "+7%", calistir });
  assert.equal(m.ses, "tr_TR-dfki-medium");
  const r = await m.sentez("Merhaba dünya nasılsın bugün");
  assert.deepEqual(r.kelimeler, []);
  assert.ok(r.buf.length > 500);
  assert.equal(durum.girdiler[0], "Merhaba dünya nasılsın bugün\n");
  const sure = path.join(ara, "piper-test.mp3");
  fs.writeFileSync(sure, r.buf);
  assert.ok(M.sureOlc(sure) > 0.9);
});

test("Piper: hata kodu ve eksik ayar anlasilir mesajla", async () => {
  const { calistir } = S.sahtePiperCalistir(() => "hata");
  const m = piper.olustur({ yol: "piper", model: "m.onnx", hiz: "+0%", calistir });
  await assert.rejects(m.sentez("deneme"), /Piper hata verdi \(kod 3\).*model yuklenemedi/);
  assert.throws(() => piper.olustur({ yol: "", model: "m", calistir }), /PIPER_YOL/);
  assert.throws(() => piper.olustur({ yol: "x", model: "", calistir }), /PIPER_MODEL/);
  assert.throws(() => piper.olustur({ yol: "bu-yol-yok.exe", model: "yok.onnx" }), /bulunamadı/);
});

testF("ffprobe ile olculemeyen dosya anlasilir hata verir", () => {
  const bozuk = path.join(ara, "bozuk.mp3");
  fs.writeFileSync(bozuk, "bu mp3 degil");
  assert.throws(() => M.sureOlc(bozuk), /okunamadı|ölçülemedi/);
});

testF("mp3Birlestir: dosya adinda tek tirnak olsa da calisir", () => {
  const a = path.join(ara, "a'b.mp3"), b = path.join(ara, "c d.mp3");
  fs.writeFileSync(a, S.sentetikMp3(1)); fs.writeFileSync(b, S.sentetikMp3(1));
  const hedef = path.join(ara, "birles.mp3");
  M.mp3Birlestir([a, b], hedef, ara);
  assert.ok(Math.abs(M.sureOlc(hedef) - 2) < 0.3);
  assert.ok(!fs.existsSync(hedef + ".part"));
});

test("ortak.kelimeHizi dil tablosu (sozlesme: en 151, tr 113, digerleri 140)", () => {
  assert.equal(ortak.kelimeHizi("en"), 151);
  assert.equal(ortak.kelimeHizi("tr"), 113);
  assert.equal(ortak.kelimeHizi("de"), 140);
});

// ---------------------------------------------------------------------------
// hiz artirma (video-seslendir.js): negatif hizda gecersiz "+-3%" uretilmez
// ---------------------------------------------------------------------------
test("hizArtir: pozitif hizin ustune ekler, negatif hizda '+-' uretmez, hep gecerli bicim (+NN% / -NN%) ve -50..+50", () => {
  const gecerli = /^[+-]\d{1,2}%$/;
  assert.equal(M.hizArtir("+0%", 1.2), "+23%");
  assert.equal(M.hizArtir("+10%", 1.2), "+36%", "mevcut hizin USTUNE eklenir");
  assert.equal(M.hizArtir("-10%", 1.03), "-4%", "eskiden '+-4%' cikardi");
  assert.equal(M.hizArtir("-10%", 1.2), "+12%", "negatiften pozitife gecebilir");
  assert.equal(M.hizArtir("+0%", 3), "+50%", "ust sinir");
  assert.equal(M.hizArtir("-50%", 1.0), "-47%");
  for (const hiz of ["-50%", "-30%", "-10%", "+0%", "+7%", "+30%", "+50%"])
    for (const g of [1.001, 1.02, 1.05, 1.2, 1.7, 2.5, 10])
      assert.match(M.hizArtir(hiz, g), gecerli, hiz + " x " + g);
  assert.equal(M.hizArtir("+7%", NaN), "+7%", "gecersiz olcu: hiz aynen doner");
  assert.equal(M.hizYuzde("-10%"), -10);
  assert.equal(M.hizYuzde("+7%"), 7);
  assert.equal(M.hizYuzde("x"), 0);
});

// ---------------------------------------------------------------------------
// ffprobe YOKSA: "ses bozuk" diye yeniden denenmez, OrtakHata('ffmpeg_yok') aynen cikar
// ---------------------------------------------------------------------------
function ffprobeYokken() {
  const yol = require.resolve("../ff-yol.js");
  const gercek = require.cache[yol].exports;
  require.cache[yol].exports = {
    get ffmpeg() { return gercek.ffmpeg; },
    get ffprobe() { throw new ortak.OrtakHata("ffmpeg_yok", "ffprobe bulunamadı.", { cikis: 2 }); },
  };
  return () => { require.cache[yol].exports = gercek; };
}

testF("sureOlc: ffprobe yoksa ffmpeg_yok (cikis 2) firlatir, 'Ses dosyasi okunamadi'ya CEVIRMEZ", () => {
  const dosya = path.join(ara, "ffprobe-yok.mp3");
  fs.writeFileSync(dosya, S.sentetikMp3(1));
  const geri = ffprobeYokken();
  try {
    assert.throws(() => M.sureOlc(dosya), e => {
      assert.ok(e instanceof ortak.OrtakHata, "OrtakHata olmali: " + e.constructor.name);
      assert.equal(e.kod, "ffmpeg_yok");
      assert.equal(e.cikis, 2);
      return true;
    });
  } finally { geri(); }
});

testF("denemeliSentez: ffprobe yoksa TEK denemede durur (5 deneme + 37 sn bekleme yok)", async () => {
  const beklemeler = [];
  const { sahte, motor } = edgeMotor();
  const geri = ffprobeYokken();
  try {
    await assert.rejects(
      M.denemeliSentez(motor, METIN, { araDizin: ara, dil: "tr", hiz: "+7%", ayar: S.hizliAyar({ bekle: async ms => { beklemeler.push(ms); } }) }),
      e => e instanceof ortak.OrtakHata && e.kod === "ffmpeg_yok");
  } finally { geri(); }
  assert.equal(sahte.durum.istekler.length, 1, "yeniden denenmemeli");
  assert.deepEqual(beklemeler, []);
});

// ---------------------------------------------------------------------------
// Edge iptali: soket kesilir (gec kare cokertmesin). Sahte motorda ozel alan yoksa sessizce atlanir.
// ---------------------------------------------------------------------------
test("Edge zaman asimi iptali: istegin soketi terminate() ile kesilir, akislar yok edilir", async () => {
  const kesilen = [];
  const soket = ad => ({ terminate() { kesilen.push(ad); }, close() { kesilen.push(ad + "-close"); } });
  const { Readable } = require("stream");
  let akis;
  class SahteEdge {
    constructor() { this._ws = soket("ws"); this._retiredSockets = [soket("eski")]; this._streams = { ISTEK1: { socket: soket("istek") } }; }
    async setMetadata() {}
    close() {}
    toStream() {
      akis = new Readable({ read() {} });
      return { audioStream: akis, metadataStream: new Readable({ read() {} }), requestId: "ISTEK1" };
    }
  }
  const motor = edge.olustur({ ses: "tr-TR-AhmetNeural", hiz: "+0%", msedge: { MsEdgeTTS: SahteEdge, OUTPUT_FORMAT: { AUDIO_24KHZ_96KBITRATE_MONO_MP3: "x" } } });
  const ac = new AbortController();
  const p = motor.sentez("merhaba", { sinyal: ac.signal });
  setTimeout(() => ac.abort(new Error("zaman aşımı (test)")), 20);
  await assert.rejects(p, /zaman aşımı/);
  assert.deepEqual(kesilen.sort(), ["eski", "istek", "ws"], "istek soketi, aktif soket ve eski soketler terminate edilmeli");
  assert.equal(akis.destroyed, true);
});

test("Edge: sinyal zaten iptalse istek hic yollanmaz", async () => {
  const sahte = S.sahteEdge();
  const motor = edge.olustur({ ses: "tr-TR-AhmetNeural", hiz: "+0%", msedge: sahte });
  const ac = new AbortController();
  ac.abort(new Error("onceden iptal"));
  await assert.rejects(motor.sentez("merhaba", { sinyal: ac.signal }), /onceden iptal/);
  assert.equal(sahte.durum.istekler.length, 0);
});
