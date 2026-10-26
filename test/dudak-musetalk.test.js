// MuseTalk sarmalayicisi: kurulum denetimi, GPU/torch uyumu (RTX 50 uyarisi), yaml + komut, sonuc kopyalama. MuseTalk/GPU gerektirmez (sahte).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const D = require("../dudak-musetalk.js");

function sahteKok() {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "mt-kok-"));
  fs.mkdirSync(path.join(kok, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(kok, "scripts", "inference.py"), "");
  fs.mkdirSync(path.join(kok, "models", "musetalkV15"), { recursive: true });
  fs.writeFileSync(path.join(kok, "models", "musetalkV15", "unet.pth"), "x");
  fs.writeFileSync(path.join(kok, "models", "musetalkV15", "musetalk.json"), "{}");
  return kok;
}
const torch = o => () => ({ status: 0, stdout: JSON.stringify(o) + "\n", stderr: "" });

test("kurulumKontrol: kok yok / yanlis klasor / agirlik eksik acik hatayla reddedilir", () => {
  assert.throws(() => D.kurulumKontrol(() => ""), /MUSETALK_KOK tanımlı değil/);
  assert.throws(() => D.kurulumKontrol(a => a === "MUSETALK_KOK" ? os.tmpdir() : ""), /scripts\/inference\.py yok/);
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "mt-bos-"));
  fs.mkdirSync(path.join(kok, "scripts")); fs.writeFileSync(path.join(kok, "scripts", "inference.py"), "");
  assert.throws(() => D.kurulumKontrol(a => a === "MUSETALK_KOK" ? kok : ""), /ağırlığı eksik/);
});

test("gpuKontrol: RTX 50 + eski torch (sm_120 yok) reddedilir; uyumlu torch ve RTX 40 kabul", () => {
  const eski = D.gpuKontrol("python", ".", torch({ s: "2.0.1+cu118", cuda: true, arch: ["sm_37", "sm_86", "sm_90"], kart: "NVIDIA GeForce RTX 5060 Laptop GPU" }));
  assert.equal(eski.ok, false); assert.match(eski.neden, /sm_120.*cu128/s);
  assert.equal(D.gpuKontrol("python", ".", torch({ s: "2.7.0+cu128", cuda: true, arch: ["sm_86", "sm_120"], kart: "NVIDIA GeForce RTX 5060" })).ok, true);
  assert.equal(D.gpuKontrol("python", ".", torch({ s: "2.0.1+cu118", cuda: true, arch: ["sm_86", "sm_89"], kart: "NVIDIA GeForce RTX 4070" })).ok, true);
  assert.match(D.gpuKontrol("python", ".", torch({ s: "2.0.1", cuda: false, arch: [], kart: "" })).neden, /GPU'suz/);
  assert.match(D.gpuKontrol("python", ".", () => ({ status: 1, stderr: "ModuleNotFoundError: torch" })).neden, /torch yuklenemedi/);
});

test("uret: uyumsuz GPU'da calismaz; uyumluda yaml yazar, komutu dogru kurar, sonucu cikti'ya kopyalar", () => {
  const kok = sahteKok(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mt-t-"));
  const video = path.join(tmp, "v.mp4"), ses = path.join(tmp, "s.m4a"), cikti = path.join(tmp, "k", "o.mp4");
  fs.writeFileSync(video, "v"); fs.writeFileSync(ses, "s");
  const env = a => a === "MUSETALK_KOK" ? kok : "";
  const eski = (cmd, args) => args[0] === "-c" ? torch({ s: "2.0.1", cuda: true, arch: ["sm_86"], kart: "RTX 5060" })() : { status: 0 };
  assert.throws(() => D.uret({ video, ses, cikti }, { env, calistir: eski, ffmpeg: "C:\\ff\\ffmpeg.exe" }), /bu makinede çalışamaz/);

  let komut = null, yamlIcerik = "";
  const iyi = (cmd, args, o) => {
    if (args[0] === "-c") return torch({ s: "2.7.0", cuda: true, arch: ["sm_120"], kart: "RTX 5060" })();
    komut = { cmd, args, cwd: o.cwd };
    yamlIcerik = fs.readFileSync(args[args.indexOf("--inference_config") + 1], "utf8");
    const sonuc = args[args.indexOf("--result_dir") + 1];
    fs.mkdirSync(path.join(sonuc, "v15"), { recursive: true });
    fs.writeFileSync(path.join(sonuc, "v15", "v_s.mp4"), "SENKRON");
    return { status: 0 };
  };
  const r = D.uret({ video, ses, cikti }, { env, calistir: iyi, ffmpeg: "C:\\ff\\ffmpeg.exe" });
  assert.equal(r, cikti); assert.equal(fs.readFileSync(cikti, "utf8"), "SENKRON");
  assert.equal(komut.cwd, kok); assert.deepEqual(komut.args.slice(0, 2), ["-m", "scripts.inference"]);
  assert.ok(komut.args.includes("v15") && komut.args.includes("--unet_model_path"));
  assert.match(yamlIcerik, /video_path: '.*v\.mp4'/); assert.match(yamlIcerik, /audio_path: '.*s\.m4a'/);
});

test("uret: MuseTalk hata kodu / ciktisizlik acik hata", () => {
  const kok = sahteKok(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mt-h-"));
  const video = path.join(tmp, "v.mp4"), ses = path.join(tmp, "s.m4a");
  fs.writeFileSync(video, "v"); fs.writeFileSync(ses, "s");
  const env = a => a === "MUSETALK_KOK" ? kok : "";
  const gpu = torch({ s: "2.7.0", cuda: true, arch: ["sm_120"], kart: "RTX 5060" });
  assert.throws(() => D.uret({ video, ses, cikti: path.join(tmp, "o.mp4") }, { env, ffmpeg: "ff.exe", calistir: (c, a) => a[0] === "-c" ? gpu() : { status: 1, stderr: "CUDA out of memory" } }), /MuseTalk başarısız.*out of memory/);
  assert.throws(() => D.uret({ video, ses, cikti: path.join(tmp, "o.mp4") }, { env, ffmpeg: "ff.exe", calistir: (c, a) => a[0] === "-c" ? gpu() : { status: 0 } }), /çıktı videosu üretmedi/);
  assert.throws(() => D.uret({ video: path.join(tmp, "yok.mp4"), ses, cikti: "x" }, { env, ffmpeg: "ff.exe", calistir: (c, a) => gpu() }), /Video yok/);
});
