// vidIQ klip uretimi: kuru calisma, butce korumasi, tekrar uretmeme, yarim isi surdurme. Gercek vidIQ'ya/krediye DOKUNMAZ.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const K = require("../lib/vidiq-klip.js");

const gecici = () => fs.mkdtempSync(path.join(os.tmpdir(), "vidiq-klip-"));

// sahte vidIQ: bakiye her generate_video'da dusuk/duz ucretle azalir
function sahteVidiq(bas, ucretSn) {
  const durum = { bakiye: bas, basladi: [], pollar: 0 };
  return {
    durum,
    async cagir(arac, arg) {
      if (arac === "vidiq_balance") return { totalCredits: durum.bakiye };
      if (arac === "vidiq_generate_video") { durum.basladi.push(arg); durum.bakiye -= arg.duration * ucretSn; return { mcpJobId: "is-" + durum.basladi.length }; }
      throw new Error("beklenmeyen arac " + arac);
    },
    async isBekle(no) { durum.pollar++; return { videoUrl: "https://cdn.example.com/" + no + ".mp4" }; },
  };
}
const indir = async () => Buffer.from("mp4-verisi");

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

test("yarim kalan is (indirilmemis) yeniden BASLATILMAZ, ayni is no ile surer", async () => {
  const v = sahteVidiq(1000, 15), dizin = gecici();
  fs.mkdirSync(dizin, { recursive: true });
  fs.writeFileSync(path.join(dizin, "klipler.json"), JSON.stringify({ klipler: [{ istem: "a", sure: 5, model: "minimax-h3", cozunurluk: "768p", isNo: "eski-is", dosya: "" }] }));
  const r = await K.uret({ liste: [{ istem: "a", sure: 5 }], model: "minimax-h3", cozunurluk: "768p", oran: "9:16", dizin, butce: 300, onay: true, vidiq: v, indir });
  assert.equal(r.durum, "bitti"); assert.equal(v.durum.basladi.length, 0, "generate_video cagrilmamali");
});
