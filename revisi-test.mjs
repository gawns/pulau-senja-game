// Smoke test revisi v2: boot, gerak, tabrakan, tebang, rumah, tidur, kucing, menu C, cutscene.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const OUT = "C:/Users/USER/Downloads/pulau-senja/playtest";
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.SENJA_URL || "http://localhost:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, ok, x = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`);
  if (!ok) fails++;
};

// Deterministic stepping: drive sim.step with fixed dt so logic tests don't
// depend on headless swiftshader frame rate.
async function step(page, seconds, keyList = []) {
  return page.evaluate((seconds, keyList) => {
    const keys = new Set(keyList);
    const s = __senja.sim;
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) {
      s.step(1 / 60, keys);
      __senja.world.sync(s, 1 / 60);
    }
    return true;
  }, seconds, keyList);
}

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(600);

check("intro overlay visible", await page.evaluate(() => !document.getElementById("intro").hidden));
check("audio not started before input", await page.evaluate(() => !__senja.audio.started));
await page.click("#intro-go");
await sleep(500);
check("sim started", await page.evaluate(() => __senja.sim.started && document.getElementById("intro").hidden));
check("audio started after input", await page.evaluate(() => __senja.audio.started));

// world content
const worldInfo = await page.evaluate(() => ({
  cats: __senja.world.cats.map((c) => c.name),
  npcs: __senja.world.npcs.map((n) => n.id),
  trees: __senja.world.trees.length,
  playerScale: __senja.world.player.scale.x,
  hasLegs: !!__senja.world.player.userData.legs,
  nav: !!__senja.nav && __senja.nav.N,
}));
check("3 cats Soto/Bella/Cemong", worldInfo.cats.join(",") === "Soto,Bella,Cemong", worldInfo.cats.join(","));
check("Mira removed from NPCs", !worldInfo.npcs.includes("mira"), worldInfo.npcs.join(","));
check("player is capsule scale 0.6", Math.abs(worldInfo.playerScale - 0.6) < 0.01 && !worldInfo.hasLegs, String(worldInfo.playerScale));
check("at least 12 trees", worldInfo.trees >= 12, String(worldInfo.trees));
check("nav grid built", worldInfo.nav > 50, String(worldInfo.nav));

// movement + collision
const st = await page.evaluate(async () => {
  const s = __senja.sim;
  s.yaw = 0; s.pitch = 0;
  const p0 = { x: s.x, z: s.z };
  return { p0, blockedCenter: s.blocked(0, 0) };
});
await page.keyboard.down("d");
await sleep(320);
await page.keyboard.up("d");
await sleep(60);
const p1 = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z }));
check("D strafes screen-right (world -x)", p1.x < st.p0.x - 0.05, JSON.stringify({ p0: st.p0, p1 }));

// walking never ends inside a collider
const noOverlap = await page.evaluate(async () => {
  const s = __senja.sim;
  let bad = 0;
  for (let i = 0; i < 200; i++) {
    const a = Math.random() * Math.PI * 2;
    const nx = s.x + Math.cos(a) * 0.4;
    const nz = s.z + Math.sin(a) * 0.4;
    if (!s.blocked(nx, nz)) { s.x = nx; s.z = nz; }
    if (s.blocked(s.x, s.z, 0.2)) bad++;
  }
  return bad;
});
check("player never ends inside collider", noOverlap === 0, String(noOverlap));

// fast-forward quest: talk to Tamo
await page.evaluate(() => { __senja.sim.openDialog(__senja.world.npcs.find((n) => n.id === "tamo")); });
for (let i = 0; i < 8; i++) {
  const open = await page.evaluate(() => !!__senja.sim.dialog);
  if (!open) break;
  await page.evaluate(() => __senja.sim.advanceDialog());
  await sleep(90);
}
let s = await page.evaluate(() => ({ axe: __senja.sim.axe, quest: __senja.sim.quest }));
check("axe + chop quest", s.axe && s.quest === "chop", JSON.stringify(s));

// chop 10 trees (teleport next to each tree, real E presses)
const chopped = await page.evaluate(() => {
  const s = __senja.sim;
  const trees = __senja.world.trees.filter((t) => !t.felled);
  for (const t of trees) {
    if (s.inv.log >= 10) break;
    // stand at a spot where the tree really is the nearest interactable
    let placed = false;
    for (let a = 0; a < 16 && !placed; a++) {
      const ang = (a / 16) * Math.PI * 2;
      s.x = t.x + Math.cos(ang) * 1.2;
      s.z = t.z + Math.sin(ang) * 1.2;
      if (s.blocked(s.x, s.z, 0.3)) continue;
      const tgt = s.target();
      if (tgt && tgt.kind === "tree" && tgt.ref === t) placed = true;
    }
    if (!placed) continue;
    for (let hit = 0; hit < 3; hit++) {
      s.interact();
      for (let i = 0; i < 40; i++) s.step(1 / 60, new Set());
    }
  }
  return { log: s.inv.log, quest: s.quest, felled: __senja.world.trees.filter((t) => t.felled).length, hp: trees[0].hp };
});
check("10 logs from 10 trees", chopped.log === 10, JSON.stringify(chopped));
check("quest -> house", chopped.quest === "house", chopped.quest);

// house: place 8 logs at plot
const house = await page.evaluate(() => {
  const s = __senja.sim;
  s.x = __senja.world.housePos.x; s.z = __senja.world.housePos.z + 3.0;
  const before = s.inv.log;
  for (let i = 0; i < 8; i++) {
    s.placeLog();
    for (let k = 0; k < 80; k++) s.step(1 / 60, new Set());
  }
  for (let k = 0; k < 120; k++) s.step(1 / 60, new Set());
  return { stage: s.houseStage, log: s.inv.log, before, quest: s.quest, anim: s.houseAnim, queue: s.houseQueue.length };
});
check("house built 8/8", house.stage === 8, JSON.stringify(house));
check("8 logs used, 2 left", house.before === 10 && house.log === 2, JSON.stringify(house));
check("quest -> sleep", house.quest === "sleep", house.quest);

// sleep only at night
const sleepDay = await page.evaluate(() => {
  const s = __senja.sim;
  s.hour = 12;
  return { ok: s.trySleep(), sleeping: s.sleeping };
});
check("cannot sleep at noon", sleepDay.ok === false && !sleepDay.sleeping, JSON.stringify(sleepDay));
const sleepNight = await page.evaluate(() => {
  const s = __senja.sim;
  s.hour = 22; s.day = 3;
  const ok = s.trySleep();
  for (let i = 0; i < 60 * 20 && s.sleeping; i++) s.step(1 / 60, new Set());
  return { ok, day: s.day, hour: s.hour, quest: s.quest, sleeping: s.sleeping };
});
check("sleep at night advances day", sleepNight.ok && sleepNight.day === 4 && sleepNight.hour === 6, JSON.stringify(sleepNight));

// cats pet
const cat = await page.evaluate(() => {
  const s = __senja.sim;
  const c = __senja.world.cats[0];
  s.x = c.x + 0.8; s.z = c.z;
  const t = s.target();
  const kind = t && t.kind;
  s.interact();
  return { kind, pets: s.catsPet };
});
check("E pets a cat", cat.kind === "cat" && cat.pets >= 1, JSON.stringify(cat));

// menu C: no boat recipe, world keeps running
const craft = await page.evaluate(() => {
  const s = __senja.sim;
  s.craftOpen = true;
  const boatBtn = !!document.querySelector('[data-craft="boat"]');
  const hour0 = s.hour;
  for (let i = 0; i < 60; i++) s.step(1 / 60, new Set());
  return { boatBtn, hourMoved: s.hour !== hour0, recipes: s.recipes().map((r) => r.id) };
});
check("no boat recipe in menu C", craft.boatBtn === false && !craft.recipes.includes("boat"), craft.recipes.join(","));
check("world keeps running with menu open", craft.hourMoved);
await page.evaluate(() => { __senja.sim.craftOpen = false; });

// soak: NPCs + cats must never sit inside a collider and must not get stuck
const soak = await page.evaluate(() => {
  const s = __senja.sim, w = __senja.world;
  s.houseStage = 8; s.quest = "sleep";
  let inside = 0, stuck = 0, moved = 0;
  const prev = new Map(w.npcs.map((n) => [n.id, { x: n.x, z: n.z, t: 0 }]));
  for (let i = 0; i < 60 * 300; i++) {
    s.step(1 / 60, new Set());
    w.setTime(s.hour);
    w.sync(s, 1 / 60);
    for (const n of w.npcs) {
      if (w.collides(n.x, n.z, 0.25)) inside++;
      const p = prev.get(n.id);
      if (n.path && n.pi < n.path.length) {
        const m = Math.hypot(n.x - p.x, n.z - p.z);
        if (m < 0.002) p.t += 1 / 60; else { p.t = 0; moved++; }
        if (p.t > 2.0) stuck++;
      } else p.t = 0;
      p.x = n.x; p.z = n.z;
    }
    for (const c of w.cats) if (w.collides(c.x, c.z, 0.12)) inside++;
  }
  return { inside, stuck, moved, day: s.day };
});
check("NPCs and cats never inside colliders (5 game-min soak)", soak.inside === 0, JSON.stringify(soak));
check("NPCs never stuck while pathing", soak.stuck === 0, JSON.stringify(soak));
check("NPCs actually moved during soak", soak.moved > 200, String(soak.moved));

// cutscene 1 -> card -> sail
await page.evaluate(() => {
  const s = __senja.sim;
  s.sleeping = false; s.sleepFade = 0; s.sleepCard = null; s.craftOpen = false;
  s.phase = "island";
  s.quest = "boat"; s.startCutscene("gift");
});
await sleep(400);
check("cutscene 1 starts", await page.evaluate(() => __senja.sim.phase === "cut1" && !!__senja.sim.cut));
const cutInfo = await page.evaluate(() => ({ dur: __senja.sim.cut.dur, boat: __senja.sim.built.boat }));
check("cutscene 1 <= 15s and grants boat", cutInfo.dur <= 15 && cutInfo.boat, JSON.stringify(cutInfo));
await page.evaluate(() => { __senja.sim.cut.t = 99; });
await sleep(300);
check("card with 2 buttons appears", await page.evaluate(() => __senja.sim.phase === "card" && !document.getElementById("card").hidden && !!document.getElementById("card-sail")));
await page.click("#card-sail");
await sleep(600);
check("sailing phase", await page.evaluate(() => __senja.sim.phase === "sail"));

// shark
await page.evaluate(() => { __senja.sim.phase = "shark"; __senja.sim.sharkT = 0; });
await sleep(500);
check("shark visible", await page.evaluate(() => __senja.world.shark.group.visible));
await page.evaluate(() => { __senja.sim.sharkT = 12; });
await sleep(500);
check("phase -> patch", await page.evaluate(() => __senja.sim.phase === "patch"));

// patch 2 holes with held E
const patched = await page.evaluate(() => {
  const s = __senja.sim;
  for (let k = 0; k < 2; k++) {
    s.holdE = true;
    for (let i = 0; i < 90 && s.patches.filter(Boolean).length <= k; i++) s.step(1 / 60, new Set());
    s.holdE = false;
  }
  return { patches: s.patches, ach: s.ach.includes("shark") };
});
check("2 holes patched, no game over", patched.patches.every(Boolean) && patched.ach, JSON.stringify(patched));
await sleep(2800);
check("city phase + city mesh built", await page.evaluate(() => __senja.sim.phase === "city" && !!__senja.world.city));
await page.evaluate(() => {
  const s = __senja.sim;
  if (s.cut) s.cut.t = 99;
  for (let i = 0; i < 60; i++) s.step(1 / 60, new Set());
});
await sleep(400);
const ending = await page.evaluate(() => ({ phase: __senja.sim.phase, ended: __senja.sim.ended, city: !!__senja.world.city, endShown: !document.getElementById("end").hidden }));
check("ending shown and city disposed", ending.ended && !ending.city && ending.endShown, JSON.stringify(ending));

// screenshots
await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(600);
await page.click("#intro-go");
await sleep(600);
await page.screenshot({ path: `${OUT}/rev-day.png` });
await page.evaluate(() => { __senja.sim.hour = 18.4; });
await sleep(800);
await page.screenshot({ path: `${OUT}/rev-dusk.png` });
await page.evaluate(() => { __senja.sim.hour = 22; });
await sleep(800);
await page.screenshot({ path: `${OUT}/rev-night.png` });

check("no runtime errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\nRESULT: ${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
await browser.close();
process.exit(fails ? 1 : 0);
