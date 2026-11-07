// cinecode yetenegi: depodaki kopya eksiksiz ve lisansli; esitleme yalniz hedef klasore yazar, lisans/SKILL denetimi yapar. Ag yok.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const E = require("../araclar/cinecode-esitle.js");

const KIT = path.join(__dirname, "..", ".claude", "skills", "cinecode");

test("depodaki cinecode kopyasi: SKILL, MIT lisans, LemoLab lisansi, kaynak notu ve ana araclar yerinde", () => {
  assert.match(fs.readFileSync(path.join(KIT, "SKILL.md"), "utf8"), /^name:\s*cinecode/m);
  assert.match(fs.readFileSync(path.join(KIT, "LICENSE"), "utf8"), /MIT License[\s\S]*Sarp/);
  assert.match(fs.readFileSync(path.join(KIT, "styles", "LICENSE-lemo-opuscar"), "utf8"), /MIT License[\s\S]*LemoLab/);
  assert.match(fs.readFileSync(path.join(KIT, "KAYNAK.txt"), "utf8"), /sarpstar\/cinecode/);
  for (const f of ["scripts/init_film.py", "scripts/make.py", "scripts/capture.mjs", "scripts/hook.cjs", "templates/quick/film.html", "starter/index.html", "references/quick-mode.md"])
    assert.ok(fs.existsSync(path.join(KIT, f)), f);
  assert.ok(!fs.existsSync(path.join(KIT, "docs")), "tanitim medyasi alinmaz");
});

test("esitle: yalniz hedefe yazar, eski hedefi tamamen yeniler; lisans MIT degilse ya da SKILL baskasininsa durur", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cc-"));
  try {
    const kaynak = path.join(d, "kaynak"), hedef = path.join(d, "hedef");
    for (const p of ["references", "styles", "templates", "starter", "scripts"]) {
      fs.mkdirSync(path.join(kaynak, p), { recursive: true });
      fs.writeFileSync(path.join(kaynak, p, "a.md"), "x");
    }
    fs.mkdirSync(path.join(kaynak, "scripts", "__pycache__"), { recursive: true });
    fs.writeFileSync(path.join(kaynak, "scripts", "__pycache__", "x.pyc"), "x");
    fs.writeFileSync(path.join(kaynak, "SKILL.md"), "---\nname: cinecode\n---\n");
    fs.writeFileSync(path.join(kaynak, "AGENTS.md"), "x");
    fs.writeFileSync(path.join(kaynak, "LICENSE"), "MIT License\nCopyright Sarp");
    fs.mkdirSync(path.join(kaynak, "docs")); fs.writeFileSync(path.join(kaynak, "docs", "buyuk.mp4"), "x");
    fs.mkdirSync(hedef); fs.writeFileSync(path.join(hedef, "eski.txt"), "silinmeli");
    E.esitle(kaynak, { hedef, log: () => {} });
    assert.ok(fs.existsSync(path.join(hedef, "SKILL.md")) && fs.existsSync(path.join(hedef, "KAYNAK.txt")));
    assert.ok(!fs.existsSync(path.join(hedef, "eski.txt")), "eski hedef yenilendi");
    assert.ok(!fs.existsSync(path.join(hedef, "docs")), "docs alinmaz");
    assert.ok(!fs.existsSync(path.join(hedef, "scripts", "__pycache__")), "onbellek alinmaz");
    fs.writeFileSync(path.join(kaynak, "LICENSE"), "GPL");
    assert.throws(() => E.esitle(kaynak, { hedef, log: () => {} }), /MIT degil/);
    fs.writeFileSync(path.join(kaynak, "LICENSE"), "MIT License");
    fs.writeFileSync(path.join(kaynak, "SKILL.md"), "---\nname: baska\n---\n");
    assert.throws(() => E.esitle(kaynak, { hedef, log: () => {} }), /cinecode'a ait/);
    assert.ok(fs.existsSync(path.join(hedef, "SKILL.md")), "basarisiz esitleme mevcut kopyayi bozmaz");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
