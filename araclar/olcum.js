#!/usr/bin/env node
// Olcum: bu makinede Otopilot'un agir adimlari ne kadar suruyor? Sonuc tekrarlanabilir bir JSON + docs/OLCUMLER.md satiri.
//   node araclar/olcum.js                 kodlama olcumu (ekran karti varsa GPU + her zaman CPU)
//   node araclar/olcum.js --ses           + VoxCPM2 yerel ses olcumu (kuruluysa; ilk calisma model yukleme dahil)
//   node araclar/olcum.js --belgeye       sonucu olcumler/ klasorune yazar ve docs/OLCUMLER.md tablosuna ekler
//
// NE OLCULUR (adil karsilastirma icin sabit): 20 sn, 1080x1920, 30 fps, gurultulu test goruntusu (testsrc2 + zamansal gurultu:
// gercek fotograf/klip kadar zor kodlanir). Otopilot'un final kodlayici ayarlariyla (CPU: libx264 medium crf 20; NVIDIA: h264_nvenc p4 cq 20).
// Sonuc "gercek zaman orani": 2.0x = 20 sn video 10 sn'de kodlandi. Tam video suresi bunun yaninda gorsel indirme ve sesten olusur.
// Kisisel veri yazilmaz: yalniz islemci/ekran karti modeli, bellek, isletim sistemi, surumler.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const KOK = path.join(__dirname, "..");
const donanim = require(path.join(KOK, "lib", "donanim.js"));
const F = require(path.join(KOK, "lib", "render-ffmpeg.js"));
const SURE = 20;
const KAYNAK = `testsrc2=s=1080x1920:r=30:d=${SURE}`;
const SUZGEC = "noise=alls=24:allf=t+u,format=yuv420p";

// Ayni olcum TEKRAR edilir ve ortanca alinir: dizustunde isinma/guc modu tek olcumu 2 kata kadar oynatir (gozlendi: libx264 medium
// ayni makinede 85 sn ve 107 sn). Ilk kosu 45 sn'yi asarsa 2 tekrar yeter. -> ortanca kosu + tum sureler
function kodlamaOlc(argv, etiket, tekrar) {
  const n = tekrar || 3, kosular = [];
  for (let i = 0; i < n; i++) {
    const k = kodlamaTek(argv, etiket);
    if (!k.ok) return k;
    kosular.push(k);
    if (i === 0 && k.saniye > 45) { kosular.push(kodlamaTek(argv, etiket)); break; }
  }
  const sirali = kosular.filter(k => k.ok).sort((a, b) => a.saniye - b.saniye);
  const orta = sirali[Math.floor((sirali.length - 1) / 2)];
  return Object.assign({}, orta, { kosular: kosular.map(k => k.saniye) });
}
function kodlamaTek(argv, etiket) {
  const cikti = path.join(os.tmpdir(), `otopilot-olcum-${process.pid}-${etiket}.mp4`);
  const t0 = process.hrtime.bigint();
  const r = spawnSync(F.ffmpegYolu(), ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", KAYNAK, "-vf", SUZGEC, ...argv, "-an", cikti],
    { encoding: "utf8", windowsHide: true, timeout: 15 * 60 * 1000 });
  const sn = Number(process.hrtime.bigint() - t0) / 1e9;
  let boyutMB = null;
  try { boyutMB = Math.round(fs.statSync(cikti).size / 1048576 * 10) / 10; fs.unlinkSync(cikti); } catch (e) { /* yok */ }
  if (r.status !== 0) return { etiket, ok: false, hata: String(r.stderr || "").split("\n").filter(Boolean).slice(-2).join(" | ") };
  return { etiket, ok: true, saniye: Math.round(sn * 10) / 10, gercekZamanOrani: Math.round(SURE / sn * 100) / 100, boyutMB };
}

function sesOlc(motor, ses) {
  const cikti = path.join(os.tmpdir(), `otopilot-olcum-${process.pid}-${motor}.mp3`);
  const metin = "Bu bir ölçüm cümlesidir. Otopilot, yerel ekran kartında bu cümleyi kaç saniyede seslendiriyor, onu ölçüyoruz.";
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(KOK, "seslendir.js"), "--test", cikti, "--motor", motor, ...(ses ? ["--ses", ses] : []), "--metin", metin],
    { encoding: "utf8", windowsHide: true, timeout: 10 * 60 * 1000, cwd: KOK });
  const sn = (Date.now() - t0) / 1000;
  if (r.status !== 0) return { ok: false, hata: (String(r.stdout || "") + String(r.stderr || "")).split("\n").filter(Boolean).slice(-2).join(" | ") };
  let sesSn = null;
  try { sesSn = Number(execFileSync(F.ffprobeYolu(), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", cikti], { encoding: "utf8" }).trim()); fs.unlinkSync(cikti); } catch (e) { /* yok */ }
  return { ok: true, motor: ses || motor, saniye: Math.round(sn * 10) / 10, sesSaniye: sesSn ? Math.round(sesSn * 10) / 10 : null,
    gercekZamanOrani: sesSn ? Math.round(sesSn / sn * 100) / 100 : null, not: "program/model yükleme dahil" };
}

const slug = s => String(s || "").toLowerCase().replace(/\(r\)|\(tm\)|laptop gpu|graphics|processor|cpu|@.*$/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
function ffmpegSurum() { try { return execFileSync(F.ffmpegYolu(), ["-version"], { encoding: "utf8" }).split("\n")[0].replace(/^ffmpeg version\s*/, "").split(" ")[0]; } catch (e) { return null; } }

const KISA = { nvidia: "NVENC", amd: "AMF", intel: "Quick Sync", apple: "VideoToolbox", mf: "MediaFoundation" };
const sesHucre = o => [o.ses && o.ses.ok ? `VoxCPM2 ${o.ses.saniye} sn → ${o.ses.sesSaniye} sn` : null, o.piper && o.piper.ok ? `Piper ${o.piper.saniye} sn → ${o.piper.sesSaniye} sn` : null].filter(Boolean).join(" · ") || "—";
function belgeSatiri(o) {
  const kart = (o.donanim.kartlar.find(k => k.marka === "nvidia") || o.donanim.kartlar[0] || {});
  const h = x => (x && x.ok ? `${x.saniye} sn (${x.gercekZamanOrani}x)` : "—");
  const dk = o.kodlama.filter(k => k.donanim && k.ok).map(k => `${KISA[k.etiket] || k.kodlayici} ${k.saniye} sn`).join(" · ") || "—";
  return `| ${o.tarih} | ${o.donanim.cpu.ad || "?"} | ${o.donanim.ram.toplamGB} GB | ${kart.ad ? kart.ad + (kart.vramGB ? " " + kart.vramGB + " GB" : "") : "yok"} | ${o.profil} | ${h(o.kodlama.find(k => k.etiket === "cpu"))} | ${h(o.kodlama.find(k => k.etiket === "cpu-hafif"))} | ${dk} | ${sesHucre(o)} | ${o.surum} |`;
}
function belgeyeEkle(satir) {
  const dosya = path.join(KOK, "docs", "OLCUMLER.md");
  const s = fs.readFileSync(dosya, "utf8");
  const bas = "<!-- OLCUM-BASLA -->", bit = "<!-- OLCUM-BIT -->";
  const i = s.indexOf(bas), j = s.indexOf(bit);
  if (i < 0 || j < i) throw new Error("docs/OLCUMLER.md içinde olçüm işaretleri yok");
  const govde = s.slice(i + bas.length, j).split(/\r?\n/).filter(l => l.trim().startsWith("|"));
  const ust = govde.slice(0, 2), satirlar = govde.slice(2).filter(l => l !== satir);
  satirlar.push(satir);
  fs.writeFileSync(dosya, s.slice(0, i + bas.length) + "\n" + [...ust, ...satirlar].join("\n") + "\n" + s.slice(j));
}

function main(argv) {
  const d = donanim.olc();
  const p = donanim.profilSec(d, n => process.env[n]);
  console.log(`Profil ${p.ad} · ${d.cpu.ad} · ${d.ram.toplamGB} GB · ${d.kartlar.map(k => k.ad).join(", ") || "ekran kartı yok"}`);
  console.log(`Kodlama ölçümü: ${SURE} sn, 1080x1920, 30 fps (Otopilot final ayarları)...`);
  const kodlama = [];
  // her calisan donanim kodlayicisi (yalniz secileni degil: "bu kart olmasaydi" sorusunu da cevaplar)
  for (const a of F.kodlayiciAdaylari()) {
    if (!F.kodlayiciDene(a)) continue;
    const g = kodlamaOlc(a.argv, a.marka); g.kodlayici = a.ad; g.donanim = true; kodlama.push(g);
    console.log(`  ${a.ad}: ` + (g.ok ? `${g.saniye} sn, ${g.gercekZamanOrani}x` : "HATA " + g.hata));
  }
  if (!kodlama.length) console.log("  donanım kodlayıcısı yok (NVENC/AMF/Quick Sync/VideoToolbox/MediaFoundation bulunamadı)");
  for (const [etiket, argv, ad] of [["cpu", F.CPU_SON, "libx264 medium"], ["cpu-hafif", F.CPU_SON_HAFIF, "libx264 veryfast (hafif mod)"]]) {
    const c = kodlamaOlc(argv, etiket); c.kodlayici = ad; kodlama.push(c);
    console.log(`  işlemci ${ad}: ` + (c.ok ? `${c.saniye} sn, ${c.gercekZamanOrani}x` : "HATA " + c.hata));
  }
  let ses = null, piper = null;
  if (argv.includes("--ses")) {
    console.log("VoxCPM2 ses ölçümü...");
    ses = sesOlc("voxcpm", "voxcpm:tok_anlatici");
    console.log("  " + (ses.ok ? `${ses.saniye} sn'de ${ses.sesSaniye} sn ses (${ses.not})` : "atlandı/hata: " + ses.hata));
    console.log("Piper (işlemci, internetsiz) ses ölçümü...");
    piper = sesOlc("piper", null);
    console.log("  " + (piper.ok ? `${piper.saniye} sn'de ${piper.sesSaniye} sn ses` : "atlandı (kurulu değil: node araclar/piper-kur.js) " + piper.hata));
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(KOK, "package.json"), "utf8"));
  const tarih = new Date().toISOString().slice(0, 10);
  const o = { tarih, surum: pkg.version, node: process.versions.node, ffmpeg: ffmpegSurum(), platform: `${os.type()} ${os.release()}`,
    profil: p.ad, donanim: { cpu: d.cpu, ram: { toplamGB: d.ram.toplamGB }, kartlar: d.kartlar.map(k => ({ marka: k.marka, ad: k.ad, vramGB: k.vramGB, surucu: k.surucu })) },
    olcum: { sure: SURE, kaynak: KAYNAK, suzgec: SUZGEC, tekrar: "ortanca (3 kosu; uzun kodlayicida 2)" }, kodlama, ses, piper };
  const satir = belgeSatiri(o);
  if (argv.includes("--belgeye")) {
    const dir = path.join(KOK, "olcumler");
    fs.mkdirSync(dir, { recursive: true });
    const ad = `${tarih}_${slug(d.cpu.ad)}_${slug((d.kartlar.find(k => k.marka === "nvidia") || d.kartlar[0] || {}).ad || "gpu-yok")}.json`;
    fs.writeFileSync(path.join(dir, ad), JSON.stringify(o, null, 2) + "\n");
    belgeyeEkle(satir);
    console.log(`\nYazıldı: olcumler/${ad} ve docs/OLCUMLER.md`);
  }
  console.log("\n" + satir);
  console.log("\nKendi ölçümünü paylaş: GitHub'da 'Ölçüm paylaş' şablonuyla bir konu aç ve yukarıdaki satırı ekle.");
  return 0;
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main, belgeSatiri, kodlamaOlc, SURE, KAYNAK, SUZGEC };
