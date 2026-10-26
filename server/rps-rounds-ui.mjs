import assert from "node:assert/strict";
import {chromium} from "playwright-core";
const base=process.env.C2P_BASE_URL||"http://127.0.0.1:3003/";
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,
 args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})));
const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
const errors=[];for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
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
 await a.getByText("Choose how many wins").first().waitFor({timeout:8000});
 for(const value of ["5 wins","10 wins","3 wins"]){
  const button=a.getByRole("button",{name:value}).first();
  await button.click();
  await button.waitFor({state:"visible"});
  assert.equal(await button.getAttribute("aria-pressed"),"true",value+" preselection did not stay selected");
 }
 await a.getByRole("button",{name:"Load 3D game"}).first().click();
 await Promise.all([a.locator(".rps-full-overlay[role=dialog]").waitFor({timeout:19000}),
   b.locator(".rps-full-overlay[role=dialog]").waitFor({timeout:19000})]);
 await Promise.all([a.locator(".rps-loading-overlay:visible").first().waitFor({state:"hidden",timeout:35000}),
   b.locator(".rps-loading-overlay:visible").first().waitFor({state:"hidden",timeout:35000})]);
 for(const page of [a,b]){
  const overlay=await page.locator(".rps-full-overlay").boundingBox();
  assert.ok(overlay&&overlay.x<=1&&overlay.y<=1&&overlay.width>=389&&overlay.height>=843,"RPS game does not fill the viewport");
 }
 const scores=async()=>a.locator(".rps-stage-hud:visible span").allTextContents();
 for(let i=1;i<=3;i++){
  const chooseA=a.getByRole("button",{name:"Choose rock"}).first();
  const chooseB=b.getByRole("button",{name:"Choose scissors"}).first();
  await Promise.all([chooseA.waitFor({state:"visible",timeout:9500}),chooseB.waitFor({state:"visible",timeout:9500})]);
  await a.waitForFunction(round=>document.querySelector(".rps-stage-status")?.textContent?.includes("Round "+round),i,{timeout:12000});
  await a.evaluate(()=>{
   const trace={beats:[],actions:[]};window.__rpsTrace=trace;
   const capture=()=>{
    const word=document.querySelector(".rps-chant-word"),beat=word?.getAttribute("data-beat");
    if(beat&&trace.beats.at(-1)?.beat!==beat)trace.beats.push({beat,word:word.textContent});
    const action=document.querySelector(".rps-scene-pov")?.getAttribute("data-action0");
    if(action&&trace.actions.at(-1)!==action)trace.actions.push(action);
   };
   const observer=new MutationObserver(capture);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-beat","data-action0"]});
   window.__rpsObserver=observer;capture();
  });
  await Promise.all([chooseA.click(),chooseB.click()]);
  // The selected signs and result appear only after the third beat lands.
  await a.locator(".rps-stage-status:visible").filter({hasText:"You won this round"}).first().waitFor({timeout:14500});
  await b.locator(".rps-stage-status:visible").filter({hasText:"partner won this round"}).first().waitFor({timeout:14500});
  const trace=await a.evaluate(()=>{window.__rpsObserver?.disconnect();return window.__rpsTrace;});
  assert.deepEqual(trace.beats,[{beat:"1",word:"Bato!"},{beat:"2",word:"Bato!"},{beat:"3",word:"Pick!"}],"The three words did not appear in order: "+JSON.stringify(trace));
  assert.ok(trace.actions.includes("POVPump")&&trace.actions.includes("POVThrow"),"The hand missed a pump or the final throw: "+JSON.stringify(trace));
  const text=await scores();
  assert.ok(text[0].includes(String(i)),"Score did not increment to "+i+" "+JSON.stringify(text));
  await a.waitForTimeout(1000);
  assert.equal(await a.locator(".rps-scene-3d:visible").first().getAttribute("data-result"),"win");
  assert.equal(await b.locator(".rps-scene-3d:visible").first().getAttribute("data-result"),"lose");
  for(const [page,sign] of [[a,"POVRock"],[b,"POVScissors"]]){
   await page.waitForFunction(expected=>[...document.querySelectorAll(".rps-scene-3d")]
    .some(el=>el.getClientRects().length&&el.dataset.action0===expected&&el.dataset.phase==="revealed"),sign,{timeout:6000});
  }
  if(i===1){
   await a.getByRole("button",{name:"Back to chat"}).click();
   assert.equal(await a.locator(".rps-full-overlay").count(),0,"Back did not return to chat");
   assert.ok(await a.locator(".composer textarea").isVisible(),"Chat is hidden after Back");
   await b.locator(".rps-full-status.is-paused").filter({hasText:"Your partner is outside the game"}).waitFor({timeout:3000});
   await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-paused-partner.png"});
   await a.getByRole("button",{name:/Return to game/}).filter({hasText:"Return to game"}).waitFor({timeout:3000});
   await a.waitForTimeout(1200);
   assert.ok((await b.locator(".rps-stage-status").textContent())?.includes("Game paused"),"The partner's match advanced while paused");
   await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-back-to-chat.png"});
   await a.getByRole("button",{name:/Return to game/}).click();
   await a.locator(".rps-full-overlay").waitFor({timeout:8000});
  }
  console.log("PASS RPS round",i,"of 3, score",JSON.stringify(text));
 }
 await a.getByText("MATCH WINNER!",{exact:false}).first().waitFor({timeout:8000});
 await b.locator(".rps-full-finish:visible").first().waitFor({timeout:8000});
 await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-three-rounds-winner.png"});
 await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-three-rounds-loser.png"});
 await a.getByRole("button",{name:"Arena view"}).first().click();
 await a.waitForFunction(()=>[...document.querySelectorAll(".rps-scene-3d")]
  .some(el=>el.getClientRects().length&&el.querySelector("canvas")&&!el.classList.contains("rps-scene-pov")
   &&el.dataset.characterSource==="blender-glb"&&el.dataset.renderer==="three"),null,{timeout:35000});
 await a.locator('.rps-scene-arena .rps-arena-sign:not([hidden])').first().waitFor({timeout:12000});
 assert.deepEqual(await a.locator('.rps-scene-arena .rps-arena-sign:not([hidden])').evaluateAll(els=>els.map(el=>el.getAttribute('data-choice'))),['rock','scissors']);
 await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-arena-matched.png"});
 assert.equal(errors.length,0,"Client JS errors: "+errors.join(";"));
 console.log("ALL THREE SERVER-CLOCKED RPS ROUNDS PASSED; FULL FIRST-TO-3 MATCH COMPLETE");
}catch(e){console.error("FAIL",String(e),"page errors",errors);
 console.error("scene state",await a.locator(".rps-scene-3d").first().evaluate(el=>({error:el.dataset.assetError,fallback:el.dataset.fallback,source:el.dataset.characterSource,renderer:el.dataset.renderer,canvas:el.querySelectorAll("canvas").length,rect:el.getBoundingClientRect().toJSON(),text:el.textContent})).catch(()=>null));
 await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/rps-rounds-failure.png"}).catch(()=>{});process.exitCode=1}
finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
