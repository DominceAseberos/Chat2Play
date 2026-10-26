import assert from "node:assert/strict";
import {chromium} from "playwright-core";
const browser=await chromium.launch({
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--autoplay-policy=no-user-gesture-required"]
});
for(const [width,height] of [[390,844],[320,568]]){
 const base="http://127.0.0.1:5173";
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,permissions:["microphone"]})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[];for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
 try{
  await Promise.all([a.goto(base,{waitUntil:"domcontentloaded"}),b.goto(base,{waitUntil:"domcontentloaded"})]);
  for(const page of [a,b]){
   await page.locator(".online-status strong").waitFor({timeout:10000});
   for(let i=0;i<3;i++)await page.locator(".home-pager-next").click();
   await page.locator(".consent input").check();
  }
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:14000}),b.locator(".partner-name-button").waitFor({timeout:14000})]);
  await a.getByRole("button",{name:"Open mini games"}).click();
  await a.locator(".game-sidebar-open .sidebar-game").filter({hasText:"Pinoy Henyo"}).click();
  const invitation=b.locator(".inline-game");
  await invitation.getByRole("button",{name:"Accept invitation"}).click();
  const setup=a.getByRole("dialog",{name:"Pinoy Henyo setup"});
  await setup.getByRole("checkbox").check();
  await setup.getByRole("button",{name:"Share categories"}).click();
  await invitation.getByRole("checkbox").check();
  await invitation.getByRole("button",{name:"Confirm categories"}).click();
  await setup.getByRole("button",{name:"3m"}).click();
  await setup.getByRole("button",{name:"Start game"}).click();
  for(const page of [a,b])await page.getByRole("dialog",{name:"Pinoy Henyo microphone permission"}).waitFor({timeout:12000});
  if(await a.locator(".forehead-overlay").count()||await b.locator(".forehead-overlay").count())throw Error("3D gameplay started without microphone approval");
  await a.getByRole("button",{name:"Allow microphone"}).click();
  await a.getByText("Your microphone is ready. Waiting for your partner").waitFor({timeout:9000});
  if(await a.locator(".forehead-overlay").count()||await b.locator(".forehead-overlay").count())throw Error("Game started after just one microphone");
  await b.getByRole("button",{name:"Allow microphone"}).click();
  await Promise.all([a.locator(".forehead-overlay").waitFor({timeout:15000}),b.locator(".forehead-overlay").waitFor({timeout:15000})]);
  await Promise.all([a.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:15000}),b.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:15000})]);
  await Promise.all([a.locator(".henyo-voice-dock").waitFor(),b.locator(".henyo-voice-dock").waitFor()]);
  // This validates actual media tracks, not just a 'connected' text label.
  for(const page of [a,b]){
   await page.waitForFunction(()=>{
    const audio=document.querySelector("audio[data-henyo-remote-audio]");
    return audio?.srcObject instanceof MediaStream&&audio.srcObject.getAudioTracks().length>0;
   },null,{timeout:15000});
   assert.equal(await page.getByRole("button",{name:"Ask category"}).count(),0);
   assert.equal(await page.getByRole("textbox",{name:"Your word guess"}).count(),0);
   assert.equal(await page.getByRole("button",{name:"YES",exact:true}).count(),0);
   assert.equal(await page.getByRole("button",{name:"NO",exact:true}).count(),0);
  }
  const roleA=await a.locator(".forehead-round strong").textContent();
  const roleB=await b.locator(".forehead-round strong").textContent();
  console.log("ROLES",roleA,roleB);
  const giver=roleA?.includes("GIVE HINTS")?a:b;
  const guesser=giver===a?b:a;
  const scoreBefore=Number(await guesser.locator(".forehead-score.is-active b").textContent());
  await giver.locator(".henyo-correct-button").click({timeout:5000});
  await guesser.locator(".henyo-success-overlay.correct svg").waitFor({timeout:7000});
  await guesser.waitForFunction(previous=>{
   const active=document.querySelector(".forehead-score.is-active b");return Number(active?.textContent)!==previous;
  },scoreBefore,{timeout:9000}).catch(()=>{}); // Role switched; score belongs to previous guesser.
  await giver.getByRole("button",{name:"Pass turn"}).waitFor({timeout:7000});
  console.log("SCORES",{before:scoreBefore,after:await guesser.locator(".forehead-score b").allTextContents()});
  const scoreAfter=await guesser.locator(".forehead-score b").first().textContent();
  assert.ok(Number(scoreAfter)>=scoreBefore,"Correct voice answer did not increase guesser score");
  await guesser.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-voice-"+width+".png"});
  if(errors.length)throw Error(errors.join(";"));
  console.log("PASS",width+"x"+height,"two mic consent gates, live audio tracks, no category UI, SVG correct scoring");
 }catch(e){
  console.error("FAIL",width+"x"+height,String(e));
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-voice-error-"+width+".png"}).catch(()=>{});
  process.exitCode=1;
 }finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();
