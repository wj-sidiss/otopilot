// PANEL: IS DURUMU, LISTE, DETAY, SAHNE/GORSEL OKUMA (SOZLESME 6.6). Yalniz okur; yazan yerler ayri modullerde.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ortak = require("./ortak");

// Sahne klasorundeki gorseller + stok video klipleri (video-bul.js: 00-stok-*.mp4). Render bunlari videoya koyar; panel listeler,
// onizler (/onizle, video/mp4) ve siler (gorsel-sil) — "bozuk, panelden sil" uyarisi klip icin de uygulanabilsin.
const GORSEL_UZ = /\.(jpe?g|png|webp|mp4)$/i;
const VIDEO_UZ = /\.mp4$/i;
const jsonSessiz = (p, v) => { try { return ortak.jsonOku(p, v); } catch (e) { return v; } };
const stat = p => { try { return fs.statSync(p); } catch (e) { return null; } };
const var_ = p => { const s = stat(p); return !!(s && s.isFile() && s.size > 0); };
const oku = p => { try { return fs.readFileSync(p, "utf8"); } catch (e) { return ""; } };
const sayiSirala = (a, b) => parseInt(a, 10) - parseInt(b, 10) || (a < b ? -1 : a > b ? 1 : 0);

function dizinBoyutu(dir, tavan) {
  let toplam = 0, n = 0;
  const yuru = d => {
    let g; try { g = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const x of g) {
      if (n++ > (tavan || 200000)) return;
      const p = path.join(d, x.name);
      if (x.isSymbolicLink()) continue;
      if (x.isDirectory()) yuru(p);
      else { const s = stat(p); if (s) toplam += s.size; }
    }
  };
  yuru(dir);
  return toplam;
}
// boyut onbellegi: liste her birkac saniyede sorgulaniyor, dizin gezmek pahali
const _boyut = new Map();
function boyutMB(dir, ttlMs) {
  const k = dir, simdi = Date.now();
  const e = _boyut.get(k);
  if (e && simdi - e.t < (ttlMs || 60000)) return e.mb;
  const mb = Math.round(dizinBoyutu(dir) / 1048576 * 10) / 10;
  _boyut.set(k, { t: simdi, mb });
  return mb;
}
const boyutuSifirla = dir => _boyut.delete(dir);

// --- ffprobe ile video gecerliligi (sonuc onbellekte) ---
// Liste her birkac saniyede sorgulandigi icin ffprobe LISTEDE arka planda calisir (panel donmasin); ilk sorguda
// sonuc bilinmiyorsa (undefined) boyuta guvenilir, ikinci sorguda gercek deger gelir. senkron=true: sonucu bekler (toplu uretim).
const _probe = new Map(), _probeSira = [];
let _probeAktif = 0;
const probeAnahtar = (dosya, st) => dosya + "|" + st.size + "|" + st.mtimeMs;
function probeSonucu(r) {
  if (r.error) return undefined;                          // ffprobe yok: olculemedi
  const n = parseFloat(String(r.stdout).trim());
  return r.status === 0 && n > 0 ? n : 0;
}
const probeArgs = dosya => ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", dosya];
function probeIsle() {
  while (_probeAktif < 2 && _probeSira.length) {
    const { dosya, anahtar } = _probeSira.shift();
    _probeAktif++;
    let cikti = "", bitti = false;
    const son = r => { if (bitti) return; bitti = true; _probeAktif--; _probe.set(anahtar, probeSonucu(r)); probeIsle(); };
    try {
      const p = require("child_process").spawn("ffprobe", probeArgs(dosya), { windowsHide: true });
      const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, 10000); if (t.unref) t.unref();
      p.stdout.on("data", d => cikti += d);
      p.on("error", e => { clearTimeout(t); son({ error: e }); });
      p.on("close", kod => { clearTimeout(t); son({ status: kod, stdout: cikti }); });
    } catch (e) { son({ error: e }); }
  }
}
function ffprobeSure(dosya, st, senkron) {
  const k = probeAnahtar(dosya, st);
  if (_probe.has(k)) return _probe.get(k);
  if (senkron) {
    let sonuc;
    try { sonuc = probeSonucu(spawnSync("ffprobe", probeArgs(dosya), { timeout: 10000, windowsHide: true, encoding: "utf8" })); } catch (e) { sonuc = undefined; }
    _probe.set(k, sonuc);
    return sonuc;
  }
  if (!_probeSira.some(x => x.anahtar === k)) { _probeSira.push({ dosya, anahtar: k }); probeIsle(); }
  return undefined;
}

// Final video: Videos/<is>.mp4 (.part ve -onizleme degil). {ad, mb, sureSn, gecerli} | null
function videoBilgisi(b, is, secenek) {
  const vd = path.join(b, "Videos");
  const p = path.join(vd, is + ".mp4");
  const st = stat(p);
  if (!st || !st.isFile()) return null;
  let partVar = false;
  try { partVar = fs.readdirSync(vd).some(x => /\.part(\.|$)/i.test(x) && x.startsWith(is)); } catch (e) {}
  const rs = jsonSessiz(path.join(b, "render-sonuc.json"), null);
  let sureSn = null, gecerli;
  if (rs && ortak.duzNesne(rs) && rs.boyutBayt === st.size && Number(rs.sureSn) > 0) { sureSn = Number(rs.sureSn); gecerli = true; }
  else {
    const s = st.size > 0 ? ffprobeSure(p, st, !!(secenek && secenek.senkron)) : 0;
    if (s === undefined) { gecerli = st.size > 1048576; }       // henuz olculmedi ya da ffprobe yok: boyuta guven
    else { gecerli = s > 0; sureSn = s > 0 ? Math.round(s * 10) / 10 : null; }
  }
  return { ad: is + ".mp4", mb: Math.round(st.size / 1048576), sureSn, gecerli: gecerli && !partVar };
}

// Ses parcalari: {parca: kanonik 0..N-1 sirayla kesintisiz mi, sayi}
function sesParcalari(b) {
  let adlar = [];
  try { adlar = fs.readdirSync(path.join(b, "Voice", "parts")).filter(x => /^\d+\.mp3$/.test(x)); } catch (e) {}
  const nolar = adlar.map(x => parseInt(x, 10)).sort((x, y) => x - y);
  return nolar;
}

// SOZLESME 2: zamanlama.json gecerlilik kurali
function sesDurumu(b, paragraflar) {
  const nolar = sesParcalari(b);
  const N = paragraflar.length;
  const zm = jsonSessiz(path.join(b, "Voice", "zamanlama.json"), null);
  let tamam = false, eski = false;
  if (N > 0) {
    if (zm && ortak.duzNesne(zm)) {
      const ozet = ortak.paragrafOzeti(paragraflar);
      const dosyalar = Array.isArray(zm.paragraflar) ? zm.paragraflar : [];
      const hepsiVar = dosyalar.length > 0 && dosyalar.every(p => p && p.dosya && var_(path.join(b, "Voice", p.dosya)));
      tamam = zm.metinOzeti === ozet && hepsiVar && zm.paragrafSayisi === N;
      eski = zm.metinOzeti !== ozet;
    } else {
      // eski is (zamanlama.json yok): parts 0..N-1 kesintisiz mi
      tamam = nolar.length === N && nolar.every((x, i) => x === i);
    }
  }
  return { tamam, eski, sesParca: nolar.length, sesBeklenen: N, zm };
}

function gorselSayilari(b) {
  let gorsel = 0, sahne = 0;
  const vis = path.join(b, "Visuals");
  try {
    for (const d of fs.readdirSync(vis, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith("_")) continue;
      const n = fs.readdirSync(path.join(vis, d.name)).filter(x => GORSEL_UZ.test(x)).length;
      if (n > 0) { gorsel += n; sahne++; }
    }
  } catch (e) {}
  return { gorsel, sahne };
}

function altyaziDosyaVar(b) {
  try { return fs.readdirSync(path.join(b, "Voice")).some(x => /^ALTYAZI-[A-Za-z]{2}\.txt$/.test(x) && var_(path.join(b, "Voice", x))); }
  catch (e) { return false; }
}

// Konu okuma: {konu, bozuk, hata}
function konuOku(is) {
  try { return { konu: ortak.konuHam(is), bozuk: false, hata: null }; }
  catch (e) {
    if (e instanceof ortak.OrtakHata && (e.kod === "konu_bozuk" || e.kod === "konu_gecersiz"))
      return { konu: null, bozuk: true, hata: { mesaj: e.message, satir: e.satir || null, sutun: e.sutun || null } };
    throw e;
  }
}

// --- bir isin ozeti (GET /api/isler satiri) ---
// canli: calistirici.durumuAl(is) -> {durum,...} | null
function isOzeti(is, canli, secenek) {
  secenek = secenek || {};
  const b = ortak.isDizin(is);
  const k = konuOku(is);
  const konu = k.konu;
  const metin = oku(path.join(b, "Voice", "SESLENDIRME-TAM-METIN.txt"));
  const paragraflar = ortak.paragraflaraBol(metin);
  const kelime = metin.split(/\s+/).filter(Boolean).length;
  let dil = (konu && konu.dil) || (konu && typeof konu.ses === "string" && /^[a-z]{2}[-_]/i.test(konu.ses) ? konu.ses.slice(0, 2).toLowerCase() : null);
  if (!dil) { try { dil = ortak.ayarOku().dil || "en"; } catch (e) { dil = "en"; } }
  const ses = sesDurumu(b, paragraflar);
  const g = gorselSayilari(b);
  const video = videoBilgisi(b, is);
  const durumDosya = jsonSessiz(path.join(b, "durum.json"), null);
  const sonKayit = durumDosya && durumDosya.son ? durumDosya.son : null;
  // onay_bekliyor: panel yeniden başlasa da durum.json'daki onay beklemesi geçerlidir (onayla() oradan sürdürür); listede "yeni"ye
  // düşerse kullanıcı beklemeyi fark etmez ve arayüzdeki onay paneline hiç ulaşamaz
  let durum = canli && canli.durum ? canli.durum : (sonKayit && sonKayit.durum && ["bitti", "hata", "durduruldu", "onay_bekliyor"].includes(sonKayit.durum) ? sonKayit.durum : null);
  if (!durum) durum = video && video.gecerli ? "bitti" : "yeni";
  let format = "long";
  if (konu) format = konu.format === "reels" ? "reels" : konu.format === "tiktok" ? "tiktok" : konu.format === "short" || konu.aspect === "9:16" ? "short" : "long";
  const dakika = ses.zm && ses.zm.toplamSn > 0 ? Math.round(ses.zm.toplamSn / 60 * 10) / 10
    : kelime ? Math.round(kelime / ortak.kelimeHizi(dil) * 10) / 10 : 0;
  const vsVar = var_(path.join(b, "vs-tanim.json")) || var_(path.join(b, "vs.json"));
  const kst = stat(b);
  let guncelleme = kst ? kst.mtimeMs : 0;
  for (const f of ["konu.json", "durum.json", "Voice/SESLENDIRME-TAM-METIN.txt", "Voice/zamanlama.json", "Visuals/manifest.json", "render-sonuc.json"]) {
    const s = stat(path.join(b, f)); if (s && s.mtimeMs > guncelleme) guncelleme = s.mtimeMs;
  }
  const o = {
    ad: is, baslik: (konu && konu.baslik_en) || is, tip: vsVar ? "vs" : "video", format, dil,
    konuVar: !!konu, konuBozuk: k.bozuk, konuHata: k.hata,
    senaryo: metin.trim().length >= 50, kelime, dakika, trAlt: altyaziDosyaVar(b),
    gorsel: g.gorsel, sahne: g.sahne, sesParca: ses.sesParca, sesBeklenen: ses.sesBeklenen, sesTamam: ses.tamam,
    video, kapak: var_(path.join(b, "Videos", is + "-kapak.jpg")), yayinPaketi: var_(path.join(b, "YAYIN-PAKETI.md")),
    durum, sonHata: sonKayit && sonKayit.hata ? sonKayit.hata : null,
    olusturma: kst ? Math.round(kst.birthtimeMs || kst.ctimeMs) : 0, guncelleme: Math.round(guncelleme),
  };
  // Dizin boyutu pahali (olculdu: 150 is x ~100 dosya = ~4 sn, olay dongusunu tikar). Calisan isin boyutu hizli degisir,
  // bosta duran isinki degismez: bosta olanlar icin uzun omurlu onbellek (panelin kendi yazmalari ve is bitisi onbellegi sifirlar).
  if (!secenek.boyutsuz) {
    const sicak = !!(canli && canli.durum);
    o.tmpMB = boyutMB(path.join(b, "_tmp"), sicak ? 20000 : 180000);
    o.toplamMB = boyutMB(b, sicak ? 60000 : 600000);
  }
  return o;
}

function isListesi(canliFn, secenek) {
  let adlar = [];
  try {
    adlar = fs.readdirSync(ortak.uretimDizini(), { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith("_") && ortak.guvenliAd(d.name)).map(d => d.name);
  } catch (e) {}
  const liste = [];
  for (const ad of adlar) {
    try { liste.push(isOzeti(ad, canliFn ? canliFn(ad) : null, secenek)); } catch (e) { /* tek is bozuksa liste bozulmasin */ }
  }
  liste.sort((a, b) => b.guncelleme - a.guncelleme);
  return liste;
}

// --- is detayi (GET /api/is-detay) ---
const DOSYA_HARITASI = {
  senaryo: "Voice/SESLENDIRME-TAM-METIN.txt", iddia: "IDDIA-RAPORU.md", baslik: "BASLIK-VE-ETIKETLER.md", atif: "ATIF.txt",
  yayin: "YAYIN-PAKETI.md", bolumler: "bolumler.txt", srt: "altyazi.srt", manifest: "Visuals/manifest.json",
  zamanlama: "Voice/zamanlama.json", renderSonuc: "render-sonuc.json",
  // senaryo betigi hedef sureye ulasamayinca metni buraya kaydeder ve cikis 4 verir (arayuz "kabul et / duzenle" sunar)
  senaryoYarim: "Voice/SESLENDIRME-TAM-METIN-yarim.txt", yayinDurum: "yayin-durum.json",
};

// Shorts kesme ciktilari: uretim/<is>/Shorts/NN-ad.mp4 (.part ve bos dosya sayilmaz). [{ad, mb}]
function shortsListesi(is) {
  const d = path.join(ortak.isDizin(is), "Shorts");
  let adlar = [];
  try { adlar = fs.readdirSync(d); } catch (e) { return []; }
  const out = [];
  for (const ad of adlar.sort(sayiSirala)) {
    if (!/\.mp4$/i.test(ad) || /\.part\./i.test(ad)) continue;
    const st = stat(path.join(d, ad));
    if (st && st.isFile() && st.size > 0) out.push({ ad, mb: Math.round(st.size / 1048576 * 10) / 10 });
  }
  return out;
}

function isDetay(is, canli, ayar, diskEsikGB) {
  const b = ortak.isDizin(is);
  const ozet = isOzeti(is, canli);
  const k = konuOku(is);
  const dosyalar = {};
  for (const [ad, rel] of Object.entries(DOSYA_HARITASI)) dosyalar[ad] = var_(path.join(b, rel));
  dosyalar.altyazi = altyaziDosyaVar(b);
  dosyalar.kapak = ozet.kapak;
  dosyalar.onizleme = var_(path.join(b, "Videos", is + "-onizleme.mp4"));
  const shorts = shortsListesi(is);
  dosyalar.shorts = shorts.length;
  const uyarilar = [];
  const metin = oku(path.join(b, "Voice", "SESLENDIRME-TAM-METIN.txt"));
  const paragraflar = ortak.paragraflaraBol(metin);
  const ozetSha = paragraflar.length ? ortak.paragrafOzeti(paragraflar) : null;
  const zm = jsonSessiz(path.join(b, "Voice", "zamanlama.json"), null);
  const man = jsonSessiz(path.join(b, "Visuals", "manifest.json"), null);
  if (zm && zm.metinOzeti && ozetSha && zm.metinOzeti !== ozetSha)
    uyarilar.push({ kod: "ses_eski", mesaj: "Senaryo seslendirmeden sonra değişmiş; seslendirmeyi yeniden yap." });
  if (man && man.kaynakSenaryoSha1 && ozetSha && man.kaynakSenaryoSha1 !== ozetSha)
    uyarilar.push({ kod: "gorsel_eski", mesaj: "Görseller eski senaryoya göre bulunmuş; görselleri yenile." });
  if (zm && Math.abs(Number(zm.sapmaYuzde)) > 15)
    uyarilar.push({ kod: "hedef_sapma", mesaj: "Anlatım süresi hedeften %" + Math.abs(Math.round(zm.sapmaYuzde)) + " " + (zm.sapmaYuzde < 0 ? "kısa" : "uzun") + " (" + Math.round(zm.toplamSn) + " sn / hedef " + Math.round(zm.hedefSn) + " sn)." });
  if (k.bozuk) uyarilar.push({ kod: "konu_bozuk", mesaj: k.hata.mesaj });
  let etkin = null;
  if (!k.bozuk && k.konu) { try { etkin = ortak.konuBirlestir(k.konu, ayar || ortak.ayarOku(), is); } catch (e) { uyarilar.push({ kod: "konu_bozuk", mesaj: e.message }); } }
  if (etkin && (etkin.kanal === "KANALIM" || !etkin.kanal)) uyarilar.push({ kod: "kanal_varsayilan", mesaj: "Kanal adı hâlâ KANALIM; videoda bu yazı çıkar." });
  const bos = ortak.diskBosGB(ortak.uretimDizini());
  if (bos !== null && bos < (diskEsikGB != null ? diskEsikGB : 5)) uyarilar.push({ kod: "disk_az", mesaj: "Diskte yalnızca " + bos + " GB boş yer kaldı." });
  if (ozet.video && ozet.video.gecerli) {
    const vs = stat(path.join(b, "Videos", is + ".mp4"));
    let yeni = 0;
    for (const f of ["Voice/SESLENDIRME-TAM-METIN.txt", "Voice/zamanlama.json", "Visuals/manifest.json", "konu.json"]) {
      const s = stat(path.join(b, f)); if (s && s.mtimeMs > yeni) yeni = s.mtimeMs;
    }
    if (vs && yeni > vs.mtimeMs + 1000) uyarilar.push({ kod: "video_eski", mesaj: "Video, senaryo/ses/görsel/ayarlardan sonra yeniden kurulmamış." });
  }
  const dj = jsonSessiz(path.join(b, "durum.json"), null);
  return { ozet, konu: k.konu, konuHata: k.hata, durum: dj || null, dosyalar, uyarilar };
}

// --- sahneler / gorseller (manifest + disk) ---
function sahneKlasorleri(b) {
  const vis = path.join(b, "Visuals");
  let ds = [];
  try { ds = fs.readdirSync(vis, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith("_")).map(d => d.name); } catch (e) {}
  return ds.sort(sayiSirala);
}
function dizindekiGorseller(b, klasor) {
  try { return fs.readdirSync(path.join(b, "Visuals", klasor)).filter(x => GORSEL_UZ.test(x)).sort(sayiSirala); } catch (e) { return []; }
}
// Stok video kayitlari (manifeste girmez): "klasor/ad" -> kayit
function videoKayitlari(b) {
  const l = jsonSessiz(path.join(b, "Visuals", "video-atif.json"), []);
  const m = {};
  for (const g of Array.isArray(l) ? l : []) if (g && typeof g.dosya === "string") m[g.dosya.replace(/\\/g, "/")] = g;
  return m;
}
// Liste satiri: manifest kaydi (gorsel) ya da video-atif.json kaydi (klip); klipte video:true (arayuz <video> ile onizler)
function gorselSatiri(ad, g, vk) {
  const o = { ad, kaynak: g.kaynak || null, lisans: g.lisans || null, atif: g.atif || null };
  if (VIDEO_UZ.test(ad)) { o.video = true; o.kaynak = (vk && vk.kaynak) || o.kaynak; o.lisans = (vk && vk.lisans) || o.lisans; o.atif = (vk && vk.atif) || o.atif; }
  return o;
}
function sahneler(is) {
  const b = ortak.isDizin(is);
  const man = jsonSessiz(path.join(b, "Visuals", "manifest.json"), null);
  const zm = jsonSessiz(path.join(b, "Voice", "zamanlama.json"), null);
  const paragraflar = ortak.paragraflaraBol(oku(path.join(b, "Voice", "SESLENDIRME-TAM-METIN.txt")));
  const zp = zm && Array.isArray(zm.paragraflar) ? zm.paragraflar : [];
  const sure = pl => {
    if (!pl || !pl.length || !zp.length) return null;
    const a = zp.find(x => x.no === pl[0]), z = zp.find(x => x.no === pl[pl.length - 1]);
    if (!a || !z) return null;
    return Math.round((a.baslangicSn !== undefined && z.baslangicSn !== undefined ? z.baslangicSn + z.sureSn - a.baslangicSn : 0) * 10) / 10;
  };
  const metin160 = pl => (pl || []).map(i => paragraflar[i] || "").join(" ").trim().slice(0, 160);
  const kaynakMap = {};
  const vk = videoKayitlari(b);
  const out = [];
  if (man && Array.isArray(man.sahneler)) {
    for (const s of man.sahneler) {
      const klasor = s.klasor;
      const diskte = dizindekiGorseller(b, klasor);
      const kayit = {};
      for (const g of s.gorseller || []) kayit[path.basename(String(g.dosya || ""))] = g;
      kaynakMap[klasor] = true;
      out.push({
        no: s.no, klasor, paragraflar: s.paragraflar || [], metin: metin160(s.paragraflar), sureSn: sure(s.paragraflar),
        aramalar: s.aramalar || [], durum: diskte.length ? (s.durum || "tamam") : "eksik",
        gorseller: diskte.map(ad => gorselSatiri(ad, kayit[ad] || {}, vk[klasor + "/" + ad])),
      });
    }
  }
  // manifestte olmayan ama diskte duran klasorler (eski isler / elle eklenenler)
  for (const klasor of sahneKlasorleri(b)) {
    if (kaynakMap[klasor]) continue;
    const diskte = dizindekiGorseller(b, klasor);
    if (!diskte.length) continue;
    out.push({ no: parseInt(klasor, 10) || out.length + 1, klasor, paragraflar: [], metin: "", sureSn: null, aramalar: [],
      durum: "tamam", gorseller: diskte.map(ad => gorselSatiri(ad, {}, vk[klasor + "/" + ad])) });
  }
  out.sort((a, c) => a.no - c.no);
  return out;
}
// Manifestin sahne disi bilgileri: lisans uyarilari (CC BY-SA vb.) ve kaynak hatalari ({wikimedia:2, openverse:"kapali (429)"})
function manifestNotlari(is) {
  const man = jsonSessiz(path.join(ortak.isDizin(is), "Visuals", "manifest.json"), null);
  const dizi = x => (Array.isArray(x) ? x.filter(s => typeof s === "string" && s.trim()).map(s => s.slice(0, 300)) : []);
  const hatalar = {};
  if (man && ortak.duzNesne(man.kaynakHatalari))
    for (const [k, v] of Object.entries(man.kaynakHatalari)) if (typeof v === "number" || typeof v === "string") hatalar[k] = v;
  return { uyarilar: dizi(man && man.uyarilar), kaynakHatalari: hatalar };
}
function gorseller(is) {
  const b = ortak.isDizin(is);
  const man = jsonSessiz(path.join(b, "Visuals", "manifest.json"), null);
  const kayit = {};
  if (man && Array.isArray(man.sahneler))
    for (const s of man.sahneler) for (const g of s.gorseller || []) kayit[s.klasor + "/" + path.basename(String(g.dosya || ""))] = g;
  const vk = videoKayitlari(b);
  const out = [];
  for (const klasor of sahneKlasorleri(b)) for (const ad of dizindekiGorseller(b, klasor)) {
    const g = kayit[klasor + "/" + ad] || {};
    out.push(Object.assign({ sahne: klasor }, gorselSatiri(ad, g, vk[klasor + "/" + ad]), { en: g.en || null, boy: g.boy || null }));
  }
  return out;
}

// Panel yeniden basladiktan sonra bile okunabilen son gunluk: uretim/<is>/_log/<damga>-<tur>.log (en yenisi, son N satir)
function sonGunluk(is, satir) {
  const dizin = path.join(ortak.isDizin(is), "_log");
  let dosyalar = [];
  try { dosyalar = fs.readdirSync(dizin).filter(x => /^\d{8}-\d{6}-.*\.log$/.test(x)).sort(); } catch (e) {}
  if (!dosyalar.length) return { dosya: null, satirlar: [] };
  const ad = dosyalar[dosyalar.length - 1];
  const sinir = Math.max(1, Math.min(2000, Number(satir) || 200));
  const tum = oku(path.join(dizin, ad)).split(/\r?\n/);
  if (tum.length && tum[tum.length - 1] === "") tum.pop();
  const ilk = Math.max(0, tum.length - sinir);
  return { dosya: ad, kesildi: ilk > 0, satirlar: tum.slice(ilk).map((t, i) => ({ n: ilk + i + 1, t })) };
}

module.exports = { isOzeti, isListesi, isDetay, sonGunluk, sahneler, gorseller, videoBilgisi, sesDurumu, konuOku, boyutMB, boyutuSifirla,
  dizinBoyutu, sahneKlasorleri, DOSYA_HARITASI, var_, oku, jsonSessiz, GORSEL_UZ, VIDEO_UZ, altyaziDosyaVar, shortsListesi, manifestNotlari };
