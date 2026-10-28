import puppeteer from "puppeteer-core";
import { launchOptions, pageUrl } from "./qa-config.mjs";

const browser = await puppeteer.launch(launchOptions());
const page = await browser.newPage();
page.on("pageerror", e => console.log("ERR", e.message));
await page.goto(pageUrl("?lowfx=1"), { waitUntil: "networkidle0" });
await new Promise(r=>setTimeout(r,600));
await page.click("#intro-go");
await new Promise(r=>setTimeout(r,300));
await page.evaluate(()=>{const s=__senja.sim;s.axe=true;s.quest="chop";});
// simulate the walkthrough loop: walk to spot with key input, then 3 presses
for (let k=0;k<12;k++){
  const r = await page.evaluate(async (k)=>{
    const s=__senja.sim,w=__senja.world;
    const t=w.trees.filter(x=>!x.felled)
      .map(x=>({x:x.x,z:x.z,d:Math.hypot(x.x-s.x,x.z-s.z)})).sort((a,b)=>a.d-b.d)[0];
    if(!t) return null;
    const tr=w.trees.find(x=>Math.abs(x.x-t.x)<0.01&&Math.abs(x.z-t.z)<0.01);
    let spot=null;
    for(let a=0;a<8&&!spot;a++){
      const ang=a/8*Math.PI*2+0.4;
      const x=t.x+Math.cos(ang)*1.35,z=t.z+Math.sin(ang)*1.35;
      if(!s.blocked(x,z)) spot={x,z};
    }
    if(!spot) return {fail:"nospot",tree:`${t.x},${t.z}`};
    // walk: set yaw and hold W via sim.step with keys
    const keys=new Set(["KeyW"]);
    for(let i=0;i<600;i++){
      const dx=spot.x-s.x,dz=spot.z-s.z;
      if(Math.hypot(dx,dz)<0.35) break;
      s.yaw=Math.atan2(dx,dz);
      s.step(1/60,keys);
    }
    s.yaw=Math.atan2(t.x-s.x,t.z-s.z);
    const tgt=s.target();
    const before={log:s.inv.log,hp:tr.hp,dist:+Math.hypot(t.x-s.x,t.z-s.z).toFixed(2),tgt:tgt&&tgt.kind};
    let hits=0;
    for(let hit=0;hit<3;hit++){
      if(!tr.felled){ s.interact(); hits++; }
      for(let i=0;i<60;i++) s.step(1/60,new Set());
    }
    return {...before,tree:`${t.x},${t.z}`,felled:tr.felled,logAfter:s.inv.log,hits};
  }, k);
  console.log(JSON.stringify(r));
}
await browser.close();
