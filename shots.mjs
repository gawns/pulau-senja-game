import puppeteer from "puppeteer-core";
import { OUT, ensureOut, launchOptions, pageUrl, sleep } from "./qa-config.mjs";

const URL = pageUrl();
ensureOut();
const b = await puppeteer.launch(
  launchOptions({ defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 } })
);
const page = await b.newPage();
page.on("pageerror", (e) => console.log("ERR", e.message.slice(0, 160)));
await page.goto(URL + "?v=" + Date.now(), { waitUntil: "networkidle0" });
await page.screenshot({ path: `${OUT}/v2-intro.png` });
await page.click("#intro-go");
await sleep(900);

const shot = async (name) => { await page.screenshot({ path: `${OUT}/v2-${name}.png` }); };

// 1. Tamo + campfire
await page.evaluate(() => {
  const s = __senja.sim;
  s.x = 1.2; s.z = -9.4; s.yaw = Math.PI;
  s.hour = 10.5;
});
await sleep(900);
await shot("tamo-campfire");

// 2. NPC close-up (check height)
await page.evaluate(() => {
  const s = __senja.sim;
  const n = __senja.world.npcs.find(o => o.id === "tamo");
  s.x = n.x + 1.8; s.z = n.z + 1.8; s.yaw = Math.PI * 0.75;
});
await sleep(900);
await shot("npc-height");

// 3. house from the south (camera behind player looking north at the house)
await page.evaluate(() => {
  const s = __senja.sim;
  s.built = { furnace: true, house: true, boat: true };
  s.quest = "sail";
  s.x = 8.5; s.z = 2.2; s.yaw = Math.PI; s.pitch = 0.16;
});
await sleep(1400);
await shot("house-front");

// 4. house from the south-west
await page.evaluate(() => {
  const s = __senja.sim;
  s.x = 4.6; s.z = 2.6; s.yaw = Math.PI * 0.78; s.pitch = 0.18;
});
await sleep(1000);
await shot("house-side");

// 4b. house from the east
await page.evaluate(() => {
  const s = __senja.sim;
  s.x = 13.4; s.z = -2.0; s.yaw = -Math.PI / 2; s.pitch = 0.14;
});
await sleep(1000);
await shot("house-east");

// 5. world wide (shrine + altar)
await page.evaluate(() => {
  const s = __senja.sim;
  s.x = 2.0; s.z = 1.0; s.yaw = -1.4; s.pitch = 0.12;
});
await sleep(900);
await shot("world-wide");

// 6. flowers/rocks detail
await page.evaluate(() => {
  const s = __senja.sim;
  s.x = -4.4; s.z = -3.6; s.yaw = 0.4; s.pitch = 0.2;
});
await sleep(900);
await shot("flora");

// 7. dusk
await page.evaluate(() => { __senja.sim.hour = 18.3; });
await sleep(1200);
await shot("dusk");

// 8. night
await page.evaluate(() => { __senja.sim.hour = 22.0; });
await sleep(1200);
await shot("night");

// 9. dialog GUI
await page.evaluate(() => {
  __senja.sim.hour = 11;
  const n = __senja.world.npcs.find(o => o.id === "tamo");
  __senja.sim.openDialog(n);
});
await sleep(1200);
await shot("dialog");

// 10. craft panel
await page.evaluate(() => {
  __senja.sim.dialog = null; __senja.sim.focus = null;
  __senja.sim.craftOpen = true;
});
await sleep(600);
await shot("craft");

// 11. mobile
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluate(() => { __senja.sim.craftOpen = false; __senja.sim.hour = 12; });
await sleep(1200);
await shot("mobile");

await b.close();
console.log("shots done");
