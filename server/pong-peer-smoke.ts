import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {resolve} from "node:path";
import {io,type Socket} from "socket.io-client";
import type {PongState} from "../src/pongPhysics.js";

const url="http://127.0.0.1:3104";
const server=spawn(process.execPath,[resolve("node_modules/tsx/dist/cli.mjs"),"server/index.ts"],{
 cwd:process.cwd(),env:{...process.env,PORT:"3104",PONG_PEER_ENABLED:"true"},windowsHide:true,stdio:"ignore"
});
const clients:Socket[]=[];
function wait(s:Socket,event:string,pred:(v:any)=>boolean=()=>true,ms=8000){
 return new Promise<any>((yes,no)=>{
  const timer=setTimeout(()=>{s.off(event,handler);no(Error("Timeout: "+event));},ms);
  function handler(v:any){if(pred(v)){clearTimeout(timer);s.off(event,handler);yes(v);}}
  s.on(event,handler);
 });
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function connect(){const s=io(url,{autoConnect:false,reconnection:false,transports:["websocket"]});
 clients.push(s);const connected=wait(s,"connect");s.connect();await connected;return s;}
try{
 for(let i=0;i<70;i++){try{if((await fetch(url+"/api/health")).ok)break;}catch{}await sleep(100);}
 const a=await connect(),b=await connect();
 const matched=[wait(a,"match:found"),wait(b,"match:found")];
 for(const s of [a,b])s.emit("queue:join",{gender:"unspecified",lookingFor:"any",interests:["pong"],fallback:"automatic",isAdult:true});
 const matches=await Promise.all(matched);
 const host=matches[0].side===0?a:b,guest=host===a?b:a;
 const invite=wait(b,"game:state",g=>g?.phase==="invite");
 a.emit("game:propose",{kind:"pong",options:{targetPoints:5}});await invite;
 const loading=wait(a,"game:state",g=>g?.phase==="loading");b.emit("game:respond",true);
 const game=await loading,id=game.id;
 const connecting=wait(a,"game:state",g=>g?.pongNetwork?.mode==="connecting");
 a.emit("pong:scene-ready",{id,peer:true});b.emit("pong:scene-ready",{id,peer:true});
 const net=(await connecting).pongNetwork,epoch=net.epoch;
 const signal=wait(guest,"pong:signal");
 host.emit("pong:signal",{id,epoch,signal:{type:"offer",sdp:"test-offer"}});
 guest.emit("pong:peer-listening",{id,epoch});
 assert.equal((await signal).signal.sdp,"test-offer");
 let injected=false;host.on("pong:signal",()=>{injected=true;});
 guest.emit("pong:signal",{id,epoch,signal:{type:"offer",sdp:"wrong-role"}});
 guest.emit("pong:signal",{id:"00000000-0000-4000-8000-000000000000",epoch,signal:{type:"answer",sdp:"wrong-game"}});
 await sleep(100);assert.equal(injected,false);
 console.log("PASS: signaling is restricted to the current game and designated roles");
 const start=wait(host,"pong:peer-start");
 host.emit("pong:peer-ready",{id,epoch});guest.emit("pong:peer-ready",{id,epoch});
 const seed=await start;
 let broadcasts=0;const count=()=>broadcasts++;a.on("game:state",count);
 await sleep(1200);
 assert.equal(broadcasts,0,"Peer matches must not receive the server's 30 Hz simulation stream");
 a.off("game:state",count);
 console.log("PASS: server stops simulation broadcasts during a peer match");
 const state=structuredClone(seed.state) as PongState;
 state.paddles[0]=.8;state.lastTick=Date.now();
 host.emit("pong:checkpoint",{id,epoch,seq:1,state});
 await sleep(300);
 const forged=structuredClone(state);forged.paddles[0]=.2;forged.lastTick=Date.now();
 guest.emit("pong:checkpoint",{id,epoch,seq:100,state:forged});
 host.emit("pong:checkpoint",{id,epoch:epoch-1,seq:100,state:forged});
 const fallback=wait(a,"game:state",g=>g?.pongNetwork?.mode==="server");
 guest.emit("pong:peer-failed",{id,epoch});
 const restored=await fallback;
 assert.equal(restored.pong.paddles[0],.8,"Fallback must restore the host checkpoint, ignoring forged/stale ones");
 console.log("PASS: checkpoint restores physics on fallback; guest and stale writes are rejected");
 const moved=wait(guest,"game:state",g=>g?.pong?.paddles[1]>.85);
 guest.emit("pong:paddle",{y:.9,depth:1.1,forwardStroke:0});await moved;
 console.log("PASS: server gameplay resumes after peer failure");
 // A second match checks the winner/question flow with peer-reported scores.
 const closed=wait(a,"game:state",g=>g===null);a.emit("game:close",{id});await closed;
 const invite2=wait(b,"game:state",g=>g?.phase==="invite");
 a.emit("game:propose",{kind:"pong",options:{targetPoints:5}});await invite2;
 const loading2=wait(a,"game:state",g=>g?.phase==="loading");b.emit("game:respond",true);
 const id2=(await loading2).id,connecting2=wait(a,"game:state",g=>g?.pongNetwork?.mode==="connecting");
 a.emit("pong:scene-ready",{id:id2,peer:true});b.emit("pong:scene-ready",{id:id2,peer:true});await connecting2;
 const start2=wait(host,"pong:peer-start");
 host.emit("pong:peer-ready",{id:id2,epoch:1});guest.emit("pong:peer-ready",{id:id2,epoch:1});
 const scored=(await start2).state as PongState;
 const finished=wait(guest,"game:state",g=>g?.id===id2&&g.phase==="finished");
 const question=wait(guest,"winner-question:state",q=>q.question?.gameId===id2);
 for(let score=1;score<=5;score++){
  await sleep(300);scored.scores[0]=score;scored.lastTick=Date.now();
  host.emit("pong:checkpoint",{id:id2,epoch:1,seq:score,state:scored});
 }
 assert.equal((await finished).winner,0);assert.equal((await question).question.asker,0);
 console.log("PASS: peer results finish the match and preserve the winner's question flow");
}catch(e){console.error(e);process.exitCode=1;}
finally{
 clients.forEach(s=>s.disconnect());
 if(process.platform==="win32"){
  const killer=spawn("taskkill",["/PID",String(server.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});
  await new Promise(r=>killer.on("close",r));
 }else server.kill();
}
