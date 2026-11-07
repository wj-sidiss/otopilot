// Named camera moves for a three.js PerspectiveCamera. No imports, no state: every function maps an eased
// progress e (0..1) or the film time t to numbers, so a frame stays a pure function of time.
// Vocabulary, durations and how to write a camera line: references/camera-moves.md.
//
//   import { EASE, apply, dolly, orbit, dollyZoom, handheld, rackFocus, retime } from './camera.mjs';
//   // dolly in, 3 s, slow ease-in-out, toward the figure
//   const e = EASE.inOut(k);
//   apply(camera, { position: dolly([0, 1.6, 10], [0, 1.2, 0], e, 10, 6), target: [0, 1.2, 0], fov: 35 });
//
// Points are [x, y, z] arrays in metres; angles in degrees; fov is three.js vertical FOV in degrees.

export const EASE = {
  linear: (k) => k, in: (k) => k * k * k, out: (k) => 1 - (1 - k) ** 3,
  inOut: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  inertia: (k) => 0.35 * k + 0.65 * k * k * (3 - 2 * k),     // keeps speed at both ends (moving at frame 0 and at the cut)
};

const lerp = (a, b, e) => a + (b - a) * e;
const lerp3 = (a, b, e) => [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const RAD = Math.PI / 180;

// Pose -> camera. roll in degrees (Dutch angle, FPV banking); fov changes update the projection.
export function apply(camera, { position, target, fov, roll = 0, offset = [0, 0, 0] }) {
  camera.position.set(...add(position, offset));
  camera.up.set(0, 1, 0);
  camera.lookAt(...target);
  if (roll) camera.rotateZ(roll * RAD);
  if (fov !== undefined && camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  return camera;
}

// Dolly in / out, push-in, pull-back: move along the line from the target to the camera, distance a -> b.
export function dolly(position, target, e, a, b) {
  return add(target, mul(norm(sub(position, target)), lerp(a, b, e)));
}
// Tracking / truck: camera and target slide sideways together by a -> b metres (+ = camera right).
export function truck(position, target, e, a, b) {
  const right = norm(cross(sub(target, position), [0, 1, 0])), d = mul(right, lerp(a, b, e));
  return { position: add(position, d), target: add(target, d) };
}
// Crane / pedestal: camera height a -> b metres above its start; keepTarget = tilt to hold the subject.
export function crane(position, target, e, a, b, keepTarget = true) {
  const up = [0, lerp(a, b, e), 0];
  return { position: add(position, up), target: keepTarget ? target : add(target, up) };
}
// Pan / tilt: the camera stays, the aim turns by a -> b degrees (pan + = right, tilt + = up).
export function pan(position, target, e, a, b) {
  const v = sub(target, position), ang = lerp(a, b, e) * RAD, c = Math.cos(ang), s = Math.sin(ang);
  return add(position, [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c]);
}
export function tilt(position, target, e, a, b) {
  const v = sub(target, position), h = Math.hypot(v[0], v[2]), r = len(v);
  const el = Math.atan2(v[1], h) + lerp(a, b, e) * RAD, k = (Math.cos(el) * r) / (h || 1);
  return add(position, [v[0] * k, Math.sin(el) * r, v[2] * k]);
}
// Orbit / arc around a target at radius r and height h above it, azimuth a -> b degrees (0 = on +z).
export function orbit(target, e, r, a, b, h = 0) {
  const ang = lerp(a, b, e) * RAD;
  return [target[0] + Math.sin(ang) * r, target[1] + h, target[2] + Math.cos(ang) * r];
}
// Zoom: vertical FOV a -> b degrees (no parallax; a stylistic choice).
export const zoom = (e, a, b) => lerp(a, b, e);
// Dolly zoom (vertigo): the subject keeps its size while the distance goes d0 -> d1; FOV compensates.
// Returns { distance, fov }; use dolly(..., e, d0, d1) for the position with the same e.
export function dollyZoom(e, d0, d1, fov0) {
  const d = lerp(d0, d1, e);
  return { distance: d, fov: (2 * Math.atan((Math.tan((fov0 * RAD) / 2) * d0) / d)) / RAD };
}
// Push-in on a detail: approach a point and end framed on it.
export function pushTo(position, target, detail, e, endDistance) {
  const aim = lerp3(target, detail, e);
  const end = add(detail, mul(norm(sub(position, detail)), endDistance));
  return { position: lerp3(position, end, e), target: aim };
}
// FPV / fly-through along points (Catmull-Rom); looks ahead along the path and banks into turns (roll, degrees).
export function fpv(points, e, { lookAhead = 0.03, bank = 25 } = {}) {
  const at = (u) => catmull(points, Math.min(1, Math.max(0, u)));
  const p = at(e), q = at(e + lookAhead), r = at(e + 2 * lookAhead);
  const d1 = norm(sub(q, p)), d2 = norm(sub(r, q));
  const turn = d1[0] * d2[2] - d1[2] * d2[0];
  return { position: p, target: q, roll: Math.max(-1, Math.min(1, turn * 20)) * bank };
}
function catmull(pts, u) {
  const n = pts.length - 1, x = u * n, i = Math.min(n - 1, Math.floor(x)), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t
    + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}

// Handheld: seeded value noise, low-passed (0.3-1.2 Hz) plus a slower drift; never per-frame random jitter.
// Returns { offset: [x, y, z] metres, roll: degrees }; pass both to apply(). amount 1 = subtle.
export function handheld(t, amount = 1, seed = 7) {
  const n = (f, o) => 2 * noise(t * f + o, seed) - 1;
  return {
    offset: [amount * (0.012 * n(1.1, 0) + 0.008 * n(0.3, 40)), amount * (0.010 * n(1.0, 20) + 0.006 * n(0.27, 60)),
      amount * 0.006 * n(0.5, 90)],
    roll: amount * 0.4 * n(0.8, 80),
  };
}
function hash(i, seed) { const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, seed) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u; }

// Rack focus / focus pull: focus distance a -> b metres. With pmndrs/postprocessing DepthOfFieldEffect:
//   dof.cocMaterial.worldFocusDistance = rackFocus(e, 2.5, 9);
export const rackFocus = (e, a, b) => lerp(a, b, e);

// Speed ramp, slow motion, time-lapse, freeze frame: remap film time. keys = [[t, speed], ...]; speed is linear
// between keys (1 real time, 0.25 slow motion, 8 time-lapse, 0 freeze). Feed the result to the scene's animation.
export function retime(t, keys) {
  let acc = 0, pt = 0, ps = keys[0][1];
  for (const [kt, ks] of keys) {
    if (kt > pt) {
      if (t <= kt) { const s = ps + ((ks - ps) * (t - pt)) / (kt - pt); return acc + ((t - pt) * (ps + s)) / 2; }
      acc += ((kt - pt) * (ps + ks)) / 2;
    }
    pt = kt; ps = ks;
  }
  return acc + (t - pt) * ps;
}

// Shot progress helpers: k = local progress of a shot, e = eased. A camera line names the easing.
export const progress = (t, from, to) => Math.min(1, Math.max(0, (t - from) / (to - from)));
