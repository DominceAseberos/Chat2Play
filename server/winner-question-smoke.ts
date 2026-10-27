import assert from "node:assert/strict";
import {io,type Socket} from "socket.io-client";

const url=process.env.LIVE_TEST_URL||"http://127.0.0.1:3003";
const clients=[0,1].map(()=>io(url,{autoConnect:false,transports:["websocket"],reconnection:false})) as [Socket,Socket];
function wait(socket:Socket,event:string,check:(value:any)=>boolean=()=>true,timeout=7000):Promise<any>{
 return new Promise((resolve,reject)=>{
  const handler=(value:any)=>{if(!check(value))return;clearTimeout(timer);socket.off(event,handler);resolve(value);};
  const timer=setTimeout(()=>{socket.off(event,handler);reject(new Error(`Timed out waiting for ${event}`));},timeout);
  socket.on(event,handler);
 });
}
function request(socket:Socket,event:string,data:unknown):Promise<{ok:boolean;error?:string}>{
 return new Promise(resolve=>socket.timeout(5000).emit(event,data,(error:Error|null,result?:{ok:boolean;error?:string})=>
  resolve(error?{ok:false,error:error.message}:result??{ok:false})));
}
async function run(){
 const [a,b]=clients;
 try{
 const connected=clients.map(s=>wait(s,"connect"));clients.forEach(s=>s.connect());await Promise.all(connected);
 const matched=clients.map(s=>wait(s,"match:found"));
 clients.forEach(s=>s.emit("queue:join",{gender:"unspecified",lookingFor:"any",interests:["ttt"],isAdult:true}));
 await Promise.all(matched);
 const invited=wait(b,"game:state",g=>g?.kind==="ttt"&&g.phase==="invite");
 a.emit("game:propose","ttt");await invited;
 const started=wait(a,"game:state",g=>g?.kind==="ttt"&&g.phase==="playing");
 b.emit("game:respond",true);
 const game=await started,first=game.turn as 0|1,second=(1-first) as 0|1;
 const sequence:[[0|1,number],[0|1,number],[0|1,number],[0|1,number],[0|1,number]]=[
  [first,0],[second,3],[first,1],[second,4],[first,2]
 ];
 const awarded=clients.map(s=>wait(s,"winner-question:state",v=>v.question?.gameId===game.id));
 for(let i=0;i<sequence.length;i++){
  const [player,cell]=sequence[i];
  const state=wait(a,"game:state",g=>g?.id===game.id&&g.board?.filter((x:unknown)=>x!==null).length===i+1);
  clients[player].emit("game:move",cell);await state;
 }
 const [initial,peerInitial]=await Promise.all(awarded);
 assert.equal(initial.question.asker,first);assert.deepEqual(initial,peerInitial);
 assert.deepEqual(initial.skipsLeft,[3,3]);
 const id=initial.question.id;
 assert.equal((await request(clients[second],"winner-question:ask",{id,text:"Can I ask this?"})).ok,false);
 assert.equal((await request(clients[first],"winner-question:answer",{id,text:"Spoofed answer"})).ok,false);
 assert.equal((await request(clients[first],"chat:send",{id:crypto.randomUUID(),kind:"text",text:"Bypass"})).ok,false);
 const blocked=wait(clients[first],"system:notice",s=>s.includes("winner's question"));
 clients[first].emit("game:propose","ttt");await blocked;
 for(let skipped=0;skipped<3;skipped++){
  const asked=clients.map(s=>wait(s,"winner-question:state",v=>v.question?.phase==="answering"&&v.question?.round===skipped+1));
  assert.equal((await request(clients[first],"winner-question:ask",{id,text:`What would you like to try next, round ${skipped+1}?`})).ok,true);
  await Promise.all(asked);
  const updated=clients.map(s=>wait(s,"winner-question:state",v=>v.question?.phase==="asking"&&v.question?.round===skipped+2));
  assert.equal((await request(clients[second],"winner-question:skip",{id})).ok,true);
  const [next,other]=await Promise.all(updated);
  assert.deepEqual(next,other);assert.equal(next.skipsLeft[second],2-skipped);
 }
 const finalAsk=wait(a,"winner-question:state",v=>v.question?.phase==="answering"&&v.question?.round===4);
 assert.equal((await request(clients[first],"winner-question:ask",{id,text:"What is your favorite place to visit?"})).ok,true);
 await finalAsk;
 assert.equal((await request(clients[second],"winner-question:skip",{id})).ok,false);
 const answered=clients.map(s=>wait(s,"winner-question:state",v=>v.question===null));
 const answerMessage=wait(clients[first],"chat:message",m=>m.kind==="winner-answer");
 assert.equal((await request(clients[second],"winner-question:answer",{id,text:"The beach."})).ok,true);
 const [done,otherDone]=await Promise.all(answered);
 assert.deepEqual(done,otherDone);assert.equal(done.skipsLeft[second],0);
 assert.equal(done.skipsLeft[first],3,"Each person keeps their own three-skip budget");
 assert.equal((await answerMessage).text,"The beach.");
 const nextInvite=wait(b,"game:state",g=>g?.kind==="ttt"&&g.phase==="invite"&&g.id!==game.id);
 a.emit("game:propose","ttt");await nextInvite;
 console.log("PASS: winner asks, loser uses three skips, fourth question must be answered, both clients resume games");
}finally{clients.forEach(s=>s.disconnect());}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
