// Lensfun lens profilleri: indirme (sahte ag), okuma, arama, filtre kacisi, gercek ffmpeg ile uygulama. Gercek veritabanina/aga dokunmaz.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const DB = fs.mkdtempSync(path.join(os.tmpdir(), "lensfun-"));
process.env.LENSFUN_DB = DB;
test.after(() => fs.rmSync(DB, { recursive: true, force: true }));
const L = require("../lib/lensfun.js");

const XML = `<lensdatabase version="1">
  <lens><maker>Test &amp; Co</maker><model>Test 35mm f/2</model><mount>TestMount</mount><cropfactor>1</cropfactor>
    <calibration><distortion model="ptlens" focal="35" a="0.01" b="-0.02" c="0.0"/></calibration></lens>
  <lens><maker>Telefon</maker><model>Phone back camera 4.25mm f/1.8</model><mount>PhoneMount</mount><cropfactor>6.1</cropfactor>
    <calibration><distortion model="ptlens" focal="4.25" a="0.0" b="0.01" c="-0.01"/></calibration></lens>
  <camera><maker>Test</maker><model>Cam One</model><mount>TestMount</mount><cropfactor>1</cropfactor></camera>
  <camera><maker>Telefon</maker><model>Phone X</model><mount>PhoneMount</mount><cropfactor>6.1</cropfactor></camera>
</lensdatabase>`;
fs.writeFileSync(path.join(DB, "test.xml"), XML);

test("oku/ara: kamera ve lens, XML kodlari cozulur, buyuk/kucuk harf ve Turkce I duyarsiz", () => {
  const v = L.oku(DB);
  assert.equal(v.kameralar.length, 2); assert.equal(v.lensler.length, 2);
  assert.equal(L.ara("cam one", "kamera")[0].model, "Cam One");
  assert.equal(L.ara("TEST CO", "lens")[0].maker, "Test & Co");
  assert.equal(L.ara("PHONE X", "kamera")[0].model, "Phone X");
  assert.equal(L.ara("yok boyle", "kamera").length, 0);
  assert.equal(L.ara("", "kamera").length, 0);
});

test("profilBul: bulunamazsa cozumlu hata", () => {
  const p = L.profilBul("cam one", "test 35mm");
  assert.equal(p.kamera.model, "Cam One"); assert.equal(p.lens.model, "Test 35mm f/2");
  assert.throws(() => L.profilBul("yok", "test"), /Kamera profili bulunamadı/);
  assert.throws(() => L.profilBul("cam one", "yok"), /Lens profili bulunamadı/);
});

test("filtre: kacis, reverse (ekle) / duzelt, sinir kontrolu", () => {
  const p = L.profilBul("cam one", "test 35mm");
  const f = L.filtre({ kamera: p.kamera, lens: p.lens, odak: 35, diyafram: 2, mesafe: 3 });
  assert.match(f, /reverse=1/); assert.match(f, /db_path='/); assert.match(f, /lens_model='Test 35mm f\/2'/);
  assert.doesNotMatch(L.filtre({ kamera: p.kamera, lens: p.lens, yon: "duzelt" }), /reverse/);
  assert.match(L.kac("o'neil: a"), /o'\\''neil\\: a/);
  assert.throws(() => L.filtre({ kamera: p.kamera, lens: p.lens, odak: -1 }), /aralık dışı/);
  assert.throws(() => L.filtre({ kamera: p.kamera }), /gerekli/);
});

test("gercek ffmpeg: profil uygulanir (lens karakteri ekle ve duzelt)", { skip: !(() => { try { return spawnSync(require("../ff-yol.js").ffmpeg, ["-version"]).status === 0; } catch { return false; } })() }, () => {
  const ffm = require("../ff-yol.js").ffmpeg;
  const p = L.profilBul("cam one", "test 35mm");
  for (const yon of ["ekle", "duzelt"]) {
    const r = spawnSync(ffm, ["-y", "-f", "lavfi", "-i", "testsrc=s=160x90:r=30:d=0.3", "-vf", L.filtre({ kamera: p.kamera, lens: p.lens, odak: 35, diyafram: 2, mesafe: 3, yon }), "-f", "null", "-"], { encoding: "utf8" });
    if (/No such filter|lensfun/i.test(r.stderr || "") && r.status !== 0 && /No such filter/i.test(r.stderr)) return;   // bu ffmpeg Lensfun'siz derlenmis: atla
    assert.equal(r.status, 0, yon + ": " + (r.stderr || "").slice(-300));
  }
});

test("indir: sahte ag ile dosyalar yazilir; yabanci adres ve yol kacisi reddedilir", async () => {
  const hedef = fs.mkdtempSync(path.join(os.tmpdir(), "lensfun-dl-"));
  process.env.LENSFUN_DB = hedef;
  try {
    const liste = [
      { name: "iyi.xml", size: 10, download_url: "https://raw.githubusercontent.com/lensfun/lensfun/master/data/db/iyi.xml" },
      { name: "../kacis.xml", size: 10, download_url: "https://raw.githubusercontent.com/lensfun/lensfun/master/x" },
      { name: "kotu.xml", size: 10, download_url: "https://evil.example.com/kotu.xml" },
    ];
    const cagrilar = [];
    const sahte = async (url) => {
      cagrilar.push(url);
      if (/api\.github\.com/.test(url)) return { ok: true, json: async () => liste };
      return { ok: true, arrayBuffer: async () => Buffer.from("<lensdatabase/>") };
    };
    const r = await L.indir({ fetch: sahte, log: () => {} });
    assert.equal(r.dosya, 1);
    assert.ok(fs.existsSync(path.join(hedef, "iyi.xml")) && fs.existsSync(path.join(hedef, "KAYNAK.txt")));
    assert.ok(!cagrilar.some(u => /evil/.test(u)));
    assert.ok(!fs.existsSync(path.join(hedef, "..", "kacis.xml")));
    await assert.rejects(L.indir({ fetch: async () => ({ ok: false, status: 503 }), log: () => {} }), /HTTP 503/);
  } finally { process.env.LENSFUN_DB = DB; fs.rmSync(hedef, { recursive: true, force: true }); }
});

test("kur: lensProfili uygulanir (uyari yok); olmayan profil uyari verir ama film kurulur", { skip: !(() => { try { return spawnSync(require("../ff-yol.js").ffmpeg, ["-version"]).status === 0; } catch { return false; } })() }, async () => {
  const fik = require("./render-fikstur");
  const kok = fik.ortamKur();
  try {
    const S = require("../studyo.js"), K = require("../lib/vidiq-klip.js");
    const ffm = require("../ff-yol.js").ffmpeg;
    S.yeni("lenstest", { stil: "serbest" });
    S.sahneEkle("lenstest", "a cat walking on a beach", 6);
    const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(20, 1)]);
    const sahte = { async cagir(arac, arg) { if (arac === "vidiq_balance") return { totalCredits: 9999 }; if (arac === "vidiq_generate_video") return { mcpJobId: "j1" }; throw new Error(arac); }, async isBekle() { return { videoUrl: "https://cdn.example.com/a.mp4" }; } };
    await S.uret("lenstest", { butce: "500", onay: true }, { vidiq: sahte, indir: async () => MP4, log: () => {} });
    const clips = path.join(kok, "lenstest", "Clips");
    for (const g of K.kayitOku(clips).klipler.filter(x => x.dosya))
      assert.equal(spawnSync(ffm, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=320x240:r=30", "-t", "1", "-pix_fmt", "yuv420p", path.join(clips, g.dosya)]).status, 0);
    const yol = path.join(kok, "lenstest", "studyo.json");
    const a = JSON.parse(fs.readFileSync(yol, "utf8"));
    a.kamera = "temiz"; a.lensProfili = { kamera: "Cam One", lens: "Test 35mm", odak: 35, diyafram: 2 };
    fs.writeFileSync(yol, JSON.stringify(a));
    const r = await S.kur("lenstest", {}, { log: () => {} });
    assert.ok(fs.existsSync(r.cikti));
    assert.ok(fs.existsSync(path.join(kok, "lenstest", "kurgu", "lens.mp4")), "lens adimi calisti");
    assert.equal(r.uyarilar.filter(u => /Lens profili/.test(u)).length, 0, r.uyarilar.join(" | "));
    a.lensProfili = { kamera: "Yok Kamera", lens: "Yok Lens" };
    fs.writeFileSync(yol, JSON.stringify(a));
    const r2 = await S.kur("lenstest", {}, { log: () => {} });
    assert.ok(fs.existsSync(r2.cikti));
    assert.ok(r2.uyarilar.some(u => /Lens profili uygulanamadı/.test(u)), r2.uyarilar.join(" | "));
    a.lensProfili = "bozuk"; fs.writeFileSync(yol, JSON.stringify(a));
    await assert.rejects(S.kur("lenstest", {}, { log: () => {} }), /Geçersiz lensProfili/);
  } finally { fik.temizle(kok); }
});
