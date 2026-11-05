// Studyo 3B urun sahnesinde kendi GLB modelin: dogrulama, kur'da yol aktarimi + onbellek anahtari, panel yukleme guvenligi. Sahte cizici; gercek cizim OTOPILOT_3D_TEST=1 ile.
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
const S3 = require("../lib/sahne3d.js");
const ff = () => require("../ff-yol.js");
const sessiz = { log: () => {} };

// tek ucgenli, gecerli minimum GLB
function ucgenGlb(x) {
  const bin = Buffer.alloc(36); [-1, -1, 0, 1, -1, 0, 0, x || 1, 0].forEach((v, i) => bin.writeFloatLE(v, i * 4));
  const json = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36, target: 34962 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [-1, -1, 0], max: [1, x || 1, 0] }] };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const bas = Buffer.alloc(12); bas.write("glTF", 0); bas.writeUInt32LE(2, 4); bas.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([bas, c1, js, c2, bin]);
}

test("sahne3dEkle --glb: dosya adi ve varlik dogrulanir; ayar dosyasina yazilir", { skip }, () => {
  const r = S.yeni("glb1", { stil: "serbest" });
  assert.throws(() => S.sahne3dEkle("glb1", "urun", { glb: "yok.glb" }), /GLB bulunamadı/);
  assert.throws(() => S.sahne3dEkle("glb1", "urun", { glb: "kotu ad.glb" }), /GLB dosya adı geçersiz/);
  assert.throws(() => S.sahne3dEkle("glb1", "urun", { glb: "model.obj" }), /GLB dosya adı geçersiz/);
  fs.writeFileSync(path.join(r.girdi, "urun.glb"), ucgenGlb());
  assert.equal(S.sahne3dEkle("glb1", "urun", { glb: "urun.glb", baslik: "Benim urunum" }), 1);
  assert.equal(S.ayarOku("glb1").sahneler[0].parametre.glb, "urun.glb");
  // elle bozulan ayar reddedilir
  const y = path.join(kok, "glb1", "studyo.json"), a = JSON.parse(fs.readFileSync(y, "utf8"));
  a.sahneler[0].parametre.glb = "../../disari.glb"; fs.writeFileSync(y, JSON.stringify(a));
  assert.throws(() => S.ayarOku("glb1"), /glb girdi\/ içindeki/);
});

test("kur: GLB yolu cizici'ye gecer; model degisince yeniden cizilir; dosya yoksa acik hata", { skip }, async () => {
  const r = S.yeni("glb2", { stil: "serbest" });
  const glb = path.join(r.girdi, "urun.glb");
  fs.writeFileSync(glb, ucgenGlb(1));
  S.sahne3dEkle("glb2", "urun", { glb: "urun.glb" });
  const cizilen = [];
  const sahteCizici = async o => {
    cizilen.push(o); fs.mkdirSync(path.dirname(o.cikti), { recursive: true });
    execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=" + o.genislik + "x" + o.yukseklik + ":r=30", "-t", String(o.sure), "-pix_fmt", "yuv420p", o.cikti]);
  };
  const enj = Object.assign({ ciz3d: sahteCizici }, sessiz);
  await S.kur("glb2", { sesnormalsiz: true }, enj);
  assert.equal(cizilen.length, 1); assert.equal(path.resolve(cizilen[0].model), path.resolve(glb));
  await S.kur("glb2", { sesnormalsiz: true }, enj);
  assert.equal(cizilen.length, 1, "ayni model: onbellek");
  fs.writeFileSync(glb, ucgenGlb(2));
  await S.kur("glb2", { sesnormalsiz: true }, enj);
  assert.equal(cizilen.length, 2, "model icerigi degisti: yeniden cizildi");
  fs.rmSync(glb);
  await assert.rejects(S.kur("glb2", { sesnormalsiz: true }, enj), /GLB model bulunamadı/);
});

test("GERCEK cizim (OTOPILOT_3D_TEST=1): kendi GLB modeli urun sahnesinde cizilir", { skip: process.env.OTOPILOT_3D_TEST !== "1" && "OTOPILOT_3D_TEST=1 ile calisir", timeout: 300000 }, async () => {
  assert.ok(S3.chromeBul(), "Chrome/Edge yok");
  const model = path.join(kok, "gercek.glb"); fs.writeFileSync(model, ucgenGlb());
  const cikti = path.join(kok, "gercek-glb.mp4");
  const r = await S3.ciz({ sablon: "urun", parametre: { baslik: "GLB" }, model, sure: 1, genislik: 360, yukseklik: 640, fps: 30, cikti, log: () => {} });
  assert.equal(r.kare, 30);
});
