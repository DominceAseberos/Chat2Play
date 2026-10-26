import {chromium,type Page} from "playwright-core";
import assert from "node:assert/strict";

const browser=await chromium.launch({headless:true,executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",args:["--no-sandbox"]});
const errors:string[]=[];
const contexts=await Promise.all([0,1,2,3].map(()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1})));
const pages=await Promise.all(contexts.map(c=>c.newPage()));
for(const p of pages)p.on("pageerror",error=>errors.push(error.message));
async function prepare(p:Page){await p.goto("http://localhost:5173/");await p.locator(".online-status strong").waitFor({timeout:8000});await p.locator(".consent input").check();}
async function match(a:Page,b:Page){await Promise.all([a.getByRole("button",{name:/Find a stranger/}).click(),b.getByRole("button",{name:/Find a stranger/}).click()]);}
try{
 const [a,b,c,d]=pages;
 await Promise.all([prepare(a),prepare(b)]);
 await match(a,b);
 await Promise.all([a.getByText("MATCH FOUND",{exact:true}).waitFor({timeout:9000}),b.getByText("MATCH FOUND",{exact:true}).waitFor({timeout:9000})]);
 console.log("✓ Both phones display Match Found before chat");
 assert.equal(await a.locator(".matched-screen .match-morph.is-matched").count(),1);
 await a.waitForTimeout(400);
 const check=await a.locator(".matched-screen .match-morph svg path").count();
 assert.equal(check,1);
 await a.screenshot({path:"match-found-mobile.png"});
 console.log("✓ Merging circles transition to a drawn check mark");
 await Promise.all([a.locator(".partner-name-button").waitFor({timeout:9000}),b.locator(".partner-name-button").waitFor({timeout:9000})]);
 console.log("✓ Both phones automatically enter the same chat");

 await a.getByRole("button",{name:"Choose emoji, GIF or sticker"}).click();
 await a.getByRole("textbox",{name:"Search emojis"}).waitFor({timeout:9000});
 const images=a.locator(".emoji-local-grid img");
 assert.ok(await images.count()>10);
 const loaded=await images.first().evaluate(async img=>{
  const i=img as HTMLImageElement;
  if(i.complete)return i.naturalWidth>0;
  return new Promise<boolean>(resolve=>{i.onload=()=>resolve(i.naturalWidth>0);i.onerror=()=>resolve(false);setTimeout(()=>resolve(false),3000);});
 });
 assert.equal(loaded,true,"Vendored image failed to load");
 console.log("✓ Local emoji catalog loads images from same origin");
 await a.getByRole("textbox",{name:"Search emojis"}).fill("heart eyes");
 const results=a.locator(".emoji-local-grid button");
 assert.ok(await results.count()>0);
 await results.first().click();
 const input=a.getByRole("textbox",{name:"Message"});
 const message=await input.inputValue();
 assert.ok(message.length>0);
 await a.getByRole("button",{name:"Send message",exact:true}).click();
 await b.locator(".message-line.theirs .message-bubble").filter({hasText:message}).waitFor({timeout:9000});
 console.log("✓ Searchable vendored emoji inserts a real Unicode message and relays it");

 await Promise.all([prepare(c),prepare(d)]);
 await match(c,d);
 await c.getByText("MATCH FOUND",{exact:true}).waitFor({timeout:9000});
 await d.close(); // The other peer ends the match before the animation finishes.
 await c.waitForTimeout(1600);
 assert.equal(await c.locator(".matched-screen").count(),0);
 assert.equal(await c.locator(".chat-card").count(),0);
 assert.equal(await c.locator(".form-card").count(),1);
 console.log("✓ Early partner disconnect cancels the transition; no empty chat");
 const dimensions=await a.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dimensions.scroll<=dimensions.width+1);
 assert.equal(errors.length,0,errors.join("; "));
 console.log("✓ No mobile horizontal overflow or JS exceptions");
 console.log("ALL MATCH + EMOJI TESTS PASSED");
}finally{await browser.close();}
