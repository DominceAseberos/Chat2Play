import {chromium} from "playwright-core";
import {selectedWordPool} from "./foreheadWordBank.ts";
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
for(const [width,height] of [[390,844],[320,568]]){
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[];[a,b].forEach(page=>page.on("pageerror",e=>errors.push(e.message)));
 try{
  await Promise.all([a.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded"}),b.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded"})]);
  for(const page of [a,b]){await page.locator(".online-status strong").waitFor();for(let i=0;i<3;i++)await page.locator(".home-pager-next").click();await page.locator(".consent input").check();}
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:14000}),b.locator(".partner-name-button").waitFor({timeout:14000})]);
  await a.getByRole("button",{name:"Open mini games"}).click();
  await a.locator(".game-sidebar-open .sidebar-game").filter({hasText:"Pinoy Henyo"}).click();
  const invite=b.locator(".inline-game");
  const accept=invite.getByRole("button",{name:"Accept invitation"});
  await accept.waitFor();
  // No setup on either browser before the invitation has been agreed to.
  if(await a.getByRole("dialog",{name:"Pinoy Henyo setup"}).count())throw Error("Setup appeared before accepting the invitation");
  if(await b.getByRole("dialog",{name:"Pinoy Henyo setup"}).count())throw Error("Invited player was sent to setup prematurely");
  await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-first-invitation-"+width+".png"});
  await accept.click();
  const setup=a.getByRole("dialog",{name:"Pinoy Henyo setup"});
  await setup.waitFor({timeout:10000});
  const cat=setup.getByRole("group",{name:"Allowed word categories"});
  const share=setup.getByRole("button",{name:"Share categories"});
  if(await share.isEnabled())throw Error("Categories shared without proposer approval");
  // Each tap is reflected on the waiting player's screen BEFORE final approval.
  const live=invite.getByRole("status",{name:"Partner's live category selection"});
  await live.waitFor({timeout:10000});
  const currentSelection=async()=>await live.locator(".henyo-live-category-grid > span.chosen").allTextContents();
  await b.waitForFunction(()=>{
   return document.querySelectorAll(".inline-game .henyo-live-category-grid > span.chosen").length===3;
  },null,{timeout:8000});
  if(JSON.stringify(await currentSelection())!==JSON.stringify(["Animals","Places","Food"]))
   throw Error("Initial live preview does not match inviter choices");
  for(const [name,expected] of [["Animals",["Places","Food"]],["Food",["Places"]],["Places",[]],["Countries",["Countries"]]]){
   await cat.getByRole("button",{name}).click();
   await b.waitForFunction(expectedText=>{
    const actual=[...document.querySelectorAll(".inline-game .henyo-live-category-grid > span.chosen")].map(el=>el.textContent?.trim());
    return JSON.stringify(actual)===JSON.stringify(expectedText);
   },expected,{timeout:7000});
   if(await invite.getByRole("checkbox").count())throw Error("Preview appeared as already confirmed!");
  }
  await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-live-categories-"+width+".png"});
  const chosen=await cat.locator('button[aria-pressed="true"]').allTextContents();
  if(chosen.join(" ").trim()!=="Countries")throw Error("Country selection failed "+JSON.stringify(chosen));
  if(await share.isEnabled())throw Error("Category confirmation was not reset after edits");
  const modalMeasurements=await setup.evaluate(el=>{const rect=el.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,screen:innerHeight,scroll:el.scrollHeight>el.clientHeight}});
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-agreement-setup-"+width+".png"});
  await setup.getByRole("checkbox").check();await share.click();
  await invite.getByText("Your partner proposed these categories").waitFor({timeout:9000});
  const approved=await invite.locator(".henyo-invite-categories span").allTextContents();
  if(JSON.stringify(approved)!==JSON.stringify(["Countries"]))throw Error("Partner saw different categories "+JSON.stringify(approved));
  const agree=invite.getByRole("button",{name:"Confirm categories"});
  if(await agree.isEnabled())throw Error("Partner can approve without checkbox");
  await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/henyo-agreement-invite-"+width+".png"});
  // Changing categories requires a fresh proposer confirmation.
  await invite.getByRole("button",{name:"Request changes"}).click();
  await setup.waitFor({timeout:9000});
  await setup.getByRole("checkbox").check();await setup.getByRole("button",{name:"Share categories"}).click();
  await invite.getByRole("checkbox").check();
  if(!await agree.isEnabled())throw Error("Partner confirmation remains disabled");
  await agree.click();
  await setup.waitFor({timeout:10000});
  if(await a.locator(".forehead-overlay").count())throw Error("Game started before timer selected");
  const listed=await setup.locator(".henyo-setup-category-summary b").allTextContents();
  if(JSON.stringify(listed)!==JSON.stringify(["Countries"]))throw Error("Agreed categories changed during time setup");
  await setup.getByRole("button",{name:"1m"}).click();
  await setup.getByRole("button",{name:"Start game"}).click();
  await Promise.all([a.locator(".forehead-overlay").waitFor({timeout:16000}),b.locator(".forehead-overlay").waitFor({timeout:16000})]);
  await Promise.all([
   a.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:16000}),
   b.locator(".henyo-asset-loading").waitFor({state:"hidden",timeout:16000})
  ]);
  const wordSource=(await a.locator(".forehead-scene").getAttribute("aria-label"))?.startsWith("Partner's forehead word:")?a:b;
  const secret=(await wordSource.locator(".forehead-scene").getAttribute("aria-label")).replace("Partner's forehead word: ","");
  if(!selectedWordPool(["Country"],"medium").includes(secret))throw Error("Disallowed word in Country-only game "+secret);
  if(errors.length)throw Error("Browser errors "+errors.join(";"));
  console.log("PASS",width+"x"+height,"category confirmation, country-only invite & approved words",JSON.stringify({chosen,secret,modalMeasurements}));
 }catch(e){console.error("FAIL",width+"x"+height,String(e));process.exitCode=1;}
 finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();