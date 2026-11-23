'use strict';

/**
 * AYNA: sag taraf acilarini modele sormak yerine sol taraf karesinden uretir.
 *
 * Neden: damitilmis modeller (Pollinations "sana") "sol/sag" ayrimini dinlemiyor; sol ceyrek ile sag ceyrek ayni kare, iki profil de
 * ayni yone bakiyor. Yatay cevirme ise KESIN zit yon verir ve ikinci bir model cagrisi gerektirmez; ustelik ayni kisi/ayni sac kalir
 * (kimlik tutarliligi ayri ayri uretmekten iyidir). Bedeli: yuzdeki dogal asimetri (ben, fark) aynalanir.
 *
 * ffmpeg kullanir (repo kokundeki ff-yol.js); ffmpeg yoksa null doner ve cagiran normal uretime duser.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

/** Aynadan uretilecek aci -> kaynak aci */
const KAYNAK = Object.freeze({ quarter_right: 'quarter_left', profile_right: 'profile_left' });

function ffmpegYolu() {
  try { return require(path.join(__dirname, '..', '..', 'ff-yol.js')).ffmpeg; } catch (e) { return null; }
}

/** Gorsel tamponunu yatay cevirir. Donus: { buffer, ext } ya da null (ffmpeg yok / hata). */
function cevir(buffer, ext) {
  const ff = ffmpegYolu();
  if (!ff || !buffer || !buffer.length) return null;
  const uzanti = /^(jpe?g|png|webp)$/i.test(ext || '') ? ext.toLowerCase() : 'png';
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'ayna-'));
  try {
    const girdi = path.join(klasor, 'in.' + uzanti), cikti = path.join(klasor, 'out.' + uzanti);
    fs.writeFileSync(girdi, buffer);
    const r = spawnSync(ff, ['-v', 'error', '-y', '-i', girdi, '-vf', 'hflip', '-q:v', '2', cikti], { windowsHide: true, timeout: 30000 });
    if (r.status !== 0 || !fs.existsSync(cikti)) return null;
    return { buffer: fs.readFileSync(cikti), ext: uzanti === 'jpeg' ? 'jpg' : uzanti };
  } catch (e) {
    return null;
  } finally {
    fs.rmSync(klasor, { recursive: true, force: true });
  }
}

module.exports = { KAYNAK, cevir };
