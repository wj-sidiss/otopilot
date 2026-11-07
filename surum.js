#!/usr/bin/env node
// Surum otomasyonu.
//   1) npm run surum -- patch|minor|major|x.y.z "Baslik"   -> surumu yukseltir, CHANGELOG'a taslak bolum ekler (commit yok;
//      en ustte "## [Yayınlanmamış]" varsa taslak eklenmez, o bolum yeni surumun basligini alir)
//   2) CHANGELOG'daki TASLAK satirini doldur
//   3) npm run surum -- --yayinla                           -> kapi + commit + etiket (vX.Y.Z) + push (main)
// Taslak doluyken, kapi kapaliyken ya da etiket zaten varken yayin reddedilir.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const KOK = __dirname;
const P = (f) => path.join(KOK, f);

function sonraki(simdiki, tur) {
  if (/^\d+\.\d+\.\d+$/.test(tur)) return tur;
  const [a, b, c] = simdiki.split(".").map(Number);
  if (tur === "major") return `${a + 1}.0.0`;
  if (tur === "minor") return `${a}.${b + 1}.0`;
  if (tur === "patch") return `${a}.${b}.${c + 1}`;
  throw new Error("tur: patch | minor | major | x.y.z");
}

// JSON'u bicimini bozmadan guncelle: yalnizca ilk "version" satirlari degisir
function jsonSurumYaz(dosya, eski, yeni, adet) {
  const s = fs.readFileSync(P(dosya), "utf8");
  let n = 0;
  const cikti = s.replace(new RegExp(`("version"\\s*:\\s*)"${eski.replace(/\./g, "\\.")}"`, "g"), (m, on) => (n++ < adet ? `${on}"${yeni}"` : m));
  fs.writeFileSync(P(dosya), cikti);
}

function degistir(tur, baslik, tarih = new Date().toISOString().slice(0, 10)) {
  const pkg = JSON.parse(fs.readFileSync(P("package.json"), "utf8"));
  const eski = pkg.version, yeni = sonraki(eski, tur);
  if (yeni === eski) throw new Error("yeni surum eskisiyle ayni");
  jsonSurumYaz("package.json", eski, yeni, 1);
  jsonSurumYaz("package-lock.json", eski, yeni, 2); // kok + packages[""]
  let cl = fs.readFileSync(P("CHANGELOG.md"), "utf8");
  const crlf = cl.includes("\r\n");
  cl = cl.replace(/\r\n/g, "\n");
  cl = changelogBolumu(cl, yeni, tarih, baslik);
  fs.writeFileSync(P("CHANGELOG.md"), crlf ? cl.replace(/\n/g, "\r\n") : cl);
  return { eski, yeni };
}

// CHANGELOG'a yeni surum bolumu. En ustteki bolum "## [Yayınlanmamış]" ise yeni surum basligina DONUSTURULUR
// (icerigi korunur, taslak eklenmez); yoksa ilk bolumun ustune TASLAK bolum eklenir.
function changelogBolumu(cl, yeni, tarih, baslik) {
  const baslikSatiri = `## [${yeni}] — ${tarih} — ${baslik}`;
  const ilk = /^## \[([^\]]*)\][^\n]*$/m.exec(cl);
  if (ilk && ilk[1] === "Yayınlanmamış") return cl.slice(0, ilk.index) + baslikSatiri + cl.slice(ilk.index + ilk[0].length);
  return cl.replace(/^## \[/m, `${baslikSatiri}\n\n### Eklenenler\n- TASLAK: buraya yaz\n\n## [`);
}

function git(...a) { return execFileSync("git", a, { cwd: KOK, encoding: "utf8" }).trim(); }

function yayinla(yeni) {
  const cl = fs.readFileSync(P("CHANGELOG.md"), "utf8");
  if (cl.includes("TASLAK: buraya yaz")) throw new Error("CHANGELOG hala taslak; once doldur");
  if (git("tag", "-l", `v${yeni}`)) throw new Error(`v${yeni} etiketi zaten var`);
  const kapi = spawnSync(process.execPath, [P("kapi.js"), "--ilgili"], { cwd: KOK, stdio: "inherit" });   // degisen dosyalara bagli testler de kosar
  if (kapi.status !== 0) throw new Error("kapi kapali; yayin durdu");
  const kirli = git("status", "--porcelain").split("\n").filter(Boolean).map((l) => l.slice(3));
  const bizim = ["package.json", "package-lock.json", "CHANGELOG.md"];
  const baska = kirli.filter((f) => !bizim.includes(f));
  if (baska.length) console.log("  not: su dosyalar commit'e GIRMEYECEK (baska is): " + baska.join(", "));
  git("add", ...bizim);
  git("commit", "-m", `Surum ${yeni}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`);
  git("tag", "-a", `v${yeni}`, "-m", `v${yeni}`);
  git("push", "origin", "HEAD:main");
  git("push", "origin", `v${yeni}`);
  console.log(`  yayinlandi: v${yeni} (main + etiket)`);
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--"));
  const bayrak = argv.filter((a) => a.startsWith("--"));
  if (bayrak.includes("--yayinla") && !args.length) {
    try { yayinla(JSON.parse(fs.readFileSync(P("package.json"), "utf8")).version); return 0; }
    catch (e) { console.error("  HATA " + e.message); return 1; }
  }
  if (args.length < 2) { console.error('kullanim: npm run surum -- patch|minor|major|x.y.z "Baslik"   sonra   npm run surum -- --yayinla'); return 2; }
  try {
    const { eski, yeni } = degistir(args[0], args.slice(1).join(" "));
    console.log(`  ${eski} -> ${yeni} (package.json, package-lock.json, CHANGELOG.md)`);
    console.log("  simdi CHANGELOG'daki TASLAK satirini doldur, sonra: npm run surum -- --yayinla");
    return 0;
  } catch (e) { console.error("  HATA " + e.message); return 1; }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { sonraki, degistir, changelogBolumu };
