import {io,type Socket} from "socket.io-client";
import assert from "node:assert/strict";
const clients:Socket[]=[];
function until(s:Socket,event:string,predicate:(v:any)=>boolean=()=>true,ms=8000):Promise<any>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{s.off(event,handler);reject(new Error("Timeout for "+event));},ms);
  function handler(value:any){if(!predicate(value))return;clearTimeout(timer);s.off(event,handler);resolve(value);}
  s.on(event,handler);
 });
}
async function create(){
 const s=io("http://127.0.0.1:3001",{autoConnect:false,transports:["websocket"],reconnection:false});
 clients.push(s);const connected=until(s,"connect");s.connect();await connected;return s;
}
try{
 const [a,b]=await Promise.all([create(),create()]);
 const old={gender:"woman",lookingFor:"any",interests:["ttt"],fallback:"strict",isAdult:true};
 const other={gender:"man",lookingFor:"any",interests:["ttt"],fallback:"strict",isAdult:true};
 const foundA=until(a,"match:found");
 const foundB=until(b,"match:found");
 a.emit("queue:join",old);b.emit("queue:join",other);await Promise.all([foundA,foundB]);
 const rejected=until(a,"system:error");
 a.emit("match:next",{...old,isAdult:false});
 await rejected;
 const stillTogether=until(b,"chat:message",m=>m?.text==="Current match remains");
 a.emit("chat:send",{text:"Current match remains"});
 await stillTogether;
 console.log("PASS invalid updated profile rejected without ending current chat");
 const newProfile={gender:"nonbinary",lookingFor:"woman",interests:["forehead"],fallback:"strict",isAdult:true};
 const leftB=until(b,"match:ended");
 a.emit("match:next",newProfile);await leftB;
 const c=await create();
 const nextA=until(a,"match:found");
 const nextC=until(c,"match:found");
 c.emit("queue:join",{gender:"woman",lookingFor:"nonbinary",interests:["forehead"],fallback:"strict",isAdult:true});
 const [ma,mc]=await Promise.all([nextA,nextC]);
 assert.equal(ma.partnerGender,"woman");
 assert.equal(mc.partnerGender,"nonbinary");
 assert.deepEqual(ma.commonGames,["forehead"]);
 assert.deepEqual(mc.commonGames,["forehead"]);
 assert.equal(ma.matchType,"preferred");
 console.log("PASS Next matches the newly selected gender, preference, and games instead of old settings");
 console.log("ALL NEXT-PROFILE TESTS PASSED");
}catch(error){console.error(error);process.exitCode=1;}
finally{for(const s of clients)s.disconnect();}
