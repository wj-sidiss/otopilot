// lib/ses-uret.js — seslendirme cekirdegi (seslendir.js bunu cagirir; testler dogrudan cagirir).
//
// GIRDI : uretim/<is>/Voice/SESLENDIRME-TAM-METIN.txt  (paragraflar bos satirla ayrilir)
// CIKTI : Voice/parts/NNN.mp3        NNN = KANONIK paragraf indeksi (0 tabanli, 3 hane)
//         Voice/kelimeler.json       paragraf basina kelime zamanlari (ms, parcaya gore goreli)
//         Voice/zamanlama.json       paragraf basina baslangic/sure (EN SON, atomik) — render bunu okur
//
// SOZLESME (v1 bolum 2):
//  - Hicbir paragraf dusmez, yeniden numaralanmaz. Bir paragraf denemeler tukenince
//    seslendirilemezse zamanlama.json YAZILMAZ ve cikis kodu 4 olur (eskiden sessizce atlaniyordu).
//  - Cikti once Voice/parts.tmp/'ye yazilir; TUMU basariliysa eski parts silinip tmp -> parts olur.
//    Boylece yarim kalan kosu eski (tutarli) sesi bozmaz; tmp'de ayni sha8'li parca yeniden uretilmez.
//  - Guncelse atla: metin ozeti + ses + hiz + motor + okunus eslesir ve tum parcalar durur.
//  - metniHazirla YALNIZ TTS'e uygulanir; altyazi ozgun metinle kurulur (okunanMetin kaydedilir).
//  - Motor degisimi TUM isi bastan calistirir (karisik ses motoru yok).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ortak = require("./ortak.js");
const { metniHazirla, hazirlikOzeti, kelimeSay, bomAt } = require("./ses-metin.js");
const M = require("./ses-motor.js");

const BOSLUK = 0.35;                 // paragraflar arasi nefes payi (sn); render ayni degeri kullanir
const ARDISIK_HATA_SINIRI = 3;       // ust uste 3 paragraf dusunce o motoru birak (servis kapali)
const SAPMA_UYARI_YUZDE = 15;

const adNo = i => String(i).padStart(3, "0");
const yuvarla = (x, k) => Math.round(x * 10 ** k) / 10 ** k;
const bosluksuz = s => String(s).replace(/\s+/g, " ").trim();

function bekleSenkron(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { /* yoksay */ }
}
function rmGuvenli(yol) { try { fs.rmSync(yol, { recursive: true, force: true }); } catch (e) { /* yoksay */ } }

// Windows'ta dizin yeniden adlandirma, icinde bir dosya baska surecte aciksa (antivirus,
// onizleme, onceki ffmpeg) EPERM/EBUSY verebilir: kisa beklemelerle tekrar dene.
function yenidenAdlandir(kaynak, hedef) {
  let son;
  for (let i = 0; i < 8; i++) {
    try { fs.renameSync(kaynak, hedef); return; }
    catch (e) {
      son = e;
      if (!["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"].includes(e.code)) break;
      bekleSenkron(150 * (i + 1));
    }
  }
  throw son;
}

// ---------------------------------------------------------------------------
// Dil / ses yardimcilari
// ---------------------------------------------------------------------------
// Motorun GERCEKTE kullandigi ses adi (zamanlama.json "ses", guncellik ve parca ozeti bunu kullanir).
//   piper: model adi · voxcpm: "voxcpm:<ad>" (Edge adi verildiyse dilin VoxCPM varsayilani)
//   edge/azure: VoxCPM sesi verildiyse (otomatik yedek) dilin varsayilan Edge sesi
function sesAdiMotor(motorAdi, ses, env, dil) {
  if (motorAdi === "piper") return path.basename(String(env("PIPER_MODEL") || "model")).replace(/\.onnx$/i, "");
  if (motorAdi === "voxcpm") return require("./ses-motor-voxcpm.js").kimlikBul(ses, dil) || "voxcpm:?";
  if (dil && (motorAdi === "edge" || motorAdi === "azure")) return M.yedekSes(ses, dil);
  return ses;
}

// Ses ornegi dili: Edge adinin onekinden (tr-TR-...), VoxCPM sesinin kartindan; yoksa en.
function sesDili(ses) {
  if (ortak.voxcpmSesiMi(ses)) return ortak.voxcpmKimlikDili(ses) || "tr";
  return /^[a-z]{2}[-_]/i.test(String(ses || "")) ? String(ses).slice(0, 2) : "en";
}

const ORNEK_METIN = {
  en: "This is a short sample of the selected voice. How does it sound to you?",
  tr: "Bu, seçilen sesin kısa bir örneğidir. Sana nasıl geliyor?",
  es: "Esta es una breve muestra de la voz seleccionada. ¿Cómo te suena?",
  de: "Das ist ein kurzes Beispiel der gewählten Stimme. Wie klingt sie für dich?",
  fr: "Ceci est un court exemple de la voix choisie. Comment la trouves-tu ?",
  ru: "Это короткий пример выбранного голоса. Как он вам?",
  zh: "这是所选声音的简短示例。你觉得听起来怎么样？",
  ja: "これは選んだ声の短いサンプルです。どう聞こえますか？",
};

// ---------------------------------------------------------------------------
// Guncel mi? (atla karari)
// ---------------------------------------------------------------------------
function guncelMi(c) {
  let zam;
  try { zam = ortak.jsonOku(path.join(c.sesDizin, "zamanlama.json"), null); } catch (e) { return false; }
  if (!zam || zam.surum !== 1 || !Array.isArray(zam.paragraflar)) return false;
  if (zam.metinOzeti !== c.ozet || zam.paragrafSayisi !== c.n || zam.paragraflar.length !== c.n) return false;
  if (zam.dil !== c.dil || zam.hiz !== c.hiz || zam.okunusOzeti !== c.hazirlik) return false;
  if (c.motorSecimi === "otomatik") {
    // VoxCPM yalniz ses "voxcpm:<ad>" iken otomatik siradadir; VoxCPM sesi istenip yedek motorla uretilmis ses,
    // VoxCPM sonradan kurulduysa (sira artik onunla basliyor) guncel sayilmaz.
    const voxSesi = ortak.voxcpmSesiMi(c.ses);
    if (zam.motor === "voxcpm" ? !voxSesi : !M.OTOMATIK_MOTORLAR.includes(zam.motor)) return false;
    if (voxSesi && zam.motor !== "voxcpm" && c.sira && c.sira[0] === "voxcpm") return false;
  } else if (zam.motor !== c.motorSecimi) return false;
  if (zam.ses !== sesAdiMotor(zam.motor, c.ses, c.env, c.dil)) return false;
  for (let i = 0; i < c.n; i++) {
    const p = zam.paragraflar[i];
    if (!p || p.no !== i) return false;
    const f = path.join(c.sesDizin, "parts", adNo(i) + ".mp3");
    try { if (fs.statSync(f).size !== p.bayt) return false; } catch (e) { return false; }
  }
  return true;
}

// ---------------------------------------------------------------------------
// ANA AKIS
//   g: {dizin, ses, hiz, dil, motorSecimi, okunus, yeniden, hedefSn, teknikMaxSn, env, enjekte,
//       ayar (deneme politikasi), log, uyari, ilerleme}
//   -> {atlandi:true, neden} | {atlandi:false, motor, ses, paragrafSayisi, toplamSn, sapmaYuzde, uyarilar}
// ---------------------------------------------------------------------------
async function seslendir(g) {
  const env = g.env || ortak.envOku;
  const enjekte = g.enjekte || {};
  const log = g.log || (m => console.log(m));
  const uyari = g.uyari || ortak.uyari;
  const ilerleme = g.ilerleme || ortak.ilerleme;
  const uyarilar = [];
  const uyar = m => { uyarilar.push(m); uyari(m); };

  const dil = String(g.dil || "en").toLowerCase().slice(0, 2);
  const hiz = g.hiz || "+7%";
  const okunus = g.okunus || {};
  const sesDizin = path.join(g.dizin, "Voice");
  const TXT = path.join(sesDizin, "SESLENDIRME-TAM-METIN.txt");
  const PARTS = path.join(sesDizin, "parts");
  const TMP = path.join(sesDizin, "parts.tmp");
  const META = path.join(TMP, "_meta");
  const ARA = path.join(TMP, "_ara");

  // ---- girdi ----
  let ham = "";
  try { ham = bomAt(fs.readFileSync(TXT, "utf8")); } catch (e) { /* asagida hata */ }
  const paragraflar = ortak.paragraflaraBol(ham);
  if (!paragraflar.length)
    throw new ortak.OrtakHata("senaryo_yok", "Seslendirilecek senaryo yok ya da boş.", {
      cikis: 2, cozum: "Önce senaryoyu yaz ya da Voice/SESLENDIRME-TAM-METIN.txt dosyasına metni yapıştır." });
  const n = paragraflar.length;
  const ozet = ortak.paragrafOzeti(paragraflar);
  const hazirlik = hazirlikOzeti(okunus);

  // Eski altyazi.srt artik uretilmez (tek SRT: render'in gercek zamanli ciktisi). Eski kopya yaniltir.
  rmGuvenli(path.join(sesDizin, "altyazi.srt"));

  const sira = M.motorSirasi(g.motorSecimi, env, enjekte, g.ses);
  if (ortak.voxcpmSesiMi(g.ses) && !sira.includes("voxcpm")) {
    // otomatik secim + VoxCPM kurulu degil: hata degil, siradaki motorla (dilin varsayilan sesi) devam
    const h = M.motorHazirMi("voxcpm", env, enjekte);
    log("VoxCPM kullanılamıyor (" + h.neden + "); '" + sira[0] + "' motoruyla " + M.yedekSes(g.ses, dil) + " sesi kullanılacak.");
  }

  // ---- guncelse atla ----
  try {                                        // bilinmeyen/ust surum: guvenli geri dusus = yeniden uret (uyarili)
    const eskiZam = ortak.jsonOku(path.join(sesDizin, "zamanlama.json"), null);
    if (eskiZam && eskiZam.surum !== 1) uyar("zamanlama.json sürümü tanınmıyor (" + eskiZam.surum + "); ses yeniden üretilecek.");
  } catch (e) { /* bozuksa guncelMi zaten false verir */ }
  const baglam = { sesDizin, ozet, n, dil, hiz, hazirlik, motorSecimi: g.motorSecimi || "otomatik", ses: g.ses, env, sira };
  if (!g.yeniden && guncelMi(baglam)) {
    log("Ses güncel (" + n + " paragraf); yeniden üretilmedi. Zorlamak için --yeniden kullan.");
    return { atlandi: true, neden: "ses güncel", paragrafSayisi: n, uyarilar };
  }

  ortak.diskKontrol(g.dizin, 0.5);

  // ---- okunacak metinler ----
  const okunanlar = paragraflar.map(p => metniHazirla(p, dil, okunus, { xml: false }));
  const degisti = paragraflar.map((p, i) => bosluksuz(p) !== bosluksuz(okunanlar[i]));

  // ---- tmp hazirligi (kismi devam) ----
  if (g.yeniden) rmGuvenli(TMP);
  fs.mkdirSync(META, { recursive: true });
  rmGuvenli(ARA);
  fs.mkdirSync(ARA, { recursive: true });
  const tmpTemizle = () => {                       // artik/yarim dosyalari at
    for (const f of fs.readdirSync(TMP)) {
      if (f === "_meta" || f === "_ara") continue;
      const m = /^(\d+)\.mp3$/.exec(f);
      if (!m || Number(m[1]) >= n) rmGuvenli(path.join(TMP, f));
    }
    for (const f of fs.readdirSync(META)) {
      const m = /^(\d+)\.json$/.exec(f);
      if (!m || Number(m[1]) >= n) rmGuvenli(path.join(META, f));
    }
  };
  tmpTemizle();

  const metaOku = i => { try { return JSON.parse(fs.readFileSync(path.join(META, adNo(i) + ".json"), "utf8")); } catch (e) { return null; } };
  const metaYaz = (i, m) => ortak.atomikJsonYaz(path.join(META, adNo(i) + ".json"), m);

  log(n + " paragraf, dil: " + dil + ", ses: " + g.ses + ", hız: " + hiz +
      ", motor: " + (g.motorSecimi || "otomatik") + (sira.length > 1 ? " (sıra: " + sira.join(" → ") + ")" : ""));
  if (degisti.some(Boolean)) log(degisti.filter(Boolean).length + " paragrafın okunuşu hazırlandı (sayı/kısaltma/sembol); altyazı özgün metinle kalır.");

  // ---- bir motorla tum paragraflar ----
  async function tumuUret(motorAdi) {
    const sesAdi = sesAdiMotor(motorAdi, g.ses, env, dil);
    let motor;
    try {
      motor = M.motorOlustur(motorAdi, { ses: g.ses, hiz, dil, env, enjekte, zamanAsimiMs: (g.ayar || {}).zamanAsimiMs, log });
    } catch (e) {                                       // gecersiz ses adi, eksik anahtar/model, paket yok...
      e.kalici = true;
      return { motorAdi, sesAdi, sonuclar: new Array(n).fill(null), dusen: [], durduruldu: false, kalici: e, kelimeZamani: false };
    }
    // Metni okuyamayacak motor (VoxCPM: o dilde rakam kaldi vb.) uzun GPU isine BASLAMADAN elenir.
    if (typeof motor.metinDenetle === "function") {
      const sorunlu = [];
      okunanlar.forEach((m, i) => { const s = motor.metinDenetle(m); if (s && s.length) sorunlu.push("paragraf " + (i + 1) + ": " + s[0]); });
      if (sorunlu.length) {
        try { motor.kapat(); } catch (e) { /* yoksay */ }
        const e = new Error("'" + motorAdi + "' motoru metni okuyamıyor — " + sorunlu.slice(0, 3).join("; ") +
          (sorunlu.length > 3 ? " (+" + (sorunlu.length - 3) + " paragraf)" : ""));
        e.kalici = true; e.cozum = motor.metinCozumu;
        return { motorAdi, sesAdi, sonuclar: new Array(n).fill(null), dusen: [], durduruldu: false, kalici: e, kelimeZamani: false };
      }
    }
    const sonuclar = new Array(n).fill(null);
    const dusen = [];
    let ardisik = 0, durduruldu = false, kalici = null, yenidenKullanilan = 0;
    try {
      for (let i = 0; i < n; i++) {
        const sha = ortak.sha1([motorAdi, sesAdi, hiz, dil, okunanlar[i]].join("\u0000")).slice(0, 8);
        const mp3 = path.join(TMP, adNo(i) + ".mp3");
        const meta = g.yeniden ? null : metaOku(i);
        let gecerli = false;
        if (meta && meta.surum === 1 && meta.sha === sha && Array.isArray(meta.kelimeler)) {
          try { gecerli = fs.statSync(mp3).size === meta.bayt; } catch (e) { gecerli = false; }
        }
        if (gecerli) {
          sonuclar[i] = meta; yenidenKullanilan++;
        } else {
          rmGuvenli(mp3); rmGuvenli(path.join(META, adNo(i) + ".json"));
          try {
            // paragraf icinden ilerleme (VoxCPM "k/n cümle"): yuzde paragraflar arasinda geriye gitmez
            const icIlerleme = oran => ilerleme("ses", (i + oran) / n * 100, { n: i + 1, toplam: n });
            const r = await M.parcaUret(motor, okunanlar[i], { hedef: mp3, araDizin: ARA, dil, hiz, ayar: g.ayar, log, ilerleme: icIlerleme });
            const m = { surum: 1, no: i, sha, sureSn: r.sureSn, bayt: r.bayt, okunanMetin: okunanlar[i],
                        metinDegisti: degisti[i], kelimeler: r.kelimeler, parcaSayisi: r.parcaSayisi };
            metaYaz(i, m);
            sonuclar[i] = m; ardisik = 0;
          } catch (e) {
            if (e instanceof ortak.OrtakHata || (e && (e.code === "ENOSPC" || e.code === "EDQUOT"))) throw e;   // disk dolu vb.: paragraf hatasi DEGIL
            if (e && e.kalici) { kalici = e; break; }      // yapilandirma/anahtar hatasi: hepsi ayni olur
            dusen.push({ no: i, neden: String((e && e.message) || e), cozum: e && e.cozum });
            ardisik++;
            log("!! paragraf " + (i + 1) + " seslendirilemedi: " + String((e && e.message) || e).split("\n")[0]);
            if (ardisik >= ARDISIK_HATA_SINIRI) { durduruldu = true; break; }
          }
        }
        ilerleme("ses", (i + 1) / n * 100, { n: i + 1, toplam: n });
        if ((i + 1) % 10 === 0 && i + 1 < n) log("  " + (i + 1) + "/" + n + " paragraf");
      }
    } finally {
      try { motor.kapat(); } catch (e) { /* yoksay */ }
    }
    if (yenidenKullanilan) log(yenidenKullanilan + " paragraf önceki koşudan alındı (aynı metin/ses/hız).");
    return { motorAdi, sesAdi, sonuclar, dusen, durduruldu, kalici, kelimeZamani: sonuclar.some(s => s && s.kelimeler.length) };
  }

  // ---- motor sirasi: biri paragraf dusurursa TUM is siradakiyle bastan ----
  let son = null, voxYarim = false;
  for (let k = 0; k < sira.length; k++) {
    son = await tumuUret(sira[k]);
    const tamam = !son.kalici && !son.dusen.length && !son.durduruldu;
    if (tamam) break;
    // VoxCPM (yerel GPU, saatler surebilir) bazi paragraflari BITIRDIYSE o emek silinip is Edge'in varsayilan sesiyle
    // bastan yapilmaz: is durur (cikis 4), biten paragraflar parts.tmp'de kalir, ayni komut kaldigi yerden devam eder.
    // Hic paragraf bitmediyse ya da kalici hatada (kurulum, metin) yedek motora gecilir.
    if (sira[k] === "voxcpm" && k + 1 < sira.length && !son.kalici && son.sonuclar.some(Boolean)) { voxYarim = true; break; }
    if (k + 1 < sira.length) {
      const neden = son.kalici ? son.kalici.message
        : "paragraf " + son.dusen.map(d => d.no + 1).join(", ") + " seslendirilemedi";
      uyar("'" + sira[k] + "' motoru başarısız oldu (" + neden + "); ses tutarlılığı için TÜM iş '" + sira[k + 1] + "' motoruyla baştan yapılıyor.");
      rmGuvenli(TMP);
      fs.mkdirSync(META, { recursive: true });
      fs.mkdirSync(ARA, { recursive: true });
    }
  }

  if (son.kalici) {
    throw new ortak.OrtakHata("motor_hata", son.kalici.message, {
      cikis: son.kalici.kod === "anahtar_gecersiz" ? 3 : 2,
      cozum: son.kalici.cozum || "Kaynaklar sekmesinden '" + son.motorAdi + "' ayarlarını kontrol et.", detay: { motor: son.motorAdi } });
  }
  if (son.dusen.length || son.durduruldu) {
    const liste = son.dusen.map(d => d.no + 1);
    const denenmeyen = n - son.sonuclar.filter(Boolean).length - son.dusen.length;
    // Yedek motor ipucu: tek motor denendiyse hazir baska motor var mi? (VoxCPM otomatik siraya kendiliginden girmez)
    let ipucu = "";
    if (sira.length === 1) {
      const hazir = M.OTOMATIK_MOTORLAR.filter(m => m !== sira[0] && M.motorHazirMi(m, env, enjekte).ok);
      ipucu = hazir.length
        ? " Yedek motor hazır (" + hazir.join(", ") + "): ses motorunu 'otomatik' yap."
        : " Yedek motor için AZURE_SPEECH_KEY + AZURE_SPEECH_REGION ya da PIPER_YOL + PIPER_MODEL tanımla.";
    }
    // motorun kendi cozumu (VoxCPM: "cumleyi bol") ag tavsiyesinden daha dogrudur
    const motorCozumu = (son.dusen.find(d => d.cozum) || {}).cozum;
    const yerel = son.motorAdi === "voxcpm";              // yerel GPU motoru: "baglanti/servis" tavsiyesi yanlis olur
    const durduMetni = !son.durduruldu ? ""
      : yerel ? "VoxCPM art arda " + ARDISIK_HATA_SINIRI + " paragrafı okuyamadı (" + denenmeyen + " paragraf denenmedi). "
      : "Servis yanıt vermiyor (ardışık " + ARDISIK_HATA_SINIRI + " paragraf düştü; " + denenmeyen + " paragraf denenmedi). ";
    const varsayilanCozum = yerel
      ? "Ekran kartını kullanan başka programı kapatıp seslendirmeyi yeniden çalıştır; tamamlanan paragraflar yeniden üretilmez."
      : "Bağlantını kontrol edip seslendirmeyi yeniden çalıştır; tamamlanan paragraflar yeniden üretilmez.";
    // VoxCPM'de "otomatik yap" ipucu ise yaramaz (VoxCPM sesi otomatikte de once VoxCPM'le okunur): Edge'e acik gecis
    if (yerel) ipucu = (voxYarim ? " Biten VoxCPM paragrafları korunsun diye Edge'e geçilmedi." : "") +
      " Tümünü Edge sesiyle yapmak istersen: --motor edge --ses " + ortak.varsayilanSes(dil) + " --yeniden";
    throw new ortak.OrtakHata("paragraf_dustu", "Paragraf " + liste.join(", ") + " seslendirilemedi", {
      cikis: 4,
      cozum: durduMetni + (motorCozumu || varsayilanCozum) + ipucu,
      detay: son.dusen.map(d => ({ no: d.no, neden: d.neden })) });
  }

  // ---- bitirme: zamanlama hesabi ----
  const sonuclar = son.sonuclar;
  const toplamSure = sonuclar.reduce((a, s) => a + s.sureSn, 0);
  const toplamSn = toplamSure + (n - 1) * BOSLUK;
  let bas = 0;
  const satirlar = sonuclar.map((s, i) => {
    const baslangic = bas;
    bas += s.sureSn + BOSLUK;
    return { no: i, dosya: "parts/" + adNo(i) + ".mp3", sureSn: yuvarla(s.sureSn, 3), baslangicSn: yuvarla(baslangic, 3),
             kelimeSayisi: kelimeSay(paragraflar[i]), sha: s.sha, bayt: s.bayt };
  });
  const toplamKelime = paragraflar.reduce((a, p) => a + kelimeSay(p), 0);
  const hedefSn = Number.isFinite(g.hedefSn) && g.hedefSn > 0 ? g.hedefSn : null;
  const sapmaYuzde = hedefSn ? yuvarla((toplamSn - hedefSn) / hedefSn * 100, 1) : null;

  if (!son.kelimeZamani && son.motorAdi === "edge")
    uyar("Edge kelime zamanlarını göndermedi (kelimeler.json boş): altyazı karakter oranıyla kurulacak, kayma olabilir.");
  else if (!sonuclar.every(s => s.kelimeler.length) && son.kelimeZamani)
    uyar(sonuclar.filter(s => !s.kelimeler.length).length + " paragrafta kelime zamanı yok; o paragrafların altyazısı karakter oranıyla kurulacak.");
  if (hedefSn && Math.abs(sapmaYuzde) > SAPMA_UYARI_YUZDE)
    uyar("Ses süresi hedeften %" + Math.abs(Math.round(sapmaYuzde)) + " " + (sapmaYuzde < 0 ? "kısa" : "uzun") + ": " +
         yuvarla(toplamSn / 60, 1) + " dk (hedef " + yuvarla(hedefSn / 60, 1) + " dk). Senaryoyu " +
         (sapmaYuzde < 0 ? "uzat" : "kısalt") + " ya da ses hızını değiştir.");
  if (g.teknikMaxSn && toplamSn > g.teknikMaxSn)
    uyar("Ses " + Math.round(toplamSn) + " sn: bu format için sınır " + g.teknikMaxSn + " sn.");

  // ---- yayina al ----
  // Sira: (1) eski zamanlama/kelimeler yana alinir (yarim kalirsa eski sureler yeni sese yanlis
  // uymasin), (2) parts degistirilir, (3) kelimeler.json, (4) zamanlama.json EN SON.
  // Degistirme basarisiz olursa her sey eski yerine doner.
  const ESKI = PARTS + ".eski";
  const yana = ["zamanlama.json", "kelimeler.json"].map(a => [path.join(sesDizin, a), path.join(sesDizin, a + ".eski")]);
  rmGuvenli(ESKI);
  for (const [a, b] of yana) { rmGuvenli(b); if (fs.existsSync(a)) fs.renameSync(a, b); }
  try {
    if (fs.existsSync(PARTS)) yenidenAdlandir(PARTS, ESKI);
    yenidenAdlandir(TMP, PARTS);
  } catch (e) {
    if (fs.existsSync(ESKI) && !fs.existsSync(PARTS)) { try { yenidenAdlandir(ESKI, PARTS); } catch (e2) { /* yoksay */ } }
    for (const [a, b] of yana) { try { if (fs.existsSync(b)) fs.renameSync(b, a); } catch (e2) { /* yoksay */ } }
    throw new ortak.OrtakHata("parts_degistirilemedi", "Ses klasörü güncellenemedi: " + e.message, {
      cikis: 1, cozum: "Voice/parts klasörünü kullanan program varsa (önizleme, ffmpeg) kapat ve seslendirmeyi yeniden çalıştır." });
  }
  rmGuvenli(ESKI);
  rmGuvenli(path.join(PARTS, "_meta")); rmGuvenli(path.join(PARTS, "_ara"));   // devam bilgisi artik gerekmiyor

  ortak.atomikJsonYaz(path.join(sesDizin, "kelimeler.json"), {
    surum: 1, dil, ses: son.sesAdi, motor: son.motorAdi,
    paragraflar: sonuclar.map(s => ({ no: s.no, okunanMetin: s.okunanMetin, metinDegisti: s.metinDegisti, kelimeler: s.kelimeler })),
  });
  ortak.atomikJsonYaz(path.join(sesDizin, "zamanlama.json"), {
    surum: 1, olusturma: new Date().toISOString(), metinOzeti: ozet, dil, ses: son.sesAdi, motor: son.motorAdi, hiz,
    bosluk: BOSLUK, paragrafSayisi: n, toplamSn: yuvarla(toplamSn, 2), hedefSn, sapmaYuzde,
    olculenKelimeHizi: yuvarla(toplamKelime / (toplamSn / 60), 1), okunusOzeti: hazirlik, paragraflar: satirlar,
  });
  for (const [, b] of yana) rmGuvenli(b);

  log("Bitti: " + n + " paragraf, " + yuvarla(toplamSn / 60, 2) + " dk (" + son.motorAdi + ", " + son.sesAdi + ").");
  return { atlandi: false, motor: son.motorAdi, ses: son.sesAdi, paragrafSayisi: n, toplamSn: yuvarla(toplamSn, 2),
           hedefSn, sapmaYuzde, olculenKelimeHizi: yuvarla(toplamKelime / (toplamSn / 60), 1), uyarilar };
}

// ---------------------------------------------------------------------------
// 5 sn ornek (--test): tek motor, tek parca. -> {dosya, sureSn, motor}
// ---------------------------------------------------------------------------
async function ornekUret(g) {
  const env = g.env || ortak.envOku;
  const enjekte = g.enjekte || {};
  const log = g.log || (m => console.log(m));
  const ses = g.ses || ortak.varsayilanSes(g.dil || "en");
  const dil = String(g.dil || sesDili(ses)).toLowerCase().slice(0, 2);
  const hiz = g.hiz || "+0%";
  const metin = metniHazirla(g.metin || ORNEK_METIN[dil] || ORNEK_METIN.en, dil, g.okunus || {}, { xml: false });
  const cikti = path.resolve(g.cikti);
  fs.mkdirSync(path.dirname(cikti), { recursive: true });
  const ara = fs.mkdtempSync(path.join(os.tmpdir(), "ses-ornek-"));
  const sira = M.motorSirasi(g.motorSecimi, env, enjekte, ses);
  let sonHata = null;
  try {
    for (const motorAdi of sira) {
      let motor;
      try { motor = M.motorOlustur(motorAdi, { ses, hiz, dil, env, enjekte, log }); }
      catch (e) { sonHata = e; log("'" + motorAdi + "' motoru kurulamadı: " + String((e && e.message) || e)); continue; }
      try {
        const r = await M.parcaUret(motor, metin, { hedef: cikti, araDizin: ara, dil, hiz, ayar: g.ayar, log });
        return { dosya: cikti, sureSn: yuvarla(r.sureSn, 2), motor: motorAdi };
      } catch (e) {
        sonHata = e;
        log("'" + motorAdi + "' motoru örnek üretemedi: " + String((e && e.message) || e));
      } finally { try { motor.kapat(); } catch (e) { /* yoksay */ } }
    }
  } finally { rmGuvenli(ara); }
  throw new ortak.OrtakHata("ses_testi", "Ses örneği üretilemedi: " + String((sonHata && sonHata.message) || "bilinmeyen hata"), {
    cikis: 3, cozum: "Bağlantını ve ses ayarlarını kontrol et; Kaynaklar sekmesinden başka bir ses motoru seçebilirsin." });
}

module.exports = { BOSLUK, seslendir, ornekUret, guncelMi, sesAdiMotor, sesDili, ORNEK_METIN };
