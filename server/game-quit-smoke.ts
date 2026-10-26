import {io,type Socket} from "socket.io-client";
import assert from "node:assert/strict";
const clients:Socket[]=[];
function until(s:Socket,event:string,predicate:(v:any)=>boolean=()=>true,ms=6500):Promise<any>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{s.off(event,handler);reject(Error("Timed out: "+event));},ms);
  function handler(data:any){if(!predicate(data))return;clearTimeout(timer);s.off(event,handler);resolve(data);}
  s.on(event,handler);
 });
}
async function client():Promise<Socket>{
 const s=io("http://127.0.0.1:3001",{autoConnect:false,transports:["websocket"],reconnection:false});
 clients.push(s);const ready=until(s,"connect");s.connect();await ready;return s;
}
async function invite(a:Socket,b:Socket,kind="ttt"){
 const pa=until(a,"game:state",g=>g?.phase==="invite"&&g.kind===kind);
 const pb=until(b,"game:state",g=>g?.phase==="invite"&&g.kind===kind);
 a.emit("game:propose",kind);
 const [ga,gb]=await Promise.all([pa,pb]);
 assert.equal(ga.id,gb.id);return ga;
}
async function close(a:Socket,b:Socket,id:string,kind:string){
 const eventA=until(a,"game:closed",e=>e?.id===id);
 const eventB=until(b,"game:closed",e=>e?.id===id);
 const emptyA=until(a,"game:state",g=>g===null);
 const emptyB=until(b,"game:state",g=>g===null);
 a.emit("game:close",{id});
 const [self,peer]=await Promise.all([eventA,eventB]);
 await Promise.all([emptyA,emptyB]);
 assert.deepEqual({kind:self.kind,bySelf:self.bySelf},{kind,bySelf:true});
 assert.deepEqual({kind:peer.kind,bySelf:peer.bySelf},{kind,bySelf:false});
}
try{
 const [a,b]=await Promise.all([client(),client()]);
 const fa=until(a,"match:found"),fb=until(b,"match:found");
 const p={gender:"unspecified",lookingFor:"any",interests:["ttt","forehead"],fallback:"automatic",isAdult:true};
 a.emit("queue:join",p);b.emit("queue:join",p);await Promise.all([fa,fb]);
 const initial=await invite(a,b);
 await close(a,b,initial.id,"ttt");
 console.log("PASS invited game cancelled: both notified and invitation cleared");
 const accepted=await invite(a,b);
 const onA=until(a,"game:state",g=>g?.id===accepted.id&&g.phase==="playing");
 const onB=until(b,"game:state",g=>g?.id===accepted.id&&g.phase==="playing");
 b.emit("game:respond",true);
 const [started]=await Promise.all([onA,onB]);
 // A late close from the prior invitation must NOT end the current game.
 a.emit("game:close",{id:initial.id});
 a.emit("game:close",{id:"unrelated-game"});
 const turn=started.turn===0?a:b;
 const moveA=until(a,"game:state",g=>g?.id===started.id&&g.board?.[0]!==null);
 const moveB=until(b,"game:state",g=>g?.id===started.id&&g.board?.[0]!==null);
 turn.emit("game:move",0);await Promise.all([moveA,moveB]);
 console.log("PASS stale close commands ignored; active game remains playable");
 await close(b,a,accepted.id,"ttt");
 console.log("PASS player B quits: A receives partner-left; B receives own-exit");
 const messageA=until(a,"chat:message",m=>m?.text==="Chat still works!");
 const messageB=until(b,"chat:message",m=>m?.text==="Chat still works!");
 a.emit("chat:send",{text:"Chat still works!"});
 await Promise.all([messageA,messageB]);
 console.log("PASS matched chat survives the game exit");
 const third=await invite(a,b,"forehead");
 const cats=until(a,"game:state",g=>g?.id===third.id&&g.phase==="categories");
 b.emit("game:respond",true);await cats;
 const proposed=until(b,"game:state",g=>g?.id===third.id&&g.foreheadCategories?.length===2);
 a.emit("forehead:categories:select",{id:third.id,confirmed:true,categories:["Animal","Food"]});await proposed;
 const configured=until(a,"game:state",g=>g?.id===third.id&&g.phase==="settings");
 b.emit("forehead:categories:agree",{id:third.id,confirmed:true,categories:["Animal","Food"]});await configured;
 const startA=until(a,"game:state",g=>g?.id===third.id&&g.phase==="playing");
 const startB=until(b,"game:state",g=>g?.id===third.id&&g.phase==="playing");
 const mic=until(a,"game:state",g=>g?.id===third.id&&g.phase==="mic");
 a.emit("forehead:configure",{id:third.id,difficulty:"medium",durationSeconds:60});
 await mic;
 const loading=until(a,"game:state",g=>g?.id===third.id&&g.phase==="loading");
 a.emit("forehead:mic-ready",{id:third.id});
 b.emit("forehead:mic-ready",{id:third.id});
 await loading;
 a.emit("forehead:scene-ready",{id:third.id});
 b.emit("forehead:scene-ready",{id:third.id});
 await Promise.all([startA,startB]);
 await close(a,b,third.id,"forehead");
 console.log("PASS 3D Pinoy Henyo quits and notifies both players");
 console.log("ALL GAME QUIT SERVER TESTS PASSED");
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const c of clients)c.disconnect();}
