// Look families as parameter presets for pmndrs/postprocessing (Zlib) on three.js (MIT), plus one small
// kit effect (FilmGrain, MIT, this file) because the library noise has no size, hold or luminance response.
// See references/looks.md for what every parameter does and how to write a custom look from references.
//
// The kit installs nothing. The engine page loads pinned versions with an import map:
//   <script type="importmap">{ "imports": {
//     "three": "https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js",
//     "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/",
//     "postprocessing": "https://cdn.jsdelivr.net/npm/postprocessing@6.39.5/build/index.js" } }</script>
//
//   import { LOOKS, buildLook, makeMaterial } from './looks.mjs';
//   const look = buildLook({ renderer, scene, camera, look: LOOKS['anime-cel'], fps: 24, setTime });
//   window.renderFrame = (i) => look.render(i);
//
// Determinism: time comes from the frame index only (EffectPass time = frame / fps, composer delta 0), grain is a
// pure function of (frame, seed). No Clock, no requestAnimationFrame time, no Math.random in a capture.

import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute, BlendFunction,
  BloomEffect, ChromaticAberrationEffect, ToneMappingEffect, ToneMappingMode, HueSaturationEffect,
  BrightnessContrastEffect, VignetteEffect, ScanlineEffect, PixelationEffect, DotScreenEffect, OutlineEffect,
  TiltShiftEffect, DepthOfFieldEffect,
} from 'postprocessing';
import { Sky } from 'three/addons/objects/Sky.js';

// ---------------------------------------------------------------- presets (starting points, never the answer)
// palette: [background, ground, main, secondary, accent]; hue in radians; saturation/brightness/contrast -1..1.
// light.exposure multiplies the scene's light intensities (the scene applies it; see scene.html).

export const LOOKS = {
  'cinematic-realistic': {
    palette: ['#1d2430', '#5b4a3c', '#a88a6a', '#3e5568', '#e0a35a'],
    materials: { shading: 'pbr', roughness: 0.6 },
    light: { exposure: 1.0, azimuthDeg: 140, elevationDeg: 18, intensity: 3.2, ambient: 0.25, fog: 0 },   // fog only when the story has air
    post: { tone: 'AGX', saturation: -0.05, contrast: 0.08, brightness: 0,
      bloom: { threshold: 0.85, smoothing: 0.3, intensity: 0.6, radius: 0.7 },
      chromatic: 0.6, vignette: { offset: 0.3, darkness: 0.55 }, grain: { intensity: 0.05, size: 1.4 } },
    render: { fps: 24, hold: 1, aspects: ['16:9', '2.39:1', '9:16'] },
  },
  'anime-cel': {
    palette: ['#8cc6f2', '#7dbf6a', '#f2e3c6', '#5b6f99', '#f2a33a'],
    materials: { shading: 'toon', steps: 3 },
    light: { exposure: 1.05, azimuthDeg: 100, elevationDeg: 55, intensity: 2.6, ambient: 0.45, fog: 0 },
    post: { tone: 'NEUTRAL', saturation: 0.12, contrast: 0.04, brightness: 0.02,
      bloom: { threshold: 0.9, smoothing: 0.4, intensity: 0.35, radius: 0.8 },
      outline: { color: '#2a2633', strength: 3 } },
    render: { fps: 24, hold: 1, aspects: ['16:9', '9:16'] },
  },
  'pastel-storybook': {
    palette: ['#f6e4dc', '#e9c9b4', '#9fc9c0', '#f1b6b0', '#e8c66a'],
    materials: { shading: 'toon', steps: 4 },
    light: { exposure: 1.1, azimuthDeg: 175, elevationDeg: 40, intensity: 2.0, ambient: 0.7, fog: 0 },
    post: { tone: 'NEUTRAL', saturation: -0.08, contrast: -0.06, brightness: 0.04,
      bloom: { threshold: 0.8, smoothing: 0.5, intensity: 0.3, radius: 0.8 },
      vignette: { offset: 0.5, darkness: 0.2 }, grain: { intensity: 0.02, size: 1.6 } },
    render: { fps: 24, hold: 1, aspects: ['16:9', '1:1', '9:16'] },
  },
  'claymation': {
    palette: ['#3a3230', '#c98f5a', '#e05a3e', '#4f8f8a', '#f2d06b'],
    materials: { shading: 'pbr', roughness: 0.85 },
    light: { exposure: 1.0, azimuthDeg: 120, elevationDeg: 35, intensity: 3.0, ambient: 0.35, fog: 0 },
    post: { tone: 'ACES_FILMIC', saturation: 0.08, contrast: 0.06, brightness: 0,
      bloom: { threshold: 0.9, smoothing: 0.3, intensity: 0.25, radius: 0.6 },
      tiltShift: { focusArea: 0.45, feather: 0.3 }, vignette: { offset: 0.35, darkness: 0.4 },
      grain: { intensity: 0.025, size: 1.3 } },
    render: { fps: 24, hold: 2, aspects: ['16:9', '1:1'] },          // characters on twos, camera on ones
  },
  'papercut-collage': {
    palette: ['#efe6d2', '#d9a46a', '#3f6f73', '#c4553b', '#e0b04a'],
    materials: { shading: 'toon', steps: 2 },
    light: { exposure: 1.05, azimuthDeg: 150, elevationDeg: 50, intensity: 2.4, ambient: 0.55, fog: 0 },
    post: { tone: 'NEUTRAL', saturation: -0.1, contrast: 0.05, brightness: 0.02,
      outline: { color: '#2e2a26', strength: 1.5 }, vignette: { offset: 0.4, darkness: 0.3 },
      grain: { intensity: 0.04, size: 2.2, hold: 1000 } },            // static paper fibre: grain never changes
    render: { fps: 12, hold: 1, aspects: ['16:9', '1:1', '9:16'] },
  },
  'retro-synthwave-vhs': {
    palette: ['#14082a', '#2b0f4c', '#ff3fa4', '#2fd6ff', '#ffb347'],
    materials: { shading: 'unlit' },
    light: { exposure: 1.0, azimuthDeg: 180, elevationDeg: 10, intensity: 1.0, ambient: 0.2, fog: 0.04 },
    post: { tone: 'ACES_FILMIC', saturation: 0.15, contrast: 0.1, brightness: 0,
      bloom: { threshold: 0.4, smoothing: 0.4, intensity: 1.4, radius: 0.85 },
      chromatic: 1.6, scanline: { density: 1.2, opacity: 0.12 }, vignette: { offset: 0.3, darkness: 0.6 },
      grain: { intensity: 0.05, size: 1.2, chroma: 0.6 } },
    render: { fps: 30, hold: 1, aspects: ['16:9', '9:16', '4:3'] },
  },
  'glossy-commercial': {
    palette: ['#f4f5f7', '#dfe3e8', '#1f2a37', '#3a7bd5', '#ff6b3d'],
    materials: { shading: 'pbr', roughness: 0.18 },
    light: { exposure: 1.1, azimuthDeg: 120, elevationDeg: 45, intensity: 3.0, ambient: 0.6, fog: 0 },
    post: { tone: 'AGX', saturation: 0.05, contrast: 0.05, brightness: 0.02,
      bloom: { threshold: 0.9, smoothing: 0.2, intensity: 0.5, radius: 0.6 } },
    render: { fps: 30, hold: 1, aspects: ['16:9', '1:1', '9:16'] },
  },
  'handmade-ink': {
    palette: ['#efe4cc', '#e3d5b5', '#cbb894', '#8c7b66', '#a8322a'],
    materials: { shading: 'toon', steps: 2 },
    light: { exposure: 1.1, azimuthDeg: 130, elevationDeg: 45, intensity: 2.2, ambient: 0.9, fog: 0.02 },
    post: { tone: 'NEUTRAL', saturation: -0.75, contrast: 0.12, brightness: 0.03,
      outline: { color: '#1e1a17', strength: 2.5 }, dotScreen: { scale: 1.6, angle: 0.8, opacity: 0.12 },
      vignette: { offset: 0.45, darkness: 0.35 }, grain: { intensity: 0.05, size: 2.0, hold: 1000 } },
    render: { fps: 12, hold: 1, aspects: ['16:9', '9:16'] },
  },
};

// ---------------------------------------------------------------- kit effect: FilmGrain (size, hold, chroma, response)

class FilmGrainEffect extends Effect {
  constructor({ intensity = 0.04, size = 1.4, chroma = 0, hold = 1, seed = 7 } = {}) {
    super('FilmGrainEffect', `
uniform float intensity, size, chroma, hold, seed, frame;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
float g(vec2 px, float f, float ch) { vec2 o = vec2(h12(vec2(f + ch * 101.0, seed)), h12(vec2(seed + ch * 17.0, f + 7.0))) * 512.0;
  vec2 q = px / size; return (vn(q + o) + vn(q * 1.7 + o.yx + 31.0)) * 0.5 - 0.5; }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float L = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float w = 0.35 + 0.65 * (1.0 - abs(L * 2.0 - 1.0));          // strongest in the midtones
  float f = floor(frame / max(hold, 1.0)); vec2 px = uv * resolution;
  float m = g(px, f, 0.0); vec3 n = mix(vec3(m), vec3(m, g(px, f, 1.0), g(px, f, 2.0)), chroma);
  outputColor = vec4(inputColor.rgb + n * intensity * w, inputColor.a);
}`, { uniforms: new Map([['intensity', new THREE.Uniform(intensity)], ['size', new THREE.Uniform(size)],
      ['chroma', new THREE.Uniform(chroma)], ['hold', new THREE.Uniform(hold)], ['seed', new THREE.Uniform(seed)],
      ['frame', new THREE.Uniform(0)]]) });
  }
}

// ---------------------------------------------------------------- kit effect: PrintTone (the kit's own print curve)
// Lifted blacks, a soft highlight shoulder from `knee`, a little S-contrast, a warm-highlight / cool-shadow split.
// The same curve as FINISH.tone in templates/quick/film.html; no outside LUT file.

class PrintToneEffect extends Effect {
  constructor({ lift = 0.035, knee = 0.72, contrast = 0.12, split = 0.02 } = {}) {
    super('PrintToneEffect', `
uniform float lift, knee, contrast, split;
float curve(float x) {
  x = clamp(x, 0.0, 1.0);
  float y = x <= knee ? x : knee + (1.0 - knee) * (1.0 - exp(-(x - knee) / (1.0 - knee)));
  return lift + (1.0 - lift) * mix(y, y * y * (3.0 - 2.0 * y), contrast);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 d = pow(max(inputColor.rgb, 0.0), vec3(1.0 / 2.2));   // the curve is defined on display values, like film.html
  vec3 c = vec3(curve(d.r), curve(d.g), curve(d.b));
  c = clamp(c + split * (c - 0.5) * vec3(1.0, 0.0, -1.0), 0.0, 1.0);
  outputColor = vec4(pow(c, vec3(2.2)), inputColor.a);
}`, { uniforms: new Map([['lift', new THREE.Uniform(lift)], ['knee', new THREE.Uniform(knee)],
      ['contrast', new THREE.Uniform(contrast)], ['split', new THREE.Uniform(split)]]) });
  }
}

// ---------------------------------------------------------------- materials that follow the look

export function makeMaterial(look, color, opts = {}) {
  const m = look.materials || {};
  if (m.shading === 'toon') {
    const steps = m.steps || 3;
    const grad = new THREE.DataTexture(new Uint8Array([...Array(steps)].map((_, i) => Math.round(255 * (i + 0.5) / steps))),
      steps, 1, THREE.RedFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
    return new THREE.MeshToonMaterial({ color, gradientMap: grad, ...opts });
  }
  if (m.shading === 'unlit') return new THREE.MeshBasicMaterial({ color, ...opts });
  return new THREE.MeshStandardMaterial({ color, roughness: m.roughness ?? 0.5, ...opts });
}

// Time for animated characters: held on twos (or threes) when the look asks for it; keep the camera on ones.
export const heldTime = (look, frame, fps) => {
  const hold = (look.render && look.render.hold) || 1;
  return Math.floor(frame / hold) * hold / fps;
};

// ---------------------------------------------------------------- on-screen text and subtitles (2D, per frame)
// items: { t: [start, end], text, y: 0..1 (centre line), size: fraction of the short side, weight: 'bold' }
//        { t: [start, end], sub: ['primary line', 'optional second language'] }   stacked, bottom safe area
// Deterministic: opacity is a function of t only (0.15 s fades). Fonts: await document.fonts.ready before READY.
// font: the text role's stack (subtitles), display: the display role's stack (cards); from the TYPE block via typeStack().
export function drawOverlay(g, items, t, W, H, { font = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', display = font } = {}) {
  const S = Math.min(W, H), vertical = H > W;
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const it of items) {
    const [a, b] = it.t;
    if (t < a || t > b) continue;
    g.globalAlpha = Math.min(1, (t - a) / 0.15, (b - t) / 0.15);
    g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = S * 0.012; g.fillStyle = it.color || '#ffffff';
    if (it.sub) {
      const base = H - (vertical ? H * 0.2 : H * 0.08);          // above the 9:16 UI zone; inside the 16:9 bottom band
      g.font = `600 ${S * 0.042}px ${font}`; g.fillText(it.sub[0], W / 2, base - (it.sub[1] ? S * 0.05 : 0));
      if (it.sub[1]) { g.globalAlpha *= 0.8; g.font = `italic 500 ${S * 0.034}px ${font}`; g.fillText(it.sub[1], W / 2, base); }
    } else {
      g.font = `${it.weight || 'bold'} ${S * (it.size || 0.07)}px ${display}`;
      g.fillText(it.text, W / 2, H * (it.y ?? 0.42));
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- the chain

// ---------------------------------------------------------------- sky light (references/finish.md: env)
// The sky as the scene's environment: soft fill and reflections that match the sun's direction. Deterministic.
//   skyLight(renderer, scene, { elevationDeg: 12, azimuthDeg: 140, intensity: 0.12, background: true })
export function skyLight(renderer, scene, { elevationDeg = 20, azimuthDeg = 140, turbidity = 6, rayleigh = 1.5,
  mie = 0.005, intensity = 0.12, background = false } = {}) {
  const sky = new Sky();
  sky.scale.setScalar(1000);
  const u = sky.material.uniforms;
  u.turbidity.value = turbidity; u.rayleigh.value = rayleigh; u.mieCoefficient.value = mie;
  const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevationDeg),
    THREE.MathUtils.degToRad(azimuthDeg));
  u.sunPosition.value.copy(sun);
  const pm = new THREE.PMREMGenerator(renderer), holder = new THREE.Scene();
  holder.add(sky);
  const env = pm.fromScene(holder).texture;
  pm.dispose();
  scene.environment = env;
  scene.environmentIntensity = intensity;               // a fill, not a second sun: lower the hemisphere light with it
  if (background) { holder.remove(sky); scene.add(sky); }
  return { sky, env, sun };
}

export function buildLook({ renderer, scene, camera, look, fps = 24, seed = 7, setTime = null }) {
  const p = look.post || {};
  renderer.toneMapping = THREE.NoToneMapping;                 // tone mapping is an effect in the chain
  renderer.toneMappingExposure = 1;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType,
    multisampling: p.msaa === 0 ? 0 : (p.msaa || 4) });       // clean edges by default; msaa: 0 for pixel art's hard edges
  const fx = {};
  composer.addPass(new RenderPass(scene, camera));
  const passes = [], grains = [];
  let group = [];
  const flush = () => { if (group.length) { const ep = new EffectPass(camera, ...group); passes.push(ep); composer.addPass(ep); group = []; } };
  const add = (fx) => {                                       // convolution effects need their own pass
    if (fx.getAttributes() & EffectAttribute.CONVOLUTION) { flush(); group.push(fx); flush(); } else group.push(fx);
  };

  if (p.outline) {
    const fx = new OutlineEffect(scene, camera, { edgeStrength: p.outline.strength ?? 2, blendFunction: BlendFunction.ALPHA,
      visibleEdgeColor: new THREE.Color(p.outline.color).getHex(), hiddenEdgeColor: new THREE.Color(p.outline.color).getHex() });
    fx.selection.set(scene.children.filter((o) => o.isMesh && !o.userData.noOutline));
    add(fx);
  }
  if (p.dof) add(fx.dof = new DepthOfFieldEffect(camera, { focusDistance: p.dof.focus ?? 6,
    focusRange: p.dof.range ?? 3, bokehScale: p.dof.bokeh ?? 2 }));      // close shots only (finish.md)
  if (p.bloom) add(fx.bloom = new BloomEffect({ luminanceThreshold: p.bloom.threshold, luminanceSmoothing: p.bloom.smoothing,
    intensity: p.bloom.intensity, radius: p.bloom.radius, levels: 8, mipmapBlur: true }));
  if (p.chromatic) add(fx.chromatic = new ChromaticAberrationEffect({ offset: new THREE.Vector2(p.chromatic / 1920, p.chromatic / 1920),
    radialModulation: true, modulationOffset: 0.2 }));
  if (p.tiltShift) add(new TiltShiftEffect({ focusArea: p.tiltShift.focusArea, feather: p.tiltShift.feather }));
  if (p.tone !== 'NONE') add(fx.tone = new ToneMappingEffect({ mode: ToneMappingMode[p.tone || 'AGX'] }));   // 'NONE': exact colours
  if (p.hue || p.saturation) add(new HueSaturationEffect({ hue: p.hue || 0, saturation: p.saturation || 0 }));
  if (p.brightness || p.contrast) add(new BrightnessContrastEffect({ brightness: p.brightness || 0, contrast: p.contrast || 0 }));
  if (p.print) add(new PrintToneEffect(p.print));
  if (p.dotScreen) { const fx = new DotScreenEffect({ scale: p.dotScreen.scale, angle: p.dotScreen.angle, blendFunction: BlendFunction.OVERLAY });
    fx.blendMode.opacity.value = p.dotScreen.opacity ?? 0.3; add(fx); }
  if (p.scanline) { const fx = new ScanlineEffect({ density: p.scanline.density }); fx.blendMode.opacity.value = p.scanline.opacity; add(fx); }
  if (p.pixelation) add(new PixelationEffect(p.pixelation));
  if (p.vignette) add(fx.vignette = new VignetteEffect({ offset: p.vignette.offset, darkness: p.vignette.darkness }));
  if (p.grain) { const g = new FilmGrainEffect({ seed, ...p.grain }); grains.push(g); add(fx.grain = g); }
  flush();

  function render(frame, t = frame / fps) {        // t: a sub-frame time for motion blur; grain stays on the frame
    if (setTime) setTime(t, frame);
    for (const ep of passes) ep.fullscreenMaterial.time = t;
    for (const g of grains) g.uniforms.get('frame').value = frame;
    composer.render(0);
  }
  // Per shot: a device the film uses may be off where it would hurt (finish.md), e.g. toggle('bloom', false) for the
  // noon wide, toggle('dof', true) and focus(4.2) for the close-up. Pure functions of the shot, like everything else.
  const toggle = (name, on) => { if (fx[name]) fx[name].blendMode.opacity.value = on ? 1 : 0; };
  const focus = (distance, range) => { if (fx.dof) { fx.dof.cocMaterial.focusDistance = distance;
    if (range !== undefined) fx.dof.cocMaterial.focusRange = range; } };
  return { composer, render, fx, toggle, focus };
}
