import assert from "node:assert/strict";
import {chromium} from "playwright-core";
const base=process.env.C2P_BASE_URL||"http://127.0.0.1:3003/";
const small=process.argv.includes("--small");
const tablet=process.argv.includes("--tablet");
const landscape=process.argv.includes("--landscape");
const width=tablet?(landscape?1024:768):small?320:390;
const height=tablet?(landscape?768:1024):small?568:844;
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
async function meet(){
 const ctx=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true})));
 const [a,b]=await Promise.all(ctx.map(c=>c.newPage()));
 const errors=[];for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
 await Promise.all([a.goto(base,{waitUntil:"domcontentloaded",timeout:18000}),b.goto(base,{waitUntil:"domcontentloaded",timeout:18000})]);
 for(const p of [a,b]){
  await p.locator(".online-status strong").waitFor({timeout:18000});
  const next=p.locator(".home-pager-next");
  if(await next.isVisible())for(let i=0;i<3;i++)await next.click();
  const consent=p.locator(".consent input");if(await consent.isVisible())await consent.check();
 }
 await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
 await Promise.all([a.locator(".partner-name-button").waitFor({timeout:19000}),b.locator(".partner-name-button").waitFor({timeout:19000})]);
 return {a,b,ctx,errors};
}
async function invite(a,b,name){
 const open=a.getByRole("button",{name:"Open mini games"});
 if(await open.isVisible())await open.click();
 await a.locator(".sidebar-game").filter({hasText:name}).filter({visible:true}).first().click();
 await b.getByRole("button",{name:"Accept invitation"}).first().waitFor({timeout:8000});
 await b.getByRole("button",{name:"Accept invitation"}).first().click();
}
try{
 const {a,b,ctx,errors}=await meet();
 try{
  await invite(a,b,"Ping Pong");
  const sa=a.locator(".pong-scene-3d"),sb=b.locator(".pong-scene-3d");
  await Promise.all([sa.waitFor({timeout:16000}),sb.waitFor({timeout:16000})]);
  await Promise.all([a.waitForFunction(()=>document.querySelector(".pong-scene-3d")?.dataset.renderer==="three",{},{timeout:11000}),
    b.waitForFunction(()=>document.querySelector(".pong-scene-3d")?.dataset.renderer==="three",{},{timeout:11000})]);
  try{
   await a.locator(".pong-load-screen").waitFor({state:"hidden",timeout:16000});
   await b.locator(".pong-load-screen").waitFor({state:"hidden",timeout:16000});
  }catch(error){
   console.error("PONG LOAD STATE",await Promise.all([a,b].map(page=>page.evaluate(()=>({
    scenes:[...document.querySelectorAll(".pong-scene-3d")].map(el=>({
     renderer:el.dataset.renderer,model:el.dataset.paddleModel,ready:el.dataset.sceneReadySent,
     parent:el.parentElement?.className})),
    loading:[...document.querySelectorAll(".pong-load-screen")].map(el=>({
     text:el.textContent,visible:!!el.getClientRects().length,
     parent:el.parentElement?.className})),
    dialogs:[...document.querySelectorAll('[role="dialog"]')].map(el=>el.getAttribute("aria-label"))
   })))),errors);
   throw error;
  }
  console.log("PASS PONG scene ready on both players");
  assert.equal(await sa.getAttribute("data-paddle-model"),"blender",
   "The Blender paddle should load in the game");
  assert.ok(Number(await sa.getAttribute("data-self-paddle-reach"))<.05,
   "The paddle should start behind the near edge of the board");
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/swipe-pong-rest-center-"+width+".png"});
  await sa.evaluate(el=>{
   window.__pongMaxPower=0;
   new MutationObserver(()=>{window.__pongMaxPower=Math.max(window.__pongMaxPower,
    Number(el.dataset.power)||0);}).observe(el,{attributes:true,attributeFilter:["data-power"]});
  });
  const rect=await sa.boundingBox();
  await a.mouse.move(rect.x+rect.width*.30,rect.y+rect.height*.70);
  await a.mouse.down();await a.waitForTimeout(450);
  assert.equal(Number(await sa.getAttribute("data-power")),0,"A stationary press must not charge power");
  await a.mouse.move(rect.x+rect.width*.44,rect.y+rect.height*.70);
  await a.mouse.move(rect.x+rect.width*.66,rect.y+rect.height*.70);
  await a.mouse.move(rect.x+rect.width*.82,rect.y+rect.height*.70);
  try{await a.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.selfPaddleX)>.68,
   null,{timeout:5000});}
  catch(error){console.error("PONG MOVE STATE",await sa.evaluate(el=>({
   x:el.dataset.selfPaddleX,dragging:el.dataset.dragging,power:el.dataset.power,
   reach:el.dataset.selfPaddleReach,model:el.dataset.paddleModel
  })));throw error;}
  const edge=await sa.evaluate(el=>({x:Number(el.dataset.selfPaddleX),roll:Number(el.dataset.paddleRoll)}));
  assert.ok(edge.x>.68,"Drag should move the paddle toward the right edge: "+JSON.stringify(edge));
  assert.ok(Math.abs(Math.abs(edge.roll)-Math.PI/2)>.35,
   "Paddle should rotate away from its upright center angle: "+JSON.stringify(edge));
  const powerHandle=await a.waitForFunction(()=>window.__pongMaxPower>.16?window.__pongMaxPower:false,
   null,{timeout:5000});
  const power=Number(await powerHandle.jsonValue());
  assert.ok(power>.16&&power<=1,"Drag power should rise with movement, got "+power);
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/swipe-pong-drag-"+width+".png"});
  await a.mouse.up();await a.waitForTimeout(75);
  assert.equal(await sa.getAttribute("data-dragging"),"false");
  console.log("PASS PONG stationary press stays weak; dragging generates strike power");
  await a.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.70);
  await a.mouse.down();
  await a.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.15);
  await a.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.selfPaddleReach)>.95,
   null,{timeout:5000});
  assert.ok(Number(await sa.getAttribute("data-paddle-base-z"))<.7,
   "At the net the paddle should leave the near edge visually");
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/swipe-pong-forward-"+width+".png"});
  await a.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.85);
  await a.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.selfPaddleReach)<.05,
   null,{timeout:5000});
  const resting=await sa.evaluate(el=>({reach:Number(el.dataset.selfPaddleReach),
   z:Number(el.dataset.paddleBaseZ),side:el.dataset.perspective}));
  assert.ok(resting.z>4.5,
   "At rest the paddle should sit outside the board visually: "+JSON.stringify(resting));
  await a.mouse.up();
  console.log("PASS PONG paddle advances to the net and retreats behind the board");
  await a.waitForTimeout(240);
  const ballHeight=Number(await sa.getAttribute("data-ball-height"));
  assert.ok(Number.isFinite(ballHeight)&&ballHeight>=.09,"Physical ball height missing "+ballHeight);
  assert.equal(await sa.locator("canvas").count(),1);
  const calls=Number(await sa.getAttribute("data-draw-calls"));
  assert.ok(calls<115,"WebGL mobile budget "+calls);
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/swipe-pong-release-"+width+".png"});
  console.log("PASS PONG physical height, 3D trail, swipe and graphics budget",calls);
  if(process.env.C2P_ONLY_GAME!=="pong"){
  await a.getByRole("button",{name:"End game"}).click();
  await a.getByRole("button",{name:"Quit game",exact:false}).last().click();
  await a.locator(".arcade-overlay").waitFor({state:"hidden",timeout:10000});
  await invite(a,b,"Rock Paper Scissors");
  const settings=a.locator(".rps-preselect:visible").first();
  await settings.getByText("Choose how many wins").waitFor({timeout:8000});
  assert.equal(await settings.getByRole("button",{name:"3 wins"}).count()>0,true);
  await settings.getByRole("button",{name:"Custom"}).click();
  await settings.getByRole("spinbutton",{name:"Custom target wins"}).fill("1");
  await settings.getByRole("button",{name:"Load 3D game"}).click();
  await Promise.all([a.locator(".rps-scene-3d:visible").first().waitFor({timeout:15000}),
   b.locator(".rps-scene-3d:visible").first().waitFor({timeout:15000})]);
  await Promise.all([a.locator(".rps-loading-overlay:visible").first().waitFor({state:"hidden",timeout:14000}),
    b.locator(".rps-loading-overlay:visible").first().waitFor({state:"hidden",timeout:14000})]);
  const choices=[a.locator(".rps-3d-game:visible").first().getByRole("button",{name:"Choose rock"}),
    b.locator(".rps-3d-game:visible").first().getByRole("button",{name:"Choose scissors"})];
  for(const b of choices)await b.waitFor({state:"visible",timeout:7000});
  await Promise.all(choices.map(x=>x.click()));
  await a.waitForFunction(()=>Array.from(document.querySelectorAll('button[aria-label="Choose rock"]')).some(el=>el instanceof HTMLButtonElement&&el.getClientRects().length&&el.disabled),null,{timeout:1800});
  console.log("ROUND START",await a.locator(".rps-stage-status:visible").allTextContents());
  console.log("PASS RPS both assets ready and choices locked during 3s");
  await Promise.all([a.locator(".rps-stage-status:visible").filter({hasText:"won this round"}).first().waitFor({timeout:8000}),
    b.locator(".rps-stage-status:visible").filter({hasText:"won this round"}).first().waitFor({timeout:8000})]);
  await a.waitForTimeout(1000);
  assert.equal(await a.locator(".rps-scene-3d:visible").first().getAttribute("data-result"),"win");
  assert.equal(await b.locator(".rps-scene-3d:visible").first().getAttribute("data-result"),"lose");
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-bestof-win-"+width+".png"});
  await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-bestof-lose-"+width+".png"});
  await a.locator(".rps-stage-status:visible").filter({hasText:"MATCH WINNER!"}).first().waitFor({timeout:7000});
  console.log("PASS RPS preselect custom target 1, 3-second simultaneous reveal, authoritative winner, expressions and match finish");
  }
  if(errors.length)throw Error("Browser page errors: "+errors.join(" | "));
 }finally{await Promise.all(ctx.map(c=>c.close()));}
}catch(e){console.error("TEST FAILED",e);process.exitCode=1;}
await browser.close();
