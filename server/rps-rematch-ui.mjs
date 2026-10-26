import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const base=process.env.C2P_BASE_URL||"http://127.0.0.1:5173/";
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,
 args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})));
const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
const errors=[];for(const p of [a,b])p.on("pageerror",error=>errors.push(error.message));
try{
 await Promise.all([a.goto(base,{waitUntil:"domcontentloaded"}),b.goto(base,{waitUntil:"domcontentloaded"})]);
 for(const p of [a,b]){
  await p.locator(".online-status strong").waitFor({timeout:14000});
  for(let i=0;i<3;i++)await p.locator(".home-pager-next").click();
  await p.locator(".consent input").check();
 }
 await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
 await Promise.all([a.locator(".partner-name-button").waitFor({timeout:17000}),b.locator(".partner-name-button").waitFor({timeout:17000})]);
 await a.getByRole("button",{name:"Open mini games"}).click();
 await a.locator(".game-sidebar-open .sidebar-game").filter({hasText:"Rock Paper Scissors"}).click();
 await b.getByRole("button",{name:"Accept invitation"}).first().click();
 await a.getByRole("button",{name:"Custom"}).first().click();
 await a.getByRole("spinbutton",{name:"Custom target wins"}).fill("1");
 await a.getByRole("button",{name:"Load 3D game"}).first().click();
 const awaitReady=async()=>{
  await Promise.all([a.locator(".rps-loading-overlay:visible").first().waitFor({timeout:15000}),
   b.locator(".rps-loading-overlay:visible").first().waitFor({timeout:15000})]);
  await Promise.all([a.locator(".rps-loading-overlay:visible").first().waitFor({state:"hidden",timeout:35000}),
   b.locator(".rps-loading-overlay:visible").first().waitFor({state:"hidden",timeout:35000})]);
  await Promise.all([a.getByRole("button",{name:"Choose rock"}).first().waitFor({state:"visible",timeout:10000}),
   b.getByRole("button",{name:"Choose scissors"}).first().waitFor({state:"visible",timeout:10000})]);
 };
 const playAndFinish=async()=>{
  await awaitReady();
  await Promise.all([a.getByRole("button",{name:"Choose rock"}).first().click(),
   b.getByRole("button",{name:"Choose scissors"}).first().click()]);
  await Promise.all([a.getByText("MATCH WINNER!",{exact:false}).first().waitFor({timeout:18000}),
   b.locator(".rps-full-finish:visible").first().waitFor({timeout:18000})]);
 };
 await playAndFinish();
 await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-shared-pov.png"});
 await a.evaluate(()=>{window.__rpsOriginalCanvas=document.querySelector('.rps-scene-3d canvas');});
 await a.getByRole("button",{name:"Arena view"}).first().click();
 await a.waitForFunction(()=>{
  const stage=document.querySelector(".rps-scene-arena");
  return stage?.dataset.characterSource==="blender-glb"&&stage?.dataset.renderer==="three";
 },null,{timeout:35000});
 const signs=await a.locator(".rps-scene-arena .rps-arena-sign:not([hidden])").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("data-choice")));
 assert.deepEqual(signs,["rock","scissors"]);
 assert.ok(await a.evaluate(()=>document.querySelector('.rps-scene-3d canvas')===window.__rpsOriginalCanvas),"Switching camera rebuilt the 3D scene");
 assert.deepEqual(await a.locator(".rps-scene-arena .rps-arena-sign:not([hidden])").allTextContents(),["",""],"Floating signs should have no card names");
 await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-arena-matched.png"});
 await a.getByRole("button",{name:"Request rematch"}).click();
 await a.getByText("Waiting for partner",{exact:false}).first().waitFor({timeout:6000});
 await b.getByRole("button",{name:/Accept rematch/}).click();
 await playAndFinish();
 assert.ok((await a.locator(".rps-stage-hud span").first().textContent())?.includes("1"),"Accepted rematch did not reset and replay the match");
 console.log("PASS mutual rematch: two acceptances start a new match");
 await b.getByRole("button",{name:"Request rematch"}).click();
 await a.getByRole("button",{name:/Accept rematch/}).waitFor({timeout:3000});
 await a.getByRole("button",{name:"Back to chat"}).first().click();
 await a.locator(".rps-return-to-game").filter({hasText:"Your partner requested a rematch"}).waitFor({timeout:3000});
 await Promise.all([a.locator(".rps-full-overlay").waitFor({state:"detached",timeout:13000}),
  b.locator(".rps-full-overlay").waitFor({state:"detached",timeout:13000})]);
 await Promise.all([a.locator(".toast").filter({hasText:"Rematch request expired"}).waitFor({timeout:3000}),
  b.locator(".toast").filter({hasText:"Rematch request expired"}).waitFor({timeout:3000})]);
 assert.equal(errors.length,0,"Browser errors: "+errors.join("; "));
 console.log("PASS 10-second rematch expiry: both players return to chat with notification");
}catch(error){
 console.error("FAIL",String(error),"browser errors",errors);
 await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-rematch-failure.png"}).catch(()=>{});
 process.exitCode=1;
}finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
