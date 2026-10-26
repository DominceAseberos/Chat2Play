import {io} from "socket.io-client";
import assert from "node:assert/strict";
const base=process.env.LIVE_TEST_URL;
if(!base)throw Error("Set LIVE_TEST_URL");
const options={autoConnect:false,transports:["websocket"],reconnection:false,timeout:14000};
const a=io(base,options),b=io(base,options);
function wait(s,event,filter=()=>true,ms=18000){
 return new Promise((resolve,reject)=>{
  const t=setTimeout(()=>{s.off(event,handler);reject(Error("Timeout "+event+": "+base))},ms);
  function handler(v){if(!filter(v))return;clearTimeout(t);s.off(event,handler);resolve(v);}
  s.on(event,handler)
 });
}
try{
 const connA=wait(a,"connect"),connB=wait(b,"connect");
 const onFailure=(label)=>(e)=>console.error("CONNECT ERROR",label,e.message);
 a.on("connect_error",onFailure("A"));b.on("connect_error",onFailure("B"));
 a.connect();b.connect();
 await Promise.all([connA,connB]);
 console.log("PASS public websocket WSS both clients");
 const onlineA=wait(a,"match:found"),onlineB=wait(b,"match:found");
 const profile={gender:"unspecified",lookingFor:"any",interests:["pong"],fallback:"automatic",isAdult:true};
 a.emit("queue:join",profile);b.emit("queue:join",profile);
 const matches=await Promise.all([onlineA,onlineB]);
 assert.ok(matches.every(x=>x!==null));
 assert.equal(matches[0].side+matches[1].side,1,"Test clients matched different strangers");
 console.log("PASS public reciprocal stranger matching",JSON.stringify(matches.map(x=>x.side)));
 const invite=wait(b,"game:state",x=>x?.kind==="pong"&&x.phase==="invite");
 a.emit("game:propose","pong");await invite;
 const liveA=wait(a,"game:state",x=>x?.kind==="pong"&&x.phase==="playing");
 const liveB=wait(b,"game:state",x=>x?.kind==="pong"&&x.phase==="playing");
 b.emit("game:respond",true);
 const [ga,gb]=await Promise.all([liveA,liveB]);
 assert.deepEqual(ga.pong.scores,gb.pong.scores);
 console.log("PASS public Pong invitation accepted on both clients");
 const aSide=matches[0].side;
 const moveA=wait(a,"game:state",x=>x?.pong?.paddles?.[aSide]>.80);
 const moveB=wait(b,"game:state",x=>x?.pong?.paddles?.[aSide]>.80);
 a.emit("pong:paddle",.86);await Promise.all([moveA,moveB]);
 console.log("PASS public socket paddle synchronization");
 const ballA=wait(a,"game:state",x=>x?.pong&&Math.abs(x.pong.ball.x-.5)>.09);
 const ballB=wait(b,"game:state",x=>x?.pong&&Math.abs(x.pong.ball.x-.5)>.09);
 const [fa,fb]=await Promise.all([ballA,ballB]);
 assert.ok(Math.abs(fa.pong.ball.x-fb.pong.ball.x)<.08,"Ball snapshots diverged");
 console.log("PASS public authoritative shared ball physics");
 console.log("ALL PUBLIC LIVE TESTS PASSED");
}catch(e){console.error("PUBLIC TEST FAILED",e);process.exitCode=1;}
finally{a.disconnect();b.disconnect();}
