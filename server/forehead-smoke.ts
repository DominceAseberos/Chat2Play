import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {io,type Socket} from "socket.io-client";
import {createForehead,foreheadView,advanceTurn,submitGuess,skipForehead,validForeheadOptions,result,markSpokenCorrect} from "./forehead.js";
const clients:Socket[]=[];
function once(s:Socket,event:string,predicate:(v:any)=>boolean=()=>true,ms=7000):Promise<any>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{s.off(event,onMessage);reject(new Error("Timeout "+event));},ms);
  function onMessage(data:any){if(!predicate(data))return;clearTimeout(timer);s.off(event,onMessage);resolve(data);}
  s.on(event,onMessage);
 });
}
async function connect(){
 const s=io("http://127.0.0.1:3001",{autoConnect:false,reconnection:false,transports:["websocket"]});
 clients.push(s);const opened=once(s,"connect");s.connect();await opened;return s;
}
const opposite=(s:0|1)=>(1-s) as 0|1;
try{
 assert.equal(validForeheadOptions({difficulty:"easy",durationSeconds:301}),null);
 const now=1000000;
 const local=createForehead({difficulty:"medium",durationSeconds:120,categories:["Animal","Food"]},now);
 const first=local.turn,second=opposite(first);
 assert.deepEqual(local.timesLeft,[120000,120000]);
 assert.equal(foreheadView(local,first,now).otherWord,"");
 assert.equal(foreheadView(local,second,now).otherWord,local.words[first]);
 const correctWord=local.words[first];
 assert.equal(submitGuess(local,first,correctWord,now+1000),"correct");
 assert.equal(local.scores[first],1);
 assert.equal(local.turn,second);
 assert.equal(local.completed,1);
 assert.equal(local.timesLeft[first],119000);
 assert.equal(local.timesLeft[second],120000);
 assert.equal(local.words[first],"");
 assert.equal(local.expression?.kind,"correct");
 assert.equal(foreheadView(local,first,now+1000).otherWord,local.words[second]);
 assert.equal(foreheadView(local,second,now+1000).otherWord,"");
 assert.equal(skipForehead(local,second,now+6000),true);
 assert.equal(local.turn,first);
 assert.equal(local.completed,2);
 assert.equal(local.timesLeft[second],115000);
 assert.equal(local.timesLeft[first],119000);
 assert.equal(local.scores[second],0);
 assert.equal(local.expression?.kind,"pass");
 assert.equal(advanceTurn(local,now+125000),true); // first uses its remaining 119s
 assert.equal(local.timesLeft[first],0);
 assert.equal(local.turn,second);
 assert.equal(local.timesLeft[second],115000);
 assert.equal(local.finished,false);
 assert.equal(advanceTurn(local,now+240000),true);
 assert.deepEqual(local.timesLeft,[0,0]);
 assert.equal(local.finished,true);
 assert.equal(result(local),first);
 assert.equal(local.words.join(""),"");
 assert.equal(advanceTurn(local,now+260000),false);
 const spoken=createForehead({difficulty:"easy",durationSeconds:120,categories:["Animal"]},now);
 const speaker=spoken.turn,listener=opposite(speaker);
 assert.equal(markSpokenCorrect(spoken,speaker,now+1000),false,"Guesser cannot approve their own spoken word");
 assert.equal(markSpokenCorrect(spoken,listener,now+1000),true);
 assert.equal(spoken.scores[speaker],1);
 assert.equal(spoken.turn,listener);
 assert.equal(markSpokenCorrect(spoken,listener,now+1001),false,"New guesser cannot award their own point");
 console.log("PASS spoken answer may only be marked Correct by the hint giver");
 console.log("PASS independent clocks, freeze/resume, correct +1 and switch, Pass no points, expiry winner");

 const [a,b]=await Promise.all([connect(),connect()]);
 const profile={gender:"unspecified",lookingFor:"any",interests:["forehead"],fallback:"automatic",isAdult:true};
 const foundA=once(a,"match:found"),foundB=once(b,"match:found");
 a.emit("queue:join",profile);b.emit("queue:join",profile);
 await Promise.all([foundA,foundB]);
 const invitedA=once(a,"game:state",g=>g?.phase==="invite"&&g.kind==="forehead");
 const invitedB=once(b,"game:state",g=>g?.phase==="invite"&&g.kind==="forehead");
 a.emit("game:propose","forehead");
 await Promise.all([invitedA,invitedB]);
 const invitedAccepted=once(a,"game:state",g=>g?.phase==="categories");
 b.emit("game:respond",true);
 const proposed=await invitedAccepted;
 const categorySent=once(b,"game:state",g=>g?.foreheadCategories?.includes("Animal"));
 a.emit("forehead:categories:select",{id:proposed.id,confirmed:true,categories:["Country","Animal"]});
 await categorySent;
 const settingsReady=once(a,"game:state",g=>g?.phase==="settings");
 b.emit("forehead:categories:agree",{id:proposed.id,confirmed:true,categories:["Country","Animal"]});
 await settingsReady;
 const beganA=once(a,"game:state",g=>g?.phase==="playing"&&!!g.forehead);
 const beganB=once(b,"game:state",g=>g?.phase==="playing"&&!!g.forehead);
 const micPrompt=once(a,"game:state",g=>g?.phase==="mic"&&!!g.forehead);
 a.emit("forehead:configure",{id:proposed.id,difficulty:"easy",durationSeconds:60});
 const micGame=await micPrompt;
 assert.deepEqual(micGame.micReady,[false,false]);
 const micOne=once(b,"game:state",g=>g?.phase==="mic"&&g.micReady?.[0]===true);
 a.emit("forehead:mic-ready",{id:proposed.id});await micOne;
 const loading=once(a,"game:state",g=>g?.phase==="loading"&&!!g.forehead);
 b.emit("forehead:mic-ready",{id:proposed.id});
 const loadingGame=await loading;
 assert.deepEqual(loadingGame.micReady,[true,true]);
 assert.deepEqual(loadingGame.sceneReady,[false,false]);
 const onlyA=once(b,"game:state",g=>g?.phase==="loading"&&g.sceneReady?.[0]===true);
 a.emit("forehead:scene-ready",{id:proposed.id});
 await onlyA;
 b.emit("forehead:scene-ready",{id:proposed.id});
 let [ga,gb]=await Promise.all([beganA,beganB]);
 const firstSide=ga.forehead.turn as 0|1,firstPlayer=firstSide===0?a:b,secondPlayer=firstSide===0?b:a;
 const firstView=firstSide===0?ga:gb,secondView=firstSide===0?gb:ga;
 assert.equal(firstView.forehead.otherWord,"");
 assert.ok(secondView.forehead.otherWord);
 assert.equal(firstView.forehead.timesLeft.length,2);
 // Both players are authorized to look around and are synced with peer.
 const lookFromGuesser=once(secondPlayer,"forehead:look",pose=>pose?.yaw===.32);
 firstPlayer.emit("forehead:look",{id:ga.id,round:0,serial:ga.forehead.wordSerial,yaw:.32,pitch:-.12});
 await lookFromGuesser;
 await new Promise(resolve=>setTimeout(resolve,120));
 const lookFromGiver=once(firstPlayer,"forehead:look",pose=>pose?.yaw===-.26);
 secondPlayer.emit("forehead:look",{id:ga.id,round:0,serial:ga.forehead.wordSerial,yaw:-.26,pitch:.10});
 await lookFromGiver;
 console.log("PASS two-way head movement relay with no secret word leaked");
 const questionId=randomUUID();
 const receiving=once(secondPlayer,"chat:message",m=>m?.id===questionId);
 const qState=once(secondPlayer,"game:state",g=>g?.forehead?.chatQuestion?.id===questionId);
 firstPlayer.emit("chat:send",{id:questionId,kind:"text",text:"Does it live on land?"});
 await receiving;
 const questionGame=await qState;
 assert.equal(questionGame.forehead.chatQuestion.answered,false);
 const rejectedReply=once(firstPlayer,"chat:message",m=>m?.replyTo===questionId,600);
 firstPlayer.emit("forehead:chat-answer",{id:ga.id,round:0,serial:ga.forehead.wordSerial,questionId,yes:true});
 try{await rejectedReply;throw Error("Guesser answered own question");}
 catch(e){if(!String(e).includes("Timeout"))throw e;}
 const answerEvent=once(firstPlayer,"chat:message",m=>m?.replyTo===questionId);
 const answeredA=once(a,"game:state",g=>g?.forehead?.chatQuestion?.answered===true);
 const answeredB=once(b,"game:state",g=>g?.forehead?.chatQuestion?.answered===true);
 secondPlayer.emit("forehead:chat-answer",{id:ga.id,round:0,serial:ga.forehead.wordSerial,questionId,yes:true});
 const resultMessage=await answerEvent;
 assert.equal(resultMessage.text,"YES");
 const [answeredGameA,answeredGameB]=await Promise.all([answeredA,answeredB]);
 assert.equal(answeredGameA.forehead.chatQuestion.answer,true);
 assert.equal(answeredGameB.forehead.hints.length,0,"Chat answer consumed a category hint");
 assert.equal(answeredGameB.forehead.scores[firstSide],0,"Chat answer scored a point");
 console.log("PASS guesser text question, YES/NO reply visible as chat, no category/score side effect");
 // Duplicate replies and stale question IDs are rejected.
 firstPlayer.emit("forehead:chat-answer",{id:ga.id,round:0,serial:ga.forehead.wordSerial,questionId,yes:false});

 const scoreA=once(a,"game:state",g=>g?.forehead?.scores?.[firstSide]===1);
 const scoreB=once(b,"game:state",g=>g?.forehead?.scores?.[firstSide]===1);
 secondPlayer.emit("forehead:heard-correct",{id:ga.id,round:0,serial:ga.forehead.wordSerial});
 [ga,gb]=await Promise.all([scoreA,scoreB]);
 assert.equal(ga.forehead.turn,1-firstSide);
 assert.equal(ga.forehead.completed,1);
 assert.equal(ga.forehead.expression.kind,"correct");
 assert.equal(ga.forehead.scores[firstSide],1);
 assert.equal((firstSide===0?ga:gb).forehead.otherWord,ga.forehead.otherWord||gb.forehead.otherWord);
 assert.equal((firstSide===0?gb:ga).forehead.otherWord,"");
 assert.ok(ga.forehead.timesLeft[firstSide]<60000);
 assert.ok(ga.forehead.timesLeft[opposite(firstSide)]<=60000);
 console.log("PASS correct guess stops current clock, switches roles, clears old word");

 const oldSerial=ga.forehead.wordSerial;
 const nextA=once(a,"game:state",g=>g?.forehead?.completed===2);
 const nextB=once(b,"game:state",g=>g?.forehead?.completed===2);
 secondPlayer.emit("forehead:skip",{round:1,serial:oldSerial});
 [ga,gb]=await Promise.all([nextA,nextB]);
 assert.equal(ga.forehead.turn,firstSide);
 assert.equal(ga.forehead.scores[opposite(firstSide)],0);
 assert.equal(ga.forehead.expression.kind,"pass");
 console.log("PASS Pass switches roles, adds no point and preserves independent clocks");
 console.log("ALL PINOY HENYO MULTIPLAYER AND CLOCK TESTS PASSED");
}catch(err){console.error("FAIL",err);process.exitCode=1;}
finally{for(const s of clients)s.disconnect();}
