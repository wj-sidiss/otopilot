// MASAUSTU KONTROL PANELI — sifir bagimlilik, tarayicida calisir.
// Baslat: PANEL.bat  (cift tikla)
//
// Guvenlik modeli (SOZLESME 6.4): yalniz 127.0.0.1'e baglanir; Host/Origin/Icerik-turu denetlenir; her /api cagrisi
// acilista uretilen rastgele jetonu ister (X-Panel-Token; medya GET'leri cerezle). Is adlari katı beyaz listeden gecer.
// Asil is kutuphaneleri lib/panel-*.js icinde; bu dosya yalnizca sunucuyu ve yonlendirmeyi kurar.
"use strict";
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ortak = require("./lib/ortak");
const guvenlik = require("./lib/panel-guvenlik");
const H = require("./lib/panel-http");
const isler = require("./lib/panel-isler");
const dosya = require("./lib/panel-dosya");
const komutlar = require("./lib/panel-komutlar");
const maliyet = require("./lib/panel-maliyet");
const anahtar = require("./lib/panel-anahtar");
const yayin = require("./lib/panel-yayin");
const yeniIs = require("./lib/panel-yeni-is");
const aiInfapp = require("./lib/panel-aiinfapp");
const { calistiriciOlustur } = require("./lib/panel-calistir");
const { kuyrukOlustur } = require("./lib/panel-kuyruk");
const { HttpHata } = H;

const KOK = __dirname;
const PUBLIC = path.join(KOK, "panel-public");
const PORT = Number(process.env.PANEL_PORT) || 4173;
// SOZLESME 6.4: panel HER ZAMAN yalniz bu bilgisayara baglanir. Agda acma secenegi (PANEL_HOST) bilerek YOK: sayfa jetonu
// HTML'e gomulu verir; ag'a acik bir panelde Host'u izinli HER istemci jetonu alip .env anahtarlarini yazabilir, ucretli is baslatabilirdi.
const HOST = "127.0.0.1";
const INDIRICI_PORT = Number(process.env.INDIRICI_PORT) || 4190;
// Ai Infapp (ai-infapp/) ayri bir yerel web panelidir; panel onu yalniz dugmeyle baslatir. Dizin degiskeni testlerde sahte sunucu icindir.
const AIINFAPP_PORT = Number(process.env.AIINFAPP_PORT) || 4200;
const AIINFAPP_DIZINI = process.env.PANEL_AIINFAPP_DIZINI ? path.resolve(process.env.PANEL_AIINFAPP_DIZINI) : path.join(__dirname, "ai-infapp");
const BETIK_DIZINI = process.env.PANEL_BETIK_DIZINI ? path.resolve(process.env.PANEL_BETIK_DIZINI) : KOK;   // testlerde sahte betikler
const JETON = guvenlik.jetonUret();
const WIN = process.platform === "win32";
const sayiEnv = (ad, v) => (process.env[ad] !== undefined && Number.isFinite(Number(process.env[ad])) ? Number(process.env[ad]) : v);

// ---------------------------------------------------------------- panel gunlugu (cokmeler ve beklenmeyen hatalar)
function panelLog(mesaj) {
  try {
    const d = path.join(ortak.uretimDizini(), "_log");
    fs.mkdirSync(d, { recursive: true });
    const gun = ortak.damga().slice(0, 8);
    fs.appendFileSync(path.join(d, "panel-" + gun + ".log"), "[" + new Date().toISOString() + "] " + mesaj + "\n", "utf8");
  } catch (e) { /* gunluk yazilamiyorsa sessiz gec */ }
}
process.on("uncaughtException", e => { panelLog("uncaughtException: " + (e && e.stack || e)); console.error("  ! Beklenmeyen hata (günlüğe yazıldı): " + (e && e.message)); });
process.on("unhandledRejection", e => { panelLog("unhandledRejection: " + (e && e.stack || e)); console.error("  ! Beklenmeyen hata (günlüğe yazıldı): " + (e && e.message || e)); });

// ---------------------------------------------------------------- calistirici + kuyruk
// ucretli/engelli islemler baslamadan once ayni kontrolden gecer (anahtar, disk, maliyet, bozuk konu.json)
function onkontrolFirlat(tur, is, b) {
  const r = maliyet.onkontrol({ tur, is, b });
  const h = r.sorunlar.find(s => s.seviye === "hata");
  if (h) throw new HttpHata(h.kod === "konu_bozuk" ? 409 : 400, h.kod, h.mesaj, { cozum: h.cozum, sorunlar: r.sorunlar });
}
const calistirici = calistiriciOlustur({
  kok: KOK, betikDizini: BETIK_DIZINI, onkontrol: onkontrolFirlat,
  zamanlar: {
    bostaUyariSn: sayiEnv("PANEL_BOSTA_UYARI_SN", 900), bostaOldurSn: sayiEnv("PANEL_BOSTA_OLDUR_SN", 2700),
    videoBostaOldurSn: sayiEnv("PANEL_VIDEO_BOSTA_OLDUR_SN", 5400), kontrolMs: sayiEnv("PANEL_KONTROL_MS", 5000),
    zincirMax: sayiEnv("PANEL_ZINCIR_MAX", 2),
  },
});
const kuyruk = kuyrukOlustur({ calistirici });

// ---------------------------------------------------------------- kucuk yardimcilar
const isAl = (v, varOlmali) => {
  if (!ortak.guvenliAd(v)) throw new HttpHata(400, "gecersiz_is", "Geçersiz iş adı: yalnızca harf, rakam, tire ve alt çizgi (en çok 64 karakter).");
  if (varOlmali && !fs.existsSync(ortak.isDizin(v))) throw new HttpHata(404, "is_yok", "Böyle bir iş yok.");
  return v;
};
const canliFn = is => calistirici.durumuAl(is);

const portAcikMi = H.portAcikMi;

// Indirici portunda KIM dinliyor? "TCP acik" demek yetmez: proje disindaki ESKI kopya (bu depo disindaki eski bir klasor, ayni 4190 portu;
// Host/Origin/jeton/klasor korumasi yok) aciksa panel kullaniciyi ona yonlendirir ve yeni kopyanin korumalari sessizce devre disi kalirdi.
// Yeni kopya jetonsuz /api/durum'a 403 + {kod:"token"} verir; 200 + {isler, ayar} JSON'u veren sunucu eski kopyadir.
// -> "kapali" | "yeni" | "eski" | "baska" (baska program) | "yanit_yok" (port acik ama HTTP cevap vermiyor)
async function indiriciTani(port, ms) {
  if (!(await portAcikMi(port, 300))) return "kapali";     // kapali portta HTTP zaman asimi "yanit yok" sanilmasin
  return new Promise(coz => {
    let bitti = false;
    const son = v => { if (!bitti) { bitti = true; coz(v); } };
    try {
      const r = http.get({ host: "127.0.0.1", port, path: "/api/durum", timeout: ms || 600, headers: { Accept: "application/json" } }, res => {
        const parcalar = []; let boyut = 0;
        res.on("data", c => { boyut += c.length; if (boyut > 256 * 1024) { res.destroy(); son("baska"); } else parcalar.push(c); });
        res.on("error", () => son("baska"));
        res.on("end", () => {
          let j = null;
          try { j = JSON.parse(Buffer.concat(parcalar).toString("utf8")); } catch (e) { /* JSON degil */ }
          if (res.statusCode === 403 && j && j.kod === "token") return son("yeni");
          if (res.statusCode === 200 && j && Array.isArray(j.isler) && j.ayar && typeof j.ayar === "object") return son("eski");
          son("baska");
        });
      });
      r.on("timeout", () => { r.destroy(); son("yanit_yok"); });
      r.on("error", () => son("yanit_yok"));
    } catch (e) { son("yanit_yok"); }
  });
}

// kisa omurlu betik (ses testi gibi): {kod, cikti, sonuc}
function kisaCalistir(betik, argv, zamanAsimiMs) {
  return new Promise(coz => {
    const yol = path.join(BETIK_DIZINI, betik);
    if (!fs.existsSync(yol)) return coz({ kod: 2, cikti: betik + " bu kurulumda yok.", sonuc: null });
    let cikti = "", sonuc = null, bitti = false;
    const bit = kod => { if (bitti) return; bitti = true; clearTimeout(t); coz({ kod, cikti, sonuc }); };
    let p;
    try { p = spawn(process.execPath, [yol].concat(argv), { cwd: KOK, windowsHide: true, env: Object.assign({}, process.env, { OTOMASYON_PANEL: "1" }) }); }
    catch (e) { return coz({ kod: 1, cikti: e.message, sonuc: null }); }
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} bit(124); }, zamanAsimiMs || 60000);
    const al = d => { for (const l of String(d).split(/\r?\n/)) { const m = /^@@SONUC\s+(.*)$/.exec(l); if (m) { try { sonuc = JSON.parse(m[1]); } catch (e) {} } else cikti += l + "\n"; } };
    p.stdout.on("data", al); p.stderr.on("data", al);
    p.on("error", e => { cikti += e.message; bit(1); });
    p.on("close", k => bit(k === null ? 1 : k));
  });
}

// vidIQ kalan kredi (60 sn onbellek, 8 sn zaman asimi); anahtar yoksa ya da ag kapaliysa null
let _bakiye = { t: 0, v: null };
async function vidiqBakiye() {
  if (!ortak.envOku("VIDIQ_KEY") || process.env.PANEL_ANAHTAR_TEST_KAPALI === "1") return null;
  if (Date.now() - _bakiye.t < 60000) return _bakiye.v;
  let v = null;
  try {
    const m = require("./lib/vidiq");
    const r = await Promise.race([m.bakiye(ortak.envOku("VIDIQ_KEY")), new Promise((_, red) => setTimeout(() => red(new Error("zaman asimi")), 8000))]);
    v = r && typeof r.kalan === "number" ? r.kalan : null;
  } catch (e) { v = null; }
  _bakiye = { t: Date.now(), v };
  return v;
}

// ses testi: gecici dosyalar jetonlu adresle servis edilir, 10 dk sonra silinir
const sesTestleri = new Map();
const SESTESTI_DIZIN = path.join(os.tmpdir(), "otomasyon-sestesti");
function sesTestiTemizle() {
  const simdi = Date.now();
  for (const [id, x] of sesTestleri) if (x.bitis < simdi) { try { fs.unlinkSync(x.dosya); } catch (e) {} sesTestleri.delete(id); }
  // onceki panel oturumlarindan kalan eski ornekler (panel aniden kapandiysa)
  try { for (const f of fs.readdirSync(SESTESTI_DIZIN)) { const p = path.join(SESTESTI_DIZIN, f); if (simdi - fs.statSync(p).mtimeMs > 15 * 60000) fs.unlinkSync(p); } } catch (e) {}
}
const sesTemizleyici = setInterval(sesTestiTemizle, 60000); if (sesTemizleyici.unref) sesTemizleyici.unref();

const ORNEK_METIN = { en: "This is a short voice test for your channel.", tr: "Bu, kanalınız için kısa bir ses denemesidir.", es: "Esta es una breve prueba de voz para tu canal.", de: "Dies ist ein kurzer Stimmtest für deinen Kanal.", fr: "Ceci est un court test de voix pour votre chaîne." };

// ---------------------------------------------------------------- API yolu tablosu
const GET = {}, POST = {};

GET["/api/ozellikler"] = async () => {
  const dir = path.join(KOK, "video-indirici", "server.js");
  const [indiriciDurum, aiInfappDurum] = await Promise.all([indiriciTani(INDIRICI_PORT, 400), aiInfapp.tani(AIINFAPP_PORT, 400)]);
  return { surum: 1, platform: process.platform, claude: !!ortak.envOku("ANTHROPIC_API_KEY"), vidiq: !!ortak.envOku("VIDIQ_KEY"),
    // "calisiyor" yalniz BU projenin indiricisi / Ai Infapp'i icin (eski korumasiz kopya ya da baska program calisiyor sayilmaz)
    indirici: { var: fs.existsSync(dir), calisiyor: ["yeni", "yanit_yok"].includes(indiriciDurum), port: INDIRICI_PORT },
    aiinfapp: { var: fs.existsSync(path.join(AIINFAPP_DIZINI, "server.js")), calisiyor: ["yeni", "yanit_yok"].includes(aiInfappDurum), port: AIINFAPP_PORT } };
};
POST["/api/indirici/baslat"] = async () => {
  const dosyaYolu = path.join(KOK, "video-indirici", "server.js");
  if (!fs.existsSync(dosyaYolu)) throw new HttpHata(404, "indirici_yok", "Video indirici bu kurulumda yok.");
  const tani = await indiriciTani(INDIRICI_PORT, 600);
  if (tani === "yeni" || tani === "yanit_yok") return { ok: true, port: INDIRICI_PORT };
  if (tani === "eski") throw new HttpHata(409, "indirici_eski", "Port " + INDIRICI_PORT + "'de ESKİ, güvenlik denetimi olmayan bir video indirici çalışıyor (bu projenin dışındaki, eski bir video indirici klasörü). Panel onu açmaz.",
    { cozum: "O indirici penceresini kapat, sonra bu düğmeye yeniden bas. O klasörü bir daha açma: güncellenmiyor; indirilenler klasöründeki dosyaları bu projedeki video-indirici\\indirilenler içine taşıyıp eski klasörü silebilirsin." });
  if (tani === "baska") throw new HttpHata(409, "indirici_port", "Port " + INDIRICI_PORT + " başka bir program tarafından kullanılıyor; video indirici açılamaz.",
    { cozum: "Portu kullanan programı kapat ya da INDIRICI_PORT ortam değişkeniyle başka bir port ver (hem panel hem indirici aynı değeri görmeli)." });
  if (process.env.PANEL_INDIRICI_KAPALI === "1") throw new HttpHata(500, "indirici", "Video indirici başlatma bu ortamda kapalı.");
  let hata = null;
  const p = spawn(process.execPath, [dosyaYolu], { cwd: path.dirname(dosyaYolu), windowsHide: true, stdio: "ignore", detached: true, env: Object.assign({}, process.env, { INDIRICI_PORT: String(INDIRICI_PORT) }) });
  p.on("error", e => { hata = e; });
  p.unref();
  for (let i = 0; i < 40; i++) {
    if (hata) break;
    await new Promise(r => setTimeout(r, 200));
    if (await portAcikMi(INDIRICI_PORT, 200)) return { ok: true, port: INDIRICI_PORT };
  }
  throw new HttpHata(500, "indirici", "Video indirici başlatılamadı" + (hata ? ": " + hata.message : " (8 sn içinde açılmadı)."), { cozum: "video-indirici klasöründe BASLAT.bat ile elle başlatmayı dene; yt-dlp ve ffmpeg kurulu olmalı." });
};
// Ai Infapp: teshis + baslatma lib/panel-aiinfapp.js'te (mantik indirici ile ayni; ek olarak sunucu acilmadan kapanirsa hemen hata verir).
// Diger POST uclari gibi Host/Origin/Sec-Fetch/Content-Type/oturum jetonu kapisindan gecer; ayri bir muafiyet yoktur.
POST["/api/aiinfapp/baslat"] = async () => aiInfapp.baslat({ port: AIINFAPP_PORT, dizin: AIINFAPP_DIZINI, kapali: process.env.PANEL_AIINFAPP_KAPALI === "1" });

GET["/api/isler"] = async () => ({ isler: isler.isListesi(canliFn) });
GET["/api/is-detay"] = async c => {
  const is = isAl(c.q.get("is"), true);
  const ayar = ortak.ayarOku();
  return isler.isDetay(is, canliFn(is), ayar, ayar.diskEsikGB);
};
GET["/api/sahneler"] = async c => { const is = isAl(c.q.get("is"), true); return Object.assign({ sahneler: isler.sahneler(is) }, isler.manifestNotlari(is)); };
GET["/api/gorseller"] = async c => ({ gorseller: isler.gorseller(isAl(c.q.get("is"), true)) });

GET["/api/ayarlar"] = async () => ortak.ayarOku();
POST["/api/ayarlar"] = async c => {
  const d = ortak.ayarDogrula(c.b);
  if (!d.gecerli) throw new HttpHata(400, "ayar_gecersiz", "Ayarlar geçersiz: " + d.hatalar.slice(0, 3).map(h => h.alan + " — " + h.mesaj).join("; "), { alanlar: d.hatalar });
  const yeni = ortak.ayarBirlestir(ortak.ayarOku(), c.b);
  yeni.surum = 1;
  // okunamayan (bozuk / nesne olmayan) ayar dosyasi varsayilanlarla degistirilecek: kullanici elle kurtarabilsin diye kopyasi kalir
  try {
    const p = ortak.ayarDosyasi();
    if (fs.existsSync(p)) {
      let gecerli = false;
      try { gecerli = ortak.duzNesne(ortak.jsonOku(p, null)); } catch (e) { gecerli = false; }
      if (!gecerli) fs.copyFileSync(p, p + ".bozuk-" + ortak.damga());
    }
  } catch (e) { /* yedek alinamadiysa yazmayi engelleme */ }
  ortak.atomikJsonYaz(ortak.ayarDosyasi(), yeni);
  return { ok: true, ayar: yeni };
};

GET["/api/onkontrol"] = async c => {
  const tur = c.q.get("tur") || "hepsi", is = c.q.get("is");
  if (!komutlar.TURLER.includes(tur)) throw new HttpHata(400, "gecersiz_islem", "Geçersiz işlem.");
  if (is) isAl(is, true);
  return maliyet.onkontrol({ tur, is: is || null });
};

// ---- yeni is
POST["/api/yeni"] = async c => {
  const g = c.b;
  const ayar = ortak.ayarOku();
  const { hatalar } = yeniIs.girdiDogrula(g, ayar);
  if (hatalar.length) throw new HttpHata(400, "girdi", hatalar.map(h => h.mesaj).join(" "), { alanlar: hatalar });
  if (g.uret === true) {
    // ONCE on kontrol: basarisizsa klasor acilmaz, bos is kalmaz
    const r = maliyet.onkontrol({ tur: "hepsi", is: null, ayar, b: g });          // b: dil/altyaziDili (cevirisi Claude anahtari ister)
    const h = r.sorunlar.find(s => s.seviye === "hata");
    if (h) throw new HttpHata(400, h.kod, h.mesaj, { cozum: h.cozum, sorunlar: r.sorunlar });
  }
  let sonuc;
  try { sonuc = yeniIs.yeniIs(g, { ayar }); }
  catch (e) {
    if (e instanceof yeniIs.GirdiHatasi) throw new HttpHata(e.durum || 400, e.kod, e.message, { alanlar: e.alanlar });
    throw e;
  }
  const yanit = { ok: true, ad: sonuc.ad, uyarilar: sonuc.uyarilar };
  if (g.uret === true) {
    try { yanit.id = calistirici.baslat("hepsi", { is: sonuc.ad }).id; }
    catch (e) {
      try { fs.rmSync(sonuc.dizin, { recursive: true, force: true }); } catch (e2) {}
      throw e;
    }
  }
  return yanit;
};
POST["/api/vs-yeni"] = async c => dosya.vsYeni(c.b);
POST["/api/is-arsivle"] = async c => {
  const is = isAl(c.b.is, true);
  if (calistirici.durumuAl(is)) throw new HttpHata(409, "is_calisiyor", "Bu iş çalışıyor ya da onay bekliyor; önce Durdur'a bas.");
  return dosya.arsivle(is);
};

// ---- dosyalar
GET["/api/dosya"] = async c => {
  const is = isAl(c.q.get("is"), true), tur = c.q.get("tur");
  return dosya.dosyaOku(is, tur);
};
POST["/api/dosya"] = async c => {
  const is = isAl(c.q.get("is"), true), tur = c.q.get("tur");
  return dosya.dosyaYaz(is, tur, c.b.icerik);
};
POST["/api/gorunum"] = async c => dosya.gorunumUygula(isAl(c.b.is, true), c.b);
POST["/api/baslik-sec"] = async c => dosya.baslikSec(isAl(c.b.is, true), c.b.baslik);
POST["/api/gorsel-sil"] = async c => {
  const is = isAl(c.b.is, true);
  if (calistirici.isMesgulId(is)) throw new HttpHata(409, "is_calisiyor", "Bu iş çalışırken görsel silinemez; işlem bitince tekrar dene.", { id: calistirici.isMesgulId(is) });
  return dosya.gorselSil(is, c.b.sahne, c.b.ad);
};
POST["/api/ac"] = async c => {
  const is = isAl(c.b.is, true);
  const klasor = c.b.klasor === undefined || c.b.klasor === null ? "" : (typeof c.b.klasor === "string" ? c.b.klasor : "?");
  if (!["", "video", "tmp"].includes(klasor)) throw new HttpHata(400, "klasor", "Klasör video, tmp ya da boş olmalı.");
  const d = path.join(ortak.isDizin(is), klasor === "video" ? "Videos" : klasor === "tmp" ? "_tmp" : "");
  if (!fs.existsSync(d)) throw new HttpHata(404, "klasor_yok", "Bu klasör henüz oluşmamış.");
  if (process.env.PANEL_AC_KAPALI === "1") return { ok: true, acilmadi: true };
  const komut = WIN ? ["explorer.exe", [d]] : process.platform === "darwin" ? ["open", [d]] : ["xdg-open", [d]];
  const sonuc = await new Promise(coz => {
    let p;
    try { p = spawn(komut[0], komut[1], { detached: true, stdio: "ignore" }); } catch (e) { return coz(e); }
    p.once("error", e => coz(e));
    p.once("spawn", () => coz(null));
    p.unref();
    setTimeout(() => coz(null), 2000).unref();
  });
  if (sonuc) throw new HttpHata(500, "ac_hata", "Klasör açılamadı: " + sonuc.message, { cozum: "Klasörü elle aç: " + d });
  return { ok: true };
};

// ---- calistirma
POST["/api/calistir"] = async c => {
  const b = c.b;
  return calistirici.baslat(typeof b.tur === "string" ? b.tur : "", b);     // {"toString":"x"} gibi nesne String()'i patlatmasin
};
POST["/api/onayla"] = async c => calistirici.onayla(c.b.is);
POST["/api/durdur"] = async c => ({ ok: calistirici.durdur(c.b.id) });
GET["/api/calisanlar"] = async () => ({ calisanlar: calistirici.calisanlar(), kuyruk: kuyruk.liste().ogeler.filter(x => x.durum === "sirada" || x.durum === "calisiyor") });
GET["/api/gunluk"] = async c => isler.sonGunluk(isAl(c.q.get("is"), true), c.q.get("satir"));      // diskteki son gunluk (panel yeniden baslamis olsa da)
GET["/api/log"] = async c => {
  const id = c.q.get("id");
  const ara = parseInt(c.q.get("ara"), 10);
  const l = calistirici.log(id, ara);
  if (!l) throw new HttpHata(404, "log_yok", "Bu iş kaydı bulunamadı (panel yeniden başlamış olabilir).");
  return l;
};

// ---- kuyruk
GET["/api/kuyruk"] = async () => kuyruk.liste();
POST["/api/kuyruk/ekle"] = async c => {
  const eklenen = kuyruk.ekle(c.b.isler, () => {
    const r = maliyet.onkontrol({ tur: "hepsi", is: null, adet: Array.isArray(c.b.isler) ? c.b.isler.length : 1, girdiler: Array.isArray(c.b.isler) ? c.b.isler : undefined });
    const h = r.sorunlar.find(s => s.seviye === "hata");
    if (h) throw new HttpHata(400, h.kod, h.mesaj, { cozum: h.cozum, sorunlar: r.sorunlar });
  });
  return { ok: true, eklenen };
};
POST["/api/kuyruk/iptal"] = async c => { kuyruk.iptal(isAl(c.b.is)); return { ok: true }; };
POST["/api/kuyruk/duraklat"] = async () => { kuyruk.duraklat(); return { ok: true }; };
POST["/api/kuyruk/devam"] = async () => { kuyruk.devam(); return { ok: true }; };

// ---- anahtarlar
GET["/api/anahtarlar"] = async () => anahtar.maskeliListe();
POST["/api/anahtarlar"] = async c => {
  const { ayarla, sil } = anahtar.govdeCoz(c.b);
  ortak.envYaz({ ayarla, sil });
  _bakiye = { t: 0, v: null };
  const test = {};
  if (process.env.PANEL_ANAHTAR_TEST_KAPALI !== "1") {
    const liste = anahtar.testlerKaydedilenler(Object.keys(ayarla));
    await Promise.all(liste.map(async t => { test[t] = await anahtar.testEt(t); }));
  }
  return { ok: true, test };
};
GET["/api/anahtar-test"] = async c => anahtar.testHepsi(c.q.get("anahtar") || "hepsi");

// ---- maliyet / disk / raporlar / performans / yayin
GET["/api/maliyet"] = async () => maliyet.maliyetOzeti(ortak.ayarOku(), await vidiqBakiye());
GET["/api/disk"] = async () => dosya.diskOzeti();
POST["/api/temizle"] = async c => {
  // tur:"onbellek" = isten bagimsiz ortak onbellek (uretim/_onbellek: geri sayim karti); tur:"ara" = tek isin _tmp klasoru
  if (c.b.tur === "onbellek") {
    if (calistirici.calisanVideoVar()) throw new HttpHata(409, "is_calisiyor", "Bir video kuruluyor; ortak önbellek ondan sonra temizlenebilir.");
    return dosya.onbellekTemizle();
  }
  const is = isAl(c.b.is, true);
  if (c.b.tur !== "ara") throw new HttpHata(400, "tur", "Temizleme türü ara ya da onbellek olmalı.");
  if (calistirici.durumuAl(is)) throw new HttpHata(409, "is_calisiyor", "Bu iş çalışıyor ya da onay bekliyor; önce Durdur'a bas.");
  return dosya.araDosyalariTemizle(is);
};
GET["/api/shorts"] = async c => ({ shorts: isler.shortsListesi(isAl(c.q.get("is"), true)) });
GET["/api/marka"] = async () => {                // marka-yap.js ciktilari (uretim/_marka): /marka/<dosya> ile gosterilir
  const d = path.join(ortak.uretimDizini(), "_marka");
  let liste = [];
  try { liste = fs.readdirSync(d).filter(x => /\.(png|jpe?g)$/i.test(x)).map(x => ({ ad: x, mb: Math.round(fs.statSync(path.join(d, x)).size / 1048576 * 100) / 100 })); } catch (e) {}
  return { dosyalar: liste };
};
GET["/api/raporlar"] = async c => dosya.raporListe(c.q.get("tur"));
GET["/api/rapor"] = async c => dosya.raporOku(c.q.get("tur"), c.q.get("ad"));
POST["/api/yayin-isaretle"] = async c => ({ ok: true, yayin: yayin.yayinIsaretle(isAl(c.b.is, true), c.b) });
GET["/api/performans"] = async () => yayin.performansOzeti();
POST["/api/ses-testi"] = async c => {
  const ayar = ortak.ayarOku();
  const motor = c.b.motor || "otomatik";
  // gecerli motorlar tek yerden (konu.json ve CLI ile ayni liste; 'sistem' dahil)
  if (typeof motor !== "string" || !ortak.SES_MOTORLARI.includes(motor))
    throw new HttpHata(400, "motor", "Motor şunlardan biri olmalı: " + ortak.SES_MOTORLARI.join(", ") + ".");
  const dil = c.b.dil || ayar.dil || "en";
  if (typeof dil !== "string" || !/^[a-z]{2}$/.test(dil)) throw new HttpHata(400, "dil", "Dil iki küçük harf olmalı.");
  const ses = c.b.ses || (dil === ayar.dil ? ayar.ses : ortak.varsayilanSes(dil));
  // Edge/Azure/Piper ses adı ya da yerel VoxCPM2 sesi: voxcpm:<ad> / voxcpm:<ad>/<çeşit>
  if (typeof ses !== "string" || !(/^[A-Za-z0-9._-]{1,80}$/.test(ses) || /^voxcpm:[a-z0-9_]{1,60}(\/\d{1,3})?$/.test(ses))) throw new HttpHata(400, "ses", "Ses adı geçersiz.");
  const id = crypto.randomBytes(12).toString("hex");
  fs.mkdirSync(SESTESTI_DIZIN, { recursive: true });
  const cikti = path.join(SESTESTI_DIZIN, id + ".mp3");
  // VoxCPM2 her çağrıda modeli ekran kartına yükler (10-20 sn); kısa bir örnek için bile daha uzun süre tanınır
  const voxcpm = motor === "voxcpm" || ses.startsWith("voxcpm:");
  const r = await kisaCalistir("seslendir.js", ["--test", cikti, "--ses", ses, "--motor", motor, "--metin", ORNEK_METIN[dil] || ORNEK_METIN.en], voxcpm ? 240000 : 70000);
  if (r.kod !== 0 || !fs.existsSync(cikti)) {
    try { fs.unlinkSync(cikti); } catch (e) {}
    const c2 = ortak.hataCevir(r.cikti);
    throw new HttpHata(500, "ses_testi", "Ses testi başarısız: " + (c2.kod === "genel" ? (r.cikti.split("\n").filter(Boolean).pop() || "bilinmeyen hata").replace(/^\s*✗\s*/, "") : c2.ozet), { cozum: c2.cozum || "Motoru ya da sesi değiştirip tekrar dene." });
  }
  sesTestleri.set(id, { dosya: cikti, bitis: Date.now() + 10 * 60000 });
  return { ok: true, motor: (r.sonuc && r.sonuc.motor) || motor, sureSn: (r.sonuc && r.sonuc.sureSn) || null, url: "/sestesti/" + id };
};

// ---------------------------------------------------------------- medya (cerezle yetkilendirilen GET'ler)
function medya(c, yol) {
  const parca = yol.split("/").slice(1).map(p => { try { return decodeURIComponent(p); } catch (e) { throw new HttpHata(400, "yol", "Geçersiz adres."); } });
  const tur = parca[0];
  if (tur === "onizle") {
    const [, is, sahne, ad] = parca;
    isAl(is);
    if (parca.length !== 4 || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(sahne || "") || (sahne || "").includes("..") || !ad || path.basename(ad) !== ad || !isler.GORSEL_UZ.test(ad))
      throw new HttpHata(400, "yol", "Geçersiz adres.");
    const vis = path.join(ortak.isDizin(is), "Visuals");
    const p = path.join(vis, sahne, ad);
    if (!ortak.yolIcinde(vis, p)) throw new HttpHata(403, "yol", "Bu yola erişim yok.");
    return H.dosyaAkit(c.req, c.res, p, { onbellek: "private, max-age=60" });
  }
  if (tur === "video") {
    const is = isAl(parca[1]);
    // /video/<is> = final video; /video/<is>/onizleme = "Onizleme" adiminin kisa dusuk cozunurluklu ciktisi
    if (parca.length === 3 && parca[2] === "onizleme")
      return H.dosyaAkit(c.req, c.res, path.join(ortak.isDizin(is), "Videos", is + "-onizleme.mp4"), { tur: "video/mp4" });
    if (parca.length !== 2) throw new HttpHata(400, "yol", "Geçersiz adres.");
    return H.dosyaAkit(c.req, c.res, path.join(ortak.isDizin(is), "Videos", is + ".mp4"), { tur: "video/mp4" });
  }
  if (tur === "shorts") {
    // /shorts/<is>/<dosya>: "Videodan Shorts cikar" ciktilari (Shorts/NN-ad.mp4); ?indir=1 ile dosya olarak iner
    const is = isAl(parca[1]);
    const ad = parca[2];
    if (parca.length !== 3 || !ad || path.basename(ad) !== ad || !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,100}\.mp4$/i.test(ad) || /\.part\./i.test(ad))
      throw new HttpHata(400, "yol", "Geçersiz adres.");
    const d = path.join(ortak.isDizin(is), "Shorts");
    const p = path.join(d, ad);
    if (!ortak.yolIcinde(d, p)) throw new HttpHata(403, "yol", "Bu yola erişim yok.");
    const sec = { tur: "video/mp4" };
    if (new URL(c.req.url, "http://localhost").searchParams.get("indir") === "1") sec.indirAd = is + "-" + ad;
    return H.dosyaAkit(c.req, c.res, p, sec);
  }
  if (tur === "indir") {
    const is = isAl(parca[1]);
    const t = parca[2];
    const b = ortak.isDizin(is);
    const harita = {
      video: [path.join(b, "Videos", is + ".mp4"), is + ".mp4"],
      onizleme: [path.join(b, "Videos", is + "-onizleme.mp4"), is + "-onizleme.mp4"],
      srt: [isler.var_(path.join(b, "Videos", is + ".srt")) ? path.join(b, "Videos", is + ".srt") : path.join(b, "altyazi.srt"), is + ".srt"],
      kapak: [path.join(b, "Videos", is + "-kapak.jpg"), is + "-kapak.jpg"],
      yayin: [path.join(b, "YAYIN-PAKETI.md"), is + "-yayin-paketi.md"],
      bolumler: [path.join(b, "bolumler.txt"), is + "-bolumler.txt"],
      atif: [path.join(b, "ATIF.txt"), is + "-atif.txt"],
      baslik: [path.join(b, "BASLIK-VE-ETIKETLER.md"), is + "-baslik-ve-etiketler.md"],
    };
    if (parca.length !== 3 || !harita[t]) throw new HttpHata(400, "tur", "İndirme türü video, onizleme, srt, kapak, yayin, bolumler, atif ya da baslik olmalı.");
    return H.dosyaAkit(c.req, c.res, harita[t][0], { indirAd: harita[t][1] });
  }
  if (tur === "marka") {
    const ad = parca[1];
    const d = path.join(ortak.uretimDizini(), "_marka");
    if (parca.length !== 2 || !ad || path.basename(ad) !== ad || !/\.(png|jpe?g)$/i.test(ad)) throw new HttpHata(400, "yol", "Geçersiz adres.");
    const p = path.join(d, ad);
    if (!ortak.yolIcinde(d, p)) throw new HttpHata(403, "yol", "Bu yola erişim yok.");
    return H.dosyaAkit(c.req, c.res, p, { onbellek: "private, max-age=30" });
  }
  if (tur === "sestesti") {
    const x = sesTestleri.get(parca[1]);
    if (!x || parca.length !== 2) throw new HttpHata(404, "yok", "Ses örneği bulunamadı ya da süresi doldu.");
    return H.dosyaAkit(c.req, c.res, x.dosya, { tur: "audio/mpeg" });
  }
  throw new HttpHata(404, "yok", "Bulunamadı.");
}

// ---------------------------------------------------------------- sunucu
function hataIsle(req, res, e) {
  if (e instanceof HttpHata) return H.hataYaniti(res, e);
  if (e instanceof ortak.OrtakHata) {
    const durum = e.kod === "konu_bozuk" || e.kod === "konu_gecersiz" ? 409 : e.kod === "gecersiz_is" || e.kod === "env_ad" || e.kod === "env_deger" ? 400 : 500;
    return H.hataYaniti(res, { durum, kod: e.kod === "bozuk" ? "dosya_bozuk" : e.kod, hata: e.message, cozum: e.cozum, satir: e.satir, sutun: e.sutun });
  }
  if (e && (e.code === "ENOSPC" || e.code === "EDQUOT")) return H.hataYaniti(res, { durum: 500, kod: "disk_dolu", hata: "Diskte boş yer kalmadı; işlem yapılamadı.", cozum: "Disk alanı aç ve tekrar dene." });
  panelLog("istek hatasi " + req.method + " " + req.url + ": " + (e && e.stack || e));
  // yigin izi disariya SIZMAZ
  H.hataYaniti(res, { durum: 500, kod: "sunucu", hata: "Panelde beklenmeyen bir hata oluştu; ayrıntı günlüğe yazıldı." });
}

async function isle(req, res) {
  let u;
  try { u = new URL(req.url, "http://localhost"); } catch (e) { guvenlik.guvenlikBasliklari(res); return H.hataYaniti(res, new HttpHata(400, "adres", "Geçersiz adres.")); }
  const yol = u.pathname;
  guvenlik.guvenlikBasliklari(res);
  const red = guvenlik.kapi(req, yol, PORT, JETON);
  if (red) return H.hataYaniti(res, new HttpHata(red.durum, red.kod, red.hata));
  const yontem = req.method || "GET";

  if (yol.startsWith("/api/")) {
    const tablo = yontem === "GET" ? GET : yontem === "POST" ? POST : null;
    const fn = tablo && Object.prototype.hasOwnProperty.call(tablo, yol) ? tablo[yol] : null;
    if (!fn) throw new HttpHata(404, "yok", "Bulunamadı.");
    const c = { req, res, q: u.searchParams, b: {} };
    if (yontem === "POST") c.b = await H.govdeOku(req);
    const sonuc = await fn(c);
    return H.json(res, 200, sonuc === undefined ? { ok: true } : sonuc);
  }
  if (yontem !== "GET" && yontem !== "HEAD") throw new HttpHata(404, "yok", "Bulunamadı.");
  if (guvenlik.MEDYA_YOLU.test(yol)) return medya({ req, res }, yol);

  // statik: panel sayfasi + varliklar. HTML'e jeton gomulur, oturum cerezi verilir.
  return H.statikGonder(res, PUBLIC, yol, { donustur: html => guvenlik.htmlEnjekte(html, JETON), cerez: guvenlik.cerezDegeri(JETON) });
}

const server = http.createServer((req, res) => {
  isle(req, res).catch(e => { try { hataIsle(req, res, e); } catch (e2) { try { res.destroy(); } catch (e3) {} } });
});
server.on("clientError", (e, soket) => { try { soket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); } catch (e2) {} });
server.on("error", e => {
  if (e && e.code === "EADDRINUSE") {
    console.error("\n  ✗ " + PORT + " numaralı port dolu — panel zaten açık olabilir.");
    console.error("    Tarayıcıda http://localhost:" + PORT + " adresini dene; açılmıyorsa eski paneli kapatıp yeniden başlat.\n");
    process.exit(98);
  }
  panelLog("sunucu hatasi: " + (e && e.stack || e));
  console.error("  ✗ Sunucu hatası: " + (e && e.message));
  process.exit(1);
});

function basla() {
  server.listen(PORT, HOST, () => {
    // Acilis isleri (yetim kilit taramasi, kuyruk yukleme, ses ornegi temizligi) YALNIZ port alindiktan sonra yapilir. Eskiden listen'den
    // ONCE yapiliyordu: PANEL.bat'a ikinci kez cift tiklaninca ikinci ornek 98 ile cikmadan once ilk panelin durum.json/_kuyruk.json
    // dosyalarini bozuyordu (calisan isi "panel kapandi" diye isaretliyor, kuyrugu duraklatiyordu). Port doluysa 'error' olayi
    // (EADDRINUSE → cikis 98) bu satira hic gelmez, hicbir dosyaya dokunulmaz. Ayni tick'te calistigi icin ilk istek taramadan once gelmez.
    sesTestiTemizle();
    calistirici.baslangicTaramasi();
    kuyruk.yukle();
    console.log("\n  ============================================");
    console.log("   OTOPILOT");
    console.log("  ============================================\n");
    console.log("   Panel : http://localhost:" + PORT);
    console.log("   Video indirici ayrı çalışır: panelden \"Video indirici\" düğmesiyle başlat (http://localhost:" + INDIRICI_PORT + ").");
    console.log("   Ai Infapp ayrı çalışır: panelden \"Ai Infapp\" düğmesiyle başlat (http://localhost:" + AIINFAPP_PORT + ").");
    console.log("\n   Kapatmak için bu pencereyi kapat.\n");
    require("./lib/egitim").otomatik();   // eğitim PDF'leri bir kez masaüstüne iner (yalnız terminalde; hata vermez)
    if (process.send) process.send({ hazir: true, port: PORT });
  });
}
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { try { server.close(); } catch (e) {} calistirici.kapat(); process.exit(0); });

if (require.main === module) basla();
module.exports = { server, basla, calistirici, kuyruk, JETON };
