import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const PAL = {
  sand: 0xe8c98a, wet: 0xcaa96e, water: 0x2f83b8,
  grass: 0x74a856, grass2: 0x5e9147, dirt: 0x9a7548,
  leaf: 0x35704a, leaf2: 0x498a55, leaf3: 0x2b5c3d,
  trunk: 0x6f4a34, trunk2: 0x87603f, stump: 0x9a7150,
  rock: 0x8b8d85, rock2: 0x74766f, stone: 0xbcb6a6, moss: 0x5f7f4a,
  wood: 0xb0854f, wood2: 0x94693c, plank: 0xc59a63,
  cloth: 0xc4685c, cloth2: 0x3d6f92, cloth3: 0xd8bd72,
  skin: 0xdca87e, skin2: 0xc78f66, hair: 0x2b211c, hair2: 0x5a3d28,
  roof: 0x8a4638, roof2: 0x6f362b, ember: 0xe6803f,
  shell: 0xf6efe2, flower: 0xd9586f, flower2: 0xe8d05a, cloud: 0xf3f6fa,
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

const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function mesh(geo, color, x, y, z, parent, cast = true) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------- terrain height ----------
// One continuous surface. No stacked coplanar plates, so nothing can z-fight.
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

export const WALK_MAX = 16.3; // beyond this the ground is under the waterline

// The jetty is a walkable platform over the water; everything else walks on terrain.
export const DOCK = { x: 0, z: 17.0, halfW: 0.85, z0: 14.9, z1: 18.8, top: 0.57 };

export function onDock(x, z) {
  return Math.abs(x - DOCK.x) <= DOCK.halfW && z >= DOCK.z0 && z <= DOCK.z1;
}

export function surfaceAt(x, z) {
  return onDock(x, z) ? Math.max(groundAt(x, z), DOCK.top) : groundAt(x, z);
}

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
    const r = 0.16 + (Math.abs(Math.sin(x * 3.7 + z * 2.1 + i * 1.4)) * 0.18);
    const ox = Math.cos(a) * 0.28;
    const oz = Math.sin(a) * 0.28;
    mesh(new THREE.DodecahedronGeometry(r, 0), i % 2 ? PAL.rock : PAL.rock2, ox, r * 0.45, oz, g, false);
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
  // log circle
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const l = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 6), PAL.trunk, Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18, g);
    l.rotation.z = Math.cos(a) * 0.6;
    l.rotation.x = Math.sin(a) * 0.6;
  }
  // embers
  mesh(new THREE.SphereGeometry(0.14, 5, 4), 0x4a2210, 0, 0.07, 0, g, false);
  // flame (cone)
  const flame = mesh(new THREE.ConeGeometry(0.09, 0.38, 5), 0xff7020, 0, 0.34, 0, g, false);
  flame.material.transparent = true;
  flame.material.opacity = 0.85;
  // inner flame
  const flame2 = mesh(new THREE.ConeGeometry(0.055, 0.25, 5), 0xffc040, 0, 0.4, 0, g, false);
  flame2.material.transparent = true;
  flame2.material.opacity = 0.75;
  // fire light
  const fl = new THREE.PointLight(0xff8830, 1.4, 7, 2);
  fl.position.set(0, 0.5, 0);
  g.add(fl);
  g.position.set(x, groundAt(x, z), z);
  parent.add(g);
  g.userData = { flame, flame2, fl };
  return g;
}



// ---------- static geometry merge ----------
// Collapses hundreds of one-off decor meshes into one draw call per colour.
// Skips anything that animates or toggles visibility, so runtime behaviour is untouched.
function mergeStatic(root, protectedRoots) {
  const skip = new Set();
  for (const o of protectedRoots) if (o && typeof o.traverse === "function") o.traverse((c) => skip.add(c));

  root.updateMatrixWorld(true);
  const buckets = new Map(); // colour -> BufferGeometry[]
  const doomed = [];
  root.traverse((o) => {
    if (!o.isMesh || skip.has(o)) return;
    const g = o.geometry;
    if (!g || !g.attributes || !g.attributes.position || g.attributes.position.isInterleavedBufferAttribute) return;
    if (g.attributes.position.count > 4000) return; // terrain / sea / big discs stay
    if (o.material.transparent || o.material.opacity < 1) return;
    const key = o.material.color.getHexString();
    let clone = g.clone();
    if (clone.index) clone = clone.toNonIndexed();
    // normalise attribute set so mergeGeometries accepts them together
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
    m.frustumCulled = false; // one big mesh spans the island
    root.add(m);
    merged += geos.length;
    used.add(hex);
  }
  // drop the originals that actually made it into a merged mesh
  for (const o of doomed) {
    const hex = o.material.color.getHexString();
    if (used.has(hex)) { o.parent && o.parent.remove(o); o.geometry.dispose(); }
  }
  return { merged };
}

export function createWorld(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // ---------- sky ----------
  const skyColor = new THREE.Color(SKY[4].top);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(SKY[4].fog, 28, 96);

  const sunLight = new THREE.DirectionalLight(SKY[4].sun, SKY[4].sunI);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = sc.bottom = -26;
  sc.right = sc.top = 26;
  sc.near = 1;
  sc.far = 150;
  sunLight.shadow.bias = -0.0012;
  scene.add(sunLight, sunLight.target);

  const hemi = new THREE.HemisphereLight(SKY[4].hemi, SKY[4].grd, SKY[4].hemiI);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xa8bcdc, 0);
  scene.add(ambient);

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

  // ---------- sea ----------
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshLambertMaterial({ color: PAL.water, flatShading: true }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.02;
  sea.receiveShadow = true;
  root.add(sea);

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
  const cDirt = new THREE.Color(PAL.dirt);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = Math.max(-1.8, groundAt(x, z));
    pos.setY(i, y);
    const n = Math.sin(x * 1.7) * Math.cos(z * 1.4) * 0.5 + 0.5;
    if (y < 0.22) c.copy(cWet);
    else if (y < 0.62) c.copy(cSand).lerp(cWet, Math.max(0, (0.42 - y) * 2));
    else if (y < 0.95) c.copy(cSand).lerp(cGrass, (y - 0.62) / 0.33);
    else c.copy(cGrass).lerp(cGrass2, n * 0.75);
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

  // shoreline foam rings
  const foams = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(16.0, 16.6, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.18;
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

  // ---------- small rock clusters ----------
  for (const [x, z] of [[3.8, -5.6], [-5.2, -2.2], [11.4, -3.4], [-12.4, -2.8], [2.2, 7.4], [-7.2, 7.6]]) {
    if (groundAt(x, z) > 0.55) rockCluster(root, x, z);
  }

  // ---------- flower patches ----------
  for (const [x, z] of [[-4.4, -5.2], [5.8, -4.6], [-8.4, 3.2], [6.6, 2.8], [1.2, 6.6], [-3.8, 6.2], [4.2, 10.8], [-5.6, 10.2]]) {
    if (groundAt(x, z) > 0.8) flowerPatch(root, x, z);
  }

  // ---------- vegetation ----------
  const trees = [];
  const treeSpots = [
    [-3.2, -8.4], [-6.4, -6.2], [-8.2, -2.6], [-9.4, 3.4], [-6.8, 6.2],
    [-2.4, 8.4], [1.8, 9.2], [5.4, 8.6], [8.8, 4.4], [10.2, -1.2],
    [6.2, -6.4], [2.2, -9.6], [-10.6, 0.2], [-1.2, 2.4],
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

  // corals just under the waterline
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
  addSolid(1.6, 8.6, 6.6);
  dock(root, 0, 17.0);

  const builds = {
    furnace: furnace(root, 4.4, -4.6),
    house: house(root, 8.5, -3.2),
    boat: boat(root, 0, 18.4),
  };
  addSolid(0.55, 4.4, -4.6);
  const houseSolid = addSolid(0, 8.5, -3.2);
  const boatSolid = addSolid(0, 0, 18.4);

  // ---------- campfire near Tamo ----------
  const fire = campfire(root, 1.2, -11.6);

  // ---------- npcs ----------
  const npcs = [
    { id: "tamo", name: "Tamo", x: 1.2, z: -13.4, yaw: 2.6, shirt: PAL.cloth3, pants: 0x6b5b3e, hair: PAL.hair2, hat: true },
    { id: "mira", name: "Mira", x: -7.9, z: 0.4, yaw: 1.4, shirt: PAL.cloth, pants: 0x4a4238, hair: PAL.hair, scarf: true },
    { id: "arin", name: "Arin", x: 7.6, z: 5.0, yaw: -2.2, shirt: PAL.cloth2, pants: 0x3c4a52, hair: PAL.hair, necklace: true },
  ].map((n) => {
    const g = doodle(root, n.x, n.z, n);
    const label = nameLabel(n.name);
    label.position.set(n.x, groundAt(n.x, n.z) + 1.62, n.z);
    root.add(label);
    return { ...n, mesh: g, label, parts: g.userData };
  });

  const player = doodle(root, 0, -15.2, { shirt: 0x3f6b52, pants: 0x2f3b46, hair: 0x241c18, yaw: 0 });

  const torch = new THREE.PointLight(0xffc98a, 0, 9, 2);
  root.add(torch);

  const lanterns = [
    lantern(root, -7.6, 1.0),
    lantern(root, 7.4, 6.2),
    lantern(root, -0.9, 15.6),
  ];

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
      sunLight.position.set(sx, sy, 24);
      sunDisc.position.set(sx * 1.5, sy * 1.5, 24 * 1.5);
      sunDisc.lookAt(0, 0, 0);
      sunDisc.visible = true;
      moonDisc.visible = false;
    } else {
      sunLight.position.set(-sx, Math.max(12, -sy), -24);
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
    sea.material.color.setHex(PAL.water).multiplyScalar(0.42 + 0.58 * (1 - nightK * 0.82));
    for (const f of foams) f.material.opacity = 0.06 + 0.16 * (1 - nightK * 0.6);
  }

  const now = () => performance.now() / 1000;

  function sync(sim) {
    const t = now();
    const py = surfaceAt(sim.x, sim.z);
    const bob = sim.moving ? Math.abs(Math.sin(sim.walk * 8)) * 0.055 : 0;
    player.position.set(sim.x, py + bob, sim.z);
    player.rotation.y = sim.yaw + Math.PI;
    animateHumanoid(player.userData, sim.moving ? sim.walk : 0, t);

    for (const tr of trees) {
      tr.canopy.visible = !tr.felled;
      tr.stump.visible = tr.felled;
    }
    for (const r of rocks) r.mesh.visible = !r.mined;
    for (const s of sands) s.mesh.visible = !s.taken;
    for (const s of shells) s.mesh.visible = !s.taken;
    altar.repaired.visible = sim.repaired;
    altar.crack.visible = !sim.repaired;
    builds.furnace.visible = sim.built.furnace;
    builds.house.visible = sim.built.house;
    builds.boat.visible = sim.built.boat && sim.sailing < 0.94;
    houseSolid.r = sim.built.house ? 1.9 : 0;
    boatSolid.r = 0; // boat sits at the jetty end; never block the walk-up

    // sway
    for (const p of palms) p.crown.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.035;
    for (const b of bushes) b.rotation.z = Math.sin(t * 1.1 + b.position.x) * 0.02;

    // smoke from the house chimney
    if (sim.built.house) {
      const smoke = builds.house.userData.smoke;
      for (let i = 0; i < smoke.length; i++) {
        const s = smoke[i];
        const k = ((t * 0.32 + i / smoke.length) % 1);
        s.position.y = 3.9 + k * 2.6;
        s.position.x = Math.sin(k * 6 + i) * 0.35;
        s.scale.setScalar(0.3 + k * 0.8);
        s.material.opacity = 0.42 * (1 - k);
      }
    }
    if (sim.built.furnace) {
      const fu = builds.furnace.userData;
      fu.ember.material.color.setHex(0xe6803f).multiplyScalar(0.7 + Math.abs(Math.sin(t * 6)) * 0.5);
      fu.emberLight.intensity = 1.1 + Math.sin(t * 6) * 0.35;
    }

    // boat leaving
    if (sim.sailing > 0) {
      const k = sim.sailing;
      const ease = k * k * (3 - 2 * k);
      builds.boat.position.z = 18.4 + ease * 34;
      builds.boat.position.x = Math.sin(ease * 2.2) * 1.4;
      builds.boat.position.y = 0.02 + Math.sin(t * 2.4) * 0.07;
      builds.boat.rotation.z = Math.sin(ease * 2.2 + 1) * 0.05 - ease * 0.02;
      builds.boat.rotation.x = -ease * 0.05;
    } else {
      builds.boat.position.set(0, 0.02 + Math.sin(t * 1.6) * 0.05, 18.4);
      builds.boat.rotation.z = Math.sin(t * 1.1) * 0.035;
      builds.boat.rotation.x = 0;
    }

    torch.position.set(sim.x, py + 1.9, sim.z);

    for (const n of npcs) {
      const d = Math.hypot(n.x - sim.x, n.z - sim.z);
      const look = d < 6 ? Math.atan2(sim.x - n.x, sim.z - n.z) : n.yaw;
      let dy = look - n.mesh.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      n.mesh.rotation.y += dy * 0.06;
      animateHumanoid(n.parts, 0, t + n.x);
      n.mesh.position.y = groundAt(n.x, n.z) + Math.sin(t * 0.9 + n.z) * 0.012;
      n.label.position.y = groundAt(n.x, n.z) + 1.66;
      n.label.material.opacity = d < 14 ? 1 : 0.45;
    }

    for (const cl of clouds) {
      cl.position.x += 0.012;
      if (cl.position.x > 70) cl.position.x = -70;
    }
    for (const b of birds) {
      const u = b.userData;
      u.a += u.sp * 0.016;
      b.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 2) * 0.6, Math.sin(u.a) * u.r);
      b.rotation.y = -u.a + Math.PI / 2;
      const flap = Math.sin(t * 6 + u.a * 3) * 0.5;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
    }
    for (const f of foams) {
      const k = ((t * 0.12 + f.userData.off) % 1);
      // no scale change – avoids z-fight with terrain at shoreline
      f.material.opacity = 0.08 + 0.14 * (1 - k) * (1 - nightK * 0.55);
    }
    if (fire) {
      const fk = Math.abs(Math.sin(t * 7.4));
      fire.userData.flame.scale.y = 0.82 + fk * 0.36;
      fire.userData.flame.scale.x = 0.88 + fk * 0.22;
      fire.userData.flame2.scale.y = 0.8 + fk * 0.3;
      fire.userData.fl.intensity = 1.1 + fk * 0.65 + nightK * 0.4;
    }
  }

  // ---------- collapse static decor into few draw calls ----------
  const keep = [
    ...trees, ...rocks, ...sands, ...shells,
    builds.furnace, builds.house, builds.boat,
    ...npcs.map((n) => n.mesh), ...npcs.map((n) => n.label),
    player, ...clouds, ...birds, ...foams,
    sunDisc, moonDisc, torch, ...(fire && fire.flame ? [fire.flame, fire.flame2] : []),
  ];
  const mergeStats = mergeStatic(root, keep);

  return {
    mergeStats,
    solids,
    trees,
    rocks,
    sands,
    shells,
    npcs,
    altar,
    boat: { x: 0, z: 18.4 },
    builds,
    housePos: { x: 8.5, z: -3.2 },
    player,
    setTime,
    sync,
    get night() {
      return nightK;
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
  return { x, z, felled: false, solid: col, canopy, stump };
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

// ---------- interactables ----------
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

// ---------- structures ----------
function hut(parent, x, z) {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(2.4, 1.4, 2.0), PAL.wood, 0, 0.9, 0, g);
  mesh(new THREE.BoxGeometry(2.5, 0.12, 2.1), PAL.wood2, 0, 1.62, 0, g);
  mesh(new THREE.ConeGeometry(2.0, 1.15, 4), PAL.roof, 0, 2.15, 0, g);
  mesh(new THREE.BoxGeometry(0.5, 0.85, 0.08), 0x4a3222, 0, 0.62, 1.02, g);
  mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), 0x2a2118, -0.72, 1.05, 1.02, g);
  // drying rack
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
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.32, 1.5, 0.32), PAL.stone, sx * 0.92, 1.2, sz * 0.92, g);
    }
  }
  mesh(new THREE.BoxGeometry(2.4, 0.24, 1.3), PAL.moss, 0, 2.05, -0.8, g);
  mesh(new THREE.BoxGeometry(2.5, 0.16, 1.4), 0x9a9488, 0, 2.22, -0.8, g);
  // idol
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
  for (let i = 0; i < 9; i++) {
    mesh(new THREE.BoxGeometry(1.7, 0.1, 0.42), i % 2 ? PAL.plank : PAL.wood, 0, 0.52, -2.0 + i * 0.45, g);
  }
  for (const sx of [-0.7, 0.7]) {
    for (const sz of [-2.0, -0.2, 1.6]) {
      mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), PAL.trunk, sx, -0.1, sz, g);
    }
  }
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

function house(parent, x, z) {
  const g = new THREE.Group();
  const W = 3.6;
  const D = 3.0;
  const floorY = 0.95;
  // stilts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 0, 1]) {
      mesh(new THREE.BoxGeometry(0.18, floorY + 0.4, 0.18), PAL.trunk2, sx * (W / 2 - 0.2), (floorY - 0.4) / 2, sz * (D / 2 - 0.2), g);
    }
  }
  // deck
  mesh(new THREE.BoxGeometry(W + 0.4, 0.16, D + 0.4), PAL.plank, 0, floorY, 0, g);
  for (let i = 0; i < 5; i++) {
    mesh(new THREE.BoxGeometry(W + 0.42, 0.02, 0.04), PAL.wood2, 0, floorY + 0.09, -D / 2 + 0.3 + i * (D / 2.4), g, false);
  }
  const wallY = floorY + 0.08 + 0.78;
  const wallH = 1.56;
  // back + sides
  mesh(new THREE.BoxGeometry(W, wallH, 0.14), PAL.wood, 0, wallY, -D / 2, g);
  mesh(new THREE.BoxGeometry(0.14, wallH, D), PAL.wood, -W / 2, wallY, 0, g);
  mesh(new THREE.BoxGeometry(0.14, wallH, D), PAL.wood, W / 2, wallY, 0, g);
  // front wall with door gap
  mesh(new THREE.BoxGeometry(1.25, wallH, 0.14), PAL.wood, -1.05, wallY, D / 2, g);
  mesh(new THREE.BoxGeometry(1.25, wallH, 0.14), PAL.wood, 1.05, wallY, D / 2, g);
  mesh(new THREE.BoxGeometry(0.95, 0.42, 0.14), PAL.wood, 0, wallY + 0.57, D / 2, g);
  // plank grooves
  for (let i = 0; i < 3; i++) {
    const yy = floorY + 0.36 + i * 0.46;
    mesh(new THREE.BoxGeometry(W + 0.02, 0.03, 0.02), PAL.wood2, 0, yy, D / 2 + 0.08, g, false);
    mesh(new THREE.BoxGeometry(0.02, 0.03, D + 0.02), PAL.wood2, W / 2 + 0.08, yy, 0, g, false);
  }
  // door
  mesh(new THREE.BoxGeometry(0.9, 1.1, 0.07), 0x53381f, 0, floorY + 0.63, D / 2 + 0.02, g);
  mesh(new THREE.SphereGeometry(0.045, 6, 5), 0xc8a24a, 0.33, floorY + 0.62, D / 2 + 0.07, g, false);
  // windows
  for (const sx of [-1.05, 1.05]) {
    mesh(new THREE.BoxGeometry(0.72, 0.62, 0.06), 0x241c16, sx, floorY + 0.95, D / 2 + 0.02, g, false);
    mesh(new THREE.BoxGeometry(0.82, 0.08, 0.1), PAL.wood2, sx, floorY + 1.28, D / 2 + 0.05, g);
    mesh(new THREE.BoxGeometry(0.82, 0.08, 0.1), PAL.wood2, sx, floorY + 0.62, D / 2 + 0.05, g);
    mesh(new THREE.BoxGeometry(0.08, 0.74, 0.1), PAL.wood2, sx - 0.4, floorY + 0.95, D / 2 + 0.05, g);
    mesh(new THREE.BoxGeometry(0.08, 0.74, 0.1), PAL.wood2, sx + 0.4, floorY + 0.95, D / 2 + 0.05, g);
    mesh(new THREE.BoxGeometry(0.04, 0.62, 0.04), PAL.wood2, sx, floorY + 0.95, D / 2 + 0.06, g, false);
  }
  // gable roof
  const roofY = floorY + 0.08 + wallH;
  for (const s of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(W + 0.7, 0.14, D * 0.72), PAL.roof, 0, roofY + 0.42, s * D * 0.28, g);
    r.rotation.x = s * 0.62;
  }
  mesh(new THREE.BoxGeometry(W + 0.74, 0.16, 0.2), PAL.roof2, 0, roofY + 0.86, 0, g);
  // gable ends
  for (const s of [-1, 1]) {
    const tri = new THREE.Shape();
    tri.moveTo(-W / 2, 0);
    tri.lineTo(W / 2, 0);
    tri.lineTo(0, 0.86);
    tri.lineTo(-W / 2, 0);
    const geo = new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mat(PAL.wood2));
    m.position.set(0, roofY + 0.02, s * D * 0.5);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  // chimney + smoke
  mesh(new THREE.BoxGeometry(0.38, 1.1, 0.38), 0x8f8578, 1.15, roofY + 0.75, -0.7, g);
  const smoke = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: 0xd8dce2, transparent: true, opacity: 0.4, depthWrite: false }));
    s.position.set(1.15, 3.9, -0.7);
    g.add(s);
    smoke.push(s);
  }
  // porch + railing
  mesh(new THREE.BoxGeometry(W + 0.4, 0.14, 1.1), PAL.plank, 0, floorY, D / 2 + 0.72, g);
  for (const sx of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), PAL.wood2, sx * (W / 2 - 0.05), floorY + 0.4, D / 2 + 1.2, g);
  }
  mesh(new THREE.BoxGeometry(W + 0.1, 0.08, 0.08), PAL.wood2, 0, floorY + 0.68, D / 2 + 1.2, g);
  // stairs
  for (let i = 0; i < 4; i++) {
    mesh(new THREE.BoxGeometry(0.95, 0.1, 0.34), PAL.wood2, 0, floorY - 0.16 - i * 0.24, D / 2 + 1.35 + i * 0.3, g);
  }
  // clothesline
  mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), PAL.trunk, -W / 2 - 0.55, floorY + 0.7, -0.2, g);
  mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), PAL.trunk, W / 2 + 0.55, floorY + 0.7, -0.2, g);
  mesh(new THREE.BoxGeometry(W + 1.1, 0.03, 0.03), 0x6b5a44, 0, floorY + 1.35, -0.2, g, false);
  mesh(new THREE.BoxGeometry(0.55, 0.7, 0.03), PAL.cloth, -0.7, floorY + 1.0, -0.2, g, false);
  mesh(new THREE.BoxGeometry(0.5, 0.6, 0.03), PAL.cloth2, 0.75, floorY + 1.05, -0.2, g, false);
  mesh(new THREE.BoxGeometry(0.42, 0.55, 0.03), PAL.cloth3, 0.08, floorY + 1.02, -0.2, g, false);
  // rain barrel
  mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.62, 8), PAL.trunk2, -W / 2 + 0.15, floorY + 0.31, D / 2 + 0.35, g, false);
  mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 8), PAL.wood2, -W / 2 + 0.15, floorY + 0.65, D / 2 + 0.35, g, false);
  // flower box under window
  for (const sx of [-1.05, 1.05]) {
    mesh(new THREE.BoxGeometry(0.78, 0.14, 0.22), PAL.trunk2, sx, floorY + 0.62, D / 2 + 0.12, g, false);
    mesh(new THREE.SphereGeometry(0.065, 5, 4), 0xe05a5a, sx - 0.2, floorY + 0.78, D / 2 + 0.12, g, false);
    mesh(new THREE.SphereGeometry(0.065, 5, 4), 0xf4c84a, sx + 0.2, floorY + 0.78, D / 2 + 0.12, g, false);
  }
  // wooden sign above door
  mesh(new THREE.BoxGeometry(0.7, 0.28, 0.06), PAL.trunk2, 0, wallY + wallH * 0.5 + 0.08, D / 2 + 0.12, g, false);
  mesh(new THREE.BoxGeometry(0.56, 0.04, 0.04), PAL.wood2, 0, wallY + wallH * 0.5 + 0.22, D / 2 + 0.14, g, false);

  g.position.set(x, groundAt(x, z) - 0.22, z);
  g.rotation.y = -0.38;
  g.visible = false;
  parent.add(g);
  g.userData = { smoke };
  return g;
}

function boat(parent, x, z) {
  const g = new THREE.Group();
  g.userData.isBoat = true;
  const hull = mesh(new THREE.BoxGeometry(1.5, 0.36, 3.4), PAL.wood, 0, 0.3, 0, g);
  hull.scale.set(1, 1, 1);
  mesh(new THREE.BoxGeometry(1.1, 0.16, 2.9), 0x5b3f28, 0, 0.42, 0, g, false);
  // bow taper
  const bow = mesh(new THREE.ConeGeometry(0.62, 1.0, 4), PAL.wood2, 0, 0.32, 1.85, g);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.scale.set(1, 1, 0.6);
  mesh(new THREE.BoxGeometry(1.5, 0.1, 0.14), PAL.wood2, 0, 0.5, -1.6, g, false);
  // mast + sail
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

// ---------- doodle characters ----------
// Flat doodle-art look: 4 shapes per character, one ink outline each.
// head sphere + capsule body + 2 stick legs + 2 stick arms + 2 dot eyes.
const INK = 0x201a12;
const OUTLINE_T = 0.02;

function inkHull(geo, r) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  m.scale.setScalar(1 + (2 * OUTLINE_T) / (r * 2));
  return m;
}

// one solid part + its outline
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

function doodle(parent, x, z, o) {
  const g = new THREE.Group();
  const bodyCol = o.shirt ?? 0x4a8c52;
  const legCol = o.pants ?? 0x2a3b4c;
  const SKIN = 0xf6dcb0;

  // legs — two short stubs
  const legs = new THREE.Group();
  for (const sx of [-1, 1]) {
    part(legs, new THREE.CapsuleGeometry(0.075, 0.24, 3, 6), legCol, 0.075, sx * 0.11, 0.20, 0);
  }
  g.add(legs);

  // body — short fat capsule
  const body = new THREE.Group();
  part(body, new THREE.CapsuleGeometry(0.23, 0.22, 3, 8), bodyCol, 0.23, 0, 0.66, 0);

  // arms — two short sticks
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    part(arm, new THREE.CapsuleGeometry(0.055, 0.22, 3, 6), bodyCol, 0.055, 0, -0.14, 0);
    arm.position.set(sx * 0.26, 0.80, 0);
    body.add(arm);
    arms.push(arm);
  }

  // head — big blank ball, no face
  const head = new THREE.Group();
  head.position.y = 0.92;
  part(head, new THREE.SphereGeometry(0.36, 14, 12), SKIN, 0.36, 0, 0.14, 0);
  if (o.hat) {
    part(head, new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), 0xd8bc6c, 0.46, 0, 0.40, 0);
    part(head, new THREE.CylinderGeometry(0.2, 0.22, 0.16, 10), 0xd8bc6c, 0.22, 0, 0.48, 0);
  }
  if (o.scarf) {
    part(body, new THREE.TorusGeometry(0.19, 0.055, 5, 12), bodyCol, 0.19, 0, 0.90, 0);
  }
  if (o.necklace) {
    part(body, new THREE.TorusGeometry(0.13, 0.03, 4, 10), 0xd4a837, 0.13, 0, 0.85, 0.05);
  }

  body.add(head);
  g.add(body);
  g.userData = { legs, body, arms, head };
  g.position.set(x, groundAt(x, z), z);
  g.rotation.y = o.yaw ?? 0;
  g.scale.setScalar(1);
  parent.add(g);
  return g;
}

function animateHumanoid(p, walk, t) {
  if (!p || !p.arms) return;
  const sw = walk ? Math.sin(walk * 8) : 0;
  p.arms[0].rotation.x = sw * 0.75;
  p.arms[1].rotation.x = -sw * 0.75;
  p.legs.children[0].rotation.x = -sw * 0.7;
  p.legs.children[1].rotation.x = sw * 0.7;
  p.head.rotation.y = Math.sin(t * 0.7) * 0.14;
  p.body.position.y = Math.sin(t * 1.8) * 0.014;
}

function nameLabel(text) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 72;
  const g2 = cv.getContext("2d");
  g2.fillStyle = "rgba(12,18,28,0.7)";
  const w = 176;
  const h = 44;
  const r = 12;
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
  g2.font = "600 30px Segoe UI, system-ui, sans-serif";
  g2.textAlign = "center";
  g2.textBaseline = "middle";
  g2.fillStyle = "#f4efe4";
  g2.fillText(text, 128, y0 + h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  spr.scale.set(1.5, 0.42, 1);
  spr.renderOrder = 5;
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
