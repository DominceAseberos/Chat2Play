import { chromium, type Page } from "playwright-core";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",args:["--no-sandbox"]});
const errors:string[]=[];
const c1=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const c2=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const a=await c1.newPage(),b=await c2.newPage();
for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
function ok(description:string){console.log("✓ "+description);}
async function match(){
 await Promise.all([a.goto("http://localhost:5173"),b.goto("http://localhost:5173")]);
 await a.locator(".online-status strong").waitFor({timeout:9000});
 for(const p of [a,b]){for(let step=0;step<3;step++)await p.locator(".home-pager-next").click();await p.locator(".consent input").check();}
 await Promise.all([a.getByRole("button",{name:/Find a stranger/}).click(),b.getByRole("button",{name:/Find a stranger/}).click()]);
 await Promise.all([a.locator(".partner-name-button").waitFor(),b.locator(".partner-name-button").waitFor()]);
}
async function propose(p:Page,name:string){
 await p.getByRole("button",{name:"Open mini games"}).click();
 await p.locator(".game-sidebar-open").getByRole("button",{name:new RegExp(name)}).first().click();
 if(name==="Ping Pong")await p.getByRole("button",{name:"Send invitation"}).click();
}
async function accept(p:Page){
 await p.locator(".inline-game").getByRole("button",{name:/Let's play/}).click();
}
async function noOverflow(p:Page){
 const info=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
 assert.ok(info.scroll<=info.width+1,"Horizontal overflow "+JSON.stringify(info));
}
try{
 await match();ok("Two phones matched");
 await propose(a,"Memory Duel");
 await b.locator(".inline-game").getByText("Game invitation").waitFor();
 await accept(b);
 await Promise.all([a.getByRole("dialog",{name:"Memory Duel"}).waitFor(),b.getByRole("dialog",{name:"Memory Duel"}).waitFor()]);
 ok("Memory Duel opened on both phones after mutual consent");
 const memoryOnA=await a.locator(".memory-card:not(:disabled)").count();
 const player=memoryOnA>0?a:b;
 const boardIndex=player===a?b:a;
 await player.getByRole("button",{name:"Hidden card 1",exact:true}).click();
 await Promise.all([a.locator(".memory-card.flipped").first().waitFor(),b.locator(".memory-card.flipped").first().waitFor()]);
 assert.equal(await a.locator(".memory-card.flipped").count(),1);
 assert.equal(await boardIndex.locator(".memory-card:not(:disabled)").count(),0);
 ok("Memory cards flip and synchronize while opponent cannot act out of turn");
 await noOverflow(a);
 await a.screenshot({path:"memory-duel-phone.png",fullPage:false});
 await a.getByRole("button",{name:/Back to chat/}).click();
 await a.locator(".arcade-overlay").waitFor({state:"hidden"});
 await a.locator(".inline-game").getByRole("button",{name:/Open game/}).click();
 await a.getByRole("dialog",{name:"Memory Duel"}).waitFor();
 ok("Minimize and restore arcade without losing the game");
 await a.getByRole("button",{name:/End game/}).click();
 await a.locator(".arcade-overlay").waitFor({state:"hidden"});
 await propose(a,"Ping Pong");
 await b.locator(".inline-game").getByText("Game invitation").waitFor();
 await accept(b);
 await Promise.all([a.getByRole("dialog",{name:"Ping Pong"}).waitFor(),b.getByRole("dialog",{name:"Ping Pong"}).waitFor()]);
 const court=a.locator(".pong-canvas");
 await court.waitFor();
 const rect=await court.boundingBox();assert.ok(rect&&rect.width>200&&rect.height>180);
 await a.mouse.move(rect!.x+rect!.width/3,rect!.y+rect!.height*.8);
 await a.mouse.down();
 await a.mouse.move(rect!.x+rect!.width/3,rect!.y+rect!.height*.9,{steps:8});
 await a.mouse.up();
 await a.waitForTimeout(500);
 await noOverflow(a);
 await a.screenshot({path:"ping-pong-phone.png",fullPage:false});
 ok("Ping Pong touch arena is responsive and accepts paddle dragging");
 assert.equal(errors.length,0,"Uncaught JavaScript errors: "+errors.join(" | "));
 ok("No browser errors or horizontal mobile overflow");
 console.log("ALL ARCADE UI TESTS PASSED");
}finally{await browser.close();}
