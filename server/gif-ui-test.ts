import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const browser=await chromium.launch({
 headless:true,executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
 args:["--no-sandbox"]
});
const [ca,cb]=await Promise.all([browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})]);
const a=await ca.newPage(),b=await cb.newPage();
const errors:string[]=[];
for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
try{
 await Promise.all([a.goto("http://localhost:5173/"),b.goto("http://localhost:5173/")]);
 await a.locator(".online-status strong").waitFor({timeout:9000});
 for(const p of [a,b]){for(let step=0;step<2;step++)await p.locator(".home-pager-next").click();}
 await a.getByText("Flexible matching",{exact:true}).waitFor();
 assert.equal(await a.locator(".fallback-choice input").isChecked(),true);
 await a.locator(".fallback-choice input").uncheck();
 assert.equal(await a.locator(".fallback-choice input").isChecked(),false);
 await a.locator(".fallback-choice input").check();
 console.log("[PASS] Flexible matching toggle is visible, enabled by default and changeable");
 for(const p of [a,b]){await p.locator(".home-pager-next").click();await p.locator(".consent input").check();}
 await Promise.all([a.getByRole("button",{name:/Find a stranger/}).click(),b.getByRole("button",{name:/Find a stranger/}).click()]);
 await Promise.all([a.locator(".partner-name-button").waitFor({timeout:9000}),b.locator(".partner-name-button").waitFor({timeout:9000})]);
 console.log("[PASS] Matching still enters real chat");
 await a.getByRole("button",{name:"Choose emoji, GIF or sticker"}).click();
 await a.getByRole("tab",{name:"GIF"}).click();
 const originals=a.locator(".gif-local-grid button");
 assert.equal(await originals.count(),10);
 const picture=a.locator(".gif-local-grid img").first();
 await picture.evaluate(async element=>{
  const image=element as HTMLImageElement;
  if(image.complete && image.naturalWidth>0)return;
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("GIF failed to load"));setTimeout(()=>reject(new Error("GIF image load timeout")),5000);});
 });
 console.log("[PASS] Ten same-origin animated GIFs shown immediately");
 const liveSearch=await a.getByPlaceholder("Search reaction GIFs").count();
 console.log("[PASS] GIPHY search "+(liveSearch?"enabled by configured key":"not configured; local GIFs still available"));
 if(liveSearch){await a.getByRole("button",{name:"Search GIPHY"}).click();await a.getByPlaceholder("Search reaction GIFs").fill("hello");await a.waitForTimeout(1800);const count=await a.locator(".gif-tab .gif-grid:not(.gif-local-grid) button").count();console.log("GIPHY_LIVE_RESULTS_COUNT="+count);}
 await a.getByRole("button",{name:"Local reactions"}).click();
 await a.getByRole("button",{name:"Send Hello! GIF"}).click();
 await b.locator('img.gif-message[src="/gifs/hello.gif"]').waitFor({timeout:9000});
 console.log("[PASS] Local GIF delivered to the stranger across Socket.IO");
 await a.getByRole("button",{name:"Choose emoji, GIF or sticker"}).click();
 await a.getByRole("tab",{name:"GIF"}).click();
 await a.waitForFunction(()=>Array.from(document.querySelectorAll(".gif-local-grid img")).every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0),null,{timeout:12000});
 await a.screenshot({path:"chat2play-local-gifs.png",fullPage:false});
 const widths=await Promise.all([a,b].map(p=>p.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}))));
 for(const x of widths)assert.ok(x.scroll<=x.viewport+1,JSON.stringify(x));
 assert.equal(errors.length,0,errors.join("; "));
 console.log("[PASS] No mobile overflow or browser JavaScript errors");
 console.log("ALL GIF UI TESTS PASSED");
}finally{await browser.close();}

