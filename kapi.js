#!/usr/bin/env node
// Yayin kapisi: push/surum oncesi agsiz kontroller. `npm run kapi` (hizli) | `-- --ilgili` (degisen dosyalara bagli testler) | `-- --tam` (tum testler).
// Cikis kodu 0 = gecti, 1 = hata var. Uyarilar cikis kodunu etkilemez.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const KOK = __dirname;
const hatalar = [];
const uyarilar = [];
const tamam = [];

function git(...a) {
  try { return execFileSync("git", a, { cwd: KOK, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}
const hata = (m) => hatalar.push(m);
const uyari = (m) => uyarilar.push(m);
const ok = (m) => tamam.push(m);

// 1) surum = CHANGELOG'un ilk surumu
function surumDenetimi() {
  const pkg = JSON.parse(fs.readFileSync(path.join(KOK, "package.json"), "utf8"));
  const cl = fs.readFileSync(path.join(KOK, "CHANGELOG.md"), "utf8");
  const m = cl.match(/^## \[(\d+\.\d+\.\d+)\]/m);
  if (!m) return hata("CHANGELOG.md icinde '## [x.y.z]' basligi yok");
  if (m[1] !== pkg.version) hata(`package.json ${pkg.version} ama CHANGELOG ilk surum ${m[1]}`);
  else ok(`surum ${pkg.version} = CHANGELOG`);
  const lock = JSON.parse(fs.readFileSync(path.join(KOK, "package-lock.json"), "utf8"));
  if (lock.version && lock.version !== pkg.version) hata(`package-lock.json surumu ${lock.version} (beklenen ${pkg.version})`);
}

// 2) izlenen dosyalarda sir ve izlenmemesi gerekenler
const SIR = [
  [/\bsk-[A-Za-z0-9_-]{20,}/, "sk- anahtari"],
  [/\bAIza[0-9A-Za-z_-]{30,}/, "Google anahtari"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "GitHub anahtari"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack anahtari"],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, "ozel anahtar"],
  [/^\s*[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)\s*=\s*[^\s#"'<>$]{12,}\s*$/m, "anahtar atamasi"],
];
function sirDenetimi() {
  const liste = git("ls-files", "-z");
  if (liste === null) return uyari("git yok; sir taramasi atlandi");
  const dosyalar = liste.split("\0").filter(Boolean);
  const yasak = dosyalar.filter((f) => /(^|\/)\.env$/.test(f) || /^uretim\//.test(f) || /^ai-infapp\/data\//.test(f) || /\.(pem|p12)$/.test(f));
  yasak.forEach((f) => hata(`izlenmemesi gereken dosya depoda: ${f}`));
  let bulunan = 0;
  for (const f of dosyalar) {
    if (/\.(png|jpe?g|gif|mp[34]|webm|ttf|woff2?|ico|zip|lock)$/i.test(f) || f === "package-lock.json" || f === "kapi.js") continue;
    let s;
    try { const p = path.join(KOK, f); if (fs.statSync(p).size > 2e6) continue; s = fs.readFileSync(p, "utf8"); } catch { continue; }
    for (const [re, ad] of SIR) {
      if (re.test(s)) {
        // .env.ornek ve testlerdeki sahte degerler: yalnizca bos/ornek degerlere izin ver
        if (/\.env\.ornek$|(^|\/)test\//.test(f)) continue;
        hata(`olasi sir (${ad}): ${f}`); bulunan++;
      }
    }
  }
  if (!yasak.length && !bulunan) ok(`${dosyalar.length} izlenen dosyada sir/yasak dosya yok`);
}

// 3) sozdizimi: tum .js/.cjs dosyalari
function sozdizimi() {
  const liste = git("ls-files", "*.js", "*.cjs");
  if (liste === null) return;
  const dosyalar = liste.split("\n").filter((f) => f && !f.startsWith("panel-public/") && !f.startsWith("node_modules/"));
  let kotu = 0;
  for (const f of dosyalar) {
    const r = spawnSync(process.execPath, ["--check", path.join(KOK, f)], { encoding: "utf8" });
    if (r.status !== 0) { hata(`sozdizimi hatasi: ${f}: ${(r.stderr || "").split("\n")[0]}`); kotu++; }
  }
  if (!kotu) ok(`${dosyalar.length} betikte sozdizimi temiz`);
}

// 4) git durumu
function gitDurumu() {
  const dal = git("rev-parse", "--abbrev-ref", "HEAD");
  if (dal === null) return;
  const kirli = git("status", "--porcelain");
  if (kirli) uyari(`commitlenmemis degisiklik var (${kirli.split("\n").length} dosya) — sana ait degilse dokunma`);
  else ok("calisma agaci temiz");
  git("fetch", "-q");
  const onde = git("rev-list", "--count", "origin/main..HEAD");
  const geride = git("rev-list", "--count", "HEAD..origin/main");
  if (geride && Number(geride) > 0) uyari(`HEAD, origin/main'in ${geride} commit gerisinde`);
  if (onde && Number(onde) > 0) uyari(`${onde} commit henuz origin/main'de degil (dal: ${dal})`);
}

// 5) belge: README/AGENTS'te anilan npm betikleri gercekten var mi
function belgeDenetimi() {
  const pkg = JSON.parse(fs.readFileSync(path.join(KOK, "package.json"), "utf8"));
  const gecen = new Set();
  for (const d of ["README.md", "AGENTS.md", "CONTRIBUTING.md"]) {
    let s = ""; try { s = fs.readFileSync(path.join(KOK, d), "utf8"); } catch { continue; }
    for (const m of s.matchAll(/npm run ([a-z0-9:_-]+)/gi)) gecen.add(m[1]);
  }
  const yok = [...gecen].filter((n) => !pkg.scripts[n]);
  if (yok.length) hata(`belgelerde anilan ama package.json'da olmayan betik: ${yok.join(", ")}`);
  else ok(`belgelerde anilan ${gecen.size} npm betigi mevcut`);
}


// 6) ilgili testler: son etiketten (ya da origin/main'den) beri degisen dosyalara bagli test dosyalari.
// Bir test dosyasi secilir: kendisi degistiyse ya da degisen bir modulu require ediyorsa; panel-public degistiyse panel testleri.
function ilgiliTestDosyalari() {
  const taban = git("describe", "--tags", "--abbrev=0") || "origin/main";
  const degisen = new Set([
    ...(git("diff", "--name-only", taban) || "").split("\n"),
    ...(git("ls-files", "--others", "--exclude-standard") || "").split("\n"),
  ].filter(Boolean).map((f) => f.replace(/\\/g, "/")));
  const testler = (git("ls-files", "test/*.test.js", "video-indirici/test/*.test.js", "ai-infapp/test/*.test.js") || "").split("\n").filter(Boolean);
  for (const f of degisen) if (/\.test\.js$/.test(f) && fs.existsSync(path.join(KOK, f)) && !testler.includes(f)) testler.push(f);
  const moduller = [...degisen].filter((f) => /\.(c?js)$/.test(f) && !/\.test\.js$/.test(f) && !f.startsWith("panel-public/"));
  const panelDegisti = [...degisen].some((f) => f.startsWith("panel-public/") || f === "panel.js");
  const secilen = testler.filter((t) => {
    if (degisen.has(t)) return true;
    let s = "";
    try { s = fs.readFileSync(path.join(KOK, t), "utf8"); } catch { return false; }
    if (panelDegisti && /panel/.test(path.basename(t))) return true;
    return moduller.some((m) => {
      const ad = path.basename(m).replace(/\.(c?js)$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp("require\\([\"'][^\"']*[/\\\\.]" + ad + "(\\.c?js)?[\"']\\)").test(s);
    });
  });
  return { taban, degisen: degisen.size, secilen };
}

function ilgiliTestler() {
  const r = ilgiliTestDosyalari();
  if (!r.secilen.length) return ok("degisikliklere bagli test dosyasi yok (taban " + r.taban + ")");
  console.log("ilgili testler (" + r.secilen.length + " dosya, taban " + r.taban + ") calisiyor...");
  const k = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...r.secilen], { cwd: KOK, stdio: "inherit" });
  if (k.status !== 0) hata("ilgili testler basarisiz (" + r.secilen.join(", ") + ")");
  else ok(r.secilen.length + " ilgili test dosyasi gecti");
}

function main(argv) {
  const tam = argv.includes("--tam"), ilgili = argv.includes("--ilgili");
  surumDenetimi(); sirDenetimi(); sozdizimi(); belgeDenetimi(); gitDurumu();
  if (argv.includes("--liste")) { const r = ilgiliTestDosyalari(); console.log(r.secilen.join("\n")); return 0; }
  if (ilgili && !tam) ilgiliTestler();
  else if (tam) {
    console.log("testler calisiyor (birkac dakika)...");
    const r = spawnSync("npm", ["test"], { cwd: KOK, stdio: "inherit", shell: true });
    if (r.status !== 0) hata("npm test basarisiz");
    else ok("npm test gecti");
  } else uyari("testler calistirilmadi (ilgili testler: npm run kapi -- --ilgili, hepsi: --tam)");
  tamam.forEach((m) => console.log("  ok   " + m));
  uyarilar.forEach((m) => console.log("  uyari " + m));
  hatalar.forEach((m) => console.log("  HATA " + m));
  console.log(hatalar.length ? `\nKAPI KAPALI: ${hatalar.length} hata` : "\nKAPI ACIK");
  return hatalar.length ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main, ilgiliTestDosyalari };
