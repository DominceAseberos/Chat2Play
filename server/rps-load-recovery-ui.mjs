import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const browser=await chromium.launch({headless:true,
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})));
try{
 const [broken,partner]=await Promise.all(contexts.map(context=>context.newPage()));
 await broken.route("**/assets/RpsFullView-*.js",route=>route.fulfill({status:404,contentType:"text/plain",body:""}));
 for(const page of [broken,partner]){
  await page.goto(process.env.C2P_BASE_URL||"http://127.0.0.1:3003/",{waitUntil:"domcontentloaded"});
  await page.locator(".online-status strong").waitFor();
  const next=page.locator(".home-pager-next");
  if(await next.isVisible())for(let i=0;i<3;i++)await next.click();
  const consent=page.locator(".consent input");if(await consent.isVisible())await consent.check();
 }
 await Promise.all([broken,partner].map(page=>page.getByRole("button",{name:"Find a stranger"}).click()));
 await Promise.all([broken,partner].map(page=>page.locator(".partner-name-button").waitFor()));
 await broken.getByRole("button",{name:"Open mini games"}).click();
 await broken.locator(".game-sidebar-open .sidebar-game").filter({hasText:"Rock Paper Scissors"}).click();
 await partner.getByRole("button",{name:"Accept invitation"}).first().click();
 await broken.getByRole("button",{name:"Load 3D game"}).first().click();
 const recovery=broken.locator(".rps-load-error");
 await recovery.waitFor({timeout:12000});
 assert.match(await recovery.textContent(),/Refresh app/);
 assert.ok(await recovery.getByRole("button",{name:"Refresh app"}).isVisible());
 console.log("PASS: a missing RPS build chunk shows a refresh action instead of a blank screen");
}finally{
 await Promise.all(contexts.map(context=>context.close()));
 await browser.close();
}
