// Panel veri uclari (gercek surec): konu.json dogrulama/yedek, gorunum, yeni is, ayarlar, anahtarlar, liste/detay/sahne,
// medya (Range/indirme), disk/arsiv, raporlar, yayin, VS tanimi, ses testi.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const Y = require("./panel-yardim");

const kok = (o, ...p) => path.join(o.uretim, ...p);
const yaz = (p, i) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof i === "string" || Buffer.isBuffer(i) ? i : JSON.stringify(i)); };
const ffmpegVar = (() => { try { return spawnSync("ffmpeg", ["-version"], { timeout: 8000 }).status === 0; } catch (e) { return false; } })();

let ortam, panel, c;
test.before(async () => {
  ortam = Y.geciciOrtam("uclar");
  panel = await Y.panelBaslat(ortam);
  c = panel.istemci;
});
test.after(async () => { if (panel) await panel.kapat(); if (ortam) ortam.temizle(); });

async function yeniIs(ek) { const r = await c.post("/api/yeni", Object.assign({ baslik: "Veri testi" }, ek || {})); assert.equal(r.durum, 200, r.metin); return r.json.ad; }

test("/api/ozellikler: surum, platform, anahtar durumu, indirici (muzik alani yok)", async () => {
  const r = (await c.get("/api/ozellikler")).json;
  assert.equal(r.surum, 1); assert.equal(r.platform, process.platform);
  assert.equal(typeof r.claude, "boolean"); assert.equal(typeof r.vidiq, "boolean");
  assert.deepEqual(Object.keys(r.indirici).sort(), ["calisiyor", "port", "var"]);
  assert.equal("muzik" in r, false);
  const b = await c.post("/api/indirici/baslat");
  assert.equal(b.durum, 500, "testte baslatma kapali; panel kendi kendine indirici BASLATMAZ");
});

test("/api/yeni: alanlar konu.json'a yazilir ve gecerlidir; hatali girdide 400 + klasor yok", async () => {
  const r = await c.post("/api/yeni", { baslik: "Roma Neden Çöktü?", nis: "Kısa not", format: "short", sureDk: 0.75, dil: "tr", altyaziDili: "en", tur: "haber-spor", ton: "ciddi",
    kaynakMetin: "Kaynak 1: ...", kisiselKatki: "Ben şunu düşünüyorum", kanal: "Tarih Kanalı", slogan: "Her gün bir hikâye", acilisStili: "sinematik", onay: { senaryo: false, gorsel: true } });
  assert.equal(r.durum, 200);
  assert.equal(r.json.ad, "roma-neden-coktu");
  const k = JSON.parse(fs.readFileSync(kok(ortam, r.json.ad, "konu.json"), "utf8"));
  assert.deepEqual([k.baslik_en, k.format, k.aspect, k.hedefSaniye, k.dil, k.ses, k.altyaziDili, k.tur, k.ton, k.arastirma, k.kisiselKatki, k.kanal, k.slogan, k._not],
    ["Roma Neden Çöktü?", "short", "9:16", 45, "tr", "tr-TR-AhmetNeural", "en", "haber-spor", "ciddi", "Kaynak 1: ...", "Ben şunu düşünüyorum", "Tarih Kanalı", "Her gün bir hikâye", "Kısa not"]);
  assert.deepEqual(k.onay, { senaryo: false, gorsel: true });
  assert.equal((await c.get("/api/dosya?is=" + r.json.ad + "&tur=konu")).json.icerik.includes("Roma Neden"), true);
  const sayi = fs.readdirSync(ortam.uretim).length;
  for (const kotu of [{ baslik: "" }, { baslik: "x", format: "mp4" }, { baslik: "x", sureDk: 999 }, { baslik: "x", dil: "turkce" }])
    assert.equal((await c.post("/api/yeni", kotu)).durum, 400);
  assert.equal(fs.readdirSync(ortam.uretim).length, sayi);
  const a = await c.post("/api/yeni", { baslik: "x", ad: "ozel-ad" }); const b = await c.post("/api/yeni", { baslik: "x", ad: "ozel-ad" });
  assert.equal(a.durum, 200); assert.equal(b.durum, 409); assert.equal(b.json.kod, "is_var");
  assert.equal((await c.post("/api/yeni", { baslik: "Roma Neden Çöktü?" })).json.ad, "roma-neden-coktu-2");
});

test("/api/dosya: konu bozuk JSON 400 satir/sutun ve dosya degismez; gecerli yazilir + .bak; okuma-yazma turleri", async () => {
  const ad = await yeniIs();
  const once = fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8");
  let r = await c.post("/api/dosya?is=" + ad + "&tur=konu", { icerik: '{\n  "baslik_en": "x",\n}' });
  assert.equal(r.durum, 400); assert.equal(r.json.kod, "konu_bozuk"); assert.equal(r.json.satir, 3); assert.equal(typeof r.json.sutun, "number"); assert.match(r.json.hata, /satır 3/);
  r = await c.post("/api/dosya?is=" + ad + "&tur=konu", { icerik: '{"baslik_en":"x","hedefSaniye":5,"gecis":"yok-gecis"}' });
  assert.equal(r.durum, 400); assert.equal(r.json.kod, "konu_gecersiz"); assert.ok(r.json.alanlar.some(a => a.alan === "hedefSaniye") && r.json.alanlar.some(a => a.alan === "gecis"));
  assert.equal(fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8"), once, "hatali kayit dosyayi bozmamali");
  r = await c.post("/api/dosya?is=" + ad + "&tur=konu", { icerik: JSON.stringify({ baslik_en: "Yeni baslik", ozel: 1 }) });
  assert.equal(r.durum, 200); assert.equal(r.json.ok, true);
  assert.equal(JSON.parse(fs.readFileSync(kok(ortam, ad, "konu.json.bak"), "utf8")).baslik_en, "Veri testi");
  for (const tur of ["iddia", "baslik", "atif", "yayin", "bolumler", "srt", "renderSonuc"]) {
    assert.equal((await c.post("/api/dosya?is=" + ad + "&tur=" + tur, { icerik: "x" })).json.kod, "yalniz_okuma", tur);
    assert.equal((await c.get("/api/dosya?is=" + ad + "&tur=" + tur)).durum, 200, tur);
  }
  yaz(kok(ortam, ad, "ATIF.txt"), "Görsel kaynakları / Image credits:\n\"Foto\" — Yazar — CC BY 4.0 — https://x");
  yaz(kok(ortam, ad, "baslik.json"), { surum: 1, mevcut: { baslik: "x", puan: 70 } }); yaz(kok(ortam, ad, "BASLIK-VE-ETIKETLER.md"), "# Başlıklar");
  assert.match((await c.get("/api/dosya?is=" + ad + "&tur=atif")).json.icerik, /Image credits/);
  const b = (await c.get("/api/dosya?is=" + ad + "&tur=baslik")).json;
  assert.equal(b.icerik, "# Başlıklar"); assert.equal(b.json.mevcut.puan, 70);
  assert.equal((await c.get("/api/dosya?is=" + ad + "&tur=yok-tur")).durum, 400);
  assert.equal((await c.post("/api/dosya?is=" + ad + "&tur=senaryo", { icerik: 5 })).durum, 400);
  r = await c.post("/api/dosya?is=" + ad + "&tur=senaryo", { icerik: "x".repeat(2 * 1024 * 1024 + 10) });
  assert.equal(r.durum, 413);
  r = await c.post("/api/dosya?is=" + ad + "&tur=kaynakmetin", { icerik: "Araştırma metni" });
  assert.equal(r.durum, 200); assert.equal((await c.get("/api/dosya?is=" + ad + "&tur=kaynakmetin")).json.icerik, "Araştırma metni");
  assert.equal(JSON.parse(fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8")).arastirma, "Araştırma metni");
});

test("bozuk konu.json: /api/gorunum 409 (uzerine yazmaz), is listesinde konuBozuk, is-detay konuHata; kaynakmetin 409", async () => {
  const ad = await yeniIs();
  fs.writeFileSync(kok(ortam, ad, "konu.json"), '{"baslik_en": "x",\n "gecis": }');
  let r = await c.post("/api/gorunum", { is: ad, gecis: "fade", kanal: "Yeni" });
  assert.equal(r.durum, 409); assert.equal(r.json.kod, "konu_bozuk"); assert.equal(r.json.satir, 2);
  assert.equal(fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8"), '{"baslik_en": "x",\n "gecis": }', "bozuk dosya ayni kalmali (kurtarilabilir)");
  const l = (await c.get("/api/isler")).json.isler.find(x => x.ad === ad);
  assert.equal(l.konuBozuk, true); assert.equal(l.konuVar, false); assert.equal(l.konuHata.satir, 2);
  const d = (await c.get("/api/is-detay?is=" + ad)).json;
  assert.equal(d.konuHata.satir, 2); assert.ok(d.uyarilar.some(u => u.kod === "konu_bozuk")); assert.equal(d.konu, null);
  assert.equal((await c.post("/api/dosya?is=" + ad + "&tur=kaynakmetin", { icerik: "x" })).durum, 409);
  assert.equal((await c.post("/api/baslik-sec", { is: ad, baslik: "x" })).durum, 409);
  assert.equal((await c.post("/api/calistir", { tur: "hepsi", is: ad })).durum, 409, "bozuk konu ile zincir baslamaz");
  // Ham ayar kutusundan duzeltince yeniden calisir
  r = await c.post("/api/dosya?is=" + ad + "&tur=konu", { icerik: '{"baslik_en":"duzeldi"}' });
  assert.equal(r.durum, 200);
  assert.equal((await c.get("/api/isler")).json.isler.find(x => x.ad === ad).konuBozuk, false);
});

test("/api/gorunum: dogrulanir, tur cevrilir, yedek alinir; gecersiz deger dosyayi degistirmez; baslik-sec", async () => {
  const ad = await yeniIs();
  let r = await c.post("/api/gorunum", { is: ad, gecis: "wipeleft", gecisSure: "1.5", efekt: "zoom", renk: "sicak", muzikSeviyesi: 0.3, muzikRuhu: "sakin", muzikDucking: false,
    intro: 4, outro: 6, konuKarti: 2, geriSayim: 5, markaKose: 2, kanal: "Test Kanal", slogan: "Slogan", altyazi: true, altyaziStil: "kelime", vurguRenk: "FF8800",
    outroMetni: { baslik: "ABONE OL", alt: "ZİLİ AÇ" }, bilinmeyenAlan: 1 });
  assert.equal(r.durum, 200); assert.deepEqual(r.json.yoksayilan, ["bilinmeyenAlan"]);
  const k = JSON.parse(fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8"));
  assert.deepEqual([k.gecis, k.gecisSure, k.muzikDucking, k.geriSayim, k.markaKose, k.kanal, k.altyaziStil, k.vurguRenk], ["wipeleft", 1.5, false, 5, 2, "Test Kanal", "kelime", "FF8800"]);
  assert.deepEqual(k.outroMetni, { baslik: "ABONE OL", alt: "ZİLİ AÇ" });
  assert.ok(fs.existsSync(kok(ortam, ad, "konu.json.bak")));
  const once = fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8");
  for (const kotu of [{ gecis: "yok" }, { gecisSure: 99 }, { geriSayim: 3 }, { muzikSeviyesi: 5 }, { vurguRenk: "kirmizi" }, { efekt: "ucan" }, { outroMetni: "x" }]) {
    const rr = await c.post("/api/gorunum", Object.assign({ is: ad }, kotu));
    assert.equal(rr.durum, 400, JSON.stringify(kotu));
  }
  assert.equal(fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8"), once);
  assert.equal((await c.post("/api/gorunum", { is: "olmayan" })).durum, 404);
  r = await c.post("/api/baslik-sec", { is: ad, baslik: "Secilen Baslik" });
  assert.equal(r.durum, 200); assert.equal(JSON.parse(fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8")).baslik_en, "Secilen Baslik");
  assert.equal((await c.post("/api/baslik-sec", { is: ad, baslik: "" })).durum, 400);
});

test("/api/ayarlar: birlestirir, dogrular, bilinmeyen anahtari reddeder; bozuk dosyada varsayilan", async () => {
  let r = await c.get("/api/ayarlar");
  assert.equal(r.json.kanal, "KANALIM"); assert.equal(r.json.diskEsikGB, 5); assert.equal(r.json.surum, 1);
  r = await c.post("/api/ayarlar", { kanal: "Benim Kanalim", dil: "tr", outroMetni: { baslik: "ABONE OL" }, onay: { gorsel: true } });
  assert.equal(r.durum, 200);
  r = (await c.get("/api/ayarlar")).json;
  assert.equal(r.kanal, "Benim Kanalim"); assert.equal(r.dil, "tr"); assert.deepEqual(r.onay, { senaryo: true, gorsel: true }); assert.equal(r.outroMetni.baslik, "ABONE OL"); assert.equal(r.claudeModel, "claude-opus-5");
  const hata = await c.post("/api/ayarlar", { kanal: "x", bilinmeyen: 1, dil: "turkce" });
  assert.equal(hata.durum, 400); assert.equal(hata.json.kod, "ayar_gecersiz"); assert.ok(hata.json.alanlar.some(a => a.alan === "bilinmeyen"));
  assert.equal((await c.get("/api/ayarlar")).json.kanal, "Benim Kanalim", "reddedilen istek ayari degistirmemeli");
  assert.equal((await c.post("/api/ayarlar", { maliyet: { gunlukUSD: -1 } })).durum, 400);
  // yeni is bu profili kullanir
  const ad = await yeniIs({ baslik: "Profil testi" });
  const kk = JSON.parse(fs.readFileSync(kok(ortam, ad, "konu.json"), "utf8"));
  assert.equal(kk.dil, "tr"); assert.equal(kk.ses, "tr-TR-AhmetNeural", "ayarda dil tr ama ses hala Ingilizce: dilin varsayilan sesi secilir");
  const e = (await c.get("/api/is-detay?is=" + ad)).json;
  assert.ok(!e.uyarilar.some(u => u.kod === "kanal_varsayilan"), "kanal artik varsayilan degil");
  fs.writeFileSync(ortam.ayar, "{bozuk");
  assert.equal((await c.get("/api/ayarlar")).json.kanal, "KANALIM");
  assert.equal((await c.post("/api/ayarlar", { kanal: "Yeniden" })).durum, 200, "bozuk dosya yeni kayitla duzelir");
  assert.equal((await c.get("/api/ayarlar")).json.kanal, "Yeniden");
  // bozuk dosyanin kopyasi kalir (kullanici icerigini elle kurtarabilsin); gecerli dosya icin kopya ALINMAZ
  const yedekler = () => fs.readdirSync(path.dirname(ortam.ayar)).filter(x => x.startsWith(path.basename(ortam.ayar) + ".bozuk-"));
  assert.equal(yedekler().length, 1, "bozuk ayar dosyasi .bozuk-<damga> olarak saklandi");
  assert.equal(fs.readFileSync(path.join(path.dirname(ortam.ayar), yedekler()[0]), "utf8"), "{bozuk");
  assert.equal((await c.post("/api/ayarlar", { kanal: "Bir daha" })).durum, 200);
  assert.equal(yedekler().length, 1, "gecerli dosyanin ustune yazarken yedek alinmaz");
});

test("/api/anahtarlar: maskeli GET, yorumlari koruyan POST, sil, izinsiz ad 400, eski duz bicim", async () => {
  fs.writeFileSync(ortam.env, "# not\nBILINMEYEN_KEY=eski-bos\n");
  let r = await c.post("/api/anahtarlar", { ayarla: { PEXELS_KEY: "pexels-secret-9876", ANTHROPIC_MODEL: "claude-opus-5", AZURE_SPEECH_REGION: "westeurope", AZURE_SPEECH_KEY: "azure-secret-5555" } });
  assert.equal(r.durum, 200); assert.deepEqual(r.json.test, {});
  const g = (await c.get("/api/anahtarlar")).json;
  assert.equal(g.PEXELS_KEY, "••••••9876"); assert.equal(g.AZURE_SPEECH_KEY, "••••••5555");
  assert.equal(g.ANTHROPIC_MODEL, "claude-opus-5"); assert.equal(g.AZURE_SPEECH_REGION, "westeurope");
  assert.equal(g.VIDIQ_KEY, ""); assert.equal("BILINMEYEN_KEY" in g, false);
  assert.ok(!JSON.stringify(g).includes("pexels-secret"));
  const env = fs.readFileSync(ortam.env, "utf8");
  assert.match(env, /^# not\nBILINMEYEN_KEY=eski-bos\n/); assert.match(env, /PEXELS_KEY=pexels-secret-9876/);
  r = await c.post("/api/anahtarlar", { sil: ["PEXELS_KEY"] });
  assert.equal(r.durum, 200); assert.equal((await c.get("/api/anahtarlar")).json.PEXELS_KEY, ""); assert.ok(!fs.readFileSync(ortam.env, "utf8").includes("PEXELS_KEY"));
  r = await c.post("/api/anahtarlar", { PIXABAY_KEY: "eski-duz-bicim-1111" });
  assert.equal(r.durum, 200); assert.equal((await c.get("/api/anahtarlar")).json.PIXABAY_KEY, "••••••1111");
  assert.equal((await c.post("/api/anahtarlar", { ayarla: { BILINMEYEN_KEY: "x" } })).json.kod, "anahtar_adi");
  assert.equal((await c.post("/api/anahtarlar", { ayarla: { PATH: "x" } })).durum, 400);
  assert.equal((await c.post("/api/anahtarlar", { ayarla: { PEXELS_KEY: "a\nVIDIQ_KEY=sizdir" } })).durum, 400);
  assert.ok(!/VIDIQ_KEY=sizdir/.test(fs.readFileSync(ortam.env, "utf8")), "satir enjeksiyonu engellenmeli");
  assert.equal((await c.post("/api/anahtarlar", { ayarla: { PEXELS_KEY: "  " } })).durum, 200, "bos deger: dokunma");
  assert.equal((await c.get("/api/anahtar-test?anahtar=hepsi")).json.claude.ok, false, "ag testi testte kapali");
  assert.equal((await c.get("/api/anahtar-test?anahtar=BILINMEYEN_KEY")).durum, 400);
});

test("is listesi/detay/sahneler/gorseller: ses durumu, uyarilar, manifest eslemesi, sayisal siralama (100+ sahne)", async () => {
  await c.post("/api/ayarlar", { kanal: "KANALIM", dil: "en" });          // onceki testin kanal profilini sifirla
  const ad = await yeniIs({ baslik: "Liste testi", dil: "en" });
  const par =["Birinci paragraf.", "Ikinci paragraf.", "Ucuncu paragraf."];
  const ortakLib = require("../lib/ortak");
  yaz(kok(ortam, ad, "Voice", "SESLENDIRME-TAM-METIN.txt"), par.join("\n\n") + "\n" + "x".repeat(60));
  const metin = fs.readFileSync(kok(ortam, ad, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8");
  const kanon = ortakLib.paragraflaraBol(metin);
  for (let i = 0; i < kanon.length; i++) yaz(kok(ortam, ad, "Voice", "parts", String(i).padStart(3, "0") + ".mp3"), "m");
  yaz(kok(ortam, ad, "Voice", "zamanlama.json"), { surum: 1, metinOzeti: ortakLib.paragrafOzeti(kanon), toplamSn: 90, hedefSn: 900, sapmaYuzde: -90, paragrafSayisi: kanon.length,
    paragraflar: kanon.map((p, i) => ({ no: i, dosya: "parts/" + String(i).padStart(3, "0") + ".mp3", sureSn: 10, baslangicSn: i * 10.35 })) });
  // 105 sahne: 3 haneli numaralar sayisal siralanmali; her sahnede gorsel
  const sahneler = [];
  for (let i = 1; i <= 105; i++) {
    const klasor = String(i).padStart(3, "0") + "-k" + i;
    yaz(kok(ortam, ad, "Visuals", klasor, "01.jpg"), "j");
    sahneler.push({ no: i, klasor, paragraflar: i <= 3 ? [i - 1] : [], aramalar: ["a" + i], durum: "tamam", gorseller: [{ dosya: klasor + "/01.jpg", kaynak: "pexels", lisans: "Pexels", atif: "Foto Grafci", en: 1920, boy: 1080 }] });
  }
  yaz(kok(ortam, ad, "Visuals", "manifest.json"), { surum: 1, kaynakSenaryoSha1: "eskisha", sahneler, toplamGorsel: 105 });
  const l = (await c.get("/api/isler")).json.isler.find(x => x.ad === ad);
  assert.equal(l.sesTamam, true); assert.equal(l.sesBeklenen, 3); assert.equal(l.sesParca, 3); assert.equal(l.sahne, 105); assert.equal(l.gorsel, 105);
  assert.equal(l.dakika, 1.5, "dakika zamanlama.toplamSn'den"); assert.equal(l.tip, "video"); assert.equal(l.kapak, false); assert.equal(l.video, null);
  const d = (await c.get("/api/is-detay?is=" + ad)).json;
  const kodlar = d.uyarilar.map(u => u.kod);
  assert.ok(kodlar.includes("gorsel_eski"), kodlar.join()); assert.ok(kodlar.includes("hedef_sapma")); assert.ok(kodlar.includes("kanal_varsayilan")); assert.ok(!kodlar.includes("ses_eski"));
  assert.equal(d.dosyalar.zamanlama, true); assert.equal(d.dosyalar.manifest, true); assert.equal(d.dosyalar.senaryo, true);
  fs.appendFileSync(kok(ortam, ad, "Voice", "SESLENDIRME-TAM-METIN.txt"), "\n\nDorduncu paragraf eklendi.\n");
  const d2 = (await c.get("/api/is-detay?is=" + ad)).json;
  assert.ok(d2.uyarilar.some(u => u.kod === "ses_eski"), "senaryo degisince ses_eski uyarisi");
  assert.equal((await c.get("/api/isler")).json.isler.find(x => x.ad === ad).sesTamam, false);
  const s = (await c.get("/api/sahneler?is=" + ad)).json.sahneler;
  assert.equal(s.length, 105);
  assert.deepEqual(s.map(x => x.no), Array.from({ length: 105 }, (_, i) => i + 1), "sayisal sira");
  assert.deepEqual(s[0].paragraflar, [0]); assert.equal(s[0].metin, "Birinci paragraf."); assert.equal(s[0].sureSn, 10); assert.deepEqual(s[0].aramalar, ["a1"]);
  assert.deepEqual(s[0].gorseller, [{ ad: "01.jpg", kaynak: "pexels", lisans: "Pexels", atif: "Foto Grafci" }]);
  const g = (await c.get("/api/gorseller?is=" + ad)).json.gorseller;
  assert.equal(g.length, 105); assert.equal(g[0].sahne, "001-k1"); assert.equal(g[104].sahne, "105-k105"); assert.deepEqual([g[0].en, g[0].boy], [1920, 1080]);
  // diskte olmayan gorsel sahnede 'eksik'
  fs.unlinkSync(kok(ortam, ad, "Visuals", "002-k2", "01.jpg"));
  assert.equal((await c.get("/api/sahneler?is=" + ad)).json.sahneler[1].durum, "eksik");
  // gorsel sil (kosan is yok): manifestten cikar, silinenler.json
  const r = await c.post("/api/gorsel-sil", { is: ad, sahne: "003-k3", ad: "01.jpg" });
  assert.equal(r.durum, 200);
  assert.equal(JSON.parse(fs.readFileSync(kok(ortam, ad, "silinenler.json"), "utf8")).silinenler[0].sahne, "003-k3");
  assert.equal((await c.post("/api/gorsel-sil", { is: ad, sahne: "003-k3", ad: "01.jpg" })).durum, 404);
});

test("medya: /video Range (206/416), /indir (Content-Disposition), /onizle goruntu, /marka; cerezsiz 403", async () => {
  const ad = await yeniIs({ baslik: "Medya testi" });
  const icerik = Buffer.alloc(10000); for (let i = 0; i < icerik.length; i++) icerik[i] = i % 251;
  yaz(kok(ortam, ad, "Videos", ad + ".mp4"), icerik); yaz(kok(ortam, ad, "Videos", ad + ".srt"), "1\n00:00:00,000 --> 00:00:01,000\nMerhaba\n");
  yaz(kok(ortam, ad, "Videos", ad + "-kapak.jpg"), "JPGDATA"); yaz(kok(ortam, ad, "YAYIN-PAKETI.md"), "# Paket"); yaz(kok(ortam, ad, "Visuals", "001-a", "01.jpg"), "gorsel-baytlari");
  yaz(kok(ortam, "_marka", "profil.png"), "PNGDATA");
  let r = await c.get("/video/" + ad, { cerezli: true });
  assert.equal(r.durum, 200); assert.equal(r.baslik["content-type"], "video/mp4"); assert.equal(r.baslik["accept-ranges"], "bytes"); assert.equal(r.buf.length, 10000); assert.ok(r.buf.equals(icerik));
  r = await c.get("/video/" + ad, { cerezli: true, baslik: { Range: "bytes=100-199" } });
  assert.equal(r.durum, 206); assert.equal(r.baslik["content-range"], "bytes 100-199/10000"); assert.ok(r.buf.equals(icerik.subarray(100, 200)));
  r = await c.get("/video/" + ad, { cerezli: true, baslik: { Range: "bytes=9990-" } });
  assert.equal(r.durum, 206); assert.equal(r.buf.length, 10);
  r = await c.get("/video/" + ad, { cerezli: true, baslik: { Range: "bytes=-5" } });
  assert.equal(r.durum, 206); assert.ok(r.buf.equals(icerik.subarray(9995)));
  r = await c.get("/video/" + ad, { cerezli: true, baslik: { Range: "bytes=20000-30000" } });
  assert.equal(r.durum, 416); assert.equal(r.baslik["content-range"], "bytes */10000");
  assert.equal((await c.get("/video/" + ad, { cerezli: true, baslik: { Range: "bytes=abc" } })).durum, 416);
  assert.equal((await c.get("/video/" + ad)).durum, 403);
  r = await c.get("/indir/" + ad + "/video", { cerezli: true });
  assert.match(r.baslik["content-disposition"], /^attachment; filename="/); assert.match(r.baslik["content-disposition"], new RegExp(ad + "\\.mp4"));
  assert.match((await c.get("/indir/" + ad + "/srt", { cerezli: true })).metin, /Merhaba/);
  assert.equal((await c.get("/indir/" + ad + "/kapak", { cerezli: true })).metin, "JPGDATA");
  assert.equal((await c.get("/indir/" + ad + "/yayin", { cerezli: true })).metin, "# Paket");
  assert.equal((await c.get("/indir/" + ad + "/atif", { cerezli: true })).durum, 404, "olmayan dosya");
  assert.equal((await c.get("/indir/" + ad + "/baska", { cerezli: true })).durum, 400);
  r = await c.get("/onizle/" + ad + "/001-a/01.jpg", { cerezli: true });
  assert.equal(r.durum, 200); assert.equal(r.baslik["content-type"], "image/jpeg"); assert.equal(r.metin, "gorsel-baytlari");
  assert.equal((await c.get("/onizle/" + ad + "/001-a/02.jpg", { cerezli: true })).durum, 404);
  assert.equal((await c.get("/onizle/" + ad + "/001-a/01.txt", { cerezli: true })).durum, 400);
  assert.equal((await c.get("/marka/profil.png", { cerezli: true })).metin, "PNGDATA");
  assert.deepEqual((await c.get("/api/marka")).json.dosyalar.map(x => x.ad), ["profil.png"]);
  assert.equal((await c.get("/marka/yok.png", { cerezli: true })).durum, 404);
  assert.equal((await c.get("/marka/.env", { cerezli: true })).durum, 400);
  assert.equal((await c.get("/video/olmayan-is", { cerezli: true })).durum, 404);
});

test("/api/disk, /api/temizle, /api/is-arsivle (silme yok), /api/ac", async () => {
  const ad = await yeniIs({ baslik: "Disk testi" });
  yaz(kok(ortam, ad, "_tmp", "clip000.mp4"), Buffer.alloc(3 * 1024 * 1024)); yaz(kok(ortam, ad, "Videos", ad + ".mp4"), "v");
  const d = (await c.get("/api/disk")).json;
  assert.equal(typeof d.bosGB, "number"); assert.equal(typeof d.uretimGB, "number");
  const satir = d.isler.find(x => x.ad === ad);
  assert.ok(satir.mb >= 3 && satir.tmpMB >= 3, JSON.stringify(satir));
  assert.equal((await c.post("/api/temizle", { is: ad, tur: "disk" })).durum, 400);
  const t = await c.post("/api/temizle", { is: ad, tur: "ara" });
  assert.equal(t.durum, 200); assert.ok(t.json.serbestMB >= 3);
  assert.equal(fs.existsSync(kok(ortam, ad, "_tmp")), false); assert.equal(fs.existsSync(kok(ortam, ad, "Videos", ad + ".mp4")), true);
  assert.equal((await c.post("/api/ac", { is: ad, klasor: "video" })).json.ok, true);
  assert.equal((await c.post("/api/ac", { is: ad, klasor: "tmp" })).durum, 404, "tmp artik yok");
  assert.equal((await c.post("/api/ac", { is: ad, klasor: "../.." })).durum, 400);
  const a = await c.post("/api/is-arsivle", { is: ad });
  assert.equal(a.durum, 200); assert.match(a.json.arsiv, /^_arsiv\/disk-testi-\d{8}-\d{6}$/);
  assert.equal(fs.existsSync(kok(ortam, ad)), false); assert.ok(fs.existsSync(kok(ortam, a.json.arsiv, "Videos", ad + ".mp4")), "arsivlenen is silinmez, tasinir");
  assert.equal((await c.get("/api/isler")).json.isler.some(x => x.ad === ad), false, "_arsiv klasoru liste disi");
  assert.equal((await c.post("/api/is-arsivle", { is: ad })).durum, 404);
});

test("raporlar: trend/viral listesi ve okuma (md+json); gecersiz ad ve tur reddedilir", async () => {
  yaz(path.join(ortam.kok, "trend", "2026-10-05-yapay-zeka.md"), "# Trend raporu"); yaz(path.join(ortam.kok, "trend", "2026-10-05-yapay-zeka.json"), { surum: 1, tur: "trend", satirlar: [] });
  yaz(path.join(ortam.kok, "viral-analiz", "2026-10-04.md"), "# Viral");
  let r = await c.get("/api/raporlar?tur=trend");
  assert.ok(Array.isArray(r.json)); assert.equal(r.json[0].ad, "2026-10-05-yapay-zeka"); assert.ok(r.json[0].tarih && typeof r.json[0].mb === "number");
  assert.equal((await c.get("/api/raporlar?tur=viral")).json[0].ad, "2026-10-04");
  r = (await c.get("/api/rapor?tur=trend&ad=2026-10-05-yapay-zeka")).json;
  assert.equal(r.md, "# Trend raporu"); assert.equal(r.json.tur, "trend");
  assert.equal((await c.get("/api/rapor?tur=viral&ad=2026-10-04.md")).json.json, null);
  for (const ad of ["../x", "..%2f..%2fpanel", "a/b", "", ".env"]) assert.ok([400, 404].includes((await c.get("/api/rapor?tur=trend&ad=" + encodeURIComponent(ad))).durum), ad);
  assert.equal((await c.get("/api/raporlar?tur=baska")).durum, 400);
  assert.equal((await c.get("/api/rapor?tur=trend&ad=yok-rapor")).durum, 404);
  assert.deepEqual((await c.get("/api/raporlar?tur=trend")).json.map(x => x.ad), ["2026-10-05-yapay-zeka"], "yalniz .md dosyalari");
});

test("yayin-isaretle + performans + VS tanimi", async () => {
  const ad = await yeniIs({ baslik: "Yayin testi" });
  let r = await c.post("/api/yayin-isaretle", { is: ad, platform: "youtube", durum: "yuklendi", url: "https://youtu.be/dQw4w9WgXcQ" });
  assert.equal(r.durum, 200); assert.equal(r.json.yayin.platformlar.youtube.videoId, "dQw4w9WgXcQ");
  assert.equal(JSON.parse(fs.readFileSync(kok(ortam, ad, "yayin-durum.json"), "utf8")).platformlar.youtube.durum, "yuklendi");
  assert.equal((await c.post("/api/yayin-isaretle", { is: ad, platform: "x", durum: "hazir" })).durum, 400);
  for (const [is, izl] of [["p1", 100], ["p2", 900], ["p3", 50]]) { yaz(kok(ortam, is, "konu.json"), { baslik_en: is }); yaz(kok(ortam, is, "performans.json"), { surum: 1, izlenme: izl }); yaz(kok(ortam, is, "render-sonuc.json"), { surum: 1, sureSn: 30 }); }
  const p = (await c.get("/api/performans")).json;
  assert.equal(p.isler[0].is, "p2"); assert.equal(typeof p.oneri, "string");
  const vs = { baslik: "KUTUP AYISI vs BAL PORSUGU", ust: { ad: "KUTUP AYISI", renk: "3BE07A", ara: "polar bear" }, alt: { ad: "BAL PORSUGU", renk: "FFB020", ara: "honey badger", zorunlu: ["badger"] },
    olculer: [{ ad: "AGIRLIK", ustDeger: 450, ustMetin: "450 kg", altDeger: 12, altMetin: "12 kg", kazanan: "ust", not: "ortalama" }], kazanan: "ust", sonuc: "Biri kazanir." };
  r = await c.post("/api/vs-yeni", vs);
  assert.equal(r.durum, 200); assert.equal(r.json.ad, "kutup-ayisi-vs-bal-porsugu");
  const t = JSON.parse(fs.readFileSync(kok(ortam, r.json.ad, "vs-tanim.json"), "utf8"));
  assert.equal(t.surum, 1); assert.deepEqual(t.alt.zorunlu, ["badger"]); assert.equal(t.olculer[0].ustDeger, 450);
  assert.equal((await c.get("/api/isler")).json.isler.find(x => x.ad === r.json.ad).tip, "vs");
  assert.equal((await c.post("/api/vs-yeni", Object.assign({}, vs, { olculer: [] }))).json.kod, "vs_gecersiz");
});

test("/api/ses-testi: motor/ses dogrulama; betik basarisizsa 500 ses_testi; basariliysa gecici dosya jetonlu adresle servis edilir", async () => {
  assert.equal((await c.post("/api/ses-testi", { motor: "gtts" })).durum, 400);
  assert.equal((await c.post("/api/ses-testi", { motor: "edge", ses: "../x" })).durum, 400);
  assert.equal((await c.post("/api/ses-testi", { motor: "edge", dil: "turkce" })).durum, 400);
  let r = await c.post("/api/ses-testi", { motor: "edge" });          // sahte seslendir.js --test'i bilmez: cikti dosyasi olusmaz
  assert.equal(r.durum, 500); assert.equal(r.json.kod, "ses_testi");
  const yol = path.join(ortam.betik, "seslendir.js");
  const eski = fs.readFileSync(yol);
  fs.writeFileSync(yol, [
    "const fs=require('fs');const a=process.argv;const i=a.indexOf('--test');",
    "if(i<0){process.exit(0)}",
    "fs.writeFileSync(a[i+1],'MP3VERISI');",
    "console.log('@@SONUC '+JSON.stringify({dosya:a[i+1],sureSn:5.1,motor:a[a.indexOf('--motor')+1]}));",
  ].join("\n"));
  try {
    r = await c.post("/api/ses-testi", { motor: "azure", ses: "tr-TR-EmelNeural", dil: "tr" });
    assert.equal(r.durum, 200, r.metin); assert.equal(r.json.ok, true); assert.equal(r.json.motor, "azure"); assert.equal(r.json.sureSn, 5.1); assert.match(r.json.url, /^\/sestesti\/[0-9a-f]+$/);
    assert.equal((await c.get(r.json.url)).json.kod, "token", "cerezsiz erisim yok");
    const s = await c.get(r.json.url, { cerezli: true });
    assert.equal(s.durum, 200); assert.equal(s.metin, "MP3VERISI"); assert.equal(s.baslik["content-type"], "audio/mpeg");
  } finally {
    fs.writeFileSync(yol, eski);
    try { fs.rmSync(path.join(require("os").tmpdir(), "otomasyon-sestesti"), { recursive: true, force: true }); } catch (e) { /* gecici ornekler */ }
  }
});

test("toplu uretim: yarim kalan kosudan devam, konu.json/senaryo EZILMEZ, sayac yalniz dogrulanmis videoyu sayar, hata -> cikis kodu 1, tam gunluk dosyasi",
  { skip: !ffmpegVar && "ffmpeg yok" }, async () => {
  const toplu = require("../lib/panel-toplu");
  const o = Y.geciciOrtam("toplu");
  const mp4 = path.join(o.kok, "gercek.mp4");
  const ff = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=64x64:d=1:r=10", "-pix_fmt", "yuv420p", mp4], { timeout: 30000 });
  assert.equal(ff.status, 0, "sentetik video uretilemedi");
  fs.writeFileSync(path.join(o.betik, "video-yap.js"), fs.readFileSync(path.join(o.betik, "video-yap.js"), "utf8").replace(
    'yaz(path.join(B, "Videos", is + ".mp4"), Buffer.alloc(200000, 1));', 'fs.mkdirSync(path.join(B, "Videos"), { recursive: true }); fs.copyFileSync(process.env.SAHTE_MP4, path.join(B, "Videos", is + ".mp4"));'));
  const once = { u: process.env.OTOMASYON_URETIM, e: process.env.OTOMASYON_ENV_DOSYASI, a: process.env.OTOMASYON_AYAR_DOSYASI, m: process.env.SAHTE_MP4 };
  Object.assign(process.env, { OTOMASYON_URETIM: o.uretim, OTOMASYON_ENV_DOSYASI: o.env, OTOMASYON_AYAR_DOSYASI: o.ayar, SAHTE_MP4: mp4 });
  try {
    const man = { kanal: "TOPLU KANAL", varsayilan: { dil: "tr" }, isler: [
      { slug: "t1", baslik_en: "Bir", paragraflar: ["Birinci paragraf yeterince uzun bir cumledir.", "Ikinci paragraf de uzun."] },
      { slug: "t2", baslik_en: "Iki", paragraflar: ["Yeni senaryo metni kullanilmayacak, cunku dosya dolu."], kanal: "OGE KANAL", sesHizi: "+10%" },
      { slug: "t3", baslik_en: "Uc", paragraflar: ["Bu is hata verecek; ses adimi basarisiz olur."] },
      { slug: "t4", baslik_en: "Dort", paragraflar: ["Zaten bitmis bir is atlanir ve yeniden uretilmez."] } ] };
    const manifest = path.join(o.kok, "manifest.json"); fs.writeFileSync(manifest, JSON.stringify(man));
    // t2: panelde duzenlenmis konu.json + dolu senaryo; t4: zaten bitmis video; t3: ses adimi hata verecek
    yaz(path.join(o.uretim, "t2", "konu.json"), { baslik_en: "ELLE DUZENLENDI", kanal: "ELLE KANAL", ozelAlan: 5 });
    const elleSenaryo = "Elle yazilmis senaryo: bu metin ezilmemeli, elli karakterden uzun olsun.\n";
    yaz(path.join(o.uretim, "t2", "Voice", "SESLENDIRME-TAM-METIN.txt"), elleSenaryo);
    fs.mkdirSync(path.join(o.uretim, "t4", "Videos"), { recursive: true }); fs.copyFileSync(mp4, path.join(o.uretim, "t4", "Videos", "t4.mp4"));
    yaz(path.join(o.uretim, "t3", "_sahte.json"), { hata: { "seslendir.js": 4 } });
    const satirlar = [];
    const sonuc = await toplu.toplu({ profil: "short", manifest, betikDizini: o.betik, uretim: o.uretim, cikti: m => satirlar.push(m), bekleMs: 50 });
    assert.equal(sonuc.toplam, 4);
    assert.deepEqual(sonuc.bitenler.sort(), ["t1", "t2", "t4"], "sayac yalniz dogrulanmis videoyu sayar");
    assert.deepEqual(sonuc.hata, ["t3"]);
    assert.equal(sonuc.durum.t4, "BITTI"); assert.equal(sonuc.durum.t3, "HATA-ses");
    assert.equal(fs.existsSync(path.join(o.uretim, "t4", "_cagrilar.txt")), false, "bitmis is yeniden uretilmemeli");
    const k1 = JSON.parse(fs.readFileSync(path.join(o.uretim, "t1", "konu.json"), "utf8"));
    assert.deepEqual([k1.kanal, k1.dil, k1.format, k1.aspect, k1.muzikSeviyesi, k1.sesHizi, k1.surum], ["TOPLU KANAL", "tr", "short", "9:16", 0.4, "+18%", 1]);
    const k2 = JSON.parse(fs.readFileSync(path.join(o.uretim, "t2", "konu.json"), "utf8"));
    assert.equal(k2.baslik_en, "ELLE DUZENLENDI", "var olan alan ezilmez"); assert.equal(k2.kanal, "ELLE KANAL"); assert.equal(k2.ozelAlan, 5);
    assert.equal(k2.format, "short", "eksik alan tamamlanir"); assert.equal(k2.dil, "tr"); assert.equal(k2.sesHizi, "+10%");
    assert.equal(fs.readFileSync(path.join(o.uretim, "t2", "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8"), elleSenaryo, "dolu senaryo ezilmez");
    assert.match(fs.readFileSync(path.join(o.uretim, "t1", "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8"), /^Birinci paragraf/);
    const gunluk = fs.readdirSync(o.uretim).find(x => /^_toplu-\d{8}-\d{6}\.log$/.test(x));
    assert.ok(gunluk, "tam gunluk uretim/_toplu-<tarih>.log");
    const g = fs.readFileSync(path.join(o.uretim, gunluk), "utf8");
    assert.match(g, /t3 ses ÇIKTISI \(tam\)/); assert.match(g, /Toplam: 3\/4 video/); assert.match(g, /seslendir\.js sahte hata verdi/);
    assert.ok(satirlar.some(s => /1 iş başarısız: t3/.test(s)));
    // ikinci kosu: devam — t1/t2 zaten bitti, atlanir; t3 hata duzelince uretilir
    yaz(path.join(o.uretim, "t3", "_sahte.json"), {});
    const cagriOnce = fs.readFileSync(path.join(o.uretim, "t1", "_cagrilar.txt"), "utf8");
    const s2 = await toplu.toplu({ profil: "short", manifest, betikDizini: o.betik, uretim: o.uretim, cikti: () => {}, bekleMs: 50 });
    assert.deepEqual(s2.bitenler.sort(), ["t1", "t2", "t3", "t4"]); assert.deepEqual(s2.hata, []);
    assert.equal(fs.readFileSync(path.join(o.uretim, "t1", "_cagrilar.txt"), "utf8"), cagriOnce, "devam: biten is tekrar calismamali");
  } finally {
    for (const [k, v] of [["OTOMASYON_URETIM", once.u], ["OTOMASYON_ENV_DOSYASI", once.e], ["OTOMASYON_AYAR_DOSYASI", once.a], ["SAHTE_MP4", once.m]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    o.temizle();
  }
});

test("yeni-is.js CLI: panelle ayni cekirdek; eksik arguman exit 2; cakisma exit 2", async () => {
  const o = Y.geciciOrtam("cli");
  const env = Object.assign({}, process.env, { OTOMASYON_URETIM: o.uretim, OTOMASYON_ENV_DOSYASI: o.env, OTOMASYON_AYAR_DOSYASI: o.ayar });
  try {
    const cal = (args) => spawnSync(process.execPath, [path.join(Y.KOK, "yeni-is.js"), ...args], { env, encoding: "utf8", timeout: 20000 });
    let r = cal(["cli-is", "--baslik", "CLI Başlığı", "--format", "reels", "--sure", "2", "--dil", "tr", "--nis", "bir not"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const k = JSON.parse(fs.readFileSync(path.join(o.uretim, "cli-is", "konu.json"), "utf8"));
    assert.deepEqual([k.baslik_en, k.format, k.hedefSaniye, k.dil, k._not, k.surum], ["CLI Başlığı", "reels", 120, "tr", "bir not", 1]);
    assert.match(r.stdout, /@@SONUC/); assert.match(r.stdout, /node gorsel-bul\.js cli-is/);
    r = cal(["cli-is", "--baslik", "tekrar"]);
    assert.equal(r.status, 2); assert.match(r.stderr, /zaten var/);
    r = cal([]); assert.equal(r.status, 2);
    r = cal(["x", "--baslik", "b", "--format", "mp4"]); assert.equal(r.status, 2); assert.match(r.stderr, /Biçim/);
    assert.equal(fs.existsSync(path.join(o.uretim, "x")), false);
    r = cal(["--yardim"]); assert.equal(r.status, 0);
  } finally { o.temizle(); }
});
