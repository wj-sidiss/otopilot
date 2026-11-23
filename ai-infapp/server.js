'use strict';

/**
 * AI INFAPP - yerel panel sunucusu
 *
 * Sifir bagimlilik. Node 22+ (otopilot deposunun ortak kurali).
 *
 * ONEMLI: Bu otomasyon KENDI BASINA GORSEL URETMEZ ve stok gorsel kullanmaz.
 * Gorselin geldigi tek yer, kullanicinin Ayarlar bolumunden bagladigi
 * gorsel uretim API'sidir. Bagli API yoksa otomasyon sadece prompt verir.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const store = require('./src/store');
const wizard = require('./src/wizard');
const persona = require('./src/persona');
const life = require('./src/life');
const traits = require('./src/traits');
const promptcraft = require('./src/promptcraft');
const scenes = require('./src/scenes');
const reference = require('./src/reference');
const brief = require('./src/brief');
const welcome = require('./src/welcome');
const caption = require('./src/caption');
const output = require('./src/output');
const providers = require('./src/providers');
const upscalers = require('./src/upscalers');
const studios = require('./src/studios');
const kutuphane = require('./src/kutuphane');

// Panel (otopilot) bu sunucuyu AI_INFAPP_PORT ile baslatir; eski PORT degiskeni de calisir.
const PORT = Number(process.env.AI_INFAPP_PORT || process.env.PORT || 4200);
// Her yanita konan kimlik basligi: panel, 4200 portunda KIMIN dinledigini bununla ayirir (eski, korumasiz kopya bu basligi tasimaz).
const KIMLIK = 'ai-infapp/' + require('./package.json').version;
const PUBLIC_DIR = path.join(__dirname, 'public');

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
if (NODE_MAJOR < 22) {
  console.error(`\n[HATA] Node 22+ gerekli (su an: ${process.version}). https://nodejs.org\n`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/* --------------------------------------------------------------- yardimci */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** Durum kodlu hata: sunucunun catch'i err.status'u yanita yazar. */
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Panelden giden en buyuk govde birkac KB'tir (dosya yukleme yok). 4 MB sinir, tek istekle
// bellegi ve JSON ayristirmayi sisirmeye yetiyordu.
const GOVDE_SINIRI = 256 * 1024;

function readBody(req, limit = GOVDE_SINIRI) {
  return new Promise((resolve, reject) => {
    let bitti = false;
    const reddet = (err) => {
      if (bitti) return;
      bitti = true;
      req.resume(); // kalan govdeyi at: soketi okunmamis veriyle kapatmak istemciye ECONNRESET gosterir
      reject(err);
    };

    const bildirilen = Number(req.headers['content-length']);
    if (Number.isFinite(bildirilen) && bildirilen > limit) {
      return reddet(httpError(413, `Istek govdesi cok buyuk (en fazla ${Math.round(limit / 1024)} KB).`));
    }

    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      if (bitti) {
        // Sinir asildiktan sonra gelen veri atilir; ama sonsuz akisa da izin verme.
        size += chunk.length;
        if (size > limit * 8) req.destroy();
        return;
      }
      size += chunk.length;
      if (size > limit) {
        chunks.length = 0;
        reddet(httpError(413, `Istek govdesi cok buyuk (en fazla ${Math.round(limit / 1024)} KB).`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (bitti) return;
      bitti = true;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      let value;
      try {
        // "__proto__" anahtari ayiklanir: sonraki Object.assign / atamalar nesnenin prototipini degistiremesin.
        value = JSON.parse(raw, (key, v) => (key === '__proto__' ? undefined : v));
      } catch (err) {
        return reject(httpError(400, 'Gecersiz JSON govdesi.'));
      }
      // Rotalar govdeyi duz nesne sanip body.x okuyor: null / dizi / ilkel deger 500 yerine 400 olmali.
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return reject(httpError(400, 'Istek govdesi bir JSON nesnesi olmali.'));
      }
      resolve(value);
    });
    req.on('error', (err) => { if (!bitti) { bitti = true; reject(err); } });
  });
}

function serveFile(res, fullPath) {
  const yok = () => {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bulunamadi');
  };
  try {
    fs.readFile(fullPath, (err, data) => {
      if (err) return yok();
      res.writeHead(200, {
        'content-type': MIME[path.extname(fullPath).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(data);
    });
  } catch {
    // gecersiz yol (ornegin NUL bayti) readFile'i senkron firlatir
    yok();
  }
}

/* ----------------------------------------------------------- girdi sinirlari */

const METIN_SINIRI = 300;

/**
 * Disaridan gelen sahneyi sinirlar. Sahne alanlari kisa duz metindir (poz, kiyafet, isik...);
 * 100 binlerce karakterlik bir deger prompt'a, galeri kaydina ve metin motoruna kadar ilerleyip
 * olay dongusunu kilitleyebiliyordu. Duz nesne, en cok 40 anahtar, metinler 300 karakter;
 * ic ice nesne/dizi sahne alani degildir ve atilir.
 */
function temizSahne(scene) {
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) return {};
  const out = {};
  let adet = 0;
  for (const key of Object.keys(scene)) {
    if (key === '__proto__' || key.length > 40) continue;
    if (++adet > 40) break;
    const v = scene[key];
    if (typeof v === 'string') out[key] = v.slice(0, METIN_SINIRI);
    else if (typeof v === 'number') { if (Number.isFinite(v)) out[key] = v; }
    else if (typeof v === 'boolean' || v === null) out[key] = v;
  }
  return out;
}

/**
 * Karakter dosyasi (persona) alanlari: tur ve boyut denetimi. Eskiden her sey oldugu gibi
 * character.json'a yaziliyordu; 20 bin ogeli "avoid" listesi her metin uretiminde
 * ~55 kalip x 20 bin karsilastirma yaptiriyor ve kalici oluyordu.
 */
function personaMetin(ad, v, en = 2000) {
  if (typeof v !== 'string') throw badRequest(`${ad} metin olmali.`);
  if (v.length > en) throw badRequest(`${ad} en fazla ${en} karakter olabilir.`);
  return v;
}

function personaListe(ad, v, adet, uzunluk) {
  if (!Array.isArray(v)) throw badRequest(`${ad} liste olmali.`);
  if (v.length > adet) throw badRequest(`${ad} en fazla ${adet} oge icerebilir.`);
  for (const oge of v) {
    if (typeof oge !== 'string') throw badRequest(`${ad} ogeleri metin olmali.`);
    if (oge.length > uzunluk) throw badRequest(`${ad} ogeleri en fazla ${uzunluk} karakter olabilir.`);
  }
  return v;
}

/* ------------------------------------------------------------ maskeleme */

const MASKE = '•';
const MASKE_KISA = MASKE.repeat(8);

/** Sirri gizler, son 4 karakteri ipucu olarak birakir (sirlar 8 karakter ve altindaysa hic birakmaz). */
function maskeleToken(token) {
  const s = String(token);
  return s.length <= 8 ? MASKE_KISA : `${MASKE.repeat(12)}${s.slice(-4)}`;
}

/** "{{anahtar}}" gibi bir sablon yer tutucusu sir degildir; maskelenirse sablon okunmaz olur. */
const YER_TUTUCU = /^(\{\{[^}]*\}\}|\$\{[^}]*\}|\{[A-Za-z_]+\})$/;

const SIR_ANAHTARI = 'api[_-]?key|apikey|x-api-key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|secret|client[_-]?secret|password|passwd|authorization|bearer';
const SIR_SORGUSU = 'api[_-]?key|apikey|key|access[_-]?token|auth|authorization|token|secret|client[_-]?secret|password|passwd|pwd|sig|signature|x-api-key';

/**
 * Her metin alaninda (secret isaretli olsun olmasin) kimlik bilgisi tasiyan kaliplari gizler:
 *   - https://kullanici:PAROLA@sunucu            (URL icindeki kimlik)
 *   - ?key=... &token=... &api_key=...            (sorgu parametreleri)
 *   - "api_key": "...", "password": "..."         (JSON govde / baslik degerleri)
 * Adresin / govdenin geri kalani okunur kalir.
 *
 * Sema uzunlugu {0,31} ile SINIRLI: sinirsiz `[a-z0-9+.\-]*` "a.a.a.a..." gibi tek satirlik 250 KB'lik
 * girdide her baslangic noktasindan sonuna kadar tarayip ikinci dereceden surer (~12 sn olay dongusu kilidi).
 */
function maskeleKimlik(metin) {
  return String(metin)
    .replace(/(\b[a-z][a-z0-9+.\-]{0,31}:\/\/)([^\/\s@"'?#]+)@/gi, (m, sema, kimlik) => {
      const i = kimlik.indexOf(':');
      return `${sema}${i < 0 ? MASKE_KISA : `${kimlik.slice(0, i + 1)}${MASKE_KISA}`}@`;
    })
    .replace(new RegExp(`([?&;](?:${SIR_SORGUSU})=)([^&#\\s"'<>]+)`, 'gi'), (m, onek, deger) => (
      YER_TUTUCU.test(deger) ? m : `${onek}${maskeleToken(deger)}`
    ))
    .replace(new RegExp(`("(?:${SIR_ANAHTARI})"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`, 'gi'), (m, onek, deger, son) => (
      !deger || YER_TUTUCU.test(deger) ? m : `${onek}${maskeleToken(deger)}${son}`
    ));
}

/** secret alanlarda ek olarak: anahtar gibi gorunen (rakam+harf karisimi ya da cok uzun) dizileri gizler. */
function maskeleAnahtarBenzeri(metin) {
  return String(metin).replace(/[A-Za-z0-9_\-.:+\/=]{8,}/g, (token) => {
    if (token.includes(MASKE)) return token;
    const rakamHarf = /\d/.test(token) && /[A-Za-z]/.test(token);
    const uzun = token.length >= 16 && !/^[a-z]+\/[a-z0-9.+\-]+$/i.test(token); // application/json gibi MIME turleri okunur kalsin
    return rakamHarf || uzun ? maskeleToken(token) : token;
  });
}

function maskeliGoster(field, value) {
  let metin = maskeleKimlik(value);
  if (field.secret) metin = maskeleAnahtarBenzeri(metin);
  return metin;
}

/** API anahtarlarini panele gonderirken maskele. */
function maskConfig(providerSpec, config) {
  const out = {};
  for (const field of providerSpec.fields || []) {
    const value = config ? config[field.key] : undefined;
    if (value == null || value === '') {
      out[field.key] = '';
      continue;
    }
    if (field.type === 'password') {
      const str = String(value);
      out[field.key] = `${MASKE.repeat(Math.max(0, Math.min(20, str.length - 4)))}${str.slice(-4)}`;
      out[`${field.key}__set`] = true;
      continue;
    }
    if (field.secret) {
      // Serbest metin icindeki anahtar benzeri dizileri maskele
      // (ornek: Ozel API basliklarindaki "Bearer sk-...").
      out[field.key] = maskeliGoster(field, value);
      out[`${field.key}__set`] = true;
      continue;
    }
    // secret isaretsiz alanlarda (adres, govde sablonu, baseUrl...) yalniz kimlik tasiyan kaliplar gizlenir.
    // Metin olmayan degerler (sayi, mantiksal) oldugu gibi gider.
    if (typeof value === 'string') {
      const gosterilen = maskeleKimlik(value);
      out[field.key] = gosterilen;
      if (gosterilen !== value) out[`${field.key}__set`] = true;
    } else {
      out[field.key] = value;
    }
  }
  return out;
}

// Saglayici alanlarina yazilabilecek en uzun metin: adres/model/anahtar kisa, basliklar ve govde sablonu uzundur.
// Sinirsiz deger hem diske kalir hem her ayar yuklemesinde maskeleme maliyeti olur.
const ALAN_SINIRI_METIN = 4096;
const ALAN_SINIRI_KUTU = 16384;

/** Panelden gelen maskelenmis degeri kaydetme; eski degeri koru. */
function mergeConfig(providerSpec, oldConfig = {}, incoming = {}) {
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw badRequest('config bir nesne olmali.');
  }
  const out = { ...oldConfig };
  for (const field of providerSpec.fields || []) {
    if (!Object.hasOwn(incoming, field.key)) continue;
    const value = incoming[field.key];
    const masked = typeof value === 'string' && value.includes(MASKE);
    if ((field.type === 'password' || field.secret) && masked) continue;
    // Gizli alan olmayan ama maskelenerek gonderilmis alan (adresteki parola, govdedeki anahtar):
    // panel maskeli halini aynen geri yollar; eski degeri koru. Kullanici degeri gercekten
    // degistirdiyse yeni deger maske icermez ve yazilir.
    const eski = oldConfig[field.key];
    if (masked && typeof eski === 'string' && maskeleKimlik(eski) !== eski) continue;
    if (typeof value === 'string') {
      const en = field.type === 'textarea' ? ALAN_SINIRI_KUTU : ALAN_SINIRI_METIN;
      if (value.length > en) throw badRequest(`${field.label || field.key} en fazla ${en} karakter olabilir.`);
    }
    out[field.key] = value;
  }
  return out;
}

function activeProvider() {
  const cfg = store.getProviderConfig();
  const spec = providers.get(cfg.active || 'manual');
  return { cfg, spec, config: (cfg.entries && cfg.entries[spec.id]) || {} };
}

/**
 * Sahneye uygun referans kareyi yukler.
 * Eskiden yalnizca birincil kare gonderiliyordu; artik vesikalik setinden
 * sahnenin acisina en yakin kare seciliyor (bkz. reference.pickReference).
 */
function referencePayload(character, scene) {
  const filename = reference.pickReference(character, scene || {});
  if (!filename) return {};
  const buffer = store.readImageBuffer(filename);
  if (!buffer) return {};
  const b64 = buffer.toString('base64');

  // Mime SABIT image/png DEGIL. store.saveImageBuffer jpg ve webp de
  // kaydediyor (Pollinations jpeg donuyor); sabit png yazinca JPEG baytlari
  // "bu bir png" etiketiyle bulut API'sine gidiyordu.
  const ext = String(filename).split('.').pop().toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'webp' ? 'image/webp'
      : 'image/png';

  return {
    referenceBuffer: buffer,   // ComfyUI dosyayi yukluyor, base64 gomemiyor
    referenceMime: mime,
    referenceBase64: b64,      // automatic1111 SAF base64 bekliyor, data URI degil
    referenceDataUri: `data:${mime};base64,${b64}`,
    referenceFile: filename,
  };
}

/**
 * Ortak uretim yolu: sahne -> prompt -> bagli API -> kaydedilen gorseller.
 * Hem normal uretim hem vesikalik seti bunu kullanir.
 */
async function generateScene(character, scene, count = 1) {
  const { spec, config } = activeProvider();
  const dialect = config.dialect || spec.dialect;

  // GERCEK referans durumu. Eskiden burada `spec.supportsReference` bayragina
  // bakiliyordu ve o bayrak YALAN SOYLUYORDU: ComfyUI "destekliyorum" diyip
  // referansi hic kullanmiyordu, Replicate/fal ise alan adi girilmemisse
  // sessizce referanssiz uretiyordu. Sonuc iki katmanli hasar:
  //   1) yuz kilidi acik saniliyordu ama acik degildi,
  //   2) asagidaki seed kaydirmasi yine de uygulaniyordu -> 8 aci = 8 ayri insan.
  const refState = providers.referenceState(spec, config);
  const refPayload = refState.state === 'ready' ? referencePayload(character, scene) : {};
  const referenceLive = !!refPayload.referenceFile;

  // Seed kaydirmasi SADECE referans gercekten gidiyorsa dogru: orada kimligi
  // referans tutar, seed yalnizca kompozisyonu degistirir. Referans gitmiyorsa
  // seed'i kaydirmak kimligi de degistirir.
  let effectiveScene = (scene.seedOffset && !referenceLive)
    ? { ...scene, seedOffset: 0 }
    : scene;

  let built = promptcraft.build(character, effectiveScene, dialect);
  // "YENIDEN URET" HEP AYNI FOTOGRAFI VERIYORDU: ayni prompt + ayni seed = modelden birebir ayni kare (Pollinations onbellekler).
  // Galeride AYNI prompt'la uretilmis kare varsa bu bir yeniden denemedir: tohum her denemede kaydirilir (kimlik prompt'ta, kompozisyon tohumda).
  try {
    const onceki = store.getGallery().filter((g) => g && g.prompt === built.prompt).length;
    if (onceki > 0 && !scene.reroll) {
      effectiveScene = { ...effectiveScene, reroll: onceki };
      built = promptcraft.build(character, effectiveScene, dialect);
    }
  } catch (err) { /* galeri okunamazsa ilk deneme gibi davran */ }
  const aspectMeta = promptcraft.ASPECT[built.aspect];

  if (spec.id === 'manual') {
    const err = new Error(
      'Bagli bir gorsel uretim API\'si yok. Bu otomasyon kendi basina gorsel uretmez ve stok gorsel kullanmaz. ' +
      'Ayarlar bolumunden bir platform sec - varsayilan Pollinations.ai ucretsizdir ve anahtar istemez. ' +
      'Asagidaki prompt hazir; istersen simdilik elle kendi aracina yapistirabilirsin.'
    );
    err.status = 428;
    err.payload = { prompt: built, all: promptcraft.buildAll(character, scene) };
    throw err;
  }

  const started = Date.now();
  const result = await spec.generate({
    config,
    prompt: built.prompt,
    negative: built.negative,
    seed: built.seed,
    width: built.width,
    height: built.height,
    size: built.params.size || `${built.width}x${built.height}`,
    aspectRatio: aspectMeta.mj,
    count: Math.min(Math.max(Number(count) || 1, 1), 4),
    // Motor ayarlari (guidance/steps/cfg) - eskiden burada dusuruluyordu ve
    // model kendi varsayilaniyla calisiyordu. FLUX'ta plastik cildin bir
    // numarali sebebi buydu.
    engine: built.engine,
    params: built.params,
    ...refPayload,
  });

  // Buyutme adimi: uretilen kare, bagli buyutme aracina gonderilir.
  // Ucretsiz saglayici ~686x858 donduruyor; Instagram 1080 istiyor.
  const upCfg = store.getUpscalerConfig();
  const upSpec = upscalers.get(upCfg.active || 'none');
  const upConf = (upCfg.entries && upCfg.entries[upSpec.id]) || {};

  // MASAUSTU CIKTI KLASORU: bu isin tum ciktilari kendi klasorune de yazilir.
  // data/ altindaki yigin degismez - burasi ONA EK.
  let job = null;
  try {
    job = output.createJobFolder({
      studio: 'karakter',
      title: scene.request || scene.categoryLabel || scene.category || 'uretim',
    });
  } catch (err) {
    // Cikti klasoru acilamazsa URETIMI DURDURMA - kullanicinin karesi
    // data/ altinda zaten guvende.
    console.error('[cikti] klasor acilamadi:', err.message);
  }

  const saved = [];
  for (const image of result.images || []) {
    let out = image;
    let upscaled = null;
    if (upSpec.id !== 'none') {
      try {
        const up = await upSpec.upscale({
          config: upConf,
          buffer: image.buffer,
          scale: Math.min(Math.max(Number(upCfg.scale) || 2, 1), upSpec.maxScale || 4),
        });
        if (up && up.buffer && !up.skipped) {
          out = { buffer: up.buffer, mime: up.mime || 'image/png' };
          upscaled = { by: upSpec.id, scale: upCfg.scale || 2 };
        }
      } catch (err) {
        // Buyutme basarisiz olursa uretimi CÖPE ATMA - orijinali kaydet,
        // sadece uyariyi tasi. Kullanici parasini odedigi kareyi kaybetmesin.
        upscaled = { by: upSpec.id, failed: true, error: err.message };
      }
    }
    const image2 = out;
    const ext = image2.mime === 'image/jpeg' ? 'jpg' : image2.mime === 'image/webp' ? 'webp' : 'png';
    const file = store.saveImageBuffer(image2.buffer, ext);
    const item = {
      id: file.id,
      filename: file.filename,
      url: file.url,
      createdAt: new Date().toISOString(),
      provider: spec.id,
      providerLabel: spec.label,
      dialect,
      prompt: built.prompt,
      negative: built.negative,
      seed: built.seed,
      scene,
      category: scene.categoryLabel || scene.category || null,
      upscaled,
      isGolden: false,
    };
    store.addGalleryItem(item);
    saved.push(item);

    if (job) {
      try {
        output.writeImage(job, image2.buffer, {
          index: saved.length,
          ext,
          label: scene.categoryLabel || scene.category || '',
        });
      } catch (err) {
        console.error('[cikti] gorsel yazilamadi:', err.message);
      }
    }
  }

  if (job && saved.length) {
    try {
      output.writeText(job, 'prompt.txt', [
        'PROMPT', '------', built.prompt, '',
        'NEGATIF PROMPT', '--------------', built.negative || '(yok)', '',
        'TEKNIK', '------',
        `Saglayici : ${spec.label}`,
        `Model dili: ${built.dialectLabel || dialect}`,
        `Olcu      : ${built.width}x${built.height}`,
        `Seed      : ${built.seed != null ? built.seed : '(bu platform seed desteklemiyor)'}`,
      ].join('\n'));

      output.writeText(job, 'bilgi.txt', [
        'AI INFAPP - is ozeti',
        '======================', '',
        `Tarih     : ${new Date().toLocaleString('tr-TR')}`,
        'Studyo    : AI Influencer',
        `Is        : ${scene.request || scene.categoryLabel || scene.category || '-'}`,
        `Karakter  : ${character.identity.name} (@${character.identity.handle})`,
        `Saglayici : ${spec.label}`,
        `Gorsel    : ${saved.length} adet`,
        `Sure      : ${((Date.now() - started) / 1000).toFixed(1)} sn`, '',
        'YUZ REFERANSI',
        '-------------',
        referenceLive
          ? `Gonderildi (${refPayload.referenceFile})`
          : `GONDERILMEDI - ${refState.reason || 'vesikalik karesi yok'}`,
        referenceLive ? '' : (refState.fix ? `Yapilacak: ${refState.fix}` : ''),
      ].filter((x) => x !== null).join('\n'));
    } catch (err) {
      console.error('[cikti] not yazilamadi:', err.message);
    }
  }

  return {
    images: saved,
    built,
    spec,
    tookMs: Date.now() - started,
    export: job ? { name: job.name, path: job.path, root: job.root } : null,
    // Teshis: kare referansli mi uretildi, degilse NEDEN? Panel bunu
    // sonucun ustunde gosteriyor - sessiz basarisizlik kalmasin.
    reference: {
      state: refState.state,
      used: referenceLive,
      file: refPayload.referenceFile || null,
      reason: referenceLive ? null : (refState.reason || 'Gonderilecek vesikalik karesi yok.'),
      fix: referenceLive ? null : refState.fix,
    },
  };
}

/* ------------------------------------------------------------------ rotalar */

const routes = {
  'GET /api/durum': async () => {
    const character = store.getCharacter();
    const { cfg, spec, config } = activeProvider();
    const refState = providers.referenceState(spec, config);
    return {
      hasCharacter: !!character,
      character,
      gallery: store.getGalleryPage(60),
      provider: {
        active: spec.id,
        label: spec.label,
        generates: spec.id !== 'manual',
        dialect: (cfg.entries && cfg.entries[spec.id] && cfg.entries[spec.id].dialect) || spec.dialect,
        supportsReference: !!spec.supportsReference,
        // Gercek durum: 'none' | 'needs-config' | 'ready'
        referenceState: refState.state,
        referenceReason: refState.reason,
        referenceFix: refState.fix,
      },
      identityLine: character ? promptcraft.identityLine(character.identity) : null,
      reference: character ? reference.status(character) : null,
      risks: character ? traits.risks(character.identity.distinctive) : [],
      app: store.getAppState(),
      studios: studios.list(),
      activeStudio: store.getAppState().activeStudio || 'karakter',
    };
  },

  /* --------------------------------------------------- karsilama (bir kez) */

  'GET /api/studyolar': async () => ({
    studios: studios.list(),
    active: store.getAppState().activeStudio || 'karakter',
  }),

  'POST /api/studyolar/aktif': async (body) => {
    const spec = studios.get(body.id);
    return { state: store.saveAppState({ activeStudio: spec.id }), active: spec.id };
  },

  'GET /api/karsilama': async () => ({
    welcome: welcome.WELCOME,
    state: store.getAppState(),
  }),

  'POST /api/karsilama': async () => {
    // Ekran bir kez gosterilir, sonra bir daha cikmaz - otomasyonu engellemez, kilitlemez.
    return { state: store.saveAppState({ welcomeSeen: true }) };
  },

  'POST /api/sorular': async (body) => {
    // Duzenleme formu icin: kayitli karakterin cevaplarini da hesaba kat,
    // boylece kita->ulke->sehir zinciri mevcut secime gore cozulur.
    const character = store.getCharacter();
    const base = character ? (character.answers || answersFromCharacter(character)) : {};
    const answers = body.useSaved ? { ...base, ...(body.answers || {}) } : (body.answers || {});
    return {
      questions: wizard.questionsFor(answers),
      sections: wizard.sections(),
      answers: body.useSaved ? answers : undefined,
    };
  },

  'GET /api/sorular': async () => ({
    questions: wizard.questionsFor({}),
    sections: wizard.sections(),
  }),

  'POST /api/karakter': async (body) => {
    if (store.hasCharacter()) {
      const err = new Error('Zaten kilitli bir karakter var. Yeni karakter icin once "TUM VERIYI SIL" komutunu calistir.');
      err.status = 409;
      throw err;
    }

    // Once bos birakilan HAYAT sorulari tutarli sekilde doldurulur, sonra
    // dogrulama yapilir. Boylece kullanici "kalanini sen doldur" diyebilir;
    // gorunus sorulari yine zorunlu kalir.
    const submitted = life.autoFill(body.answers || {});

    const { ok, errors, clean } = wizard.validate(submitted);
    if (!ok) {
      const err = new Error(errors.join(' '));
      err.status = 400;
      err.errors = errors;
      throw err;
    }

    const name = clean.name || wizard.suggestName(clean);
    const handle = clean.handle || wizard.suggestHandle(name, clean.interests);

    const identity = {
      name,
      handle: handle.replace(/^@/, ''),
      gender: clean.gender,
      region: clean.region,
      ethnicity: clean.ethnicity,
      skinTone: clean.skinTone,
      eyeColor: clean.eyeColor,
      hairColor: clean.hairColor,
      hairStyle: clean.hairStyle,
      age: clean.age,
      bodyType: clean.bodyType,
      measurements: clean.measurements,
      distinctive: clean.distinctive || [],
      appearanceNote: clean.appearanceNote || '',
    };

    // YUZ GEOMETRISI - yalnizca GERCEKTEN secilmis alanlar yazilir.
    // Bos alani '' olarak yazarsak kimlik nesnesi degisir ve
    // identityChanged karsilastirmasi sahte "vesikalik bayat" uyarisi verir.
    for (const key of wizard.FACE_KEYS) {
      const value = clean[key];
      if (value && value !== wizard.NOT_SET) identity[key] = value;
    }

    const lifeBlock = wizard.extractLife({ ...clean, name });
    const personaBlock = life.enrich(persona.build(clean, name), lifeBlock);

    const character = {
      version: 3,
      characterId: `chr_${crypto.randomBytes(4).toString('hex')}`,
      createdAt: new Date().toISOString(),
      locked: true,
      seed: wizard.deriveSeed(identity),
      // Ham cevaplar saklanir: karakter dosyasi sayfasinda her alan tek tek
      // duzenlenebilsin diye formu bunlarla dolduruyoruz.
      answers: clean,
      identity,
      life: lifeBlock,
      persona: personaBlock,
      dossier: life.dossier(identity, lifeBlock, personaBlock),
      referenceSet: {},
      reference: { filename: null, publicUrl: '', setAt: null },
    };

    store.saveCharacter(character);
    return {
      character,
      identityLine: promptcraft.identityLine(identity),
      risks: traits.risks(identity.distinctive),
    };
  },

  /**
   * KARAKTERI DUZENLE
   * Karakter dosyasi sayfasindaki formdan gelir; her alan tek tek degistirilebilir.
   * Kimlik degisirse seed yeniden turetilir - o yuzden mevcut vesikalik ve
   * gorseller artik ayni kisiyi gostermeyebilir; bunu cagirana bildiriyoruz.
   */
  'POST /api/karakter/duzenle': async (body) => {
    const existing = store.getCharacter();
    if (!existing) throw notFound('Once karakter yarat.');

    const base = existing.answers || answersFromCharacter(existing);
    const merged = life.autoFill({ ...base, ...(body.answers || {}) });

    const { ok, errors, clean } = wizard.validate(merged);
    if (!ok) {
      const err = new Error(errors.join(' '));
      err.status = 400;
      err.errors = errors;
      throw err;
    }

    const name = clean.name || existing.identity.name;
    const handle = (clean.handle || existing.identity.handle).replace(/^@/, '');

    const identity = {
      name,
      handle,
      gender: clean.gender,
      region: clean.region,
      ethnicity: clean.ethnicity,
      skinTone: clean.skinTone,
      eyeColor: clean.eyeColor,
      hairColor: clean.hairColor,
      hairStyle: clean.hairStyle,
      age: clean.age,
      bodyType: clean.bodyType,
      measurements: clean.measurements,
      distinctive: clean.distinctive || [],
      appearanceNote: clean.appearanceNote || '',
    };

    // YUZ GEOMETRISI - yalnizca GERCEKTEN secilmis alanlar yazilir.
    // Bos alani '' olarak yazarsak kimlik nesnesi degisir ve
    // identityChanged karsilastirmasi sahte "vesikalik bayat" uyarisi verir.
    for (const key of wizard.FACE_KEYS) {
      const value = clean[key];
      if (value && value !== wizard.NOT_SET) identity[key] = value;
    }

    const identityChanged = JSON.stringify(identity) !== JSON.stringify(existing.identity);
    const lifeBlock = wizard.extractLife({ ...clean, name });
    const personaBlock = life.enrich(persona.build(clean, name), lifeBlock);

    const updated = {
      ...existing,
      version: 3,
      answers: clean,
      identity,
      seed: wizard.deriveSeed(identity),
      life: lifeBlock,
      persona: personaBlock,
      dossier: life.dossier(identity, lifeBlock, personaBlock),
      updatedAt: new Date().toISOString(),
    };

    // Kimlik degistiyse eski referans kareler baska bir kisiye ait olur.
    let referenceCleared = false;
    const hasReference = Object.keys(existing.referenceSet || {}).length > 0;
    if (identityChanged && hasReference && body.clearReference) {
      updated.referenceSet = {};
      updated.reference = { filename: null, publicUrl: '', setAt: null };
      referenceCleared = true;
    }

    store.saveCharacter(updated);
    return {
      character: updated,
      identityLine: promptcraft.identityLine(identity),
      identityChanged,
      referenceStale: identityChanged && hasReference && !referenceCleared,
      referenceCleared,
      risks: traits.risks(identity.distinctive),
    };
  },

  'POST /api/karakter/persona': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    // Kimlik DEGISTIRILEMEZ. Sadece kisilik/metin katmani duzenlenebilir.
    // Once HEPSI dogrulanir, sonra yazilir: reddedilen bir istek karakter dosyasina hicbir sey yazmaz.
    const yazilacak = {};
    for (const key of ['backstory', 'tone', 'signatureHook', 'emojiStyle']) {
      if (Object.hasOwn(body, key)) yazilacak[key] = personaMetin(key, body[key]);
    }
    for (const key of ['contentPillars', 'wardrobe', 'settings', 'props']) {
      if (Object.hasOwn(body, key)) yazilacak[key] = personaListe(key, body[key], 20, 200);
    }

    // Ses rehberi: yalnizca BILINEN alt anahtarlar yazilabilir.
    // Keyfi anahtar kabul edersek karakter dosyasi cop kutusuna doner ve
    // caption motoru beklemedigi bir sekille karsilasir.
    const sesYazilacak = {};
    const ses = body.voiceGuide;
    if (ses && typeof ses === 'object' && !Array.isArray(ses)) {
      for (const key of ['register', 'sentenceLength', 'emojiRule', 'ctaStyle']) {
        if (Object.hasOwn(ses, key)) sesYazilacak[key] = personaMetin(`voiceGuide.${key}`, ses[key]);
      }
      if (Object.hasOwn(ses, 'avoid')) sesYazilacak.avoid = personaListe('voiceGuide.avoid', ses.avoid, 30, 80);
      if (Object.hasOwn(ses, 'openers')) sesYazilacak.openers = personaListe('voiceGuide.openers', ses.openers, 20, 200);
    }
    if (body.publicReferenceUrl !== undefined && typeof body.publicReferenceUrl === 'string') {
      personaMetin('publicReferenceUrl', body.publicReferenceUrl);
    }

    character.persona = character.persona || {};
    Object.assign(character.persona, yazilacak);
    if (Object.keys(sesYazilacak).length) {
      character.persona.voiceGuide = { ...(character.persona.voiceGuide || {}), ...sesYazilacak };
    }
    if (typeof body.publicReferenceUrl === 'string') {
      character.reference = character.reference || {};
      character.reference.publicUrl = body.publicReferenceUrl.trim();
    }
    store.saveCharacter(character);
    return { character };
  },

  /**
   * GONDERI METNI URETIR.
   *
   * Bagli bir gorsel API'si GEREKMEZ: bu motor metin uretir, gorsel degil.
   * Yerel, deterministik, sablon tabanli - harici LLM veya kredi kullanmaz.
   */
  'POST /api/metin': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    const scene = temizSahne(body.scene);
    const out = caption.build(character, scene, {
      platform: body.platform,
      variants: body.variants,
      aiLabel: body.aiLabel,
    });

    // Metin, gorselin yazildigi ISIN KLASORUNE gider. Panel son uretimin
    // klasor adini gonderiyor; yoksa metin icin kendi klasoru acilir.
    let job = null;
    try {
      job = body.exportTo
        ? output.reuseJobFolder(body.exportTo)
        : output.createJobFolder({
          studio: 'karakter',
          title: `metin - ${scene.request || scene.categoryLabel || out.platformLabel}`,
        });
      if (job) {
        output.writeText(job, `metin-${out.platform}.txt`, [
          `${out.platformLabel} icin gonderi metni`,
          '='.repeat(40), '',
          ...out.variants.map((v, i) => [
            `--- VARYANT ${i + 1} (${v.chars}/${v.max} karakter) ---`,
            v.text, '',
          ].join('\n')),
          out.aiNote,
        ].join('\n'));
      }
    } catch (err) {
      console.error('[cikti] metin yazilamadi:', err.message);
    }

    return { ...out, export: job ? { name: job.name, path: job.path } : null };
  },

  /* ------------------------------------------------- masaustu cikti ayari */

  /**
   * KURULUM DURUMU
   *
   * Depoyu yeni acan kisi neyin hazir neyin eksik oldugunu tek bakista
   * gorsun diye. Hicbiri "hata" degil - cogu istege bagli; amac yol
   * gostermek, korkutmak degil.
   */
  'GET /api/kurulum': async () => {
    const { spec, config } = activeProvider();
    const refState = providers.referenceState(spec, config);
    const raster = require('./src/raster');
    const ciktiCfg = output.getConfig();

    let etsyApi = false;
    let etsyMagaza = null;
    try {
      const pazar = require('./src/studios/etsy/pazar');
      etsyApi = pazar.getConfig().hazir;
    } catch {}
    try {
      const magaza = require('./src/studios/etsy/magaza');
      etsyMagaza = magaza.getConfig();
    } catch {}

    return {
      adimlar: [
        {
          ad: 'Node.js',
          zorunlu: true,
          tamam: true,
          deger: process.version,
          not: 'Panelin kendisi bunun uzerinde calisiyor.',
        },
        {
          ad: 'Chrome / Edge',
          zorunlu: true,
          tamam: raster.available(),
          deger: raster.available() ? 'bulundu' : 'bulunamadi',
          not: raster.available()
            ? 'Baskiya hazir PNG ve PDF uretilebiliyor.'
            : 'Etsy ve Reklam studyolari tasarimi PNG/PDF\'e ceviremiyor - yalnizca SVG indirebilirsin. Chrome veya Edge kur.',
        },
        {
          ad: 'Gorsel uretim saglayicisi',
          zorunlu: false,
          tamam: spec.id !== 'manual',
          deger: spec.label,
          not: refState.state === 'ready'
            ? 'Yuz kilidi acik - referans kare gonderiliyor.'
            : refState.state === 'needs-config'
              ? `Yuz kilidi KAPALI: ${refState.reason || ''}`
              : 'Bu platform referans gorsel kabul etmiyor; acilar arasinda yuz kayabilir. Ayarlar > karsilastirma tablosuna bak.',
        },
        {
          ad: 'Masaustu cikti klasoru',
          zorunlu: false,
          tamam: !!ciktiCfg.enabled,
          deger: ciktiCfg.enabled ? ciktiCfg.root : 'kapali',
          not: ciktiCfg.enabled
            ? 'Her is kendi klasorune yaziliyor.'
            : 'Kapali - ciktilar yalnizca galeride kalir.',
        },
        {
          ad: 'Etsy pazar arastirmasi',
          zorunlu: false,
          tamam: etsyApi,
          deger: etsyApi ? 'anahtar girildi' : 'anahtar yok',
          not: etsyApi
            ? 'Canli Etsy verisiyle desen cikarabilirsin.'
            : 'Nis kutuphanesi anahtarsiz zaten calisiyor. Canli veri istersen Etsy POD > Pazar arastirmasi.',
        },
        {
          ad: 'Etsy magazasi',
          zorunlu: false,
          tamam: !!(etsyMagaza && etsyMagaza.bagli),
          deger: etsyMagaza && etsyMagaza.bagli ? (etsyMagaza.shopName || 'bagli') : 'bagli degil',
          not: etsyMagaza && etsyMagaza.bagli
            ? 'Tasarimlari magazana TASLAK olarak gonderebilirsin (yayina alma senin elinde).'
            : 'Istege bagli. Etsy POD > Magaza sekmesinde adim adim anlatiliyor.',
        },
      ],
    };
  },

  'GET /api/cikti': async () => ({
    config: output.getConfig(),
    jobs: output.listJobs(20),
  }),

  'POST /api/cikti': async (body) => ({
    config: output.saveConfig({ enabled: body.enabled, root: body.root }),
    jobs: output.listJobs(20),
  }),

  'POST /api/cikti/ac': async (body) => {
    const acilan = output.openFolder(body.path || undefined);
    return { opened: acilan };
  },

  'GET /api/metin/platformlar': async () => ({ platforms: caption.platforms() }),

  'POST /api/sahneler': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    return {
      scenes: scenes.suggest(character, Math.min(Math.max(Number(body.count) || 12, 1), 40)),
      options: scenes.options(),
      realism: promptcraft.realismOptions(),
    };
  },

  'POST /api/prompt': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    const scene = temizSahne(body.scene);
    const { spec, config } = activeProvider();
    const dialect = config.dialect || spec.dialect;
    return {
      active: promptcraft.build(character, scene, dialect),
      all: promptcraft.buildAll(character, scene),
      dialects: promptcraft.DIALECTS,
    };
  },

  'POST /api/uret': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    const out = await generateScene(character, temizSahne(body.scene), body.count);
    return {
      images: out.images,
      prompt: out.built,
      provider: { id: out.spec.id, label: out.spec.label },
      tookMs: out.tookMs,
      referenceMissing: !reference.status(character).complete,
      reference: out.reference,
      export: out.export,
    };
  },

  /* ------------------------------------------------------- vesikalik seti */

  'GET /api/referans': async () => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    return { status: reference.status(character), angles: reference.list() };
  },

  'POST /api/referans/uret': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    const scene = reference.sceneFor(body.angle);
    if (!scene) throw badRequest('Bilinmeyen aci.');

    const out = await generateScene(character, scene, 1);
    const image = out.images[0];
    if (!image) throw new Error('Vesikalik uretilemedi.');

    // Oku-degistir-yaz tek kilit altinda: iki surec ayni anda vesikalik
    // uretirse biri otekinin acisini silmesin.
    const fresh = store.updateCharacter((cur) => {
      if (!cur) return undefined;
      cur.referenceSet = cur.referenceSet || {};
      cur.referenceSet[body.angle] = {
        angle: body.angle,
        filename: image.filename,
        url: image.url,
        createdAt: image.createdAt,
        prompt: out.built.prompt,
      };
      // Ilk uretilen onden kare otomatik olarak birincil referans olur.
      if (body.angle === reference.primaryKey() || !cur.reference.filename) {
        cur.reference = {
          filename: image.filename,
          publicUrl: cur.reference.publicUrl || '',
          setAt: new Date().toISOString(),
        };
      }
      return cur;
    });

    return {
      angle: body.angle,
      image,
      status: reference.status(fresh),
      tookMs: out.tookMs,
      reference: out.reference,
      export: out.export,
    };
  },

  'POST /api/referans/promptlar': async () => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    const { spec, config } = activeProvider();
    const dialect = config.dialect || spec.dialect;
    return {
      prompts: reference.ANGLES.map((a) => ({
        key: a.key,
        label: a.label,
        built: promptcraft.build(character, reference.sceneFor(a.key), dialect),
      })),
    };
  },

  'POST /api/referans/birincil': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    // Yalniz kendi anahtarlari: "constructor" / "__proto__" gibi bir aci Object.prototype'a dusup
    // "bulundu" sayiliyor ve birincil referans bozuk (dosya adsiz) kaydediliyordu.
    const set = character.referenceSet || {};
    const entry = typeof body.angle === 'string' && Object.hasOwn(set, body.angle) ? set[body.angle] : null;
    if (!entry || !entry.filename) throw notFound('Bu aci henuz uretilmemis.');
    character.reference = {
      filename: entry.filename,
      publicUrl: character.reference.publicUrl || '',
      setAt: new Date().toISOString(),
    };
    store.saveCharacter(character);
    return { status: reference.status(character) };
  },

  /* ---------------------------------------------------- gorev / brief / plan */

  'POST /api/brief': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    const text = String(body.text || '').trim().slice(0, 500);
    if (!text) throw badRequest('Bir istek yaz. Ornek: "kahve reklami yap" veya "spor salonunda foto".');
    const scene = brief.toScene(text, character);
    const { spec, config } = activeProvider();
    return {
      scene,
      prompt: promptcraft.build(character, scene, config.dialect || spec.dialect),
      tasks: brief.taskList(),
    };
  },

  /* ------------------------------------------------------ sahne kutuphanesi */

  'GET /api/kutuphane': async () => ({
    bilgi: kutuphane.bilgi(),
    etiketler: kutuphane.etiketler(),
  }),

  'POST /api/kutuphane/ara': async (body) => kutuphane.ara({
    sorgu: body.sorgu, etiket: body.etiket,
    limit: Math.min(Number(body.limit) || 12, 60),
    atla: Math.max(Number(body.atla) || 0, 0),
  }),

  /**
   * Kutuphane kaydini sahneye cevirir ve onizleme prompt'unu dondurur.
   * Yeni bir uretim yolu ACMIYOR - uretim mevcut POST /api/uret ile.
   */
  'POST /api/kutuphane/sahne': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    const kayit = kutuphane.bul(body.i);
    if (!kayit) throw notFound('Kutuphane kaydi bulunamadi.');
    const scene = kutuphane.sahneYap(kayit, { aspect: body.aspect });
    const { spec, config } = activeProvider();
    return { scene, prompt: promptcraft.build(character, scene, config.dialect || spec.dialect) };
  },

  'GET /api/plan': async () => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');
    return { plan: brief.weeklyPlan(character), tasks: brief.taskList() };
  },

  /* ------------------------------------------------------ buyutme (upscale) */

  'GET /api/buyutme': async () => {
    const cfg = store.getUpscalerConfig();
    return {
      active: cfg.active || 'none',
      scale: cfg.scale || 2,
      upscalers: upscalers.list().map((u) => ({
        ...u,
        config: maskConfig(upscalers.get(u.id), (cfg.entries && cfg.entries[u.id]) || {}),
      })),
    };
  },

  'POST /api/buyutme': async (body) => {
    const spec = upscalers.get(body.id);
    const cfg = store.getUpscalerConfig();
    cfg.entries = cfg.entries || {};
    cfg.entries[spec.id] = mergeConfig(spec, cfg.entries[spec.id], body.config || {});
    if (body.makeActive) cfg.active = spec.id;
    if (body.scale != null) cfg.scale = Math.min(Math.max(Number(body.scale) || 2, 1), 4);
    store.saveUpscalerConfig(cfg);
    return { active: cfg.active, scale: cfg.scale, config: maskConfig(spec, cfg.entries[spec.id]) };
  },

  'GET /api/saglayicilar': async () => {
    const cfg = store.getProviderConfig();
    const list = providers.list().map((p) => {
      const spec = providers.get(p.id);
      const conf = (cfg.entries && cfg.entries[p.id]) || {};
      const refState = providers.referenceState(spec, conf);
      return {
        ...p,
        config: maskConfig(spec, conf),
        configured: isConfigured(spec, conf),
        // Karsilastirma tablosu ve uyarilar bunu okur - sabit bir alan DEGIL,
        // kullanicinin kaydettigi ayara gore hesaplaniyor.
        referenceState: refState.state,
        referenceReason: refState.reason,
        referenceFix: refState.fix,
        // Yalnizca ONERI. Asla kendiliginden uygulanmaz; kullanici
        // "Kutuya yaz" derse input'a yazilir, Kaydet'e basana kadar da
        // hicbir sey degismez.
        referenceGuess: typeof spec.referenceGuess === 'function'
          ? spec.referenceGuess(conf.model || '')
          : null,
        canDiscoverReferenceFields: typeof spec.discoverReferenceFields === 'function',
      };
    });
    return { active: cfg.active || 'manual', providers: list };
  },

  /**
   * Modelin gercek girdi semasindan referans gorsel alani adaylarini bulur.
   * Tahmin degil, platformun kendi OpenAPI semasi okunur.
   */
  'POST /api/saglayici/referans-alanlari': async (body) => {
    const spec = providers.get(body.id);
    if (!spec || spec.id !== body.id) throw badRequest('Bilinmeyen saglayici.');
    if (typeof spec.discoverReferenceFields !== 'function') {
      throw badRequest('Bu platform icin alan kesfi desteklenmiyor.');
    }
    const cfg = store.getProviderConfig();
    const conf = (cfg.entries && cfg.entries[spec.id]) || {};
    const fields = await spec.discoverReferenceFields({
      config: { ...conf, ...(body.model ? { model: body.model } : {}) },
    });
    return { id: spec.id, fields };
  },

  'POST /api/saglayici': async (body) => {
    const spec = providers.get(body.id);
    if (!spec || spec.id !== body.id) throw badRequest('Bilinmeyen saglayici.');
    const cfg = store.getProviderConfig();
    cfg.entries = cfg.entries || {};
    cfg.entries[spec.id] = mergeConfig(spec, cfg.entries[spec.id], body.config || {});
    if (body.makeActive) cfg.active = spec.id;
    store.saveProviderConfig(cfg);
    return {
      active: cfg.active,
      config: maskConfig(spec, cfg.entries[spec.id]),
      configured: isConfigured(spec, cfg.entries[spec.id]),
    };
  },

  'POST /api/saglayici/aktif': async (body) => {
    const spec = providers.get(body.id);
    const cfg = store.getProviderConfig();
    cfg.active = spec.id;
    store.saveProviderConfig(cfg);
    return { active: cfg.active };
  },

  'POST /api/saglayici/test': async () => {
    const character = store.getCharacter();
    const { spec, config } = activeProvider();
    if (spec.id === 'manual') throw badRequest('Test icin once bir uretim saglayicisi sec.');

    const testScene = {
      shot: 'close-up portrait, head and shoulders',
      pose: 'soft smile, looking directly into the lens',
      lighting: 'soft natural window light',
      aspect: 'square',
    };
    const built = character
      ? promptcraft.build(character, testScene, config.dialect || spec.dialect)
      : { prompt: 'a simple test photograph of a red apple on a white table', negative: null, seed: 1234, width: 768, height: 768, params: {} };

    const result = await spec.generate({
      config,
      prompt: built.prompt,
      negative: built.negative,
      seed: built.seed,
      width: built.width,
      height: built.height,
      size: built.params.size || `${built.width}x${built.height}`,
      aspectRatio: '1:1',
      count: 1,
    });

    const images = (result.images || []).map((image) => {
      const file = store.saveImageBuffer(image.buffer, image.mime === 'image/jpeg' ? 'jpg' : 'png');
      const item = {
        id: file.id,
        filename: file.filename,
        url: file.url,
        createdAt: new Date().toISOString(),
        provider: spec.id,
        providerLabel: spec.label,
        prompt: built.prompt,
        seed: built.seed,
        scene: { category: 'test' },
        category: 'Baglanti testi',
        isGolden: false,
      };
      store.addGalleryItem(item);
      return item;
    });

    return { ok: true, provider: spec.label, images };
  },

  /**
   * Bir kareyi "birincil referans" yapar.
   *
   * Rota once yazilmisti ama panelden HIC cagrilmiyordu - galeride buton yoktu.
   */
  'POST /api/galeri/altin': async (body) => {
    const character = store.getCharacter();
    if (!character) throw notFound('Once karakter yarat.');

    let item = null;
    store.updateGallery((gallery) => {
      item = gallery.find((g) => g.id === body.id) || null;
      if (!item) return undefined;
      for (const g of gallery) g.isGolden = g.id === item.id;
      return gallery;
    });

    if (!item) throw notFound('Gorsel bulunamadi.');
    if (!item.filename) throw badRequest('Bu kaydin dosyasi yok.');
    // Etsy/Reklam tasarimlari karakterin YUZ referansi olamaz.
    if (item.studio && item.studio !== 'karakter') {
      throw badRequest('Bu kare bir tasarim stüdyosundan geliyor; karakterin yuz referansi olamaz.');
    }

    const guncel = store.updateCharacter((cur) => {
      if (!cur) return undefined;
      cur.reference = {
        filename: item.filename,
        publicUrl: (cur.reference && cur.reference.publicUrl) || '',
        setAt: new Date().toISOString(),
      };
      return cur;
    });

    return { character: guncel, golden: item, gallery: store.getGalleryPage(60) };
  },

  /**
   * Galeri karesini kaldirir.
   *
   * VARSAYILAN ARSIVDIR - dosya data/_arsiv/silinen/ altina tasinir.
   * Vesikalik seti bir kareye dayaniyorsa 409 doner: silmek yuz kilidini
   * sessizce koparir, kullanici bunu bilmeden onaylamamali.
   */
  'POST /api/galeri/sil': async (body) => {
    const gallery = store.getGallery();
    const item = gallery.find((g) => g.id === body.id);
    if (!item) throw notFound('Gorsel bulunamadi.');

    const character = store.getCharacter();
    const kullanan = [];
    if (character) {
      const set = character.referenceSet || {};
      for (const [aci, kare] of Object.entries(set)) {
        if (kare && kare.filename === item.filename) kullanan.push(aci);
      }
      if (character.reference && character.reference.filename === item.filename) {
        kullanan.push('birincil');
      }
    }

    if (kullanan.length && body.force !== true) {
      const err = new Error(
        `Bu kare vesikalik setinde kullaniliyor (${kullanan.join(', ')}). ` +
        'Silersen yuz referansi kopar ve o aci yeniden uretilmeli.'
      );
      err.status = 409;
      err.payload = { code: 'REFERANS_KULLANIMDA', angles: kullanan };
      throw err;
    }

    // Once karakteri temizle: yarim kalirsa referans olmayan dosyayi gosterir.
    if (kullanan.length) {
      store.updateCharacter((cur) => {
        if (!cur) return undefined;
        const set = cur.referenceSet || {};
        for (const [aci, kare] of Object.entries(set)) {
          if (kare && kare.filename === item.filename) delete set[aci];
        }
        if (cur.reference && cur.reference.filename === item.filename) {
          cur.reference = { filename: '', publicUrl: (cur.reference.publicUrl) || '', setAt: null };
        }
        return cur;
      });
    }

    store.updateGallery((g) => g.filter((x) => x.id !== item.id));

    // Dosyayi yalnizca baska kayit KULLANMIYORSA kaldir.
    let dosya = { removed: false };
    if (item.filename && store.galleryUsesFile(item.filename) === 0) {
      dosya = store.trashImageFile(item.filename, { hard: body.hard === true });
    }

    const guncel = store.getCharacter();
    return {
      removed: item.id,
      file: dosya,
      clearedAngles: kullanan,
      gallery: store.getGalleryPage(60),
      reference: guncel ? reference.status(guncel) : null,
      character: guncel,
    };
  },

  /**
   * Var olan bir kareyi sonradan buyutur.
   *
   * Uretim sirasinda buyutme kapaliyken uretilmis kareler icin. Kayit
   * YERINDE guncellenir (id degismez) ve karakterin referans dosya adlari
   * senkronlanir - aksi halde reference.js dosya adiyla esledigi icin yuz
   * referansi kopardi.
   */
  'POST /api/galeri/buyut': async (body) => {
    const item = store.getGallery().find((g) => g.id === body.id);
    if (!item) throw notFound('Gorsel bulunamadi.');

    const upCfg = store.getUpscalerConfig();
    const upSpec = upscalers.get(upCfg.active || 'none');
    if (upSpec.id === 'none') {
      const err = new Error('Bagli bir buyutme araci yok. Ayarlar > Buyutme bolumunden bir arac sec.');
      err.status = 428;
      throw err;
    }

    const buffer = store.readImageBuffer(item.filename);
    if (!buffer) throw notFound('Bu kaydin dosyasi diskte yok.');

    let up;
    try {
      up = await upSpec.upscale({
        config: (upCfg.entries && upCfg.entries[upSpec.id]) || {},
        buffer,
        scale: Math.min(Math.max(Number(upCfg.scale) || 2, 1), upSpec.maxScale || 4),
      });
    } catch (err) {
      // ORIJINAL HICBIR SEKILDE BOZULMAZ.
      const e = new Error(`Buyutme basarisiz: ${err.message}`);
      e.status = 502;
      throw e;
    }
    if (!up || !up.buffer || up.skipped) {
      throw badRequest('Buyutme araci gorsel dondurmedi.');
    }

    const ext = up.mime === 'image/jpeg' ? 'jpg' : up.mime === 'image/webp' ? 'webp' : 'png';
    const yeni = store.saveImageBuffer(up.buffer, ext);
    const eskiDosya = item.filename;

    const guncelKayit = { ...item };
    store.updateGallery((gallery) => {
      const hedef = gallery.find((g) => g.id === body.id);
      if (!hedef) return undefined;
      hedef.previousFilename = eskiDosya;
      hedef.filename = yeni.filename;
      hedef.url = yeni.url;
      hedef.upscaled = { by: upSpec.id, scale: upCfg.scale || 2, at: new Date().toISOString() };
      Object.assign(guncelKayit, hedef);
      return gallery;
    });

    // Karakter senkronu: reference.js dosya ADIYLA esliyor.
    store.updateCharacter((cur) => {
      if (!cur) return undefined;
      let degisti = false;
      const set = cur.referenceSet || {};
      for (const kare of Object.values(set)) {
        if (kare && kare.filename === eskiDosya) {
          kare.filename = yeni.filename;
          kare.url = yeni.url;
          degisti = true;
        }
      }
      if (cur.reference && cur.reference.filename === eskiDosya) {
        cur.reference.filename = yeni.filename;
        degisti = true;
      }
      return degisti ? cur : undefined;
    });

    if (store.galleryUsesFile(eskiDosya) === 0) {
      store.trashImageFile(eskiDosya, { hard: false });
    }

    return {
      item: guncelKayit,
      upscaler: upSpec.id,
      gallery: store.getGalleryPage(60),
      character: store.getCharacter(),
    };
  },

  'POST /api/sifirla': async (body) => {
    if (body.confirm !== 'SIFIRLA') {
      throw badRequest('Onay metni yanlis. Silmek icin kutuya SIFIRLA yaz.');
    }
    const result = store.resetAll({
      hard: !!body.hard,
      keepProviders: body.keepProviders !== false,
    });
    const anahtar = body.keepProviders === false
      ? ` API anahtarlari ve jetonlar da silindi${result.secretsRemoved.length ? ` (${result.secretsRemoved.join(', ')})` : ''}.`
      : '';
    const arsivUyari = result.hard && !result.archiveRemoved
      ? ` UYARI: onceki arsivler (data/_arsiv) silinemedi${result.archiveError ? `: ${result.archiveError}` : ''}.`
      : '';
    return {
      ok: true,
      ...result,
      message: (body.hard
        ? `Tum veri kalici olarak silindi${result.archiveRemoved ? ' (onceki arsivler dahil)' : ''}. Sifirdan baslayabilirsin.`
        : `Tum veri arsive tasindi (${result.archive}). Sifirdan baslayabilirsin.`) + anahtar + arsivUyari,
    };
  },
};

/**
 * Eski surumde yaratilmis (answers alani olmayan) karakterler icin
 * cevaplari kimlik + hayat bloklarindan geri kurar. Boylece duzenleme
 * formu onlarda da dolu acilir.
 */
function answersFromCharacter(character) {
  const id = character.identity || {};
  const lf = character.life || {};
  const pr = character.persona || {};
  const [cityName, country] = String(lf.city || '').split(',').map((s) => s.trim());
  const [hometownCity, hometownCountry] = String(lf.hometown || '').split(',').map((s) => s.trim());
  const sameHometown = (lf.hometown || '') === (lf.city || '');

  return {
    ...id,
    ...lf,
    zodiac: pr.zodiac,
    education: pr.education,
    interests: pr.interests || [],
    continent: lf.continent || life.continentOf(country) || 'Avrupa',
    country: country || lf.country || '',
    cityName: cityName || '',
    hometownMode: sameHometown ? life.SAME_AS_CITY : 'Farkli bir yer sececegim',
    hometownContinent: lf.hometownContinent || life.continentOf(hometownCountry) || 'Avrupa',
    hometownCountry: hometownCountry || '',
    hometownCity: hometownCity || '',
  };
}

// Studyolar kendi rotalarini kendi klasorlerinde tasir; burada tabloya karisir.
// Studyolara cekirdek yeteneklerini bagla (fotoroman kare uretimi icin).
studios.init({ generateScene });
Object.assign(routes, studios.routes());

function isConfigured(spec, config) {
  if (spec.id === 'manual') return true;
  const required = (spec.fields || []).filter((f) => f.required);
  if (!required.length) return true;
  return required.every((f) => config && config[f.key] != null && String(config[f.key]).trim() !== '');
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

/* ------------------------------------------------------------------ sunucu */

/**
 * YEREL PANEL KAPISI
 *
 * Bu sunucu senin bilgisayarinda calisiyor ama tarayicin acikken ziyaret
 * ettigin HERHANGI bir web sitesi de ona istek atabilir. Korumasiz birakirsan
 * kotu niyetli bir sayfa:
 *   - POST /api/sifirla ile karakterini ve tum gorsellerini silebilir,
 *   - aktif saglayiciyi "custom" yapip URL'yi kendi sunucusuna cevirerek
 *     bundan sonraki her prompt'u ve yuz verisini disari tasiyabilir.
 * Teorik degil, klasik bir yerel panel acigi.
 *
 * Uc katman:
 *  1. Host yalnizca localhost olabilir (DNS rebinding'i keser).
 *  2. Yazma isteklerinde Origin / Sec-Fetch-Site ayni kaynak olmali.
 *  3. API yazma istekleri application/json olmali - basit bir HTML formu
 *     bu basligi CORS on-kontrolune takilmadan gonderemez.
 */
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function denyRequest(req, pathname) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return { status: 403, message: 'Bu panel yalnizca localhost uzerinden acilabilir.' };
  }

  const site = req.headers['sec-fetch-site'];

  if (req.method === 'GET' || req.method === 'HEAD') {
    // Okumalar yan etkisiz sanilir ama bazi GET uclari (Etsy magaza sorgulari gibi) kayitli jetonla
    // disariya istek atar; baska sitenin sayfasi bunu fetch/img ile tetikleyebilirdi. /api/* okumalari yalniz
    // ayni kaynaktan ya da adres cubugundan (none) gelir. Sayfanin kendisi baglantiyla acilabilir.
    if (pathname.startsWith('/api/') && site && site !== 'same-origin' && site !== 'none') {
      return { status: 403, message: 'Baska bir sitenin istegi reddedildi.' };
    }
    return null;
  }

  if (site && site !== 'same-origin' && site !== 'none') {
    return { status: 403, message: 'Baska bir sitenin istegi reddedildi.' };
  }

  const origin = req.headers.origin;
  if (origin) {
    const ok = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`].includes(origin);
    if (!ok) return { status: 403, message: 'Gecersiz Origin.' };
  }

  if (pathname.startsWith('/api/')) {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') {
      return { status: 415, message: 'API istekleri application/json olmali.' };
    }
  }

  return null;
}

/**
 * Her yanitta gonderilen basliklar. setHeader ile konanlar sonraki res.writeHead(...) cagrilarinda korunur,
 * yani sendJson, serveFile ve denyRequest yanitlarinin hepsini kapsar.
 *
 *  - X-Ai-Infapp: panel, 4200'de KIMIN dinledigini bununla anlar.
 *  - CSP: public/ icinde satir ici betik / on* nitelikleri / dis kaynak yok (style nitelikleri var,
 *    o yuzden style-src 'unsafe-inline'). frame-ancestors + X-Frame-Options: baska bir sitenin paneli
 *    saydam iframe'e alip tiklama kacirmasini (galeri silme, saglayici etkinlestirme) onler.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function temelBasliklar(res) {
  res.setHeader('X-Ai-Infapp', KIMLIK);
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}

async function istegiIsle(req, res) {
  // Adres ayristirma HER ZAMAN denetimden once ve hata yakalanarak yapilir: bozuk yuzde-kodlama
  // (/%, /%zz), NUL baytli yol, "//" ve mutlak bicimli hedefler eskiden yakalanmamis istisna
  // olup baglantiyi yanitsiz, sonsuza dek acik birakiyordu (Host denetimi bile calismiyordu).
  let url = null;
  let pathname = '';
  const hamAdres = String(req.url || '');
  if (hamAdres.startsWith('/') && !hamAdres.startsWith('//')) {
    try {
      url = new URL(hamAdres, `http://localhost:${PORT}`);
      pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\0')) url = null;
    } catch {
      url = null;
    }
  }
  const key = `${req.method} ${pathname}`;

  const denied = denyRequest(req, pathname);
  if (denied) {
    res.writeHead(denied.status, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: denied.message }));
  }
  if (!url) return sendJson(res, 400, { error: 'Gecersiz adres.' });

  // API
  if (pathname.startsWith('/api/')) {
    const handler = routes[key];
    if (!handler) return sendJson(res, 404, { error: 'Bilinmeyen uc nokta.' });
    try {
      const body = req.method === 'GET' ? {} : await readBody(req);
      const result = await handler(body, url);
      return sendJson(res, 200, result);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(`[hata] ${key}:`, err);
      return sendJson(res, status, {
        error: err.message || 'Bilinmeyen hata.',
        code: err.code || null,
        errors: err.errors || null,
        ...(err.payload || {}),
      });
    }
  }

  // Uretilen gorseller
  if (pathname.startsWith('/gorseller/')) {
    const filename = path.basename(pathname);
    return serveFile(res, path.join(store.IMAGES_DIR, filename));
  }

  // Statik panel
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const full = path.join(PUBLIC_DIR, rel);
  // Ayirici ile karsilastir: yalniz startsWith(PUBLIC_DIR) "public-x" gibi kardes klasorlerden de gecerdi.
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Yasak');
  }
  return serveFile(res, full);
}

const server = http.createServer((req, res) => {
  temelBasliklar(res);
  istegiIsle(req, res).catch((err) => {
    // Beklenmeyen hata yanitsiz baglanti birakmasin ve unhandledRejection'a dusmesin.
    console.error(`[hata] ${req.method} istegi islenemedi:`, err && err.message ? err.message : err);
    try {
      if (!res.headersSent) sendJson(res, 500, { error: 'Sunucu hatasi.' });
      else res.end();
    } catch {
      try { res.destroy(); } catch {}
    }
  });
});

store.ensureDirs();

/**
 * TEK ORNEK KILIDI.
 *
 * Ayni data/ klasorune iki sunucu sureci yazarsa galeri kareleri kayboluyor
 * ve character.json bozulabiliyor. Store katmani artik dosya kilidiyle bunu
 * savusturuyor, ama dogru cozum ikinci ornegi hic baslatmamak: iki panel ayni
 * karakteri farkli bellek durumuyla gosterir, kullanici hangisinin dogru
 * oldugunu bilemez.
 *
 * Kilit dosyasi PID tutuyor; surec cokerse bayat kilit otomatik temizlenir.
 */
const INSTANCE_FILE = path.join(store.DATA_DIR, '.instance');

/**
 * Kilidin sahibi gercekten bir Ai Infapp paneli mi? PID tek basina yetmez: sert kapanis ya da
 * yeniden baslatmadan sonra Windows ayni PID'yi baska bir surece (explorer.exe gibi) verir ve
 * bayat .instance, olmayan bir paneli "calisiyor" gosterip baslatmayi kalici engellerdi.
 * Kilitteki porta baglanilir; X-Ai-Infapp basligi donerse panel gercektir. Baglanti reddedilir
 * ya da baska bir program yanit verirse kilit bayattir. Yanit gelmezse (mesgul sunucu) temkinli
 * davranilir: canli sayilir.
 */
function sahipPanelMi(sahip) {
  return new Promise((coz) => {
    let bitti = false;
    let istek = null;
    const son = (deger) => {
      if (bitti) return;
      bitti = true;
      clearTimeout(saat);
      try { if (istek) istek.destroy(); } catch {}
      coz(deger);
    };
    const saat = setTimeout(() => son(true), 1500);
    try {
      istek = http.get({ host: '127.0.0.1', port: sahip.port, path: '/', agent: false, headers: { accept: 'text/html' } }, (yanit) => {
        yanit.resume();
        son(/^ai-infapp\//.test(String(yanit.headers['x-ai-infapp'] || '')));
      });
      istek.on('error', () => son(false));
    } catch {
      son(false);
    }
  });
}

async function claimInstance() {
  for (let deneme = 0; deneme < 2; deneme++) {
    try {
      const fd = fs.openSync(INSTANCE_FILE, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, port: PORT, at: new Date().toISOString() }), 'utf8');
      fs.closeSync(fd);
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      let sahip = null;
      try {
        sahip = JSON.parse(fs.readFileSync(INSTANCE_FILE, 'utf8'));
      } catch {
        // Okunamayan kilit bayat sayilir.
      }

      let yasiyor = false;
      if (sahip && sahip.pid && sahip.pid !== process.pid) {
        try {
          process.kill(sahip.pid, 0); // sinyal gondermez, sadece varligi sorar
          yasiyor = true;
        } catch (killErr) {
          yasiyor = killErr.code === 'EPERM'; // surec var ama sinyal yetkisi yok
        }
      }

      // PID canli ama baska bir surece ait olabilir (PID yeniden kullanimi). Kilit cok tazeyse (sahip
      // henuz portu acmamis olabilir) devralmak iki ornek demek: dokunma. Degilse portu yokla.
      if (yasiyor) {
        const yas = Date.now() - Date.parse(sahip.at);
        const taze = Number.isFinite(yas) && yas >= 0 && yas < 10000;
        if (!taze && sahip.port && !(await sahipPanelMi(sahip))) yasiyor = false;
      }

      if (yasiyor) {
        console.error('');
        console.error('  [HATA] Bu klasorde zaten bir panel calisiyor.');
        console.error(`         PID ${sahip.pid} · http://localhost:${sahip.port || PORT}`);
        console.error('');
        console.error('         Ayni data/ klasorune iki sunucu yazarsa galeri kareleri');
        console.error('         kaybolur ve karakter dosyasi bozulabilir. Ikinci ornek');
        console.error('         BASLATILMADI.');
        console.error('');
        console.error('         Acik olani kullan, ya da once onu kapat (Ctrl+C).');
        console.error('');
        process.exit(1);
      }

      // Sahibi olmus - bayat kilidi temizle ve bir kez daha dene.
      try { fs.unlinkSync(INSTANCE_FILE); } catch {}
    }
  }
}

function releaseInstance() {
  try {
    const sahip = JSON.parse(fs.readFileSync(INSTANCE_FILE, 'utf8'));
    if (sahip && sahip.pid === process.pid) fs.unlinkSync(INSTANCE_FILE);
  } catch {}
}

// Kilit asenkron (sahip panel mi diye porta bakilabilir); dinleme kilit alinincaya kadar baslamaz.
// releaseInstance yalniz kendi PID'imizi tasiyan kilidi siler, bu yuzden kayitlar once yapilabilir.
const sahiplendi = claimInstance();
process.on('exit', releaseInstance);
for (const sinyal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sinyal, () => {
    releaseInstance();
    process.exit(0);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[HATA] ${PORT} portu dolu - panel muhtemelen zaten acik.`);
    console.error(`        http://localhost:${PORT} adresini dene.`);
    console.error('');
    console.error('        Baska bir port acmak COZUM DEGIL: ayni klasorden ikinci bir');
    console.error('        panel calistirmak galeri kareni kaybettirir. Once acik olani kapat.\n');
    process.exit(1);
  }
  console.error('\n[HATA] Sunucu hatasi:', err.message, '\n');
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[uyari] Yakalanmamis hata:', err && err.message ? err.message : err);
});

/* GLIF OLCUMU - acilista bir kez, ARKA PLANDA.
 * Gomulu tablo Windows'ta olculdu; baska isletim sisteminde ayni adli font
 * olmayabilir ve harf genislikleri degisir. Ilk acilista sistemdeki gercek
 * fontlar olculup onbellege aliniyor. Kullaniciyi BEKLETMIYOR: olcum bitene
 * kadar gomulu yedek kullanilir. */
setTimeout(() => {
  try {
    const glifler = require('./src/glifler');
    if (glifler.olculmusTablo()) return;   // zaten olculmus
    glifler.olcVeKaydet()
      .then((t) => { if (t) console.log('   [olcum] Yazi tipleri bu sistemde olculdu, tablo guncellendi.'); })
      .catch(() => { /* Chrome yoksa gomulu yedek zaten calisiyor */ });
  } catch {}
}, 1500);

const dinle = () => server.listen(PORT, '127.0.0.1', () => {
  const character = store.getCharacter();
  const { spec } = activeProvider();
  const refStatus = character ? reference.status(character) : null;
  console.log('');
  console.log('  ================================================');
  console.log('   AI INFAPP - AI influencer karakter otomasyonu');
  console.log('  ================================================');
  console.log(`   Panel      : http://localhost:${PORT}`);
  console.log(`   Karakter   : ${character ? `${character.identity.name} (@${character.identity.handle}) - KILITLI` : 'yok - sihirbaz acilacak'}`);
  if (refStatus) console.log(`   Vesikalik  : ${refStatus.done}/${refStatus.total} aci`);
  console.log(`   Uretici    : ${spec.label}`);
  if (!store.getAppState().welcomeSeen) {
    console.log('');
    console.log('   Ilk calistirma: panelde kisa bir karsilama ekrani cikacak.');
  }
  if (spec.id === 'manual') {
    console.log('');
    console.log('   ! Bagli gorsel uretim API\'si yok.');
    console.log('     Bu otomasyon kendi basina gorsel URETMEZ, stok gorsel de kullanmaz.');
    console.log('     Panelde Ayarlar > Gorsel Uretim bolumunden bir platform sec.');
  }
  console.log('');
  console.log('   Kapatmak icin Ctrl+C');
  console.log('');
});

sahiplendi.then(dinle).catch((err) => {
  console.error('\n[HATA] Panel baslatilamadi:', err && err.message ? err.message : err, '\n');
  process.exit(1);
});
