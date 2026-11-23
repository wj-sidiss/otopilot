'use strict';

/**
 * VESIKALIK ACILARI + "YENIDEN URET" (8 aci / her yeniden uretim ayni foto sorunu)
 *
 *  R-01  onden harici her aci KENDI acisiyla acilir: prompt'un ilk cumlesi aciyi soyler, "pasaport vesikaligi / yuz kadrajin cogunu
 *        doldurur" onden-onyargisi yalniz 'front' acisinda kalir (damitilmis modeller ilk cumleye uyar; eskiden 8 aci = ayni karsidan kare)
 *  R-02  8 acinin acilis cumleleri birbirinden farkli (ayni baslangic = ayni kare)
 *  R-03  reroll tohumu kaydirir: ayni prompt'un N. denemesi farkli tohum; reroll yoksa tohum degismez (geriye uyum)
 *  R-04  tohum acisi + reroll toplanir; tag tabanli (midjourney) lehcede de aci acilisi onde
 *
 * Ag yok, gercek data/ klasorune dokunulmaz.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const reference = require('../src/reference');
const promptcraft = require('../src/promptcraft');

const character = {
  seed: 1234567,
  identity: {
    name: 'Test', handle: 'test', gender: 'Kadin', region: 'Akdeniz', ethnicity: 'Akdeniz', skinTone: 'Cok acik (porselen)',
    eyeColor: 'Kahverengi', hairColor: 'Siyah', hairStyle: 'Trasli / cok kisa', age: 27, bodyType: 'Ince / zayif',
    measurements: { height_cm: 168, weight_kg: 56 }, distinctive: [], appearanceNote: '',
  },
};
const prompt = (angle, dialect = 'flux', extra = {}) => promptcraft.build(character, { ...reference.sceneFor(angle), ...extra }, dialect);
const ONDEN_DISI = reference.ANGLES.map((a) => a.key).filter((k) => k !== 'front');

test('R-01: onden harici her aci kendi acisiyla baslar, pasaport onyargisi yalniz onde', () => {
  const front = prompt('front').prompt;
  assert.match(front, /^A studio passport identification photograph/);
  assert.match(front, /Tightly cropped passport-style identification headshot/);
  for (const key of ONDEN_DISI) {
    const p = prompt(key).prompt;
    assert.doesNotMatch(p.slice(0, 160), /passport/i, `${key}: acilis cumlesinde pasaport onyargisi var`);
    assert.doesNotMatch(p, /Tightly cropped passport-style/, `${key}: "yuz kadraji dolduruyor" onyargisi kaldi`);
    assert.match(p, /Plain, seamless light grey background/);
  }
  assert.match(prompt('profile_left').prompt.slice(0, 200), /side-profile/i);
  assert.match(prompt('quarter_left').prompt.slice(0, 200), /three-quarter/i);
  assert.match(prompt('back_quarter').prompt.slice(0, 200), /from behind/i);
});

test('R-02: aci acilis cumleleri birbirinden farkli', () => {
  const acilislar = ONDEN_DISI.map((k) => prompt(k).prompt.split('.')[0]);
  assert.equal(new Set(acilislar).size, acilislar.length, 'iki aci ayni cumleyle basliyor: ' + acilislar.join(' | '));
  assert.notEqual(prompt('front').prompt.split('.')[0], acilislar[0]);
});

test('R-03: reroll tohumu kaydirir, reroll yokken tohum degismez', () => {
  const taban = prompt('front').seed;
  assert.equal(promptcraft.build(character, { shot: 'a portrait', pose: 'standing' }, 'flux').seed, character.seed, 'sade sahne: tohum karakter tohumu (geriye uyum)');
  assert.equal(taban, (character.seed + reference.sceneFor('front').seedOffset) % 2147483647);
  assert.equal(prompt('front', 'flux', { reroll: 0 }).seed, taban);
  const r1 = prompt('front', 'flux', { reroll: 1 }).seed, r2 = prompt('front', 'flux', { reroll: 2 }).seed;
  assert.notEqual(r1, taban); assert.notEqual(r2, r1);
  assert.equal(r1, (taban + 104729) % 2147483647);
  assert.equal(prompt('front', 'flux', { reroll: 1 }).prompt, prompt('front').prompt, 'reroll prompt metnini degistirmemeli (kimlik ayni kalir)');
});

test('R-04: aci tohumu + reroll toplanir; tag lehcesinde de aci acilisi onde', () => {
  const s = reference.sceneFor('profile_left');
  const a = promptcraft.build(character, { ...s, reroll: 3 }, 'flux').seed;
  assert.equal(a, (character.seed + s.seedOffset + 3 * 104729) % 2147483647);
  const mj = promptcraft.build(character, reference.sceneFor('profile_left'), 'midjourney').prompt;
  assert.doesNotMatch(mj.slice(0, 40), /passport/i);
  assert.match(promptcraft.build(character, reference.sceneFor('front'), 'midjourney').prompt, /^passport ID photograph/);
});
