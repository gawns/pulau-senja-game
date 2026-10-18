// Reachability + night visibility audit
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const OUT = "C:/Users/USER/Downloads/pulau-senja/playtest";
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
  defaultViewport: { width: 1100, height: 720 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle0" });
await page.click("#start");
await new Promise((r) => setTimeout(r, 500));

// --- reachability: BFS on walkable grid from spawn, then check every interactable has a
// reachable cell within interaction range
const reach = await page.evaluate(() => {
  const s = __senja.sim;
  const W = __senja.world;
  const step = 0.35;
  const N = 88;
  const off = N / 2;
  const key = (i, j) => i + "," + j;
  const walkable = (i, j) => {
    const x = (i - off) * step;
    const z = (j - off) * step;
    return !s.blocked(x, z);
  };
  // start cell
  const si = Math.round(s.x / step) + off;
  const sj = Math.round(s.z / step) + off;
  const seen = new Set();
  const q = [[si, sj]];
  seen.add(key(si, sj));
  while (q.length) {
    const [i, j] = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const k = key(ni, nj);
      if (seen.has(k)) continue;
      if (!walkable(ni, nj)) continue;
      seen.add(k);
      q.push([ni, nj]);
    }
  }
  const cells = [...seen].map((k) => k.split(",").map(Number));
  const near = (x, z, r) =>
    cells.some(([i, j]) => Math.hypot((i - off) * step - x, (j - off) * step - z) <= r);

  const out = { reachableCells: cells.length, fails: [], ok: 0 };
  const test = (name, x, z, r) => {
    if (near(x, z, r)) out.ok++;
    else out.fails.push(`${name} @${x},${z} r=${r}`);
  };
  for (const n of W.npcs) test("npc:" + n.id, n.x, n.z, 2.2);
  for (const t of W.trees) test("tree", t.x, t.z, 1.7);
  for (const r2 of W.rocks) test("rock", r2.x, r2.z, 1.7);
  for (const sd of W.sands) test("sand", sd.x, sd.z, 1.7);
  for (const sh of W.shells) test("shell", sh.x, sh.z, 1.7);
  test("boat", W.boat.x, W.boat.z, 2.4);
  return out;
});
console.log("reachable cells:", reach.reachableCells, "| ok:", reach.ok, "| fails:", reach.fails.length);
if (reach.fails.length) console.log(reach.fails.join("\n"));

// --- night visibility: center region brightness/contrast
async function region(hour, tag) {
  await page.evaluate((h) => { __senja.sim.hour = h; }, hour);
  await new Promise((r) => setTimeout(r, 600));
  const b64 = await page.screenshot({ encoding: "base64" });
  fs.writeFileSync(`${OUT}/vis-${tag}.png`, Buffer.from(b64, "base64"));
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = 200; cv.height = 130;
    const x = cv.getContext("2d");
    x.drawImage(img, 0, 0, 200, 130);
    // center playfield only (avoid HUD corners)
    const d = x.getImageData(50, 40, 100, 70).data;
    let sum = 0, n = 0;
    const vals = [];
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      vals.push(v); sum += v; n++;
    }
    const mean = sum / n;
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
    return { mean: +mean.toFixed(1), sd: +sd.toFixed(1) };
  }, b64);
}
for (const [tag, h] of [["day", 12], ["dusk", 18.3], ["night", 22], ["deep-night", 2]]) {
  const r = await region(h, tag);
  console.log(`${tag} (${h}h): center mean=${r.mean} contrast(sd)=${r.sd}`);
}
await browser.close();
