import assert from "node:assert/strict";
import {chromium} from "playwright-core";
const TEST_BASE_URL=process.env.LIVE_TEST_URL || "http://localhost:5173/";
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
for(const [width,height] of [[390,844],[320,568],[768,1024]]){
 const mobile=width<700;
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[];for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
 try{
  await Promise.all([a.goto(TEST_BASE_URL,{waitUntil:"domcontentloaded",timeout:18000}),b.goto(TEST_BASE_URL,{waitUntil:"domcontentloaded",timeout:18000})]);
  for(const page of [a,b]){
   await page.locator(".online-status strong").waitFor({timeout:10000});
   const pager=page.locator(".home-pager-next");
   if(await pager.isVisible())for(let i=0;i<3;i++)await pager.click();
   const consent=page.locator(".consent input");
   if(await consent.isVisible())await consent.check();
  }
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:15000}),b.locator(".partner-name-button").waitFor({timeout:15000})]);
  const open=a.getByRole("button",{name:"Open mini games"});
  if(await open.isVisible())await open.click();
  await a.getByRole("button",{name:/Ping Pong.*Live arcade battle/}).first().click();
  await a.getByRole("button",{name:"Send invitation"}).click();
  const acceptance=b.getByRole("button",{name:"Accept invitation"}).first();
  await acceptance.waitFor({timeout:8000});await acceptance.click();
  await Promise.all([a.getByRole("dialog",{name:"Ping Pong"}).waitFor({timeout:12000}),b.getByRole("dialog",{name:"Ping Pong"}).waitFor({timeout:12000})]);
  for(const p of [a,b]){
   const dlg=p.getByRole("dialog",{name:"Ping Pong"});
   const canvas=dlg.locator(".pong-canvas");
   await canvas.waitFor();
   const bounds=await canvas.boundingBox();
   assert.ok(bounds&&bounds.height>bounds.width*1.15,"Court is not vertical "+JSON.stringify(bounds));
   assert.equal(await dlg.getByText("One ball. Two rivals.").count(),0);
   assert.equal(await dlg.getByText("MATCH IN PROGRESS").count(),0);
   assert.equal(await dlg.locator(".pong-scorebar").count(),0);
   assert.equal(await dlg.locator(".pong-floating-scores").count(),1);
   assert.equal(await dlg.locator(".pong-floating-score.self").getByText("YOU").count(),1);
   assert.equal(await dlg.locator(".pong-floating-score.opponent").getByText("STRANGER").count(),1);
   const overlay=await dlg.locator(".pong-floating-scores").evaluate(e=>({z:getComputedStyle(e).zIndex,position:getComputedStyle(e).position,top:e.getBoundingClientRect().top,court:e.parentElement.getBoundingClientRect().top}));
   assert.ok(Number(overlay.z)>=5&&overlay.position==="absolute"&&overlay.top>=overlay.court);
   const overflow=await p.evaluate(()=>({h:document.documentElement.scrollHeight,vh:innerHeight,w:document.documentElement.scrollWidth,vw:innerWidth}));
   assert.ok(overflow.w<=overflow.vw+2&&overflow.h<=overflow.vh+2,"Viewport overflow "+JSON.stringify(overflow));
  }
  const one=a.locator(".pong-canvas"),two=b.locator(".pong-canvas");
  const orientations=[await one.getAttribute("data-perspective"),await two.getAttribute("data-perspective")];
  assert.equal(new Set(orientations).size,2,"Both sides received identical perspective");
  async function movePaddle(p,normalizedX){
   const bounds=await p.locator(".pong-canvas").boundingBox();
   await p.mouse.move(bounds.x+bounds.width*normalizedX,bounds.y+bounds.height*.78);
   await p.mouse.down();await p.mouse.up();
  }
  await movePaddle(a,.22);
  await a.waitForTimeout(380);
  await a.waitForFunction(()=>Number(document.querySelector(".pong-canvas")?.dataset.selfPaddleX)<.31,null,{timeout:6500});
  await b.waitForFunction(()=>Number(document.querySelector(".pong-canvas")?.dataset.opponentPaddleX)>.69,null,{timeout:6500});
  await movePaddle(b,.79);
  await b.waitForTimeout(380);
  await b.waitForFunction(()=>Number(document.querySelector(".pong-canvas")?.dataset.selfPaddleX)>.68,null,{timeout:6500});
  await a.waitForFunction(()=>Number(document.querySelector(".pong-canvas")?.dataset.opponentPaddleX)<.32,null,{timeout:6500});
  const positions=await Promise.all([a,b].map(p=>p.locator(".pong-canvas").evaluate(el=>({self:el.dataset.selfPaddleX,opponent:el.dataset.opponentPaddleX,ball:[el.dataset.ballX,el.dataset.ballY]}))));
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/pong-vertical-"+width+"-a.png"});
  await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/pong-vertical-"+width+"-b.png"});
  assert.equal(errors.length,0,errors.join("\n"));
  console.log("PASS",width+"x"+height,"both vertical views / mirror roles / horizontal movement / floating scores",JSON.stringify(positions));
 }catch(err){
  console.error("FAIL",width+"x"+height,String(err));
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/pong-debug-"+width+".png"}).catch(()=>{});
  process.exitCode=1;
 }finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();
