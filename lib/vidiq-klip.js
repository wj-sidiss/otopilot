// lib/vidiq-klip.js — vidIQ ile AI video klipi uretimi (Seedance, Veo, MiniMax, Kling...). KREDI HARCAR: kati korumalar var.
//
// Korumalar:
//   * Varsayilan KURU CALISMA: ne kadar kredi harcanacagini yazar, hicbir sey baslatmaz. Harcama icin acik `onay` gerekir.
//   * `butce` (kredi) yeni is varsa ZORUNLU: tahmini toplam butceyi asarsa hic baslamaz. Calisirken her yeni klipten ONCE
//     kalan butce o klibin maliyetine karsi denetlenir (birim = tablo tahmini ile bu kosuda OLCULEN kredi/sn'nin buyugu);
//     yetmiyorsa klip baslamaz. Harcama GERCEK bakiye farkiyla (gonderimden hemen once/sonra) olculur.
//   * Ayni cekim (istem|sure|model|cozunurluk|oran) ASLA ikinci kez ucretli uretilmez (Clips/klipler.json): teslim edilen
//     atlanir; ucreti odenmis yarim is ve dosyasi silinmis teslim UCRETSIZ yeniden sorgulanir (vidiq_job_poll). Listedeki
//     tekrar satiri ve silinen klibin yeni surumu yalniz `yeniCekim` ile (confirmNewAttempt) uretilir.
//   * vidIQ'da basarisiz/expired biten is (kredi iade edilir) kayitta 'basarisiz' isaretlenir; sonraki kosu onu yeniden
//     baslatir. Bir klibin hatasi listedeki digerlerini durdurmaz.
//   * klipler.json okunamiyor/bozuksa HICBIR SEY baslamaz (bos sayilmaz); var olan klip dosyasi asla ezilmez.
//   * vidiq_job_poll ve vidiq_balance ucretsizdir; yalniz vidiq_generate_video krediyle calisir.
//
// Ag ve vidIQ istemcisi enjekte edilebilir (testte gercek krediye dokunulmaz).
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak.js");

// kredi/sn UST SINIR tahminleri (olculen: seedance-2 1080p 88, veo-3.1 1080p 80, minimax-h3 2k 23-26). Olculmeyenler tutucu (yuksek)
// tahmindir; gercek ucret gonderimde kesinlesir ve butce GERCEK bakiye farkiyla da izlenir.
const KREDI_SN = {
  "minimax-h3": { "768p": 20, "2k": 26 },
  "seedance-2-fast": { "720p": 40 },
  "seedance-2": { "720p": 60, "1080p": 88 },
  "veo-3.1-lite": { "720p": 30, "1080p": 45 },
  "veo-3.1-fast": { "720p": 40, "1080p": 60 },
  "veo-3.1": { "720p": 60, "1080p": 80 },
  "kling-3": { "720p": 60, "1080p": 70 },
  "kling-3-pro": { "720p": 90, "1080p": 100 },
  "gemini-omni-flash": { "720p": 40 },
};
// En ucuz makul varsayilan: minimax-h3 768p
const VARSAYILAN = Object.freeze({ model: "minimax-h3", cozunurluk: "768p", sure: 5, oran: "9:16" });
const ORANLAR = ["9:16", "16:9"];          // vidIQ aspectRatio degerleri

function hata(kod, mesaj, cozum, cikis) { const e = new Error(mesaj); e.kod = kod; e.cikis = cikis || 2; if (cozum) e.cozum = cozum; return e; }

// "istem metni | 6" -> {istem, sure}. # ile baslayan ve bos satirlar yok sayilir.
function klipListesi(metin, varsayilanSure) {
  const liste = [];
  for (const ham of String(metin || "").split(/\r?\n/)) {
    const s = ham.trim();
    if (!s || s.startsWith("#")) continue;
    const m = /^(.*?)\s*\|\s*(\d{1,2})\s*$/.exec(s);
    const istem = (m ? m[1] : s).trim();
    const sure = m ? Number(m[2]) : varsayilanSure;
    if (istem) liste.push({ istem: istem.slice(0, 4000), sure });
  }
  return liste;
}

function sureGecerli(model, sure) {
  if (model === "veo-3.1" || model === "veo-3.1-fast" || model === "veo-3.1-lite") return [4, 6, 8].includes(sure);
  if (model === "minimax-h3") return sure >= 4 && sure <= 15;
  if (model === "gemini-omni-flash") return sure >= 3 && sure <= 10;
  return sure >= 1 && sure <= 15;
}

function tahmin(liste, model, cozunurluk) {
  const oran = (KREDI_SN[model] || {})[cozunurluk];
  if (!oran) {
    const gecerli = Object.entries(KREDI_SN).map(([m, c]) => m + ": " + Object.keys(c).join("/")).join(" · ");
    throw hata("model_cozunurluk", "'" + model + "' modeli için '" + cozunurluk + "' çözünürlüğü yok.", "Geçerli: " + gecerli);
  }
  let toplam = 0;
  for (const k of liste) {
    if (!sureGecerli(model, k.sure)) throw hata("sure", "'" + k.istem.slice(0, 40) + "…' için " + k.sure + " sn bu modelde geçersiz.", "Veo 4/6/8 sn, MiniMax 4–15, Seedance/Kling 1–15, Omni 3–10.");
    toplam += k.sure * oran;
  }
  return { toplam, oran };
}

// Sonuc nesnesinde video adresini bul (vidIQ sonuc bicimi surumlere gore degisebilir).
//   1) videoUrl / video_url / downloadUrl / download_url acik anahtarlari
//   2) 'url' anahtari YALNIZ yolu video uzantisiyla bitiyorsa ya da ust anahtar video/clip ise
//   3) alt agaclar; kucuk resim/poster/onizleme/kapak altlari ATLANIR (once gelen poster.jpg video sanilmasin)
const VIDEO_ANAHTAR = ["videoUrl", "video_url", "downloadUrl", "download_url"];
const VIDEO_UST = /^(video|videos|clip|clips)$/i;
const ATLA_ANAHTAR = /^(thumbnails?|thumb|thumbnailUrl|thumbnail_url|posters?|posterUrl|poster_url|previews?|previewUrl|preview_url|images?|imageUrl|image_url|covers?|coverUrl|cover_url|frames?|startFrame|endFrame|firstFrame|lastFrame)$/i;
const httpsMi = s => typeof s === "string" && /^https:\/\/\S+$/i.test(s);
function videoYoluMu(s) { try { return /\.(mp4|mov|webm|m4v)$/i.test(new URL(s).pathname); } catch (e) { return false; } }
function videoUrlBul(v, derinlik, ust) {
  const d = derinlik || 0;
  if (d > 6 || v == null) return "";
  if (typeof v === "string") return httpsMi(v) && (videoYoluMu(v) || VIDEO_UST.test(ust || "")) ? v : "";
  if (Array.isArray(v)) { for (const x of v) { const u = videoUrlBul(x, d + 1, ust); if (u) return u; } return ""; }
  if (typeof v === "object") {
    for (const k of VIDEO_ANAHTAR) { if (httpsMi(v[k])) return v[k]; }
    if (httpsMi(v.url) && (videoYoluMu(v.url) || VIDEO_UST.test(ust || ""))) return v.url;
    for (const [k, x] of Object.entries(v)) {
      if (ATLA_ANAHTAR.test(k)) continue;
      const u = videoUrlBul(x, d + 1, k); if (u) return u;
    }
  }
  return "";
}

// indirilen govde gercekten video mu? MP4/MOV: 4-8. baytlar 'ftyp' (eski QuickTime: moov/mdat/wide/free/skip); WebM: 1A45DFA3
function videoGovdesiMi(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  if (["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(buf.toString("latin1", 4, 8))) return true;
  return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

const kayitYolu = dizin => path.join(dizin, "klipler.json");
// Dosya YOKSA bos kayit. Var ama okunamiyor/bozuksa HATA: bos saymak teslim edilmis klipleri yeniden ucretli uretir ve
// var olan dosyalarin uzerine yazardi. Bastaki BOM (PowerShell 'Set-Content -Encoding utf8') atilir (ortak.jsonCoz).
function kayitOku(dizin) {
  const cozum = "Clips/klipler.json dosyasını düzelt ya da yedeğinden geri al. Silme: silinirse teslim edilmiş klipler yeniden ücretli üretilir.";
  let metin;
  try { metin = fs.readFileSync(kayitYolu(dizin), "utf8"); }
  catch (e) {
    if (e.code === "ENOENT") return { klipler: [] };
    throw hata("kayit_bozuk", "Clips/klipler.json okunamadı (" + (e.code || e.message) + "); hiçbir şey başlatılmadı.", cozum);
  }
  let k;
  try { k = ortak.jsonCoz(metin, "Clips/klipler.json"); }
  catch (e) { throw hata("kayit_bozuk", e.message + "; hiçbir şey başlatılmadı, kredi harcanmadı.", cozum); }
  if (!k || typeof k !== "object" || !Array.isArray(k.klipler) || k.klipler.some(x => !x || typeof x !== "object" || Array.isArray(x)))
    throw hata("kayit_bozuk", "Clips/klipler.json beklenen biçimde değil ({\"klipler\": [...]}); hiçbir şey başlatılmadı, kredi harcanmadı.", cozum);
  return k;
}
function kayitYaz(dizin, k) {
  fs.mkdirSync(dizin, { recursive: true });
  const g = kayitYolu(dizin) + ".part";
  fs.writeFileSync(g, JSON.stringify(k, null, 2));
  fs.renameSync(g, kayitYolu(dizin));
}

// Klip dosyasini yazar; VAR OLAN dosyayi (kaydi kaybolmus eski klip dahil) ya da baska kaydin adini ASLA ezmez:
// NNN doluysa bir sonraki bos numaraya gecer. Once .part'a yazilir (yarim dosya klip adini almasin).
function klipYaz(dizin, sira, model, buf, dolu) {
  fs.mkdirSync(dizin, { recursive: true });
  for (let n = sira; n < sira + 1000; n++) {
    const ad = String(n).padStart(3, "0") + "-" + model + ".mp4";
    const hedef = path.join(dizin, ad);
    if (dolu.has(ad) || fs.existsSync(hedef)) continue;
    const g = hedef + ".part";
    try {
      fs.writeFileSync(g, buf);
      if (fs.existsSync(hedef)) { fs.rmSync(g, { force: true }); continue; }
      fs.renameSync(g, hedef);
    } catch (e) { try { fs.rmSync(g, { force: true }); } catch (e2) { /* zaten yok */ } throw e; }
    return ad;
  }
  throw hata("klip_adi", "Clips içinde boş klip adı bulunamadı (" + sira + "…" + (sira + 999) + ").", "Clips klasöründeki eski dosyaları başka yere taşı.");
}

// Cekim anahtari: ayni istem baska oran/cozunurlukte AYRI cekimdir. Eski kayitlarda oran yok: o zamanki varsayilan 9:16.
const ayarOf = (oran, coz) => (oran || VARSAYILAN.oran) + "/" + (coz || "?");
const cekimAnahtari = (istem, sure, model, coz, oran) => [istem, sure, model, coz || "", oran || VARSAYILAN.oran].join("|");
const dosyaVar = (dizin, ad) => typeof ad === "string" && ad !== "" && fs.existsSync(path.join(dizin, ad));

// Listeyi kayitla SAYARAK eslestirir (listede 3 kez gecen istem 3 cekimdir):
//   atlanan: teslim edilmis (dosyasi duruyor)
//   surdur : ucreti odenmis is (yarim ya da dosyasi silinmis teslim = 'kayip') -> vidiq_job_poll ile UCRETSIZ alinir
//   yeni   : ucretli baslatilacak; ek=true ise bilincli ek cekim (confirmNewAttempt), yalniz yeniCekim ile
//   tekrar : ayni cekim zaten var / listede tekrar ediyor; yeniCekim yoksa ATLANIR (vidIQ duplicate_submission ile reddeder)
//   farkliAyar: ayni istem|sure|model baska oran/cozunurlukte var; bu ayar icin yeniden UCRETLI uretilecek (uyari)
function planla(liste, kayit, a) {
  const havuz = new Map();
  const bilinen = new Set();
  const ayarlar = new Map();
  for (const g of kayit.klipler) {
    if (g.durum === "basarisiz") continue;                    // iade edildi: yeniden baslatilabilir
    const an = cekimAnahtari(g.istem, g.sure, g.model, g.cozunurluk, g.oran);
    const an3 = g.istem + "|" + g.sure + "|" + g.model;
    if (!ayarlar.has(an3)) ayarlar.set(an3, new Set());
    ayarlar.get(an3).add(ayarOf(g.oran, g.cozunurluk));
    bilinen.add(an);                                           // 'yenilendi' de: ayni cekimin yeni surumu yine ek cekimdir
    if (g.durum === "yenilendi") continue;
    const tur = g.dosya ? (dosyaVar(a.dizin, g.dosya) ? "teslim" : g.isNo ? "kayip" : "") : g.isNo ? "yarim" : "";
    if (!tur) continue;
    if (!havuz.has(an)) havuz.set(an, []);
    havuz.get(an).push({ girdi: g, tur });
  }
  const SIRA = { teslim: 0, yarim: 1, kayip: 2 };
  for (const l of havuz.values()) l.sort((x, y) => SIRA[x.tur] - SIRA[y.tur]);
  const p = { atlanan: 0, surdur: [], yeni: [], tekrar: [], farkliAyar: [] };
  const buAyar = ayarOf(a.oran, a.cozunurluk);
  for (const k of liste) {
    const an = cekimAnahtari(k.istem, k.sure, a.model, a.cozunurluk, a.oran);
    const es = havuz.has(an) ? havuz.get(an).shift() : null;
    if (es && es.tur === "teslim") { p.atlanan++; continue; }
    if (es && es.tur === "yarim") { p.surdur.push({ k, girdi: es.girdi, tur: "yarim" }); continue; }
    if (es && es.tur === "kayip") {
      if (a.yeniCekim) p.yeni.push({ k, ek: true, eski: es.girdi });
      else p.surdur.push({ k, girdi: es.girdi, tur: "kayip" });
      continue;
    }
    if (bilinen.has(an)) { if (a.yeniCekim) p.yeni.push({ k, ek: true }); else p.tekrar.push(k); continue; }
    bilinen.add(an);
    p.yeni.push({ k, ek: false });
    const diger = [...(ayarlar.get(k.istem + "|" + k.sure + "|" + a.model) || [])].filter(x => x !== buAyar);
    if (diger.length) p.farkliAyar.push({ istem: k.istem, mevcut: diger });
  }
  return p;
}

async function bakiyeOku(vidiq) {
  const b = await vidiq.cagir("vidiq_balance", {}, ["totalCredits"]);
  return b && typeof b.totalCredits === "number" ? b.totalCredits : null;
}

// Gonderimde bildirilen kesin ucret (vidIQ: "quoted exactly at submit"; alan adi surume gore degisebilir).
// Yalniz bakiye farki olculemezse kullanilir.
function ucretBul(b) {
  if (!b || typeof b !== "object") return 0;
  for (const a of ["creditsCharged", "chargedCredits", "creditCost", "cost"]) if (typeof b[a] === "number" && b[a] > 0) return b[a];
  return 0;
}

// duplicate_submission: vidIQ ayni cekimi yakin zamanda almis; yeni is BASLATMAZ, ucret ALMAZ, mesajda mevcut mcpJobId'yi verir.
// Donus: null (baska hata) | {no} (no bos olabilir: is no okunamadi). Hata kodundan bagimsiz bakilir: mesaj "credits"
// gecirirse lib/vidiq.js onu vidiq_kredi siniflandirabilir.
function tekrarIsNo(e) {
  let detay = "";
  try { detay = e && e.detay !== undefined ? (typeof e.detay === "string" ? e.detay : JSON.stringify(e.detay)) : ""; } catch (x) { /* dongusel */ }
  const metin = String((e && e.message) || "") + " " + detay;
  if (!/duplicate_submission/i.test(metin)) return null;
  const i = metin.search(/(?:mcp_?)?job_?id/i);
  if (i < 0) return { no: "" };
  const parcalar = metin.slice(i, i + 160).replace(/^(?:mcp_?)?job_?id/i, "").split(/[\s"'`:=,;()[\]{}<>]+/);
  for (const p0 of parcalar) {
    const t = p0.replace(/[.\-]+$/, "");
    if (t.length >= 6 && t.length <= 128 && /\d/.test(t) && /^[A-Za-z0-9][\w\-.]*$/.test(t)) return { no: t };
  }
  return { no: "" };
}

// vidIQ istegi ACIKCA reddetti (icerik politikasi, gecersiz girdi...): is baslamadi, ucret alinmadi -> o klip atlanir.
// Tasima hatasi (baglanti, zaman asimi, 5xx) BURAYA girmez: isin baslayip baslamadigi bilinmez, kosu durur.
const RED_KODU = /content_policy|invalid_(?:duration|input|resolution|model|aspect)|Input validation error/i;
function reddedildiMi(e) {
  const m = String((e && e.message) || "");
  if (RED_KODU.test(m)) return true;
  return e && e.kod === "vidiq_ag" && !e.httpDurum && (/isteği reddetti \(vidiq_generate_video\)/.test(m) || /^vidIQ: /.test(m));
}

// Is bitene dek UCRETSIZ sorgular, videoyu indirip yazar. Basari: {ad}; degilse {hata, kredi, iade}.
//   vidIQ'da basarisiz/expired (kredi iade edilir): kayitta 'basarisiz' -> sonraki kosu yeniden baslatir. Dosyasi silinmis
//     teslimde ('kayip') isaretlenmez: o cekim teslim edilmisti, yeni surum ancak yeniCekim ile.
//   zaman asimi / ag / adres yok / indirme / video degil: kayit (isNo) KORUNUR, sonraki kosu ayni isi ucretsiz yeniden sorgular.
async function teslimAl(o, kayit, girdi, k, tur, log) {
  const istem = k.istem.slice(0, 60);
  const yeniden = "Aynı komutu yeniden çalıştır: iş ücretsiz yeniden sorgulanır, yeni ücret alınmaz.";
  let sonucV;
  try {
    sonucV = await o.vidiq.isBekle(girdi.isNo, { maksSn: 900, aralikSn: o.bekleSn || 6, onIlerleme: p => log("    … " + p.gecenSn + " sn") });
  } catch (e) {
    if (e.kod === "vidiq_uretim" || e.kod === "vidiq_kredi") {
      const iade = !!(e.detay && e.detay.refunded === true);
      if (tur === "kayip") return { hata: { istem, isNo: girdi.isNo, neden: e.message, cozum: "Bu çekim önceden teslim edilmişti ve artık indirilemiyor. Yeni ücretli sürüm için --yeni-cekim ekle." } };
      girdi.durum = "basarisiz"; girdi.hata = String(e.message).slice(0, 300); kayitYaz(o.dizin, kayit);
      return { kredi: e.kod === "vidiq_kredi", iade, hata: { istem, isNo: girdi.isNo, neden: e.message,
        cozum: e.kod === "vidiq_kredi" ? "vidIQ kredini kontrol et, sonra aynı komutu yeniden çalıştır; başarısız klip yeniden başlatılır."
          : "Aynı komutu yeniden çalıştır; başarısız klip yeniden başlatılır (kredi iade edilir). Yine olursa istemi değiştir." } };
    }
    if (e.kod === "vidiq_zaman_asimi" || e.kod === "vidiq_ag")
      return { hata: { istem, isNo: girdi.isNo, neden: e.message, cozum: "İş vidIQ'da sürüyor olabilir. Biraz sonra: " + yeniden } };
    throw e;
  }
  const url = videoUrlBul(sonucV);
  if (!url) return { hata: { istem, isNo: girdi.isNo, neden: "Video adresi bulunamadı (iş " + girdi.isNo + ").", cozum: "vidIQ'da işi kontrol et. " + yeniden } };
  // adres once kaydedilir: indirme olmazsa klip elle de indirilebilsin (imzali adres bir sure gecerlidir)
  girdi.url = url; kayitYaz(o.dizin, kayit);
  let buf;
  try { buf = await o.indir(url); }
  catch (e) { return { hata: { istem, isNo: girdi.isNo, neden: "İndirilemedi: " + String((e && e.message) || e).slice(0, 120), cozum: "Bağlantıyı kontrol et. " + yeniden } }; }
  if (!videoGovdesiMi(buf)) return { hata: { istem, isNo: girdi.isNo, neden: "İndirilen dosya video değil (iş " + girdi.isNo + "); kaydedilmedi.", cozum: "vidIQ'da işi kontrol et. " + yeniden } };
  const dolu = new Set(kayit.klipler.filter(x => x !== girdi && typeof x.dosya === "string" && x.dosya).map(x => x.dosya));
  const ad = klipYaz(o.dizin, kayit.klipler.indexOf(girdi) + 1, girdi.model, buf, dolu);
  girdi.dosya = ad; delete girdi.hata; kayitYaz(o.dizin, kayit);
  return { ad };
}

// o: {liste, model, cozunurluk, oran, dizin, butce, onay, yeniCekim, vidiq (istemci), indir(url)->Buffer, log, bekleSn}
// Donus durumu: hepsi_hazir | kuru_calisma | bitti | butce_doldu | kismi (bazi klipler alinamadi ya da kredi bitti; durdu/basarisiz)
async function uret(o) {
  const log = o.log || (() => {});
  const oran = o.oran || VARSAYILAN.oran;
  if (!ORANLAR.includes(oran)) throw hata("oran", "'" + oran + "' en-boy oranı geçersiz.", "Geçerli: " + ORANLAR.join(" ya da "));
  const kayit = kayitOku(o.dizin);
  const p = planla(o.liste, kayit, { model: o.model, cozunurluk: o.cozunurluk, oran, yeniCekim: !!o.yeniCekim, dizin: o.dizin });
  // tahmin ve butce/bakiye kapilari YALNIZ yeni (ucretli) islerle: surdurulen islerin ucreti onceki kosuda odendi
  const { toplam, oran: krediSn } = tahmin(p.yeni.map(x => x.k), o.model, o.cozunurluk);
  const ozet = {
    klip: o.liste.length, atlanan: p.atlanan, surdurulecek: p.surdur.length, uretilecek: p.yeni.length,
    ekCekim: p.yeni.filter(x => x.ek).length, tekrar: p.tekrar.length,
    farkliAyar: p.farkliAyar.length, farkliAyarlar: [...new Set(p.farkliAyar.flatMap(x => x.mevcut))],
    tahminiKredi: toplam, krediSn, butce: o.butce || 0, oran, cozunurluk: o.cozunurluk,
  };
  const r = { harcanan: 0, dosyalar: [], basarisiz: [], durdu: null, baslatilmayan: 0 };
  if (!p.surdur.length && !p.yeni.length) return Object.assign({ durum: "hepsi_hazir" }, r, ozet);
  if (p.yeni.length) {
    if (!(o.butce > 0)) throw hata("butce", "Bütçe verilmedi. Tahmini harcama " + toplam + " kredi.", "--butce <kredi> ver (üst sınır; bu sınırı aşan iş hiç başlamaz).");
    if (toplam > o.butce) throw hata("butce_asildi", "Tahmini harcama " + toplam + " kredi, bütçe " + o.butce + ". Hiçbir şey başlatılmadı.", "Bütçeyi artır, klip sayısını/süresini azalt ya da daha ucuz model seç.");
  }
  if (!o.onay) return Object.assign({ durum: "kuru_calisma" }, r, ozet);

  const toplamIs = p.surdur.length + p.yeni.length;
  let sayac = 0;
  const baslik = (k, ek) => log("  klip " + (++sayac) + "/" + toplamIs + ": " + k.istem.slice(0, 60) + " (" + k.sure + " sn)" + (ek || ""));

  // 1) ucreti odenmis isler: butceden ve bakiyeden BAGIMSIZ, once (sorgu ucretsiz; bakiye farki olcumunu de bozmaz)
  for (const s of p.surdur) {
    baslik(s.k);
    log(s.tur === "kayip" ? "    dosyası silinmiş teslim; iş " + s.girdi.isNo + " ücretsiz yeniden indiriliyor (yeni ücretli sürüm için --yeni-cekim)"
      : "    önceki yarım iş sürdürülüyor (" + s.girdi.isNo + "), yeniden başlatılmıyor");
    const t = await teslimAl(o, kayit, s.girdi, s.k, s.tur, log);
    if (t.ad) { r.dosyalar.push(t.ad); log("    ✓ " + t.ad); }
    else { r.basarisiz.push(t.hata); log("    ✗ " + t.hata.neden); }
  }

  // 2) yeni (ucretli) isler
  let bakiye0 = null, baslatilanSn = 0;
  if (p.yeni.length) {
    bakiye0 = await bakiyeOku(o.vidiq);
    if (bakiye0 !== null && bakiye0 < toplam) {
      const e = hata("kredi_yetmez", "Kalan kredi " + bakiye0 + ", tahmini ihtiyaç " + toplam + ".", "Krediyi artır ya da klip sayısını azalt.");
      if (!p.surdur.length) throw e;                            // hicbir sey yapilmadi: eskisi gibi hata
      log("  ! " + e.message + " Yeni klip başlatılmadı.");
      r.durdu = "kredi"; r.baslatilmayan = p.yeni.length;
    }
  }
  for (let i = 0; i < p.yeni.length && !r.durdu; i++) {
    const y = p.yeni[i], k = y.k;
    const kalan = p.yeni.length - i;
    // kalan butce BU klibe yetiyor mu? birim: tablo tahmini ile bu kosuda olculen kredi/sn'nin buyugu
    const bOnce = await bakiyeOku(o.vidiq);
    if (bakiye0 !== null && bOnce !== null) r.harcanan = Math.max(r.harcanan, bakiye0 - bOnce);   // gecikmeli dusen ucret de sayilsin
    const birim = Math.max(krediSn, baslatilanSn > 0 ? r.harcanan / baslatilanSn : 0);
    const gerek = k.sure * birim;
    if (r.harcanan + gerek > o.butce) {
      log("  ! bütçe bu klibe yetmiyor (harcanan " + r.harcanan + " + bu klip ≈ " + Math.round(gerek) + " > bütçe " + o.butce + "); kalan " + kalan + " klip başlatılmadı.");
      r.durdu = "butce"; r.baslatilmayan = kalan; break;
    }
    if (bOnce !== null && bOnce < gerek) {
      log("  ! kalan kredi (" + bOnce + ") bu klibe (≈ " + Math.round(gerek) + ") yetmiyor; kalan " + kalan + " klip başlatılmadı.");
      r.durdu = "kredi"; r.baslatilmayan = kalan; break;
    }
    baslik(k, y.ek ? " · ek çekim (ücretli yeni sürüm)" : "");
    const arg = { prompt: k.istem, model: o.model, resolution: o.cozunurluk, duration: k.sure, aspectRatio: oran };
    if (y.ek) arg.confirmNewAttempt = true;                    // yalniz acik yeniCekim istegiyle
    let isNo = "", ucretli = true, teklif = 0;
    try {
      const basla = await o.vidiq.cagir("vidiq_generate_video", arg, ["mcpJobId", "jobId"]);
      isNo = (basla && (basla.mcpJobId || basla.jobId)) || "";
      teklif = ucretBul(basla);
    } catch (e) {
      const dup = tekrarIsNo(e);
      if (dup) {
        const eski = dup.no ? kayit.klipler.find(x => x.isNo === dup.no) : null;
        if (dup.no && !eski) { isNo = dup.no; ucretli = false; log("    vidIQ bu çekimi zaten almış (duplicate_submission): mevcut iş " + isNo + " ücretsiz sorgulanıyor"); }
        else {
          r.basarisiz.push({ istem: k.istem.slice(0, 60), isNo: dup.no, neden: dup.no ? "vidIQ bu çekimi önceki işle (" + dup.no + ") eşleştirdi; yeniden başlatmadı." : "vidIQ aynı çekimi yakın zamanda almış (duplicate_submission) ama iş numarasını vermedi.",
            cozum: eski && eski.durum === "basarisiz" ? "Biraz sonra yeniden dene ya da istemi değiştir." : "Ek ücretli sürüm istiyorsan --yeni-cekim ekle; değilse vidIQ'daki işlerine bak." });
          log("    ✗ " + r.basarisiz[r.basarisiz.length - 1].neden);
          continue;
        }
      } else if (e.kod === "vidiq_anahtar") throw e;
      else if (reddedildiMi(e)) {
        r.basarisiz.push({ istem: k.istem.slice(0, 60), neden: e.message, cozum: "İstemi ya da ayarı değiştir; aynısını yeniden gönderme (ücret alınmadı)." });
        log("    ✗ reddedildi: " + e.message); continue;
      } else if (e.kod === "vidiq_kredi") {
        r.basarisiz.push({ istem: k.istem.slice(0, 60), neden: e.message, cozum: "vidIQ kredini kontrol et, sonra aynı komutu yeniden çalıştır." });
        r.durdu = "kredi"; r.baslatilmayan = kalan; log("    ✗ " + e.message); break;
      } else throw e;                                            // baglanti/zaman asimi: is baslamis olabilir, yeniden calistirinca duplicate ile taninir
    }
    if (!isNo) throw hata("vidiq_is", "vidIQ iş numarası döndürmedi (kredi düşmüş olabilir).", "vidIQ'daki işlerine bak; aynı komutu yeniden çalıştırınca vidIQ aynı çekimi tanırsa mevcut iş ücretsiz sorgulanır.", 3);
    // is baslar baslamaz kaydet: surec yarida kesilirse ayni cekim yeniden BASLATILMAZ
    const girdi = { istem: k.istem, sure: k.sure, model: o.model, cozunurluk: o.cozunurluk, oran, isNo, dosya: "" };
    if (y.ek) girdi.ekCekim = true;
    kayit.klipler.push(girdi);
    if (y.eski) y.eski.durum = "yenilendi";
    kayitYaz(o.dizin, kayit);
    let ucret = 0;
    if (ucretli) {
      let bSonra = null;
      try { bSonra = await bakiyeOku(o.vidiq); } catch (e) { /* is kaydedildi; olcum olmazsa teklif/tahmin */ }
      const olculen = bOnce !== null && bSonra !== null ? bOnce - bSonra : 0;
      ucret = olculen > 0 ? olculen : teklif > 0 ? teklif : k.sure * krediSn;
      girdi.ucret = ucret;
      r.harcanan += ucret; baslatilanSn += k.sure;
    }
    const t = await teslimAl(o, kayit, girdi, k, "yeni", log);
    if (t.ad) { r.dosyalar.push(t.ad); log("    ✓ " + t.ad + " · şu ana dek harcanan ≈ " + r.harcanan + " kredi"); continue; }
    r.basarisiz.push(t.hata); log("    ✗ " + t.hata.neden);
    if (t.iade && ucretli) { r.harcanan = Math.max(0, r.harcanan - ucret); baslatilanSn -= k.sure; }
    if (t.kredi) { r.durdu = "kredi"; r.baslatilmayan = kalan - 1; }
  }
  const durum = r.durdu === "butce" ? "butce_doldu" : r.durdu || r.basarisiz.length ? "kismi" : "bitti";
  return Object.assign({ durum }, r, ozet);
}

module.exports = { uret, planla, klipListesi, tahmin, videoUrlBul, videoGovdesiMi, tekrarIsNo, sureGecerli, kayitOku, KREDI_SN, VARSAYILAN, ORANLAR };
