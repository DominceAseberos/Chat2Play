import {chromium} from "playwright-core";
const browser=await chromium.launch({
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]
});
const viewports=[[320,568],[390,844],[768,1024],[1024,768]];
for(const [width,height] of viewports){
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[];[a,b].forEach(p=>p.on("pageerror",e=>errors.push(e.message)));
 try{
  await Promise.all([a.goto("http://localhost:5173/",{waitUntil:"domcontentloaded",timeout:20000}),b.goto("http://localhost:5173/",{waitUntil:"domcontentloaded",timeout:20000})]);
  for(const page of [a,b]){
   await page.locator(".online-status strong").waitFor({timeout:8500});
   const next=page.locator(".home-pager-next");
   if(await next.isVisible())for(let i=0;i<3;i++)await next.click();
   const consent=page.locator(".consent input");
   if(await consent.isVisible())await consent.check();
  }
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:13000}),b.locator(".partner-name-button").waitFor({timeout:13000})]);
  const openGames=a.getByRole("button",{name:"Open mini games"});
  if(await openGames.isVisible())await openGames.click();
  await a.getByRole("button",{name:/Pinoy Henyo.*Give clues/}).first().click();
  const invitation=b;
  await invitation.getByRole("button",{name:"Accept invitation"}).first().click();
  const setup=a.getByRole("dialog",{name:"Pinoy Henyo setup"});
  await setup.getByRole("checkbox").check();
  await setup.getByRole("button",{name:"Share categories"}).click();
  await invitation.getByRole("checkbox").first().check();
  await invitation.getByRole("button",{name:"Confirm categories"}).first().click();
  await setup.getByRole("button",{name:"Start game"}).click();
  await Promise.all([a.locator(".forehead-overlay").waitFor({timeout:18000}),b.locator(".forehead-overlay").waitFor({timeout:18000})]);
  await Promise.all([a.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:16000}),b.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:16000})]);
  const giver=(await a.locator(".forehead-scene").getAttribute("aria-label"))?.startsWith("Partner's forehead word:")?a:b;
  const guesser=giver===a?b:a;
  const metadata=await giver.locator(".forehead-scene").evaluate(el=>({
   draws:Number(el.dataset.drawCalls),triangles:Number(el.dataset.triangles),
   sceneWidth:el.getBoundingClientRect().width,sceneHeight:el.getBoundingClientRect().height
  }));
  if(metadata.draws>290||metadata.triangles>100000)throw Error("Performance budget exceeded "+JSON.stringify(metadata));
  for(const page of [guesser,giver]){
   const dims=await page.evaluate(()=>({
    scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,
    backgroundLocked:getComputedStyle(document.documentElement).overflow==="hidden",
    vw:innerWidth,vh:innerHeight,
    shell:(()=>{const b=document.querySelector(".forehead-shell").getBoundingClientRect();return {width:b.width,height:b.height,bottom:b.bottom,top:b.top}})()
   }));
   if(dims.scrollW>dims.vw+2||(dims.scrollH>dims.vh+2&&!dims.backgroundLocked)
      ||dims.shell.bottom>dims.vh+2||dims.shell.top< -2)
    throw Error("Overflow layout "+JSON.stringify(dims));
  }
  await giver.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-responsive-"+width+"x"+height+".png"});
  const canvas=guesser.locator(".forehead-scene canvas");
  const rect=await canvas.boundingBox();if(!rect)throw Error("Canvas is not visible");
  const sx=rect.x+rect.width*.51,sy=rect.y+Math.min(92,rect.height*.20);
  await guesser.mouse.move(sx,sy);
  await guesser.mouse.down();
  await guesser.mouse.move(sx,sy+Math.max(200,rect.height*.47),{steps:8});
  await guesser.mouse.up();
  await guesser.waitForFunction(()=>{
   const el=document.querySelector(".forehead-scene");
   return Number(el?.dataset.cameraPitch)<-.95&&el?.dataset.selfVisible==="true";
  },null,{timeout:6500});
  await guesser.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-look-down-"+width+"x"+height+".png"});
  const pitch=await guesser.locator(".forehead-scene").getAttribute("data-camera-pitch");
  // Word card must remain in scene for giver and hidden from guesser.
  if((await giver.locator(".forehead-scene").getAttribute("aria-label"))?.includes("Your secret word is hidden"))throw Error("Word disappeared from giver");
  if(!(await guesser.locator(".forehead-scene").getAttribute("aria-label"))?.includes("Your secret word is hidden"))throw Error("Guesser saw word");
  console.log("PASS",width+"x"+height,JSON.stringify({pitch,...metadata}));
  if(errors.length)throw Error("Page errors: "+errors.join(";"));
 }catch(e){
  console.error("FAIL",width+"x"+height,String(e));
  console.log("BUTTONS",await a.locator("button").evaluateAll(items=>items.map(el=>[el.textContent?.trim(),el.getAttribute("aria-label")]).filter(x=>x[0]||x[1]).slice(0,35)));
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-tablet-debug-"+width+".png"});
  process.exitCode=1;
 }
 finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();
