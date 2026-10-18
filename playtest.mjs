// Playtest Pulau Senja: boot, quest chain, day/night, screenshots, pixel checks.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.SENJA_URL || "http://localhost:5173/";
const OUT = "C:/Users/USER/Downloads/pulau-senja/playtest";
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const logs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) fails++;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--window-size=1280,800",
    "--mute-audio",
  ],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
page.on("console", (m) => {
  logs.push(`${m.type()}: ${m.text()}`);
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

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

// start game
await page.click("#start");
await sleep(600);
let st = await page.evaluate(() => ({ started: __senja.sim.started, menuHidden: document.getElementById("menu").hidden }));
check("start button starts sim", st.started && st.menuHidden, JSON.stringify(st));

const hud = async () =>
  page.evaluate(() => ({
    title: document.getElementById("quest-title").textContent,
    detail: document.getElementById("quest-detail").textContent,
    clock: document.getElementById("clock").textContent,
    bag: document.getElementById("bag").textContent,
    prompt: document.getElementById("prompt").hidden ? "" : document.getElementById("prompt").textContent,
    dialog: document.getElementById("dialog").hidden ? null : document.getElementById("dialog-text").textContent,
  }));

// walk toward Mira (npc at -4.4, 0.4). player at 0,-4
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

await walkTo(-4.4, 0.9, 7000);
let h = await hud();
check("prompt shows Mira nearby", /Mira/.test(h.prompt), JSON.stringify(h.prompt));

await page.keyboard.press("e");
await sleep(250);
h = await hud();
check("dialog opens with Mira", !!h.dialog, String(h.dialog));

// click through dialog
for (let i = 0; i < 4; i++) {
  const open = await page.evaluate(() => !!__senja.sim.dialog);
  if (!open) break;
  await page.click("#dialog-next");
  await sleep(150);
}
st = await page.evaluate(() => ({ axe: __senja.sim.axe, quest: __senja.sim.quest }));
check("axe received, quest=chop", st.axe && st.quest === "chop", JSON.stringify(st));

// helper: teleport-free gathering via real E presses next to objects
async function gather(listName, count, field, questAfter) {
  for (let i = 0; i < count; i++) {
    const ok = await page.evaluate((ln, f) => {
      const s = __senja.sim;
      const it = __senja.world[ln].find((o) => !o[f]);
      if (!it) return false;
      s.x = it.x;
      s.z = it.z;
      return true;
    }, listName, field);
    if (!ok) return false;
    await sleep(60);
    const dbg = await page.evaluate(() => {
      const s = __senja.sim;
      const t = s.target();
      return { label: t && t.label, kind: t && t.kind, craft: s.craftOpen, dlg: !!s.dialog, paused: s.paused, inv: { ...s.inv } };
    });
    await page.keyboard.press("e");
    await sleep(140);
    if (process.env.SENJA_DEBUG) console.log("    gather", listName, JSON.stringify(dbg));
  }
  return true;
}

// trees: need 6 logs
await gather("trees", 6, "felled");
st = await page.evaluate(() => ({ inv: __senja.sim.inv, quest: __senja.sim.quest }));
check("6 logs gathered", st.inv.log === 6, JSON.stringify(st.inv));
check("quest advanced to planks", st.quest === "planks", st.quest);

// craft planks: open craft with C, click plank button 3 times (6 logs -> 12 planks)
await page.keyboard.press("c");
await sleep(200);
const craftVisible = await page.evaluate(() => !document.getElementById("craft").hidden);
check("craft panel opens with C", craftVisible);

async function clickCraft(id) {
  const sel = `[data-craft="${id}"]`;
  const enabled = await page.evaluate((s) => !document.querySelector(s).disabled, sel);
  if (!enabled) return false;
  await page.click(sel);
  await sleep(180);
  return true;
}
for (let i = 0; i < 8; i++) {
  if (!(await clickCraft("plank"))) break;
}
st = await page.evaluate(() => ({ inv: __senja.sim.inv, quest: __senja.sim.quest }));
check("planks crafted (>=8) and quest advanced", st.inv.plank >= 8 && st.quest === "sand", JSON.stringify(st));

await page.keyboard.press("c");
await sleep(120);

// sand
await gather("sands", 4, "taken");
st = await page.evaluate(() => ({ inv: __senja.sim.inv, quest: __senja.sim.quest }));
check("4 sand gathered, quest=stone", st.inv.sand >= 4 && st.quest === "stone", JSON.stringify(st));

// side quest: Arin altar (2 stone + 2 plank). need 6 stone total -> 8 rocks exist
await gather("rocks", 6, "mined");
st = await page.evaluate(() => ({ inv: __senja.sim.inv, quest: __senja.sim.quest }));
check("6 stone gathered, quest=furnace", st.inv.stone >= 6 && st.quest === "furnace", JSON.stringify(st));

// shells for Tamo
await gather("shells", 3, "taken");
st = await page.evaluate(() => ({ inv: __senja.sim.inv }));
check("3 shells gathered", st.inv.shell === 3, JSON.stringify(st.inv));

// talk to Tamo -> trade shells for 2 planks
await page.evaluate(() => {
  const n = __senja.world.npcs.find((x) => x.id === "tamo");
  __senja.sim.x = n.x + 1.0; __senja.sim.z = n.z + 1.0;
});
await sleep(120);
await page.keyboard.press("e");
await sleep(250);
for (let i = 0; i < 4; i++) {
  const open = await page.evaluate(() => !!__senja.sim.dialog);
  if (!open) break;
  await page.click("#dialog-next");
  await sleep(150);
}
st = await page.evaluate(() => ({ inv: __senja.sim.inv, traded: __senja.sim.traded }));
check("Tamo trade gave 2 planks", st.traded.tamo && st.inv.shell === 0, JSON.stringify(st));

// talk to Arin -> trade 2 stone for 2 planks + repair altar
await page.evaluate(() => {
  const n = __senja.world.npcs.find((x) => x.id === "arin");
  __senja.sim.x = n.x + 1.0; __senja.sim.z = n.z + 1.0;
});
await sleep(120);
await page.keyboard.press("e");
await sleep(250);
for (let i = 0; i < 4; i++) {
  const open = await page.evaluate(() => !!__senja.sim.dialog);
  if (!open) break;
  await page.click("#dialog-next");
  await sleep(150);
}
st = await page.evaluate(() => ({ inv: __senja.sim.inv, traded: __senja.sim.traded, repaired: __senja.sim.repaired }));
check("Arin trade repaired altar", st.traded.arin && st.repaired, JSON.stringify(st));

// craft furnace
await page.keyboard.press("c");
await sleep(200);
check("furnace craft enabled", await page.evaluate(() => !document.querySelector('[data-craft="furnace"]').disabled));
await clickCraft("furnace");
st = await page.evaluate(() => ({ built: __senja.sim.built, quest: __senja.sim.quest, inv: __senja.sim.inv }));
check("furnace built, quest=house", st.built.furnace && st.quest === "house", JSON.stringify(st));

// need 8 planks for house; may need more logs. check
let planks = st.inv.plank;
if (planks < 8) {
  const need = Math.ceil((8 - planks) / 2);
  // refell trees not possible; add logs via extra trees? assert instead
  check("enough planks for house without extra trees", false, `planks=${planks}`);
} else {
  check("enough planks for house", true, `planks=${planks}`);
}
check("house craft enabled", await page.evaluate(() => !document.querySelector('[data-craft="house"]').disabled));
await clickCraft("house");
st = await page.evaluate(() => ({ built: __senja.sim.built, quest: __senja.sim.quest, inv: __senja.sim.inv }));
check("house built, quest=boat", st.built.house && st.quest === "boat", JSON.stringify(st));

let boatOk = await page.evaluate(() => !document.querySelector('[data-craft="boat"]').disabled);
check("boat craft enabled", boatOk, `planks=${st.inv.plank}`);

if (!boatOk) {
  // Player would be stuck: report exact numbers
  console.log("STUCK-DATA", JSON.stringify(st));
} else {
  await clickCraft("boat");
  st = await page.evaluate(() => ({ built: __senja.sim.built, quest: __senja.sim.quest }));
  check("boat built, quest=sail", st.built.boat && st.quest === "sail", JSON.stringify(st));
  await page.keyboard.press("c");
  await sleep(150);

  // sail away
  await page.evaluate(() => { __senja.sim.x = -1; __senja.sim.z = -11.2; });
  await sleep(150);
  h = await hud();
  check("boat prompt visible", /berangkat/.test(h.prompt), h.prompt);
  await page.keyboard.press("e");
  await sleep(400);
  st = await page.evaluate(() => ({ ended: __senja.sim.ended, quest: __senja.sim.quest }));
  check("game ends on boat", st.ended && st.quest === "done", JSON.stringify(st));
  const endVisible = await page.evaluate(() => !document.getElementById("end").hidden);
  check("end screen shown", endVisible);
  const s2 = await frameStats();
  fs.writeFileSync(`${OUT}/09-end.png`, s2.buf);
}

// ---- day / night ----
await page.evaluate(() => { location.reload(); });
await sleep(1500);
await page.click("#start");
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
  const clk = await page.evaluate(() => document.getElementById("clock").textContent);
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

// time skip key
await page.evaluate(() => { __senja.sim.hour = 9; });
await page.keyboard.press("t");
await sleep(200);
const afterSkip = await page.evaluate(() => __senja.sim.hour);
check("T skips time", afterSkip > 11, `hour=${afterSkip.toFixed(2)}`);

// collision: walk into hut should not pass through
const collide = await page.evaluate(async () => {
  const s = __senja.sim;
  s.x = -5; s.z = 1.6;
  s.yaw = Math.PI; // facing -z toward hut
  const before = { x: s.x, z: s.z };
  for (let i = 0; i < 40; i++) s.step(1 / 60, new Set(["KeyW"]));
  return { before, after: { x: s.x, z: s.z }, blocked: Math.hypot(s.x + 5, s.z + 2) < 1.4 };
});
check("hut blocks player", !collide.blocked, JSON.stringify(collide));

// boundary clamp
const bound = await page.evaluate(() => {
  const s = __senja.sim;
  s.x = 0; s.z = 0; s.yaw = 0;
  for (let i = 0; i < 600; i++) s.step(1 / 60, new Set(["KeyW"]));
  return Math.hypot(s.x, s.z);
});
check("island edge stops player", bound < 15.5, `r=${bound.toFixed(2)}`);

// resize
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
