// PANEL -> AI STUDYO uclari (studyo.js'in panel yuzu). Surecte AI cagirmaz: fotograf yukler, studyo.json'u duzenler,
// maliyeti hesaplar; uretim ve kurgu `node studyo.js` alt sureci olarak calisir (kredi YALNIZ acik onayla: onay:true).
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ortak = require("./ortak");
const K = require("./vidiq-klip");
const S = require("../studyo.js");
const S3 = require("./sahne3d");
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
    const yerel = s.mod === "3b";                              // 3B sahne: bu bilgisayarda cizilir, kredi yok
    return Object.assign({}, s, { sure, klip, kredi: klip || yerel ? 0 : sure * oran });
  });
  const kalan = sahneler.filter(s => !s.klip && s.mod !== "3b");
  const is = isler.get(a);
  return {
    ad: a, ayar: { stil: j.stil, oran: j.oran, model: j.model, cozunurluk: j.cozunurluk, sure: j.sure, dil: j.dil, kamera: j.kamera, karakter: j.karakter || [], lensProfili: j.lensProfili || null },
    lens: Lensfun().durum(),
    sahneler, kredi: kalan.reduce((t, s) => t + s.kredi, 0), krediSn: oran, uretilecek: kalan.length,
    video: fs.existsSync(path.join(d, "Videos", a + ".mp4")),
    yuz: (() => { try { require("./yuz-degistir").kokBul(); return { hazir: true }; } catch (e) { return { hazir: false, neden: e.message, cozum: e.cozum || "" }; } })(),
    is: is ? { tur: is.tur, calisiyor: is.calisiyor, kod: is.kod, satirlar: is.satirlar.slice(-60) } : null,
    stiller: Object.fromEntries(Object.entries(S.STILLER).map(([k, v]) => [k, v.ad])),
    yonetmen: Object.fromEntries(Object.entries(S.YONETMEN).map(([g, m]) => [g, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v[0]]))])),
    gecisler: Object.fromEntries(Object.entries(S.GECISLER).map(([k, v]) => [k, v[0]])),
    sablonlar: Object.fromEntries(Object.entries(S.SABLONLAR).map(([k, v]) => [k, v.ad])),
    sahne3d: { sablonlar: Object.fromEntries(Object.entries(S3.SABLONLAR).map(([k, v]) => [k, v.ad])), onAyarlar: S3.KARAKTER_AYARLARI, chrome: !!S3.chromeBul(), three: S3.threeHazirMi() },
    kameralar: Object.fromEntries(Object.entries(S.KAMERALAR).map(([k, v]) => [k, v.ad])),
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
  const modelMi = b.rol === "model";
  const orijinal = path.basename(String(b.dosya || "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/İ/g, "I").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
  if (modelMi) {
    if (!/\.glb$/i.test(orijinal)) throw new HttpHata(400, "dosya", "3B model için yalnız .glb yüklenir.", { cozum: "Modelini GLB olarak dışa aktar." });
  } else if (!orijinal || !FOTO.test(orijinal)) throw new HttpHata(400, "dosya", "Yalnız JPG, PNG ya da WebP yüklenir.", { cozum: "HEIC/BMP ise önce JPG'e çevir." });
  const veri = Buffer.from(String(b.veri || ""), "base64");
  if (!veri.length) throw new HttpHata(400, "dosya", "Dosya boş.");
  if (veri.length > DOSYA_SINIRI) throw new HttpHata(413, "cok_buyuk", "Fotoğraf 20 MB'tan büyük.", { cozum: "Küçült ya da JPG kaydet." });
  if (modelMi) {
    if (veri.subarray(0, 4).toString() !== "glTF") throw new HttpHata(400, "dosya", "Dosya gerçek bir GLB değil.");
    const gd = path.join(dizin(a), "girdi"); fs.mkdirSync(gd, { recursive: true });
    let gh = orijinal, gn = 1;
    while (fs.existsSync(path.join(gd, gh))) gh = orijinal.replace(/(\.[^.]+)$/, "-" + (++gn) + "$1");
    fs.writeFileSync(path.join(gd, gh) + ".part", veri); fs.renameSync(path.join(gd, gh) + ".part", path.join(gd, gh));
    return { ok: true, dosya: gh, model: true };
  }
  const jpg = veri[0] === 0xff && veri[1] === 0xd8, png = veri.subarray(1, 4).toString() === "PNG", webp = veri.subarray(0, 4).toString() === "RIFF" && veri.subarray(8, 12).toString() === "WEBP";
  if (!jpg && !png && !webp) throw new HttpHata(400, "dosya", "Dosya gerçek bir JPG/PNG/WebP değil.");
  const rol = ["sablon", "kisi"].includes(b.rol) ? b.rol : "";
  const girdi = rol ? path.join(dizin(a), "girdi", "yuz") : path.join(dizin(a), "girdi");
  fs.mkdirSync(girdi, { recursive: true });
  let hedef = orijinal, n = 1;
  while (fs.existsSync(path.join(girdi, hedef))) hedef = orijinal.replace(/(\.[^.]+)$/, "-" + (++n) + "$1");
  const p = path.join(girdi, hedef);
  fs.writeFileSync(p + ".part", veri);
  fs.renameSync(p + ".part", p);
  if (rol) return { ok: true, dosya: hedef, rol };           // yuz degistirme girdisi: sahne olmaz
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
  if (b.kamera !== undefined) j.kamera = String(b.kamera);
  if (b.lensProfili === null) delete j.lensProfili;
  else if (b.lensProfili && typeof b.lensProfili === "object") {
    const lp = b.lensProfili, o = { kamera: String(lp.kamera || "").slice(0, 120), lens: String(lp.lens || "").slice(0, 120) };
    if (!o.kamera || !o.lens) throw new HttpHata(400, "lens", "Lens profili için kamera ve lens seçmelisin.");
    sarar(() => Lensfun().profilBul(o.kamera, o.lens));
    for (const k of ["odak", "diyafram", "mesafe"]) if (lp[k] !== undefined && lp[k] !== "" && lp[k] !== null) { const n = Number(lp[k]); if (!(n > 0 && n < 1e5)) throw new HttpHata(400, "lens", k + " geçersiz."); o[k] = n; }
    if (lp.yon === "duzelt") o.yon = "duzelt";
    j.lensProfili = o;
  }
  if (Array.isArray(b.karakter)) j.karakter = b.karakter.map(String);
  if (Array.isArray(b.sahneler)) {
    j.sahneler = b.sahneler.slice(0, 60).map(s => {
      const o = { mod: String(s.mod || "") };
      if (s.kaynak) o.kaynak = path.basename(String(s.kaynak));
      if (s.url) o.url = String(s.url).slice(0, 500);
      if (s.hareket !== undefined) o.hareket = String(s.hareket).slice(0, 3500);
      if (s.anlatim) o.anlatim = String(s.anlatim).slice(0, 600);
      for (const alan of ["plan", "kameraHareketi", "lens", "isik", "gecis"]) if (s[alan]) o[alan] = String(s[alan]);
      if (s.mod === "3b") {
        o.sablon3d = String(s.sablon3d || "");
        const pr = s.parametre && typeof s.parametre === "object" ? s.parametre : {};
        o.parametre = {};
        for (const k of ["baslik", "altBaslik", "renk", "renk2", "onAyar", "glb"]) if (typeof pr[k] === "string" && pr[k]) o.parametre[k] = pr[k].slice(0, 120);
      }
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

function sablon(b) {
  const a = var_(ad(b.ad));
  let fotolar = Array.isArray(b.fotolar) ? b.fotolar.map(x => path.basename(String(x))) : [];
  if (b.kadro && typeof b.kadro === "object") {
    // kadro: erkek / kadin / cift. Biri bossa digeri onun yerine kullanilir; cift yoksa "ikisi birlikte" sahneleri sirayla ikisini kullanir.
    const t = k => (b.kadro[k] ? path.basename(String(b.kadro[k])) : "");
    const c = t("cift"), e = t("erkek") || t("kadin") || c, k = t("kadin") || t("erkek") || c;
    fotolar = [e, k, c].filter(Boolean);
    if (fotolar.length === 2 && !c) fotolar = [e, k];
    if (fotolar.length === 3 && !c) fotolar = [e, k];
  }
  const n = sarar(() => S.sablonEkle(a, String(b.sablon || ""), fotolar));
  return { ok: true, eklenen: n };
}

function sahne3d(b) {
  const a = var_(ad(b.ad));
  const n = sarar(() => S.sahne3dEkle(a, String(b.sablon || ""), { baslik: b.baslik, alt: b.alt, "on-ayar": b.onAyar, sure: b.sure }));
  return { ok: true, sahne: n };
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
  if (tur === "yuz") {
    if (b.riza !== true) throw new HttpHata(400, "riza", "Rıza onayı gerekli.", { cozum: "Fotoğraflardaki kişilerin sen ya da yazılı izin veren kişiler olduğunu onayla." });
    const dosyalar = [b.sablon, ...(Array.isArray(b.kisiler) ? b.kisiler : [])].map(x => path.basename(String(x || "")));
    if (dosyalar.length < 2 || dosyalar.some(x => !x)) throw new HttpHata(400, "yuz", "Poz fotoğrafı ve en az bir kişi fotoğrafı gerekli.");
    argv.push("--sablon", "yuz/" + dosyalar[0], "--kisi", dosyalar.slice(1).map(x => "yuz/" + x).join(","), "--riza");
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

const Lensfun = () => require("./lensfun.js");
function lensAra(tur, q) {
  const s = String(q || "").trim();
  if (s.length < 2) return { sonuclar: [] };
  return { sonuclar: Lensfun().ara(s.slice(0, 80), tur === "lens" ? "lens" : "kamera", 25).map(x => ({ maker: x.maker, model: x.model, mount: x.mount })) };
}
let lensIndiriyor = null;
async function lensKur() {
  if (!lensIndiriyor) lensIndiriyor = Lensfun().indir({ log: () => {} }).finally(() => { lensIndiriyor = null; });
  try { await lensIndiriyor; } catch (e) { throw new HttpHata(502, "lens", e.message, e.cozum ? { cozum: e.cozum } : undefined); }
  return Object.assign({ ok: true }, Lensfun().durum());
}

function ekle(GET, POST) {
  GET["/api/studyo/liste"] = async () => ({ isler: liste(), stiller: Object.fromEntries(Object.entries(S.STILLER).map(([k, v]) => [k, v.ad])), modeller: K.GIRDI_DESTEK && Object.keys(K.GIRDI_DESTEK) });
  GET["/api/studyo/detay"] = async c => detay(c.q.get("ad"));
  POST["/api/studyo/yeni"] = async c => yeni(c.b);
  POST["/api/studyo/yukle"] = async c => yukle(c.b);
  POST["/api/studyo/kaydet"] = async c => kaydet(c.b);
  POST["/api/studyo/sahne"] = async c => sahneEkle(c.b);
  POST["/api/studyo/sablon"] = async c => sablon(c.b);
  POST["/api/studyo/sahne3d"] = async c => sahne3d(c.b);
  POST["/api/studyo/uret"] = async c => calistir("uret", c.b);
  POST["/api/studyo/kur"] = async c => calistir("kur", c.b);
  POST["/api/studyo/yuz"] = async c => calistir("yuz", c.b);
  POST["/api/studyo/durdur"] = async c => durdur(c.b.ad);
  GET["/api/studyo/lens-ara"] = async c => lensAra(c.q.get("tur"), c.q.get("q"));
  POST["/api/studyo/lens-kur"] = async () => lensKur();
}

module.exports = { ekle, liste, detay, yeni, yukle, kaydet, sahneEkle, calistir, durdur, YUKLE_SINIRI, isler };
