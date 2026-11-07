// 3B model bul: arama puani, dort kaynak (sahte ag), glTF -> tek GLB paketleme, indirme + atif, anahtarsiz Sketchfab hatasi. Gercek aga dokunmaz.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const KOK = fs.mkdtempSync(path.join(os.tmpdir(), "model-bul-"));
process.env.OTOMASYON_URETIM = path.join(KOK, "uretim");
fs.mkdirSync(process.env.OTOMASYON_URETIM, { recursive: true });
test.after(() => fs.rmSync(KOK, { recursive: true, force: true }));
const M = require("../lib/model-bul.js");

function glbOku(b) {
  assert.equal(b.subarray(0, 4).toString(), "glTF");
  assert.equal(b.readUInt32LE(8), b.length, "toplam uzunluk");
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jl).toString("utf8"));
  const bl = b.readUInt32LE(20 + jl);
  return { json, bin: b.subarray(28 + jl, 28 + jl + bl) };
}
const ab = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.length);   // Buffer havuzundan degil kendi baytlarindan
const sahteGlb = () => { const g = M.glbPaketle({ asset: { version: "2.0" }, buffers: [{ byteLength: 4, uri: "a.bin" }], bufferViews: [{ buffer: 0, byteLength: 4 }] }, () => Buffer.from([1, 2, 3, 4])); return g; };

test("sade/puan: Turkce I/i, aksan, kelime eslesmesi", () => {
  assert.equal(M.sade("ISPARTA Şapka"), "isparta sapka");
  assert.ok(M.puan("ship", "Dutch Ship Large 01") >= 1);
  assert.ok(M.puan("dutch ship", "Dutch Ship Large") > M.puan("dutch ship", "Ship Anchor"));
  assert.equal(M.puan("kedi", "Dutch Ship"), 0);
  assert.equal(M.kisaAd("Hubble Space Telescope (A)"), "hubble-space-telescope-a");
});

test("glbPaketle: dis tampon ve resimler tek GLB'ye girer, 4 bayt hizali, uri kalmaz", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const dosyalar = { "m.bin": Buffer.alloc(12, 7), "textures/a b.png": png };
  const g = M.glbPaketle({
    asset: { version: "2.0" }, buffers: [{ byteLength: 12, uri: "m.bin" }],
    bufferViews: [{ buffer: 0, byteOffset: 4, byteLength: 8 }],
    images: [{ uri: "textures/a%20b.png" }],
  }, uri => { const k = decodeURIComponent(uri); if (!dosyalar[k]) throw new Error("yok " + k); return dosyalar[k]; });
  const { json, bin } = glbOku(g);
  assert.equal(g.length % 4, 0);
  assert.equal(json.buffers.length, 1); assert.equal(json.buffers[0].uri, undefined);
  assert.equal(json.images[0].uri, undefined); assert.equal(json.images[0].mimeType, "image/png");
  const bv = json.bufferViews[json.images[0].bufferView];
  assert.deepEqual([...bin.subarray(bv.byteOffset, bv.byteOffset + bv.byteLength)], [...png]);
  assert.equal(json.bufferViews[0].byteOffset, 4, "ilk tampon 0'dan basladigi icin ofset ayni");
  assert.throws(() => M.glbPaketle({ buffers: [{ byteLength: 1, uri: "yok.bin" }] }, () => { throw new Error("eksik"); }), /eksik/);
});

function sahteAg(kayit) {
  return async (url) => {
    kayit.push(url);
    const ok = (govde, tur) => ({ ok: true, status: 200, json: async () => govde, arrayBuffer: async () => ab(Buffer.isBuffer(govde) ? govde : Buffer.from(JSON.stringify(govde))) });
    if (/api\.polyhaven\.com\/assets\?type=models/.test(url)) return ok({ ship_01: { name: "Dutch Ship", categories: ["vehicles"], tags: ["ship", "boat"], authors: { Ali: "All" } }, chair_01: { name: "Chair", categories: ["furniture"], tags: ["chair"], authors: {} } });
    if (/api\.polyhaven\.com\/files\/ship_01/.test(url)) return ok({ gltf: { "1k": { gltf: { url: "https://dl.polyhaven.org/ship.gltf", include: { "ship.bin": { url: "https://dl.polyhaven.org/ship.bin" } } } } } });
    if (url === "https://dl.polyhaven.org/ship.gltf") return ok({ asset: { version: "2.0" }, buffers: [{ byteLength: 4, uri: "ship.bin" }], bufferViews: [{ buffer: 0, byteLength: 4 }] });
    if (url === "https://dl.polyhaven.org/ship.bin") return ok(Buffer.from([9, 9, 9, 9]));
    if (/api\.github\.com\/repos\/nasa/.test(url)) return ok({ tree: [{ path: "3D Models/Hubble Space Telescope (A)/Hubble Space Telescope (A).glb", size: 1000 }, { path: "3D Models/Readme.md", size: 5 }, { path: "3D Models/Apollo/Apollo.glb", size: 2000 }] });
    if (/raw\.githubusercontent\.com\/nasa/.test(url)) return ok(sahteGlb());
    if (/3d-api\.si\.edu\/api\/v1\.0\/content\/file\/search/.test(url)) return ok({ rows: [
      { title: "Bell X-1", content: { file_type: "glb", quality: "Thumb", uri: "https://3d-api.si.edu/content/document/3d_package:x/https://cdn.3d-api.si.edu/x/bell-thumb.glb", model_url: "3d_package:x" } },
      { title: "Bell X-1", content: { file_type: "glb", quality: "AR", draco_compressed: true, uri: "https://3d-api.si.edu/content/document/3d_package:x/https://cdn.3d-api.si.edu/x/bell_std_draco.glb", model_url: "3d_package:x" } },
      { title: "Bell X-1", content: { file_type: "glb", quality: "Medium", uri: "https://3d-api.si.edu/content/document/3d_package:x/https://cdn.3d-api.si.edu/x/bell-medium.glb", model_url: "3d_package:x" } }] });
    if (/cdn\.3d-api\.si\.edu/.test(url)) return ok(sahteGlb());
    if (/api\.sketchfab\.com\/v3\/search/.test(url)) return ok({ results: [
      { uid: "u1", name: "Boat A", license: { label: "CC Attribution" }, user: { displayName: "Ayse" }, viewerUrl: "https://sketchfab.com/3d-models/boat-a-u1" },
      { uid: "u2", name: "Boat NC", license: { label: "CC Attribution-NonCommercial" }, user: {} },
      { uid: "u3", name: "Boat SA", license: { label: "CC Attribution-ShareAlike" }, user: {} }] });
    return { ok: false, status: 404 };
  };
}

test("ara: dort kaynak, lisans suzgeci (Sketchfab NC/SA elenir), Smithsonian'da tam model (AR) secilir, numaralanir", async () => {
  const kayit = [];
  const r = await M.ara("ship", { fetch: sahteAg(kayit), taze: true });
  const kaynaklar = r.sonuclar.map(x => x.kaynak);
  assert.ok(kaynaklar.includes("polyhaven") && kaynaklar.includes("sketchfab") && kaynaklar.includes("smithsonian"));
  assert.deepEqual(r.sonuclar.map(x => x.no), r.sonuclar.map((_, i) => i + 1));
  assert.equal(r.sonuclar.filter(x => x.kaynak === "sketchfab").length, 1, "yalniz CC BY kaldi");
  const si = r.sonuclar.find(x => x.kaynak === "smithsonian");
  assert.match(si.indir, /bell_std_draco\.glb$/); assert.equal(si.draco, true);
  assert.ok(!r.sonuclar.some(x => /Chair/.test(x.ad)), "alakasiz model yok");
  const n = await M.ara("hubble", { kaynaklar: ["nasa"], fetch: sahteAg(kayit), taze: true });
  assert.equal(n.sonuclar.length, 1); assert.match(n.sonuclar[0].indir, /Hubble%20Space%20Telescope%20\(A\)\.glb$/);
  await assert.rejects(M.ara("  ", {}), /Arama metni boş/);
});

test("indir: Poly Haven glTF tek GLB olur; NASA/Smithsonian dogrudan; KAYNAK.txt ve atif yazilir; stüdyo isine kopyalanir", async () => {
  const kayit = [], ag = sahteAg(kayit);
  await M.ara("ship", { kaynaklar: ["polyhaven"], fetch: ag, taze: true });
  const r = await M.indir(1, { fetch: ag, bekleMs: 0 });
  assert.equal(r.sonuc.kaynak, "polyhaven");
  const { json, bin } = glbOku(fs.readFileSync(r.glb));
  assert.equal(json.buffers[0].uri, undefined); assert.deepEqual([...bin.subarray(0, 4)], [9, 9, 9, 9]);
  const kaynakTxt = fs.readFileSync(path.join(r.dizin, "KAYNAK.txt"), "utf8");
  assert.match(kaynakTxt, /Lisans: CC0/); assert.match(kaynakTxt, /Dutch Ship/); assert.match(r.atif, /Poly Haven \(CC0\)/);

  // stüdyo isi
  const is = path.join(process.env.OTOMASYON_URETIM, "film1");
  fs.mkdirSync(is, { recursive: true }); fs.writeFileSync(path.join(is, "studyo.json"), "{}");
  await M.ara("hubble", { kaynaklar: ["nasa"], fetch: ag, taze: true });
  const n = await M.indir(1, { fetch: ag, is: "film1", bekleMs: 0 });
  assert.ok(fs.existsSync(path.join(is, "girdi", "hubble-space-telescope-a.glb")));
  assert.match(fs.readFileSync(path.join(is, "ATIF.txt"), "utf8"), /NASA 3D Resources/);
  assert.equal(n.kopya, path.join(is, "girdi", "hubble-space-telescope-a.glb"));
  await assert.rejects(M.indir(1, { fetch: ag, is: "yok-is", bekleMs: 0 }), /Böyle bir stüdyo işi yok/);
  await assert.rejects(M.indir(99, { fetch: ag }), /99 numaralı sonuç yok/);
});

test("Sketchfab indirme anahtarsiz acik hata verir; GLB olmayan dosya reddedilir; gecici ag hatasi yeniden denenir", async () => {
  const ag = sahteAg([]);
  await M.ara("boat", { kaynaklar: ["sketchfab"], fetch: ag, taze: true });
  delete process.env.SKETCHFAB_TOKEN;
  await assert.rejects(M.indir(1, { fetch: ag, bekleMs: 0 }), e => /SKETCHFAB_TOKEN/.test(e.cozum || ""));

  const kotu = async (url) => (/api\.github\.com/.test(url) ? { ok: true, status: 200, json: async () => ({ tree: [{ path: "3D Models/Rocket/Rocket.glb", size: 10 }] }) } : { ok: true, status: 200, arrayBuffer: async () => ab(Buffer.from("<html>hata</html>")) });
  await M.ara("rocket", { kaynaklar: ["nasa"], fetch: kotu, taze: true });
  await assert.rejects(M.indir(1, { fetch: kotu, bekleMs: 0 }), /gerçek bir GLB değil/);

  let n = 0;
  const kesik = async (url) => { n++; if (n < 3) throw new Error("fetch failed"); return { ok: true, status: 200, json: async () => ({ tree: [] }) }; };
  const r = await M.ara("rocket", { kaynaklar: ["nasa"], fetch: kesik, taze: true, bekleMs: 0 });
  assert.equal(r.sonuclar.length, 0); assert.equal(n, 3, "iki kez yeniden denedi");
});
