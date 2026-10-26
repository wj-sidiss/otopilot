// Stok video klibi (video-bul.js, Visuals/<sahne>/00-stok-*.mp4) render/panel/gorsel hatti ile birlikte: arsive tasima (--sahne --ara),
// ATIF.txt = yayin paketi, panelde listeleme/silme, "elle eklenen" uyarisi, sahnede tek kullanim + ofsetli dongu.
// Ag YOK (kaynak istemcileri ve indirme sahte), ucretli servis YOK; ffmpeg gereken testler ffmpeg yoksa atlanir (-threads 1/2).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const fik = require("./render-fikstur");
const kok = fik.ortamKur();
const Y = require("./birim-yardim");
const ortak = require("../lib/ortak");
const SH = require("../lib/render-sahne");
const K = require("../lib/render-klip");
const A = require("../lib/render-ayar");
const F = require("../lib/render-ffmpeg");
const man = require("../lib/gorsel-manifest");
const yayin = require("../lib/render-yayin");
const isler = require("../lib/panel-isler");
const { lisansCoz } = require("../lib/gorsel-lisans");
const ffvar = fik.ffmpegVarMi();

test.after(() => fik.temizle(kok));

const sahteMp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(30000, 1)]);
const pexAtif = (dosya, id) => ({ dosya, baslik: "ocean waves " + id, atif: "Yazar " + id, lisans: "Pexels License", lisansKodu: "pexels", atifGerekli: false,
  atifOnerilen: true, kaynak: "pexels", kaynakUrl: "https://www.pexels.com/video/ocean-waves-" + id + "/", indirmeUrl: "https://v/" + id + ".mp4" });
// Kucuk is: manifest (+ CC BY gorsel) ve sahne klasorleri; gorseller sahte JPEG (yalniz baslik okuyuculari icin)
function kucukIs(ad, sahneSayisi) {
  const dizin = path.join(kok, ad), vis = path.join(dizin, "Visuals");
  const sahneler = [];
  for (let i = 1; i <= sahneSayisi; i++) {
    const klasor = String(i).padStart(3, "0") + "-s";
    fs.mkdirSync(path.join(vis, klasor), { recursive: true });
    fs.writeFileSync(path.join(vis, klasor, "01.jpg"), Y.jpegUret(1280, 720, { bayt: 4000 + i }));
    sahneler.push({ no: i, klasor, paragraflar: [i - 1], aramalar: ["x"], gorseller: [{ dosya: klasor + "/01.jpg", kaynak: "wikimedia", lisans: "CC BY 4.0",
      lisansKodu: "by", atifGerekli: true, atifOnerilen: true, atif: "Foto " + i, baslik: "Gorsel " + i, kaynakUrl: "https://commons.test/" + i }] });
  }
  const m = { surum: 1, sahneler };
  fs.writeFileSync(path.join(vis, "manifest.json"), JSON.stringify(m));
  return { ad, dizin, vis, m };
}

// ---------------------------------------------------------------- bulgu 21: ATIF.txt video atiflarini da icerir
test("atifYaz: ATIF.txt stok video atiflarini da icerir (yalniz diskte duranlar); yayin paketiyle AYNI satirlar", () => {
  const j = kucukIs("atif1", 2);
  fs.writeFileSync(path.join(j.vis, "001-s", "00-stok-pexels-11.mp4"), sahteMp4());
  fs.writeFileSync(path.join(j.vis, "video-atif.json"), JSON.stringify([pexAtif("001-s/00-stok-pexels-11.mp4", 11), pexAtif("002-s/00-stok-pexels-12.mp4", 12),
    pexAtif("../../disari.mp4", 13)]));
  assert.equal(man.atifYaz(j.ad, j.m), 3, "2 CC BY gorsel + 1 diskte duran Pexels klibi");
  const satirlar = fs.readFileSync(path.join(j.dizin, "ATIF.txt"), "utf8").trim().split("\n");
  assert.equal(satirlar[0], man.ATIF_BASLIK);
  assert.ok(satirlar.some(l => /Yazar 11 — Pexels License/.test(l)));
  assert.ok(!satirlar.some(l => /Yazar 12|Yazar 13/.test(l)), "silinmis / Visuals disi klibin atfi girmez");
  const r = yayin.atiflariKur(j.dizin);
  assert.deepEqual(r.atiflar.map(a => a.atifMetni).sort(), satirlar.slice(1).sort());
  assert.deepEqual(r.kayitsizKlipler, []);
  // VIS verilmezse eski davranis (yalniz manifest)
  assert.equal(man.atifSatirlari(j.m).length, 2);
});

test("atiflariKur: video-atif.json'da kaydi olmayan stok klip bildirilir (yayin paketinde uyari)", () => {
  const j = kucukIs("atif2", 2);
  fs.writeFileSync(path.join(j.vis, "002-s", "00-stok-pexels-99.mp4"), sahteMp4());
  const r = yayin.atiflariKur(j.dizin);
  assert.deepEqual(r.kayitsizKlipler, [{ dosya: "002-s/00-stok-pexels-99.mp4", sahne: 2 }]);
});

// ---------------------------------------------------------------- bulgu 22: stok klip icin "elle eklenen" uyarisi yok
test("manifestDisiEkle: stok klip sahnenin basina UYARISIZ eklenir; elle eklenen gorsel yine uyarilir", () => {
  const j = kucukIs("mde", 2);
  fs.writeFileSync(path.join(j.vis, "001-s", "00-stok-pexels-1.mp4"), sahteMp4());
  fs.writeFileSync(path.join(j.vis, "002-s", "00-stok-pexels-2.mp4"), sahteMp4());
  fs.writeFileSync(path.join(j.vis, "002-s", "05.jpg"), Y.jpegUret(1280, 720, { bayt: 4100 }));
  const ham = j.m.sahneler.map(s => ({ no: s.no, klasor: s.klasor, paragraflar: s.paragraflar,
    gorseller: s.gorseller.map(g => ({ ad: g.dosya, yol: path.resolve(j.vis, g.dosya), gecerliYol: true })) }));
  const uy = [];
  assert.equal(SH.manifestDisiEkle(j.vis, ham, uy), 2);
  assert.equal(ham[0].gorseller[0].ad, "001-s/00-stok-pexels-1.mp4", "klip sahnenin basinda");
  assert.equal(ham[1].gorseller[0].ad, "002-s/00-stok-pexels-2.mp4");
  assert.equal(uy.length, 1, uy.join("\n"));
  assert.match(uy[0], /Sahne 2 \(002-s\): manifestte kayıtlı olmayan 1 görsel \(elle eklenen ya da kart\)/);
});

// ---------------------------------------------------------------- bulgu 23: klip sahnede bir kez; yalniz klip varsa ofsetli dongu
test("klipPlani: mp4 sahnede BIR kez (tekrar parcalari durgun gorsele doner); yalniz klip varsa tekrarlar kaldigi yerden baslar", () => {
  const ctx = { FPS: 30, cfKare: 12, MAX_L: 11 };
  const g = [{ ad: "s/00-stok-pexels-1.mp4", yol: "v.mp4", sure: 20 }, { ad: "s/01.jpg", yol: "1.jpg" }, { ad: "s/02.jpg", yol: "2.jpg" }, { ad: "s/03.jpg", yol: "3.jpg" }];
  const kl = SH.klipPlani(ctx, [{ no: 1, son: 45, gorseller: g }], 0);
  assert.equal(kl.length, 5, "45 sn / MAX_L 11 -> 5 parca");
  assert.deepEqual(kl.map(k => k.yol), ["v.mp4", "1.jpg", "2.jpg", "3.jpg", "1.jpg"]);
  assert.ok(kl.every(k => k.ofsetSn === undefined));
  // gorsel sahnesinde siralama eskisiyle ayni (j % nKullan)
  const yalnizGorsel = SH.klipPlani(ctx, [{ no: 1, son: 45, gorseller: g.slice(1) }], 0);
  assert.deepEqual(yalnizGorsel.map(k => k.yol), ["1.jpg", "2.jpg", "3.jpg", "1.jpg"].concat(yalnizGorsel.length > 4 ? ["2.jpg"] : []));
  // yalniz klip: 30 sn, 3 parca; her tekrar onceki parcalarin oynattigi sure kadar ileriden (klip suresine gore modlu)
  const kl2 = SH.klipPlani(ctx, [{ no: 1, son: 30, gorseller: [{ ad: "s/00-stok-x-1.mp4", yol: "v.mp4", sure: 8 }] }], 0);
  assert.equal(kl2.length, 3);
  assert.equal(kl2[0].ofsetSn, undefined);
  assert.equal(kl2[1].ofsetSn, Math.round(((kl2[0].kare / 30) % 8) * 1000) / 1000);
  assert.equal(kl2[2].ofsetSn, Math.round((((kl2[0].kare + kl2[1].kare) / 30) % 8) * 1000) / 1000);
  assert.notEqual(kl2[1].ofsetSn, kl2[2].ofsetSn);
  // sure bilinmiyorsa ofset verilmez (eski davranis)
  assert.ok(SH.klipPlani(ctx, [{ no: 1, son: 30, gorseller: [{ ad: "s/00-stok-x-1.mp4", yol: "v.mp4" }] }], 0).every(k => k.ofsetSn === undefined));
});

test("esitKlipPlani (eski yol): tekrar turlarina stok klip girmez", () => {
  const ctx = { FPS: 30, cfKare: 12, CF: 0.4, MAX_L: 11 };
  const r = SH.esitKlipPlani(ctx, { toplam: 60 }, [{ ad: "00-stok-p-1.mp4", yol: "v.mp4", sure: 5 }, { ad: "a.jpg", yol: "a.jpg" }], 0);
  assert.ok(r.klipler.length > 2);
  assert.equal(r.klipler.filter(k => k.yol === "v.mp4").length, 1);
  assert.equal(r.ozgun, 2);
});

test("klipArgv / klipImzasi: ofset -ss ile verilir ve imzaya girer; ofsetsiz klibin imzasi degismez", () => {
  const ayar = { W: 320, H: 180, SW: 360, SH: 200, FPS: 25, efekt: "yavas", renk: "x", renkFiltresi: "null" };
  const argv = K.klipArgv(ayar, { yol: "a.mp4", kare: 50, ofsetSn: 2.4 }, { ara: [] }, 64);
  assert.deepEqual(argv.slice(0, 5), ["-stream_loop", "-1", "-ss", "2.400", "-i"]);
  assert.deepEqual(K.klipArgv(ayar, { yol: "a.mp4", kare: 50 }, { ara: [] }, 64).slice(0, 3), ["-stream_loop", "-1", "-i"]);
  const k = { ad: "s/00-stok-p-1.mp4", yol: path.join(kok, "yok.mp4"), kare: 50, zin: true };
  assert.equal(K.klipImzasi(ayar, k, "x"), K.klipImzasi(ayar, Object.assign({}, k, { ofsetSn: 0 }), "x"));
  assert.notEqual(K.klipImzasi(ayar, k, "x"), K.klipImzasi(ayar, Object.assign({}, k, { ofsetSn: 2.4 }), "x"));
});

test("bozukMesaji: gorselde eski metin; stok klipte panel + video-bul komutu", () => {
  assert.equal(SH.bozukMesaji("002-sahne/02.jpg"), "Görsel 002-sahne/02.jpg bozuk, panelden sil");
  const m = SH.bozukMesaji("001-s/00-stok-pexels-7.mp4", "isim", 1);
  assert.match(m, /^Stok video 001-s\/00-stok-pexels-7\.mp4 bozuk/);
  assert.match(m, /panelden/);
  assert.match(m, /node video-bul\.js isim --sahne 1 --yeniden/);
});

// gercek ffmpeg: -ss + -stream_loop: ilk tur ofsetten, sonraki donguler BASTAN (kirmizi 0-2 sn, mavi 2-4 sn)
test("videoKlipArgv (gercek ffmpeg): ofsetli klip ofsetteki kareyle baslar, dongu bastan devam eder", { skip: !ffvar && "ffmpeg yok" }, () => {
  const dz = path.join(kok, "ofset"); fs.mkdirSync(dz, { recursive: true });
  const kaynak = path.join(dz, "00-stok-test-1.mp4");
  fik.ff(["-f", "lavfi", "-i", "color=c=red:s=160x90:r=25:d=2", "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=25:d=2",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1[v]", "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", kaynak]);
  const ayar = { W: 160, H: 90, FPS: 25, renkFiltresi: "null" };
  const Kk = { ara: ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"] };
  const renkler = (k, ad) => {
    const cikti = path.join(dz, ad);
    execFileSync(fik.FF(), ["-y", "-hide_banner", "-loglevel", "error", ...K.klipArgv(ayar, Object.assign({ yol: kaynak }, k), Kk, 64), cikti], { stdio: "pipe", windowsHide: true, timeout: 120000 });
    const ham = execFileSync(fik.FF(), ["-hide_banner", "-loglevel", "error", "-i", cikti, "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-threads", "2", "-"], { windowsHide: true, timeout: 60000 });
    const l = [];
    for (let i = 0; i + 2 < ham.length; i += 3) l.push(ham[i] > ham[i + 2] ? "K" : "M");
    return l;
  };
  // argv kendi -threads degerini verir (paralellik payi): 64 isci -> 2
  assert.equal(K.klipArgv(ayar, { yol: kaynak, kare: 10 }, Kk, 64)[K.klipArgv(ayar, { yol: kaynak, kare: 10 }, Kk, 64).indexOf("-threads") + 1], "2");
  const ofsetsiz = renkler({ kare: 10 }, "a.mp4");
  assert.equal(ofsetsiz.length, 10);
  assert.equal(ofsetsiz[0], "K");
  const ofsetli = renkler({ kare: 25, ofsetSn: 3.5 }, "b.mp4");
  assert.equal(ofsetli.length, 25);
  assert.equal(ofsetli[0], "M", "3.5 sn'den basladi (mavi)");
  assert.equal(ofsetli[ofsetli.length - 1], "K", "klip sonuna gelince BASTAN dondu (kirmizi): " + ofsetli.join(""));
});

// ---------------------------------------------------------------- bulgu 18: panel listeler, onizler ve siler
test("panel: stok klip sahne listesinde (video:true, kaynak/lisans video-atif.json'dan); gorsel-sil klibi siler, video-bul bir daha indirmez", async () => {
  const j = kucukIs("panelklip", 1);
  fs.writeFileSync(path.join(j.vis, "001-s", "00-stok-pexels-31.mp4"), sahteMp4());
  fs.writeFileSync(path.join(j.vis, "video-atif.json"), JSON.stringify([pexAtif("001-s/00-stok-pexels-31.mp4", 31)]));
  assert.ok(isler.GORSEL_UZ.test("00-stok-pexels-31.mp4") && isler.GORSEL_UZ.test("01.jpg") && !isler.GORSEL_UZ.test("x.gif"));
  const s = isler.sahneler("panelklip")[0];
  const klip = s.gorseller.find(g => g.ad === "00-stok-pexels-31.mp4");
  assert.deepEqual(klip, { ad: "00-stok-pexels-31.mp4", kaynak: "pexels", lisans: "Pexels License", atif: "Yazar 31", video: true });
  assert.deepEqual(s.gorseller.find(g => g.ad === "01.jpg"), { ad: "01.jpg", kaynak: "wikimedia", lisans: "CC BY 4.0", atif: "Foto 1" }, "gorsel satiri degismedi");
  assert.ok(isler.gorseller("panelklip").some(g => g.ad === "00-stok-pexels-31.mp4" && g.video && g.sahne === "001-s"));
  // silme ucu (panel-dosya.gorselSil) klibi kabul eder; silinenler.json'a ad yazilir
  const dosya = require("../lib/panel-dosya");
  assert.deepEqual(dosya.gorselSil("panelklip", "001-s", "00-stok-pexels-31.mp4"), { ok: true });
  assert.ok(!fs.existsSync(path.join(j.vis, "001-s", "00-stok-pexels-31.mp4")));
  assert.ok(isler.sahneler("panelklip")[0].gorseller.every(g => !g.video));
  const sl = JSON.parse(fs.readFileSync(path.join(j.dizin, "silinenler.json"), "utf8"));
  assert.ok(sl.silinenler.some(x => x.ad === "00-stok-pexels-31.mp4"));
  // video-bul ayni klibi bir daha indirmez, atif kaydi duser, ATIF.txt yenilenir
  const vb = require("../video-bul.js");
  const pex = id => Object.assign({ kaynak: "pexels", url: "https://v/" + id + ".mp4", yedekUrl: [], baslik: "ocean waves", etiket: "", atif: "Yazar " + id,
    kaynakUrl: "https://www.pexels.com/video/ocean-waves-" + id + "/", indirmeUrl: "https://v/" + id + ".mp4", sure: 8, en: 1920, boy: 1080, sira: 0 }, lisansCoz("pexels"));
  j.m.sahneler[0].aramalar = ["ocean waves"];
  fs.writeFileSync(path.join(j.vis, "manifest.json"), JSON.stringify(j.m));
  const getir = { gorsel: async () => ({ govde: sahteMp4() }) };
  const r = await vb.calistir(["panelklip"], { pexelsKey: "K", pixabayKey: "", getir, istemciler: { pexels: async () => [pex(31), pex(32)] }, log: () => {} });
  assert.equal(r.eklenen, 1);
  assert.deepEqual(fs.readdirSync(path.join(j.vis, "001-s")).sort(), ["00-stok-pexels-32.mp4", "01.jpg"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(j.vis, "video-atif.json"), "utf8")).map(x => x.dosya), ["001-s/00-stok-pexels-32.mp4"]);
  assert.match(fs.readFileSync(path.join(j.dizin, "ATIF.txt"), "utf8"), /Yazar 32/);
});

// ---------------------------------------------------------------- bulgu 19: gorsel-bul --sahne N --ara eski klibi arsive tasir
test("gorsel-bul --sahne N --ara: eski stok klip arsive tasinir (uyari); yeni arama bos donerse klip geri konur", async () => {
  const akis = require("../lib/gorsel-akis");
  const is = "akisklip";
  const dizin = path.join(kok, is);
  fs.mkdirSync(path.join(dizin, "Voice"), { recursive: true });
  const paragraf = i => Array.from({ length: 30 }, (_, k) => "terim" + i + "x" + k).join(" ") + ".";
  fs.writeFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), [0, 1, 2].map(paragraf).join("\n\n"));
  fs.writeFileSync(path.join(dizin, "konu.json"), JSON.stringify({ format: "long", sahneKelimeleri: [["brown bear"], ["red fox"], ["bald eagle"]] }));
  const resimler = new Map();
  let n = 0;
  const aday = (q, i) => {
    const url = "https://img.test/" + (++n) + ".jpg";
    resimler.set(url, Y.jpegUret(1920, 1080, { bayt: 5000 + n }));
    return Object.assign({ kaynak: "pexels", url, yedekUrl: [], baslik: q + " photo " + i, etiket: "", atif: "Foto", kaynakUrl: "https://www.pexels.com/photo/" + n + "/",
      indirmeUrl: url, en: 1920, boy: 1080, sira: i }, lisansCoz("pexels"));
  };
  const getir = async () => { throw new Error("cagrilmamali"); };
  getir.json = async () => { throw new Error("cagrilmamali"); };
  getir.gorsel = async u => { const r = resimler.get(u); if (!r) throw Object.assign(new Error("HTTP 404"), { kod: 404 }); return { govde: r }; };
  const bos = async () => [];
  const pexels = async q => (/nothing/.test(q) ? [] : [0, 1, 2, 3].map(i => aday(q, i)));
  const uyarilar = [];
  const bag = { getir, anahtarlar: { pexels: "x", pixabay: "" }, istemciler: { pexels, pixabay: bos, wikimedia: bos, openverse: bos, nasa: bos },
    bekle: async () => {}, bekleKaynak: async () => {}, aralik: {}, indirmeAra: 0, log: () => {}, uyari: m => uyarilar.push(m) };
  await Y.yakala(() => akis.calistir({ is }, bag));
  let M = JSON.parse(fs.readFileSync(path.join(dizin, "Visuals", "manifest.json"), "utf8"));
  const s2 = M.sahneler[1].klasor;
  const vis = path.join(dizin, "Visuals");
  fs.writeFileSync(path.join(vis, s2, "00-stok-pexels-77.mp4"), sahteMp4());

  // duzeltme: --sahne 2 --ara -> klip arsive, uyari video-bul komutunu soyler
  await Y.yakala(() => akis.calistir({ is, sahne: 2, ara: "gray wolf" }, bag));
  M = JSON.parse(fs.readFileSync(path.join(vis, "manifest.json"), "utf8"));
  assert.ok(!fs.readdirSync(path.join(vis, s2)).some(f => /\.mp4$/.test(f)), "klip sahnede kalmadi");
  const arsiv = fs.readdirSync(vis).filter(x => /^_eski-/.test(x));
  assert.ok(arsiv.some(a => fs.existsSync(path.join(vis, a, s2, "00-stok-pexels-77.mp4"))), "klip arsivde");
  assert.ok(uyarilar.some(u => /Sahne 2: eski aramayla seçilmiş stok video klibi kaldırıldı/.test(u) && /node video-bul\.js akisklip --sahne 2/.test(u)), uyarilar.join("\n"));
  // render: sahnenin basina eski klip konmaz, yeni gorseller gelir
  const ham = M.sahneler.map(s => ({ no: s.no, klasor: s.klasor, paragraflar: s.paragraflar,
    gorseller: s.gorseller.map(g => ({ ad: g.dosya, yol: path.resolve(vis, g.dosya), gecerliYol: true })) }));
  SH.manifestDisiEkle(vis, ham, []);
  assert.ok(ham[1].gorseller.length && ham[1].gorseller.every(g => !/\.mp4$/.test(g.ad)) && /gray wolf/.test(M.sahneler[1].gorseller[0].baslik));

  // yeni arama hic sonuc vermezse sahne eskisi gibi kalir: klip de geri konur
  fs.writeFileSync(path.join(vis, s2, "00-stok-pexels-88.mp4"), sahteMp4());
  const once = M.sahneler[1].gorseller.map(g => g.dosya).sort();
  uyarilar.length = 0;
  await assert.rejects(Y.yakala(() => akis.calistir({ is, sahne: 2, ara: "nothing at all" }, bag)), e => e.kod === "gorsel_yok");
  assert.ok(fs.existsSync(path.join(vis, s2, "00-stok-pexels-88.mp4")), "geri alinan aramada klip yerine dondu");
  M = JSON.parse(fs.readFileSync(path.join(vis, "manifest.json"), "utf8"));
  assert.deepEqual(M.sahneler[1].gorseller.map(g => g.dosya).sort(), once);
  assert.ok(!uyarilar.some(u => /klibi kaldırıldı/.test(u)), uyarilar.join("\n"));
});

test("sahneleriTopla: gorselsiz sahne komsudan DURGUN gorsel odunc alir (komsunun basindaki stok klip arka arkaya iki kez oynamaz)", { skip: !ffvar && "ffmpeg yok" }, async () => {
  const j = fik.isKur(kok, { ad: "odunc", paragraf: 4, sahneBasina: 2, gorselBasina: 1, ton: true });
  const vis = path.join(j.dizin, "Visuals");
  fs.rmSync(path.join(vis, "001-sahne", "01.jpg"));
  fik.ff(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=25", "-t", "2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", path.join(vis, "002-sahne", "00-stok-pexels-5.mp4")]);
  const ses = { N: 4, baslangic: j.zParca.map(p => p.baslangicSn), sure: j.zParca.map(p => p.sureSn), toplam: j.toplam, ozet: ortak.paragrafOzeti(j.paragraflar) };
  const r = await SH.sahneleriTopla(A.ayarCoz("odunc"), ses);
  assert.equal(r.sahneler[0].odunc, "sonraki");
  assert.deepEqual(r.sahneler[0].gorseller.map(g => g.ad), ["002-sahne/01.jpg"]);
  assert.deepEqual(r.sahneler[1].gorseller.map(g => g.ad), ["002-sahne/00-stok-pexels-5.mp4", "002-sahne/01.jpg"]);
});

// ---------------------------------------------------------------- uctan uca: gercek render (video-yap.js)
test("video-yap (gercek render): stok klipli is biter; 'elle eklenen' uyarisi yok; mp4 suresi olculur; ATIF.txt = yayin.json atiflari",
  { skip: !ffvar && "ffmpeg yok", timeout: 600000 }, async t => {
    const j = fik.isKur(kok, { ad: "v1", paragraf: 4, sahneBasina: 2, gorselBasina: 1, ton: true,
      konu: { intro: 0, outro: 0, konuKarti: 0, gecisSure: 0.4, muzikSeviyesi: 0, geriSayim: 0 } });
    const vis = path.join(j.dizin, "Visuals");
    const klip = path.join(vis, "001-sahne", "00-stok-pexels-77.mp4");
    fik.ff(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=25", "-t", "3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", klip]);
    fs.writeFileSync(path.join(vis, "video-atif.json"), JSON.stringify([pexAtif("001-sahne/00-stok-pexels-77.mp4", 77)]));
    man.atifYaz("v1", JSON.parse(fs.readFileSync(path.join(vis, "manifest.json"), "utf8")));     // video-bul.js sonunda yaptigi gibi

    // sahne toplama: klip suresi olculur, uyari yok
    const ses = { N: 4, baslangic: j.zParca.map(p => p.baslangicSn), sure: j.zParca.map(p => p.sureSn), toplam: j.toplam, ozet: ortak.paragrafOzeti(j.paragraflar) };
    const st = await SH.sahneleriTopla(A.ayarCoz("v1"), ses);
    assert.equal(st.stokKlip, 1);
    const g0 = st.sahneler[0].gorseller[0];
    assert.equal(g0.ad, "001-sahne/00-stok-pexels-77.mp4");
    assert.ok(Math.abs(g0.sure - 3) < 0.2, "klip suresi: " + g0.sure);
    assert.ok(!st.uyarilar.some(u => /elle eklenen/.test(u)), st.uyarilar.join("\n"));

    const r = await fik.betikCalistir("video-yap.js", ["v1"], { env: { VIDEO_KODEK: "cpu", RENDER_OLCEK: "0.25", RENDER_DUSUK_BELLEK: "1" }, signal: t.signal });
    assert.equal(r.kod, 0, r.stdout.slice(-3000) + "\n" + r.stderr.slice(-2000));
    assert.ok(!/elle eklenen/.test(r.stdout), "stok klip 'elle eklenen' diye uyarilmaz");
    const y = JSON.parse(fs.readFileSync(path.join(j.dizin, "yayin.json"), "utf8"));
    const atifTxt = fs.readFileSync(path.join(j.dizin, "ATIF.txt"), "utf8").trim().split("\n").slice(1);
    assert.ok(y.atiflar.some(a => /Yazar 77/.test(a.atifMetni)));
    assert.deepEqual(y.atiflar.map(a => a.atifMetni).sort(), atifTxt.slice().sort(), "ATIF.txt ile yayin.json atiflari ayni");
    assert.ok(F.sureOlc(path.join(j.dizin, "Videos", "v1.mp4")) > 1);
  });
