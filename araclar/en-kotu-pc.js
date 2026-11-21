#!/usr/bin/env node
// "En kotu PC" uctan uca testi: GERCEK video-yap.js ile tam boyutlu (dikey) bir Shorts'u bastan sona kurar ve ciktiyi dogrular.
// Ag yok, ucret yok: ses ve gorseller sentetik (test/render-fikstur.js, ffmpeg lavfi). CI'da 1 cekirdek / 2 GB bellek / ekran karti yok
// bir konteynerde kosar (.github/workflows/en-kotu-pc.yml); yerelde de calisir:
//   node araclar/en-kotu-pc.js                         bu makinede
//   DONANIM_PROFIL=cok-dusuk VIDEO_KODEK=cpu node araclar/en-kotu-pc.js   zayif makineyi taklit et
//   ... --json-cikti sonuc.json                        ozet JSON'u dosyaya da yaz
// Cikis: 0 video gecerli · 1 video yok/bozuk/sure tutmuyor · 2 ffmpeg yok
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const KOK = path.join(__dirname, "..");
const fik = require(path.join(KOK, "test", "render-fikstur.js"));
const donanim = require(path.join(KOK, "lib", "donanim.js"));

async function main(argv) {
  if (!fik.ffmpegVarMi()) { console.log("✗ ffmpeg yok"); return 2; }
  const env = n => process.env[n];
  const d = donanim.olc({ kartlar: [] });          // ekran karti olcmeden (CI'da yok; yerelde kodlayici zaten kendisi dener)
  const p = donanim.renderKisiti(env);              // render'i belirleyen bellek profili (ekran kartindan bagimsiz)
  p.ad = p.profil;
  console.log(`Makine: ${d.cpu.cekirdek} çekirdek, ${d.ram.toplamGB} GB · render profili ${p.ad} (${p.neden})`);
  const kok = fik.ortamKur();
  const ozet = { tarih: new Date().toISOString(), cekirdek: d.cpu.cekirdek, bellekGB: d.ram.toplamGB, profil: p.ad,
    hafif: donanim.hafifRender(env), zamanCarpani: donanim.zamanCarpani(env), cozunurluk: donanim.cozunurlukOlcek(env) };
  let kod = 1;
  try {
    const t0 = Date.now();
    // ~30 sn'lik Shorts: 6 paragraf, 3 sahne x 2 dikey gorsel, gercek konusma (flite; yoksa sinus)
    const k = fik.isKur(kok, { ad: "en-kotu-pc", paragraf: 6, sahneBasina: 2, gorselBasina: 2, genislik: 1080, yukseklik: 1920,
      konu: { format: "short", intro: 0, outro: 0, markaKose: 0 } });
    ozet.hazirlikSn = Math.round((Date.now() - t0) / 100) / 10;
    ozet.anlatimSn = Math.round(k.toplam * 10) / 10;
    const t1 = Date.now();
    // RENDER_OLCEK=1: testlerin 0,25 kucultmesi YOK, gercek boyut (cok-dusuk profilde donanim 720p'yi kendisi secer)
    const r = await fik.betikCalistir("video-yap.js", [k.ad], { env: { RENDER_OLCEK: "1", VIDEO_KODEK: process.env.VIDEO_KODEK || "" }, zamanAsimiMs: 60 * 60 * 1000 });
    ozet.renderSn = Math.round((Date.now() - t1) / 100) / 10;
    ozet.cikis = r.kod;
    ozet.kodlayici = (/KODLAYICI: ([^\n]+)/.exec(r.stdout) || [])[1] || null;
    ozet.bellekModu = (/BELLEK: ([^\n]+)/.exec(r.stdout) || [])[1] || null;
    const mp4 = path.join(kok, k.ad, "Videos", k.ad + ".mp4");
    if (r.kod !== 0 || !fs.existsSync(mp4)) {
      ozet.hata = (r.stderr || r.stdout).split("\n").filter(Boolean).slice(-6).join(" | ");
      console.log("✗ video-yap başarısız (çıkış " + r.kod + "): " + ozet.hata);
    } else {
      const j = JSON.parse(execFileSync(require(path.join(KOK, "ff-yol.js")).ffprobe, ["-v", "error", "-print_format", "json", "-show_entries",
        "format=duration,size:stream=codec_type,width,height,codec_name,pix_fmt", mp4], { encoding: "utf8" }));
      const v = j.streams.find(s => s.codec_type === "video"), a = j.streams.find(s => s.codec_type === "audio");
      ozet.video = { genislik: v.width, yukseklik: v.height, kodek: v.codec_name, pix_fmt: v.pix_fmt, sureSn: Math.round(Number(j.format.duration) * 10) / 10,
        boyutMB: Math.round(Number(j.format.size) / 1048576 * 10) / 10, ses: !!a };
      const sorun = [];
      if (!(v.height > v.width)) sorun.push("dikey değil");
      if (v.height < 1280) sorun.push("çözünürlük " + v.width + "x" + v.height);
      if (!a) sorun.push("ses akışı yok");
      if (ozet.video.sureSn < k.toplam - 0.5) sorun.push(`süre ${ozet.video.sureSn} sn < anlatım ${ozet.anlatimSn} sn`);
      ozet.sorunlar = sorun;
      kod = sorun.length ? 1 : 0;
      console.log(`${kod ? "✗" : "✔"} ${v.width}x${v.height} ${v.codec_name}, ${ozet.video.sureSn} sn, ${ozet.video.boyutMB} MB · render ${ozet.renderSn} sn · ${ozet.kodlayici}` +
        (sorun.length ? " · SORUN: " + sorun.join(", ") : ""));
    }
  } finally { fik.temizle(kok); }
  const i = argv.indexOf("--json-cikti");
  if (i >= 0 && argv[i + 1]) fs.writeFileSync(argv[i + 1], JSON.stringify(ozet, null, 2) + "\n");
  console.log(JSON.stringify(ozet));
  return kod;
}
if (require.main === module) main(process.argv.slice(2)).then(k => { process.exitCode = k; }).catch(e => { console.error("HATA " + e.message); process.exitCode = 1; });
module.exports = { main };
