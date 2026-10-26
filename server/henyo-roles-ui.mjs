import assert from "node:assert/strict";
import {chromium} from "playwright-core";
const base=process.env.C2P_BASE_URL||"https://supplier-preserve-resulted-anywhere.trycloudflare.com/";
const browser=await chromium.launch({
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--autoplay-policy=no-user-gesture-required"]
});
const viewportArgs=process.argv.includes("--small")?[[320,568]]:[[390,844]];
for(const [width,height] of viewportArgs){
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({
  viewport:{width,height},isMobile:true,hasTouch:true,permissions:["microphone"]
 })));
 for(const ctx of contexts)await ctx.addInitScript(()=>{
  const media=navigator.mediaDevices;
  const original=media.getUserMedia.bind(media);
  Object.defineProperty(media,"getUserMedia",{configurable:true,value:async constraints=>{
   const stream=await original(constraints);
   window.__henyoTestTracks=stream.getAudioTracks();
   return stream;
  }});
 });
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errs=[];for(const p of [a,b])p.on("pageerror",e=>errs.push(e.message));
 const tracks=async(p)=>await p.evaluate(()=>window.__henyoTestTracks?.map(t=>t.enabled)??[]);
 try{
  await Promise.all([a.goto(base,{waitUntil:"domcontentloaded",timeout:23000}),b.goto(base,{waitUntil:"domcontentloaded",timeout:23000})]);
  for(const p of [a,b]){
   await p.locator(".online-status strong").waitFor({timeout:13000});
   const pager=p.locator(".home-pager-next");if(await pager.isVisible())for(let i=0;i<3;i++)await pager.click();
   const consent=p.locator(".consent input");if(await consent.isVisible())await consent.check();
  }
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:20000}),b.locator(".partner-name-button").waitFor({timeout:20000})]);
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
  await a.waitForFunction(()=>document.querySelector('[aria-label="Timer length"] button:nth-child(3)')?.getAttribute("aria-pressed")==="true");
  // CSS uses a short 160ms background transition; wait for its settled color.
  await a.waitForTimeout(240);
  const styled=await setup.evaluate(el=>{
   const selected=el.querySelector('.henyo-setup-time [aria-pressed="true"]');
   const unselected=el.querySelector('.henyo-setup-time button:first-child');
   return {radius:getComputedStyle(selected).borderRadius,
    selectedText:selected.textContent,otherText:unselected.textContent,
    selectedClass:selected.className,otherClass:unselected.className,
    bg:getComputedStyle(selected).backgroundColor,other:getComputedStyle(unselected).backgroundColor,
    accent:getComputedStyle(selected).getPropertyValue("--accent"),
    matching:[...document.styleSheets].flatMap(sheet=>{
     try{return [...sheet.cssRules]}catch{return []}
    }).filter(rule=>rule instanceof CSSStyleRule&&selected.matches(rule.selectorText)&&rule.style.background)
     .map(rule=>[rule.selectorText,rule.style.background]).slice(-12)};
  });
  console.log("STYLED",width,JSON.stringify(styled));
  assert.ok(parseInt(styled.radius)>=10,"Setup buttons are not rounded "+JSON.stringify(styled));
  assert.notEqual(styled.bg,styled.other,"Selected time does not look different");
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-role-setup-"+width+".png"});
  await setup.getByRole("button",{name:"Start game"}).click();
  for(const p of [a,b])await p.getByRole("dialog",{name:"Pinoy Henyo microphone permission"}).waitFor({timeout:12000});
  await a.getByRole("button",{name:"Allow microphone"}).click();
  await a.getByText("Your microphone is ready. Waiting for your partner").waitFor({timeout:9000});
  assert.deepEqual(await tracks(a),[false],"Permission leaked outgoing audio before match");
  await b.getByRole("button",{name:"Allow microphone"}).click();
  await Promise.all([a.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:19000}),b.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:19000})]);
  for(const p of [a,b]){
   await p.waitForFunction(()=>document.querySelector("audio[data-henyo-remote-audio]")?.srcObject?.getAudioTracks()?.length>0,null,{timeout:14000});
   assert.equal(await p.getByRole("button",{name:/^(?:YES|NO)(?:\b|\s)/i}).count(),0,"YES/NO button still visible");
   assert.equal(await p.locator(".henyo-gesture-actions").count(),0,"Gesture buttons still visible");
  }
  const roleA=await a.locator(".forehead-round strong").textContent();
  const giver=roleA?.includes("GIVE HINTS")?a:b,guesser=giver===a?b:a;
  await guesser.waitForFunction(()=>window.__henyoTestTracks?.[0]?.enabled===true,null,{timeout:9000});
  await giver.waitForFunction(()=>window.__henyoTestTracks?.[0]?.enabled===false,null,{timeout:9000});
  assert.deepEqual(await tracks(guesser),[true]);
  assert.deepEqual(await tracks(giver),[false]);
  assert.equal(await giver.locator(".henyo-correct-button").count(),1);
  const initialScore=await guesser.locator(".forehead-score b").first().textContent();
  // Hint giver swipes horizontally to SHAKE head, without a button.
  const canvas=giver.locator(".forehead-scene canvas");
  const rect=await canvas.boundingBox();
  assert.ok(rect&&rect.width>150);
  const cx=rect.x+rect.width*.50,cy=rect.y+rect.height*.54;
  await giver.mouse.move(cx,cy);await giver.mouse.down();
  await giver.mouse.move(cx+95,cy,{steps:6});await giver.mouse.up();
  await guesser.waitForFunction(()=>{
   const v=parseFloat(document.querySelector(".forehead-scene")?.dataset.headMotion??"0");
   return v>.13;
  },null,{timeout:5000});
  assert.equal(await guesser.locator(".forehead-score b").first().textContent(),initialScore,"Head shake scored a point");
  // Correct button is the ONLY score-awarding gesture.
  await giver.locator(".henyo-correct-button").click({timeout:6000});
  await guesser.locator(".henyo-success-overlay.correct svg").waitFor({timeout:8500});
  await giver.locator(".forehead-round strong").getByText("YOU GUESS").waitFor({timeout:9500});
  await guesser.locator(".forehead-round strong").getByText("GIVE HINTS").waitFor({timeout:9500});
  await giver.waitForFunction(()=>window.__henyoTestTracks?.[0]?.enabled===true,null,{timeout:8000});
  await guesser.waitForFunction(()=>window.__henyoTestTracks?.[0]?.enabled===false,null,{timeout:8000});
  assert.deepEqual(await tracks(giver),[true],"New guesser was not unmuted");
  assert.deepEqual(await tracks(guesser),[false],"New hint giver was not muted");
  assert.equal(Number(await guesser.locator(".forehead-score b").first().textContent()),Number(initialScore)+1,"Correct did not score");
  await giver.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-role-guess-"+width+".png"});
  await guesser.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-role-hints-"+width+".png"});
  if(errs.length)throw Error("Browser JS errors: "+errs.join(";"));
  console.log("PASS",width+"x"+height,"styled setup, no yes/no buttons, role-locked real audio, swipe head shake, correct +1, automatic microphone swap");
 }catch(e){
  console.error("FAIL",width+"x"+height,String(e));
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-role-failure-"+width+".png"}).catch(()=>{});
  process.exitCode=1;
 }finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();