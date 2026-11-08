// SES EFEKTI KATMANI: yalniz ince, kisa "tik" ve "din". Whoosh/swoosh/riser/boom/vurus YOK (yapay zeka videosunun en bilinen izi).
// Kurallar kodla zorlanir: yalniz izinli turler, en az 1,5 sn aralik, dakikada en cok 6 efekt, her efekt <= 0,6 sn.
// Seviye: ham tepe -6 dBFS; render hatti bu katmani konusmanin ~12 dB altina ve konusurken ayrica kisilmis olarak karistirir
// (lib/ses-denge.js efektBusu). Saf JS: ffmpeg gerekmez, ornekleme 48 kHz stereo 16 bit WAV.
"use strict";
const fs = require("fs");
const path = require("path");
const { OrtakHata, CIKIS } = require("./ortak");

const SR = 48000;
const IZINLI = Object.freeze(["tik", "din"]);
const YASAK = /^(whoosh|swoosh|swish|riser|boom|impact|hit|vurus|glitch|zap|sweep)/i;
const SINIR = Object.freeze({ enAzAralikSn: 1.5, dakikadaEnCok: 6, enCokToplam: 40 });
const hata = (kod, msg, cozum) => new OrtakHata(kod, msg, { cikis: CIKIS.GIRDI, cozum });

// deterministik gurultu (ayni olay = ayni ses)
const toz = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

function tikUret(guc) {
  const L = Math.round(0.06 * SR), a = new Float32Array(L); let lp = 0;
  for (let i = 0; i < L; i++) {
    const t = i / SR, n = toz(i + 7) - 0.5; lp += (n - lp) * 0.35;                    // yumusatilmis gurultu: sert "cizirti" degil
    const govde = Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t / 0.012);            // kisa tonal govde
    const tik = (n - lp) * Math.exp(-t / 0.004);                                        // ust bantli kisa tik
    a[i] = (0.55 * govde + 0.45 * tik) * Math.min(1, t / 0.0008);
  }
  return olcekle(a, 0.5 * guc);
}
function dinUret(guc) {
  const L = Math.round(0.55 * SR), a = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    const t = i / SR;
    const v = Math.sin(2 * Math.PI * 988 * t) + 0.28 * Math.sin(2 * Math.PI * 1976 * t) * Math.exp(-t / 0.08) + 0.08 * Math.sin(2 * Math.PI * 2964 * t) * Math.exp(-t / 0.04);
    a[i] = v * Math.exp(-t / 0.14) * Math.min(1, t / 0.004) * Math.min(1, (L - i) / (0.04 * SR));   // 4 ms girisi, 40 ms cikis: tiklama yok
  }
  return olcekle(a, 0.5 * guc);
}
function olcekle(a, tepe) { let m = 0; for (const x of a) m = Math.max(m, Math.abs(x)); const k = m ? tepe / m : 1; for (let i = 0; i < a.length; i++) a[i] *= k; return a; }

// olaylar: [{ t:sn, tur:"tik"|"din", guc:0.3-1 }]  -> temizlenmis liste (hata verir ya da uyari listesi doner)
function dogrula(olaylar, sureSn) {
  if (!Array.isArray(olaylar)) throw hata("efekt_liste", "sesEfektleri bir liste olmalı: [{\"t\": 3.2, \"tur\": \"din\"}]");
  if (olaylar.length > SINIR.enCokToplam) throw hata("efekt_cok", `En çok ${SINIR.enCokToplam} ses efekti olabilir (${olaylar.length}).`, "Efekti yalnız anlamlı anlara koy: başlık, rakam, bölüm geçişi.");
  const temiz = [], uyarilar = [];
  for (const o of olaylar) {
    const tur = String(o && o.tur || "").toLowerCase().trim(), t = Number(o && o.t);
    if (YASAK.test(tur)) throw hata("efekt_yasak_tur", `'${tur}' ses efekti yasak: whoosh/riser/boom yapay zekâ videosu gibi durur.`, "Yalnız 'tik' ya da 'din' kullan, ya da hiç efekt koyma.");
    if (!IZINLI.includes(tur)) throw hata("efekt_tur", `Bilinmeyen ses efekti türü: '${tur}' (izinli: ${IZINLI.join(", ")}).`);
    if (!Number.isFinite(t) || t < 0 || (sureSn && t > sureSn)) throw hata("efekt_zaman", `Efekt zamanı geçersiz: ${o && o.t} (0–${sureSn || "?"} sn).`);
    const guc = o.guc === undefined ? 1 : Number(o.guc);
    if (!(guc >= 0.3 && guc <= 1)) throw hata("efekt_guc", "Efekt gücü 0,3–1 arasında olmalı.");
    temiz.push({ t, tur, guc });
  }
  temiz.sort((a, b) => a.t - b.t);
  const kalan = [];
  for (const o of temiz) {                                  // seyreklik: cok yakin efekt atilir
    const onceki = kalan[kalan.length - 1];
    if (onceki && o.t - onceki.t < SINIR.enAzAralikSn) { uyarilar.push(`${o.t.toFixed(1)} sn'deki ${o.tur} atıldı (önceki efektten ${SINIR.enAzAralikSn} sn'den yakın).`); continue; }
    const sonDakika = kalan.filter(x => o.t - x.t < 60).length;
    if (sonDakika >= SINIR.dakikadaEnCok) { uyarilar.push(`${o.t.toFixed(1)} sn'deki ${o.tur} atıldı (dakikada en çok ${SINIR.dakikadaEnCok} efekt).`); continue; }
    kalan.push(o);
  }
  return { olaylar: kalan, uyarilar };
}

function pcmYaz(dosya, a) {
  const pcm = Buffer.alloc(a.length * 4);
  for (let i = 0; i < a.length; i++) { const v = Math.max(-32768, Math.min(32767, Math.round(a[i] * 32767))); pcm.writeInt16LE(v, i * 4); pcm.writeInt16LE(v, i * 4 + 2); }
  const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  fs.mkdirSync(path.dirname(path.resolve(dosya)), { recursive: true });
  fs.writeFileSync(dosya, Buffer.concat([h, pcm]));
}

// Efekt katmanini (toplam sureye kadar, sessiz zeminli) WAV olarak yazar. Donus: { cikti, olaylar, uyarilar }
function olustur(olaylar, sureSn, cikti) {
  if (!(sureSn > 0 && sureSn <= 3600)) throw hata("efekt_sure", "Toplam süre geçersiz.");
  const { olaylar: temiz, uyarilar } = dogrula(olaylar, sureSn);
  const N = Math.round(sureSn * SR), mix = new Float32Array(N);
  for (const o of temiz) {
    const ses = o.tur === "tik" ? tikUret(o.guc) : dinUret(o.guc), i0 = Math.round(o.t * SR);
    for (let i = 0; i < ses.length && i0 + i < N; i++) mix[i0 + i] += ses[i];
  }
  pcmYaz(cikti, mix);
  return { cikti: path.resolve(cikti), olaylar: temiz, uyarilar };
}

module.exports = { olustur, dogrula, tikUret, dinUret, IZINLI, SINIR, YASAK };
