// Playtest Pulau Senja: boot, HUD, quest chain, day/night, collision, resize.
// The chain follows ORDER in src/content.js exactly:
//   talk -> chop -> house -> sleep -> boat -> sail -> patch -> city -> done
// walkthrough.mjs walks the same chain with nothing but real keyboard input;
// this script teleports between interactions so it stays a fast smoke test.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import { OUT, ensureOut, launchOptions, pageUrl, sleep } from "./qa-config.mjs";

// ?lowfx=1: headless Chrome falls back to SwiftShader, which cannot hold 60fps
// with shadows + full pixel ratio on. At 3fps the dt clamp makes every timed
// animation (sleep fade, cutscenes) take ~30s of wall clock. Same flag the
// walkthrough uses.
const URL = pageUrl("?lowfx=1");
ensureOut();

const errors = [];
const logs = [];
let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) fails++;
};

const browser = await puppeteer.launch(
  launchOptions({
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--window-size=1280,800",
      "--mute-audio",
    ],
    defaultViewport: { width: 1280, height: 800 },
  })
);
const page = await browser.newPage();
page.on("console", (m) => {
  logs.push(`${m.type()}: ${m.text()}`);
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("requestfailed", (r) => {
  const why = r.failure()?.errorText || "";
  // location.reload() aborts in-flight requests; that is not a page failure
  if (/ERR_ABORTED/.test(why)) return;
  errors.push(`requestfailed: ${r.url()} ${why}`);
});

await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(1200);

const gl = await page.evaluate(() => {
  const c = document.getElementById("view");
  const ctx = c.getContext("webgl2") || c.getContext("webgl");
  return { has: !!ctx, w: c.width, h: c.height };
});
check("WebGL context present", gl.has, JSON.stringify(gl));
check("no console errors on boot", errors.length === 0, errors.join(" | "));

// canvas is not a flat colour
async function frameStats() {
  const b64 = await page.screenshot({ encoding: "base64" });
  const buf = Buffer.from(b64, "base64");
  const png = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = 160; cv.height = 100;
    const x = cv.getContext("2d");
    x.drawImage(img, 0, 0, 160, 100);
    const d = x.getImageData(0, 0, 160, 100).data;
    const set = new Set();
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      set.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4));
      sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    }
    return { colors: set.size, mean: sum / (d.length / 4) };
  }, b64);
  return { ...png, buf };
}

let stats = await frameStats();
check("canvas renders varied pixels (day)", stats.colors > 12, `colors=${stats.colors} mean=${stats.mean.toFixed(1)}`);
fs.writeFileSync(`${OUT}/01-menu-day.png`, stats.buf);

// start game: the first screen is the #intro overlay (#intro-go); #start only
// exists in the pause menu, so click whichever is actually on screen.
async function startGame() {
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => {
      const vis = (id) => {
        const el = document.getElementById(id);
        if (!el || el.hidden) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      return { started: __senja.sim.started, intro: vis("intro-go"), menu: vis("start") };
    });
    if (st.started) return true;
    if (st.intro) await page.evaluate(() => document.getElementById("intro-go").click());
    else if (st.menu) await page.evaluate(() => document.getElementById("start").click());
    await sleep(150);
  }
  return await page.evaluate(() => __senja.sim.started);
}

await startGame();
await sleep(600);
let st = await page.evaluate(() => ({ started: __senja.sim.started, menuHidden: document.getElementById("menu").hidden }));
check("start button starts sim", st.started && st.menuHidden, JSON.stringify(st));

// paint() runs inside the render loop, so give it two real frames before
// reading the DOM; stepSim() advances the sim without ever painting.
const nextPaint = () =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const hud = async () => {
  await nextPaint();
  return page.evaluate(() => ({
    kicker: document.getElementById("quest-kicker").textContent,
    title: document.getElementById("quest-title").textContent,
    detail: document.getElementById("quest-detail").textContent,
    dots: document.getElementById("quest-dots").childElementCount,
    barHidden: document.getElementById("quest-bar").hidden,
    clock: `${document.getElementById("clock-day").textContent} ${document.getElementById("clock-time").textContent}`.trim(),
    bag: document.getElementById("bag").textContent,
    prompt: document.getElementById("prompt").hidden ? "" : document.getElementById("prompt").textContent,
    dialog: document.getElementById("dialog").hidden ? null : document.getElementById("dialog-text").textContent,
  }));
};

// the five resource chips, counted code point by code point (a class without
// the /u flag splits astral emoji into surrogate halves and miscounts)
const BAG_RE = /[\u{1fab5}\u{1fa9a}\u{23f3}\u{1faa8}\u{1f41a}]/gu;
const bagCount = (s) => (s.match(BAG_RE) || []).length;

// ---- 1. HUD reflects the opening quest ----
let h = await hud();
check("quest HUD shows the opening objective", /Tamo/i.test(h.title), `${h.title} | ${h.detail}`);
check("quest kicker counts 8 steps", /Langkah\s*1\s*\/\s*8/.test(h.kicker), h.kicker);
check("quest dots follow ORDER", h.dots === 8, `dots=${h.dots}`);
check("clock card shows day + time", /Hari\s*1/.test(h.clock) && /\d{2}:\d{2}/.test(h.clock), h.clock);
check("bag lists the five resources", bagCount(h.bag) === 5, `${JSON.stringify(h.bag)} → ${bagCount(h.bag)}`);

// walk toward a target with real key presses. the player starts on the south
// beach (0, -14.2) and Tamo waits by the campfire on the north side.
async function walkTo(tx, tz, maxMs = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await page.evaluate(() => ({ x: __senja.sim.x, z: __senja.sim.z, dlg: !!__senja.sim.dialog }));
    const dx = tx - p.x;
    const dz = tz - p.z;
    if (Math.hypot(dx, dz) < 1.2) break;
    await page.evaluate((yaw) => { __senja.sim.yaw = yaw; }, Math.atan2(dx, dz));
    await page.keyboard.down("w");
    await sleep(90);
    await page.keyboard.up("w");
    if (p.dlg) break;
  }
}

// advance the sim deterministically so a slow software renderer can never
// stretch a 0.6s swing or a 1.2s build past the next assertion
const stepSim = (frames) =>
  page.evaluate((n) => {
    const s = __senja.sim;
    for (let i = 0; i < n; i++) s.step(1 / 60, new Set());
  }, frames);

async function closeDialog() {
  for (let i = 0; i < 12; i++) {
    const open = await page.evaluate(() => !!__senja.sim.dialog);
    if (!open) return true;
    await page.click("#dialog-next");
    await sleep(150);
  }
  return await page.evaluate(() => !__senja.sim.dialog);
}

// ---- 2. talk: Tamo hands over the axe ----
await walkTo(1.2, -13.4, 6000);
h = await hud();
check("prompt offers to talk to Tamo", /Tamo/.test(h.prompt), JSON.stringify(h.prompt));

await page.keyboard.press("e");
await sleep(300);
h = await hud();
check("dialog opens with Tamo", !!h.dialog, String(h.dialog));
await closeDialog();
st = await page.evaluate(() => ({ axe: __senja.sim.axe, quest: __senja.sim.quest, ach: __senja.sim.ach }));
check("axe received, quest=chop", st.axe && st.quest === "chop", JSON.stringify(st));
check("'axe' achievement unlocked", st.ach.includes("axe"), st.ach.join(","));
fs.writeFileSync(`${OUT}/02-axe.png`, (await frameStats()).buf);
h = await hud();
check("HUD follows ORDER into chop", /Tebang/.test(h.title) && /2\s*\/\s*8/.test(h.kicker), `${h.title} · ${h.kicker}`);
check("chop shows the log progress bar", !h.barHidden && /\d+\/10/.test(h.detail), h.detail);

// ---- 3. chop: ten trees, three swings each ----
async function chopTrees(count) {
  let felled = 0;
  for (let k = 0; k < count; k++) {
    const t = await page.evaluate(() => {
      const s = __senja.sim;
      const list = __senja.world.trees
        .filter((x) => !x.felled)
        .map((x) => ({ x: x.x, z: x.z, d: Math.hypot(x.x - s.x, x.z - s.z) }))
        .sort((a, b) => a.d - b.d);
      return list[0] || null;
    });
    if (!t) break;
    await page.evaluate((x, z) => { __senja.sim.x = x; __senja.sim.z = z; }, t.x, t.z);
    await sleep(60);
    const kind = await page.evaluate(() => { const o = __senja.sim.target(); return o ? o.kind : null; });
    if (kind !== "tree") continue;
    for (let hit = 0; hit < 3; hit++) {
      await page.keyboard.press("e");
      await stepSim(45);
    }
    const down = await page.evaluate((x, z) => {
      const tr = __senja.world.trees.find((o) => Math.abs(o.x - x) < 0.01 && Math.abs(o.z - z) < 0.01);
      return !!(tr && tr.felled);
    }, t.x, t.z);
    if (down) felled++;
  }
  return felled;
}

const felled = await chopTrees(10);
st = await page.evaluate(() => ({ inv: __senja.sim.inv, quest: __senja.sim.quest, ach: __senja.sim.ach }));
check("10 trees felled by E + swing", felled === 10, `${felled} felled`);
check("10 logs gathered", st.inv.log === 10, JSON.stringify(st.inv));
check("quest advanced to house", st.quest === "house", st.quest);
check("'wood' achievement unlocked", st.ach.includes("wood"), st.ach.join(","));
h = await hud();
check("HUD shows the house stage", /Bangun rumah/.test(h.title) && /3\s*\/\s*8/.test(h.kicker), `${h.title} · ${h.kicker}`);

// ---- 4. house: eight logs on the plot ----
const plot = await page.evaluate(() => ({ x: __senja.world.housePos.x, z: __senja.world.housePos.z }));
// face the plot from the front so no tree can win the "look at it" tie-break
await page.evaluate((x, z) => {
  const s = __senja.sim;
  s.x = x;
  s.z = z + 3.0;
  s.yaw = Math.PI; // looking toward -z, i.e. at the plot
}, plot.x, plot.z);
await nextPaint();
const plotPrompt = await page.evaluate(() => document.getElementById("prompt").textContent || "");
check("plot offers to place a log", /taruh kayu/i.test(plotPrompt), plotPrompt);
for (let i = 0; i < 8; i++) {
  await page.keyboard.press("e");
  await sleep(70);
}
await stepSim(700); // eight stages, 1.2s of build animation each
st = await page.evaluate(() => ({
  stage: __senja.sim.houseStage, quest: __senja.sim.quest, inv: __senja.sim.inv, ach: __senja.sim.ach,
}));
check("house built from 8 logs", st.stage === 8, `stage=${st.stage}`);
check("2 logs kept for the hull patch", st.inv.log === 2, JSON.stringify(st.inv));
check("'house' achievement unlocked", st.ach.includes("house"), st.ach.join(","));
check("quest advanced to sleep", st.quest === "sleep", st.quest);

// ---- 5. side quests: sand, stone, shells, Arin, Tamo, the furnace ----
async function gather(listName, field, invKey, kind, count) {
  const spots = await page.evaluate(
    (ln, f) => __senja.world[ln].filter((o) => !o[f]).map((o) => ({ x: o.x, z: o.z })),
    listName, field
  );
  let got = 0;
  for (const sp of spots) {
    if (got >= count) break;
    await page.evaluate((x, z) => { __senja.sim.x = x; __senja.sim.z = z; }, sp.x, sp.z);
    await sleep(70);
    const t = await page.evaluate(() => { const o = __senja.sim.target(); return o ? o.kind : null; });
    if (t !== kind) continue;
    await page.keyboard.press("e");
    await sleep(90);
    got = await page.evaluate((k) => __senja.sim.inv[k], invKey);
  }
  return got;
}

check("4 sand gathered", (await gather("sands", "taken", "sand", "sand", 4)) === 4);
check("6 stone gathered", (await gather("rocks", "mined", "stone", "rock", 6)) === 6);
check("3 shells gathered", (await gather("shells", "taken", "shell", "shell", 3)) === 3);

async function talkTo(npcId) {
  const n = await page.evaluate((id) => {
    const o = __senja.world.npcs.find((x) => x.id === id);
    __senja.sim.x = o.x + 0.9;
    __senja.sim.z = o.z + 0.9;
    __senja.sim.yaw = Math.atan2(o.x - __senja.sim.x, o.z - __senja.sim.z);
    return { x: o.x, z: o.z, name: o.name };
  }, npcId);
  await sleep(150);
  await page.keyboard.press("e");
  await sleep(300);
  const opened = await page.evaluate(() => !!__senja.sim.dialog);
  await closeDialog();
  return { ...n, opened };
}

const arin = await talkTo("arin");
st = await page.evaluate(() => ({ inv: __senja.sim.inv, traded: __senja.sim.traded, repaired: __senja.sim.repaired }));
check("Arin trade repaired the altar", arin.opened && st.traded.arin && st.repaired, JSON.stringify(st));

const tamoTalk = await talkTo("tamo");
st = await page.evaluate(() => ({ inv: __senja.sim.inv, traded: __senja.sim.traded }));
check("Tamo traded 3 shells for 2 planks", tamoTalk.opened && st.traded.tamo && st.inv.shell === 0, JSON.stringify(st));

// build menu: recipes are buttons carrying data-recipe, tabs are Rumah/Perabot
async function openCraft() {
  if (await page.evaluate(() => __senja.sim.craftOpen)) return true;
  await page.keyboard.press("c");
  await sleep(240);
  return await page.evaluate(() => __senja.sim.craftOpen);
}
async function closeCraft() {
  if (!(await page.evaluate(() => __senja.sim.craftOpen))) return true;
  await page.keyboard.press("c");
  await sleep(200);
  return await page.evaluate(() => !__senja.sim.craftOpen);
}
async function craftMake(id) {
  if (!(await openCraft())) return false;
  const tab = await page.evaluate((rid) => {
    for (const b of document.querySelectorAll("#craft-tabs button")) {
      b.click();
      if (document.querySelector(`[data-recipe="${rid}"]`)) return b.dataset.tab;
    }
    return null;
  }, id);
  if (!tab) return false;
  await sleep(180);
  const btn = `[data-recipe="${id}"]`;
  const usable = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.classList.contains("dim");
  }, btn);
  if (!usable) return false;
  await page.click(btn);
  await sleep(160);
  if (await page.evaluate(() => document.getElementById("craft-make").disabled)) return false;
  await page.click("#craft-make");
  await sleep(220);
  return true;
}

check("build menu opens with C", await openCraft());
check("plank recipe turns 1 log into 2 planks", await craftMake("plank"));
// 2 kept logs + 2 planks (Arin) + 2 planks (Tamo) -> one craft spends 1 log
st = await page.evaluate(() => ({ inv: __senja.sim.inv }));
check("planks crafted from the kept logs", st.inv.plank === 6 && st.inv.log === 1, JSON.stringify(st.inv));
check("furnace crafted from 4 stone + 4 sand", await craftMake("furnace"));
st = await page.evaluate(() => ({ built: __senja.sim.built, inv: __senja.sim.inv }));
check("furnace stands on the island", st.built.furnace, JSON.stringify(st));
check("build menu closes with C", await closeCraft());

// ---- 6. sleep: night only, then a new day ----
const noon = await page.evaluate(() => {
  const s = __senja.sim;
  s.hour = 12;
  const ok = s.trySleep();
  return { ok, sleeping: s.sleeping };
});
check("sleep refused at noon", noon.ok === false && !noon.sleeping, JSON.stringify(noon));

const bed = await page.evaluate(() => {
  const b = __senja.world.builds.house.userData.beds[0];
  return { x: b.x, z: b.z };
});
await page.evaluate((x, z) => { __senja.sim.x = x; __senja.sim.z = z; __senja.sim.hour = 22; }, bed.x, bed.z + 0.75);
await sleep(320);
h = await hud();
check("bed prompt inside the house at night", /tidur/i.test(h.prompt), h.prompt);
await page.keyboard.press("e");
await sleep(500);
const slept = await page.evaluate(() => ({ sleeping: __senja.sim.sleeping, day: __senja.sim.day }));
check("sleep starts the night card", slept.sleeping || slept.day === 2, JSON.stringify(slept));
// The sleep overlay drops the software renderer to ~4 fps, and dt is clamped to
// 0.05/frame, so fade + 2.2s hold + fade-out (~4.3s of sim) can take ~90s of
// wall clock. Wait on the state, with plenty of headroom.
await page.waitForFunction(() => !__senja.sim.sleeping, { timeout: 120000, polling: 100 });
st = await page.evaluate(() => ({ day: __senja.sim.day, hour: __senja.sim.hour, quest: __senja.sim.quest, ach: __senja.sim.ach }));
check("woke at 06:00 on day 2", st.day === 2 && st.hour === 6, JSON.stringify({ day: st.day, hour: st.hour }));
check("'sleep' achievement unlocked", st.ach.includes("sleep"), st.ach.join(","));
check("quest advanced to boat", st.quest === "boat", st.quest);
h = await hud();
check("HUD asks for Tamo at the dock", /dermaga/i.test(h.title) && /5\s*\/\s*8/.test(h.kicker), `${h.title} · ${h.kicker}`);

// ---- 7. boat: Tamo's cutscene, then the two-button card ----
const tamo2 = await talkTo("tamo");
st = await page.evaluate(() => ({ phase: __senja.sim.phase, built: __senja.sim.built, ach: __senja.sim.ach }));
check("talking to Tamo starts cutscene 1", tamo2.opened && st.phase === "cut1", st.phase);
check("boat built by the cutscene", st.built.boat && st.ach.includes("boat"), JSON.stringify(st));
await page.keyboard.press("Escape");
await sleep(500);
const card = await page.evaluate(() => ({
  phase: __senja.sim.phase,
  shown: !document.getElementById("card").hidden,
  again: !!document.getElementById("card-again"),
  sail: !!document.getElementById("card-sail"),
}));
check("card offers Mulai lagi + Lanjut menjelajah", card.phase === "card" && card.shown && card.again && card.sail, JSON.stringify(card));
await page.click("#card-sail");
await sleep(700);
st = await page.evaluate(() => ({ phase: __senja.sim.phase, quest: __senja.sim.quest }));
check("card starts the voyage", st.phase === "sail" && st.quest === "sail", JSON.stringify(st));

// ---- 8. shark -> patch -> city -> done ----
await page.evaluate(() => { __senja.sim.phase = "shark"; __senja.sim.sharkT = 0; });
await sleep(400);
check("shark appears", await page.evaluate(() => __senja.world.shark.group.visible));
await page.evaluate(() => { __senja.sim.sharkT = 12; });
await page.waitForFunction(() => __senja.sim.phase === "patch", { timeout: 10000 }).catch(() => {});
st = await page.evaluate(() => ({ phase: __senja.sim.phase, quest: __senja.sim.quest }));
check("shark attack -> patch stage", st.phase === "patch" && st.quest === "patch", JSON.stringify(st));

for (let k = 0; k < 2; k++) {
  await page.keyboard.down("e");
  await sleep(120);
  await page.evaluate(() => {
    const s = __senja.sim;
    for (let i = 0; i < 110 && s.patches.filter(Boolean).length <= 1; i++) s.step(1 / 60, new Set());
  });
  await page.keyboard.up("e");
  await sleep(200);
}
const patches = await page.evaluate(() => ({ p: __senja.sim.patches.slice(), ach: __senja.sim.ach.includes("shark") }));
check("2 holes patched with held E", patches.p.every(Boolean) && patches.ach, JSON.stringify(patches));

await page.waitForFunction(() => __senja.sim.phase === "city", { timeout: 15000 }).catch(() => {});
st = await page.evaluate(() => ({ phase: __senja.sim.phase, quest: __senja.sim.quest, city: !!__senja.world.city }));
check("city cutscene starts", st.phase === "city" && st.city, JSON.stringify(st));
await page.keyboard.press("Escape");
await page.waitForFunction(() => __senja.sim.ended, { timeout: 12000 }).catch(() => {});
const ending = await page.evaluate(() => ({
  ended: __senja.sim.ended,
  quest: __senja.sim.quest,
  city: !!__senja.world.city,
  endShown: !document.getElementById("end").hidden,
  again: document.getElementById("again").textContent,
  kicker: document.getElementById("quest-kicker").textContent,
}));
check("ending reached, quest=done", ending.ended && ending.quest === "done", JSON.stringify(ending));
check("city torn down after the ending", !ending.city);
check("end screen shown with Mulai lagi", ending.endShown && /mulai lagi/i.test(ending.again), ending.again);
check("quest kicker says Selesai", /Selesai/i.test(ending.kicker), ending.kicker);
fs.writeFileSync(`${OUT}/09-end.png`, (await frameStats()).buf);

// ---- day / night ----
await page.evaluate(() => { location.reload(); });
await sleep(1800);
await startGame();
await sleep(400);
const times = [
  ["07", 7.5],
  ["12", 12.0],
  ["18", 18.2],
  ["22", 22.0],
  ["03", 3.0],
];
const means = {};
for (const [name, hour] of times) {
  await page.evaluate((hr) => { __senja.sim.hour = hr; }, hour);
  await sleep(500);
  const s = await frameStats();
  means[name] = s.mean;
  const clk = await page.evaluate(() => `${document.getElementById("clock-day").textContent} ${document.getElementById("clock-time").textContent}`.trim());
  fs.writeFileSync(`${OUT}/time-${name}.png`, s.buf);
  console.log(`  ${name}:00  mean=${s.mean.toFixed(1)}  clock="${clk}"`);
}
check("day brighter than night", means["12"] > means["22"] + 15, `12h=${means["12"].toFixed(1)} 22h=${means["22"].toFixed(1)}`);
check("dawn/sunset between", means["07"] > means["22"] && means["18"] > means["22"], JSON.stringify(means));
check("night not pure black (playable)", means["22"] > 18, `mean=${means["22"].toFixed(1)}`);

// night light present
const nightLights = await page.evaluate(() => {
  __senja.sim.hour = 23;
  return new Promise((res) => setTimeout(() => {
    let pl = 0;
    __senja.scene.traverse((o) => { if (o.isPointLight && o.intensity > 0.2) pl++; });
    res(pl);
  }, 300));
});
check("lanterns lit at night", nightLights >= 3, `pointLights=${nightLights}`);

// the clock ticks on its own while the game runs
await page.evaluate(() => { __senja.sim.hour = 9; });
const hour0 = await page.evaluate(() => __senja.sim.hour);
await sleep(1300);
const hour1 = await page.evaluate(() => __senja.sim.hour);
check("clock advances while playing", hour1 > hour0 + 0.01, `${hour0.toFixed(3)} → ${hour1.toFixed(3)}`);

// ---- collision: the hut is solid ----
const collide = await page.evaluate(() => {
  const s = __senja.sim;
  s.x = -5.6; s.z = 1.4;
  s.yaw = -Math.PI / 2; // facing -x, straight at the hut at (-9, 1.4)
  const before = { x: s.x, z: s.z };
  for (let i = 0; i < 240; i++) s.step(1 / 60, new Set(["KeyW"]));
  return { before, after: { x: +s.x.toFixed(2), z: +s.z.toFixed(2) }, gap: +Math.hypot(s.x + 9, s.z - 1.4).toFixed(2) };
});
check("hut blocks the player", collide.gap > 1.5 && collide.after.x > -7.6, JSON.stringify(collide));

// ---- island edge: open water stops the player ----
// heading picked to avoid props: the east side is a rock field (4.6..12.0, ~x),
// so walk due north from the open beach instead.
const bound = await page.evaluate(() => {
  const s = __senja.sim;
  s.x = 0; s.z = -8; s.yaw = Math.PI; // facing -z, open beach, no props in the lane
  for (let i = 0; i < 600; i++) s.step(1 / 60, new Set(["KeyW"]));
  return { r: +Math.hypot(s.x, s.z).toFixed(2), x: +s.x.toFixed(2), z: +s.z.toFixed(2) };
});
check("island edge stops the player", bound.r < 17.2 && bound.r > 10, JSON.stringify(bound));

// ---- the dock is walkable past the shoreline ----
const dockWalk = await page.evaluate(() => {
  const s = __senja.sim;
  s.x = 0; s.z = 14.2; s.yaw = 0; // facing +z, onto the dock
  for (let i = 0; i < 120; i++) s.step(1 / 60, new Set(["KeyW"]));
  return { z: +s.z.toFixed(2), onDock: __senja.world.surface(0, s.z) >= 0.57 };
});
check("dock is walkable past the shoreline", dockWalk.z > 16.0 && dockWalk.onDock, JSON.stringify(dockWalk));

// ---- resize ----
await page.setViewport({ width: 420, height: 780 });
await sleep(500);
const small = await page.evaluate(() => {
  const c = document.getElementById("view");
  return { cw: c.clientWidth, ch: c.clientHeight, bw: c.width, bh: c.height, ar: __senja.camera.aspect };
});
check("resize keeps canvas matched", Math.abs(small.ar - small.cw / small.ch) < 0.02, JSON.stringify(small));
const sSmall = await frameStats();
fs.writeFileSync(`${OUT}/10-mobile.png`, sSmall.buf);
check("mobile frame renders", sSmall.colors > 10, `colors=${sSmall.colors}`);

await page.setViewport({ width: 1280, height: 800 });
await sleep(400);

check("no console errors during whole run", errors.length === 0, errors.slice(0, 4).join(" | "));

console.log("\n--- console log tail ---");
console.log(logs.slice(-12).join("\n") || "(empty)");
console.log(`\nRESULT: ${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
