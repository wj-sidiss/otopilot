// 3B MODEL BUL (acik lisansli kaynaklar): arama, tek dosya .glb indirme, lisans/atif kaydi.
// Kaynaklar:
//   polyhaven    Poly Haven: ~520 model (mobilya, bina, arac, doga), CC0. glTF + dokular -> tek .glb'ye paketlenir.
//   nasa         NASA 3D Resources (GitHub): ~260 .glb (uzay araclari, gezegenler, roketler), kamu mali; NASA logosu/onay ima etme.
//   smithsonian  Smithsonian 3D API: muze taramalari (.glb, Draco sikistirmali), Open Access; atif onerilir, sayfadan dogrula.
//   sketchfab    Sketchfab: arama anahtarsiz; INDIRME icin kullanicinin ucretsiz SKETCHFAB_TOKEN'i gerekir. Yalniz CC0 ve CC BY
//                (NC/ND/SA elenir); CC BY'de yazar atfi ZORUNLU (KAYNAK.txt'te hazir metin).
// Yalnizca resmi API'ler; acik bir User-Agent; sonuclar uretim/_modeller/.onbellek icinde 1 gun saklanir.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ortak = require("./ortak.js");
const UA = "Otopilot-model-bul/1.0 (+https://github.com/wj-sidiss/otopilot)";
const KAYNAKLAR = ["polyhaven", "nasa", "smithsonian", "sketchfab"];
const MAKS_BOYUT = 120 * 1024 * 1024;

const kok = () => path.join(ortak.uretimDizini(), "_modeller");
const hata = (m, cozum, cikis) => Object.assign(new Error(m), { cikis: cikis || 2, cozum });

// Turkce yerel ayardan bagimsiz sadelestirme (arama eslesmesi icin)
function sade(s) {
  return String(s || "").replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i").toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function kisaAd(s) { return sade(s).replace(/ /g, "-").slice(0, 60) || "model"; }

// ---------------------------------------------------------------- ag
async function getir(url, o) {
  const f = (o && o.fetch) || fetch;
  let r, son;
  for (let deneme = 0; deneme < 3; deneme++) {          // gecici ag kopmasi (fetch failed / 5xx): 2 kez daha dene
    try { r = await f(url, { headers: Object.assign({ "user-agent": UA }, (o && o.basliklar) || {}) }); if (r.status < 500) break; }
    catch (e) { son = e; r = null; }
    if (deneme < 2) await new Promise(k => setTimeout(k, (o && o.bekleMs !== undefined ? o.bekleMs : 1500) * (deneme + 1)));
  }
  if (!r) throw hata("Bağlantı kurulamadı: " + url.replace(/[?#].*$/, "") + " (" + String((son && son.message) || son) + ")", "İnterneti kontrol edip tekrar dene.", 3);
  if (!r.ok) throw hata("İstek başarısız (HTTP " + r.status + "): " + url.replace(/[?#].*$/, ""), "İnterneti kontrol edip tekrar dene.", 3);
  return r;
}
async function json(url, o) { return (await getir(url, o)).json(); }
async function ikili(url, o) {
  const r = await getir(url, o);
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length > MAKS_BOYUT) throw hata("Dosya çok büyük (" + Math.round(b.length / 1e6) + " MB).", "Daha küçük bir model seç.", 2);
  return b;
}
// gunluk onbellek (polyhaven listesi, nasa agaci gibi buyuk listeler)
async function onbellekli(ad, uret, o) {
  const d = path.join(kok(), ".onbellek");
  const y = path.join(d, ad + ".json");
  try { const st = fs.statSync(y); if (Date.now() - st.mtimeMs < 864e5 && !(o && o.taze)) return JSON.parse(fs.readFileSync(y, "utf8")); } catch (e) { /* yok */ }
  const v = await uret();
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(y, JSON.stringify(v));
  return v;
}

// basit puan: sorgu kelimelerinin metinde gecme orani
function puan(sorgu, metin) {
  const k = sade(sorgu).split(" ").filter(Boolean), m = " " + sade(metin) + " ";
  if (!k.length) return 0;
  let p = 0;
  for (const w of k) { if (m.includes(" " + w + " ")) p += 2; else if (m.includes(w)) p += 1; }
  return p / (2 * k.length);
}

// ---------------------------------------------------------------- kaynaklar: ara
async function araPolyhaven(q, n, o) {
  const liste = await onbellekli("polyhaven-models", () => json("https://api.polyhaven.com/assets?type=models", o), o);
  return Object.entries(liste)
    .map(([id, a]) => ({ id, a, p: puan(q, [id, a.name, (a.tags || []).join(" "), (a.categories || []).join(" ")].join(" ")) }))
    .filter(x => x.p >= 0.5).sort((x, y) => y.p - x.p).slice(0, n)
    .map(({ id, a }) => ({ kaynak: "polyhaven", id, ad: a.name || id, yazar: Object.keys(a.authors || {}).join(", "), lisans: "CC0",
      sayfa: "https://polyhaven.com/a/" + id, onizleme: "https://cdn.polyhaven.com/asset_img/thumbs/" + id + ".png?width=256" }));
}

async function araNasa(q, n, o) {
  const agac = await onbellekli("nasa-3d", async () => {
    const t = await json("https://api.github.com/repos/nasa/NASA-3D-Resources/git/trees/master?recursive=1", o);
    return (t.tree || []).filter(x => /\.glb$/i.test(x.path) && x.size).map(x => ({ yol: x.path, boyut: x.size }));
  }, o);
  return agac.map(x => ({ x, p: puan(q, x.yol.replace(/^3D Models\//, "").replace(/\.glb$/i, "")) }))
    .filter(x => x.p >= 0.5).sort((a, b) => b.p - a.p || a.x.boyut - b.x.boyut).slice(0, n)
    .map(({ x }) => ({ kaynak: "nasa", id: x.yol, ad: path.basename(x.yol, path.extname(x.yol)), yazar: "NASA", lisans: "Kamu malı (NASA)",
      sayfa: "https://github.com/nasa/NASA-3D-Resources/tree/master/" + encodeURI(path.dirname(x.yol)), boyutMB: +(x.boyut / 1e6).toFixed(1),
      indir: "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/" + x.yol.split("/").map(encodeURIComponent).join("/") }));
}

async function araSmithsonian(q, n, o) {
  const d = await json("https://3d-api.si.edu/api/v1.0/content/file/search?" + new URLSearchParams({ q, file_type: "glb", rows: String(Math.min(100, n * 6)) }), o);
  const gruplar = new Map();
  for (const r of d.rows || []) {
    const c = r.content || {};
    if (c.file_type !== "glb" || !c.uri) continue;
    const anahtar = c.model_url || c.uri;
    const g = gruplar.get(anahtar) || { ad: r.title, dosyalar: [] };
    g.dosyalar.push({ kalite: c.quality, url: c.uri.replace(/^https:\/\/3d-api\.si\.edu\/content\/document\/[^/]+\//, ""), draco: !!c.draco_compressed });
    gruplar.set(anahtar, g);
  }
  // "AR" dosyasi modelin TAMAMIDIR (diger kaliteler cogu zaman parca parca: motor, kanat...); yoksa orta kalite
  return [...gruplar.entries()].slice(0, n).map(([anahtar, g]) => {
    const ar = g.dosyalar.filter(f => /^AR$/i.test(f.kalite || ""));
    const sec = ar.find(f => /_std_draco\.glb$/i.test(f.url)) || ar[0]
      || ["Medium", "Low", "High", "Highest", "Thumb"].map(k => g.dosyalar.find(f => f.kalite === k)).find(Boolean) || g.dosyalar[0];
    return { kaynak: "smithsonian", id: anahtar, ad: g.ad, yazar: "Smithsonian Institution", lisans: "Smithsonian Open Access (CC0 olarak yayınlananlar; sayfadan doğrula)",
      sayfa: "https://3d.si.edu/search/collections?edan_q=" + encodeURIComponent(g.ad || q), indir: sec.url, draco: sec.draco, kalite: sec.kalite };
  });
}

async function araSketchfab(q, n, o) {
  const d = await json("https://api.sketchfab.com/v3/search?" + new URLSearchParams({ type: "models", q, downloadable: "true", count: String(Math.min(24, n * 2)) }), o);
  // lisans adi etiketle gelir: yalniz "CC Attribution" (CC BY) ve CC0; NonCommercial/NoDerivs/ShareAlike elenir
  const kod = l => { const e = String((l || {}).label || (l || {}).slug || ""); return /^CC0|public domain/i.test(e) || e === "cc0" ? "cc0" : (e === "CC Attribution" || e === "by") ? "by" : ""; };
  return (d.results || []).filter(m => kod(m.license)).slice(0, n).map(m => {
    const resimler = ((m.thumbnails || {}).images || []).sort((a, b) => Math.abs(a.width - 256) - Math.abs(b.width - 256));
    return { kaynak: "sketchfab", id: m.uid, ad: m.name, yazar: (m.user || {}).displayName || (m.user || {}).username || "",
      yazarSayfa: (m.user || {}).profileUrl || "", lisans: kod(m.license) === "cc0" ? "CC0" : "CC BY 4.0", lisansKodu: kod(m.license),
      sayfa: m.viewerUrl || ("https://sketchfab.com/3d-models/" + m.uid), onizleme: resimler[0] && resimler[0].url, ucgen: m.faceCount };
  });
}

const ARA = { polyhaven: araPolyhaven, nasa: araNasa, smithsonian: araSmithsonian, sketchfab: araSketchfab };

async function ara(q, s) {
  const o = s || {};
  if (!sade(q)) throw hata("Arama metni boş.", "Örnek: node model-bul.js ara \"ship\" (İngilizce kelimeler daha çok sonuç verir)");
  const kaynaklar = (o.kaynaklar || KAYNAKLAR).filter(k => ARA[k]);
  const n = Math.max(1, Math.min(30, Number(o.sayi) || 8));
  const sonuclar = [], uyarilar = [];
  await Promise.all(kaynaklar.map(async k => {
    try { (await ARA[k](q, n, o)).forEach(r => sonuclar.push(r)); }
    catch (e) { uyarilar.push(k + ": " + String(e.message).slice(0, 140)); }
  }));
  sonuclar.sort((a, b) => kaynaklar.indexOf(a.kaynak) - kaynaklar.indexOf(b.kaynak));
  sonuclar.forEach((r, i) => { r.no = i + 1; });
  const arama = { sorgu: q, tarih: new Date().toISOString(), sonuclar, uyarilar };
  const d = path.join(kok(), "aramalar");
  fs.mkdirSync(d, { recursive: true });
  const dosya = path.join(d, kisaAd(q) + ".json");
  fs.writeFileSync(dosya, JSON.stringify(arama, null, 2));
  fs.writeFileSync(path.join(d, "_son.json"), JSON.stringify({ dosya: path.basename(dosya) }));
  return Object.assign(arama, { dosya });
}

function aramaOku(ad) {
  const d = path.join(kok(), "aramalar");
  let dosya = ad ? path.join(d, kisaAd(ad) + ".json") : null;
  if (!dosya) { try { dosya = path.join(d, JSON.parse(fs.readFileSync(path.join(d, "_son.json"), "utf8")).dosya); } catch (e) { /* yok */ } }
  if (!dosya || !fs.existsSync(dosya)) throw hata("Önce arama yap.", "node model-bul.js ara \"<ne>\"");
  return JSON.parse(fs.readFileSync(dosya, "utf8"));
}

// ---------------------------------------------------------------- glTF -> tek GLB paketleyici
// Dis .bin tamponlarini tek BIN parcasinda birlestirir, resimleri bufferView olarak gomer. Saf JS, bagimlilik yok.
function glbPaketle(gltfJson, dosyaOku) {
  const g = JSON.parse(JSON.stringify(gltfJson));
  const parcalar = []; let uzunluk = 0;
  const ekle = buf => { const bas = uzunluk; parcalar.push(buf); uzunluk += buf.length; const pad = (4 - uzunluk % 4) % 4; if (pad) { parcalar.push(Buffer.alloc(pad)); uzunluk += pad; } return bas; };
  const tamponBaslangic = (g.buffers || []).map(b => {
    if (!b.uri) throw new Error("glTF tamponunda uri yok");
    const veri = /^data:/.test(b.uri) ? Buffer.from(b.uri.split(",")[1], "base64") : dosyaOku(b.uri);
    return ekle(veri.subarray(0, b.byteLength));
  });
  for (const bv of g.bufferViews || []) { bv.byteOffset = (bv.byteOffset || 0) + tamponBaslangic[bv.buffer]; bv.buffer = 0; }
  for (const im of g.images || []) {
    if (!im.uri) continue;
    const veri = /^data:/.test(im.uri) ? Buffer.from(im.uri.split(",")[1], "base64") : dosyaOku(im.uri);
    const mime = im.mimeType || (/\.png$/i.test(im.uri) ? "image/png" : /\.webp$/i.test(im.uri) ? "image/webp" : "image/jpeg");
    const bas = ekle(veri);
    g.bufferViews = g.bufferViews || [];
    g.bufferViews.push({ buffer: 0, byteOffset: bas, byteLength: veri.length });
    im.bufferView = g.bufferViews.length - 1; im.mimeType = mime; delete im.uri;
  }
  g.buffers = [{ byteLength: uzunluk }];
  let js = Buffer.from(JSON.stringify(g)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const bin = Buffer.concat(parcalar);
  const bas = Buffer.alloc(12); bas.write("glTF", 0); bas.writeUInt32LE(2, 4); bas.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([bas, c1, js, c2, bin]);
}

// ---------------------------------------------------------------- indir
async function indirPolyhaven(r, o) {
  const f = await json("https://api.polyhaven.com/files/" + encodeURIComponent(r.id), o);
  const cozunurluk = o.cozunurluk || "1k";
  const g = ((f.gltf || {})[cozunurluk] || (f.gltf || {})["1k"] || {}).gltf;
  if (!g || !g.url) throw hata("Bu Poly Haven modelinin glTF dosyası yok.");
  const gltf = JSON.parse((await ikili(g.url, o)).toString("utf8"));
  const ekler = {};
  for (const [ad, v] of Object.entries(g.include || {})) ekler[ad] = await ikili(v.url, o);
  return glbPaketle(gltf, uri => { const k = decodeURIComponent(uri); if (!ekler[k]) throw new Error("eksik ek dosya: " + k); return ekler[k]; });
}
async function indirSketchfab(r, o) {
  const jeton = o.sketchfabJeton || ortak.envOku("SKETCHFAB_TOKEN");
  if (!jeton) throw hata("Sketchfab'den indirmek için ücretsiz hesap anahtarı gerekir.", "sketchfab.com → Ayarlar → Password & API → API token; .env'e SKETCHFAB_TOKEN=... yaz ya da Poly Haven/NASA/Smithsonian sonuçlarından seç.");
  const d = await json("https://api.sketchfab.com/v3/models/" + encodeURIComponent(r.id) + "/download", Object.assign({}, o, { basliklar: { authorization: "Token " + jeton } }));
  if (!d.glb || !d.glb.url) throw hata("Bu Sketchfab modelinin .glb indirmesi yok.");
  return ikili(d.glb.url, o);   // imzali adres: yetki basligi gonderilmez
}

async function indir(no, s) {
  const o = s || {};
  const arama = aramaOku(o.arama);
  const r = arama.sonuclar.find(x => x.no === Number(no));
  if (!r) throw hata("Aramada " + no + " numaralı sonuç yok.", "Numaralar: 1-" + arama.sonuclar.length);
  let glb;
  if (r.kaynak === "polyhaven") glb = await indirPolyhaven(r, o);
  else if (r.kaynak === "sketchfab") glb = await indirSketchfab(r, o);
  else glb = await ikili(r.indir, o);
  if (glb.subarray(0, 4).toString() !== "glTF") throw hata("İnen dosya gerçek bir GLB değil.", "Başka bir sonuç seç.", 4);
  const dizin = path.join(kok(), r.kaynak + "-" + kisaAd(r.ad) + "-" + crypto.createHash("sha1").update(String(r.id)).digest("hex").slice(0, 6));
  fs.mkdirSync(dizin, { recursive: true });
  const glbYol = path.join(dizin, "model.glb");
  fs.writeFileSync(glbYol, glb);
  const atif = atifMetni(r);
  fs.writeFileSync(path.join(dizin, "KAYNAK.txt"),
    "Model: " + r.ad + "\nKaynak: " + r.kaynak + "\nSayfa: " + r.sayfa + "\nYazar: " + (r.yazar || "-") + "\nLisans: " + r.lisans +
    (r.draco ? "\nNot: Draco sıkıştırmalı (Otopilot 3B çizici açar)." : "") + "\nİndirme: " + new Date().toISOString() + "\n\nAçıklamaya eklenecek atıf:\n" + atif + "\n");
  let kopya = null;
  if (o.is) {
    const girdi = path.join(ortak.isDizin(o.is), "girdi");
    if (!fs.existsSync(path.join(ortak.isDizin(o.is), "studyo.json"))) throw hata("Böyle bir stüdyo işi yok: " + o.is, "Önce: node studyo.js yeni " + o.is);
    fs.mkdirSync(girdi, { recursive: true });
    kopya = path.join(girdi, kisaAd(r.ad) + ".glb");
    fs.copyFileSync(glbYol, kopya);
    fs.appendFileSync(path.join(ortak.isDizin(o.is), "ATIF.txt"), atif + "\n");
  }
  return { sonuc: r, dizin, glb: glbYol, boyutMB: +(glb.length / 1e6).toFixed(2), atif, kopya };
}

function atifMetni(r) {
  if (r.kaynak === "polyhaven") return "3B model: \"" + r.ad + "\", " + (r.yazar || "Poly Haven") + ", Poly Haven (CC0) " + r.sayfa;
  if (r.kaynak === "nasa") return "3B model: \"" + r.ad + "\", NASA 3D Resources (kamu malı; NASA bu içeriği onaylamaz) " + r.sayfa;
  if (r.kaynak === "smithsonian") return "3B model: \"" + r.ad + "\", Smithsonian Institution, Smithsonian 3D (Open Access) " + r.sayfa;
  return "3B model: \"" + r.ad + "\", " + r.yazar + " (" + r.lisans + "), Sketchfab " + r.sayfa;
}

module.exports = { KAYNAKLAR, ara, aramaOku, indir, glbPaketle, atifMetni, puan, sade, kisaAd, kok };
