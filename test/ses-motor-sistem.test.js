// Sistem sesi motoru: komut kurulumu (Windows/macOS/Linux), dil->kultur, hiz adimi, otomatik sirada son motor.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const sistem = require("../lib/ses-motor-sistem.js");
const M = require("../lib/ses-motor.js");

function wavYaz(yol) {                       // 0,2 sn sessizlik: gecerli 16 bit mono 16 kHz WAV
  const n = 3200, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  fs.writeFileSync(yol, b);
}

test("hizAdimi: +%7 -> 1, -%50 -> -5, sinir -10..10, gecersiz -> 0", () => {
  assert.equal(sistem.hizAdimi("+7%"), 1); assert.equal(sistem.hizAdimi("-50%"), -5);
  assert.equal(sistem.hizAdimi("+99%"), 10); assert.equal(sistem.hizAdimi("x"), 0); assert.equal(sistem.hizAdimi(undefined), 0);
});

for (const [platform, beklenen] of [["win32", "powershell.exe"], ["darwin", "say"], ["linux", "espeak-ng"]]) {
  test("sentez (" + platform + "): komut, dil kulturu, mp3 doner", async () => {
    let cagri;
    const m = sistem.olustur({ platform, dil: "tr", hiz: "+10%", espeak: "espeak-ng",
      calistir: async o => { cagri = o; wavYaz(o.argv[o.argv.indexOf({ win32: "-Cikti", darwin: "-o", linux: "-w" }[platform]) + 1]); return { kod: 0, stderr: "" }; } });
    const r = await m.sentez("Merhaba dünya");
    assert.equal(cagri.komut, beklenen);
    assert.ok(r.buf.length > 100 && r.buf[0] !== undefined);
    assert.equal(m.ad, "sistem"); assert.equal(m.kelimeZamani, false);
    if (platform === "win32") assert.ok(cagri.argv.includes("tr-TR"));
    if (platform === "linux") assert.ok(cagri.argv.includes("tr"));
  });
}

test("sentez: motor hata kodu verirse ya da dosya uretmezse hata firlatir", async () => {
  const m = sistem.olustur({ platform: "win32", dil: "en", calistir: async () => ({ kod: 1, stderr: "boom" }) });
  await assert.rejects(m.sentez("x"), /Sistem sesi hata verdi/);
  const m2 = sistem.olustur({ platform: "win32", dil: "en", calistir: async () => ({ kod: 0, stderr: "" }) });
  await assert.rejects(m2.sentez("x"), /dosya üretmedi/);
});

test("otomatik sira: sistem EN SONDA; acik secimle kullanilabilir", () => {
  assert.deepEqual(M.OTOMATIK_MOTORLAR.slice(-1), ["sistem"]);
  assert.ok(M.MOTORLAR.includes("sistem"));
  assert.deepEqual(M.motorSirasi("sistem", () => "", { sistemCalistir: true }), ["sistem"]);
});
