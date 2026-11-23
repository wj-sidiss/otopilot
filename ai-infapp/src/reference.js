'use strict';

/**
 * VESIKALIK SETI (referans kareler)
 *
 * Karakter yaratildiktan sonra atilacak ILK adim. Herhangi bir icerik gorseli
 * uretmeden once yuzun 8 acidan vesikaligi cikarilir.
 *
 * Neden: tek bir "altin kare" yuzu sadece o acidan tanimlar. Model karakteri
 * yandan veya asagidan gostermek istediginde tahmin etmeye baslar ve yuz kayar.
 * 8 acilik set, hem referans destekleyen platformlara dogru aciyi verir hem de
 * LoRA egitimi / platform karakteri olusturmak icin gereken minimum veri setidir.
 *
 * Kritik kural: 8 karede DEGISEN TEK SEY ACIDIR. Kiyafet, arka plan, isik ve
 * ifade birebir ayni tutulur - degisen her ek degisken yuzu kaydirir.
 */

const BASE_SCENE = {
  shot: 'tightly cropped passport-style identification headshot, head and shoulders only, the face filling most of the frame',
  outfit: 'a plain white crew-neck t-shirt',
  setting: 'a plain light grey seamless studio background',
  props: '',
  lighting: 'flat even soft studio lighting with no harsh shadows on the face',
  mood: 'neutral and relaxed',
  aspect: 'square',
  style: 'reference',
};

const ANGLES = [
  {
    // TEK KAREDE COK GORUNUM.
    // Referans gorsel kabul etmeyen modellerde (FLUX/Pollinations gibi) en
    // tutarli yontem budur: acilari ayri ayri uretmek yerine hepsini AYNI
    // karede uretmek. Model tek bir goruntu icinde kendini tutarli tutmak
    // zorunda kaldigi icin yuz, sac ve kiyafet uc gorunumde de ayni cikar.
    key: 'sheet',
    label: 'Karakter sayfasi (3 gorunum)',
    order: 0,
    isSheet: true,
    aspect: 'wide',
    pose: 'shown three times side by side in a single frame as a character model sheet: front view on the left, 45 degree three-quarter view in the middle, and full side profile on the right, identical face, identical hair and identical clothing in all three, evenly spaced, neutral expression with the mouth closed',
  },
  {
    key: 'front',
    label: 'Onden (0°)',
    order: 1,
    primary: true,
    pose: 'looking perfectly straight into the camera, face square to the lens, both ears equally visible, neutral expression with the mouth closed',
  },
  {
    key: 'quarter_left',
    label: 'Sol ceyrek (45°)',
    order: 2,
    pose: 'head turned 45 degrees to their left in a three-quarter view, eyes still looking towards the camera, neutral expression with the mouth closed',
  },
  {
    key: 'quarter_right',
    label: 'Sag ceyrek (45°)',
    order: 3,
    pose: 'head turned 45 degrees to their right in a three-quarter view, eyes still looking towards the camera, neutral expression with the mouth closed',
  },
  {
    key: 'profile_left',
    label: 'Sol profil (90°)',
    order: 4,
    pose: 'a full 90 degree left profile, the nose pointing towards the left edge of the frame, looking straight ahead, neutral expression with the mouth closed',
  },
  {
    key: 'profile_right',
    label: 'Sag profil (90°)',
    order: 5,
    pose: 'a full 90 degree right profile, the nose pointing towards the right edge of the frame, looking straight ahead, neutral expression with the mouth closed',
  },
  {
    key: 'tilt_up',
    label: 'Alttan aci',
    order: 6,
    pose: 'facing the camera with the chin slightly raised, photographed from slightly below eye level, neutral expression with the mouth closed',
  },
  {
    key: 'tilt_down',
    label: 'Ustten aci',
    order: 7,
    pose: 'facing the camera with the chin slightly lowered, photographed from slightly above eye level, neutral expression with the mouth closed',
  },
  {
    key: 'back_quarter',
    label: 'Arkadan ceyrek',
    order: 8,
    pose: 'seen from behind at a three-quarter angle, showing the back of the head, the hairline at the neck and one ear, face mostly hidden',
  },
];


// ACI-ONCE ACILIS: hizli/damitilmis modeller (Pollinations "sana" gibi) prompt'un ILK cumlesine agirlik verir; "pasaport vesikaligi"
// cumlesi onde olunca ne yazarsan yaz tam karsidan yuz uretiyorlar (8 aci = ayni kare). Onden harici her aci kendi acisiyla acilir.
const LEADS = {
  sheet: 'A character model sheet photograph with three views of the same person.',
  quarter_left: 'A three-quarter view studio portrait photograph, the head turned 45 degrees to the left so the right cheek is closer to the camera.',
  quarter_right: 'A three-quarter view studio portrait photograph, the head turned 45 degrees to the right so the left cheek is closer to the camera.',
  profile_left: 'A side-profile studio portrait photograph, seen exactly from the side: only one side of the face is visible, the nose points to the left edge of the frame, one eye visible.',
  profile_right: 'A side-profile studio portrait photograph, seen exactly from the side: only one side of the face is visible, the nose points to the right edge of the frame, one eye visible.',
  tilt_up: 'A studio portrait photograph taken from slightly below eye level, the chin raised.',
  tilt_down: 'A studio portrait photograph taken from slightly above eye level, the chin lowered.',
  back_quarter: 'A studio portrait photograph taken from behind, the back of the head and the neck visible, the face turned away from the camera.',
};
const NO_FRONT_SHOT = 'a head-and-shoulders studio portrait, plain background';

const BY_KEY = new Map(ANGLES.map((a) => [a.key, a]));

/** Bir acinin promptcraft'a verilecek sahne nesnesi. */
function sceneFor(angleKey) {
  const angle = BY_KEY.get(angleKey);
  if (!angle) return null;
  return {
    ...BASE_SCENE,
    id: `ref_${angle.key}`,
    angle: angle.key,
    category: 'reference',
    categoryLabel: `Vesikalik · ${angle.label}`,
    pose: angle.pose,
    aspect: angle.aspect || BASE_SCENE.aspect,
    // onden disindaki acilarda "pasaport vesikaligi / yuz kadrajin cogunu doldurur" ifadesi KALKAR: profil istenirken
    // "karsidan, yuz kadrajda" demek modele celisen sinyal verip karsidan yuz urettiriyordu.
    shot: angle.isSheet
      ? 'a character model sheet with three head-and-shoulders views of the same person side by side'
      : (angle.key === 'front' ? BASE_SCENE.shot : NO_FRONT_SHOT),
    lead: LEADS[angle.key] || '',
    // Her aciya kimlikten turetilmis FARKLI bir seed verilir.
    // Ayni seed + ayni kalip = model aci talimatini yok sayip birebir ayni
    // kareyi tekrar uretiyor; 8 kare yerine 1 kareyi 8 kez almis oluyorduk.
    seedOffset: angle.order * 7919,
  };
}

function list() {
  return ANGLES.map(({ key, label, order, primary }) => ({ key, label, order, primary: !!primary }));
}

function primaryKey() {
  return (ANGLES.find((a) => a.primary) || ANGLES[0]).key;
}

/**
 * Karakterin vesikalik durumu: kac aci tamam, hangileri eksik.
 */
function status(character) {
  const set = (character && character.referenceSet) || {};
  const done = ANGLES.filter((a) => set[a.key] && set[a.key].filename);
  return {
    total: ANGLES.length,
    done: done.length,
    complete: done.length === ANGLES.length,
    missing: ANGLES.filter((a) => !(set[a.key] && set[a.key].filename)).map((a) => a.key),
    angles: ANGLES.map((a) => ({
      key: a.key,
      label: a.label,
      order: a.order,
      shot: set[a.key] || null,
      isPrimary: !!(character && character.reference && set[a.key] && character.reference.filename === set[a.key].filename),
    })),
  };
}

/**
 * Sahneye en uygun referans kareyi secer.
 *
 * Eskiden her uretimde SADECE birincil (onden) kare gonderiliyordu:
 * profil karesi isterken bile modele onden vesikalik gidiyordu ve model
 * celisen iki sinyal aliyordu (metin "yandan" diyor, referans "onden"
 * gosteriyor). 8 acilik setin geri kalani hic kullanilmiyordu.
 *
 * Simdi sahnenin pozundaki yon ipuclarina gore aci esleniyor.
 */
// ".*" yerine ".{0,80}": sinirsiz .* her "turned " gecisinde satir sonuna kadar tarayip
// geri donuyordu (kareli); 80 karakter bir yon ipucunun komsulugu icin fazlasiyla yeter.
const DIRECTION_HINTS = [
  { test: /full (left )?profile|90 degree left|side profile.{0,80}left/i, angle: 'profile_left' },
  { test: /full (right )?profile|90 degree right/i, angle: 'profile_right' },
  { test: /\bprofile\b|side view|from the side/i, angle: 'profile_left' },
  { test: /turned .{0,80}left|three-quarter.{0,80}left|looking over .{0,80}left/i, angle: 'quarter_left' },
  { test: /turned .{0,80}right|three-quarter.{0,80}right|over the shoulder/i, angle: 'quarter_right' },
  { test: /from behind|back of the head|rear view/i, angle: 'back_quarter' },
  { test: /from (slightly )?below|low angle|chin (slightly )?raised/i, angle: 'tilt_up' },
  { test: /from (slightly )?above|high angle|chin (slightly )?lowered/i, angle: 'tilt_down' },
];

function pickReference(character, scene = {}) {
  const set = (character && character.referenceSet) || {};
  const has = (key) => set[key] && set[key].filename;

  // Vesikalik uretiliyorsa kendi karesini referans alma - kendi kopyasindan
  // aci uretilemez.
  if (scene.style === 'reference') {
    return has('front') && scene.angle !== 'front' ? set.front.filename : null;
  }

  // Metin sinirli: yon ipucu pozun basinda gecer; dev bir poz/kadraj regex'leri yavaslatmasin.
  // Her alan ayri kirpilir ki dev bir poz kadraj ipucunu yutmasin.
  const parca = (v) => (typeof v === 'string' ? v.slice(0, 600) : '');
  const text = `${parca(scene.pose)} ${parca(scene.shot)}`;
  for (const hint of DIRECTION_HINTS) {
    if (hint.test.test(text) && has(hint.angle)) return set[hint.angle].filename;
  }

  // Yon ipucu yoksa: birincil kare, yoksa onden, yoksa elde ne varsa.
  if (character.reference && character.reference.filename) return character.reference.filename;
  if (has('front')) return set.front.filename;
  const first = Object.values(set).find((s) => s && s.filename);
  return first ? first.filename : null;
}

module.exports = { ANGLES, BASE_SCENE, sceneFor, list, primaryKey, status, pickReference };
