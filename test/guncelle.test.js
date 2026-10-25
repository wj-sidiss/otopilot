// lib/guncelle.js (npm run guncelle) — tek komutluk guvenli guncelleme.
// Mantik testleri git/npm cagrilarini SAHTELER; gercek-git testleri gecici yerel depolarla (uzak = yerel bare depo) calisir,
// internete, GitHub'a ve gercek kopyaya (bu depoya) DOKUNMAZ. git kurulu degilse gercek-git testleri atlanir.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ortak = require("../lib/ortak");
const G = require("../lib/guncelle");

const KOK = path.resolve(__dirname, "..");
const GIT_VAR = (() => { try { return spawnSync("git", ["--version"], { windowsHide: true }).status === 0; } catch (e) { return false; } })();
const gerekirGit = GIT_VAR ? {} : { skip: "git kurulu degil" };
const temizlenecek = [];
test.after(() => { for (const d of temizlenecek) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* kilitli */ } } });

function gecici(on) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "guncelle-" + (on || "t") + "-"));
  temizlenecek.push(d);
  return d;
}
function yaz(dosya, icerik) { fs.mkdirSync(path.dirname(dosya), { recursive: true }); fs.writeFileSync(dosya, icerik); }
const toplayici = () => { const satirlar = []; const f = s => satirlar.push(String(s)); f.satirlar = satirlar; f.metin = () => satirlar.join("\n"); return f; };

// ---------------------------------------------------------------- sahte calistirici (yalniz mantik testleri)
// kok: .git klasoru, package.json ve CHANGELOG.md olan gecici dizin.
function sahteKok(surum, baslik) {
  const kok = gecici("sahte");
  fs.mkdirSync(path.join(kok, ".git"));
  fs.mkdirSync(path.join(kok, "node_modules"));
  yaz(path.join(kok, "package.json"), JSON.stringify({ name: "otopilot", version: surum || "1.2.0" }));
  yaz(path.join(kok, "CHANGELOG.md"), "# Değişiklik geçmişi\n\n## " + (baslik || "[1.2.0] — 2026-10-15 — Eski") + "\n\nMetin.\n");
  return kok;
}
const tamam = out => ({ kod: 0, out: out || "", err: "", hata: null, zamanAsimi: false });
function sahteCalistirici(kok, ayar) {
  ayar = ayar || {};
  const cagrilar = [];
  let cekildi = false;
  const f = (komut, args, secenek) => {
    const anahtar = komut + " " + args.join(" ");
    cagrilar.push({ komut, args, anahtar, secenek: secenek || {} });
    if (ayar.ozel) { const r = ayar.ozel(anahtar, komut, args); if (r) return Object.assign(tamam(), r); }
    if (komut === "npm") return tamam("added 1 package");
    const a = args.join(" ");
    if (a === "--version") return tamam("git version 2.50.0\n");
    if (a === "rev-parse --show-toplevel") return tamam(kok.replace(/\\/g, "/") + "\n");
    if (a === "rev-parse --show-cdup") return tamam("\n");
    if (a === "rev-parse --abbrev-ref HEAD") return tamam("main\n");
    if (a === "rev-parse --abbrev-ref --symbolic-full-name @{u}") return tamam("origin/main\n");
    if (a === "config --get branch.main.remote") return tamam("origin\n");
    if (a === "remote get-url origin") return tamam((ayar.url || "https://github.com/wj-sidiss/otopilot.git") + "\n");
    if (a === "status --porcelain -z") {
      const d = cekildi && ayar.cekmeSonrasiDurum !== undefined ? ayar.cekmeSonrasiDurum : ayar.durum;
      return tamam(d || "");
    }
    if (a === "rev-parse HEAD") return tamam((cekildi ? (ayar.sonra || "bbbbbbb2222222") : (ayar.once || "aaaaaaa1111111")) + "\n");
    if (a === "rev-parse @{u}") return tamam((ayar.ust || ayar.once || "aaaaaaa1111111") + "\n");   // varsayilan: uzak dal ilerlememis
    if (a === "pull --no-rebase --ff-only") {
      cekildi = true;
      if (ayar.cek) return Object.assign(tamam(), ayar.cek);
      if (ayar.cekinceDegistir) ayar.cekinceDegistir(kok);
      return tamam("Updating aaaaaaa..bbbbbbb\n");
    }
    if (args[0] === "rev-list") return tamam("2\n");
    if (args[0] === "log" && args[1] === "-1") return tamam("bbbbbbb Yeni özellik\n");
    if (args[0] === "log") return tamam("bbbbbbb Yeni özellik\nccccccc Düzeltme\n");
    if (a.startsWith("diff --name-only -z ")) {
      const fark = ayar.fark !== undefined ? ayar.fark : "lib/yeni.js\nREADME.md\n";
      return fark === null ? { kod: 128, out: "", err: "fatal", hata: null, zamanAsimi: false } : tamam(fark.replace(/\n/g, "\0"));
    }
    throw new Error("sahte calistirici bilmiyor: " + anahtar);
  };
  f.cagrilar = cagrilar;
  f.git = () => cagrilar.filter(c => c.komut === "git").map(c => c.args.join(" "));
  f.npm = () => cagrilar.filter(c => c.komut === "npm");
  return f;
}
const SINGLE_YIKICI = ["reset", "checkout", "stash", "clean", "restore", "rm", "switch", "rebase", "merge", "branch", "commit", "config", "push", "add", "update-index"];
function yikiciYok(f) {
  const yikici = c => {
    const args = c.args[0] === "--literal-pathspecs" ? c.args.slice(1) : c.args;
    if (args[0] === "config" && args[1] === "--get") return false;            // salt okuma
    return SINGLE_YIKICI.includes(args[0]);
  };
  assert.deepEqual(f.cagrilar.filter(c => c.komut === "git" && yikici(c)).map(c => c.anahtar), [], "yerel calisma kopyasini degistiren git komutu calistirildi");
}
const cekmeyiDene = f => f.git().filter(a => a.startsWith("pull"));
function hataBekle(fn) {
  try { fn(); } catch (e) { assert.ok(e instanceof ortak.OrtakHata, "OrtakHata bekleniyordu: " + e); return e; }
  assert.fail("hata bekleniyordu");
}

// ---------------------------------------------------------------- saf yardimcilar
test("durumAyristir: izlenen degisiklik / izlenmeyen yeni dosya / yok sayilan ayrilir; yeniden adlandirmada eski ad atlanir", () => {
  const r = G.durumAyristir(" M lib/a.js\0?? yeni dosya.txt\0R  yeni-ad.js\0eski-ad.js\0!! uretim/\0A  b.js\0UU celisen.js\0");
  assert.deepEqual(r.izlenen, ["lib/a.js", "yeni-ad.js", "b.js", "celisen.js"]);
  assert.deepEqual(r.izlenmeyen, ["yeni dosya.txt"]);
  assert.deepEqual(r.girdiler.map(g => g.xy), [" M", "R ", "A ", "UU"]);
  assert.deepEqual(G.durumAyristir(""), { izlenen: [], izlenmeyen: [], girdiler: [] });
  assert.deepEqual(G.durumAyristir(null), { izlenen: [], izlenmeyen: [], girdiler: [] });
});

test("hataSatiri: git pull'un fetch/hint gurultusunu atlar, asil fatal/error satirini verir; cakisanDosyalar listeyi cikarir", () => {
  const err = "From https://github.com/wj-sidiss/otopilot\n   605c21f..ae70cff  main       -> origin/main\nhint: Diverging branches can't be fast-forwarded, you need to either:\nhint:\nfatal: Not possible to fast-forward, aborting.\n";
  assert.equal(G.hataSatiri(err), "fatal: Not possible to fast-forward, aborting.");
  assert.equal(G.hataSatiri("From x\n   a..b  main -> origin/main\nbir sey ters gitti\n"), "bir sey ters gitti");
  assert.equal(G.hataSatiri(""), "");
  const ez = "From x\nerror: Your local changes to the following files would be overwritten by merge:\n\tlib/a.js\n\tpanel bosluklu.js\nPlease commit your changes or stash them before you merge.\nAborting\n";
  assert.deepEqual(G.cakisanDosyalar(ez), ["lib/a.js", "panel bosluklu.js"]);
  assert.deepEqual(G.cakisanDosyalar("fatal: baska"), []);
});

test("resmiDepoMu / adresTemizle: https, ssh, scp bicimi ve eski ad resmi; fork degil; jeton ekrana yazilmaz", () => {
  for (const u of ["https://github.com/wj-sidiss/otopilot.git", "https://github.com/wj-sidiss/otopilot", "https://github.com/WJ-Sidiss/Otopilot/",
    "git@github.com:wj-sidiss/otopilot.git", "ssh://git@github.com/wj-sidiss/otopilot.git", "https://kisi:JETON@github.com/wj-sidiss/otopilot.git",
    "https://github.com/wj-sidiss/youtube-otomasyon.git"]) assert.equal(G.resmiDepoMu(u), true, u);
  for (const u of ["https://github.com/baskasi/otopilot.git", "git@github.com:baskasi/otopilot.git", "https://github.com/wj-sidiss/otopilot-kopya.git",
    "https://evil.example/github.com/wj-sidiss/otopilot.git", "C:/Users/x/uzak.git", ""]) assert.equal(G.resmiDepoMu(u), false, u);
  assert.equal(G.adresTemizle("https://kisi:ghp_GIZLI@github.com/baskasi/otopilot.git"), "https://github.com/baskasi/otopilot.git");
  assert.equal(G.adresTemizle("git@github.com:baskasi/otopilot.git"), "git@github.com:baskasi/otopilot.git");
});

test("npmCagrisi: npm run altinda npm-cli.js dogrudan node ile; yoksa Windows'ta kabukla sabit komut, digerlerinde dogrudan npm; baska paket yoneticisi yok sayilir", () => {
  const d = gecici("npm");
  const npmCli = path.join(d, "npm-cli.js"); yaz(npmCli, "");
  const yarnJs = path.join(d, "yarn.js"); yaz(yarnJs, "");
  const arg = ["ci", "--no-fund", "--ignore-scripts"];
  assert.deepEqual(G.npmCagrisi(arg, { npm_execpath: npmCli }, "win32"), { komut: process.execPath, args: [npmCli, ...arg], kabuk: false });
  assert.deepEqual(G.npmCagrisi(arg, {}, "win32"), { komut: "npm ci --no-fund --ignore-scripts", args: [], kabuk: true });
  assert.deepEqual(G.npmCagrisi(arg, { npm_execpath: yarnJs }, "win32"), { komut: "npm ci --no-fund --ignore-scripts", args: [], kabuk: true });
  assert.deepEqual(G.npmCagrisi(arg, { npm_execpath: path.join(d, "yok", "npm-cli.js") }, "linux"), { komut: "npm", args: arg, kabuk: false });
  assert.deepEqual(G.npmCagrisi(arg, {}, "linux"), { komut: "npm", args: arg, kabuk: false });
});

test("changelogBasligi: en ustteki '## ' basligini verir; dosya yoksa null; surumOku bozuk package.json'da null", () => {
  const k = sahteKok("1.0.0", "[1.0.0] — 2026-01-01 — Ilk");
  assert.equal(G.changelogBasligi(k), "[1.0.0] — 2026-01-01 — Ilk");
  assert.equal(G.surumOku(k), "1.0.0");
  fs.rmSync(path.join(k, "CHANGELOG.md"));
  assert.equal(G.changelogBasligi(k), null);
  yaz(path.join(k, "package.json"), "{bozuk");
  assert.equal(G.surumOku(k), null);
});

// ---------------------------------------------------------------- mantik (sahte git/npm)
test("temiz + ileri sarilabilir: yalniz 'git pull --no-rebase --ff-only' calisir (pull.rebase ayari olsa da); surum, commit ve CHANGELOG basligi yazilir; npm ci YOK", () => {
  const kok = sahteKok("1.2.0", "[1.2.0] — eski");
  const f = sahteCalistirici(kok, { cekinceDegistir: k => {
    yaz(path.join(k, "package.json"), JSON.stringify({ name: "otopilot", version: "1.3.0" }));
    yaz(path.join(k, "CHANGELOG.md"), "# Değişiklik geçmişi\n\n## [1.3.0] — 2026-11-01 — Yeni\n\n## [1.2.0] — eski\n");
  } });
  const y = toplayici();
  const s = G.guncelle({ kok, calistir: f, yaz: y });
  assert.equal(s.durum, "guncellendi");
  assert.equal(s.once, "aaaaaaa1111111");
  assert.equal(s.sonra, "bbbbbbb2222222");
  assert.equal(s.eskiSurum, "1.2.0");
  assert.equal(s.surum, "1.3.0");
  assert.equal(s.changelogBasligi, "[1.3.0] — 2026-11-01 — Yeni");
  assert.equal(s.bagimliliklarKuruldu, false);
  assert.deepEqual(cekmeyiDene(f), ["pull --no-rebase --ff-only"]);
  assert.equal(f.npm().length, 0, "lock degismedi: npm ci calismamali");
  yikiciYok(f);
  const metin = y.metin();
  assert.match(metin, /2 yeni commit/);
  assert.match(metin, /bbbbbbb Yeni özellik/);
  assert.match(metin, /Güncellendi: Otopilot 1\.3\.0 · commit bbbbbbb Yeni özellik/);
  assert.match(metin, /CHANGELOG\.md\): \[1\.3\.0\] — 2026-11-01 — Yeni/);
  assert.match(metin, /Panel açıksa kapatıp yeniden aç/);
  // pull, status'tan SONRA calisir (once denetle, sonra cek)
  const sira = f.git();
  assert.ok(sira.indexOf("status --porcelain -z") < sira.indexOf("pull --no-rebase --ff-only"));
  // git komutlari kok klasorde, soru sormadan calisir (cwd)
  assert.ok(f.cagrilar.filter(c => c.komut === "git").every(c => c.secenek.cwd === kok));
});

test("zaten guncel: HEAD degismez; pull calisir ama diff/npm calismaz; surum ve commit yine yazilir", () => {
  const kok = sahteKok("1.2.0");
  const f = sahteCalistirici(kok, { sonra: "aaaaaaa1111111" });
  const y = toplayici();
  const s = G.guncelle({ kok, calistir: f, yaz: y });
  assert.equal(s.durum, "zaten_guncel");
  assert.equal(f.git().some(a => a.startsWith("diff")), false);
  assert.equal(f.npm().length, 0);
  assert.match(y.metin(), /Zaten güncel: Otopilot 1\.2\.0/);
  assert.doesNotMatch(y.metin(), /Panel açıksa/);
  yikiciYok(f);
});

test("package-lock.json degisti: pull'dan SONRA 'npm ci --no-fund --ignore-scripts' kok klasorde calisir", () => {
  const kok = sahteKok();
  const f = sahteCalistirici(kok, { fark: "lib/a.js\npackage-lock.json\n" });
  const y = toplayici();
  const s = G.guncelle({ kok, calistir: f, yaz: y });
  assert.equal(s.bagimliliklarKuruldu, true);
  const npm = f.npm();
  assert.equal(npm.length, 1);
  assert.deepEqual(npm[0].args, ["ci", "--no-fund", "--ignore-scripts"]);
  assert.equal(npm[0].secenek.cwd, kok);
  assert.ok(f.cagrilar.findIndex(c => c.komut === "npm") > f.cagrilar.findIndex(c => c.anahtar === "git pull --no-rebase --ff-only"), "npm ci pull'dan once calisti");
  assert.match(y.metin(), /npm ci --ignore-scripts/);
  assert.match(y.metin(), /Bağımlılıklar kuruldu/);
});

test("diff okunamazsa temkinli: paketler yine kurulur; yalniz package.json (lock degismedi) ise kurulmaz", () => {
  const k1 = sahteKok();
  const f1 = sahteCalistirici(k1, { fark: null });
  G.guncelle({ kok: k1, calistir: f1, yaz: toplayici() });
  assert.equal(f1.npm().length, 1);
  const k2 = sahteKok();
  const f2 = sahteCalistirici(k2, { fark: "package.json\nlib/a.js\n" });
  G.guncelle({ kok: k2, calistir: f2, yaz: toplayici() });
  assert.equal(f2.npm().length, 0);
});

test("npm ci basarisiz: kod guncellendi diye soyler; ag hatasi -> cikis 3, diger -> 1, disk dolu -> 5, npm yok -> 2", () => {
  const dene = npmSonuc => {
    const kok = sahteKok();
    const f = sahteCalistirici(kok, { fark: "package-lock.json\n", ozel: (a, k) => (k === "npm" ? npmSonuc : null) });
    return hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  };
  const ag = dene({ kod: 1, err: "npm error code ENOTFOUND\nnpm error network request failed" });
  assert.equal(ag.cikis, ortak.CIKIS.SERVIS);
  assert.match(ag.message, /Kod güncellendi \(bbbbbbb\) ama bağımlılıklar kurulamadı/);
  assert.match(ag.cozum, /npm ci --ignore-scripts/);
  assert.equal(dene({ kod: 1, err: "npm error something odd" }).cikis, ortak.CIKIS.GENEL);
  assert.equal(dene({ kod: 1, err: "npm error ENOSPC: no space left on device" }).cikis, ortak.CIKIS.DISK);
  assert.equal(dene({ kod: null, hata: Object.assign(new Error("x"), { code: "ENOENT" }) }).cikis, ortak.CIKIS.GIRDI);
  assert.equal(dene({ kod: null, zamanAsimi: true, hata: Object.assign(new Error("x"), { code: "ETIMEDOUT" }) }).cikis, ortak.CIKIS.SERVIS);
});

test("yerel degisiklik: DURUR (cikis 2), pull calismaz, hicbir yikici git komutu yok, dosya adlari ve ne yapilacagi mesajda", () => {
  const kok = sahteKok();
  const f = sahteCalistirici(kok, { durum: " M lib/ortak.js\0M  panel.js\0?? notlarim.txt\0" });
  const e = hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_yerel_degisiklik");
  assert.equal(e.cikis, ortak.CIKIS.GIRDI);
  assert.match(e.message, /lib\/ortak\.js, panel\.js/);
  assert.doesNotMatch(e.message, /notlarim/, "izlenmeyen dosya engel degildir");
  assert.match(e.message, /silinmedi/);
  assert.match(e.cozum, /git stash/);
  assert.equal(cekmeyiDene(f).length, 0, "yerel degisiklikle pull denenmemeli");
  assert.equal(f.npm().length, 0);
  yikiciYok(f);
});

test("yalniz package-lock.json degismisse ('npm install' yapilmis) ozel ipucu verilir; 8'den cok dosya kisaltilir", () => {
  const kok = sahteKok();
  const e = hataBekle(() => G.guncelle({ kok, calistir: sahteCalistirici(kok, { durum: " M package-lock.json\0" }), yaz: toplayici() }));
  assert.match(e.cozum, /git restore package-lock\.json/);
  const cok = Array.from({ length: 12 }, (_, i) => " M d" + i + ".js\0").join("");
  const e2 = hataBekle(() => G.guncelle({ kok, calistir: sahteCalistirici(kok, { durum: cok }), yaz: toplayici() }));
  assert.match(e2.message, /\(\+4\)/);
  assert.deepEqual(e2.detay.dosyalar.length, 12);
});

test("yalniz izlenmeyen yeni dosya varsa engel degil: guncellenir, kullaniciya dokunulmayacagi soylenir", () => {
  const kok = sahteKok();
  const f = sahteCalistirici(kok, { durum: "?? kendi-betigim.js\0" });
  const y = toplayici();
  const s = G.guncelle({ kok, calistir: f, yaz: y });
  assert.equal(s.durum, "guncellendi");
  assert.match(y.metin(), /kendi-betigim\.js/);
  assert.match(y.metin(), /ezmez/);
});

test("ZIP (.git yok): hicbir git/npm komutu calismaz, hicbir dosya silinmez, yonerge ZIP adresini ve tasinacak yerel dosyalari soyler, cikis 2", () => {
  const kok = gecici("zip");
  yaz(path.join(kok, "package.json"), "{}");
  yaz(path.join(kok, ".env"), "PEXELS_KEY=\n");
  yaz(path.join(kok, "uretim", "is1", "konu.json"), "{}");
  yaz(path.join(kok, "ai-infapp", "data", "x.json"), "{}");
  const f = sahteCalistirici(kok);
  const e = hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_zip");
  assert.equal(e.cikis, ortak.CIKIS.GIRDI);
  assert.equal(f.cagrilar.length, 0, "ZIP kopyasinda hicbir dis komut calismamali (ust klasorun git deposu yanlislikla guncellenmesin)");
  assert.match(e.message, /ZIP/);
  assert.match(e.cozum, new RegExp(G.ZIP_ADRESI.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&")));
  assert.match(e.cozum, /\.env/);
  assert.match(e.cozum, /uretim\//);
  assert.match(e.cozum, /ai-infapp\/data\//);
  assert.doesNotMatch(e.cozum, /muzik|panel-ayar/, "olmayan dosya listelenmez");
  assert.match(e.cozum, /silinmedi/);
  for (const d of [".env", "uretim/is1/konu.json", "ai-infapp/data/x.json", "package.json"]) assert.ok(fs.existsSync(path.join(kok, ...d.split("/"))), d + " silinmis");
});

test("git kurulu degil (.git var): git_yok hatasi, cikis 2, ZIP yontemi de anlatilir; git hic calismis sayilmaz", () => {
  const kok = sahteKok();
  const f = sahteCalistirici(kok, { ozel: (a, k, args) => (args[0] === "--version" ? { kod: null, hata: Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" }) } : null) });
  const e = hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_git_yok");
  assert.equal(e.cikis, ortak.CIKIS.GIRDI);
  assert.match(e.cozum, /winget install --id Git\.Git/);
  assert.match(e.cozum, new RegExp("archive/refs/heads/main\\.zip"));
  assert.deepEqual(f.git(), ["--version"]);
});

test("ust klasorun git deposuna bagli (kendi .git'i gecersiz/farkli): ZIP gibi davranir, pull calismaz", () => {
  const kok = sahteKok();
  const baska = gecici("baska");
  const ustDepo = { "rev-parse --show-toplevel": { out: baska.replace(/\\/g, "/") + "\n" }, "rev-parse --show-cdup": { out: "../\n" } };
  const f = sahteCalistirici(kok, { ozel: (a, k, args) => ustDepo[args.join(" ")] || null });
  const e = hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_zip");
  assert.match(e.message, /başka bir git deposuna bağlı/);
  assert.equal(cekmeyiDene(f).length, 0);
  // yol bicimi farkli ama git "en usttesin" diyorsa (subst surucu, baglanti, Cygwin git) ZIP sanilmaz
  const f3 = sahteCalistirici(kok, { ozel: (a, k, args) => (args.join(" ") === "rev-parse --show-toplevel" ? { out: "/cygdrive/c/baska/bicim\n" } : null) });
  assert.equal(G.guncelle({ kok, calistir: f3, yaz: toplayici() }).durum, "guncellendi");
  // bozuk .git
  const f2 = sahteCalistirici(kok, { ozel: (a, k, args) => (args.join(" ") === "rev-parse --show-toplevel" ? { kod: 128, err: "fatal: not a git repository" } : null) });
  assert.equal(hataBekle(() => G.guncelle({ kok, calistir: f2, yaz: toplayici() })).kod, "guncelle_zip");
});

test("'dubious ownership': guvenli dizin ipucu, cikis 2", () => {
  const kok = sahteKok();
  const f = sahteCalistirici(kok, { ozel: (a, k, args) => (args.join(" ") === "rev-parse --show-toplevel" ? { kod: 128, err: "fatal: detected dubious ownership in repository at 'X'" } : null) });
  const e = hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_guvenli_dizin");
  assert.match(e.cozum, /safe\.directory/);
  assert.equal(e.cikis, ortak.CIKIS.GIRDI);
});

test("detached HEAD ve izleme dali yok: cikis 2, anlasilir yonerge, pull calismaz", () => {
  const kok = sahteKok();
  const f = sahteCalistirici(kok, { ozel: (a, k, args) => (args.join(" ") === "rev-parse --abbrev-ref HEAD" ? { out: "HEAD\n" } : null) });
  const e = hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_dal");
  assert.match(e.message, /detached HEAD/);
  assert.match(e.cozum, /git switch main/);
  assert.equal(cekmeyiDene(f).length, 0);
  const f2 = sahteCalistirici(kok, { ozel: (a, k, args) => (args[args.length - 1] === "@{u}" ? { kod: 128, err: "fatal: no upstream configured for branch 'main'" } : null) });
  const e2 = hataBekle(() => G.guncelle({ kok, calistir: f2, yaz: toplayici() }));
  assert.equal(e2.kod, "guncelle_dal");
  assert.match(e2.message, /izleme dalı yok/);
  assert.equal(e2.cikis, ortak.CIKIS.GIRDI);
  assert.equal(cekmeyiDene(f2).length, 0);
});

test("ag hatalari -> cikis 3 (ortak desen): cozulemeyen ana makine, baglanti reddi, zaman asimi, yetki; hicbir seyin degismedigi soylenir", () => {
  const dene = cek => {
    const kok = sahteKok();
    return hataBekle(() => G.guncelle({ kok, calistir: sahteCalistirici(kok, { cek }), yaz: toplayici() }));
  };
  const e1 = dene({ kod: 128, err: "fatal: unable to access 'https://github.com/x/y.git/': Could not resolve host: github.com" });
  assert.equal(e1.kod, "guncelle_ag");
  assert.equal(e1.cikis, ortak.CIKIS.SERVIS);
  assert.match(e1.message, /GitHub'a ulaşılamadı/);
  assert.match(e1.message, /Hiçbir dosya değiştirilmedi/);
  assert.equal(dene({ kod: 128, err: "fatal: unable to access 'https://x/': Failed to connect to github.com port 443 after 21000 ms" }).cikis, 3);
  assert.equal(dene({ kod: 128, err: "error: RPC failed; curl 56 Recv failure" }).cikis, 3);
  assert.equal(dene({ kod: null, zamanAsimi: true, hata: Object.assign(new Error("spawnSync git ETIMEDOUT"), { code: "ETIMEDOUT" }) }).cikis, 3);
  const yetki = dene({ kod: 128, err: "fatal: could not read Username for 'https://github.com': terminal prompts disabled" });
  assert.equal(yetki.cikis, 3);
  assert.match(yetki.message, /erişim izni/);
  // ortak.bitir ile ayni cikis kodu sinifi: OrtakHata.cikis dogrudan kullanilir
  assert.equal(ortak.hataCevir(e1).kod, "guncelle_ag");
});

test("ff yapilamiyor (ayrismis dal) -> cikis 2, yerel commit'leri yedekleme onerisi; dosya ezme -> cikis 2; bilinmeyen git hatasi -> cikis 1", () => {
  const dene = cek => {
    const kok = sahteKok();
    return hataBekle(() => G.guncelle({ kok, calistir: sahteCalistirici(kok, { cek }), yaz: toplayici() }));
  };
  const a = dene({ kod: 128, err: "fatal: Not possible to fast-forward, aborting." });
  assert.equal(a.kod, "guncelle_ayrisma");
  assert.equal(a.cikis, 2);
  assert.match(a.cozum, /git branch yedek-/);
  assert.match(a.message, /Hiçbir dosya değiştirilmedi/);
  const b = dene({ kod: 1, err: "error: The following untracked working tree files would be overwritten by merge:\n\tlib/yeni.js\nPlease move or remove them before you merge." });
  assert.equal(b.kod, "guncelle_yerel_degisiklik");
  assert.equal(b.cikis, 2);
  assert.match(b.cozum, /git stash -u/);
  const c = dene({ kod: 1, err: "fatal: bambaska bir sey" });
  assert.equal(c.kod, "guncelle_git");
  assert.equal(c.cikis, 1);
  assert.match(c.message, /bambaska bir sey/);
});

test("gercekci git ciktisi ('From ...' + hint satirlari once gelir): mesaj asil hatayi verir, uzak adres/fetch satirini degil; cakisan dosyalar listelenir", () => {
  const dene = cek => {
    const kok = sahteKok();
    return hataBekle(() => G.guncelle({ kok, calistir: sahteCalistirici(kok, { cek }), yaz: toplayici() }));
  };
  const fetch = "From https://github.com/wj-sidiss/otopilot\n   605c21f..ae70cff  main       -> origin/main\n";
  const a = dene({ kod: 128, err: fetch + "hint: Diverging branches can't be fast-forwarded\nhint:\nfatal: Not possible to fast-forward, aborting.\n" });
  assert.equal(a.kod, "guncelle_ayrisma");
  assert.equal(a.detay, "fatal: Not possible to fast-forward, aborting.");
  const b = dene({ kod: 1, err: fetch + "error: Your local changes to the following files would be overwritten by merge:\n\tlib/ortak.js\n\tPANEL.bat\nPlease commit your changes or stash them before you merge.\nAborting\n" });
  assert.equal(b.kod, "guncelle_yerel_degisiklik");
  assert.match(b.message, /lib\/ortak\.js, PANEL\.bat/);
  assert.doesNotMatch(b.message, /From https/);
  assert.match(b.cozum, /başka bir programda/);
  const c = dene({ kod: 1, err: fetch + "fatal: bambaska\n" });
  assert.match(c.message, /: fatal: bambaska$/);
});

test("yerel dosya yazilamadi ('Permission denied' / 'unable to unlink') -> guncelle_dosya cikis 2, GitHub yetki hatasi SANILMAZ; ssh anahtar reddi -> 3; index.lock -> 6; disk dolu -> 5", () => {
  const dene = cek => {
    const kok = sahteKok();
    return hataBekle(() => G.guncelle({ kok, calistir: sahteCalistirici(kok, { cek }), yaz: toplayici() }));
  };
  for (const err of ["error: unable to unlink old 'PANEL.bat': Permission denied\n", "error: unable to unlink old 'b.txt': Invalid argument\n",
    "error: unable to create file lib/yeni.js: Permission denied\n"]) {
    const e = dene({ kod: 1, out: "Updating a..b\n", err });
    assert.equal(e.kod, "guncelle_dosya", err);
    assert.equal(e.cikis, ortak.CIKIS.GIRDI);
    assert.match(e.cozum, /programı kapat/);
  }
  const ssh = dene({ kod: 128, err: "git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.\n" });
  assert.equal(ssh.kod, "guncelle_ag");
  assert.equal(ssh.cikis, ortak.CIKIS.SERVIS);
  const kilit = dene({ kod: 128, err: "fatal: Unable to create 'C:/Users/x/otopilot/.git/index.lock': File exists.\n\nAnother git process seems to be running in this repository\n" });
  assert.equal(kilit.kod, "guncelle_kilit");
  assert.equal(kilit.cikis, ortak.CIKIS.KILIT);
  assert.match(kilit.cozum, /index\.lock/);
  const disk = dene({ kod: 128, err: "error: unable to write file lib/a.js\nfatal: write error: No space left on device\n" });
  assert.equal(disk.kod, "guncelle_disk");
  assert.equal(disk.cikis, ortak.CIKIS.DISK);
});

test("cekme yarida kaldi (git bir kismini yazdi): 'hicbir dosya degistirilmedi' DENMEZ, guncelle_yarim + yazilan dosyalar; onceden duran izlenmeyen dosya sayilmaz", () => {
  const kok = sahteKok();
  const f = sahteCalistirici(kok, {
    durum: "?? kendi-notum.txt\0",
    cek: { kod: 1, out: "Updating aaaaaaa..bbbbbbb\n", err: "error: unable to unlink old 'b.txt': Invalid argument\n" },
    cekmeSonrasiDurum: " M a.txt\0?? kendi-notum.txt\0?? lib/yeni/\0",
  });
  const e = hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_yarim");
  assert.equal(e.cikis, ortak.CIKIS.GIRDI);
  assert.deepEqual(e.detay.dosyalar, ["a.txt", "lib/yeni/"]);
  assert.match(e.message, /yarıda kaldı/);
  assert.match(e.message, /unable to unlink old 'b\.txt'/);
  assert.doesNotMatch(e.message, /Hiçbir dosya değiştirilmedi/);
  assert.match(e.cozum, /npm run guncelle/);
  yikiciYok(f);
  // ag hatasinda calisma agaci ayni kaldiysa: eski mesaj (hicbir sey degismedi) dogru kalir
  const k2 = sahteKok();
  const e2 = hataBekle(() => G.guncelle({ kok: k2, calistir: sahteCalistirici(k2, { cek: { kod: 128, err: "fatal: unable to access 'https://github.com/x/': Could not resolve host: github.com" } }), yaz: toplayici() }));
  assert.equal(e2.kod, "guncelle_ag");
  assert.match(e2.message, /Hiçbir dosya değiştirilmedi/);
});

test("fork'tan guncelleniyorsa uyarir (jeton gizlenir); resmi depoda uyari yok", () => {
  const kok = sahteKok();
  const y = toplayici();
  const s = G.guncelle({ kok, calistir: sahteCalistirici(kok, { url: "https://kisi:ghp_GIZLIJETON@github.com/baskasi/otopilot.git", sonra: "aaaaaaa1111111" }), yaz: y });
  assert.equal(s.resmiDepo, false);
  assert.equal(s.uzakAdres, "https://github.com/baskasi/otopilot.git");
  assert.match(y.metin(), /resmî depodan değil.*github\.com\/baskasi\/otopilot\.git/);
  assert.match(y.metin(), /Sync fork/);
  assert.doesNotMatch(y.metin(), /GIZLIJETON|kisi:/);
  const k2 = sahteKok();
  const y2 = toplayici();
  const s2 = G.guncelle({ kok: k2, calistir: sahteCalistirici(k2), yaz: y2 });
  assert.equal(s2.resmiDepo, true);
  assert.doesNotMatch(y2.metin(), /resmî depodan değil/);
});

test("yerel degisiklik + uzak dal ilerlememis: yarim-guncelleme denetimi devreye girmez, normal 'yerel degisiklik' hatasi", () => {
  const kok = sahteKok();
  const f = sahteCalistirici(kok, { durum: " M lib/ortak.js\0" });
  const e = hataBekle(() => G.guncelle({ kok, calistir: f, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_yerel_degisiklik");
  assert.ok(f.git().includes("rev-parse @{u}"));
  assert.equal(f.git().some(a => /^(?:diff|ls-tree|hash-object)/.test(a)), false);
  yikiciYok(f);
});

test("gercekCalistir: git soru sormaz ve Ingilizce hata verir (ortam), zaman asimini ve eksik komutu bildirir", gerekirGit, () => {
  const r = G.gercekCalistir("git", ["-c", "alias.ortam=!echo $GIT_TERMINAL_PROMPT-$LC_ALL", "ortam"], { cwd: os.tmpdir(), zamanAsimiMs: 20000 });
  assert.equal(r.kod, 0, r.err);
  assert.equal(r.out.trim(), "0-C");
  const t = G.gercekCalistir("git", ["-c", "alias.bekle=!sleep 2", "bekle"], { cwd: os.tmpdir(), zamanAsimiMs: 300 });
  assert.equal(t.zamanAsimi, true);
  const y = G.gercekCalistir("otopilot-olmayan-komut-xyz", [], { cwd: os.tmpdir() });
  assert.equal(y.hata && y.hata.code, "ENOENT");
  assert.equal(y.kod, null);
});

// ---------------------------------------------------------------- gercek git (yerel uzak depo)
// commit.gpgsign: gelistiricinin genel ayarinda imza zorunluysa test commit'leri gpg beklemesin
const GIT_ENV = Object.assign({}, process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com", GIT_TERMINAL_PROMPT: "0",
  GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "commit.gpgsign", GIT_CONFIG_VALUE_0: "false" });
function g(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, env: GIT_ENV });
  assert.equal(r.status, 0, "git " + args.join(" ") + " -> " + r.stderr);
  return r.stdout;
}
function durumBaslat(adim) {
  const d = gecici("git" + adim);
  const uzak = path.join(d, "uzak.git");
  const itici = path.join(d, "itici");
  const calisma = path.join(d, "calisma");
  fs.mkdirSync(uzak);
  g(uzak, "init", "--bare", "-b", "main");
  fs.mkdirSync(itici);
  g(itici, "init", "-b", "main");
  g(itici, "config", "core.autocrlf", "false");
  g(itici, "remote", "add", "origin", uzak);
  yaz(path.join(itici, "package.json"), JSON.stringify({ name: "otopilot", version: "1.0.0" }) + "\n");
  yaz(path.join(itici, "CHANGELOG.md"), "# Değişiklik geçmişi\n\n## [1.0.0] — ilk\n");
  yaz(path.join(itici, ".gitignore"), "uretim/\n.env\n");
  g(itici, "add", "-A");
  g(itici, "commit", "-m", "ilk");
  g(itici, "push", "-u", "origin", "main");
  g(d, "-c", "core.autocrlf=false", "clone", uzak, calisma);          // klonlamadan ONCE kapat: global autocrlf=true ise dosyalar CRLF'e donup 'degismis' gorunur
  g(calisma, "config", "core.autocrlf", "false");
  const yeniSurum = (surum, baslik, dosya) => {
    yaz(path.join(itici, "package.json"), JSON.stringify({ name: "otopilot", version: surum }) + "\n");
    yaz(path.join(itici, "CHANGELOG.md"), "# Değişiklik geçmişi\n\n## " + baslik + "\n\n## [1.0.0] — ilk\n");
    if (dosya) yaz(path.join(itici, dosya), "x\n");
    g(itici, "add", "-A");
    g(itici, "commit", "-m", "surum " + surum);
    g(itici, "push", "origin", "main");
  };
  return { d, uzak, itici, calisma, yeniSurum };
}
const gercek = k => ({ kok: k.calisma, yaz: toplayici() });

test("gercek git: uzakta yeni surum var -> ileri sarilir, dosyalar guncellenir; ikinci calistirma 'zaten guncel'", gerekirGit, () => {
  const k = durumBaslat("ileri");
  k.yeniSurum("1.1.0", "[1.1.0] — yeni", "lib/yeni.js");
  const o = gercek(k);
  yaz(path.join(k.calisma, ".env"), "GIZLI=1\n");                       // yok sayilan dosyalar engel degil, silinmez
  yaz(path.join(k.calisma, "uretim", "is1", "a.txt"), "uretim\n");
  const s = G.guncelle(o);
  assert.equal(s.durum, "guncellendi");
  assert.equal(s.surum, "1.1.0");
  assert.equal(s.changelogBasligi, "[1.1.0] — yeni");
  assert.ok(fs.existsSync(path.join(k.calisma, "lib", "yeni.js")));
  assert.equal(g(k.calisma, "rev-parse", "HEAD"), g(k.itici, "rev-parse", "HEAD"));
  assert.equal(fs.readFileSync(path.join(k.calisma, ".env"), "utf8"), "GIZLI=1\n");
  assert.equal(fs.readFileSync(path.join(k.calisma, "uretim", "is1", "a.txt"), "utf8"), "uretim\n");
  assert.match(o.yaz.metin(), /1 yeni commit/);
  const o2 = gercek(k);
  const s2 = G.guncelle(o2);
  assert.equal(s2.durum, "zaten_guncel");
  assert.match(o2.yaz.metin(), /Zaten güncel: Otopilot 1\.1\.0/);
});

test("gercek git: package-lock.json degisince 'npm ci' (sahte npm) calisir; baska dosya degisince calismaz", gerekirGit, () => {
  const k = durumBaslat("kilit");
  k.yeniSurum("1.0.1", "[1.0.1] — kilit", "package-lock.json");
  const npmCagrilari = [];
  const o = { kok: k.calisma, yaz: toplayici(), calistir: (komut, args, sec) => {
    if (komut === "npm") { npmCagrilari.push(args); return tamam("ok"); }
    return G.gercekCalistir(komut, args, sec);
  } };
  const s = G.guncelle(o);
  assert.equal(s.bagimliliklarKuruldu, true);
  assert.deepEqual(npmCagrilari, [["ci", "--no-fund", "--ignore-scripts"]]);
  assert.deepEqual(s.degisenDosyalar.sort(), ["CHANGELOG.md", "package-lock.json", "package.json"]);
  k.yeniSurum("1.0.2", "[1.0.2] — sadece belge");
  npmCagrilari.length = 0;
  G.guncelle(Object.assign(o, { yaz: toplayici() }));
  assert.deepEqual(npmCagrilari, []);
});

test("gercek git: izlenen dosyada yerel degisiklik -> durur, dosya ve HEAD aynen kalir; yalniz izlenmeyen dosya engel degil", gerekirGit, () => {
  const k = durumBaslat("kirli");
  k.yeniSurum("1.1.0", "[1.1.0] — yeni");
  const basta = g(k.calisma, "rev-parse", "HEAD");
  yaz(path.join(k.calisma, "kendi-notum.txt"), "not\n");
  const s = G.guncelle(gercek(k));                                       // izlenmeyen dosya engel degil
  assert.equal(s.durum, "guncellendi");
  k.yeniSurum("1.2.0", "[1.2.0] — daha yeni");
  const kendi = "// benim degisikligim\n";
  yaz(path.join(k.calisma, "package.json"), kendi);
  const once = g(k.calisma, "rev-parse", "HEAD");
  const e = hataBekle(() => G.guncelle(gercek(k)));
  assert.equal(e.kod, "guncelle_yerel_degisiklik");
  assert.equal(e.cikis, 2);
  assert.match(e.message, /package\.json/);
  assert.equal(fs.readFileSync(path.join(k.calisma, "package.json"), "utf8"), kendi, "yerel degisiklik silindi/ezildi");
  assert.equal(g(k.calisma, "rev-parse", "HEAD"), once, "HEAD ilerlememeli");
  assert.notEqual(basta, once);
  assert.equal(fs.readFileSync(path.join(k.calisma, "kendi-notum.txt"), "utf8"), "not\n");
  assert.equal(g(k.calisma, "stash", "list"), "", "kendiliginden stash yapilmamali");
});

// Onceki `git pull` dosya yazarken durmus gibi: uzak dal cekilmis (fetch), dosyalarin bir kismi yeni surume gecmis, HEAD eski.
function yarimDurum(on, benimIcerik) {
  const k = durumBaslat(on);
  yaz(path.join(k.itici, "lib", "a.js"), "a1\n");
  yaz(path.join(k.itici, "sil.txt"), "silinecek\n");
  g(k.itici, "add", "-A"); g(k.itici, "commit", "-m", "dosyalar"); g(k.itici, "push", "origin", "main");
  g(k.calisma, "pull", "--ff-only");
  yaz(path.join(k.itici, "lib", "a.js"), "a2\n");
  fs.rmSync(path.join(k.itici, "sil.txt"));
  yaz(path.join(k.itici, "yeni klasör", "b.js"), "b\n");
  k.yeniSurum("1.1.0", "[1.1.0] — yarım kalan");
  g(k.calisma, "fetch");
  const basHead = g(k.calisma, "rev-parse", "HEAD");
  // git'in yarida biraktigi hal: a.js ve yeni dosya yazilmis, sil.txt silinmis; package.json/CHANGELOG'a sira gelmemis
  yaz(path.join(k.calisma, "lib", "a.js"), benimIcerik || "a2\r\n");     // CRLF: autocrlf=true kopyada git boyle yazar
  fs.rmSync(path.join(k.calisma, "sil.txt"));
  yaz(path.join(k.calisma, "yeni klasör", "b.js"), "b\n");
  yaz(path.join(k.calisma, "kendi-notum.txt"), "benim notum\n");        // guncellemeyle ilgisiz kullanici dosyasi
  return Object.assign(k, { basHead });
}

test("gercek git: yarida kalmis guncelleme (dosyalar yeni surumle birebir ayni) -> kanitlanip tamamlanir; calisma dosyalarina ve kullanici dosyasina dokunulmaz, stash yok", gerekirGit, () => {
  const k = yarimDurum("yarim");
  g(k.calisma, "config", "core.autocrlf", "true");
  const o = gercek(k);
  const s = G.guncelle(o);
  assert.equal(s.durum, "guncellendi");
  assert.deepEqual(s.yarimTamamlanan.slice().sort(), ["lib/a.js", "sil.txt", "yeni klasör/b.js"]);
  assert.equal(g(k.calisma, "rev-parse", "HEAD"), g(k.itici, "rev-parse", "HEAD"));
  assert.equal(s.surum, "1.1.0");
  assert.equal(g(k.calisma, "status", "--porcelain"), "?? kendi-notum.txt\n");
  assert.equal(fs.readFileSync(path.join(k.calisma, "kendi-notum.txt"), "utf8"), "benim notum\n");
  assert.equal(g(k.calisma, "stash", "list"), "");
  assert.match(o.yaz.metin(), /yarıda kalmış: 3 dosya zaten yeni sürümle birebir aynı/);
  assert.match(o.yaz.metin(), /1 yeni commit/);
});

test("gercek git: yarim gibi gorunen ama BIR dosyasi farkli (kullanici degistirmis) -> tamamlanmaz, yerel degisiklik hatasi; dosyalar, HEAD ve index aynen kalir", gerekirGit, () => {
  const k = yarimDurum("yarimdegil", "a2 ama benim satirim\n");
  const e = hataBekle(() => G.guncelle(gercek(k)));
  assert.equal(e.kod, "guncelle_yerel_degisiklik");
  assert.equal(fs.readFileSync(path.join(k.calisma, "lib", "a.js"), "utf8"), "a2 ama benim satirim\n");
  assert.ok(fs.existsSync(path.join(k.calisma, "yeni klasör", "b.js")));
  assert.equal(g(k.calisma, "rev-parse", "HEAD"), k.basHead);
  assert.equal(g(k.calisma, "diff", "--cached", "--name-only"), "", "index'e hicbir sey sahnelenmemeli");
  assert.equal(g(k.calisma, "stash", "list"), "");
});

test("gercek git: yerel commit + uzakta yeni commit (ayrisma) -> cikis 2, yerel commit yerinde", gerekirGit, () => {
  const k = durumBaslat("ayrisma");
  yaz(path.join(k.calisma, "benim.txt"), "benim\n");
  g(k.calisma, "add", "-A");
  g(k.calisma, "commit", "-m", "benim commit");
  const benim = g(k.calisma, "rev-parse", "HEAD");
  k.yeniSurum("1.1.0", "[1.1.0] — yeni");
  const e = hataBekle(() => G.guncelle(gercek(k)));
  assert.equal(e.kod, "guncelle_ayrisma");
  assert.equal(e.cikis, 2);
  assert.equal(g(k.calisma, "rev-parse", "HEAD"), benim);
  assert.ok(fs.existsSync(path.join(k.calisma, "benim.txt")));
});

test("gercek git: detached HEAD ve izleme dalsiz dal -> guncelle_dal (cikis 2)", gerekirGit, () => {
  const k = durumBaslat("dal");
  g(k.calisma, "checkout", "-b", "yerel-dal");
  const a = hataBekle(() => G.guncelle(gercek(k)));
  assert.equal(a.kod, "guncelle_dal");
  assert.match(a.message, /izleme dalı yok/);
  g(k.calisma, "checkout", "--detach");
  const b = hataBekle(() => G.guncelle(gercek(k)));
  assert.equal(b.kod, "guncelle_dal");
  assert.match(b.message, /detached HEAD/);
});

test("gercek git: alt klasor baska bir deponun icindeyse (ZIP acilmis) ust depo ASLA cekilmez", gerekirGit, () => {
  const k = durumBaslat("ust");
  const ic = path.join(k.calisma, "zip-acilmis");                        // .git'i yok, ama ust klasor git deposu
  yaz(path.join(ic, "package.json"), "{}");
  const once = g(k.calisma, "rev-parse", "HEAD");
  k.yeniSurum("1.1.0", "[1.1.0] — yeni");
  const e = hataBekle(() => G.guncelle({ kok: ic, yaz: toplayici() }));
  assert.equal(e.kod, "guncelle_zip");
  assert.equal(g(k.calisma, "rev-parse", "HEAD"), once, "ust depo guncellenmis");
});

// ---------------------------------------------------------------- komut satiri (gercek surec, cikis kodlari)
function kopyaKok() {
  const d = gecici("cli");
  yaz(path.join(d, "lib", "guncelle.js"), fs.readFileSync(path.join(KOK, "lib", "guncelle.js")));
  yaz(path.join(d, "lib", "ortak.js"), fs.readFileSync(path.join(KOK, "lib", "ortak.js")));
  yaz(path.join(d, "package.json"), JSON.stringify({ name: "otopilot", version: "9.9.9" }));
  return d;
}
const calistirCli = (d, ...args) => spawnSync(process.execPath, [path.join(d, "lib", "guncelle.js"), ...args], { cwd: d, encoding: "utf8", windowsHide: true, timeout: 60000, env: GIT_ENV });

test("komut satiri: --yardim cikis 0; ZIP kopyada cikis 2 + '✗' + @@HATA + ZIP adresi, yigin izi yok, dosyalar yerinde", () => {
  const d = kopyaKok();
  const y = calistirCli(d, "--yardim");
  assert.equal(y.status, 0, y.stderr);
  assert.match(y.stdout, /npm run guncelle/);
  for (const bayrak of ["--help", "-h"]) {                               // yardim isteyen guncellemeyi baslatmamali
    const h = calistirCli(d, bayrak);
    assert.equal(h.status, 0, bayrak + ": " + h.stderr);
    assert.match(h.stdout, /Kullanım: npm run guncelle/);
  }
  yaz(path.join(d, ".env"), "A=\n");
  const r = calistirCli(d);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /@@HATA \{"kod":"guncelle_zip"/);
  assert.match(r.stderr, /✗ .*ZIP/);
  assert.match(r.stderr, /archive\/refs\/heads\/main\.zip/);
  assert.doesNotMatch(r.stderr, /\n\s+at\s+\S+.*:\d+:\d+/, "yigin izi sizdi");
  assert.ok(fs.existsSync(path.join(d, ".env")));
});

test("komut satiri (gercek git): ulasilamayan uzak adres -> cikis 3 ve 'Hicbir dosya degistirilmedi'", gerekirGit, () => {
  const d = kopyaKok();
  g(d, "init", "-b", "main");
  g(d, "config", "core.autocrlf", "false");
  g(d, "add", "-A");
  g(d, "commit", "-m", "ilk");
  g(d, "remote", "add", "origin", "http://127.0.0.1:1/yok.git");        // port 1: baglanti reddedilir, ag gerekmez
  g(d, "update-ref", "refs/remotes/origin/main", "HEAD");
  g(d, "branch", "--set-upstream-to=origin/main", "main");
  const once = g(d, "rev-parse", "HEAD");
  const r = calistirCli(d);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /@@HATA \{"kod":"guncelle_ag"/);
  assert.match(r.stderr, /Hiçbir dosya değiştirilmedi/);
  assert.equal(g(d, "rev-parse", "HEAD"), once);
});
