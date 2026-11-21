#!/usr/bin/env node
// Piper yerel ses motorunu kurar: internetsiz, ekran kartsiz, cok dusuk donanimda calisan yedek ses (Raspberry Pi'de bile calisir).
//   node araclar/piper-kur.js            Turkce ses (varsayilan)
//   node araclar/piper-kur.js --dil en   Ingilizce ses
//   node araclar/piper-kur.js --kontrol  kuruluysa dosyalari SHA256 ile dogrula ve kisa bir deneme sesi uret
// Ne yapar: surume sabit Piper programini (MIT) ve ses modelini indirir, HER dosyanin SHA256'sini data/piper-sha256.json ile
// dogrular (tutmazsa siler, durur), ~/.otopilot/piper altina acar, .env'e PIPER_YOL ve PIPER_MODEL yazar, deneme sesi uretir.
// Indirme ~85 MB. LISANS: ses modellerinin veri setleri TICARI OLMAYAN lisanslidir (tr: CC BY-NC-SA 4.0); para kazanan kanalda
// birincil ses olarak kullanma. Piper, Otopilot'un "otomatik" sirasinda Edge'den sonra yedektir (internet/Edge kapaliysa).
// Cikis: 0 tamam · 2 desteklenmeyen platform/arguman · 3 indirme/ag · 4 SHA256 tutmadi · 5 acma/deneme hatasi
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const KOK = path.join(__dirname, "..");
const B = require(path.join(KOK, "lib", "butunluk.js"));
const T = JSON.parse(fs.readFileSync(path.join(KOK, "data", "piper-sha256.json"), "utf8"));

const HEDEF = process.env.OTOPILOT_PIPER_KOK || path.join(os.homedir(), ".otopilot", "piper");
const platformAnahtari = () => `${process.platform}-${process.arch === "arm64" ? "arm64" : "x64"}`;
const exe = () => path.join(HEDEF, "piper", process.platform === "win32" ? "piper.exe" : "piper");

// zip/tar.gz acma: Windows 10+ kendi bsdtar'i zip de acar (Git Bash'in GNU tar'i acamaz: o yuzden tam yol)
function ac(arsiv, hedef) {
  fs.mkdirSync(hedef, { recursive: true });
  const winTar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
  const tar = process.platform === "win32" && fs.existsSync(winTar) ? winTar : "tar";
  let r = spawnSync(tar, ["-xf", arsiv, "-C", hedef], { encoding: "utf8", windowsHide: true });
  if (r.status !== 0 && process.platform === "win32")
    r = spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${arsiv}' -DestinationPath '${hedef}' -Force`], { encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw Object.assign(new Error("arşiv açılamadı: " + String(r.stderr || "").split("\n")[0]), { cikis: 5 });
}

function dene(model) {
  const wav = path.join(os.tmpdir(), `otopilot-piper-${process.pid}.wav`);
  const r = spawnSync(exe(), ["--model", model, "--output_file", wav], { input: "Otopilot yerel ses denemesi.", encoding: "utf8", windowsHide: true, timeout: 120000 });
  const ok = r.status === 0 && fs.existsSync(wav) && fs.statSync(wav).size > 10000;
  try { fs.unlinkSync(wav); } catch (e) { /* yok */ }
  return { ok, hata: ok ? "" : String(r.stderr || r.error || "").split("\n").filter(Boolean).slice(-1)[0] };
}

async function main(argv) {
  const i = argv.indexOf("--dil");
  const dil = i >= 0 ? String(argv[i + 1] || "").toLowerCase() : "tr";
  const ses = T.sesler[dil];
  if (!ses) { console.log(`✗ '${dil}' için sabitlenmiş Piper sesi yok. Var olanlar: ${Object.keys(T.sesler).join(", ")}`); return 2; }
  const prog = T.program[platformAnahtari()];
  if (!prog) { console.log(`✗ Bu platform için hazır Piper yok (${platformAnahtari()}). Linux ARM'de: pip install piper-tts`); return 2; }
  const indir = path.join(HEDEF, "indirmeler");
  const modelYol = path.join(HEDEF, "sesler", ses.ad + ".onnx");

  if (argv.includes("--kontrol")) {
    if (!fs.existsSync(exe()) || !fs.existsSync(modelYol)) { console.log("✗ Piper kurulu değil: node araclar/piper-kur.js" + (dil !== "tr" ? " --dil " + dil : "")); return 2; }
    const dogru = (await B.sha256Dosya(modelYol)) === ses.model.sha256;
    console.log(`  ${dogru ? "✔" : "✗"} model SHA256 (${ses.ad})`);
    const d = dene(modelYol);
    console.log(`  ${d.ok ? "✔" : "✗"} deneme sesi${d.ok ? "" : ": " + d.hata}`);
    return dogru && d.ok ? 0 : 4;
  }

  console.log(`Piper ${T.surum} (${platformAnahtari()}) + ses ${ses.ad} → ${HEDEF}`);
  console.log(`LİSANS: ${ses.lisans}. Para kazanan kanalda birincil ses olarak kullanma; Otopilot onu yalnız Edge çalışmazsa yedek olarak kullanır.`);
  const ilerleme = ad => (n, top) => { if (process.stdout.isTTY) process.stdout.write(`\r  ${ad}: ${Math.round(n / 1048576)}/${Math.round((top || n) / 1048576)} MB`); };
  try {
    const arsiv = path.join(indir, path.basename(new URL(prog.url).pathname));
    const a = await B.guvenliIndir(prog.url, arsiv, prog, { ilerleme: ilerleme("program") });
    console.log(`\n  ✔ program ${a.indirildi ? "indirildi" : "zaten vardı"}, SHA256 doğru`);
    if (!fs.existsSync(exe())) ac(arsiv, HEDEF);
    for (const [ad, x, hedef] of [["model", ses.model, modelYol], ["ayar", ses.ayar, modelYol + ".json"]]) {
      const r = await B.guvenliIndir(x.url, hedef, x, { ilerleme: ilerleme(ad) });
      console.log(`\n  ✔ ${ad} ${r.indirildi ? "indirildi" : "zaten vardı"}, SHA256 doğru`);
    }
  } catch (e) {
    console.log("\n✗ " + e.message);
    return e.kod === "sha256_tutmadi" ? 4 : (e.cikis || 3);
  }
  if (process.platform !== "win32") { try { fs.chmodSync(exe(), 0o755); } catch (e) { /* zaten calistirilabilir */ } }
  const d = dene(modelYol);
  if (!d.ok) { console.log("✗ Piper deneme sesi üretemedi: " + d.hata); return 5; }
  console.log("  ✔ deneme sesi üretildi");
  try {
    require(path.join(KOK, "lib", "ortak.js")).envYaz({ ayarla: { PIPER_YOL: exe(), PIPER_MODEL: modelYol } });
    console.log("  ✔ .env: PIPER_YOL ve PIPER_MODEL yazıldı");
  } catch (e) { console.log(`  ! .env yazılamadı (${e.message}); elle ekle:\n    PIPER_YOL=${exe()}\n    PIPER_MODEL=${modelYol}`); }
  console.log(`\nKullanım: node seslendir.js <is> --motor piper  (ya da 'otomatik': Edge çalışmazsa kendiliğinden Piper)`);
  return 0;
}
if (require.main === module) main(process.argv.slice(2)).then(k => { process.exitCode = k; }).catch(e => { console.error("HATA " + e.message); process.exitCode = 1; });
module.exports = { main, ac, platformAnahtari };
