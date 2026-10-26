// vidIQ klip uretimi: kuru calisma, butce korumasi, tekrar uretmeme, yarim isi surdurme. Gercek vidIQ'ya/krediye DOKUNMAZ.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const K = require("../lib/vidiq-klip.js");
const C = require("../vidiq-klip.js");

const gecici = () => fs.mkdtempSync(path.join(os.tmpdir(), "vidiq-klip-"));

// sahte vidIQ: bakiye her generate_video'da duz ucretle azalir. ayar.gonder(arg, durum) / ayar.bekle(no, durum) bir hata
// dondururse o cagri o hatayla duser (gonderim hatasi generate'i saymaz, bakiyeyi dusurmez).
function sahteVidiq(bas, ucretSn, ayar) {
  const a = ayar || {};
  const durum = { bakiye: bas, basladi: [], pollar: [], beklenen: [], bakiyeSorgu: 0 };
  return {
    durum,
    async cagir(arac, arg, beklenen) {
      if (arac === "vidiq_balance") { durum.bakiyeSorgu++; return { totalCredits: durum.bakiye }; }
      if (arac === "vidiq_generate_video") {
        durum.beklenen.push(beklenen);
        const h = a.gonder && a.gonder(arg, durum);
        if (h) throw h;
        durum.basladi.push(arg); durum.bakiye -= arg.duration * ucretSn;
        return { mcpJobId: "is-" + durum.basladi.length };
      }
      throw new Error("beklenmeyen arac " + arac);
    },
    async isBekle(no) {
      durum.pollar.push(no);
      const h = a.bekle && a.bekle(no, durum);
      if (h) throw h;
      return { videoUrl: "https://cdn.example.com/" + no + ".mp4" };
    },
  };
}
// gecerli MP4 basligi (4-8. baytlar 'ftyp')
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(20, 1)]);
const indir = async () => MP4;
const vHata = (kod, mesaj, detay) => Object.assign(new Error(mesaj), { kod, cikis: 3, detay });
const kayit = dizin => JSON.parse(fs.readFileSync(path.join(dizin, "klipler.json"), "utf8"));
const temel = (dizin, v, ek) => Object.assign({ model: "minimax-h3", cozunurluk: "768p", oran: "9:16", dizin, butce: 300, onay: true, vidiq: v, indir }, ek || {});
const L = (...ad) => ad.map(a => ({ istem: a, sure: 5 }));

test("klipListesi: sure, yorum ve bos satirlar", () => {
  const l = K.klipListesi("# not\n\nwaves at dawn | 6\ncity at night\n", 5);
  assert.deepEqual(l, [{ istem: "waves at dawn", sure: 6 }, { istem: "city at night", sure: 5 }]);
});

test("tahmin: gecersiz model/cozunurluk ve sure reddedilir", () => {
  assert.throws(() => K.tahmin([{ istem: "x", sure: 5 }], "seedance-2-fast", "1080p"), /çözünürlüğü yok/);
  assert.throws(() => K.tahmin([{ istem: "x", sure: 5 }], "veo-3.1-fast", "720p"), /geçersiz/);
  assert.equal(K.tahmin([{ istem: "x", sure: 5 }, { istem: "y", sure: 4 }], "minimax-h3", "768p").toplam, 180);
});

test("videoUrlBul: ic ice sonucta https mp4 bulur, http'yi almaz", () => {
  assert.equal(K.videoUrlBul({ a: [{ b: { videoUrl: "https://x/y.mp4" } }] }), "https://x/y.mp4");
  assert.equal(K.videoUrlBul({ videos: ["http://x/y.mp4"] }), "");
});

test("videoUrlBul: once gelen kucuk resmi video sanmaz; uzantisiz 'url' yalniz video altinda kabul", () => {
  assert.equal(K.videoUrlBul({ thumbnail: { url: "https://cdn.x/poster.jpg" }, video: { url: "https://cdn.x/v.mp4" } }), "https://cdn.x/v.mp4");
  assert.equal(K.videoUrlBul({ poster: { url: "https://cdn.x/p" }, video: { url: "https://cdn.x/v?sig=1" } }), "https://cdn.x/v?sig=1");
  assert.equal(K.videoUrlBul({ url: "https://cdn.x/poster.jpg" }), "", "uzantisi video olmayan url alinmaz");
  assert.equal(K.videoUrlBul({ preview: { videoUrl: "https://cdn.x/prev.mp4" }, result: { videoUrl: "https://cdn.x/full.mp4" } }), "https://cdn.x/full.mp4");
  assert.equal(K.videoUrlBul({ thumbnailUrl: "https://cdn.x/t.mp4", url: "https://cdn.x/a.mp4?x=1" }), "https://cdn.x/a.mp4?x=1");
  assert.equal(K.videoGovdesiMi(MP4), true);
  assert.equal(K.videoGovdesiMi(Buffer.from("<!DOCTYPE html><html>")), false);
});

test("onay yoksa KURU CALISMA: hicbir sey baslatilmaz", async () => {
  const v = sahteVidiq(1000, 20), dizin = gecici();
  const r = await K.uret({ liste: [{ istem: "a", sure: 5 }], model: "minimax-h3", cozunurluk: "768p", oran: "9:16", dizin, butce: 500, onay: false, vidiq: v, indir });
  assert.equal(r.durum, "kuru_calisma"); assert.equal(r.tahminiKredi, 100);
  assert.equal(v.durum.basladi.length, 0);
});

test("butce yok ya da tahmini asiliyorsa HIC baslamaz", async () => {
  const v = sahteVidiq(1000, 20), dizin = gecici();
  const a = { liste: [{ istem: "a", sure: 5 }, { istem: "b", sure: 5 }], model: "minimax-h3", cozunurluk: "768p", oran: "9:16", dizin, onay: true, vidiq: v, indir };
  await assert.rejects(K.uret(Object.assign({ butce: 0 }, a)), /Bütçe verilmedi/);
  await assert.rejects(K.uret(Object.assign({ butce: 150 }, a)), /Hiçbir şey başlatılmadı/);
  assert.equal(v.durum.basladi.length, 0);
});

test("uretir, dosya + kayit yazar; ikinci calistirma ayni istemi TEKRAR uretmez", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  const a = { liste: [{ istem: "a", sure: 5 }, { istem: "b", sure: 4 }], model: "minimax-h3", cozunurluk: "768p", oran: "9:16", dizin, butce: 300, onay: true, vidiq: v, indir };
  const r = await K.uret(a);
  assert.equal(r.durum, "bitti"); assert.equal(r.dosyalar.length, 2); assert.equal(r.harcanan, 135);
  assert.ok(r.dosyalar.every(f => fs.existsSync(path.join(dizin, f))));
  assert.deepEqual(v.durum.beklenen[0], ["mcpJobId", "jobId"], "is no hangi bicimde gelirse gelsin bulunmali");
  assert.equal(kayit(dizin).klipler[0].oran, "9:16", "oran kayda yazilir");
  const r2 = await K.uret(a);
  assert.equal(r2.durum, "hepsi_hazir"); assert.equal(v.durum.basladi.length, 2, "ikinci kosuda yeni is baslamamali");
});

test("yeni klip eklenince yalniz eksik uretilir", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  const t = { model: "minimax-h3", cozunurluk: "768p", oran: "9:16", dizin, butce: 300, onay: true, vidiq: v, indir };
  await K.uret(Object.assign({ liste: [{ istem: "a", sure: 5 }] }, t));
  const r = await K.uret(Object.assign({ liste: [{ istem: "a", sure: 5 }, { istem: "b", sure: 5 }] }, t));
  assert.equal(r.atlanan, 1); assert.equal(r.dosyalar.length, 1); assert.equal(v.durum.basladi.length, 2);
});

test("gercek harcama butceyi asinca sonraki klip BASLAMAZ", async () => {
  const v = sahteVidiq(1000, 60), dizin = gecici();       // tahmin 20/sn ama gercek 60/sn
  const r = await K.uret({ liste: [{ istem: "a", sure: 5 }, { istem: "b", sure: 5 }, { istem: "c", sure: 5 }], model: "minimax-h3", cozunurluk: "768p", oran: "9:16", dizin, butce: 300, onay: true, vidiq: v, indir });
  assert.equal(v.durum.basladi.length, 1, "ilk klip 300 harcadi, butce dolu");
  assert.equal(r.harcanan, 300);
});

test("butce: kalan butce HER klipten once o klibin olculen maliyetine karsi denetlenir (asilmaz)", async () => {
  // tahmin 20/sn (5 sn = 100) ama gercek 26/sn: 2 klip 260; 3. klip (130) 300'u asardi -> baslamaz
  const v1 = sahteVidiq(1000, 26), d1 = gecici();
  const r1 = await K.uret(temel(d1, v1, { liste: L("a", "b", "c") }));
  assert.equal(v1.durum.basladi.length, 2); assert.equal(r1.harcanan, 260); assert.ok(r1.harcanan <= 300);
  assert.equal(r1.durum, "butce_doldu"); assert.equal(r1.baslatilmayan, 1); assert.equal(r1.dosyalar.length, 2);
  assert.equal(C.cikisKodu(r1), 7, "butce doldu = maliyet siniri");
  // gercek 59/sn: tek klip 295; ikincisi 590 olurdu
  const v2 = sahteVidiq(1000, 59), d2 = gecici();
  const r2 = await K.uret(temel(d2, v2, { liste: L("a", "b", "c") }));
  assert.equal(v2.durum.basladi.length, 1); assert.equal(r2.harcanan, 295);
  // butce 350, gercek 60/sn: 1 klip
  const v3 = sahteVidiq(1000, 60), d3 = gecici();
  const r3 = await K.uret(temel(d3, v3, { liste: L("a", "b"), butce: 350 }));
  assert.equal(v3.durum.basladi.length, 1); assert.equal(r3.harcanan, 300);
  // devam: butce artirilinca yalniz kalanlar uretilir
  const r1b = await K.uret(temel(d1, v1, { liste: L("a", "b", "c"), butce: 200 }));
  assert.equal(r1b.atlanan, 2); assert.equal(r1b.durum, "bitti"); assert.equal(v1.durum.basladi.length, 3);
});

test("yarim kalan is (indirilmemis) yeniden BASLATILMAZ, ayni is no ile surer", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  fs.mkdirSync(dizin, { recursive: true });
  fs.writeFileSync(path.join(dizin, "klipler.json"), JSON.stringify({ klipler: [{ istem: "a", sure: 5, model: "minimax-h3", cozunurluk: "768p", isNo: "eski-is", dosya: "" }] }));
  const r = await K.uret({ liste: [{ istem: "a", sure: 5 }], model: "minimax-h3", cozunurluk: "768p", oran: "9:16", dizin, butce: 300, onay: true, vidiq: v, indir });
  assert.equal(r.durum, "bitti"); assert.equal(v.durum.basladi.length, 0, "generate_video cagrilmamali");
});

test("ucreti odenmis yarim is: bakiye/butce yetmese de UCRETSIZ sorgulanip alinir, tahmine girmez", async () => {
  const v = sahteVidiq(20, 20), dizin = gecici();
  fs.mkdirSync(dizin, { recursive: true });
  fs.writeFileSync(path.join(dizin, "klipler.json"), JSON.stringify({ klipler: [{ istem: "a", sure: 5, model: "minimax-h3", cozunurluk: "768p", oran: "9:16", isNo: "eski-is", dosya: "" }] }));
  const kuru = await K.uret(temel(dizin, v, { liste: L("a"), butce: 0, onay: false }));
  assert.equal(kuru.durum, "kuru_calisma"); assert.equal(kuru.surdurulecek, 1); assert.equal(kuru.uretilecek, 0); assert.equal(kuru.tahminiKredi, 0);
  const r = await K.uret(temel(dizin, v, { liste: L("a"), butce: 0 }));
  assert.equal(r.durum, "bitti"); assert.equal(r.harcanan, 0); assert.equal(r.dosyalar.length, 1);
  assert.equal(v.durum.basladi.length, 0); assert.deepEqual(v.durum.pollar, ["eski-is"]);
});

test("yarim is + yeni klip, kredi yetmez: yarim is alinir, yeni klip BASLAMAZ; yarim is yoksa eskisi gibi hata", async () => {
  const v = sahteVidiq(20, 20), dizin = gecici();
  fs.mkdirSync(dizin, { recursive: true });
  fs.writeFileSync(path.join(dizin, "klipler.json"), JSON.stringify({ klipler: [{ istem: "a", sure: 5, model: "minimax-h3", cozunurluk: "768p", isNo: "eski-is", dosya: "" }] }));
  const r = await K.uret(temel(dizin, v, { liste: L("a", "b") }));
  assert.equal(r.dosyalar.length, 1); assert.equal(v.durum.basladi.length, 0);
  assert.equal(r.durum, "kismi"); assert.equal(r.durdu, "kredi"); assert.equal(r.baslatilmayan, 1);
  await assert.rejects(K.uret(temel(dizin, v, { liste: L("a", "b") })), e => e.kod === "kredi_yetmez");
  assert.equal(v.durum.basladi.length, 0);
});

test("vidIQ'da basarisiz/expired is KILIT olmaz: sonraki klip uretilir, sonraki kosu yeniden baslatir", async () => {
  let ilk = true;
  const v = sahteVidiq(1000, 15, { bekle: (no, d) => {
    if (no === "is-1" && ilk) { ilk = false; d.bakiye += 75; return vHata("vidiq_uretim", "vidIQ üretimi başarısız oldu (provider_error). Krediler iade edildi.", { status: "failed", refunded: true }); }
  } });
  const dizin = gecici();
  const r1 = await K.uret(temel(dizin, v, { liste: L("a", "b") }));
  assert.equal(r1.durum, "kismi"); assert.equal(r1.dosyalar.length, 1, "b yine uretilmeli"); assert.equal(r1.basarisiz.length, 1);
  assert.equal(r1.harcanan, 75, "iade edilen klip harcamaya sayilmaz");
  assert.match(r1.basarisiz[0].cozum, /yeniden çalıştır/);
  assert.equal(C.cikisKodu(r1), 3);
  assert.equal(kayit(dizin).klipler[0].durum, "basarisiz");
  const r2 = await K.uret(temel(dizin, v, { liste: L("a", "b") }));
  assert.equal(r2.durum, "bitti"); assert.equal(r2.atlanan, 1); assert.equal(r2.dosyalar.length, 1);
  assert.equal(v.durum.basladi.length, 3, "basarisiz klip yeni isle yeniden baslatilmali");
});

test("kredi yuzunden basarisiz is donguyu durdurur (sonraki klipler de krediye takilirdi)", async () => {
  const v = sahteVidiq(1000, 15, { bekle: no => no === "is-1" ? vHata("vidiq_kredi", "vidIQ üretimi başarısız oldu (insufficient_credits).", { status: "failed", refunded: true }) : null });
  const dizin = gecici();
  const r = await K.uret(temel(dizin, v, { liste: L("a", "b") }));
  assert.equal(v.durum.basladi.length, 1); assert.equal(r.durdu, "kredi"); assert.equal(r.durum, "kismi"); assert.equal(r.baslatilmayan, 1);
});

test("zaman asimi/ag hatasi: kayit KORUNUR, digerleri surer; sonraki kosu ayni isi ucretsiz sorgular", async () => {
  let ilk = true;
  const v = sahteVidiq(1000, 15, { bekle: no => { if (no === "is-1" && ilk) { ilk = false; return vHata("vidiq_zaman_asimi", "vidIQ işi 15 dakikada bitmedi."); } } });
  const dizin = gecici();
  const r1 = await K.uret(temel(dizin, v, { liste: L("a", "b") }));
  assert.equal(r1.dosyalar.length, 1); assert.equal(r1.basarisiz.length, 1);
  assert.equal(kayit(dizin).klipler[0].isNo, "is-1"); assert.equal(kayit(dizin).klipler[0].durum, undefined);
  const r2 = await K.uret(temel(dizin, v, { liste: L("a", "b") }));
  assert.equal(r2.durum, "bitti"); assert.equal(r2.harcanan, 0); assert.equal(v.durum.basladi.length, 2, "yeni is baslamamali");
});

test("klipler.json BOM'lu: okunur, teslim edilmis klip YENIDEN uretilmez", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  await K.uret(temel(dizin, v, { liste: L("a") }));
  const yol = path.join(dizin, "klipler.json");
  fs.writeFileSync(yol, "﻿" + fs.readFileSync(yol, "utf8"));
  const r = await K.uret(temel(dizin, v, { liste: L("a") }));
  assert.equal(r.durum, "hepsi_hazir"); assert.equal(v.durum.basladi.length, 1);
});

test("klipler.json bozuk ya da bicimsiz: DURUR (bos sayilmaz), hicbir sey baslamaz, 001 ezilmez", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  await K.uret(temel(dizin, v, { liste: L("a") }));
  const ilk = fs.readFileSync(path.join(dizin, "001-minimax-h3.mp4"));
  const yol = path.join(dizin, "klipler.json");
  for (const bozuk of ["{\"klipler\": [", "{}", "{\"klipler\": [null]}", ""]) {
    fs.writeFileSync(yol, bozuk);
    await assert.rejects(K.uret(temel(dizin, v, { liste: L("a", "b") })), e => e.kod === "kayit_bozuk" && e.cikis === 2 && /hiçbir şey başlatılmadı/.test(e.message), bozuk);
    await assert.rejects(K.uret(temel(dizin, v, { liste: L("a"), onay: false })), e => e.kod === "kayit_bozuk", "kuru calisma da durmali");
  }
  assert.equal(v.durum.basladi.length, 1);
  assert.deepEqual(fs.readFileSync(path.join(dizin, "001-minimax-h3.mp4")), ilk);
});

test("kaydi olmayan var olan klip dosyasi EZILMEZ: bir sonraki bos numaraya yazilir", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  fs.writeFileSync(path.join(dizin, "001-minimax-h3.mp4"), "eski");
  const r = await K.uret(temel(dizin, v, { liste: L("a") }));
  assert.deepEqual(r.dosyalar, ["002-minimax-h3.mp4"]);
  assert.equal(fs.readFileSync(path.join(dizin, "001-minimax-h3.mp4"), "utf8"), "eski");
  assert.equal(kayit(dizin).klipler[0].dosya, "002-minimax-h3.mp4");
});

test("oran ya da cozunurluk degisince ayri cekim sayilir ve uyarilir; yarim is baska oranla surdurulmez", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  await K.uret(temel(dizin, v, { liste: L("a") }));
  const yatay = await K.uret(temel(dizin, v, { liste: L("a"), oran: "16:9", onay: false }));
  assert.equal(yatay.durum, "kuru_calisma"); assert.equal(yatay.uretilecek, 1); assert.equal(yatay.atlanan, 0);
  assert.equal(yatay.farkliAyar, 1); assert.deepEqual(yatay.farkliAyarlar, ["9:16/768p"]);
  const ikiK = await K.uret(temel(dizin, v, { liste: L("a"), cozunurluk: "2k", onay: false }));
  assert.equal(ikiK.uretilecek, 1); assert.equal(ikiK.tahminiKredi, 130);
  await assert.rejects(K.uret(temel(dizin, v, { liste: L("a"), oran: "4:3" })), e => e.kod === "oran");
  // 9:16 yarim is varken 16:9 istenirse yeni is baslar, eski is sorgulanmaz
  const v2 = sahteVidiq(1000, 15), d2 = gecici();
  fs.writeFileSync(path.join(d2, "klipler.json"), JSON.stringify({ klipler: [{ istem: "a", sure: 5, model: "minimax-h3", cozunurluk: "768p", oran: "9:16", isNo: "dikey-is", dosya: "" }] }));
  const r = await K.uret(temel(d2, v2, { liste: L("a"), oran: "16:9" }));
  assert.equal(r.durum, "bitti"); assert.equal(v2.durum.basladi.length, 1); assert.equal(v2.durum.basladi[0].aspectRatio, "16:9");
  assert.ok(!v2.durum.pollar.includes("dikey-is"));
  assert.equal(kayit(d2).klipler[1].oran, "16:9");
});

test("duplicate_submission: mevcut is no kaydedilir ve UCRETSIZ sorgulanir (hata kredi diye siniflansa da)", async () => {
  let ilk = true;
  const v = sahteVidiq(1000, 15, { gonder: () => {
    if (ilk) { ilk = false; return vHata("vidiq_kredi", "vidIQ isteği reddetti (vidiq_generate_video): duplicate_submission: an identical shot was submitted recently, no credits were charged. Poll the existing mcpJobId \"job-777abc\" instead."); }
  } });
  const dizin = gecici();
  const r = await K.uret(temel(dizin, v, { liste: L("a", "b") }));
  assert.equal(r.durum, "bitti"); assert.equal(r.dosyalar.length, 2);
  assert.equal(v.durum.basladi.length, 1, "yalniz b ucretli baslar");
  assert.ok(v.durum.pollar.includes("job-777abc"));
  assert.equal(kayit(dizin).klipler[0].isNo, "job-777abc");
  assert.equal(r.harcanan, 75, "duplicate ucret almaz");
  assert.equal(K.tekrarIsNo(new Error('duplicate_submission {"mcpJobId":"mcp_9f3a1c"}')).no, "mcp_9f3a1c");
  assert.equal(K.tekrarIsNo(new Error("duplicate_submission: poll the existing mcpJobId with vidiq_job_poll")).no, "");
  assert.equal(K.tekrarIsNo(new Error("baska hata")), null);
});

test("listede ayni istem iki kez: ikinci satir yeniCekim olmadan ATLANIR; yeniCekim ile confirmNewAttempt gider", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  const r1 = await K.uret(temel(dizin, v, { liste: L("a", "a", "b") }));
  assert.equal(r1.durum, "bitti"); assert.equal(r1.tekrar, 1); assert.equal(v.durum.basladi.length, 2);
  assert.ok(v.durum.basladi.every(x => !x.confirmNewAttempt));
  const kuru = await K.uret(temel(dizin, v, { liste: L("a", "a", "b"), yeniCekim: true, onay: false }));
  assert.equal(kuru.uretilecek, 1); assert.equal(kuru.ekCekim, 1); assert.equal(kuru.tahminiKredi, 100);
  const r2 = await K.uret(temel(dizin, v, { liste: L("a", "a", "b"), yeniCekim: true }));
  assert.equal(r2.dosyalar.length, 1); assert.equal(v.durum.basladi.length, 3); assert.equal(v.durum.basladi[2].confirmNewAttempt, true);
  const r3 = await K.uret(temel(dizin, v, { liste: L("a", "a", "b"), yeniCekim: true }));
  assert.equal(r3.durum, "hepsi_hazir"); assert.equal(v.durum.basladi.length, 3);
});

test("dosyasi silinen teslim klip UCRETSIZ yeniden indirilir; yeniCekim ile yeni ucretli surum uretilir", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  await K.uret(temel(dizin, v, { liste: L("a") }));
  fs.rmSync(path.join(dizin, "001-minimax-h3.mp4"));
  const kuru = await K.uret(temel(dizin, v, { liste: L("a"), butce: 0, onay: false }));
  assert.equal(kuru.surdurulecek, 1); assert.equal(kuru.uretilecek, 0);
  const r1 = await K.uret(temel(dizin, v, { liste: L("a"), butce: 0 }));
  assert.equal(r1.durum, "bitti"); assert.equal(r1.harcanan, 0); assert.equal(v.durum.basladi.length, 1);
  assert.deepEqual(v.durum.pollar, ["is-1", "is-1"]);
  assert.ok(fs.existsSync(path.join(dizin, "001-minimax-h3.mp4")));
  fs.rmSync(path.join(dizin, "001-minimax-h3.mp4"));
  const r2 = await K.uret(temel(dizin, v, { liste: L("a"), yeniCekim: true }));
  assert.equal(r2.dosyalar.length, 1); assert.equal(v.durum.basladi.length, 2); assert.equal(v.durum.basladi[1].confirmNewAttempt, true);
  assert.equal(kayit(dizin).klipler[0].durum, "yenilendi");
  const r3 = await K.uret(temel(dizin, v, { liste: L("a") }));
  assert.equal(r3.durum, "hepsi_hazir");
});

test("gonderimde acik red (content_policy) yalniz o klibi atlar; tasima hatasi kosuyu keser", async () => {
  const v = sahteVidiq(1000, 15, { gonder: arg => arg.prompt === "a" ? vHata("vidiq_ag", "vidIQ isteği reddetti (vidiq_generate_video): content_policy_rejected") : null });
  const dizin = gecici();
  const r = await K.uret(temel(dizin, v, { liste: L("a", "b") }));
  assert.equal(r.durum, "kismi"); assert.equal(r.dosyalar.length, 1); assert.equal(r.basarisiz.length, 1);
  assert.match(r.basarisiz[0].cozum, /İstemi/);
  assert.equal(kayit(dizin).klipler.length, 1);
  const v2 = sahteVidiq(1000, 15, { gonder: () => vHata("vidiq_ag", "vidIQ'ya ulaşılamadı (ECONNRESET). İnternet bağlantını kontrol et.") });
  await assert.rejects(K.uret(temel(gecici(), v2, { liste: L("a", "b") })), e => e.kod === "vidiq_ag");
});

test("indirilen govde video degilse YAZILMAZ, is korunur; sonraki kosu ayni isi ucretsiz yeniden indirir", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  const r1 = await K.uret(temel(dizin, v, { liste: L("a"), indir: async () => Buffer.from("<!DOCTYPE html><html>erisim yok</html>") }));
  assert.equal(r1.dosyalar.length, 0); assert.equal(r1.basarisiz.length, 1); assert.match(r1.basarisiz[0].neden, /video değil/);
  assert.deepEqual(fs.readdirSync(dizin).filter(f => f.endsWith(".mp4")), []);
  const g = kayit(dizin).klipler[0];
  assert.equal(g.isNo, "is-1"); assert.equal(g.dosya, ""); assert.equal(g.url, "https://cdn.example.com/is-1.mp4");
  const r2 = await K.uret(temel(dizin, v, { liste: L("a") }));
  assert.equal(r2.durum, "bitti"); assert.equal(v.durum.basladi.length, 1);
});

test("CLI: indirmenin toplam sure siniri 200 MB'a gore (120 sn degil)", async () => {
  let secenek = null;
  const getir = { gorsel: async (u, o) => { secenek = o; return { govde: MP4 }; } };
  assert.equal(await C.indirici(getir)("https://cdn.x/v.mp4"), MP4);
  assert.equal(secenek.maksBayt, 200 * 1024 * 1024);
  assert.ok(secenek.toplamAsimiMs >= 15 * 60 * 1000, "toplam sure en az 15 dk olmali");
  assert.equal(C.cikisKodu({ durum: "bitti" }), 0); assert.equal(C.cikisKodu({ durum: "kuru_calisma" }), 0);
});

test("CLI: kuru calisma ozeti surdurulecek (ucreti odenmis) klipleri ayri yazar, tekrar satirini uyarir", async () => {
  const kok = gecici();
  const eskiU = process.env.OTOMASYON_URETIM, eskiE = process.env.OTOMASYON_ENV_DOSYASI;
  process.env.OTOMASYON_URETIM = kok; process.env.OTOMASYON_ENV_DOSYASI = path.join(kok, "yok.env");
  try {
    const clips = path.join(kok, "klipis", "Clips"), voice = path.join(kok, "klipis", "Voice");
    fs.mkdirSync(clips, { recursive: true }); fs.mkdirSync(voice, { recursive: true });
    fs.writeFileSync(path.join(clips, "klipler.json"), JSON.stringify({ klipler: [{ istem: "a", sure: 5, model: "minimax-h3", cozunurluk: "768p", isNo: "eski-is", dosya: "" }] }));
    fs.writeFileSync(path.join(voice, "KLIPLER.txt"), "a | 5\nb | 5\nb | 5\n");
    const v = sahteVidiq(1000, 15), cikti = [];
    const r = await C.calistir(["klipis", "--butce", "300"], { vidiq: v, indir, log: m => cikti.push(m) });
    const metin = cikti.join("\n");
    assert.equal(r.durum, "kuru_calisma");
    assert.match(metin, /1 sürdürülecek \(ücreti ödenmiş/); assert.match(metin, /1 üretilecek/); assert.match(metin, /tahmini en çok 100 kredi/);
    assert.match(metin, /1 tekrar satırı atlandı/); assert.match(metin, /--yeni-cekim/);
    assert.equal(v.durum.basladi.length, 0); assert.equal(v.durum.pollar.length, 0);
  } finally {
    if (eskiU === undefined) delete process.env.OTOMASYON_URETIM; else process.env.OTOMASYON_URETIM = eskiU;
    if (eskiE === undefined) delete process.env.OTOMASYON_ENV_DOSYASI; else process.env.OTOMASYON_ENV_DOSYASI = eskiE;
  }
});
