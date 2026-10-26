import { chromium, type Page } from "playwright-core";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",args:["--no-sandbox"]});
const errors:string[]=[];
const mob1=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const mob2=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const a=await mob1.newPage();const b=await mob2.newPage();
for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
async function check(p:Page,label:string){
 const v=await p.evaluate(()=>({
  width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
  text:getComputedStyle(document.body).color,
  theme:document.documentElement.dataset.theme,
  card:document.querySelector(".form-card")?getComputedStyle(document.querySelector(".form-card")!).borderRadius:"none"
 }));
 console.log(label+":"+JSON.stringify(v));
 assert.ok(v.scroll<=v.width+1,"Mobile horizontal overflow in "+label);
}
try{
 await Promise.all([a.goto("http://localhost:5173"),b.goto("http://localhost:5173")]);
 await a.locator(".online-status strong").waitFor({timeout:10000});
 await check(a,"Mobile landing");
 assert.equal(await a.locator("html").getAttribute("data-theme"),"dark");
 await a.screenshot({path:"noir-home-mobile.png",fullPage:false});
 await a.getByRole("button",{name:"Open settings"}).click();
 await a.getByRole("button",{name:/Light/}).click();
 assert.equal(await a.locator("html").getAttribute("data-theme"),"light");
 await a.getByRole("button",{name:/Dark/}).click();
 await a.getByRole("button",{name:"Close"}).click();
 console.log("✓ Light/dark theme modal works");
 await a.locator(".consent input").check();await b.locator(".consent input").check();
 await Promise.all([a.getByRole("button",{name:/Find a stranger/}).click(),b.getByRole("button",{name:/Find a stranger/}).click()]);
 await Promise.all([a.locator(".partner-name-button").waitFor({timeout:12000}),b.locator(".partner-name-button").waitFor({timeout:12000})]);
 await a.getByRole("textbox",{name:"Message"}).fill("Hey stranger, want to play?");
 await a.getByRole("button",{name:"Send message"}).click();
 await b.getByText("Hey stranger, want to play?").waitFor({timeout:9000});
 await b.getByRole("textbox",{name:"Message"}).fill("Absolutely, let's go!");
 await b.getByRole("button",{name:"Send message"}).click();
 await a.getByText("Absolutely, let's go!").waitFor({timeout:9000});
 await check(a,"Mobile chat");
 await a.screenshot({path:"noir-chat-mobile.png",fullPage:false});
 await a.getByRole("button",{name:"Open mini games"}).click();
 await a.locator(".game-sidebar-open").waitFor();
 await a.screenshot({path:"noir-games-mobile.png",fullPage:false});
 await a.getByRole("button",{name:"Close games"}).click();
 await a.getByRole("button",{name:"View current stranger"}).click();
 assert.equal(await a.getByRole("dialog").isVisible(),true);
 await a.getByRole("button",{name:"Close"}).click();
 console.log("✓ Glass dock, game sheet, profile modal work");
 console.log("JS_ERRORS:"+JSON.stringify(errors));
 assert.equal(errors.length,0);
 console.log("ALL NOIR BROWSER TESTS PASSED");
}finally{await browser.close();}
