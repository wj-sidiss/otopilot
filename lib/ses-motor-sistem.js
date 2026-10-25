// lib/ses-motor-sistem.js — isletim sisteminin KENDI sesi: kurulum, anahtar, internet gerektirmez. Son care yedek motor.
//   Windows: System.Speech (SAPI)   macOS: say   Linux: espeak-ng / espeak
// Kalite orta (robotik) ama her makinede calisir; Edge sesi servisi kapaninca video yine de biter.
// Ses secimi dile gore: dilin kulturu (tr -> tr-TR, en -> en-US ...) ile eslesen ilk yuklu ses; yoksa varsayilan ses
// (kullaniciya uyari verilir). Kelime zamani vermez. WAV/AIFF, ffmpeg ile mp3'e (24 kHz mono 96 kbps) cevrilir.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const KULTUR = { tr: "tr-TR", en: "en-US", es: "es-ES", de: "de-DE", fr: "fr-FR", it: "it-IT", pt: "pt-BR", ru: "ru-RU", nl: "nl-NL",
  pl: "pl-PL", ja: "ja-JP", ko: "ko-KR", ar: "ar-SA", hi: "hi-IN", zh: "zh-CN" };

function hata(mesaj, secenek) { return Object.assign(new Error(mesaj), secenek || {}); }

// "+7%" -> SAPI Rate (-10..10): %10 ~ 1 adim
function hizAdimi(hiz) {
  const m = /^([+-]\d{1,2})%$/.exec(String(hiz || ""));
  return Math.max(-10, Math.min(10, m ? Math.round(Number(m[1]) / 10) : 0));
}

function espeakYolu() {
  for (const ad of ["espeak-ng", "espeak"]) {
    try { const r = spawnSync(ad, ["--version"], { stdio: "ignore", windowsHide: true }); if (r.status === 0) return ad; } catch (e) { /* yoksay */ }
  }
  return "";
}

// -> {ok, neden?}
function hazirMi(platform) {
  const p = platform || process.platform;
  if (p === "win32" || p === "darwin") return { ok: true };
  return espeakYolu() ? { ok: true } : { ok: false, neden: "espeak-ng kurulu değil (sudo apt install espeak-ng)" };
}

const PS_BETIK = [
  "param([string]$Metin,[string]$Cikti,[string]$Kultur,[int]$Hiz)",
  "Add-Type -AssemblyName System.Speech",
  "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
  "$ses = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq $Kultur } | Select-Object -First 1",
  "if (-not $ses) { $ses = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq $Kultur.Substring(0,2) } | Select-Object -First 1 }",
  "if ($ses) { $s.SelectVoice($ses.VoiceInfo.Name) } else { [Console]::Error.WriteLine('SES_YOK ' + $Kultur) }",
  "$s.Rate = $Hiz",
  "$s.SetOutputToWaveFile($Cikti)",
  "$s.Speak([System.IO.File]::ReadAllText($Metin, [System.Text.Encoding]::UTF8))",
  "$s.Dispose()",
].join("\n");

function varsayilanCalistir(o) {
  return new Promise((coz, red) => {
    let c;
    try { c = spawn(o.komut, o.argv, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] }); } catch (e) { return red(e); }
    let stderr = "";
    const zaman = setTimeout(() => { try { c.kill(); } catch (e) { /* yoksay */ } red(new Error("Sistem sesi zaman aşımı")); }, o.zamanAsimiMs || 120000);
    c.stderr.on("data", d => { stderr = (stderr + d).slice(-2000); });
    c.on("error", e => { clearTimeout(zaman); red(e); });
    c.on("close", kod => { clearTimeout(zaman); coz({ kod, stderr }); });
  });
}

function olustur(ayar) {
  const platform = ayar.platform || process.platform;
  const h = ayar.calistir ? { ok: true } : hazirMi(platform);
  if (!h.ok) throw hata(h.neden, { kalici: true });
  const dil = String(ayar.dil || "en").toLowerCase().slice(0, 2);
  const kultur = KULTUR[dil] || "en-US";
  const calistir = ayar.calistir || varsayilanCalistir;
  const ffmpeg = ayar.ffmpeg || (() => require("../ff-yol.js").ffmpeg);
  const espeak = platform === "win32" || platform === "darwin" ? "" : (ayar.espeak || espeakYolu());

  async function sentez(metin, secenek) {
    const ara = (secenek && secenek.araDizin) || os.tmpdir();
    const govde = path.join(ara, "sistem-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
    const txt = govde + ".txt", ps1 = govde + ".ps1", ham = govde + (platform === "darwin" ? ".aiff" : ".wav"), mp3 = govde + ".mp3";
    try {
      fs.writeFileSync(txt, String(metin).replace(/\s*\n\s*/g, " "), "utf8");
      let komut, argv;
      if (platform === "win32") {
        fs.writeFileSync(ps1, "﻿" + PS_BETIK, "utf8");
        komut = "powershell.exe";
        argv = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1, "-Metin", txt, "-Cikti", ham, "-Kultur", kultur, "-Hiz", String(hizAdimi(ayar.hiz))];
      } else if (platform === "darwin") {
        komut = "say"; argv = ["-o", ham, "-r", String(175 + hizAdimi(ayar.hiz) * 12), "-f", txt];
      } else {
        komut = espeak; argv = ["-v", dil, "-s", String(165 + hizAdimi(ayar.hiz) * 12), "-w", ham, "-f", txt];
      }
      const r = await calistir({ komut, argv, zamanAsimiMs: ayar.zamanAsimiMs || 120000, sinyal: secenek && secenek.sinyal });
      if (r.kod !== 0) throw hata("Sistem sesi hata verdi (kod " + r.kod + "): " + String(r.stderr || "").trim().split("\n").pop());
      if (/SES_YOK/.test(r.stderr || "") && ayar.uyar && !olustur._uyardi) { olustur._uyardi = true; ayar.uyar("Sistemde " + kultur + " sesi yok; varsayılan ses kullanıldı (Windows: Ayarlar > Zaman ve dil > Konuşma)."); }
      if (!fs.existsSync(ham) || fs.statSync(ham).size < 100) throw hata("Sistem sesi dosya üretmedi");
      require("child_process").execFileSync(ffmpeg(), ["-y", "-hide_banner", "-loglevel", "error", "-i", ham, "-ar", "24000", "-ac", "1", "-b:a", "96k", "-f", "mp3", mp3],
        { timeout: 60000, stdio: ["ignore", "ignore", "pipe"] });
      return { buf: fs.readFileSync(mp3), kelimeler: [] };
    } finally {
      for (const f of [txt, ps1, ham, mp3]) { try { fs.unlinkSync(f); } catch (e) { /* yoksay */ } }
    }
  }
  return { ad: "sistem", kelimeZamani: false, ses: "sistem-" + kultur, sentez, sifirla: async () => {}, kapat: () => {} };
}

module.exports = { olustur, hazirMi, hizAdimi, KULTUR, varsayilanCalistir };
