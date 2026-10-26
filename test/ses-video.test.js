// test/ses-video.test.js — video-seslendir.js: altyazi kurma (saf fonksiyonlar) + sentetik video duman testi.
// Video/ses lavfi ile uretilir; Edge/Piper agi SAHTE. Gercek .env'e dokunulmaz.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./ses-sahte.js");

const ortam = S.ortamiYalitla();
const testF = S.ffmpegTesti(test);          // ffmpeg yoksa (CI) atlanir
const A = require("../lib/ses-altyazi.js");
const VS = require("../video-seslendir.js");
const M = require("../lib/ses-motor.js");
const FF = require("../ff-yol.js");

const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "ses-video-test-"));
test.after(() => { fs.rmSync(dizin, { recursive: true, force: true }); ortam.temizle(); });

const ffprobe = (f, secim) => execFileSync(FF.ffprobe, ["-v", "error", ...secim, "-of", "csv=p=0", f]).toString().trim();

// ---------------------------------------------------------------------------
// Saf fonksiyonlar
// ---------------------------------------------------------------------------
test("srtZaman bicimi", () => {
  assert.equal(A.srtZaman(0), "00:00:00,000");
  assert.equal(A.srtZaman(3723456), "01:02:03,456");
  assert.equal(A.srtZaman(-5), "00:00:00,000");
});

test("cumleSonuMu: Dr. / U.S. / vs. cumle bitirmez; ! ? ve normal nokta bitirir", () => {
  for (const k of ["Dr.", "Mr.", "U.S.", "e.g.", "vs.", "Prof.", "Doç.", "vb."]) assert.equal(A.cumleSonuMu(k), false, k);
  for (const k of ["bitti.", "mı?", "Hey!", "dedi.\"", "son…"]) assert.equal(A.cumleSonuMu(k), true, k);
  assert.equal(A.cumleSonuMu("kelime"), false);
});

test("satirlaraBol: <=42 karakter ve cumle sonunda biter, kisaltmada bolmez", () => {
  const kel = "Dr. Smith went to the U.S. yesterday. He stayed for a very long time there.".split(" ");
  const s = A.satirlaraBol(kel, 42);
  for (const x of s) assert.ok(x.join(" ").length <= 42, x.join(" "));
  assert.equal(s[0].join(" ").startsWith("Dr. Smith went to the U.S."), true);
  assert.ok(s.some(x => x[x.length - 1] === "yesterday."), "cumle sonunda satir biter");
});

test("satirlaraBol: uzun cumle dengeli bolunur (yalniz kalan kelime olmaz); asiri uzun kelime kelime kelime", () => {
  const s = A.satirlaraBol("Welcome to this short demo about narrated videos.".split(" "), 42);
  assert.deepEqual(s.map(x => x.join(" ")), ["Welcome to this short demo", "about narrated videos."]);
  const uc = A.satirlaraBol(("kelime ".repeat(20) + "bitti.").split(" "), 42);
  for (const x of uc) assert.ok(x.join(" ").length <= 42);
  assert.ok(uc.length >= 3 && uc.every(x => x.length >= 2), "yetim satir yok: " + JSON.stringify(uc.map(x => x.length)));
  assert.deepEqual(A.satirlaraBol(["x".repeat(60), "y."], 42).map(x => x.join(" ")), ["x".repeat(60), "y."]);
});

test("paragrafBloklari: kelime zamanlarindan kurulur (karakter orani degil)", () => {
  // 10 kelime; kelime zamanlari ESIT DEGIL: ilk cumle (4 kelime) cok yavas, ikinci hizli
  const metin = "One two three four. Five six seven eight nine ten.";
  const kel = [];
  const w = metin.split(" ");
  let t = 0;
  w.forEach((x, i) => { const d = i < 4 ? 1000 : 200; kel.push({ t, d, w: x }); t += d + 50; });
  const b = A.paragrafBloklari({ metin, baslangicSn: 10, sureSn: 8, kelimeler: kel });
  assert.equal(b.length, 2);
  assert.equal(b[0].metin, "One two three four.");
  assert.equal(b[1].metin, "Five six seven eight nine ten.");
  assert.equal(b[0].bas, 10000);
  assert.equal(b[1].bas, 10000 + kel[4].t, "ikinci cumle 5. kelimenin gercek zamaninda baslar");
  assert.equal(b[0].bit, b[1].bas, "bir satir sonrakinin basinda biter");
  assert.equal(b[1].bit, 18000, "son satir paragraf sonunda biter");
  // karakter orani kullanilsaydi ikinci satir ~%40'ta degil sonda baslardi
  const oransal = A.paragrafBloklari({ metin, baslangicSn: 10, sureSn: 8, kelimeler: [] });
  assert.notEqual(oransal[1].bas, b[1].bas);
});

test("paragrafBloklari: kelime zamani yoksa sure KARAKTER sayisiyla dagitilir (satirlara esit degil)", () => {
  const metin = "a b c d e f g h i j k l m n o p q r s t u v w x y z. Short.";
  const b = A.paragrafBloklari({ metin, baslangicSn: 0, sureSn: 10, kelimeler: [] }, { maks: 30 });
  assert.ok(b.length >= 2);
  const sonSatir = b[b.length - 1];
  assert.equal(sonSatir.metin, "Short.");
  const uzunSure = b[0].bit - b[0].bas, kisaSure = sonSatir.bit - sonSatir.bas;
  assert.ok(uzunSure > kisaSure * 2, "uzun satir daha uzun gorunmeli: " + uzunSure + " / " + kisaSure);
  for (let i = 1; i < b.length; i++) assert.ok(b[i].bas >= b[i - 1].bit - 1, "cakisma yok");
});

test("paragrafBloklari: tavan, en az gorunme suresi, bos metin", () => {
  assert.deepEqual(A.paragrafBloklari({ metin: "   ", baslangicSn: 0, sureSn: 1, kelimeler: [] }), []);
  const b = A.paragrafBloklari({ metin: "Hi.", baslangicSn: 5, sureSn: 0.2, kelimeler: [] }, { tavanMs: 5300 });
  assert.equal(b[0].bit, 5300, "sonraki paragrafin basini asmaz");
  const c = A.paragrafBloklari({ metin: "Hi.", baslangicSn: 5, sureSn: 0.2, kelimeler: [] });
  assert.equal(c[0].bit - c[0].bas, 600, "en az 0.6 sn gorunur");
});

test("srtMetni: numarali bloklar", () => {
  const srt = A.srtMetni([{ bas: 0, bit: 1500, metin: "A" }, { bas: 1500, bit: 3000, metin: "B" }]);
  assert.equal(srt, "1\n00:00:00,000 --> 00:00:01,500\nA\n\n2\n00:00:01,500 --> 00:00:03,000\nB\n");
});

// ---------------------------------------------------------------------------
// Sentetik video ile duman testi
// ---------------------------------------------------------------------------
function sentetikVideo(yol, sn, sesli) {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=320x180:r=15:d=" + sn];
  if (sesli) args.push("-f", "lavfi", "-i", "sine=frequency=220:duration=" + sn);
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p");
  if (sesli) args.push("-c:a", "aac", "-ar", "44100");
  args.push("-threads", "2", yol);       // fikstur: cekirdek sayisi kadar kodlayici is parcacigi gereksiz, bellek darken ENOMEM verir
  execFileSync(FF.ffmpeg, args, { stdio: "ignore" });
}
const PAR = ["Welcome to this short demo about narrated videos.", "The second paragraph says something different here.", "And finally the closing words of the demo."];
const env0 = () => "";
const ayar = S.hizliAyar();
const sessiz = () => {};

testF("duman: sesli video + sahte Edge -> .part kalmaz, sure korunur, ses 48 kHz aac, SRT kelime zamanlarindan", async () => {
  const video = path.join(dizin, "kaynak'li video.mp4");        // tek tirnakli ad (eski kodda sorun cikarirdi)
  sentetikVideo(video, 12, true);
  const senaryo = path.join(dizin, "senaryo.txt");
  fs.writeFileSync(senaryo, PAR.join("\n\n"));
  const cikti = path.join(dizin, "cikti.mp4");
  const sahte = S.sahteEdge();
  const r = await VS.ana([video, senaryo, cikti, "--ses", "en-US-ChristopherNeural", "--motor", "edge", "--punto", "14", "--srt"],
    { env: env0, enjekte: { msedge: sahte }, ayar, log: sessiz });

  assert.ok(fs.existsSync(cikti));
  assert.ok(!fs.existsSync(path.join(dizin, "cikti.part.mp4")), ".part kalmamali");
  assert.equal(r.motor, "edge");
  assert.ok(Math.abs(Number(ffprobe(cikti, ["-show_entries", "format=duration"])) - 12) < 0.6, "sure kaynak video kadar");
  assert.equal(ffprobe(cikti, ["-select_streams", "a", "-show_entries", "stream=sample_rate"]), "48000", "loudnorm sonrasi 48 kHz");
  assert.equal(ffprobe(cikti, ["-select_streams", "a", "-show_entries", "stream=codec_name"]), "aac");
  assert.equal(ffprobe(cikti, ["-select_streams", "v", "-show_entries", "stream=codec_name"]), "h264");

  const srt = fs.readFileSync(path.join(dizin, "cikti.srt"), "utf8");
  assert.match(srt, /\nWelcome to this short demo\n\n2\n[^\n]+\nabout narrated videos\.\n/, "49 karakterlik cumle dengeli iki altyazi satirina bolunur");
  assert.match(srt, /And finally the closing words of the demo\./);
  assert.ok(r.altyaziSatir >= 3);
  assert.ok(sahte.durum.istekler.every(i => i.rate === "+0%" || /^\+\d+%$/.test(i.rate)));
  assert.deepEqual(fs.readdirSync(os.tmpdir()).filter(f => f.startsWith("video-seslendir-") && fs.statSync(path.join(os.tmpdir(), f)).mtimeMs > Date.now() - 60000), [],
    "gecici klasor silinmeli");
});

testF("duman: anlatim videodan uzunsa hiz artirilir; sessiz video + Piper (kelime zamani yok, karakter orani)", async () => {
  const video = path.join(dizin, "sessiz.mp4");
  sentetikVideo(video, 6, false);
  const senaryo = path.join(dizin, "uzun.txt");
  fs.writeFileSync(senaryo, ["word ".repeat(20).trim() + ".", "more ".repeat(20).trim() + "."].join("\n\n"));      // 40 kelime * 0.25 sn = 10 sn > 6 sn
  const cikti = path.join(dizin, "sessiz-cikti.mp4");
  const { calistir, durum } = S.sahtePiperCalistir();
  const env = a => ({ PIPER_YOL: "piper", PIPER_MODEL: "m.onnx" })[a] || "";
  const r = await VS.ana([video, senaryo, cikti, "--motor", "piper", "--ses", "tr-TR-AhmetNeural", "--srt"],
    { env, enjekte: { calistir }, ayar, log: sessiz });
  assert.equal(r.motor, "piper");
  assert.ok(durum.cagri >= 4, "hiz artirilip tum paragraflar yeniden uretildi: " + durum.cagri);
  assert.ok(fs.existsSync(cikti));
  assert.ok(Math.abs(Number(ffprobe(cikti, ["-show_entries", "format=duration"])) - 6) < 0.6);
  assert.equal(ffprobe(cikti, ["-select_streams", "a", "-show_entries", "stream=sample_rate"]), "48000");
  const srt = fs.readFileSync(path.join(dizin, "sessiz-cikti.srt"), "utf8");
  assert.ok(srt.split("\n\n").length >= 2);
});

testF("--altyazi 0: altyazi gomulmez ve --srt dosyasi yazilmaz", async () => {
  const video = path.join(dizin, "a0.mp4");
  sentetikVideo(video, 8, true);
  const senaryo = path.join(dizin, "a0.txt");
  fs.writeFileSync(senaryo, PAR[0]);
  const cikti = path.join(dizin, "a0-cikti.mp4");
  const r = await VS.ana([video, senaryo, cikti, "--ses", "en-US-ChristopherNeural", "--motor", "edge", "--altyazi", "0", "--srt"],
    { env: env0, enjekte: { msedge: S.sahteEdge() }, ayar, log: sessiz });
  assert.equal(r.altyaziSatir, 0);
  assert.ok(!fs.existsSync(path.join(dizin, "a0-cikti.srt")));
  assert.ok(fs.existsSync(cikti));
});

testF("paragraf seslendirilemezse cikis 4, cikti dosyasi OLUSMAZ (eskiden sessizce atlanirdi)", async () => {
  const video = path.join(dizin, "hata.mp4");
  sentetikVideo(video, 8, true);
  const senaryo = path.join(dizin, "hata.txt");
  fs.writeFileSync(senaryo, PAR.join("\n\n"));
  const cikti = path.join(dizin, "hata-cikti.mp4");
  const sahte = S.sahteEdge((no, metin) => (/second paragraph/.test(metin) ? "hata" : "tam"));
  await assert.rejects(VS.ana([video, senaryo, cikti, "--ses", "en-US-ChristopherNeural", "--motor", "edge"],
    { env: env0, enjekte: { msedge: sahte }, ayar, log: sessiz }), e => {
    assert.equal(e.cikis, 4);
    assert.equal(e.message, "Paragraf 2 seslendirilemedi");
    return true;
  });
  assert.ok(!fs.existsSync(cikti));
  assert.ok(!fs.existsSync(path.join(dizin, "hata-cikti.part.mp4")));
});

testF("otomatik: Edge TEK paragraf dusurdu, sirada sistem sesi var -> sisteme GECILMEZ (cikis 4, cozumde --motor sistem)", async () => {
  const video = path.join(dizin, "sistem.mp4");
  sentetikVideo(video, 8, true);
  const senaryo = path.join(dizin, "sistem.txt");
  fs.writeFileSync(senaryo, PAR.join("\n\n"));
  const cikti = path.join(dizin, "sistem-cikti.mp4");
  let sistemCagri = 0;
  const sistemCalistir = async () => { sistemCagri++; return { kod: 1, stderr: "cagrilmamaliydi" }; };
  const sahte = S.sahteEdge((no, metin) => (/second paragraph/.test(metin) ? "hata" : "tam"));
  assert.deepEqual(M.motorSirasi("otomatik", env0, { msedge: sahte, sistemCalistir }), ["edge", "sistem"]);
  await assert.rejects(VS.ana([video, senaryo, cikti, "--ses", "en-US-ChristopherNeural"],
    { env: env0, enjekte: { msedge: sahte, sistemCalistir }, ayar, log: sessiz, uyari: () => {} }), e => {
    assert.equal(e.cikis, 4);
    assert.match(e.cozum, /İşletim sistemi sesine \(robotik, kalite düşer\) kendiliğinden geçilmedi/);
    assert.match(e.cozum, /--motor sistem/);
    return true;
  });
  assert.equal(sistemCagri, 0);
  assert.ok(!fs.existsSync(cikti));
});

testF("girdi hatalari: eksik arguman, olmayan dosya, kaynakla ayni cikti, gecersiz hiz/orijinal/punto -> exit 2", async () => {
  const video = path.join(dizin, "girdi.mp4");
  sentetikVideo(video, 3, true);
  const senaryo = path.join(dizin, "girdi.txt");
  fs.writeFileSync(senaryo, PAR[0]);
  const ek = { env: env0, enjekte: { msedge: S.sahteEdge() }, ayar, log: sessiz };
  const dene = async (argv, desen) => assert.rejects(VS.ana(argv, ek), e => { assert.equal(e.cikis, 2, e.message); assert.match(e.message, desen); return true; });
  await dene([], /verilmedi/);
  await dene([video], /verilmedi/);
  await dene(["yok.mp4", senaryo], /Dosya bulunamadı/);
  await dene([video, senaryo, video], /aynı olamaz/);
  await dene([video, senaryo, "--hiz", "hizli"], /hızı geçersiz/);
  await dene([video, senaryo, "--orijinal", "5"], /0 ile 1/);
  await dene([video, senaryo, "--punto", "2"], /8 ile 72/);
  const bos = path.join(dizin, "bos.txt");
  fs.writeFileSync(bos, "  \n\n  ");
  await dene([video, bos, "--motor", "edge"], /Senaryo dosyası boş/);
});

testF("CLI: konsola 'kendi/izinli icerik' uyarisi basilir ve eksik arguman exit 2", () => {
  const r = spawnSync(process.execPath, [path.join(S.KOK, "video-seslendir.js")], { encoding: "utf8", env: process.env });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /✗ Video ve senaryo dosyası verilmedi/);
  assert.match(r.stderr, /↳ Kullanım: node video-seslendir\.js/);
});

testF("uyari metni: kendi/izinli icerik + sentetik ses hatirlatmasi", async () => {
  const video = path.join(dizin, "uyari.mp4");
  sentetikVideo(video, 5, true);
  const senaryo = path.join(dizin, "uyari.txt");
  fs.writeFileSync(senaryo, PAR[0]);
  const satirlar = [], uyarilar = [];
  await VS.ana([video, senaryo, path.join(dizin, "uyari-cikti.mp4"), "--ses", "en-US-ChristopherNeural", "--motor", "edge"],
    { env: env0, enjekte: { msedge: S.sahteEdge() }, ayar, log: m => satirlar.push(m), uyari: m => uyarilar.push(m) });
  assert.ok(uyarilar.some(m => /KENDİ videoların ya da kullanma iznin olan/.test(m)), "@@UYARI olarak (uyari kanalindan) gelmeli");
  assert.ok(uyarilar.some(m => /sentetik/.test(m)));
  assert.ok(!satirlar.some(m => /^UYARI:/.test(m)), "duz log satiri olarak basilmamali");
  assert.ok(M.sureOlc(path.join(dizin, "uyari-cikti.mp4")) > 3);
});

testF("CLI: acilis uyarilari stdout'ta @@UYARI satiri olarak basilir (panel uyari olarak isaretler)", () => {
  const video = path.join(dizin, "uyari-cli.mp4");
  sentetikVideo(video, 3, true);
  const senaryo = path.join(dizin, "uyari-cli.txt");
  fs.writeFileSync(senaryo, PAR[0]);
  // ag yok: piper yolu var olmayan bir dosyaya isaret eder -> uyarilar basildiktan SONRA yapilandirma hatasi (exit 2)
  const bosEnv = path.join(dizin, "bos-uyari.env");
  fs.writeFileSync(bosEnv, "");
  const r = spawnSync(process.execPath, [path.join(S.KOK, "video-seslendir.js"), video, senaryo, path.join(dizin, "uyari-cli-cikti.mp4"), "--motor", "piper"],
    { encoding: "utf8", env: Object.assign({}, process.env, { OTOMASYON_ENV_DOSYASI: bosEnv, PIPER_YOL: path.join(dizin, "yok-piper.exe"), PIPER_MODEL: path.join(dizin, "yok.onnx") }) });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /^@@UYARI Bu araç yalnızca KENDİ videoların/m);
  assert.match(r.stdout, /^@@UYARI Yapay \(sentetik\) ses kullanıyorsun/m);
  assert.doesNotMatch(r.stdout, /^UYARI:/m, "duz 'UYARI:' log satiri kalmamali");
  assert.match(r.stderr, /✗ PIPER_YOL bulunamadı/);
});

// ---------------------------------------------------------------------------
// Hiz artirma: negatif --hiz'de gecerli deger, sinirdayken bosuna yeniden uretme yok
// ---------------------------------------------------------------------------
const UZUN = ["word ".repeat(27).trim() + "."];             // sahte Edge: 27 kelime * 0.3 sn = 8.1 sn

testF("--hiz -10%: anlatim videodan uzunsa yeni hiz GECERLI bicimde ('+-' yok) ve motora o gider", async () => {
  const video = path.join(dizin, "negatif.mp4");
  sentetikVideo(video, 8, true);
  const senaryo = path.join(dizin, "negatif.txt");
  fs.writeFileSync(senaryo, UZUN.join("\n\n"));
  const sahte = S.sahteEdge();
  const satirlar = [];
  await VS.ana([video, senaryo, path.join(dizin, "negatif-cikti.mp4"), "--ses", "en-US-ChristopherNeural", "--motor", "edge", "--hiz", "-10%"],
    { env: env0, enjekte: { msedge: sahte }, ayar, log: m => satirlar.push(m), uyari: () => {} });
  const oranlar = sahte.durum.istekler.map(i => i.rate);
  assert.equal(oranlar[0], "-10%");
  assert.ok(oranlar.length >= 2, "hiz degisti, yeniden uretildi: " + JSON.stringify(oranlar));
  for (const o of oranlar) assert.match(o, /^[+-]\d{1,2}%$/, "gecerli rate: " + o);
  assert.ok(!oranlar.some(o => o.includes("+-")));
  assert.ok(!satirlar.some(m => m.includes("+-")), "log'da da '+-' yok: " + satirlar.join(" | "));
  assert.ok(satirlar.some(m => /anlatım videodan .* sn uzun — hız [+-]\d{1,2}% yapılıyor/.test(m)), "Türkçe karakterli log: " + satirlar.join(" | "));
});

testF("--hiz +50%: zaten sinirda; ayni sesi bosuna yeniden uretmez, uyarir", async () => {
  const video = path.join(dizin, "sinir.mp4");
  sentetikVideo(video, 6, true);
  const senaryo = path.join(dizin, "sinir.txt");
  fs.writeFileSync(senaryo, UZUN.join("\n\n"));
  const sahte = S.sahteEdge();
  const uyarilar = [];
  await VS.ana([video, senaryo, path.join(dizin, "sinir-cikti.mp4"), "--ses", "en-US-ChristopherNeural", "--motor", "edge", "--hiz", "+50%"],
    { env: env0, enjekte: { msedge: sahte }, ayar, log: sessiz, uyari: m => uyarilar.push(m) });
  assert.equal(sahte.durum.istekler.length, 1, "yeniden uretilmemeli: " + JSON.stringify(sahte.durum.istekler.map(i => i.rate)));
  assert.ok(uyarilar.some(m => /hız zaten sınırda \(\+50%\)/.test(m)), uyarilar.join(" | "));
});

testF("konsol metinleri Türkçe karakterli (BİTTİ, anlatım, karışım, altyazı)", async () => {
  const video = path.join(dizin, "metin.mp4");
  sentetikVideo(video, 8, true);
  const senaryo = path.join(dizin, "metin.txt");
  fs.writeFileSync(senaryo, PAR[0]);
  const satirlar = [];
  await VS.ana([video, senaryo, path.join(dizin, "metin-cikti.mp4"), "--ses", "en-US-ChristopherNeural", "--motor", "edge"],
    { env: env0, enjekte: { msedge: S.sahteEdge() }, ayar, log: m => satirlar.push(m), uyari: () => {} });
  const hepsi = satirlar.join("\n");
  for (const parca of ["=== BİTTİ ===", "son karışım yapılıyor...", "sn anlatım +", "paragraf arası", "altyazı  :", "satır ("])
    assert.ok(hepsi.includes(parca), "eksik: " + parca + "\n" + hepsi);
  assert.ok(!/BITTI|karisim|anlatim|altyazi |satir \(/.test(hepsi), "ASCII Türkçe kalmamalı:\n" + hepsi);
});
