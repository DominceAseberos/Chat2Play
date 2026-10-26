import {chromium} from "playwright-core";
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
for(const [width,height] of [[390,844],[320,568]]){
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[];for(const page of [a,b])page.on("pageerror",e=>errors.push(e.message));
 try{
  await Promise.all([a.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded",timeout:15000}),b.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded",timeout:15000})]);
  for(const page of [a,b]){
   await page.locator(".online-status strong").waitFor({timeout:12000});
   for(let s=0;s<3;s++)await page.locator(".home-pager-next").click();
   await page.locator(".consent input").check();
  }
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:16000}),b.locator(".partner-name-button").waitFor({timeout:16000})]);
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
  await setup.getByRole("button",{name:"Start game"}).click();
  await Promise.all([a.locator(".forehead-overlay").waitFor({timeout:20000}),b.locator(".forehead-overlay").waitFor({timeout:20000})]);
  await Promise.all([
   a.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:16000}),
   b.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:16000})
  ]);
  await a.getByRole("button",{name:"End game"}).click();
  await a.getByRole("dialog",{name:"Quit this game?"}).waitFor({timeout:7000});
  const z=await a.evaluate(()=>({
   modal:Number(getComputedStyle(document.querySelector(".modal-body-game-quit")).zIndex),
   game:Number(getComputedStyle(document.querySelector(".forehead-overlay")).zIndex),
   scroll:document.documentElement.scrollHeight,vh:innerHeight
  }));
  if(z.modal<=z.game||z.scroll!==z.vh)throw Error("Quit confirmation is clipped/hidden "+JSON.stringify(z));
  await a.getByRole("button",{name:"Keep playing"}).click();
  await a.getByRole("dialog",{name:"Quit this game?"}).waitFor({state:"hidden",timeout:5000});
  if(!await a.locator(".forehead-overlay").isVisible()||!await b.locator(".forehead-overlay").isVisible())throw Error("Cancel incorrectly ended the game");
  console.log("PASS",width+"x"+height,"cancel does not end game, quit dialog sits above 3D scene");
  await a.getByRole("button",{name:"End game"}).click();
  await a.getByRole("dialog",{name:"Quit this game?"}).waitFor();
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/game-quit-confirm-"+width+".png"});
  await a.getByRole("button",{name:"Quit game"}).click();
  await Promise.all([
   a.getByRole("status").filter({hasText:"You left Pinoy Henyo"}).waitFor({timeout:9000}),
   b.getByRole("status").filter({hasText:"Your partner left Pinoy Henyo"}).waitFor({timeout:9000})
  ]);
  await Promise.all([
   a.locator(".forehead-overlay").waitFor({state:"hidden",timeout:9000}),
   b.locator(".forehead-overlay").waitFor({state:"hidden",timeout:9000})
  ]);
  if(!await a.locator(".partner-name-button").isVisible()||!await b.locator(".partner-name-button").isVisible())throw Error("Match was ended rather than just game");
  await a.getByRole("textbox",{name:"Message"}).fill("Still chatting after leaving!");
  await a.getByRole("button",{name:"Send message"}).click();
  await b.getByText("Still chatting after leaving!").waitFor({timeout:8500});
  const state=await b.evaluate(()=>({doc:document.documentElement.scrollHeight,viewport:innerHeight,toast:document.querySelector(".toast")?.textContent,chat:!!document.querySelector(".composer"),errors:0}));
  if(errors.length||state.doc!==state.viewport)throw Error("Mobile regression "+JSON.stringify({state,errors}));
  console.log("PASS",width+"x"+height,"partner notified; game closed on both sides; chat preserved",JSON.stringify(state));
 }catch(e){console.error("FAIL",width+"x"+height,String(e));process.exitCode=1;}
 finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();
