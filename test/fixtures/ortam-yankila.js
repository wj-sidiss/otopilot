// test/fixtures/ortam-yankila.js — test/fikstur-kararlilik.test.js'in alt sureci (betikCalistir yerine gercek betik olmasin diye).
// Ortamdan VIDEO_KODEK ve RENDER_OLCEK'i tek satir JSON olarak yazar; "--bekle" verilirse kendiliginden kapanmaz (oldurulmeyi bekler).
// Dosyaya, aga, uretim/'e dokunmaz.
"use strict";
const deger = ad => (process.env[ad] === undefined ? null : process.env[ad]);
process.stdout.write(JSON.stringify({ VIDEO_KODEK: deger("VIDEO_KODEK"), RENDER_OLCEK: deger("RENDER_OLCEK") }) + "\n");
if (process.argv.includes("--bekle")) setInterval(() => {}, 1000);
