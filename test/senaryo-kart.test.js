// formul-kart.js ve prompt-kart.js testleri: GERCEK ffmpeg (lavfi ile sentetik zemin); ag yok.
"use strict";
const Y = require("./senaryo-yardim");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

let FF = null, FP = null;
try { const f = require("../ff-yol"); FF = f.ffmpeg; FP = f.ffprobe; } catch (e) { /* ffmpeg yok: testler atlanir */ }
const atla = FF ? false : "ffmpeg kurulu degil";

const FK = require("../formul-kart");
const PK = require("../prompt-kart");
const KT = require("../lib/senaryo-kart");
const ortak = require("../lib/ortak");

let sayac = 0;
const yeniIs = (konu) => { const ad = "senaryotest-k" + (++sayac); const d = Y.isOlustur(ad, konu); return { ad, d }; };
const boyut = (dosya) => {
  const j = JSON.parse(execFileSync(FP, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", dosya], { encoding: "utf8" }));
  return j.streams[0];
};
const sessiz = fn => Y.sessiz(fn);

test("formul-kart: ozel karakterli metin, uzun formul, sahne klasorune yazim; .part/_tmp artigi yok", { skip: atla }, async () => {
  const { ad, d } = yeniIs({ baslik_en: "F", _not: "k", format: "long", vurguRenk: "FFAA00", formuller: [
    { n: "e-mc2", ust: "Bob's: 100% Facts \\ test", ana: "E = mc²", alt: "Einstein, 1905", hedef: "001-einstein" },
    { n: "uzun", ust: "Çok uzun", ana: "∮ E·dA = Q/ε₀ ve ∇×B = μ₀J + μ₀ε₀ ∂E/∂t Maxwell denklemleri bir arada yazilinca sigmaz", alt: "x" },
  ] });
  // zemin: baska bir sahne klasorundeki gorsel + _eski klasoru atlanir
  fs.mkdirSync(path.join(d, "Visuals", "002-zemin"), { recursive: true });
  // -threads 1: mjpeg kodlayicisi varsayilan "auto"da cekirdek basina kopya acar, bellek darken ENOMEM (test/render-fikstur.js ff)
  execFileSync(FF, ["-y", "-f", "lavfi", "-i", "color=c=blue:s=640x360", "-frames:v", "1", "-threads", "1", path.join(d, "Visuals", "002-zemin", "01.jpg")], { stdio: "ignore" });
  fs.mkdirSync(path.join(d, "Visuals", "_eski-20260101-000000"), { recursive: true });
  fs.writeFileSync(path.join(d, "Visuals", "_eski-20260101-000000", "01.jpg"), "bozuk");

  const r = await sessiz(() => FK.ana([ad]));
  assert.equal(r.kart, 2);
  const a = path.join(d, "Visuals", "001-einstein", "90-formul-e-mc2.jpg");
  const b = path.join(d, "Visuals", "14-formuller", "90-formul-uzun.jpg");
  for (const f of [a, b]) {
    assert.ok(fs.statSync(f).size > 5000, f);
    const s = boyut(f);
    assert.equal(s.width, 1920);
    assert.equal(s.height, 1080);
  }
  assert.ok(!fs.existsSync(path.join(d, "_tmp")), "gecici metin dosyalari temizlenmeli");
  assert.ok(!fs.readdirSync(path.join(d, "Visuals", "001-einstein")).some(x => /\.part\./.test(x)));
  assert.ok(!fs.existsSync(path.join(d, ".kilit")));
});

test("formul-kart: formuller yoksa uyari ve cikis 0; zemin yoksa duz koyu zeminle uretir", { skip: atla }, async () => {
  const { ad } = yeniIs({ baslik_en: "F", _not: "k", format: "long" });
  assert.deepEqual(await sessiz(() => FK.ana([ad])), { kart: 0 });
  const { ad: ad2, d } = yeniIs({ baslik_en: "F", _not: "k", format: "long", formuller: [{ n: "a", ust: "u", ana: "x = 1", alt: "z" }] });
  await sessiz(() => FK.ana([ad2]));
  assert.ok(fs.existsSync(path.join(d, "Visuals", "14-formuller", "90-formul-a.jpg")));
});

test("kart betikleri: konu.json'daki yol bilesenleri dogrulanir (../ ile proje disina yazilamaz)", async () => {
  const { ad } = yeniIs({ baslik_en: "F", _not: "k", format: "long", formuller: [{ n: "a", ana: "x", hedef: "../../disari" }] });
  await assert.rejects(sessiz(() => FK.ana([ad])), e => e.kod === "konu_gecersiz" && e.cikis === 2);
  const { ad: ad2 } = yeniIs({ baslik_en: "P", _not: "k", format: "long", promptlar: [{ baslik: "b", satirlar: ["x"], hedef: "a/b" }] });
  await assert.rejects(sessiz(() => PK.ana([ad2])), e => e.kod === "konu_gecersiz" && e.cikis === 2);
  assert.throws(() => KT.adDogrula("..", "hedef"), e => e.cikis === 2);
  assert.throws(() => KT.adDogrula("a\\b", "n"), e => e.cikis === 2);
  assert.equal(KT.adDogrula("001-sahne ad_1", "hedef"), "001-sahne ad_1");
  await assert.rejects(sessiz(() => FK.ana([])), e => e.cikis === 2);
  await assert.rejects(sessiz(() => FK.ana(["senaryotest-yok-is"])), e => e.cikis === 2);
  // metin alani siniri
  assert.throws(() => KT.metinDogrula("x".repeat(500), "ust", 120), e => e.cikis === 2);
});

test("prompt-kart.yerlestir: uzun satir sarilir, cok satirda punto kuculur, yine sigmazsa kesilir", () => {
  const uzun = "$ claude --print " + "cok-uzun-arguman ".repeat(15);
  const k1 = PK.yerlestir(["# yorum", uzun, "> cikti"]);
  assert.equal(k1.punto, 32);
  assert.ok(k1.satirlar.length > 3, "uzun satir sarilmali");
  assert.ok(k1.satirlar.filter(s => s.tip === "komut").length >= 2, "devam satirlari komut rengini korur");
  assert.ok(k1.satirlar.every(s => Array.from(s.metin).length <= Math.floor(1548 / (32 * 0.6))));
  const k2 = PK.yerlestir(Array.from({ length: 15 }, (_, i) => "satir " + i));
  assert.equal(k2.punto, 28);
  assert.equal(k2.kesildi, false);
  const k3 = PK.yerlestir(Array.from({ length: 40 }, (_, i) => "satir " + i));
  assert.equal(k3.kesildi, true);
  assert.equal(k3.satirlar[k3.satirlar.length - 1].metin, "...");
  assert.equal(k3.satirlar.length, k3.maksSatir);
});

test("prompt-kart: tirnak/iki nokta/yuzde/ters egik cizgi iceren satirlarla kart uretir; uzun ve cok satir kesilir", { skip: atla }, async () => {
  const satirlar = ["$ git commit -m 'fix: 100% done'", "> C:\\Users\\ornek\\proje 50%", "# not: ' \" : % \\", "[etiket] deger"]
    .concat(Array.from({ length: 30 }, (_, i) => "satir numara " + i + " " + "uzun ".repeat(20)));
  const { ad, d } = yeniIs({ baslik_en: "P", _not: "k", format: "long", promptlar: [
    { baslik: "claude: 'terminal' 100%", satirlar, alt: "alt etiket: 50%", hedef: "003-demo" },
    { baslik: "ikinci", satirlar: ["$ ls"] },
  ] });
  const cikti = [];
  const r = await Y.sessiz(async (c) => { const x = await PK.ana([ad]); cikti.push(...c); return x; });
  assert.equal(r.kart, 2);
  assert.ok(cikti.some(x => /@@UYARI promptlar\[0\]: satırlar pencereye sığmadı/.test(x)));
  assert.ok(cikti.some(x => /@@UYARI Prompt kartlarına 'hedef'/.test(x)) === false, "ilk kartta hedef var: uyari yok");
  const a = path.join(d, "Visuals", "003-demo", "95-prompt-01.jpg");
  const b = path.join(d, "Visuals", "90-promptlar", "95-prompt-02.jpg");
  for (const f of [a, b]) { assert.ok(fs.statSync(f).size > 3000); assert.equal(boyut(f).width, 1920); }
  assert.ok(!fs.existsSync(path.join(d, "_tmp")));
});
