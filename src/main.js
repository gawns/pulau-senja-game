import * as THREE from "three";
import { createWorld, groundAt, surfaceAt } from "./world.js";
import { createSim } from "./sim.js";
import { ACHIEVEMENTS, INTRO, NEED } from "./content.js";

const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 460);

const world = createWorld(scene);
const sim = createSim(world);
const keys = new Set();

const $ = (id) => document.getElementById(id);
const promptEl = $("prompt");
const toastEl = $("toast");
const dialogEl = $("dialog");
const craftEl = $("craft");
const endEl = $("end");
const menuEl = $("menu");
const introEl = $("intro");
const achEl = $("ach");
const achList = $("ach-list");
const isTouch = matchMedia("(pointer: coarse)").matches;
let toastUntil = 0;

// ---------- intro ----------
$("intro-kicker").textContent = INTRO.kicker;
$("intro-title").textContent = INTRO.title;
$("intro-body").innerHTML = INTRO.lines.map((l) => `<p>${l}</p>`).join("");
document.body.dataset.ready = "1";

function begin() {
  introEl.hidden = true;
  sim.started = true;
  sim.paused = false;
  if (!isTouch) lock();
}
$("intro-go").onclick = begin;

// ---------- pointer lock / camera look ----------
function lock() {
  if (!sim.started || sim.dialog || sim.craftOpen || sim.paused || sim.ended || isTouch) return;
  const p = canvas.requestPointerLock();
  if (p && p.catch) p.catch(() => {});
}

addEventListener("keydown", (e) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
    if (sim.started && !sim.paused && !sim.dialog) keys.add(e.code);
    e.preventDefault();
  }
  if (e.code === "KeyE" && sim.started && !sim.paused && !sim.dialog && !sim.craftOpen && !sim.ended) sim.interact();
  if (e.code === "KeyC" && sim.started && !sim.dialog && !sim.ended && !sim.paused) {
    sim.craftOpen = !sim.craftOpen;
    if (sim.craftOpen && document.pointerLockElement) document.exitPointerLock();
    else if (!sim.craftOpen) lock();
  }
  if (e.code === "KeyT" && sim.started && !sim.paused) sim.skipTime();
  if (e.code === "Escape") {
    if (sim.craftOpen) {
      sim.craftOpen = false;
      lock();
    } else if (document.pointerLockElement) document.exitPointerLock();
    else if (sim.started && !sim.dialog && !sim.ended) {
      sim.paused = true;
      menuEl.hidden = false;
    }
  }
  if ((e.code === "Enter" || e.code === "Space") && sim.dialog) {
    e.preventDefault();
    nextLine();
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

canvas.addEventListener("click", () => {
  if (!sim.started || sim.dialog || sim.craftOpen || sim.paused || sim.ended) return;
  if (!isTouch && !document.pointerLockElement) lock();
});
document.addEventListener("pointerlockchange", () => {
  sim.lookLocked = document.pointerLockElement === canvas;
});
addEventListener("mousemove", (e) => {
  if (!sim.lookLocked || sim.craftOpen || sim.dialog) return;
  sim.yaw -= e.movementX * 0.0024;
  sim.pitch = Math.max(-0.4, Math.min(0.8, sim.pitch + e.movementY * 0.0018));
});

// ---------- dialog ----------
function nextLine() {
  sim.advanceDialog();
  if (!sim.dialog) lock();
}
$("dialog-next").onclick = nextLine;

// ---------- craft ----------
$("craft-close").onclick = () => {
  sim.craftOpen = false;
  lock();
};
for (const btn of document.querySelectorAll("[data-craft]")) {
  btn.onclick = () => {
    sim.craft(btn.dataset.craft);
  };
}
$("again").onclick = () => location.reload();
$("start").onclick = () => {
  menuEl.hidden = true;
  sim.paused = false;
  sim.started = true;
  lock();
};

// ---------- resize ----------
function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// ---------- touch ----------
const touchEl = $("touch");
if (isTouch) {
  for (const btn of document.querySelectorAll("[data-key]")) {
    const code = btn.dataset.key;
    const on = (e) => { e.preventDefault(); keys.add(code); };
    const off = (e) => { e.preventDefault(); keys.delete(code); };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("pointerleave", off);
  }
  for (const btn of document.querySelectorAll("[data-act]")) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!sim.started || sim.paused) return;
      const a = btn.dataset.act;
      if (a === "e") {
        if (sim.dialog) nextLine();
        else if (!sim.craftOpen) sim.interact();
      }
      if (a === "c" && !sim.dialog) sim.craftOpen = !sim.craftOpen;
      if (a === "t") sim.skipTime();
    });
  }
  let lastX = null;
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" || !sim.started || sim.dialog || sim.craftOpen) return;
    if (lastX !== null) sim.yaw -= (e.clientX - lastX) * 0.006;
    lastX = e.clientX;
  });
  canvas.addEventListener("pointerup", () => { lastX = null; });
  canvas.addEventListener("pointercancel", () => { lastX = null; });
}

// ---------- achievements ----------
const achCards = [];
function showAch(id) {
  const a = ACHIEVEMENTS[id];
  if (!a) return;
  const el = document.createElement("div");
  el.className = "ach-card";
  el.innerHTML = `<span class="ach-icon">${a.icon}</span><div><b>${a.title}</b><small>${a.desc}</small></div>`;
  achList.appendChild(el);
  achCards.push(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => {
    el.classList.remove("in");
    setTimeout(() => el.remove(), 400);
  }, 5200);
  while (achList.children.length > 3) achList.firstChild.remove();
}

// ---------- HUD ----------
const DOT_MAX = 8;
function paint() {
  const q = sim.questView();
  $("quest-kicker").textContent = q.kicker;
  $("quest-title").textContent = q.title;
  $("quest-detail").textContent = q.detail;
  const bar = $("quest-bar");
  bar.hidden = !q.showBar;
  bar.firstElementChild.style.width = `${Math.round(q.pct * 100)}%`;

  const c = sim.clock();
  $("clock").textContent = `Hari ${sim.day} · ${c.text} · ${c.phase}`;
  const bags = [["log", "Kayu"], ["plank", "Papan"], ["sand", "Pasir"], ["stone", "Batu"], ["shell", "Kerang"]];
  $("bag").textContent = bags.map(([k, n]) => `${n} ${sim.inv[k]}`).join("   ");
  $("side").textContent = sim.sideView();

  const prompt = sim.promptText();
  promptEl.hidden = !prompt;
  if (prompt) promptEl.textContent = prompt;

  dialogEl.hidden = !sim.dialog;
  if (sim.dialog) {
    const npc = world.npcs.find((n) => n.id === sim.dialog.id);
    $("dialog-name").textContent = sim.dialog.name;
    $("dialog-text").textContent = sim.dialog.line;
    $("dialog-next").textContent = sim.dialog.last ? "Tutup" : "Lanjut ▸";
    const p = $("dialog-portrait");
    p.textContent = sim.dialog.name[0];
    p.style.background = npc ? `#${npc.shirt.toString(16).padStart(6, "0")}` : "#3d6f92";
    const prog = sim.dialogProgress();
    const dots = $("dialog-dots");
    if (dots.childElementCount !== prog.n) {
      dots.innerHTML = Array.from({ length: prog.n }, () => "<i></i>").join("");
    }
    [...dots.children].forEach((d, i) => d.classList.toggle("on", i < prog.i));
  }

  craftEl.hidden = !sim.craftOpen;
  for (const btn of document.querySelectorAll("[data-craft]")) {
    btn.disabled = !sim.canCraft(btn.dataset.craft);
  }
  endEl.hidden = !sim.ended;
  if (sim.ended) {
    $("end-stats").textContent = `Pencapaian ${sim.achCount}/${Object.keys(ACHIEVEMENTS).length} · Hari ${sim.day} · ${sim.clock().text}`;
  }
  achEl.hidden = sim.achCount === 0;
  $("ach-count").textContent = `Pencapaian ${sim.achCount}/${Object.keys(ACHIEVEMENTS).length}`;
  touchEl.hidden = !(isTouch && sim.started && !sim.paused && !sim.ended);

  for (const id of sim.takeAchievements()) showAch(id);

  const note = sim.takeToast();
  if (note) {
    toastEl.hidden = false;
    toastEl.textContent = note;
    toastUntil = performance.now() + 1700;
  }
  if (!toastEl.hidden && performance.now() > toastUntil) toastEl.hidden = true;
}

// ---------- camera ----------
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const wantPos = new THREE.Vector3();
const wantAim = new THREE.Vector3();
let camInit = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (sim.started && !sim.paused) sim.step(dt, keys);
  world.setTime(sim.hour);
  world.sync(sim);

  const ground = surfaceAt(sim.x, sim.z);
  if (sim.dialog && sim.focus) {
    // zoom in on the speaker, over the shoulder
    const npc = sim.focus;
    const ang = Math.atan2(npc.x - sim.x, npc.z - sim.z);
    wantAim.set(npc.x, surfaceAt(npc.x, npc.z) + 1.10, npc.z);
    wantPos.set(
      npc.x - Math.sin(ang) * 2.05 + Math.cos(ang) * 0.75,
      surfaceAt(npc.x, npc.z) + 1.24,
      npc.z - Math.cos(ang) * 2.05 - Math.sin(ang) * 0.75
    );
    camera.position.lerp(wantPos, 1 - Math.pow(0.0008, dt));
    camAim.lerp(wantAim, 1 - Math.pow(0.0008, dt));
    camera.lookAt(camAim);
  } else {
    const dist = 6.4;
    const back = new THREE.Vector3(Math.sin(sim.yaw), 0, Math.cos(sim.yaw));
    wantAim.set(sim.x + (sim.moving ? Math.sin(sim.yaw) * 0.35 : 0), ground + 1.05, sim.z + (sim.moving ? Math.cos(sim.yaw) * 0.35 : 0));
    wantPos.set(
      sim.x - back.x * dist,
      Math.max(ground + 0.7, ground + 1.7 + sim.pitch * 4.4),
      sim.z - back.z * dist
    );
    if (!camInit) {
      camera.position.copy(wantPos);
      camAim.copy(wantAim);
      camInit = true;
    }
    camera.position.lerp(wantPos, 1 - Math.pow(0.0015, dt));
    camAim.lerp(wantAim, 1 - Math.pow(0.0005, dt));
    camera.lookAt(camAim);
  }

  renderer.render(scene, camera);
  paint();
  requestAnimationFrame(frame);
}
let last = performance.now();
requestAnimationFrame(frame);

window.__senja = { sim, world, scene, camera, renderer, THREE };
