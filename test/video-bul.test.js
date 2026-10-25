// Stok video: Pexels/Pixabay video istemcileri, alaka secimi, indirme, atif kaydi, klip argv'si. Ag ve krediye DOKUNMAZ.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const kaynak = require("../lib/gorsel-kaynak.js");
const vb = require("../video-bul.js");
const K = require("../lib/render-klip.js");
const SH = require("../lib/render-sahne.js");

const sahte = yanit => { const g = { cagrilar: [] }; g.json = async (u, o) => { g.cagrilar.push({ u, o }); return yanit(u); }; return g; };

test("pexelsVideoAra: mp4, <=1920 genislik, en genisi secilir, kisa klip elenir", async () => {
  const g = sahte(() => ({ videos: [
    { url: "https://www.pexels.com/video/waves-crashing-on-rocks-123/", duration: 9, user: { name: "Ayse" }, video_files: [
      { link: "https://v/4k.mp4", file_type: "video/mp4", width: 3840, height: 2160 }, { link: "https://v/hd.mp4", file_type: "video/mp4", width: 1920, height: 1080 },
      { link: "https://v/sd.mp4", file_type: "video/mp4", width: 960, height: 540 }, { link: "https://v/x.webm", file_type: "video/webm", width: 1280, height: 720 }] },
    { url: "https://www.pexels.com/video/short-1/", duration: 2, video_files: [{ link: "https://v/s.mp4", file_type: "video/mp4", width: 1280, height: 720 }] }] }));
  const r = await kaynak.pexelsVideoAra("waves", { yon: "yatay" }, { getir: g, anahtar: "K" });
  assert.equal(r.length, 1); assert.equal(r[0].url, "https://v/hd.mp4"); assert.deepEqual(r[0].yedekUrl, ["https://v/sd.mp4"]);
  assert.equal(r[0].lisansKodu, "pexels"); assert.equal(r[0].baslik, "waves crashing on rocks"); assert.match(g.cagrilar[0].u, /orientation=landscape/);
  assert.deepEqual(await kaynak.pexelsVideoAra("x", {}, { getir: g }), []);
});

test("pixabayVideoAra: large>medium, 1920'den genis elenir", async () => {
  const g = sahte(() => ({ hits: [{ pageURL: "https://pixabay.com/videos/x-1/", tags: "sea, waves", duration: 12, user: "Can",
    videos: { large: { url: "https://p/l.mp4", width: 3840, height: 2160, size: 9 }, medium: { url: "https://p/m.mp4", width: 1920, height: 1080, size: 5 } } }] }));
  const r = await kaynak.pixabayVideoAra("waves", {}, { getir: g, anahtar: "K" });
  assert.equal(r[0].url, "https://p/m.mp4"); assert.equal(r[0].lisansKodu, "pixabay");
});

test("alakaPuani / enIyiAday: alakasiz elenir, dikeyde dikey tercih edilir", () => {
  assert.ok(vb.alakaPuani({ baslik: "waves crashing on rocks" }, "ocean waves rocks") >= 0.34);
  assert.equal(vb.alakaPuani({ baslik: "city traffic night" }, "ocean waves rocks"), 0);
  const l = vb.enIyiAday([
    { baslik: "waves", en: 1920, boy: 1080, sure: 8, sira: 0 }, { baslik: "waves", en: 1080, boy: 1920, sure: 8, sira: 1 }, { baslik: "traffic", en: 1080, boy: 1920, sure: 8, sira: 2 }], "ocean waves", "dikey");
  assert.equal(l.length, 2); assert.equal(l[0].boy, 1920);
});

test("calistir: klibi sahne klasorune yazar, atif kaydeder, ikinci kosuda atlar; anahtar yoksa hata", async () => {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "video-bul-"));
  process.env.OTOMASYON_URETIM = kok;
  const ortak = require("../lib/ortak.js");
  const dizin = ortak.isDizin("deneme", kok);
  fs.mkdirSync(path.join(dizin, "Visuals", "001-dalgalar"), { recursive: true });
  fs.writeFileSync(path.join(dizin, "Visuals", "manifest.json"), JSON.stringify({ hedefYon: "yatay", sahneler: [{ no: 1, klasor: "001-dalgalar", aramalar: ["ocean waves"], gorseller: [] }] }));
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(30000, 1)]);
  const getir = { gorsel: async () => ({ govde: mp4 }) };
  const ist = { pexels: async () => [{ kaynak: "pexels", url: "https://v/a.mp4", baslik: "ocean waves", etiket: "", atif: "Ayse", kaynakUrl: "https://www.pexels.com/video/ocean-waves-77/",
    lisans: "Pexels License", lisansKodu: "pexels", sure: 8, en: 1920, boy: 1080, sira: 0 }] };
  const loglar = [];
  const r = await vb.calistir(["deneme"], { pexelsKey: "K", pixabayKey: "", getir, istemciler: ist, log: m => loglar.push(m) });
  assert.equal(r.eklenen, 1);
  const klasor = path.join(dizin, "Visuals", "001-dalgalar");
  assert.deepEqual(fs.readdirSync(klasor), ["00-stok-pexels-77.mp4"]);
  const atif = JSON.parse(fs.readFileSync(path.join(dizin, "Visuals", "video-atif.json"), "utf8"));
  assert.equal(atif.length, 1); assert.equal(atif[0].lisansKodu, "pexels");
  const r2 = await vb.calistir(["deneme"], { pexelsKey: "K", pixabayKey: "", getir, istemciler: ist, log: () => {} });
  assert.equal(r2.eklenen, 0, "ikinci kosuda yeniden indirmez");
  await assert.rejects(vb.calistir(["deneme"], { pexelsKey: "", pixabayKey: "", getir, istemciler: ist }), /PEXELS_KEY ya da PIXABAY_KEY/);
});

test("render: mp4 gorsel uzantisi sayilir; klipArgv video icin stream_loop + kirpma, zoompan YOK", () => {
  assert.ok(SH.GORSEL_UZANTI.test("00-stok-pexels-1.mp4") && SH.GORSEL_UZANTI.test("01.jpg") && !SH.GORSEL_UZANTI.test("x.gif"));
  const ayar = { W: 1080, H: 1920, SW: 1200, SH: 2100, FPS: 30, efekt: "yavas", renkFiltresi: "null" };
  const argv = K.klipArgv(ayar, { yol: "a.mp4", kare: 90, zin: true }, { ara: ["-c:v", "libx264"] }, 2);
  assert.deepEqual(argv.slice(0, 3), ["-stream_loop", "-1", "-i"]);
  const vf = argv[argv.indexOf("-vf") + 1];
  assert.match(vf, /crop=1080:1920/); assert.ok(!/zoompan/.test(vf));
  assert.equal(argv[argv.indexOf("-frames:v") + 1], "90");
  assert.ok(K.klipArgv(ayar, { yol: "a.jpg", kare: 90, zin: true }, { ara: [] }, 2).join(" ").includes("zoompan"));
});
