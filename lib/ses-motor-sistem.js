// lib/ses-motor-sistem.js — isletim sisteminin KENDI sesi: kurulum, anahtar, internet gerektirmez. Son care yedek motor.
//   Windows: WinRT Windows.Media.SpeechSynthesis (OneCore sesleri; Ayarlar > Konusma'dan kurulanlar, or. Microsoft Tolga),
//            yoksa System.Speech (SAPI masaustu sesleri)
//   macOS  : say -v <dile uygun ses> ('say -v ?' listesinden)      Linux: espeak-ng / espeak -v <dil>
// Kalite orta (robotik) ama her makinede calisir; Edge sesi servisi kapaninca video yine de biter.
//
// NEDEN WinRT: System.Speech, Ayarlar'dan kurulan OneCore seslerini GORMEZ. Turkce Windows 11'de olculdu: System.Speech
// yalniz en-US David/Zira'yi buluyordu, kurulu "Microsoft Tolga (tr-TR)" WinRT AllVoices'ta vardi; Turkce senaryo Zira'yla
// (Ingilizce aksanla) okunup is "basarili" bitiyordu.
// Ses secimi: dilin kulturuyle (tr -> tr-TR) eslesen ilk ses, yoksa ayni dilin baska bolge sesi. O dilde HIC ses yoksa
// varsayilan sesle OKUNMAZ: kalici hata (cozumuyle); otomatik sira ve paragraf_dustu/motor_hata yolu bunu tasir.
// Kelime zamani vermez. WAV/AIFF, ffmpeg ile mp3'e (24 kHz mono 96 kbps) cevrilir.
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

// "+7%" -> WinRT SpeakingRate x100 (107). Tamsayi gecer: PowerShell'e ondalik yollamak yerel ayarin virgulune takilmasin.
// WinRT araligi 0,5..6,0; bizim hiz -50..+50 -> 50..150.
function winrtOran(hiz) {
  const m = /^([+-]\d{1,2})%$/.exec(String(hiz || ""));
  return Math.max(50, Math.min(600, 100 + (m ? Number(m[1]) : 0)));
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

// Cikis 3 + "SES_YOK <kultur>": o dilde ses yok (varsayilan sesle OKUNMAZ). Basarida stdout: "SES <ad>|<dil>".
const PS_BETIK = [
  "param([string]$Metin,[string]$Cikti,[string]$Kultur,[int]$Oran,[int]$Hiz)",
  "$ErrorActionPreference = 'Stop'",
  "try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }",
  "$m = [System.IO.File]::ReadAllText($Metin, [System.Text.Encoding]::UTF8)",
  "$iki = $Kultur.Substring(0,2)",
  "# 1) WinRT: OneCore sesleri (System.Speech bunlari gormez)",
  "$v = $null",
  "try {",
  "  Add-Type -AssemblyName System.Runtime.WindowsRuntime",
  "  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]",
  "  $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]",
  "  $tum = @([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices)",
  "  $v = $tum | Where-Object { $_.Language -eq $Kultur } | Select-Object -First 1",
  "  if (-not $v) { $v = $tum | Where-Object { $_.Language.Length -ge 2 -and $_.Language.Substring(0,2) -eq $iki } | Select-Object -First 1 }",
  "} catch { $v = $null; [Console]::Error.WriteLine('WINRT_YOK ' + $_.Exception.Message) }",
  "if ($v) {",
  "  $gen = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
  "  function Bekle($op, [Type]$t) { $task = $gen.MakeGenericMethod($t).Invoke($null, @($op)); $null = $task.Wait(-1); $task.Result }",
  "  $s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer",
  "  $s.Voice = $v",
  "  try { $s.Options.SpeakingRate = $Oran / 100.0 } catch { }",
  "  $st = Bekle ($s.SynthesizeTextToStreamAsync($m)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])",
  "  $r = New-Object Windows.Storage.Streams.DataReader($st.GetInputStreamAt(0))",
  "  $n = Bekle ($r.LoadAsync([uint32]$st.Size)) ([uint32])",
  "  $b = New-Object byte[] $n",
  "  $r.ReadBytes($b)",
  "  [System.IO.File]::WriteAllBytes($Cikti, $b)",
  "  [Console]::Out.WriteLine('SES ' + $v.DisplayName + '|' + $v.Language)",
  "  exit 0",
  "}",
  "# 2) System.Speech (SAPI masaustu sesleri)",
  "Add-Type -AssemblyName System.Speech",
  "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
  "$ses = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq $Kultur } | Select-Object -First 1",
  "if (-not $ses) { $ses = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq $iki } | Select-Object -First 1 }",
  "if (-not $ses) { $s.Dispose(); [Console]::Error.WriteLine('SES_YOK ' + $Kultur); exit 3 }",
  "$s.SelectVoice($ses.VoiceInfo.Name)",
  "$s.Rate = $Hiz",
  "$s.SetOutputToWaveFile($Cikti)",
  "$s.Speak($m)",
  "$s.Dispose()",
  "[Console]::Out.WriteLine('SES ' + $ses.VoiceInfo.Name + '|' + $ses.VoiceInfo.Culture.Name)",
].join("\n");

// sinyal: zaman asimi/iptal gelirse surec oldurulur (yoksa PowerShell arka planda okumaya devam ederdi)
function varsayilanCalistir(o) {
  return new Promise((coz, red) => {
    let c;
    try { c = spawn(o.komut, o.argv, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { return red(e); }
    let stdout = "", stderr = "", bitti = false;
    const bitir = (hataNesnesi, deger) => {
      if (bitti) return;
      bitti = true;
      clearTimeout(zaman);
      if (o.sinyal) o.sinyal.removeEventListener("abort", iptal);
      if (hataNesnesi) red(hataNesnesi); else coz(deger);
    };
    const oldur = () => { try { c.kill(); } catch (e) { /* yoksay */ } };
    const iptal = () => { oldur(); bitir((o.sinyal && o.sinyal.reason) || new Error("iptal edildi")); };
    const zaman = setTimeout(() => { oldur(); bitir(new Error("Sistem sesi zaman aşımı")); }, o.zamanAsimiMs || 120000);
    if (o.sinyal) {
      if (o.sinyal.aborted) return iptal();
      o.sinyal.addEventListener("abort", iptal, { once: true });
    }
    c.stdout.on("data", d => { stdout = (stdout + d).slice(-2000); });
    c.stderr.on("data", d => { stderr = (stderr + d).slice(-2000); });
    c.on("error", e => bitir(e));
    c.on("close", kod => bitir(null, { kod, stdout, stderr }));
  });
}

// macOS 'say -v ?' satirlari: "Yelda               tr_TR    # Merhaba..." ; ad bosluk/parantez icerebilir, yerel ayar
// tr_TR, ar_001, en-scotland gibi olabilir. -> [{ad, yerel}]
function macSesleriniCoz(metin) {
  const liste = [];
  for (const satir of String(metin || "").split(/\r?\n/)) {
    const m = /^(.+?)\s+([a-z]{2,3}(?:[_-][A-Za-z0-9-]+)?)\s+#/.exec(satir);
    if (m) liste.push({ ad: m[1].trim(), yerel: m[2] });
  }
  return liste;
}

// kultur "tr-TR" ile once tam (tr_TR), sonra ayni dil (tr_*) eslesen ilk ses; yoksa null
function macSesiSec(liste, kultur) {
  const norm = s => String(s).toLowerCase().replace(/_/g, "-");
  const iki = norm(kultur).slice(0, 2);
  return liste.find(s => norm(s.yerel) === norm(kultur)) ||
         liste.find(s => norm(s.yerel).split("-")[0] === iki) || null;
}

let macSesOnbellek = null;
function macSesleriOku() {
  if (macSesOnbellek === null) {
    try {
      const r = spawnSync("say", ["-v", "?"], { encoding: "utf8", timeout: 15000, windowsHide: true });
      macSesOnbellek = r.status === 0 ? String(r.stdout || "") : "";
    } catch (e) { macSesOnbellek = ""; }
  }
  return macSesOnbellek;
}

const SES_KUR = {
  win32: "Windows: Ayarlar > Zaman ve dil > Konuşma > Sesleri yönet > Ses ekle bölümünden bu dilin sesini kur",
  darwin: "macOS: Sistem Ayarları > Erişilebilirlik > Seslendirilen İçerik > Sistem Sesi > Sesleri Yönet'ten bu dilde bir ses indir",
  linux: "Linux: espeak-ng'nin bu dili desteklediğini kontrol et (espeak-ng --voices)",
};

function sesYokHatasi(kultur, platform) {
  return hata("Sistemde " + kultur + " sesi yok; metin başka dildeki sesle okunmaz.", {
    kalici: true, kod: "sistem_ses_yok",
    cozum: (SES_KUR[platform] || SES_KUR.linux) + " ya da başka bir ses motoru seç (Edge, Azure, VoxCPM).",
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
  const log = ayar.log || (() => {});
  const uyar = ayar.uyar || log;
  let sesBildirildi = false;          // secilen ses adi motor basina BIR kez yazilir (eskiden modul duzeyinde bayrak vardi)

  // macOS: dile uygun sesi bir kez sec (yoksa kalici hata: varsayilan sesle OKUMA)
  let macSesi = null;
  function macSesiBul() {
    if (macSesi) return macSesi;
    const metin = typeof ayar.macSesleri === "function" ? ayar.macSesleri() : macSesleriOku();
    const s = macSesiSec(macSesleriniCoz(metin), kultur);
    if (!s) throw sesYokHatasi(kultur, platform);
    macSesi = s;
    return s;
  }

  async function sentez(metin, secenek) {
    const ara = (secenek && secenek.araDizin) || os.tmpdir();
    const govde = path.join(ara, "sistem-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
    const txt = govde + ".txt", ps1 = govde + ".ps1", ham = govde + (platform === "darwin" ? ".aiff" : ".wav"), mp3 = govde + ".mp3";
    try {
      let komut, argv, secilen = null;
      if (platform === "darwin") {
        const s = macSesiBul();
        secilen = s.ad + " (" + s.yerel + ")";
        komut = "say"; argv = ["-v", s.ad, "-o", ham, "-r", String(175 + hizAdimi(ayar.hiz) * 12), "-f", txt];
      }
      fs.writeFileSync(txt, String(metin).replace(/\s*\n\s*/g, " "), "utf8");
      if (platform === "win32") {
        fs.writeFileSync(ps1, "﻿" + PS_BETIK, "utf8");
        komut = "powershell.exe";
        argv = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1, "-Metin", txt, "-Cikti", ham,
          "-Kultur", kultur, "-Oran", String(winrtOran(ayar.hiz)), "-Hiz", String(hizAdimi(ayar.hiz))];
      } else if (platform !== "darwin") {
        komut = espeak; argv = ["-v", dil, "-s", String(165 + hizAdimi(ayar.hiz) * 12), "-w", ham, "-f", txt];
      }
      const r = await calistir({ komut, argv, zamanAsimiMs: ayar.zamanAsimiMs || 120000, sinyal: secenek && secenek.sinyal });
      const stderr = String(r.stderr || "");
      // o dilde ses yok: yanlis dilde ses URETILMEZ (eski betik varsayilan sesle okuyup cikis 0 veriyordu)
      if (/SES_YOK/.test(stderr) || (platform !== "win32" && platform !== "darwin" && /Failed to read voice/i.test(stderr)))
        throw sesYokHatasi(kultur, platform);
      if (r.kod !== 0) throw hata("Sistem sesi hata verdi (kod " + r.kod + "): " + stderr.trim().split("\n").pop());
      const m = /SES ([^\r\n|]+)\|([^\r\n]*)/.exec(String(r.stdout || ""));
      if (m) secilen = m[1].trim() + " (" + m[2].trim() + ")";
      if (!fs.existsSync(ham) || fs.statSync(ham).size < 100) throw hata("Sistem sesi dosya üretmedi");
      if (secilen && !sesBildirildi) {
        sesBildirildi = true;
        log("Sistem sesi: " + secilen + " (kalite orta, kelime zamanı yok).");
        // ayni dilin baska bolge sesi (or. pt-PT yerine pt-BR istendi): duyulur fark olabilir, kullanici bilsin
        if (m && m[2].trim() && m[2].trim().toLowerCase() !== kultur.toLowerCase())
          uyar("Sistemde " + kultur + " sesi yok; aynı dilin " + m[2].trim() + " sesi kullanıldı (" + m[1].trim() + ").");
      }
      require("child_process").execFileSync(ffmpeg(), ["-y", "-hide_banner", "-loglevel", "error", "-i", ham, "-ar", "24000", "-ac", "1", "-b:a", "96k", "-f", "mp3", mp3],
        { timeout: 60000, stdio: ["ignore", "ignore", "pipe"] });
      return { buf: fs.readFileSync(mp3), kelimeler: [] };
    } finally {
      for (const f of [txt, ps1, ham, mp3]) { try { fs.unlinkSync(f); } catch (e) { /* yoksay */ } }
    }
  }
  return { ad: "sistem", kelimeZamani: false, ses: "sistem-" + kultur, sentez, sifirla: async () => {}, kapat: () => {} };
}

module.exports = { olustur, hazirMi, hizAdimi, winrtOran, KULTUR, varsayilanCalistir, macSesleriniCoz, macSesiSec, PS_BETIK };
