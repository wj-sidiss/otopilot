#!/usr/bin/env node
// cinecode (Sarp Yildiz, MIT) yetenegini Otopilot'a esitler: .claude/skills/cinecode/
//   npm run cinecode-guncelle                 -> GitHub'dan en yeni surumu ceker (git gerekir)
//   node araclar/cinecode-esitle.js --kaynak <klasor>   -> zaten indirilmis bir kopyadan esitler
// Yalniz asagidaki parcalar alinir (tanitim videolari/resimleri ve kitin kendi testleri alinmaz).
// Hedef klasor bastan yazilir; baska hicbir yere dokunmaz.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const KOK = path.join(__dirname, "..");
const HEDEF = path.join(KOK, ".claude", "skills", "cinecode");
const DEPO = "https://github.com/sarpstar/cinecode.git";
const PARCALAR = ["SKILL.md", "AGENTS.md", "LICENSE", "references", "styles", "templates", "starter", "scripts"];

function kopyala(kaynak, hedef) {
  const st = fs.statSync(kaynak);
  if (st.isDirectory()) {
    fs.mkdirSync(hedef, { recursive: true });
    for (const ad of fs.readdirSync(kaynak)) {
      if (ad === "__pycache__" || ad === ".DS_Store") continue;
      kopyala(path.join(kaynak, ad), path.join(hedef, ad));
    }
  } else fs.copyFileSync(kaynak, hedef);
}

function esitle(kaynak, o) {
  const log = (o && o.log) || (m => console.log(m));
  for (const p of PARCALAR) if (!fs.existsSync(path.join(kaynak, p))) throw new Error("cinecode kopyasinda eksik: " + p);
  if (!/^name:\s*cinecode\b/m.test(fs.readFileSync(path.join(kaynak, "SKILL.md"), "utf8"))) throw new Error("SKILL.md cinecode'a ait gorunmuyor");
  if (!/MIT License/.test(fs.readFileSync(path.join(kaynak, "LICENSE"), "utf8"))) throw new Error("LICENSE MIT degil; esitleme durdu");
  const hedef = (o && o.hedef) || HEDEF;
  const gecici = hedef + ".yeni";
  fs.rmSync(gecici, { recursive: true, force: true });
  fs.mkdirSync(gecici, { recursive: true });
  for (const p of PARCALAR) kopyala(path.join(kaynak, p), path.join(gecici, p));
  const surum = spawnSync("git", ["-C", kaynak, "log", "-1", "--format=%h %cs"], { encoding: "utf8" });
  const imza = surum.status === 0 ? surum.stdout.trim() : "bilinmiyor";
  fs.writeFileSync(path.join(gecici, "KAYNAK.txt"),
    "cinecode — https://github.com/sarpstar/cinecode (Sarp Yildiz, MIT; styles/ icindeki bir kismi LemoLab, MIT: styles/LICENSE-lemo-opuscar)\n" +
    "Surum: " + imza + "\nEsitleme: " + new Date().toISOString() + "\nGuncelleme: npm run cinecode-guncelle\n");
  fs.rmSync(hedef, { recursive: true, force: true });
  fs.renameSync(gecici, hedef);
  log("  cinecode esitlendi (" + imza + "): " + path.relative(KOK, hedef));
  return { surum: imza, hedef };
}

function main(argv) {
  const i = argv.indexOf("--kaynak");
  if (i !== -1) { esitle(path.resolve(argv[i + 1])); return 0; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cinecode-"));
  try {
    const r = spawnSync("git", ["clone", "--depth", "1", "--quiet", DEPO, tmp], { stdio: "inherit" });
    if (r.status !== 0) { console.error("  HATA git clone basarisiz (internet ya da git?)"); return 3; }
    esitle(tmp);
    return 0;
  } catch (e) { console.error("  HATA " + e.message); return 2; }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { esitle, PARCALAR };
