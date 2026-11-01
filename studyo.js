// AI STUDYO: ne istersen -- yazdigin istemden video, fotografindan video, kendi videonu donusturme; istersen cizgi film/anime/3D/kil stili (vidIQ ile; KREDI HARCAR, varsayilan KURU CALISMA).
//   Stil "serbest" = ek stil yok, istem aynen gider. Fotograf gerekmez: node studyo.js sahne <ad> "istem" ile yalniz metinden sahne eklenir.
//   node studyo.js stiller                                  hazir stiller (cizgi-film, anime, 3d-animasyon, kil, suluboya, cizgi-roman, gercekci)
//   node studyo.js yeni <ad> [--stil cizgi-film] [--oran 9:16|16:9] [--model minimax-h3] [--sure 6]
//   (fotograflari ve videolari uretim/<ad>/girdi/ icine koy; dosya adi sirasi = film sirasi)
//   node studyo.js sahne <ad> "istem" [--sure 6]            fotografsiz sahne: yalniz yazdigin istemden video
//   node studyo.js tara <ad>                                girdi/'deki yeni dosyalari sahne olarak studyo.json'a ekler
//   node studyo.js uret <ad> --butce 400 [--onay] [--yeni-cekim]   maliyeti yazar; --onay ile klipleri uretir (vidiq-klip korumalari)
//   node studyo.js kur <ad> [--muzik yol.mp3]               klipleri sirayla birlestirir -> uretim/<ad>/Videos/<ad>.mp4
// Sahne modlari (studyo.json "sahneler"[].mod):
//   referans  foto karakter/stil referansi olur, sahne secilen stilde YENIDEN cizilir (cizgi film/anime icin varsayilan)
//   ilk-kare  foto videonun ilk karesi olur, oldugu gibi canlanir (gercekci icin varsayilan)
//   metin     fotograf yok: "hareket" alanindaki istem (Ingilizce) videoya cevrilir
//   video     "url": kendi videonun https/YouTube adresi -> vidIQ'ya ucretsiz yuklenir, hareketi korunarak stile cevrilir (minimax-h3/gemini-omni-flash)
// girdi/'deki yerel video dosyasindan "an" saniyesindeki kare alinir ve referans olarak kullanilir (vidIQ yerel videoyu okuyamaz).
// "hareket": Ingilizce, sahnede ne olacagi; "sure": sn. "karakter": tum referans sahnelerine eklenen ortak yuz fotograflari (girdi/ icinde).
// IZIN: yalniz kendi fotografin/videon ya da yazili izin verilen kisi; telifli film sahnesi DEGIL (kendi cekimin). Yayinda "yapay zeka" etiketi.
// Cikis: 0 tamam/kuru calisma · 2 girdi/ayar · 3 vidIQ/ag · 7 butce.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const ortak = require("./lib/ortak.js");
const K = require("./lib/vidiq-klip.js");

const STILLER = {
  serbest: { ad: "Serbest (ne istersen)", metin: "", mod: "ilk-kare" },
  "cizgi-film": { ad: "Çizgi film", metin: "2D hand-drawn cartoon animation style, bold clean outlines, flat vibrant colors, expressive faces", mod: "referans" },
  anime: { ad: "Anime", metin: "Japanese anime style animation, cel shading, detailed painted background, dynamic lighting", mod: "referans" },
  "3d-animasyon": { ad: "3D animasyon", metin: "3D animated feature film style, stylized characters, soft global illumination, rich colors", mod: "referans" },
  kil: { ad: "Kil animasyon", metin: "claymation stop-motion style, handmade clay textures, miniature set", mod: "referans" },
  suluboya: { ad: "Suluboya", metin: "watercolor illustrated animation, soft paper texture, gentle brush strokes", mod: "referans" },
  "cizgi-roman": { ad: "Çizgi roman", metin: "comic book style animation, ink lines, halftone shading, bold colors", mod: "referans" },
  gercekci: { ad: "Gerçekçi", metin: "photorealistic, natural motion, cinematic lighting, shallow depth of field", mod: "ilk-kare" },
};
const MODLAR = ["referans", "ilk-kare", "video", "metin"];
const FOTO = /\.(jpe?g|png|webp|bmp|heic)$/i, VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i;
const VARSAYILAN_HAREKET = "gentle natural movement, the subject slowly turns and smiles, subtle camera push-in";
const BOYUT = { "9:16": [1080, 1920], "16:9": [1920, 1080] };

const hata = (m, c, cikis) => Object.assign(new Error(m), { cikis: cikis || 2, cozum: c });
const ff = () => require("./ff-yol.js");
function ffmpeg(argv, etiket) {
  const r = spawnSync(ff().ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...argv], { encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  if (r.status !== 0) throw hata("ffmpeg başarısız (" + etiket + "): " + String(r.stderr || "").trim().split("\n").slice(-3).join(" | "));
}
const dizinOf = ad => ortak.isDizin(ad);
const ayarYolu = ad => path.join(dizinOf(ad), "studyo.json");

function ayarOku(ad) {
  const y = ayarYolu(ad);
  if (!fs.existsSync(y)) throw hata("studyo.json yok: " + ad, "Önce: node studyo.js yeni " + ad);
  let a;
  try { a = JSON.parse(fs.readFileSync(y, "utf8").replace(/^﻿/, "")); } catch (e) { throw hata("studyo.json okunamadı (" + e.message + ").", "Dosyadaki JSON hatasını düzelt."); }
  if (!STILLER[a.stil]) throw hata("Bilinmeyen stil: " + a.stil, "Geçerli: " + Object.keys(STILLER).join(", "));
  if (!BOYUT[a.oran]) throw hata("Geçersiz oran: " + a.oran, "9:16 ya da 16:9");
  if (!Array.isArray(a.sahneler)) a.sahneler = [];
  a.sahneler.forEach((s, i) => {
    if (!MODLAR.includes(s.mod)) throw hata("Sahne " + (i + 1) + ": geçersiz mod '" + s.mod + "'.", "Geçerli: " + MODLAR.join(", "));
    if (s.mod === "metin" ? !String(s.hareket || "").trim() : s.mod === "video" ? !s.url : !s.kaynak) throw hata("Sahne " + (i + 1) + ": " + (s.mod === "metin" ? "'hareket' (istem)" : s.mod === "video" ? "'url'" : "'kaynak'") + " yok.");
  });
  return a;
}
const ayarYaz = (ad, a) => fs.writeFileSync(ayarYolu(ad), JSON.stringify(a, null, 2) + "\n");

// girdi/ altindan cikamayan guvenli yol
function girdiYolu(ad, ad2) {
  const kok = path.join(dizinOf(ad), "girdi");
  const y = path.resolve(kok, String(ad2 || ""));
  if (!y.startsWith(kok + path.sep)) throw hata("Dosya girdi/ klasörünün dışında: " + ad2);
  if (!fs.existsSync(y)) throw hata("Girdi dosyası yok: girdi/" + ad2, "Dosyayı uretim/" + ad + "/girdi/ içine koy.");
  return y;
}

function yeni(ad, b) {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(ad || "")) throw hata("Geçersiz ad: küçük harf, rakam, tire.");
  const stil = b.stil || "cizgi-film", oran = b.oran || "9:16";
  if (!STILLER[stil]) throw hata("Bilinmeyen stil: " + stil, "Geçerli: " + Object.keys(STILLER).join(", "));
  if (!BOYUT[oran]) throw hata("Geçersiz oran: " + oran, "9:16 ya da 16:9");
  const d = dizinOf(ad);
  if (fs.existsSync(path.join(d, "studyo.json"))) throw hata("Bu stüdyo işi zaten var: " + ad, "Başka ad seç ya da 'tara' ile devam et.");
  fs.mkdirSync(path.join(d, "girdi"), { recursive: true });
  const a = { surum: 1, stil, oran, model: b.model || K.VARSAYILAN.model, cozunurluk: b.cozunurluk || (b.model && b.model !== K.VARSAYILAN.model ? "720p" : K.VARSAYILAN.cozunurluk),
    sure: Number(b.sure || 6), karakter: [], sahneler: [] };
  ayarYaz(ad, a);
  return { dizin: d, girdi: path.join(d, "girdi") };
}

// fotografsiz sahne: yalniz yazdigin istemden video (ne istersen)
function sahneEkle(ad, istem, sure) {
  const a = ayarOku(ad);
  if (!String(istem || "").trim()) throw hata("İstem boş.", "Örnek: node studyo.js sahne " + ad + " \"a astronaut walking on mars at sunset, cinematic\"");
  a.sahneler.push({ mod: "metin", hareket: String(istem).trim().slice(0, 3500), sure: Number(sure || a.sure) });
  ayarYaz(ad, a);
  return a.sahneler.length;
}

// tek fotografi sahne olarak ekler (panel yuklemesi); girdi/'deki silinmis sahneler geri gelmesin diye tara() cagrilmaz
function fotoEkle(ad, dosya) {
  const a = ayarOku(ad);
  girdiYolu(ad, dosya);
  a.sahneler.push({ kaynak: dosya, mod: STILLER[a.stil].mod, hareket: VARSAYILAN_HAREKET, sure: a.sure });
  ayarYaz(ad, a);
  return a.sahneler.length;
}

// girdi/'de olup sahnelerde olmayan dosyalari ekler (ad sirasiyla)
function tara(ad) {
  const a = ayarOku(ad);
  const kok = path.join(dizinOf(ad), "girdi");
  const bilinen = new Set(a.sahneler.map(s => s.kaynak).concat(a.karakter || []));
  const yeniler = fs.readdirSync(kok).filter(f => (FOTO.test(f) || VIDEO.test(f)) && !bilinen.has(f)).sort((x, y) => x.localeCompare(y, "tr", { numeric: true }));
  for (const f of yeniler) {
    const s = { kaynak: f, mod: VIDEO.test(f) ? "referans" : STILLER[a.stil].mod, hareket: VARSAYILAN_HAREKET, sure: a.sure };
    if (VIDEO.test(f)) { s.an = 1; s.hareket = "recreate this exact scene with the same composition, characters and action"; }
    a.sahneler.push(s);
  }
  ayarYaz(ad, a);
  return { eklenen: yeniler, toplam: a.sahneler.length };
}

// fotografi (ya da videodan kareyi) <=1536 px JPEG'e cevirir: vidIQ siniri 10 MB, HEIC/BMP de okunur. Ayni girdi icin onbellek.
function hazirla(ad, dosya, an) {
  const kaynak = girdiYolu(ad, dosya);
  const hazir = path.join(dizinOf(ad), "hazir");
  fs.mkdirSync(hazir, { recursive: true });
  const st = fs.statSync(kaynak);
  const anahtar = crypto.createHash("sha1").update(dosya + "|" + st.size + "|" + st.mtimeMs + "|" + (an || 0)).digest("hex").slice(0, 12);
  const cikti = path.join(hazir, anahtar + ".jpg");
  if (fs.existsSync(cikti)) return cikti;
  const vf = ["-vf", "scale='min(1536,iw)':'min(1536,ih)':force_original_aspect_ratio=decrease", "-q:v", "3", "-frames:v", "1"];
  ffmpeg(VIDEO.test(dosya) ? ["-ss", String(an || 1), "-i", kaynak, ...vf, cikti] : ["-i", kaynak, ...vf, cikti], "hazırlık " + dosya);
  return cikti;
}
const ozet = (...parcalar) => crypto.createHash("sha1").update(parcalar.join("|")).digest("hex").slice(0, 12);
const dosyaOzeti = y => crypto.createHash("sha1").update(fs.readFileSync(y)).digest("hex").slice(0, 12);

function istemKur(a, s) {
  const st = STILLER[a.stil];
  const ek = s.mod === "metin" ? "" : s.mod === "referans" ? "Keep the same people, faces and outfits as in the reference photos."
    : s.mod === "video" ? "Restyle the whole video in this style, keep the original motion, timing and composition."
      : "Animate this exact image, keep the composition and the people's faces.";
  return [String(s.hareket || VARSAYILAN_HAREKET).trim().replace(/\.$/, "") + ".", st.metin && st.metin + ".", ek].filter(Boolean).join(" ");
}

// studyo.json -> vidiq-klip listesi. videolar: url -> vidIQ videoUrl (yalniz gercek koşuda yuklenir)
function liste(ad, a, videolar) {
  const karakter = (a.karakter || []).map(f => hazirla(ad, f));
  return a.sahneler.map((s, i) => {
    const k = { istem: istemKur(a, s), sure: Number(s.sure || a.sure) };
    if (s.mod === "metin") {
      k.girdiOzet = ozet("metin");
    } else if (s.mod === "video") {
      k.videoUrl = (videolar && videolar[i]) || "https://vidiq.yuklenecek/" + i;
      k.girdiOzet = ozet("video", s.url);
    } else {
      const foto = hazirla(ad, s.kaynak, s.an);
      if (s.mod === "ilk-kare") k.ilkKare = foto; else k.referans = [foto, ...karakter];
      k.girdiOzet = ozet(s.mod, dosyaOzeti(foto), ...karakter.map(dosyaOzeti));
    }
    return k;
  });
}

// kendi videonun adresini vidIQ'ya yukler (UCRETSIZ); YouTube linki arka planda iner
async function videoYukle(vidiq, url, log) {
  const r = await vidiq.cagir("vidiq_video_upload", { url, title: "otopilot-studyo" }, ["videoUrl", "uploadId", "mcpJobId"]);
  if (r && r.videoUrl) return r.videoUrl;
  if (r && r.mcpJobId) {
    log("  video vidIQ'ya iniyor (ücretsiz): " + url);
    const s = await vidiq.isBekle(r.mcpJobId, { maksSn: 900, aralikSn: 6 });
    if (s && s.videoUrl) return s.videoUrl;
  }
  throw hata("vidIQ videoyu yükleyemedi: " + url, "Adres herkese açık bir https MP4/MOV ya da YouTube linki olmalı (en çok 299 MB).", 3);
}

async function uret(ad, b, enj) {
  const e = enj || {};
  const log = e.log || (m => console.log(m));
  const a = ayarOku(ad);
  if (!a.sahneler.length) throw hata("Sahne yok.", "Fotoğrafları uretim/" + ad + "/girdi/ içine koyup: node studyo.js tara " + ad);
  const onay = b.onay === true;
  let vidiq = e.vidiq || null;
  if (!vidiq && onay) {
    const anahtar = ortak.envOku("VIDIQ_KEY");
    if (!anahtar) throw hata("VIDIQ_KEY tanımlı değil.", ".env'e VIDIQ_KEY yaz (app.vidiq.com/account/settings/mcp).");
    const { VidiqIstemci } = require("./lib/vidiq.js");
    vidiq = new VidiqIstemci(anahtar, {});
  }
  const videolar = {};
  if (onay) for (const [i, s] of a.sahneler.entries()) if (s.mod === "video") videolar[i] = await videoYukle(vidiq, s.url, log);
  const ag = e.indir ? null : require("./lib/gorsel-ag.js");
  const vk = require("./vidiq-klip.js");
  const r = await K.uret({
    liste: liste(ad, a, videolar), model: a.model, cozunurluk: a.cozunurluk, oran: a.oran, dizin: path.join(dizinOf(ad), "Clips"),
    butce: Number(b.butce || 0), onay, yeniCekim: b["yeni-cekim"] === true, log, vidiq,
    indir: e.indir || vk.indirici(ag.istemciYap({ limitBekleSn: 5 })),
  });
  log("\n" + STILLER[a.stil].ad + " · " + r.klip + " sahne · " + r.atlanan + " hazır · " + r.uretilecek + " üretilecek · tahmini en çok " + r.tahminiKredi + " kredi · " + a.model + " " + a.cozunurluk + " " + a.oran);
  if (r.durum === "kuru_calisma") log("KURU ÇALIŞMA: kredi harcanmadı. Üretmek için --onay ekle.");
  else if (r.durum === "hepsi_hazir" || r.durum === "bitti") log("Klipler hazır. Sıradaki: node studyo.js kur " + ad);
  else for (const h of r.basarisiz || []) log("  ✗ " + h.istem + " — " + h.neden + (h.cozum ? "\n    ↳ " + h.cozum : ""));
  return r;
}

// her sahnenin en son teslim edilen klibi (studyo listesiyle ayni kimlik)
function klipEsle(ad, a) {
  const clips = path.join(dizinOf(ad), "Clips");
  const kayit = K.kayitOku(clips).klipler || [];
  const l = liste(ad, a, {});
  return l.map((k, i) => {
    const e = kayit.filter(g => g.dosya && g.istem === k.istem && Number(g.sure) === k.sure && (g.girdiOzet || "") === k.girdiOzet && fs.existsSync(path.join(clips, g.dosya))).pop();
    return { sahne: i + 1, yol: e ? path.join(clips, e.dosya) : null };
  });
}

function kur(ad, b) {
  const a = ayarOku(ad);
  const es = klipEsle(ad, a);
  const eksik = es.filter(x => !x.yol).map(x => x.sahne);
  const var_ = es.filter(x => x.yol);
  if (!var_.length) throw hata("Hiç klip yok.", "Önce: node studyo.js uret " + ad + " --butce <kredi> --onay");
  const [w, h] = BOYUT[a.oran];
  const d = dizinOf(ad), kurgu = path.join(d, "kurgu");
  fs.mkdirSync(kurgu, { recursive: true });
  fs.mkdirSync(path.join(d, "Videos"), { recursive: true });
  const parcalar = var_.map((x, i) => {
    const p = path.join(kurgu, String(i + 1).padStart(3, "0") + ".mp4");
    ffmpeg(["-i", x.yol, "-vf", "fps=30,scale=" + w + ":" + h + ":force_original_aspect_ratio=increase,crop=" + w + ":" + h + ",format=yuv420p,setsar=1",
      "-an", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-threads", "2", p], "sahne " + x.sahne);
    return p;
  });
  const listeDosya = path.join(kurgu, "liste.txt");
  fs.writeFileSync(listeDosya, parcalar.map(p => "file '" + p.replace(/\\/g, "/").replace(/'/g, "'\\''") + "'").join("\n") + "\n");
  const cikti = path.join(d, "Videos", ad + ".mp4");
  if (b.muzik) {
    const m = path.resolve(String(b.muzik));
    if (!fs.existsSync(m)) throw hata("Müzik dosyası yok: " + m);
    const ham = path.join(kurgu, "ham.mp4");
    ffmpeg(["-f", "concat", "-safe", "0", "-i", listeDosya, "-c", "copy", ham], "birleştir");
    const sure = var_.length ? parcalar.reduce((t, p) => t + sureOlc(p), 0) : 0;
    ffmpeg(["-i", ham, "-stream_loop", "-1", "-i", m, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
      "-af", "afade=t=in:d=0.5,afade=t=out:st=" + Math.max(0, sure - 1.5).toFixed(2) + ":d=1.5", "-t", sure.toFixed(3), cikti], "müzik");
  } else ffmpeg(["-f", "concat", "-safe", "0", "-i", listeDosya, "-c", "copy", cikti], "birleştir");
  return { cikti, sahne: var_.length, eksik };
}
function sureOlc(dosya) {
  const r = spawnSync(ff().ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dosya], { encoding: "utf8", windowsHide: true });
  const s = Number(String(r.stdout).trim());
  return Number.isFinite(s) && s > 0 ? s : 0;
}

function ayristir(args) {
  const DEGERLI = new Set(["stil", "oran", "model", "cozunurluk", "sure", "butce", "muzik"]);
  const b = {}, konum = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x.startsWith("--")) { const n = x.slice(2); if (DEGERLI.has(n)) b[n] = args[++i]; else b[n] = true; } else konum.push(x);
  }
  return { b, konum };
}

async function ana(args) {
  const { b, konum } = ayristir(args);
  const [komut, ad] = konum;
  if (komut === "stiller") { for (const [k, v] of Object.entries(STILLER)) console.log("  " + k.padEnd(14) + v.ad + " (" + v.mod + ")"); return; }
  if (!ad || !["yeni", "tara", "sahne", "uret", "kur"].includes(komut)) throw hata("Kullanım: node studyo.js yeni|tara|uret|kur <ad> (ayrıntı: dosyanın başı) · node studyo.js stiller");
  if (komut === "yeni") {
    const r = yeni(ad, b);
    console.log("✓ Stüdyo işi açıldı. Fotoğrafları ve videoları şuraya koy (dosya adı sırası = film sırası):\n  " + r.girdi + "\nSonra: node studyo.js tara " + ad);
  } else if (komut === "sahne") {
    const n = sahneEkle(ad, konum.slice(2).join(" "), b.sure);
    console.log("✓ Sahne " + n + " eklendi (metinden video). Sonra: node studyo.js uret " + ad + " --butce <kredi>");
  } else if (komut === "tara") {
    const r = tara(ad);
    console.log("✓ " + r.eklenen.length + " yeni sahne eklendi (toplam " + r.toplam + "). Hareketleri uretim/" + ad + "/studyo.json içinde yaz, sonra: node studyo.js uret " + ad + " --butce <kredi>");
  } else if (komut === "uret") {
    const r = await uret(ad, b);
    if (r.durum === "butce_doldu") process.exitCode = ortak.CIKIS.MALIYET;
    else if (r.durum === "kismi") process.exitCode = ortak.CIKIS.SERVIS;
  } else {
    const r = kur(ad, b);
    console.log("✓ " + r.cikti + " (" + r.sahne + " sahne)" + (r.eksik.length ? "\n! klibi olmayan sahneler atlandı: " + r.eksik.join(", ") : ""));
  }
}

if (require.main === module) {
  ana(process.argv.slice(2)).catch(e => { console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : "")); process.exit(e.cikis || 1); });
}
module.exports = { STILLER, MODLAR, yeni, tara, sahneEkle, fotoEkle, uret, kur, liste, istemKur, klipEsle, ayarOku, ayristir };
