import assert from "node:assert/strict";
import {chromium} from "playwright-core";
const base=process.env.C2P_BASE_URL||"http://127.0.0.1:5173/";
const specs=[[390,844],[320,568],[768,1024]];
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
for(const [width,height] of specs){
 const mobile=width<=700;
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[]; for(const p of [a,b])p.on("pageerror",e=>errors.push(e.message));
 try{
  await Promise.all([a.goto(base,{waitUntil:"domcontentloaded",timeout:22000}),b.goto(base,{waitUntil:"domcontentloaded",timeout:22000})]);
  for(const p of [a,b]){
   await p.locator(".online-status strong").waitFor({timeout:15000});
   const pager=p.locator(".home-pager-next");
   if(await pager.isVisible())for(let i=0;i<3;i++)await pager.click();
   const consent=p.locator(".consent input");if(await consent.isVisible())await consent.check();
  }
  await Promise.all([a.getByRole("button",{name:"Find a stranger"}).click(),b.getByRole("button",{name:"Find a stranger"}).click()]);
  await Promise.all([a.locator(".partner-name-button").waitFor({timeout:18000}),b.locator(".partner-name-button").waitFor({timeout:18000})]);
  if(mobile){
   const fullscreen=await a.evaluate(()=>{
    const topbar=document.querySelector(".topbar"),card=document.querySelector(".chat-card")?.getBoundingClientRect();
    return {topbarDisplay:topbar?getComputedStyle(topbar).display:null,
     card:card&&{top:card.top,bottom:card.bottom,height:card.height},viewport:innerHeight,
     bottomSettings:!!document.querySelector('.chat-dock button[aria-label="Open appearance settings"]')};
   });
   assert.equal(fullscreen.topbarDisplay,"none","The redundant mobile top navigation must be hidden");
   assert.ok(fullscreen.card&&fullscreen.card.top<=1&&fullscreen.card.bottom>=fullscreen.viewport-1,
    "The mobile chat must fill the viewport: "+JSON.stringify(fullscreen));
   assert.ok(fullscreen.bottomSettings,"Settings must remain available in the bottom dock");
  }
  console.log("MATCH",width+"x"+height,"both clients joined same match");
  await b.getByRole("textbox",{name:"Message",exact:true}).fill("typing preview");
  await a.locator(".typing-above-composer .typing-pill").waitFor({timeout:5000});
  const typingPlacement=await a.evaluate(()=>{
   const typing=document.querySelector(".typing-above-composer")?.getBoundingClientRect();
   const input=document.querySelector(".composer")?.getBoundingClientRect();
   return {typingBottom:typing?.bottom,inputTop:input?.top};
  });
  assert.ok(typingPlacement.typingBottom<=typingPlacement.inputTop+2&&
   typingPlacement.inputTop-typingPlacement.typingBottom<15,
   "Typing indicator must sit immediately above the input: "+JSON.stringify(typingPlacement));
  if(width===390)await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/chat-typing-390.png"});
  await b.getByRole("textbox",{name:"Message",exact:true}).fill("");
  await a.locator(".typing-above-composer").waitFor({state:"detached",timeout:5000});
  const texts=[["A","FIRST_HELLO"],["B","FIRST_REPLY"],["A","SECOND_QUESTION"],["B","SECOND_REPLY"],["A","THIRD_MESSAGE"]];
  let i=0;
  for(const [who,text] of texts){
   const p=who==="A"?a:b;
   await p.getByRole("textbox",{name:"Message",exact:true}).fill(text);
   await p.getByRole("button",{name:"Send message"}).click();
   i++;
   for(const q of [a,b]){
    await q.locator(".message-line .message-bubble").filter({hasText:text}).waitFor({timeout:8000});
    const visible=await q.locator(".conversation-scroll .message-line:visible").count();
    const bubbles=await q.locator(".conversation-scroll .message-bubble").allTextContents();
    if(visible!==i||bubbles.length!==i){
     throw Error("Message history lost after "+text+"; "+JSON.stringify({expected:i,visible,bubbles}));
    }
    if(i===1){
     const placement=await q.evaluate(()=>{
      const line=document.querySelector(".conversation-scroll .message-line")?.getBoundingClientRect();
      const composer=document.querySelector(".composer-area")?.getBoundingClientRect();
      return {messageBottom:line?.bottom,composerTop:composer?.top};
     });
     assert.ok(placement.messageBottom<=placement.composerTop+2&&
      placement.composerTop-placement.messageBottom<48,
      "The first message must sit near the input: "+JSON.stringify(placement));
     if(width===390&&q===a)await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/chat-first-message-390.png"});
    }
   }
   await p.waitForTimeout(850); // Server permits one message per sender per 700ms.
  }
  // Reading old messages must not get snapped back to the bottom by a new
  // incoming message. The message still stays in the history.
  const topBefore=await a.locator(".conversation-scroll").evaluate(el=>{
   el.scrollTop=0;
   el.dispatchEvent(new Event("scroll",{bubbles:true}));
   return {hasOverflow:el.scrollHeight>el.clientHeight+40,top:el.scrollTop};
  });
  await a.waitForTimeout(120);
  await b.getByRole("textbox",{name:"Message",exact:true}).fill("WHILE_READING_OLD");
  await b.getByRole("button",{name:"Send message"}).click();
  for(const q of [a,b]){
   await q.locator(".message-bubble").filter({hasText:"WHILE_READING_OLD"}).waitFor({timeout:8000});
   const bubbles=await q.locator(".conversation-scroll .message-bubble").allTextContents();
   if(bubbles.length!==texts.length+1||bubbles[0]!=="FIRST_HELLO")
    throw Error("New incoming chat destroyed history: "+JSON.stringify(bubbles));
  }
  if(topBefore.hasOverflow){
   const after=await a.locator(".conversation-scroll").evaluate(el=>el.scrollTop);
   if(after>45)throw Error("Reading older messages jumped to bottom "+after);
  }
  // Inviting a game must not replace or hide the current chat history.
  const open=a.getByRole("button",{name:"Open mini games"});
  if(await open.isVisible())await open.click();
  await a.getByRole("button",{name:/Memory Duel.*Flip/}).first().click();
  await b.getByRole("button",{name:"Accept invitation"}).first().waitFor({timeout:8000});
  for(const q of [a,b]){
   const visible=await q.locator(".conversation-scroll .message-line:visible").count();
   if(visible!==texts.length+1)throw Error("Opening game invitation hid chat messages "+visible+"/"+(texts.length+1));
  }
  const layout=await a.evaluate(()=>{
   const pane=document.querySelector(".conversation-scroll");
   const rect=pane?.getBoundingClientRect();
   const style=pane?getComputedStyle(pane):null;
   return {docScroll:document.documentElement.scrollHeight>innerHeight+1,paneScroll:!!pane&&pane.scrollHeight>pane.clientHeight,overflow:style?.overflowY,rect:rect&&{top:rect.top,bottom:rect.bottom}};
  });
  console.log("PASS",width+"x"+height,"6 messages retained; reading-old scroll held; invite preserved history",JSON.stringify(layout));
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/chat-history-"+width+"-a.png"});
  await b.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/chat-history-"+width+"-b.png"});
  if(errors.length)throw Error("Client errors: "+errors.join("; "));
 }catch(e){
  console.error("FAIL",width+"x"+height,String(e));
  await a.screenshot({path:"C:/Users/user/OneDrive/Desktop/Projects/Chat2Play/chat-history-fail-"+width+".png"}).catch(()=>{});
  process.exitCode=1;
 }finally{await Promise.all(contexts.map(c=>c.close()));}
}
await browser.close();
