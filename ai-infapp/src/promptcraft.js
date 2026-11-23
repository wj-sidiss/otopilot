'use strict';

/**
 * PROMPT MUTFAGI
 *
 * Kilitli kimlik + sahne -> her platformun kendi diline gore prompt.
 * Her uretimde ayni "fiziksel cekirdek" kelimesi kelimesine tekrarlanir;
 * tutarliligi tasiyan ana arac budur; yaninda sabit seed ve (destekleyen
 * platformlarda) referans gorsel calisir.
 * NOT: buraya oran YAZMA - projede tutarliligi olcen kod yok, dolayisiyla
 * herhangi bir yuzde uydurma olur.
 */

/* ----------------------------------------------- TR -> EN sozluk (gorsel) */

const GENDER = {
  'Kadin': 'woman',
  'Erkek': 'man',
  'Androjen': 'androgynous person',
  'Non-binary': 'non-binary person',
  'Android / dijital varlik': 'humanoid android',
};

const ETHNICITY = {
  'Akdeniz': 'Mediterranean',
  'Kuzey Avrupali': 'Northern European',
  'Slav': 'Slavic',
  'Turk': 'Turkish',
  'Arap': 'Arab',
  'Fars': 'Persian',
  'Berberi': 'Amazigh',
  'Batı Afrikali': 'West African',
  'Dogu Afrikali': 'East African',
  'Hint': 'South Asian Indian',
  'Cinli': 'Han Chinese',
  'Japon': 'Japanese',
  'Koreli': 'Korean',
  'Guneydogu Asyali': 'Southeast Asian',
  'Latin / Hispanik': 'Latina/Latino Hispanic',
  'Yerli Amerikali': 'Native American',
  'Polinezyali': 'Polynesian',
  'Karma / cok etnikli': 'mixed-race',
};

const REGION = {
  'Akdeniz': 'Mediterranean coast',
  'Kuzey Avrupa': 'Nordic',
  'Bati Avrupa': 'Western European',
  'Dogu Avrupa': 'Eastern European',
  'Balkanlar': 'Balkan',
  'Anadolu / Turkiye': 'Anatolian Turkish',
  'Kafkasya': 'Caucasian highlands',
  'Orta Dogu': 'Middle Eastern',
  'Kuzey Afrika': 'North African',
  'Sahra Alti Afrika': 'Sub-Saharan African',
  'Orta Asya': 'Central Asian',
  'Guney Asya': 'South Asian',
  'Dogu Asya': 'East Asian',
  'Guneydogu Asya': 'Southeast Asian',
  'Latin Amerika': 'Latin American',
  'Kuzey Amerika': 'North American',
  'Okyanusya': 'Oceanian',
};

const SKIN = {
  'Cok acik (porselen)': 'very fair porcelain skin',
  'Soluk / soguk ton': 'pale skin with cool undertones',
  'Acik': 'fair skin',
  'Kizila calan acik': 'fair skin with rosy undertones',
  'Acik bugday': 'light tan skin',
  'Bugday': 'tan skin',
  'Altin bugday': 'warm golden tan skin',
  'Zeytin': 'olive skin',
  'Orta esmer': 'medium brown skin',
  'Koyu esmer': 'deep brown skin',
  'Cok koyu (abanoz)': 'rich ebony skin',
};

const EYES = {
  'Kahverengi': 'brown eyes',
  'Koyu kahve / siyaha yakin': 'near-black dark brown eyes',
  'Acik kahve / bal': 'light honey-brown eyes',
  'Ela': 'hazel eyes',
  'Yesil': 'green eyes',
  'Yesil-ela': 'green-hazel eyes',
  'Mavi': 'blue eyes',
  'Koyu mavi': 'deep blue eyes',
  'Buz mavisi': 'pale ice-blue eyes',
  'Gri': 'grey eyes',
  'Gri-yesil': 'grey-green eyes',
  'Amber': 'amber eyes',
};

const HAIR_COLOR = {
  'Siyah': 'black',
  'Koyu kahve': 'dark brown',
  'Kahverengi': 'brown',
  'Kumral': 'chestnut brown',
  'Acik kahve': 'light brown',
  'Bal sarisi': 'honey blonde',
  'Sari / blonde': 'blonde',
  'Platin': 'platinum blonde',
  'Kizil': 'auburn red',
  'Bakir': 'copper red',
  'Gri / gumus': 'silver grey',
  'Beyaz': 'white',
  'Renkli (fantezi)': 'vivid dyed',
};

const HAIR_STYLE = {
  'Trasli / cok kisa': 'buzzcut',
  'Kisa duz': 'short straight',
  'Kisa dalgali': 'short wavy',
  'Kisa kivircik': 'short curly',
  'Bob': 'chin-length bob',
  'Dalgali bob': 'wavy chin-length bob',
  'Omuz hizasi duz': 'shoulder-length straight',
  'Omuz hizasi dalgali': 'shoulder-length wavy',
  'Omuz hizasi kivircik': 'shoulder-length curly',
  'Uzun duz': 'long straight',
  'Uzun dalgali': 'long wavy',
  'Uzun kivircik': 'long curly',
  'Afro': 'natural afro',
  'Sıkı bukleli (coil)': 'tightly coiled natural',
  'Orgu / braids': 'braided',
  'Dredlok': 'locs',
  'Topuz': 'tied in a bun',
  'At kuyrugu': 'tied in a ponytail',
};

const BODY = {
  'Ince / zayif': 'slim slender build',
  'Ince ve kaslı': 'lean toned build',
  'Atletik': 'athletic toned build',
  'Kaslı': 'muscular build',
  'Cok kaslı (vucut gelistirme)': 'heavily muscular bodybuilder physique',
  'Kum saati': 'hourglass figure',
  'Armut': 'pear-shaped figure',
  'Elma': 'apple-shaped figure',
  'Duz / dikdortgen': 'straight rectangular figure',
  'Kivrimli': 'curvy figure',
  'Ortalama': 'average build',
  'Uzun ve ince (manken)': 'tall lean model build',
  'Iri / plus size': 'plus-size full figure',
  'Balikci / iri yapili': 'broad sturdy build',
  'Kucuk yapili (orantili kisa boy)': 'petite, proportionate short stature',
  'Cucelik (akondroplazi)': 'a person with achondroplasia dwarfism, short stature with proportionally shorter arms and legs and an average-sized torso',
};

// Ayirt edici ozelliklerin Ingilizce tarifleri ve risk seviyeleri src/traits.js'te.
const traits = require('./traits');

/* ---------------------------------------------------------- negatif liste */

const NEGATIVE = [
  'deformed hands', 'extra fingers', 'missing fingers', 'fused fingers',
  'mutated limbs', 'extra limbs', 'extra arms', 'asymmetrical eyes',
  'crossed eyes', 'distorted face', 'disfigured', 'bad anatomy', 'long neck',
  'lowres', 'blurry', 'out of focus', 'jpeg artifacts', 'oversaturated',
  'plastic skin', 'waxy skin', 'airbrushed skin', 'doll-like', 'uncanny valley',
  'watermark', 'signature', 'text', 'logo', 'caption',
  'duplicate person', 'cloned face', 'two heads',
  'cartoon', 'anime', '3d render', 'cgi', 'illustration', 'painting',
  // Dovme ve cil karakter secenegi olmaktan cikarildi: her karede farkli
  // ciktiklari icin tutarliligi bozuyorlardi. Model bunlari ISTENMEDEN de
  // ekliyordu (ilk testte omuza rastgele dovme cizdi), o yuzden burada
  // aktif olarak engelleniyorlar.
  'tattoo', 'tattoos', 'tattooed skin', 'body art',
  'freckles', 'freckled skin', 'blotchy skin', 'skin blemishes', 'acne',
  // "AI kokusu" veren her sey. Bu blok gercekciligin yarisini tek basina
  // halleder: model yapay zeka portresi refleksine kaydigi anda geri ceker.
  'smooth skin', 'flawless skin', 'perfect skin', 'glossy skin', 'poreless skin',
  'retouched', 'photoshopped', 'beauty filter', 'instagram filter', 'face filter',
  'airbrush', 'HDR', 'oversharpened', 'overprocessed', 'vibrant oversaturated colors',
  'perfectly symmetrical face', 'mannequin', 'doll face', 'unreal engine',
  'octane render', 'artstation', 'digital painting', 'concept art', 'ai generated look',
  'perfect hair', 'every hair in place', 'studio perfect lighting',
];

/* ------------------------------------------------------- GERCEKCILIK ---- */

/**
 * "AI kokusunu" yok eden sey cozunurluk degil, KUSURDUR.
 *
 * Yapay zeka goruntusunu ele veren tipik isaretler:
 *   puruzsuz mumsu cilt · kusursuz simetri · kusursuz isik · asiri guzel
 *   yuz hatlari · film grenisiz temizlik · her teli yerinde sac · fazla
 *   parlak gozler · HDR gibi doygun renkler
 *
 * Karsi ilac: gozenek, ince tuy, hafif asimetri, kacak sac telleri, gercek
 * lens/film kusurlari ve "profesyonel cekim" degil "an yakalanmis" his.
 *
 * Not: dovme ve cil hala engellidir (bkz. NEGATIVE). "Isaretsiz cilt" ile
 * "dokusuz cilt" ayni sey degil - gozenek ve ton dalgalanmasi kalir,
 * dovme/cil kalmaz.
 */
const SKIN_REAL = 'natural skin texture with visible pores, fine vellus hair and subtle tonal unevenness, unmarked skin';

// Olumsuz ifade YOK - bkz. REALISM ustundeki not. "no retouching" yerine
// ayni seyi olumlu soyleyen karsiligi kullaniliyor.
const IMPERFECTION = 'slight natural facial asymmetry, a few loose flyaway hairs, skin left exactly as the sensor recorded it';

/** Gercekcilik seviyeleri - kullanici Uretim ekranindan secer. */
/**
 * MOTOR AYARLARI - kelimelerden daha cok etki eden kisim.
 *
 * FLUX'ta mumsu/plastik cilt hissinin en buyuk tek sebebi yuksek guidance.
 * Varsayilan 3.5'tir; 2.2-2.8 araliginda gozenek ve doku gorunur sekilde
 * geliyor. Bu degerler saglayiciya GERCEKTEN gonderilmeli - eskiden
 * hesaplanip yolda dusuruluyordu.
 */
/**
 * KRITIK: FLUX ve DALL-E'nin metin kodlayicisi OLUMSUZLAMAYI COZEMEZ.
 * "no beauty filter, no retouching" yazdiginda modele giren sey pratikte
 * "beauty filter, retouching" oluyor - yani kendi ayagimiza sikiyoruz.
 * Bu yuzden dogal dil cumlelerinde olumsuz ifade YASAK; her sey olumlu
 * karsiligiyla yaziliyor ("unretouched frame straight out of the camera").
 *
 * Agirlik sozdizimi (parantez:1.3) yalnizca SDXL tabanli araclarda anlamli;
 * Midjourney ve bulut API'lerinde cop token olarak giriyor. O yuzden uc ayri
 * bicim var: sentences (dogal dil), tags (SDXL, agirlikli), plain (duz etiket).
 */
const REALISM = {
  // Varsayilan. En cok "gercek insan" hissi veren yol: profesyonel cekim
  // gibi degil, birinin telefonuyla cektigi an gibi gorunmek.
  ultra: {
    label: 'Ultra gercekci (telefonla cekilmis gibi)',
    engine: { guidance: 2.4, steps: 32, cfg: 4.5 },
    sentences: [
      'A candid, unposed amateur snapshot taken on a modern smartphone camera.',
      `${SKIN_REAL}. ${IMPERFECTION}.`,
      'An unretouched frame straight out of the camera: available light with uneven shadows, slightly off-centre framing, a trace of motion blur, muted everyday colours and fine sensor grain.',
    ],
    tags: [
      '(RAW candid photo:1.3)', '(photorealistic:1.3)', 'amateur smartphone snapshot',
      '(skin texture:1.2)', '(skin pores:1.1)', 'subsurface scattering', 'imperfect skin',
      'natural available light', 'slight motion blur', 'muted natural colours',
      'unretouched', 'film grain',
    ],
    plain: [
      'candid amateur phone photo', 'unretouched straight out of camera',
      'natural skin texture with visible pores', 'available light with uneven shadows',
      'muted everyday colours', 'fine sensor grain',
    ],
  },
  pro: {
    label: 'Gercekci profesyonel (fotografci cekimi)',
    engine: { guidance: 3.0, steps: 30, cfg: 5 },
    sentences: [
      'Photographed by a professional on a Canon EOS R5 with an 85mm f/1.4 lens.',
      `${SKIN_REAL}. ${IMPERFECTION}.`,
      'An unretouched frame with realistic colour grading, shallow depth of field, sharp focus on the eyes and subtle film grain.',
    ],
    tags: [
      '(RAW photo:1.3)', '(photorealistic:1.3)', 'Canon EOS R5', '85mm f/1.4',
      '(skin texture:1.2)', '(skin pores:1.1)', 'subsurface scattering',
      'shallow depth of field', 'sharp focus on eyes', 'film grain', 'unretouched',
    ],
    plain: [
      'photorealistic', 'shot on Canon EOS R5 with 85mm f/1.4',
      'natural skin texture with visible pores', 'unretouched', 'shallow depth of field',
      'sharp focus on the eyes', 'film grain',
    ],
  },
  editorial: {
    label: 'Editoryal / moda',
    engine: { guidance: 3.5, steps: 28, cfg: 6 },
    sentences: [
      'An editorial fashion photograph shot on a medium format camera.',
      `${SKIN_REAL}.`,
      'Controlled studio lighting, realistic colour, sharp focus, high detail, skin left largely untouched.',
    ],
    tags: [
      '(editorial fashion photo:1.2)', '(photorealistic:1.2)', 'medium format',
      '(skin texture:1.2)', 'skin pores', 'studio lighting', 'high detail', 'minimal retouching',
    ],
    plain: [
      'editorial fashion photograph', 'medium format camera',
      'natural skin texture', 'controlled studio lighting', 'high detail',
    ],
  },
};

/** Lehceye gore dogru gercekcilik bicimi. */
function realismTags(real, dialect) {
  const weighted = dialect === 'sdxl';
  return weighted ? real.tags : real.plain;
}

/**
 * Tablo aramasi YALNIZ tablonun kendi anahtarlariyla yapilir.
 * Panelden gelen "constructor" / "__proto__" / "toString" gibi degerler
 * Object.prototype'a dusup "bulundu" sayiliyor ve sonraki satirda 500 veriyordu.
 */
function ownGet(table, key) {
  return typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined;
}

function realismOf(scene) {
  return ownGet(REALISM, scene.realism) || REALISM.ultra;
}

const QUALITY = {
  // Vesikalik seti: kimligi tanimlayan kare. Duz isik gercek bir kimlik
  // fotografinin kendisidir, ama cilt yine gercek dokuda olmali.
  reference: [
    'photorealistic', SKIN_REAL, IMPERFECTION,
    'sharp focus across the whole face', 'evenly lit', 'no makeup styling',
    'no jewellery', 'no accessories', 'shot on 85mm lens at f/8',
    'full face in focus', 'high detail', 'unretouched identification photo',
  ],
};

// Tum olculer 16'nin kati olmali - difuzyon modelleri latent uzayda 8/16
// kat kucultuyor, bolunmeyen olcude kenar bozulmasi ve detay kaybi oluyor.
// Eski deger 864x1080 idi; 1080 sayisi 16'ya bolunmuyor.
const ASPECT = {
  'post': { label: 'Instagram post (4:5)', mj: '4:5', wh: [896, 1120], wideWh: [1024, 1280] },
  'story': { label: 'Story / Reel (9:16)', mj: '9:16', wh: [768, 1344], wideWh: [896, 1568] },
  'square': { label: 'Kare (1:1)', mj: '1:1', wh: [1024, 1024], wideWh: [1152, 1152] },
  'wide': { label: 'Yatay (16:9)', mj: '16:9', wh: [1344, 768], wideWh: [1536, 896] },
};

/**
 * GENIS KADRAJDA YUZ ERIMESI
 *
 * Tam boy bir figurde yuz karenin kucuk bir kismini kaplar - 896x1120'de
 * yuz bolgesi birkac yuz piksele dusuyor;
 * VAE 8 kat kucultunce latent uzayda ~11 piksel kaliyor ve model orada goz,
 * burun, agiz uretemiyor - yuz eriyor. Cozum prompt degil, cozunurluk.
 * Genis kadrajda olcuyu buyutuyoruz.
 */
const WIDE_SHOT = /full body|wide|head to toe|knees up|three-quarter body|environmental/i;

/**
 * Kadraj GENIS mi - cozunurluk yukseltmesi buna bagli.
 *
 * Eski hali IKI YONDE birden yaniliyordu, olculdu:
 *
 *   1. YANLIS TETIK: poz metninde "wide-angle" gecen bir YAKIN PLAN
 *      portre genis sayiliyordu ("wide-angle selfie perspective").
 *      Sonuc 1024x1280 - yuz detayi butcesi bos yere buyuk kareye
 *      yayiliyordu. Kutuphane sahnelerinde bu ifade sik geciyor.
 *
 *   2. KACAK: "full_body_standing" gibi alt_cizgili yazilmis gercek tam
 *      boy kareler yakalanmiyordu (896x1120'de kaliyordu), cunku desen
 *      bosluk bekliyordu.
 *
 * Duzeltme: butun sahne alanlari birlestiriliyor, ayirici karakterler
 * boslugla normalize ediliyor ve "wide" yalnizca "wide-angle" DEGILSE
 * genis sayiliyor.
 */
function isWideShot(scene) {
  const metin = [scene.shot, scene.pose, scene.composition, scene.framing]
    .filter(Boolean).join(' ')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
  // "wide angle" bir LENS tarifi, kadraj tarifi degil.
  const lensiz = metin.replace(/\bwide angle\b/g, ' ');
  return WIDE_SHOT.test(lensiz) || /\bfull body\b|\bhead to toe\b|\bknees up\b|\bthree quarter body\b|\benvironmental\b/.test(lensiz);
}

/* ---------------------------------------------------- fiziksel cekirdek */

/**
 * Kimligin degismez tarifi. Her prompt'a AYNEN girer.
 */
/** Ayirt edici ozellik alani hem eski (metin) hem yeni (dizi) bicimi kabul eder. */
function distinctiveList(identity) {
  const raw = identity.distinctive;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw && raw !== 'Yok') return [raw];
  return [];
}

/**
 * @param {object} options
 *   short=true      -> vucut/boy/olcu atlanir (bas-omuz kadrajinda anlamsiz ve
 *                      prompt'u sulandirir)
 *   facialOnly=true -> sadece kadrajda gorunebilen ozellikler (bilek dovmesi
 *                      vesikalikta gorunmez; birakilirsa model uydurur)
 */
/* ------------------------------------------------------ yuz geometrisi */

/**
 * YUZ GEOMETRISI SOZLUKLERI
 *
 * Neden var: ucretsiz katmanda (referans gorsel kabul etmeyen platformlarda)
 * kimligi tutan TEK arac metindir. Eskiden physicalCore yalnizca ten/goz/sac
 * yaziyordu - yani model yuzun kemik yapisini her karede kendi uyduruyordu.
 * Ayni seed ayni yuzu getiriyordu ama poz degisince yuz kayiyordu.
 *
 * Kurallar:
 * - Ilk anahtar her zaman NOT_SET ('Belirtmeyecegim') ve '' doner.
 * - `|| identity.x` YEDEGI YOK. Bilinmeyen deger bos donmeli; aksi halde
 *   Turkce etiket ("Kalp yuz") oldugu gibi Ingilizce prompt'a sizar.
 * - NEGATIVE listesiyle catisan kelime yok: 'asymmetrical', 'smooth',
 *   'flawless', 'poreless' bilerek kullanilmadi.
 * - Hicbiri sayisal olcu icermez (guvenlik filtresi tetikliyor).
 */

const FACE_SHAPE = {
  'Oval': 'an oval face',
  'Yuvarlak': 'a round face',
  'Kare': 'a square face',
  'Dikdortgen / uzun': 'a long rectangular face',
  'Kalp': 'a heart-shaped face',
  'Elmas': 'a diamond-shaped face',
  'Ucgen': 'a triangular face with a wider jaw than forehead',
  'Armut': 'a pear-shaped face',
};

const JAWLINE = {
  'Keskin ve belirgin': 'a sharply defined jawline',
  'Yumusak ve yuvarlak': 'a soft rounded jawline',
  'Kare ve genis': 'a broad square jaw',
  'Sivri / dar': 'a narrow tapered jaw',
  'Cukur cene': 'a chin with a dimple in the middle',
  'Ileri cikik cene': 'a forward-set chin',
  'Geri cekik cene': 'a gently receding chin',
};

const CHEEKBONES = {
  'Cok belirgin / yuksek': 'high prominent cheekbones',
  'Belirgin': 'defined cheekbones',
  'Orta': 'moderately defined cheekbones',
  'Duz / az belirgin': 'low flat cheekbones',
  'Dolgun yanaklar': 'full rounded cheeks',
  'Cokuk yanaklar': 'hollow cheeks beneath the cheekbones',
};

const FOREHEAD = {
  'Genis ve yuksek': 'a wide high forehead',
  'Genis': 'a wide forehead',
  'Orta': 'a forehead of average height',
  'Dar': 'a narrow forehead',
  'Alcak': 'a low forehead with the hairline sitting close to the brows',
  'Hafif cikik': 'a slightly rounded forehead',
};

const EYE_SHAPE = {
  'Badem': 'almond-shaped eyes',
  'Yuvarlak / iri': 'large round eyes',
  'Capakli / hooded': 'hooded eyes with the lid crease partly covered',
  'Monolid': 'monolid eyes without a visible crease',
  'Cekik / yukari kalkik': 'upturned eyes lifting at the outer corners',
  'Asagi egimli': 'downturned eyes sloping at the outer corners',
  'Dar / cizgi': 'narrow eyes with a slim opening',
  'Belirgin cift kapak': 'eyes with a deep double eyelid crease',
};

const EYE_SET = {
  'Genis aralikli': 'wide-set eyes',
  'Dar aralikli': 'close-set eyes',
  'Ortalama aralikli': 'evenly spaced eyes',
  'Derin yerlesik': 'deep-set eyes',
  'Cikik / one yerlesik': 'prominent forward-set eyes',
};

const BROW_SHAPE = {
  'Duz ve kalin': 'straight thick eyebrows',
  'Duz ve ince': 'straight thin eyebrows',
  'Kemerli ve kalin': 'thick arched eyebrows',
  'Kemerli ve ince': 'thin arched eyebrows',
  'Yumusak kavisli': 'softly curved eyebrows',
  'Keskin acili': 'sharply angled eyebrows',
  'Dogal / bakimsiz': 'natural untrimmed eyebrows',
  'Birlesige yakin': 'eyebrows set close together above the nose',
};

const NOSE_BRIDGE = {
  'Duz ve ince': 'a straight narrow nose bridge',
  'Duz ve genis': 'a straight broad nose bridge',
  'Yuksek / belirgin': 'a high prominent nose bridge',
  'Alcak / duz': 'a low flat nose bridge',
  'Kemerli (Roma)': 'a nose with a convex Roman arch',
  'Cukur (kavisli)': 'a nose with a gently concave bridge',
};

const NOSE_TIP = {
  'Sivri': 'a pointed nose tip',
  'Yuvarlak': 'a rounded nose tip',
  'Genis / etli': 'a broad fleshy nose tip',
  'Yukari kalkik': 'an upturned nose tip',
  'Asagi donuk': 'a downturned nose tip',
  'Bolunmus': 'a nose tip with a slight cleft',
};

const LIP_FULLNESS = {
  'Cok dolgun': 'very full lips',
  'Dolgun': 'full lips',
  'Orta': 'lips of average fullness',
  'Ince': 'thin lips',
  'Ust dudak ince': 'a thin upper lip with a fuller lower lip',
  'Alt dudak dolgun': 'a noticeably fuller lower lip',
  'Genis agiz': 'a wide mouth',
  'Kucuk agiz': 'a small mouth',
};

const PHILTRUM = {
  'Belirgin ve derin': 'a deep well-defined philtrum groove above the lip',
  'Hafif': 'a shallow philtrum',
  'Uzun': 'a long philtrum between nose and lip',
  'Kisa': 'a short philtrum',
  'Belirgin kirik yay': 'a sharply drawn cupid\'s bow',
};

const EARS = {
  'Kucuk ve yatik': 'small ears held close to the head',
  'Orta': 'ears of average size',
  'Buyuk': 'large ears',
  'Kepce / disari acik': 'ears that stand out from the head',
  'Sivri ust kenar': 'ears with a slightly pointed upper edge',
  'Yapisik memecik': 'ears with attached lobes',
  'Serbest memecik': 'ears with free-hanging lobes',
};

const SKIN_TEXTURE = {
  'Belirgin gozenekli': 'visibly porous skin texture',
  'Normal gozenekli': 'natural skin texture with visible pores',
  'Ince dokulu': 'fine-grained skin texture',
  'Kuru / mat': 'matte dry-looking skin',
  'Yagli / parlak': 'skin with a natural sheen across the t-zone',
  'Ifade cizgileri belirgin': 'skin with visible expression lines',
  'Gunes gormus': 'weathered sun-exposed skin',
};

/** anahtar -> sozluk. wizard.FACE_KEYS ile ayni anahtarlar. */
const FACE_DICT = {
  faceShape: FACE_SHAPE,
  jawline: JAWLINE,
  cheekbones: CHEEKBONES,
  forehead: FOREHEAD,
  eyeShape: EYE_SHAPE,
  eyeSet: EYE_SET,
  browShape: BROW_SHAPE,
  noseBridge: NOSE_BRIDGE,
  noseTip: NOSE_TIP,
  lipFullness: LIP_FULLNESS,
  philtrum: PHILTRUM,
  ears: EARS,
  skinTexture: SKIN_TEXTURE,
};

/**
 * Genis kadrajda dusurulen INCE detaylar.
 * Tam boy karede yuz latent uzayda ~11 piksele dusuyor; filtrum tarifi orada
 * bilgi tasimaz, sadece prompt'u uzatip onemli kisimlari seyreltir.
 */
const FINE_FACE_KEYS = ['eyeSet', 'philtrum', 'ears', 'forehead', 'skinTexture'];

function physicalCore(identity, options = {}) {
  const gender = GENDER[identity.gender] || 'person';
  const ethnicity = ETHNICITY[identity.ethnicity] || identity.ethnicity;
  const region = REGION[identity.region] || identity.region;
  const skin = SKIN[identity.skinTone] || identity.skinTone;
  const eyes = EYES[identity.eyeColor] || identity.eyeColor;
  const hair = `${HAIR_STYLE[identity.hairStyle] || identity.hairStyle} ${HAIR_COLOR[identity.hairColor] || identity.hairColor} hair`;
  const body = BODY[identity.bodyType] || identity.bodyType;
  const list = distinctiveList(identity);
  const marks = options.facialOnly ? traits.describeFacial(list) : traits.describe(list);

  // Kullanicinin serbest yazdigi ek gorunum notu her zaman prompt'a girer -
  // listelerde olmayan hicbir sey elenmesin diye.
  const note = (identity.appearanceNote || '').trim();

  // Yuz geometrisi. Secilmemis alan '' doner ve filter(Boolean) ile duser -
  // yani bu alanlar eklenmeden once yaratilmis karakterlerde cumle
  // BIREBIR AYNI kalir.
  // faceDetail: 'full' (varsayilan) | 'core' (ince detaylar duser, genis kadraj)
  //           | 'none' (yuz alanlari hic girmez - ayri cumlede verilecekse)
  const ince = options.faceDetail === 'core';
  const yuzYok = options.faceDetail === 'none';
  const F = (key) => {
    // 'none' yalnizca YUZ GEOMETRISINI susturur. skinTexture bir cilt
    // ozelligi, yuz kemik yapisi degil - ayri cumleye tasinmaz, burada kalir.
    if (yuzYok && key !== 'skinTexture') return '';
    if (ince && FINE_FACE_KEYS.includes(key)) return '';
    const dict = FACE_DICT[key];
    const value = identity[key];
    if (!dict || !value) return '';
    return dict[value] || '';
  };

  if (options.short) {
    return [
      `${identity.age}-year-old ${ethnicity} ${gender}`,
      skin,
      F('faceShape'), F('jawline'), F('cheekbones'),
      eyes, F('eyeShape'), F('browShape'),
      F('noseBridge'), F('lipFullness'),
      hair,
      F('skinTexture'),
      ...marks, note,
    ].filter(Boolean).join(', ');
  }

  // Boy ve olculer prompt'a SAYI olarak girmez.
  // Iki sebep: (1) "24-year-old ... 163cm tall" gibi yas+olcu bitisikligi
  // bircok servisin guvenlik filtresini tetikliyor ve istek 500 donuyor
  // (Pollinations'ta olculu testle dogrulandi), (2) modeller santimetreyi
  // zaten anlamiyor - siluet tarifi cok daha iyi calisiyor.
  // Sayilar karakter dosyasinda aynen duruyor, sadece prompt'a girmiyor.
  const m = identity.measurements || {};
  const stature = [];
  const h = Number(m.height_cm);
  if (h) {
    if (h < 140) stature.push('notably short stature');
    else if (h < 158) stature.push('petite');
    else if (h > 185) stature.push('very tall');
    else if (h > 175) stature.push('tall');
  }

  // DIKKAT: bolge tarifi bilerek DISARIDA birakildi.
  // "Mediterranean coast heritage" gibi ifadelerdeki mekan kelimeleri
  // (coast, highlands) modeli sahneden kopararak plaja/dagliga cekiyordu.
  // Gorunusu zaten etnik koken tasiyor; bolge karakter verisinde duruyor.
  // Goz RENGI ile goz GEOMETRISI bitisik duruyor: model iki ayri yerde
  // gecen goz tarifini birlestirmekte zorlaniyor.
  const parts = [
    `${identity.age}-year-old ${ethnicity} ${gender}`,
    skin,
    F('faceShape'), F('jawline'), F('cheekbones'), F('forehead'),
    eyes, F('eyeShape'), F('eyeSet'), F('browShape'),
    F('noseBridge'), F('noseTip'),
    F('lipFullness'), F('philtrum'),
    F('ears'),
    hair,
    F('skinTexture'),
    body,
    ...stature,
    ...marks,
    note,
  ];

  return parts.filter(Boolean).join(', ');
}

/**
 * physicalCore'un uc parcasi: kimlik girisi, yuz cumlesi, geri kalani.
 * Dogal dil lehcelerinde (flux, dalle) yuzu AYRI BIR CUMLEYE almak icin.
 * Tek uzun virgullu yigin yerine iki cumle, modelin yuz tarifini gormesini
 * belirgin sekilde artiriyor.
 */
function physicalCoreSplit(identity, options = {}) {
  // lead: yuz alanlari HIC girmeden uretilir (metin oyunuyla cikarmak yerine).
  const lead = physicalCore(identity, { ...options, faceDetail: 'none' });

  const ince = options.faceDetail === 'core';
  const F = (key) => {
    if (ince && FINE_FACE_KEYS.includes(key)) return '';
    const dict = FACE_DICT[key];
    const value = identity[key];
    if (!dict || !value) return '';
    return dict[value] || '';
  };
  const yuz = [
    F('faceShape'), F('jawline'), F('cheekbones'), F('forehead'),
    F('eyeShape'), F('eyeSet'), F('browShape'),
    F('noseBridge'), F('noseTip'),
    F('lipFullness'), F('philtrum'), F('ears'),
  ].filter(Boolean);

  return { lead, face: yuz.join(', '), rest: '' };
}


/** Vesikalik icin ek negatifler: sahne/aksesuar sizmasini engeller. */
const REFERENCE_NEGATIVE = [
  'outdoor background', 'scenery', 'landscape', 'beach', 'sky', 'trees', 'street',
  'busy background', 'patterned background', 'props', 'jewellery', 'hat', 'sunglasses',
  'heavy makeup', 'full body', 'wide shot', 'multiple people', 'text overlay',
];

/** Sahneye gore negatif listeyi genisletir. */
function negativeFor(identity, scene = {}) {
  const extra = scene.style === 'reference' ? REFERENCE_NEGATIVE : [];
  return [...NEGATIVE, ...extra].join(', ');
}

/**
 * VESIKALIK PROMPTU - normal sahnelerden ayri kurulur.
 *
 * Neden ayri: gorsel modelleri prompt'un BASINDAKI kelimelere agirlik verir.
 * Kisiyi anlatarak baslarsan "duz gri stüdyo arka plani" talimati sonda kalir
 * ve model karakteri plaja, sokaga, nereye isterse koyar. Burada once FORMAT
 * soylenir, kisi sonra gelir.
 */
function buildReferencePrompt(identity, scene, dialect) {
  // Vesikalikta budama YOK: kare zaten yuze odakli, ince detaylarin tam da
  // ise yaradigi tek yer burasi.
  // Yuz alanlari core'a GIRMEZ; hemen altta kendi cumlesinde tam haliyle
  // veriliyor. Ikisini birden yazarsak ayni tarif iki kez gecer ve model
  // celisen agirlik alir.
  const core = physicalCore(identity, { short: true, facialOnly: true, faceDetail: 'none' });
  const split = physicalCoreSplit(identity, { faceDetail: 'full' });
  const naturalLanguage = ['flux', 'dalle', 'leonardo', 'higgsfield', 'generic'].includes(dialect);

  if (naturalLanguage) {
    // Sira onemli: once format (arka plani sabitler), hemen ardindan KISI
    // (kimligi yuksek agirlikta tutar), en sonda aci ve teknik detaylar.
    return [
      scene.lead ? `${scene.lead} Plain, seamless light grey background.` : 'A studio passport identification photograph taken against a plain, seamless light grey background.',
      `The subject is a ${core}.`,
      // "yukarida tarif edildigi gibi" satiri, yuz geometrisi yokken bos bir
      // soze isaret ediyordu. Artik gercekten tarif edilen bir sey var.
      split.face ? `They have ${split.face}.` : '',
      'Their hair length, hair style, eye colour and facial features must stay exactly as described above.',
      `${capitalise(scene.shot)}.`,
      `${capitalise(scene.pose)}.`,
      'They are wearing a plain white crew-neck t-shirt.',
      'Flat, even studio lighting, soft and shadowless, neutral white.',
      `Photorealistic and unretouched: ${SKIN_REAL}. ${IMPERFECTION}. Sharp focus across the whole face, high detail.`,
      'It looks like a real photograph of a real person, captured on a real camera.',
      'The background is a completely empty flat grey wall, bare and uninterrupted.',
      `Again: ${capitalise(scene.pose)}.`,
    ].join(' ');
  }

  // Etiket tabanli araclar (Midjourney, SDXL): format kelimeleri yine basta.
  return [
    scene.lead ? scene.pose : 'passport ID photograph', 'plain seamless light grey studio backdrop',
    scene.shot, scene.pose,
    core,
    split.face,
    'plain white crew-neck t-shirt', 'flat even studio lighting', 'no shadows',
    '(RAW photo:1.3)', '(photorealistic:1.3)', SKIN_REAL, IMPERFECTION,
    'subsurface scattering', 'film grain', 'unretouched',
    'sharp focus on the face', 'high detail',
  ].filter(Boolean).join(', ');
}

/** Insan tarafindan okunabilir kisa ozet (panelde gosterilir) */
function identityLine(identity) {
  return physicalCore(identity);
}

/* ------------------------------------------------------------- lehceler */

const DIALECTS = {
  midjourney: {
    label: 'Midjourney',
    supportsNegative: false,
    supportsSeed: true,
    notes: [
      'Resmi API yok. Prompt\'u kopyalayip Discord/web arayuzune yapistir.',
      'Yuz kilidi icin golden shot\'i internete yukleyip --cref <url> --cw 100 ekle.',
    ],
  },
  leonardo: {
    label: 'Leonardo.ai (Phoenix)',
    supportsNegative: true,
    supportsSeed: true,
    notes: [
      'Negatif prompt ayri alana girilir.',
      'Yuz kilidi icin golden shot\'i "Image Guidance / Character Reference" olarak 0.8-0.9 agirlikla ekle.',
    ],
  },
  sdxl: {
    label: 'Stable Diffusion / SDXL (A1111, ComfyUI, Forge)',
    supportsNegative: true,
    supportsSeed: true,
    notes: [
      'Onerilen: 30 adim, CFG 4.5-6, DPM++ 2M Karras, 832x1216.',
      'Yuz kilidi icin IPAdapter FaceID veya bir LoRA en saglam sonucu verir.',
    ],
  },
  flux: {
    label: 'FLUX (Replicate, fal, BFL)',
    supportsNegative: false,
    supportsSeed: true,
    notes: [
      'Negatif prompt kullanmaz - istemediklerini yazma, sadece istedigini tarif et.',
      'Duz cumlelerle yazilan uzun tarifleri etiket yiginindan daha iyi anlar.',
    ],
  },
  dalle: {
    label: 'DALL-E 3 / gpt-image (OpenAI)',
    supportsNegative: false,
    supportsSeed: false,
    notes: [
      'Seed desteklemez - ayni yuzu birebir tekrarlamakta en zayif secenek.',
      'Prompt\'u kendi icinde yeniden yazar; bu yuzden tarif cok net olmali.',
    ],
  },
  higgsfield: {
    label: 'Higgsfield / karakter referansli araclar',
    supportsNegative: true,
    supportsSeed: true,
    notes: [
      'Once golden shot\'i "character / soul" olarak kaydet, sonra her uretimde onu sec.',
      'Bu tur araclarda tutarlilik prompt\'tan cok referans karakterden gelir.',
    ],
  },
  generic: {
    label: 'Genel (diger tum araclar)',
    supportsNegative: true,
    supportsSeed: true,
    notes: ['Araciniz ne kabul ediyorsa: prompt + negatif + seed alanlarini doldurun.'],
  },
};

/* -------------------------------------------------------------- uretim */

/**
 * Duz cumle isteyen lehceler (DALL-E) icin eksik artikeli tamamlar.
 * Difuzyon modelleri artikelsiz etiket dizisinden etkilenmez, ama DALL-E
 * prompt'u bir dil modeli gibi yeniden yazdigi icin dilbilgisi onemli.
 */
const UNCOUNTABLE = new Set([
  'produce', 'jewelry', 'jewellery', 'makeup', 'coffee', 'water', 'food',
  'equipment', 'lighting', 'hair', 'sportswear', 'swimwear', 'denim',
  'linen', 'gear', 'clothing', 'furniture', 'art', 'music',
]);

function withArticle(phrase) {
  const text = String(phrase || '').trim();
  if (!text) return '';
  if (/^(a|an|the|his|her|their|its|some|two|three)\s/i.test(text)) return text;
  const words = text.split(/\s+/);
  const last = words[words.length - 1].toLowerCase();
  if (last.endsWith('s')) return text;          // cogul
  if (UNCOUNTABLE.has(last)) return text;       // sayilamayan
  return `${/^[aeiou]/i.test(text) ? 'an' : 'a'} ${text}`;
}

/**
 * Poz zaten "holding ..." diyorsa aksesuari tekrar "holding" ile eklemek
 * modeli sasirtiyor (iki ayri nesne sanip ikisini de dusuruyor).
 */
function propsPhrase(scene) {
  if (!scene.props) return '';
  const poseHasHold = /\bholding\b/i.test(scene.pose || '');
  return poseHasHold ? `with ${scene.props} clearly in frame` : `holding ${scene.props}`;
}

function sceneWords(scene) {
  const bits = [];
  if (scene.shot) bits.push(scene.shot);
  if (scene.outfit) bits.push(`wearing ${scene.outfit}`);
  if (scene.pose) bits.push(scene.pose);
  if (scene.setting) bits.push(`in ${scene.setting}`);
  const props = propsPhrase(scene);
  if (props) bits.push(props);
  if (scene.lighting) bits.push(scene.lighting);
  if (scene.mood) bits.push(`${scene.mood} mood`);
  return bits.filter(Boolean);
}

/**
 * Ana fonksiyon.
 * @param {object} character  data/character.json icerigi
 * @param {object} scene      { shot, outfit, pose, setting, props, lighting, mood, aspect, extra }
 * @param {string} dialect    DIALECTS anahtari
 */
function build(character, scene = {}, dialect = 'generic') {
  const identity = character.identity;
  const aspectKey = ownGet(ASPECT, scene.aspect) ? scene.aspect : 'post';
  const aspectBase = ASPECT[aspectKey];
  // Genis kadrajda yuze daha cok piksel dusmesi icin cozunurluk buyutulur.
  const wide = isWideShot(scene) && scene.style !== 'reference';
  // Genis kadrajda ince yuz detaylari dusuruluyor: yuz zaten birkac piksel,
  // filtrum tarifi orada bilgi tasimadan prompt'u seyreltiyor.
  const core = physicalCore(identity, { faceDetail: wide ? 'core' : 'full' });
  const aspect = { ...aspectBase, wh: wide ? aspectBase.wideWh : aspectBase.wh };
  // Vesikalik acilarinda seed kaydirilir (bkz. reference.sceneFor): ayni seed
  // ile model aci talimatini yok sayip ayni kareyi tekrar uretiyor.
  // reroll: ayni prompt'un N. yeniden denemesi; tohum her denemede kayar (yoksa "yeniden uret" ayni kareyi verir).
  const seed = (scene.seedOffset || scene.reroll)
    ? (character.seed + (scene.seedOffset || 0) + (Number(scene.reroll) || 0) * 104729) % 2147483647
    : character.seed;
  const words = sceneWords(scene);
  const real = realismOf(scene);
  const quality = ownGet(QUALITY, scene.style) || realismTags(real, dialect);
  const extra = scene.extra ? String(scene.extra).trim() : '';
  const spec = ownGet(DIALECTS, dialect) || DIALECTS.generic;

  // Negatif liste, secilen riskli ozelliklere gore genisler (cil -> lekelenme,
  // dovme -> bulanik/degisken desen) ve vesikalikta sahne sizmasini engeller.
  const negative = negativeFor(identity, scene);
  let prompt;
  const params = {};

  // Vesikalik: format-onde prompt, tum lehcelerde ayni mantik.
  if (scene.style === 'reference') {
    prompt = buildReferencePrompt(identity, scene, dialect);
    if (dialect === 'midjourney') {
      const flags = [`--ar ${aspect.mj}`, '--style raw', '--v 7', `--seed ${seed}`];
      prompt = `${prompt} ${flags.join(' ')}`;
    } else if (dialect === 'dalle') {
      params.size = '1024x1024';
    } else {
      params.negative_prompt = negative;
      params.seed = seed;
      params.width = aspect.wh[0];
      params.height = aspect.wh[1];
    }
    return {
      dialect,
      dialectLabel: spec.label,
      prompt: prompt.replace(/\s+/g, ' ').trim(),
      negative: spec.supportsNegative ? negative : null,
      seed: spec.supportsSeed ? seed : null,
      aspect: aspectKey,
      aspectLabel: aspect.label,
      width: aspect.wh[0],
      height: aspect.wh[1],
      params,
      notes: spec.notes,
      core,
      isReference: true,
    };
  }

  switch (dialect) {
    case 'midjourney': {
      prompt = [core, ...words, ...quality, extra].filter(Boolean).join(', ');
      const flags = [`--ar ${aspect.mj}`, '--style raw', '--v 7', `--seed ${seed}`];
      if (character.reference && character.reference.publicUrl) {
        flags.push(`--cref ${character.reference.publicUrl}`, '--cw 100');
      }
      prompt = `${prompt} ${flags.join(' ')}`;
      break;
    }

    case 'leonardo': {
      prompt = [
        `A ${core}, ${words.join(', ')}.`,
        real.sentences.join(' '),
        extra,
      ].filter(Boolean).join(' ');
      params.negative_prompt = negative;
      params.seed = seed;
      params.width = aspect.wh[0];
      params.height = aspect.wh[1];
      params.preset = 'LEONARDO';
      break;
    }

    case 'sdxl': {
      prompt = [
        ...quality,
        core,
        ...words,
        extra,
      ].filter(Boolean).join(', ');
      params.negative_prompt = negative;
      params.seed = seed;
      params.steps = real.engine.steps;
      params.cfg_scale = real.engine.cfg;
      params.sampler = 'DPM++ 2M Karras';
      params.width = aspect.wh[0];
      params.height = aspect.wh[1];
      break;
    }

    case 'flux': {
      // Once KADRAJ + MEKAN, sonra kisi, sonra eylem. Kisiyi anlatarak
      // baslarsan model bunu bir portre istegi sanip mekani gormezden gelir.
      const fluxSplit = physicalCoreSplit(identity, { faceDetail: wide ? 'core' : 'full' });
      prompt = [
        `${capitalise(scene.shot || 'A candid photograph')}${scene.setting ? `, set in ${scene.setting}` : ''}.`,
        `The subject is a ${fluxSplit.lead}.`,
        // Yuz AYRI CUMLE: tek uzun virgullu yiginda model yuz tarifini
        // gormezden geliyordu.
        fluxSplit.face ? `They have ${fluxSplit.face}.` : '',
        [
          scene.pose ? `They are ${scene.pose}` : '',
          scene.outfit ? `wearing ${scene.outfit}` : '',
          propsPhrase(scene),
        ].filter(Boolean).join(', ') + '.',
        scene.lighting ? `${capitalise(scene.lighting)}.` : '',
        extra ? `${extra}.` : '',
        real.sentences.join(' '),
      ].filter((s) => s && s !== '.').join(' ');
      params.seed = seed;
      params.width = aspect.wh[0];
      params.height = aspect.wh[1];
      break;
    }

    case 'dalle': {
      // DALL-E etiket yigini degil duz cumle ister; sahneyi cumlelere ceviriyoruz.
      const sentences = [
        scene.shot ? `Framed as ${withArticle(scene.shot)}.` : '',
        scene.outfit ? `The subject is wearing ${withArticle(scene.outfit)}.` : '',
        scene.pose ? `They are ${scene.pose}.` : '',
        scene.setting ? `The scene is set in ${withArticle(scene.setting)}.` : '',
        scene.props ? `They are holding ${withArticle(scene.props)}.` : '',
        scene.lighting ? `Lit by ${withArticle(scene.lighting)}.` : '',
        scene.mood ? `The overall mood is ${scene.mood}.` : '',
      ].filter(Boolean).join(' ');

      prompt = [
        `A photograph of a ${core}.`,
        sentences,
        real.sentences.join(' '),
        'It looks like a real photograph of a real person, captured on a real camera. The frame contains only the photograph itself.',
        extra,
      ].filter(Boolean).join(' ');
      params.size = aspectKey === 'square' ? '1024x1024' : (aspectKey === 'wide' ? '1792x1024' : '1024x1792');
      break;
    }

    case 'higgsfield': {
      prompt = [
        `${core}, ${words.join(', ')}.`,
        real.sentences.join(' '),
        extra,
      ].filter(Boolean).join(' ');
      params.negative_prompt = negative;
      params.seed = seed;
      params.aspect_ratio = aspect.mj;
      params.character_reference = character.reference && character.reference.publicUrl
        ? character.reference.publicUrl
        : '(golden shot\'i platformda karakter olarak kaydet ve burada sec)';
      break;
    }

    default: {
      prompt = [core, ...words, ...quality, extra].filter(Boolean).join(', ');
      params.negative_prompt = negative;
      params.seed = seed;
      params.width = aspect.wh[0];
      params.height = aspect.wh[1];
    }
  }

  return {
    dialect,
    dialectLabel: spec.label,
    prompt: prompt.replace(/\s+/g, ' ').trim(),
    negative: spec.supportsNegative ? negative : null,
    seed: spec.supportsSeed ? seed : null,
    aspect: aspectKey,
    aspectLabel: aspect.label,
    width: aspect.wh[0],
    height: aspect.wh[1],
    wideShot: wide,
    params,
    // Motor ayarlari: saglayiciya AYRICA gonderilir. Eskiden params icinde
    // hesaplanip yolda dusuruluyordu, model varsayilanlariyla calisiyordu.
    engine: { ...real.engine },
    realism: scene.realism || 'ultra',
    notes: spec.notes,
    core,
  };
}

function buildAll(character, scene = {}) {
  const out = {};
  for (const key of Object.keys(DIALECTS)) {
    out[key] = build(character, scene, key);
  }
  return out;
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  build,
  buildAll,
  physicalCore,
  physicalCoreSplit,
  FACE_DICT,
  FINE_FACE_KEYS,
  identityLine,
  DIALECTS,
  ASPECT,
  NEGATIVE,
  REALISM,
  realismOptions: () => Object.entries(REALISM).map(([key, v]) => ({ key, label: v.label })),
};
