import assert from "node:assert/strict";
import {chromium} from "playwright-core";
const base=process.env.C2P_BASE_URL||"http://127.0.0.1:3002/";
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,
 args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
const onlyWidth=process.env.C2P_TEST_WIDTH;
const pairs=[[320,568],[390,844],[768,1024],[1024,768]].filter(([width])=>!onlyWidth||String(width)===onlyWidth);
async function joined(size){
 const [width,height]=size,mobile=width<700;
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[];for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
 try{
  await Promise.all([a.goto(base,{waitUntil:"domcontentloaded",timeout:24000}),b.goto(base,{waitUntil:"domcontentloaded",timeout:24000})]);
  for(const p of [a,b]){
   await p.locator(".online-status strong").waitFor({timeout:14000});
   const next=p.locator(".home-pager-next");if(await next.isVisible())for(let i=0;i<3;i++)await next.click();
   const consent=p.locator(".consent input");if(await consent.isVisible())await consent.check();
  }
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:18000}),b.locator(".partner-name-button").waitFor({timeout:18000})]);
  return {a,b,contexts,errors,width,height};
 }catch(e){await Promise.all(contexts.map(c=>c.close()));throw e;}
}
async function invite({a,b},name){
 const open=a.getByRole("button",{name:"Open mini games"});if(await open.isVisible())await open.click();
 const option=a.getByRole("button",{name:new RegExp(name)}).first();
 await option.waitFor({state:"visible",timeout:12000});
 await option.evaluate(el=>el.click());
 await b.getByRole("button",{name:"Accept invitation"}).first().waitFor({timeout:11000});
 await b.getByRole("button",{name:"Accept invitation"}).first().click();
}
for(const [width,height] of pairs){
 const ctx=await joined([width,height]);
 const {a,b,contexts,errors}=ctx;
 try{
  await invite(ctx,"Ping Pong");
  const da=a.getByRole("dialog",{name:"Ping Pong"}),db=b.getByRole("dialog",{name:"Ping Pong"});
  await Promise.all([da.waitFor({timeout:13000}),db.waitFor({timeout:13000})]);
  const sceneA=da.locator(".pong-scene-3d"),sceneB=db.locator(".pong-scene-3d");
  await Promise.all([sceneA.waitFor(),sceneB.waitFor()]);
  await Promise.all([a.waitForFunction(()=>document.querySelector(".pong-scene-3d")?.dataset.renderer==="three",{},{timeout:14000}),
   b.waitForFunction(()=>document.querySelector(".pong-scene-3d")?.dataset.renderer==="three",{},{timeout:14000})]);
  await Promise.all([da.locator(".pong-load-screen").waitFor({state:"hidden",timeout:14000}),
   db.locator(".pong-load-screen").waitFor({state:"hidden",timeout:14000})]);
  const values=await Promise.all([sceneA.evaluate(el=>({calls:Number(el.dataset.drawCalls),canvasCount:el.querySelectorAll("canvas").length,
   width:el.clientWidth,height:el.clientHeight,me:el.dataset.selfPaddleX,opponent:el.dataset.opponentPaddleX,side:el.dataset.perspective})),
   sceneB.evaluate(el=>({calls:Number(el.dataset.drawCalls),canvasCount:el.querySelectorAll("canvas").length,
   width:el.clientWidth,height:el.clientHeight,me:el.dataset.selfPaddleX,opponent:el.dataset.opponentPaddleX,side:el.dataset.perspective}))]);
  for(const v of values)assert.ok(v.canvasCount===1&&v.calls<100&&v.height>v.width*1.1,"Pong 3D performance/orientation "+JSON.stringify(v));
  assert.notEqual(values[0].side,values[1].side);
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/test-3d-pong-"+width+"-center.png"});
  const box=await sceneA.boundingBox();
  const controlY=box.y+box.height*.84;
  await a.mouse.move(box.x+box.width*.72,controlY);
  await a.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.selfPaddleX)>.62,null,{timeout:7000});
  await b.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.opponentPaddleX)<.38,null,{timeout:7000});
  if(width<700){
   await a.touchscreen.tap(box.x+box.width*.35,controlY);
   await a.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.selfPaddleX)<.44,null,{timeout:7000});
   await b.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.opponentPaddleX)>.56,null,{timeout:7000});
  }
  await a.mouse.move(box.x+box.width*.18,box.y+box.height*.84);await a.mouse.down();await a.mouse.up();
  await a.waitForTimeout(380);
  await a.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.selfPaddleX)<.29,null,{timeout:7000});
  await b.waitForFunction(()=>Number(document.querySelector(".pong-scene-3d")?.dataset.opponentPaddleX)>.70,null,{timeout:7000});
  const dragAndMeasure=async(from,to)=>{
   let min=Infinity,max=-Infinity;
   const y=box.y+box.height*.84;
   await a.mouse.move(box.x+box.width*from,y);await a.mouse.down();
   for(let i=1;i<=12;i++){
    await a.mouse.move(box.x+box.width*(from+(to-from)*i/12),y);
    await a.waitForTimeout(25);
    const tilt=Number(await sceneA.getAttribute("data-self-paddle-tilt"));
    min=Math.min(min,tilt);max=Math.max(max,tilt);
   }
   const beforeRelease=Number(await sceneA.getAttribute("data-self-paddle-tilt"));
   await a.mouse.up();await a.waitForTimeout(60);
   const afterRelease=Number(await sceneA.getAttribute("data-self-paddle-tilt"));
   return {min,max,beforeRelease,afterRelease};
  };
  const right=await dragAndMeasure(.18,.82);
  assert.ok(right.min<-.08,"Paddle should lean right while moving right: "+JSON.stringify(right));
  assert.ok(Math.abs(right.afterRelease)<Math.abs(right.beforeRelease)+.01,
   "Right lean should ease back after release: "+JSON.stringify(right));
  await a.waitForTimeout(350);
  const left=await dragAndMeasure(.82,.18);
  assert.ok(left.max>.08,"Paddle should lean left while moving left: "+JSON.stringify(left));
  assert.ok(Math.abs(left.afterRelease)<Math.abs(left.beforeRelease)+.01,
   "Left lean should ease back after release: "+JSON.stringify(left));
  await a.waitForTimeout(500);
  assert.ok(Math.abs(Number(await sceneA.getAttribute("data-self-paddle-tilt")))<.05,"Paddle should return upright when still");
  console.log("PASS 3D Pong",width,height,JSON.stringify({views:values,right,left}));
  if(errors.length)throw Error(errors.join(";"));
 }catch(e){console.error("FAIL 3D Pong",width,height,String(e));await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/fail-pong-"+width+".png"}).catch(()=>{});process.exitCode=1}
 finally{await Promise.all(contexts.map(c=>c.close()));}
}
// Rock Paper Scissors pairs
if(process.env.C2P_ONLY_GAME!=="pong")for(const [width,height] of [[320,568],[390,844],[768,1024]].filter(([width])=>!onlyWidth||String(width)===onlyWidth)){
 const ctx=await joined([width,height]);
 const {a,b,contexts,errors}=ctx;
 try{
  await invite(ctx,"Rock Paper Scissors");
  // The inviter chooses the match length before either 3D scene loads.
  await a.getByRole("button",{name:/Load 3D game/i}).click();
  await Promise.all([a.locator(".rps-scene-3d:visible").first().waitFor({timeout:16000}),b.locator(".rps-scene-3d:visible").first().waitFor({timeout:16000})]);
  await Promise.all([a.waitForFunction(()=>[...document.querySelectorAll(".rps-scene-3d")].some(e=>e.getClientRects().length&&e.dataset.renderer==="three"),null,{timeout:12000}),
   b.waitForFunction(()=>[...document.querySelectorAll(".rps-scene-3d")].some(e=>e.getClientRects().length&&e.dataset.renderer==="three"),null,{timeout:12000})]);
  for(const p of [a,b]){
   const scene=p.locator(".rps-scene-3d:visible").first();
   const info=await scene.evaluate(el=>({canvas:el.querySelectorAll("canvas").length,calls:Number(el.dataset.drawCalls)}));
   assert.ok(info.canvas===1&&info.calls<190,"RPS performance: "+JSON.stringify(info));
  }
  await a.getByRole("button",{name:"Choose rock"}).first().click();
  await b.getByRole("button",{name:"Choose scissors"}).first().click();
  for(const p of [a,b]){
   await p.waitForFunction(()=>[...document.querySelectorAll(".rps-scene-3d")].some(el=>el.getClientRects().length&& (el.dataset.result==="win"||el.dataset.result==="lose")),null,{timeout:10000});
   const sc=await p.locator(".rps-scene-3d:visible").first().getAttribute("data-result");
   if((p===a&&sc!=="win")||(p===b&&sc!=="lose"))throw Error("Wrong client RPS result "+sc);
  }
  await a.waitForTimeout(1300);
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/test-3d-rps-"+width+"-winner.png"});
  await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/test-3d-rps-"+width+"-loser.png"});
  if(errors.length)throw Error(errors.join(";"));
  console.log("PASS 3D Rock Paper Scissors",width,height,"win and lose reactions, authoritative result");
 }catch(e){console.error("FAIL 3D RPS",width,height,String(e));await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/fail-rps-"+width+".png"}).catch(()=>{});process.exitCode=1}
 finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();
