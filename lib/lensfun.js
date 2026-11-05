// Lensfun lens profilleri (acik kaynak): yuzlerce kamera/lens/telefon profili. ffmpeg'in `lensfun` filtresiyle:
//   reverse=1  -> normal goruntuye o lensin karakteri eklenir (distorsiyon, vinyet, renk sapmasi)  [AI klipler icin: "lens hissi"]
//   reverse=0  -> kendi gercek videondaki lens bozulmasi duzeltilir
// Veritabani (CC BY-SA 3.0, https://github.com/lensfun/lensfun) repoya GIRMEZ: `node studyo.js lens-kur` ile uretim/_lensfun/db'ye iner.
"use strict";
const fs = require("fs");
const path = require("path");

const KOK = path.join(__dirname, "..");
const KAYNAK_API = "https://api.github.com/repos/lensfun/lensfun/contents/data/db";
const dbYolu = () => process.env.LENSFUN_DB || path.join(KOK, "uretim", "_lensfun", "db");

// Turkce yerel ayardan bagimsiz kucuk harf + aksan/bosluk sadeleştirme (arama icin)
function sade(s) {
  return String(s || "").replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i").toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
}

// ---- indirme -----------------------------------------------------------
async function indir(e) {
  const o = e || {};
  const log = o.log || (m => console.log(m));
  const getir = o.fetch || fetch;
  const dizin = dbYolu();
  const r = await getir(KAYNAK_API, { headers: { "user-agent": "otopilot-lensfun", accept: "application/vnd.github+json" } });
  if (!r.ok) { const h = new Error("Lensfun listesi alınamadı (HTTP " + r.status + ")."); h.cikis = 3; h.cozum = "İnterneti/GitHub erişimini kontrol edip tekrar dene."; throw h; }
  const liste = (await r.json()).filter(x => x && /^[A-Za-z0-9_.-]+\.xml$/.test(x.name) && typeof x.download_url === "string" && /^https:\/\/raw\.githubusercontent\.com\/lensfun\/lensfun\//.test(x.download_url) && x.size < 5e6);
  if (!liste.length) { const h = new Error("Lensfun listesi boş geldi."); h.cikis = 3; throw h; }
  fs.mkdirSync(dizin, { recursive: true });
  let n = 0;
  for (const x of liste) {
    const d = await getir(x.download_url, { headers: { "user-agent": "otopilot-lensfun" } });
    if (!d.ok) { const h = new Error(x.name + " indirilemedi (HTTP " + d.status + ")."); h.cikis = 3; throw h; }
    fs.writeFileSync(path.join(dizin, x.name), Buffer.from(await d.arrayBuffer()));
    n++;
  }
  fs.writeFileSync(path.join(dizin, "KAYNAK.txt"), "Lensfun veritabanı, CC BY-SA 3.0 — https://github.com/lensfun/lensfun (data/db). İndirilme: " + new Date().toISOString() + "\n");
  log("  " + n + " profil dosyası indi: " + dizin);
  return { dosya: n, dizin };
}

// ---- okuma -------------------------------------------------------------
function ilk(blok, etiket) {
  const m = new RegExp("<" + etiket + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + etiket + ">", "i").exec(blok);
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim() : "";
}
function oku(dizin) {
  const d = dizin || dbYolu();
  if (!fs.existsSync(d)) return { kameralar: [], lensler: [] };
  const kameralar = [], lensler = [];
  for (const f of fs.readdirSync(d).filter(x => /\.xml$/i.test(x))) {
    const s = fs.readFileSync(path.join(d, f), "utf8");
    for (const m of s.matchAll(/<camera\b[\s\S]*?<\/camera>/gi)) {
      const maker = ilk(m[0], "maker"), model = ilk(m[0], "model");
      if (maker && model) kameralar.push({ maker, model, mount: ilk(m[0], "mount"), crop: Number(ilk(m[0], "cropfactor")) || 0, dosya: f });
    }
    for (const m of s.matchAll(/<lens\b[\s\S]*?<\/lens>/gi)) {
      const maker = ilk(m[0], "maker"), model = ilk(m[0], "model");
      if (maker && model) lensler.push({ maker, model, mount: ilk(m[0], "mount"), crop: Number(ilk(m[0], "cropfactor")) || 0, dosya: f });
    }
  }
  return { kameralar, lensler };
}

let onbellek = null;
function yukle() {
  const d = dbYolu();
  const imza = fs.existsSync(d) ? fs.readdirSync(d).length : -1;
  if (!onbellek || onbellek.d !== d || onbellek.imza !== imza) onbellek = { d, imza, v: oku(d) };
  return onbellek.v;
}

function ara(sorgu, tur, sinir) {
  const v = yukle();
  const k = sade(sorgu).split(" ").filter(Boolean);
  const havuz = tur === "lens" ? v.lensler : v.kameralar;
  if (!k.length) return [];
  return havuz.filter(x => { const s = sade(x.maker + " " + x.model); return k.every(p => s.includes(p)); }).slice(0, sinir || 25);
}

// ---- ffmpeg filtresi ---------------------------------------------------
// ffmpeg filtre degeri kacisi: tek tirnak icine al, ic tirnaklari kac; yol ayiraci ve ':' kullanimi icin yol / ile yazilir
function kac(v) { return "'" + String(v).replace(/\\/g, "/").replace(/'/g, "'\\''").replace(/:/g, "\\:") + "'"; }

// b: { kamera: {maker, model}, lens: {maker, model}, odak, diyafram, mesafe, yon: "ekle"|"duzelt", mod: 1-7 }
function filtre(b) {
  if (!b || !b.kamera || !b.lens) throw Object.assign(new Error("Kamera ve lens gerekli."), { cikis: 2 });
  const odak = Number(b.odak) || 35, diy = Number(b.diyafram) || 2.8, mesafe = Number(b.mesafe) || 3;
  if (!(odak > 0 && odak < 2000) || !(diy > 0 && diy < 64) || !(mesafe > 0 && mesafe < 1e6)) throw Object.assign(new Error("odak/diyafram/mesafe aralık dışı."), { cikis: 2 });
  const mod = [1, 2, 3, 4, 5, 6, 7].includes(Number(b.mod)) ? Number(b.mod) : 7;
  const dizin = dbYolu().replace(/\\/g, "/");
  return "lensfun=make=" + kac(b.kamera.maker) + ":model=" + kac(b.kamera.model) + ":lens_model=" + kac(b.lens.model)
    + ":db_path=" + kac(dizin) + ":focal_length=" + odak + ":aperture=" + diy + ":focus_distance=" + mesafe + ":mode=" + mod
    + (b.yon === "duzelt" ? "" : ":reverse=1") + ",format=yuv420p";
}

// "Canon EOS 5D Mark II" + "Canon EF 50mm f/1.4 USM" gibi metinlerden profil bul (ilk eslesme)
function profilBul(kameraMetni, lensMetni) {
  const k = ara(kameraMetni, "kamera", 1)[0], l = ara(lensMetni, "lens", 1)[0];
  if (!k) throw Object.assign(new Error("Kamera profili bulunamadı: " + kameraMetni), { cikis: 2, cozum: "Önce: node studyo.js lens-kur   sonra: node studyo.js lens-ara <kelime>" });
  if (!l) throw Object.assign(new Error("Lens profili bulunamadı: " + lensMetni), { cikis: 2, cozum: "node studyo.js lens-ara <kelime> --tur lens" });
  return { kamera: k, lens: l };
}

function durum() {
  const d = dbYolu();
  const hazir = fs.existsSync(d) && fs.readdirSync(d).some(x => /\.xml$/i.test(x));
  if (!hazir) return { hazir: false, kameralar: 0, lensler: 0 };
  const v = yukle();
  return { hazir: true, kameralar: v.kameralar.length, lensler: v.lensler.length };
}

module.exports = { durum, dbYolu, indir, oku, ara, filtre, profilBul, sade, kac, KAYNAK_API };
