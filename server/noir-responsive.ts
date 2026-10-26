import {chromium} from "playwright-core";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",args:["--no-sandbox"]});
try{
 for(const width of [320,375,768,1280]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<800,hasTouch:width<800});
  const page=await context.newPage();let errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://localhost:5173",{waitUntil:"networkidle"});
  const out=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth,theme:document.documentElement.dataset.theme,form:getComputedStyle(document.querySelector(".form-card")!).visibility}));
  assert.ok(out.scroll<=out.width+1,JSON.stringify(out));
  assert.equal(out.theme,"dark");assert.equal(errors.length,0);
  if(width===1280)await page.screenshot({path:"noir-home-desktop.png"});
  console.log("✓ Responsive "+width+"px: "+JSON.stringify(out));
  await context.close();
 }
 console.log("ALL NOIR RESPONSIVE TESTS PASSED");
}finally{await browser.close();}
