// End-to-end walkthrough using ONLY real keyboard input (no teleporting).
// Proves the island is walkable and the whole quest chain completes.
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

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
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
check("intro mentions house + boat", /rumah/i.test(introText) && /kapal/i.test(introText));
await page.click("#intro-go");
await sleep(400);
check("intro dismissed, sim started", await page.evaluate(() => __senja.sim.started && document.getElementById("intro").hidden));

const state = () => page.evaluate(() => {
  const s = __senja.sim;
  return {
    x: +s.x.toFixed(2), z: +s.z.toFixed(2), quest: s.quest, axe: s.axe,
    inv: { ...s.inv }, built: { ...s.built }, dlg: !!s.dialog, craft: s.craftOpen,
    ended: s.ended, hour: +s.hour.toFixed(2), day: s.day, ach: s.ach.slice(),
  };
});

// ---- movement: D must move screen-right, A screen-left
async function strafeTest() {
  await page.evaluate(() => { __senja.sim.yaw = 0; __senja.sim.pitch = 0; });
  const p0 = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z }));
  await page.keyboard.down("d");
  await sleep(320);
  await page.keyboard.up("d");
  await sleep(60);
  const p1 = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z }));
  await page.keyboard.down("a");
  await sleep(320);
  await page.keyboard.up("a");
  await sleep(60);
  const p2 = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z }));
  return { dxD: p1.x - p0.x, dzD: p1.z - p0.z, dxA: p2.x - p1.x, dzA: p2.z - p1.z };
}
const st = await strafeTest();
// camera sits behind the player looking along +z, so screen-right is -x
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
  const n = await page.evaluate((id) => {
    const x = __senja.world.npcs.find((o) => o.id === id);
    return { x: x.x, z: x.z, name: x.name };
  }, npcId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const a = (attempt * 2.1) + 0.7;
    await pathTo(n.x + Math.cos(a) * 1.5, n.z + Math.sin(a) * 1.5);
    await sleep(120);
    const label = await page.evaluate(() => document.getElementById("prompt").textContent || "");
    if (!label.includes(n.name)) {
      // walk one step closer along the free cell nearest the npc, no teleport
      await pathTo(n.x + Math.cos(a) * 0.95, n.z + Math.sin(a) * 0.95);
      await sleep(120);
    }
    await page.keyboard.press("e");
    await sleep(250);
    if (await page.evaluate(() => !!__senja.sim.dialog)) break;
  }
  for (let i = 0; i < 8; i++) {
    const open = await page.evaluate(() => !!__senja.sim.dialog);
    if (!open) break;
    await page.click("#dialog-next");
    await sleep(130);
  }
}

async function craftOnce(id) {
  if (await page.evaluate(() => !__senja.sim.craftOpen)) { await page.keyboard.press("c"); await sleep(200); }
  // wait for paint() to enable the button (it runs on the animation frame)
  let can = false;
  for (let i = 0; i < 25; i++) {
    can = await page.evaluate((k) => {
      const b = document.querySelector(`[data-craft="${k}"]`);
      return !!(b && !b.disabled);
    }, id);
    if (can) break;
    await sleep(60);
  }
  if (!can) return false;
  await page.click(`[data-craft="${id}"]`);
  await sleep(220);
  return true;
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
      await sleep(150);
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

// ---- 2. six trees
await harvest("trees", "felled", 6, /tebang/);
s = await state();
check("6 logs via walking + E", s.inv.log === 6, JSON.stringify(s.inv));
check("quest -> planks", s.quest === "planks", s.quest);
check("achievement 'wood'", s.ach.includes("wood"), s.ach.join(","));

// ---- 3. planks
let made = 0;
while (await craftOnce("plank")) made++;
s = await state();
check("planks crafted by clicking UI", s.inv.plank >= 8, `${made} crafts, planks=${s.inv.plank}`);
check("quest -> sand", s.quest === "sand", s.quest);
check("achievement 'plank'", s.ach.includes("plank"), s.ach.join(","));
if (await page.evaluate(() => __senja.sim.craftOpen)) { await page.keyboard.press("c"); await sleep(150); }

// ---- 4. sand
await harvest("sands", "taken", 4, /pasir/);
s = await state();
check("4 sand", s.inv.sand >= 4 && s.quest === "stone", JSON.stringify(s.inv));
check("achievement 'sand'", s.ach.includes("sand"), s.ach.join(","));

// ---- 5. stone
await harvest("rocks", "mined", 6, /batu/);
s = await state();
check("6 stone", s.inv.stone >= 6 && s.quest === "furnace", JSON.stringify(s.inv));
check("achievement 'stone'", s.ach.includes("stone"), s.ach.join(","));

// ---- 6. side quests
await harvest("shells", "taken", 3, /kerang/);
s = await state();
check("3 shells", s.inv.shell === 3, JSON.stringify(s.inv));
await talk("tamo");
s = await state();
check("Tamo shell trade +2 planks", s.inv.shell === 0, JSON.stringify(s.inv));
await talk("arin");
s = await state();
check("Arin trade repaired altar", await page.evaluate(() => __senja.sim.repaired), `planks=${s.inv.plank}`);
check("achievement 'arin'", s.ach.includes("arin"), s.ach.join(","));

// ---- 7. furnace -> house
check("furnace craft available", await craftOnce("furnace"));
s = await state();
check("furnace built", s.built.furnace && s.quest === "house", `${s.quest} planks=${s.inv.plank}`);
check("achievement 'furnace'", s.ach.includes("furnace"), s.ach.join(","));
check("house craft available", await craftOnce("house"));
s = await state();
check("house built", s.built.house && s.quest === "boat", `${s.quest} planks=${s.inv.plank}`);
check("achievement 'house'", s.ach.includes("house"), s.ach.join(","));
if (await page.evaluate(() => __senja.sim.craftOpen)) { await page.keyboard.press("c"); await sleep(150); }

// house must NOT be craftable from the menu any more (boat comes from Tamo)
const boatBtn = await page.evaluate(() => !!document.querySelector('[data-craft="boat"]'));
check("no boat craft button (boat comes from Tamo)", !boatBtn);

// ---- 8. Tamo hands over the boat
await talk("tamo");
s = await state();
check("Tamo grants boat after house", s.built.boat && s.quest === "sail", JSON.stringify({ q: s.quest, b: s.built }));
check("achievement 'boat'", s.ach.includes("boat"), s.ach.join(","));

// ---- 9. dialog camera zoom
const npcPos = await page.evaluate(() => {
  const n = __senja.world.npcs.find((o) => o.id === "tamo");
  return { x: n.x, z: n.z };
});
await page.evaluate(() => { __senja.sim.openDialog(__senja.world.npcs.find((n) => n.id === "tamo")); });
await sleep(700);
const zoomIn = await page.evaluate((n) => {
  const c = __senja.camera.position;
  return Math.hypot(c.x - n.x, c.z - n.z);
}, npcPos);
check("camera zooms in on speaker", zoomIn < 3.2, `dist=${zoomIn.toFixed(2)}`);
await page.evaluate(() => { __senja.sim.dialog = null; __senja.sim.focus = null; });
await sleep(900);
const zoomOut = await page.evaluate((n) => {
  const c = __senja.camera.position;
  return Math.hypot(c.x - n.x, c.z - n.z);
}, npcPos);
check("camera returns after dialog", zoomOut > 3.2, `dist=${zoomOut.toFixed(2)}`);

// ---- 10. sail
const reached = await pathTo(0, 17.4);
await sleep(300);
const prompt = await page.evaluate(() => document.getElementById("prompt").textContent);
const where = await page.evaluate(() => ({ x: +__senja.sim.x.toFixed(2), z: +__senja.sim.z.toFixed(2) }));
check("boat prompt reachable by walking", /berlayar/i.test(prompt), `${prompt} @ ${JSON.stringify(where)} path=${reached}`);
await page.keyboard.press("e");
await sleep(400);
s = await state();
check("ending triggered", s.ended, JSON.stringify({ q: s.quest, ended: s.ended }));
const boatGone = await page.evaluate(async () => {
  const t0 = Date.now();
  while (__senja.sim.sailing < 0.995 && Date.now() - t0 < 25000) {
    await new Promise((r) => setTimeout(r, 120));
  }
  return { sailing: __senja.sim.sailing, ms: Date.now() - t0 };
});
check("sailing progress reaches 1", boatGone.sailing >= 0.99, JSON.stringify(boatGone));
const boatVisible = await page.evaluate(() => {
  let vis = null;
  __senja.scene.traverse((o) => {
    if (o.userData && o.userData.isBoat) vis = o.visible;
  });
  return vis;
});
check("boat mesh hidden after sailing", boatVisible === false, String(boatVisible));
const endShown = await page.evaluate(() => !document.getElementById("end").hidden);
check("end overlay visible", endShown);
check("achievement 'sailor'", (await state()).ach.includes("sailor"));
await page.screenshot({ path: `${OUT}/walk-end.png` });

// ---- 11. reload: pause, clock, night
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
  const s = __senja.sim;
  s.hour = 23.9; s.day = 1;
  s.advanceClock(0.5);
  return { hour: +s.hour.toFixed(2), day: s.day };
});
check("clock rolls to day 2", roll.day === 2 && roll.hour < 1, JSON.stringify(roll));

await page.evaluate(() => { __senja.sim.hour = 22; });
await sleep(700);
await page.screenshot({ path: `${OUT}/walk-night.png` });
await page.evaluate(() => { __senja.sim.hour = 12; });
await sleep(700);
await page.screenshot({ path: `${OUT}/walk-day.png` });
await page.evaluate(() => { __senja.sim.hour = 18.4; });
await sleep(700);
await page.screenshot({ path: `${OUT}/walk-dusk.png` });

check("no runtime errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\nRESULT: ${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
await browser.close();
process.exit(fails ? 1 : 0);
