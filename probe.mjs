import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = "C:/Users/USER/Downloads/pulau-senja/playtest";
const b = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
  defaultViewport: { width: 900, height: 700 },
});
const page = await b.newPage();
page.on("pageerror", (e) => console.log("ERR", e.message.slice(0,240)));
await page.goto("http://localhost:5173/?v=" + Date.now(), { waitUntil: "networkidle0" });
await page.click("#intro-go");
await sleep(900);
const info = await page.evaluate(() => {
  const T = __senja.THREE, box = new T.Box3();
  const out = {};
  for (const n of __senja.world.npcs) {
    let m = 0; n.mesh.traverse(o => { if (o.isMesh) m++; });
    box.setFromObject(n.mesh);
    out[n.id] = { h: +(box.max.y - box.min.y).toFixed(2), meshes: m };
  }
  box.setFromObject(__senja.world.player);
  out.player = { h: +(box.max.y - box.min.y).toFixed(2) };
  let all = 0; __senja.scene.traverse(o => { if (o.isMesh) all++; });
  return { out, all, calls: __senja.renderer.info.render.calls };
});
console.log(JSON.stringify(info, null, 1));
await page.evaluate(() => {
  const s = __senja.sim, n = __senja.world.npcs.find(o => o.id === "tamo");
  s.hour = 11; s.x = n.x; s.z = n.z + 2.2; s.yaw = Math.PI; s.pitch = -0.03;
});
await sleep(1200);
await page.screenshot({ path: `${OUT}/doodle3-closeup.png` });
await page.evaluate(() => { const s = __senja.sim; s.x = 4; s.z = 2; s.yaw = Math.PI; });
await sleep(1000);
await page.screenshot({ path: `${OUT}/doodle3-player.png` });
await b.close();
console.log("shots ok");
