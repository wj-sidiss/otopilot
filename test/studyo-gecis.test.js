// Studyo: gecisler (xfade grafigi), tur paketleri (yesilcam, bilim kurgu, fantastik, aksiyon-filmi), kadro dagitimi. Ag ve kredi yok.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const S = require("../studyo.js");

test("gecisGrafigi: gecis yoksa null; varsa tail + xfade + ses kirpma, zaman cizgisi degismez", () => {
  assert.equal(S.gecisGrafigi([4, 4, 4], [], true), null);
  assert.equal(S.gecisGrafigi([4, 4], ["kes"], true), null);
  assert.equal(S.gecisGrafigi([4], ["cozul"], true), null);
  const g = S.gecisGrafigi([4, 3, 5], ["cozul", "kes", "zoom"], true);
  assert.match(g.filtre, /tpad=stop_mode=clone:stop_duration=0\.600/);
  assert.match(g.filtre, /xfade=transition=fade:duration=0\.600:offset=4\.000/);
  assert.match(g.filtre, /concat=n=2:v=1:a=0\[vout\]/);                  // son gecis "kes" degil ama ucuncu sahnenin sonrasi yok -> son adim concat
  assert.match(g.filtre, /atrim=0:3\.000/);
  assert.deepEqual(g.harita, ["-map", "[vout]", "-map", "[aout]"]);
  assert.deepEqual(S.gecisGrafigi([3, 3], ["whip"], false).harita, ["-map", "[vout]"]);
});

test("gecis suresi sahnenin yarisini asmaz", () => {
  const g = S.gecisGrafigi([1, 1], ["daire"], false);
  assert.match(g.filtre, /duration=0\.500/);
});

test("her gecis kodu gecerli bir xfade adi uretir (gercek ffmpeg, kucuk klip)", { skip: !(() => { try { return spawnSync(require("../ff-yol.js").ffmpeg, ["-version"]).status === 0; } catch { return false; } })() }, () => {
  const ffm = require("../ff-yol.js").ffmpeg;
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gecis-"));
  const klip = (ad, renk) => {
    const p = path.join(d, ad + ".mp4");
    const r = spawnSync(ffm, ["-y", "-f", "lavfi", "-i", `color=c=${renk}:s=128x72:r=30:d=1.5`, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "1.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", p]);
    assert.equal(r.status, 0, String(r.stderr));
    return p;
  };
  const a = klip("a", "red"), b = klip("b", "blue");
  for (const kod of Object.keys(S.GECISLER).filter(k => k !== "kes")) {
    const g = S.gecisGrafigi([1.5, 1.5], [kod], true);
    const cikti = path.join(d, kod + ".mp4");
    const r = spawnSync(ffm, ["-y", "-i", a, "-i", b, "-filter_complex", g.filtre, ...g.harita, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", cikti], { encoding: "utf8" });
    assert.equal(r.status, 0, kod + ": " + (r.stderr || "").slice(-300));
    assert.ok(fs.statSync(cikti).size > 500, kod);
  }
});

test("tur paketleri: 4 yeni paket, 8 cekim, gecerli plan/hareket/lens/isik/gecis kodlari", () => {
  for (const k of ["yesilcam", "bilimkurgu", "fantastik", "aksiyon-filmi"]) {
    const t = S.SABLONLAR[k];
    assert.ok(t, k); assert.equal(t.sahneler.length, 8, k); assert.ok(t.stilEki && S.KAMERALAR[t.kamera], k);
    assert.ok(t.sahneler.some(s => s.gecis && s.gecis !== "kes"), k + ": en az bir gecis");
  }
  for (const k of ["yesilcam", "bilimkurgu", "fantastik", "aksiyon-filmi", "simetri", "kesintisiz", "gerilim-teknigi"]) {
    const t = S.SABLONLAR[k];
    assert.ok(t.stilEki, k);
    for (const s of t.sahneler) {
      assert.ok(S.YONETMEN.plan[s.plan], k + " plan " + s.plan);
      assert.ok(S.YONETMEN.hareket[s.kameraHareketi], k + " hareket " + s.kameraHareketi);
      if (s.lens) assert.ok(S.YONETMEN.lens[s.lens], k + " lens " + s.lens);
      if (s.isik) assert.ok(S.YONETMEN.isik[s.isik], k + " isik " + s.isik);
      assert.ok(S.GECISLER[s.gecis], k + " gecis " + s.gecis);
      assert.ok(s.kisi === undefined || [0, 1, 2].includes(s.kisi));
    }
  }
  assert.ok(S.SABLONLAR.bilimkurgu.sahneler.some(s => s.plan === "pov"), "pov acisi var");
});

test("teknik paketleri: simetri, kesintisiz, gerilim-teknigi (5-6 cekim)", () => {
  assert.equal(S.SABLONLAR.simetri.sahneler.length, 6);
  assert.equal(S.SABLONLAR.kesintisiz.sahneler.length, 5);
  assert.ok(S.SABLONLAR.kesintisiz.sahneler.every(s => s.gecis === "kes"), "kesintisiz: gecis yok");
  assert.ok(S.SABLONLAR["gerilim-teknigi"].sahneler.some(s => s.kameraHareketi === "dolly-zoom"));
});

test("her kamera gorunumu gercek ffmpeg'de calisir (kucuk klip)", { skip: !(() => { try { return spawnSync(require("../ff-yol.js").ffmpeg, ["-version"]).status === 0; } catch { return false; } })() }, () => {
  const ffm = require("../ff-yol.js").ffmpeg;
  for (const [k, v] of Object.entries(S.KAMERALAR).filter(([, x]) => x.vf)) {
    const r = spawnSync(ffm, ["-y", "-f", "lavfi", "-i", "testsrc=s=160x90:r=30:d=0.4", "-vf", v.vf, "-f", "null", "-"], { encoding: "utf8" });
    assert.equal(r.status, 0, k + ": " + (r.stderr || "").slice(-200));
  }
  for (const k of ["vhs", "super8", "yumusak-lens", "kamkorder"]) assert.ok(S.KAMERALAR[k], k);
});

test("sablonEkle: stilEki, kamera ve kadro dagitimi (erkek, kadin, cift)", () => {
  const fs2 = require("fs");
  const fik = require("./render-fikstur");
  const kok = fik.ortamKur();
  try {
    const r = S.yeni("kadro", { stil: "gercekci" });
    for (const f of ["e.jpg", "k.jpg", "c.jpg"]) fs2.writeFileSync(path.join(r.girdi, f), "x");
    S.sablonEkle("kadro", "yesilcam", ["e.jpg", "k.jpg", "c.jpg"]);
    const a = S.ayarOku("kadro");
    assert.equal(a.kamera, "film");
    assert.equal(a.sahneler.length, 8);
    assert.match(a.sahneler[0].hareket, /Yesilcam cinema look/);
    assert.deepEqual(a.sahneler.map(s => s.kaynak), ["e.jpg", "e.jpg", "k.jpg", "c.jpg", "c.jpg", "k.jpg", "c.jpg", "c.jpg"]);
    assert.ok(a.sahneler.every(s => s.kisi === undefined && s.mod === "referans"));
    assert.equal(a.sahneler[0].gecis, "cozul");
  } finally { fik.temizle(kok); }
});

test("anlatim taslaklari: 4 film paketinde TR/EN 8'er satir, yapay zeka kalibi yok, 600 karakter altinda", () => {
  const K = require("../lib/ai-kalip.js");
  for (const k of ["yesilcam", "bilimkurgu", "fantastik", "aksiyon-filmi"]) {
    const t = S.SABLONLAR[k];
    for (const dil of ["tr", "en"]) {
      const l = t.anlatimTaslak[dil];
      assert.equal(l.length, t.sahneler.length, k + " " + dil);
      for (const satir of l) {
        assert.ok(satir.length > 5 && satir.length <= 600, satir);
        assert.deepEqual(K.kalipBul(satir, dil).map(x => x.kalip), [], k + " " + dil + ": " + satir);
      }
    }
  }
});

test("sablonEkle anlatim secenegi: isin diline gore taslak eklenir; secenek yoksa eklenmez", () => {
  const fs2 = require("fs");
  const fik = require("./render-fikstur");
  const kok = fik.ortamKur();
  try {
    S.yeni("anl1", { stil: "gercekci" });
    S.sablonEkle("anl1", "yesilcam", [], { anlatim: true });
    let a = S.ayarOku("anl1");
    assert.equal(a.sahneler[0].anlatim, S.SABLONLAR.yesilcam.anlatimTaslak.en[0]);       // varsayilan dil en
    const y = path.join(kok, "anl1", "studyo.json"), j = JSON.parse(fs2.readFileSync(y, "utf8"));
    j.dil = "tr"; j.sahneler = []; fs2.writeFileSync(y, JSON.stringify(j));
    S.sablonEkle("anl1", "bilimkurgu", [], { anlatim: true });
    a = S.ayarOku("anl1");
    assert.equal(a.sahneler[7].anlatim, S.SABLONLAR.bilimkurgu.anlatimTaslak.tr[7]);
    S.sablonEkle("anl1", "fantastik", []);
    a = S.ayarOku("anl1");
    assert.ok(a.sahneler.slice(8).every(s => s.anlatim === undefined), "secenek yokken anlatim eklenmez");
    S.sablonEkle("anl1", "romantik", [], { anlatim: true });                                 // taslagi olmayan paket: sessizce atlanir
    assert.ok(S.ayarOku("anl1").sahneler.slice(16).every(s => s.anlatim === undefined));
  } finally { fik.temizle(kok); }
});
