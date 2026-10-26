import {chromium} from "playwright-core";
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--no-sandbox"]});
const expectedKey="c2p:matching-profile:v1";
for(const [width,height] of [[390,844],[320,568],[1280,800]]){
 const mobile=width<701;
 const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded",timeout:12000});
  if(mobile){
   if(!await page.locator(".mobile-home-step-0 .hero").isVisible())throw Error("New user did not see initial welcome.");
   for(let step=0;step<3;step++)await page.locator(".home-pager-next").click();
   await page.locator(".consent input").check();
  }else{
   await page.locator(".consent input").check();
  }
  await page.locator(".match-button").click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)??"null")?.completed===true,expectedKey,{timeout:8000});
  const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)??"null"),expectedKey);
  if(stored?.completed!==true||stored?.gender!=="unspecified")throw Error("Saved profile missing "+JSON.stringify(stored));
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Edit matching preferences"}).waitFor({timeout:7000});
  if(mobile&&!(await page.locator(".mobile-home-step-3.profile-returning").count()))throw Error("Returning user was sent through Get Started");
  const preferencesDialog=page.getByRole("dialog",{name:"Settings"});
  await page.getByRole("button",{name:"Edit matching preferences"}).click();
  await preferencesDialog.waitFor();
  if(!await preferencesDialog.getByText("Your matching profile").isVisible())throw Error("Settings did not open matching tab");
  await preferencesDialog.getByRole("combobox",{name:"My gender"}).click();
  await page.getByRole("option",{name:"Woman",exact:true}).click();
  await preferencesDialog.getByRole("combobox",{name:"Match preference"}).click();
  await page.getByRole("option",{name:"Men",exact:true}).click();
  await preferencesDialog.locator(".settings-fallback input").uncheck();
  await preferencesDialog.getByRole("button",{name:"Next"}).click();
  await preferencesDialog.locator(".settings-game-grid button").filter({hasText:"Ping Pong"}).click();
  await preferencesDialog.locator(".settings-game-grid button").filter({hasText:"Pinoy Henyo"}).click();
  const newProfile=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)??"null"),expectedKey);
  if(newProfile?.gender!=="woman"||newProfile?.lookingFor!=="man"||newProfile?.fallback!=="strict"
   ||newProfile?.interests.includes("pong")||!newProfile?.interests.includes("forehead"))throw Error("Settings not saved "+JSON.stringify(newProfile));
  await preferencesDialog.getByRole("button",{name:"Close",exact:true}).click();
  await page.reload({waitUntil:"domcontentloaded"});
  const persisted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)??"null"),expectedKey);
  if(JSON.stringify(persisted)!==JSON.stringify(newProfile))throw Error("Profile changed on reload");
  await page.getByText("Looking for man",{exact:false}).waitFor({timeout:6000});
  if(mobile&&await page.locator(".home-pager-next").isVisible())throw Error("Get Started shown to returning user");
  const viewport=await page.evaluate(()=>({documentHeight:document.documentElement.scrollHeight,windowHeight:innerHeight,form:document.querySelector(".form-card")?.getBoundingClientRect().toJSON()}));
  if(mobile&&viewport.documentHeight>viewport.windowHeight+1)throw Error("Returning mobile home page scrolls");
  console.log("PASS",width+"x"+height,"saved preferences, skip intro, settings updated, reloaded",JSON.stringify({persisted,viewportHeight:viewport.windowHeight}));
  await page.getByRole("button",{name:"Edit matching preferences"}).click();
  await preferencesDialog.getByRole("button",{name:"Next"}).click();
  await preferencesDialog.getByRole("button",{name:"Forget saved setup on this device"}).click();
  if(await page.evaluate(k=>localStorage.getItem(k),expectedKey)!==null)throw Error("Forget action did not remove profile");
  await page.reload({waitUntil:"domcontentloaded"});
  if(mobile && !await page.locator(".mobile-home-step-0 .hero").isVisible())throw Error("Reset did not restore onboarding");
  if(await page.locator(".edit-saved-setup").count())throw Error("Reset kept returning-user shortcut");
  console.log("PASS",width+"x"+height,"reset restores first-use setup; no JS errors:",errors.length);
  if(errors.length)throw Error(JSON.stringify(errors));
 }catch(e){console.error("FAIL",width+"x"+height,String(e));process.exitCode=1;}
 finally{await context.close();}
}
await browser.close();
