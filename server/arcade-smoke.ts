import { io, type Socket } from "socket.io-client";
import assert from "node:assert/strict";

const serverUrl=process.env.LIVE_TEST_URL || "http://localhost:3001";
const a=io(serverUrl,{autoConnect:false,transports:["websocket"],reconnection:false});
const b=io(serverUrl,{autoConnect:false,transports:["websocket"],reconnection:false});
function wait(s:Socket,event:string,check:(v:any)=>boolean=()=>true,timeout=7000):Promise<any>{
 return new Promise((resolve,reject)=>{
  const handler=(v:any)=>{if(!check(v))return;clearTimeout(timer);s.off(event,handler);resolve(v);};
  const timer=setTimeout(()=>{s.off(event,handler);reject(new Error("Timeout waiting for "+event));},timeout);
  s.on(event,handler);
 });
}
const state=(s:Socket,kind:string,phase:string,check:(v:any)=>boolean=()=>true)=>
 wait(s,"game:state",g=>g?.kind===kind&&g.phase===phase&&check(g));
async function test(){
 const connectedA=wait(a,"connect"),connectedB=wait(b,"connect");a.connect();b.connect();await Promise.all([connectedA,connectedB]);
 const matchA=wait(a,"match:found"),matchB=wait(b,"match:found");
 a.emit("queue:join",{gender:"unspecified",lookingFor:"any",interests:["memory","pong"],isAdult:true});
 b.emit("queue:join",{gender:"unspecified",lookingFor:"any",interests:["memory","pong"],isAdult:true});
 await Promise.all([matchA,matchB]);console.log("✓ Two strangers matched with shared Memory Duel and Ping Pong interests");

 const invite=state(b,"memory","invite");a.emit("game:propose","memory");await invite;
 const startA=state(a,"memory","playing"),startB=state(b,"memory","playing");
 b.emit("game:respond",true);
 const [ma,mb]=await Promise.all([startA,startB]);
 assert.equal(ma.memory.cards.length,12);
 assert.ok(ma.memory.cards.every((v:any)=>v===null),"Unrevealed cards exposed");
 assert.deepEqual(ma.memory.cards,mb.memory.cards);
 console.log("✓ Memory Duel starts with 12 hidden cards on both phones");
 const player=ma.memory.turn===0?a:b,notPlayer=ma.memory.turn===0?b:a;
 notPlayer.emit("memory:flip",1);
 const firstA=state(a,"memory","playing",g=>g.memory.cards.filter((v:any)=>v!==null).length===1);
 const firstB=state(b,"memory","playing",g=>g.memory.cards.filter((v:any)=>v!==null).length===1);
 player.emit("memory:flip",0);
 const [flipA,flipB]=await Promise.all([firstA,firstB]);
 assert.equal(flipA.memory.cards[0],flipB.memory.cards[0]);
 assert.ok(flipA.memory.cards.slice(1).every((v:any)=>v===null));
 console.log("✓ Opponent cannot flip out of turn; revealed card synchronized without deck leak");
 const secondA=state(a,"memory","playing",g=>g.memory.matched.some(Boolean)||g.memory.revealed.length===2);
 const secondB=state(b,"memory","playing",g=>g.memory.matched.some(Boolean)||g.memory.revealed.length===2);
 player.emit("memory:flip",1);
 const [two]=await Promise.all([secondA,secondB]);
 if(two.memory.resolving){
   const settledA=state(a,"memory","playing",g=>!g.memory.resolving&&g.memory.revealed.length===0);
   const settledB=state(b,"memory","playing",g=>!g.memory.resolving&&g.memory.revealed.length===0);
   const [settled]=await Promise.all([settledA,settledB]);
   assert.notEqual(settled.memory.turn,ma.memory.turn);
 }else{
   assert.equal(two.memory.scores[ma.memory.turn],1);
 }
 console.log("✓ Pair validation, scoring or wrong-pair turn switching");

 const clearedA=wait(a,"game:state",g=>g===null),clearedB=wait(b,"game:state",g=>g===null);
 a.emit("game:close",{id:ma.id});await Promise.all([clearedA,clearedB]);
 const pongInvite=state(b,"pong","invite");a.emit("game:propose","pong");await pongInvite;
 const pongLoadA=state(a,"pong","loading"),pongLoadB=state(b,"pong","loading");
 b.emit("game:respond",true);
 const [loading]=await Promise.all([pongLoadA,pongLoadB]);
 assert.deepEqual(loading.sceneReady,[false,false],"3D Pong must wait for both players to load");
 const pongStartA=state(a,"pong","playing"),pongStartB=state(b,"pong","playing");
 a.emit("pong:scene-ready",{id:loading.id});
 b.emit("pong:scene-ready",{id:loading.id});
 const [psa,psb]=await Promise.all([pongStartA,pongStartB]);
 assert.deepEqual(psa.pong.scores,[0,0]);assert.deepEqual(psa.pong.scores,psb.pong.scores);
 console.log("✓ Ping Pong accepted by both players, matching initial scores");
 const movedA=state(a,"pong","playing",g=>g.pong.paddles[0]>.84);
 const movedB=state(b,"pong","playing",g=>g.pong.paddles[0]>.84);
 a.emit("pong:paddle",.86);await Promise.all([movedA,movedB]);
 console.log("✓ Player paddle movement reaches both clients");
 const ballA=state(a,"pong","playing",g=>Math.abs(g.pong.ball.x-.5)>.045);
 const ballB=state(b,"pong","playing",g=>Math.abs(g.pong.ball.x-.5)>.045);
 const [ba,bb]=await Promise.all([ballA,ballB]);
 assert.ok(Math.abs(ba.pong.ball.x-bb.pong.ball.x)<.025);
 console.log("✓ Authoritative ball physics streams synchronized snapshots");
 const interrupted=wait(b,"partner:connection",v=>v.connected===false);
 const ended=wait(b,"match:ended",()=>true,16000);a.disconnect();await interrupted;await ended;
 console.log("✓ Disconnect ends live arena and clears match room");
 console.log("ALL ARCADE SERVER TESTS PASSED");
}
test().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{a.disconnect();b.disconnect();});
