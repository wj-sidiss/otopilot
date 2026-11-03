// 3B sahne sablonlari icin ortak yardimcilar. Kural: HER KARE f(t): Date.now/Math.random/requestAnimationFrame YOK.
// Yapi ve fikir: motionforge mf-three.js (MIT); burada yeniden yazildi.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export { THREE };
export const P = JSON.parse(document.getElementById("params").textContent);
export const clamp01 = v => Math.min(1, Math.max(0, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp01((t - a) / (b - a));                    // t, [a,b] araliginda 0..1
export const ease = { out: k => 1 - Math.pow(1 - k, 3), inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2), sine: k => 0.5 - 0.5 * Math.cos(Math.PI * k) };
export function rng(tohum) { let a = tohum >>> 0 || 1; const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; r.aralik = (x, y) => x + (y - x) * r(); return r; }

// renderer + sahne + kamera; genislik/yukseklik pencereden (dikey ya da yatay)
export function sahneKur({ arka = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (arka !== null) renderer.setClearColor(arka, 1); else renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);
  const sahne = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 200);
  return { renderer, sahne, kamera, dikey: innerHeight > innerWidth };
}
export function ortam(renderer, sahne, siddet = 0.6) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  sahne.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; sahne.environmentIntensity = siddet;
}
// kare = f(t): ciz(t) icinde her hareketli ozelligi t'den kur; ardindan render
export function baslat(renderer, sahne, kamera, ciz, hazirBekle) {
  window.__seek = t => { ciz(t); renderer.render(sahne, kamera); return true; };
  Promise.resolve(hazirBekle).then(() => { window.__seek(0); window.READY = true; }).catch(e => { setTimeout(() => { throw e; }, 0); });
}
export const renk = h => new THREE.Color(h);
export function yazi(id, metin, konum) { const el = document.getElementById(id); if (el) { el.textContent = metin || ""; if (konum) Object.assign(el.style, konum); } return el; }
export function gorun(el, a) { if (el) { el.style.opacity = String(a); el.style.transform = "translateY(" + ((1 - a) * 24).toFixed(1) + "px)"; } }
