
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:"new",args:["--no-sandbox","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader"]});
const page = await browser.newPage();
page.on("pageerror",e=>console.log("ERR",e.message));
await page.goto("http://localhost:5173/?lowfx=1",{waitUntil:"networkidle0"});
await new Promise(r=>setTimeout(r,600));
await page.click("#intro-go");
await new Promise(r=>setTimeout(r,300));
console.log(JSON.stringify(await page.evaluate(()=>{
  const s=__senja.sim,w=__senja.world;
  s.axe=true;s.quest="chop";
  const out=[];
  const trees=w.trees.filter(t=>!t.felled);
  for(const t of trees){
    let best=null;
    for(let a=0;a<16;a++){
      const ang=a/16*Math.PI*2;
      const x=t.x+Math.cos(ang)*1.3,z=t.z+Math.sin(ang)*1.3;
      if(s.blocked(x,z)) continue;
      s.x=x;s.z=z;s.yaw=Math.atan2(t.x-x,t.z-z);
      const tgt=s.target();
      if(tgt&&tgt.kind==="tree"&&tgt.ref===t){best={a,ang};break;}
      if(!best) best={a,ang,tgt:tgt&&tgt.kind};
    }
    out.push({tree:{x:t.x,z:t.z},best});
  }
  return out;
})));
await browser.close();
