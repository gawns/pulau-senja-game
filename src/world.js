import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CATS } from "./content.js";

const PAL = {
  sand: 0xe8c98a, wet: 0xcaa96e, water: 0x2f83b8, waterDeep: 0x1d5f8e, waterShallow: 0x55c2c9,
  grass: 0x74a856, grass2: 0x5e9147, grass3: 0x8dbb5f, dirt: 0x9a7548,
  leaf: 0x35704a, leaf2: 0x498a55, leaf3: 0x2b5c3d,
  trunk: 0x6f4a34, trunk2: 0x87603f, stump: 0x9a7150,
  rock: 0x8b8d85, rock2: 0x74766f, stone: 0xbcb6a6, moss: 0x5f7f4a,
  wood: 0xb0854f, wood2: 0x94693c, plank: 0xc59a63,
  cloth: 0xc4685c, cloth2: 0x3d6f92, cloth3: 0xd8bd72,
  skin: 0xdca87e, hair: 0x2b211c, hair2: 0x5a3d28,
  roof: 0x8a4638, roof2: 0x6f362b, ember: 0xe6803f,
  shell: 0xf6efe2, flower: 0xd9586f, flower2: 0xe8d05a, cloud: 0xf3f6fa,
  ink: 0x2a2019,
};

const SKY = [
  { t: 0.0, top: 0x1a2752, fog: 0x1e2c50, sun: 0x8fa3d4, sunI: 0.46, hemi: 0x44557c, grd: 0x1a2431, hemiI: 0.80, night: 1.0 },
  { t: 4.6, top: 0x33416a, fog: 0x3a4766, sun: 0x8fa0cc, sunI: 0.60, hemi: 0x556788, grd: 0x232d38, hemiI: 0.90, night: 0.70 },
  { t: 6.2, top: 0x9a86b4, fog: 0xc4937f, sun: 0xffbb8a, sunI: 0.85, hemi: 0xb0a2b8, grd: 0x635740, hemiI: 0.65, night: 0.20 },
  { t: 8.0, top: 0x8fc6e4, fog: 0xc3dbeb, sun: 0xfff2d6, sunI: 1.30, hemi: 0xc2dcf2, grd: 0x6f9356, hemiI: 0.62, night: 0.0 },
  { t: 12.0, top: 0x74b3dc, fog: 0xa2cbe2, sun: 0xffffff, sunI: 1.60, hemi: 0xcce0f4, grd: 0x739a58, hemiI: 0.66, night: 0.0 },
  { t: 16.0, top: 0x82b6d2, fog: 0xb4ccd3, sun: 0xfff0c8, sunI: 1.40, hemi: 0xc6dae6, grd: 0x73914f, hemiI: 0.62, night: 0.0 },
  { t: 18.4, top: 0xcf8d63, fog: 0xe0a577, sun: 0xff9a55, sunI: 1.00, hemi: 0xc59f84, grd: 0x5f4d34, hemiI: 0.58, night: 0.10 },
  { t: 19.8, top: 0x714e68, fog: 0x73505f, sun: 0xd0643c, sunI: 0.58, hemi: 0x816a7d, grd: 0x3d333b, hemiI: 0.88, night: 0.58 },
  { t: 21.5, top: 0x1f2c58, fog: 0x223054, sun: 0x8fa3d4, sunI: 0.48, hemi: 0x49597c, grd: 0x1b2733, hemiI: 0.82, night: 1.0 },
  { t: 24.0, top: 0x1a2752, fog: 0x1e2c50, sun: 0x8fa3d4, sunI: 0.46, hemi: 0x44557c, grd: 0x1a2431, hemiI: 0.80, night: 1.0 },
];

const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });

function mesh(geo, color, x, y, z, parent, cast = true) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------- terrain ----------
export function groundAt(x, z) {
  const r = Math.hypot(x, z);
  let h;
  if (r < 11) h = 1.25 - 0.25 * (r / 11) * (r / 11);
  else if (r < 15.5) h = 1.0 - 0.55 * ((r - 11) / 4.5) * ((r - 11) / 4.5);
  else h = 0.45 - (r - 15.5) * 0.5;
  const damp = Math.max(0, 1 - Math.max(0, r - 11) / 4.5);
  h += (Math.sin(x * 0.55) * Math.cos(z * 0.47) * 0.075 + Math.sin((x + z) * 0.31) * 0.05) * damp;
  return h;
}

export const WALK_MAX = 16.3;
export const DOCK = { x: 0, z: 17.0, halfW: 0.85, z0: 14.9, z1: 18.8, top: 0.57 };

export function onDock(x, z) {
  return Math.abs(x - DOCK.x) <= DOCK.halfW && z >= DOCK.z0 && z <= DOCK.z1;
}

export function surfaceAt(x, z) {
  return onDock(x, z) ? Math.max(groundAt(x, z), DOCK.top) : groundAt(x, z);
}

export const HOUSE = { x: 8.5, z: -3.2, w: 4.6, d: 4.0, doorW: 1.4, floor: groundAt(8.5, -3.2) + 0.24 };

const PATHS = [
  [[0, -15.2], [0.6, -14.2], [1.2, -13.2]],
  [[1.2, -13.2], [0, -8], [-3, -3], [-7.6, 0.4]],
  [[0, -8], [4, -6], [8.5, -3.2]],
  [[4, -6], [7.5, 2], [8.6, 6.6]],
  [[8.5, -3.2], [4.2, 0.6], [-2, -1.6]],
];

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function pathDist(x, z) {
  let d = 1e9;
  for (const line of PATHS) {
    for (let i = 0; i < line.length - 1; i++) {
      d = Math.min(d, distToSeg(x, z, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]));
    }
  }
  return d;
}

function rockCluster(parent, x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const r = 0.16 + Math.abs(Math.sin(x * 3.7 + z * 2.1 + i * 1.4)) * 0.18;
    mesh(new THREE.DodecahedronGeometry(r, 0), i % 2 ? PAL.rock : PAL.rock2, Math.cos(a) * 0.28, r * 0.45, Math.sin(a) * 0.28, g, false);
  }
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
}

function flowerPatch(parent, x, z) {
  const COLS = [0xe05a5a, 0xe07a2a, 0xf4c84a, 0x9cd884, 0x8ac4dc];
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const r = 0.22 + (i % 3) * 0.13;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r;
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 4), 0x4a7840, ox, 0.11, oz, g, false);
    mesh(new THREE.SphereGeometry(0.065, 5, 4), COLS[i % COLS.length], ox, 0.26, oz, g, false);
  }
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
}

function campfire(parent, x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const l = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 6), PAL.trunk, Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18, g);
    l.rotation.z = Math.cos(a) * 0.6;
    l.rotation.x = Math.sin(a) * 0.6;
  }
  mesh(new THREE.SphereGeometry(0.14, 5, 4), 0x4a2210, 0, 0.07, 0, g, false);
  const flame = mesh(new THREE.ConeGeometry(0.09, 0.38, 5), 0xff7020, 0, 0.34, 0, g, false);
  flame.material.transparent = true;
  flame.material.opacity = 0.85;
  const flame2 = mesh(new THREE.ConeGeometry(0.055, 0.25, 5), 0xffc040, 0, 0.4, 0, g, false);
  flame2.material.transparent = true;
  flame2.material.opacity = 0.75;
  const fl = new THREE.PointLight(0xff8830, 1.4, 7, 2);
  fl.position.set(0, 0.5, 0);
  g.add(fl);
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  g.userData = { flame, flame2, fl };
  return g;
}

function mergeStatic(root, protectedRoots) {
  const skip = new Set();
  for (const o of protectedRoots) if (o && typeof o.traverse === "function") o.traverse((c) => skip.add(c));
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const doomed = [];
  root.traverse((o) => {
    if (!o.isMesh || skip.has(o)) return;
    const g = o.geometry;
    if (!g || !g.attributes || !g.attributes.position || g.attributes.position.isInterleavedBufferAttribute) return;
    if (g.attributes.position.count > 4000) return;
    if (o.material.transparent || o.material.opacity < 1) return;
    const key = o.material.color.getHexString();
    let clone = g.clone();
    if (clone.index) clone = clone.toNonIndexed();
    const keep = ["position", "normal", "uv"];
    for (const name of Object.keys(clone.attributes)) if (!keep.includes(name)) clone.deleteAttribute(name);
    if (!clone.attributes.normal) clone.computeVertexNormals();
    if (!clone.attributes.uv) {
      clone.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(clone.attributes.position.count * 2), 2));
    }
    clone.applyMatrix4(o.matrixWorld);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(clone);
    doomed.push(o);
  });
  let merged = 0;
  const used = new Set();
  for (const [hex, geos] of buckets) {
    if (geos.length < 4) { geos.forEach((x) => x.dispose()); continue; }
    const g = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    if (!g) continue;
    const m = new THREE.Mesh(g, mat(parseInt(hex, 16)));
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    root.add(m);
    merged += geos.length;
    used.add(hex);
  }
  for (const o of doomed) {
    const hex = o.material.color.getHexString();
    if (used.has(hex)) { o.parent && o.parent.remove(o); o.geometry.dispose(); }
  }
  return { merged };
}

// ---------- capsule characters ----------
const OUTLINE_T = 0.018;

function inkHull(geo, r) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PAL.ink, side: THREE.BackSide }));
  m.scale.setScalar(1 + (2 * OUTLINE_T) / (r * 2));
  return m;
}

function part(parent, geo, color, r, x, y, z) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  const h = inkHull(geo, r);
  h.position.set(x, y, z);
  parent.add(h);
  return m;
}

function blobShadow(parent) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g2 = cv.getContext("2d");
  const grd = g2.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, "rgba(20,16,10,0.55)");
  grd.addColorStop(1, "rgba(20,16,10,0)");
  g2.fillStyle = grd;
  g2.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.renderOrder = 2;
  parent.add(m);
  return m;
}

// Kapsul bergaya Among Us: badan + mata + kelopak. Tanpa kaki dan tangan.
function capsule(parent, x, z, o = {}) {
  const g = new THREE.Group();
  const bodyCol = o.shirt ?? 0x4a8c52;
  const body = new THREE.Group();
  const core = part(body, new THREE.CapsuleGeometry(0.30, 0.34, 4, 12), bodyCol, 0.30, 0, 0.46, 0);
  // belly patch
  if (o.belly) part(body, new THREE.SphereGeometry(0.19, 10, 8), o.belly, 0.19, 0, 0.36, 0.19);

  // eyes
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.58, 0.265);
  for (const sx of [-1, 1]) {
    part(eyes, new THREE.SphereGeometry(0.052, 8, 7), 0x14110e, 0.052, sx * 0.1, 0, 0);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(bodyCol));
    lid.position.set(sx * 0.1, 0.005, 0);
    lid.scale.set(1, 0.2, 1);
    eyes.add(lid);
    if (!eyes.userData.lids) eyes.userData.lids = [];
    eyes.userData.lids.push(lid);
  }
  body.add(eyes);

  if (o.hat) {
    const hat = new THREE.Group();
    hat.position.y = 0.78;
    part(hat, new THREE.CylinderGeometry(0.40, 0.42, 0.055, 14), 0xd8bc6c, 0.40, 0, 0, 0);
    part(hat, new THREE.CylinderGeometry(0.19, 0.21, 0.17, 10), 0xd8bc6c, 0.19, 0, 0.09, 0);
    body.add(hat);
  }
  if (o.scarf) {
    part(body, new THREE.TorusGeometry(0.20, 0.055, 5, 14), 0xc4685c, 0.20, 0, 0.70, 0);
  }
  if (o.necklace) {
    part(body, new THREE.TorusGeometry(0.14, 0.03, 4, 12), 0xd4a837, 0.14, 0, 0.66, 0.04);
  }
  if (o.flower) {
    part(body, new THREE.SphereGeometry(0.07, 6, 5), 0xe8d05a, 0.07, 0.24, 0.68, 0.1);
  }
  g.add(body);

  // floating axe (no hands)
  const axe = new THREE.Group();
  axe.position.set(0.34, 0.46, 0.05);
  mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.5, 6), 0x8a6236, 0, 0, 0, axe, false);
  const head = mesh(new THREE.BoxGeometry(0.16, 0.14, 0.05), 0xa9adb3, 0.09, 0.2, 0, axe, false);
  head.rotation.z = -0.2;
  axe.visible = false;
  g.add(axe);

  const shadow = blobShadow(g);
  g.userData = { body, core, eyes, axe, shadow, base: bodyCol, scale: o.scale ?? 0.6 };
  g.position.set(x, groundAt(x, z), z);
  g.rotation.y = o.yaw ?? 0;
  g.scale.setScalar(o.scale ?? 0.6);
  parent.add(g);
  return g;
}

// Animasi kapsul: napas, kedip, hop, squash, condong, kapak.
function animateCapsule(u, opts = {}) {
  if (!u || !u.body) return;
  const t = opts.t ?? 0;
  const moving = !!opts.moving;
  const speed = opts.speed ?? 1;
  const phase = opts.phase ?? 0;
  const dt = opts.dt ?? 0.016;
  const body = u.body;
  // breathing
  const breath = Math.sin(t * 1.7 + phase) * 0.018;
  body.scale.set(1 + breath * 0.6, 1 + breath, 1 + breath * 0.6);
  // hop
  let hop = 0;
  if (moving) {
    const s = Math.sin(t * 9 * speed + phase);
    hop = Math.max(0, s) * 0.075;
    body.rotation.z = Math.sin(t * 4.5 * speed + phase) * 0.06;
    body.rotation.x = -0.09;
  } else {
    body.rotation.z += (0 - body.rotation.z) * Math.min(1, dt * 8);
    body.rotation.x += (0 - body.rotation.x) * Math.min(1, dt * 8);
  }
  // landing squash
  if (u.squash > 0) {
    u.squash = Math.max(0, u.squash - dt * 4.5);
    const k = u.squash;
    body.scale.y *= 1 - k * 0.28;
    body.scale.x *= 1 + k * 0.18;
    body.scale.z *= 1 + k * 0.18;
  }
  body.position.y = hop;
  // blink
  u.blink = (u.blink ?? Math.random() * 3) - dt;
  if (u.blink < 0) u.blink = 2 + Math.random() * 3;
  const shut = u.blink < 0.11;
  for (const lid of u.eyes.userData.lids || []) lid.scale.y = shut ? 1 : 0.2;
  // axe
  if (u.axe) {
    u.axe.visible = !!opts.axe;
    if (opts.axe && opts.swing) {
      u.axe.rotation.z = -1.9 + Math.sin(opts.swing * Math.PI) * 2.2;
      u.axe.rotation.x = 0.2;
    } else {
      u.axe.rotation.z += (0 - u.axe.rotation.z) * Math.min(1, dt * 6);
      u.axe.rotation.x = 0.1;
    }
  }
  // shadow follows ground scale with hop
  if (u.shadow) {
    const k = 1 - hop * 1.4;
    u.shadow.scale.setScalar(Math.max(0.55, k));
    u.shadow.material.opacity = 0.9 - hop * 2;
  }
}

// ---------- cats ----------
function catMesh(parent, cfg, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const core = part(body, new THREE.SphereGeometry(0.24, 12, 10), cfg.fur, 0.24, 0, 0.24, 0);
  core.scale.set(1.25, 0.86, 1.05);
  part(body, new THREE.SphereGeometry(0.16, 10, 8), cfg.belly, 0.16, 0, 0.19, 0.12);
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.15);
  part(head, new THREE.SphereGeometry(0.17, 12, 10), cfg.fur, 0.17, 0, 0, 0);
  part(head, new THREE.SphereGeometry(0.11, 10, 8), cfg.belly, 0.11, 0, -0.02, 0.11);
  for (const sx of [-1, 1]) {
    const ear = part(head, new THREE.ConeGeometry(0.065, 0.13, 4), cfg.fur, 0.065, sx * 0.1, 0.15, 0);
    ear.rotation.z = sx * -0.18;
    part(head, new THREE.SphereGeometry(0.028, 6, 5), 0x1a1714, 0.028, sx * 0.065, 0.015, 0.15);
  }
  body.add(head);
  // tail: 4 segments with follow-through
  const tail = [];
  let parentSeg = body;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0.28 : 0.0, i === 0 ? -0.24 : -0.16);
    part(seg, new THREE.SphereGeometry(0.055 - i * 0.006, 8, 6), i % 2 ? cfg.fur : cfg.stripe, 0.055, 0, 0, 0);
    parentSeg.add(seg);
    tail.push(seg);
    parentSeg = seg;
  }
  g.add(body);
  const shadow = blobShadow(g);
  g.userData = { body, head, tail, shadow, cfg };
  g.position.set(x, groundAt(x, z), z);
  g.scale.setScalar(0.85);
  parent.add(g);
  return g;
}

// Small speech bubble that pops above an NPC's head when the player walks up.
function speechBubble(text) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 128;
  const g2 = cv.getContext("2d");
  const w = Math.min(238, 56 + text.length * 12);
  const h = 62;
  const x0 = (256 - w) / 2;
  const y0 = 18;
  const r = 18;
  g2.fillStyle = "rgba(246,231,203,0.96)";
  g2.beginPath();
  g2.moveTo(x0 + r, y0);
  g2.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
  g2.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
  g2.arcTo(x0, y0 + h, x0, y0, r);
  g2.arcTo(x0, y0, x0 + w, y0, r);
  g2.closePath();
  g2.fill();
  // tail
  g2.beginPath();
  g2.moveTo(128 - 11, y0 + h - 2);
  g2.lineTo(128, y0 + h + 16);
  g2.lineTo(128 + 11, y0 + h - 2);
  g2.closePath();
  g2.fill();
  g2.font = "600 24px Nunito, Segoe UI, system-ui, sans-serif";
  g2.textAlign = "center";
  g2.textBaseline = "middle";
  g2.fillStyle = "#2a2019";
  g2.fillText(text, 128, y0 + h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  spr.scale.set(1.5, 0.75, 1);
  spr.renderOrder = 7;
  spr.visible = false;
  return spr;
}

function nameLabel(text, opts = {}) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 72;
  const g2 = cv.getContext("2d");
  g2.fillStyle = opts.bg || "rgba(42,32,25,0.82)";
  const w = Math.min(230, 40 + text.length * 17);
  const h = 44;
  const r = 16;
  const x0 = (256 - w) / 2;
  const y0 = 14;
  g2.beginPath();
  g2.moveTo(x0 + r, y0);
  g2.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
  g2.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
  g2.arcTo(x0, y0 + h, x0, y0, r);
  g2.arcTo(x0, y0, x0 + w, y0, r);
  g2.closePath();
  g2.fill();
  g2.font = "600 28px Nunito, Segoe UI, system-ui, sans-serif";
  g2.textAlign = "center";
  g2.textBaseline = "middle";
  g2.fillStyle = "#f6e7cb";
  g2.fillText(text, 128, y0 + h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  spr.scale.set(1.3, 0.37, 1);
  spr.renderOrder = 6;
  return spr;
}

function lantern(parent, x, z) {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), PAL.trunk, 0, 0.85, 0, g);
  mesh(new THREE.BoxGeometry(0.34, 0.06, 0.06), PAL.trunk2, 0.12, 1.68, 0, g, false);
  const bulb = mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), 0xffd98a, 0.24, 1.5, 0, g, false);
  const light = new THREE.PointLight(0xffc46b, 0, 13, 2);
  light.position.set(0.24, 1.5, 0);
  g.add(light);
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return { light, bulb };
}

// ---------- house (8 stages) ----------
function buildHouse(parent) {
  const { x, z, w, d, doorW, floor } = HOUSE;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);

  const stageGroups = [];
  const mkStage = () => {
    const sg = new THREE.Group();
    sg.visible = false;
    g.add(sg);
    stageGroups.push(sg);
    return sg;
  };

  // 1 tapak
  const s1 = mkStage();
  const plate = mesh(new THREE.BoxGeometry(w + 0.9, 0.12, d + 0.9), 0x9a8a6a, 0, floor - 0.06, 0, s1);
  plate.receiveShadow = true;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), PAL.wood2, sx * (w / 2 + 0.3), floor + 0.2, sz * (d / 2 + 0.3), s1, false);
  }

  // 2 tiang depan
  const s2 = mkStage();
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.16, 2.1, 0.16), PAL.trunk2, sx * (w / 2 - 0.1), floor + 1.05, d / 2 - 0.1, s2);

  // 3 tiang belakang
  const s3 = mkStage();
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.16, 2.1, 0.16), PAL.trunk2, sx * (w / 2 - 0.1), floor + 1.05, -d / 2 + 0.1, s3);

  // 4 balok bawah
  const s4 = mkStage();
  mesh(new THREE.BoxGeometry(w, 0.16, 0.16), PAL.wood, 0, floor + 0.12, d / 2 - 0.1, s4);
  mesh(new THREE.BoxGeometry(w, 0.16, 0.16), PAL.wood, 0, floor + 0.12, -d / 2 + 0.1, s4);
  mesh(new THREE.BoxGeometry(0.16, 0.16, d), PAL.wood, w / 2 - 0.1, floor + 0.12, 0, s4);
  mesh(new THREE.BoxGeometry(0.16, 0.16, d), PAL.wood, -w / 2 + 0.1, floor + 0.12, 0, s4);

  // 5 dinding samping
  const s5 = mkStage();
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      mesh(new THREE.BoxGeometry(0.12, 0.44, d), PAL.wood, sx * (w / 2), floor + 0.4 + i * 0.46, 0, s5);
    }
  }

  // 6 dinding depan + belakang (celah pintu)
  const s6 = mkStage();
  const sideW = (w - doorW) / 2;
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const y = floor + 0.4 + i * 0.46;
      if (sz > 0 && i < 3) {
        mesh(new THREE.BoxGeometry(sideW, 0.44, 0.12), PAL.wood, -(doorW / 2 + sideW / 2), y, d / 2, s6);
        mesh(new THREE.BoxGeometry(sideW, 0.44, 0.12), PAL.wood, doorW / 2 + sideW / 2, y, d / 2, s6);
      } else {
        mesh(new THREE.BoxGeometry(w, 0.44, 0.12), PAL.wood, 0, y, sz * d / 2, s6);
      }
    }
  }

  // 7 rangka atap
  const s7 = mkStage();
  const roofY = floor + 2.2;
  for (const sz of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(w + 0.5, 0.14, d * 0.62), PAL.wood2, 0, roofY + 0.36, sz * d * 0.26, s7);
    r.rotation.x = sz * 0.6;
  }
  mesh(new THREE.BoxGeometry(w + 0.5, 0.12, 0.16), PAL.trunk2, 0, roofY + 0.72, 0, s7);

  // 8 atap + pintu + lentera
  const s8 = mkStage();
  const roofMats = [];
  for (const sz of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(w + 0.8, 0.14, d * 0.7), PAL.roof, 0, roofY + 0.44, sz * d * 0.28, s8);
    r.rotation.x = sz * 0.6;
    r.material.transparent = true;
    roofMats.push(r.material);
  }
  mesh(new THREE.BoxGeometry(w + 0.84, 0.16, 0.22), PAL.roof2, 0, roofY + 0.88, 0, s8);
  const door = mesh(new THREE.BoxGeometry(doorW - 0.12, 1.5, 0.08), 0x53381f, 0, floor + 0.78, d / 2 + 0.02, s8);
  door.userData.isDoor = true;
  mesh(new THREE.SphereGeometry(0.045, 6, 5), 0xc8a24a, doorW / 2 - 0.22, floor + 0.75, d / 2 + 0.08, s8, false);
  const lampBulb = mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), 0xffd98a, doorW / 2 + 0.45, floor + 1.9, d / 2 + 0.12, s8, false);
  const lamp = new THREE.PointLight(0xffc46b, 0, 9, 2);
  lamp.position.set(doorW / 2 + 0.45, floor + 1.9, d / 2 + 0.2);
  g.add(lamp);
  // porch + stairs
  mesh(new THREE.BoxGeometry(w + 0.6, 0.14, 1.1), PAL.plank, 0, floor - 0.02, d / 2 + 0.6, s8);
  for (let i = 0; i < 3; i++) {
    mesh(new THREE.BoxGeometry(1.0, 0.1, 0.32), PAL.wood2, 0, floor - 0.16 - i * 0.16, d / 2 + 1.3 + i * 0.3, s8);
  }
  // interior: beds, table, lantern
  const beds = [];
  const bedSpots = [[-1.35, -1.05], [0.25, -1.05], [1.35, 1.0]];
  for (const [bx, bz] of bedSpots) {
    const b = new THREE.Group();
    b.position.set(bx, floor + 0.05, bz);
    mesh(new THREE.BoxGeometry(0.92, 0.16, 1.55), PAL.wood2, 0, 0.12, 0, b);
    mesh(new THREE.BoxGeometry(0.86, 0.16, 1.45), 0xf2e3c6, 0, 0.26, 0, b, false);
    mesh(new THREE.BoxGeometry(0.7, 0.12, 0.34), 0xe8d6b4, 0, 0.36, -0.52, b, false);
    s8.add(b);
    beds.push({ x: x + bx, z: z + bz, mesh: b });
  }
  mesh(new THREE.BoxGeometry(0.9, 0.5, 0.7), PAL.wood2, 0, floor + 0.3, 0.35, s8);
  mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), PAL.plank, 0, floor + 0.58, 0.35, s8, false);
  const innerLamp = new THREE.PointLight(0xffd08a, 0, 6, 2);
  innerLamp.position.set(0, floor + 1.6, 0);
  g.add(innerLamp);

  // smoke
  const smoke = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), new THREE.MeshBasicMaterial({ color: 0xd8dce2, transparent: true, opacity: 0.35, depthWrite: false }));
    s.position.set(1.0, roofY + 1.1, -0.6);
    g.add(s);
    smoke.push(s);
  }

  g.userData = { stageGroups, roofMats, lamp, innerLamp, bulb: lampBulb, beds, smoke, door };
  return g;
}

// ---------- world ----------
export function createWorld(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const skyColor = new THREE.Color(SKY[4].top);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(SKY[4].fog, 28, 92);

  const sunLight = new THREE.DirectionalLight(SKY[4].sun, SKY[4].sunI);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = sc.bottom = -24;
  sc.right = sc.top = 24;
  sc.near = 1;
  sc.far = 150;
  sunLight.shadow.bias = -0.0012;
  scene.add(sunLight, sunLight.target);

  const hemi = new THREE.HemisphereLight(SKY[4].hemi, SKY[4].grd, SKY[4].hemiI);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xa8bcdc, 0);

  const starPos = [];
  for (let i = 0; i < 800; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    starPos.push(Math.cos(th) * r * 240, Math.abs(u) * 210 + 12, Math.sin(th) * r * 240);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, depthWrite: false, fog: false });
  root.add(new THREE.Points(starGeo, starMat));

  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(4, 20), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false, transparent: true, opacity: 0.9 }));
  root.add(sunDisc, moonDisc);

  // ---------- sea with waves ----------
  const seaGeo = new THREE.PlaneGeometry(420, 420, 56, 56);
  seaGeo.rotateX(-Math.PI / 2);
  const seaPos = seaGeo.attributes.position;
  const seaCol = new Float32Array(seaPos.count * 3);
  const shallow = new THREE.Color(PAL.waterShallow);
  const deep = new THREE.Color(PAL.waterDeep);
  const cTmp = new THREE.Color();
  for (let i = 0; i < seaPos.count; i++) {
    const x = seaPos.getX(i);
    const z = seaPos.getZ(i);
    const r = Math.hypot(x, z);
    const k = Math.min(1, Math.max(0, (r - 14) / 12));
    cTmp.copy(shallow).lerp(deep, k);
    seaCol[i * 3] = cTmp.r;
    seaCol[i * 3 + 1] = cTmp.g;
    seaCol[i * 3 + 2] = cTmp.b;
  }
  seaGeo.setAttribute("color", new THREE.BufferAttribute(seaCol, 3));
  const seaMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = -0.02;
  sea.receiveShadow = true;
  root.add(sea);
  const seaBase = Float32Array.from(seaPos.array);

  // ---------- terrain ----------
  const geo = new THREE.PlaneGeometry(80, 80, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const cSand = new THREE.Color(PAL.sand);
  const cWet = new THREE.Color(PAL.wet);
  const cGrass = new THREE.Color(PAL.grass);
  const cGrass2 = new THREE.Color(PAL.grass2);
  const cGrass3 = new THREE.Color(PAL.grass3);
  const cDirt = new THREE.Color(PAL.dirt);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = Math.max(-1.8, groundAt(x, z));
    pos.setY(i, y);
    const n = Math.sin(x * 1.7) * Math.cos(z * 1.4) * 0.5 + 0.5;
    const n2 = Math.sin(x * 0.43 + 1.3) * Math.cos(z * 0.51) * 0.5 + 0.5;
    if (y < 0.22) c.copy(cWet);
    else if (y < 0.62) c.copy(cSand).lerp(cWet, Math.max(0, (0.42 - y) * 2));
    else if (y < 0.95) c.copy(cSand).lerp(cGrass, (y - 0.62) / 0.33);
    else c.copy(cGrass).lerp(cGrass2, n * 0.7).lerp(cGrass3, n2 * 0.35);
    const pd = pathDist(x, z);
    if (pd < 1.1 && y > 0.5) c.lerp(cDirt, Math.max(0, 1 - pd / 1.1) * 0.85);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  terrain.receiveShadow = true;
  root.add(terrain);

  const foams = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(15.6 + i * 0.22, 16.1 + i * 0.22, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    ring.userData.off = i / 3;
    ring.renderOrder = 1;
    root.add(ring);
    foams.push(ring);
  }

  const solids = [];
  const addSolid = (r, x, z) => {
    const s = { r, x, z };
    solids.push(s);
    return s;
  };
  const boxes = [];

  for (const [x, z] of [[3.8, -5.6], [-5.2, -2.2], [11.4, -3.4], [-12.4, -2.8], [2.2, 7.4], [-7.2, 7.6]]) {
    if (groundAt(x, z) > 0.55) rockCluster(root, x, z);
  }
  for (const [x, z] of [[-4.4, -5.2], [5.8, -4.6], [-8.4, 3.2], [6.6, 2.8], [1.2, 6.6], [-3.8, 6.2], [4.2, 10.8], [-5.6, 10.2]]) {
    if (groundAt(x, z) > 0.8) flowerPatch(root, x, z);
  }

  // ---------- vegetation ----------
  const trees = [];
  const treeSpots = [
    [-3.2, -8.4], [-6.4, -6.2], [-8.2, -2.6], [-12.0, 6.2], [-6.8, 6.2],
    [-2.4, 8.4], [1.8, 9.2], [5.4, 8.6], [12.4, -2.6], [10.2, -1.2],
    [6.2, -6.4], [2.2, -9.6], [-11.4, 3.2], [-1.2, 2.4], [12.2, 2.6], [-11.8, -1.4],
  ];
  for (const [x, z] of treeSpots) {
    const s = 0.9 + ((x * 7 + z * 3) % 5) * 0.06;
    trees.push(broadleaf(root, x, z, s, addSolid(0.5, x, z)));
  }

  const palms = [];
  const palmSpots = [
    [-2.8, -14.4], [3.4, -13.6], [6.2, -11.2], [-6.2, -11.8], [-10.4, -7.4],
    [10.8, 2.2], [11.4, 6.8], [-11.2, 5.6], [5.8, 12.4], [-4.2, 12.8],
  ];
  for (const [x, z] of palmSpots) palms.push(palm(root, x, z, 1.0 + ((x + z) % 3) * 0.08));

  const bushes = [];
  const bushSpots = [
    [-1.4, -6.2], [2.4, -3.4], [-4.6, 2.8], [4.8, 4.2], [-7.2, -4.4], [6.4, 0.6],
    [-8.6, 1.6], [3.2, 7.2], [-2.8, 5.4], [8.2, -5.4], [-5.2, 9.2], [9.6, 3.2],
    [0.8, 4.2], [-9.8, -3.2],
  ];
  for (const [x, z] of bushSpots) bushes.push(bush(root, x, z, 0.9 + ((x * 3 + z) % 4) * 0.12));

  const grassTufts = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + 0.4;
    const d = 3.4 + ((i * 7) % 9);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (groundAt(x, z) < 0.7) continue;
    grassTufts.push(grassTuft(root, x, z, 0.8 + ((i * 3) % 4) * 0.1));
  }
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + 1.1;
    const d = 4.2 + ((i * 5) % 8);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (groundAt(x, z) < 0.8) continue;
    flower(root, x, z, i % 2 ? PAL.flower : PAL.flower2);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + 2.2;
    const d = 12.6 + ((i * 3) % 5) * 0.7;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    pebble(root, x, z, 0.1 + ((i * 3) % 3) * 0.04);
  }
  const driftwood = [[-7.4, -12.6, 0.6], [7.8, -10.2, -0.4], [-12.2, -2.4, 1.2], [12.4, 0.8, 0.2], [1.6, 13.2, -0.9], [-9.8, 9.8, 0.9]];
  for (const [x, z, r] of driftwood) logPiece(root, x, z, r);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.8;
    const d = 17.2 + (i % 3) * 1.4;
    coral(root, Math.cos(a) * d, Math.sin(a) * d, 0.7 + (i % 3) * 0.2);
  }

  // ---------- interactables ----------
  const rocks = [
    [7.2, 0.4, 0.55], [10.2, 1.6, 0.5], [6.2, 3.2, 0.5], [9.4, 4.4, 0.48],
    [11.2, -0.6, 0.48], [5.2, 5.4, 0.45], [8.2, -1.8, 0.45], [11.6, 3.2, 0.42],
    [4.6, 2.2, 0.46], [12.0, 1.0, 0.44], [-9.6, -6.2, 0.5], [-7.8, 8.4, 0.46],
  ].map(([x, z, s]) => makeRock(root, x, z, s, addSolid(s * 0.75, x, z)));

  const sands = [
    [4.8, -13.0], [6.4, -14.2], [7.6, -12.2], [-3.6, -13.2],
    [-4.8, -14.4], [-6.2, -12.6], [5.6, -15.2], [-2.2, -15.6],
  ].map(([x, z]) => makeSand(root, x, z));

  const shells = [
    [-6.4, -13.6], [8.2, -11.6], [-5.6, -15.0], [9.0, -9.8], [-8.4, -10.0],
    [3.4, -15.6], [-7.2, -12.0],
  ].map(([x, z]) => makeShell(root, x, z));

  // ---------- structures ----------
  hut(root, -9, 1.4);
  addSolid(1.5, -9, 1.4);
  const altar = shrine(root, 8.6, 6.6);
  boxes.push({ x: 8.6, z: 6.6, hw: 1.5, hd: 1.5, rot: -0.5 });
  dock(root, 0, 17.0);

  const builds = {
    furnace: furnace(root, 4.4, -4.6),
    house: buildHouse(root),
    boat: boat(root, 0, 18.4),
  };
  addSolid(0.55, 4.4, -4.6);
  boxes.push({ x: HOUSE.x, z: HOUSE.z, hw: HOUSE.w / 2 + 0.06, hd: HOUSE.d / 2 + 0.06, doorW: HOUSE.doorW, walls: true });
  const boatSolid = addSolid(0, 0, 18.4);
  builds.house.visible = true;

  const fire = campfire(root, 1.2, -11.6);

  // ---------- NPCs ----------
  const npcs = [
    { id: "tamo", name: "Tamo", x: 1.2, z: -13.4, yaw: 2.6, shirt: PAL.cloth3, hat: true, work: { x: 1.6, z: -12.2 }, home: { x: HOUSE.x - 1.7, z: HOUSE.z + HOUSE.d / 2 + 0.75 } },
    { id: "arin", name: "Arin", x: 6.6, z: 5.9, yaw: -2.2, shirt: PAL.cloth2, necklace: true, work: { x: 6.6, z: 5.9 }, home: { x: HOUSE.x + 1.7, z: HOUSE.z + HOUSE.d / 2 + 0.75 } },
  ].map((n) => {
    const g = capsule(root, n.x, n.z, n);
    const label = nameLabel(n.name);
    label.position.set(n.x, groundAt(n.x, n.z) + 1.35, n.z);
    root.add(label);
    const bubble = speechBubble(n.id === "tamo" ? "Halo, pendatang." : "Altar dijaga, ya.");
    bubble.position.set(n.x, groundAt(n.x, n.z) + 1.85, n.z);
    root.add(bubble);
    return {
      ...n, mesh: g, label, bubble, parts: g.userData,
      path: null, pi: 0, wait: Math.random() * 2, stuck: 0, lastX: n.x, lastZ: n.z,
      vy: 0, y: groundAt(n.x, n.z), greet: 0, greetCool: 0, bubbleT: 0, sepX: 0, sepZ: 0,
    };
  });

  const player = capsule(root, 0, -15.2, { shirt: 0x3f6b52, scarf: true, yaw: 0 });

  // ---------- cats ----------
  const cats = [
    { id: "soto", x: 2.6, z: -12.2 },
    { id: "bella", x: -6.0, z: 0.2 },
    { id: "cemong", x: 5.5, z: 4.7 },
  ].map((c) => {
    const cfg = CATS[c.id];
    const g = catMesh(root, cfg, c.x, c.z);
    const label = nameLabel(cfg.name);
    label.position.set(c.x, groundAt(c.x, c.z) + 0.9, c.z);
    label.visible = false;
    root.add(label);
    return {
      ...c, name: cfg.name, mesh: g, label, state: "sit", t: Math.random() * 3,
      target: null, path: null, pi: 0, purr: 0, night: false,
      y: groundAt(c.x, c.z), bubble: null, greetCool: 0,
    };
  });

  const torch = new THREE.PointLight(0xffc98a, 0, 9, 2);
  root.add(torch);
  const lanterns = [lantern(root, -7.6, 1.0), lantern(root, 7.4, 6.2), lantern(root, -0.9, 15.6)];

  // ---------- sky motion ----------
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const s = 3.4 + k * 1.5;
      const m = mesh(new THREE.SphereGeometry(s, 8, 6), PAL.cloud, k * 2.4 - 2, (k % 2) * 0.5, k * 0.6, g, false);
      m.material.fog = false;
      m.material.transparent = true;
      m.material.opacity = 0.92;
    }
    g.position.set(-60 + i * 15, 30 + (i % 3) * 5, -40 + (i % 4) * 26);
    g.userData.speed = 0.25 + (i % 4) * 0.09;
    root.add(g);
    clouds.push(g);
  }
  const birds = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.34, 0.08, 0.12), 0x2b2b30, 0, 0, 0, g, false);
    const wl = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.16), 0x33333a, -0.42, 0, 0, g, false);
    const wr = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.16), 0x33333a, 0.42, 0, 0, g, false);
    g.userData = { wl, wr, r: 13 + i * 1.6, a: (i / 6) * Math.PI * 2, y: 13 + (i % 3) * 2.2, sp: 0.16 + i * 0.02 };
    root.add(g);
    birds.push(g);
  }

  // ---------- sky driver ----------
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const tmp = new THREE.Color();
  const sunBase = new THREE.Vector3(0, 40, 24);
  const lerpC = (out, a, b, k) => out.copy(cA.setHex(a)).lerp(cB.setHex(b), k);
  let nightK = 0;

  function setTime(h) {
    const t = ((h % 24) + 24) % 24;
    let i = 0;
    while (i < SKY.length - 2 && SKY[i + 1].t <= t) i++;
    const a = SKY[i];
    const b = SKY[i + 1];
    const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));

    lerpC(skyColor, a.top, b.top, k);
    lerpC(scene.fog.color, a.fog, b.fog, k);
    lerpC(tmp, a.sun, b.sun, k);
    sunLight.color.copy(tmp);
    sunLight.intensity = a.sunI + (b.sunI - a.sunI) * k;
    lerpC(tmp, a.hemi, b.hemi, k);
    hemi.color.copy(tmp);
    lerpC(tmp, a.grd, b.grd, k);
    hemi.groundColor.copy(tmp);
    hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * k;
    nightK = a.night + (b.night - a.night) * k;
    starMat.opacity = Math.max(0, (nightK - 0.25) / 0.75);

    const ang = ((t - 6) / 24) * Math.PI * 2;
    const sx = Math.cos(ang) * 80;
    const sy = Math.sin(ang) * 80;
    if (sy > 2) {
      sunBase.set(sx, sy, 24);
      sunLight.position.copy(sunBase);
      sunDisc.position.set(sx * 1.5, sy * 1.5, 24 * 1.5);
      sunDisc.lookAt(0, 0, 0);
      sunDisc.visible = true;
      moonDisc.visible = false;
    } else {
      sunBase.set(-sx, Math.max(12, -sy), -24);
      sunLight.position.copy(sunBase);
      moonDisc.position.set(-sx * 1.5, Math.max(22, -sy * 1.5), -24 * 1.5);
      moonDisc.lookAt(0, 0, 0);
      moonDisc.visible = true;
      sunDisc.visible = false;
    }
    sunLight.target.position.set(0, 0, 0);
    sunLight.target.updateMatrixWorld();

    for (const l of lanterns) {
      l.light.intensity = nightK * 1.6;
      l.bulb.visible = nightK > 0.3;
    }
    torch.intensity = nightK * 1.2;
    ambient.intensity = nightK * 0.26;
    seaMat.color.setHex(0xffffff).multiplyScalar(0.55 + 0.45 * (1 - nightK * 0.75));
    for (const f of foams) f.material.opacity = 0.06 + 0.16 * (1 - nightK * 0.6);
    // house lights
    const hu = builds.house.userData;
    hu.lamp.intensity = nightK * 1.7;
    hu.innerLamp.intensity = nightK * 1.4;
    hu.bulb.visible = nightK > 0.3;
  }

  // ---------- dynamic state ----------
  let elapsed = 0;
  let nav = null;
  let surfaceFn = surfaceAt;
  const houseU = builds.house.userData;

  function houseContains(x, z) {
    return Math.abs(x - HOUSE.x) < HOUSE.w / 2 + 0.5 && Math.abs(z - HOUSE.z) < HOUSE.d / 2 + 0.8;
  }

  function surface(x, z) {
    if (houseContains(x, z) && simStage >= 1) return Math.max(surfaceAt(x, z), HOUSE.floor);
    return surfaceAt(x, z);
  }

  let simStage = 0;
  let playerRef = null;
  let lastNight = false;

  function moveActor(a, dt, speed, radius) {
    if (!a.path || a.pi >= a.path.length) return false;
    const target = a.path[a.pi];
    const dx = target.x - a.x;
    const dz = target.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.18) {
      a.pi++;
      return a.pi < a.path.length;
    }
    const vx = (dx / d) * speed;
    const vz = (dz / d) * speed;
    const nx = a.x + vx * dt;
    const nz = a.z + vz * dt;
    const ok = (x, z) => {
      if (collides(x, z, radius)) return false;
      // don't walk through the player
      if (playerRef && Math.hypot(x - playerRef.x, z - playerRef.z) < radius + 0.34) return false;
      return true;
    };
    if (ok(nx, a.z)) a.x = nx;
    if (ok(a.x, nz)) a.z = nz;
    // stuck detection
    const moved = Math.hypot(a.x - a.lastX, a.z - a.lastZ);
    a.stuck = moved < 0.01 ? a.stuck + dt : 0;
    a.lastX = a.x;
    a.lastZ = a.z;
    if (a.stuck > 1.5) {
      a.path = null;
      a.pi = 0;
      a.stuck = 0;
      a.wait = 0.2 + Math.random() * 0.4;
    }
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - a.mesh.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    a.mesh.rotation.y += dy * Math.min(1, dt * 7);
    return true;
  }

  // ---------- spatial hash for collider queries ----------
  // Buckets solids and boxes into a 2-unit grid so a query only tests nearby
  // candidates instead of every tree on the island.
  const HASH = 2;
  const hashCells = new Map();
  const hkey = (i, j) => i * 73856093 ^ j * 19349663;
  let hashDirty = true;

  function hashInsert(obj, minX, maxX, minZ, maxZ) {
    const i0 = Math.floor(minX / HASH), i1 = Math.floor(maxX / HASH);
    const j0 = Math.floor(minZ / HASH), j1 = Math.floor(maxZ / HASH);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = hkey(i, j);
        let list = hashCells.get(k);
        if (!list) { list = []; hashCells.set(k, list); }
        list.push(obj);
      }
    }
  }

  function rebuildHash() {
    hashCells.clear();
    for (const s of solids) {
      if (s.r <= 0) continue;
      hashInsert(s, s.x - s.r, s.x + s.r, s.z - s.r, s.z + s.r);
    }
    for (const b of boxes) {
      if (b.walls && simStage < 5) continue;
      const pad = b.walls ? 0.4 : 0;
      hashInsert(b, b.x - b.hw - pad, b.x + b.hw + pad, b.z - b.hd - pad, b.z + b.hd + pad);
    }
    hashDirty = false;
  }

  function hashQuery(x, z, r, out) {
    if (hashDirty) rebuildHash();
    out.length = 0;
    const i0 = Math.floor((x - r) / HASH), i1 = Math.floor((x + r) / HASH);
    const j0 = Math.floor((z - r) / HASH), j1 = Math.floor((z + r) / HASH);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = hashCells.get(hkey(i, j));
        if (!list) continue;
        for (const o of list) if (!out.includes(o)) out.push(o);
      }
    }
    return out;
  }
  const _q = [];

  // Nearest free spot for a body that ended up inside a collider.
  function depenetrate(x, z, r) {
    if (!collides(x, z, r)) return null;
    for (let ring = 1; ring <= 6; ring++) {
      const rad = ring * 0.16;
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2 + ring * 0.3;
        const px = x + Math.cos(ang) * rad;
        const pz = z + Math.sin(ang) * rad;
        if (!collides(px, pz, r)) return { x: px, z: pz };
      }
    }
    return null;
  }

  function collides(x, z, r) {
    const near = hashQuery(x, z, r + 1.2, _q);
    for (const s of near) {
      if (s.r === undefined) continue;
      if (s.r <= 0) continue;
      if (Math.hypot(s.x - x, s.z - z) < s.r + r) return true;
    }
    for (const b of near) {
      if (b.r !== undefined) continue;
      if (b.walls) {
        // walls only exist once the framing stage has been built
        if (simStage < 5) continue;
        // house: four wall strips, with a doorway on the +z face
        const lx = x - b.x;
        const lz = z - b.z;
        const t = 0.22 + r; // wall thickness + body radius
        // side walls
        if (Math.abs(Math.abs(lx) - b.hw) < t && Math.abs(lz) < b.hd + r) return true;
        // back wall
        if (Math.abs(lz + b.hd) < t && Math.abs(lx) < b.hw + r) return true;
        // front wall, split by the doorway
        if (Math.abs(lz - b.hd) < t && Math.abs(lx) < b.hw + r) {
          const half = b.doorW / 2 - r * 0.5;
          if (Math.abs(lx) > half) return true;
        }
        continue;
      }
      const dx = Math.max(Math.abs(x - b.x) - b.hw, 0);
      const dz = Math.max(Math.abs(z - b.z) - b.hd, 0);
      if (Math.hypot(dx, dz) < r) return true;
    }
    return false;
  }

  function invalidateHash() {
    hashDirty = true;
  }

  function setNav(n) {
    nav = n;
  }

  // ---------- voyage: boat, shark, patches, city ----------
  const voyage = new THREE.Group();
  voyage.visible = false;
  scene.add(voyage);
  const sailBoat = sailBoatMesh(voyage);
  const shark = sharkMesh(voyage);
  shark.group.visible = false;
  const patchMarks = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.34, 18),
      new THREE.MeshBasicMaterial({ color: 0xf5a63b, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.24, 14), new THREE.MeshBasicMaterial({ color: 0x101820 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.01;
    g.add(hole);
    g.position.set(side * 0.62, 0.62, 0.2);
    g.visible = false;
    voyage.add(g);
    patchMarks.push({ side, group: g, ring, hole, done: false, x: side * 0.62, z: 0.2 });
  }
  const spray = [];
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xcfeaf4, transparent: true, opacity: 0.7 }));
    s.position.set(i ? 0.62 : -0.62, 0.75, 0.2);
    s.visible = false;
    voyage.add(s);
    spray.push(s);
  }
  let city = null;

  function buildCity() {
    if (city) return city;
    city = new THREE.Group();
    const rnd = mulberry(7);
    for (let i = 0; i < 38; i++) {
      const w = 1.4 + rnd() * 2.4;
      const h = 2 + rnd() * 8;
      const d = 1.4 + rnd() * 2.4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(new THREE.Color().setHSL(0.58, 0.12, 0.18 + rnd() * 0.14).getHex()));
      b.position.set(-16 + rnd() * 32, h / 2, -8 - rnd() * 20);
      b.castShadow = true;
      b.receiveShadow = true;
      city.add(b);
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.6, 0.05), new THREE.MeshBasicMaterial({ color: 0xffcf7a }));
      win.position.set(b.position.x, b.position.y, b.position.z + d / 2 + 0.03);
      city.add(win);
    }
    // lighthouse
    const lh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 12, 10), mat(0xe8e2d4));
    lh.position.set(-12, 6, -18);
    city.add(lh);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 10), mat(0xb8443a));
    cap.position.set(-12, 12.6, -18);
    city.add(cap);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
    lamp.position.set(-12, 11.6, -18);
    city.add(lamp);
    // cranes
    for (const cx of [-4, 6]) {
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.25, 9, 0.25), mat(0x6a7076));
      mast.position.set(cx, 4.5, -12);
      city.add(mast);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 0.25), mat(0x6a7076));
      arm.position.set(cx + 2.5, 8.6, -12);
      city.add(arm);
    }
    // pier
    const pier = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 2.2), mat(PAL.wood2));
    pier.position.set(0, 0.3, -6.5);
    city.add(pier);
    city.position.set(0, 0, -60);
    voyage.add(city);
    return city;
  }

  function disposeCity() {
    if (!city) return;
    voyage.remove(city);
    city.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    city = null;
  }

  function mulberry(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- sync ----------
  // Collider debug view (F3 / ?debug=collider): circles, boxes, nav grid.
  let debugGroup = null;
  function toggleDebug(on) {
    if (on === undefined) on = !debugGroup;
    if (on && !debugGroup) {
      debugGroup = new THREE.Group();
      debugGroup.renderOrder = 9;
      const cm = new THREE.MeshBasicMaterial({ color: 0xf5a63b, transparent: true, opacity: 0.35, depthWrite: false, wireframe: true });
      const bm = new THREE.MeshBasicMaterial({ color: 0xe8654c, transparent: true, opacity: 0.4, depthWrite: false, wireframe: true });
      for (const s of solids) {
        if (s.r <= 0) continue;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, 1.2, 10), cm);
        c.position.set(s.x, surfaceAt(s.x, s.z) + 0.6, s.z);
        debugGroup.add(c);
      }
      for (const b of boxes) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(b.hw * 2, 2.2, b.hd * 2), bm);
        box.position.set(b.x, surfaceAt(b.x, b.z) + 1.1, b.z);
        debugGroup.add(box);
      }
      if (nav) {
        const pts = [];
        for (let j = 0; j < nav.N; j += 1) {
          for (let i = 0; i < nav.N; i += 1) {
            if (nav.free(i, j)) continue;
            const x = nav.toWorld(i);
            const z = nav.toWorld(j);
            pts.push(x, surfaceAt(x, z) + 0.06, z);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        debugGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8654c, size: 0.18, transparent: true, opacity: 0.7, depthWrite: false })));
      }
      scene.add(debugGroup);
    } else if (!on && debugGroup) {
      scene.remove(debugGroup);
      debugGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      debugGroup = null;
    }
    return !!debugGroup;
  }

  function sync(sim, dt = 0.016) {
    elapsed += dt;
    const t = elapsed;
    const stageBefore = simStage;
    simStage = sim.houseStage || 0;
    if (simStage !== stageBefore) invalidateHash();
    playerRef = sim;
    // keep the shadow frustum tight around the player so shadows stay sharp
    sunLight.position.set(sunBase.x + sim.x * 0.35, sunBase.y, sunBase.z + sim.z * 0.35);
    sunLight.target.position.set(sim.x * 0.35, 0, sim.z * 0.35);
    sunLight.target.updateMatrixWorld();
    const py = surface(sim.x, sim.z);

    // player
    const onBoat = sim.phase === "sail" || sim.phase === "shark" || sim.phase === "patch" || sim.phase === "city";
    if (onBoat) {
      player.position.set(sim.x, sim.y ?? 0.9, sim.z);
      player.visible = true;
    } else {
      player.position.set(sim.x, py, sim.z);
      player.visible = sim.phase === "island" || sim.phase === "cut1";
    }
    player.rotation.y = sim.yaw + Math.PI;
    animateCapsule(player.userData, {
      t,
      dt,
      moving: sim.moving && !onBoat,
      speed: sim.running ? 1.4 : 1,
      phase: 0,
      axe: sim.axe && !onBoat,
      swing: sim.chop ? sim.chop.t / sim.chop.dur : 0,
    });

    // house stage visibility + pop
    houseU.stageGroups.forEach((sg, i) => {
      const want = i < simStage;
      if (want && !sg.visible) {
        sg.visible = true;
        sg.userData.pop = 1;
        sg.scale.setScalar(0.82);
      }
      if (!want) sg.visible = false;
      if (sg.userData.pop > 0) {
        sg.userData.pop = Math.max(0, sg.userData.pop - dt * 2.4);
        const k = sg.userData.pop;
        const s = 1 + Math.sin(k * Math.PI) * 0.08 * k;
        sg.scale.setScalar(s);
      } else if (sg.visible) sg.scale.setScalar(1);
    });
    // roof fades when player is inside
    const inside = houseContains(sim.x, sim.z) && Math.abs(sim.x - HOUSE.x) < HOUSE.w / 2 && Math.abs(sim.z - HOUSE.z) < HOUSE.d / 2;
    for (const m of houseU.roofMats) {
      m.transparent = true;
      m.opacity += ((inside ? 0.22 : 1) - m.opacity) * Math.min(1, dt * 6);
    }
    // smoke
    if (sim.houseStage >= 8) {
      for (let i = 0; i < houseU.smoke.length; i++) {
        const s = houseU.smoke[i];
        const k = (t * 0.22 + i / houseU.smoke.length) % 1;
        s.position.y = HOUSE.floor + 3.4 + k * 2.4;
        s.position.x = 1.0 + Math.sin(k * 6 + i) * 0.3;
        s.scale.setScalar(0.3 + k * 0.8);
        s.material.opacity = 0.32 * (1 - k);
      }
    }

    // trees
    for (const tr of trees) {
      const alive = !tr.felled;
      tr.canopy.visible = alive;
      tr.stump.visible = tr.felled;
      if (alive) {
        tr.canopy.rotation.z = Math.sin(t * 0.7 + tr.phase) * 0.012 + (tr.shake || 0);
        tr.canopy.rotation.x = Math.cos(t * 0.6 + tr.phase) * 0.009;
      }
      if (tr.shake > 0) tr.shake = Math.max(0, tr.shake - dt * 3);
      if (tr.falling) {
        tr.fallT = Math.min(1, (tr.fallT || 0) + dt * 1.5);
        const e = tr.fallT * tr.fallT;
        tr.mesh.rotation.x = tr.fallDir * e * 1.5;
        tr.mesh.position.y = groundAt(tr.x, tr.z) - e * 0.1;
        if (tr.fallT >= 1) {
          tr.falling = false;
          tr.canopy.visible = false;
          tr.stump.visible = true;
        }
      }
      if (tr.felled) {
        // regrow after 2 game days
        if (sim.day >= (tr.regrowDay || 0) && tr.regrowDay) {
          tr.felled = false;
          tr.regrowDay = 0;
          tr.solid.r = 0.5;
          invalidateHash();
          tr.mesh.rotation.x = 0;
          tr.mesh.position.y = groundAt(tr.x, tr.z);
          tr.canopy.visible = true;
          tr.stump.visible = false;
          tr.canopy.scale.setScalar(0.5);
          tr.grow = 1;
          if (nav) nav.updateAround(tr.x, tr.z, 2);
        }
      }
      if (tr.grow > 0) {
        tr.grow = Math.max(0, tr.grow - dt * 0.6);
        tr.canopy.scale.setScalar(0.5 + (1 - tr.grow) * 0.5);
      }
    }
    for (const r of rocks) r.mesh.visible = !r.mined;
    for (const s of sands) s.mesh.visible = !s.taken;
    for (const s of shells) s.mesh.visible = !s.taken;
    altar.repaired.visible = sim.repaired;
    altar.crack.visible = !sim.repaired;
    builds.furnace.visible = sim.built.furnace;
    boatSolid.r = 0;

    // palms, bushes sway with per-object phase
    for (const p of palms) {
      p.crown.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.045;
      p.crown.rotation.x = Math.cos(t * 0.7 + p.phase * 1.3) * 0.02;
    }
    for (const b of bushes) b.rotation.z = Math.sin(t * 1.1 + b.position.x) * 0.022;
    for (const g of grassTufts) g.rotation.z = Math.sin(t * 1.6 + g.position.x * 2.1) * 0.05;

    // sea waves
    const pa = seaPos.array;
    for (let i = 0; i < seaPos.count; i++) {
      const x = seaBase[i * 3];
      const z = seaBase[i * 3 + 2];
      const r = Math.hypot(x, z);
      const damp = Math.min(1, Math.max(0, (r - 13) / 8));
      pa[i * 3 + 1] = (Math.sin(x * 0.42 + t * 1.1) * 0.09 + Math.cos(z * 0.37 + t * 0.8) * 0.07 + Math.sin((x + z) * 0.23 + t * 0.5) * 0.05) * damp;
    }
    seaPos.needsUpdate = true;

    // clouds / birds
    for (const cl of clouds) {
      cl.position.x += dt * cl.userData.speed;
      if (cl.position.x > 70) cl.position.x = -70;
    }
    for (const b of birds) {
      const u = b.userData;
      u.a += u.sp * dt;
      b.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 2) * 0.6, Math.sin(u.a) * u.r);
      b.rotation.y = -u.a + Math.PI / 2;
      const flap = Math.sin(t * 6 + u.a * 3) * 0.5;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
    }
    for (const f of foams) {
      const k = (t * 0.12 + f.userData.off) % 1;
      f.material.opacity = 0.08 + 0.14 * (1 - k) * (1 - nightK * 0.55);
    }
    if (fire) {
      const fk = Math.abs(Math.sin(t * 7.4));
      fire.userData.flame.scale.y = 0.82 + fk * 0.36;
      fire.userData.flame.scale.x = 0.88 + fk * 0.22;
      fire.userData.flame2.scale.y = 0.8 + fk * 0.3;
      fire.userData.fl.intensity = 1.1 + fk * 0.65 + nightK * 0.4;
    }
    torch.position.set(sim.x, py + 1.4, sim.z);

    // ---------- NPC AI ----------
    for (const n of npcs) {
      const night = nightK > 0.55;
      const home = sim.houseStage >= 8;
      let goal;
      if (night && home) goal = n.home;
      else if (night) goal = n.work;
      else if (n.id === "tamo" && sim.houseStage > 0 && sim.houseStage < 8) goal = { x: HOUSE.x - 1.8, z: HOUSE.z + 2.2 };
      else goal = n.work;
      n.wait -= dt;
      const distGoal = Math.hypot(goal.x - n.x, goal.z - n.z);
      if (n.wait <= 0 && distGoal > 0.55 && (!n.path || n.pi >= n.path.length)) {
        if (nav) n.path = nav.path(n.x, n.z, goal.x, goal.z);
        n.pi = 0;
        n.wait = 2 + Math.random() * 2;
      }
      let moving = false;
      if (n.path && n.pi < n.path.length && distGoal > 0.5) {
        moving = moveActor(n, dt, night ? 1.1 : 1.4, 0.3);
      }
      if (!moving && distGoal <= 0.6) {
        n.wait = 1.5 + Math.random() * 3;
        n.path = null;
      }
      // depenetration: if a stage popped up around the NPC, slide it out
      const push = depenetrate(n.x, n.z, 0.3);
      if (push) {
        n.x += (push.x - n.x) * Math.min(1, dt * 5);
        n.z += (push.z - n.z) * Math.min(1, dt * 5);
        n.path = null;
      }
      // greet the player: turn, hop twice, show a bubble, cool down
      const d = Math.hypot(n.x - sim.x, n.z - sim.z);
      n.greetCool = Math.max(0, n.greetCool - dt);
      if (d < 3.0) {
        const look = Math.atan2(sim.x - n.x, sim.z - n.z);
        let dy = look - n.mesh.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        n.mesh.rotation.y += dy * Math.min(1, dt * 5);
        if (d < 2.2 && n.greetCool <= 0 && n.greet <= 0) {
          n.greet = 1.6;
          n.greetCool = 14;
          n.bubbleT = 2.6;
          n.path = null; // pause the walk to say hello
        }
      }
      if (n.greet > 0) n.greet = Math.max(0, n.greet - dt);
      const hop = n.greet > 0 ? Math.abs(Math.sin((1.6 - n.greet) * 9)) * 0.16 * Math.min(1, n.greet) : 0;
      // damped ground follow so slopes never snap the mesh
      const gy = surface(n.x, n.z);
      n.y += (gy - n.y) * Math.min(1, dt * 9);
      n.mesh.position.set(n.x, n.y + (moving ? Math.abs(Math.sin(t * 9)) * 0.04 : 0) + hop, n.z);
      animateCapsule(n.parts, { t, dt, moving, speed: 0.9, phase: n.x });
      n.label.position.set(n.x, n.y + 1.35, n.z);
      n.label.material.opacity = d < 10 ? 1 : 0.4;
      // bubble
      n.bubbleT = Math.max(0, n.bubbleT - dt);
      n.bubble.visible = n.bubbleT > 0;
      if (n.bubble.visible) {
        n.bubble.position.set(n.x, n.y + 1.85 + hop, n.z);
        const k = Math.min(1, (2.6 - n.bubbleT) * 6);
        n.bubble.scale.set(1.5 * (0.7 + k * 0.3), 0.75 * (0.7 + k * 0.3), 1);
      }
      if (n.mesh.rotation.y > Math.PI) n.mesh.rotation.y -= Math.PI * 2;
      if (n.mesh.rotation.y < -Math.PI) n.mesh.rotation.y += Math.PI * 2;
    }

    // ---------- cats ----------
    for (const cat of cats) {
      const u = cat.mesh.userData;
      cat.t -= dt;
      const night = nightK > 0.55;
      if (night) cat.state = "sleep";
      else if (cat.state === "sleep") cat.state = "sit";
      if (cat.state === "sleep") {
        const base = cat.mesh.position;
        const porch = { x: HOUSE.x + (cat.id === "soto" ? -1.6 : cat.id === "bella" ? 0 : 1.6), z: HOUSE.z + HOUSE.d / 2 + 0.9 };
        if (sim.houseStage >= 8) {
          const dx = porch.x - cat.x, dz = porch.z - cat.z;
          if (Math.hypot(dx, dz) > 0.5) {
            const nx = cat.x + (dx / Math.hypot(dx, dz)) * dt * 0.9;
            const nz = cat.z + (dz / Math.hypot(dx, dz)) * dt * 0.9;
            if (!collides(nx, nz, 0.18)) { cat.x = nx; cat.z = nz; }
          }
        }
        base.set(cat.x, surface(cat.x, cat.z), cat.z);
        u.body.rotation.z = 1.35;
        u.body.position.y = 0.14;
        u.head.rotation.z = 0.5;
      } else {
        u.body.rotation.z += (0 - u.body.rotation.z) * Math.min(1, dt * 4);
        u.body.position.y += (0 - u.body.position.y) * Math.min(1, dt * 4);
        u.head.rotation.z += (0 - u.head.rotation.z) * Math.min(1, dt * 4);
        if (cat.state === "walk" || cat.state === "play") {
          if (!cat.target || Math.hypot(cat.target.x - cat.x, cat.target.z - cat.z) < 0.35 || cat.t <= 0) {
            const a = Math.random() * Math.PI * 2;
            const r = 2 + Math.random() * 5;
            let tx = Math.max(-12, Math.min(12, cat.x + Math.cos(a) * r));
            let tz = Math.max(-12, Math.min(12, cat.z + Math.sin(a) * r));
            // keep cats off the water and out of walls
            if (surfaceAt(tx, tz) < 0.4 || collides(tx, tz, 0.18)) {
              tx = cat.x;
              tz = cat.z;
            }
            cat.target = { x: tx, z: tz };
            cat.path = nav ? nav.path(cat.x, cat.z, tx, tz) : null;
            cat.pi = 0;
            cat.t = 3 + Math.random() * 4;
          }
          if (cat.path && cat.pi < cat.path.length) {
            const tp = cat.path[cat.pi];
            const dx = tp.x - cat.x, dz = tp.z - cat.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.2) cat.pi++;
            else {
              const nx = cat.x + (dx / d) * dt * 1.05;
              const nz = cat.z + (dz / d) * dt * 1.05;
              if (!collides(nx, nz, 0.16)) { cat.x = nx; cat.z = nz; }
              const yaw = Math.atan2(dx, dz);
              let dy = yaw - cat.mesh.rotation.y;
              while (dy > Math.PI) dy -= Math.PI * 2;
              while (dy < -Math.PI) dy += Math.PI * 2;
              cat.mesh.rotation.y += dy * Math.min(1, dt * 8);
            }
          }
        }
        if (cat.t <= 0 && cat.state !== "petted") {
          cat.state = Math.random() < 0.35 ? "walk" : Math.random() < 0.5 ? "play" : "sit";
          cat.t = 3 + Math.random() * 5;
        }
      }
      // depenetration + damped ground follow
      const cpush = depenetrate(cat.x, cat.z, 0.17);
      if (cpush) {
        cat.x += (cpush.x - cat.x) * Math.min(1, dt * 5);
        cat.z += (cpush.z - cat.z) * Math.min(1, dt * 5);
        cat.path = null;
      }
      const cgy = surface(cat.x, cat.z);
      cat.y += (cgy - cat.y) * Math.min(1, dt * 10);
      const cMoving = cat.state === "walk" || cat.state === "play";
      if (cat.state !== "sleep") {
        cat.mesh.position.set(cat.x, cat.y + (cMoving ? Math.abs(Math.sin(t * 9 + cat.x)) * 0.035 : 0), cat.z);
      }

      // tail follow-through
      for (let i = 0; i < u.tail.length; i++) {
        const seg = u.tail[i];
        const sway = Math.sin(t * (2.2 + i * 0.4) + cat.x + i * 0.5) * (0.16 + i * 0.05);
        seg.rotation.y = sway;
        seg.rotation.x = -0.25 + Math.sin(t * 1.6 + i * 0.6) * 0.08;
      }
      // head bob
      u.head.rotation.y = Math.sin(t * 0.8 + cat.z) * 0.22;
      // label
      const d = Math.hypot(cat.x - sim.x, cat.z - sim.z);
      cat.label.visible = d < 6 && sim.phase === "island";
      cat.label.position.set(cat.x, cat.y + 0.95, cat.z);
      // purr squash
      if (cat.purr > 0) {
        cat.purr = Math.max(0, cat.purr - dt);
        const k = cat.purr / 0.5;
        u.body.scale.set(1 + k * 0.2, 1 - k * 0.25, 1 + k * 0.2);
      } else {
        u.body.scale.x += (1 - u.body.scale.x) * Math.min(1, dt * 6);
        u.body.scale.y += (1 - u.body.scale.y) * Math.min(1, dt * 6);
        u.body.scale.z += (1 - u.body.scale.z) * Math.min(1, dt * 6);
      }
    }

    // ---------- actor separation ----------
    // Runs on live positions after everyone has moved, so it can't be undone
    // by a stale snapshot. Pairwise push; the player is pushed too.
    const bodies = [
      { x: sim.x, z: sim.z, r: 0.34, player: true },
      ...npcs.map((n) => ({ ref: n, x: n.x, z: n.z, r: 0.30 })),
      ...cats.map((c) => ({ ref: c, x: c.x, z: c.z, r: 0.17 })),
    ];
    for (let i = 0; i < bodies.length; i++) {
      for (let k = i + 1; k < bodies.length; k++) {
        const a = bodies[i];
        const b = bodies[k];
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        let dist = Math.hypot(dx, dz);
        const minD = a.r + b.r;
        if (dist >= minD) continue;
        if (dist < 0.0001) { dx = 0.01; dz = 0; dist = 0.01; }
        const overlap = (minD - dist) * 0.5 + 0.005;
        const nx = dx / dist;
        const nz = dz / dist;
        const aPlayer = !!a.player;
        const bPlayer = !!b.player;
        // share the push; a player-vs-NPC pair moves the player a bit less
        const aw = aPlayer ? 0.6 : bPlayer ? 1 : 0.5;
        const bw = 1 - aw;
        // a chopping player is planted: NPCs walk around, they never shove
        if ((aPlayer || bPlayer) && sim.chop) continue;
        const ax = a.x - nx * overlap * 2 * aw;
        const az = a.z - nz * overlap * 2 * aw;
        if (!collides(ax, az, a.r)) { a.x = ax; a.z = az; }
        const bx = b.x + nx * overlap * 2 * bw;
        const bz = b.z + nz * overlap * 2 * bw;
        if (!collides(bx, bz, b.r)) { b.x = bx; b.z = bz; }
      }
    }
    for (const body of bodies) {
      if (body.player) { sim.x = body.x; sim.z = body.z; }
      else if (body.ref) { body.ref.x = body.x; body.ref.z = body.z; }
    }
    // refresh meshes with the post-separation positions
    player.position.x = sim.x;
    player.position.z = sim.z;
    player.position.y = surface(sim.x, sim.z);
    for (const n of npcs) {
      n.mesh.position.x = n.x;
      n.mesh.position.z = n.z;
      n.label.position.x = n.x;
      n.label.position.z = n.z;
    }

    // ---------- voyage ----------
    if (sim.phase === "sail" || sim.phase === "shark" || sim.phase === "patch" || sim.phase === "city") {
      voyage.visible = true;
      sailBoat.position.set(0, 0, 0);
      const bob = Math.sin(t * 1.3) * 0.06 + Math.sin(t * 0.7 + 1.2) * 0.04;
      sailBoat.position.y = bob;
      sailBoat.rotation.z = Math.sin(t * 0.9) * 0.035 - sim.boatBank * 0.28;
      sailBoat.rotation.x = Math.sin(t * 1.1 + 0.6) * 0.02;
      // ocean moved under the boat: fake by moving island? keep boat at origin, move city
      if (city) city.position.z = -60 + sim.voyageDist * 0.9;
      // patches
      patchMarks.forEach((p, i) => {
        p.group.visible = sim.phase === "patch" && !sim.patches[i];
        p.group.position.set(p.side * 0.62, 0.62 + bob, 0.2);
        p.ring.rotation.z = t * 2;
        p.ring.material.opacity = 0.5 + Math.sin(t * 4) * 0.3;
        spray[i].visible = sim.phase === "patch" && !sim.patches[i];
        if (spray[i].visible) {
          spray[i].position.y = 0.72 + Math.sin(t * 8 + i) * 0.08;
          spray[i].scale.y = 0.8 + Math.sin(t * 9 + i) * 0.3;
        }
      });
      // shark
      shark.group.visible = sim.phase === "shark";
      if (sim.phase === "shark") {
        const k = sim.sharkT || 0;
        const a = k * 2.4;
        const r = 3.2 - Math.min(1, k * 0.5) * 1.4;
        shark.group.position.set(Math.cos(a) * r, -0.1 + Math.sin(a * 2) * 0.12, Math.sin(a) * r);
        shark.group.rotation.y = -a + Math.PI / 2;
        const wave = Math.sin(t * 6);
        shark.body.rotation.z = wave * 0.12;
        shark.tail.rotation.y = wave * 0.5;
        if (k > 0.45 && k < 0.62) {
          shark.group.position.y += Math.sin((k - 0.45) / 0.17 * Math.PI) * 1.8;
        }
      }
      if (sim.phase === "city" && city) {
        city.visible = true;
      }
    } else {
      voyage.visible = false;
    }

    // boat on the island dock
    if (sim.phase === "island" || sim.phase === "cut1") {
      builds.boat.visible = sim.built.boat;
      builds.boat.position.set(0, 0.02 + Math.sin(t * 1.6) * 0.05, 18.4);
      builds.boat.rotation.z = Math.sin(t * 1.1) * 0.035;
    }
  }

  // ---------- cutscene camera ----------
  const cut = {
    pos: new THREE.Vector3(),
    aim: new THREE.Vector3(),
  };
  function cutCamera(kind, k) {
    const e = k * k * (3 - 2 * k);
    if (kind === "gift") {
      // wide dock, push in toward boat
      cut.pos.set(-6 + e * 4, 4.2 - e * 1.3, 13.0 - e * 2.0);
      cut.aim.set(0, 1.0, 17.6);
    } else if (kind === "depart") {
      cut.pos.set(-3 + e * 2, 3.2 + e * 2.4, 11.5 + e * 2.0);
      cut.aim.set(0, 0.8, 18.2 + e * 2.2);
    } else if (kind === "crane") {
      cut.pos.set(0.5, 1.4 + e * 7.0, 10.0 + e * 3.0);
      cut.aim.set(0, 1.0, 20.0 + e * 10);
    } else if (kind === "shark") {
      cut.pos.set(3.2 - e * 1.2, 0.55 + e * 1.1, 3.2 - e * 1.0);
      cut.aim.set(0, 0.5, 0.4);
    } else if (kind === "patch") {
      cut.pos.set(0, 2.4, 4.6 - e * 0.4);
      cut.aim.set(0, 0.8, 0);
    } else if (kind === "city") {
      cut.pos.set(-5 + e * 2, 2.0 + e * 2.2, -48 - e * 6);
      cut.aim.set(0, 2.0, -62);
    }
    return cut;
  }

  const keep = [
    ...trees, ...rocks, ...sands, ...shells,
    builds.furnace, builds.house, builds.boat,
    ...npcs.map((n) => n.mesh), ...npcs.map((n) => n.label), ...npcs.map((n) => n.bubble),
    player, ...clouds, ...birds, ...foams, ...cats.map((c) => c.mesh), ...cats.map((c) => c.label),
    sunDisc, moonDisc, torch, ...(fire && fire.flame ? [fire.flame, fire.flame2] : []),
  ];
  const mergeStats = mergeStatic(root, keep);

  return {
    mergeStats,
    solids,
    boxes,
    trees,
    rocks,
    sands,
    shells,
    npcs,
    cats,
    altar,
    boat: { x: 0, z: 18.4 },
    builds,
    housePos: { x: HOUSE.x, z: HOUSE.z },
    house: HOUSE,
    player,
    voyage,
    sailBoat,
    shark,
    patchMarks,
    buildCity,
    disposeCity,
    get city() {
      return city;
    },
    setTime,
    sync,
    surface,
    collides,
    setNav,
    cutCamera,
    toggleDebug,
    hashQuery,
    invalidateHash,
    depenetrate,
    get night() {
      return nightK;
    },
    get elapsed() {
      return elapsed;
    },
    get decorCount() {
      return trees.length + palms.length + bushes.length + grassTufts.length + clouds.length + birds.length;
    },
  };
}

// ---------- vegetation builders ----------
function broadleaf(parent, x, z, s, col) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.13 * s, 0.21 * s, 1.5 * s, 6), PAL.trunk, 0, 0.75 * s, 0, g);
  const canopy = new THREE.Group();
  canopy.position.y = 1.5 * s;
  mesh(new THREE.IcosahedronGeometry(0.95 * s, 0), PAL.leaf, 0, 0.42 * s, 0, canopy);
  mesh(new THREE.IcosahedronGeometry(0.7 * s, 0), PAL.leaf2, 0.55 * s, 0.16 * s, 0.24 * s, canopy);
  mesh(new THREE.IcosahedronGeometry(0.62 * s, 0), PAL.leaf3, -0.5 * s, 0.2 * s, -0.3 * s, canopy);
  mesh(new THREE.IcosahedronGeometry(0.5 * s, 0), PAL.leaf2, 0.1 * s, 0.86 * s, -0.12 * s, canopy);
  g.add(canopy);
  const stump = mesh(new THREE.CylinderGeometry(0.24 * s, 0.28 * s, 0.2, 6), PAL.stump, 0, 0.1, 0, g);
  stump.visible = false;
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return { x, z, felled: false, solid: col, canopy, stump, mesh: g, hp: 3, phase: x * 1.7 + z * 0.9, shake: 0, falling: false, fallT: 0, fallDir: 1, regrowDay: 0, grow: 0 };
}

function palm(parent, x, z, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Group();
  let py = 0;
  const lean = 0.1 * s;
  for (let i = 0; i < 5; i++) {
    const h = 0.62 * s;
    const rTop = 0.085 * s * (1 - i * 0.08);
    const rBot = 0.1 * s * (1 - i * 0.08);
    const seg = mesh(new THREE.CylinderGeometry(rTop, rBot, h, 6), i % 2 ? PAL.trunk : PAL.trunk2, lean * i * 0.9, py + h / 2, 0, trunk);
    seg.rotation.z = -lean * i * 0.28;
    py += h * 0.94;
  }
  g.add(trunk);
  const crown = new THREE.Group();
  crown.position.set(lean * 5 * 0.75, py, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const fg = new THREE.Group();
    fg.rotation.y = -a;
    const leaf = mesh(new THREE.BoxGeometry(1.55 * s, 0.055, 0.34 * s), i % 2 ? PAL.leaf : PAL.leaf2, 0.78 * s, 0.04, 0, fg);
    leaf.rotation.z = -0.24;
    crown.add(fg);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.6;
    mesh(new THREE.SphereGeometry(0.1 * s, 6, 5), 0x6b5232, Math.cos(a) * 0.16 * s, -0.1, Math.sin(a) * 0.16 * s, crown);
  }
  g.add(crown);
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return { crown, phase: x * 1.3 + z * 0.7 };
}

function bush(parent, x, z, s) {
  const g = new THREE.Group();
  mesh(new THREE.IcosahedronGeometry(0.42 * s, 0), PAL.leaf3, 0, 0.3 * s, 0, g);
  mesh(new THREE.IcosahedronGeometry(0.3 * s, 0), PAL.leaf, 0.26 * s, 0.24 * s, 0.14 * s, g);
  mesh(new THREE.IcosahedronGeometry(0.26 * s, 0), PAL.leaf2, -0.22 * s, 0.2 * s, -0.1 * s, g);
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return g;
}

function grassTuft(parent, x, z, s) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const b = mesh(new THREE.ConeGeometry(0.055 * s, 0.42 * s, 4), i % 2 ? PAL.grass : PAL.grass2, Math.cos(a) * 0.09, 0.21 * s, Math.sin(a) * 0.09, g, false);
    b.rotation.z = Math.cos(a) * 0.3;
    b.rotation.x = Math.sin(a) * 0.3;
  }
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return g;
}

function flower(parent, x, z, color) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.26, 4), PAL.grass2, 0, 0.13, 0, g, false);
  mesh(new THREE.IcosahedronGeometry(0.075, 0), color, 0, 0.28, 0, g, false);
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return g;
}

function pebble(parent, x, z, s) {
  const m = mesh(new THREE.DodecahedronGeometry(s, 0), PAL.rock2, x, groundAt(x, z) + s * 0.5, z, parent, false);
  m.rotation.set(x, z, x + z);
  return m;
}

function logPiece(parent, x, z, rot) {
  const g = new THREE.Group();
  const m = mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.5, 6), PAL.trunk2, 0, 0.14, 0, g, false);
  m.rotation.z = Math.PI / 2;
  g.rotation.y = rot;
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return g;
}

function coral(parent, x, z, s) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const m = mesh(new THREE.ConeGeometry(0.12 * s, 0.7 * s, 5), i % 2 ? 0xd77a5a : 0xc76a7a, Math.cos(a) * 0.16, 0.28 * s, Math.sin(a) * 0.16, g, false);
    m.rotation.z = Math.cos(a) * 0.35;
    m.rotation.x = Math.sin(a) * 0.35;
  }
  g.position.set(x, -0.35, z);
  parent.add(g);
  return g;
}

function makeRock(parent, x, z, s, col) {
  const g = new THREE.Group();
  const m = mesh(new THREE.DodecahedronGeometry(s, 0), PAL.rock, 0, s * 0.55, 0, g);
  m.rotation.set(x * 0.3, z * 0.4, x * 0.2);
  mesh(new THREE.DodecahedronGeometry(s * 0.55, 0), PAL.rock2, s * 0.5, s * 0.28, s * 0.3, g, false);
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return { x, z, mined: false, solid: col, mesh: g };
}

function makeSand(parent, x, z) {
  const g = new THREE.Group();
  mesh(new THREE.ConeGeometry(0.3, 0.26, 6), PAL.sand, 0, 0.13, 0, g, false);
  mesh(new THREE.ConeGeometry(0.18, 0.16, 5), 0xf0d7a0, 0.22, 0.08, 0.1, g, false);
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return { x, z, taken: false, mesh: g };
}

function makeShell(parent, x, z) {
  const g = new THREE.Group();
  const m = mesh(new THREE.SphereGeometry(0.17, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), PAL.shell, 0, 0.02, 0, g, false);
  m.rotation.x = -0.35;
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  return { x, z, taken: false, mesh: g };
}

function hut(parent, x, z) {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(2.4, 1.4, 2.0), PAL.wood, 0, 0.9, 0, g);
  mesh(new THREE.BoxGeometry(2.5, 0.12, 2.1), PAL.wood2, 0, 1.62, 0, g);
  mesh(new THREE.ConeGeometry(2.0, 1.15, 4), PAL.roof, 0, 2.15, 0, g);
  mesh(new THREE.BoxGeometry(0.5, 0.85, 0.08), 0x4a3222, 0, 0.62, 1.02, g);
  mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), 0x2a2118, -0.72, 1.05, 1.02, g);
  mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), PAL.trunk, 1.5, 0.5, 0.9, g);
  mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), PAL.trunk, 2.1, 0.5, 0.9, g);
  mesh(new THREE.BoxGeometry(0.7, 0.04, 0.04), PAL.trunk, 1.8, 0.96, 0.9, g);
  g.position.set(x, groundAt(x, z) - 0.05, z);
  g.rotation.y = 0.4;
  parent.add(g);
  return g;
}

function shrine(parent, x, z) {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(2.6, 0.36, 2.6), PAL.stone, 0, 0.36, 0, g);
  mesh(new THREE.BoxGeometry(2.8, 0.12, 2.8), 0x9a9488, 0, 0.12, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(0.32, 1.5, 0.32), PAL.stone, sx * 0.92, 1.2, sz * 0.92, g);
  mesh(new THREE.BoxGeometry(2.4, 0.24, 1.3), PAL.moss, 0, 2.05, -0.8, g);
  mesh(new THREE.BoxGeometry(2.5, 0.16, 1.4), 0x9a9488, 0, 2.22, -0.8, g);
  mesh(new THREE.BoxGeometry(0.36, 0.7, 0.3), PAL.stone, 0, 0.86, -0.6, g);
  mesh(new THREE.SphereGeometry(0.2, 6, 5), PAL.stone, 0, 1.32, -0.6, g);
  const crack = mesh(new THREE.BoxGeometry(1.6, 0.1, 0.32), 0x3a3630, 0, 0.56, 0.35, g, false);
  const repaired = mesh(new THREE.BoxGeometry(1.6, 0.15, 0.36), PAL.moss, 0, 0.56, 0.35, g, false);
  repaired.visible = false;
  g.position.set(x, groundAt(x, z) - 0.3, z);
  g.rotation.y = -0.5;
  parent.add(g);
  return { crack, repaired };
}

function dock(parent, x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) mesh(new THREE.BoxGeometry(1.7, 0.1, 0.42), i % 2 ? PAL.plank : PAL.wood, 0, 0.52, -2.0 + i * 0.45, g);
  for (const sx of [-0.7, 0.7]) for (const sz of [-2.0, -0.2, 1.6]) mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), PAL.trunk, sx, -0.1, sz, g);
  mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), PAL.trunk, -0.78, 0.75, -1.9, g);
  mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), PAL.trunk, 0.78, 0.75, -1.9, g);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

function furnace(parent, x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const m = mesh(new THREE.BoxGeometry(0.42, 0.3, 0.36), PAL.stone, Math.cos(a) * 0.42, 0.15, Math.sin(a) * 0.42, g);
    m.rotation.y = a;
  }
  mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), 0x9a9488, 0, 0.55, 0, g);
  mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.6, 7), PAL.stone, 0, 1.05, 0, g);
  const ember = mesh(new THREE.BoxGeometry(0.34, 0.24, 0.1), PAL.ember, 0, 0.4, 0.46, g, false);
  const emberLight = new THREE.PointLight(0xff9a4a, 0, 6, 2);
  emberLight.position.set(0, 0.6, 0.3);
  g.add(emberLight);
  g.position.set(x, groundAt(x, z) - 0.02, z);
  g.visible = false;
  parent.add(g);
  g.userData = { ember, emberLight };
  return g;
}

function boat(parent, x, z) {
  const g = new THREE.Group();
  g.userData.isBoat = true;
  mesh(new THREE.BoxGeometry(1.5, 0.36, 3.4), PAL.wood, 0, 0.3, 0, g);
  mesh(new THREE.BoxGeometry(1.1, 0.16, 2.9), 0x5b3f28, 0, 0.42, 0, g, false);
  const bow = mesh(new THREE.ConeGeometry(0.62, 1.0, 4), PAL.wood2, 0, 0.32, 1.85, g);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.scale.set(1, 1, 0.6);
  mesh(new THREE.BoxGeometry(1.5, 0.1, 0.14), PAL.wood2, 0, 0.5, -1.6, g, false);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.6, 6), PAL.trunk, 0, 1.7, 0.15, g);
  mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.6, 5), PAL.trunk, 0, 1.5, -0.9, g);
  const sail = mesh(new THREE.PlaneGeometry(1.5, 1.7), 0xf2e6cf, 0, 1.6, 0.2, g, false);
  sail.material.side = THREE.DoubleSide;
  sail.rotation.y = Math.PI / 2;
  const sail2 = mesh(new THREE.PlaneGeometry(1.1, 1.2), 0xe8d9bd, 0, 1.3, -1.0, g, false);
  sail2.material.side = THREE.DoubleSide;
  sail2.rotation.y = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), PAL.trunk2, 0, 2.9, 0.15, g, false);
  g.position.set(x, 0.02, z);
  g.visible = false;
  parent.add(g);
  return g;
}

// big sail boat for the voyage (player stands on deck)
function sailBoatMesh(parent) {
  const g = new THREE.Group();
  g.userData.isSailBoat = true;
  const hull = mesh(new THREE.BoxGeometry(2.2, 0.5, 4.6), PAL.wood, 0, 0.3, 0, g);
  mesh(new THREE.BoxGeometry(1.9, 0.14, 4.1), PAL.plank, 0, 0.58, 0, g, false);
  // bow
  const bow = mesh(new THREE.ConeGeometry(1.0, 1.6, 4), PAL.wood2, 0, 0.32, 2.7, g);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.scale.set(1, 1, 0.55);
  // railings
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), PAL.wood2, sx * 1.05, 0.82, -2 + i * 1.0, g, false);
    mesh(new THREE.BoxGeometry(0.07, 0.07, 4.2), PAL.wood2, sx * 1.05, 1.05, 0, g, false);
  }
  // mast + big sail
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.2, 8), PAL.trunk, 0, 3.0, -0.2, g);
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 6), PAL.trunk, 0, 4.4, 1.0, g, false);
  const sail = mesh(new THREE.PlaneGeometry(3.0, 3.4), 0xf4ead6, 0, 3.4, 0.9, g, false);
  sail.material.side = THREE.DoubleSide;
  sail.rotation.y = Math.PI / 2;
  // lantern at bow
  mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), 0xffd98a, 0, 1.1, 2.5, g, false);
  const lamp = new THREE.PointLight(0xffc46b, 1.2, 8, 2);
  lamp.position.set(0, 1.2, 2.5);
  g.add(lamp);
  // patch planks ready on deck
  for (let i = 0; i < 2; i++) mesh(new THREE.BoxGeometry(0.5, 0.06, 0.24), PAL.plank, -0.7 + i * 1.4, 0.65, -1.2, g, false);
  parent.add(g);
  return g;
}

function sharkMesh(parent) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mat(0x5b7f96));
  hull.scale.set(0.55, 0.6, 1.9);
  body.add(hull);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat(0xe8eef0));
  belly.scale.set(0.5, 0.45, 1.5);
  belly.position.y = -0.14;
  body.add(belly);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 4), mat(0x4b6d82));
  fin.position.set(0, 0.5, 0);
  fin.rotation.x = 0.2;
  body.add(fin);
  const tail = new THREE.Group();
  tail.position.z = -1.0;
  const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.9, 4), mat(0x4b6d82));
  tailFin.rotation.x = -Math.PI / 2;
  tail.add(tailFin);
  body.add(tail);
  group.add(body);
  group.scale.setScalar(1.1);
  parent.add(group);
  return { group, body, tail };
}
