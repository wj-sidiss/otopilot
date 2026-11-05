// Panel / AI Studyo uclari (gercek panel sureci): is acma, foto yukleme guvenligi, kaydetme + geri alma, maliyet, kuru calisma, medya.
// Gercek vidIQ'ya ve krediye DOKUNMAZ (VIDIQ_KEY yok; kuru calisma anahtarsiz calisir).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Y = require("./panel-yardim");

let ortam, panel, c;
test.before(async () => { ortam = Y.geciciOrtam("studyo"); panel = await Y.panelBaslat(ortam); c = panel.istemci; });
test.after(async () => { if (panel) await panel.kapat(); if (ortam) ortam.temizle(); });

// kucuk gecerli JPEG basligi (yalniz imza kontrolu) + govde
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]).toString("base64");

async function bekleBitsin(ad) {
  for (let i = 0; i < 100; i++) {
    const r = (await c.get("/api/studyo/detay?ad=" + ad)).json;
    if (!r.is || !r.is.calisiyor) return r;
    await new Promise(k => setTimeout(k, 150));
  }
  throw new Error("is bitmedi");
}

test("yeni is: gecersiz ad ve stil reddedilir; liste stilleri dondurur", async () => {
  assert.equal((await c.post("/api/studyo/yeni", { ad: "../kotu" })).durum, 400);
  assert.equal((await c.post("/api/studyo/yeni", { ad: "Buyuk" })).durum, 400);
  assert.equal((await c.post("/api/studyo/yeni", { ad: "film1", stil: "yok" })).durum, 400);
  const r = await c.post("/api/studyo/yeni", { ad: "film1", stil: "serbest", oran: "9:16" });
  assert.equal(r.durum, 200, r.metin);
  assert.equal((await c.post("/api/studyo/yeni", { ad: "film1" })).durum, 400);     // zaten var
  const l = (await c.get("/api/studyo/liste")).json;
  assert.deepEqual(l.isler.map(x => x.ad), ["film1"]);
  assert.ok(l.stiller["cizgi-film"] && l.stiller.serbest);
});

test("foto yukleme: gercek imza zorunlu, guvenli ad, tekrar yuklenince ad cakismaz; ucuncu taraf yol/uzanti reddedilir", async () => {
  const kotu = (govde) => c.post("/api/studyo/yukle", Object.assign({ ad: "film1" }, govde));
  assert.equal((await kotu({ dosya: "a.exe", veri: JPEG })).durum, 400);
  assert.equal((await kotu({ dosya: "a.jpg", veri: Buffer.from("MZ not an image").toString("base64") })).durum, 400);   // imza yok
  assert.equal((await kotu({ dosya: "a.jpg", veri: "" })).durum, 400);
  assert.equal((await c.post("/api/studyo/yukle", { ad: "yok-boyle", dosya: "a.jpg", veri: JPEG })).durum, 404);
  let r = await kotu({ dosya: "../../etc/Kedi Foto.jpg", veri: JPEG });
  assert.equal(r.durum, 200, r.metin);
  assert.equal(r.json.dosya, "Kedi-Foto.jpg");                                     // yol kirpildi, bosluk temizlendi
  r = await kotu({ dosya: "Kedi Foto.jpg", veri: JPEG });
  assert.equal(r.json.dosya, "Kedi-Foto-2.jpg");
  r = await kotu({ dosya: "Büyük Çocuk ığış.jpg", veri: JPEG });                    // Turkce karakterler okunur kalir
  assert.equal(r.json.dosya, "Buyuk-Cocuk-igis.jpg");
  assert.ok(fs.existsSync(path.join(ortam.uretim, "film1", "girdi", "Kedi-Foto.jpg")));
  const d = (await c.get("/api/studyo/detay?ad=film1")).json;
  assert.equal(d.sahneler.length, 3);
  assert.equal(d.sahneler[0].mod, "ilk-kare");                                     // serbest stil: foto oldugu gibi canlanir
});

test("kaydet: sahneler, ayar ve maliyet; gecersiz kayit eski dosyayi bozmaz", async () => {
  let r = await c.post("/api/studyo/sahne", { ad: "film1", istem: "an astronaut on mars at sunset", sure: 5 });
  assert.equal(r.durum, 200, r.metin);
  assert.equal((await c.post("/api/studyo/sahne", { ad: "film1", istem: "  " })).durum, 400);
  const d = (await c.get("/api/studyo/detay?ad=film1")).json;
  assert.equal(d.sahneler.length, 4);
  const bekle = d.ayar.sure;
  assert.equal(d.krediSn, 20);                                                      // minimax-h3 768p
  assert.equal(d.kredi, (bekle * 3 + 5) * 20);
  const oncekiDosya = fs.readFileSync(path.join(ortam.uretim, "film1", "studyo.json"), "utf8");
  r = await c.post("/api/studyo/kaydet", { ad: "film1", model: "wan-3", cozunurluk: "768p" });   // wan-3 768p yok
  assert.equal(r.durum, 400);
  assert.equal(fs.readFileSync(path.join(ortam.uretim, "film1", "studyo.json"), "utf8"), oncekiDosya);
  const videolu = [{ mod: "metin", hareket: "a cat", sure: 4 }, { mod: "video", url: "https://example.com/v.mp4", sure: 6 }];
  r = await c.post("/api/studyo/kaydet", { ad: "film1", model: "seedance-2-fast", cozunurluk: "720p", sahneler: videolu });   // bu model videoyu donusturmez
  assert.equal(r.durum, 400); assert.match(r.json.hata, /dönüştürmez/);
  assert.equal(fs.readFileSync(path.join(ortam.uretim, "film1", "studyo.json"), "utf8"), oncekiDosya);
  r = await c.post("/api/studyo/kaydet", { ad: "film1", model: "minimax-h3", cozunurluk: "2k", sahneler: videolu });
  assert.equal(r.durum, 200, r.metin);
  const d2 = (await c.get("/api/studyo/detay?ad=film1")).json;
  assert.equal(d2.kredi, (4 + 6) * 26);
  assert.equal(d2.uretilecek, 2);
  assert.equal((await c.post("/api/studyo/kaydet", { ad: "film1", sahneler: [{ mod: "metin", hareket: "" }] })).durum, 400);     // bos istem
  assert.equal((await c.post("/api/studyo/kaydet", { ad: "film1", sahneler: [{ mod: "uydurma", hareket: "x" }] })).durum, 400);
});

test("kuru calisma: onaysiz uret hicbir sey baslatmaz, maliyeti yazar; butcesiz istek reddedilir", async () => {
  assert.equal((await c.post("/api/studyo/uret", { ad: "film1" })).durum, 400);               // butce yok
  const r = await c.post("/api/studyo/uret", { ad: "film1", butce: 500 });                    // onay yok => kuru
  assert.equal(r.durum, 200, r.metin);
  assert.equal(r.json.tur, "kuru");
  const son = await bekleBitsin("film1");
  assert.equal(son.is.kod, 0);
  const metin = son.is.satirlar.join("\n");
  assert.match(metin, /KURU ÇALIŞMA: kredi harcanmadı/);
  assert.match(metin, /tahmini en çok 260 kredi/);
  assert.ok(!fs.existsSync(path.join(ortam.uretim, "film1", "Clips", "klipler.json")));        // hicbir is kaydedilmedi
});

test("onayli uret VIDIQ_KEY yoksa acik hatayla biter (kredi harcanmaz)", async () => {
  const r = await c.post("/api/studyo/uret", { ad: "film1", butce: 500, onay: true });
  assert.equal(r.durum, 200);
  const son = await bekleBitsin("film1");
  assert.notEqual(son.is.kod, 0);
  assert.match(son.is.satirlar.join("\n"), /VIDIQ_KEY tanımlı değil/);
});

test("kur: klip yokken acik hata", async () => {
  await c.post("/api/studyo/kur", { ad: "film1" });
  const son = await bekleBitsin("film1");
  assert.notEqual(son.is.kod, 0);
  assert.match(son.is.satirlar.join("\n"), /Hiç klip yok/);
});

test("medya: foto cerezle gelir, cerezsiz 403, yol kacisi ve uzanti reddedilir", async () => {
  let r = await c.get("/studyo/film1/girdi/Kedi-Foto.jpg", { cerezli: true });
  assert.equal(r.durum, 200);
  assert.equal(r.baslik["content-type"], "image/jpeg");
  assert.equal((await c.get("/studyo/film1/girdi/Kedi-Foto.jpg", { cerezli: false, jetonsuz: true })).durum, 403);
  assert.equal((await c.get("/studyo/film1/girdi/..%2F..%2Fstudyo.json", { cerezli: true })).durum, 400);
  assert.equal((await c.get("/studyo/film1/girdi/not.txt", { cerezli: true })).durum, 400);
  assert.equal((await c.get("/studyo/film1/gizli/Kedi-Foto.jpg", { cerezli: true })).durum, 400);
  assert.equal((await c.get("/studyo/yok-boyle/girdi/a.jpg", { cerezli: true })).durum, 404);
});

test("anlatim ve dil kaydedilir; 600 karakteri asan anlatim kesilir, gecersiz dil reddedilir", async () => {
  let r = await c.post("/api/studyo/kaydet", { ad: "film1", model: "minimax-h3", cozunurluk: "768p", dil: "tr",
    sahneler: [{ mod: "metin", hareket: "a cat on a beach", sure: 4, anlatim: "Bir kedi plajda.".padEnd(700, "x") }] });
  assert.equal(r.durum, 200, r.metin);
  const d = (await c.get("/api/studyo/detay?ad=film1")).json;
  assert.equal(d.ayar.dil, "tr");
  assert.equal(d.sahneler[0].anlatim.length, 600);
  r = await c.post("/api/studyo/kaydet", { ad: "film1", dil: "turkce" });
  assert.equal(r.durum, 400);
  assert.equal((await c.get("/api/studyo/detay?ad=film1")).json.ayar.dil, "tr");           // gecersiz kayit eskiyi bozmadi
});

test("yonetmen modu: detay etiketleri verir, sablon sahne ekler, plan/lens/isik kaydedilir, gecersiz kod reddedilir", async () => {
  const d0 = (await c.get("/api/studyo/detay?ad=film1")).json;
  assert.equal(d0.yonetmen.plan.genis, "Geniş plan");
  assert.ok(d0.sablonlar.romantik && d0.kameralar.sinema);
  let r = await c.post("/api/studyo/kaydet", { ad: "film1", sahneler: [{ mod: "metin", hareket: "a kiss", sure: 4, plan: "yakin", kameraHareketi: "yaklas", lens: "85", isik: "mum" }] });
  assert.equal(r.durum, 200, r.metin);
  const d = (await c.get("/api/studyo/detay?ad=film1")).json;
  assert.deepEqual([d.sahneler[0].plan, d.sahneler[0].lens, d.sahneler[0].isik], ["yakin", "85", "mum"]);
  assert.equal((await c.post("/api/studyo/kaydet", { ad: "film1", sahneler: [{ mod: "metin", hareket: "x", plan: "uydurma" }] })).durum, 400);
  r = await c.post("/api/studyo/sablon", { ad: "film1", sablon: "romantik" });
  assert.equal(r.durum, 200, r.metin); assert.equal(r.json.eklenen, 6);
  assert.equal((await c.get("/api/studyo/detay?ad=film1")).json.sahneler.length, 7);
  assert.equal((await c.post("/api/studyo/sablon", { ad: "film1", sablon: "komedi" })).durum, 400);
});

test("yuz degistirme: kisi/poz yuklemesi sahne olmaz (girdi/yuz), riza yoksa 400, FaceFusion yoksa acik hata", async () => {
  await c.post("/api/studyo/yeni", { ad: "film2", stil: "serbest" });
  let r = await c.post("/api/studyo/yukle", { ad: "film2", dosya: "Poz.jpg", veri: JPEG, rol: "sablon" });
  assert.equal(r.durum, 200, r.metin);
  r = await c.post("/api/studyo/yukle", { ad: "film2", dosya: "Sol.jpg", veri: JPEG, rol: "kisi" });
  assert.equal(r.durum, 200, r.metin);
  assert.ok(fs.existsSync(path.join(ortam.uretim, "film2", "girdi", "yuz", "Poz.jpg")));
  assert.equal((await c.get("/api/studyo/detay?ad=film2")).json.sahneler.length, 0);       // sahne eklenmedi
  assert.equal((await c.post("/api/studyo/yuz", { ad: "film2", sablon: "Poz.jpg", kisiler: ["Sol.jpg"] })).durum, 400);   // riza yok
  assert.equal((await c.post("/api/studyo/yuz", { ad: "film2", sablon: "Poz.jpg", kisiler: [], riza: true })).durum, 400);
  const d = (await c.get("/api/studyo/detay?ad=film2")).json;
  assert.equal(d.yuz.hazir, false);                                                             // test ortaminda FACEFUSION_KOK yok
  r = await c.post("/api/studyo/yuz", { ad: "film2", sablon: "Poz.jpg", kisiler: ["Sol.jpg"], riza: true });
  assert.equal(r.durum, 200, r.metin);
  const son = await bekleBitsin("film2");
  assert.notEqual(son.is.kod, 0);
  assert.match(son.is.satirlar.join("\n"), /FACEFUSION_KOK tanımlı değil/);
});

test("kadro: tur paketi erkek/kadin/cift fotograflariyla kurulur; eksik rol digerini kullanir", async () => {
  assert.equal((await c.post("/api/studyo/yeni", { ad: "kadro1", stil: "gercekci" })).durum, 200);
  const yukle = async (dosya) => (await c.post("/api/studyo/yukle", { ad: "kadro1", dosya, veri: JPEG })).json.dosya;
  const e = await yukle("erkek.jpg"), k = await yukle("kadin.jpg"), cf = await yukle("cift.jpg");
  const r = await c.post("/api/studyo/sablon", { ad: "kadro1", sablon: "yesilcam", kadro: { erkek: e, kadin: k, cift: cf } });
  assert.equal(r.durum, 200, r.metin);
  let s = (await c.get("/api/studyo/detay?ad=kadro1")).json.sahneler.slice(-8);
  assert.deepEqual(s.map(x => x.kaynak), [e, e, k, cf, cf, k, cf, cf]);
  assert.equal(s[0].gecis, "cozul");
  // yalniz kadin secilince erkek sahneleri de onu kullanir, cift yoksa ikisi sirayla
  assert.equal((await c.post("/api/studyo/yeni", { ad: "kadro2", stil: "gercekci" })).durum, 200);
  const k2 = (await c.post("/api/studyo/yukle", { ad: "kadro2", dosya: "tek.jpg", veri: JPEG })).json.dosya;
  assert.equal((await c.post("/api/studyo/sablon", { ad: "kadro2", sablon: "bilimkurgu", kadro: { kadin: k2 } })).durum, 200);
  s = (await c.get("/api/studyo/detay?ad=kadro2")).json.sahneler.slice(-8);
  assert.ok(s.every(x => x.kaynak === k2));
  assert.equal((await c.post("/api/studyo/sablon", { ad: "kadro2", sablon: "yok-paket", kadro: { kadin: k2 } })).durum, 400);
});

test("3B model (.glb) yukleme: gercek imza zorunlu, sahne olmaz, urun sahnesine baglanip kaydedilir", async () => {
  assert.equal((await c.post("/api/studyo/yeni", { ad: "glbpanel", stil: "serbest" })).durum, 200);
  const GLB = Buffer.concat([Buffer.from("glTF"), Buffer.alloc(60, 2)]).toString("base64");
  const yukle = (govde) => c.post("/api/studyo/yukle", Object.assign({ ad: "glbpanel", rol: "model" }, govde));
  assert.equal((await yukle({ dosya: "urun.glb", veri: JPEG })).durum, 400);             // imza yok
  assert.equal((await yukle({ dosya: "urun.exe", veri: GLB })).durum, 400);              // uzanti
  const r = await yukle({ dosya: "Urun Model.glb", veri: GLB });
  assert.equal(r.durum, 200, r.metin);
  assert.equal(r.json.dosya, "Urun-Model.glb");
  assert.equal((await c.get("/api/studyo/detay?ad=glbpanel")).json.sahneler.length, 0);   // model sahne olmaz
  assert.equal((await c.post("/api/studyo/sahne3d", { ad: "glbpanel", sablon: "urun", baslik: "Model" })).durum, 200);
  const k = await c.post("/api/studyo/kaydet", { ad: "glbpanel", sahneler: [{ mod: "3b", sablon3d: "urun", parametre: { baslik: "Model", glb: "Urun-Model.glb" }, sure: 4 }] });
  assert.equal(k.durum, 200, k.metin);
  assert.equal((await c.get("/api/studyo/detay?ad=glbpanel")).json.sahneler[0].parametre.glb, "Urun-Model.glb");
  assert.equal((await c.post("/api/studyo/kaydet", { ad: "glbpanel", sahneler: [{ mod: "3b", sablon3d: "urun", parametre: { glb: "../x.glb" }, sure: 4 }] })).durum, 400);
});

test("gecis onizlemesi: ilk istekte uretilir, sonra onbellekten; cerezsiz 403, gecersiz kod 404/400", { skip: !(() => { try { return require("child_process").spawnSync(require("../ff-yol.js").ffmpeg, ["-version"]).status === 0; } catch { return false; } })() }, async () => {
  const r = await c.get("/studyo/_gecis/cozul.mp4", { cerezli: true });
  assert.equal(r.durum, 200, r.metin);
  assert.equal(r.baslik["content-type"], "video/mp4");
  assert.ok(fs.existsSync(path.join(ortam.uretim, "_gecis", "cozul.mp4")));
  const t = fs.statSync(path.join(ortam.uretim, "_gecis", "cozul.mp4")).mtimeMs;
  assert.equal((await c.get("/studyo/_gecis/cozul.mp4", { cerezli: true })).durum, 200);
  assert.equal(fs.statSync(path.join(ortam.uretim, "_gecis", "cozul.mp4")).mtimeMs, t);   // onbellek: yeniden uretilmedi
  assert.equal((await c.get("/studyo/_gecis/cozul.mp4", { cerezli: false, jetonsuz: true })).durum, 403);
  assert.equal((await c.get("/studyo/_gecis/kes.mp4", { cerezli: true })).durum, 404);
  assert.equal((await c.get("/studyo/_gecis/yok.mp4", { cerezli: true })).durum, 404);
  assert.equal((await c.get("/studyo/_gecis/..%2Fx.mp4", { cerezli: true })).durum, 400);
  assert.ok(!fs.readdirSync(path.join(ortam.uretim, "_gecis")).some(f => f.startsWith(".")), "gecici dosya kalmadi");
});
