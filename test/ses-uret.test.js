// test/ses-uret.test.js — seslendirme cekirdegi: paragraf dusme (exit 4), parts temizligi, zamanlama.json,
// guncelse atla, kismi devam, motor yedegi, okunus. Ag sahte; ses sentetik (gercek ffmpeg).
"use strict";
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./ses-sahte.js");

const ortam = S.ortamiYalitla();
const uretim = S.testUretimi();
const testF = S.ffmpegTesti(test);          // ffmpeg yoksa (CI) atlanir
const ortak = require("../lib/ortak.js");
const U = require("../lib/ses-uret.js");
const M = require("../lib/ses-motor.js");

test.after(() => { uretim.temizle(); ortam.temizle(); });

let sayac = 0;
const yeniIs = paragraflar => S.isOlustur(uretim.taban, "is" + (++sayac), paragraflar);
const NEFES = [];            // uyari ciktilari
const sessiz = { log: () => {}, uyari: m => NEFES.push(m), ilerleme: () => {} };
const PAR = [
  "The first paragraph has several words in it.",
  "A second paragraph follows right after the first.",
  "Third paragraph here, also quite short but fine.",
  "The fourth paragraph keeps going for a while longer.",
  "Finally the fifth and last paragraph ends it all.",
];
const env0 = () => "";
const oku = (dizin, ad) => JSON.parse(fs.readFileSync(path.join(dizin, "Voice", ad), "utf8"));
const parcalar = dizin => fs.readdirSync(path.join(dizin, "Voice", "parts")).sort();

const calistir = (dizin, ek, sahte) => U.seslendir(Object.assign({
  dizin, ses: "en-US-ChristopherNeural", hiz: "+7%", dil: "en", motorSecimi: "edge", okunus: {},
  env: env0, enjekte: { msedge: sahte }, ayar: S.hizliAyar(), ...sessiz,
}, ek || {}));

testF("normal kosu: parts/NNN.mp3, kelimeler.json ve zamanlama.json sozlesmeye uygun", async () => {
  const dizin = yeniIs(PAR);
  fs.writeFileSync(path.join(dizin, "Voice", "altyazi.srt"), "1\n00:00:00,000 --> 00:00:01,000\neski\n");
  const sahte = S.sahteEdge();
  const r = await calistir(dizin, { hedefSn: 12 }, sahte);
  assert.equal(r.atlandi, false);
  assert.equal(r.motor, "edge");

  assert.deepEqual(parcalar(dizin), ["000.mp3", "001.mp3", "002.mp3", "003.mp3", "004.mp3"]);
  assert.ok(!fs.existsSync(path.join(dizin, "Voice", "parts.tmp")), "tmp klasoru kalmamali");
  assert.ok(!fs.existsSync(path.join(dizin, "Voice", "altyazi.srt")), "eski Voice/altyazi.srt silinmeli");

  const z = oku(dizin, "zamanlama.json");
  assert.equal(z.surum, 1);
  assert.equal(z.metinOzeti, ortak.paragrafOzeti(PAR));
  assert.equal(z.paragrafSayisi, 5);
  assert.equal(z.dil, "en"); assert.equal(z.ses, "en-US-ChristopherNeural"); assert.equal(z.motor, "edge"); assert.equal(z.hiz, "+7%");
  assert.equal(z.bosluk, 0.35);
  assert.equal(z.hedefSn, 12);
  assert.equal(z.paragraflar.length, 5);

  // sureSn ffprobe ile OLCULMUS: baslangicSn[i] = toplam(sure[j<i]) + i*bosluk
  let toplam = 0;
  z.paragraflar.forEach((p, i) => {
    assert.equal(p.no, i);
    assert.equal(p.dosya, "parts/" + String(i).padStart(3, "0") + ".mp3");
    const gercek = M.sureOlc(path.join(dizin, "Voice", p.dosya));
    assert.ok(Math.abs(p.sureSn - gercek) < 0.002, "sureSn olculen sureyle ayni: " + p.sureSn + " / " + gercek);
    assert.ok(Math.abs(p.baslangicSn - (toplam + i * 0.35)) < 0.01 * (i + 1), "baslangicSn formulu, paragraf " + i);
    assert.equal(p.kelimeSayisi, PAR[i].split(/\s+/).length);
    assert.match(p.sha, /^[0-9a-f]{8}$/);
    toplam += p.sureSn;
  });
  assert.ok(Math.abs(z.toplamSn - (toplam + 4 * 0.35)) < 0.05, "toplamSn = Σsure + (N-1)*bosluk");
  assert.equal(typeof z.olculenKelimeHizi, "number");
  assert.equal(typeof z.sapmaYuzde, "number");

  const k = oku(dizin, "kelimeler.json");
  assert.equal(k.surum, 1); assert.equal(k.motor, "edge"); assert.equal(k.paragraflar.length, 5);
  assert.equal(k.paragraflar[0].okunanMetin, PAR[0]);
  assert.equal(k.paragraflar[0].metinDegisti, false);
  assert.equal(k.paragraflar[0].kelimeler[0].w, "The");
  assert.equal(k.paragraflar[0].kelimeler[0].t, 0);
  assert.ok(NEFES.some(m => /Ses süresi hedeften/.test(m)), "hedefe gore sapma uyarisi verilmeli");
  assert.equal(sahte.durum.kapatilan >= 1, true, "baglanti kapatilmali");
});

testF("paragraf dusunce exit 4: zamanlama.json YAZILMAZ, eski ses ve eski zamanlama bozulmaz", async () => {
  const dizin = yeniIs(PAR);
  await calistir(dizin, {}, S.sahteEdge());                       // ilk saglam kosu
  const eskiZam = fs.readFileSync(path.join(dizin, "Voice", "zamanlama.json"), "utf8");
  const eskiBayt = fs.statSync(path.join(dizin, "Voice", "parts", "002.mp3")).size;

  // metni degistir: 3. paragraf (indeks 2) hep hata alsin
  const yeni = PAR.slice(); yeni[2] = "Replaced third paragraph that will always fail badly.";
  fs.writeFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), yeni.join("\n\n"));
  const sahte = S.sahteEdge((no, metin) => (/always fail/.test(metin) ? "hata" : "tam"));
  await assert.rejects(calistir(dizin, {}, sahte), e => {
    assert.equal(e.cikis, 4);
    assert.equal(e.message, "Paragraf 3 seslendirilemedi");
    assert.ok(e.cozum);
    assert.equal(e.detay[0].no, 2);
    return true;
  });
  assert.equal(fs.readFileSync(path.join(dizin, "Voice", "zamanlama.json"), "utf8"), eskiZam, "eski zamanlama.json korunmali");
  assert.equal(fs.statSync(path.join(dizin, "Voice", "parts", "002.mp3")).size, eskiBayt, "eski parts degismemeli");
  assert.ok(fs.existsSync(path.join(dizin, "Voice", "parts.tmp")), "kismi devam icin tmp kalir");
});

testF("kismi devam: ayni sha8'li parca yeniden sentezlenmez; yalniz dusen paragraf uretilir", async () => {
  const dizin = yeniIs(PAR);
  let acik = true;
  const s1 = S.sahteEdge((no, metin) => (acik && /fourth/.test(metin) ? "hata" : "tam"));
  await assert.rejects(calistir(dizin, {}, s1), /Paragraf 4 seslendirilemedi/);
  assert.equal(s1.durum.istekler.filter(i => /fourth/.test(i.metin)).length, 5, "dusen paragraf 5 kez denendi");
  assert.equal(s1.durum.istekler.length, 3 + 5 + 1, "3 saglam + dusen paragraf 5 deneme + son paragraf (tek hata ardisik sayilmaz)");

  acik = false;
  const s2 = S.sahteEdge();
  const r = await calistir(dizin, {}, s2);
  assert.equal(r.atlandi, false);
  assert.equal(s2.durum.istekler.length, 1, "yalniz 4. paragraf yeniden uretilmeli");
  assert.match(s2.durum.istekler[0].metin, /fourth/);
  assert.deepEqual(parcalar(dizin), ["000.mp3", "001.mp3", "002.mp3", "003.mp3", "004.mp3"]);
  assert.equal(oku(dizin, "zamanlama.json").paragrafSayisi, 5);
});

testF("ardisik 3 paragraf dusunce o motor birakilir (servis kapali) ve hepsi listelenir", async () => {
  const dizin = yeniIs(PAR);
  const sahte = S.sahteEdge(() => "hata");
  await assert.rejects(calistir(dizin, {}, sahte), e => {
    assert.equal(e.cikis, 4);
    assert.equal(e.message, "Paragraf 1, 2, 3 seslendirilemedi");
    assert.match(e.cozum, /Servis yanıt vermiyor/);
    assert.match(e.cozum, /AZURE_SPEECH_KEY|Yedek motor hazır/, "yedek motor onerisi");
    return true;
  });
  assert.equal(sahte.durum.istekler.length, 15, "3 paragraf x 5 deneme; kalan paragraflar denenmedi");
});

testF("eski parca kalintisi silinir: 20 parcalik eski ses, 5 paragrafli yeni senaryo", async () => {
  const dizin = yeniIs(PAR);
  const eski = path.join(dizin, "Voice", "parts");
  fs.mkdirSync(eski, { recursive: true });
  for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(eski, String(i).padStart(3, "0") + ".mp3"), "eski ses");
  fs.writeFileSync(path.join(eski, "concat.txt"), "eski liste");
  await calistir(dizin, {}, S.sahteEdge());
  assert.deepEqual(parcalar(dizin), ["000.mp3", "001.mp3", "002.mp3", "003.mp3", "004.mp3"], "fazladan eski parca kalmamali");
  assert.ok(!fs.existsSync(path.join(dizin, "Voice", "parts.eski")));
  assert.ok(M.sureOlc(path.join(eski, "004.mp3")) > 0.5, "yeni parcalar gecerli mp3");
});

testF("guncelse atla; --yeniden, metin/ses/hiz/okunus degisimi yeniden uretir", async () => {
  const dizin = yeniIs(PAR);
  const s1 = S.sahteEdge();
  await calistir(dizin, {}, s1);
  assert.equal(s1.durum.istekler.length, 5);

  const s2 = S.sahteEdge();
  const atla = await calistir(dizin, {}, s2);
  assert.deepEqual([atla.atlandi, atla.neden], [true, "ses güncel"]);
  assert.equal(s2.durum.istekler.length, 0, "atlarken motora istek gitmez");

  const s3 = S.sahteEdge();
  assert.equal((await calistir(dizin, { yeniden: true }, s3)).atlandi, false);
  assert.equal(s3.durum.istekler.length, 5);

  const s4 = S.sahteEdge();
  assert.equal((await calistir(dizin, { hiz: "+10%" }, s4)).atlandi, false, "hiz degisti");
  const s5 = S.sahteEdge();
  assert.equal((await calistir(dizin, { hiz: "+10%", okunus: { first: "1st" } }, s5)).atlandi, false, "okunus sozlugu degisti");
  const s6 = S.sahteEdge();
  assert.equal((await calistir(dizin, { hiz: "+10%", okunus: { first: "1st" } }, s6)).atlandi, true);

  // metin degisince
  fs.appendFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), "\n\nA sixth paragraph appears now.");
  const s7 = S.sahteEdge();
  const r7 = await calistir(dizin, { hiz: "+10%", okunus: { first: "1st" } }, s7);
  assert.equal(r7.atlandi, false);
  assert.equal(r7.paragrafSayisi, 6);
  assert.equal(parcalar(dizin).length, 6);
  assert.equal(s7.durum.istekler.length, 6, "basarili kosudan sonra tmp kalmaz: metin degisince hepsi yeniden uretilir");
});

testF("parca dosyasi silinirse (bozulursa) guncel sayilmaz", async () => {
  const dizin = yeniIs(PAR);
  await calistir(dizin, {}, S.sahteEdge());
  fs.writeFileSync(path.join(dizin, "Voice", "parts", "003.mp3"), "kesik");
  const sahte = S.sahteEdge();
  const r = await calistir(dizin, {}, sahte);
  assert.equal(r.atlandi, false);
  assert.equal(sahte.durum.istekler.length, 5);
});

testF("bilinmeyen/ust surumlu ya da bozuk zamanlama.json guvenle yeniden uretilir (uyarili)", async () => {
  const dizin = yeniIs(PAR);
  await calistir(dizin, {}, S.sahteEdge());
  const zamDosya = path.join(dizin, "Voice", "zamanlama.json");
  const z = JSON.parse(fs.readFileSync(zamDosya, "utf8"));
  z.surum = 2;
  fs.writeFileSync(zamDosya, JSON.stringify(z));
  NEFES.length = 0;
  const s1 = S.sahteEdge();
  assert.equal((await calistir(dizin, {}, s1)).atlandi, false);
  assert.ok(NEFES.some(m => /sürümü tanınmıyor \(2\)/.test(m)));
  assert.equal(oku(dizin, "zamanlama.json").surum, 1);

  fs.writeFileSync(zamDosya, '{"surum": 1, bozuk');
  const s2 = S.sahteEdge();
  assert.equal((await calistir(dizin, {}, s2)).atlandi, false, "bozuk dosya cokertmez, yeniden uretir");
  assert.equal(oku(dizin, "zamanlama.json").paragrafSayisi, 5);
});

testF("okunus hazirligi yalniz TTS'e uygulanir: kelimeler.json okunanMetin + metinDegisti, senaryo dosyasi aynen kalir", async () => {
  const tr = ["Enflasyon %15 arttı ve 2.500 kişi etkilendi.", "Hiçbir şey değişmedi bu cümlede.", "Dr. Ahmet 3,5 saat konuştu."];
  const dizin = yeniIs(tr);
  const oncesi = fs.readFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8");
  const sahte = S.sahteEdge();
  await calistir(dizin, { dil: "tr", ses: "tr-TR-AhmetNeural" }, sahte);
  assert.equal(fs.readFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8"), oncesi, "senaryo/altyazi metni degismemeli");
  assert.equal(sahte.durum.istekler[0].metin, "Enflasyon yüzde on beş arttı ve iki bin beş yüz kişi etkilendi.");
  assert.equal(sahte.durum.istekler[2].metin, "doktor Ahmet üç virgül beş saat konuştu.");
  const k = oku(dizin, "kelimeler.json");
  assert.equal(k.dil, "tr");
  assert.equal(k.paragraflar[0].metinDegisti, true);
  assert.equal(k.paragraflar[1].metinDegisti, false);
  assert.equal(k.paragraflar[0].okunanMetin, "Enflasyon yüzde on beş arttı ve iki bin beş yüz kişi etkilendi.");
  assert.equal(k.paragraflar[0].kelimeler.length, 12);
  assert.equal(oku(dizin, "zamanlama.json").paragraflar[0].kelimeSayisi, 7, "kelimeSayisi ozgun metindendir");
});

testF("&, < ve > Edge'e XML kacisli gider", async () => {
  const dizin = yeniIs(["AT&T said x < y > z loudly today."]);
  const sahte = S.sahteEdge();
  await calistir(dizin, {}, sahte);
  assert.equal(sahte.durum.istekler[0].metin, "AT&amp;T said x &lt; y &gt; z loudly today.");
});

testF("kelime zamani hic gelmezse zamanlama yine yazilir, kelimeler [] ve uyari verilir", async () => {
  const dizin = yeniIs(PAR);
  NEFES.length = 0;
  await calistir(dizin, {}, S.sahteEdge(() => "kelimesiz"));
  const k = oku(dizin, "kelimeler.json");
  assert.ok(k.paragraflar.every(p => p.kelimeler.length === 0));
  assert.ok(NEFES.some(m => /kelime zamanlarını göndermedi/.test(m)));
  assert.equal(oku(dizin, "zamanlama.json").paragrafSayisi, 5);
});

testF("otomatik motor yedegi: Edge dusunce Piper'a gecer, hepsi Piper'dan gelir", async () => {
  const dizin = yeniIs(PAR);
  NEFES.length = 0;
  const edge = S.sahteEdge((no, metin) => (/third/i.test(metin) ? "hata" : "tam"));
  const piper = S.sahtePiperCalistir();
  const env = a => ({ PIPER_YOL: "piper", PIPER_MODEL: "C:\\m\\tr_TR-dfki-medium.onnx" })[a] || "";
  const r = await U.seslendir({
    dizin, ses: "en-US-ChristopherNeural", hiz: "+0%", dil: "en", motorSecimi: "otomatik", okunus: {},
    env, enjekte: { msedge: edge, calistir: piper.calistir }, ayar: S.hizliAyar(), ...sessiz,
  });
  assert.equal(r.motor, "piper");
  assert.equal(r.ses, "tr_TR-dfki-medium");
  assert.equal(piper.durum.cagri, 5, "TUM paragraflar Piper'dan");
  assert.ok(NEFES.some(m => /'edge' motoru başarısız.*'piper' motoruyla baştan/.test(m)), "gecis logda soylenmeli: " + NEFES.join(" | "));
  const z = oku(dizin, "zamanlama.json");
  assert.equal(z.motor, "piper"); assert.equal(z.ses, "tr_TR-dfki-medium");
  assert.ok(oku(dizin, "kelimeler.json").paragraflar.every(p => p.kelimeler.length === 0), "piper kelime zamani vermez");
  assert.equal(parcalar(dizin).length, 5);
});

testF("acik motor secilirse yedege GECILMEZ", async () => {
  const dizin = yeniIs(PAR);
  const edge = S.sahteEdge(() => "hata");
  const env = a => ({ PIPER_YOL: "piper", PIPER_MODEL: "m.onnx" })[a] || "";
  const piper = S.sahtePiperCalistir();
  await assert.rejects(U.seslendir({ dizin, ses: "en-US-ChristopherNeural", hiz: "+0%", dil: "en", motorSecimi: "edge", okunus: {},
    env, enjekte: { msedge: edge, calistir: piper.calistir }, ayar: S.hizliAyar(), ...sessiz }), e => e.cikis === 4);
  assert.equal(piper.durum.cagri, 0);
});

testF("kalici motor hatasi (Azure 401) cikis 3 ve acik mesaj", async () => {
  const dizin = yeniIs(PAR);
  const env = a => ({ AZURE_SPEECH_KEY: "yanlis", AZURE_SPEECH_REGION: "westeurope" })[a] || "";
  const getir = async () => ({ durum: 401, basliklar: {}, govde: Buffer.from("") });
  await assert.rejects(U.seslendir({ dizin, ses: "en-US-ChristopherNeural", hiz: "+0%", dil: "en", motorSecimi: "azure", okunus: {},
    env, enjekte: { getir }, ayar: S.hizliAyar(), ...sessiz }), e => {
    assert.equal(e.cikis, 3);
    assert.match(e.message, /Azure Speech anahtarı/);
    return true;
  });
});

testF("Azure ile tam kosu: kelime zamani yok, yine de zamanlama + sure kontrolu", async () => {
  const dizin = yeniIs(PAR);
  const env = a => ({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "westeurope" })[a] || "";
  const getir = async (url, o) => ({ durum: 200, basliklar: {}, govde: S.sentetikMp3(3) });
  const r = await U.seslendir({ dizin, ses: "en-US-ChristopherNeural", hiz: "+0%", dil: "en", motorSecimi: "azure", okunus: {},
    env, enjekte: { getir }, ayar: S.hizliAyar(), ...sessiz });
  assert.equal(r.motor, "azure");
  assert.equal(oku(dizin, "zamanlama.json").motor, "azure");
  assert.ok(Math.abs(oku(dizin, "zamanlama.json").paragraflar[1].sureSn - 3) < 0.1);
});

testF("senaryo yok ya da bos: exit 2, anlasilir mesaj", async () => {
  const bos = yeniIs(null);
  await assert.rejects(calistir(bos, {}, S.sahteEdge()), e => e.cikis === 2 && /senaryo yok/i.test(e.message));
  const bosMetin = yeniIs(["", "   "]);
  await assert.rejects(calistir(bosMetin, {}, S.sahteEdge()), e => e.cikis === 2);
});

testF("BOM'lu senaryo dosyasi ilk paragrafi bozmaz", async () => {
  const dizin = yeniIs(null);
  fs.writeFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), "\uFEFFFirst paragraph with a BOM mark.\r\n\r\nSecond paragraph, windows line ends.\r\n");
  const sahte = S.sahteEdge();
  await calistir(dizin, {}, sahte);
  assert.equal(sahte.durum.istekler[0].metin, "First paragraph with a BOM mark.");
  assert.equal(oku(dizin, "zamanlama.json").paragrafSayisi, 2);
});

testF("uzun paragraf (1500+ karakter) bolunur; parts'ta tek parca, kelimeler tek zaman cizgisinde", async () => {
  const uzun = ("This sentence is repeated to make a very long paragraph indeed. ").repeat(30).trim();     // ~2000 karakter
  const dizin = yeniIs(["Short opening paragraph here.", uzun]);
  const sahte = S.sahteEdge();
  await calistir(dizin, { ayar: S.hizliAyar({ zamanAsimiMs: 20000 }) }, sahte);
  assert.ok(sahte.durum.istekler.length >= 3, "1 kisa + en az 2 parca");
  for (const i of sahte.durum.istekler) assert.ok(i.metin.length <= 1500);
  assert.deepEqual(parcalar(dizin), ["000.mp3", "001.mp3"]);
  const k = oku(dizin, "kelimeler.json").paragraflar[1];
  assert.equal(k.kelimeler.length, uzun.split(/\s+/).length);
  const z = oku(dizin, "zamanlama.json").paragraflar[1];
  assert.ok(Math.abs(z.sureSn - M.sureOlc(path.join(dizin, "Voice", "parts", "001.mp3"))) < 0.002);
});

testF("ornekUret: 5 sn ornek dosyasi ve sonuc alanlari", async () => {
  const cikti = path.join(uretim.taban, "ornek", "ses.mp3");
  const r = await U.ornekUret({ cikti, ses: "tr-TR-AhmetNeural", motorSecimi: "edge", env: env0, enjekte: { msedge: S.sahteEdge() },
    ayar: S.hizliAyar(), log: () => {} });
  assert.equal(r.motor, "edge");
  assert.equal(r.dosya, cikti);
  assert.ok(r.sureSn > 1);
  assert.ok(fs.existsSync(cikti) && !fs.existsSync(cikti + ".part"));
});

testF("ornekUret: motor basarisizsa cikis 3 ve Turkce mesaj", async () => {
  const cikti = path.join(uretim.taban, "ornek", "yok.mp3");
  await assert.rejects(U.ornekUret({ cikti, ses: "en-US-ChristopherNeural", motorSecimi: "edge", env: env0,
    enjekte: { msedge: S.sahteEdge(() => "hata") }, ayar: S.hizliAyar({ denemeSayisi: 2 }), log: () => {} }),
    e => e.cikis === 3 && /Ses örneği üretilemedi/.test(e.message));
  assert.ok(!fs.existsSync(cikti));
});

testF("disk dolu (ENOSPC) paragraf hatasi sayilmaz: ilk hatada durur, tekrar denenmez", async () => {
  const dizin = yeniIs(PAR);
  const sahte = S.sahteEdge();
  const orijinal = sahte.MsEdgeTTS.prototype.toStream;
  sahte.MsEdgeTTS.prototype.toStream = function () { throw Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" }); };
  await assert.rejects(calistir(dizin, {}, sahte), e => e.code === "ENOSPC");
  sahte.MsEdgeTTS.prototype.toStream = orijinal;
  assert.ok(!fs.existsSync(path.join(dizin, "Voice", "zamanlama.json")));
  assert.equal(ortak.hataCevir(Object.assign(new Error("x"), { code: "ENOSPC" })).kod, "disk_dolu");
});

testF("test sonrasi kalinti yok: parts.eski / .part / gecici dosya", () => {
  const bul = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(g => {
    const p = path.join(d, g.name);
    return g.isDirectory() ? [p].concat(bul(p)) : [p];
  });
  const kotu = bul(uretim.taban).filter(p => /\.part$|\.eski$|\.tmp$/.test(p) && !/parts\.tmp$/.test(p));
  assert.deepEqual(kotu, []);
});
