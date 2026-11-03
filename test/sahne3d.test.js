// 3B sahne (ucretsiz, yerel): agiz egrisi, sablon dogrulamasi, kredi harcamama, kur'da cizim entegrasyonu (sahte cizici) ve istege bagli GERCEK cizim.
// Gercek cizim (Chrome + three.js indirme) yalniz OTOPILOT_3D_TEST=1 ile calisir; varsayilan testler aga/Chrome'a dokunmaz.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const fik = require("./render-fikstur");
const kok = fik.ortamKur();
const skip = !fik.ffmpegVarMi() && "ffmpeg yok";
test.after(() => fik.temizle(kok));
const S = require("../studyo.js");
const AG = require("../lib/ses-agzi.js");
const S3 = require("../lib/sahne3d.js");
const ff = () => require("../ff-yol.js");
const sessiz = { log: () => {} };

test("ses-agzi: sessizlik 0, konusma/ton acik; yumusatma atak hizli, birakma yavas", { skip }, () => {
  const d = path.join(kok, "agiz"); fs.mkdirSync(d, { recursive: true });
  const ses = path.join(d, "s.wav");
  // 1 sn sessiz + 1 sn ton + 1 sn sessiz
  execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "1", path.join(d, "a.wav")]);
  execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=1:sample_rate=16000", "-af", "volume=0.5", path.join(d, "b.wav")]);
  execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-i", path.join(d, "a.wav"), "-i", path.join(d, "b.wav"), "-i", path.join(d, "a.wav"), "-filter_complex", "concat=n=3:v=0:a=1", ses]);
  const e = AG.agizEgrisi(ses, 30);
  assert.ok(e.length >= 88 && e.length <= 92, "kare sayisi " + e.length);
  assert.ok(e.slice(0, 25).every(v => v === 0), "ilk sn kapali");
  assert.ok(Math.max(...e.slice(34, 56)) > 0.5, "ton sirasinda acik");
  assert.ok(e.slice(70).every(v => v < 0.05), "son sn kapali");
  assert.ok(e.every(v => v >= 0 && v <= 1));
  const y = AG.yumusat([0, 1, 1, 0, 0, 0]);
  assert.ok(y[1] > 0.7 && y[3] > 0.2 && y[3] < y[2]);                    // hizli ac, yavas kapa
  assert.equal(AG.esle(-Infinity), 0); assert.equal(AG.esle(-10), 1);
});

test("3B sahne: sablonlar, dogrulama; gecersiz kayit dosyayi bozmaz; ayni yapi 3 sablon icin", { skip }, () => {
  assert.deepEqual(Object.keys(S3.SABLONLAR).sort(), ["dunya", "karakter", "urun"]);
  assert.deepEqual(S3.KARAKTER_AYARLARI, ["yaratici", "ogretmen", "sef", "koc", "analist"]);
  for (const s of Object.keys(S3.SABLONLAR)) assert.match(S3.sahneHtml(s, { baslik: "</script><b>x" }), /\\u003c\/script>/);     // parametre html'i bozamaz
  S.yeni("uc", { stil: "serbest" });
  assert.throws(() => S.sahne3dEkle("uc", "yok", {}), /Bilinmeyen 3B şablon/);
  const yol = path.join(kok, "uc", "studyo.json");
  const once = fs.readFileSync(yol, "utf8");
  assert.throws(() => S.sahne3dEkle("uc", "urun", { renk: "kirmizi" }), /#rrggbb/);
  assert.throws(() => S.sahne3dEkle("uc", "karakter", { "on-ayar": "yok" }), /onAyar/);
  assert.equal(fs.readFileSync(yol, "utf8"), once);                      // geri alindi
  assert.equal(S.sahne3dEkle("uc", "urun", { baslik: "Yeni telefon", renk: "#ff0066", sure: 4 }), 1);
  assert.equal(S.sahne3dEkle("uc", "karakter", { "on-ayar": "sef", anlatim: "Merhaba" }), 2);
  const a = S.ayarOku("uc");
  assert.deepEqual(a.sahneler.map(s => [s.mod, s.sablon3d]), [["3b", "urun"], ["3b", "karakter"]]);
  assert.equal(a.sahneler[0].parametre.baslik, "Yeni telefon"); assert.equal(a.sahneler[1].anlatim, "Merhaba");
});

test("3B sahne ucretsizdir: uret kuru calismada 3B sahneyi saymaz ve kredi harcamaz", { skip }, async () => {
  const sahte = { async cagir() { throw new Error("vidIQ cagrilmamali"); }, async isBekle() { throw new Error("vidIQ cagrilmamali"); } };
  const r = await S.uret("uc", { butce: "100", onay: true }, Object.assign({ vidiq: sahte, indir: async () => Buffer.alloc(0) }, sessiz));
  assert.equal(r.durum, "hepsi_hazir"); assert.equal(r.uretilecek, 0); assert.equal(r.tahminiKredi, 0);
});

test("kur: 3B sahneler cizilir (sahte cizici), karakterin agzi anlatim sesinden gelir, sonuc film olur; ayni girdi yeniden cizilmez", { skip }, async () => {
  const cizilen = [];
  const sahteCizici = async o => {
    cizilen.push(o);
    fs.mkdirSync(path.dirname(o.cikti), { recursive: true });
    execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=" + o.genislik + "x" + o.yukseklik + ":r=30", "-t", String(o.sure), "-pix_fmt", "yuv420p", o.cikti]);
  };
  const sahteSes = async g => execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=2", "-c:a", "aac", "-f", "adts", g.cikti]);
  const enj = Object.assign({ ciz3d: sahteCizici, ses: sahteSes }, sessiz);
  const r = await S.kur("uc", { sesnormalsiz: true }, enj);
  assert.equal(r.yerel3b, 2);
  assert.deepEqual(cizilen.map(o => o.sablon), ["urun", "karakter"]);
  assert.equal(cizilen[0].parametre.baslik, "Yeni telefon");
  assert.ok(Array.isArray(cizilen[1].parametre.agiz) && cizilen[1].parametre.agiz.length > 50);   // karakter: ses -> agiz egrisi
  assert.ok(!("agiz" in cizilen[0].parametre));                                                    // urun: yok
  assert.ok(cizilen[1].sure >= 2.4, "sahne anlatimdan kisa degil: " + cizilen[1].sure);
  assert.ok(Math.min(cizilen[0].genislik, cizilen[0].yukseklik) <= 720);                          // hizli cizim icin 720'ye indirilir
  assert.ok(fs.existsSync(r.cikti));
  const boyut = execFileSync(ff().ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", r.cikti], { encoding: "utf8" }).trim();
  assert.equal(boyut, "1080,1920");
  await S.kur("uc", { sesnormalsiz: true }, enj);
  assert.equal(cizilen.length, 2);                                                                  // onbellek: yeniden cizilmedi
});

test("GERCEK cizim (OTOPILOT_3D_TEST=1): Chrome + three.js ile karakter sahnesi bir mp4 olur", { skip: process.env.OTOPILOT_3D_TEST !== "1" && "OTOPILOT_3D_TEST=1 ile calisir", timeout: 300000 }, async () => {
  assert.ok(S3.chromeBul(), "Chrome/Edge yok");
  const cikti = path.join(kok, "gercek3d.mp4");
  const r = await S3.ciz({ sablon: "karakter", parametre: { baslik: "Test", onAyar: "ogretmen", agiz: Array.from({ length: 70 }, (_, i) => (i > 10 ? Math.abs(Math.sin(i / 3)) : 0)) }, sure: 2, genislik: 360, yukseklik: 640, fps: 30, cikti, log: () => {} });
  assert.equal(r.kare, 60);
  const n = execFileSync(ff().ffprobe, ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", cikti], { encoding: "utf8" }).trim();
  assert.equal(n.replace(/,/g, ""), "60");
});
