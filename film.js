// FILM / DIZI hatti: bolum -> sahneler -> diyalog sesleri (karakter basina ses) -> AI klipler -> kurgu + altyazi (+ istege bagli dudak senkronu).
//   node film.js yeni <dizi> [--ad "Dizi Adi"] [--dil tr]     iskelet: bibliya.json + bolum-001.json (ornek)
//   node film.js klipler <dizi> <bolum>                        Voice/KLIPLER.txt yazar (vidiq-klip.js girdisi); URETMEZ, kredi harcamaz
//   node film.js ses <dizi> <bolum>                            diyalog satirlarini karakter sesleriyle seslendirir (ucretsiz motorlar)
//   node film.js kur <dizi> <bolum> [--dudak] [--yer-tutucu]   sahne klipleri + ses -> bolum-NNN.mp4 (+ .srt)
// Klip uretimi: node vidiq-klip.js <dizi>-bNNN --butce <kredi> [--onay]   (kuru calisma varsayilan; ucretli, onaysiz harcamaz)
// Dudak senkronu DIS aractir: hazir MuseTalk baglayicisi dudak-musetalk.js (bkz .env.ornek). Genel: .env DUDAK_KOMUT = sablon, orn.
//   python C:\musetalk\inference.py --video {video} --audio {ses} --cikti {cikti}
// {video} {ses} {cikti} yerine sahne dosyalari konur; komut kullanici tarafindan kurulur (bu depo indirmez/calistirmaz baska kod).
// Dosya duzeni: uretim/<dizi>/bibliya.json, uretim/<dizi>/bolum-001.json, uretim/<dizi>/bolum-001/{ses,kurgu}/ ,
//               uretim/<dizi>-b001/{Voice/KLIPLER.txt, Clips/} (vidiq-klip is klasoru), uretim/<dizi>/bolum-001.mp4
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ortak = require("./lib/ortak.js");

const ARA = 0.35;                       // diyalog satirlari arasi sessizlik (sn)
const SAHNE_BOS = 2.5;                  // diyalogsuz sahne suresi (sn)

const hata = (m, c) => Object.assign(new Error(m), { cikis: 2, cozum: c });
const bolumAdi = n => "bolum-" + String(n).padStart(3, "0");
const isAdi = (dizi, n) => dizi + "-b" + String(n).padStart(3, "0");
const jsonOku = y => { try { return JSON.parse(fs.readFileSync(y, "utf8").replace(/^\uFEFF/, "")); } catch (e) { throw hata("JSON okunamadı: " + path.basename(y) + " (" + e.message + ")", "Dosyayı düzelt ya da 'film.js yeni' ile yeniden oluştur."); } };
const ff = () => require("./ff-yol.js");

function sureOlc(dosya) {
  const r = spawnSync(ff().ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dosya], { encoding: "utf8", windowsHide: true });
  const s = Number(String(r.stdout).trim());
  if (!Number.isFinite(s) || s <= 0) throw hata("Süre ölçülemedi: " + dosya);
  return s;
}
function ffmpeg(argv, etiket) {
  const r = spawnSync(ff().ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...argv], { encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  if (r.status !== 0) throw hata("ffmpeg başarısız (" + etiket + "): " + String(r.stderr || "").trim().split("\n").slice(-3).join(" | "));
}
const srtZaman = s => { const ms = Math.round(s * 1000), p = (n, k) => String(n).padStart(k, "0"); return p(Math.floor(ms / 3600000), 2) + ":" + p(Math.floor(ms / 60000) % 60, 2) + ":" + p(Math.floor(ms / 1000) % 60, 2) + "," + p(ms % 1000, 3); };

// ---------------------------------------------------------------- dogrulama
function bibliyaOku(dizi) {
  const b = jsonOku(path.join(ortak.isDizin(dizi), "bibliya.json"));
  if (!b || typeof b.karakterler !== "object" || !Object.keys(b.karakterler).length) throw hata("bibliya.json içinde 'karakterler' yok.", "Her karakter için ad ve ses yaz (ör. \"ayse\": {\"ses\": \"tr-TR-EmelNeural\"}).");
  return b;
}
function bolumOku(dizi, n, bibliya) {
  const b = jsonOku(path.join(ortak.isDizin(dizi), bolumAdi(n) + ".json"));
  if (!Array.isArray(b.sahneler) || !b.sahneler.length) throw hata(bolumAdi(n) + ".json içinde 'sahneler' yok.");
  b.sahneler.forEach((s, i) => {
    if (!s.aksiyon || typeof s.aksiyon !== "string") throw hata("Sahne " + (i + 1) + ": 'aksiyon' (İngilizce klip istemi) yok.");
    for (const d of s.diyalog || []) {
      if (!bibliya.karakterler[d.karakter]) throw hata("Sahne " + (i + 1) + ": bilinmeyen karakter '" + d.karakter + "'.", "bibliya.json karakterlerinden biri olmalı: " + Object.keys(bibliya.karakterler).join(", "));
      if (!d.metin || !String(d.metin).trim()) throw hata("Sahne " + (i + 1) + ": boş diyalog metni.");
    }
  });
  return b;
}

// ---------------------------------------------------------------- yeni
function yeni(dizi, b) {
  const dizin = ortak.isDizin(dizi);
  if (fs.existsSync(path.join(dizin, "bibliya.json"))) throw hata("Bu dizi zaten var: " + dizi, "Başka ad seç ya da dosyaları elle düzenle.");
  fs.mkdirSync(dizin, { recursive: true });
  const dil = b.dil || "tr";
  const sesler = dil === "tr" ? ["tr-TR-EmelNeural", "tr-TR-AhmetNeural"] : ["en-US-JennyNeural", "en-US-GuyNeural"];
  fs.writeFileSync(path.join(dizin, "bibliya.json"), JSON.stringify({
    ad: b.ad || dizi, dil, format: "dikey 9:16 kısa dizi", uslup: "Gerçekçi, sıcak ışık, sinematik. (Tüm klip istemlerine eklenir; karakter görünümlerini her istemde tekrar et: yüz tutarlılığı için.)",
    karakterler: {
      ayse: { ad: "Ayşe", ses: sesler[0], gorunum: "27 yaşında, omuz hizasında kahverengi dalgalı saç, yeşil gözler, bej trençkot" },
      mert: { ad: "Mert", ses: sesler[1], gorunum: "30 yaşında, kısa siyah saç, hafif sakallı, lacivert palto" },
    },
  }, null, 2));
  fs.writeFileSync(path.join(dizin, bolumAdi(1) + ".json"), JSON.stringify({
    baslik: "Bölüm 1 — Yağmurda Tesadüf",
    sahneler: [
      { aksiyon: "rainy Istanbul street at dusk, a woman in a beige trench coat holds a broken umbrella, a man approaches and offers his umbrella", sure: 6,
        diyalog: [{ karakter: "mert", metin: "Şemsiyem büyük, ikimize de yeter." }, { karakter: "ayse", metin: "Teşekkür ederim ama seni tanımıyorum." }] },
      { aksiyon: "close-up of the woman smiling shyly under a shared umbrella, warm street lights blurred behind", sure: 5,
        diyalog: [{ karakter: "mert", metin: "O zaman tanışalım. Ben Mert." }] },
    ],
  }, null, 2));
  console.log("✓ " + dizin + "\n  bibliya.json (karakterler, ses, görünüm) ve bolum-001.json (örnek) oluşturuldu.\n  Karakterleri ve sahneleri düzenle, sonra: node film.js ses " + dizi + " 1");
}

// ---------------------------------------------------------------- klipler (istem dosyasi)
function klipler(dizi, n) {
  const bib = bibliyaOku(dizi), bol = bolumOku(dizi, n, bib);
  const is = isAdi(dizi, n), voice = path.join(ortak.isDizin(is), "Voice");
  fs.mkdirSync(voice, { recursive: true });
  const satirlar = bol.sahneler.map(s => {
    const gorunen = [...new Set((s.diyalog || []).map(d => d.karakter))].map(k => bib.karakterler[k].gorunum).filter(Boolean);
    return [s.aksiyon.replace(/\s+/g, " ").trim(), gorunen.length ? "characters: " + gorunen.join("; ") : "", bib.uslup || ""].filter(Boolean).join(". ") + " | " + (Number(s.sure) || 5);
  });
  fs.writeFileSync(path.join(voice, "KLIPLER.txt"), "# " + bib.ad + " " + bolumAdi(n) + " — film.js klipler\n" + satirlar.join("\n") + "\n");
  console.log("✓ " + path.join(voice, "KLIPLER.txt") + " (" + satirlar.length + " klip)\n  Maliyet için: node vidiq-klip.js " + is + " --butce 500   (kuru çalışma, kredi harcamaz)");
}

// ---------------------------------------------------------------- ses
async function ses(dizi, n) {
  const M = require("./lib/ses-motor.js");
  const bib = bibliyaOku(dizi), bol = bolumOku(dizi, n, bib);
  const dizin = path.join(ortak.isDizin(dizi), bolumAdi(n), "ses");
  fs.mkdirSync(dizin, { recursive: true });
  const zaman = [];
  let motorlar = {};
  for (let si = 0; si < bol.sahneler.length; si++) {
    const satirlar = [];
    const dl = bol.sahneler[si].diyalog || [];
    for (let di = 0; di < dl.length; di++) {
      const k = bib.karakterler[dl[di].karakter];
      const dosya = path.join(dizin, String(si + 1).padStart(2, "0") + "-" + String(di + 1).padStart(2, "0") + ".mp3");
      if (!fs.existsSync(dosya)) {
        const sira = M.motorSirasi("otomatik", ortak.envOku, {}, k.ses);
        let buf = null, son = null;
        for (const ad of sira) {
          try {
            const anahtar = ad + "|" + k.ses;
            const motor = motorlar[anahtar] || (motorlar[anahtar] = M.motorOlustur(ad, { ses: k.ses, hiz: k.hiz || "+0%", dil: bib.dil || "tr", env: ortak.envOku, enjekte: {}, log: m => console.log("  " + m) }));
            buf = (await motor.sentez(dl[di].metin, { araDizin: dizin })).buf;
            if (buf && buf.length > 500) break;
          } catch (e) { son = e; buf = null; }
        }
        if (!buf) throw hata("Seslendirilemedi (sahne " + (si + 1) + ", " + dl[di].karakter + "): " + (son && son.message), "node seslendir.js --liste-sesler ile motorları kontrol et; Edge çalışmazsa sistem sesi ya da VoxCPM kur.");
        fs.writeFileSync(dosya + ".part", buf); fs.renameSync(dosya + ".part", dosya);
      }
      satirlar.push({ karakter: dl[di].karakter, metin: dl[di].metin, dosya: path.relative(ortak.isDizin(dizi), dosya).replace(/\\/g, "/"), sn: sureOlc(dosya) });
    }
    zaman.push({ sahne: si + 1, satirlar });
  }
  fs.writeFileSync(path.join(ortak.isDizin(dizi), bolumAdi(n), "ses-zaman.json"), JSON.stringify(zaman, null, 2));
  const toplam = zaman.reduce((a, s) => a + s.satirlar.reduce((b, x) => b + x.sn, 0), 0);
  console.log("✓ " + zaman.reduce((a, s) => a + s.satirlar.length, 0) + " diyalog satırı seslendirildi, toplam " + toplam.toFixed(1) + " sn konuşma.\n  Sıradaki: node film.js klipler " + dizi + " " + n + "  →  node vidiq-klip.js " + isAdi(dizi, n) + " ...  →  node film.js kur " + dizi + " " + n);
}

// ---------------------------------------------------------------- kur (kurgu)
function dudakKomutu(video, ses, cikti) {
  const sablon = ortak.envOku("DUDAK_KOMUT");
  if (!sablon) throw hata("DUDAK_KOMUT tanımlı değil.", ".env'e dudak senkronu komutunu yaz, ör. DUDAK_KOMUT=python C:\\musetalk\\inference.py --video {video} --audio {ses} --cikti {cikti}  (MuseTalk/LatentSync'i sen kurarsın).");
  const parcalar = sablon.match(/"[^"]*"|\S+/g).map(p => p.replace(/^"|"$/g, "").replace("{video}", video).replace("{ses}", ses).replace("{cikti}", cikti));
  const r = spawnSync(parcalar[0], parcalar.slice(1), { encoding: "utf8", windowsHide: true, timeout: 20 * 60 * 1000 });
  if (r.status !== 0 || !fs.existsSync(cikti)) throw hata("Dudak senkronu komutu başarısız: " + String(r.stderr || r.error || "").trim().slice(-300));
}

function kur(dizi, n, o) {
  const bib = bibliyaOku(dizi), bol = bolumOku(dizi, n, bib);
  const kok = ortak.isDizin(dizi), bdizin = path.join(kok, bolumAdi(n));
  const zamanYolu = path.join(bdizin, "ses-zaman.json");
  if (!fs.existsSync(zamanYolu)) throw hata("Önce sesleri üret.", "node film.js ses " + dizi + " " + n);
  const zaman = jsonOku(zamanYolu);
  const kurgu = path.join(bdizin, "kurgu");
  fs.mkdirSync(kurgu, { recursive: true });
  const kayit = (() => { try { return jsonOku(path.join(ortak.isDizin(isAdi(dizi, n)), "Clips", "klipler.json")).klipler || []; } catch (e) { return []; } })();
  const parcalar = [], altyazi = [];
  let t = 0;
  const uyarilar = [];
  bol.sahneler.forEach((s, i) => {
    const sat = (zaman[i] && zaman[i].satirlar) || [];
    const ad = String(i + 1).padStart(2, "0");
    // sahne sesi: satirlar + aralar
    const sesDosya = path.join(kurgu, ad + "-ses.m4a");
    let sure;
    if (sat.length) {
      const girdi = [], filtre = [];
      sat.forEach((x, k) => { girdi.push("-i", path.join(kok, x.dosya)); filtre.push("[" + k + ":a]aresample=44100,aformat=channel_layouts=stereo,apad=pad_dur=" + ARA + "[a" + k + "]"); });
      ffmpeg([...girdi, "-filter_complex", filtre.join(";") + ";" + sat.map((_, k) => "[a" + k + "]").join("") + "concat=n=" + sat.length + ":v=0:a=1[o]", "-map", "[o]", "-c:a", "aac", "-b:a", "160k", sesDosya], "sahne " + ad + " ses");
      sure = sureOlc(sesDosya);
      let c = t;
      for (const x of sat) { altyazi.push({ b: c, e: c + x.sn, m: x.metin }); c += x.sn + ARA; }
    } else {
      sure = SAHNE_BOS;
      ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(sure), "-c:a", "aac", sesDosya], "sahne " + ad + " sessiz");
    }
    // sahne klibi: vidiq-klip kayitinda istemi eslesen dosya
    const gorunen = [...new Set((s.diyalog || []).map(d => d.karakter))].map(k => bib.karakterler[k].gorunum).filter(Boolean);
    const istem = [s.aksiyon.replace(/\s+/g, " ").trim(), gorunen.length ? "characters: " + gorunen.join("; ") : "", bib.uslup || ""].filter(Boolean).join(". ");
    const kk = kayit.find(x => x.dosya && x.istem === istem);
    const klipYolu = kk ? path.join(ortak.isDizin(isAdi(dizi, n)), "Clips", kk.dosya) : null;
    const video = path.join(kurgu, ad + "-video.mp4");
    const filtre = "fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,setsar=1";
    if (klipYolu && fs.existsSync(klipYolu)) ffmpeg(["-stream_loop", "-1", "-i", klipYolu, "-t", sure.toFixed(3), "-vf", filtre, "-an", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-threads", "2", video], "sahne " + ad + " video");
    else {
      if (!o.yerTutucu) throw hata("Sahne " + (i + 1) + " için klip yok.", "node vidiq-klip.js " + isAdi(dizi, n) + " --butce 500 --onay ile klipleri üret ya da deneme için --yer-tutucu ekle.");
      uyarilar.push("Sahne " + (i + 1) + ": klip yok, yer tutucu (düz renk) kullanıldı.");
      ffmpeg(["-f", "lavfi", "-i", "color=c=0x1a1a2e:s=1080x1920:r=30", "-t", sure.toFixed(3), "-c:v", "libx264", "-crf", "24", "-preset", "veryfast", "-pix_fmt", "yuv420p", video], "sahne " + ad + " yer tutucu");
    }
    // sahne: video + ses (+ dudak senkronu)
    let kaynakVideo = video;
    if (o.dudak && sat.length && klipYolu) {
      const dudak = path.join(kurgu, ad + "-dudak.mp4");
      if (!fs.existsSync(dudak)) dudakKomutu(video, sesDosya, dudak);
      kaynakVideo = dudak;
    }
    const sahne = path.join(kurgu, ad + "-sahne.mp4");
    ffmpeg(["-i", kaynakVideo, "-i", sesDosya, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "aac", "-b:a", "160k", "-t", sure.toFixed(3), "-r", "30", sahne], "sahne " + ad + " birlestir");
    parcalar.push(sahne);
    t += sure;
  });
  // birlestir
  const liste = path.join(kurgu, "liste.txt");
  fs.writeFileSync(liste, parcalar.map(p => "file '" + path.basename(p).replace(/'/g, "'\\''") + "'").join("\n") + "\n");
  const ham = path.join(kurgu, "birlesik.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", ham], "birlestir");
  const srt = path.join(kok, bolumAdi(n) + ".srt");
  fs.writeFileSync(srt, altyazi.map((a, k) => (k + 1) + "\n" + srtZaman(a.b) + " --> " + srtZaman(a.e) + "\n" + a.m + "\n").join("\n"));
  const cikti = path.join(kok, bolumAdi(n) + ".mp4");
  // altyazi gomme: ffmpeg 'subtitles' filtresi; yol kacislari Windows icin (iki nokta ve ters bolu). Olmazsa .srt ayri kalir.
  const srtF = srt.replace(/\\/g, "/").replace(/:/g, "\\:");
  try {
    ffmpeg(["-i", ham, "-vf", "subtitles='" + srtF + "':force_style='Alignment=2,FontSize=14,Outline=2,MarginV=90'", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "copy", cikti], "altyazı");
  } catch (e) { uyarilar.push("Altyazı videoya gömülemedi (" + e.message.slice(0, 120) + "); .srt ayrı dosya olarak yazıldı."); fs.copyFileSync(ham, cikti); }
  console.log("✓ " + cikti + " (" + t.toFixed(1) + " sn, " + bol.sahneler.length + " sahne)\n  altyazı: " + srt);
  for (const u of uyarilar) console.log("  ! " + u);
  return { cikti, sure: t, uyarilar };
}

// ---------------------------------------------------------------- CLI
async function calistir(args) {
  const bayrak = a => args.includes("--" + a);
  const deger = a => { const i = args.indexOf("--" + a); return i >= 0 ? args[i + 1] : undefined; };
  const konum = args.filter((a, i) => !a.startsWith("--") && !["--ad", "--dil"].includes(args[i - 1]));
  const [komut, dizi, bolum] = konum;
  if (!komut || !dizi) throw hata("Kullanım: node film.js yeni|klipler|ses|kur <dizi> [bölüm]", "Başlamak için: node film.js yeni benim-dizim");
  const n = Number(bolum || 1);
  if (komut === "yeni") return yeni(dizi, { ad: deger("ad"), dil: deger("dil") });
  if (!Number.isInteger(n) || n < 1) throw hata("Bölüm numarası geçersiz: " + bolum);
  if (komut === "klipler") return klipler(dizi, n);
  if (komut === "ses") return ses(dizi, n);
  if (komut === "kur") return kur(dizi, n, { dudak: bayrak("dudak"), yerTutucu: bayrak("yer-tutucu") });
  throw hata("Bilinmeyen komut: " + komut);
}
if (require.main === module) calistir(process.argv.slice(2)).catch(e => { console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : "")); process.exit(e.cikis || 1); });
module.exports = { calistir, yeni, klipler, ses, kur, bibliyaOku, bolumOku, srtZaman, isAdi };
