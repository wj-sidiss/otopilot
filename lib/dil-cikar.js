// Arayuz metinlerini (Turkce kaynak) panel/uygulama dosyalarindan cikarir: diller/_kaynak.json
//   node lib/dil-cikar.js            -> diller/_kaynak.json + her dil icin eksik sayisi
// Calisma zamani cevirisi (panel-public/dil.js) METNIN KENDISIYLE eslesir: kaynak kodda sarmalayici gerekmez.
// Gecerli metin: bir dize ya da HTML metni; uzunlugu 2-300; kimlik/adres/CSS gibi gorunenler atilir. Fazladan metin zarar vermez
// (yalniz birebir eslesen metin cevrilir).
"use strict";
const fs = require("fs");
const path = require("path");

const KOK = path.join(__dirname, "..");
const KAYNAKLAR = ["panel-public", "video-indirici/public", "ai-infapp/public"];
const TR = /[çğıöşüÇĞİÖŞÜ]/;
const lsDir = (d, re) => { try { return fs.readdirSync(path.join(__dirname, "..", d)).filter(f => re.test(f)).map(f => d + "/" + f); } catch (e) { return []; } };
const SUNUCU_DOSYALARI = {
  "panel-public": ["panel.js"].concat(lsDir("lib", /^panel-.*\.js$/)),
};
// ekranda tek basina gorunen (durum etiketi, "Claude yok", "11 gorsel" gibi bilesik metinlerin parcalari) ama kodda
// kimlik gibi gorundugu icin otomatik secilmeyen Turkce sozcukler
const EK_METINLER = ["yok", "var", "dk", "sn", "saat", "gün", "önce", "sonra", "senaryo", "ses", "video", "görsel", "kredi", "bekliyor", "hazır", "bitti",
  "hata", "iptal", "tamam", "aktif", "pasif", "açık", "kapalı", "ücretli", "ücretsiz", "çalışıyor", "durdu", "yeni", "sil", "kaydet", "indir", "kopyala"];
const DILLER = ["en", "es", "de", "fr", "it", "pt", "ru", "nl", "pl", "ja", "ko", "ar", "hi", "zh"];

function aday(s, kume) {
  s = s.replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 300) return;
  if (!/\p{L}{2}/u.test(s)) return;
  if (/^[a-z0-9_.\-/#:?=&%@[\]()]+$/i.test(s) && !/\s/.test(s) && !TR.test(s) && !/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+$/.test(s)) return;
  if (/^(https?:|\/api|\.|#|data:|function|return|var |const |let )/.test(s)) return;
  if ((/[{}]/.test(s) && !/\{\}/.test(s)) || /;\s*$/.test(s)) return;
  if (/[a-z-]+:\s*[\w.#(-][^;]*;|^[a-z-]+:[\w.%#(-]+$/i.test(s)) return;                            // CSS bildirimi
  if (/^(?:notice|bad|ok|warn|info|ghost|tiny|danger|card|savebar|guessbox|warnbox|tag|kotu|choice)(?: (?:notice|bad|ok|warn|info|ghost|tiny|danger|card|savebar|guessbox|warnbox|tag|kotu|choice))*$/.test(s)) return;   // sinif listesi
  if (/^(?:use strict|image\/svg\+xml|Cannot access .* before initialization|type:'\w+')$/.test(s) || /^[-@]?\{\}/.test(s) && !/\p{L}{3}/u.test(s.replace(/\{\}/g, " "))) return;
  if (/<[a-z!/][^>]*>/i.test(s) || s.startsWith("/")) return;         // HTML sablonu / adres: metin dugumleri zaten ayri cevrilir
  if (/^["'<>)\]]/.test(s) || /(class=|data-[\w-]+=|href=|style=|<\/|\bid=)/.test(s)) return;      // sablon icindeki HTML kirintilari
  if (/\$\{/.test(s)) return;
  kume.add(s);
}

function dosyadan(yol, kume) {
  const t = fs.readFileSync(yol, "utf8");
  if (yol.endsWith(".html")) {
    t.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/>([^<>]+)</g, (m, x) => { aday(x, kume); return m; });
    t.replace(/\b(?:placeholder|title|aria-label|alt)="([^"]+)"/g, (m, x) => { aday(x, kume); return m; });
  } else {
    // "a " + "b" (satir sonlu da olabilir) birlesik dizeleri tek metin yap; sablon dizelerde ${...} yerlerinden bol
    // (parcalar ayri ceviri adayi olur: "11 gorsel" -> " gorsel")
    const dize = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
    const birlesik = /(["'])((?:\\.|(?!\1)[^\\\n])*)\1\s*\+\s*\1((?:\\.|(?!\1)[^\\\n])*)\1/g;
    let kaynak = t, onceki;
    // "Olcu " + n + " adi" -> "Olcu {} adi" (degisken araya girince yer tutucu); sonra bitisik dizeler birlesir
    const degisken = /(["'])((?:\\.|(?!\1)[^\\\n])*)\1\s*\+\s*[A-Za-z_$][\w$.()[\]]*\s*\+\s*\1((?:\\.|(?!\1)[^\\\n])*)\1/g;
    do { onceki = kaynak; kaynak = kaynak.replace(degisken, (m, q, x, y) => q + x + "{}" + y + q).replace(birlesik, (m, q, x, y) => q + x + y + q); } while (kaynak !== onceki);
    const temiz = x => x.replace(/\\n/g, " ").replace(/\\(["'`])/g, "$1");
    kaynak.replace(dize, (m, q, x) => {
      if (q === "`" && /\$\{/.test(x)) {
        // sayi iceren sablon: ${...} -> {} tam metin (calisma zamaninda sayilar yer tutucuya alinip aranir) + parcalar
        const tam = temiz(x.replace(/\$\{[^}]*\}/g, "{}"));
        if (/\{\}/.test(tam) && /\p{L}{3}/u.test(tam.replace(/\{\}/g, " "))) aday(tam, kume);
        for (const parca of x.split(/\$\{[^}]*\}/)) aday(temiz(parca), kume);
      }
      else aday(temiz(x), kume);
      return m;
    });
  }
}

// tek uygulama klasorunun (panel-public, video-indirici/public, ai-infapp/public) metinleri
function cikarDizin(d) {
  const kume = new Set();
  const dizin = path.join(KOK, d);
  if (fs.existsSync(dizin)) {
    for (const f of fs.readdirSync(dizin)) {
      if (/\.(js|html)$/.test(f) && f !== "dil.js") dosyadan(path.join(dizin, f), kume);
    }
  }
  // arayuzde gorunen SUNUCU metinleri (hata/cozum/durum mesajlari API ile gelir)
  for (const f of SUNUCU_DOSYALARI[d] || []) { const y = path.join(KOK, f); if (fs.existsSync(y)) dosyadan(y, kume); }
  for (const e of EK_METINLER) kume.add(e);
  return [...kume].sort();
}
function cikar() {
  const kume = new Set();
  for (const d of KAYNAKLAR) for (const s of cikarDizin(d)) kume.add(s);
  return [...kume].sort();
}

function eksikRaporu(kaynak) {
  const r = {};
  for (const k of DILLER) {
    let t = {};
    try { t = JSON.parse(fs.readFileSync(path.join(KOK, "diller", k + ".json"), "utf8")); } catch (e) { /* dosya yok */ }
    r[k] = kaynak.filter(s => !t[s]).length;
  }
  return r;
}

if (require.main === module) {
  const kaynak = cikar();
  fs.mkdirSync(path.join(KOK, "diller"), { recursive: true });
  fs.writeFileSync(path.join(KOK, "diller", "_kaynak.json"), JSON.stringify(kaynak, null, 1));
  console.log(kaynak.length + " metin → diller/_kaynak.json");
  const e = eksikRaporu(kaynak);
  for (const k of DILLER) console.log("  " + k + ": " + e[k] + " eksik");
}
module.exports = { cikar, cikarDizin, eksikRaporu, DILLER, KAYNAKLAR };
