// AI STUDYO: ne istersen -- yazdigin istemden video, fotografindan video, kendi videonu donusturme; istersen cizgi film/anime/3D/kil stili (vidIQ ile; KREDI HARCAR, varsayilan KURU CALISMA).
//   Stil "serbest" = ek stil yok, istem aynen gider. Fotograf gerekmez: node studyo.js sahne <ad> "istem" ile yalniz metinden sahne eklenir.
//   node studyo.js stiller                                  hazir stiller (cizgi-film, anime, 3d-animasyon, kil, suluboya, cizgi-roman, gercekci)
//   node studyo.js yeni <ad> [--stil cizgi-film] [--oran 9:16|16:9] [--model minimax-h3] [--sure 6]
//   (fotograflari ve videolari uretim/<ad>/girdi/ icine koy; dosya adi sirasi = film sirasi)
//   node studyo.js 3b <ad> urun|dunya|karakter [--baslik ".."] [--alt ".."] [--renk "#c8f53a"] [--on-ayar ogretmen] [--sure 5] [--anlatim ".."]   3B sahne (UCRETSIZ, yerel three.js; karakterin agzi anlatim sesinden)
//   node studyo.js 3b-sablonlar | 3b-kur (three.js'i bir kez indirir)
//   node studyo.js yuz <ad> --sablon yuz/poz.jpg --kisi yuz/sol.jpg,yuz/sag.jpg --riza   yerel FaceFusion ile poz fotografindaki yuzleri degistirir (ucretsiz; .env FACEFUSION_KOK; kisiler soldan saga)
//   node studyo.js sablonlar | sablon <ad> romantik|aksiyon|gerilim [--foto a.jpg,b.jpg]   hazir cekim listesi (yonetmen modu); fotograf verilirse referans olur
//   Yonetmen modu: sahnede "plan", "kameraHareketi", "lens", "isik" (kodlar studyo.js YONETMEN) -> Ingilizce sinema dili istemin sonuna eklenir
//   node studyo.js sahne <ad> "istem" [--sure 6]            fotografsiz sahne: yalniz yazdigin istemden video
//   node studyo.js tara <ad>                                girdi/'deki yeni dosyalari sahne olarak studyo.json'a ekler
//   node studyo.js uret <ad> --butce 400 [--onay] [--yeni-cekim]   maliyeti yazar; --onay ile klipleri uretir (vidiq-klip korumalari)
//   node studyo.js kur <ad> [--muzik yol.mp3] [--altyazisiz]  klipleri sirayla birlestirir -> uretim/<ad>/Videos/<ad>.mp4
//   Kamera gorunumu: yeni <ad> --kamera sinema|film|temiz (varsayilan sinema; kur --kamerasiz ile bir kereligine kapatilir)
//   Anlatim: sahnede "anlatim": "metin" (<=600 kr) varsa UCRETSIZ seslendirilir (Edge, olmazsa sistem sesi; dil: studyo.json "dil", ses: "ses"),
//   sahne anlatimdan kisaysa klip dongulenir, altyazi yakilir, --muzik anlatimin altina karisir. Anlatimsiz film eskisi gibi sessizdir.
// Sahne modlari (studyo.json "sahneler"[].mod):
//   referans  foto karakter/stil referansi olur, sahne secilen stilde YENIDEN cizilir (cizgi film/anime icin varsayilan)
//   ilk-kare  foto videonun ilk karesi olur, oldugu gibi canlanir (gercekci icin varsayilan)
//   metin     fotograf yok: "hareket" alanindaki istem (Ingilizce) videoya cevrilir
//   video     "url": kendi videonun https/YouTube adresi -> vidIQ'ya ucretsiz yuklenir, hareketi korunarak stile cevrilir (minimax-h3/gemini-omni-flash)
// girdi/'deki yerel video dosyasindan "an" saniyesindeki kare alinir ve referans olarak kullanilir (vidIQ yerel videoyu okuyamaz).
// "hareket": Ingilizce, sahnede ne olacagi; "sure": sn. "karakter": tum referans sahnelerine eklenen ortak yuz fotograflari (girdi/ icinde).
// IZIN: yalniz kendi fotografin/videon ya da yazili izin verilen kisi; telifli film sahnesi DEGIL (kendi cekimin). Yayinda "yapay zeka" etiketi.
// Cikis: 0 tamam/kuru calisma · 2 girdi/ayar · 3 vidIQ/ag · 7 butce.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const ortak = require("./lib/ortak.js");
const K = require("./lib/vidiq-klip.js");

const STILLER = {
  serbest: { ad: "Serbest (ne istersen)", metin: "", mod: "ilk-kare" },
  "cizgi-film": { ad: "Çizgi film", metin: "2D hand-drawn cartoon animation style, bold clean outlines, flat vibrant colors, expressive faces", mod: "referans" },
  anime: { ad: "Anime", metin: "Japanese anime style animation, cel shading, detailed painted background, dynamic lighting", mod: "referans" },
  "3d-animasyon": { ad: "3D animasyon", metin: "3D animated feature film style, stylized characters, soft global illumination, rich colors", mod: "referans" },
  kil: { ad: "Kil animasyon", metin: "claymation stop-motion style, handmade clay textures, miniature set", mod: "referans" },
  suluboya: { ad: "Suluboya", metin: "watercolor illustrated animation, soft paper texture, gentle brush strokes", mod: "referans" },
  "cizgi-roman": { ad: "Çizgi roman", metin: "comic book style animation, ink lines, halftone shading, bold colors", mod: "referans" },
  gercekci: { ad: "Gerçekçi", metin: "photorealistic, natural motion, cinematic lighting, shallow depth of field", mod: "ilk-kare" },
};
const MODLAR = ["referans", "ilk-kare", "video", "metin", "3b"];
// 3B SAHNE (ucretsiz, yerel): three.js sablonlari (urun platformu, dunya + ucus yaylari, konusan 3B karakter); vidIQ kredisi harcamaz, kur'da cizilir.
const S3D = () => require("./lib/sahne3d.js");
const HEX = /^#[0-9a-fA-F]{6}$/;
const GLB = /^[A-Za-z0-9._-]{1,100}\.glb$/;
// Ses seviyesi (EBU R128, iki gecis): kisa video platformlari (Shorts/Reels/TikTok/YouTube) icin -14 LUFS, tepe <= -1.5 dBTP.
// Yontem: motionforge tools/loudness.sh fikri (olc, sonra olculen degerlerle dogrusal kazanc); kod bize ait.
function sesNormalle(girdi, cikti, hedef) {
  const SD = require("./lib/ses-denge"), I = hedef || SD.HEDEF.I, TP = SD.HEDEF.TP, LRA = SD.HEDEF.LRA;
  const olc = spawnSync(ff().ffmpeg, ["-hide_banner", "-nostats", "-i", girdi, "-vn", "-af", "loudnorm=I=" + I + ":TP=" + TP + ":LRA=" + LRA + ":print_format=json", "-f", "null", "-"], { encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(String(olc.stderr || ""));
  if (!m) throw hata("Ses seviyesi ölçülemedi.");
  const o = JSON.parse(m[0]);
  if (!Number.isFinite(Number(o.input_i))) throw hata("Videoda duyulur ses yok (sessiz).");
  const f = "loudnorm=I=" + I + ":TP=" + TP + ":LRA=" + LRA + ":measured_I=" + o.input_i + ":measured_TP=" + o.input_tp + ":measured_LRA=" + o.input_lra + ":measured_thresh=" + o.input_thresh + ":offset=" + o.target_offset + ":linear=true";
  ffmpeg(["-i", girdi, "-c:v", "copy", "-af", f, "-c:a", "aac", "-b:a", "160k", "-ar", "44100", cikti], "ses seviyesi");
  return { once: Number(o.input_i), hedef: I };
}
// Kontrol sayfasi: filmden esit aralikli 12 kare tek JPG (once bak, sonra yayinla; metin tasmasi, bos sahne, kopuk kare).
function kontrolSayfasi(video, cikti, sure) {
  const fps = Math.max(0.05, 12 / Math.max(1, sure)).toFixed(4);
  ffmpeg(["-i", video, "-vf", "fps=" + fps + ",scale=270:-2,tile=4x3:padding=4:margin=4:color=0x111111", "-frames:v", "1", "-q:v", "3", cikti], "kontrol sayfası");
}
// YONETMEN MODU: sahne basina plan / kamera hareketi / lens / isik (Ingilizce sinema dili istem sonuna eklenir) + hazir cekim sablonlari.
const YONETMEN = {
  plan: {
    genis: ["Geniş plan", "wide establishing shot"], orta: ["Orta plan", "medium shot"], yakin: ["Yakın plan", "close-up shot"],
    "cok-yakin": ["Çok yakın (detay)", "extreme close-up shot"], omuz: ["Omuz üstü", "over-the-shoulder shot"], ikili: ["İkili plan", "two-shot framing both characters"],
    "alt-aci": ["Alttan çekim", "low angle shot"], "ust-aci": ["Üstten çekim", "high angle shot"], pov: ["Göz hizası (POV)", "point-of-view shot"], siluet: ["Siluet", "silhouette shot against the light"],
  },
  hareket: {
    sabit: ["Sabit kamera", "static locked-off camera"], yaklas: ["Yavaş yaklaşma", "slow push-in"], uzaklas: ["Yavaş uzaklaşma", "slow pull-out"], pan: ["Yatay pan", "smooth pan"],
    tilt: ["Yukarı tilt", "gentle tilt up"], takip: ["Takip çekimi", "tracking shot following the subject"], dolly: ["Dolly", "smooth dolly move"], vinc: ["Vinç yükselişi", "crane shot rising"],
    elde: ["Elde kamera", "handheld camera with subtle shake"], orbit: ["Etrafında dönüş", "slow orbit around the subject"],
    "dolly-zoom": ["Dolly zoom (vertigo)", "dolly zoom, vertigo effect: the subject keeps its size while the background stretches"], "rack-focus": ["Odak kaydırma", "rack focus from the foreground to the background"],
    "geri-acilis": ["Detaydan geri açılış", "starts on a close detail and pulls back to reveal the wider scene"], fpv: ["FPV uçuş", "fast FPV drone fly-through with banking turns"],
    "yavas-cekim": ["Ağır çekim", "slow motion, time stretched"], hizlandirilmis: ["Hızlandırılmış (time-lapse)", "time-lapse, time passing quickly"], "vinc-asagi": ["Vinç alçalışı", "crane shot descending to eye level"],
  },
  lens: {
    "24": ["24mm geniş açı", "24mm wide-angle lens"], "35": ["35mm", "35mm lens"], "50": ["50mm doğal", "50mm lens, natural perspective"],
    "85": ["85mm portre (bokeh)", "85mm portrait lens, shallow depth of field, creamy bokeh"], anamorfik: ["Anamorfik", "anamorphic lens, horizontal flares, cinematic widescreen look"],
    balikgozu: ["Balık gözü", "fisheye lens, ultra-wide barrel distortion"], "tilt-shift": ["Tilt-shift (minyatür)", "tilt-shift lens, miniature effect with a sharp band"], flare: ["Lens flare", "lens flare from a bright light source"],
  },
  isik: {
    altin: ["Altın saat", "golden hour warm backlight"], mavi: ["Mavi saat", "blue hour soft twilight"], neon: ["Gece neon", "night scene with neon lights"],
    bulutlu: ["Bulutlu yumuşak", "soft overcast daylight"], mum: ["Mum ışığı", "warm candlelight"], arkadan: ["Arkadan güneş", "sun flare backlight"],
    rembrandt: ["Rembrandt", "Rembrandt lighting, key light high at 45 degrees with a small triangle of light on the shadow cheek"], kelebek: ["Kelebek (güzellik)", "butterfly lighting, high frontal soft key, small shadow under the nose"],
    yari: ["Yarım yüz ışık", "split lighting, side light illuminating half the face"], "high-key": ["High-key (aydınlık)", "high-key lighting, bright and airy, lifted shadows"], "low-key": ["Low-key (noir)", "low-key lighting, mostly dark with one pool of light, noir mood"],
    "teal-turuncu": ["Teal ve turuncu", "teal and orange color grade, cool shadows and warm skin tones"], "siyah-beyaz": ["Siyah beyaz", "black and white, high contrast monochrome"], sizinti: ["Işık sızıntısı", "warm light leak drifting in from the frame edge"],
  },
};
const YONETMEN_ALANLAR = { plan: "plan", kameraHareketi: "hareket", lens: "lens", isik: "isik" };

// GECISLER: sahne sonrasi gecis (ffmpeg xfade; ucretsiz). Kod -> [ad, xfade adi, sure sn]. "kes" = dogrudan kesme.
const GECISLER = {
  kes: ["Kesme", "", 0], cozul: ["Çözülme (dissolve)", "fade", 0.6], siyah: ["Siyaha kararma", "fadeblack", 0.8], beyaz: ["Beyaz parlama", "fadewhite", 0.5],
  kaydir: ["Kaydırma", "slideleft", 0.5], whip: ["Whip pan (hızlı savruluş)", "slideleft", 0.22], silme: ["Silme", "wipeleft", 0.6],
  daire: ["Daire açılışı (iris)", "circleopen", 0.8], "daire-kapan": ["Daire kapanışı (iris)", "circleclose", 0.8], zoom: ["Zoom geçişi", "zoomin", 0.7],
  piksel: ["Piksel", "pixelize", 0.7], radyal: ["Radyal silme", "radial", 0.8], bulanik: ["Bulanık geçiş", "hblur", 0.5],
};
// Geciskili birlestirme grafigi: her sahne bitisinde kuyruk kadar son kareyi uzatir, sonraki sahne tam sahne baslangicinda gecisle girer;
// boylece anlatim sesi ve altyazi zamanlari DEGISMEZ. Ses sahne sahne kirpilip birlestirilir. Hic gecis yoksa null (eski concat yolu).
function gecisGrafigi(sureler, gecisler, sesVar) {
  const n = sureler.length;
  const gec = i => {
    const k = (gecisler || [])[i];
    if (i >= n - 1 || !k || k === "kes" || !GECISLER[k]) return null;
    return { ad: GECISLER[k][1], sn: Math.max(0.1, Math.min(GECISLER[k][2], sureler[i] * 0.5, sureler[i + 1] * 0.5)) };
  };
  if (n < 2 || !sureler.some((_, i) => gec(i))) return null;
  const f = [];
  for (let i = 0; i < n; i++) {
    const g = gec(i);
    f.push("[" + i + ":v]" + (g ? "tpad=stop_mode=clone:stop_duration=" + g.sn.toFixed(3) + "," : "") + "setpts=PTS-STARTPTS[v" + i + "]");
  }
  let cur = "v0", basla = 0;
  for (let i = 0; i < n - 1; i++) {
    basla += sureler[i];
    const g = gec(i), cikis = i === n - 2 ? "vout" : "x" + i;
    f.push(g ? "[" + cur + "][v" + (i + 1) + "]xfade=transition=" + g.ad + ":duration=" + g.sn.toFixed(3) + ":offset=" + basla.toFixed(3) + "[" + cikis + "]"
      : "[" + cur + "][v" + (i + 1) + "]concat=n=2:v=1:a=0[" + cikis + "]");
    cur = cikis;
  }
  if (sesVar) {
    for (let i = 0; i < n; i++) f.push("[" + i + ":a]atrim=0:" + sureler[i].toFixed(3) + ",asetpts=PTS-STARTPTS[a" + i + "]");
    f.push(sureler.map((_, i) => "[a" + i + "]").join("") + "concat=n=" + n + ":v=0:a=1[aout]");
  }
  return { filtre: f.join(";"), harita: ["-map", "[vout]"].concat(sesVar ? ["-map", "[aout]"] : []) };
}
const SABLONLAR = {
  // TUR PAKETLERI: kisi 0/1 = ilk/ikinci foto (erkek/kadin), 2 = ikisi birlikte (cift fotosu varsa o, yoksa donusumlu). gecis = bu sahneden sonrakine.
  yesilcam: { anlatimTaslak: {"tr": ["İstanbul'a döndüğü akşam elinde tek bir bavul vardı.", "Yıllar geçmişti ama o iskeleyi unutamamıştı.", "O ise hâlâ aynı yerde bekliyordu.", "Bir bakış, söylenmemiş her şeyi anlattı.", "Ama yıllar aralarına kolay aşılmayacak bir duvar örmüştü.", "Gözyaşı, sözden önce davrandı.", "Yağmur başladığında ikisi de koşuyordu.", "Vapur düdük çaldı. Bu sefer kimse gitmedi."], "en": ["He came back to Istanbul one evening with a single suitcase.", "Years had passed, but he never forgot that pier.", "She was still waiting in the same place.", "One look said everything they had never said.", "But the years had built a wall between them.", "The tear came before the words.", "When the rain started, they were both running.", "The ferry horn sounded. This time, no one left."]}, ad: "Yeşilçam melodramı (8 çekim)", kamera: "film", stilEki: "1970s Turkish Yesilcam cinema look, melodrama, saturated warm film colors, soft focus, grainy 35mm film", sahneler: [
    { hareket: "an old Istanbul street by the Bosphorus at dusk, the man walks alone carrying a worn suitcase", plan: "genis", kameraHareketi: "takip", isik: "altin", kisi: 0, gecis: "cozul" },
    { hareket: "the man's eyes fill with tears as he remembers the past, dramatic zoom on his face", plan: "yakin", kameraHareketi: "yaklas", lens: "85", isik: "altin", kisi: 0, gecis: "cozul" },
    { hareket: "the woman waits at a ferry pier, the wind in her hair, she turns and sees the man", plan: "orta", kameraHareketi: "yaklas", lens: "50", isik: "altin", kisi: 1, gecis: "zoom" },
    { hareket: "the two face each other at the pier, time stops, a long silent look", plan: "ikili", kameraHareketi: "sabit", lens: "50", kisi: 2, gecis: "cozul" },
    { hareket: "they quarrel painfully, the woman turns away in anguish and the man reaches out", plan: "omuz", kameraHareketi: "elde", lens: "35", kisi: 2, gecis: "siyah" },
    { hareket: "a single tear rolls down the woman's cheek", plan: "cok-yakin", kameraHareketi: "yaklas", lens: "85", isik: "mum", kisi: 1, gecis: "cozul" },
    { hareket: "rain pours on the empty pier, the man stands alone in the rain, then runs toward the woman and they embrace", plan: "genis", kameraHareketi: "takip", isik: "bulutlu", kisi: 2, gecis: "cozul" },
    { hareket: "the ferry horn sounds as the couple stand together at sunset, final frame", plan: "siluet", kameraHareketi: "uzaklas", isik: "arkadan", kisi: 2, gecis: "kes" },
  ] },
  bilimkurgu: { anlatimTaslak: {"tr": ["Yıl 2187. Şehir hiç uyumuyordu.", "Haritada tek bir nokta yanıp sönüyordu: dönüşü olmayan bir rota.", "Solucan deliğine girdikleri an zaman yön değiştirdi.", "Ekrandaki sayılar yanlıştı. Ya da artık doğru olan buydu.", "İki ay, bir vadi ve ikisinden başka kimse.", "Drone onları buldu.", "Koridor arkalarında çöküyordu.", "İki güneş doğdu. Eve dönmek artık bir seçenek değildi."], "en": ["The year is 2187. The city never sleeps.", "One dot blinked on the map: a route with no way back.", "The moment they entered the wormhole, time changed direction.", "The numbers on the screen were wrong. Or maybe this was the new right.", "Two moons, one valley, and no one else.", "The drone found them.", "The corridor collapsed behind them.", "Two suns rose. Going home was no longer an option."]}, ad: "Bilim kurgu (8 çekim)", kamera: "sinema", stilEki: "cinematic science fiction film, anamorphic lens look, teal and orange color grade, volumetric light, photorealistic", sahneler: [
    { hareket: "a vast futuristic megacity at night with flying vehicles between glowing towers", plan: "genis", kameraHareketi: "vinc", isik: "neon", gecis: "kaydir" },
    { hareket: "the man and the woman in sleek space suits stand on a starship bridge looking at a hologram map", plan: "ikili", kameraHareketi: "orbit", lens: "35", isik: "mavi", kisi: 2, gecis: "cozul" },
    { hareket: "first-person view from the pilot seat as the ship accelerates into a glowing wormhole", plan: "pov", kameraHareketi: "fpv", lens: "24", isik: "neon", gecis: "beyaz" },
    { hareket: "the woman's face lit by blue holographic displays, she realizes something is wrong", plan: "yakin", kameraHareketi: "yaklas", lens: "85", isik: "mavi", kisi: 1, gecis: "kes" },
    { hareket: "an alien planet with two moons, the couple stands on a cliff above a glowing valley", plan: "genis", kameraHareketi: "geri-acilis", isik: "altin", kisi: 2, gecis: "whip" },
    { hareket: "the man fires an energy weapon at a hovering combat drone, sparks fly", plan: "alt-aci", kameraHareketi: "elde", lens: "24", isik: "neon", kisi: 0, gecis: "kes" },
    { hareket: "they run through a collapsing corridor as explosions follow behind them", plan: "orta", kameraHareketi: "takip", lens: "24", isik: "mum", kisi: 2, gecis: "siyah" },
    { hareket: "the two look at a double sunrise over the alien planet, calm after the storm", plan: "siluet", kameraHareketi: "uzaklas", isik: "arkadan", kisi: 2, gecis: "kes" },
  ] },
  fantastik: { anlatimTaslak: {"tr": ["Bulutların üstünde unutulmuş bir krallık vardı.", "Bir şövalye ve bir büyücü. Aynı yolda, farklı sebeplerle.", "Kılıç yüz yıldır kimseye bu kadar kolay çıkmamıştı.", "Ejderhanın sırtında fırtınayı geçtiler.", "Büyü onun avuçlarında uyandı.", "Kapının önünde ejderha ile şövalye göz göze geldi.", "Karanlık askerler geldiğinde yan yana durdular.", "Güneş doğduğunda krallık hâlâ ayaktaydı."], "en": ["Above the clouds stood a forgotten kingdom.", "A knight and a sorceress. The same road, different reasons.", "In a hundred years, the sword had never come out this easily.", "They crossed the storm on a dragon's back.", "The spell woke in her hands.", "At the gate, the dragon and the knight met eye to eye.", "When the dark soldiers came, they stood side by side.", "When the sun rose, the kingdom was still standing."]}, ad: "Fantastik / destan (8 çekim)", kamera: "sinema", stilEki: "epic high fantasy film, painterly golden light, drifting mist, detailed practical-looking costumes, shot on 35mm", sahneler: [
    { hareket: "a vast mountain kingdom with a castle above the clouds at dawn", plan: "genis", kameraHareketi: "vinc", isik: "altin", gecis: "cozul" },
    { hareket: "the man as a knight in worn armor and the woman as a sorceress in a hooded cloak walk through an ancient misty forest", plan: "ikili", kameraHareketi: "takip", lens: "35", isik: "bulutlu", kisi: 2, gecis: "cozul" },
    { hareket: "the man draws a glowing sword from an old stone, light spills over his face", plan: "yakin", kameraHareketi: "yaklas", lens: "50", isik: "altin", kisi: 0, gecis: "beyaz" },
    { hareket: "first-person view flying on a dragon's back through storm clouds toward the castle", plan: "pov", kameraHareketi: "fpv", lens: "24", gecis: "kes" },
    { hareket: "the woman casts a spell, her hands glowing, wind whipping her cloak", plan: "orta", kameraHareketi: "orbit", lens: "35", isik: "neon", kisi: 1, gecis: "whip" },
    { hareket: "a giant dragon lands in front of the gate, the knight steps forward alone", plan: "alt-aci", kameraHareketi: "sabit", lens: "24", isik: "arkadan", kisi: 0, gecis: "siyah" },
    { hareket: "sparks and fire as the knight and the sorceress fight side by side against dark soldiers", plan: "orta", kameraHareketi: "elde", lens: "35", isik: "mum", kisi: 2, gecis: "cozul" },
    { hareket: "the two stand victorious on the castle wall as the sun rises over the kingdom", plan: "siluet", kameraHareketi: "uzaklas", isik: "arkadan", kisi: 2, gecis: "kes" },
  ] },
  "aksiyon-filmi": { anlatimTaslak: {"tr": ["Gece pazarında yalnızca bir araba bu kadar hızlı gidebilirdi.", "Aynada aynı farlar. Üç sokaktır peşlerindeydiler.", "Bir çatı, bir boşluk, bir karar.", "Aşağısı yirmi kattı. Bırakmak bir seçenek değildi.", "Koridor dardı. Kaçacak yer yoktu.", "Arkalarındaki patlamaya dönüp bakmadılar.", "Sırt sırta. Etrafları sarılmıştı.", "Şafak söktüğünde ikisi de ayaktaydı."], "en": ["Only one car could move that fast through the night market.", "Same headlights in the mirror. Three streets now.", "A rooftop, a gap, a decision.", "Twenty floors down. Letting go was not an option.", "The corridor was narrow. Nowhere to run.", "They did not look back at the explosion.", "Back to back. Surrounded.", "When dawn broke, both of them were still standing."]}, ad: "Aksiyon filmi (8 çekim)", kamera: "sinema", stilEki: "high-budget action thriller, gritty handheld camera, motion blur, teal and orange grade, photorealistic", sahneler: [
    { hareket: "a black car speeds through a crowded night market, sparks flying as it scrapes a wall", plan: "genis", kameraHareketi: "takip", lens: "24", isik: "neon", gecis: "kes" },
    { hareket: "the woman at the wheel, eyes locked on the mirror, gripping the steering wheel", plan: "cok-yakin", kameraHareketi: "elde", lens: "50", isik: "neon", kisi: 1, gecis: "kes" },
    { hareket: "first-person view running along a rooftop, then jumping across a gap between buildings", plan: "pov", kameraHareketi: "elde", lens: "24", gecis: "whip" },
    { hareket: "the man hangs from a ledge with one hand, the street far below, then pulls himself up", plan: "ust-aci", kameraHareketi: "vinc-asagi", lens: "24", kisi: 0, gecis: "kes" },
    { hareket: "a close fight in a narrow corridor, the man blocks a punch and throws one back", plan: "orta", kameraHareketi: "elde", lens: "35", isik: "mum", kisi: 0, gecis: "beyaz" },
    { hareket: "slow motion: the couple walks away as a car explodes behind them without looking back", plan: "orta", kameraHareketi: "yavas-cekim", lens: "50", isik: "neon", kisi: 2, gecis: "siyah" },
    { hareket: "a tense standoff, the man and the woman back to back surrounded by armed men", plan: "ikili", kameraHareketi: "orbit", lens: "35", isik: "mavi", kisi: 2, gecis: "kes" },
    { hareket: "they step out of the smoke at dawn, battered but alive, and look at each other", plan: "ikili", kameraHareketi: "yaklas", lens: "85", isik: "altin", kisi: 2, gecis: "kes" },
  ] },
  // TEKNIK PAKETLERI: ayri bir film turu degil, bir cekim dilini ogretir (kendi cumlelerimizle; belirli bir filmden sahne/kare yok)
  simetri: { ad: "Teknik: simetrik tek nokta perspektif (6 çekim)", stilEki: "perfectly symmetrical centered composition, one-point perspective, pastel color palette, flat frontal staging, deadpan mood", sahneler: [
    { hareket: "a grand hotel lobby seen straight on, perfectly centered, the character stands in the middle of the frame", plan: "genis", kameraHareketi: "sabit", lens: "24", isik: "high-key", kisi: 0, gecis: "kaydir" },
    { hareket: "a long hallway with the character walking away from the camera down the exact center", plan: "genis", kameraHareketi: "yaklas", lens: "24", isik: "high-key", kisi: 1, gecis: "kaydir" },
    { hareket: "two characters sit side by side facing the camera, completely still, staring straight ahead", plan: "ikili", kameraHareketi: "sabit", lens: "35", isik: "high-key", kisi: 2, gecis: "silme" },
    { hareket: "an overhead view of a perfectly arranged table, the character's hands place one object in the center", plan: "ust-aci", kameraHareketi: "sabit", lens: "35", isik: "high-key", kisi: 0, gecis: "kaydir" },
    { hareket: "the camera pans sharply to the side to reveal the second character standing in a doorway", plan: "orta", kameraHareketi: "pan", lens: "35", isik: "high-key", kisi: 1, gecis: "whip" },
    { hareket: "both characters walk toward the camera in step, centered, the background perfectly symmetrical", plan: "ikili", kameraHareketi: "uzaklas", lens: "35", isik: "high-key", kisi: 2, gecis: "kes" },
  ] },
  kesintisiz: { ad: "Teknik: kesintisiz uzun çekim hissi (5 çekim)", stilEki: "continuous long take feel, fluid camera, no cuts, naturalistic lighting, immersive", sahneler: [
    { hareket: "the camera follows the character from behind as they leave a quiet apartment and step into a busy street", plan: "orta", kameraHareketi: "takip", lens: "24", isik: "bulutlu", kisi: 0, gecis: "kes" },
    { hareket: "the camera drifts past the character and slowly orbits to reveal the second character arriving", plan: "ikili", kameraHareketi: "orbit", lens: "35", isik: "bulutlu", kisi: 2, gecis: "kes" },
    { hareket: "the camera follows both characters walking and talking through a market, people crossing in front of the lens", plan: "ikili", kameraHareketi: "takip", lens: "35", isik: "altin", kisi: 2, gecis: "kes" },
    { hareket: "the camera rises on a crane above the crowd while the characters keep walking below", plan: "genis", kameraHareketi: "vinc", lens: "24", isik: "altin", kisi: 2, gecis: "kes" },
    { hareket: "the camera pushes in slowly until the characters fill the frame, a quiet shared glance", plan: "yakin", kameraHareketi: "yaklas", lens: "50", isik: "altin", kisi: 2, gecis: "kes" },
  ] },
  "gerilim-teknigi": { ad: "Teknik: dolly zoom ve POV gerilimi (6 çekim)", stilEki: "suspense thriller cinematography, cold desaturated palette, shallow depth of field, slow deliberate pacing", sahneler: [
    { hareket: "a character stands at the end of a long hotel corridor, unsure whether to walk forward", plan: "genis", kameraHareketi: "sabit", lens: "35", isik: "mavi", kisi: 0, gecis: "cozul" },
    { hareket: "dolly zoom on the character's face as they realize they are not alone, the corridor stretches behind them", plan: "yakin", kameraHareketi: "dolly-zoom", lens: "50", isik: "mavi", kisi: 0, gecis: "kes" },
    { hareket: "first-person view moving slowly toward a half open door, the light from inside spilling out", plan: "pov", kameraHareketi: "yaklas", lens: "24", isik: "mum", gecis: "kes" },
    { hareket: "extreme close-up of the character's eyes reflecting something unseen", plan: "cok-yakin", kameraHareketi: "sabit", lens: "85", isik: "yari", kisi: 1, gecis: "siyah" },
    { hareket: "a shadow passes behind the character as they slowly turn, the focus shifting from them to the empty space behind", plan: "omuz", kameraHareketi: "rack-focus", lens: "85", isik: "mum", kisi: 1, gecis: "kes" },
    { hareket: "the door slams shut, sudden silence, the character alone in the dark corridor", plan: "genis", kameraHareketi: "geri-acilis", lens: "24", isik: "low-key", kisi: 0, gecis: "kes" },
  ] },
  romantik: { ad: "Romantik (6 çekim)", sahneler: [
    { hareket: "a couple walking hand in hand along the seashore, seen from far away", plan: "genis", kameraHareketi: "yaklas", isik: "altin" },
    { hareket: "the couple laughing together while walking, a warm natural moment", plan: "ikili", kameraHareketi: "takip", lens: "35", isik: "altin" },
    { hareket: "close-up of one partner's eyes looking at the other, a soft smile", plan: "yakin", kameraHareketi: "sabit", lens: "85", isik: "altin" },
    { hareket: "two hands slowly intertwining", plan: "cok-yakin", kameraHareketi: "yaklas", lens: "85" },
    { hareket: "the partners look at each other, foreheads almost touching", plan: "omuz", kameraHareketi: "yaklas", lens: "50", isik: "arkadan" },
    { hareket: "the couple embracing as the sun sets", plan: "siluet", kameraHareketi: "uzaklas", isik: "arkadan" },
  ] },
  aksiyon: { ad: "Aksiyon (5 çekim)", sahneler: [
    { hareket: "a car speeds through a narrow city street at night", plan: "genis", kameraHareketi: "takip", isik: "neon" },
    { hareket: "the driver grips the steering wheel, eyes focused", plan: "cok-yakin", kameraHareketi: "elde", lens: "50" },
    { hareket: "a runner leaps across a rooftop gap", plan: "alt-aci", kameraHareketi: "takip", lens: "24" },
    { hareket: "an explosion lights up the street behind the hero walking away", plan: "orta", kameraHareketi: "sabit", isik: "neon" },
    { hareket: "the hero looks up at the skyline", plan: "ust-aci", kameraHareketi: "vinc", lens: "24" },
  ] },
  tanitim: { ad: "Ürün tanıtımı / reklam (5 çekim)", sahneler: [
    { hareket: "the product appears in a bold close-up as the very first frame, grabbing attention", plan: "yakin", kameraHareketi: "yaklas", lens: "85", isik: "kelebek" },
    { hareket: "a person struggles with the problem the product solves, an honest everyday moment", plan: "orta", kameraHareketi: "elde", lens: "35", isik: "bulutlu" },
    { hareket: "the product enters the scene and the problem disappears", plan: "orta", kameraHareketi: "dolly", lens: "50", isik: "high-key" },
    { hareket: "a detail of the product, texture and finish in focus", plan: "cok-yakin", kameraHareketi: "rack-focus", lens: "85", isik: "kelebek" },
    { hareket: "the product on a clean surface, calm final frame with space for text", plan: "genis", kameraHareketi: "sabit", lens: "50", isik: "high-key" },
  ] },
  gerilim: { ad: "Gerilim (5 çekim)", sahneler: [
    { hareket: "an empty corridor with a flickering light", plan: "genis", kameraHareketi: "yaklas", isik: "mavi" },
    { hareket: "a hand slowly reaches for a door handle", plan: "cok-yakin", kameraHareketi: "sabit", lens: "85" },
    { hareket: "the character turns around, sensing someone behind", plan: "omuz", kameraHareketi: "elde", lens: "35", isik: "mavi" },
    { hareket: "a shadow moves across the wall", plan: "orta", kameraHareketi: "pan", isik: "mum" },
    { hareket: "the character's frightened eyes in the dark", plan: "yakin", kameraHareketi: "yaklas", lens: "85", isik: "mum" },
  ] },
};
// Anlatim sesi zinciri (cinecode references/sound.md tarifi): alcak kesim, orta boslugu hafif al, 3 kHz sunum, hafif sikistirma.
const SES_ZINCIRI = "highpass=f=90,equalizer=f=300:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1:g=2,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=150:makeup=3dB";
// Kamera gorunumu: AI klipin "plastik" hissini kirar (gercek kamera gibi tane, vinyet, hafif renk kaymasi/sicaklik). Yalniz ffmpeg; ucretsiz.
const KAMERALAR = {
  temiz: { ad: "Temiz (dokunma)", vf: "" },
  sinema: { ad: "Sinema", vf: "eq=contrast=1.06:saturation=0.9:gamma=0.98,colorbalance=rs=0.04:bs=-0.03:rh=0.05:bh=-0.04,rgbashift=rh=-1:bh=1,unsharp=3:3:0.4,noise=alls=9:allf=t+u,vignette=PI/5,format=yuv420p" },
  vhs: { ad: "VHS / eski kamera kaydı", vf: "eq=saturation=1.25:contrast=0.95,chromashift=crh=3:cbh=-3,gblur=sigma=0.8,noise=alls=22:allf=t+u,vignette=PI/6,format=yuv420p" },
  super8: { ad: "Super 8 (sıcak, titrek tane)", vf: "eq=saturation=0.72:contrast=1.1:brightness=0.02,colorbalance=rs=0.08:bs=-0.08:rm=0.04,gblur=sigma=0.6,noise=alls=28:allf=t+u,vignette=PI/3.5,format=yuv420p" },
  "yumusak-lens": { ad: "Yumuşak lens (eski cam, ışık taşması)", vf: "split[a][b];[b]gblur=sigma=14,eq=brightness=0.03[g];[a][g]blend=all_mode=screen:all_opacity=0.3,eq=saturation=1.05,vignette=PI/5,format=yuv420p" },
  kamkorder: { ad: "90'lar kamkorder (parlak, keskin)", vf: "eq=saturation=1.3:contrast=1.1,unsharp=5:5:1.2,noise=alls=10:allf=t,format=yuv420p" },
  film: { ad: "Film (grenli, solgun)", vf: "eq=contrast=1.04:saturation=0.82:brightness=0.01,colorbalance=rs=0.06:gs=0.01:bs=-0.05:rm=0.03:bm=-0.03,noise=alls=18:allf=t+u,unsharp=3:3:0.3,vignette=PI/4,format=yuv420p" },
};
const FOTO = /\.(jpe?g|png|webp|bmp|heic)$/i, VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i;
const VARSAYILAN_HAREKET = "gentle natural movement, the subject slowly turns and smiles, subtle camera push-in";
const BOYUT = { "9:16": [1080, 1920], "16:9": [1920, 1080] };

const hata = (m, c, cikis) => Object.assign(new Error(m), { cikis: cikis || 2, cozum: c });
const ff = () => require("./ff-yol.js");
// Bellek yetersizse (dolu RAM'de libx264 "Cannot allocate memory") bir kez tek is parcacigiyla yeniden dener.
const BELLEK_HATASI = /Cannot allocate memory|Generic error in an external library|out of memory/i;
function tekIsParcacigi(argv) {
  const a = argv.slice();
  let vardi = false;
  for (let i = 0; i < a.length - 1; i++) if (a[i] === "-threads") { a[i + 1] = "1"; vardi = true; }
  if (!vardi) a.splice(a.length - 1, 0, "-threads", "1");          // cikti dosyasindan hemen once
  return a;
}
function ffmpeg(argv, etiket, enj) {
  const calistir = (enj && enj.spawn) || spawnSync;
  const kos = a => calistir(ff().ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...a], { encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  let r = kos(argv);
  if (r.status !== 0 && BELLEK_HATASI.test(String(r.stderr || ""))) r = kos(tekIsParcacigi(argv));
  if (r.status !== 0) {
    const bellek = BELLEK_HATASI.test(String(r.stderr || ""));
    throw hata("ffmpeg başarısız (" + etiket + "): " + String(r.stderr || "").trim().split("\n").slice(-3).join(" | "),
      bellek ? "Bellek yetersiz: açık programları (özellikle tarayıcı sekmelerini) kapatıp aynı komutu tekrar çalıştır; biten sahneler korunur." : undefined, bellek ? 5 : 2);
  }
}
const dizinOf = ad => ortak.isDizin(ad);

// Gecis onizlemesi: iki desen klip arasinda secilen gecisi gosteren kucuk MP4 (bir kez uretilir, uretim/_gecis/ icinde saklanir; ucretsiz)
function gecisOnizleme(kod) {
  if (!GECISLER[kod] || kod === "kes") throw hata("Önizlemesi olmayan geçiş: " + kod, "Geçerli: " + Object.keys(GECISLER).filter(k => k !== "kes").join(", "));
  const d = path.join(ortak.uretimDizini(), "_gecis");
  fs.mkdirSync(d, { recursive: true });
  const cikti = path.join(d, kod + ".mp4");
  if (fs.existsSync(cikti)) return cikti;
  const gecici = s => path.join(d, "." + process.pid + "-" + crypto.randomBytes(4).toString("hex") + "-" + s);
  const desen = (ad, kaynak) => {
    const y = path.join(d, ad);
    if (fs.existsSync(y)) return y;
    const t = gecici(ad);
    ffmpeg(["-f", "lavfi", "-i", kaynak, "-t", "1.4", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast", t], "geçiş önizleme");
    try { fs.renameSync(t, y); } catch (e) { fs.rmSync(t, { force: true }); }
    return y;
  };
  const a = desen("_a.mp4", "testsrc2=s=320x180:r=30"), b = desen("_b.mp4", "smptehdbars=s=320x180:r=30");
  const g = gecisGrafigi([1.4, 1.4], [kod], false);
  const t = gecici(kod + ".mp4");
  ffmpeg(["-i", a, "-i", b, "-filter_complex", g.filtre, ...g.harita, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", t], "geçiş önizleme");
  try { fs.renameSync(t, cikti); } catch (e) { fs.rmSync(t, { force: true }); }
  return cikti;
}
const ayarYolu = ad => path.join(dizinOf(ad), "studyo.json");

function ayarOku(ad) {
  const y = ayarYolu(ad);
  if (!fs.existsSync(y)) throw hata("studyo.json yok: " + ad, "Önce: node studyo.js yeni " + ad);
  let a;
  try { a = JSON.parse(fs.readFileSync(y, "utf8").replace(/^﻿/, "")); } catch (e) { throw hata("studyo.json okunamadı (" + e.message + ").", "Dosyadaki JSON hatasını düzelt."); }
  if (!STILLER[a.stil]) throw hata("Bilinmeyen stil: " + a.stil, "Geçerli: " + Object.keys(STILLER).join(", "));
  if (!BOYUT[a.oran]) throw hata("Geçersiz oran: " + a.oran, "9:16 ya da 16:9");
  if (!Array.isArray(a.sahneler)) a.sahneler = [];
  a.dil = a.dil || "en";
  a.kamera = a.kamera || "temiz";
  if (!KAMERALAR[a.kamera]) throw hata("Bilinmeyen kamera görünümü: " + a.kamera, "Geçerli: " + Object.keys(KAMERALAR).join(", "));
  if (a.lensProfili !== undefined) {
    const lp = a.lensProfili;
    if (!lp || typeof lp !== "object" || typeof lp.kamera !== "string" || typeof lp.lens !== "string" || lp.kamera.length > 120 || lp.lens.length > 120)
      throw hata("Geçersiz lensProfili.", "{ \"kamera\": \"Apple iPhone XS\", \"lens\": \"...\" } biçiminde olmalı; bul: node studyo.js lens-ara <kelime>");
  }
  if (!/^[a-z]{2}$/.test(a.dil)) throw hata("Geçersiz anlatım dili: " + a.dil, "İki harfli kod: tr, en, es, de, fr…");
  a.sahneler.forEach((s, i) => {
    if (!MODLAR.includes(s.mod)) throw hata("Sahne " + (i + 1) + ": geçersiz mod '" + s.mod + "'.", "Geçerli: " + MODLAR.join(", "));
    for (const [alan, grup] of Object.entries(YONETMEN_ALANLAR))
      if (s[alan] && !YONETMEN[grup][s[alan]]) throw hata("Sahne " + (i + 1) + ": bilinmeyen " + alan + " '" + s[alan] + "'.", "Geçerli: " + Object.keys(YONETMEN[grup]).join(", "));
    if (s.gecis !== undefined && !GECISLER[s.gecis]) throw hata("Sahne " + (i + 1) + ": bilinmeyen geçiş '" + s.gecis + "'.", "Geçerli: " + Object.keys(GECISLER).join(", "));
    if (s.anlatim !== undefined && (typeof s.anlatim !== "string" || s.anlatim.length > 600)) throw hata("Sahne " + (i + 1) + ": 'anlatim' en çok 600 karakterlik metin olmalı.");
    if (s.mod === "3b") {
      const sb = S3D().SABLONLAR;
      if (!sb[s.sablon3d]) throw hata("Sahne " + (i + 1) + ": bilinmeyen 3B şablon '" + s.sablon3d + "'.", "Geçerli: " + Object.keys(sb).join(", "));
      const pr = s.parametre === undefined ? {} : s.parametre;
      if (!pr || typeof pr !== "object" || Array.isArray(pr) || JSON.stringify(pr).length > 4000) throw hata("Sahne " + (i + 1) + ": 'parametre' küçük bir nesne olmalı.");
      for (const k of ["renk", "renk2"]) if (pr[k] !== undefined && !HEX.test(pr[k])) throw hata("Sahne " + (i + 1) + ": " + k + " #rrggbb biçiminde olmalı.");
      if (pr.onAyar !== undefined && !S3D().KARAKTER_AYARLARI.includes(pr.onAyar)) throw hata("Sahne " + (i + 1) + ": onAyar geçerli değil.", "Geçerli: " + S3D().KARAKTER_AYARLARI.join(", "));
      if (pr.glb !== undefined && (typeof pr.glb !== "string" || !GLB.test(pr.glb))) throw hata("Sahne " + (i + 1) + ": glb girdi/ içindeki bir .glb dosya adı olmalı.", "Yalnız harf, rakam, nokta, tire, alt çizgi; örn. urun.glb");
      for (const k of ["baslik", "altBaslik"]) if (pr[k] !== undefined && (typeof pr[k] !== "string" || pr[k].length > 120)) throw hata("Sahne " + (i + 1) + ": " + k + " en çok 120 karakter.");
      return;
    }
    if (s.mod === "metin" ? !String(s.hareket || "").trim() : s.mod === "video" ? !s.url : !s.kaynak) throw hata("Sahne " + (i + 1) + ": " + (s.mod === "metin" ? "'hareket' (istem)" : s.mod === "video" ? "'url'" : "'kaynak'") + " yok.");
  });
  return a;
}
const ayarYaz = (ad, a) => fs.writeFileSync(ayarYolu(ad), JSON.stringify(a, null, 2) + "\n");

// girdi/ altindan cikamayan guvenli yol
function girdiYolu(ad, ad2) {
  const kok = path.join(dizinOf(ad), "girdi");
  const y = path.resolve(kok, String(ad2 || ""));
  if (!y.startsWith(kok + path.sep)) throw hata("Dosya girdi/ klasörünün dışında: " + ad2);
  if (!fs.existsSync(y)) throw hata("Girdi dosyası yok: girdi/" + ad2, "Dosyayı uretim/" + ad + "/girdi/ içine koy.");
  return y;
}

function yeni(ad, b) {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(ad || "")) throw hata("Geçersiz ad: küçük harf, rakam, tire.");
  const stil = b.stil || "cizgi-film", oran = b.oran || "9:16";
  if (!STILLER[stil]) throw hata("Bilinmeyen stil: " + stil, "Geçerli: " + Object.keys(STILLER).join(", "));
  if (!BOYUT[oran]) throw hata("Geçersiz oran: " + oran, "9:16 ya da 16:9");
  const d = dizinOf(ad);
  if (fs.existsSync(path.join(d, "studyo.json"))) throw hata("Bu stüdyo işi zaten var: " + ad, "Başka ad seç ya da 'tara' ile devam et.");
  fs.mkdirSync(path.join(d, "girdi"), { recursive: true });
  const a = { surum: 1, stil, oran, kamera: b.kamera || "sinema", model: b.model || K.VARSAYILAN.model, cozunurluk: b.cozunurluk || (b.model && b.model !== K.VARSAYILAN.model ? "720p" : K.VARSAYILAN.cozunurluk),
    sure: Number(b.sure || 6), karakter: [], sahneler: [] };
  ayarYaz(ad, a);
  return { dizin: d, girdi: path.join(d, "girdi") };
}

// fotografsiz sahne: yalniz yazdigin istemden video (ne istersen)
function sahneEkle(ad, istem, sure) {
  const a = ayarOku(ad);
  if (!String(istem || "").trim()) throw hata("İstem boş.", "Örnek: node studyo.js sahne " + ad + " \"a astronaut walking on mars at sunset, cinematic\"");
  a.sahneler.push({ mod: "metin", hareket: String(istem).trim().slice(0, 3500), sure: Number(sure || a.sure) });
  ayarYaz(ad, a);
  return a.sahneler.length;
}

// tek fotografi sahne olarak ekler (panel yuklemesi); girdi/'deki silinmis sahneler geri gelmesin diye tara() cagrilmaz
function fotoEkle(ad, dosya) {
  const a = ayarOku(ad);
  girdiYolu(ad, dosya);
  a.sahneler.push({ kaynak: dosya, mod: STILLER[a.stil].mod, hareket: VARSAYILAN_HAREKET, sure: a.sure });
  ayarYaz(ad, a);
  return a.sahneler.length;
}

// hazir cekim sablonunu ekler; fotograf verilirse sahneler sirayla o fotograflari referans alir (yuz/stil tutarliligi), yoksa yazidan video
// kisi 0 = ilk foto (erkek), 1 = ikinci foto (kadin), 2 = ikisi birlikte: 3. foto (cift fotosu) varsa o, yoksa sirayla ikisi
function kadroFoto(f, kisi, i) {
  if (kisi === 2) return f.length >= 3 ? f[2] : f[i % Math.min(2, f.length)];
  return f[Math.min(kisi, f.length - 1)];
}
function sablonEkle(ad, sablon, fotolar, secenek) {
  const t = SABLONLAR[sablon];
  if (!t) throw hata("Bilinmeyen şablon: " + sablon, "Geçerli: " + Object.keys(SABLONLAR).join(", "));
  const a = ayarOku(ad);
  const f = (fotolar || []).filter(Boolean);
  f.forEach(x => girdiYolu(ad, x));
  if (t.kamera) a.kamera = t.kamera;   // tur paketi kendi gorunumunu getirir; sonra panelden/dosyadan degistirilebilir
  t.sahneler.forEach((s, i) => {
    const o = Object.assign({ mod: f.length ? "referans" : "metin", sure: a.sure }, s);
    delete o.kisi;
    if (t.stilEki) o.hareket = s.hareket + ", " + t.stilEki;
    if (f.length) o.kaynak = typeof s.kisi === "number" ? kadroFoto(f, s.kisi, i) : f[i % f.length];
    if (secenek && secenek.anlatim && t.anlatimTaslak) {
      const liste = t.anlatimTaslak[a.dil] || t.anlatimTaslak.en;
      if (liste && liste[i]) o.anlatim = liste[i];
    }
    a.sahneler.push(o);
  });
  ayarYaz(ad, a);
  return t.sahneler.length;
}

// YUZ DEGISTIRME (yerel FaceFusion, ucretsiz): poz fotografindaki yuzler ciftin kendi fotograflariyla degisir, sonuc ilk-kare sahnesi olur.
// Rıza onayi ZORUNLU (--riza): yuzler kullanicinin kendisine ya da yazili izin verdigi kisilere ait olmali.
function yuzDegistir(ad, b, enj) {
  const e = enj || {};
  const log = e.log || (m => console.log(m));
  const a = ayarOku(ad);
  if (b.riza !== true) throw hata("Rıza onayı gerekli.", "Fotoğraflardaki kişiler sen ya da yazılı izin veren kişiler olmalı; onaylıyorsan --riza ekle.");
  const adlar = String(b.kisi || "").split(",").map(x => x.trim()).filter(Boolean);
  if (!b.sablon || !adlar.length) throw hata("Poz fotoğrafı ve kişi fotoğrafları gerekli.", "node studyo.js yuz <ad> --sablon yuz/poz.jpg --kisi yuz/sol.jpg,yuz/sag.jpg --riza (kişiler soldan sağa)");
  const sablon = girdiYolu(ad, b.sablon), kisiler = adlar.map(k => girdiYolu(ad, k));
  for (const y of [sablon, ...kisiler]) if (!/\.(jpe?g|png|webp)$/i.test(y)) throw hata("Yalnız JPG/PNG/WebP: " + path.basename(y));
  const cikti = path.join(dizinOf(ad), "girdi", "yuz-" + ozet(dosyaOzeti(sablon), ...kisiler.map(dosyaOzeti)) + ".jpg");
  if (!fs.existsSync(cikti)) (e.degistir || require("./lib/yuz-degistir.js").degistir)({ sablon, kisiler, cikti }, { log });
  const dosya = path.basename(cikti);
  if (!a.sahneler.some(s => s.kaynak === dosya)) a.sahneler.push({ kaynak: dosya, mod: "ilk-kare", hareket: "the couple gently look at each other, subtle natural movement, soft breeze", sure: a.sure });
  a.riza = { onay: true, tarih: new Date().toISOString() };
  ayarYaz(ad, a);
  return { dosya };
}

// 3B sahne ekler (ucretsiz): sablon urun|dunya|karakter; b: {baslik, alt, renk, renk2, "on-ayar", sure, anlatim}
function sahne3dEkle(ad, sablon, b) {
  const sb = S3D().SABLONLAR;
  if (!sb[sablon]) throw hata("Bilinmeyen 3B şablon: " + sablon, "Geçerli: " + Object.keys(sb).join(", "));
  const a = ayarOku(ad);
  const parametre = {};
  if (b.baslik) parametre.baslik = String(b.baslik).slice(0, 120);
  if (b.alt) parametre.altBaslik = String(b.alt).slice(0, 120);
  if (b.renk) parametre.renk = String(b.renk);
  if (b.renk2) parametre.renk2 = String(b.renk2);
  if (b["on-ayar"]) parametre.onAyar = String(b["on-ayar"]);
  if (b.glb) {
    const g = path.basename(String(b.glb));
    if (!GLB.test(g)) throw hata("GLB dosya adı geçersiz: " + g, "Yalnız harf, rakam, nokta, tire, alt çizgi; .glb ile bitmeli.");
    if (!fs.existsSync(path.join(dizinOf(ad), "girdi", g))) throw hata("GLB bulunamadı: girdi/" + g, "Dosyayı uretim/" + ad + "/girdi/ içine koy (kendi modelin ya da telifsiz bir GLB).");
    parametre.glb = g;
  }
  const s = { mod: "3b", sablon3d: sablon, parametre, sure: Number(b.sure || a.sure) };
  if (b.anlatim) s.anlatim = String(b.anlatim).slice(0, 600);
  a.sahneler.push(s);
  const yol = ayarYolu(ad), eski = fs.readFileSync(yol, "utf8");
  ayarYaz(ad, a);
  try { ayarOku(ad); } catch (x) { fs.writeFileSync(yol, eski); throw x; }       // gecersiz parametre dosyayi bozmaz
  return a.sahneler.length;
}

// girdi/'de olup sahnelerde olmayan dosyalari ekler (ad sirasiyla)
function tara(ad) {
  const a = ayarOku(ad);
  const kok = path.join(dizinOf(ad), "girdi");
  const bilinen = new Set(a.sahneler.map(s => s.kaynak).concat(a.karakter || []));
  const yeniler = fs.readdirSync(kok).filter(f => (FOTO.test(f) || VIDEO.test(f)) && !bilinen.has(f)).sort((x, y) => x.localeCompare(y, "tr", { numeric: true }));
  for (const f of yeniler) {
    const s = { kaynak: f, mod: VIDEO.test(f) ? "referans" : STILLER[a.stil].mod, hareket: VARSAYILAN_HAREKET, sure: a.sure };
    if (VIDEO.test(f)) { s.an = 1; s.hareket = "recreate this exact scene with the same composition, characters and action"; }
    a.sahneler.push(s);
  }
  ayarYaz(ad, a);
  return { eklenen: yeniler, toplam: a.sahneler.length };
}

// fotografi (ya da videodan kareyi) <=1536 px JPEG'e cevirir: vidIQ siniri 10 MB, HEIC/BMP de okunur. Ayni girdi icin onbellek.
function hazirla(ad, dosya, an) {
  const kaynak = girdiYolu(ad, dosya);
  const hazir = path.join(dizinOf(ad), "hazir");
  fs.mkdirSync(hazir, { recursive: true });
  const st = fs.statSync(kaynak);
  const anahtar = crypto.createHash("sha1").update(dosya + "|" + st.size + "|" + st.mtimeMs + "|" + (an || 0)).digest("hex").slice(0, 12);
  const cikti = path.join(hazir, anahtar + ".jpg");
  if (fs.existsSync(cikti)) return cikti;
  const vf = ["-vf", "scale='min(1536,iw)':'min(1536,ih)':force_original_aspect_ratio=decrease", "-q:v", "3", "-frames:v", "1"];
  ffmpeg(VIDEO.test(dosya) ? ["-ss", String(an || 1), "-i", kaynak, ...vf, cikti] : ["-i", kaynak, ...vf, cikti], "hazırlık " + dosya);
  return cikti;
}
const ozet = (...parcalar) => crypto.createHash("sha1").update(parcalar.join("|")).digest("hex").slice(0, 12);
const dosyaOzeti = y => crypto.createHash("sha1").update(fs.readFileSync(y)).digest("hex").slice(0, 12);

function istemKur(a, s) {
  const st = STILLER[a.stil];
  const ek = s.mod === "metin" ? "" : s.mod === "referans" ? "Keep the same people, faces and outfits as in the reference photos."
    : s.mod === "video" ? "Restyle the whole video in this style, keep the original motion, timing and composition."
      : "Animate this exact image, keep the composition and the people's faces.";
  const yon = Object.entries(YONETMEN_ALANLAR).map(([alan, grup]) => s[alan] && YONETMEN[grup][s[alan]] ? YONETMEN[grup][s[alan]][1] : "").filter(Boolean);
  return [String(s.hareket || VARSAYILAN_HAREKET).trim().replace(/\.$/, "") + ".", yon.length && "Cinematic direction: " + yon.join(", ") + ".", st.metin && st.metin + ".", ek].filter(Boolean).join(" ");
}

// studyo.json -> vidiq-klip listesi. videolar: url -> vidIQ videoUrl (yalniz gercek koşuda yuklenir)
function liste(ad, a, videolar) {
  const karakter = (a.karakter || []).map(f => hazirla(ad, f));
  return a.sahneler.map((s, i) => {
    if (s.mod === "3b") return { istem: "3b:" + s.sablon3d, sure: Number(s.sure || a.sure), yerel: true, girdiOzet: ozet("3b", s.sablon3d, JSON.stringify(s.parametre || {})) };
    const k = { istem: istemKur(a, s), sure: Number(s.sure || a.sure) };
    if (s.mod === "metin") {
      k.girdiOzet = ozet("metin");
    } else if (s.mod === "video") {
      k.videoUrl = (videolar && videolar[i]) || "https://vidiq.yuklenecek/" + i;
      k.girdiOzet = ozet("video", s.url);
    } else {
      const foto = hazirla(ad, s.kaynak, s.an);
      if (s.mod === "ilk-kare") k.ilkKare = foto; else k.referans = [foto, ...karakter];
      k.girdiOzet = ozet(s.mod, dosyaOzeti(foto), ...karakter.map(dosyaOzeti));
    }
    return k;
  });
}

// kendi videonun adresini vidIQ'ya yukler (UCRETSIZ); YouTube linki arka planda iner
async function videoYukle(vidiq, url, log) {
  const r = await vidiq.cagir("vidiq_video_upload", { url, title: "otopilot-studyo" }, ["videoUrl", "uploadId", "mcpJobId"]);
  if (r && r.videoUrl) return r.videoUrl;
  if (r && r.mcpJobId) {
    log("  video vidIQ'ya iniyor (ücretsiz): " + url);
    const s = await vidiq.isBekle(r.mcpJobId, { maksSn: 900, aralikSn: 6 });
    if (s && s.videoUrl) return s.videoUrl;
  }
  throw hata("vidIQ videoyu yükleyemedi: " + url, "Adres herkese açık bir https MP4/MOV ya da YouTube linki olmalı (en çok 299 MB).", 3);
}

async function uret(ad, b, enj) {
  const e = enj || {};
  const log = e.log || (m => console.log(m));
  const a = ayarOku(ad);
  if (!a.sahneler.length) throw hata("Sahne yok.", "Fotoğrafları uretim/" + ad + "/girdi/ içine koyup: node studyo.js tara " + ad);
  const onay = b.onay === true;
  let vidiq = e.vidiq || null;
  if (!vidiq && onay) {
    const anahtar = ortak.envOku("VIDIQ_KEY");
    if (!anahtar) throw hata("VIDIQ_KEY tanımlı değil.", ".env'e VIDIQ_KEY yaz (app.vidiq.com/account/settings/mcp).");
    const { VidiqIstemci } = require("./lib/vidiq.js");
    vidiq = new VidiqIstemci(anahtar, {});
  }
  const videolar = {};
  if (onay) for (const [i, s] of a.sahneler.entries()) if (s.mod === "video") videolar[i] = await videoYukle(vidiq, s.url, log);
  const ag = e.indir ? null : require("./lib/gorsel-ag.js");
  const vk = require("./vidiq-klip.js");
  const r = await K.uret({
    liste: liste(ad, a, videolar).filter(k => !k.yerel), model: a.model, cozunurluk: a.cozunurluk, oran: a.oran, dizin: path.join(dizinOf(ad), "Clips"),
    butce: Number(b.butce || 0), onay, yeniCekim: b["yeni-cekim"] === true, log, vidiq,
    indir: e.indir || vk.indirici(ag.istemciYap({ limitBekleSn: 5 })),
  });
  log("\n" + STILLER[a.stil].ad + " · " + r.klip + " sahne · " + r.atlanan + " hazır · " + r.uretilecek + " üretilecek · tahmini en çok " + r.tahminiKredi + " kredi · " + a.model + " " + a.cozunurluk + " " + a.oran);
  if (r.durum === "kuru_calisma") log("KURU ÇALIŞMA: kredi harcanmadı. Üretmek için --onay ekle.");
  else if (r.durum === "hepsi_hazir" || r.durum === "bitti") log("Klipler hazır. Sıradaki: node studyo.js kur " + ad);
  else for (const h of r.basarisiz || []) log("  ✗ " + h.istem + " — " + h.neden + (h.cozum ? "\n    ↳ " + h.cozum : ""));
  return r;
}

// her sahnenin en son teslim edilen klibi (studyo listesiyle ayni kimlik)
function klipEsle(ad, a) {
  const clips = path.join(dizinOf(ad), "Clips");
  const kayit = K.kayitOku(clips).klipler || [];
  const l = liste(ad, a, {});
  return l.map((k, i) => {
    if (k.yerel) return { sahne: i + 1, yol: null, yerel: true };
    const e = kayit.filter(g => g.dosya && g.istem === k.istem && Number(g.sure) === k.sure && (g.girdiOzet || "") === k.girdiOzet && fs.existsSync(path.join(clips, g.dosya))).pop();
    return { sahne: i + 1, yol: e ? path.join(clips, e.dosya) : null };
  });
}

// sahne anlatimlarini ucretsiz motorlarla seslendirir (Edge -> sistem sesi). Ayni metin+dil+ses ikinci kez uretilmez.
async function anlatimSesleri(ad, a, log, uretici) {
  const klasor = path.join(dizinOf(ad), "Voice");
  fs.mkdirSync(klasor, { recursive: true });
  const out = [];
  for (const [i, s] of a.sahneler.entries()) {
    const metin = String(s.anlatim || "").trim();
    if (!metin) { out.push(null); continue; }
    const dosya = path.join(klasor, String(i + 1).padStart(3, "0") + "-" + ozet(metin, a.dil, a.ses || "") + ".mp3");
    if (!fs.existsSync(dosya)) {
      log("  sahne " + (i + 1) + " seslendiriliyor…");
      await (uretici || require("./lib/ses-uret.js").ornekUret)({ metin, dil: a.dil, ses: a.ses || undefined, cikti: dosya, log: () => {} });
    }
    out.push({ dosya, sure: sureOlc(dosya), metin });
  }
  return out;
}
const srtZaman = sn => { const ms = Math.round(sn * 1000), p = (n, k) => String(n).padStart(k, "0"); return p(Math.floor(ms / 3600000), 2) + ":" + p(Math.floor(ms / 60000) % 60, 2) + ":" + p(Math.floor(ms / 1000) % 60, 2) + "," + p(ms % 1000, 3); };
function satirla(metin, en) {
  const satirlar = []; let su = "";
  for (const k of String(metin).split(/\s+/)) { if (su && (su + " " + k).length > en) { satirlar.push(su); su = k; } else su = su ? su + " " + k : k; }
  if (su) satirlar.push(su);
  return satirlar.join("\n");
}

// klipleri sirayla birlestirir; anlatim varsa sahne anlatimdan kisaysa uzatilir (klip dongulenir), altyazi yakilir, muzik anlatimin altina karisir
async function kur(ad, b, enj) {
  const e = enj || {};
  const log = e.log || (m => console.log(m));
  const a = ayarOku(ad);
  const es = klipEsle(ad, a);
  const eksik = es.filter(x => !x.yol && !x.yerel).map(x => x.sahne);
  const var_ = es.filter(x => x.yol || x.yerel);
  if (!var_.length) throw hata("Hiç klip yok.", "Önce: node studyo.js uret " + ad + " --butce <kredi> --onay");
  const kalipUyarilari = [];
  a.sahneler.forEach((s, i) => {
    if (!s.anlatim) return;
    for (const k of require("./lib/ai-kalip.js").kalipBul(s.anlatim, a.dil)) kalipUyarilari.push("Sahne " + (i + 1) + " anlatımında yapay zekâ kalıbı: \"" + k.parca + "\" (somut gerçekle değiştir)");
  });
  for (const u of kalipUyarilari) log("! " + u);
  const sesler = await anlatimSesleri(ad, a, log, e.ses);
  const sesVar = var_.some(x => sesler[x.sahne - 1]);
  const [w, h] = BOYUT[a.oran];
  // 3B sahneleri bu bilgisayarda cizilir (ucretsiz); karakter sahnesinde agiz, o sahnenin anlatim sesinden gelir
  let yerel3b = 0;
  for (const x of var_.filter(v => v.yerel)) {
    const s = a.sahneler[x.sahne - 1], ses = sesler[x.sahne - 1];
    const sure3 = Math.max(Number(s.sure || a.sure), ses ? ses.sure + 0.4 : 0);
    const parametre = Object.assign({}, s.parametre || {});
    if (s.sablon3d === "karakter" && ses) parametre.agiz = require("./lib/ses-agzi.js").agizEgrisi(ses.dosya, 30);
    let glbYol = "";
    if (parametre.glb) {
      glbYol = path.join(dizinOf(ad), "girdi", parametre.glb);
      if (!fs.existsSync(glbYol)) throw hata("Sahne " + x.sahne + ": GLB model bulunamadı (girdi/" + parametre.glb + ").", "Dosyayı koy ya da sahneden modeli kaldır; model olmadan varsayılan şekil çizilir.");
    }
    const kimlik3 = ozet("3b", s.sablon3d, JSON.stringify(Object.assign({}, parametre, { agiz: parametre.agiz ? ozet(parametre.agiz.join(",")) : "", glbOzet: glbYol ? dosyaOzeti(glbYol) : "" })), sure3.toFixed(2), w, h);
    const yol3 = path.join(dizinOf(ad), "Clips3d", String(x.sahne).padStart(3, "0") + "-" + s.sablon3d + "-" + kimlik3 + ".mp4");
    if (!fs.existsSync(yol3)) {
      log("  3B sahne " + x.sahne + " (" + s.sablon3d + ") çiziliyor…");
      const k = Math.min(1, 720 / Math.min(w, h));
      await (e.ciz3d || S3D().ciz)({ sablon: s.sablon3d, parametre, sure: sure3, genislik: Math.round(w * k), yukseklik: Math.round(h * k), fps: 30, cikti: yol3, model: glbYol || undefined, log });
    }
    x.yol = yol3; yerel3b++;
  }
  const d = dizinOf(ad), kurgu = path.join(d, "kurgu");
  fs.mkdirSync(kurgu, { recursive: true });
  fs.mkdirSync(path.join(d, "Videos"), { recursive: true });
  const filtre = "fps=30,scale=" + w + ":" + h + ":force_original_aspect_ratio=increase,crop=" + w + ":" + h + ",format=yuv420p,setsar=1";
  let t = 0; const altyazi = [];
  const parcalar = var_.map((x, i) => {
    const p = path.join(kurgu, String(i + 1).padStart(3, "0") + ".mp4");
    const ses = sesler[x.sahne - 1];
    const klipSn = sureOlc(x.yol);
    const sure = ses ? Math.max(klipSn, ses.sure + 0.4) : klipSn;
    const girdi = ["-stream_loop", "-1", "-i", x.yol];
    if (sesVar) girdi.push(...(ses ? ["-i", ses.dosya] : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]));
    ffmpeg([...girdi, "-t", sure.toFixed(3), "-vf", filtre,
      ...(sesVar ? ["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", "-af", ses ? SES_ZINCIRI + ",apad" : "apad"] : ["-an"]),
      "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-threads", "2", p], "sahne " + x.sahne);
    if (ses) altyazi.push({ b: t + 0.1, e: t + Math.min(sure, ses.sure + 0.3), m: satirla(ses.metin, a.oran === "9:16" ? 28 : 52) });
    t += sure;
    return p;
  });
  const listeDosya = path.join(kurgu, "liste.txt");
  fs.writeFileSync(listeDosya, parcalar.map(p => "file '" + p.replace(/\\/g, "/").replace(/'/g, "'\\''") + "'").join("\n") + "\n");
  const ham = path.join(kurgu, "ham.mp4");
  const uyarilar = [];
  const gecisG = gecisGrafigi(parcalar.map(p => sureOlc(p)), var_.map(x => a.sahneler[x.sahne - 1].gecis), sesVar);
  let gecisli = false;
  if (gecisG) {
    try {
      ffmpeg([].concat(...parcalar.map(p => ["-i", p])).concat(["-filter_complex", gecisG.filtre], gecisG.harita,
        ["-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-threads", "2", "-pix_fmt", "yuv420p"], sesVar ? ["-c:a", "aac", "-b:a", "160k"] : ["-an"], [ham]), "geçişli birleştir");
      gecisli = true;
    } catch (x) { uyarilar.push("Geçişler uygulanamadı (" + x.message.slice(0, 100) + "); sahneler düz kesmeyle birleştirildi."); }
  }
  if (!gecisli) ffmpeg(["-f", "concat", "-safe", "0", "-i", listeDosya, "-c", "copy", ham], "birleştir");
  let simdi = ham;
  if (a.lensProfili && b.lenssiz !== true) {
    const lensYol = path.join(kurgu, "lens.mp4");
    try {
      const L = require("./lib/lensfun.js"), lp = a.lensProfili;
      const p = L.profilBul(lp.kamera, lp.lens);
      ffmpeg(["-i", simdi, "-vf", L.filtre({ kamera: p.kamera, lens: p.lens, odak: lp.odak, diyafram: lp.diyafram, mesafe: lp.mesafe, yon: lp.yon }), "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-c:a", "copy", lensYol], "lens");
      simdi = lensYol;
    } catch (x) { uyarilar.push("Lens profili uygulanamadı (" + String(x.message).slice(0, 120) + "); film olduğu gibi kuruldu."); }
  }
  if (KAMERALAR[a.kamera].vf && b.kamerasiz !== true) {
    const kameraliYol = path.join(kurgu, "kamera.mp4");
    try { ffmpeg(["-i", ham, "-vf", KAMERALAR[a.kamera].vf, "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-c:a", "copy", kameraliYol], "kamera"); simdi = kameraliYol; }
    catch (x) { uyarilar.push("Kamera görünümü uygulanamadı (" + x.message.slice(0, 100) + "); film olduğu gibi kuruldu."); }
  }
  const kameraBitti = simdi;
  if (altyazi.length && b.altyazisiz !== true) {
    const srt = path.join(d, "Videos", ad + ".srt");
    fs.writeFileSync(srt, altyazi.map((x, k) => (k + 1) + "\n" + srtZaman(x.b) + " --> " + srtZaman(x.e) + "\n" + x.m + "\n").join("\n"));
    const yakili = path.join(kurgu, "altyazili.mp4");
    const srtF = srt.replace(/\\/g, "/").replace(/:/g, "\\:");
    try {
      ffmpeg(["-i", kameraBitti, "-vf", "subtitles='" + srtF + "':force_style='Alignment=2,FontSize=" + (a.oran === "9:16" ? 14 : 20) + ",Outline=2,MarginV=" + (a.oran === "9:16" ? 90 : 40) + "'", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "copy", yakili], "altyazı");
      simdi = yakili;
    } catch (x) { uyarilar.push("Altyazı videoya gömülemedi (" + x.message.slice(0, 100) + "); .srt ayrı dosya olarak yazıldı."); }
  }
  const cikti = path.join(d, "Videos", ad + ".mp4");
  if (b.muzik) {
    const m = path.resolve(String(b.muzik));
    if (!fs.existsSync(m)) throw hata("Müzik dosyası yok: " + m);
    const son = Math.max(0, t - 1.5).toFixed(2);
    if (sesVar) {
      ffmpeg(["-i", simdi, "-stream_loop", "-1", "-i", m, "-filter_complex",
        // muzik, anlatim konusurken kendiliginden kisilir (sidechain), aralarda yukselir (cinecode references/sound.md)
        "[1:a]volume=0.5,afade=t=in:d=0.5,afade=t=out:st=" + son + ":d=1.5[m];[0:a]asplit=2[v][vk];[m][vk]sidechaincompress=threshold=0.03:ratio=8:attack=30:release=600[d];[d][v]amix=inputs=2:normalize=0:duration=first[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", t.toFixed(3), cikti], "müzik");
    } else {
      ffmpeg(["-i", simdi, "-stream_loop", "-1", "-i", m, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
        "-af", "afade=t=in:d=0.5,afade=t=out:st=" + son + ":d=1.5", "-t", t.toFixed(3), cikti], "müzik");
    }
  } else fs.copyFileSync(simdi, cikti);
  let sesNormal = false;
  if ((sesVar || b.muzik) && b.sesnormalsiz !== true) {
    const ham2 = path.join(kurgu, "normsiz.mp4");
    fs.copyFileSync(cikti, ham2);
    try { sesNormalle(ham2, cikti); sesNormal = true; }
    catch (x) { fs.copyFileSync(ham2, cikti); uyarilar.push("Ses seviyesi eşitlenmedi (" + x.message.slice(0, 100) + ")."); }
  }
  let kontrol = "";
  try { kontrol = path.join(d, "Videos", ad + "-kontrol.jpg"); kontrolSayfasi(cikti, kontrol, t); }
  catch (x) { kontrol = ""; uyarilar.push("Kontrol sayfası yapılamadı (" + x.message.slice(0, 100) + ")."); }
  return { cikti, sahne: var_.length, eksik, sure: t, uyarilar: kalipUyarilari.concat(uyarilar), anlatim: altyazi.length, sesNormal, kontrol, yerel3b };
}
function sureOlc(dosya) {
  const r = spawnSync(ff().ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dosya], { encoding: "utf8", windowsHide: true });
  const s = Number(String(r.stdout).trim());
  return Number.isFinite(s) && s > 0 ? s : 0;
}

function ayristir(args) {
  const DEGERLI = new Set(["stil", "oran", "model", "cozunurluk", "sure", "butce", "muzik", "kamera", "foto", "sablon", "kisi", "baslik", "alt", "renk", "renk2", "on-ayar", "anlatim", "tur", "lens", "odak", "diyafram", "mesafe", "glb"]);
  const b = {}, konum = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x.startsWith("--")) { const n = x.slice(2); if (DEGERLI.has(n)) b[n] = args[++i]; else b[n] = true; } else konum.push(x);
  }
  return { b, konum };
}

async function ana(args) {
  const { b, konum } = ayristir(args);
  const [komut, ad] = konum;
  if (komut === "3b-kur") { S3D().threeKur(console.log); console.log("✓ three.js hazır (" + S3D().THREE_SURUM + ")."); return; }
  if (komut === "3b-sablonlar") { for (const [k, v] of Object.entries(S3D().SABLONLAR)) console.log("  " + k.padEnd(10) + v.ad); console.log("  karakter ön ayarları: " + S3D().KARAKTER_AYARLARI.join(", ")); return; }
  if (komut === "lens-kur") { await require("./lib/lensfun.js").indir({}); console.log("✓ Lens profilleri hazır (CC BY-SA 3.0, Lensfun). Ara: node studyo.js lens-ara <kelime> [--tur lens]"); return; }
  if (komut === "lens-ara") {
    const L = require("./lib/lensfun.js"), tur = b.tur === "lens" ? "lens" : "kamera";
    const r = L.ara(konum.slice(1).join(" "), tur, 40);
    if (!r.length) { console.log("  bulunamadı (veritabanı yoksa önce: node studyo.js lens-kur)"); return; }
    for (const x of r) console.log("  " + x.maker + " | " + x.model + (x.mount ? "  [" + x.mount + "]" : ""));
    return;
  }
  if (komut === "lens") {
    if (!konum[1]) throw hata("Kullanım: node studyo.js lens <ad> --kamera \"Apple iPhone XS\" --lens \"iPhone XS back camera\" [--odak 35 --diyafram 2.8 --duzelt | --kaldir]");
    const a = ayarOku(konum[1]);
    if (b.kaldir) { delete a.lensProfili; ayarYaz(konum[1], a); console.log("✓ Lens profili kaldırıldı."); return; }
    const p = require("./lib/lensfun.js").profilBul(b.kamera, b.lens);
    a.lensProfili = { kamera: p.kamera.model, lens: p.lens.model };
    for (const k of ["odak", "diyafram", "mesafe"]) if (b[k] !== undefined) a.lensProfili[k] = Number(b[k]);
    if (b.duzelt) a.lensProfili.yon = "duzelt";
    ayarYaz(konum[1], a);
    console.log("✓ Lens profili: " + p.kamera.maker + " " + p.kamera.model + " + " + p.lens.model + (b.duzelt ? " (düzelt)" : " (lens karakteri ekle)") + ". kur'da uygulanır.");
    return;
  }
  if (komut === "sablonlar") { for (const [k, v] of Object.entries(SABLONLAR)) console.log("  " + k.padEnd(10) + v.ad); return; }
  if (komut === "stiller") { for (const [k, v] of Object.entries(STILLER)) console.log("  " + k.padEnd(14) + v.ad + " (" + v.mod + ")"); return; }
  if (!ad || !["yeni", "tara", "sahne", "3b", "sablon", "yuz", "uret", "kur"].includes(komut)) throw hata("Kullanım: node studyo.js yeni|tara|uret|kur <ad> (ayrıntı: dosyanın başı) · node studyo.js stiller");
  if (komut === "yeni") {
    const r = yeni(ad, b);
    console.log("✓ Stüdyo işi açıldı. Fotoğrafları ve videoları şuraya koy (dosya adı sırası = film sırası):\n  " + r.girdi + "\nSonra: node studyo.js tara " + ad);
  } else if (komut === "sahne") {
    const n = sahneEkle(ad, konum.slice(2).join(" "), b.sure);
    console.log("✓ Sahne " + n + " eklendi (metinden video). Sonra: node studyo.js uret " + ad + " --butce <kredi>");
  } else if (komut === "3b") {
    const n = sahne3dEkle(ad, konum[2], b);
    console.log("✓ 3B sahne " + n + " eklendi (" + konum[2] + "; ücretsiz, kur'da bu bilgisayarda çizilir). Sonra: node studyo.js kur " + ad);
  } else if (komut === "yuz") {
    const r = yuzDegistir(ad, b);
    console.log("✓ Yüzler değiştirildi: girdi/" + r.dosya + " yeni sahne olarak eklendi (ilk kare). Sıradaki: node studyo.js uret " + ad + " --butce <kredi>");
  } else if (komut === "sablon") {
    const n = sablonEkle(ad, konum[2], b.foto ? String(b.foto).split(",").map(x => x.trim()) : [], { anlatim: !!b.anlatimli });
    console.log("✓ " + n + " çekim eklendi (" + konum[2] + "). Hareketleri/planları studyo.json'da ya da panelde düzenle, sonra: node studyo.js uret " + ad + " --butce <kredi>");
  } else if (komut === "tara") {
    const r = tara(ad);
    console.log("✓ " + r.eklenen.length + " yeni sahne eklendi (toplam " + r.toplam + "). Hareketleri uretim/" + ad + "/studyo.json içinde yaz, sonra: node studyo.js uret " + ad + " --butce <kredi>");
  } else if (komut === "uret") {
    const r = await uret(ad, b);
    if (r.durum === "butce_doldu") process.exitCode = ortak.CIKIS.MALIYET;
    else if (r.durum === "kismi") process.exitCode = ortak.CIKIS.SERVIS;
  } else {
    const r = await kur(ad, b);
    console.log("✓ " + r.cikti + " (" + r.sahne + " sahne)" + (r.eksik.length ? "\n! klibi olmayan sahneler atlandı: " + r.eksik.join(", ") : "") + (r.anlatim ? "\n  anlatım: " + r.anlatim + " sahne seslendirildi, altyazı yakıldı" : "") + r.uyarilar.map(u => "\n! " + u).join(""));
  }
}

if (require.main === module) {
  ana(process.argv.slice(2)).catch(e => { console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : "")); process.exit(e.cikis || 1); });
}
module.exports = { GECISLER, gecisGrafigi, gecisOnizleme, ffmpeg, tekIsParcacigi, sahne3dEkle, yuzDegistir, STILLER, MODLAR, KAMERALAR, YONETMEN, SABLONLAR, sablonEkle, yeni, tara, sahneEkle, fotoEkle, uret, kur, liste, istemKur, klipEsle, ayarOku, ayristir };
