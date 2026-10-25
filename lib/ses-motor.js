// lib/ses-motor.js — ses motorlari icin ortak katman: motor secimi, zaman asimi + yeniden deneme,
// kesik/bos ses kontrolu, uzun paragraf bolme ve birlestirme.
//
// Motorlar (lib/ses-motor-*.js) ayni arayuzu verir:  { ad, kelimeZamani, ses, sentez, sifirla, kapat }
//   sentez(metin, {sinyal}) -> {buf (mp3), kelimeler:[{t,d,w}]}
//
// Deneme politikasi (OLCUM DEGIL, bulgu B033'un onerisi): >=5 deneme, 2/5/10/20 sn bekleme,
// deneme basi 45 sn zaman asimi, her yeniden denemede YENI baglanti. Donen kelime sayisi metnin
// kelime sayisinin %70'inden azsa deneme basarisiz sayilir. Kalici hatalar (yanlis anahtar,
// gecersiz ses adi) bosuna denenmez.
// Motor kendi politikasini verebilir (yerel GPU motoru VoxCPM: 2 deneme, metne gore uzayan zaman asimi):
//   motor.denemeAyari {denemeSayisi, bekleme, maksKarakter} · motor.zamanAsimiHesapla(metin) -> ms
//   hata.tekrarsiz = true: ayni girdi ayni sonucu verir (sabit tohum), yeniden denenmez; yalniz o paragraf duser.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ortak = require("./ortak.js");
const { uzunMetniBol, kelimeSay } = require("./ses-metin.js");

// voxcpm: kullanicinin bilgisayarinda kurulu VoxCPM2 (lib/ses-motor-voxcpm.js). "otomatik" sirasina YALNIZ ses
// "voxcpm:<ad>" ise (ve kuruluysa) en basta girer; kurulu degilse sessizce Edge/Azure/Piper'a dusulur.
const MOTORLAR = ["edge", "azure", "piper", "voxcpm"];
const OTOMATIK_MOTORLAR = ["edge", "azure", "piper"];
const voxcpm = () => require("./ses-motor-voxcpm.js");

const VARSAYILAN = Object.freeze({
  denemeSayisi: 5,
  bekleme: [2000, 5000, 10000, 20000],
  zamanAsimiMs: 45000,
  maksKarakter: 1500,          // ~4096 bayt SSML siniri civari: paragraf cumle sinirinda bolunur
  kelimeOrani: 0.7,
  bekle: ms => new Promise(r => setTimeout(r, ms)),
});

// ---------------------------------------------------------------------------
// ffmpeg / ffprobe (tembel yukleme: ff-yol bulunamazsa kendi mesajiyla cikar)
// ---------------------------------------------------------------------------
const araclar = () => require("../ff-yol.js");

function sureOlc(dosya, zamanAsimiMs) {
  // ffprobe YOKSA OrtakHata('ffmpeg_yok', cikis 2) oldugu gibi yukari cikar: try icinde olsaydi
  // "ses dosyasi bozuk" diye yeniden denenir (5 deneme + bekleme) ve yanlis mesaj verilirdi.
  const ffprobe = araclar().ffprobe;
  let cikti;
  try {
    cikti = execFileSync(ffprobe,
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dosya],
      { timeout: zamanAsimiMs || 30000, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  } catch (e) {
    throw new Error("Ses dosyası okunamadı (bozuk olabilir): " + path.basename(dosya));
  }
  const s = Number(cikti);
  if (!Number.isFinite(s) || s <= 0) throw new Error("Ses süresi ölçülemedi: " + path.basename(dosya));
  return s;
}

function mp3Birlestir(dosyalar, hedef, araDizin) {
  const liste = path.join(araDizin, "_birlestir.txt");
  // yol yerine yalniz dosya adi + liste klasorunde calisma: tek tirnak/ters egik cizgi sorunu yok
  fs.writeFileSync(liste, dosyalar.map(f => "file '" + path.basename(f).replace(/'/g, "'\\''") + "'").join("\n") + "\n");
  const gecici = hedef + ".part";
  try {
    execFileSync(araclar().ffmpeg,
      ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", "-f", "mp3", gecici],
      { cwd: araDizin, timeout: 120000, stdio: ["ignore", "ignore", "pipe"] });
    fs.renameSync(gecici, hedef);
  } finally {
    try { fs.unlinkSync(liste); } catch (e) { /* yoksay */ }
    try { fs.unlinkSync(gecici); } catch (e) { /* yoksay */ }
  }
}

// ---------------------------------------------------------------------------
// Motor secimi
// ---------------------------------------------------------------------------
function edgeKurulu() {
  try { require.resolve("msedge-tts"); return true; } catch (e) { return false; }
}

// -> {ok:true} | {ok:false, neden}
function motorHazirMi(ad, env, enjekte) {
  const e = env || ortak.envOku;
  const ek = enjekte || {};
  if (ad === "edge") return ek.msedge || edgeKurulu() ? { ok: true } : { ok: false, neden: "msedge-tts paketi kurulu değil (npm install)" };
  if (ad === "azure") {
    if (!e("AZURE_SPEECH_KEY") || !e("AZURE_SPEECH_REGION")) return { ok: false, neden: "AZURE_SPEECH_KEY ve AZURE_SPEECH_REGION tanımlı değil" };
    return { ok: true };
  }
  if (ad === "piper") {
    if (!e("PIPER_YOL") || !e("PIPER_MODEL")) return { ok: false, neden: "PIPER_YOL ve PIPER_MODEL tanımlı değil" };
    return { ok: true };
  }
  if (ad === "voxcpm") {
    if (ek.voxcpmKurulum) return ek.voxcpmKurulum.ok ? { ok: true } : { ok: false, neden: ek.voxcpmKurulum.neden };
    const k = voxcpm().kurulumDenetle(e);
    return k.ok ? { ok: true } : { ok: false, neden: k.neden };
  }
  return { ok: false, neden: "bilinmeyen motor: " + ad };
}

// secim: otomatik | edge | azure | piper | voxcpm  ->  denenecek motor adlari (sirayla)
// ses (istege bagli): "voxcpm:<ad>" ise otomatik sirada VoxCPM (kuruluysa) basa gelir, kurulu degilse sessizce
// atlanir; acik secilen baska motorla VoxCPM sesi celisir (girdi hatasi, cikis 2).
function motorSirasi(secim, env, enjekte, ses) {
  const s = secim || "otomatik";
  const voxSesi = ortak.voxcpmSesiMi(ses);
  if (s !== "otomatik") {
    if (!MOTORLAR.includes(s))
      throw new ortak.OrtakHata("motor_gecersiz", "Bilinmeyen ses motoru: " + s, { cikis: 2, cozum: "otomatik, edge, azure, piper ya da voxcpm yaz." });
    if (voxSesi && s !== "voxcpm")
      throw new ortak.OrtakHata("ses_motor_celiski", "'" + String(ses).trim() + "' bir VoxCPM sesi; '" + s + "' ses motoruyla kullanılamaz.", {
        cikis: 2, cozum: "Ses motorunu 'voxcpm' ya da 'otomatik' yap (--motor voxcpm), ya da bu motora uygun bir ses adı ver (ör. tr-TR-AhmetNeural)." });
    const h = motorHazirMi(s, env, enjekte);
    if (!h.ok) throw new ortak.OrtakHata("motor_hazir_degil", "'" + s + "' ses motoru kullanılamıyor: " + h.neden + ".", {
      cikis: 2, cozum: s === "edge" ? "Proje klasöründe 'npm install' çalıştır."
        : s === "voxcpm" ? voxcpm().kurulumCozumu() : "Kaynaklar sekmesinden ilgili anahtarları gir (.env.ornek'e bak)." });
    return [s];
  }
  const sira = OTOMATIK_MOTORLAR.filter(m => motorHazirMi(m, env, enjekte).ok);
  if (voxSesi && motorHazirMi("voxcpm", env, enjekte).ok) sira.unshift("voxcpm");
  if (!sira.length) throw new ortak.OrtakHata("motor_yok", "Kullanılabilir ses motoru yok.", {
    cikis: 2, cozum: "Proje klasöründe 'npm install' çalıştır (Edge sesi için)." });
  return sira;
}

// VoxCPM sesi ("voxcpm:<ad>") Edge/Azure'a gidemez: yedek motorda dilin varsayilan sesi kullanilir.
const yedekSes = (ses, dil) => (ortak.voxcpmSesiMi(ses) ? ortak.varsayilanSes(dil) : ses);

function motorOlustur(ad, ayar) {
  const e = ayar.env || ortak.envOku;
  const ek = ayar.enjekte || {};
  if (ad === "edge") return require("./ses-motor-edge.js").olustur({ ses: yedekSes(ayar.ses, ayar.dil), hiz: ayar.hiz, msedge: ek.msedge });
  if (ad === "azure") return require("./ses-motor-azure.js").olustur({
    ses: yedekSes(ayar.ses, ayar.dil), hiz: ayar.hiz, anahtar: e("AZURE_SPEECH_KEY"), bolge: e("AZURE_SPEECH_REGION"), getir: ek.getir, zamanAsimiMs: ayar.zamanAsimiMs });
  if (ad === "piper") return require("./ses-motor-piper.js").olustur({
    hiz: ayar.hiz, yol: e("PIPER_YOL"), model: e("PIPER_MODEL"), calistir: ek.calistir, ffmpeg: ek.ffmpeg });
  if (ad === "voxcpm") return voxcpm().olustur({
    ses: ayar.ses, dil: ayar.dil, hiz: ayar.hiz, env: e, kurulum: ek.voxcpmKurulum, calistir: ek.voxcpmCalistir,
    ffmpeg: ek.ffmpeg, kilitDosyasi: ek.voxcpmKilit, log: ayar.log });
  throw new Error("Bilinmeyen ses motoru: " + ad);
}

// ---------------------------------------------------------------------------
// Kesik / bos ses kontrolu. Hata firlatir; denemeyi basarisiz sayar.
// ---------------------------------------------------------------------------
function hizCarpani(hiz) {
  const m = /^([+-]\d{1,2})%$/.exec(String(hiz || ""));
  return 1 + (m ? Number(m[1]) / 100 : 0);
}

// Mevcut hizin USTUNE "gerekli" kat hizlanma ekler (+3 puan pay), -50..+50 ile sinirli.
//   hizArtir("+10%", 1.2) -> "+36%" ; hizArtir("-10%", 1.03) -> "-4%"  (negatif hizda "+-4%" ASLA uretilmez)
// Cikti her zaman ^[+-]\d{1,2}%$ bicimindedir (Edge/Azure rate degeri); gecersiz girdide hiz aynen doner.
function hizArtir(hiz, gerekli) {
  const yuzde = Math.max(-50, Math.min(50, Math.ceil((hizCarpani(hiz) * gerekli - 1) * 100) + 3));
  const s = (yuzde >= 0 ? "+" : "-") + Math.abs(yuzde) + "%";
  return /^[+-]\d{1,2}%$/.test(s) ? s : String(hiz);
}

// "+10%" -> 10 ; "-5%" -> -5 ; gecersiz -> 0
const hizYuzde = hiz => Math.round((hizCarpani(hiz) - 1) * 100);

// -> {uyari?: "..."} ; kesik ise Error
function sesDogrula(r, metin, o) {
  const beklenen = kelimeSay(metin);
  const kel = r.kelimeler || [];
  const sureSn = r.sureSn;
  if (!(sureSn >= 0.15)) throw new Error("Boş ya da çok kısa ses geldi");
  const oran = o.kelimeOrani;
  if (kel.length) {
    const gelen = kel.filter(k => /[\p{L}\p{N}]/u.test(k.w)).length;
    if (beklenen >= 3 && gelen < Math.ceil(beklenen * oran))
      throw new Error("Ses kesik geldi: " + gelen + "/" + beklenen + " kelime");
    const son = kel[kel.length - 1];
    // son kelimenin bitisi ses suresinden 1.2 sn'den fazla tasiyorsa ses sondan kesilmistir
    // (kucuk tasma normal: son kelimenin Duration'i bazen ses bitisini biraz asar)
    if (son.t + son.d > sureSn * 1000 + 1200)
      throw new Error("Ses yarıda kesilmiş: son kelime ses süresinin dışında kalıyor");
    return {};
  }
  // kelime zamani yok: sure makullugunu denetle (ses kelime hizindan cok kisa olamaz)
  const beklenenSn = beklenen / (ortak.kelimeHizi(o.dil) * hizCarpani(o.hiz)) * 60;
  if (beklenen >= 4 && sureSn < beklenenSn * 0.4)
    throw new Error("Ses beklenenden çok kısa (" + sureSn.toFixed(1) + " sn / ~" + beklenenSn.toFixed(1) + " sn): kesik olabilir");
  return o.kelimeZamani ? { uyari: "kelime zamanı gelmedi" } : {};
}

// ---------------------------------------------------------------------------
// Zaman asimli, yeniden denemeli TEK parca sentezi
//   -> {buf, kelimeler, sureSn, denemeler, uyari?}
// ---------------------------------------------------------------------------
async function zamanAsimli(motor, metin, zamanAsimiMs, araDizin, ek) {
  const ac = new AbortController();
  let zaman, reddet, bitti = false;
  const kur = () => {
    if (bitti || ac.signal.aborted) return;
    clearTimeout(zaman);
    zaman = setTimeout(() => {
      const e = new Error("zaman aşımı (" + Math.round(zamanAsimiMs / 1000) + " sn)");
      ac.abort(e); reddet(e);
    }, zamanAsimiMs);
  };
  const sureAsimi = new Promise((_, red) => { reddet = red; kur(); });
  // araDizin: motorun gecici dosyalari buraya yazmasi icin (kosu kesilirse sonraki kosu temizler)
  // ilerleme/log: uzun suren yerel motor (VoxCPM) parca icinden ilerleme ve durum satiri verir
  // sureyiDurdur / sureyiBaslat: sira bekleyen motor (VoxCPM: ekran karti kilidi) beklemeye girerken saati durdurur,
  // asil ise baslarken yeniden kurar; zaman asimi o andan sayilir (yoksa baska bir seslendirmenin GPU isini beklerken
  // zaman asimina dusulurdu). Bekleme sinyalle (iptal) yine kesilebilir.
  const durdur = () => clearTimeout(zaman);
  const is = Promise.resolve().then(() => motor.sentez(metin, Object.assign({ sinyal: ac.signal, araDizin, zamanAsimiMs,
    sureyiDurdur: durdur, sureyiBaslat: kur }, ek || {})));
  is.catch(() => { /* yarisi kaybeden taraf: yutulur, sessiz kalir */ });
  try { return await Promise.race([is, sureAsimi]); }
  finally { bitti = true; clearTimeout(zaman); }
}

// Deneme politikasi: VARSAYILAN < motorun kendi ayari < cagiranin ayari (testler). Zaman asimi: cagiran acikca
// vermediyse motor metne gore hesaplayabilir (yerel GPU motoru uzun paragrafta dakikalar surer).
const politika = (motor, oAyar) => Object.assign({}, VARSAYILAN, (motor && motor.denemeAyari) || {}, oAyar || {});
function denemeZamanAsimi(motor, metin, ayar, oAyar) {
  if (oAyar && oAyar.zamanAsimiMs) return oAyar.zamanAsimiMs;
  if (motor && typeof motor.zamanAsimiHesapla === "function") return motor.zamanAsimiHesapla(metin);
  return ayar.zamanAsimiMs;
}

async function denemeliSentez(motor, metin, o) {
  const ayar = politika(motor, o.ayar);
  const zamanAsimiMs = denemeZamanAsimi(motor, metin, ayar, o.ayar);
  const log = o.log || (() => {});
  let son = null;
  for (let d = 0; d < ayar.denemeSayisi; d++) {
    try {
      const r = await zamanAsimli(motor, metin, zamanAsimiMs, o.araDizin, { ilerleme: o.ilerleme, log: o.log });
      if (!r || !r.buf || !r.buf.length) throw new Error("Boş ses geldi");
      const gecici = path.join(o.araDizin, "_dene-" + process.pid + ".mp3");
      fs.writeFileSync(gecici, r.buf);
      let sureSn;
      try { sureSn = sureOlc(gecici); } finally { try { fs.unlinkSync(gecici); } catch (e) { /* yoksay */ } }
      const tam = { buf: r.buf, kelimeler: r.kelimeler || [], sureSn, denemeler: d + 1 };
      const k = sesDogrula(tam, metin, { kelimeOrani: ayar.kelimeOrani, dil: o.dil, hiz: o.hiz, kelimeZamani: motor.kelimeZamani });
      if (k.uyari) tam.uyari = k.uyari;
      return tam;
    } catch (e) {
      son = e;
      if (e && (e.kalici || e.tekrarsiz)) throw e;                            // tekrarsiz: ayni girdi ayni sonucu verir
      if (e instanceof ortak.OrtakHata) throw e;                              // ffmpeg/ffprobe yok vb.: tekrar denemek anlamsiz
      if (e && (e.code === "ENOSPC" || e.code === "EDQUOT")) throw e;         // disk dolu: tekrar denemek anlamsiz
      if (d < ayar.denemeSayisi - 1) {
        const bekleme = Math.max(ayar.bekleme[Math.min(d, ayar.bekleme.length - 1)], (e && e.beklemeMs) || 0);
        log("deneme " + (d + 1) + "/" + ayar.denemeSayisi + " başarısız (" + String(e && e.message || e).split("\n")[0] +
            "); " + Math.round(bekleme / 1000) + " sn sonra yeni bağlantıyla tekrar");
        await ayar.bekle(bekleme);
        try { await motor.sifirla(); } catch (e2) { /* sonraki sentez yeniden baglanir */ }
      }
    }
  }
  const hata = new Error(String(son && son.message || son || "bilinmeyen hata"));
  hata.denemeler = ayar.denemeSayisi;
  throw hata;
}

// ---------------------------------------------------------------------------
// Bir paragrafi mp3 dosyasina uret (gerekirse cumle sinirinda bolup birlestirir).
//   metin: DUZ okunan metin (XML kacisi motorda)
//   -> {sureSn, kelimeler:[{t,d,w}], bayt, parcaSayisi, uyari?}
// ---------------------------------------------------------------------------
async function parcaUret(motor, metin, o) {
  const ayar = politika(motor, o.ayar);
  fs.mkdirSync(o.araDizin, { recursive: true });
  const parcalar = uzunMetniBol(metin, ayar.maksKarakter);
  // o.ilerleme(oran 0..1): paragrafin ne kadari bitti (motor parca icinden de bildirirse)
  const ilerleme = k => (typeof o.ilerleme === "function" ? oran => o.ilerleme((k + Math.max(0, Math.min(1, oran))) / parcalar.length) : undefined);
  const ortakO = { araDizin: o.araDizin, dil: o.dil, hiz: o.hiz, ayar: o.ayar, log: o.log, ilerleme: ilerleme(0) };

  if (parcalar.length === 1) {
    const r = await denemeliSentez(motor, parcalar[0], ortakO);
    const gecici = o.hedef + ".part";
    fs.writeFileSync(gecici, r.buf);
    fs.renameSync(gecici, o.hedef);
    return { sureSn: r.sureSn, kelimeler: r.kelimeler, bayt: r.buf.length, parcaSayisi: 1, uyari: r.uyari };
  }

  const dosyalar = [], kelimeler = [];
  let kayma = 0, uyari;
  try {
    for (let k = 0; k < parcalar.length; k++) {
      const r = await denemeliSentez(motor, parcalar[k], Object.assign({}, ortakO, { ilerleme: ilerleme(k) }));
      const f = path.join(o.araDizin, "_c" + k + ".mp3");
      fs.writeFileSync(f, r.buf);
      dosyalar.push(f);
      for (const w of r.kelimeler) kelimeler.push({ t: Math.round(w.t + kayma * 1000), d: w.d, w: w.w });
      kayma += r.sureSn;
      if (r.uyari) uyari = r.uyari;
    }
    mp3Birlestir(dosyalar, o.hedef, o.araDizin);
  } finally {
    for (const f of dosyalar) { try { fs.unlinkSync(f); } catch (e) { /* yoksay */ } }
  }
  return { sureSn: sureOlc(o.hedef), kelimeler, bayt: fs.statSync(o.hedef).size, parcaSayisi: parcalar.length, uyari };
}

module.exports = {
  MOTORLAR, OTOMATIK_MOTORLAR, VARSAYILAN, sureOlc, mp3Birlestir, motorHazirMi, motorSirasi, motorOlustur, yedekSes,
  sesDogrula, denemeliSentez, parcaUret, hizCarpani, hizArtir, hizYuzde,
};
