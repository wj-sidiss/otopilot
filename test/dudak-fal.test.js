// fal.ai dudak senkronu sağlayıcısı: sahte fetch ile kuyruk akışı, hata kodları, adres/indirme güvenliği. Ağa ve paraya dokunmaz.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const F = require("../dudak-fal.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fal-"));
const video = path.join(tmp, "v.mp4"), ses = path.join(tmp, "s.m4a");
fs.writeFileSync(video, Buffer.from("videoverisi")); fs.writeFileSync(ses, Buffer.from("sesverisi"));
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(2000, 1)]);
const yanit = (govde, durum = 200) => ({ ok: durum < 400, status: durum, json: async () => govde, arrayBuffer: async () => (Buffer.isBuffer(govde) ? govde : MP4) });

function sahte(opts = {}) {
  const cagri = [];
  const f = async (url, o = {}) => {
    cagri.push({ url, o });
    if (o.method === "POST") return opts.gonder || yanit({ request_id: "r1", status_url: "https://queue.fal.run/fal-ai/latentsync/requests/r1/status", response_url: "https://queue.fal.run/fal-ai/latentsync/requests/r1" });
    if (/\/status$/.test(url)) return yanit({ status: cagri.filter(c => /\/status$/.test(c.url)).length < 2 ? "IN_PROGRESS" : "COMPLETED" });
    if (/requests\/r1$/.test(url)) return yanit({ video: { url: opts.sonucUrl || "https://v3.fal.media/files/x/out.mp4" } });
    return yanit(MP4);
  };
  f.cagri = cagri;
  return f;
}

test("anahtar yok / dosya yok acik hata", async () => {
  await assert.rejects(F.uret({ video, ses, cikti: path.join(tmp, "o.mp4") }, { anahtar: "" }), /FAL_KEY tanımlı değil/);
  await assert.rejects(F.uret({ video: path.join(tmp, "yok.mp4"), ses, cikti: "x" }, { anahtar: "K" }), /Video yok/);
});

test("tam akis: data URI + Key basligi, yoklama, mp4 indirilir; sahte mp4 reddedilir", async () => {
  const f = sahte(), cikti = path.join(tmp, "k", "o.mp4");
  const r = await F.uret({ video, ses, cikti }, { anahtar: "GIZLI", fetch: f, bekle: async () => {}, yoklamaMs: 1 });
  assert.equal(r, cikti); assert.equal(fs.readFileSync(cikti).length, MP4.length); assert.ok(!fs.existsSync(cikti + ".part"));
  const post = f.cagri[0];
  assert.equal(post.o.headers.Authorization, "Key GIZLI"); assert.equal(post.url, "https://queue.fal.run/fal-ai/latentsync");
  const govde = JSON.parse(post.o.body);
  assert.match(govde.video_url, /^data:video\/mp4;base64,/); assert.match(govde.audio_url, /^data:audio\/mp4;base64,/);
  const kotu = sahte(); const f2 = async (u, o) => (/out\.mp4$/.test(u) ? { ok: true, status: 200, arrayBuffer: async () => Buffer.from("html hata sayfasi".repeat(100)) } : kotu(u, o));
  await assert.rejects(F.uret({ video, ses, cikti: path.join(tmp, "b.mp4") }, { anahtar: "K", fetch: f2, bekle: async () => {}, yoklamaMs: 1 }), /geçerli bir mp4 değil/);
});

test("401, bakiye ve kuyruk reddi ayri mesajlar", async () => {
  const dene = (gonder) => F.uret({ video, ses, cikti: path.join(tmp, "x.mp4") }, { anahtar: "K", fetch: sahte({ gonder }), bekle: async () => {}, yoklamaMs: 1 });
  await assert.rejects(dene(yanit({}, 401)), /anahtarı reddedildi/);
  await assert.rejects(dene(yanit({ detail: "Insufficient balance" }, 403 + 0)), /anahtarı reddedildi|bakiye/);
  await assert.rejects(dene(yanit({ detail: "insufficient credit" }, 422)), /bakiyesi yetersiz/);
  await assert.rejects(dene(yanit({ hata: "x" }, 500)), /kabul etmedi/);
});

test("guvenlik: fal disi durum/sonuc/video adresi reddedilir (SSRF)", async () => {
  const ayar = { anahtar: "K", bekle: async () => {}, yoklamaMs: 1 };
  const kotuDurum = sahte({ gonder: yanit({ request_id: "r1", status_url: "https://evil.example.com/s", response_url: "https://queue.fal.run/x" }) });
  await assert.rejects(F.uret({ video, ses, cikti: path.join(tmp, "g1.mp4") }, { ...ayar, fetch: kotuDurum }), /Beklenmeyen fal adresi/);
  await assert.rejects(F.uret({ video, ses, cikti: path.join(tmp, "g2.mp4") }, { ...ayar, fetch: sahte({ sonucUrl: "https://evil.example.com/out.mp4" }) }), /alan adı dışında/);
  await assert.rejects(F.uret({ video, ses, cikti: path.join(tmp, "g3.mp4") }, { ...ayar, fetch: sahte({ sonucUrl: "http://v3.fal.media/out.mp4" }) }), /alan adı dışında/);
  assert.ok(F.IZINLI_HOST.test("v3.fal.media") && F.IZINLI_HOST.test("queue.fal.run") && !F.IZINLI_HOST.test("fal.media.evil.com") && !F.IZINLI_HOST.test("notfal.media"));
});

test("is basarisiz: FAILED durumu acik hata; dataUri bilinmeyen uzantiyi reddeder", async () => {
  const f = async (u, o = {}) => o.method === "POST" ? yanit({ request_id: "r1", status_url: "https://queue.fal.run/a/status", response_url: "https://queue.fal.run/a" }) : yanit({ status: "FAILED", error: "no face" });
  await assert.rejects(F.uret({ video, ses, cikti: path.join(tmp, "f.mp4") }, { anahtar: "K", fetch: f, bekle: async () => {}, yoklamaMs: 1 }), /başarısız oldu/);
  assert.throws(() => F.dataUri(path.join(tmp, "x.exe")), /Desteklenmeyen/);
});
