// AI Studyo (studyo.js): fotograftan stil klibi, kuru calisma, girdi korumalari, video yukleme, kurgu. Sahte vidIQ; gercek krediye DOKUNMAZ.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const fik = require("./render-fikstur");
const kok = fik.ortamKur();
const skip = !fik.ffmpegVarMi() && "ffmpeg yok";
test.after(() => fik.temizle(kok));
const S = require("../studyo.js");
const K = require("../lib/vidiq-klip.js");
const ff = () => require("../ff-yol.js");

const sessiz = { log: () => {} };
function foto(dosya, renk) {
  execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=" + renk + ":s=320x480", "-frames:v", "1", dosya], { windowsHide: true });
}
function klip(dosya, sn) {
  execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=320x240:r=30", "-t", String(sn), "-pix_fmt", "yuv420p", dosya], { windowsHide: true });
}
function sahteVidiq() {
  const d = { bakiye: 10000, basladi: [], yukle: [] };
  return {
    d,
    async cagir(arac, arg) {
      if (arac === "vidiq_balance") return { totalCredits: d.bakiye };
      if (arac === "vidiq_video_upload") { d.yukle.push(arg.url); return { videoUrl: "https://s3.example.com/up.mp4", uploadId: "u1" }; }
      if (arac === "vidiq_generate_video") { d.basladi.push(arg); d.bakiye -= arg.duration * 20; return { mcpJobId: "is-" + d.basladi.length }; }
      throw new Error("beklenmeyen " + arac);
    },
    async isBekle(no) { return { videoUrl: "https://cdn.example.com/" + no + ".mp4" }; },
  };
}

test("yeni/tara: stil, oran ve sahne modlari; gecersiz stil reddedilir", { skip }, () => {
  assert.throws(() => S.yeni("x1", { stil: "yok" }), /Bilinmeyen stil/);
  const r = S.yeni("aile", { stil: "cizgi-film" });
  foto(path.join(r.girdi, "02-plaj.jpg"), "blue"); foto(path.join(r.girdi, "01-ev.png"), "red"); klip(path.join(r.girdi, "03-sahne.mp4"), 2);
  fs.writeFileSync(path.join(r.girdi, "not.txt"), "x");
  const t = S.tara("aile");
  assert.deepEqual(t.eklenen, ["01-ev.png", "02-plaj.jpg", "03-sahne.mp4"]);
  const a = S.ayarOku("aile");
  assert.deepEqual(a.sahneler.map(s => s.mod), ["referans", "referans", "referans"]);
  assert.equal(a.sahneler[2].an, 1);
  assert.equal(S.tara("aile").eklenen.length, 0);                    // ikinci tarama tekrar eklemez
  assert.throws(() => S.yeni("aile", {}), /zaten var/);
});

test("kuru calisma: istem stili icerir, kredi harcanmaz; --onay fotoyu referans olarak base64 gonderir", { skip }, async () => {
  const v = sahteVidiq();
  const r = await S.uret("aile", { butce: "1000" }, Object.assign({ vidiq: v, indir: async () => Buffer.alloc(0) }, sessiz));
  assert.equal(r.durum, "kuru_calisma"); assert.equal(r.uretilecek, 3); assert.equal(r.tahminiKredi, 3 * 6 * 20);
  assert.equal(v.d.basladi.length, 0);
  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(20, 1)]);
  const r2 = await S.uret("aile", { butce: "1000", onay: true }, Object.assign({ vidiq: v, indir: async () => MP4 }, sessiz));
  assert.equal(r2.durum, "bitti"); assert.equal(v.d.basladi.length, 3);
  const g = v.d.basladi[0];
  assert.match(g.prompt, /cartoon animation style/); assert.match(g.prompt, /reference photos/);
  assert.equal(g.ingredients.length, 1); assert.ok(!g.startFrameB64);
  assert.equal(Buffer.from(g.ingredients[0], "base64").subarray(0, 2).toString("hex"), "ffd8");   // JPEG'e cevrildi
  // ayni fotograflar ikinci kez ucretli uretilmez
  const r3 = await S.uret("aile", { butce: "1000", onay: true }, Object.assign({ vidiq: v, indir: async () => MP4 }, sessiz));
  assert.equal(r3.durum, "hepsi_hazir"); assert.equal(v.d.basladi.length, 3);
});

test("fotograf degisince ayni istem yeni cekimdir; ilk-kare modu startFrameB64 gonderir", { skip }, async () => {
  const v = sahteVidiq();
  const a = S.ayarOku("aile");
  a.sahneler[0].mod = "ilk-kare";
  fs.writeFileSync(path.join(kok, "aile", "studyo.json"), JSON.stringify(a));
  const r = await S.uret("aile", { butce: "1000" }, Object.assign({ vidiq: v }, sessiz));
  assert.equal(r.uretilecek, 1);                                      // yalniz modu degisen sahne
  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(20, 1)]);
  await S.uret("aile", { butce: "1000", onay: true }, Object.assign({ vidiq: v, indir: async () => MP4 }, sessiz));
  assert.ok(v.d.basladi[0].startFrameB64); assert.ok(!v.d.basladi[0].ingredients);
});

test("video modu: url vidIQ'ya ucretsiz yuklenir, videoUrls gider; desteklemeyen model reddedilir", { skip }, async () => {
  S.yeni("donustur", { stil: "anime" });
  const a = S.ayarOku("donustur");
  a.sahneler.push({ mod: "video", url: "https://www.youtube.com/watch?v=abc", hareket: "keep the dance", sure: 6 });
  fs.writeFileSync(path.join(kok, "donustur", "studyo.json"), JSON.stringify(a));
  const v = sahteVidiq();
  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(20, 1)]);
  const kuru = await S.uret("donustur", { butce: "500" }, Object.assign({ vidiq: v }, sessiz));
  assert.equal(kuru.durum, "kuru_calisma"); assert.equal(v.d.yukle.length, 0);   // kuru calismada yukleme bile yok
  await S.uret("donustur", { butce: "500", onay: true }, Object.assign({ vidiq: v, indir: async () => MP4 }, sessiz));
  assert.deepEqual(v.d.yukle, ["https://www.youtube.com/watch?v=abc"]);
  assert.deepEqual(v.d.basladi[0].videoUrls, ["https://s3.example.com/up.mp4"]);
  assert.match(v.d.basladi[0].prompt, /keep the original motion/);
  a.model = "seedance-2"; a.cozunurluk = "720p";
  fs.writeFileSync(path.join(kok, "donustur", "studyo.json"), JSON.stringify(a));
  await assert.rejects(S.uret("donustur", { butce: "500" }, Object.assign({ vidiq: v }, sessiz)), /video dönüştürmez/);
});

test("yonetmen modu: plan/kamera/lens/isik istemin sonuna sinema diliyle eklenir; sablon sahneleri ekler; gecersiz kod reddedilir", { skip }, () => {
  S.yeni("yon1", { stil: "serbest" });
  const n = S.sablonEkle("yon1", "romantik", []);
  assert.equal(n, 6);
  const a = S.ayarOku("yon1");
  assert.equal(a.sahneler.length, 6); assert.ok(a.sahneler.every(s => s.mod === "metin"));
  const i3 = S.istemKur(a, a.sahneler[2]);
  assert.match(i3, /Cinematic direction: close-up shot, static locked-off camera, 85mm portrait lens, shallow depth of field, creamy bokeh, golden hour warm backlight\./);
  assert.throws(() => S.sablonEkle("yon1", "komedi", []), /Bilinmeyen şablon/);
  const yol = path.join(kok, "yon1", "studyo.json");
  a.sahneler[0].plan = "yok"; fs.writeFileSync(yol, JSON.stringify(a));
  assert.throws(() => S.ayarOku("yon1"), /bilinmeyen plan/);
  // fotograf verilirse sahneler sirayla referans olur
  S.yeni("yon2", { stil: "cizgi-film" });
  const r = path.join(kok, "yon2", "girdi");
  foto(path.join(r, "a.jpg"), "red"); foto(path.join(r, "b.jpg"), "blue");
  S.sablonEkle("yon2", "aksiyon", ["a.jpg", "b.jpg"]);
  const b = S.ayarOku("yon2");
  assert.deepEqual(b.sahneler.map(s => s.kaynak), ["a.jpg", "b.jpg", "a.jpg", "b.jpg", "a.jpg"]);
  assert.ok(b.sahneler.every(s => s.mod === "referans"));
  assert.throws(() => S.sablonEkle("yon2", "gerilim", ["yok.jpg"]), /Girdi dosyası yok/);
});

test("girdiDenetle: wan-3 referans almaz, karma girdi reddedilir", () => {
  assert.throws(() => K.girdiDenetle("wan-3", { istem: "x", referans: ["a.jpg"] }), /en çok 0 referans/);
  assert.throws(() => K.girdiDenetle("minimax-h3", { istem: "x", ilkKare: "a.jpg", referans: ["b.jpg"] }), /birlikte/);
  assert.throws(() => K.girdiDenetle("minimax-h3", { istem: "x", videoUrl: "http://x/y.mp4" }), /https/);
  assert.doesNotThrow(() => K.girdiDenetle("minimax-h3", { istem: "x" }));
});

test("kur: klipler oran boyutunda birlesir, klipsiz sahne atlanir", { skip }, async () => {
  const clips = path.join(kok, "aile", "Clips");
  const kayit = K.kayitOku(clips);
  for (const g of kayit.klipler.filter(x => x.dosya)) klip(path.join(clips, g.dosya), 1);
  const r = await S.kur("aile", {}, sessiz);
  assert.ok(fs.existsSync(r.cikti));
  const boyut = execFileSync(ff().ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", r.cikti], { encoding: "utf8" }).trim();
  assert.equal(boyut, "1080,1920");
  assert.equal(r.sahne, 3);
  await assert.rejects(S.kur("donustur-yok", {}, sessiz), /studyo\.json yok/);
});

test("serbest stil + metin modu: fotografsiz, ek stil metni olmadan istem aynen gider", { skip }, async () => {
  S.yeni("serbest1", { stil: "serbest" });
  assert.throws(() => S.sahneEkle("serbest1", "  "), /İstem boş/);
  S.sahneEkle("serbest1", "an astronaut walking on mars at sunset, cinematic", 5);
  const a = S.ayarOku("serbest1");
  assert.equal(a.sahneler[0].mod, "metin");
  assert.equal(S.istemKur(a, a.sahneler[0]), "an astronaut walking on mars at sunset, cinematic.");
  const v = sahteVidiq();
  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(20, 1)]);
  const r = await S.uret("serbest1", { butce: "200", onay: true }, Object.assign({ vidiq: v, indir: async () => MP4 }, sessiz));
  assert.equal(r.durum, "bitti");
  assert.ok(!v.d.basladi[0].startFrameB64 && !v.d.basladi[0].ingredients && !v.d.basladi[0].videoUrls);
});

test("anlatim: ucretsiz ses uretilir, sahne anlatimdan kisaysa uzar, altyazi + muzik karisir; ayni metin ikinci kez seslendirilmez", { skip }, async () => {
  const yol = path.join(kok, "aile", "studyo.json");
  const a = JSON.parse(fs.readFileSync(yol, "utf8"));
  a.dil = "tr";
  a.sahneler[0].anlatim = "Bir varmış bir yokmuş, küçük bir kedi uzak bir plajda güneşin doğuşunu izlemiş.";
  fs.writeFileSync(yol, JSON.stringify(a));
  let cagri = 0;
  const sahteSes = async g => {
    cagri++;
    if (cagri === 1) { assert.equal(g.dil, "tr"); assert.match(g.metin, /küçük bir kedi/); }
    execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2.5", "-c:a", "aac", "-f", "adts", g.cikti], { windowsHide: true });
  };
  const muzik = path.join(kok, "muzik.m4a");
  execFileSync(ff().ffmpeg, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=2", "-c:a", "aac", muzik], { windowsHide: true });
  const r = await S.kur("aile", { muzik }, Object.assign({ ses: sahteSes }, sessiz));
  assert.equal(r.anlatim, 1); assert.equal(cagri, 1);
  assert.equal(r.sesNormal, true);                                   // ses seviyesi eşitlendi (-14 LUFS)
  assert.ok(r.kontrol && fs.existsSync(r.kontrol) && fs.statSync(r.kontrol).size > 1000);   // kontrol sayfası (12 kare)
  const olc = require("child_process").spawnSync(ff().ffmpeg, ["-hide_banner", "-nostats", "-i", r.cikti, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const lufs = Number(/I:\s+(-?[\d.]+)\s+LUFS/.exec(olc.slice(olc.lastIndexOf("Summary")))[1]);
  assert.ok(lufs > -18 && lufs < -10, "LUFS " + lufs);                // hedefe yakın (kısa/sentetik ses için pay bırakıldı)
  assert.ok(r.sure >= 2.9 + 1 + 1 - 0.2);                            // 1. sahne anlatima (2.5 + 0.4) kadar uzar, diger ikisi 1 sn
  assert.ok(fs.existsSync(path.join(kok, "aile", "Videos", "aile.srt")));
  assert.match(fs.readFileSync(path.join(kok, "aile", "Videos", "aile.srt"), "utf8"), /küçük/);
  const akislar = execFileSync(ff().ffprobe, ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", r.cikti], { encoding: "utf8" });
  assert.match(akislar, /audio/); assert.match(akislar, /video/);
  await S.kur("aile", {}, Object.assign({ ses: sahteSes }, sessiz));
  assert.equal(cagri, 1);
  // kamera gorunumu: boyut ve ses akisi korunur, gecersiz deger reddedilir
  for (const kam of ["sinema", "film"]) {
    a.kamera = kam; a.sahneler[0].anlatim = "Bir varmış bir yokmuş, küçük bir kedi uzak bir plajda güneşin doğuşunu izlemiş.";
    fs.writeFileSync(yol, JSON.stringify(a));
    const k = await S.kur("aile", {}, Object.assign({ ses: sahteSes }, sessiz));
    assert.equal(k.uyarilar.length, 0, k.uyarilar.join(" | "));
    const boyut = execFileSync(ff().ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", k.cikti], { encoding: "utf8" }).trim();
    assert.equal(boyut, "1080,1920");
  }
  // yapay zeka kalibi uyarisi (engellemez): Turkce + Ingilizce
  a.kamera = "temiz"; a.dil = "tr"; a.sahneler[0].anlatim = "Oyun değişti. Kuralları baştan yazıyor.";
  fs.writeFileSync(yol, JSON.stringify(a));
  const kl = await S.kur("aile", { sesnormalsiz: true }, Object.assign({ ses: sahteSes }, sessiz));
  assert.ok(kl.uyarilar.some(u => /yapay zekâ kalıbı: "oyun değişti"/.test(u)), kl.uyarilar.join(" | "));
  a.dil = "en"; a.sahneler[0].anlatim = "The camera records 4K at 60 frames per second.";
  fs.writeFileSync(yol, JSON.stringify(a));
  assert.equal((await S.kur("aile", { sesnormalsiz: true }, Object.assign({ ses: sahteSes }, sessiz))).uyarilar.length, 0);
  a.kamera = "yok"; fs.writeFileSync(yol, JSON.stringify(a));
  await assert.rejects(S.kur("aile", {}, sessiz), /Bilinmeyen kamera/);
  a.kamera = "temiz";                                             // onbellek: ayni metin ikinci kez seslendirilmedi
  a.sahneler[0].anlatim = "x".repeat(601);
  fs.writeFileSync(yol, JSON.stringify(a));
  await assert.rejects(S.kur("aile", {}, sessiz), /600 karakter/);
});

test("yuz degistirme: riza onayi zorunlu, girdi/ disina cikilamaz, sonuc ilk-kare sahnesi olur, ayni girdi tekrar islenmez", { skip }, () => {
  S.yeni("yuzis", { stil: "serbest" });
  const yz = path.join(kok, "yuzis", "girdi", "yuz");
  fs.mkdirSync(yz, { recursive: true });
  foto(path.join(yz, "poz.jpg"), "gray"); foto(path.join(yz, "sol.jpg"), "red"); foto(path.join(yz, "sag.jpg"), "blue");
  let cagri = 0;
  const sahte = o => { cagri++; assert.equal(o.kisiler.length, 2); fs.copyFileSync(o.sablon, o.cikti); };
  const b = { sablon: "yuz/poz.jpg", kisi: "yuz/sol.jpg,yuz/sag.jpg" };
  assert.throws(() => S.yuzDegistir("yuzis", b, { degistir: sahte, log: () => {} }), /Rıza onayı gerekli/);
  assert.equal(cagri, 0);
  assert.throws(() => S.yuzDegistir("yuzis", { riza: true, sablon: "../../studyo.json", kisi: "yuz/sol.jpg" }, { degistir: sahte }), /dışında/);
  assert.throws(() => S.yuzDegistir("yuzis", { riza: true, sablon: "yuz/yok.jpg", kisi: "yuz/sol.jpg" }, { degistir: sahte }), /Girdi dosyası yok/);
  const r = S.yuzDegistir("yuzis", Object.assign({ riza: true }, b), { degistir: sahte, log: () => {} });
  assert.match(r.dosya, /^yuz-[0-9a-f]{12}\.jpg$/);
  const a = S.ayarOku("yuzis");
  assert.equal(a.sahneler.length, 1); assert.equal(a.sahneler[0].mod, "ilk-kare"); assert.equal(a.sahneler[0].kaynak, r.dosya);
  assert.equal(a.riza.onay, true);
  S.yuzDegistir("yuzis", Object.assign({ riza: true }, b), { degistir: sahte, log: () => {} });
  assert.equal(cagri, 1); assert.equal(S.ayarOku("yuzis").sahneler.length, 1);          // ayni girdi: yeniden islenmez, sahne tekrarlanmaz
});
