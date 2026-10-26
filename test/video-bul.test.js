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
  kokler.push(kok);                                              // dosya sonunda silinir
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

// ---------------------------------------------------------------- duzeltmeler (bulgu 15, 16, 17, 20)
// Sahte is: manifest + sahne klasorleri gecici klasorde; ag ve Pexels istemcisi sahte (gercek aga/krediye CIKMAZ).
const mp4Yap = n => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(30000, n || 1)]);
const kokler = [];
test.after(() => { for (const k of kokler) try { fs.rmSync(k, { recursive: true, force: true }); } catch (e) { /* kilitli */ } });
function vbIsKur(sahneler, ad) {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "video-bul-"));
  kokler.push(kok);
  process.env.OTOMASYON_URETIM = kok;
  const dizin = path.join(kok, ad || "vb"), vis = path.join(dizin, "Visuals");
  const man = { hedefYon: "yatay", sahneler: sahneler.map((s, i) => ({ no: i + 1, klasor: s.klasor, aramalar: s.aramalar, gorseller: [] })) };
  for (const s of sahneler) fs.mkdirSync(path.join(vis, s.klasor), { recursive: true });
  fs.writeFileSync(path.join(vis, "manifest.json"), JSON.stringify(man));
  return { is: ad || "vb", dizin, vis };
}
// Pexels adayi: id -> kaynakUrl .../video/<baslik>-<id>/ (dosya adi 00-stok-pexels-<id>.mp4)
const pex = (id, baslik, ek) => Object.assign({ kaynak: "pexels", url: "https://v/" + id + ".mp4", yedekUrl: [], baslik, etiket: "", atif: "Yazar " + id,
  kaynakUrl: "https://www.pexels.com/video/" + baslik.replace(/\s+/g, "-") + "-" + id + "/", indirmeUrl: "https://v/" + id + ".mp4",
  lisans: "Pexels License", lisansKodu: "pexels", atifGerekli: false, atifOnerilen: true, sure: 8, en: 1920, boy: 1080, sira: 0 }, ek || {});
const sahteGetir = (ozel) => { const g = { cagrilar: [] }; g.gorsel = async (u, o) => { g.cagrilar.push({ u, o }); if (ozel) { const r = await ozel(u, o); if (r) return r; } return { govde: mp4Yap() }; }; return g; };
const vbCalistir = (args, bag) => vb.calistir(args, Object.assign({ pexelsKey: "K", pixabayKey: "", log: () => {} }, bag));

test("alakaPuani: onek eslesmesi YOK (art~artificial, universe~university, time~timelapse, planet~plane), ek eslesmesi VAR", () => {
  const sifir = [["artificial intelligence", "art gallery visitors"], ["expanding universe", "university campus students"],
    ["time travel", "timelapse of clouds"], ["planet surface", "plane taking off"], ["Carthage ruins", "car driving at night"],
    ["Nelson Mandela", "man walking"], ["gothic cathedral", "cat sleeping"]];
  for (const [q, b] of sifir) assert.equal(vb.alakaPuani({ baslik: b }, q), 0, q + " ~ " + b);
  assert.equal(vb.alakaPuani({ baslik: "wave crash" }, "crashing waves"), 1);
  assert.equal(vb.alakaPuani({ baslik: "people dance party" }, "dancing people"), 1);
  assert.equal(vb.alakaPuani({ baslik: "spiral galaxy" }, "galaxies"), 1);
  assert.equal(vb.alakaPuani({ baslik: "man runs in park" }, "running man"), 1);
  // alakasiz klip enIyiAday'dan gecmez
  assert.deepEqual(vb.enIyiAday([pex(1, "art gallery visitors")], "artificial intelligence", "yatay"), []);
});

test("calistir: atif HER indirmede (klipten once) yazilir; kesilen calismadan sonra iki klibin de atfi ATIF.txt ve yayin paketinde", async () => {
  const j = vbIsKur([{ klasor: "001-dalga", aramalar: ["ocean waves"] }, { klasor: "002-orman", aramalar: ["forest trees"] }]);
  const ist = { pexels: async q => /ocean/.test(q) ? [pex(11, "ocean waves")] : [pex(22, "forest trees")] };
  // 1. calisma: ikinci klip inerken surec "olur" (Ctrl+C / ajanin komut zaman asimi): hata yakalanmadan yukari cikar
  const kesen = sahteGetir(async u => { if (/22\.mp4/.test(u)) throw new Error("KESINTI"); });
  await assert.rejects(vbCalistir(["vb"], { getir: kesen, istemciler: ist, log: m => { if (/KESINTI/.test(m)) throw new Error("KESINTI"); } }), /KESINTI/);
  assert.ok(fs.existsSync(path.join(j.vis, "001-dalga", "00-stok-pexels-11.mp4")));
  let atif = JSON.parse(fs.readFileSync(path.join(j.vis, "video-atif.json"), "utf8"));
  assert.deepEqual(atif.map(x => x.dosya), ["001-dalga/00-stok-pexels-11.mp4"], "kesintide atif kaybolmadi");
  // 2. calisma: ilk sahne 'zaten var' ile atlanir, ikinci indirilir; iki atif da durur
  const loglar = [];
  const r = await vbCalistir(["vb"], { getir: sahteGetir(), istemciler: ist, log: m => loglar.push(m) });
  assert.equal(r.eklenen, 1);
  atif = JSON.parse(fs.readFileSync(path.join(j.vis, "video-atif.json"), "utf8"));
  assert.deepEqual(atif.map(x => x.dosya).sort(), ["001-dalga/00-stok-pexels-11.mp4", "002-orman/00-stok-pexels-22.mp4"]);
  assert.ok(!loglar.some(m => /atıf kaydı yok/.test(m)), loglar.join("\n"));
  // ATIF.txt (YouTube aciklamasina yapistirilan) ve yayin paketi ayni iki Pexels satirini tasir
  const atifTxt = fs.readFileSync(path.join(j.dizin, "ATIF.txt"), "utf8").trim().split("\n").slice(1);
  const { atiflar } = require("../lib/render-yayin.js").atiflariKur(j.dizin);
  assert.equal(atifTxt.length, 2);
  assert.deepEqual(atiflar.map(a => a.atifMetni).sort(), atifTxt.slice().sort());
  assert.ok(atifTxt.some(l => /Yazar 11/.test(l)) && atifTxt.some(l => /Yazar 22/.test(l)));
});

test("calistir: kaydi olmayan klip 'zaten var' dalinda uyarilir (--sahne N --yeniden onerilir); --yeniden eski klibin kaydini dusurur", async () => {
  const j = vbIsKur([{ klasor: "001-dalga", aramalar: ["ocean waves"] }]);
  fs.writeFileSync(path.join(j.vis, "001-dalga", "00-stok-pexels-5.mp4"), mp4Yap());
  const loglar = [];
  const ist = { pexels: async () => [pex(6, "ocean waves")] };
  await vbCalistir(["vb"], { getir: sahteGetir(), istemciler: ist, log: m => loglar.push(m) });
  assert.ok(loglar.some(m => /00-stok-pexels-5\.mp4: atıf kaydı yok/.test(m) && /--sahne 1 --yeniden/.test(m)), loglar.join("\n"));
  const r = await vbCalistir(["vb", "--sahne", "1", "--yeniden"], { getir: sahteGetir(), istemciler: ist });
  assert.equal(r.eklenen, 1);
  assert.deepEqual(fs.readdirSync(path.join(j.vis, "001-dalga")), ["00-stok-pexels-6.mp4"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(j.vis, "video-atif.json"), "utf8")).map(x => x.dosya), ["001-dalga/00-stok-pexels-6.mp4"]);
});

test("calistir: ayni klip iki sahneye inmez; panelden silinen klip bir daha gelmez; --ara --sahne'siz kullanim hatasi", async () => {
  const j = vbIsKur([{ klasor: "001-a", aramalar: ["black hole space"] }, { klasor: "002-b", aramalar: ["black hole accretion disk"] },
    { klasor: "003-c", aramalar: ["black hole event horizon"] }]);
  // Pexels her aramada ayni ust sonucu dondurur (77), ikinci sirada 78
  const ist = { pexels: async () => [pex(77, "black hole space"), pex(78, "black hole render", { sira: 1 })] };
  const loglar = [];
  const r = await vbCalistir(["vb"], { getir: sahteGetir(), istemciler: ist, log: m => loglar.push(m) });
  assert.equal(r.eklenen, 2);
  assert.deepEqual(fs.readdirSync(path.join(j.vis, "001-a")), ["00-stok-pexels-77.mp4"]);
  assert.deepEqual(fs.readdirSync(path.join(j.vis, "002-b")), ["00-stok-pexels-78.mp4"]);
  assert.deepEqual(fs.readdirSync(path.join(j.vis, "003-c")), [], "ayni klip ucuncu kez inmedi");
  assert.ok(loglar.some(m => /003-c: alakalı stok video bulunamadı \(2 aday başka sahnede/.test(m)), loglar.join("\n"));
  // panelden silinen klip (silinenler.json'da ad ile) yeniden indirilmez
  fs.unlinkSync(path.join(j.vis, "001-a", "00-stok-pexels-77.mp4"));
  fs.writeFileSync(path.join(j.dizin, "silinenler.json"), JSON.stringify({ surum: 1, silinenler: [{ sahne: "001-a", ad: "00-stok-pexels-77.mp4", kaynakUrl: null, sha1: "x" }] }));
  const ist2 = { pexels: async () => [pex(77, "black hole space"), pex(79, "black hole space", { sira: 1 })] };
  const r2 = await vbCalistir(["vb", "--sahne", "1"], { getir: sahteGetir(), istemciler: ist2 });
  assert.equal(r2.eklenen, 1);
  assert.deepEqual(fs.readdirSync(path.join(j.vis, "001-a")), ["00-stok-pexels-79.mp4"]);
  // silinen klibin atif kaydi da dustu
  const atif = JSON.parse(fs.readFileSync(path.join(j.vis, "video-atif.json"), "utf8")).map(x => x.dosya).sort();
  assert.deepEqual(atif, ["001-a/00-stok-pexels-79.mp4", "002-b/00-stok-pexels-78.mp4"]);
  // --ara tek sahnenin ifadesidir
  await assert.rejects(vbCalistir(["vb", "--ara", "waves"], { getir: sahteGetir(), istemciler: ist }), e => e.cikis === 2 && /--sahne/.test(e.message));
  await assert.rejects(vbCalistir(["vb", "--sahne", "9", "--ara", "x"], { getir: sahteGetir(), istemciler: ist }), e => e.cikis === 2 && /Sahne 9 yok/.test(e.message));
});

test("calistir: indirme toplam sure siniri 80 MB'a gore (soket bosta kalma suresinden ayri), zaman asiminda ayni klip tekrar indirilmez", async () => {
  const j = vbIsKur([{ klasor: "001-a", aramalar: ["ocean waves"] }, { klasor: "002-b", aramalar: ["ocean waves"] }, { klasor: "003-c", aramalar: ["ocean waves"] }]);
  let id = 100;
  const ist = { pexels: async () => [pex(++id, "ocean waves"), pex(++id, "ocean waves", { sira: 1 })] };
  const getir = sahteGetir();
  await vbCalistir(["vb", "--azami", "1"], { getir, istemciler: ist });
  const o = getir.cagrilar[0].o;
  assert.equal(o.maksBayt, 80 * 1024 * 1024);
  assert.equal(o.zamanAsimiTekrarYok, true, "yavas indirme 2 kez bastan baslamaz");
  assert.ok(o.toplamAsimiMs >= 10 * 60000, "80 MB ~1 Mbps'de bitebilmeli: " + o.toplamAsimiMs);
  // yavas baglanti: zaman asiminda sahnenin diger adaylari beklenmez, 2 zaman asiminda calisma durur
  const yavas = sahteGetir(async () => { throw Object.assign(new Error("Zaman aşımı (toplam süre doldu)."), { kod: "zaman_asimi" }); });
  const loglar = [];
  for (const k of ["001-a", "002-b"]) for (const f of fs.readdirSync(path.join(j.vis, k))) fs.unlinkSync(path.join(j.vis, k, f));
  const r = await vbCalistir(["vb"], { getir: yavas, istemciler: ist, log: m => loglar.push(m) });
  assert.equal(r.eklenen, 0);
  assert.equal(yavas.cagrilar.length, 2, "sahne basina tek deneme, 2 zaman asiminda durur: " + yavas.cagrilar.map(c => c.u).join(", "));
  assert.ok(loglar.some(m => /Bağlantı çok yavaş/.test(m)), loglar.join("\n"));
  // dosya siniri asilirsa ayni klibin kucuk surumu denenir
  const buyuk = sahteGetir(async u => { if (/buyuk/.test(u)) throw Object.assign(new Error("Dosya çok büyük"), { kod: "cok_buyuk" }); });
  const ist2 = { pexels: async () => [pex(500, "ocean waves", { url: "https://v/buyuk.mp4", yedekUrl: ["https://v/kucuk.mp4"] })] };
  const r2 = await vbCalistir(["vb", "--sahne", "1"], { getir: buyuk, istemciler: ist2 });
  assert.equal(r2.eklenen, 1);
  assert.deepEqual(buyuk.cagrilar.map(c => c.u), ["https://v/buyuk.mp4", "https://v/kucuk.mp4"]);
});

test("calistir: aramanin yarisi eslesen aday 'zayif': once yedek aramalar denenir; yalniz zayif varsa alinir ve isaretlenir", async () => {
  const j = vbIsKur([{ klasor: "001-a", aramalar: ["black hole", "event horizon glow"] }, { klasor: "002-b", aramalar: ["black hole"] }]);
  const ist = { pexels: async q => q === "black hole" ? [pex(1, "black cat")] : q === "event horizon glow" ? [pex(2, "event horizon glow")] : [] };
  const loglar = [];
  await vbCalistir(["vb"], { getir: sahteGetir(), istemciler: ist, log: m => loglar.push(m) });
  assert.deepEqual(fs.readdirSync(path.join(j.vis, "001-a")), ["00-stok-pexels-2.mp4"], "tam eslesen yedek arama secildi");
  assert.deepEqual(fs.readdirSync(path.join(j.vis, "002-b")), ["00-stok-pexels-1.mp4"], "baska aday yok: zayif aday alindi");
  const atif = JSON.parse(fs.readFileSync(path.join(j.vis, "video-atif.json"), "utf8"));
  assert.equal(atif.find(x => x.dosya.startsWith("002-b")).alakaZayif, true);
  assert.ok(!atif.find(x => x.dosya.startsWith("001-a")).alakaZayif);
  assert.ok(loglar.some(m => /002-b .*alakası zayıf/.test(m)), loglar.join("\n"));
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
