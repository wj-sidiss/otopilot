// PANEL -> AI STUDYO uclari (studyo.js'in panel yuzu). Surecte AI cagirmaz: fotograf yukler, studyo.json'u duzenler,
// maliyeti hesaplar; uretim ve kurgu `node studyo.js` alt sureci olarak calisir (kredi YALNIZ acik onayla: onay:true).
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ortak = require("./ortak");
const K = require("./vidiq-klip");
const S = require("../studyo.js");
const { HttpHata } = require("./panel-http");

const FOTO = /\.(jpe?g|png|webp)$/i;
const ADLAR = /^[a-z0-9][a-z0-9-]{0,60}$/;
const YUKLE_SINIRI = 60 * 1024 * 1024;           // govde siniri (base64 dahil); istemci fotografi zaten kucultur
const DOSYA_SINIRI = 20 * 1024 * 1024;
const LOG_SATIR = 200;

const isler = new Map();                          // ad -> {tur, calisiyor, satirlar, kod, surec}

const ad = v => {
  if (!ADLAR.test(String(v || ""))) throw new HttpHata(400, "gecersiz_is", "Geçersiz stüdyo adı: küçük harf, rakam ve tire (en çok 61 karakter).");
  return String(v);
};
const dizin = a => ortak.isDizin(a);
const var_ = a => { if (!fs.existsSync(path.join(dizin(a), "studyo.json"))) throw new HttpHata(404, "is_yok", "Böyle bir stüdyo işi yok."); return a; };
const sarar = f => { try { return f(); } catch (e) { if (e instanceof HttpHata) throw e; throw new HttpHata(400, "studyo", e.message, e.cozum ? { cozum: e.cozum } : undefined); } };

function liste() {
  const kok = ortak.uretimDizini();
  let adlar = [];
  try { adlar = fs.readdirSync(kok); } catch (e) { return []; }
  const out = [];
  for (const a of adlar) {
    if (!ADLAR.test(a)) continue;
    const y = path.join(kok, a, "studyo.json");
    if (!fs.existsSync(y)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(y, "utf8").replace(/^﻿/, "")); } catch (e) { continue; }
    out.push({ ad: a, stil: j.stil, oran: j.oran, sahne: (j.sahneler || []).length, video: fs.existsSync(path.join(kok, a, "Videos", a + ".mp4")), calisiyor: !!(isler.get(a) || {}).calisiyor });
  }
  return out.sort((x, y) => x.ad.localeCompare(y.ad));
}

// sahne basina klip durumu: studyo.js ile ayni kimlik (liste) yerine hafif esleme: girdiOzet gerektirmeyen sorgu icin klipEsle'yi kullanir
function detay(a) {
  var_(ad(a));
  const j = sarar(() => S.ayarOku(a));
  const d = dizin(a);
  let klipler = [];
  try { klipler = S.klipEsle(a, j); } catch (e) { klipler = j.sahneler.map((_, i) => ({ sahne: i + 1, yol: null })); }
  const oran = (K.KREDI_SN[j.model] || {})[j.cozunurluk] || 0;
  const sahneler = j.sahneler.map((s, i) => {
    const klip = klipler[i] && klipler[i].yol ? path.basename(klipler[i].yol) : "";
    const sure = Number(s.sure || j.sure);
    return Object.assign({}, s, { sure, klip, kredi: klip ? 0 : sure * oran });
  });
  const kalan = sahneler.filter(s => !s.klip);
  const is = isler.get(a);
  return {
    ad: a, ayar: { stil: j.stil, oran: j.oran, model: j.model, cozunurluk: j.cozunurluk, sure: j.sure, dil: j.dil, karakter: j.karakter || [] },
    sahneler, kredi: kalan.reduce((t, s) => t + s.kredi, 0), krediSn: oran, uretilecek: kalan.length,
    video: fs.existsSync(path.join(d, "Videos", a + ".mp4")),
    is: is ? { tur: is.tur, calisiyor: is.calisiyor, kod: is.kod, satirlar: is.satirlar.slice(-60) } : null,
    stiller: Object.fromEntries(Object.entries(S.STILLER).map(([k, v]) => [k, v.ad])),
    modeller: Object.keys(K.GIRDI_DESTEK),
  };
}

function yeni(b) {
  const a = ad(b.ad);
  sarar(() => S.yeni(a, { stil: String(b.stil || "serbest"), oran: String(b.oran || "9:16"), model: b.model ? String(b.model) : undefined, sure: b.sure }));
  return { ok: true, ad: a };
}

// fotograf yukleme: {ad, dosya, veri(base64)}; girdi/ icine guvenli adla yazar
function yukle(b) {
  const a = var_(ad(b.ad));
  const orijinal = path.basename(String(b.dosya || "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/İ/g, "I").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
  if (!orijinal || !FOTO.test(orijinal)) throw new HttpHata(400, "dosya", "Yalnız JPG, PNG ya da WebP yüklenir.", { cozum: "HEIC/BMP ise önce JPG'e çevir." });
  const veri = Buffer.from(String(b.veri || ""), "base64");
  if (!veri.length) throw new HttpHata(400, "dosya", "Dosya boş.");
  if (veri.length > DOSYA_SINIRI) throw new HttpHata(413, "cok_buyuk", "Fotoğraf 20 MB'tan büyük.", { cozum: "Küçült ya da JPG kaydet." });
  const jpg = veri[0] === 0xff && veri[1] === 0xd8, png = veri.subarray(1, 4).toString() === "PNG", webp = veri.subarray(0, 4).toString() === "RIFF" && veri.subarray(8, 12).toString() === "WEBP";
  if (!jpg && !png && !webp) throw new HttpHata(400, "dosya", "Dosya gerçek bir JPG/PNG/WebP değil.");
  const girdi = path.join(dizin(a), "girdi");
  fs.mkdirSync(girdi, { recursive: true });
  let hedef = orijinal, n = 1;
  while (fs.existsSync(path.join(girdi, hedef))) hedef = orijinal.replace(/(\.[^.]+)$/, "-" + (++n) + "$1");
  const p = path.join(girdi, hedef);
  fs.writeFileSync(p + ".part", veri);
  fs.renameSync(p + ".part", p);
  S.fotoEkle(a, hedef);
  return { ok: true, dosya: hedef };
}

// ayar + sahneleri toptan kaydeder; gecersizse eski dosya geri konur
function kaydet(b) {
  const a = var_(ad(b.ad));
  const yol = path.join(dizin(a), "studyo.json");
  const eski = fs.readFileSync(yol, "utf8");
  const j = sarar(() => S.ayarOku(a));
  if (b.stil !== undefined) j.stil = String(b.stil);
  if (b.oran !== undefined) j.oran = String(b.oran);
  if (b.model !== undefined) j.model = String(b.model);
  if (b.cozunurluk !== undefined) j.cozunurluk = String(b.cozunurluk);
  if (b.sure !== undefined) j.sure = Number(b.sure);
  if (b.dil !== undefined) j.dil = String(b.dil);
  if (Array.isArray(b.karakter)) j.karakter = b.karakter.map(String);
  if (Array.isArray(b.sahneler)) {
    j.sahneler = b.sahneler.slice(0, 60).map(s => {
      const o = { mod: String(s.mod || "") };
      if (s.kaynak) o.kaynak = path.basename(String(s.kaynak));
      if (s.url) o.url = String(s.url).slice(0, 500);
      if (s.hareket !== undefined) o.hareket = String(s.hareket).slice(0, 3500);
      if (s.anlatim) o.anlatim = String(s.anlatim).slice(0, 600);
      if (s.sure) o.sure = Number(s.sure);
      if (s.an) o.an = Number(s.an);
      return o;
    });
  }
  fs.writeFileSync(yol, JSON.stringify(j, null, 2) + "\n");
  try {
    K.tahmin(j.sahneler.map(s => ({ istem: s.hareket || "x", sure: Number(s.sure || j.sure) })), j.model, j.cozunurluk);
    S.ayarOku(a);
    // modelin desteklemedigi girdi daha kaydederken yakalansin (uretimde kredi harcanmadan once de denetlenir)
    const dst = K.GIRDI_DESTEK[j.model];
    for (const [i, s] of j.sahneler.entries()) {
      const no = "Sahne " + (i + 1) + ": ";
      if (s.mod !== "metin" && !dst) throw new Error(no + "'" + j.model + "' fotoğraf/video girdisi almıyor.");
      if (s.mod === "video" && !dst.video) throw new Error(no + "'" + j.model + "' kendi videonu dönüştürmez; minimax-h3 ya da gemini-omni-flash seç.");
      if (s.mod === "referans" && dst.referans < 1 + (j.karakter || []).length) throw new Error(no + "'" + j.model + "' referans fotoğraf kabul etmiyor ya da çok fazla; 'Fotoğraf olduğu gibi canlansın' seç ya da minimax-h3 kullan.");
    }
  }
  catch (e) { fs.writeFileSync(yol, eski); throw new HttpHata(400, "studyo", e.message, e.cozum ? { cozum: e.cozum } : undefined); }
  return { ok: true };
}

function sahneEkle(b) {
  const a = var_(ad(b.ad));
  const n = sarar(() => S.sahneEkle(a, String(b.istem || ""), b.sure));
  return { ok: true, sahne: n };
}

// studyo.js alt sureci (uret / kur). Ayni isi ikinci kez baslatmaz.
function calistir(tur, b, enj) {
  const a = var_(ad(b.ad));
  const m = isler.get(a);
  if (m && m.calisiyor) throw new HttpHata(409, "is_calisiyor", "Bu stüdyo işi zaten çalışıyor.");
  const argv = [path.join(__dirname, "..", "studyo.js"), tur, a];
  if (tur === "uret") {
    const butce = Number(b.butce);
    if (!(butce > 0)) throw new HttpHata(400, "butce", "Bütçe (kredi) gerekli.", { cozum: "Tahmini tutarın üstünde bir üst sınır gir." });
    argv.push("--butce", String(Math.ceil(butce)));
    if (b.onay === true) argv.push("--onay");
    if (b.yeniCekim === true) argv.push("--yeni-cekim");
  }
  if (tur === "kur" && b.muzik) {
    const mz = path.resolve(String(b.muzik));
    if (!fs.existsSync(mz)) throw new HttpHata(400, "muzik", "Müzik dosyası bulunamadı.");
    argv.push("--muzik", mz);
  }
  const kayit = { tur: tur === "uret" && b.onay !== true ? "kuru" : tur, calisiyor: true, satirlar: [], kod: null, surec: null };
  isler.set(a, kayit);
  const yaz = d => { for (const s of String(d).split(/\r?\n/)) if (s.trim()) { kayit.satirlar.push(s.slice(0, 400)); if (kayit.satirlar.length > LOG_SATIR) kayit.satirlar.shift(); } };
  const surec = (enj && enj.spawn || spawn)(process.execPath, argv, { cwd: path.join(__dirname, ".."), windowsHide: true, env: process.env });
  kayit.surec = surec;
  surec.stdout.on("data", yaz); surec.stderr.on("data", yaz);
  surec.on("error", e => { yaz("✗ " + e.message); kayit.calisiyor = false; kayit.kod = 1; });
  surec.on("close", kod => { kayit.calisiyor = false; kayit.kod = kod; kayit.surec = null; });
  return { ok: true, tur: kayit.tur };
}

function durdur(a) {
  const m = isler.get(ad(a));
  if (m && m.surec) { try { m.surec.kill(); } catch (e) { /* bitmis */ } }
  return { ok: true };
}

function ekle(GET, POST) {
  GET["/api/studyo/liste"] = async () => ({ isler: liste(), stiller: Object.fromEntries(Object.entries(S.STILLER).map(([k, v]) => [k, v.ad])), modeller: K.GIRDI_DESTEK && Object.keys(K.GIRDI_DESTEK) });
  GET["/api/studyo/detay"] = async c => detay(c.q.get("ad"));
  POST["/api/studyo/yeni"] = async c => yeni(c.b);
  POST["/api/studyo/yukle"] = async c => yukle(c.b);
  POST["/api/studyo/kaydet"] = async c => kaydet(c.b);
  POST["/api/studyo/sahne"] = async c => sahneEkle(c.b);
  POST["/api/studyo/uret"] = async c => calistir("uret", c.b);
  POST["/api/studyo/kur"] = async c => calistir("kur", c.b);
  POST["/api/studyo/durdur"] = async c => durdur(c.b.ad);
}

module.exports = { ekle, liste, detay, yeni, yukle, kaydet, sahneEkle, calistir, durdur, YUKLE_SINIRI, isler };
