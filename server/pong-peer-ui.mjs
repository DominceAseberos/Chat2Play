import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const browser=await chromium.launch({headless:true,
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
const expectPeer=!process.argv.includes("--server-only");
let pages=[];
try{
 pages=await Promise.all([0,1].map(async(_,index)=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  page.on("pageerror",error=>console.log("CLIENT",index,error.message));
  page.on("websocket",ws=>{
   let lastState="";
   const inspect=({payload},direction)=>{
    if(typeof payload!=="string"||!payload.startsWith("42["))return;
    const [name,data]=JSON.parse(payload.slice(2));
    if(name==="game:state"&&data?.kind==="pong"){
     const state=data.phase+":"+data.pongNetwork?.mode;
     if(state!==lastState){lastState=state;console.log("STATE",index,data.phase,data.pongNetwork?.mode);}
    }
    if(["pong:peer-ready","pong:peer-failed","pong:scene-ready"].includes(name))console.log(direction,index,name,JSON.stringify(data));
   };
   ws.on("framesent",event=>inspect(event,"SEND"));ws.on("framereceived",event=>inspect(event,"RECV"));
  });
  await page.addInitScript(expectPeer=>{
   const Native=window.RTCPeerConnection;
   window.__pongPeers=[];
   window.RTCPeerConnection=class extends Native{
    constructor(config){super(config);window.__pongPeers.push(this);}
   };
   if(!expectPeer)window.RTCPeerConnection=undefined;
  },expectPeer);
  await page.goto(process.env.C2P_BASE_URL||"http://127.0.0.1:3003/",{waitUntil:"domcontentloaded"});
  await page.locator(".online-status strong").waitFor({state:"attached"});
  const next=page.locator(".home-pager-next");
  if(await next.isVisible())for(let i=0;i<3;i++)await next.click();
  const consent=page.locator(".consent input");if(await consent.isVisible())await consent.check();
  return page;
 }));
 const [a,b]=pages;
 await Promise.all(pages.map(p=>p.getByRole("button",{name:"Find a stranger"}).click()));
 await Promise.all(pages.map(p=>p.locator(".partner-name-button").waitFor()));
 const open=a.getByRole("button",{name:"Open mini games"});
 if(await open.isVisible())await open.click();
 await a.locator(".sidebar-game").filter({hasText:"Ping Pong"}).filter({visible:true}).first().click();
 await a.getByRole("button",{name:"Send invitation"}).click();
 await b.getByRole("button",{name:"Accept invitation"}).first().click();
 await Promise.all(pages.map(p=>p.locator(".pong-scene-3d").waitFor()));
 await Promise.all(pages.map(p=>p.locator(`.pong-game[data-transport="${expectPeer?"peer":"server"}"]`).waitFor({timeout:25000})));
 console.log(expectPeer?"PASS: two mobile browsers established a real WebRTC data channel":"PASS: browsers without WebRTC use the server game");
 await Promise.all(pages.map(p=>p.locator(".pong-load-screen").waitFor({state:"hidden",timeout:20000})));
 await Promise.all(pages.map(p=>p.locator('.pong-scene-3d[data-serve-pending="true"]').waitFor()));
 const server=await a.locator(".pong-swipe-hud").textContent().then(s=>s.includes("SWIPE FORWARD"))?a:b;
 const scene=server.locator(".pong-scene-3d"),rect=await scene.boundingBox();
 assert.ok(rect,"The serving scene must be visible");
 const cx=rect.x+rect.width*.5,cy=rect.y+rect.height*.65;
 await a.waitForFunction(()=>document.querySelector(".pong-serve-note strong")?.textContent==="Serve!",null,{timeout:8000});
 await server.mouse.move(cx,cy);await server.mouse.down();
 await server.mouse.move(cx+rect.width*.1,cy,{steps:4});
 await server.mouse.move(cx,cy,{steps:4});await server.mouse.up();
 await server.waitForTimeout(200);
 assert.equal(await scene.getAttribute("data-serve-pending"),"true",
  "A sideways stroke must leave the serve staged");
 const staged=await scene.evaluate(el=>({x:Number(el.dataset.ballX),y:Number(el.dataset.ballY)}));
 await server.mouse.move(cx,cy);await server.mouse.down();
 await server.mouse.move(cx+rect.width*.12,cy-rect.height*.28,{steps:8});await server.mouse.up();
 await server.waitForFunction(()=>document.querySelector(".pong-scene-3d")?.dataset.servePending==="false",
  null,{timeout:5000});
 await (server===a?b:a).waitForFunction(()=>
  document.querySelector(".pong-scene-3d")?.dataset.servePending==="false",null,{timeout:5000});
 await server.waitForFunction(start=>{
  const el=document.querySelector(".pong-scene-3d");
  return Math.hypot(Number(el?.dataset.ballX)-start.x,Number(el?.dataset.ballY)-start.y)>.05;
 },staged,{timeout:5000});
 console.log("PASS: both mobile clients see a held ball; sideways drag does not serve, and a diagonal forward swipe launches an angled ball");
 // Closing a live peer link must return both players to the server simulation.
 if(expectPeer){
  await a.evaluate(()=>window.__pongPeers.forEach(pc=>pc.close()));
  await Promise.all(pages.map(p=>p.locator('.pong-game[data-transport="server"]').waitFor({timeout:10000})));
  await Promise.all(pages.map(p=>p.locator(".pong-scene-3d").waitFor()));
  console.log("PASS: peer-link failure restores both players to the server game");
 }
}catch(error){
 for(let i=0;i<pages.length;i++)console.log("DEBUG",i,await pages[i].evaluate(()=>({hidden:document.hidden,secure:isSecureContext,
  transport:document.querySelector(".pong-game")?.dataset.transport,
  peers:window.__pongPeers?.map(pc=>({state:pc.connectionState,ice:pc.iceConnectionState,signaling:pc.signalingState}))})));
 throw error;
}finally{await browser.close();}
