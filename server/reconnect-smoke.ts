import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { io, type Socket } from "socket.io-client";

const url="http://127.0.0.1:3102";
const server=spawn(process.execPath,[resolve("node_modules/tsx/dist/cli.mjs"),"server/index.ts"],{
 cwd:process.cwd(),env:{...process.env,PORT:"3102",RECONNECT_GRACE_MS:"2500"},
 windowsHide:true,stdio:["ignore","pipe","pipe"]
});
let serverError="";
server.stderr?.on("data",(chunk:Buffer)=>serverError+=chunk.toString().slice(0,900));
const sockets:Socket[]=[];
function event(socket:Socket,name:string,pred:(value:any)=>boolean=()=>true,timeout=6500){
 return new Promise<any>((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.off(name,handler);reject(new Error("Timed out waiting for "+name));},timeout);
  const handler=(value:any)=>{if(!pred(value))return;clearTimeout(timer);socket.off(name,handler);resolve(value);};
  socket.on(name,handler);
 });
}
async function ready(){
 for(let i=0;i<90;i++){
  if(server.exitCode!==null)throw new Error("Server exited: "+serverError);
  try {if((await fetch(url+"/api/health")).ok)return;} catch {}
  await new Promise(resolve=>setTimeout(resolve,130));
 }
 throw new Error("Server startup timed out: "+serverError);
}
async function connected(){
 const s=io(url,{autoConnect:false,transports:["websocket"],reconnection:true,reconnectionDelay:110,reconnectionDelayMax:380,timeout:3000});
 sockets.push(s);const onConnect=event(s,"connect");s.connect();await onConnect;return s;
}
const profile={gender:"unspecified",lookingFor:"any",interests:["memory","pong"],fallback:"automatic",isAdult:true};
try{
 await ready();
 const a=await connected(),b=await connected();
 const matchA=event(a,"match:found"),matchB=event(b,"match:found");
 a.emit("queue:join",profile);b.emit("queue:join",profile);
 await Promise.all([matchA,matchB]);
 console.log("[PASS] two real Socket.IO connections matched");
 const invitation=event(b,"game:state",g=>g?.kind==="memory"&&g.phase==="invite");
 a.emit("game:propose","memory");await invitation;
 const began=event(a,"game:state",g=>g?.kind==="memory"&&g.phase==="playing");
 b.emit("game:respond",true);const game=await began;
 const dropped=event(b,"partner:connection",v=>!v.connected);
 const resumed=event(b,"partner:connection",v=>v.connected);
 const restored=event(a,"session:state",v=>v.phase==="chat");
 a.io.reconnection(false);
 a.io.engine.close();
 await dropped;
 // Simulate a backgrounded mobile tab whose reconnect timers were frozen.
 // Returning before the configured grace expires must restore the same room.
 await new Promise(resolve=>setTimeout(resolve,1_500));
 a.io.reconnection(true);
 a.connect();
 const state=await restored;
 await resumed;
 assert.equal(a.connected,true);
 assert.equal(a.recovered,true,"Socket.IO should recover same session");
 assert.equal(state.phase,"chat");
 const synchronized=event(b,"game:state",g=>g?.id===game.id&&g.phase==="playing");
 a.emit("memory:flip",0);
 await synchronized;
 console.log("[PASS] transport interruption recovers the same real partner, game, and room");
 const gone=event(b,"partner:connection",v=>!v.connected);
 const ended=event(b,"match:ended",v=>v.code==="partner_disconnected",6000);
 a.disconnect();await gone;
 await ended;
 console.log("[PASS] unrecovered disconnect ends after grace and notifies the other user");
 console.log("ALL RECONNECTION TESTS PASSED");
}catch(error){console.error(error);process.exitCode=1;}
finally{
 for(const s of sockets)s.disconnect();
 if(process.platform==="win32"){
  const killer=spawn("taskkill",["/PID",String(server.pid),"/T","/F"],{windowsHide:true});
  await new Promise(resolve=>killer.on("close",resolve));
 }else server.kill("SIGTERM");
}
