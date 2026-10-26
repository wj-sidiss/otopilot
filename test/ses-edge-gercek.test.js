// test/ses-edge-gercek.test.js — GERCEK Edge istemcisi (lib/ses-motor-edge.js) + yerel sahte WebSocket sunucusu.
// Microsoft'a ag cagrisi YOK: uclar 127.0.0.1'e cevrilir. Sunucu sifir bagimli (http 'upgrade' + elle cerceve).
// Iki WebSocket turu da sinanir: 'ws' paketi (kuruluysa) ve Node'un yerlesik WebSocket'i (Node 22+).
// Sinananlar: el sikisma basliklari (dordu birden), Sec-MS-GEC v2, kelime zamanlari, uc yedegi (HTTP 200 / 1006 / takilma),
// saat kaymasi duzeltmesi (403 + Date), 1007 -> tekrarsiz, iptal, gec kare (ayri surecte: cokme olmamali), ve seslendirme
// hattiyla uctan uca (kelimeler.json dolu).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const edge = require("../lib/ses-motor-edge.js");

// ---------------------------------------------------------------------------
// Sifir bagimli sahte WebSocket sunucusu
// ---------------------------------------------------------------------------
function cerceve(opk, veri) {                 // sunucu -> istemci (maskesiz)
  const b = Buffer.isBuffer(veri) ? veri : Buffer.from(String(veri), "utf8");
  let bas;
  if (b.length < 126) bas = Buffer.from([0x80 | opk, b.length]);
  else if (b.length < 65536) { bas = Buffer.alloc(4); bas[0] = 0x80 | opk; bas[1] = 126; bas.writeUInt16BE(b.length, 2); }
  else { bas = Buffer.alloc(10); bas[0] = 0x80 | opk; bas[1] = 127; bas.writeBigUInt64BE(BigInt(b.length), 2); }
  return Buffer.concat([bas, b]);
}

function cerceveleriCoz(t) {                  // istemci -> sunucu (maskeli)
  const kareler = [];
  for (;;) {
    if (t.length < 2) break;
    const opk = t[0] & 0x0f, maskeli = (t[1] & 0x80) !== 0;
    let uz = t[1] & 0x7f, o = 2;
    if (uz === 126) { if (t.length < 4) break; uz = t.readUInt16BE(2); o = 4; }
    else if (uz === 127) { if (t.length < 10) break; uz = Number(t.readBigUInt64BE(2)); o = 10; }
    const maske = maskeli ? t.subarray(o, o + 4) : null;
    if (maskeli) o += 4;
    if (t.length < o + uz) break;
    const veri = Buffer.from(t.subarray(o, o + uz));
    if (maske) for (let i = 0; i < veri.length; i++) veri[i] ^= maske[i % 4];
    kareler.push({ opk, veri });
    t = t.subarray(o + uz);
  }
  return { kareler, kalan: t };
}

const metinCerceve = (yol, govde) => cerceve(1, "X-RequestId:abc\r\nContent-Type:application/json; charset=utf-8\r\nPath:" + yol + "\r\n\r\n" + (govde || "{}"));
function sesCerceve(veri, son) {
  const bas = Buffer.from("X-RequestId:abc\r\n" + (son ? "" : "Content-Type:audio/mpeg\r\n") + "X-StreamId:1\r\nPath:audio\r\n");
  const u = Buffer.alloc(2); u.writeUInt16BE(bas.length, 0);
  return cerceve(2, Buffer.concat([u, bas, veri || Buffer.alloc(0)]));
}
// SSML'deki okunacak metnin kelimeleri (sunucu WordBoundary uretir)
function ssmlKelimeleri(ssml) {
  const m = /<prosody[^>]*>([\s\S]*)<\/prosody>/.exec(ssml);
  return (m ? m[1] : "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").split(/\s+/).filter(Boolean);
}

// senaryo(baglanti, sira) -> "tam" | "bos200" | "red403" | "kapat1007" | "kopar" | "sus" | "sessiz" | {tur:"tam", gecikme}
function sahteSunucu(senaryo, secenek) {
  const o = secenek || {};
  const kayit = { baglantilar: [], head: 0, saatFarkiMs: o.saatFarkiMs || 0, soketler: new Set() };
  const tarih = () => new Date(Date.now() + kayit.saatFarkiMs).toUTCString();
  const sunucu = http.createServer((req, res) => { kayit.head++; res.writeHead(404, { Date: tarih() }); res.end(); });
  sunucu.on("upgrade", (req, soket) => {
    kayit.soketler.add(soket);
    soket.on("close", () => kayit.soketler.delete(soket));
    soket.on("error", () => { /* istemci kesti */ });
    const b = { url: req.url, yol: req.url.split("?")[0], basliklar: req.headers, mesajlar: [], kapandi: false };
    kayit.baglantilar.push(b);
    let s = senaryo(b, kayit.baglantilar.length);
    if (typeof s === "string") s = { tur: s };
    if (s.tur === "bos200") { soket.end("HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); return; }
    if (s.tur === "red403") { soket.end("HTTP/1.1 403 Forbidden\r\nDate: " + tarih() + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); return; }
    const kabul = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    soket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + kabul + "\r\n\r\n");
    const yolla = x => { try { if (!soket.destroyed) soket.write(x); } catch (e) { /* istemci gitti */ } };
    let tampon = Buffer.alloc(0);
    soket.on("data", d => {
      const r = cerceveleriCoz(Buffer.concat([tampon, d]));
      tampon = r.kalan;
      for (const k of r.kareler) {
        if (k.opk === 8) { b.kapandi = true; yolla(cerceve(8, Buffer.from([0x03, 0xe8]))); soket.end(); return; }
        if (k.opk !== 1) continue;
        const m = k.veri.toString("utf8");
        b.mesajlar.push(m);
        if (!/Path:ssml/.test(m)) continue;
        const yanit = () => {
          if (s.tur === "kapat1007") { yolla(cerceve(8, Buffer.concat([Buffer.from([0x03, 0xef]), Buffer.from("bad")]))); soket.end(); return; }
          yolla(metinCerceve("turn.start"));
          if (s.tur === "kopar") { soket.destroy(); return; }
          if (s.tur === "sus") return;                              // hicbir sey gelmez: istemci bekcisi devreye girer
          yolla(metinCerceve("response"));
          if (s.tur !== "sessiz") {
            const kel = ssmlKelimeleri(m);
            yolla(metinCerceve("audio.metadata", JSON.stringify({ Metadata: kel.map((w, i) => ({ Type: "WordBoundary",
              Data: { Offset: (1000000 + i * 3000000), Duration: 2500000, text: { Text: w, Length: w.length, BoundaryType: "WordBoundary" } } })) })));
            const mp3 = o.mp3 || Buffer.from("SAHTE-MP3-" + kel.length);
            for (let i = 0; i < mp3.length; i += 4096) yolla(sesCerceve(mp3.subarray(i, i + 4096)));
            yolla(sesCerceve(null, true));                          // akis sonu: icerik turu yok, bos
          }
          yolla(metinCerceve("turn.end"));
        };
        if (s.gecikme) setTimeout(yanit, s.gecikme); else yanit();
      }
    });
  });
  return new Promise(coz => sunucu.listen(0, "127.0.0.1", () => {
    const port = sunucu.address().port;
    coz({
      kayit, port,
      uclar: [
        { ad: "birinci", url: "ws://127.0.0.1:" + port + "/a", anahtar: "Ocp-Apim-Subscription-Key" },
        { ad: "ikinci", url: "ws://127.0.0.1:" + port + "/b", anahtar: "TrustedClientToken" },
      ],
      kapat: () => new Promise(r => { for (const s of kayit.soketler) s.destroy(); sunucu.close(() => r()); }),
    });
  }));
}

// ---------------------------------------------------------------------------
// Gec kare senaryosu (AYRI SURECTE): iptal edilen istege sunucu sonradan kare yollar; surec cokmemeli,
// ayni motor sonra normal calismali.   node ses-edge-gercek.test.js --cocuk <ws|yerlesik> <gecikme> <zamanAsimi>
// ---------------------------------------------------------------------------
async function cocuk(tur, gecikme, zamanAsimi) {
  const WS = tur === "ws" ? require("ws") : globalThis.WebSocket;
  const s = await sahteSunucu((b, no) => (no === 1 ? { tur: "tam", gecikme } : "tam"));
  const motor = edge.olustur({ ses: "tr-TR-AhmetNeural", hiz: "+0%", WebSocket: WS, uclar: s.uclar });
  const ac = new AbortController();
  const zaman = setTimeout(() => ac.abort(new Error("zaman aşımı (test)")), zamanAsimi);
  let hata = null;
  try { await motor.sentez("Merhaba dünya", { sinyal: ac.signal }); } catch (e) { hata = e; }
  clearTimeout(zaman);
  assert.ok(hata, "zaman asiminda sentez reddedilmeli");
  assert.match(String(hata.message), /zaman aşımı/);
  await new Promise(r => setTimeout(r, gecikme + 500));          // sunucunun gec kareleri icin yeterli sure
  await motor.sifirla();
  const r = await motor.sentez("Merhaba", {});
  assert.equal(r.kelimeler.length, 1);
  assert.equal(r.kelimeler[0].w, "Merhaba");
  assert.ok(r.buf.length > 0);
  motor.kapat();
  await s.kapat();
  console.log("TAMAM");
}

if (process.argv[2] === "--cocuk") {
  cocuk(process.argv[3], Number(process.argv[4] || 800), Number(process.argv[5] || 200))
    .then(() => process.exit(0), e => { console.error("BASARISIZ: " + ((e && e.stack) || e)); process.exit(1); });
} else {
  testler();
}

function testler() {
  let wsPaketi = null;
  try { wsPaketi = require("ws"); } catch (e) { /* kurulu degil: o tur atlanir */ }
  const TURLER = [["ws", wsPaketi], ["yerlesik", typeof globalThis.WebSocket === "function" ? globalThis.WebSocket : null]];
  const yap = (WS, s, ek) => edge.olustur(Object.assign({ ses: "tr-TR-AhmetNeural", hiz: "+7%", WebSocket: WS, uclar: s.uclar, sessizlikMs: 400 }, ek || {}));
  test.beforeEach(() => edge._sifirla());

  test("Sec-MS-GEC v2: Edge kablo yakalamasi ve msedge-tts 2.1.1 vektorleri birebir", () => {
    assert.equal(edge.secMsGec(1791888000), "492D7694A183A45E-56E821F95D4579C5B7C7E33DC7303FF379EC36D510213555BBBB9EB17EF15876");
    assert.equal(edge.secMsGec(Date.parse("2026-10-13T10:00:30Z") / 1000),
      "461B5A82FDC12AF5-A89B0EBF2C158E7B404FF47B1F12D5579CB3C7D7B18EC8ADE4A4AD0A8036C8DE");
    assert.equal(edge.ticksMetni(1791888000), edge.ticksMetni(1791888299), "ayni 5 dk penceresi");
    assert.notEqual(edge.ticksMetni(1791888000), edge.ticksMetni(1791888300));
  });

  test("sabitler: uretim uclari msedgeservices -> bing; el sikisma basliklari DORDU birden", () => {
    assert.deepEqual(edge.UCLAR.map(u => u.ad), ["msedgeservices", "bing"]);
    assert.match(edge.UCLAR[0].url, /^wss:\/\/api\.msedgeservices\.com\//);
    assert.match(edge.UCLAR[1].url, /^wss:\/\/speech\.platform\.bing\.com\//);
    for (const b of ["User-Agent", "Origin", "Accept-Encoding", "Accept-Language"]) assert.ok(edge.BASLIKLAR[b], b);
    assert.match(edge.BASLIKLAR["User-Agent"], /Edg\/\d+/);
    assert.equal(edge.hazirMi().ok, true, "Node 22+ ya da ws: hazir");
  });

  test("gecersiz ses adi kalici hata (baglanti acilmaz)", () => {
    assert.throws(() => edge.olustur({ ses: "kotu ses!", hiz: "+0%" }), e => e.kalici === true && /Geçersiz ses adı/.test(e.message));
  });

  for (const [tur, WS] of TURLER) {
    const t = (ad, fn) => (WS ? test(tur + ": " + ad, fn) : test(tur + ": " + ad, { skip: tur + " yok" }, fn));

    t("el sikisma: dort tarayici basligi + v2 belirtec + ConnectionId; SSML ve kelime zamanlari", async () => {
      const s = await sahteSunucu(() => "tam");
      try {
        const motor = yap(WS, s);
        const r = await motor.sentez("Merhaba dünya & <dostlar>", {});
        const b = s.kayit.baglantilar[0];
        assert.equal(b.basliklar["user-agent"], edge.BASLIKLAR["User-Agent"]);
        assert.equal(b.basliklar.origin, edge.BASLIKLAR.Origin);
        assert.equal(b.basliklar["accept-language"], edge.BASLIKLAR["Accept-Language"]);
        assert.equal(b.basliklar["accept-encoding"], edge.BASLIKLAR["Accept-Encoding"]);
        assert.match(b.url, /Ocp-Apim-Subscription-Key=6A5AA1D4EAFF4E9FB37E23D68491D6F4/);
        assert.match(b.url, /ConnectionId=[0-9a-f]{32}&/);
        assert.match(b.url, /Sec-MS-GEC=[0-9A-F]{16}-[0-9A-F]{64}&Sec-MS-GEC-Version=2-\d/);
        // once speech.config (kelime zamani acik, 96k mp3), sonra SSML (ses, hiz, dil, XML kacisi)
        assert.match(b.mesajlar[0], /Path:speech\.config/);
        assert.match(b.mesajlar[0], /"wordBoundaryEnabled":"true"/);
        assert.match(b.mesajlar[0], /audio-24khz-96kbitrate-mono-mp3/);
        assert.match(b.mesajlar[1], /xml:lang='tr-TR'><voice name='tr-TR-AhmetNeural'><prosody pitch='\+0Hz' rate='\+7%'/);
        assert.match(b.mesajlar[1], /Merhaba dünya &amp; &lt;dostlar&gt;<\/prosody>/);
        assert.equal(r.buf.toString(), "SAHTE-MP3-4");
        assert.deepEqual(r.kelimeler.map(k => k.w), ["Merhaba", "dünya", "&", "<dostlar>"]);
        assert.deepEqual(r.kelimeler[1], { t: 400, d: 250, w: "dünya" }, "100 ns -> ms");
        assert.equal(motor.kelimeZamani, true);
      } finally { await s.kapat(); }
    });

    t("ilk uc bos HTTP 200 verirse (msedge-tts 2.1.0 arizasi) ayni cagrida ikinci uca gecer; calisan uc hatirlanir", async () => {
      const s = await sahteSunucu(b => (b.yol === "/a" ? "bos200" : "tam"));
      const loglar = [];
      try {
        const motor = yap(WS, s, { log: m => loglar.push(m) });
        const r = await motor.sentez("Bir iki üç", {});
        assert.equal(r.kelimeler.length, 3);
        assert.deepEqual(s.kayit.baglantilar.map(b => b.yol), ["/a", "/b"]);
        assert.match(s.kayit.baglantilar[1].url, /TrustedClientToken=/);
        assert.ok(loglar.some(m => /'ikinci' ucu kullanılıyor/.test(m)), loglar.join(" | "));
        await motor.sentez("Dört beş", {});
        assert.deepEqual(s.kayit.baglantilar.map(b => b.yol), ["/a", "/b", "/b"], "ikinci istekte dogrudan calisan uc");
        assert.equal(edge._durum().tercihUc, "ikinci");
      } finally { await s.kapat(); }
    });

    t("turn.end gelmeden kopma (1006) ve takilma (sessizlik bekcisi) baska uca gecirir", async () => {
      for (const kotu of ["kopar", "sus"]) {
        edge._sifirla();
        const s = await sahteSunucu(b => (b.yol === "/a" ? kotu : "tam"));
        try {
          const t0 = Date.now();
          const r = await yap(WS, s).sentez("Merhaba dünya", {});
          assert.equal(r.kelimeler.length, 2, kotu);
          assert.deepEqual(s.kayit.baglantilar.map(b => b.yol), ["/a", "/b"], kotu);
          assert.ok(Date.now() - t0 < 5000, kotu + ": bekci 400 ms");
        } finally { await s.kapat(); }
      }
    });

    t("iki uc da duserse hata; iki uc da 1007 (gecersiz veri) verirse tekrarsiz (bosuna yeniden denenmez)", async () => {
      let s = await sahteSunucu(() => "kopar");
      try {
        await assert.rejects(yap(WS, s).sentez("Merhaba", {}), e => /Edge sesi alınamadı/.test(e.message) && !e.tekrarsiz && !e.kalici);
      } finally { await s.kapat(); }
      s = await sahteSunucu(() => "kapat1007");
      try {
        await assert.rejects(yap(WS, s).sentez("Merhaba", {}), e => {
          assert.equal(e.tekrarsiz, true);
          assert.match(e.cozum, /Ses adını kontrol et/);
          return true;
        });
      } finally { await s.kapat(); }
    });

    t("turn.end geldi ama ses yok: hata (bos ses kabul edilmez)", async () => {
      const s = await sahteSunucu(() => "sessiz");
      try { await assert.rejects(yap(WS, s).sentez("Merhaba", {}), /ses gelmedi/); }
      finally { await s.kapat(); }
    });

    t("saat kaymasi: 403 + sunucu tarihi -> belirtec sunucu saatine gore yeniden uretilir, bir kez tekrar", async () => {
      const IKI_SAAT = 2 * 3600 * 1000;
      const s = await sahteSunucu((b, no) => (no === 1 ? "red403" : "tam"), { saatFarkiMs: IKI_SAAT });
      const loglar = [];
      try {
        const r = await yap(WS, s, { log: m => loglar.push(m) }).sentez("Merhaba", {});
        assert.equal(r.kelimeler.length, 1);
        assert.deepEqual(s.kayit.baglantilar.map(b => b.yol), ["/a", "/a"], "ayni uc yeniden denenir");
        assert.ok(Math.abs(edge._durum().saatKaymasiMs - IKI_SAAT) < 5000, "kayma: " + edge._durum().saatKaymasiMs);
        const belirtec = u => /Sec-MS-GEC=([^&]+)/.exec(u)[1];
        assert.notEqual(belirtec(s.kayit.baglantilar[0].url), belirtec(s.kayit.baglantilar[1].url));
        assert.ok(loglar.some(m => /saati .* kaymış/.test(m)), loglar.join(" | "));
        // yerlesik WebSocket durum kodu/Date vermez: tarih ayni sunucuya HEAD ile sorulur ('ws' el sikisma yanitindan okur)
        assert.equal(s.kayit.head, tur === "ws" ? 0 : 1);
      } finally { await s.kapat(); }
    });

    t("iptal: sinyal gelince soket kesilir ve hemen reddedilir; onceden iptalse baglanti hic acilmaz", async () => {
      const s = await sahteSunucu(() => ({ tur: "tam", gecikme: 1500 }));
      try {
        const motor = yap(WS, s, { sessizlikMs: 10000 });
        const ac = new AbortController();
        const t0 = Date.now();
        setTimeout(() => ac.abort(new Error("zaman aşımı (test)")), 150);
        await assert.rejects(motor.sentez("Merhaba", { sinyal: ac.signal }), /zaman aşımı \(test\)/);
        assert.ok(Date.now() - t0 < 1500);
        assert.equal(s.kayit.baglantilar.length, 1, "iptalden sonra baska uc denenmez");
        const ac2 = new AbortController();
        ac2.abort(new Error("onceden iptal"));
        await assert.rejects(motor.sentez("Merhaba", { sinyal: ac2.signal }), /onceden iptal/);
        assert.equal(s.kayit.baglantilar.length, 1);
      } finally { await s.kapat(); }
    });

    t("kapat(): suren istek reddedilir ve baska uca GECILMEZ (kapatma ariza degildir)", async () => {
      const s = await sahteSunucu(() => ({ tur: "tam", gecikme: 1500 }));
      try {
        const motor = yap(WS, s, { sessizlikMs: 10000 });
        const p = motor.sentez("Merhaba", {});
        setTimeout(() => motor.kapat(), 150);
        await assert.rejects(p, /kapatıldı/);
        assert.equal(s.kayit.baglantilar.length, 1);
      } finally { await s.kapat(); }
    });

    t("gec kare (ayri surec): iptal edilen istege sonradan gelen kareler sureci cokertmez, motor sonra calisir", () => {
      for (const [gecikme, zamanAsimi] of [[800, 150], [300, 1]]) {
        const r = spawnSync(process.execPath, [__filename, "--cocuk", tur, String(gecikme), String(zamanAsimi)],
          { encoding: "utf8", timeout: 60000 });
        assert.equal(r.status, 0, "cokme: " + r.stderr);
        assert.match(r.stdout, /TAMAM/);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Seslendirme hattiyla: motor katmani (deneme/sure olcumu) ve ses-uret (kelimeler.json -> altyazi)
  // ---------------------------------------------------------------------------
  const S = require("./ses-sahte.js");
  const testF = S.ffmpegTesti(test);
  const WS = wsPaketi || globalThis.WebSocket;

  testF("motor katmani: motorOlustur('edge') gercek istemciyle; mp3 suresi olculur, kelime zamanlari korunur", async () => {
    const M = require("../lib/ses-motor.js");
    const s = await sahteSunucu(() => "tam", { mp3: S.sentetikMp3(2) });
    const ara = fs.mkdtempSync(path.join(os.tmpdir(), "edge-gercek-"));
    try {
      assert.equal(M.motorHazirMi("edge", () => "", { edgeWs: WS }).ok, true);
      const motor = M.motorOlustur("edge", { ses: "en-US-ChristopherNeural", hiz: "+0%", dil: "en", enjekte: { edgeWs: WS, edgeUclar: s.uclar } });
      const r = await M.denemeliSentez(motor, "One two three four five six.", { araDizin: ara, dil: "en", hiz: "+0%", ayar: S.hizliAyar() });
      assert.equal(r.denemeler, 1);
      assert.equal(r.kelimeler.length, 6);
      assert.ok(Math.abs(r.sureSn - 2) < 0.3, "sure: " + r.sureSn);
      motor.kapat();
    } finally { await s.kapat(); fs.rmSync(ara, { recursive: true, force: true }); }
  });

  testF("seslendirme ucdan uca: kelimeler.json gercek istemcinin kelime zamanlarini tasir (altyazi buna bagli)", async () => {
    const U = require("../lib/ses-uret.js");
    const ortam = S.ortamiYalitla();
    const uretim = S.testUretimi();
    const s = await sahteSunucu(() => "tam", { mp3: S.sentetikMp3(2.5) });
    try {
      const dizin = S.isOlustur(uretim.taban, "edge-gercek", ["Bu birinci paragraf beş kelime.", "İkinci paragraf da kısa."]);
      const r = await U.seslendir({ dizin, ses: "tr-TR-AhmetNeural", hiz: "+7%", dil: "tr", motorSecimi: "edge", okunus: {},
        env: () => "", enjekte: { edgeWs: WS, edgeUclar: s.uclar }, ayar: S.hizliAyar(), log: () => {}, uyari: () => {}, ilerleme: () => {} });
      assert.equal(r.motor, "edge");
      assert.equal(r.ses, "tr-TR-AhmetNeural");
      const k = JSON.parse(fs.readFileSync(path.join(dizin, "Voice", "kelimeler.json"), "utf8"));
      assert.deepEqual(k.paragraflar.map(p => p.kelimeler.length), [5, 4]);
      assert.equal(k.paragraflar[0].kelimeler[0].w, "Bu");
    } finally { await s.kapat(); uretim.temizle(); ortam.temizle(); }
  });
}
