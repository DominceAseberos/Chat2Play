import {chromium} from "playwright-core";
const browser=await chromium.launch({
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]
});
for(const [width,height] of [[390,844],[320,568]]){
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[];[a,b].forEach(p=>p.on("pageerror",e=>errors.push(e.message)));
 try{
  await Promise.all([a.goto("http://localhost:5173/",{waitUntil:"domcontentloaded",timeout:15000}),
   b.goto("http://localhost:5173/",{waitUntil:"domcontentloaded",timeout:15000})]);
  for(const page of [a,b]){
   await page.locator(".online-status strong").waitFor({timeout:8000});
   for(let i=0;i<3;i++)await page.locator(".home-pager-next").click();
   await page.locator(".consent input").check();
  }
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),
   b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:12000}),
   b.locator(".partner-name-button").waitFor({timeout:12000})]);
  await a.getByRole("button",{name:"Open mini games"}).click();
  await a.locator(".game-sidebar-open .sidebar-game").filter({hasText:"Pinoy Henyo"}).click();
  // The invitation is first: no category/timer dialog until player B accepts.
  const invitation=b.locator(".inline-game");
  await invitation.getByRole("button",{name:"Accept invitation"}).waitFor();
  if(await a.getByRole("dialog",{name:"Pinoy Henyo setup"}).count())throw Error("Setup appeared before partner accepted");
  await invitation.getByRole("button",{name:"Accept invitation"}).click();
  const setup=a.getByRole("dialog",{name:"Pinoy Henyo setup"});
  await setup.waitFor({timeout:9000});
  await setup.getByRole("checkbox").check();
  await setup.getByRole("button",{name:"Share categories"}).click();
  await invitation.getByRole("checkbox").check();
  await invitation.getByRole("button",{name:"Confirm categories"}).click();
  await setup.waitFor({timeout:9000});
  await setup.getByRole("button",{name:"3m"}).click();
  await setup.getByRole("button",{name:"Start game"}).click();
  await Promise.all([a.locator(".forehead-overlay").waitFor({timeout:18000}),
   b.locator(".forehead-overlay").waitFor({timeout:18000})]);
  await Promise.all([
   a.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:16000}),
   b.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:16000})
  ]);
  const first=(await a.locator(".forehead-round strong").textContent())==="YOU GUESS"?a:b;
  const helper=first===a?b:a;
  await first.waitForTimeout(500);
  const look=await first.locator(".forehead-scene").getAttribute("aria-label");
  const helperWord=await helper.locator(".forehead-scene").getAttribute("aria-label");
  if(!look?.includes("Your secret word is hidden")||!helperWord?.startsWith("Partner's forehead word:"))throw Error("Role secret view leak");
  for(const page of [first,helper]){
   const content=await page.locator(".forehead-stage").textContent();
   if(/INSIDE CHAMBER|OUTSIDE|audience|strapped|drown/i.test(content||""))throw Error("Old chamber text remains");
   const viewport=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight,viewport:innerHeight,canvas:!!document.querySelector(".forehead-scene canvas")}));
   if(viewport.scroll!==viewport.viewport||!viewport.canvas)throw Error("Mobile layout failure "+JSON.stringify(viewport));
   await page.waitForFunction(()=>Number(document.querySelector(".forehead-scene")?.dataset.drawCalls)>0,null,{timeout:3500});
   const perf=await page.locator(".forehead-scene").evaluate(el=>({
    drawCalls:Number(el.dataset.drawCalls),triangles:Number(el.dataset.triangles)
   }));
   if(perf.drawCalls>290||perf.triangles>100000)throw Error("3D scene rendering budget exceeded "+JSON.stringify(perf));
   console.log("3D budget",width+"x"+height,JSON.stringify(perf));
  }
  await helper.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-clean-studio-"+width+".png"});
  const before=await first.locator(".henyo-player-timer").first().locator("strong").textContent();
  const firstClockAtStart=await first.locator(".henyo-player-timer").first().locator("strong").textContent();
  const partnerClockAtStart=await first.locator(".henyo-player-timer").last().locator("strong").textContent();
  await first.waitForTimeout(1000);
  const currentTimer=await first.locator(".henyo-player-timer").first().locator("strong").textContent();
  const frozenTimer=await first.locator(".henyo-player-timer").last().locator("strong").textContent();
  const time=t=>(t||"").split(":").reduce((a,v)=>a*60+Number(v),0);
  if(time(currentTimer)>=time(firstClockAtStart)||time(frozenTimer)!==time(partnerClockAtStart))throw Error("Initial independent clock behavior failed");
  // Both cameras now support touch/mouse drag. The giver sees the guesser's
  // head movement, and the guesser sees the giver's, without sending words.
  const giverCanvas=await helper.locator(".forehead-scene canvas").boundingBox();
  if(!giverCanvas)throw Error("Hint giver canvas missing");
  const gx=giverCanvas.x+giverCanvas.width*.5,gy=giverCanvas.y+giverCanvas.height*.4;
  await helper.mouse.move(gx,gy);await helper.mouse.down();
  await helper.mouse.move(gx-75,gy+20,{steps:5});await helper.mouse.up();
  await helper.waitForFunction(()=>Math.abs(Number(document.querySelector(".forehead-scene")?.dataset.cameraYaw))>.10,null,{timeout:5000});
  await first.waitForFunction(()=>Math.abs(Number(document.querySelector(".forehead-scene")?.dataset.remoteYaw))>.10,null,{timeout:5000});
  console.log("PASS",width+"x"+height,"hint giver camera drag and remote head tracking");

  // Progressive three-step Yes/No path: Animal -> Land -> Four legs.
  await first.getByRole("button",{name:"Choose category"}).click();
  const panel=first.getByRole("group",{name:"Ask a category question"});
  await panel.getByRole("button",{name:"Animal",exact:true}).click();
  await helper.getByRole("button",{name:"YES",exact:true}).click();
  await first.locator(".henyo-hint-trail").getByText("Animal",{exact:true}).waitFor({timeout:7000});
  await first.getByRole("button",{name:"Choose subtype"}).click();
  if(await panel.getByRole("button",{name:"Food",exact:true}).count())throw Error("Root category appeared at subtype step");
  await panel.getByRole("button",{name:"Sea",exact:true}).click();
  await helper.getByRole("button",{name:"NO",exact:true}).click();
  await first.getByRole("button",{name:"Choose subtype"}).click();
  if(!await panel.getByRole("button",{name:"Sea",exact:true}).isDisabled())throw Error("Rejected subtype can be asked twice");
  await panel.getByRole("button",{name:"Land",exact:true}).click();
  await helper.getByRole("button",{name:"YES",exact:true}).click();
  await first.locator(".henyo-hint-trail").getByText("Land",{exact:true}).waitFor({timeout:7000});
  await first.getByRole("button",{name:"Choose trait"}).click();
  if(await panel.getByRole("button",{name:"Fins",exact:true}).count())throw Error("Sea-only trait under Land");
  await panel.getByRole("button",{name:"Four legs",exact:true}).click();
  await helper.getByRole("button",{name:"YES",exact:true}).click();
  await first.locator(".henyo-hint-trail").getByText("Four legs",{exact:true}).waitFor({timeout:7000});
  for(const page of [first,helper]){
   const hints=await page.locator(".henyo-hint-trail b").allTextContents();
   if(hints.join(" > ")!=="Animal > Land > Four legs")throw Error("Wrong 3-step hint trail "+JSON.stringify(hints));
   if(await page.locator(".forehead-ask-bar").count())throw Error("Category chooser remained after 3 confirmed hints");
  }
  if(!await first.getByRole("textbox",{name:"Your word guess"}).isVisible())throw Error("Word guessing unavailable after 3 hints");
  const askChat=first.getByRole("textbox",{name:"Ask partner a yes/no question"});
  await askChat.fill("Does it have a tail?");
  await first.getByRole("button",{name:"Send yes/no question"}).click();
  await helper.getByText("Does it have a tail?").first().waitFor({timeout:7000});
  if(!await helper.getByRole("button",{name:"YES",exact:true}).isEnabled())
   throw Error("Giver YES is disabled after 3 hints for chat question");
  await helper.getByRole("button",{name:"YES",exact:true}).click();
  await first.getByText("YES",{exact:true}).first().waitFor({timeout:7000});
  await helper.getByText("Answered: YES").waitFor({timeout:7000});
  if(await helper.getByRole("button",{name:"YES",exact:true}).isEnabled())
   throw Error("Already-answered chat question can receive duplicate answer");
  if(await first.locator(".forehead-ask-bar").count())
   throw Error("Fourth category selector reappeared after text chat");
  const postChatViewport=await first.evaluate(()=>({scroll:document.documentElement.scrollHeight,viewport:innerHeight}));
  if(postChatViewport.scroll>postChatViewport.viewport+1)
   throw Error("Chat question causes mobile scrolling "+JSON.stringify(postChatViewport));
  await first.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-chat-question-"+width+".png"});
  console.log("PASS",width+"x"+height,"three hints complete, chat YES/NO answered, no fourth category");
  const passRect=await first.getByRole("button",{name:"Pass turn"}).boundingBox();
  const sendRect=await first.getByRole("button",{name:"Submit guess"}).boundingBox();
  // Buttons are on opposite edges and passing requires a second tap; verify
  // separation of interactive hit areas, not just their vertical distance.
  if(!passRect||!sendRect||sendRect.x-(passRect.x+passRect.width)<65)
   throw Error("Pass and Send hit targets are too close on mobile "+JSON.stringify({passRect,sendRect}));
  await first.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-compact-guesser-"+width+".png"});
  await first.locator(".forehead-scene canvas").evaluate(el=>{el.dataset.keepCanvas="yes";});
  if(await first.getByRole("button",{name:"Chat",exact:true}).count()||await helper.getByRole("button",{name:"Chat",exact:true}).count())
   throw Error("Redundant Pinoy Henyo chat tabs remain");
  if(await helper.getByRole("textbox",{name:"Your word guess"}).count())
   throw Error("Hint giver incorrectly has guess/chat textbox");
  await first.getByRole("button",{name:"Pass turn"}).click();
  await first.getByRole("button",{name:"Keep guessing"}).click();
  if((await first.locator(".forehead-round strong").textContent())!=="YOU GUESS")throw Error("Cancel Pass still ended turn");
  await first.getByRole("button",{name:"Pass turn"}).click();
  await first.getByRole("button",{name:"Pass now"}).click();
  await Promise.all([first.locator(".forehead-round strong").getByText("GIVE HINTS").waitFor({timeout:7500}),
   helper.locator(".forehead-round strong").getByText("YOU GUESS").waitFor({timeout:7500})]);
  await helper.waitForFunction(()=>Math.abs(Number(document.querySelector(".forehead-scene")?.dataset.cameraYaw))<.06,null,{timeout:5000});
  const persists=await first.locator(".forehead-scene canvas").getAttribute("data-keep-canvas");
  if(persists!=="yes")throw Error("WebGL canvas was replaced when role changed (causes blinking)");
  const after=await helper.locator(".henyo-player-timer").first().locator("strong").textContent();
  const pausedFirst=await first.locator(".henyo-player-timer").first().locator("strong").textContent();
  const activeHelper=await helper.locator(".henyo-player-timer").first().locator("strong").textContent();
  if(time(pausedFirst)>time(before)+1||time(activeHelper)>180)throw Error("Pass did not preserve each player's time");
  const nextWord=(await first.locator(".forehead-scene").getAttribute("aria-label")).split(": ").pop();
  if(!nextWord||!nextWord.trim())throw Error("New giver can't see new secret word");
  if((await helper.locator(".forehead-scene").getAttribute("aria-label"))?.includes(nextWord))throw Error("New guesser word leaked");
  await helper.getByRole("textbox",{name:"Your word guess"}).fill(nextWord.trim());
  await helper.getByRole("button",{name:"Submit guess"}).click();
  await helper.locator(".henyo-success-overlay.correct svg").waitFor({timeout:5000});
  const overlay=await helper.locator(".henyo-success-overlay.correct").textContent();
  if(!overlay?.includes("Correct!")||!overlay?.includes("+1 point"))throw Error("SVG correct overlay missing");
  await helper.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-svg-correct-"+width+".png"});
  if(await helper.locator(".forehead-scene canvas").count()!==1)throw Error("Scene flicker during success");
  console.log("PASS",width+"x"+height,"SVG correct feedback and persistent canvas");
  await helper.locator(".forehead-score").first().waitFor();
  await helper.waitForFunction(()=>{
   const score=[...document.querySelectorAll(".forehead-score b")][0]?.textContent;return score==="1";
  },null,{timeout:7500});
  console.log("AFTER CORRECT",width+"x"+height,JSON.stringify({
    before:before,firstClock:await first.locator(".henyo-player-timer").first().locator("strong").textContent(),
    helperClock:await helper.locator(".henyo-player-timer").first().locator("strong").textContent(),
    firstRole:await first.locator(".forehead-round strong").textContent(),
    helperRole:await helper.locator(".forehead-round strong").textContent()
  }));
  await Promise.all([
   first.locator(".forehead-round strong").getByText("YOU GUESS").waitFor({timeout:7500}),
   helper.locator(".forehead-round strong").getByText("GIVE HINTS").waitFor({timeout:7500})
  ]);
  const helperPaused=await helper.locator(".henyo-player-timer").first().locator("strong").textContent();
  const firstResumed=await first.locator(".henyo-player-timer").first().locator("strong").textContent();
  if(time(helperPaused)>time(activeHelper)+1||time(firstResumed)>time(pausedFirst)+1)
   throw Error("Correct did not pause current clock and resume other clock");
  if(await first.locator(".forehead-scene canvas").getAttribute("data-keep-canvas")!=="yes")
   throw Error("Correct guess remounted the WebGL canvas");
  console.log("PASS",width+"x"+height,"private first-person head sync, independently frozen clocks, pass/correct switches, +1 point",before,"->",after);
  if(errors.length)throw Error("Page errors "+JSON.stringify(errors));
 }catch(e){console.error("FAIL",width+"x"+height,String(e));process.exitCode=1;}
 finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();
