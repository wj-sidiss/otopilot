// Film lideri geri sayimi (5-4-3-2-1) — donen supurme, film greni, "dit" bipleri.
// Kullanim: node geri-sayim.js <cikti.mp4> [genislik] [yukseklik]
// Cikti once <cikti>.part.mp4'e yazilir, basariliysa yeniden adlandirilir (yarim dosya kalmaz).
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ortak = require("./lib/ortak");
const Y = require("./lib/yazi");

const FPS = 30, N = 5;                       // 5 saniye

function run(ff, a) {
  try {
    return execFileSync(ff, ["-y", "-hide_banner", "-loglevel", "error", ...a],
      { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1 << 26, timeout: 900000, windowsHide: true });
  } catch (e) {
    const err = (e.stderr || Buffer.alloc(0)).toString("utf8");
    const satir = err.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    throw new ortak.OrtakHata("ffmpeg", "Geri sayım üretilemedi: " + (satir[satir.length - 1] || e.message), {
      cikis: ortak.CIKIS.GENEL, detay: satir.slice(-8) });
  }
}

async function main() {
  const { konum } = ortak.argumanCoz(process.argv.slice(2), { deger: [] });
  const FF = require("./ff-yol").ffmpeg;
  const OUT = path.resolve(konum[0] || path.join(__dirname, "tmp-test", "geri-sayim.mp4"));
  const W = Number(konum[1] || 1920), H = Number(konum[2] || 1080);
  if (!(W >= 64 && H >= 64))
    throw new ortak.OrtakHata("girdi", "Geçersiz boyut: " + konum[1] + "x" + konum[2], { cikis: ortak.CIKIS.GIRDI });

  // HIZ: halka/supurme geq'u (piksel basina atan2/hypot/exp) yari cozunurlukte hesaplanir, sonra
  // buyutulur; halkalar zaten yumusak (gauss). Keskin carpi cizgileri, rakamlar ve film greni TAM
  // cozunurlukte sonradan cizilir. 1080p'de geq maliyetini 4'e boler.
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  const hw = Math.max(32, Math.round(W / 4) * 2), hh = Math.max(32, Math.round(H / 4) * 2);   // geq alani (cift)
  const hcx = Math.round(hw / 2), hcy = Math.round(hh / 2);
  const rOut = Math.round(Math.min(hw, hh) * 0.40);
  const rIn = Math.round(Math.min(hw, hh) * 0.28);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = path.join(path.dirname(OUT), "_gs");
  fs.mkdirSync(tmp, { recursive: true });

  // --- pixel aci: tepeden saat yonunde 0..2PI ---
  const A = `mod(atan2(X-${hcx},${hcy}-Y)+2*PI,2*PI)`;
  const P = `mod(T,1)*2*PI`;                    // her saniye bir tam tur
  const ring = (r, s) => `exp(-pow(hypot(X-${hcx},Y-${hcy})-${r},2)/${s})`;
  // supurulen sektor biraz daha aydinlik (gauss genislikleri yari cozunurluge gore 70/4 ve 45/4)
  const wedge = `lt(${A},${P})*0.10`;
  const base = (b) => `clip(${b} + 210*${ring(rOut, 18)} + 210*${ring(rIn, 11)} + 255*${wedge},0,255)`;

  const rakamlar = [5, 4, 3, 2, 1].map((n, i) => Y.drawtext({
    font: "kalin", metin: String(n), dizin: tmp, ad: "rakam-" + n, boyut: Math.round(H * 0.42), renk: "0xF2F2F2",
    x: "(w-text_w)/2", y: `(h-text_h)/2-${Math.round(H * 0.03)}`, // yari acik aralik [i, i+1): between() iki ucu da kapsar, sinir karesinde iki rakam ust uste biniyordu
    ekstra: `enable='gte(t,${i})*lt(t,${i + 1})'` }));
  const vf =
    `format=rgb24,` +
    `geq=r='${base(13)}':g='${base(13)}':b='${base(15)}',` +
    `scale=${W}:${H}:flags=bicubic,` +
    `drawbox=x=0:y=${cy - 2}:w=${W}:h=4:color=0xE8E8E8@0.7:t=fill,` +
    `drawbox=x=${cx - 2}:y=0:w=4:h=${H}:color=0xE8E8E8@0.7:t=fill,` +
    rakamlar.join(",") + "," +
    // film greni + hafif titresim + vinyet
    `noise=alls=14:allf=t,eq=contrast=1.12:brightness=-0.02,vignette=angle=PI/4.5,` +
    `format=yuv420p`;

  try {
    // --- SES: her saniyede kisa 1kHz "dit" ---
    const beep = path.join(tmp, "beep.wav");
    const gap = path.join(tmp, "gap.wav");
    run(FF, ["-f", "lavfi", "-i", "sine=frequency=1000:duration=0.07", "-af", "afade=t=out:st=0.05:d=0.02", "-ar", "48000", "-ac", "2", beep]);
    run(FF, ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "0.93", gap]);
    const lst = path.join(tmp, "seq.txt");
    const satirlar = [];
    for (let i = 0; i < N; i++) {
      satirlar.push("file '" + beep.replace(/\\/g, "/").replace(/'/g, "'\\''") + "'");
      satirlar.push("file '" + gap.replace(/\\/g, "/").replace(/'/g, "'\\''") + "'");
    }
    fs.writeFileSync(lst, satirlar.join("\n"), "utf8");
    const beeps = path.join(tmp, "beeps.wav");
    run(FF, ["-f", "concat", "-safe", "0", "-i", lst, "-c:a", "pcm_s16le", beeps]);

    // --- gerilim yukselisi (riser) geri sayim boyunca ---
    const riser = path.join(tmp, "riser.wav");
    run(FF, [
      "-f", "lavfi", "-i", `sine=frequency=55:duration=${N}`,
      "-f", "lavfi", "-i", `sine=frequency=110:duration=${N}`,
      "-f", "lavfi", "-i", `anoisesrc=d=${N}:c=brown:a=0.25`,
      "-filter_complex",
        `[0]volume=0.55[a];[1]volume=0.30,tremolo=f=2:d=0.35[b];` +
        `[2]lowpass=f=220,volume=0.40[c];` +
        `[a][b][c]amix=inputs=3:duration=longest,` +
        `volume='0.25+0.75*t/${N}':eval=frame,lowpass=f=900`,
      "-ar", "48000", "-ac", "2", riser]);

    // --- ses birlestir ---
    const aud = path.join(tmp, "ses.wav");
    // loudnorm ile yayin seviyesine getir — yoksa bip sesi duyulmuyor
    run(FF, ["-i", beeps, "-i", riser, "-filter_complex",
         "[0]volume=1.0[b];[1]volume=0.55[r];[b][r]amix=inputs=2:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11",
         "-ar", "48000", "-ac", "2", aud]);

    // --- video + ses (.part'a yaz, sonra yeniden adlandir) ---
    const part = OUT.replace(/(\.[^./\\]+)$/, ".part$1");
    try { fs.unlinkSync(part); } catch (e) { /* yok */ }
    run(FF, ["-f", "lavfi", "-i", `color=c=0x0D0D0D:s=${hw}x${hh}:r=${FPS}:d=${N}`,
         "-i", aud, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
         "-c:a", "aac", "-b:a", "192k", "-shortest", part]);
    fs.renameSync(part, OUT);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* kilitli */ }
  }
  console.log("Geri sayım üretildi: " + OUT);
}

if (require.main === module) main().catch(ortak.bitir);
module.exports = { main };
