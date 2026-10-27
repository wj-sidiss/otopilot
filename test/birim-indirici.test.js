// BIRIM TESTLERI — video indirici: yol / dosya adi / klasor / link dogrulama, Host-Origin-jeton-Content-Type kapisi.
// Sahte yt-dlp (video-indirici/test/_ortam.js) ve gecici klasorler: gercek siteye BAGLANILMAZ, gercek indirilenler/ ve
// ayarlar.json'a dokunulmaz. HTTP sunucusu 127.0.0.1'de 4301-4399 portunda. Bulgu karsiliklari: B064, B065, B062, B061.
"use strict";
const ortam = require("../video-indirici/test/_ortam");       // server.js'ten ONCE: ortam degiskenlerini yonlendirir
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const B = require("./birim-yardim");
const m = require("../video-indirici/server.js");

let port = 0;
const acilanlar = [];                                         // ic.ac cagrilari: explorer/xdg-open ASLA acilmaz

test.before(async () => {
  m.ic.ac = (hedef, sec) => acilanlar.push([hedef, sec]);
  const ilk = await B.sunucuAc((q, r) => r.end(), { kayma: 17 });     // 4301-4399'da bos port bul
  port = ilk.port;
  await ilk.kapat();
  const s = await m.baslat({ port });
  assert.equal(s.address().port, port);
});
test.after(async () => { await m.kapat(); ortam.temizle(); });

// ---------------------------------------------------------------- dosya adi kapisi
test("guvenliDosya: yol parcasi, kacis, uzanti beyaz listesi disi, cihaz/akis adlari, sembolik baglanti — hepsi null", (t) => {
  fs.writeFileSync(path.join(ortam.klasor, "iyi video.mp4"), "x");
  fs.writeFileSync(path.join(ortam.klasor, "ses.mp3"), "x");
  fs.writeFileSync(path.join(ortam.klasor, "calistir.exe"), "x");
  fs.writeFileSync(path.join(ortam.klasor, "not.txt"), "x");
  fs.writeFileSync(path.join(ortam.gecici, "disarida.mp4"), "x");
  assert.equal(m.guvenliDosya("iyi video.mp4"), path.join(path.resolve(ortam.klasor), "iyi video.mp4"));
  assert.ok(m.guvenliDosya("ses.mp3"));
  const kotu = ["calistir.exe", "not.txt", "iyi video.mp4.exe", "iyi video.mp4:gizli.exe", "calistir.exe:akis.mp4", "iyi video.mp4 ", "iyi video.mp4.",
    "..", ".", "", "../disarida.mp4", "..\\disarida.mp4", path.join(ortam.gecici, "disarida.mp4"), "alt/iyi video.mp4", "alt\\iyi video.mp4", "./iyi video.mp4",
    "CON.mp4", "nul.mp4", "aux.mkv", "x".repeat(401) + ".mp4", "a\0.mp4", "yok.mp4", "%2e%2e%2fdisarida.mp4", "..%5cdisarida.mp4",
    null, undefined, 7, {}, [], ["iyi video.mp4"], true];
  for (const k of kotu) assert.equal(m.guvenliDosya(k), null, String(JSON.stringify(k)).slice(0, 60));
  const baglanti = path.join(ortam.klasor, "baglanti.mp4");
  try { fs.symlinkSync(path.join(ortam.gecici, "disarida.mp4"), baglanti, "file"); assert.equal(m.guvenliDosya("baglanti.mp4"), null, "sembolik baglanti reddedilmeli"); }
  catch (e) { if (!["EPERM", "EACCES"].includes(e.code)) throw e; t.diagnostic("symlink izni yok"); }
});

test("klasorDogrula: indirme klasoru yalniz izinli koklerin altinda; '..', UNC, cihaz yolu, goreli, kardes klasor, ev dizini REDDEDILIR", () => {
  assert.equal(m.klasorDogrula(path.join(ortam.klasor, "alt", "daha-alt")).ok, true);
  assert.equal(m.klasorDogrula(ortam.klasor).ok, true);
  assert.equal(m.klasorDogrula(path.join(os.homedir(), "Videos", "bizim")).ok, true);
  assert.equal(m.klasorDogrula(path.join(os.homedir(), "Downloads", "x")).ok, true);
  const kotu = [path.join(ortam.klasor, "..", "kardes"), path.join(ortam.klasor, ".."), ortam.klasor + "X", path.resolve(__dirname, ".."), path.resolve(__dirname, "..", ".."), os.homedir(),
    path.join(os.homedir(), "Documents"), path.join(os.homedir(), "Desktop"), path.parse(os.homedir()).root,
    "C:\\Windows", "C:\\Windows\\System32", "/etc", "/", "\\\\sunucu\\paylasim\\x", "\\\\?\\C:\\Windows", "\\\\.\\PhysicalDrive0", "//sunucu/x",
    "goreli/yol", ".", "..", "", "   ", "\0", "a".repeat(301), 5, null, undefined, {}, [], true];
  for (const k of kotu) assert.equal(m.klasorDogrula(k).ok, false, String(JSON.stringify(k)).slice(0, 60));
  const r = m.klasorDogrula(process.platform === "win32" ? "C:\\Windows" : "/etc");   // diger platformda C:\ goreli yoldur
  assert.match(r.neden, /izinli|yalnızca|Güvenlik/i);
});

test("linkGecerli: yalniz http(s); yerel ag, bulut metadata, IPv6 eslemeli, ondalik/onaltilik/kisaltmali IPv4, kimlik bilgisi, kontrol karakteri REDDEDILIR", () => {
  const iyi = ["https://www.youtube.com/watch?v=abc", "http://example.com/x", "https://vimeo.com/123", "https://www.tiktok.com/@a/video/1", "https://8.8.8.8/x", "https://[2606:4700::1111]/x"];
  for (const l of iyi) assert.equal(m.linkGecerli(l), true, l);
  const kotu = ["", "javascript:alert(1)", "file:///C:/Windows/win.ini", "ftp://example.com/x", "data:text/html,<b>x</b>", "//example.com/x", "example.com/x", "https://",
    "http://localhost/x", "http://localhost./x", "http://LOCALHOST:4173/", "http://127.0.0.1/", "http://127.1/", "http://0x7f.1/", "http://2130706433/", "http://0177.0.0.1/", "http://0/", "http://0.0.0.0/",
    "http://[::1]/", "http://[::]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/", "http://[::ffff:10.0.0.1]/", "http://[fe80::1]/", "http://[fd00::1]/", "http://[64:ff9b::7f00:1]/",
    "http://10.0.0.5/", "http://192.168.1.1/", "http://172.16.0.1/", "http://172.31.255.255/", "http://169.254.169.254/latest/meta-data/", "http://100.64.0.1/",
    "http://foo.local/", "http://nas.lan/", "http://x.internal/", "http://a.localhost/", "http://router.home.arpa/",
    "https://user:pass@example.com/x", "https://evil.com@127.0.0.1/", "http://example.com/a b", "http://example.com/a\nb", "http://example.com/\u0000", "http://example.com/" + "a".repeat(2100),
    null, undefined, 5, {}, ["http://example.com"]];
  for (const l of kotu) assert.equal(m.linkGecerli(l), false, String(JSON.stringify(l)).slice(0, 70));
  assert.equal(m.yerelAdresMi("172.15.0.1"), false, "172.16/12'nin disi");
  assert.equal(m.yerelAdresMi("172.32.0.1"), false);
  assert.equal(m.yerelAdresMi("100.63.0.1"), false);
  assert.equal(m.yerelAdresMi("8.8.8.8"), false);
});

test("hostGecerli / originGecerli: TAM port ve yalniz yerel adlar; yabanci/alt alan/portsuz reddedilir", () => {
  const p = 4350;
  for (const h of ["localhost:" + p, "127.0.0.1:" + p, "[::1]:" + p, "LOCALHOST:" + p]) assert.equal(m.hostGecerli(h, p), true, h);
  for (const h of ["localhost", "localhost:" + (p + 1), "evil.com:" + p, "localhost.evil.com:" + p, "127.0.0.1.nip.io:" + p, "localhost:" + p + ".evil.com", "", undefined, null, 5])
    assert.equal(m.hostGecerli(h, p), false, JSON.stringify(h));
  for (const o of ["http://localhost:" + p, "http://127.0.0.1:" + p, "http://[::1]:" + p]) assert.equal(m.originGecerli(o, p), true, o);
  for (const o of ["null", "", "http://evil.com", "https://localhost:" + p, "http://localhost", "http://localhost:" + p + "/", "http://localhost:" + p + ".evil.com", undefined, 5])
    assert.equal(m.originGecerli(o, p), false, JSON.stringify(o));
});

test("aralikCoz (Range): gecerli araliklar, siniri asan, ters, sifir bayt, anlasilmayan baslik", () => {
  assert.deepEqual(m.aralikCoz("bytes=0-99", 1000), { bas: 0, son: 99 });
  assert.deepEqual(m.aralikCoz("bytes=-100", 1000), { bas: 900, son: 999 });
  assert.deepEqual(m.aralikCoz("bytes=900-", 1000), { bas: 900, son: 999 });
  assert.deepEqual(m.aralikCoz("bytes=0-99999", 1000), { bas: 0, son: 999 });
  for (const kotu of ["bytes=1000-", "bytes=500-100", "bytes=-0", "bytes=2000-3000"]) assert.equal(m.aralikCoz(kotu, 1000), "x", kotu);
  assert.equal(m.aralikCoz("bytes=-5", 0), "x");
  for (const yok of [undefined, "", "bytes=-", "items=0-5", "bytes=a-b", "garbage"]) assert.equal(m.aralikCoz(yok, 1000), null, String(yok));
});

test("formatSecici / hataCevir: kalite -> yt-dlp bicimi; yt-dlp hatalari Turkce ozet + cozum, ham ayrinti detay'da", () => {
  for (const k of ["en-iyi", "2160", "1080", "720", "480", "mp3"]) assert.ok(String(m.formatSecici(k)).length > 0, k);
  assert.notEqual(m.formatSecici("mp3"), m.formatSecici("720"));
  const hata = m.hataCevir("ERROR: [youtube] abc: Sign in to confirm you’re not a bot");
  assert.match(hata.ozet, /giriş|doğrulama/i);
  assert.ok(hata.cozum.length > 0);
  assert.equal(m.hataCevir("ERROR: No space left on device").ozet, "Diskte yer kalmadı.");
  assert.match(m.hataCevir("ERROR: Unsupported URL: https://x").ozet, /desteklenmiyor/);
  assert.ok(m.hataCevir(new Error("garip bir sey")).detay.includes("garip"));
});

// ---------------------------------------------------------------- HTTP kapisi (gercek sunucu)
function istek(yontem, yol, o) {
  const s = o || {};
  return new Promise((coz, red) => {
    const h = Object.assign({}, s.baslik || {});
    if (s.jeton !== false) h["X-Panel-Token"] = typeof s.jeton === "string" ? s.jeton : m.jeton();
    const veri = s.govde === undefined ? null : (typeof s.govde === "string" ? s.govde : JSON.stringify(s.govde));
    if (yontem === "POST" && !("Content-Type" in h) && !s.turYok) h["Content-Type"] = "application/json";
    if (veri !== null) h["Content-Length"] = Buffer.byteLength(veri);
    const r = http.request({ host: "127.0.0.1", port, path: yol, method: yontem, headers: h }, res => {
      const p = []; res.on("data", c => p.push(c));
      res.on("end", () => { const b = Buffer.concat(p); let j = null; try { j = JSON.parse(b.toString("utf8")); } catch (e) { /* json degil */ } coz({ durum: res.statusCode, baslik: res.headers, buf: b, metin: b.toString("utf8"), json: j }); });
    });
    r.on("error", red);
    if (veri !== null) r.write(veri);
    r.end();
  });
}

test("HTTP: Host / jeton / Content-Type / Origin / Sec-Fetch-Site kapisi; yalniz 127.0.0.1'e baglanir; CORS izni yok", async () => {
  assert.equal(m.sunucu.address().address, "127.0.0.1");
  const ana = await istek("GET", "/", { jeton: false });
  assert.equal(ana.durum, 200);
  assert.ok(ana.metin.includes('content="' + m.jeton() + '"'));
  assert.match(ana.baslik["set-cookie"][0], /HttpOnly; SameSite=Strict; Path=\//);
  assert.match(ana.baslik["content-security-policy"], /script-src 'self'/);
  assert.doesNotMatch(ana.baslik["content-security-policy"], /script-src[^;]*unsafe-inline/);
  const kod = r => r.json && r.json.kod;
  assert.equal(kod(await istek("GET", "/api/durum", { baslik: { Host: "evil.example" } })), "host");
  assert.equal(kod(await istek("GET", "/api/durum", { jeton: false })), "token");
  assert.equal(kod(await istek("GET", "/api/durum", { jeton: "0".repeat(64) })), "token");
  assert.equal((await istek("GET", "/api/durum")).durum, 200);
  assert.equal(kod(await istek("POST", "/api/oynat", { baslik: { "Content-Type": "text/plain" }, govde: "{}" })), "icerik_turu");
  assert.equal(kod(await istek("POST", "/api/oynat", { turYok: true, govde: "{}" })), "icerik_turu");
  assert.equal(kod(await istek("POST", "/api/oynat", { baslik: { Origin: "http://evil.example" }, govde: {} })), "origin");
  assert.equal(kod(await istek("POST", "/api/oynat", { baslik: { "Sec-Fetch-Site": "cross-site" }, govde: {} })), "origin");
  assert.equal(kod(await istek("GET", "/api/durum", { baslik: { Origin: "http://evil.example" } })), "origin");
  for (const yontem of ["PUT", "DELETE", "PATCH", "OPTIONS", "TRACE"]) {
    const r = await istek(yontem, "/api/durum", {});
    assert.equal(r.durum, 405, yontem);
    for (const k of Object.keys(r.baslik)) assert.ok(!/^access-control-/i.test(k), "CORS basligi: " + k);
  }
  // cerez yalniz /dosya/ ve /api/akis icin; baska /api ucunda cerez jetonu YETMEZ
  const cerezli = await istek("GET", "/api/durum", { jeton: false, baslik: { Cookie: m.CEREZ_AD + "=" + m.jeton() } });
  assert.equal(kod(cerezli), "token");
});

test("HTTP: /api/ayar klasoru izinli kok disina cevrilemez (400), ayar degismez; /api/sil ve /api/oynat yalniz beyaz listeli dosyayi isler", async () => {
  const once = m.durum().ayar.klasor;
  for (const klasor of ["C:\\Windows", ortam.gecici, path.join(ortam.klasor, "..", "kardes"), "\\\\sunucu\\paylasim", "goreli", "..", os.homedir()]) {
    const r = await istek("POST", "/api/ayar", { govde: { klasor } });
    assert.equal(r.durum, 400, klasor + " -> " + r.durum + " " + r.metin);
    assert.equal(r.json.kod, "klasor");
  }
  assert.equal(m.durum().ayar.klasor, once);
  fs.writeFileSync(path.join(ortam.gecici, "koru.mp4"), "dokunma");
  fs.writeFileSync(path.join(ortam.klasor, "calistir.exe"), "dokunma");
  fs.writeFileSync(path.join(ortam.klasor, "silinecek.mp4"), "x");
  // nesne/liste degeri duz-deger denetiminde reddedilir (400), dosyaya dokunulmaz
  for (const uc of ["/api/sil", "/api/oynat"]) {
    for (const dosya of [["silinecek.mp4"], { toString: "x" }]) {
      const r = await istek("POST", uc, { govde: { dosya } });
      assert.equal(r.durum, 400, uc + " " + JSON.stringify(dosya) + " -> " + r.durum);
      assert.equal(r.json.kod, "govde_tipi");
    }
  }
  assert.ok(fs.existsSync(path.join(ortam.klasor, "silinecek.mp4")));
  for (const dosya of ["../koru.mp4", "..\\koru.mp4", path.join(ortam.gecici, "koru.mp4"), "calistir.exe", "yok.mp4", "", null, 5]) {
    const s = await istek("POST", "/api/sil", { govde: { dosya } });
    assert.equal(s.durum, 404, "sil " + JSON.stringify(dosya));
    const o = await istek("POST", "/api/oynat", { govde: { dosya } });
    assert.equal(o.durum, 404, "oynat " + JSON.stringify(dosya));
  }
  assert.equal(fs.readFileSync(path.join(ortam.gecici, "koru.mp4"), "utf8"), "dokunma");
  assert.equal(fs.readFileSync(path.join(ortam.klasor, "calistir.exe"), "utf8"), "dokunma");
  assert.deepEqual(acilanlar, [], "hicbir disaridaki dosya ya da program acilmamali");
  const sil = await istek("POST", "/api/sil", { govde: { dosya: "silinecek.mp4" } });
  assert.equal(sil.durum, 200);
  assert.equal(fs.existsSync(path.join(ortam.klasor, "silinecek.mp4")), false);
  const oynat = await istek("POST", "/api/oynat", { govde: { dosya: "iyi video.mp4" } });
  assert.equal(oynat.durum, 200);
  assert.deepEqual(acilanlar[acilanlar.length - 1], [path.join(path.resolve(ortam.klasor), "iyi video.mp4"), false]);
});

test("HTTP: /dosya/ yalniz klasordeki video/ses dosyasini sunar (Range 206/416); '..', kodlanmis kacis, .env ve proje dosyalari sunulmaz", async () => {
  const icerik = Buffer.alloc(5000, 7);
  fs.writeFileSync(path.join(ortam.klasor, "oyna.mp4"), icerik);
  fs.writeFileSync(ortam.dosyalar.env, "VIDIQ_KEY=GIZLI-DEGER");
  const tam = await istek("GET", "/dosya/oyna.mp4", { jeton: false, baslik: { Cookie: m.CEREZ_AD + "=" + m.jeton() } });
  assert.equal(tam.durum, 200);
  assert.equal(tam.buf.length, 5000);
  const aralik = await istek("GET", "/dosya/oyna.mp4", { jeton: false, baslik: { Cookie: m.CEREZ_AD + "=" + m.jeton(), Range: "bytes=100-199" } });
  assert.deepEqual([aralik.durum, aralik.buf.length, aralik.baslik["content-range"]], [206, 100, "bytes 100-199/5000"]);
  assert.equal((await istek("GET", "/dosya/oyna.mp4", { jeton: false, baslik: { Cookie: m.CEREZ_AD + "=" + m.jeton(), Range: "bytes=9999-" } })).durum, 416);
  assert.equal((await istek("GET", "/dosya/oyna.mp4", { jeton: false })).json.kod, "token", "cerezsiz/jetonsuz medya reddedilir");
  for (const yol of ["/dosya/..%2f..%2fserver.js", "/dosya/..%5c..%5cserver.js", "/dosya/%2e%2e%2fenv.txt", "/dosya/server.js", "/dosya/ayar.json", "/dosya/", "/dosya/%00", "/dosya/%E0%A4%A"]) {
    const r = await istek("GET", yol);
    assert.ok([400, 404].includes(r.durum), yol + " -> " + r.durum);
    assert.doesNotMatch(r.metin, /GIZLI-DEGER|require\(|createServer/);
  }
});

test("HTTP: /api/indir yerel/ozel adresli linkleri SUZER (yt-dlp'ye gitmez); gecerli link yoksa 400", async () => {
  const kotu = await istek("POST", "/api/indir", { govde: { url: "http://127.0.0.1:4173/x http://169.254.169.254/latest file:///C:/x javascript:alert(1) http://[::1]/y" } });
  assert.equal(kotu.durum, 400, kotu.metin);
  assert.equal(kotu.json.kod, "link");
  const kaliteKotu = await istek("POST", "/api/indir", { govde: { url: "https://example.com/v", kalite: "ultra" } });
  assert.equal(kaliteKotu.durum, 400);
  assert.equal(kaliteKotu.json.kod, "kalite");
  assert.ok(port >= 4301 && port <= 4399, "test portu 4301-4399 araliginda: " + port);
});
