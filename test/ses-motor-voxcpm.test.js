// test/ses-motor-voxcpm.test.js — VoxCPM2 yerel ses motoru: hazir sesler, ses adi cozumleme, dil varsayilani,
// komut kurma, metin temizleme (rakam->yazi, tirnak, satir=cumle), kurulu degilken davranis, cikti donusumu,
// GPU kilidi, ses-uret/seslendir.js entegrasyonu. GERCEK VoxCPM/GPU KULLANILMAZ: Python cagrisi sahtedir
// (enjekte calistirici ya da test/ses-sahte-voxcpm.js); ses gercek ffmpeg (lavfi) ile sentetiktir.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./ses-sahte.js");

const ortam = S.ortamiYalitla();
const uretim = S.testUretimi();
const testF = S.ffmpegTesti(test);          // ffmpeg yoksa (CI) atlanir
const ortak = require("../lib/ortak.js");
const V = require("../lib/ses-motor-voxcpm.js");
const M = require("../lib/ses-motor.js");
const U = require("../lib/ses-uret.js");
const { girdiDogrula } = require("../lib/panel-yeni-is.js");

const SAHTE = path.join(__dirname, "ses-sahte-voxcpm.js");
const ara = fs.mkdtempSync(path.join(os.tmpdir(), "voxcpm-test-"));
test.after(() => { fs.rmSync(ara, { recursive: true, force: true }); uretim.temizle(); ortam.temizle(); });

// ---- sahte VoxCPM deposu: ses_tasarim/oku.py + ayarlar.json + motor/model dosyalari (icerikleri bos) ----
let kokSayac = 0;
function sahteKok(ayarEk, secenek) {
  const kok = path.join(ara, "kok" + (++kokSayac));
  const o = secenek || {};
  fs.mkdirSync(path.join(kok, "ses_tasarim"), { recursive: true });
  if (!o.okuYok) fs.writeFileSync(path.join(kok, "ses_tasarim", "oku.py"), "");
  for (const f of ["motor/audiocpp_cli.exe", "model/voxcpm2-q8_0.gguf"]) {
    fs.mkdirSync(path.dirname(path.join(kok, f)), { recursive: true });
    if (!(o.modelYok && f.startsWith("model"))) fs.writeFileSync(path.join(kok, f), "");
  }
  if (!o.ayarYok) fs.writeFileSync(path.join(kok, "ayarlar.json"),
    JSON.stringify(Object.assign({ motor: "motor/audiocpp_cli.exe", model: "model/voxcpm2-q8_0.gguf", backend: "cpu" }, ayarEk || {})));
  return kok;
}
const envDen = o => ad => (o && o[ad]) || "";
const kuruluEnv = kok => envDen({ VOXCPM_KOK: kok, VOXCPM_PYTHON: SAHTE });

// ---- enjekte calistirici: sahte Python'u SUREC ACMADAN taklit eder (oku.py cikti sozlesmesi) ----
function sahteCalistir(secenek) {
  const o = secenek || {};
  const durum = { cagrilar: [] };
  const calistir = async c => {
    const al = ad => c.argv[c.argv.indexOf(ad) + 1];
    const metin = fs.readFileSync(al("--metin").slice(1), "utf8");
    durum.cagrilar.push({ komut: c.komut, argv: c.argv.slice(), cwd: c.cwd, metin, zamanAsimiMs: c.zamanAsimiMs, env: c.env });
    if (o.sonuc) return o.sonuc(durum.cagrilar.length, c);
    const satirlar = metin.split("\n").map(l => l.split("||")[0].trim()).filter(Boolean);
    satirlar.forEach((_, i) => c.satir("  " + (i + 1) + "/" + satirlar.length + " cümle, " + i + " sn"));
    const cikti = al("--cikti");
    fs.mkdirSync(cikti, { recursive: true });
    let t = 0;
    const kayit = satirlar.map((l, i) => {
      const sure = o.satirSn || 1;
      const r = { satir: i + 1, metin: l, t0: t, t1: t + sure };
      t += sure + 0.35;
      return r;
    });
    const toplam = Math.max(0.5, t - 0.35);
    execFileSync(require("../ff-yol.js").ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "sine=frequency=200:duration=" + toplam.toFixed(3) + ":sample_rate=48000", "-ac", "1", "-c:a", "pcm_s16le",
      path.join(cikti, "okuma.wav")], { stdio: "ignore" });
    fs.writeFileSync(path.join(cikti, "ozet.json"), JSON.stringify({ satirlar: kayit }));
    return { kod: 0, stdout: "bitti", stderr: "" };
  };
  return { calistir, durum };
}
const kilit = () => path.join(ara, "gpu-" + Math.random().toString(36).slice(2) + ".kilit");
const sureOlc = buf => { const f = path.join(ara, "olc-" + Math.random().toString(36).slice(2) + ".mp3"); fs.writeFileSync(f, buf); return M.sureOlc(f); };

// ===========================================================================
// Hazir sesler ve lisans dosyalari
// ===========================================================================
test("hazir sesler: 14 ses (7 Turkce + 7 yerli anlatici), her klasorde 4 dosya, yapay ses kartlari", () => {
  const liste = V.sesleriListele();
  assert.equal(liste.length, 14);
  assert.equal(liste.filter(s => s.dil === "tr").length, 7);
  assert.deepEqual(liste.filter(s => s.ad.startsWith("anlatici_")).map(s => s.dil).sort(), ["de", "en", "es", "fr", "ja", "ru", "zh"]);
  for (const s of liste) {
    for (const f of ["ses.json", "referans.flac", "ornek_okuma.mp3", "ornek_okuma_metni.txt"])
      assert.ok(fs.statSync(path.join(s.klasor, f)).size > 0, s.ad + "/" + f);
    const kart = JSON.parse(fs.readFileSync(path.join(s.klasor, "ses.json"), "utf8"));
    assert.equal(kart.ad, s.ad);
    assert.equal(kart.yapay, true, "ses kartinda yapay: true");
    assert.equal(kart.referans, "referans.flac");
    assert.ok(Number.isInteger(kart.okuma_tohumu) && kart.ses_yaratilirken_okutulan_metin.length > 10);
    assert.equal(fs.readFileSync(path.join(s.klasor, "referans.flac")).subarray(0, 4).toString("latin1"), "fLaC");
    const mp3 = fs.readFileSync(path.join(s.klasor, "ornek_okuma.mp3"));
    assert.ok(mp3.subarray(0, 3).toString("latin1") === "ID3" || (mp3[0] === 0xFF && (mp3[1] & 0xE0) === 0xE0), s.ad + " mp3");
    const ornek = fs.readFileSync(path.join(s.klasor, "ornek_okuma_metni.txt"), "utf8");
    assert.ok(ornek.trim().length > 20 && !ornek.includes("\uFFFD"));
  }
  // varsayilanlar: tr tok_anlatici, diger diller anlatici_<kod>
  assert.deepEqual(liste.filter(s => s.varsayilan).map(s => s.ad).sort(),
    Object.values(ortak.VOXCPM_VARSAYILAN).sort());
});

test("sesler/voxcpm2: Apache-2.0 LICENSE, NOTICE (atif, yapay ses), README (TR+EN, tum sesler), okunus sozlugu", () => {
  const oku = f => fs.readFileSync(path.join(V.SESLER, f), "utf8");
  const lisans = oku("LICENSE");
  assert.match(lisans, /Apache License/); assert.match(lisans, /Version 2\.0, January 2004/);
  assert.match(lisans, /TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION/);
  const notice = oku("NOTICE");
  for (const k of ["Ali Haydar Ozturk", V.KAYNAK_REPO, "Apache", "VoxCPM2", "audio.cpp", "yapay", "synthetic"]) assert.ok(notice.includes(k), "NOTICE: " + k);
  const readme = oku("README.md");
  for (const s of V.sesleriListele()) {
    assert.ok(readme.includes("voxcpm:" + s.ad), "README: " + s.ad);
    assert.ok(readme.includes(s.ad + "/ornek_okuma.mp3"), "README ornek: " + s.ad);
  }
  for (const k of [V.KAYNAK_REPO, "VOXCPM_KOK", "kur.ps1", "--motor voxcpm", "AI-generated", "yapay zek"]) assert.ok(readme.includes(k), "README: " + k);
  assert.ok(!readme.includes("\uFFFD") && !notice.includes("\uFFFD"));
  const sozluk = oku("okunus_sozlugu.tsv").split(/\r?\n/).filter(l => l && !l.startsWith("#"));
  assert.ok(sozluk.length >= 5 && sozluk.every(l => l.includes("\t")));
});

test("depo: .flac/.mp3 ikili isaretli, ornek mp3'ler .gitignore'a takilmaz", () => {
  const ga = fs.readFileSync(path.join(S.KOK, ".gitattributes"), "utf8");
  assert.match(ga, /^\*\.flac binary\s*$/m);
  assert.match(ga, /^\*\.mp3 binary\s*$/m);
  const r = spawnSync("git", ["check-ignore", "-q", "sesler/voxcpm2/tok_anlatici/ornek_okuma.mp3"], { cwd: S.KOK });
  if (r.error || r.status === 128) return;                 // git yok / depo degil: atla
  assert.equal(r.status, 1, "ornek_okuma.mp3 yok sayilmamali");
});

// ===========================================================================
// Ses adi cozumleme ve dil varsayilani
// ===========================================================================
test("ses adi cozumleme: voxcpm:<ad>, dile gore varsayilan, gecersiz/bilinmeyen ad kalici hata", () => {
  const s = V.sesCoz("voxcpm:tok_anlatici", "tr");
  assert.equal(s.klasor, path.join(V.SESLER, "tok_anlatici"));
  assert.equal(s.kimlik, "voxcpm:tok_anlatici");
  assert.equal(s.sesDili, "tr");
  assert.equal(V.sesCoz("tr-TR-AhmetNeural", "tr").ad, "tok_anlatici", "Edge adi verilirse dilin varsayilani");
  for (const d of ["en", "de", "es", "fr", "ja", "ru", "zh"]) {
    const v = V.sesCoz("", d);
    assert.equal(v.ad, "anlatici_" + d);
    assert.equal(v.sesDili, d);
  }
  assert.equal(V.sesCoz("voxcpm:anlatici_en", "tr").sesDili, "en", "dil uyusmazligi hata degil (yalniz not)");
  for (const kotu of ["voxcpm:yok_boyle_ses", "voxcpm:../LICENSE", "voxcpm:Tok_Anlatici", "voxcpm:a b"])
    assert.throws(() => V.sesCoz(kotu, "tr"), e => e.kalici === true && /VoxCPM ses/.test(e.message) && /--liste-sesler/.test(e.cozum), kotu);
  assert.throws(() => V.sesCoz("it-IT-DiegoNeural", "it"), e => e.kalici && /'it' dilinde hazır ses yok/.test(e.message));
  assert.equal(V.kimlikBul("en-US-ChristopherNeural", "en"), "voxcpm:anlatici_en");
  assert.equal(V.kimlikBul("voxcpm:masal_cadisi", "en"), "voxcpm:masal_cadisi");
  assert.equal(V.kimlikBul("x", "it"), null);
});

test("tasarlanan ses: voxcpm:<ad>/<cesit> kullanicinin VoxCPM klasorunden (ayarlar.json 'sesler')", () => {
  const kok = sahteKok({ sesler: "benim_seslerim" });
  const klasor = path.join(kok, "benim_seslerim", "deniz", "cesit_02");
  fs.mkdirSync(klasor, { recursive: true });
  fs.writeFileSync(path.join(klasor, "ses.json"), JSON.stringify({ ad: "deniz", dil: "en", okuma_tohumu: 1 }));
  const kurulum = V.kurulumDenetle(kuruluEnv(kok));
  assert.equal(kurulum.ok, true, kurulum.neden);
  const s = V.sesCoz("voxcpm:deniz/2", "en", kurulum);
  assert.equal(s.klasor, klasor);
  assert.equal(s.ad, "deniz/2");
  assert.throws(() => V.sesCoz("voxcpm:deniz/3", "en", kurulum), /bulunamadı/);
  assert.throws(() => V.sesCoz("voxcpm:deniz/2", "en", null), e => e.kalici && /VOXCPM_KOK/.test(e.message));
});

test("ortak: sesSec VoxCPM sesini dile uydurur; konu.json/panel 'voxcpm:<ad>' ve sesMotoru 'voxcpm' kabul eder", () => {
  assert.equal(ortak.sesSec("tr", "voxcpm:tok_anlatici"), "voxcpm:tok_anlatici");
  assert.equal(ortak.sesSec("de", "voxcpm:tok_anlatici"), "voxcpm:anlatici_de", "ayni motorun o dildeki sesi");
  assert.equal(ortak.sesSec("it", "voxcpm:tok_anlatici"), "it-IT-DiegoNeural", "o dilde VoxCPM sesi yoksa Edge");
  assert.equal(ortak.sesSec("en", "voxcpm:benim/2"), "voxcpm:benim/2", "tasarlanan ses oldugu gibi");
  assert.equal(ortak.sesSec("tr", "en-US-ChristopherNeural"), "tr-TR-AhmetNeural", "eski davranis");
  assert.equal(ortak.voxcpmSesDili("anlatici_ja"), "ja");
  assert.equal(ortak.voxcpmSesDili("belgesel_hanim"), "tr");
  assert.equal(ortak.voxcpmSesDili("../x"), null);
  assert.equal(ortak.konuDogrula({ ses: "voxcpm:tok_anlatici", sesMotoru: "voxcpm" }).gecerli, true);
  const kotu = ortak.konuDogrula({ ses: "voxcpm:../gizli" });
  assert.equal(kotu.gecerli, false);
  assert.match(kotu.hatalar[0].mesaj, /voxcpm:<ad>/);
  assert.equal(ortak.ayarDogrula({ ses: "voxcpm:tok_anlatici", sesMotoru: "voxcpm" }).gecerli, true);
  const g = girdiDogrula({ baslik: "Deneme", ses: "voxcpm:tok_anlatici", sesMotoru: "voxcpm", dil: "tr" }, ortak.AYAR_VARSAYILAN);
  assert.deepEqual(g.hatalar, []);
  assert.equal(g.temiz.ses, "voxcpm:tok_anlatici");
  assert.equal(g.temiz.sesMotoru, "voxcpm");
  assert.ok(girdiDogrula({ baslik: "D", ses: "voxcpm:a/b/c" }, ortak.AYAR_VARSAYILAN).hatalar.some(h => h.alan === "ses"));
  // konu.json'da dil yoksa: Edge adinin oneki gibi VoxCPM hazir sesinin kartindaki dil
  const ayarTr = Object.assign({}, ortak.AYAR_VARSAYILAN, { dil: "tr" });
  assert.equal(ortak.konuBirlestir({ ses: "voxcpm:anlatici_en" }, ayarTr, "x").dil, "en");
  assert.equal(ortak.konuBirlestir({ ses: "voxcpm:anlatici_en", dil: "de" }, ayarTr, "x").dil, "de", "acik dil kazanir");
  assert.equal(ortak.konuBirlestir({ ses: "voxcpm:benim/2" }, ayarTr, "x").dil, "tr", "tasarlanan ses: dil bilinmiyor");
  assert.equal(ortak.voxcpmKimlikDili("voxcpm:anlatici_zh"), "zh");
  assert.equal(ortak.voxcpmKimlikDili("voxcpm:yok_boyle"), null);
  assert.equal(ortak.voxcpmKimlikDili("tr-TR-AhmetNeural"), null);
  assert.equal(U.sesDili("voxcpm:anlatici_ja"), "ja");
  assert.equal(U.sesDili("de-DE-ConradNeural"), "de");
});

// ===========================================================================
// Komut kurma
// ===========================================================================
test("komut kurma: python yolu (Windows/Mac), VOXCPM_PYTHON, argv ve cwd", () => {
  const kok = path.join(ara, "vox");
  assert.equal(V.pythonYolu(kok, () => "", "win32"), path.join(kok, ".venv", "Scripts", "python.exe"));
  assert.equal(V.pythonYolu(kok, () => "", "darwin"), path.join(kok, ".venv", "bin", "python"));
  assert.equal(V.pythonYolu(kok, envDen({ VOXCPM_PYTHON: "D:\\py\\python.exe" }), "win32"), "D:\\py\\python.exe");
  const k = V.komutKur({ python: "PY", kok, sesKlasoru: path.join(V.SESLER, "tok_anlatici"), metinDosyasi: "metin.txt", ciktiDizin: "cikti", dil: "TR" });
  assert.equal(k.komut, "PY");
  assert.equal(k.cwd, kok);
  assert.deepEqual(k.argv, ["-m", "ses_tasarim.oku", "--ses", path.join(V.SESLER, "tok_anlatici"),
    "--metin", "@" + path.resolve("metin.txt"), "--cikti", path.resolve("cikti"), "--dil", "tr"]);
  assert.ok(path.isAbsolute(k.argv[3]), "--ses TAM yol");
  assert.deepEqual(V.komutKur({ python: "PY", kok, sesKlasoru: "s", metinDosyasi: "m", ciktiDizin: "c" }).argv.slice(-2), ["--cikti", path.resolve("c")], "dil yoksa --dil yok");
});

// ===========================================================================
// Metin temizleme
// ===========================================================================
test("metin (tr): rakam->yazi, tirnak ve kesme isareti atilir, parantez virgul olur, satir = cumle, sozluk", () => {
  const r = V.metinHazirla("Türkiye'nin 2026 yılı “hedefi” (büyük) belli oldu. MP3 ve 4K var! Sürüm 1.2.3 çıktı | GPU hazır.", "tr");
  assert.deepEqual(r.sorunlar, []);
  assert.deepEqual(r.satirlar, [
    "Türkiyenin iki bin yirmi altı yılı hedefi, büyük, belli oldu.",
    "MP üç ve dört K var!",
    "Sürüm bir nokta iki nokta üç çıktı ci pi yu hazır.",
  ]);
  assert.equal(r.metin, r.satirlar.join("\n"));
  assert.ok(!/[\d"“”'’|]/.test(r.metin.replace(/ \|\| bagli/g, "")));
  assert.equal(V.metinHazirla("Bu ２０２６ yılıdır.", "tr").satirlar[0], "Bu iki bin yirmi altı yılıdır.", "tam genislikli rakam");
  assert.equal(V.metinHazirla("Kod 007 idi.", "tr").satirlar[0], "Kod sıfır sıfır yedi idi.");
  assert.deepEqual(V.metinHazirla("Hişt... yaklaş bakalım. Bitmiyor... Her nesil ekler.", "tr").satirlar,
    ["Hişt... yaklaş bakalım.", "Bitmiyor...", "Her nesil ekler."], "uc noktadan sonra kucuk harf: ayni cumle");
  assert.deepEqual(V.metinHazirla("“” ''", "tr").sorunlar, ["okunacak metin kalmadı"]);
});

test("metin: uzun cumle virgulde bolunur ('|| bagli' kisa durak), her satir sinirin altinda", () => {
  const parca = "bu cümle uzun bir anlatımın parçasıdır ve virgülle devam eder";
  const uzun = Array(12).fill(parca).join(", ") + ".";
  assert.ok(uzun.length > 700);
  const r = V.metinHazirla(uzun, "tr");
  assert.ok(r.satirlar.length >= 3);
  r.satirlar.forEach((s, i) => {
    const govde = s.replace(/ \|\| bagli$/, "");
    assert.ok(govde.length <= V.SATIR_SINIRI, govde.length + " karakter");
    assert.equal(/ \|\| bagli$/.test(s), i < r.satirlar.length - 1, "son parca disinda kisa durak");
    assert.ok(!/,$/.test(govde));
  });
  const bosluksuz = "字".repeat(400) + "。";
  assert.ok(V.metinHazirla(bosluksuz, "zh").satirlar.every(s => s.replace(/ \|\| bagli$/, "").length <= V.SATIR_SINIRI_CJK));
});

test("metin (en): sayilar okunusa cevrilir (yil, sira, ondalik, binlik, on yil, saat), kesme isareti kalir", () => {
  assert.equal(V.enSayi("0"), "zero");
  assert.equal(V.enSayi("1250000"), "one million two hundred fifty thousand");
  assert.equal(V.enSayi("101"), "one hundred one");
  assert.equal(V.enSayi("1".repeat(19)), null);
  assert.equal(V.enYil(1969), "nineteen sixty-nine");
  assert.equal(V.enYil(1905), "nineteen oh five");
  assert.equal(V.enYil(1900), "nineteen hundred");
  assert.equal(V.enSira("21"), "twenty-first");
  assert.equal(V.enSira("12"), "twelfth");
  assert.equal(V.enSira("40"), "fortieth");
  const r = V.metinHazirla("In 1969, 3 astronauts flew 384,400 kilometers. It´s the 21st century; pi is 3.14 and the 1980s were “wild”. Meet at 10:05 or 7:00 in 2005 with agent 007.", "en");
  assert.deepEqual(r.sorunlar, []);
  assert.deepEqual(r.satirlar, [
    "In nineteen sixty-nine, three astronauts flew three hundred eighty-four thousand four hundred kilometers.",
    "It's the twenty-first century; pi is three point one four and the nineteen eighties were wild.",
    "Meet at ten oh five or seven o'clock in two thousand five with agent zero zero seven.",
  ]);
});

test("metin: baska dilde rakam kalirsa sorun bildirilir; zh/ja cumle sonu bosluksuz da bolunur; fr kesme isareti kalir", () => {
  const de = V.metinHazirla("Es gibt 3 Orte.", "de");
  assert.equal(de.sorunlar.length, 1);
  assert.match(de.sorunlar[0], /rakam okuyamaz \(3\)/);
  assert.deepEqual(V.metinHazirla("L'eau « claire » coule.", "fr"), { metin: "L'eau claire coule.", satirlar: ["L'eau claire coule."], sorunlar: [] });
  assert.deepEqual(V.metinHazirla("有些地方很美。卡帕多奇亚就是这样的地方！", "zh").satirlar, ["有些地方很美。", "卡帕多奇亚就是这样的地方！"]);
  assert.deepEqual(V.metinHazirla("Bu GPU iyi.", "en").satirlar, ["Bu GPU iyi."], "Turkce sozluk yabanci metne uygulanmaz");
});

test("zaman asimi metin uzunluguyla buyur ama sinirlidir (5-90 dk)", () => {
  assert.equal(V.zamanAsimiHesapla("Kısa.", "tr"), 5 * 60000);
  const orta = V.zamanAsimiHesapla("a".repeat(3000), "tr"), uzun = V.zamanAsimiHesapla("a".repeat(6000), "tr");
  assert.ok(orta > 5 * 60000 && uzun > orta);
  assert.equal(V.zamanAsimiHesapla("a".repeat(200000), "tr"), 90 * 60000);
  assert.ok(V.zamanAsimiHesapla("字".repeat(1000), "zh") > V.zamanAsimiHesapla("a".repeat(1000), "tr"), "CJK karakteri daha uzun konusulur");
});

// ===========================================================================
// Kurulu degilken
// ===========================================================================
test("kurulum denetimi: eksik her parca icin anlasilir neden", () => {
  const neden = env => V.kurulumDenetle(env).neden;
  assert.match(neden(envDen({})), /VOXCPM_KOK tanımlı değil/);
  assert.match(neden(envDen({ VOXCPM_KOK: path.join(ara, "olmayan-klasor") })), /klasörü bulunamadı/);
  assert.match(neden(kuruluEnv(sahteKok(null, { okuYok: true }))), /ses_tasarim\/oku\.py yok/);
  assert.match(neden(envDen({ VOXCPM_KOK: sahteKok(), VOXCPM_PYTHON: path.join(ara, "yok-python.exe") })), /Python ortamı yok/);
  assert.match(neden(envDen({ VOXCPM_KOK: sahteKok() })), /Python ortamı yok: .*\.venv/);
  assert.match(neden(kuruluEnv(sahteKok(null, { ayarYok: true }))), /ayar dosyası yok/);
  assert.match(neden(kuruluEnv(sahteKok(null, { modelYok: true }))), /modeli \(voxcpm2-q8_0\.gguf\) bulunamadı/);
  assert.match(neden(kuruluEnv(sahteKok({ backend: "cuda", cuda_bin: "cuda/bin" }))), /cudart64_12\.dll/);
  const tamam = V.kurulumDenetle(kuruluEnv(sahteKok()));
  assert.equal(tamam.ok, true, tamam.neden);
  assert.equal(tamam.python, SAHTE);
});

test("kurulu degilken: acik secim cikis 2 + kurulum adimlari; otomatikte sessizce Edge; celisen motor cikis 2", () => {
  const SISTEM = M.motorHazirMi("sistem").ok ? ["sistem"] : [];
  const edge = { msedge: S.sahteEdge() };
  try { M.motorSirasi("voxcpm", envDen({}), {}); assert.fail("hata bekleniyordu"); }
  catch (e) {
    assert.ok(e instanceof ortak.OrtakHata);
    assert.equal(e.cikis, 2);
    assert.match(e.message, /'voxcpm' ses motoru kullanılamıyor: VOXCPM_KOK/);
    for (const k of ["git clone", "kur.ps1", "VOXCPM_KOK=", V.KAYNAK_REPO]) assert.ok(e.cozum.includes(k), "cozum: " + k);
  }
  assert.deepEqual(M.motorSirasi("otomatik", envDen({}), edge, "voxcpm:tok_anlatici"), ["edge"].concat(SISTEM), "kurulu degil: sessizce Edge");
  const env = kuruluEnv(sahteKok());
  assert.deepEqual(M.motorSirasi("otomatik", env, edge, "voxcpm:tok_anlatici"), ["voxcpm", "edge"].concat(SISTEM));
  assert.deepEqual(M.motorSirasi("otomatik", env, edge, "tr-TR-AhmetNeural"), ["edge"].concat(SISTEM), "Edge sesiyle VoxCPM otomatik siraya girmez");
  assert.deepEqual(M.motorSirasi("voxcpm", env, {}), ["voxcpm"]);
  assert.throws(() => M.motorSirasi("edge", env, edge, "voxcpm:tok_anlatici"), e => e.cikis === 2 && /VoxCPM sesi/.test(e.message));
  assert.throws(() => M.motorSirasi("elevenlabs", env, {}), e => e.cikis === 2 && /voxcpm/.test(e.cozum));
  // yedek motora VoxCPM sesi gitmez: dilin varsayilan Edge sesi
  assert.equal(M.motorOlustur("edge", { ses: "voxcpm:tok_anlatici", dil: "tr", hiz: "+0%", enjekte: edge }).ses, "tr-TR-AhmetNeural");
  assert.equal(M.motorOlustur("edge", { ses: "en-US-ChristopherNeural", dil: "en", hiz: "+0%", enjekte: edge }).ses, "en-US-ChristopherNeural");
  assert.throws(() => V.olustur({ ses: "voxcpm:tok_anlatici", dil: "tr", env: envDen({}) }), e => e.kalici && /kur\.ps1/.test(e.cozum));
});

// ===========================================================================
// Cikti donusumu (sahte calistirici)
// ===========================================================================
testF("cikti donusumu: okuma.wav -> mp3 (48 kHz mono), ozet.json'dan yaklasik kelime zamani, ilerleme, temizlik", async () => {
  const kok = sahteKok();
  const { calistir, durum } = sahteCalistir();
  const notlar = [];
  const motor = V.olustur({ ses: "voxcpm:tok_anlatici", dil: "tr", hiz: "+0%", env: kuruluEnv(kok), calistir, kilitDosyasi: kilit(), log: m => notlar.push(m) });
  assert.equal(motor.ad, "voxcpm");
  assert.equal(motor.ses, "voxcpm:tok_anlatici");
  assert.equal(motor.kelimeZamani, false);
  const oranlar = [];
  const r = await motor.sentez("Bu birinci cümledir. Bu da ikinci cümledir!", { araDizin: ara, ilerleme: o => oranlar.push(o) });
  assert.equal(durum.cagrilar.length, 1);
  const c = durum.cagrilar[0];
  assert.equal(c.komut, SAHTE);
  assert.equal(c.cwd, kok);
  assert.equal(c.argv[c.argv.indexOf("--ses") + 1], path.join(V.SESLER, "tok_anlatici"));
  assert.equal(c.argv[c.argv.indexOf("--dil") + 1], "tr");
  assert.equal(c.metin, "Bu birinci cümledir.\nBu da ikinci cümledir!\n");
  assert.equal(c.env.PYTHONIOENCODING, "utf-8");
  assert.equal(c.zamanAsimiMs, 5 * 60000);
  assert.deepEqual(oranlar, [0.5, 1]);
  assert.ok(notlar.some(n => /VoxCPM: 2\/2 cümle/.test(n)));
  assert.ok(Math.abs(sureOlc(r.buf) - 2.35) < 0.2, "sure ~ 2 satir + ara");
  const f = path.join(ara, "olcum.mp3");
  fs.writeFileSync(f, r.buf);
  const bilgi = execFileSync(require("../ff-yol.js").ffprobe, ["-v", "error", "-show_entries", "stream=sample_rate,channels", "-of", "csv=p=0", f]).toString().trim();
  assert.equal(bilgi, "48000,1");
  assert.deepEqual(r.kelimeler.map(k => k.w), ["Bu", "birinci", "cümledir.", "Bu", "da", "ikinci", "cümledir!"]);
  assert.equal(r.kelimeler[0].t, 0);
  assert.equal(r.kelimeler[3].t, 1350, "ikinci cumle 1 sn + 0.35 sn arada baslar");
  for (let i = 1; i < r.kelimeler.length; i++) assert.ok(r.kelimeler[i].t >= r.kelimeler[i - 1].t);
  assert.deepEqual(fs.readdirSync(path.join(kok, "cikti")), [], "calisma klasoru silinmeli");
});

testF("hiz: +20% atempo ile uygulanir (ses ve kelime zamanlari kisalir)", async () => {
  const { calistir } = sahteCalistir({ satirSn: 2.4 });
  const motor = V.olustur({ ses: "voxcpm:anlatici_en", dil: "en", hiz: "+20%", env: kuruluEnv(sahteKok()), calistir, kilitDosyasi: kilit() });
  const r = await motor.sentez("One short line here.", { araDizin: ara });
  assert.ok(Math.abs(sureOlc(r.buf) - 2.0) < 0.15, "2.4 sn / 1.2 = 2.0 sn: " + sureOlc(r.buf));
  const son = r.kelimeler[r.kelimeler.length - 1];
  assert.ok(Math.abs(son.t + son.d - 2000) <= 2);
  assert.equal(V.tempoBul("+7%"), 1.07);
  assert.equal(V.tempoBul("x"), 1);
});

test("cikis hatalari siniflanir: metin/kurulum kalici, EOS tekrarsiz, GPU bellegi gecici", () => {
  const h = (stderr, kod) => V.cikisHatasi({ kod: kod || 1, stderr, stdout: "" });
  const metin = h("Traceback\nValueError: metin:\n  - metin: okunamayan işaret ['3']; rakamı yazıyla yaz");
  assert.equal(metin.kalici, true); assert.match(metin.cozum, /yazıyla/);
  const ayar = h("ses_tasarim.ayarlar.AyarHatasi: C:\\vox\\ayarlar.json:\n  - model bulunamadı: x");
  assert.equal(ayar.kalici, true); assert.match(ayar.cozum, /kur\.ps1/);
  assert.equal(h("ModuleNotFoundError: No module named 'soundfile'").kalici, true);
  const eos = h("ses_tasarim.motor.MotorHatasi: şu satırlar düzgün bitmedi (EOS yok): [2]; cümleyi kısalt");
  assert.equal(eos.tekrarsiz, true); assert.ok(!eos.kalici); assert.match(eos.cozum, /böl/);
  const gpu = h("MotorHatasi: motor rc=3; GGML_ASSERT(mem_buffer) failed");
  assert.ok(!gpu.kalici && !gpu.tekrarsiz && gpu.beklemeMs > 0);
  assert.match(h("bilinmeyen bir sey", 9).message, /kod 9.*bilinmeyen bir sey/);
});

test("denemeliSentez: VoxCPM politikasi (2 deneme), tekrarsiz hata yeniden denenmez", async () => {
  const kok = sahteKok();
  let n = 0;
  const { calistir } = sahteCalistir({ sonuc: () => { n++; return { kod: 1, stdout: "", stderr: "MotorHatasi: şu satırlar düzgün bitmedi (EOS yok): [1]" }; } });
  const motor = V.olustur({ ses: "voxcpm:tok_anlatici", dil: "tr", hiz: "+0%", env: kuruluEnv(kok), calistir, kilitDosyasi: kilit() });
  await assert.rejects(M.denemeliSentez(motor, "Bir cümle.", { araDizin: ara, dil: "tr", hiz: "+0%", ayar: { bekle: async () => {} } }),
    e => e.tekrarsiz === true && /bitiremedi/.test(e.message));
  assert.equal(n, 1, "ayni tohum ayni sonucu verir: tekrar yok");
  n = 0;
  const bekle = [];
  const g = sahteCalistir({ sonuc: () => { n++; return { kod: 1, stdout: "", stderr: "GGML_ASSERT(mem_buffer)" }; } });
  const m2 = V.olustur({ ses: "voxcpm:tok_anlatici", dil: "tr", hiz: "+0%", env: kuruluEnv(kok), calistir: g.calistir, kilitDosyasi: kilit() });
  await assert.rejects(M.denemeliSentez(m2, "Bir cümle.", { araDizin: ara, dil: "tr", hiz: "+0%", ayar: { bekle: async ms => { bekle.push(ms); } } }), /ekran kartı/);
  assert.equal(n, 2, "VoxCPM denemeAyari: 2 deneme");
  assert.deepEqual(bekle, [15000]);
});

testF("varsayilan calistirici: .js Python sarmalayicisi node ile calisir, satirlar okunur; iptal sureci durdurur", async () => {
  const kok = sahteKok();
  const metinF = path.join(ara, "calistir-metin.txt");
  fs.writeFileSync(metinF, "Bir.\nİki.\n");
  const k = V.komutKur({ python: SAHTE, kok, sesKlasoru: path.join(V.SESLER, "tok_anlatici"), metinDosyasi: metinF, ciktiDizin: path.join(ara, "calistir-cikti"), dil: "tr" });
  const satirlar = [];
  const r = await V.varsayilanCalistir(Object.assign({}, k, { zamanAsimiMs: 60000, satir: l => satirlar.push(l) }));
  assert.equal(r.kod, 0, r.stderr);
  assert.deepEqual(satirlar.filter(l => /cümle/.test(l)).map(l => l.trim()), ["1/2 cümle, 0 sn", "2/2 cümle, 1 sn"]);
  assert.ok(fs.existsSync(path.join(ara, "calistir-cikti", "okuma.wav")));
  const ac = new AbortController();
  const t0 = Date.now();
  const kayit = path.join(ara, "iptal-kayit.jsonl");
  const p = V.varsayilanCalistir(Object.assign({}, k, { zamanAsimiMs: 60000, sinyal: ac.signal,
    env: Object.assign({}, process.env, { SAHTE_VOXCPM_GECIKME_MS: "20000", SAHTE_VOXCPM_KAYIT: kayit }) }));
  for (let i = 0; i < 200 && !fs.existsSync(kayit); i++) await new Promise(r => setTimeout(r, 25));   // surec basladi
  ac.abort(new Error("zaman aşımı (test)"));
  await assert.rejects(p, /zaman aşımı \(test\)/);
  assert.ok(Date.now() - t0 < 15000, "iptal hemen donmeli");
  // red, surec KAPANDIKTAN sonra gelir: cagiran GPU kilidini birakip calisma klasorunu silerken motor hala calismiyor
  const cocukPid = JSON.parse(fs.readFileSync(kayit, "utf8").trim().split("\n")[0]).pid;
  assert.equal(ortak.pidCanliMi(cocukPid), false, "iptal edilen surec kapanmis olmali");
  await assert.rejects(V.varsayilanCalistir({ komut: path.join(ara, "yok", "python.exe"), argv: [], cwd: ara, zamanAsimiMs: 5000 }),
    e => e.kalici === true && /çalıştırılamadı/.test(e.message));
});

test("VOXCPM_PYTHON: goreli yol VoxCPM klasorune gore; Windows'ta .cmd/.bat kalici hata (tekrar denenmez)", async () => {
  const kok = path.join(ara, "vox-goreli");
  assert.equal(V.pythonYolu(kok, envDen({ VOXCPM_PYTHON: path.join("araclar", "py.exe") }), "win32"), path.join(kok, "araclar", "py.exe"));
  if (process.platform !== "win32") return;
  const cmd = path.join(ara, "sarmalayici.cmd");
  fs.writeFileSync(cmd, "@echo off\r\n");
  await assert.rejects(V.varsayilanCalistir({ komut: cmd, argv: ["-m", "ses_tasarim.oku"], cwd: ara, zamanAsimiMs: 5000 }),
    e => e.kalici === true && /\.bat\/\.cmd/.test(e.cozum));
});

testF("sinyal (Ctrl+C / panelden Durdur): calisan VoxCPM sureci de kapatilir, betik 130 ile cikar", () => {
  const kayit = path.join(ara, "sinyal-kayit.jsonl");
  const metinF = path.join(ara, "sinyal-metin.txt");
  fs.writeFileSync(metinF, "Bir.\n");
  const k = V.komutKur({ python: SAHTE, kok: ara, sesKlasoru: path.join(V.SESLER, "tok_anlatici"), metinDosyasi: metinF,
    ciktiDizin: path.join(ara, "sinyal-cikti"), dil: "tr" });
  const betik = "const V = require(" + JSON.stringify(path.join(S.KOK, "lib", "ses-motor-voxcpm.js")) + ");\n" +
    "const fs = require('fs');\n" +
    "V.varsayilanCalistir(Object.assign(" + JSON.stringify(k) + ", { zamanAsimiMs: 60000, env: Object.assign({}, process.env, " +
    "{ SAHTE_VOXCPM_GECIKME_MS: '30000', SAHTE_VOXCPM_KAYIT: " + JSON.stringify(kayit) + " }) })).catch(() => {});\n" +
    "const t = setInterval(() => { if (fs.existsSync(" + JSON.stringify(kayit) + ")) { clearInterval(t); process.emit('SIGINT'); } }, 50);\n" +
    "setTimeout(() => process.exit(9), 20000);\n";
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["-e", betik], { encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 130, "Ctrl+C cikis kodu: " + r.status + " " + r.stderr);
  assert.ok(Date.now() - t0 < 25000);
  const cocukPid = JSON.parse(fs.readFileSync(kayit, "utf8").trim().split("\n")[0]).pid;
  assert.equal(ortak.pidCanliMi(cocukPid), false, "VoxCPM (python) sureci yetim kalmamali");
});

test("metin (en): surum/oran gibi kalan rakam dizileri cumleye bolunmez", () => {
  assert.deepEqual(V.metinHazirla("Version 1.2.3 is out now. The ratio was 3:1 today.", "en").satirlar,
    ["Version one point two point three is out now.", "The ratio was three one today."]);
  assert.deepEqual(V.metinHazirla("Pick 1,2,3 or more.", "en").satirlar, ["Pick one, two, three or more."]);
});

test("eski calisma klasorleri: yalniz bizim adla, sahibi olu ve 10 dk'dan eski olanlar silinir", () => {
  const taban = path.join(ara, "eski-cikti");
  const eski = Date.now() - 3600000;
  const adlar = {
    oluEski: "otopilot-2147483000-" + eski + "-abc123",
    oluYeni: "otopilot-2147483000-" + Date.now() + "-abc123",
    benim: "otopilot-" + process.pid + "-" + eski + "-abc123",
    canli: "otopilot-" + (process.ppid || 1) + "-" + eski + "-abc123",
    baska: "kullanicinin-okumasi",
  };
  for (const ad of Object.values(adlar)) fs.mkdirSync(path.join(taban, ad, "_motor"), { recursive: true });
  V.eskiCalismaTemizle(taban);
  const kalan = fs.readdirSync(taban).sort();
  assert.deepEqual(kalan, [adlar.oluYeni, adlar.benim, adlar.canli, adlar.baska].sort());
});

// ===========================================================================
// GPU kilidi
// ===========================================================================
test("GPU kilidi: ikinci is sira bekler, birakilinca alir; olu surecin kilidi devralinir; iptal edilebilir", async () => {
  const dosya = kilit();
  const birak1 = await V.gpuKilidiAl({ dosya });
  assert.equal(JSON.parse(fs.readFileSync(dosya, "utf8")).pid, process.pid);
  // ayni surecin kalmis kilidi bayat sayilir: baska surec gibi davranmak icin pid'i canli bir surece cevir
  fs.writeFileSync(dosya, JSON.stringify({ pid: process.ppid || 1, zaman: Date.now() }));
  const notlar = [];
  let alindi = false;
  const p = V.gpuKilidiAl({ dosya, aralikMs: 20, log: m => notlar.push(m) }).then(b => { alindi = true; return b; });
  await new Promise(r => setTimeout(r, 120));
  assert.equal(alindi, false, "canli surecin kilidi beklenir");
  assert.equal(notlar.length, 1);
  assert.match(notlar[0], /sıra bekleniyor/);
  fs.unlinkSync(dosya);                                   // diger surec isini bitirdi
  const birak2 = await p;
  assert.equal(alindi, true);
  birak2();
  assert.ok(!fs.existsSync(dosya), "birak() kilidi siler");
  birak1();                                               // artik baskasinin degil: sessizce gecer

  fs.writeFileSync(dosya, JSON.stringify({ pid: 2147483000, zaman: Date.now() }));     // olu surec
  const birak3 = await V.gpuKilidiAl({ dosya, aralikMs: 20 });
  assert.equal(JSON.parse(fs.readFileSync(dosya, "utf8")).pid, process.pid);
  birak3();

  fs.writeFileSync(dosya, JSON.stringify({ pid: process.ppid || 1, zaman: Date.now() }));
  const ac = new AbortController();
  const bekleyen = V.gpuKilidiAl({ dosya, aralikMs: 20, sinyal: ac.signal });
  setTimeout(() => ac.abort(new Error("iptal (test)")), 60);
  await assert.rejects(bekleyen, /iptal \(test\)/);
  fs.unlinkSync(dosya);
});

test("GPU kilidi: ayni surecte ust uste binme (gec biten eski deneme) yeni sahibin kilidini calmaz/silmez; eski bicim ve 2 sa'ten eski kilit bayat", async () => {
  const dosya = kilit();
  const birak1 = await V.gpuKilidiAl({ dosya });
  let alindi = false;
  const p = V.gpuKilidiAl({ dosya, aralikMs: 20 }).then(b => { alindi = true; return b; });
  await new Promise(r => setTimeout(r, 120));
  assert.equal(alindi, false, "ayni surecin TUTULAN kilidi beklenir (eskiden 'ayni pid = bayat' diye calinirdi)");
  birak1();
  const birak2 = await p;
  const jeton2 = JSON.parse(fs.readFileSync(dosya, "utf8")).jeton;
  birak1();                                                      // gec gelen ikinci birakma: yeni sahibin kilidine dokunmaz
  assert.equal(JSON.parse(fs.readFileSync(dosya, "utf8")).jeton, jeton2);
  birak2();
  assert.ok(!fs.existsSync(dosya));

  fs.writeFileSync(dosya, JSON.stringify({ pid: process.pid, zaman: Date.now() }));                  // eski bicim, jetonsuz
  (await V.gpuKilidiAl({ dosya, aralikMs: 20 }))();
  fs.writeFileSync(dosya, JSON.stringify({ pid: process.ppid || 1, zaman: Date.now() - V.KILIT_BAYAT_MS - 1000 }));   // canli ama cok eski
  (await V.gpuKilidiAl({ dosya, aralikMs: 20 }))();
  fs.writeFileSync(dosya, "42");                                                                      // bozuk icerik, eski dosya
  const eski = new Date(Date.now() - 60000);
  fs.utimesSync(dosya, eski, eski);
  (await V.gpuKilidiAl({ dosya, aralikMs: 20 }))();
  assert.ok(!fs.existsSync(dosya));
});

testF("GPU sirasi beklemesi deneme zaman asimina sayilmaz; zaman asimi asil isten itibaren gecerli", async () => {
  const kok = sahteKok();
  const dosya = kilit();
  const tutan = await V.gpuKilidiAl({ dosya });                  // baska bir seslendirme ekran kartinda
  const notlar = [];
  const { calistir, durum } = sahteCalistir();
  const motor = V.olustur({ ses: "voxcpm:tok_anlatici", dil: "tr", hiz: "+0%", env: kuruluEnv(kok), calistir,
    kilitDosyasi: dosya, kilitAralikMs: 50, log: m => notlar.push(m) });
  setTimeout(tutan, 3500);
  const t0 = Date.now();
  const r = await M.denemeliSentez(motor, "Sırası gelince okunacak cümle.", { araDizin: ara, dil: "tr", hiz: "+0%",
    ayar: { zamanAsimiMs: 2500, denemeSayisi: 1, bekle: async () => {} } });
  assert.ok(Date.now() - t0 >= 3400, "kilit birakilana dek beklendi");
  assert.ok(r.buf.length > 0 && durum.cagrilar.length === 1);
  assert.ok(notlar.some(n => /sıra bekleniyor/.test(n)));
  // kilit bosken asil is zaman asimini asarsa yine kesilir
  const asili = V.olustur({ ses: "voxcpm:tok_anlatici", dil: "tr", hiz: "+0%", env: kuruluEnv(kok), kilitDosyasi: kilit(),
    calistir: c => new Promise((_, red) => c.sinyal.addEventListener("abort", () => red(c.sinyal.reason), { once: true })) });
  await assert.rejects(M.denemeliSentez(asili, "Bitmeyen cümle.", { araDizin: ara, dil: "tr", hiz: "+0%",
    ayar: { zamanAsimiMs: 300, denemeSayisi: 1, bekle: async () => {} } }), /zaman aşımı/);
});

// ===========================================================================
// ses-uret entegrasyonu
// ===========================================================================
let isSayac = 0;
const yeniIs = paragraflar => S.isOlustur(uretim.taban, "vox" + (++isSayac), paragraflar);
const okuJson = (dizin, ad) => JSON.parse(fs.readFileSync(path.join(dizin, "Voice", ad), "utf8"));

testF("seslendir(): --motor voxcpm ile tam kosu, zamanlama.json motor/ses, paragraf ici ilerleme, ikinci kosu atlanir", async () => {
  const dizin = yeniIs(["Birinci paragraf iki cümledir. Burada biter.", "İkinci paragraf 3 kelime."]);
  const { calistir, durum } = sahteCalistir();
  const ilerlemeler = [], loglar = [];
  const g = {
    dizin, ses: "tr-TR-AhmetNeural", hiz: "+0%", dil: "tr", motorSecimi: "voxcpm", okunus: {},
    env: kuruluEnv(sahteKok()), enjekte: { voxcpmCalistir: calistir, voxcpmKilit: kilit() },
    log: m => loglar.push(m), uyari: () => {}, ilerleme: (a, y, e) => ilerlemeler.push(y),
  };
  const r = await U.seslendir(g);
  assert.equal(r.atlandi, false);
  assert.equal(r.motor, "voxcpm");
  assert.equal(r.ses, "voxcpm:tok_anlatici", "ad verilmedi: dilin varsayilani");
  const z = okuJson(dizin, "zamanlama.json");
  assert.equal(z.motor, "voxcpm");
  assert.equal(z.ses, "voxcpm:tok_anlatici");
  assert.equal(z.paragrafSayisi, 2);
  assert.equal(durum.cagrilar.length, 2);
  assert.equal(durum.cagrilar[1].metin, "İkinci paragraf üç kelime.\n", "metniHazirla + VoxCPM hazirligi");
  const k = okuJson(dizin, "kelimeler.json");
  assert.ok(k.paragraflar.every(p => p.kelimeler.length > 0), "yaklasik kelime zamanlari kaydedilir");
  assert.ok(ilerlemeler.some(y => y > 0 && y < 50), "birinci paragrafin icinden ilerleme");
  assert.ok(ilerlemeler.every((y, i) => i === 0 || y >= ilerlemeler[i - 1]), "yuzde geri gitmez");
  const r2 = await U.seslendir(g);
  assert.equal(r2.atlandi, true);
  assert.equal(durum.cagrilar.length, 2);
});

testF("otomatik + voxcpm sesi + VoxCPM kurulu degil: hata yok, Edge'in o dildeki sesine duser; sonradan kurulunca VoxCPM'le yeniden uretir", async () => {
  const dizin = yeniIs(["Kurulum yokken Edge ile okunacak paragraf burada."]);
  const loglar = [];
  const ortakG = { dizin, ses: "voxcpm:tok_anlatici", hiz: "+0%", dil: "tr", motorSecimi: "otomatik", okunus: {},
    ayar: S.hizliAyar(), log: m => loglar.push(m), uyari: () => {}, ilerleme: () => {} };
  const r = await U.seslendir(Object.assign({}, ortakG, { env: envDen({}), enjekte: { msedge: S.sahteEdge() } }));
  assert.equal(r.motor, "edge");
  assert.equal(r.ses, "tr-TR-AhmetNeural");
  assert.ok(loglar.some(l => /VoxCPM kullanılamıyor \(VOXCPM_KOK/.test(l)), loglar.join("\n"));
  const kok = sahteKok();
  const { calistir } = sahteCalistir();
  const ek = { env: kuruluEnv(kok), enjekte: { msedge: S.sahteEdge(), voxcpmCalistir: calistir, voxcpmKilit: kilit() } };
  const r2 = await U.seslendir(Object.assign({}, ortakG, ek, { ayar: undefined }));
  assert.equal(r2.atlandi, false, "VoxCPM artik kurulu: Edge'le uretilmis ses guncel sayilmaz");
  assert.equal(r2.motor, "voxcpm");
  const r3 = await U.seslendir(Object.assign({}, ortakG, ek, { ayar: undefined }));
  assert.equal(r3.atlandi, true);
});

testF("baska dilde rakam: --motor voxcpm GPU'ya gitmeden cikis 2 + cozum; otomatikte Edge'e gecilir", async () => {
  const dizin = yeniIs(["Es gibt 3 Orte in Kappadokien."]);
  const { calistir, durum } = sahteCalistir();
  const g = { dizin, ses: "voxcpm:anlatici_de", hiz: "+0%", dil: "de", okunus: {}, ayar: S.hizliAyar(),
    env: kuruluEnv(sahteKok()), log: () => {}, ilerleme: () => {} };
  const uyarilar = [];
  await assert.rejects(U.seslendir(Object.assign({}, g, { motorSecimi: "voxcpm", uyari: () => {},
    enjekte: { voxcpmCalistir: calistir, voxcpmKilit: kilit() } })),
    e => e instanceof ortak.OrtakHata && e.cikis === 2 && /paragraf 1: .*rakam okuyamaz/.test(e.message) && e.cozum === V.METIN_COZUM);
  assert.equal(durum.cagrilar.length, 0, "Python hic cagrilmamali");
  const r = await U.seslendir(Object.assign({}, g, { motorSecimi: "otomatik", uyari: m => uyarilar.push(m),
    enjekte: { msedge: S.sahteEdge(), voxcpmCalistir: calistir, voxcpmKilit: kilit() } }));
  assert.equal(r.motor, "edge");
  assert.equal(r.ses, "de-DE-ConradNeural");
  assert.ok(uyarilar.some(u => /'voxcpm' motoru başarısız/.test(u)));
  assert.equal(durum.cagrilar.length, 0);
});

testF("EOS hatasi: paragraf duser, cikis 4 ve VoxCPM'e ozgu cozum (cumleyi bol)", async () => {
  const dizin = yeniIs(["Bu paragraf biter.", "Bu paragraf bitmez."]);
  const { calistir } = sahteCalistir({ sonuc: (n, c) => (n === 1 ? null : { kod: 1, stdout: "", stderr: "MotorHatasi: şu satırlar düzgün bitmedi (EOS yok): [1]" }) });
  const iyi = sahteCalistir().calistir;
  const karma = async c => ((await calistir(c)) || iyi(c));
  await assert.rejects(U.seslendir({ dizin, ses: "voxcpm:tok_anlatici", hiz: "+0%", dil: "tr", motorSecimi: "voxcpm", okunus: {},
    env: kuruluEnv(sahteKok()), enjekte: { voxcpmCalistir: karma, voxcpmKilit: kilit() }, log: () => {}, uyari: () => {}, ilerleme: () => {} }),
  e => e.cikis === 4 && /Paragraf 2/.test(e.message) && /böl/.test(e.cozum));
});

testF("otomatik + VoxCPM bazi paragraflari bitirdi: Edge'e GECILMEZ, biten paragraflar silinmez, ikinci kosu kaldigi yerden devam eder", async () => {
  const dizin = yeniIs(["Bu paragraf biter.", "Bu paragraf bitmez.", "Bu da biter."]);
  const kok = sahteKok();
  const edge = S.sahteEdge();
  let cagri = 0;
  const iyi = sahteCalistir();
  const eosIkinci = async c => {                                   // "bitmez" iceren paragraf EOS'suz kalir
    cagri++;
    const metin = fs.readFileSync(c.argv[c.argv.indexOf("--metin") + 1].slice(1), "utf8");
    if (/bitmez/.test(metin)) return { kod: 1, stdout: "", stderr: "MotorHatasi: şu satırlar düzgün bitmedi (EOS yok): [1]" };
    return iyi.calistir(c);
  };
  const g = { dizin, ses: "voxcpm:tok_anlatici", hiz: "+0%", dil: "tr", motorSecimi: "otomatik", okunus: {},
    env: kuruluEnv(kok), log: () => {}, uyari: () => {}, ilerleme: () => {} };
  await assert.rejects(U.seslendir(Object.assign({}, g, { enjekte: { msedge: edge, voxcpmCalistir: eosIkinci, voxcpmKilit: kilit() } })),
    e => e.cikis === 4 && /Paragraf 2/.test(e.message) && /böl/.test(e.cozum) && /Edge'e geçilmedi/.test(e.cozum) && /--motor edge --ses tr-TR-AhmetNeural/.test(e.cozum));
  assert.equal(edge.durum.istekler.length, 0, "biten VoxCPM paragraflari silinip Edge'le bastan yapilmamali");
  assert.equal(cagri, 3);
  const tmp = path.join(dizin, "Voice", "parts.tmp");
  assert.ok(fs.existsSync(path.join(tmp, "000.mp3")) && fs.existsSync(path.join(tmp, "002.mp3")), "biten paragraflar korunur");
  // metin duzeltildi (cumle bolundu): yalniz o paragraf yeniden uretilir
  fs.writeFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), "Bu paragraf biter.\n\nBu paragraf artık biter.\n\nBu da biter.\n");
  cagri = 0;
  const r = await U.seslendir(Object.assign({}, g, { enjekte: { msedge: edge, voxcpmCalistir: eosIkinci, voxcpmKilit: kilit() } }));
  assert.equal(r.motor, "voxcpm");
  assert.equal(cagri, 1, "biten iki paragraf onceki kosudan alindi");
  assert.equal(edge.durum.istekler.length, 0);
});

testF("otomatik + VoxCPM hic paragraf bitiremedi (ekran karti hatasi): o zaman Edge'e gecilir", async () => {
  const dizin = yeniIs(["Birinci paragraf.", "İkinci paragraf."]);
  const edge = S.sahteEdge();
  const gpuHata = async () => ({ kod: 3, stdout: "", stderr: "MotorHatasi: motor rc=3; GGML_ASSERT(mem_buffer) failed" });
  const r = await U.seslendir({ dizin, ses: "voxcpm:tok_anlatici", hiz: "+0%", dil: "tr", motorSecimi: "otomatik", okunus: {},
    ayar: S.hizliAyar(), env: kuruluEnv(sahteKok()), enjekte: { msedge: edge, voxcpmCalistir: gpuHata, voxcpmKilit: kilit() },
    log: () => {}, uyari: () => {}, ilerleme: () => {} });
  assert.equal(r.motor, "edge");
  assert.equal(r.ses, "tr-TR-AhmetNeural");
});

// ===========================================================================
// seslendir.js komut satiri (sahte VoxCPM Python'u: test/ses-sahte-voxcpm.js)
// ===========================================================================
const SESLENDIR = path.join(S.KOK, "seslendir.js");
const cliEnv = ek => Object.assign({}, process.env, {
  OTOMASYON_URETIM: uretim.taban, OTOMASYON_ENV_DOSYASI: ortam.envDosyasi, OTOMASYON_AYAR_DOSYASI: path.join(ortam.dizin, "yok.json"),
  VOXCPM_KOK: "", VOXCPM_PYTHON: "", TMP: ortam.dizin, TEMP: ortam.dizin, TMPDIR: ortam.dizin,     // GPU kilidi test klasorunde
}, ek || {});
const cli = (args, ek) => spawnSync(process.execPath, [SESLENDIR, ...args], { env: cliEnv(ek), encoding: "utf8", timeout: 120000 });
const sonucSatiri = cikti => JSON.parse((cikti.split(/\r?\n/).find(l => l.startsWith("@@SONUC ")) || "@@SONUC null").slice(8));

testF("CLI: --motor voxcpm sahte VoxCPM ile cikis 0 (komut, cwd, dil dogru); kurulu degilken cikis 2 + Turkce cozum", () => {
  const kok = sahteKok();
  const kayit = path.join(ara, "cli-kayit.jsonl");
  const dizin = S.isOlustur(uretim.taban, "voxcli", ["Komut satırından VoxCPM ile 2 cümle. İkincisi bu."]);
  fs.writeFileSync(path.join(dizin, "konu.json"), JSON.stringify({ baslik_en: "T", dil: "tr", ses: "voxcpm:belgesel_hanim" }));
  const r = cli(["voxcli", "--motor", "voxcpm"], { VOXCPM_KOK: kok, VOXCPM_PYTHON: SAHTE, SAHTE_VOXCPM_KAYIT: kayit });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const s = sonucSatiri(r.stdout);
  assert.equal(s.motor, "voxcpm");
  assert.equal(s.ses, "voxcpm:belgesel_hanim");
  const c = JSON.parse(fs.readFileSync(kayit, "utf8").trim().split("\n")[0]);
  assert.equal(path.resolve(c.cwd), path.resolve(kok));
  assert.equal(c.argv[c.argv.indexOf("--ses") + 1], path.join(V.SESLER, "belgesel_hanim"));
  assert.equal(c.argv[c.argv.indexOf("--dil") + 1], "tr");
  assert.equal(c.metin, "Komut satırından Voks si pi em ile iki cümle.\nİkincisi bu.\n", "rakam yaziya + okunus sozlugu");
  assert.ok(/@@ILERLEME \{"asama":"ses"/.test(r.stdout));
  assert.ok(fs.existsSync(path.join(dizin, "Voice", "parts", "000.mp3")));

  const r2 = cli(["voxcli", "--motor", "voxcpm", "--yeniden"]);
  assert.equal(r2.status, 2, r2.stderr);
  assert.match(r2.stderr, /✗ 'voxcpm' ses motoru kullanılamıyor: VOXCPM_KOK tanımlı değil/);
  assert.match(r2.stderr, /kur\.ps1/);
  assert.ok(r2.stderr.includes(V.KAYNAK_REPO));
});

testF("CLI: --ses voxcpm:anlatici_en (konu.json'dakinden farkli) dili ses kartindan alir (Edge onek kurali gibi)", () => {
  const kok = sahteKok();
  const kayit = path.join(ara, "cli-dil-kayit.jsonl");
  const dizin = S.isOlustur(uretim.taban, "voxdil", ["We counted 2 owls."]);
  fs.writeFileSync(path.join(dizin, "konu.json"), JSON.stringify({ baslik_en: "T", dil: "tr", ses: "tr-TR-AhmetNeural" }));
  const r = cli(["voxdil", "--ses", "voxcpm:anlatici_en"], { VOXCPM_KOK: kok, VOXCPM_PYTHON: SAHTE, SAHTE_VOXCPM_KAYIT: kayit });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(sonucSatiri(r.stdout).ses, "voxcpm:anlatici_en");
  const c = JSON.parse(fs.readFileSync(kayit, "utf8").trim().split("\n")[0]);
  assert.equal(c.argv[c.argv.indexOf("--dil") + 1], "en");
  assert.equal(c.metin, "We counted two owls.\n", "Ingilizce sayi kurali");
});

test("CLI: --liste-sesler 14 VoxCPM sesini ve kurulum durumunu listeler", () => {
  const r = cli(["--liste-sesler"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /voxcpm:tok_anlatici \*/);
  assert.match(r.stdout, /Kurulum: YOK — VOXCPM_KOK tanımlı değil/);
  const s = sonucSatiri(r.stdout);
  assert.equal(s.voxcpm.kurulu, false);
  assert.equal(s.voxcpm.sesler.length, 14);
  assert.equal(s.voxcpm.sesler.find(x => x.kimlik === "voxcpm:anlatici_en").ornek, "sesler/voxcpm2/anlatici_en/ornek_okuma.mp3");
  assert.equal(s.edge.tr, "tr-TR-AhmetNeural");
  const r2 = cli(["--liste-sesler"], { VOXCPM_KOK: sahteKok(), VOXCPM_PYTHON: SAHTE });
  assert.equal(sonucSatiri(r2.stdout).voxcpm.kurulu, true);
});
