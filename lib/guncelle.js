"use strict";
// TEK KOMUTLUK GUNCELLEME — npm run guncelle
//
// Depo bir git kopyasiysa guvenle gunceller; degilse (ZIP) ne yapilacagini soyler.
//  - Yerel degisikligin varsa DURUR; hicbir dosyayi silmez, stash/reset/checkout/clean/restore calistirmaz.
//  - Yalniz `git pull --no-rebase --ff-only` (gecmisi birlestirme/yeniden yazma yok; pull.rebase ayari olsa da).
//  - package-lock.json degistiyse `npm ci --ignore-scripts` (PANEL.bat ve CI ile ayni kurulum).
//  - Sonunda surum, commit ve CHANGELOG.md'nin en ustteki basligini yazar.
//  - Kopya resmi depodan degil de bir fork'tan guncelleniyorsa uyarir (fork eslenmedikce yenilik gelmez).
//  - Onceki guncelleme yarida kaldiysa (Windows'ta bir dosya baska programda acikti, git bir kismini yazip durdu)
//    ve "degisiklikler" GitHub'daki yeni surumle BIREBIR ayniysa bunu kanitlayip tamamlar (yalniz `git add` +
//    ileri sarma: calisma dosyalarina dokunmaz). Tek bir dosya bile farkliysa normal "yerel degisiklik" hatasi.
//
// Cikis kodlari (lib/ortak.js): 0 basari / zaten guncel; 2 elle mudahale gerek (ZIP, git yok, yerel degisiklik,
// dal ayrismis, izleme dali yok, dosya kullanimda); 3 ag/GitHub erisimi (npm paketleri dahil); 5 disk dolu;
// 6 baska bir git islemi suruyor (.git/index.lock); 1 diger.
//
// Test icin: guncelle({ kok, calistir, yaz }) — git/npm cagrilari `calistir(komut, args, secenek)` ile sahtelenir.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ortak = require("./ortak");

const { OrtakHata, CIKIS } = ortak;

const DEPO_SAYFASI = "https://github.com/wj-sidiss/otopilot";
const ZIP_ADRESI = DEPO_SAYFASI + "/archive/refs/heads/main.zip";
// Resmi depo (eski adi youtube-otomasyon: GitHub yeni ada yonlendirir). https / ssh / scp bicimi, kullanici bilgisi olsa da.
const RESMI_DEPO_DESENI = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@\/\s]+@)?(?:www\.)?github\.com[:\/]wj-sidiss\/(?:otopilot|youtube-otomasyon)(?:\.git)?\/?$/i;
// .gitignore'da olan, yani git'in izlemedigi KULLANICI verisi: ZIP ile guncellerken yeni klasore tasinir.
const TASINACAKLAR = [".env", "uretim", "panel-ayar.json", "muzik", "videolar", "trend",
  "video-indirici/ayarlar.json", "video-indirici/indirilenler", "ai-infapp/data"];

const NPM_ARGS = ["ci", "--no-fund", "--ignore-scripts"];
const CEK_ARGS = ["pull", "--no-rebase", "--ff-only"];
const GIT_ORTAMI = { GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", LC_ALL: "C", LANGUAGE: "C" };   // soru sorma; hata kaliplari hep Ingilizce
const PARCA = 100;   // Windows komut satiri siniri (~32K karakter): dosya listesi parca parca verilir

// ---------------------------------------------------------------- dis komut calistirici
// npm: `npm run` altindaysa npm-cli.js dogrudan node ile calistirilir (Windows'ta .cmd + shell gerekmez);
// degilse Windows'ta kabukla (sabit argumanlar, kullanici girdisi YOK), digerlerinde dogrudan "npm".
function npmCagrisi(args, env, platform) {
  env = env || process.env;
  platform = platform || process.platform;
  const yol = env.npm_execpath;
  if (yol && /^npm-cli\.[cm]?js$/i.test(path.basename(yol)) && fs.existsSync(yol)) return { komut: process.execPath, args: [yol].concat(args), kabuk: false };
  if (platform === "win32") return { komut: ["npm"].concat(args).join(" "), args: [], kabuk: true };
  return { komut: "npm", args, kabuk: false };
}

function gercekCalistir(komut, args, secenek) {
  const o = secenek || {};
  let c = komut, a = args || [], kabuk = false;
  if (komut === "npm") ({ komut: c, args: a, kabuk } = npmCagrisi(a));
  const r = spawnSync(c, a, {
    cwd: o.cwd, encoding: "utf8", windowsHide: true, timeout: o.zamanAsimiMs, maxBuffer: 64 * 1024 * 1024,
    shell: kabuk, stdio: ["ignore", "pipe", "pipe"],
    env: Object.assign({}, process.env, komut === "git" ? GIT_ORTAMI : {}),
  });
  return { kod: r.status, out: r.stdout || "", err: r.stderr || "", hata: r.error || null,
           zamanAsimi: !!(r.error && r.error.code === "ETIMEDOUT") };
}

// ---------------------------------------------------------------- yardimcilar
function yolAnahtari(y) {
  let r;
  try { r = fs.realpathSync.native(y); } catch (e) { r = path.resolve(y); }
  r = r.replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? r.toLowerCase() : r;
}

// `git status --porcelain -z`: izlenen dosyalardaki degisiklik ile izlenmeyen (yeni) dosyalari ayirir.
// .gitignore'daki (uretim/, .env, ai-infapp/data ...) dosyalar git'in kendisi tarafindan zaten listelenmez.
// girdiler: izlenen her degisikligin durum kodu (XY) ile; yarim kalan guncellemeyi tanimak icin.
function durumAyristir(cikti) {
  const parcalar = String(cikti || "").split("\0").filter(x => x.length > 0);
  const izlenen = [], izlenmeyen = [], girdiler = [];
  for (let i = 0; i < parcalar.length; i++) {
    const p = parcalar[i];
    const xy = p.slice(0, 2), ad = p.slice(3);
    if (xy === "??") { izlenmeyen.push(ad); continue; }
    if (xy === "!!") continue;
    izlenen.push(ad);
    girdiler.push({ xy, ad });
    if (/[RC]/.test(xy)) i++;                       // yeniden adlandirma/kopya: sonraki parca eski ad
  }
  return { izlenen, izlenmeyen, girdiler };
}
const sifirlaBol = metin => String(metin || "").split("\0").filter(x => x.length > 0);
const parcala = (liste, n) => { const p = []; for (let i = 0; i < liste.length; i += n) p.push(liste.slice(i, i + n)); return p; };

function ilkSatir(metin) {
  return String(metin || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0] || "";
}
// git'in stderr'indeki ASIL hata satiri. `git pull` once fetch ciktisi yazar ("From https://...", "abc..def main -> origin/main",
// "hint: ..."); bunlar hata degildir. Ilk "fatal:/error:" satiri; yoksa bu gurultu disindaki ilk satir.
function hataSatiri(metin) {
  const satirlar = String(metin || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return satirlar.find(s => /^(?:fatal|error):/i.test(s))
    || satirlar.find(s => !/^(?:hint:|From\s|remote:|Updating\s|Fast-forward|\*\s|\+\s)/i.test(s) && !/\s->\s/.test(s))
    || satirlar[0] || "";
}
// "...would be overwritten by merge:\n\tdosya1\n\tdosya2\nPlease ..." -> [dosya1, dosya2]
function cakisanDosyalar(metin) {
  const out = [];
  let topla = false;
  for (const ham of String(metin || "").split(/\r?\n/)) {
    if (/would be overwritten/i.test(ham)) { topla = true; continue; }
    if (!topla) continue;
    if (/^\t/.test(ham) && ham.trim()) out.push(ham.trim());
    else if (ham.trim()) topla = false;
  }
  return out;
}
function kisalt(liste, n) {
  const g = liste.slice(0, n).join(", ");
  return liste.length > n ? g + " … (+" + (liste.length - n) + ")" : g;
}
function surumOku(kok) {
  try { return JSON.parse(fs.readFileSync(path.join(kok, "package.json"), "utf8")).version || null; } catch (e) { return null; }
}
// CHANGELOG.md'nin en ustteki "## ..." basligi (kayitlar yeniden eskiye dizilir)
function changelogBasligi(kok) {
  try {
    const m = /^## +(.+)$/m.exec(fs.readFileSync(path.join(kok, "CHANGELOG.md"), "utf8"));
    return m ? m[1].trim() : null;
  } catch (e) { return null; }
}
// Uzak adresi ekrana yazmadan once icindeki kullanici adi/jetonu siler (https://kisi:JETON@github.com/... -> https://github.com/...).
function adresTemizle(u) {
  return String(u || "").trim().replace(/^([a-z][a-z0-9+.-]*:\/\/)[^\/@\s]*@/i, "$1");
}
const resmiDepoMu = u => RESMI_DEPO_DESENI.test(String(u || "").trim());
function hata(kod, mesaj, cozum, cikis, detay) {
  return new OrtakHata(kod, mesaj, { cikis, cozum, detay });
}

// ---------------------------------------------------------------- hata ureticileri (hepsi Turkce, ne yapilacagini soyler)
function zipYonergesi(kok) {
  const mevcut = [];
  for (const g of TASINACAKLAR) {
    try { mevcut.push(fs.statSync(path.join(kok, ...g.split("/"))).isDirectory() ? g + "/" : g); } catch (e) { /* yok: listeye girmez */ }
  }
  const tasi = mevcut.length
    ? "Eski klasörden şunları yeni klasöre taşı: " + mevcut.join(", ") + "."
    : "Eski klasörde taşınacak yerel dosya görünmüyor (.env, uretim/ gibi); varsa onları da yeni klasöre taşı.";
  return [
    "ZIP ile indirmişsin; yeni ZIP'i indirip uretim/ ve .env'i taşıman gerekir:",
    "  1) Yeni ZIP'i indir: " + ZIP_ADRESI,
    "  2) Yeni bir klasöre aç (eskisinin üstüne açma; eski klasör silinmedi, olduğu gibi duruyor).",
    "  3) " + tasi,
    "  4) Yeni klasörde: npm ci --ignore-scripts",
    "Bir daha elle uğraşmamak için git ile kur: git clone " + DEPO_SAYFASI + ".git (sonraki güncellemeler: npm run guncelle).",
  ].join("\n");
}
const zipHatasi = (kok, baslik) => hata("guncelle_zip", baslik + "; otomatik güncelleme yapılamaz. Hiçbir dosya değiştirilmedi.", zipYonergesi(kok), CIKIS.GIRDI);
const gitYokHatasi = kok => hata("guncelle_git_yok", "Git bulunamadı; otomatik güncelleme yapılamaz. Hiçbir dosya değiştirilmedi.",
  "Git'i kur (Windows: winget install --id Git.Git -e · macOS: xcode-select --install · Linux: sudo apt install git), pencereyi kapatıp yeniden aç ve npm run guncelle'yi tekrar çalıştır.\n" +
  "Git kurmak istemezsen ZIP yöntemi:\n" + zipYonergesi(kok).split("\n").map(s => "  " + s).join("\n"), CIKIS.GIRDI);
const guvenliDizinHatasi = (kok, metin) => hata("guncelle_guvenli_dizin", "Git bu klasörü güvenli saymıyor (klasörün sahibi başka bir kullanıcı).",
  "Klasörün sana ait olduğundan eminsen şunu bir kez çalıştır, sonra npm run guncelle'yi tekrar dene: git config --global --add safe.directory \"" + kok.replace(/\\/g, "/") + "\"", CIKIS.GIRDI, ilkSatir(metin));
const agHatasi = (mesaj, ek, detay) => hata("guncelle_ag", mesaj + " Hiçbir dosya değiştirilmedi.",
  "İnternet bağlantını kontrol edip npm run guncelle'yi tekrar çalıştır." + (ek ? " " + ek : ""), CIKIS.SERVIS, detay);

function yerelDegisiklikHatasi(izlenen) {
  const sadeceKilit = izlenen.every(d => d === "package-lock.json");
  const satirlar = [
    "Önce değişikliklerini sakla: git stash  (güncellemeden sonra geri getir: git stash pop)  — ya da commit'le: git commit -am \"yerel değişiklikler\".",
    "Değişikliklerin sana ait değilse ve atmak istiyorsan bunu SEN karar ver (ben hiçbir şeyi geri almıyorum ya da silmiyorum).",
  ];
  if (sadeceKilit) satirlar.push("Yalnız package-lock.json değişmiş (muhtemelen 'npm install' çalıştırdın): bu dosya sana ait bir değişiklik değilse eski haline getir: git restore package-lock.json — bundan sonra kurulum için 'npm ci --ignore-scripts' kullan.");
  satirlar.push("Sonra npm run guncelle'yi tekrar çalıştır.");
  return hata("guncelle_yerel_degisiklik",
    "Yerel değişikliklerin var, güncelleme durduruldu (hiçbir dosya silinmedi ya da değiştirilmedi): " + kisalt(izlenen, 8),
    satirlar.join("\n  "), CIKIS.GIRDI, { dosyalar: izlenen });
}

const KILIT_DESENI = /index\.lock|Another git process seems to be running|Unable to create '[^']*\.lock'|cannot lock ref/i;
const DISK_DESENI = /No space left on device|ENOSPC|Disk quota exceeded/i;
const AG_DESENI = /Could not resolve|Failed to connect|Connection (?:timed out|refused|reset|was reset)|Operation timed out|timed out|Network is unreachable|early EOF|RPC failed|SSL|schannel|Temporary failure in name resolution|Recv failure|Send failure|unable to access|returned error: 5\d\d/i;
// "Permission denied" YALNIZ ssh anahtar reddi ise yetki; digerleri (dosya yazilamadi) yerel dosya sorunudur.
const YETKI_DESENI = /Authentication failed|could not read (?:Username|Password)|terminal prompts disabled|Permission denied \(publickey|Repository not found|returned error: 40[134]/i;
const AYRISMA_DESENI = /Not possible to fast-forward|diverge|refusing to merge unrelated histories|have diverged/i;
const EZILME_DESENI = /would be overwritten|overwritten by merge|Please commit your changes or stash/i;
// Windows'ta dosya baska programda acikken (panel, kurgu, goruntuleyici, virus tarayici) ya da yazma izni yokken.
const YEREL_DOSYA_DESENI = /unable to unlink|unable to create (?:file|directory|symlink|temporary)|cannot create directory|could not create (?:work tree|leading directories)|unable to write (?:file|new index)|Invalid argument|Device or resource busy|Filename too long|Deletion of directory .* failed|Permission denied|Read-only file system/i;

// `git pull` basarisiz oldu: nedeni sinifla, anlasilir Turkce ver.
function cekmeHatasi(r, kok) {
  if (r.zamanAsimi) return agHatasi("GitHub zamanında yanıt vermedi.");
  if (r.hata && r.hata.code === "ENOENT") return gitYokHatasi(kok);
  const metin = (r.err || "") + "\n" + (r.out || "");
  const ozet = hataSatiri(r.err) || hataSatiri(r.out) || (r.hata && r.hata.message) || "bilinmeyen hata";
  if (/dubious ownership/i.test(metin)) return guvenliDizinHatasi(kok, metin);
  if (KILIT_DESENI.test(metin)) {
    const kilit = (/'([^']+\.lock)'/.exec(metin) || [])[1];
    return hata("guncelle_kilit", "Başka bir git işlemi sürüyor ya da yarıda kalmış (" + ozet + "). Hiçbir dosya değiştirilmedi.",
      "Açık bir git işlemi (editör, GitHub Desktop, başka bir terminal) varsa bitmesini bekle ve npm run guncelle'yi tekrar çalıştır. " +
      "Hiçbiri çalışmıyorsa önceki bir git işlemi yarıda kalmıştır: " + (kilit ? "'" + kilit + "'" : ".git klasöründeki .lock") + " dosyasını sen sil, sonra tekrar çalıştır.", CIKIS.KILIT, ozet);
  }
  if (DISK_DESENI.test(metin)) return hata("guncelle_disk", "Diskte yer kalmadı; güncelleme yapılamadı (" + ozet + ").",
    "Disk alanı aç (panelde Disk bölümünden ara dosyaları temizle), sonra npm run guncelle'yi tekrar çalıştır.", CIKIS.DISK, ozet);
  if (YETKI_DESENI.test(metin)) return hata("guncelle_ag", "GitHub depoya erişim izni vermedi (giriş gerekiyor ya da adres değişmiş). Hiçbir dosya değiştirilmedi.",
    "Depo özelse bir kez elle git pull çalıştırıp giriş yap; herkese açık depoysa 'git remote -v' ile adresin " + DEPO_SAYFASI + " olduğunu kontrol et.", CIKIS.SERVIS, ozet);
  if (AG_DESENI.test(metin)) return agHatasi("GitHub'a ulaşılamadı.", "Ayrıntı: " + ozet, ozet);
  if (AYRISMA_DESENI.test(metin)) return hata("guncelle_ayrisma", "Yerel dalın uzak daldan ayrışmış (kendi commit'lerin var ya da uzak geçmiş yeniden yazılmış); otomatik birleştirme yapmadım. Hiçbir dosya değiştirilmedi.",
    "Önce kendi commit'lerini yedekle: git branch yedek-" + ortak.damga().slice(0, 8) + "\n  Sonra elle seç: git pull --rebase (commit'lerini yenilerin üstüne taşır) ya da, kendi commit'in YOKSA (git log @{u}..HEAD boşsa), temiz kopya için depoyu yeniden klonla.", CIKIS.GIRDI, ozet);
  if (EZILME_DESENI.test(metin)) {
    const dosyalar = cakisanDosyalar(metin);
    return hata("guncelle_yerel_degisiklik", "Yerel dosyaların güncellemeyle çakışıyor; git hiçbir şeyi ezmedi" + (dosyalar.length ? ": " + kisalt(dosyalar, 8) : " (" + ozet + ")") + ".",
      "Çakışan dosyaları taşı ya da yedekle (git stash -u hepsini saklar), sonra npm run guncelle'yi tekrar çalıştır. " +
      "Dosyayı sen değiştirmediysen başka bir programda (panel, video kurgusu, görüntüleyici, düzenleyici) açık olabilir: kapatıp tekrar dene.", CIKIS.GIRDI, { dosyalar, ozet });
  }
  if (YEREL_DOSYA_DESENI.test(metin)) return hata("guncelle_dosya", "Git bazı dosyaları yazamadı (" + ozet + "). Hiçbir dosya değiştirilmedi.",
    "Dosyayı kullanan programı kapat (panel, video kurgusu, açık görüntüleyici ya da düzenleyici; bazen virüs tarayıcı) ve klasöre yazma iznin olduğundan emin ol, sonra npm run guncelle'yi tekrar çalıştır.", CIKIS.GIRDI, ozet);
  return hata("guncelle_git", "git pull --ff-only başarısız oldu: " + ozet, "Ayrıntı için elle çalıştır: git pull --ff-only", CIKIS.GENEL, metin.slice(-1500));
}

// Cekme basarisizken git calisma agacinin bir kismini yazmis olabilir (dosya kilitliydi, zaman asimi): o zaman
// "hicbir dosya degistirilmedi" YALAN olur. Gercek durumu soyle; sonraki calistirma yarim kalani kendisi tamamlar.
function yarimKaldiHatasi(dosyalar, asil, neden) {
  return hata("guncelle_yarim",
    "Güncelleme yarıda kaldı: git bazı dosyaları yazdı, bazılarını yazamadı (" + neden + "). " +
    "Kendi dosyalarına ve değişikliklerine dokunulmadı. Yeni sürüme geçen dosyalar: " + kisalt(dosyalar, 8),
    "Dosyaları kullanan programı kapat (panel, video kurgusu, açık görüntüleyici ya da düzenleyici; bazen virüs tarayıcı), sonra npm run guncelle'yi tekrar çalıştır: " +
    "yarım kalan güncellemeyi, dosyaların yeni sürümle aynı olduğunu doğrulayıp kendisi tamamlar.", asil.cikis === CIKIS.GENEL ? CIKIS.GIRDI : asil.cikis,
    { dosyalar, neden: asil.kod });
}

function npmHatasi(r, yeniKod) {
  const metin = (r.err || "") + "\n" + (r.out || "");
  const onek = "Kod güncellendi (" + yeniKod + ") ama bağımlılıklar kurulamadı";
  const elle = "Panel ya da başka bir program açıksa kapat, sonra proje klasöründe elle çalıştır: npm ci --ignore-scripts";
  if (r.hata && r.hata.code === "ENOENT") return hata("guncelle_npm", onek + ": npm bulunamadı.", "Node.js kurulumunu kontrol et (npm, Node.js ile gelir). " + elle, CIKIS.GIRDI);
  if (r.zamanAsimi || /ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|fetch failed|socket hang up/i.test(metin))
    return hata("guncelle_ag", onek + ": paketler indirilemedi (internet).", "Bağlantını kontrol et. " + elle, CIKIS.SERVIS, metin.slice(-1500));
  if (/ENOSPC|no space left/i.test(metin)) return hata("guncelle_npm", onek + ": diskte yer kalmadı.", "Disk alanı aç. " + elle, CIKIS.DISK, metin.slice(-1500));
  return hata("guncelle_npm", onek + ": " + (ilkSatir(r.err) || ilkSatir(r.out) || "npm ci başarısız"), elle, CIKIS.GENEL, metin.slice(-1500));
}

// ---------------------------------------------------------------- yarim kalan guncelleme
// Onceki `git pull` dosya yazarken durduysa (Windows: dosya baska programda acikti) calisma agacindaki "degisiklikler"
// aslinda GitHub'daki yeni surumun kendisidir. Bunu KANITLAYABILIRSEK tamamlariz; kanit kosullari:
//  - hicbir sey sahnelenmemis (XY = " M" / " D"), HEAD ile izlenen uzak dal (@{u}) farkli ve HEAD onun atasi (ileri sarilabilir);
//  - degisen her dosya guncellemenin dokundugu dosyalardan ve icerigi @{u}'dakiyle git hash'iyle AYNI (silinmisse @{u}'da da yok);
//  - guncellemenin getirdigi yollarda duran izlenmeyen dosyalar da @{u}'dakiyle ayni.
// Kosullar tutarsa dondurulen yollar `git add` ile sahnelenir (calisma agacina DOKUNMAZ) ve @{u}'ya ileri sarilir: kayipsizdir,
// cunku her icerik zaten @{u} commit'inde duruyor. Tek bir dosya bile farkliysa null (normal "yerel degisiklik" hatasi).
function yarimKalaniBul(git, girdiler) {
  if (!girdiler.length || girdiler.length > 2000) return null;
  if (!girdiler.every(g => g.xy[0] === " " && (g.xy[1] === "M" || g.xy[1] === "D"))) return null;
  const h = git(["rev-parse", "HEAD"]), u = git(["rev-parse", "@{u}"]);
  if (h.kod !== 0 || u.kod !== 0) return null;
  const H = h.out.trim(), U = u.out.trim();
  if (!H || !U || H === U) return null;
  if (git(["merge-base", "--is-ancestor", H, U]).kod !== 0) return null;
  const fark = git(["diff", "--name-only", "-z", H, U]);
  if (fark.kod !== 0) return null;
  const dokunulan = new Set(sifirlaBol(fark.out));
  if (!girdiler.every(g => dokunulan.has(g.ad))) return null;

  const agac = git(["ls-tree", "-r", "-z", "--full-tree", U]);
  if (agac.kod !== 0) return null;
  const hedef = new Map();                                   // yol -> @{u}'daki blob
  for (const s of sifirlaBol(agac.out)) {
    const m = /^\d+ blob ([0-9a-f]+)\t([\s\S]+)$/.exec(s);
    if (m) hedef.set(m[2], m[1]);
  }
  const izlenmeyen = git(["ls-files", "--others", "--exclude-standard", "-z"]);
  if (izlenmeyen.kod !== 0) return null;
  const gelenIzlenmeyen = sifirlaBol(izlenmeyen.out).filter(y => dokunulan.has(y));

  const karsilastir = [];
  for (const g of girdiler) {
    if (g.xy[1] === "D") { if (hedef.has(g.ad)) return null; }          // yerelde silinmis: @{u}'da da silinmis olmali
    else { if (!hedef.has(g.ad)) return null; karsilastir.push(g.ad); }
  }
  for (const y of gelenIzlenmeyen) { if (!hedef.has(y)) return null; karsilastir.push(y); }
  for (const parca of parcala(karsilastir, PARCA)) {
    const r = git(["hash-object", "--"].concat(parca));
    if (r.kod !== 0) return null;
    const hashler = r.out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (hashler.length !== parca.length) return null;
    for (let i = 0; i < parca.length; i++) if (hashler[i] !== hedef.get(parca[i])) return null;
  }
  return { hedef: U, dosyalar: girdiler.map(g => g.ad).concat(gelenIzlenmeyen) };
}

// ---------------------------------------------------------------- ana akis
function guncelle(secenek) {
  const o = secenek || {};
  const kok = o.kok || ortak.KOK;
  const calistir = o.calistir || gercekCalistir;
  const yaz = o.yaz || (s => console.log(s));
  const git = (args, ek) => calistir("git", args, Object.assign({ cwd: kok, zamanAsimiMs: 30000 }, ek));
  const gitHatasi = (adim, r, degismis) => hata("guncelle_git", "git " + adim + " başarısız oldu: " + (hataSatiri(r.err) || hataSatiri(r.out) || (r.hata && r.hata.message) || "bilinmeyen hata"),
    "Ayrıntı için klasörde elle çalıştır: git " + adim + "." + (degismis ? " Güncelleme alındı ama özet okunamadı; git status ile durumu gör." : " Hiçbir dosya değiştirilmedi."),
    CIKIS.GENEL, ((r.err || "") + (r.out || "")).slice(-1500));
  const durumOku = () => {
    const r = git(["status", "--porcelain", "-z"]);
    if (r.kod !== 0) throw gitHatasi("status", r);
    return durumAyristir(r.out);
  };

  // 1) bu klasor gercekten KENDI git kopyasi mi? (ZIP bir ust klasorun git deposuna denk gelirse yanlis depoyu cekmeyelim)
  if (!fs.existsSync(path.join(kok, ".git"))) throw zipHatasi(kok, "Bu klasör bir git kopyası değil (ZIP ile indirmiş olabilirsin)");
  const surumGit = git(["--version"]);
  if (surumGit.hata || surumGit.kod !== 0) throw gitYokHatasi(kok);
  const ust = git(["rev-parse", "--show-toplevel"]);
  if (ust.kod !== 0) {
    if (/dubious ownership|safe\.directory/i.test(ust.err)) throw guvenliDizinHatasi(kok, ust.err);
    throw zipHatasi(kok, "Bu klasör geçerli bir git kopyası değil (.git bozuk ya da eksik)");
  }
  if (yolAnahtari(ust.out.trim()) !== yolAnahtari(kok)) {
    // yol bicimi farkli olabilir (subst surucu, baglanti, Cygwin git): kesin karar icin "en ustte miyim?" diye sor
    const cdup = git(["rev-parse", "--show-cdup"]);
    if (cdup.kod !== 0 || cdup.out.trim() !== "") throw zipHatasi(kok, "Bu klasör kendi git kopyası değil (üstteki başka bir git deposuna bağlı)");
  }

  // 2) dal ve izleme dali
  const dalR = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (dalR.kod !== 0) throw gitHatasi("rev-parse --abbrev-ref HEAD", dalR);
  const dal = dalR.out.trim();
  if (dal === "HEAD") throw hata("guncelle_dal", "Belirli bir commit'tesin (detached HEAD), bir dalda değilsin; güncellenecek dal yok. Hiçbir dosya değiştirilmedi.",
    "Ana dala dön: git switch main  — sonra npm run guncelle'yi tekrar çalıştır.", CIKIS.GIRDI);
  const izle = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  if (izle.kod !== 0) throw hata("guncelle_dal", "'" + dal + "' dalının uzak izleme dalı yok; neyden güncelleneceğini bilemem. Hiçbir dosya değiştirilmedi.",
    "Ana dalda ol: git switch main — ya da bu dalı bağla: git branch --set-upstream-to=origin/" + dal + " " + dal, CIKIS.GIRDI);
  const uzak = izle.out.trim();

  // 3) nereden guncelleniyor? Fork'tan ise uyar (fork GitHub'da eslenmedikce yenilikler gelmez, hep "zaten guncel" der)
  let uzakAdres = null;
  const uzakAd = git(["config", "--get", "branch." + dal + ".remote"]);
  if (uzakAd.kod === 0 && uzakAd.out.trim() && uzakAd.out.trim() !== ".") {
    const url = git(["remote", "get-url", uzakAd.out.trim()]);
    if (url.kod === 0 && url.out.trim()) uzakAdres = url.out.trim();
  }
  const resmiDepo = uzakAdres ? resmiDepoMu(uzakAdres) : null;

  // 4) yerel degisiklik varsa DUR (silme/saklama yok) — yalniz yarim kalmis bir guncellemeyi kanitlayip tamamlar
  const onceR = git(["rev-parse", "HEAD"]);
  if (onceR.kod !== 0) throw gitHatasi("rev-parse HEAD", onceR);
  const once = onceR.out.trim();
  const eskiSurum = surumOku(kok);
  let durum = durumOku();
  let tamamlanan = null;
  if (durum.izlenen.length) {
    const yarim = yarimKalaniBul(git, durum.girdiler);
    if (!yarim) throw yerelDegisiklikHatasi(durum.izlenen);
    yaz("Önceki güncelleme yarıda kalmış: " + yarim.dosyalar.length + " dosya zaten yeni sürümle birebir aynı (" + kisalt(yarim.dosyalar, 5) + "); tamamlanıyor…");
    for (const parca of parcala(yarim.dosyalar, PARCA)) {
      const r = git(["--literal-pathspecs", "add", "--"].concat(parca));
      if (r.kod !== 0) throw gitHatasi("add", r);
    }
    const ileri = git(["merge", "--ff-only", yarim.hedef]);
    if (ileri.kod !== 0) throw gitHatasi("merge --ff-only " + yarim.hedef.slice(0, 7), ileri);
    tamamlanan = yarim.dosyalar;
    durum = durumOku();
    if (durum.izlenen.length) throw yerelDegisiklikHatasi(durum.izlenen);
  }

  // 5) cek
  yaz("Otopilot güncelleniyor (" + dal + " ← " + uzak + "; şu an " + (eskiSurum ? eskiSurum + " · " : "") + once.slice(0, 7) + ")…");
  if (uzakAdres && resmiDepo === false) yaz("  Not: bu kopya resmî depodan değil, şuradan güncelleniyor: " + adresTemizle(uzakAdres) + " (resmî depo: " + DEPO_SAYFASI +
    "). Fork'tan kurduysan önce GitHub'da fork'unu 'Sync fork' ile eşitle; yoksa yenilikler buraya gelmez.");
  if (durum.izlenmeyen.length) yaz("  Not: izlenmeyen yeni dosyaların var (" + kisalt(durum.izlenmeyen, 5) + "); dokunulmaz, güncelleme bunları ezmez.");
  const cek = git(CEK_ARGS, { zamanAsimiMs: 180000 });
  let uyari = null;
  if (cek.hata || cek.kod !== 0) {
    const asil = cekmeHatasi(cek, kok);
    // git yarida birakti mi? (onceden temizdi: simdi izlenen degisiklik ya da yeni izlenmeyen dosya varsa yarim kalmistir)
    const sonra = git(["status", "--porcelain", "-z"]);
    if (sonra.kod === 0) {
      const s = durumAyristir(sonra.out);
      const eski = new Set(durum.izlenmeyen);
      const yeni = s.izlenen.concat(s.izlenmeyen.filter(y => !eski.has(y)));
      if (yeni.length) throw yarimKaldiHatasi(yeni, asil, cek.zamanAsimi ? "GitHub zamanında yanıt vermedi" : (hataSatiri(cek.err) || hataSatiri(cek.out) || asil.message));
    }
    if (!tamamlanan) throw asil;
    // yarim kalan kisim tamamlandi ama daha yenisi alinamadi: tamamlanani kaybetme, uyar ve ozete gec
    uyari = "GitHub'dan daha yeni değişiklik alınamadı (" + asil.message.replace(/\s*Hiçbir dosya değiştirilmedi\.?/g, "") + "); sonra npm run guncelle'yi tekrar çalıştır.";
  }
  const sonraR = git(["rev-parse", "HEAD"]);
  if (sonraR.kod !== 0) throw gitHatasi("rev-parse HEAD", sonraR, true);
  const sonra = sonraR.out.trim();

  const sonuc = { durum: sonra === once ? "zaten_guncel" : "guncellendi", once, sonra, dal, uzak, eskiSurum, bagimliliklarKuruldu: false, degisenDosyalar: [],
    uzakAdres: uzakAdres ? adresTemizle(uzakAdres) : null, resmiDepo, yarimTamamlanan: tamamlanan || [], uyari };

  // 6) yeni commit'ler, degisen dosyalar, bagimliliklar
  if (sonra !== once) {
    const aralik = once + ".." + sonra;
    const say = git(["rev-list", "--count", aralik]);
    const sayi = say.kod === 0 ? parseInt(say.out.trim(), 10) : NaN;
    const gunluk = git(["log", "--format=%h %s", "-n", "8", aralik]);
    yaz("✓ " + (Number.isFinite(sayi) ? sayi + " yeni commit" : "Yeni commit'ler") + " alındı:");
    if (gunluk.kod === 0) for (const s of gunluk.out.split(/\r?\n/).filter(Boolean)) yaz("    " + s);
    if (Number.isFinite(sayi) && sayi > 8) yaz("    … ve " + (sayi - 8) + " tane daha");

    const fark = git(["diff", "--name-only", "-z", once, sonra]);
    const degisen = fark.kod === 0 ? sifirlaBol(fark.out) : null;
    sonuc.degisenDosyalar = degisen || [];
    // fark okunamazsa temkinli ol: paketleri yeniden kur
    if (degisen === null || degisen.includes("package-lock.json")) {
      yaz("package-lock.json değişti: bağımlılıklar yeniden kuruluyor (npm ci --ignore-scripts)…");
      const n = calistir("npm", NPM_ARGS, { cwd: kok, zamanAsimiMs: 600000 });
      if (n.hata || n.kod !== 0) throw npmHatasi(n, sonra.slice(0, 7));
      sonuc.bagimliliklarKuruldu = true;
      yaz("✓ Bağımlılıklar kuruldu.");
    }
  }

  // 7) ozet: surum, commit, changelog basligi
  const son = git(["log", "-1", "--format=%h %s"]);
  sonuc.commit = son.kod === 0 ? son.out.trim() : sonra.slice(0, 7);
  sonuc.surum = surumOku(kok);
  sonuc.changelogBasligi = changelogBasligi(kok);
  yaz((sonuc.durum === "zaten_guncel" ? "✓ Zaten güncel: " : "✓ Güncellendi: ") + "Otopilot" + (sonuc.surum ? " " + sonuc.surum : "") + " · commit " + sonuc.commit);
  if (sonuc.changelogBasligi) yaz("  Son değişiklik notu (CHANGELOG.md): " + sonuc.changelogBasligi);
  if (uyari) yaz("  Uyarı: " + uyari);
  if (sonuc.durum === "guncellendi") yaz("  Panel açıksa kapatıp yeniden aç (PANEL.bat ya da npm start).");
  if (!fs.existsSync(path.join(kok, "node_modules"))) yaz("  Uyarı: node_modules yok; paketleri kur: npm ci --ignore-scripts");
  return sonuc;
}

// ---------------------------------------------------------------- komut satiri
function yardim() {
  console.log("Kullanım: npm run guncelle");
  console.log("  Otopilot'u GitHub'daki son sürüme getirir (git pull --ff-only; package-lock.json değiştiyse npm ci --ignore-scripts).");
  console.log("  Yerel değişikliğin varsa durur ve hiçbir şeyi silmez. ZIP ile indirdiysen yapılacakları söyler.");
  console.log("  Çıkış kodları: 0 tamam/zaten güncel · 2 elle müdahale gerek · 3 internet/GitHub · 5 disk · 6 başka git işlemi sürüyor · 1 diğer");
}

function ana(argv) {
  const { konum, bayrak } = ortak.argumanCoz(argv, { mantik: ["yardim", "help"] });
  if (bayrak.yardim || bayrak.help || konum.includes("-h")) { yardim(); return; }
  guncelle();
}

if (require.main === module) {
  try { ana(process.argv.slice(2)); }
  catch (e) { ortak.bitir(e); }
}

module.exports = { guncelle, gercekCalistir, npmCagrisi, durumAyristir, zipYonergesi, changelogBasligi, surumOku, yolAnahtari,
  hataSatiri, cakisanDosyalar, adresTemizle, resmiDepoMu, yarimKalaniBul, TASINACAKLAR, ZIP_ADRESI, DEPO_SAYFASI };
