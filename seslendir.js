// Seslendirme: senaryodan paragraf basina ses (mp3) + kelime/sure zamanlamasi uretir.
//
// Kullanim:
//   node seslendir.js <is> [ses] [hiz]            senaryoyu seslendir
//   node seslendir.js <is> --yeniden              guncel olsa bile bastan uret
//   node seslendir.js <is> --motor edge|azure|piper|voxcpm|otomatik
//   node seslendir.js <is> --ses voxcpm:tok_anlatici      VoxCPM2 hazir sesi (yerel GPU; sesler/voxcpm2/)
//   node seslendir.js --test <cikti.mp3> [--ses X] [--metin "..."] [--motor M]    5 sn ornek
//   node seslendir.js --liste-sesler                      VoxCPM2 sesleri + kurulum durumu, dile gore Edge sesleri
//
// Ses, hiz, dil ve okunus konu.json'dan okunur; komut satiri onu ezer ("ses": "tr-TR-AhmetNeural",
// "sesHizi": "+7%", "dil": "tr", "okunus": {"GPU": "G P U"}, "sesMotoru": "otomatik").
// Motorlar: edge (varsayilan, ucretsiz, RESMI DEGIL), azure (resmi, anahtar ister), piper (yerel),
// voxcpm (yerel ekran karti, VOXCPM_KOK ister; ses "voxcpm:<ad>", ad verilmezse dile gore varsayilan).
// "otomatik": Edge dener; paragraf dusurursa TUM is siradaki motorla bastan yapilir. Ses "voxcpm:<ad>" ise
// VoxCPM (kuruluysa) en bastadir; kurulu degilse Edge'e (dilin varsayilan sesi) dusulur.
//
// Girdi : uretim/<is>/Voice/SESLENDIRME-TAM-METIN.txt
// Cikti : Voice/parts/NNN.mp3, Voice/kelimeler.json, Voice/zamanlama.json   (ayrinti: lib/ses-uret.js)
// Cikis : 0 basari/atlandi · 2 girdi/yapilandirma · 3 dis servis · 4 paragraf dustu · 5 disk · 6 kilit
//
// NOT: Bu arac yapay (sentetik) ses uretir. YouTube'da gercekci sentetik ses/gorsel varsa
// Studio'daki "degistirilmis/sentetik icerik" kutusunu isaretlemek gerekir.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");
const { seslendir, ornekUret } = require("./lib/ses-uret.js");

// --liste-sesler: VoxCPM2 hazir sesleri (kurulum durumuyla) ve dile gore Edge varsayilanlari
function sesleriListele() {
  const V = require("./lib/ses-motor-voxcpm.js");
  const kurulum = V.kurulumDenetle(ortak.envOku);
  const sesler = V.sesleriListele();
  console.log("VoxCPM2 hazır sesleri (yerel ekran kartı, yapay sesler) — kullanım: --ses voxcpm:<ad>  ya da konu.json \"ses\"");
  console.log("  Kurulum: " + (kurulum.ok ? "hazır (" + kurulum.kok + ")" : "YOK — " + kurulum.neden));
  for (const s of sesler)
    console.log("  " + (s.kimlik + (s.varsayilan ? " *" : "")).padEnd(26) + s.dil.padEnd(4) + s.tarifTr.slice(0, 90));
  console.log("  (* = o dilin varsayılanı; örnek dinleme: sesler/voxcpm2/<ad>/ornek_okuma.mp3)");
  if (!kurulum.ok) console.log("  Kurmak için: " + V.kurulumCozumu());
  const edge = Object.fromEntries(["en", "tr", "es", "de", "fr", "it", "pt", "ru", "nl", "pl", "ja", "ko", "ar", "hi"].map(d => [d, ortak.varsayilanSes(d)]));
  console.log("Edge/Azure varsayılan sesleri (dile göre): " + Object.entries(edge).map(([d, s]) => d + " " + s).join(" · "));
  ortak.sonuc({
    voxcpm: { kurulu: kurulum.ok, neden: kurulum.ok ? null : kurulum.neden, kaynak: V.KAYNAK_REPO,
      sesler: sesler.map(s => ({ kimlik: s.kimlik, dil: s.dil, varsayilan: s.varsayilan, tarif: s.tarifTr,
        ornek: path.relative(ortak.KOK, s.ornek).split(path.sep).join("/") })) },
    edge,
  });
}

async function ana(argv) {
  const { konum, bayrak } = ortak.argumanCoz(argv, {
    deger: ["test", "ses", "metin", "motor", "hiz", "dil"], mantik: ["yeniden", "liste-sesler"],
  });

  if (bayrak["liste-sesler"]) { sesleriListele(); return; }

  // ---- 5 sn ornek ----
  if (bayrak.test !== undefined) {
    if (bayrak.test === true || !String(bayrak.test).trim())
      throw new ortak.OrtakHata("arguman", "--test için çıktı dosyası gerekli.", { cikis: 2, cozum: "Örnek: node seslendir.js --test ornek.mp3 --ses tr-TR-AhmetNeural" });
    const ayar = ortak.ayarOku();
    const r = await ornekUret({
      cikti: String(bayrak.test), ses: typeof bayrak.ses === "string" ? bayrak.ses : undefined,
      metin: typeof bayrak.metin === "string" ? bayrak.metin : undefined,
      motorSecimi: typeof bayrak.motor === "string" ? bayrak.motor : "otomatik",
      hiz: typeof bayrak.hiz === "string" ? bayrak.hiz : ayar.sesHizi,
      dil: typeof bayrak.dil === "string" ? bayrak.dil : undefined,
    });
    ortak.sonuc(r);
    return;
  }

  const is = konum[0];
  if (!is) throw new ortak.OrtakHata("arguman", "İş adı verilmedi.", { cikis: 2, cozum: "Kullanım: node seslendir.js <iş> [ses] [hız]" });
  const dizin = ortak.isDizin(is);                          // gecersiz ad -> OrtakHata (exit 2)
  if (!fs.existsSync(dizin))
    throw new ortak.OrtakHata("is_yok", "İş bulunamadı: " + is, { cikis: 2, cozum: "Önce panelden yeni iş aç (ya da node yeni-is.js)." });

  ortak.kilitAl(is, "seslendir");                           // ayni ise ikinci kosu: exit 6
  try {
    // konu.json bozuksa konuEtkin OrtakHata atar (exit 2); betik varsayilana DUSMEZ.
    const konu = ortak.konuEtkin(is);
    const ayar = ortak.ayarOku();
    const k = konu || { dil: ayar.dil, ses: ayar.ses, sesHizi: ayar.sesHizi, sesMotoru: "otomatik", okunus: {}, hedefSaniye: null, format: "long" };

    // komut satiri > konu.json. Komut satirindan FARKLI bir ses verilirse dil de o sesin onekinden cikar
    // (VoxCPM hazir sesinde ses kartindaki dilden).
    const ses = typeof bayrak.ses === "string" ? bayrak.ses : (konum[1] || k.ses);
    const hiz = typeof bayrak.hiz === "string" ? bayrak.hiz : (konum[2] || k.sesHizi);
    let dil = k.dil;
    if (ses !== k.ses && /^[a-z]{2}[-_]/i.test(ses)) dil = ses.slice(0, 2).toLowerCase();
    else if (ses !== k.ses && ortak.voxcpmKimlikDili(ses)) dil = ortak.voxcpmKimlikDili(ses);   // voxcpm:anlatici_en -> en
    if (typeof bayrak.dil === "string") dil = bayrak.dil;
    if (!/^[+-]\d{1,2}%$/.test(String(hiz)))
      throw new ortak.OrtakHata("hiz_gecersiz", "Ses hızı geçersiz: " + hiz, { cikis: 2, cozum: "+7% ya da -10% gibi yaz." });

    const r = await seslendir({
      dizin, ses, hiz, dil,
      motorSecimi: typeof bayrak.motor === "string" ? bayrak.motor : (k.sesMotoru || "otomatik"),
      okunus: k.okunus || {}, yeniden: !!bayrak.yeniden, hedefSn: k.hedefSaniye,
      teknikMaxSn: k.format && k.format !== "long" ? ortak.formatSiniri(k.format).teknikMaxSn : null,
    });
    if (r.atlandi) ortak.sonuc({ atlandi: true, neden: r.neden });
    else ortak.sonuc({ paragrafSayisi: r.paragrafSayisi, toplamSn: r.toplamSn, motor: r.motor, ses: r.ses,
                       hedefSn: r.hedefSn, sapmaYuzde: r.sapmaYuzde });
  } finally {
    ortak.kilitBirak(is);
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
