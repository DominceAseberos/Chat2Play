import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { io, type Socket } from "socket.io-client";
import { bestMatchPair, reciprocalPreferences, type MatchProfile } from "./matching.js";

const woman:MatchProfile={gender:"woman",lookingFor:"man",interests:["memory","pong"],fallback:"automatic"};
const man:MatchProfile={gender:"man",lookingFor:"woman",interests:["memory"],fallback:"automatic"};
const manGames:MatchProfile={...man,interests:["memory","pong"]};
const onlyWomen:MatchProfile={...man,lookingFor:"woman"};
const notPreferred:MatchProfile={...man,gender:"man"};
function player(id:string,profile:MatchProfile,joinedAt=0){return {id,profile,joinedAt};}
function unitTests() {
  assert.equal(reciprocalPreferences(woman,man),true);
  assert.equal(reciprocalPreferences(man,notPreferred),false);
  const ranked=bestMatchPair([player("a",woman),player("b",man),player("c",manGames)],0);
  assert.ok(ranked);assert.deepEqual([ranked?.first.id,ranked?.second.id],["a","c"]);
  assert.equal(ranked?.kind,"preferred");
  assert.equal(bestMatchPair([player("a",onlyWomen),player("b",notPreferred)],500,1200),null);
  const flex=bestMatchPair([player("a",onlyWomen),player("b",notPreferred)],1700,1200);
  assert.equal(flex?.kind,"fallback");
  assert.equal(bestMatchPair([player("a",{...onlyWomen,fallback:"strict"}),player("b",notPreferred)],4000,1200),null);
  const tier=bestMatchPair([
    player("a",woman),player("b",{...man,interests:[]}),
    player("c",{...woman,gender:"woman",lookingFor:"woman",interests:["memory","pong"]})
  ],2000,1200);
  assert.equal(tier?.kind,"preferred","Preference compatibility outranks shared games on fallback");
  console.log("✓ Scoring prioritizes reciprocal preference and shared game overlap");
  console.log("✓ Fallback requires time threshold and both users' opt-in");
}
unitTests();
const url="http://127.0.0.1:3101";
const child=spawn(process.execPath,[resolve("node_modules/tsx/dist/cli.mjs"),"server/index.ts"],{
 cwd:process.cwd(),env:{...process.env,PORT:"3101",MATCH_FALLBACK_MS:"1200"},
 stdio:["ignore","pipe","pipe"],windowsHide:true
});
let serverError="";
child.stderr?.on("data",(chunk:Buffer)=>serverError+=chunk.toString().slice(0,1600));
async function ready(){
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)throw new Error("Isolated backend failed: "+serverError);
  try{const r=await fetch(url+"/api/health");if(r.ok)return;}catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 throw new Error("Timed out waiting for isolated backend: "+serverError);
}
function event(s:Socket,name:string,pred:(value:any)=>boolean=()=>true,ms=5000){
 return new Promise<any>((resolve,reject)=>{
  const timer=setTimeout(()=>{s.off(name,onMessage);reject(new Error("Timeout "+name));},ms);
  function onMessage(value:any){if(!pred(value))return;clearTimeout(timer);s.off(name,onMessage);resolve(value);}
  s.on(name,onMessage);
 });
}
const sockets:Socket[]=[];
async function connect(){
 const s=io(url,{autoConnect:false,transports:["websocket"],reconnection:false,timeout:4000});
 sockets.push(s);
 const ok=event(s,"connect",()=>true,5000);
 s.connect();await ok;
 return s;
}
function join(s:Socket,p:MatchProfile){
 s.emit("queue:join",{...p,isAdult:true});
}
function disconnectAll(){for(const s of sockets){if(s.connected)s.disconnect();}}
try{
 await ready();
 const a=await connect(),b=await connect();
 const foundA=event(a,"match:found"),foundB=event(b,"match:found");
 join(a,woman);join(b,manGames);
 const [pa,pb]=await Promise.all([foundA,foundB]);
 assert.equal(pa.matchType,"preferred");assert.equal(pb.matchType,"preferred");
 assert.deepEqual(pa.commonGames,["memory","pong"]);
 console.log("✓ Live sockets match reciprocal profiles immediately with shared games");

 const c=await connect(),d=await connect();
 const fallbackC=event(c,"match:found",v=>v.matchType==="fallback",4200);
 const fallbackD=event(d,"match:found",v=>v.matchType==="fallback",4200);
 join(c,onlyWomen);join(d,notPreferred);
 await Promise.all([fallbackC,fallbackD]);
 console.log("✓ Two incompatible users automatically match after a short wait");

 const e=await connect(),f=await connect();
 let disallowed=false;
 e.on("match:found",()=>disallowed=true);
 f.on("match:found",()=>disallowed=true);
 join(e,{...onlyWomen,fallback:"strict",interests:["memory","pong"]});
 join(f,{...notPreferred,interests:[]});
 await new Promise(r=>setTimeout(r,1950));
 assert.equal(disallowed,false,"Strict participant was matched outside preferences");
 const g=await connect();
 const preferred=event(e,"match:found",v=>v.matchType==="preferred",3500);
 join(g,{...woman,fallback:"strict"});
 await preferred;
 console.log("✓ Strict filters remain respected; preferred partner chosen when available");

 const h=await connect(),i=await connect();
 let unwanted=false;
 h.on("match:found",()=>unwanted=true);
 join(h,onlyWomen);
 h.emit("queue:cancel");
 join(i,notPreferred);
 await new Promise(r=>setTimeout(r,1700));
 assert.equal(unwanted,false,"Cancelled person should never be matched");
 console.log("✓ Cancelled users cannot be pulled back into fallback queue");
 console.log("ALL MATCHMAKING TESTS PASSED");
} catch(err){console.error(err);process.exitCode=1;}
finally{
 disconnectAll();
 if(process.platform==="win32"){
  const killer=spawn("taskkill",["/PID",String(child.pid),"/T","/F"],{windowsHide:true});
  await new Promise(resolve=>killer.on("close",resolve));
 }else child.kill("SIGTERM");
}
