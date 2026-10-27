// lib/ses-motor-voxcpm.js — VoxCPM2: kullanicinin KENDI bilgisayarinda (ekran karti) calisan yerel, ucretsiz,
// anahtarsiz ses motoru. Sesler yapaydir (metin tarifinden tasarlandi) ve Apache-2.0 ile gelir: sesler/voxcpm2/.
//
// Motorun kendisi bu depoda DEGIL: kullanici "voxcpm2-turkce-ses-tasarimi" deposunu (Apache-2.0, Ali Haydar Ozturk)
// kendi bilgisayarina kurar (scripts\kur.ps1: model + yamali audio.cpp motoru + .venv + ayarlar.json). Bu dosya o
// deponun okuma aracini cagirir:
//   cwd=<VOXCPM_KOK>   <python> -m ses_tasarim.oku --ses <sesler/voxcpm2/<ad> TAM YOLU> --metin @<metin.txt>
//                      --cikti <klasor> --dil <kod>
//   <python> = VOXCPM_PYTHON ya da <kok>\.venv\Scripts\python.exe (Windows) / <kok>/.venv/bin/python (Mac/Linux)
// oku.py ciktisi: <klasor>/okuma.wav (48 kHz mono PCM16) + <klasor>/ozet.json (satir satir t0/t1 sn). WAV ffmpeg ile
// mp3'e (48 kHz mono 128k) cevrilir; konu.json "sesHizi" atempo ile uygulanir (VoxCPM'in hiz ayari yoktur).
// Calisma klasoru <kok>/cikti/otopilot-* (VoxCPM deposunun kendi cikti yeri, .gitignore'da); is bitince silinir.
//
// Ses: konu.json "ses" / --ses "voxcpm:<ad>" (sesler/voxcpm2/<ad>) ya da "voxcpm:<ad>/<cesit>" (kullanicinin VoxCPM
// klasorunde ses_tasarim.tasarla ile tasarladigi ses: <sesler>/<ad>/cesit_NN). Baska bir ses adi verilirse (Edge adi,
// "--motor voxcpm" ile) dile gore varsayilan: tr tok_anlatici; en/de/es/fr/ja/ru/zh anlatici_<kod> (ortak.VOXCPM_VARSAYILAN).
//
// Metin kurallari (oku.py rakami ve tirnagi REDDEDER; satir = cumle; satir <= 2000 karakter):
//   - rakamlar yaziya cevrilir: tr lib/ses-metin.js trSayi ile, en asagidaki enSayi/enYil/enSira ile;
//     baska dilde rakam kalirsa is BASLAMADAN reddedilir (metinDenetle; otomatik secimde yedek motora gecilir)
//   - tirnaklar atilir (Turkcede kesme isareti de: "Türkiye'nin" -> "Türkiyenin"), parantez virgule doner
//     (VoxCPM2'de parantez ses tarifinin sinir isaretidir), "|" atilir (oku.py durak isareti "||")
//   - cumleler satira bolunur; ~30 sn'den uzun tek uretim kararsiz oldugu icin uzun cumle virgulde bolunur
//     ("|| bagli" = 0,25 sn kisa durak)
//   - Turkce metne sesler/voxcpm2/okunus_sozlugu.tsv uygulanir (oku.py kendi kopyasini da uygular; ayni sonuc)
// Kelime zamani YOK: ozet.json'daki cumle zamanlarindan YAKLASIK kelime zamani kurulur (altyazi cumle cumle oturur).
// Ayni anda tek GPU isi: makinede tek kilit dosyasi (os.tmpdir()/otopilot-voxcpm-gpu.kilit); ikinci is sira bekler
// (bekleme deneme zaman asimina sayilmaz: sentez kilidi alinca secenek.sureyiBaslat() cagirir).
// Uzun yerel islem: zaman asimi metin uzunluguyla buyur (zamanAsimiHesapla); oku.py'nin "k/n cümle" satirlari
// ilerleme olarak yukari verilir (ses-uret -> @@ILERLEME).
//
// {calistir} enjekte edilebilir (testte sahte). VOXCPM_PYTHON .js ise node ile calistirilir (sarmalayici betik/test).
// ETIK: sesler yapaydir, gercek bir kisinin taklidi degildir; yayinda yapay zeka ile uretildigini belirt.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const ortak = require("./ortak.js");
const { trSayi } = require("./ses-metin.js");

const KAYNAK_REPO = "https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi";
const SESLER = ortak.VOXCPM_SES_DIZINI;
const SOZLUK = path.join(SESLER, "okunus_sozlugu.tsv");
const SATIR_MAKS = 2000;             // oku.py MAX_LINE_CHARS (motor metin butcesi)
const SATIR_SINIRI = 300;            // ~20-25 sn konusma: VoxCPM2 tek seferde ~30 sn ustunde kararsizlasir
const SATIR_SINIRI_CJK = 120;        // zh/ja: karakter basina konusma suresi daha uzun
const CJK = new Set(["zh", "ja", "ko"]);
const MP3 = ["-ar", "48000", "-ac", "1", "-b:a", "128k"];
const DENEME = Object.freeze({ denemeSayisi: 2, bekleme: [15000], maksKarakter: 4000 });

const METIN_COZUM = "VoxCPM rakam ve tırnak okumaz: sayıları yazıyla yaz (Türkçe ve İngilizce otomatik çevrilir), " +
  "çok uzun cümleleri böl. Ya da bu iş için ses motorunu 'otomatik'/'edge' yap.";

function hata(mesaj, secenek) {
  const e = new Error(mesaj);
  Object.assign(e, secenek || {});
  return e;
}
const dosyaMi = f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };
const dizinMi = f => { try { return fs.statSync(f).isDirectory(); } catch (e) { return false; } };
const jsonOku = f => JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
const rmGuvenli = y => { try { fs.rmSync(y, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { /* yoksay */ } };
const dilKodu = dil => String(dil || "en").toLowerCase().slice(0, 2);
const sonSatir = s => String(s || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).pop() || "";

// ---------------------------------------------------------------------------
// Kurulum
// ---------------------------------------------------------------------------
function kurulumCozumu() {
  return "VoxCPM2'yi kur (NVIDIA ekran kartı en az 4 GB, 64-bit Python 3.10–3.13; ~10 dk, ~3,7 GB indirme): " +
    "1) git clone " + KAYNAK_REPO + ".git C:\\voxcpm2  2) o klasörde: powershell -NoProfile -ExecutionPolicy Bypass " +
    "-File scripts\\kur.ps1 -Kok C:\\vox  (son satır KURULUM_OK olmalı; Mac: bash scripts/kur.sh)  3) bu projenin .env " +
    "dosyasına VOXCPM_KOK=C:\\voxcpm2 yaz (klonlanan deponun klasörü; kur.ps1'in -Kok klasörü DEĞİL). " +
    "Ayrıntı: sesler/voxcpm2/README.md · " + KAYNAK_REPO;
}

function pythonYolu(kok, env, platform) {
  const e = env || ortak.envOku;
  const ozel = String(e("VOXCPM_PYTHON") || "").trim();
  // goreli yol VoxCPM klasorune gore (surec o klasorde calisir; denetim ve calistirma ayni dosyaya baksin)
  const win = (platform || process.platform) === "win32";
  if (ozel) return (win ? path.win32 : path).isAbsolute(ozel) ? ozel : path.resolve(kok, ozel);
  return win
    ? path.join(kok, ".venv", "Scripts", "python.exe") : path.join(kok, ".venv", "bin", "python");
}

// oku.py ayarlari: SES_TASARIM_AYARLAR ortam degiskeni ya da <kok>/ayarlar.json (ses_tasarim/ayarlar.py ile ayni sira)
function ayarDosyasiBul(kok) {
  const ortamdaki = process.env.SES_TASARIM_AYARLAR;
  if (ortamdaki && dosyaMi(ortamdaki)) return path.resolve(ortamdaki);
  const f = path.join(kok, "ayarlar.json");
  return dosyaMi(f) ? f : null;
}
const ayarYolu = (ayarDosyasi, deger) => {
  const v = String(deger || "").trim();
  return v ? (path.isAbsolute(v) ? v : path.resolve(path.dirname(ayarDosyasi), v)) : "";
};

// -> {ok:true, kok, python, ayarDosyasi, ayar} | {ok:false, neden}
function kurulumDenetle(env) {
  const e = env || ortak.envOku;
  const kokHam = String(e("VOXCPM_KOK") || "").trim();
  if (!kokHam) return { ok: false, neden: "VOXCPM_KOK tanımlı değil (VoxCPM2 kurulu değil ya da yolu .env'e yazılmamış)" };
  const kok = path.resolve(kokHam);
  if (!dizinMi(kok)) return { ok: false, neden: "VOXCPM_KOK klasörü bulunamadı: " + kok };
  if (!dosyaMi(path.join(kok, "ses_tasarim", "oku.py")))
    return { ok: false, neden: "VOXCPM_KOK bir voxcpm2-turkce-ses-tasarimi klasörü değil (ses_tasarim/oku.py yok): " + kok };
  const python = pythonYolu(kok, e);
  if (!dosyaMi(python)) return { ok: false, neden: "VoxCPM Python ortamı yok: " + python + " (kur.ps1'in 'python' adımı tamamlanmamış)" };
  const ayarDosyasi = ayarDosyasiBul(kok);
  if (!ayarDosyasi) return { ok: false, neden: "VoxCPM ayar dosyası yok: " + path.join(kok, "ayarlar.json") + " (kur.ps1'in 'ayar' adımı tamamlanmamış)" };
  let ayar;
  try { ayar = jsonOku(ayarDosyasi); } catch (err) { return { ok: false, neden: "VoxCPM ayar dosyası okunamadı: " + ayarDosyasi }; }
  if (!ayar || typeof ayar !== "object") return { ok: false, neden: "VoxCPM ayar dosyası geçersiz: " + ayarDosyasi };
  for (const [alan, ad] of [["motor", "motoru (audiocpp_cli)"], ["model", "modeli (voxcpm2-q8_0.gguf)"]]) {
    const yol = ayarYolu(ayarDosyasi, ayar[alan]);
    if (!yol || !dosyaMi(yol)) return { ok: false, neden: "VoxCPM " + ad + " bulunamadı: " + (yol || "ayarlar.json'da '" + alan + "' boş") + " (kur.ps1'i yeniden çalıştır)" };
  }
  // ses_tasarim/ayarlar.py ile ayni denetim: CUDA arka ucunda cudart64_12.dll cuda_bin'de olmali
  if ((ayar.backend || "cuda") === "cuda") {
    const cuda = ayarYolu(ayarDosyasi, ayar.cuda_bin);
    if (!cuda || !dosyaMi(path.join(cuda, "cudart64_12.dll")))
      return { ok: false, neden: "VoxCPM CUDA dosyaları yok: " + (cuda || "ayarlar.json'da 'cuda_bin' boş") + " içinde cudart64_12.dll (kur.ps1'in 'cuda' adımı)" };
  }
  if (!dizinMi(SESLER)) return { ok: false, neden: "sesler/voxcpm2 klasörü yok (projeyi yeniden indir)" };
  return { ok: true, kok, python, ayarDosyasi, ayar };
}

// ---------------------------------------------------------------------------
// Sesler
// ---------------------------------------------------------------------------
function hazirSesAdlari() {
  try {
    return fs.readdirSync(SESLER, { withFileTypes: true })
      .filter(d => d.isDirectory() && dosyaMi(path.join(SESLER, d.name, "ses.json"))).map(d => d.name).sort();
  } catch (e) { return []; }
}

// Hazir seslerin listesi (seslendir.js --liste-sesler, testler)
function sesleriListele() {
  const liste = [];
  for (const ad of hazirSesAdlari()) {
    let kart;
    try { kart = jsonOku(path.join(SESLER, ad, "ses.json")); } catch (e) { continue; }
    const dil = String(kart.dil || "tr").toLowerCase();
    liste.push({
      ad, kimlik: "voxcpm:" + ad, dil, gorunenAd: kart.gorunen_ad || ad,
      tarifTr: kart.tanitim_tr || "", tarifEn: kart.tanitim_en || "", yapay: kart.yapay === true,
      varsayilan: ortak.VOXCPM_VARSAYILAN[dil] === ad,
      klasor: path.join(SESLER, ad), ornek: path.join(SESLER, ad, kart.ornek_okuma || "ornek_okuma.mp3"),
    });
  }
  return liste;
}

// Ses adi (kimlik) dogrulanmadan: "voxcpm:<ad>" ya da dilin varsayilani. Bilinmeyen dilde null.
function kimlikBul(ses, dil) {
  const s = String(ses || "").trim();
  if (ortak.voxcpmSesiMi(s)) return s;
  const ad = ortak.VOXCPM_VARSAYILAN[dilKodu(dil)];
  return ad ? "voxcpm:" + ad : null;
}

// Kullanicinin VoxCPM klasorunde tasarladigi seslerin yeri (ayarlar.json "sesler", varsayilan "sesler")
function tasarlananSesler(kurulum) {
  const k = kurulum || {};
  if (!k.kok) return null;
  return (k.ayarDosyasi && ayarYolu(k.ayarDosyasi, (k.ayar && k.ayar.sesler) || "sesler")) || path.join(k.kok, "sesler");
}

// -> {ad, kimlik, klasor, kart, sesDili}  (kalici hata: bilinmeyen/gecersiz ses)
function sesCoz(ses, dil, kurulum) {
  const d = dilKodu(dil);
  const kimlik = kimlikBul(ses, d);
  const liste = () => "Hazır sesler: " + hazirSesAdlari().map(a => "voxcpm:" + a).join(", ") + ". Liste: node seslendir.js --liste-sesler";
  if (!kimlik) throw hata("VoxCPM için '" + d + "' dilinde hazır ses yok", { kalici: true,
    cozum: "Bir ses seç: --ses voxcpm:<ad> (hazır sesler tr, en, de, es, fr, ja, ru, zh dillerinde). " + liste() });
  const m = ortak.VOXCPM_SES_ADI.exec(kimlik);
  if (!m) throw hata("Geçersiz VoxCPM ses adı: '" + kimlik + "' (örnek: voxcpm:tok_anlatici)", { kalici: true, cozum: liste() });
  let klasor;
  if (m[2]) {
    const yer = tasarlananSesler(kurulum);
    if (!yer) throw hata("'" + kimlik + "' tasarlanmış bir VoxCPM sesi; VOXCPM_KOK gerekli", { kalici: true, cozum: kurulumCozumu() });
    klasor = path.join(yer, m[1], "cesit_" + m[2].padStart(2, "0"));
  } else klasor = path.join(SESLER, m[1]);
  let kart;
  try { kart = jsonOku(path.join(klasor, "ses.json")); }
  catch (e) { throw hata("VoxCPM sesi bulunamadı: " + kimlik + (m[2] ? " (" + klasor + ")" : ""), { kalici: true, cozum: liste() }); }
  return { ad: m[2] ? m[1] + "/" + m[2] : m[1], kimlik, klasor, kart, sesDili: String(kart.dil || "tr").toLowerCase() };
}

// ---------------------------------------------------------------------------
// Ingilizce sayi okuma (oku.py rakami reddeder; Edge rakami kendisi okur, VoxCPM okuyamaz)
// ---------------------------------------------------------------------------
const EN_1 = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_10 = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_OLCEK = ["", " thousand", " million", " billion", " trillion", " quadrillion"];
const EN_SIRA = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };

const en99 = n => (n < 20 ? EN_1[n] : EN_10[Math.floor(n / 10)] + (n % 10 ? "-" + EN_1[n % 10] : ""));
function en999(n) {
  const y = Math.floor(n / 100), k = n % 100;
  return (y ? EN_1[y] + " hundred" : "") + (y && k ? " " : "") + (k || !y ? en99(k) : "");
}
// "1250" -> "one thousand two hundred fifty"; 18 haneden uzunsa null
function enSayi(rakamlar) {
  const s = String(rakamlar).replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(s) || s.length > 18) return null;
  if (s === "0") return "zero";
  const gruplar = [];
  for (let i = s.length; i > 0; i -= 3) gruplar.unshift(Number(s.slice(Math.max(0, i - 3), i)));
  const cikti = [];
  gruplar.forEach((g, i) => { if (g) cikti.push(en999(g) + EN_OLCEK[gruplar.length - 1 - i]); });
  return cikti.join(" ");
}
// Yil okunusu (1100-1999, 2010-2099): 1969 -> "nineteen sixty-nine", 1905 -> "nineteen oh five", 2026 -> "twenty twenty-six"
function enYil(n) {
  const ust = Math.floor(n / 100), alt = n % 100;
  if (alt === 0) return en99(ust) + " hundred";
  return en99(ust) + " " + (alt < 10 ? "oh " + EN_1[alt] : en99(alt));
}
const yilMi = n => (n >= 1100 && n <= 1999) || (n >= 2010 && n <= 2099);
// "21" -> "twenty-first"
function enSira(rakamlar) {
  const k = enSayi(rakamlar);
  return k && k.replace(/([a-z]+)$/, w => EN_SIRA[w] || (w.endsWith("y") ? w.slice(0, -1) + "ieth" : w + "th"));
}
const enCogul = k => k.replace(/([a-z]+)$/, w => (w.endsWith("y") ? w.slice(0, -1) + "ies" : w + "s"));
const rakamRakam = (s, okuyucu) => s.split("").map(c => okuyucu(c)).join(" ");

function enTamsayi(s) {
  if (/^0\d/.test(s)) return rakamRakam(s, enSayi);                     // 007, 0212: kod/numara
  const n = Number(s);
  if (s.length === 4 && yilMi(n)) return enYil(n);
  return enSayi(s) || rakamRakam(s, enSayi);
}

function enRakamlar(m) {
  const B = "(?<![\\p{L}\\p{N}])", S = "(?![\\p{L}\\p{N}])";
  // on yillar: 1980s -> nineteen eighties, 90s -> nineties
  m = m.replace(new RegExp(B + "(\\d{1,3}0)s" + S, "gu"), (t, s) => {
    const n = Number(s);
    return enCogul(s.length === 4 && yilMi(n) ? enYil(n) : (enSayi(s) || s));
  });
  // sira: 1st 2nd 3rd 21st 100th
  m = m.replace(new RegExp(B + "(\\d{1,15})(st|nd|rd|th)" + S, "giu"), (t, s) => enSira(s) || t);
  // saat: 10:30 -> ten thirty, 9:05 -> nine oh five, 7:00 -> seven o'clock
  m = m.replace(/(?<![\p{N}:])([01]?\d|2[0-3]):([0-5]\d)(?![\p{N}:])/gu, (t, h, dk) =>
    enSayi(h) + (dk === "00" ? " o'clock" : dk[0] === "0" ? " oh " + EN_1[Number(dk[1])] : " " + en99(Number(dk))));
  m = m.replace(/(\d):(?=\d)/g, "$1 ");                 // saat olmayan "3:1" oran: iki nokta okunmaz (cumle duragi olmasin)
  // binlik virgullu ve ondalikli sayilar: 1,250,000.75 -> ... point seven five
  m = m.replace(/(?<![\p{N}.,])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![\p{N}]|[.,]\d)/gu, (t, tam, kesir) => {
    const tamK = tam.includes(",") ? (enSayi(tam.replace(/,/g, "")) || rakamRakam(tam.replace(/,/g, ""), enSayi)) : enTamsayi(tam);
    return " " + tamK + (kesir !== undefined ? " point " + rakamRakam(kesir, enSayi) : "") + " ";
  });
  // kalan rakam dizileri (surum 1.2.3, oran 3:1): ayraclar okunur, yoksa "one. two. three" cumleye bolunurdu
  m = m.replace(/(\d)\.(?=\d)/g, "$1 point ").replace(/(\d),(?=\d)/g, "$1, ");
  return m.replace(/\d+/g, s => " " + (enSayi(s) || rakamRakam(s, enSayi)) + " ");
}

// Turkce: rakamlarin cogunu metniHazirla zaten cevirdi; kalanlar (MP3, 4K, 1.2.3, 18 haneden uzun) burada
function trRakamlar(m) {
  m = m.replace(/(\d)\.(?=\d)/g, "$1 nokta ").replace(/(\d),(?=\d)/g, "$1 virgül ").replace(/(\d):(?=\d)/g, "$1 ");
  return m.replace(/\d+/g, s => " " + (/^0\d/.test(s) || s.length > 18 ? rakamRakam(s, trSayi) : trSayi(s)) + " ");
}

// Tam genislikli / Arap-Hint rakamlari ASCII'ye (Python'un \d'si bunlari da rakam sayar ve reddeder)
const asciiRakam = m => m.replace(/[\uFF10-\uFF19\u0660-\u0669\u06F0-\u06F9]/g, c => {
  const k = c.charCodeAt(0);
  return String(k - (k >= 0xFF10 ? 0xFF10 : k >= 0x06F0 ? 0x06F0 : 0x0660));
});

// ---------------------------------------------------------------------------
// Turkce okunus sozlugu (sesler/voxcpm2/okunus_sozlugu.tsv: yazilis<TAB>okunus, tam kelime, buyuk/kucuk fark etmez)
// ---------------------------------------------------------------------------
let _sozluk = null;
function sozlukKurallari(dosya) {
  if (!dosya && _sozluk) return _sozluk;
  const kurallar = [];
  let metin = "";
  try { metin = fs.readFileSync(dosya || SOZLUK, "utf8").replace(/^\uFEFF/, ""); } catch (e) { /* sozluk yoksa kural yok */ }
  for (const ham of metin.split(/\r?\n/)) {
    const l = ham.trim();
    if (!l || l.startsWith("#") || !l.includes("\t")) continue;
    const [yazilis, okunus] = l.split("\t").map(x => x.trim());
    if (yazilis && okunus) kurallar.push([yazilis, okunus]);
  }
  kurallar.sort((a, b) => b[0].length - a[0].length);
  const derli = kurallar.map(([y, o]) => [new RegExp("(?<![\\p{L}\\p{N}_])" + y.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + "(?![\\p{L}\\p{N}_])", "giu"), o]);
  if (!dosya) _sozluk = derli;
  return derli;
}
const sozlukUygula = (m, kurallar) => kurallar.reduce((t, [re, o]) => t.replace(re, () => o), m);

// ---------------------------------------------------------------------------
// Metni oku.py kurallarina hazirla: -> {metin ("satir\nsatir"), satirlar, sorunlar[]}
// ---------------------------------------------------------------------------
const GIZLI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B\u2060\uFEFF]/g;
const TIRNAK_TR = /["“”„«»‘’‚‹›`´']/g;               // oku.py QUOTE_MARKS: Turkcede kesme isareti de okunmaz
const TIRNAK_YABANCI = /["“”„«»‹›]/g;                 // diger dillerde kesme isareti kalir (l'eau, don't)
const OKUNMAZ_TR = /["“”„«»‘’‚‹›`´'\p{Nd}]/u;         // oku.py UNSPOKEN
const OKUNMAZ_YABANCI = /["“”„`´\p{Nd}]/u;            // oku.py UNSPOKEN_FOREIGN

function bolNoktasi(p, sinir) {
  for (let i = Math.min(p.length, sinir) - 1; i >= Math.floor(sinir * 0.3); i--) if (/[,;:，、；：]/.test(p[i])) return i + 1;
  const b = p.lastIndexOf(" ", sinir);
  return b >= sinir * 0.3 ? b : sinir;
}
function uzunCumleyiBol(c, sinir) {
  const parcalar = [];
  let kalan = c;
  while (kalan.length > sinir) {
    const k = bolNoktasi(kalan, sinir);
    parcalar.push(kalan.slice(0, k).trim());
    kalan = kalan.slice(k).trim();
  }
  if (kalan) parcalar.push(kalan);
  return parcalar.filter(Boolean);
}

function metinHazirla(metin, dil, secenek) {
  const d = dilKodu(dil);
  const tr = d === "tr";
  const sinir = (secenek && secenek.satirSiniri) || (CJK.has(d) ? SATIR_SINIRI_CJK : SATIR_SINIRI);
  let m = String(metin == null ? "" : metin).replace(/\r\n?/g, "\n").replace(GIZLI, "");
  m = m.replace(/\|/g, " ");                                                // "||" oku.py'de durak isaretidir
  m = m.replace(/\s*[([{]\s*/g, ", ").replace(/\s*[)\]}]\s*/g, ", ");       // parantez = ses tarifi siniri
  m = asciiRakam(m);
  if (tr) {
    m = sozlukUygula(m, sozlukKurallari(secenek && secenek.sozluk));
    m = m.replace(TIRNAK_TR, "");
    m = trRakamlar(m);
  } else {
    m = m.replace(/[`´]/g, "'").replace(TIRNAK_YABANCI, "");
    if (d === "en") m = enRakamlar(m);
  }
  // bosluk ve noktalama duzeltmesi: ", ," -> ","  " ." -> "."  satir basinda virgul yok
  m = m.replace(/\s+/g, " ").replace(/\s+([,.;:!?…。！？，、])/g, "$1")
       .replace(/,(?:\s*,)+/g, ",").replace(/,\s*([.!?…])/g, "$1").replace(/^[\s,;:]+/, "").trim();

  // cumle sonu: . ! ? (ardindan bosluk); uc nokta yalniz ardindan kucuk harf GELMIYORSA ("Hişt... yaklaş" tek cumle)
  const cumleler = m.split(CJK.has(d) ? /(?<=[。！？])\s*|(?<=[.!?…])\s+/u
    : /(?<=(?<!\.)\.["'”’)\]]*|[!?]["'”’)\]]*)\s+|(?<=(?:\.\.|…)["'”’)\]]*)\s+(?!\p{Ll})/u)
    .map(s => s.replace(/^[\s,;:]+/, "").replace(/[\s,;:]+$/, "").trim()).filter(s => /[\p{L}\p{N}]/u.test(s));
  const satirlar = [];
  for (const c of cumleler) {
    const parcalar = uzunCumleyiBol(c, sinir);
    parcalar.forEach((p, i) => satirlar.push(i < parcalar.length - 1 ? p.replace(/[\s,;:，、；：]+$/, "") + " || bagli" : p));
  }

  const sorunlar = [];
  const okunmaz = tr ? OKUNMAZ_TR : OKUNMAZ_YABANCI;
  const kalan = Array.from(new Set((satirlar.join("\n").match(new RegExp(okunmaz.source, "gu")) || [])));
  if (kalan.length) sorunlar.push(kalan.some(c => /\p{Nd}/u.test(c))
    ? "VoxCPM '" + d + "' dilinde rakam okuyamaz (" + kalan.join(" ") + "); sayıları yazıyla yaz"
    : "okunamayan işaret: " + kalan.join(" "));
  for (const s of satirlar) if (s.length > SATIR_MAKS) { sorunlar.push("cümle çok uzun (" + s.length + " karakter); böl"); break; }
  if (!satirlar.length) sorunlar.push("okunacak metin kalmadı");
  return { metin: satirlar.join("\n"), satirlar, sorunlar };
}

// Tahmini konusma suresi (sn) ve buna gore zaman asimi: model yukleme + ilk referans kodlama (~50 sn) + yavas kart payi
function tahminiSn(metin, dil) {
  const n = String(metin || "").replace(/\s+/g, " ").length;
  return n / (CJK.has(dilKodu(dil)) ? 5 : 14);
}
function zamanAsimiHesapla(metin, dil) {
  return Math.round(Math.min(90 * 60000, Math.max(5 * 60000, 240000 + tahminiSn(metin, dil) * 12000)));
}

// ---------------------------------------------------------------------------
// Komut ve calistirma
// ---------------------------------------------------------------------------
function komutKur(o) {
  const argv = ["-m", "ses_tasarim.oku", "--ses", path.resolve(o.sesKlasoru), "--metin", "@" + path.resolve(o.metinDosyasi),
    "--cikti", path.resolve(o.ciktiDizin)];
  if (o.dil) argv.push("--dil", dilKodu(o.dil));
  return { komut: o.python, argv, cwd: o.kok };
}

function cocukOrtami() {
  // Windows'ta Python'un konsol kodlamasi cp125x olabilir: Turkce hata mesaji yazarken cokmesin
  return Object.assign({}, process.env, { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONUNBUFFERED: "1" });
}

// surec agacini oldur (python + audiocpp_cli torunu GPU'yu tutmasin): Windows taskkill /T /F, digerlerinde surec grubu
function agaciOldur(c, senkron) {
  if (!c || !c.pid || c.exitCode !== null) return;
  if (process.platform === "win32") {
    const argv = ["/PID", String(c.pid), "/T", "/F"];
    try {
      if (senkron) execFileSync("taskkill", argv, { windowsHide: true, stdio: "ignore", timeout: 10000 });
      else spawn("taskkill", argv, { windowsHide: true, stdio: "ignore" }).on("error", () => { try { c.kill(); } catch (e) { /* yoksay */ } });
    } catch (e) { try { c.kill(); } catch (e2) { /* yoksay */ } }
    return;
  }
  try { process.kill(-c.pid, senkron ? "SIGKILL" : "SIGTERM"); } catch (e) { try { c.kill("SIGKILL"); } catch (e2) { /* yoksay */ } }
  if (!senkron) {
    const t = setTimeout(() => { try { process.kill(-c.pid, "SIGKILL"); } catch (e) { /* bitmis */ } }, 5000);
    if (t.unref) t.unref();
  }
}

// Calisan cocuklar ve tutulan GPU kilidi: betik Ctrl+C / process.exit ile kapanirsa da birakilsin
const _cocuklar = new Set(), _kilitler = new Set();
let _kancaKuruldu = false;
function cikisKancasi() {
  if (_kancaKuruldu) return;
  _kancaKuruldu = true;
  process.on("exit", () => {
    for (const c of _cocuklar) agaciOldur(c, true);
    for (const birak of _kilitler) { try { birak(); } catch (e) { /* yoksay */ } }
  });
  // Ctrl+C / panelden Durdur: Mac/Linux'ta cocuk ayri surec grubunda (detached) oldugu icin sinyal ona kendiliginden
  // GITMEZ; varsayilan sinyal davranisinda "exit" olayi da calismaz -> python + motor GPU'yu tutan yetim kalirdi.
  // Baska dinleyici varsa (ortak.kilitAl kancasi) cikis karari onundur; yoksa varsayilan gibi kapanilir.
  for (const [sig, kod] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]]) {
    try {
      process.on(sig, () => {
        for (const c of _cocuklar) agaciOldur(c, true);
        if (process.listenerCount(sig) <= 1) process.exit(kod);
      });
    } catch (e) { /* bu platformda desteklenmeyen sinyal */ }
  }
}

// Varsayilan calistirici: {komut, argv, cwd, env, zamanAsimiMs, sinyal, satir(l)} -> {kod, stdout, stderr}
function varsayilanCalistir(o) {
  return new Promise((coz, red) => {
    let komut = o.komut, argv = o.argv;
    if (/\.(?:js|cjs|mjs)$/i.test(komut)) { argv = [komut].concat(argv); komut = process.execPath; }
    let c;
    try {
      c = spawn(komut, argv, { cwd: o.cwd, env: o.env || cocukOrtami(), windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    } catch (e) {
      // ornegin Windows'ta .bat/.cmd kabuksuz calistirilamaz (EINVAL): yapilandirma hatasi, tekrar denemek anlamsiz
      return red(hata("VoxCPM Python'u çalıştırılamadı: " + o.komut + " (" + (e && e.code || e && e.message) + ")", { kalici: true,
        cozum: "VOXCPM_PYTHON bir python.exe yolu olmalı (.bat/.cmd değil) ya da boş bırakılmalı. " + kurulumCozumu() }));
    }
    cikisKancasi();
    _cocuklar.add(c);
    let stdout = "", stderr = "", tampon = "", bitti = false, kapandi = false;
    const satirIsle = l => { if (o.satir && l.trim()) { try { o.satir(l); } catch (e) { /* yoksay */ } } };
    function bitir(e, deger) {
      if (bitti) return;
      bitti = true;
      clearTimeout(zaman);
      if (o.sinyal) o.sinyal.removeEventListener("abort", iptal);
      if (!e) return coz(deger);
      if (kapandi || !c.pid) return red(e);
      // zaman asimi / iptal: agaci oldur ve KAPANMASINI bekle (en cok 15 sn). Hemen donulseydi cagiran GPU kilidini
      // birakir ve calisma klasorunu silmeye calisirdi; motor hala kartta ve dosyalari kilitliyken (Windows).
      agaciOldur(c);
      const t = setTimeout(() => red(e), 15000);
      c.once("close", () => { clearTimeout(t); red(e); });
    }
    const zaman = setTimeout(() => bitir(hata("VoxCPM zaman aşımı (" + Math.round((o.zamanAsimiMs || 0) / 1000) + " sn)")), o.zamanAsimiMs || 30 * 60000);
    function iptal() { bitir((o.sinyal && o.sinyal.reason) || hata("iptal edildi")); }
    c.stdout.setEncoding("utf8");
    c.stderr.setEncoding("utf8");
    c.stdout.on("data", d => {
      stdout = (stdout + d).slice(-20000);
      const parca = (tampon + d).split(/\r?\n|\r/);
      tampon = parca.pop();
      parca.forEach(satirIsle);
    });
    c.stderr.on("data", d => { stderr = (stderr + d).slice(-20000); });
    c.on("error", e => {
      _cocuklar.delete(c);
      if (!c.pid) kapandi = true;                       // hic baslamadi (ENOENT vb.): beklenecek surec yok
      bitir(e && e.code === "ENOENT" ? hata("VoxCPM Python'u çalıştırılamadı: " + o.komut, { kalici: true, cozum: kurulumCozumu() }) : e);
    });
    c.on("close", kod => {
      _cocuklar.delete(c);
      kapandi = true;
      if (tampon) satirIsle(tampon);
      bitir(null, { kod, stdout, stderr });
    });
    // iptal dinleyicisi EN SON: once error/close kancalari kurulsun (zaten iptal edilmisse sonradan gelen 'error' yakalanir)
    if (o.sinyal) {
      if (o.sinyal.aborted) iptal();
      else o.sinyal.addEventListener("abort", iptal, { once: true });
    }
  });
}

// oku.py basarisiz cikti: ne oldugunu soyleyen hata (kalici = tekrar denemek anlamsiz; tekrarsiz = yalniz bu paragraf)
function cikisHatasi(r) {
  const tum = String((r && r.stderr) || "") + "\n" + String((r && r.stdout) || "");
  const son = sonSatir(r && r.stderr) || sonSatir(r && r.stdout) || "çıkış kodu " + (r && r.kod);
  if (/AyarHatasi|ayar dosyası yok|motor bulunamadı|model bulunamadı|cudart64_12\.dll yok/.test(tum))
    return hata("VoxCPM kurulumu eksik: " + son, { kalici: true, cozum: kurulumCozumu() });
  if (/ModuleNotFoundError|No module named/.test(tum))
    return hata("VoxCPM Python paketleri eksik: " + son, { kalici: true,
      cozum: "VoxCPM klasöründe: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\kur.ps1 -Kok C:\\vox -Adim python,ayar,kontrol" });
  if (/okunamayan işaret|ValueError: metin|satırı böl|bilinmeyen durak|dil kodu tanınmadı/.test(tum))
    return hata("VoxCPM metni reddetti: " + son, { kalici: true, cozum: METIN_COZUM });
  if (/ses bulunamadı/.test(tum)) return hata("VoxCPM sesi bulunamadı: " + son, { kalici: true });
  if (/düzgün bitmedi|EOS yok|CapacityError/.test(tum))
    return hata("VoxCPM bazı cümleleri bitiremedi: " + son, { tekrarsiz: true,
      cozum: "Bu paragraftaki uzun cümleleri böl, sayıları yazıyla yaz ve seslendirmeyi yeniden çalıştır (biten paragraflar yeniden üretilmez)." });
  if (/GGML_ASSERT|mem_buffer|out of memory|cudaMalloc|CUDA error/i.test(tum))
    return hata("VoxCPM ekran kartı belleği yetmedi ya da kart başka işte: " + son, { beklemeMs: 15000 });
  return hata("VoxCPM hata verdi (kod " + (r && r.kod) + "): " + son);
}

// ---------------------------------------------------------------------------
// Tek GPU isi kilidi (makine geneli). -> birak()
// ---------------------------------------------------------------------------
const KILIT_DOSYASI = () => path.join(os.tmpdir(), "otopilot-voxcpm-gpu.kilit");
// Kilit tek bir oku.py cagrisi boyunca tutulur: en cok 90 dk zaman asimi + ffmpeg donusumu. Daha eski kilit sahipsizdir
// (surec cokmus, PID baska programa gecmis olabilir); eskiden 12 sa beklenebiliyordu.
const KILIT_BAYAT_MS = 2 * 3600000;
const _jetonlar = new Set();                     // bu surecin SU AN tuttugu kilitler (ayni surecte ust uste binme)
async function gpuKilidiAl(o) {
  const s = o || {};
  const dosya = s.dosya || KILIT_DOSYASI();
  const bekle = s.bekle || (ms => new Promise(r => setTimeout(r, ms)));
  let bildirildi = false, yazilamadi = 0, dogrulanan = null;
  for (;;) {
    if (s.sinyal && s.sinyal.aborted) throw s.sinyal.reason || hata("iptal edildi");
    const jeton = process.pid + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    try {
      fs.writeFileSync(dosya, JSON.stringify({ pid: process.pid, zaman: Date.now(), baslangic: new Date().toISOString(), jeton }), { flag: "wx" });
      _jetonlar.add(jeton);
      // yalniz KENDI jetonunu siler: zaman asiminda eski deneme gec bitse de yeni denemenin kilidini silmez
      const birak = () => {
        _kilitler.delete(birak);
        _jetonlar.delete(jeton);
        try { if (jsonOku(dosya).jeton === jeton) fs.unlinkSync(dosya); } catch (e) { /* yoksay */ }
      };
      cikisKancasi();
      _kilitler.add(birak);
      return birak;
    } catch (e) {
      // Windows: silinmekte olan dosya kisa bir an acilamaz (EPERM/EBUSY): biraz bekleyip yeniden dene
      if ((e.code === "EPERM" || e.code === "EBUSY" || e.code === "EACCES") && ++yazilamadi <= 10) { await bekle(200); continue; }
      if (e.code !== "EEXIST") return () => {};                 // gecici klasore yazilamiyor: kilitsiz devam
    }
    let ham = null, k = null, yas = 0;
    try { ham = fs.readFileSync(dosya, "utf8"); k = JSON.parse(ham.replace(/^\uFEFF/, "")); } catch (e) { k = null; }
    if (!k || typeof k !== "object") {
      try { yas = Date.now() - fs.statSync(dosya).mtimeMs; } catch (e2) { continue; }     // dosya bu arada gitti: yeniden dene
    }
    let bayat;
    if (!k || typeof k !== "object") bayat = yas > 10000;            // yarim yazilmis olabilir: kisa sure bekle
    else if (!(Date.now() - Number(k.zaman || 0) <= KILIT_BAYAT_MS)) bayat = true;
    else if (k.pid === process.pid) bayat = !_jetonlar.has(k.jeton);    // ayni surec: yalniz hala tutulan jeton gecerli
    else if (!ortak.pidCanliMi(k.pid)) bayat = true;
    else if (dogrulanan === ham) bayat = false;
    else {
      // PID canli ama gercekten bir Otopilot (node) sureci mi? (Windows PID'leri hizla baska programa verilir)
      bayat = !ortak.kilitSahibiCanliMi({ pid: k.pid, baslangic: k.baslangic });
      if (!bayat) dogrulanan = ham;
    }
    if (bayat) {
      try { if (fs.readFileSync(dosya, "utf8") === ham || ham === null) fs.unlinkSync(dosya); } catch (e) { /* baskasi aldi */ }
      continue;
    }
    if (!bildirildi && s.log) { s.log("VoxCPM: ekran kartı başka bir seslendirmede (süreç " + k.pid + "); sıra bekleniyor…"); bildirildi = true; }
    await bekle(s.aralikMs || 3000);
  }
}

// ---------------------------------------------------------------------------
// ozet.json cumle zamanlarindan yaklasik kelime zamanlari (ms; atempo ile olceklenir)
// ---------------------------------------------------------------------------
function kelimeZamanlari(ozet, tempo) {
  const t = tempo > 0 ? tempo : 1;
  const satirlar = ozet && Array.isArray(ozet.satirlar) ? ozet.satirlar : [];
  const kelimeler = [];
  for (const s of satirlar) {
    const t0 = Number(s && s.t0), t1 = Number(s && s.t1);
    if (!(Number.isFinite(t0) && t1 > t0)) continue;
    const ws = String(s.metin || "").split(/\s+/).filter(Boolean);
    const toplam = ws.reduce((a, w) => a + w.length, 0) || 1;
    let birikim = 0;
    for (const w of ws) {
      const bas = t0 + (t1 - t0) * birikim / toplam;
      birikim += w.length;
      const bit = t0 + (t1 - t0) * birikim / toplam;
      kelimeler.push({ t: Math.round(bas * 1000 / t), d: Math.max(1, Math.round((bit - bas) * 1000 / t)), w });
    }
  }
  return kelimeler;
}

function tempoBul(hiz) {
  const m = /^([+-]\d{1,2})%$/.exec(String(hiz || ""));
  return Math.min(2, Math.max(0.5, 1 + (m ? Number(m[1]) / 100 : 0)));
}

// Onceki kosulardan kalan calisma klasorleri (surec zorla kapatildiysa finally calismaz; her biri referans WAV'i ve motor
// ciktilarini tutar): YALNIZ bizim adlandirmamiza uyan, sahibi olu ve 10 dk'dan eski klasorler silinir.
const CALISMA_ADI = /^otopilot-(\d+)-(\d+)-[a-z0-9]+$/;
function eskiCalismaTemizle(taban) {
  let adlar = [];
  try { adlar = fs.readdirSync(taban); } catch (e) { return; }
  for (const ad of adlar) {
    const m = CALISMA_ADI.exec(ad);
    if (!m || Number(m[1]) === process.pid) continue;
    if (Date.now() - Number(m[2]) < 10 * 60000 || ortak.pidCanliMi(Number(m[1]))) continue;
    rmGuvenli(path.join(taban, ad));
  }
}

// Calisma klasoru: VoxCPM deposunun cikti/ klasoru (motor orada kendi yollariyla denendi; kisa yol); yazilamazsa ara klasor
function calismaDizini(kok, yedek) {
  eskiCalismaTemizle(path.join(kok, "cikti"));
  const ad = "otopilot-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  for (const taban of [path.join(kok, "cikti"), yedek, os.tmpdir()].filter(Boolean)) {
    const d = path.join(taban, ad);
    try { fs.mkdirSync(d, { recursive: true }); return d; } catch (e) { /* siradaki */ }
  }
  throw hata("VoxCPM çalışma klasörü açılamadı");
}

// ---------------------------------------------------------------------------
// Motor
//   olustur({ses, dil, hiz, env?, kurulum?, calistir?, ffmpeg?, kilitDosyasi?, kilitAralikMs?, log?})
//   -> { ad, kelimeZamani, ses, sentez, metinDenetle, metinCozumu, denemeAyari, zamanAsimiHesapla, sifirla, kapat }
// ---------------------------------------------------------------------------
function olustur(ayar) {
  const a = ayar || {};
  const kurulum = a.kurulum || kurulumDenetle(a.env || ortak.envOku);
  if (!kurulum.ok) throw hata("VoxCPM kullanılamıyor: " + kurulum.neden, { kalici: true, cozum: kurulumCozumu() });
  const dil = dilKodu(a.dil);
  const ses = sesCoz(a.ses, dil, kurulum);
  const log = a.log || (() => {});
  if (ses.sesDili !== dil)
    log("Not: '" + ses.kimlik + "' sesi '" + ses.sesDili + "' dili için tasarlandı, metin '" + dil + "': vurgu farklı olabilir.");
  const calistir = a.calistir || varsayilanCalistir;
  const ffmpeg = a.ffmpeg || (() => require("../ff-yol.js").ffmpeg);
  const tempo = tempoBul(a.hiz);

  async function sentez(metin, secenek) {
    const s = secenek || {};
    const yaz = s.log || log;
    const hazir = metinHazirla(metin, dil);
    if (hazir.sorunlar.length) throw hata("VoxCPM metni okuyamaz: " + hazir.sorunlar.join("; "), { kalici: true, cozum: METIN_COZUM });
    if (s.sinyal && s.sinyal.aborted) throw s.sinyal.reason || hata("iptal edildi");
    const isDizini = calismaDizini(kurulum.kok, s.araDizin);
    const metinDosyasi = path.join(isDizini, "metin.txt"), cikti = path.join(isDizini, "cikti");
    let birak = () => {};
    try {
      fs.writeFileSync(metinDosyasi, hazir.metin + "\n", "utf8");
      // GPU sirasi beklenirken deneme saati durur; is baslayinca yeniden kurulur (ses-motor zamanAsimli)
      if (typeof s.sureyiDurdur === "function") s.sureyiDurdur();
      try { birak = await gpuKilidiAl({ dosya: a.kilitDosyasi, sinyal: s.sinyal, log: yaz, aralikMs: a.kilitAralikMs }); }
      finally { if (typeof s.sureyiBaslat === "function") s.sureyiBaslat(); }
      if (s.sinyal && s.sinyal.aborted) throw s.sinyal.reason || hata("iptal edildi");
      const k = komutKur({ python: kurulum.python, kok: kurulum.kok, sesKlasoru: ses.klasor, metinDosyasi, ciktiDizin: cikti, dil });
      let sonBiten = -1;
      const r = await calistir(Object.assign(k, {
        env: cocukOrtami(), zamanAsimiMs: s.zamanAsimiMs || zamanAsimiHesapla(hazir.metin, dil), sinyal: s.sinyal,
        satir: l => {
          const m = /^\s*(\d+)\/(\d+)\s+cümle/.exec(l);
          if (m) {
            const biten = Number(m[1]), toplam = Number(m[2]);
            if (s.ilerleme && toplam) s.ilerleme(Math.min(1, biten / toplam));
            if (biten !== sonBiten) { sonBiten = biten; yaz("  VoxCPM: " + biten + "/" + toplam + " cümle"); }
          } else if (/speed gate|hız kapısı/.test(l)) yaz("  VoxCPM: " + l.trim() + " (o satırları dinleyip kontrol et)");
        },
      }));
      if (!r || r.kod !== 0) throw cikisHatasi(r || {});
      const wav = path.join(cikti, "okuma.wav");
      let boyut = 0;
      try { boyut = fs.statSync(wav).size; } catch (e) { /* yok */ }
      if (boyut < 1000) throw hata("VoxCPM ses dosyası üretmedi (okuma.wav yok ya da boş)");
      let ozet = null;
      try { ozet = jsonOku(path.join(cikti, "ozet.json")); } catch (e) { /* kelime zamani olmadan devam */ }
      const mp3 = path.join(isDizini, "okuma.mp3");
      execFileSync(ffmpeg(), ["-y", "-hide_banner", "-loglevel", "error", "-i", wav,
        ...(tempo !== 1 ? ["-af", "atempo=" + tempo] : []), ...MP3, "-f", "mp3", mp3],
        { timeout: 180000, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
      return { buf: fs.readFileSync(mp3), kelimeler: kelimeZamanlari(ozet, tempo) };
    } finally {
      birak();
      rmGuvenli(isDizini);
    }
  }

  return {
    ad: "voxcpm", kelimeZamani: false, ses: ses.kimlik, sesDili: ses.sesDili,
    sentez,
    metinDenetle: metin => metinHazirla(metin, dil).sorunlar,
    metinCozumu: METIN_COZUM,
    denemeAyari: DENEME,
    zamanAsimiHesapla: metin => zamanAsimiHesapla(metinHazirla(metin, dil).metin, dil),
    sifirla: async () => {}, kapat: () => {},
  };
}

module.exports = {
  KAYNAK_REPO, SESLER, SATIR_SINIRI, SATIR_SINIRI_CJK, DENEME, METIN_COZUM,
  olustur, varsayilanCalistir, metinHazirla, komutKur, pythonYolu, kurulumDenetle, kurulumCozumu,
  sesCoz, kimlikBul, sesleriListele, hazirSesAdlari, kelimeZamanlari, tempoBul, enSayi, enYil, enSira,
  gpuKilidiAl, KILIT_BAYAT_MS, zamanAsimiHesapla, cikisHatasi, sozlukKurallari, eskiCalismaTemizle,
};
