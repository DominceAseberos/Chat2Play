import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const browser=await chromium.launch({headless:true,
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
try{
 const pages=await Promise.all([0,1].map(async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto(process.env.C2P_BASE_URL||"http://127.0.0.1:3003/",{waitUntil:"domcontentloaded"});
  await page.locator(".online-status strong").waitFor();
  const next=page.locator(".home-pager-next");
  if(await next.isVisible())for(let i=0;i<3;i++)await next.click();
  const consent=page.locator(".consent input");if(await consent.isVisible())await consent.check();
  return page;
 }));
 const [a,b]=pages;
 await Promise.all(pages.map(p=>p.getByRole("button",{name:"Find a stranger"}).click()));
 await Promise.all(pages.map(p=>p.locator(".partner-name-button").waitFor()));
 const open=a.getByRole("button",{name:"Open mini games"});
 if(await open.isVisible())await open.click();
 await a.locator(".sidebar-game").filter({hasText:"Ping Pong"}).filter({visible:true}).first().click();
 await a.getByRole("button",{name:"Send invitation"}).click();
 await b.getByRole("button",{name:"Accept invitation"}).first().click();
 await Promise.all(pages.map(p=>p.locator(".pong-scene-3d").waitFor()));
 await Promise.all(pages.map(p=>p.locator(".pong-load-screen").waitFor({state:"hidden",timeout:20000})));
 await a.waitForFunction(()=>document.querySelector(".pong-serve-note strong")?.textContent==="Serve!",null,{timeout:8000});
 const server=await a.locator(".pong-swipe-hud").textContent().then(s=>s.includes("SWIPE FORWARD"))?a:b;
 const scene=server.locator(".pong-scene-3d"),rect=await scene.boundingBox();
 assert.ok(rect,"The serving scene must be visible");
 const cx=rect.x+rect.width*.5,cy=rect.y+rect.height*.65;
 await server.mouse.move(cx,cy);await server.mouse.down();
 await server.mouse.move(cx+rect.width*.1,cy,{steps:4});
 await server.mouse.move(cx,cy,{steps:4});await server.mouse.up();
 await server.waitForTimeout(200);
 assert.equal(await scene.getAttribute("data-serve-pending"),"true",
  "A sideways stroke must leave the serve staged");
 await server.mouse.move(cx,cy);await server.mouse.down();
 await server.mouse.move(cx,cy-rect.height*.28,{steps:8});await server.mouse.up();
 await server.waitForFunction(()=>document.querySelector(".pong-scene-3d")?.dataset.servePending==="false",
  null,{timeout:5000});
 await (server===a?b:a).waitForFunction(()=>
  document.querySelector(".pong-scene-3d")?.dataset.servePending==="false",null,{timeout:5000});
 console.log("PASS: both mobile clients see a held ball, sideways drag does not serve, forward contact launches immediately");
}finally{await browser.close();}
