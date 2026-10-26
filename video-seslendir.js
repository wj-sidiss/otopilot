// VAR OLAN VIDEOYA SESLENDIRME + ALTYAZI EKLER
//
// Elindeki bir videoya Turkce (ya da baska dilde) anlatim ve altyazi bindirir.
// SADECE KENDI videon ya da kullanma iznin olan bir video icin. Baskasinin videosunu izinsiz
// seslendirip yeniden yuklemek telif ihlalidir ve kanalin kapanmasina yol acabilir.
//
// Kullanim:
//   node video-seslendir.js <video.mp4> <senaryo.txt> [cikti.mp4]
//
// Secenekler:
//   --ses tr-TR-AhmetNeural     erkek (varsayilan) · tr-TR-EmelNeural kadin · voxcpm:tok_anlatici (yerel VoxCPM2)
//   --hiz +0%                   konusma hizi
//   --orijinal 0.12             orijinal sesin seviyesi (0 = tamamen kapat)
//   --altyazi 0                 altyaziyi gomme
//   --punto 22                  altyazi boyutu
//   --motor otomatik|edge|azure|piper|voxcpm|sistem   ses motoru (varsayilan otomatik: Edge, olmazsa yedek;
//                               sistem = isletim sistemi sesi, robotik, yalniz Edge tumden duserse kendiliginden secilir)
//   --srt                       altyazi SRT'sini de <cikti>.srt olarak kaydet
//
// SENARYO DOSYASI: duz metin, paragraflar bos satirla ayrilir.
// Her paragraf bir altyazi blogu ve bir konusma parcasi olur.
//
// ZAMANLAMA: Anlatim videodan kisaysa paragraf aralarina bosluk dagitilir,
// boylece anlatim videonun tamamina yayilir. Uzunsa konusma hizi otomatik
// artirilir. Ikisi de olmazsa uyari verir.
//
// ALTYAZI: ses motoru kelime zamani verirse (Edge) altyazi o kelime zamanlarindan kurulur;
// vermezse (Azure/Piper) paragrafin suresi satirlara KARAKTER oraniyla dagitilir.
// Ses TTS icin hazirlanir (yuzde, sayi, kisaltma) ama altyazi senaryodaki OZGUN metindir.
//
// Cikis kodlari: 0 basari · 2 girdi/yapilandirma · 3 dis servis · 4 paragraf seslendirilemedi
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ortak = require("./lib/ortak.js");
const { metniHazirla, bomAt } = require("./lib/ses-metin.js");
const M = require("./lib/ses-motor.js");
const A = require("./lib/ses-altyazi.js");
const FFYOL = require("./ff-yol.js");

const ARDISIK_HATA_SINIRI = 3;
const adNo = i => String(i).padStart(3, "0");

function rmGuvenli(yol) { try { fs.rmSync(yol, { recursive: true, force: true }); } catch (e) { /* yoksay */ } }

// ffmpeg calistir: zaman asimli, hata ayrintisi Turkce basliklarla
function ffmpegCalistir(args, etiket, cwd, zamanAsimiMs) {
  try {
    return execFileSync(FFYOL.ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args],
      { cwd, stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1 << 26, timeout: zamanAsimiMs });
  } catch (e) {
    const err = (e.stderr && e.stderr.toString("utf8")) || e.message || "";
    const son = err.split(/\r?\n/).filter(Boolean).slice(-8).join("\n");
    const zaman = e.code === "ETIMEDOUT" || e.signal === "SIGTERM";
    throw new ortak.OrtakHata(zaman ? "ffmpeg_zaman_asimi" : "ffmpeg_hata",
      zaman ? "ffmpeg zaman aşımına uğradı (" + etiket + ")." : "ffmpeg hata verdi (" + etiket + ").",
      { cikis: 1, cozum: zaman ? "Video çok uzun olabilir; bilgisayarı yormayan bir anda tekrar dene." : "Video dosyasını ve altyazı ayarlarını kontrol et.", detay: son });
  }
}
const sureOlc = f => M.sureOlc(f);

async function ana(argv, secenek) {
  const ek = secenek || {};
  const log = ek.log || (m => console.log(m));
  const uyari = ek.uyari || ortak.uyari;          // @@UYARI satiri: panel log'unda uyari olarak isaretlenir
  const { konum, bayrak } = ortak.argumanCoz(argv, { deger: ["ses", "hiz", "orijinal", "altyazi", "punto", "motor"] });

  // ---- girdi dogrulama ----
  if (konum.length < 2)
    throw new ortak.OrtakHata("arguman", "Video ve senaryo dosyası verilmedi.", { cikis: 2,
      cozum: "Kullanım: node video-seslendir.js <video.mp4> <senaryo.txt> [cikti.mp4]" });
  // MUTLAK YOL SART: son ffmpeg cagrisi SRT klasorunde calisiyor (Windows
  // surucu harfi altyazi filtresini bozdugu icin). Goreli yol orada kirilir.
  const VIDEO = path.resolve(konum[0]);
  const SENARYO = path.resolve(konum[1]);
  for (const f of [VIDEO, SENARYO])
    if (!fs.existsSync(f)) throw new ortak.OrtakHata("dosya_yok", "Dosya bulunamadı: " + f, { cikis: 2 });
  const pv = path.parse(VIDEO);
  let CIKTI = path.resolve(konum[2] || path.join(pv.dir, pv.name + " - seslendirilmis.mp4"));
  if (!path.extname(CIKTI)) CIKTI += ".mp4";                 // ffmpeg bicimi uzantidan anlar
  if (CIKTI.toLowerCase() === VIDEO.toLowerCase())
    throw new ortak.OrtakHata("cikti_ayni", "Çıktı dosyası kaynak videoyla aynı olamaz.", { cikis: 2, cozum: "Farklı bir çıktı adı ver." });

  const metinBayrak = (ad, v) => (typeof bayrak[ad] === "string" ? bayrak[ad] : v);
  const SES = metinBayrak("ses", "tr-TR-AhmetNeural");
  let HIZ = metinBayrak("hiz", "+0%");
  const MOTOR = metinBayrak("motor", "otomatik");
  const ORIJINAL = Number(metinBayrak("orijinal", "0.12"));
  const ALTYAZI = metinBayrak("altyazi", "1") !== "0";
  const PUNTO = Number(metinBayrak("punto", "22"));
  if (!/^[+-]\d{1,2}%$/.test(HIZ))
    throw new ortak.OrtakHata("hiz_gecersiz", "Ses hızı geçersiz: " + HIZ, { cikis: 2, cozum: "+0% ya da -10% gibi yaz." });
  if (!Number.isFinite(ORIJINAL) || ORIJINAL < 0 || ORIJINAL > 1)
    throw new ortak.OrtakHata("orijinal_gecersiz", "--orijinal 0 ile 1 arasında olmalı.", { cikis: 2 });
  if (!Number.isFinite(PUNTO) || PUNTO < 8 || PUNTO > 72)
    throw new ortak.OrtakHata("punto_gecersiz", "--punto 8 ile 72 arasında olmalı.", { cikis: 2 });
  // dil: Edge adinin onekinden (tr-TR-...), VoxCPM sesinin ("voxcpm:<ad>") kartindan
  const dil = require("./lib/ses-uret.js").sesDili(SES).toLowerCase();

  const env = ek.env || ortak.envOku;
  const sira = M.motorSirasi(MOTOR, env, ek.enjekte, SES);

  uyari("Bu araç yalnızca KENDİ videoların ya da kullanma iznin olan videolar içindir; başkasının videosunu izinsiz seslendirip yeniden yüklemek telif ihlalidir.");
  uyari("Yapay (sentetik) ses kullanıyorsun; YouTube Studio'da gerekiyorsa 'değiştirilmiş/sentetik içerik' kutusunu işaretle.");

  try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* yoksay */ }
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "video-seslendir-"));
  const CIKTI_PART = path.join(path.dirname(CIKTI), path.parse(CIKTI).name + ".part" + path.parse(CIKTI).ext);

  try {
    const V_SURE = sureOlc(VIDEO);
    log("video    : " + path.basename(VIDEO) + "  " + (V_SURE / 60).toFixed(2) + " dk");

    const ham = bomAt(fs.readFileSync(SENARYO, "utf8"));
    const paragraflar = ortak.paragraflaraBol(ham);
    if (!paragraflar.length)
      throw new ortak.OrtakHata("senaryo_bos", "Senaryo dosyası boş.", { cikis: 2, cozum: "Paragrafları boş satırla ayırarak metni yaz." });
    log("senaryo  : " + paragraflar.length + " paragraf · " + ham.split(/\s+/).filter(Boolean).length + " kelime");
    log("ses      : " + SES + "  (motor: " + MOTOR + (sira.length > 1 ? ", sıra: " + sira.join(" → ") : "") + ")");

    const okunanlar = paragraflar.map(p => metniHazirla(p, dil, {}, { xml: false }));
    ortak.diskKontrol(TMP, 0.5);
    ortak.diskKontrol(path.dirname(CIKTI), Math.round((fs.statSync(VIDEO).size / 1073741824 * 1.5 + 0.2) * 100) / 100);   // cikti ~ kaynak boyutu
    const ARA = path.join(TMP, "_ara");
    fs.mkdirSync(ARA, { recursive: true });

    // --- 1) seslendirme parcalari: motor sirasiyla, paragraf dusmez ---
    // Bir motor paragraf dusururse TUM is siradaki motorla bastan yapilir (karisik ses olmasin).
    let motorAdi = null;
    async function uret(hiz) {
      let sonHata = null;
      for (const adi of (motorAdi ? [motorAdi] : sira)) {
        let motor;
        try { motor = M.motorOlustur(adi, { ses: SES, hiz, dil, env, enjekte: ek.enjekte, log, uyar: uyari }); }
        catch (e) { sonHata = new ortak.OrtakHata("motor_hata", e.message, { cikis: 2, cozum: "'" + adi + "' ayarlarını kontrol et." }); continue; }
        const parcalar = [], dusen = [];
        let ardisik = 0;
        try {
          for (let i = 0; i < paragraflar.length; i++) {
            try {
              const f = path.join(TMP, adNo(i) + ".mp3");
              const r = await M.parcaUret(motor, okunanlar[i], { hedef: f, araDizin: ARA, dil, hiz, ayar: ek.ayar, log });
              parcalar.push({ dosya: f, metin: paragraflar[i], sure: r.sureSn, kelimeler: r.kelimeler });
              ardisik = 0;
              ortak.ilerleme("ses", (i + 1) / paragraflar.length * 100, { n: i + 1, toplam: paragraflar.length });
            } catch (e) {
              if (e instanceof ortak.OrtakHata || (e && (e.code === "ENOSPC" || e.code === "EDQUOT"))) throw e;   // disk dolu vb.
              if (e && e.kalici) throw new ortak.OrtakHata("motor_hata", e.message, { cikis: e.kod === "anahtar_gecersiz" ? 3 : 2 });
              dusen.push(i + 1);
              log("!! paragraf " + (i + 1) + " seslendirilemedi: " + String((e && e.message) || e).split("\n")[0]);
              if (++ardisik >= ARDISIK_HATA_SINIRI) break;
            }
          }
        } catch (e) {
          sonHata = e;
          try { motor.kapat(); } catch (e2) { /* yoksay */ }
          continue;
        }
        try { motor.kapat(); } catch (e) { /* yoksay */ }
        if (!dusen.length) { motorAdi = adi; return parcalar; }
        // Kalite dusuren son care (sistem sesi, robotik) KISMI basari varken secilmez: tek tuk paragraf gecici dustu diye
        // tum anlatim robotik sesle okunmaz (ses-uret.js ile ayni kural). Yalniz motor tumden coktuyse sisteme gecilir.
        const denenen = motorAdi ? [motorAdi] : sira;
        if (denenen[denenen.indexOf(adi) + 1] === "sistem" && parcalar.length)
          throw new ortak.OrtakHata("paragraf_dustu", "Paragraf " + dusen.join(", ") + " seslendirilemedi", { cikis: 4,
            cozum: "Bağlantını kontrol edip tekrar dene. İşletim sistemi sesine (robotik, kalite düşer) kendiliğinden geçilmedi; " +
              "servis düzelmezse tümünü o sesle yapmak için: --motor sistem" });
        sonHata = new ortak.OrtakHata("paragraf_dustu", "Paragraf " + dusen.join(", ") + " seslendirilemedi", {
          cikis: 4, cozum: "Bağlantını kontrol edip tekrar dene (paragrafı kısaltmak da yardımcı olabilir)." });
        if (adi !== sira[sira.length - 1] && !motorAdi) log("'" + adi + "' motoru başarısız; TÜM iş sıradaki motorla baştan yapılıyor.");
      }
      throw sonHata || new Error("seslendirme başarısız");
    }

    let parcalar = await uret(HIZ);

    // --- 2) zamanlama ---
    // Anlatim videodan uzunsa hizi artirip yeniden uret. Kisaysa aralara
    // bosluk dagit — boylece anlatim videonun tamamina yayilir.
    const KENAR = Math.min(1.5, V_SURE * 0.02);          // basta ve sonda bosluk
    const kullanilabilir = Math.max(1, V_SURE - KENAR * 2);
    let toplam = parcalar.reduce((a, p) => a + p.sure, 0);

    if (toplam > kullanilabilir) {
      const gerekli = toplam / kullanilabilir;
      // mevcut hiz (--hiz) ustune eklenir: +10% ile uretilmis sese %20 daha lazimsa yeni hiz ~+36%, +23% degil.
      // Negatif --hiz'de de gecerli bir deger uretir ("-10%" -> "-4%"; eskiden "+-4%" cikardi).
      const yeniHiz = M.hizArtir(HIZ, gerekli);
      if (M.hizYuzde(yeniHiz) <= M.hizYuzde(HIZ)) {
        // zaten en yuksek hizda (+50%): ayni sesi bosuna yeniden uretme
        uyari("Anlatım videodan " + (toplam - kullanilabilir).toFixed(1) + " sn uzun ve hız zaten sınırda (" + HIZ + "); senaryoyu kısalt ya da daha uzun video kullan.");
      } else {
        log("anlatım videodan " + (toplam - kullanilabilir).toFixed(1) + " sn uzun — hız " + yeniHiz + " yapılıyor");
        HIZ = yeniHiz;
        parcalar = await uret(HIZ);
        toplam = parcalar.reduce((a, p) => a + p.sure, 0);
        if (toplam > kullanilabilir)
          uyari("Hâlâ " + (toplam - kullanilabilir).toFixed(1) + " sn uzun — anlatım sondan taşacak, senaryoyu kısalt.");
      }
    }

    const bosluk = parcalar.length > 1
      ? Math.max(0, (kullanilabilir - toplam) / (parcalar.length - 1)) : 0;
    log("zamanlama: " + toplam.toFixed(1) + " sn anlatım + " + bosluk.toFixed(2) + " sn paragraf arası");

    // --- 3) sessizlikle birlestirilmis anlatim rayi ---
    const gecikmeler = [];
    let t = KENAR;
    for (const p of parcalar) { gecikmeler.push(t); t += p.sure + bosluk; }

    const girisler = [];
    parcalar.forEach(p => girisler.push("-i", p.dosya));
    const zincir = parcalar
      .map((p, i) => "[" + i + ":a]adelay=" + Math.round(gecikmeler[i] * 1000) + "|" + Math.round(gecikmeler[i] * 1000) + "[a" + i + "]")
      .join(";") + ";" + parcalar.map((_, i) => "[a" + i + "]").join("") +
      "amix=inputs=" + parcalar.length + ":duration=longest:normalize=0[mix]";

    // Yuzlerce paragrafta filtre komut satirina sigmaz (Windows ~32 bin karakter): dosyadan oku.
    const filtreDosyasi = path.join(TMP, "anlatim.filtre");
    fs.writeFileSync(filtreDosyasi, zincir, "utf8");
    const anlatim = path.join(TMP, "anlatim.wav");
    const zamanAsimi = Math.max(10 * 60, V_SURE * 4) * 1000;
    ffmpegCalistir([...girisler, FFYOL.filtreBayragi, filtreDosyasi, "-map", "[mix]",
      "-ar", "48000", "-ac", "2", "-t", String(V_SURE), anlatim], "anlatim birlestirme", TMP, zamanAsimi);

    // --- 4) altyazi ---
    let srt = null, bloklar = [];
    if (ALTYAZI) {
      parcalar.forEach((p, i) => {
        const b = A.paragrafBloklari({ metin: p.metin, baslangicSn: gecikmeler[i], sureSn: p.sure, kelimeler: p.kelimeler },
          { tavanMs: i + 1 < parcalar.length ? gecikmeler[i + 1] * 1000 : undefined });
        bloklar.push(...b);
      });
      srt = path.join(TMP, "altyazi.srt");
      fs.writeFileSync(srt, A.srtMetni(bloklar), "utf8");
      const kelimeli = parcalar.filter(p => p.kelimeler.length).length;
      log("altyazı  : " + bloklar.length + " satır (" + (kelimeli === parcalar.length ? "kelime zamanlarından"
        : kelimeli ? kelimeli + "/" + parcalar.length + " paragraf kelime zamanından, kalanı karakter oranıyla" : "karakter oranıyla") + ")");
    }

    // --- 5) son karisim ---
    // Orijinal ses kisilir (tamamen kapatilmaz — ortam sesi kalsin),
    // anlatim ustune biner. Videoda ses yoksa sadece anlatim kullanilir.
    const sesVar = (() => {
      try {
        return !!execFileSync(FFYOL.ffprobe, ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
          "-of", "csv=p=0", VIDEO], { timeout: 30000 }).toString().trim();
      } catch (e) { return false; }
    })();

    // Altyazi yolu: Windows'ta "C:" ffmpeg filtre sozdiziminde ayirac sayilip
    // "original_size" hatasi veriyor. Cozum: ffmpeg'i SRT'nin klasorunde
    // calistirip sadece dosya adini vermek.
    const vf = [];
    if (srt) {
      vf.push("subtitles=altyazi.srt:force_style='FontName=Arial,Fontsize=" + PUNTO + ",Bold=1," +
              "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=48'");
    }

    // SES SEVIYESI: loudnorm -16 LUFS (YouTube/TikTok ses seviyesi). loudnorm cikisi 192 kHz'e
    // yukseltir; aresample + -ar ile 48 kHz'e geri alinir (ffprobe ile dogrulandi).
    const SON_SES = "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000";
    const args = ["-i", VIDEO, "-i", anlatim];
    if (sesVar && ORIJINAL > 0) {
      args.push("-filter_complex",
        "[0:a]volume=" + ORIJINAL + "[o];[1:a]volume=1.0[n];[o][n]amix=inputs=2:duration=first:normalize=0," +
        "alimiter=level_in=1:level_out=0.95:limit=0.97," + SON_SES + "[a]",
        "-map", "0:v", "-map", "[a]");
    } else {
      args.push("-filter_complex",
        "[1:a]alimiter=level_in=1:level_out=0.95:limit=0.97," + SON_SES + "[a]",
        "-map", "0:v", "-map", "[a]");
    }
    if (vf.length) args.push("-vf", vf.join(","));
    args.push("-c:v", "libx264", "-preset", "medium", "-crf", "19",
              "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", CIKTI_PART);

    log("son karışım yapılıyor...");
    // ffmpeg SRT klasorunde calisir (Windows surucu harfi filtre sozdizimini bozuyor).
    // Cikti once .part adina yazilir; bitince yeniden adlandirilir (yarim dosya "bitmis" sanilmasin).
    try {
      ffmpegCalistir(args, "son karisim", TMP, Math.max(20 * 60, V_SURE * 6) * 1000);
      fs.renameSync(CIKTI_PART, CIKTI);
    } finally { rmGuvenli(CIKTI_PART); }

    let srtYolu = null;
    if (bayrak.srt && srt) {
      srtYolu = path.join(path.dirname(CIKTI), path.parse(CIKTI).name + ".srt");
      ortak.atomikYaz(srtYolu, fs.readFileSync(srt));
    }

    const mb = (fs.statSync(CIKTI).size / 1048576).toFixed(1);
    const bitisSure = sureOlc(CIKTI);
    log("");
    log("=== BİTTİ ===");
    log("  " + CIKTI);
    log("  " + bitisSure.toFixed(1) + " sn · " + mb + " MB" +
        (sesVar && ORIJINAL > 0 ? " · orijinal ses %" + Math.round(ORIJINAL * 100) + " seviyede" : " · sadece anlatım"));
    ortak.sonuc({ cikti: CIKTI, sureSn: Math.round(bitisSure * 100) / 100, boyutMB: Number(mb), motor: motorAdi, altyaziSatir: bloklar.length, srt: srtYolu });
    return { cikti: CIKTI, sureSn: bitisSure, motor: motorAdi, altyaziSatir: bloklar.length, srt: srtYolu };
  } finally {
    rmGuvenli(TMP);
  }
}

module.exports = { ana };

if (require.main === module) {
  require("./lib/ses-koruma.js").kur();       // yakalanmamis hata: ham yigin izi yerine Turkce tek satir
  ana(process.argv.slice(2)).then(() => {
    // Acik websocket kalirsa surec kapanmayabilir: temiz bitiste bir sure sonra zorla kapat.
    const t = setTimeout(() => process.exit(0), 1500);
    if (t.unref) t.unref();
  }).catch(ortak.bitir);
}
