// Sistem sesi motoru: komut kurulumu (Windows/macOS/Linux), dil->kultur, hiz adimi, otomatik sirada son motor.
// O dilde ses yoksa varsayilan (yanlis dilde) sesle OKUNMAZ: kalici hata. Windows'ta WinRT (OneCore sesleri) once.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const sistem = require("../lib/ses-motor-sistem.js");
const M = require("../lib/ses-motor.js");
const S = require("./ses-sahte.js");
const testF = S.ffmpegTesti(test);

function wavYaz(yol) {                       // 0,2 sn sessizlik: gecerli 16 bit mono 16 kHz WAV
  const n = 3200, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  fs.writeFileSync(yol, b);
}
const CIKTI_BAYRAGI = { win32: "-Cikti", darwin: "-o", linux: "-w" };
const yazanCalistir = (platform, ek) => async o => {
  wavYaz(o.argv[o.argv.indexOf(CIKTI_BAYRAGI[platform]) + 1]);
  return Object.assign({ kod: 0, stderr: "", stdout: "" }, typeof ek === "function" ? ek(o) : ek);
};
// macOS 'say -v ?' ornek ciktisi (ad bosluk/parantez icerebilir; yerel ayar tr_TR / ar_001 / en-scotland)
const MAC_SESLERI = [
  "Albert              en_US    # Hello! My name is Albert.",
  "Eddy (English (UK)) en_GB    # Hello! My name is Eddy.",
  "Fiona               en-scotland # Hello, my name is Fiona.",
  "Majed               ar_001   # مرحبًا! اسمي ماجد.",
  "Yelda               tr_TR    # Merhaba, benim adım Yelda.",
  "Joana               pt_PT    # Olá! Chamo-me Joana.",
].join("\n");

test("hizAdimi: +%7 -> 1, -%50 -> -5, sinir -10..10, gecersiz -> 0; winrtOran: +%7 -> 107 (0,5..6,0 x100)", () => {
  assert.equal(sistem.hizAdimi("+7%"), 1); assert.equal(sistem.hizAdimi("-50%"), -5);
  assert.equal(sistem.hizAdimi("+99%"), 10); assert.equal(sistem.hizAdimi("x"), 0); assert.equal(sistem.hizAdimi(undefined), 0);
  assert.equal(sistem.winrtOran("+7%"), 107); assert.equal(sistem.winrtOran("-50%"), 50); assert.equal(sistem.winrtOran("x"), 100);
});

for (const [platform, beklenen] of [["win32", "powershell.exe"], ["darwin", "say"], ["linux", "espeak-ng"]]) {
  testF("sentez (" + platform + "): komut, dil kulturu, mp3 doner", async () => {
    let cagri;
    const m = sistem.olustur({ platform, dil: "tr", hiz: "+10%", espeak: "espeak-ng", macSesleri: () => MAC_SESLERI,
      calistir: yazanCalistir(platform, o => { cagri = o; return {}; }) });
    const r = await m.sentez("Merhaba dünya");
    assert.equal(cagri.komut, beklenen);
    assert.ok(r.buf.length > 100 && r.buf[0] !== undefined);
    assert.equal(m.ad, "sistem"); assert.equal(m.kelimeZamani, false); assert.equal(m.ses, "sistem-tr-TR");
    if (platform === "win32") {
      assert.equal(cagri.argv[cagri.argv.indexOf("-Kultur") + 1], "tr-TR");
      assert.equal(cagri.argv[cagri.argv.indexOf("-Oran") + 1], "110", "WinRT SpeakingRate x100");
      assert.equal(cagri.argv[cagri.argv.indexOf("-Hiz") + 1], "1", "SAPI yedegi icin Rate");
    }
    if (platform === "darwin") assert.deepEqual(cagri.argv.slice(0, 2), ["-v", "Yelda"], "dile uygun ses -v ile secilir");
    if (platform === "linux") assert.equal(cagri.argv[cagri.argv.indexOf("-v") + 1], "tr");
  });
}

test("PowerShell betigi: once WinRT AllVoices (OneCore, or. Tolga), sonra System.Speech; ses yoksa SES_YOK + cikis 3 (varsayilan sesle OKUMAZ)", () => {
  const b = sistem.PS_BETIK;
  assert.ok(b.indexOf("Windows.Media.SpeechSynthesis.SpeechSynthesizer") < b.indexOf("System.Speech.Synthesis.SpeechSynthesizer"), "WinRT once");
  assert.match(b, /::AllVoices/);
  assert.match(b, /\$_\.Language -eq \$Kultur/);
  assert.match(b, /SpeakingRate = \$Oran \/ 100\.0/);
  assert.match(b, /SES_YOK ' \+ \$Kultur\); exit 3/);
  assert.doesNotMatch(b, /else \{ \[Console\]::Error\.WriteLine\('SES_YOK/, "eski davranis: ses yokken varsayilan sesle devam ederdi");
});

test("o dilde ses yok (SES_YOK): kalici hata + cozum, mp3 DONMEZ; ffmpeg hic cagrilmaz", async () => {
  for (const platform of ["win32", "linux"]) {
    let ffmpegCagrildi = false;
    const m = sistem.olustur({ platform, dil: "tr", espeak: "espeak-ng", ffmpeg: () => { ffmpegCagrildi = true; return "ffmpeg-yok"; },
      // eski betik SES_YOK yazip cikis 0 veriyordu: o durum da yanlis dilde ses sayilir
      calistir: yazanCalistir(platform, platform === "win32" ? { kod: 0, stderr: "SES_YOK tr-TR" } : { kod: 1, stderr: "Failed to read voice 'tr'" }) });
    await assert.rejects(m.sentez("Merhaba dünya"), e => {
      assert.equal(e.kalici, true, platform);
      assert.equal(e.kod, "sistem_ses_yok");
      assert.match(e.message, /Sistemde tr-TR sesi yok/);
      assert.match(e.cozum, platform === "win32" ? /Ayarlar > Zaman ve dil > Konuşma/ : /espeak-ng/);
      return true;
    });
    assert.equal(ffmpegCagrildi, false, platform);
  }
});

test("macOS: 'say -v ?' cozumlenir; tam yerel ayar, yoksa ayni dil; o dilde ses yoksa kalici hata (komut calismaz)", async () => {
  const liste = sistem.macSesleriniCoz(MAC_SESLERI);
  assert.deepEqual(liste.map(s => s.ad), ["Albert", "Eddy (English (UK))", "Fiona", "Majed", "Yelda", "Joana"]);
  assert.equal(sistem.macSesiSec(liste, "tr-TR").ad, "Yelda");
  assert.equal(sistem.macSesiSec(liste, "en-US").ad, "Albert");
  assert.equal(sistem.macSesiSec(liste, "pt-BR").ad, "Joana", "ayni dil, baska bolge");
  assert.equal(sistem.macSesiSec(liste, "ar-SA").ad, "Majed");
  assert.equal(sistem.macSesiSec(liste, "de-DE"), null);
  let calisti = 0;
  const m = sistem.olustur({ platform: "darwin", dil: "de", macSesleri: () => MAC_SESLERI, calistir: async () => { calisti++; return { kod: 0, stderr: "" }; } });
  await assert.rejects(m.sentez("Hallo Welt"), e => e.kalici === true && /de-DE/.test(e.message) && /Sesleri Yönet/.test(e.cozum));
  assert.equal(calisti, 0, "yanlis dilde say calistirilmaz");
});

testF("secilen ses adi motor basina BIR kez bildirilir; baska bolge sesi uyar kanalina gider", async () => {
  const loglar = [], uyarilar = [];
  const m = sistem.olustur({ platform: "win32", dil: "pt", log: x => loglar.push(x), uyar: x => uyarilar.push(x),
    calistir: yazanCalistir("win32", { stdout: "SES Microsoft Helia|pt-PT\r\n" }) });
  await m.sentez("Olá mundo"); await m.sentez("Olá de novo");
  assert.equal(loglar.filter(x => /Sistem sesi: Microsoft Helia \(pt-PT\)/.test(x)).length, 1, loglar.join(" | "));
  assert.equal(uyarilar.length, 1);
  assert.match(uyarilar[0], /pt-BR sesi yok; aynı dilin pt-PT sesi/);
  const m2 = sistem.olustur({ platform: "win32", dil: "tr", log: () => {}, uyar: x => uyarilar.push(x),
    calistir: yazanCalistir("win32", { stdout: "SES Microsoft Tolga|tr-TR\r\n" }) });
  await m2.sentez("Merhaba");
  assert.equal(uyarilar.length, 1, "kultur tutunca uyari yok");
});

test("sentez: motor hata kodu verirse ya da dosya uretmezse hata firlatir (gecici: kalici degil)", async () => {
  const m = sistem.olustur({ platform: "win32", dil: "en", calistir: async () => ({ kod: 1, stderr: "boom" }) });
  await assert.rejects(m.sentez("x"), e => /Sistem sesi hata verdi/.test(e.message) && !e.kalici);
  const m2 = sistem.olustur({ platform: "win32", dil: "en", calistir: async () => ({ kod: 0, stderr: "" }) });
  await assert.rejects(m2.sentez("x"), /dosya üretmedi/);
});

test("varsayilanCalistir: stdout + stderr toplanir; iptal sinyali sureci oldurur", async () => {
  const r = await sistem.varsayilanCalistir({ komut: process.execPath, argv: ["-e", "process.stdout.write('SES A|tr-TR');process.stderr.write('uyari')"] });
  assert.deepEqual([r.kod, r.stdout, r.stderr], [0, "SES A|tr-TR", "uyari"]);
  const ac = new AbortController();
  const t0 = Date.now();
  setTimeout(() => ac.abort(new Error("zaman aşımı (test)")), 100);
  await assert.rejects(sistem.varsayilanCalistir({ komut: process.execPath, argv: ["-e", "setTimeout(()=>{},20000)"], sinyal: ac.signal }), /zaman aşımı \(test\)/);
  assert.ok(Date.now() - t0 < 5000);
});

test("otomatik sira: sistem EN SONDA; acik secimle kullanilabilir; SES_YOK motor katmaninda da kalici", async () => {
  assert.deepEqual(M.OTOMATIK_MOTORLAR.slice(-1), ["sistem"]);
  assert.ok(M.MOTORLAR.includes("sistem"));
  assert.deepEqual(M.motorSirasi("sistem", () => "", { sistemCalistir: true }), ["sistem"]);
  const m = M.motorOlustur("sistem", { dil: "pt", hiz: "+0%",
    enjekte: { sistemPlatform: "win32", sistemCalistir: async () => ({ kod: 3, stderr: "SES_YOK pt-BR" }) } });
  await assert.rejects(m.sentez("Olá"), e => e.kalici === true && e.kod === "sistem_ses_yok");
});

testF("motorOlustur('sistem'): uyari ses-uret'in uyar kanalina (sonuc listesi), ses adi log'a gider", async () => {
  const uyarilar = [], loglar = [];
  const m = M.motorOlustur("sistem", { dil: "pt", hiz: "+0%", log: x => loglar.push(x), uyar: x => uyarilar.push(x),
    enjekte: { sistemPlatform: "win32", sistemCalistir: yazanCalistir("win32", { stdout: "SES Microsoft Helia|pt-PT" }) } });
  await m.sentez("Olá mundo");
  assert.equal(uyarilar.length, 1, "uyari log yerine uyar kanalindan: " + uyarilar.join(" | "));
  assert.ok(loglar.some(x => /Microsoft Helia/.test(x)));
  assert.ok(!loglar.some(x => /aynı dilin/.test(x)), "uyari log'a dusmez");
});

// Gercek isletim sistemi sesi (yalniz istenirse: OTOPILOT_GERCEK_SES=1). Sonuc ya o dilde ses ya da kalici "ses yok";
// ASLA baska dilde ses degil.
const gercek = process.env.OTOPILOT_GERCEK_SES === "1" && S.ffmpegVar && sistem.hazirMi().ok;
test("GERCEK sistem sesi: tr/en/hi ya o dilin sesiyle okunur ya da kalici hata (varsayilan sesle okunmaz)", { skip: !gercek && "OTOPILOT_GERCEK_SES=1 degil" }, async () => {
  for (const dil of ["tr", "en", "hi"]) {
    const loglar = [];
    const m = sistem.olustur({ dil, hiz: "+0%", log: x => loglar.push(x) });
    try {
      const r = await m.sentez(dil === "tr" ? "Merhaba dünya." : "Hello world.");
      assert.ok(r.buf.length > 1000, dil);
      const kultur = sistem.KULTUR[dil];
      assert.ok(loglar.some(x => x.includes("(" + kultur.slice(0, 2))), dil + " sesi dile uymali: " + loglar.join(" | "));
    } catch (e) {
      assert.equal(e.kod, "sistem_ses_yok", dil + ": " + e.message);
    }
  }
});
