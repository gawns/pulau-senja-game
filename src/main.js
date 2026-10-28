import * as THREE from "three";
import "@fontsource/baloo-2/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import { createWorld, surfaceAt } from "./world.js";
import { createSim } from "./sim.js";
import { createNav } from "./nav.js";
import { ACHIEVEMENTS, INTRO } from "./content.js";
import { audio } from "./audio.js";

const params = new URLSearchParams(location.search);
// ?lowfx=1 is a QA affordance: software renderers (headless CI) can't hold 60fps
// with shadows on, and the walkthrough times real key presses.
const LOWFX = params.get("lowfx") === "1";
const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOWFX, powerPreference: "high-performance" });
renderer.setPixelRatio(LOWFX ? 0.6 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !LOWFX;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 460);

const world = createWorld(scene);
const sim = createSim(world);
const nav = createNav((x, z, r) => sim.blocked(x, z, r), 0.3);
world.setNav(nav);
world.nav = nav;
const keys = new Set();

const $ = (id) => document.getElementById(id);
const promptEl = $("prompt");
const toastEl = $("toast");
const dialogEl = $("dialog");
const craftEl = $("craft");
const cardEl = $("card");
const sleepEl = $("sleep");
const endEl = $("end");
const menuEl = $("menu");
const introEl = $("intro");
const achEl = $("ach");
const achList = $("ach-list");
const cutbar = $("cutbar");
const isTouch = matchMedia("(pointer: coarse)").matches;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let toastUntil = 0;
let startedAudio = false;

// ---------- intro ----------
$("intro-kicker").textContent = INTRO.kicker;
$("intro-title").textContent = INTRO.title;
$("intro-body").innerHTML = INTRO.lines.map((l) => `<p>${l}</p>`).join("");
document.body.dataset.ready = "1";

function begin() {
  introEl.hidden = true;
  sim.started = true;
  sim.paused = false;
  if (!startedAudio) {
    audio.start();
    startedAudio = true;
  }
  if (!isTouch) lock();
}
$("intro-go").onclick = begin;

// first input anywhere starts audio (autoplay rule)
addEventListener("pointerdown", () => { if (!startedAudio) { audio.start(); startedAudio = true; } }, { once: true });
addEventListener("keydown", () => { if (!startedAudio) { audio.start(); startedAudio = true; } }, { once: true });

// ---------- pointer lock / camera look ----------
function lock() {
  if (!sim.started || sim.dialog || sim.craftOpen || sim.paused || sim.ended || isTouch || sim.cut) return;
  const p = canvas.requestPointerLock();
  if (p && p.catch) p.catch(() => {});
}

addEventListener("keydown", (e) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    if (sim.started && !sim.paused && !sim.dialog && !sim.craftOpen) keys.add(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
  }
  if (e.code === "KeyE" && sim.started && !sim.paused && !sim.dialog && !sim.craftOpen && !sim.ended) {
    if (sim.phase === "patch") sim.holdE = true;
    else sim.interact();
  }
  if (e.code === "KeyC" && sim.started && !sim.dialog && !sim.ended && !sim.paused && (sim.phase === "island" || sim.phase === "cut1")) {
    sim.craftOpen = !sim.craftOpen;
    audio.sfx(sim.craftOpen ? "open" : "click");
    if (sim.craftOpen && document.pointerLockElement) document.exitPointerLock();
    else if (!sim.craftOpen) lock();
  }
  if (e.code === "F3") {
    e.preventDefault();
    world.toggleDebug();
  }
  if (e.code === "KeyM") {
    const m = audio.toggleMute();
    sim.toast = m ? "Suara dibisukan" : "Suara dinyalakan";
  }
  if (e.code === "Escape") {
    if (sim.cut) {
      sim.cut.skipped = true;
      return;
    }
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
  if (sim.craftOpen && (e.code === "Enter" || e.code === "Space")) {
    e.preventDefault();
    const r = craftSelected();
    if (r) { sim.craft(r.id); paintCraft(); }
  }
  if (sim.craftOpen && (e.code === "ArrowRight" || e.code === "KeyD")) {
    craftSel = (craftSel + 1) % Math.max(1, craftList().length);
    paintCraft();
  }
  if (sim.craftOpen && (e.code === "ArrowLeft" || e.code === "KeyA")) {
    craftSel = (craftSel - 1 + craftList().length) % Math.max(1, craftList().length);
    paintCraft();
  }
});
addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyE") sim.holdE = false;
});
addEventListener("blur", () => { keys.clear(); sim.holdE = false; });

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
let craftSel = 0;
let craftTab = "Rumah";
// the grid only shows the active tab, so selection must be resolved against the
// filtered list — indexing recipes() directly would craft the wrong item
const craftList = () => sim.recipes().filter((r) => r.tab === craftTab);
const craftSelected = () => craftList()[craftSel];
$("craft-close").onclick = () => {
  sim.craftOpen = false;
  audio.sfx("click");
  lock();
};
$("craft-chip").onclick = () => {
  if (!sim.started || sim.dialog || sim.ended) return;
  sim.craftOpen = !sim.craftOpen;
  audio.sfx(sim.craftOpen ? "open" : "click");
};
$("craft-make").onclick = () => {
  const r = craftSelected();
  if (r) { sim.craft(r.id); paintCraft(); }
};
$("again").onclick = () => location.reload();
$("start").onclick = () => {
  menuEl.hidden = true;
  sim.paused = false;
  sim.started = true;
  lock();
};
$("vol").oninput = (e) => audio.setVolume(+e.target.value);

function paintCraft() {
  const recs = sim.recipes();
  const tabs = [...new Set(recs.map((r) => r.tab))];
  const tabsEl = $("craft-tabs");
  if (tabsEl.dataset.tabs !== tabs.join(",")) {
    tabsEl.dataset.tabs = tabs.join(",");
    tabsEl.innerHTML = tabs.map((t) => `<button type="button" role="tab" data-tab="${t}">${t}</button>`).join("");
    for (const b of tabsEl.querySelectorAll("button")) {
      b.onclick = () => { craftTab = b.dataset.tab; craftSel = 0; paintCraft(); };
    }
  }
  for (const b of tabsEl.querySelectorAll("button")) {
    b.classList.toggle("on", b.dataset.tab === craftTab);
    b.setAttribute("aria-selected", b.dataset.tab === craftTab ? "true" : "false");
  }
  const list = craftList();
  if (craftSel >= list.length) craftSel = 0;
  const grid = $("craft-grid");
  // paintCraft() is called from the render loop; rebuilding the grid every frame
  // would detach nodes under the cursor (and break clicks). Only re-render when
  // the visible content actually changes.
  const key = `${craftTab}|${craftSel}|${JSON.stringify(sim.inv)}|${sim.ended}`;
  if (grid.dataset.k !== key) {
    grid.dataset.k = key;
    grid.innerHTML = "";
    list.forEach((r, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "recipe";
      btn.dataset.recipe = r.id;
      btn.classList.toggle("sel", i === craftSel);
      btn.classList.toggle("dim", !sim.canCraft(r.id));
      const cost = Object.entries(r.cost).map(([k, v]) => {
        const have = sim.inv[k] || 0;
        const names = { log: "🪵", plank: "🪚", sand: "⏳", stone: "🪨", shell: "🐚" };
        return `<span class="${have >= v ? "ok" : "no"}">${names[k] || k} ${have}/${v}</span>`;
      }).join(" ");
      btn.innerHTML = `<span class="ricon">${r.icon}</span><b>${r.name}</b><small>${cost}</small>${r.forQuest ? '<em>Untuk quest</em>' : ""}`;
      btn.onclick = () => { craftSel = i; paintCraft(); };
      btn.ondblclick = () => { sim.craft(r.id); paintCraft(); };
      grid.appendChild(btn);
    });
  }
  const sel = list[craftSel];
  $("craft-desc").textContent = sel
    ? sim.canCraft(sel.id)
      ? `${sel.name} · ${sel.desc}`
      : `${sel.name} · ${sim.missingFor(sel.id)}`
    : "Belum ada resep. Tebang pohon dulu untuk membuka resep pertama.";
  $("craft-make").disabled = !sel || !sim.canCraft(sel.id);
}

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
        else if (!sim.craftOpen) {
          if (sim.phase === "patch") sim.holdE = true;
          else sim.interact();
        }
      }
      if (a === "c" && !sim.dialog) sim.craftOpen = !sim.craftOpen;
    });
    btn.addEventListener("pointerup", () => { if (btn.dataset.act === "e") sim.holdE = false; });
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
function showAch(id) {
  const a = ACHIEVEMENTS[id];
  if (!a) return;
  const el = document.createElement("div");
  el.className = "ach-card";
  el.innerHTML = `<span class="ach-icon">${a.icon}</span><div><b>${a.title}</b><small>${a.desc}</small></div>`;
  achList.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => {
    el.classList.remove("in");
    setTimeout(() => el.remove(), 400);
  }, 5200);
  while (achList.children.length > 3) achList.firstChild.remove();
}

// ---------- HUD ----------
const NAMES = [["log", "🪵"], ["plank", "🪚"], ["sand", "⏳"], ["stone", "🪨"], ["shell", "🐚"]];
let lastInv = null;
let foldQuest = false;
$("quest-fold").onclick = () => {
  foldQuest = !foldQuest;
  $("quest").classList.toggle("folded", foldQuest);
  $("quest-fold").textContent = foldQuest ? "▸" : "▾";
};

function paint() {
  const q = sim.questView();
  $("quest-kicker").textContent = q.kicker;
  $("quest-title").textContent = q.title;
  $("quest-detail").textContent = q.detail;
  const bar = $("quest-bar");
  bar.hidden = !q.showBar;
  if (q.showBar) bar.firstElementChild.style.width = `${Math.round(q.pct * 100)}%`;
  const dots = $("quest-dots");
  if (dots.dataset.n !== String(q.dots)) {
    dots.dataset.n = String(q.dots);
    dots.innerHTML = Array.from({ length: q.dots }, () => "<i></i>").join("");
  }
  [...dots.children].forEach((d, i) => {
    d.classList.toggle("done", i < q.step);
    d.classList.toggle("on", i === q.step && sim.quest !== "done");
  });

  const side = sim.sideView();
  const sideEl = $("side");
  const key = JSON.stringify(side);
  if (sideEl.dataset.k !== key) {
    sideEl.dataset.k = key;
    sideEl.innerHTML = side
      .map((s) => {
        const npc = world.npcs.find((n) => n.id === s.who);
        const col = npc ? `#${npc.shirt.toString(16).padStart(6, "0")}` : "#3DB5A8";
        const initials = s.who === "arin" ? "A" : "T";
        return `<div class="side-row"><span class="avatar" style="background:${col}">${initials}</span><span>${s.text}</span></div>`;
      })
      .join("");
  }

  const c = sim.clock();
  $("clock-day").textContent = `Hari ${sim.day}`;
  $("clock-time").textContent = `${c.text} ${c.phase}`;
  $("clock-icon").textContent = c.isNight ? "🌙" : c.hour < 7 || c.hour > 17.5 ? "🌇" : "☀";
  $("clock-sun").style.left = `${Math.round((sim.hour / 24) * 100)}%`;

  const bag = $("bag");
  const invKey = NAMES.map(([k]) => sim.inv[k]).join(",");
  if (lastInv !== invKey) {
    lastInv = invKey;
    bag.innerHTML = NAMES.map(([k, icon]) => {
      const ring = (sim.quest === "chop" && k === "log") || (sim.quest === "house" && k === "log") ? " need" : "";
      return `<span class="chip${ring}"><i>${icon}</i><b>${sim.inv[k]}</b></span>`;
    }).join("");
  }

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
    const dots2 = $("dialog-dots");
    if (dots2.childElementCount !== prog.n) {
      dots2.innerHTML = Array.from({ length: prog.n }, () => "<i></i>").join("");
    }
    [...dots2.children].forEach((d, i) => d.classList.toggle("on", i < prog.i));
  }

  craftEl.hidden = !sim.craftOpen;
  if (sim.craftOpen) paintCraft();
  $("craft-chip").hidden = sim.ended || sim.dialog || sim.phase !== "island" && sim.phase !== "cut1";
  $("craft-chip").classList.toggle("on", sim.craftOpen);

  // cutscene progress bar
  cutbar.hidden = !sim.cut;
  if (sim.cut) {
    const label = sim.cut.kind === "gift" ? "Hadiah Tamo" : sim.cut.kind === "city" ? "Tiba di kota" : "Cutscene";
    $("cut-label").textContent = `${label} · tahan Esc untuk lewati`;
    $("cut-fill").style.width = `${Math.round((sim.cut.t / sim.cut.dur) * 100)}%`;
  }

  // card after cutscene 1
  cardEl.hidden = sim.phase !== "card";
  if (sim.phase === "card") {
    $("card-kicker").textContent = "Pulau Senja selesai";
    $("card-title").textContent = "Rumah berdiri, perahu siap";
    $("card-body").textContent = "Tamo memberikan perahunya. Kau bisa mulai dari awal, atau lanjut menjelajah laut.";
    $("card-stats").textContent = `Hari ${sim.day} · ${sim._chopped} pohon · rumah ${sim.houseStage}/8 · ${sim.catsPet} kucing diusap`;
    if (!$("card-actions").dataset.ready) {
      $("card-actions").dataset.ready = "1";
      $("card-actions").innerHTML = `<button id="card-again" type="button">Mulai lagi</button><button id="card-sail" type="button">Lanjut menjelajah</button>`;
      $("card-again").onclick = () => location.reload();
      $("card-sail").onclick = () => {
        $("card-actions").dataset.ready = "";
        sim.beginSail();
        lock();
      };
    }
  }

  // sleep card
  sleepEl.hidden = !sim.sleeping;
  if (sim.sleeping) {
    sleepEl.style.opacity = String(sim.sleepFade);
    const sc = sim.sleepCard;
    $("sleep-title").textContent = sc ? `Hari ${sim.day} · 06:00 Pagi` : "Menutup mata…";
    $("sleep-stats").textContent = sc ? `Pohon ditebang ${sc.log} · rumah ${sc.stage}/8 · kucing diusap ${sc.cats}` : "zZz";
  }

  endEl.hidden = !(sim.ended && !sim.cut);
  if (sim.ended) {
    $("end-stats").textContent = `Hari ${sim.day} · ${sim._chopped} pohon · rumah ${sim.houseStage}/8 · ${sim.catsPet} kucing · ${sim.patches.filter(Boolean).length} lubang ditambal`;
  }
  achEl.hidden = sim.achCount === 0;
  $("ach-count").textContent = `${sim.achCount}/${Object.keys(ACHIEVEMENTS).length}`;
  touchEl.hidden = !(isTouch && sim.started && !sim.paused && !sim.ended);

  for (const id of sim.takeAchievements()) showAch(id);

  const note = sim.takeToast();
  if (note) {
    toastEl.hidden = false;
    toastEl.textContent = note;
    toastUntil = performance.now() + 1900;
  }
  if (!toastEl.hidden && performance.now() > toastUntil) toastEl.hidden = true;
}

// ---------- camera ----------
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
const wantPos = new THREE.Vector3();
const wantAim = new THREE.Vector3();
let camInit = false;
let shake = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (sim.started && !sim.paused) sim.step(dt, keys);
  world.setTime(sim.hour);
  world.sync(sim, dt);
  audio.setMood({ nightK: world.night, water: 1 - Math.min(1, Math.hypot(sim.x, sim.z) / 18), tension: sim.phase === "shark" ? 1 : 0 });

  const ground = world.surface(sim.x, sim.z);
  if (sim.cut) {
    const cut = world.cutCamera(sim.cut.kind, Math.min(1, sim.cut.t / sim.cut.dur));
    wantPos.copy(cut.pos);
    wantAim.copy(cut.aim);
    camera.position.lerp(wantPos, 1 - Math.pow(0.0012, dt));
    camAim.lerp(wantAim, 1 - Math.pow(0.0012, dt));
    camera.lookAt(camAim);
  } else if (sim.dialog && sim.focus) {
    const npc = sim.focus;
    const ang = Math.atan2(npc.x - sim.x, npc.z - sim.z);
    wantAim.set(npc.x, world.surface(npc.x, npc.z) + 0.95, npc.z);
    wantPos.set(
      npc.x - Math.sin(ang) * 2.05 + Math.cos(ang) * 0.75,
      world.surface(npc.x, npc.z) + 1.2,
      npc.z - Math.cos(ang) * 2.05 - Math.sin(ang) * 0.75
    );
    camera.position.lerp(wantPos, 1 - Math.pow(0.0008, dt));
    camAim.lerp(wantAim, 1 - Math.pow(0.0008, dt));
    camera.lookAt(camAim);
  } else if (sim.phase === "sail" || sim.phase === "shark" || sim.phase === "patch" || sim.phase === "city") {
    const dist = sim.phase === "city" ? 9 : 7.4;
    const back = new THREE.Vector3(Math.sin(sim.yaw), 0, Math.cos(sim.yaw));
    wantAim.set(sim.x, 1.2, sim.z - 2.2);
    wantPos.set(sim.x - back.x * dist + 1.5, 4.0, sim.z - back.z * dist + 3.2);
    camera.position.lerp(wantPos, 1 - Math.pow(0.0018, dt));
    camAim.lerp(wantAim, 1 - Math.pow(0.0012, dt));
    camera.lookAt(camAim);
  } else {
    const dist = 6.4;
    const back = new THREE.Vector3(Math.sin(sim.yaw), 0, Math.cos(sim.yaw));
    const lead = sim.moving ? 0.45 : 0;
    wantAim.set(sim.x + Math.sin(sim.yaw) * lead, ground + 1.0, sim.z + Math.cos(sim.yaw) * lead);
    wantPos.set(
      sim.x - back.x * dist,
      Math.max(ground + 0.7, ground + 1.75 + sim.pitch * 4.4),
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
  // tiny chop shake
  if (sim.chop && sim.chop.t > 0.22 && sim.chop.t < 0.34 && !reduceMotion) {
    camera.position.x += (Math.random() - 0.5) * 0.035;
    camera.position.y += (Math.random() - 0.5) * 0.035;
  }

  renderer.render(scene, camera);
  paint();
  requestAnimationFrame(frame);
}
let last = performance.now();
requestAnimationFrame(frame);

// QA shortcuts: ?act=cutscene1|sail|shark|patch|city
const act = params.get("act");
if (act) {
  setTimeout(() => {
    introEl.hidden = true;
    sim.started = true;
    sim.houseStage = 8;
    sim.quest = "boat";
    sim.inv.log = 2;
    if (act === "cutscene1") sim.startCutscene("gift");
    if (act === "sail" || act === "shark" || act === "patch" || act === "city") {
      sim.built.boat = true;
      sim.beginSail();
      if (act === "shark") { sim.phase = "shark"; sim.sharkT = 0; }
      if (act === "patch") { sim.phase = "patch"; sim.patches = [false, false]; }
      if (act === "city") sim.startCity();
    }
  }, 60);
}

if (params.get("debug") === "collider") world.toggleDebug(true);

window.__senja = { sim, world, scene, camera, renderer, THREE, nav, audio };
