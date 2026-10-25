// test/ses-sahte-voxcpm.js — GERCEK VoxCPM2 Python'u yerine gecen sahte yurutulebilir (test dosyasi DEGIL).
// VOXCPM_PYTHON=<bu dosya> (".js" ise node ile calistirilir). "python -m ses_tasarim.oku" komut satirini taklit eder:
//   -m ses_tasarim.oku --ses <klasor> --metin @<dosya> --cikti <klasor> [--dil <kod>]
// oku.py gibi: rakam/tirnak reddedilir (tr'de kesme isareti de), satir = cumle, "k/n cümle" ilerlemesi basilir,
// <cikti>/okuma.wav (48 kHz mono, ffmpeg lavfi sinus) + <cikti>/ozet.json (satir t0/t1) yazilir.
// Ortam: SAHTE_VOXCPM_HATA = eos | ggml | ayar | bos   SAHTE_VOXCPM_GECIKME_MS (yavas motor)
//        SAHTE_VOXCPM_KAYIT = <dosya>: her cagrinin argv/cwd/metni/pid'i JSON satiri olarak eklenir
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const a = process.argv.slice(2);
const al = ad => { const i = a.indexOf(ad); return i >= 0 ? a[i + 1] : undefined; };
const sesKlasoru = al("--ses"), metinArg = al("--metin"), cikti = al("--cikti");
const dil = String(al("--dil") || "tr");

function hataVer(satir) {
  process.stderr.write("Traceback (most recent call last):\n  File \"oku.py\", line 1, in <module>\n" + satir + "\n");
  process.exit(1);
}

if (a[0] !== "-m" || a[1] !== "ses_tasarim.oku" || !sesKlasoru || !metinArg || !cikti) hataVer("SystemExit: eksik argüman");
if (!fs.existsSync(path.join(sesKlasoru, "ses.json"))) hataVer("FileNotFoundError: ses bulunamadı: " + sesKlasoru);
const metin = metinArg.startsWith("@") ? fs.readFileSync(metinArg.slice(1), "utf8") : metinArg;
if (process.env.SAHTE_VOXCPM_KAYIT)
  fs.appendFileSync(process.env.SAHTE_VOXCPM_KAYIT, JSON.stringify({ argv: a, cwd: process.cwd(), metin, pid: process.pid }) + "\n");

const hataTuru = process.env.SAHTE_VOXCPM_HATA || "";
if (hataTuru === "ayar") hataVer("ses_tasarim.ayarlar.AyarHatasi: ayar dosyası yok: --ayarlar <yol>");
const okunmaz = dil === "tr" ? /["“”„«»‘’‚‹›`´'\p{Nd}]/u : /["“”„`´\p{Nd}]/u;
if (okunmaz.test(metin)) hataVer("ValueError: metin:\n  - metin: okunamayan işaret; rakamı yazıyla yaz");

const satirlar = metin.split(/\r?\n/).map(l => l.split("||")[0].trim()).filter(Boolean);
const bitir = () => {
  if (hataTuru === "eos") hataVer("ses_tasarim.motor.MotorHatasi: şu satırlar düzgün bitmedi (EOS yok): [1]; cümleyi kısalt ya da yeniden dene");
  if (hataTuru === "ggml") hataVer("ses_tasarim.motor.MotorHatasi: motor rc=3; GGML_ASSERT(mem_buffer) failed");
  satirlar.forEach((_, i) => console.log("  " + (i + 1) + "/" + satirlar.length + " cümle, " + i + " sn"));
  if (hataTuru === "bos") { console.log("bitti: 0 sn ses"); return; }
  fs.mkdirSync(cikti, { recursive: true });
  let t = 0;
  const kayitlar = satirlar.map((l, i) => {
    const sure = Math.max(0.5, l.length * 0.05);
    const r = { satir: i + 1, metin: l, t0: Math.round(t * 1000) / 1000, t1: Math.round((t + sure) * 1000) / 1000 };
    t += sure + 0.35;
    return r;
  });
  const toplam = Math.max(0.5, t - 0.35);
  execFileSync(require("../ff-yol.js").ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
    "sine=frequency=220:duration=" + toplam.toFixed(3) + ":sample_rate=48000", "-ac", "1", "-c:a", "pcm_s16le",
    path.join(cikti, "okuma.wav")], { stdio: "ignore" });
  fs.writeFileSync(path.join(cikti, "ozet.json"), JSON.stringify({ ses: path.basename(sesKlasoru), dil, satirlar: kayitlar, yapay: true }, null, 2));
  console.log("bitti: " + toplam.toFixed(2) + " sn ses, 1 sn, VRAM tepe 0 MB → " + path.join(cikti, "okuma.wav"));
};
const gecikme = Number(process.env.SAHTE_VOXCPM_GECIKME_MS || 0);
if (gecikme > 0) setTimeout(bitir, gecikme); else bitir();
