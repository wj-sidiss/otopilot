// lib/vidiq-klip.js — vidIQ ile AI video klipi uretimi (Seedance, Veo, MiniMax, Kling...). KREDI HARCAR: kati korumalar var.
//
// Korumalar:
//   * Varsayilan KURU CALISMA: ne kadar kredi harcanacagini yazar, hicbir sey baslatmaz. Harcama icin acik `onay` gerekir.
//   * `butce` (kredi) ZORUNLU: tahmini toplam butceyi asarsa hic baslamaz; calisirken GERCEK bakiye farki izlenir, butce dolunca durur.
//   * Ayni istem ayni isin icinde ASLA ikinci kez uretilmez (Clips/klipler.json): yarim kalan is yeniden calistirilinca teslim
//     edilenler atlanir, yalniz eksikler uretilir. Basarisiz is vidIQ tarafinda iade edilir.
//   * vidiq_job_poll ve vidiq_balance ucretsizdir; yalniz vidiq_generate_video krediyle calisir.
//
// Ag ve vidIQ istemcisi enjekte edilebilir (testte gercek krediye dokunulmaz).
"use strict";
const fs = require("fs");
const path = require("path");

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

function hata(kod, mesaj, cozum) { const e = new Error(mesaj); e.kod = kod; e.cikis = 2; if (cozum) e.cozum = cozum; return e; }

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

// Sonuc nesnesinde ilk https video adresini bul (vidIQ sonuc bicimi surumlere gore degisebilir)
function videoUrlBul(v, derinlik) {
  const d = derinlik || 0;
  if (d > 6 || v == null) return "";
  if (typeof v === "string") return /^https:\/\/\S+/i.test(v) && /\.mp4(\?|$)/i.test(v) ? v : "";
  if (Array.isArray(v)) { for (const x of v) { const u = videoUrlBul(x, d + 1); if (u) return u; } return ""; }
  if (typeof v === "object") {
    for (const k of ["videoUrl", "url", "video_url", "downloadUrl"]) { if (typeof v[k] === "string" && /^https:\/\//i.test(v[k])) return v[k]; }
    for (const x of Object.values(v)) { const u = videoUrlBul(x, d + 1); if (u) return u; }
  }
  return "";
}

const kayitYolu = dizin => path.join(dizin, "klipler.json");
function kayitOku(dizin) { try { return JSON.parse(fs.readFileSync(kayitYolu(dizin), "utf8")); } catch (e) { return { klipler: [] }; } }
function kayitYaz(dizin, k) {
  fs.mkdirSync(dizin, { recursive: true });
  const g = kayitYolu(dizin) + ".part";
  fs.writeFileSync(g, JSON.stringify(k, null, 2));
  fs.renameSync(g, kayitYolu(dizin));
}

// o: {liste, model, cozunurluk, oran, dizin, butce, onay, vidiq (istemci), indir(url)->Buffer, log, bekleSn}
async function uret(o) {
  const log = o.log || (() => {});
  const kayit = kayitOku(o.dizin);
  const anahtarOf = (istem, sure, model) => istem + "|" + sure + "|" + model;
  const tamam = new Set(kayit.klipler.filter(k => k.dosya && fs.existsSync(path.join(o.dizin, k.dosya))).map(k => anahtarOf(k.istem, k.sure, k.model)));
  // vidIQ'da baslamis ama indirilmemis is: ayni istem yeniden BASLATILMAZ (kredi iki kez gitmesin)
  const yarim = kayit.klipler.filter(k => !k.dosya && k.isNo);
  const bekleyen = o.liste.filter(k => !tamam.has(anahtarOf(k.istem, k.sure, o.model)));
  const { toplam, oran } = tahmin(bekleyen, o.model, o.cozunurluk);
  const ozet = { klip: o.liste.length, atlanan: o.liste.length - bekleyen.length, uretilecek: bekleyen.length, tahminiKredi: toplam, krediSn: oran, butce: o.butce || 0 };
  if (!bekleyen.length) return Object.assign({ durum: "hepsi_hazir", harcanan: 0 }, ozet);
  if (!(o.butce > 0)) throw hata("butce", "Bütçe verilmedi. Tahmini harcama " + toplam + " kredi.", "--butce <kredi> ver (üst sınır; bu sınırı aşan iş hiç başlamaz).");
  if (toplam > o.butce) throw hata("butce_asildi", "Tahmini harcama " + toplam + " kredi, bütçe " + o.butce + ". Hiçbir şey başlatılmadı.", "Bütçeyi artır, klip sayısını/süresini azalt ya da daha ucuz model seç.");
  if (!o.onay) return Object.assign({ durum: "kuru_calisma", harcanan: 0 }, ozet);

  const b0 = await o.vidiq.cagir("vidiq_balance", {});
  const bakiye0 = b0 && typeof b0.totalCredits === "number" ? b0.totalCredits : null;
  if (bakiye0 !== null && bakiye0 < toplam) throw hata("kredi_yetmez", "Kalan kredi " + bakiye0 + ", tahmini ihtiyaç " + toplam + ".", "Krediyi artır ya da klip sayısını azalt.");
  let harcanan = 0;
  const sonuc = [];
  for (let i = 0; i < bekleyen.length; i++) {
    const k = bekleyen[i];
    if (harcanan >= o.butce) { log("  ! bütçe doldu (" + harcanan + "/" + o.butce + "); kalan " + (bekleyen.length - i) + " klip üretilmedi."); break; }
    log("  klip " + (i + 1) + "/" + bekleyen.length + ": " + k.istem.slice(0, 60) + " (" + k.sure + " sn)");
    let girdi = yarim.find(y => y.istem === k.istem && y.sure === k.sure && y.model === o.model);
    let isNo = girdi && girdi.isNo;
    if (isNo) log("    önceki yarım iş sürdürülüyor (" + isNo + "), yeniden başlatılmıyor");
    else {
      const basla = await o.vidiq.cagir("vidiq_generate_video", { prompt: k.istem, model: o.model, resolution: o.cozunurluk, duration: k.sure, aspectRatio: o.oran });
      isNo = basla && (basla.mcpJobId || basla.jobId);
      if (!isNo) throw hata("vidiq_is", "vidIQ iş numarası döndürmedi: " + JSON.stringify(basla).slice(0, 200));
      // is baslar baslamaz kaydet: surec yarida kesilirse ayni istem yeniden baslatilmaz
      girdi = { istem: k.istem, sure: k.sure, model: o.model, cozunurluk: o.cozunurluk, isNo, dosya: "" };
      kayit.klipler.push(girdi); kayitYaz(o.dizin, kayit);
    }
    const sonucV = await o.vidiq.isBekle(isNo, { maksSn: 900, aralikSn: o.bekleSn || 6, onIlerleme: p => log("    … " + p.gecenSn + " sn") });
    const url = videoUrlBul(sonucV);
    if (!url) throw hata("vidiq_sonuc", "Video adresi bulunamadı (iş " + isNo + "; kredi harcanmış olabilir, vidIQ'da kontrol et).");
    const buf = await o.indir(url);
    const sira = kayit.klipler.indexOf(girdi) + 1;
    const ad = String(sira).padStart(3, "0") + "-" + o.model + ".mp4";
    fs.writeFileSync(path.join(o.dizin, ad), buf);
    girdi.dosya = ad; girdi.url = url; kayitYaz(o.dizin, kayit);
    const b = await o.vidiq.cagir("vidiq_balance", {});
    if (bakiye0 !== null && b && typeof b.totalCredits === "number") harcanan = bakiye0 - b.totalCredits;
    else harcanan += k.sure * oran;
    sonuc.push(ad);
    log("    ✓ " + ad + " · şu ana dek harcanan ≈ " + harcanan + " kredi");
  }
  return Object.assign({ durum: "bitti", harcanan, dosyalar: sonuc }, ozet);
}

module.exports = { uret, klipListesi, tahmin, videoUrlBul, sureGecerli, kayitOku, KREDI_SN, VARSAYILAN };
