// lib/ses-motor-piper.js — Piper: tamamen YEREL, anahtarsiz, internetsiz yedek ses motoru.
//
// .env:  PIPER_YOL=C:\piper\piper.exe    PIPER_MODEL=C:\piper\tr_TR-dfki-medium.onnx
// Ses, MODEL dosyasi ile belirlenir (konu.json "ses" adi yok sayilir). Kelime zamani vermez.
// Komut: piper --model <onnx> --output_file <wav> [--length_scale <hiz>]   (metin stdin'den)
// WAV, ffmpeg ile Edge'in kullandigi bicime (mp3, 24 kHz, mono, 96 kbps) cevrilir.
//
// {calistir} ile enjekte edilebilir (testte sahte). PIPER_YOL .js ise node ile, Windows'ta
// .cmd/.bat ise kabuk uzerinden calistirilir (sarmalayici betikler icin).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

function hata(mesaj, secenek) {
  const e = new Error(mesaj);
  Object.assign(e, secenek || {});
  return e;
}

// "+7%" -> length_scale 0.935 (hizlandirinca kisalir)
function uzunlukOlcegi(hiz) {
  const m = /^([+-]\d{1,2})%$/.exec(String(hiz || ""));
  const yuzde = m ? Number(m[1]) : 0;
  return Math.min(2, Math.max(0.5, Math.round(100 / (100 + yuzde) * 1000) / 1000));
}

// Varsayilan calistirici: {komut, argv, girdi, zamanAsimiMs, sinyal} -> {kod, stderr}
function varsayilanCalistir(o) {
  return new Promise((coz, red) => {
    let komut = o.komut, argv = o.argv, kabuk = false;
    if (/\.(?:js|cjs|mjs)$/i.test(komut)) { argv = [komut].concat(argv); komut = process.execPath; }
    else if (process.platform === "win32" && /\.(?:cmd|bat)$/i.test(komut)) {
      const tehlikeli = /["&|<>^%\r\n]/;
      if ([komut].concat(argv).some(a => tehlikeli.test(a)))
        return red(hata("PIPER yolunda geçersiz karakter var", { kalici: true }));
      kabuk = true;
      komut = '"' + komut + '"'; argv = argv.map(a => '"' + a + '"');
    }
    let c;
    try { c = spawn(komut, argv, { shell: kabuk, windowsHide: true, stdio: ["pipe", "ignore", "pipe"] }); }
    catch (e) { return red(e); }
    let stderr = "";
    const zaman = setTimeout(() => { try { c.kill(); } catch (e) { /* yoksay */ } red(new Error("Piper zaman aşımı")); }, o.zamanAsimiMs || 120000);
    const iptal = () => { try { c.kill(); } catch (e) { /* yoksay */ } };
    if (o.sinyal) {
      if (o.sinyal.aborted) iptal(); else o.sinyal.addEventListener("abort", iptal, { once: true });
    }
    c.stderr.on("data", d => { stderr = (stderr + d).slice(-2000); });
    c.on("error", e => { clearTimeout(zaman); red(e.code === "ENOENT" ? hata("PIPER_YOL bulunamadı: " + o.komut, { kalici: true }) : e); });
    c.on("close", kod => { clearTimeout(zaman); coz({ kod, stderr }); });
    c.stdin.on("error", () => { /* surec erken kapandiysa kapanis olayi bildirir */ });
    c.stdin.end(o.girdi);
  });
}

function olustur(ayar) {
  const yol = String(ayar.yol || "").trim(), model = String(ayar.model || "").trim();
  if (!yol) throw hata("PIPER_YOL tanımlı değil", { kalici: true });
  if (!model) throw hata("PIPER_MODEL tanımlı değil", { kalici: true });
  if (!ayar.calistir) {
    if (!fs.existsSync(yol)) throw hata("PIPER_YOL bulunamadı: " + yol, { kalici: true });
    if (!fs.existsSync(model)) throw hata("PIPER_MODEL bulunamadı: " + model, { kalici: true });
  }
  const calistir = ayar.calistir || varsayilanCalistir;
  const ffmpeg = ayar.ffmpeg || (() => require("../ff-yol.js").ffmpeg);
  const adCikis = path.win32.basename(model).replace(/\.onnx$/i, "");   // win32: hem "\" hem "/" ayirici sayilir

  async function sentez(metin, secenek) {
    const sinyal = secenek && secenek.sinyal;
    // gecici WAV/mp3: cagiranin verdigi ara klasore (kosu kesilirse sonraki kosu o klasoru temizler)
    const gecici = path.join((secenek && secenek.araDizin) || os.tmpdir(),
      "piper-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
    const wav = gecici + ".wav", mp3 = gecici + ".mp3";
    try {
      const r = await calistir({
        komut: yol, argv: ["--model", model, "--output_file", wav, "--length_scale", String(uzunlukOlcegi(ayar.hiz))],
        girdi: String(metin).replace(/\s*\n\s*/g, " ") + "\n", zamanAsimiMs: ayar.zamanAsimiMs || 120000, sinyal,
      });
      if (r.kod !== 0) throw hata("Piper hata verdi (kod " + r.kod + "): " + String(r.stderr || "").trim().split("\n").pop());
      if (!fs.existsSync(wav) || fs.statSync(wav).size < 100) throw hata("Piper ses dosyası üretmedi");
      execFileSync(ffmpeg(), ["-y", "-hide_banner", "-loglevel", "error", "-i", wav, "-ar", "24000", "-ac", "1", "-b:a", "96k", "-f", "mp3", mp3],
        { timeout: 60000, stdio: ["ignore", "ignore", "pipe"] });
      return { buf: fs.readFileSync(mp3), kelimeler: [] };
    } finally {
      for (const f of [wav, mp3]) { try { fs.unlinkSync(f); } catch (e) { /* yoksay */ } }
    }
  }

  return { ad: "piper", kelimeZamani: false, ses: adCikis, sentez, sifirla: async () => {}, kapat: () => {} };
}

module.exports = { olustur, uzunlukOlcegi, varsayilanCalistir };
