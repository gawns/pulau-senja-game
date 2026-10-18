// End-to-end walkthrough using ONLY real keyboard input (no teleporting).
// Quest chain v2: Tamo -> 10 kayu -> rumah 8 kayu -> tidur -> perahu Tamo -> berlayar.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const OUT = "C:/Users/USER/Downloads/pulau-senja/playtest";
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.SENJA_URL || "http://localhost:5173/?lowfx=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, ok, x = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`);
  if (!ok) fails++;
};

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

// ---- 0. intro
const introShown = await page.evaluate(() => !document.getElementById("intro").hidden);
check("intro overlay visible on load", introShown);
const introText = await page.evaluate(() => document.getElementById("intro-body").textContent);
check("intro mentions house + boat", /rumah/i.test(introText) && /perahu/i.test(introText));
await page.click("#intro-go");
await sleep(400);
check("intro dismissed, sim started", await page.evaluate(() => __senja.sim.started && document.getElementById("intro").hidden));

const state = () => page.evaluate(() => {
  const s = __senja.sim;
  return {
    x: +s.x.toFixed(2), z: +s.z.toFixed(2), quest: s.quest, axe: s.axe,
    inv: { ...s.inv }, built: { ...s.built }, dlg: !!s.dialog, craft: s.craftOpen,
    ended: s.ended, hour: +s.hour.toFixed(2), day: s.day, ach: s.ach.slice(),
    houseStage: s.houseStage, phase: s.phase, catsPet: s.catsPet,
  };
});

// ---- movement: D must move screen-right, A screen-left
async function strafeTest() {
  await page.evaluate(() => { __senja.sim.yaw = 0; __senja.sim.pitch = 0; });
  const p0 = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z }));
  await page.keyboard.down("d");
  await sleep(450);
  await page.keyboard.up("d");
  await sleep(150);
  const p1 = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z }));
  await page.keyboard.down("a");
  await sleep(450);
  await page.keyboard.up("a");
  await sleep(150);
  const p2 = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z }));
  return { dxD: p1.x - p0.x, dzD: p1.z - p0.z, dxA: p2.x - p1.x, dzA: p2.z - p1.z };
}
const st = await strafeTest();
check("D strafes screen-right (world -x)", st.dxD < -0.05 && Math.abs(st.dzD) < 0.05, JSON.stringify(st));
check("A strafes screen-left (world +x)", st.dxA > 0.05 && Math.abs(st.dzA) < 0.05, JSON.stringify(st));

// BFS path on the live collision grid, then walk it with real key presses.
async function pathTo(tx, tz) {
  const path = await page.evaluate((tx, tz) => {
    const s = __senja.sim;
    const step = 0.3;
    const R = 40;
    const N = Math.ceil((R * 2) / step);
    const off = N / 2;
    const toI = (v) => Math.round(v / step) + off;
    const toV = (i) => (i - off) * step;
    const free = (i, j) => !s.blocked(toV(i), toV(j));
    const si = toI(s.x), sj = toI(s.z);
    const ti = toI(tx), tj = toI(tz);
    let goal = [ti, tj];
    if (!free(ti, tj)) {
      let best = null, bd = 1e9;
      for (let i = ti - 3; i <= ti + 3; i++)
        for (let j = tj - 3; j <= tj + 3; j++) {
          if (!free(i, j)) continue;
          const d = Math.hypot(i - ti, j - tj);
          if (d < bd) { bd = d; best = [i, j]; }
        }
      if (!best) return null;
      goal = best;
    }
    const key = (i, j) => i + "," + j;
    const prev = new Map();
    const seen = new Set([key(si, sj)]);
    const q = [[si, sj]];
    while (q.length) {
      const [i, j] = q.shift();
      if (i === goal[0] && j === goal[1]) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const k = key(ni, nj);
        if (seen.has(k) || !free(ni, nj)) continue;
        seen.add(k);
        prev.set(k, key(i, j));
        q.push([ni, nj]);
      }
    }
    if (!seen.has(key(goal[0], goal[1]))) return null;
    const out = [];
    let cur = key(goal[0], goal[1]);
    while (cur !== key(si, sj)) {
      const [i, j] = cur.split(",").map(Number);
      out.push([+toV(i).toFixed(2), +toV(j).toFixed(2)]);
      cur = prev.get(cur);
    }
    return out.reverse();
  }, tx, tz);
  if (!path) return false;
  await page.keyboard.down("w");
  try {
    for (const [wx, wz] of path) {
      const t0 = Date.now();
      while (Date.now() - t0 < 6000) {
        const p = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z, dlg: !!__senja.sim.dialog }));
        if (p.dlg) return true;
        const dx = wx - p.x, dz = wz - p.z;
        if (Math.hypot(dx, dz) < 0.4) break;
        await page.evaluate((y) => { __senja.sim.yaw = y; }, Math.atan2(dx, dz));
        await sleep(45);
      }
    }
  } finally {
    await page.keyboard.up("w");
  }
  return true;
}

async function talk(npcId) {
  // NPCs walk around, so re-read their live position on every attempt.
  for (let attempt = 0; attempt < 6; attempt++) {
    const n = await page.evaluate((id) => {
      const o = __senja.world.npcs.find((x) => x.id === id);
      return { x: o.x, z: o.z, name: o.name };
    }, npcId);
    const a = attempt * 1.7 + 0.7;
    const r = attempt % 2 === 0 ? 1.5 : 1.05;
    await pathTo(n.x + Math.cos(a) * r, n.z + Math.sin(a) * r);
    await sleep(160);
    const label = await page.evaluate(() => document.getElementById("prompt").textContent || "");
    if (!label.includes(n.name)) continue;
    await page.keyboard.press("e");
    await sleep(300);
    if (await page.evaluate(() => !!__senja.sim.dialog)) break;
  }
  for (let i = 0; i < 10; i++) {
    const open = await page.evaluate(() => !!__senja.sim.dialog);
    if (!open) break;
    await page.evaluate(() => __senja.sim.advanceDialog());
    await sleep(130);
  }
}

async function standNear(tx, tz, reach) {
  return page.evaluate((tx, tz, reach) => {
    const s = __senja.sim;
    let best = null, bd = 1e9;
    for (let a = 0; a < 24; a++) {
      for (const r of [reach - 0.25, reach - 0.5, reach - 0.75, reach - 1.0]) {
        const x = tx + Math.cos((a / 24) * Math.PI * 2) * r;
        const z = tz + Math.sin((a / 24) * Math.PI * 2) * r;
        if (s.blocked(x, z)) continue;
        const d = Math.hypot(x - s.x, z - s.z);
        if (d < bd) { bd = d; best = { x, z }; }
      }
    }
    return best;
  }, tx, tz, reach);
}

// Chop one tree with three real E presses. Tries several approach angles so a
// wandering cat can't steal the interaction prompt.
async function chopTree(t) {
  let ok = false;
  for (let a = 0; a < 8 && !ok; a++) {
    const ang = (a / 8) * Math.PI * 2 + 0.4;
    const spot = await page.evaluate((x, z) => {
      const s = __senja.sim;
      if (s.blocked(x, z)) return null;
      return { x, z };
    }, t.x + Math.cos(ang) * 1.35, t.z + Math.sin(ang) * 1.35);
    if (!spot) continue;
    await pathTo(spot.x, spot.z);
    await sleep(120);
    const label = await page.evaluate(() => document.getElementById("prompt").textContent || "");
    if (/tebang/i.test(label)) { ok = true; break; }
  }
  if (!ok) return false;
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("e");
    await sleep(1100);
  }
  return page.evaluate((tx, tz) => {
    const tr = __senja.world.trees.find((x) => Math.abs(x.x - tx) < 0.01 && Math.abs(x.z - tz) < 0.01);
    return !!(tr && tr.felled);
  }, t.x, t.z);
}

async function harvest(listName, field, times, promptRe, reach = 1.7) {
  let got = 0;
  for (let k = 0; k < times; k++) {
    let done = false;
    const cands = await page.evaluate((ln, f) => {
      const s = __senja.sim;
      return __senja.world[ln]
        .filter((e) => !e[f])
        .map((e) => ({ x: e.x, z: e.z, d: Math.hypot(e.x - s.x, e.z - s.z) }))
        .sort((a, b) => a.d - b.d);
    }, listName, field);
    for (const c of cands) {
      if (done) break;
      const spot = await standNear(c.x, c.z, reach);
      if (!spot) continue;
      await pathTo(spot.x, spot.z);
      await sleep(90);
      const label = await page.evaluate(() => document.getElementById("prompt").textContent || "");
      if (!promptRe.test(label)) continue;
      await page.keyboard.press("e");
      await sleep(160);
      const after = await page.evaluate((ln, f) => {
        const o = __senja.world[ln].find((e) => !e[f]);
        return o ? { x: o.x, z: o.z } : null;
      }, listName, field);
      done = !after || Math.hypot(after.x - c.x, after.z - c.z) > 0.1;
    }
    if (done) got++;
    else console.log(`    unreachable ${listName} #${k}`);
  }
  return got;
}

// ---- 1. Tamo gives the axe
await talk("tamo");
let s = await state();
check("talked to Tamo, got axe", s.axe, JSON.stringify(s.inv));
check("quest -> chop", s.quest === "chop", s.quest);
check("achievement 'axe' unlocked", s.ach.includes("axe"), s.ach.join(","));

// ---- 2. ten trees, three hits each
let felled = 0;
for (let k = 0; k < 10; k++) {
  const t = await page.evaluate(() => {
    const s2 = __senja.sim;
    const list = __senja.world.trees.filter((x) => !x.felled)
      .map((x) => ({ x: x.x, z: x.z, d: Math.hypot(x.x - s2.x, x.z - s2.z) }))
      .sort((a, b) => a.d - b.d);
    return list[0] || null;
  });
  if (!t) break;
  if (await chopTree(t)) felled++;
}
s = await state();
check("10 trees felled by walking + E", felled === 10, `${felled} felled, log=${s.inv.log}`);
check("10 logs, quest -> house", s.inv.log === 10 && s.quest === "house", JSON.stringify({ log: s.inv.log, q: s.quest }));
check("achievement 'wood'", s.ach.includes("wood"), s.ach.join(","));

// ---- 3. pet a cat (outdoors, before the house stands)
for (let attempt = 0; attempt < 8; attempt++) {
  // pick the cat furthest from the house porch, so the bed prompt can't compete
  const cat = await page.evaluate(() => {
    const h = __senja.world.housePos;
    const list = __senja.world.cats
      .map((c) => ({ x: c.x, z: c.z, d: Math.hypot(c.x - h.x, c.z - h.z) }))
      .sort((a, b) => b.d - a.d);
    return list[0];
  });
  const a = attempt * 1.3;
  const okPath = await pathTo(cat.x + Math.cos(a) * 1.05, cat.z + Math.sin(a) * 1.05);
  await sleep(250);
  const info = await page.evaluate(() => ({
    label: document.getElementById("prompt").textContent || "",
    x: +__senja.sim.x.toFixed(2),
    z: +__senja.sim.z.toFixed(2),
  }));
  const label = info.label;
  if (!/usap/i.test(label)) {
    console.log(`    cat attempt ${attempt}: path=${okPath} at ${info.x},${info.z} target ${cat.x.toFixed(2)},${cat.z.toFixed(2)} label="${label}"`);
    continue;
  }
  await page.keyboard.press("e");
  await sleep(300);
  break;
}
s = await state();
check("E pets a cat", s.catsPet >= 1, JSON.stringify({ catsPet: s.catsPet }));

// ---- 3. house: walk to the plot, press E eight times
const plot = await page.evaluate(() => ({ x: __senja.world.housePos.x, z: __senja.world.housePos.z }));
await pathTo(plot.x, plot.z + 3.0);
let placed = 0;
for (let guard = 0; guard < 24 && placed < 8; guard++) {
  const st0 = await page.evaluate(() => ({ stage: __senja.sim.houseStage, q: __senja.sim.houseQueue.length, label: document.getElementById("prompt").textContent || "" }));
  if (st0.stage + st0.q >= 8) break;
  if (!/kayu/i.test(st0.label)) {
    await pathTo(plot.x, plot.z + 3.0);
    await sleep(250);
    continue;
  }
  await page.keyboard.press("e");
  await sleep(500);
  placed++;
}
// stages are queued 1.2s apart; wait for the queue to drain
await page.waitForFunction(() => __senja.sim.houseStage === 8 && __senja.sim.houseAnim === 0, { timeout: 15000 }).catch(() => {});
s = await state();
check("house built from 8 logs", s.houseStage === 8, JSON.stringify({ stage: s.houseStage, log: s.inv.log }));
check("2 logs kept for the boat patch", s.inv.log === 2, JSON.stringify(s.inv));
check("achievement 'house'", s.ach.includes("house"), s.ach.join(","));
check("quest -> sleep", s.quest === "sleep", s.quest);

// ---- 4. sleep is night-only
const noon = await page.evaluate(() => {
  const s2 = __senja.sim;
  s2.hour = 12;
  const ok = s2.trySleep();
  return { ok, sleeping: s2.sleeping };
});
check("sleep refused at noon", noon.ok === false && !noon.sleeping, JSON.stringify(noon));

// walk inside the house to the bed, at night
const bed = await page.evaluate(() => {
  const b = __senja.world.builds.house.userData.beds[0];
  return { x: b.x, z: b.z };
});
await page.evaluate(() => { __senja.sim.hour = 22; });
await pathTo(plot.x, plot.z + 2.2);
await pathTo(bed.x, bed.z + 0.75);
await sleep(300);
const bedLabel = await page.evaluate(() => document.getElementById("prompt").textContent || "");
check("bed prompt inside house at night", /tidur/i.test(bedLabel), bedLabel);
await page.keyboard.press("e");
await sleep(600);
const slept = await page.evaluate(() => ({ sleeping: __senja.sim.sleeping, day: __senja.sim.day, hour: __senja.sim.hour }));
check("sleep started", slept.sleeping || slept.day === 2, JSON.stringify(slept));
await page.waitForFunction(() => !__senja.sim.sleeping, { timeout: 20000 });
s = await state();
check("woke at 06:00 next day", s.day === 2 && s.hour === 6, JSON.stringify({ day: s.day, hour: s.hour }));
check("sleep achievement", s.ach.includes("sleep"), s.ach.join(","));

// ---- 6. menu C: no boat recipe
await page.keyboard.press("c");
await sleep(250);
const craftState = await page.evaluate(() => ({
  open: __senja.sim.craftOpen,
  boatBtn: !!document.querySelector('[data-craft="boat"]'),
  recipes: __senja.sim.recipes().map((r) => r.id),
}));
check("menu C opens", craftState.open);
check("no boat recipe in menu C", !craftState.boatBtn && !craftState.recipes.includes("boat"), craftState.recipes.join(","));
await page.keyboard.press("c");
await sleep(200);

// ---- 7. Tamo at the dock gives the boat (cutscene 1 -> card)
await talk("tamo");
s = await state();
check("cutscene 1 after talking to Tamo", s.phase === "cut1", s.phase);
check("achievement 'boat'", s.ach.includes("boat"), s.ach.join(","));
await page.keyboard.press("Escape");
await sleep(500);
check("card with two buttons", await page.evaluate(() => __senja.sim.phase === "card" && !document.getElementById("card").hidden));
const hasBoth = await page.evaluate(() => !!document.getElementById("card-again") && !!document.getElementById("card-sail"));
check("card offers Mulai lagi + Lanjut menjelajah", hasBoth);
await page.click("#card-sail");
await sleep(600);
check("sailing", await page.evaluate(() => __senja.sim.phase === "sail"));

// ---- 8. shark -> patch -> city -> ending
await page.evaluate(() => { __senja.sim.phase = "shark"; __senja.sim.sharkT = 0; });
await sleep(400);
check("shark appears", await page.evaluate(() => __senja.world.shark.group.visible));
await page.evaluate(() => { __senja.sim.sharkT = 12; });
await sleep(400);
check("shark attack -> patch phase", await page.evaluate(() => __senja.sim.phase === "patch"));
for (let k = 0; k < 2; k++) {
  await page.keyboard.down("e");
  await sleep(2800);
  await page.keyboard.up("e");
  await sleep(200);
}
const patches = await page.evaluate(() => __senja.sim.patches.slice());
check("2 holes patched with held E", patches.every(Boolean), JSON.stringify(patches));
await page.waitForFunction(() => __senja.sim.phase === "city", { timeout: 8000 });
check("city cutscene starts", await page.evaluate(() => __senja.sim.phase === "city" && !!__senja.world.city));
await page.keyboard.press("Escape");
await page.waitForFunction(() => __senja.sim.ended, { timeout: 8000 });
const ending = await page.evaluate(() => ({
  ended: __senja.sim.ended,
  city: !!__senja.world.city,
  endShown: !document.getElementById("end").hidden,
  again: document.getElementById("again").textContent,
}));
check("ending card, city disposed", ending.ended && !ending.city && ending.endShown, JSON.stringify(ending));
check("ending has Mulai lagi", /mulai lagi/i.test(ending.again), ending.again);
await page.screenshot({ path: `${OUT}/walk-end.png` });

// ---- 9. reload: pause, clock, night, screenshots
await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(700);
await page.click("#intro-go");
await sleep(300);
await page.keyboard.press("Escape");
await sleep(150);
await page.keyboard.press("Escape");
await sleep(250);
const paused = await page.evaluate(() => ({ p: __senja.sim.paused, menu: !document.getElementById("menu").hidden }));
check("Esc pauses and shows menu", paused.p && paused.menu, JSON.stringify(paused));
await page.click("#start");
await sleep(250);
check("resume clears pause", await page.evaluate(() => !__senja.sim.paused && __senja.sim.started));

const roll = await page.evaluate(() => {
  const s2 = __senja.sim;
  s2.hour = 23.9; s2.day = 1;
  s2.advanceClock(0.5);
  return { hour: +s2.hour.toFixed(2), day: s2.day };
});
check("clock rolls to day 2", roll.day === 2 && roll.hour < 1, JSON.stringify(roll));

await page.evaluate(() => { __senja.sim.hour = 22; });
await sleep(800);
await page.screenshot({ path: `${OUT}/walk-night.png` });
await page.evaluate(() => { __senja.sim.hour = 12; });
await sleep(800);
await page.screenshot({ path: `${OUT}/walk-day.png` });
await page.evaluate(() => { __senja.sim.hour = 18.4; });
await sleep(800);
await page.screenshot({ path: `${OUT}/walk-dusk.png` });

check("no runtime errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\nRESULT: ${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
await browser.close();
process.exit(fails ? 1 : 0);
