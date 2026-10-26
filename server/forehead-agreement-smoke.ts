import assert from "node:assert/strict";
import {io,type Socket} from "socket.io-client";
import {createForehead,validForeheadOptions,newWord} from "./forehead.js";
import {GAME_CATEGORIES,selectedWordPool} from "./foreheadWordBank.js";
const sockets:Socket[]=[];
function wait(s:Socket,event:string,filter:(x:any)=>boolean=()=>true,ms=6000){
 return new Promise<any>((resolve,reject)=>{
  const t=setTimeout(()=>{s.off(event,handler);reject(Error("Timed out "+event))},ms);
  function handler(value:any){if(!filter(value))return;clearTimeout(t);s.off(event,handler);resolve(value)}
  s.on(event,handler)
 });
}
async function join(){
 const s=io("http://127.0.0.1:3001",{autoConnect:false,reconnection:false,transports:["websocket"]});
 sockets.push(s);const ready=wait(s,"connect");s.connect();await ready;return s;
}
try{
 assert.equal(validForeheadOptions({difficulty:"medium",durationSeconds:60,categories:[]}),null);
 assert.equal(validForeheadOptions({difficulty:"medium",durationSeconds:60,categories:["Country","Country"]}),null);
 assert.equal(validForeheadOptions({difficulty:"medium",durationSeconds:60,categories:["Country","Magic"]}),null);
 for(const cat of GAME_CATEGORIES){
  for(const difficulty of ["easy","medium","hard"] as const){
   const pool=selectedWordPool([cat],difficulty);
   assert.ok(pool.length>=10,`${cat}/${difficulty} doesn't have enough words`);
   const game=createForehead({difficulty,durationSeconds:60,categories:[cat]});
   assert.ok(pool.includes(game.words[game.turn]),`${cat} selected word outside approved pool`);
   for(let i=0;i<7;i++)assert.ok(pool.includes(newWord(game)));
  }
 }
 assert.ok(selectedWordPool(["Country","Animal"],"medium").length>selectedWordPool(["Country"],"medium").length);
 console.log("PASS five exclusive category pools, 3 difficulties, no duplicate/invalid categories");
 const [a,b]=await Promise.all([join(),join()]);
 const profile={gender:"unspecified",lookingFor:"any",interests:["forehead"],fallback:"automatic",isAdult:true};
 const matchedA=wait(a,"match:found"),matchedB=wait(b,"match:found");
 a.emit("queue:join",profile);b.emit("queue:join",profile);await Promise.all([matchedA,matchedB]);
 const invitedA=wait(a,"game:state",g=>g?.kind==="forehead"&&g.phase==="invite");
 const invitedB=wait(b,"game:state",g=>g?.kind==="forehead"&&g.phase==="invite");
 // Even spoofed early options cannot skip the invitation or approve categories.
 a.emit("game:propose",{kind:"forehead",options:{difficulty:"medium",durationSeconds:60,categories:["Country"]},categoriesConfirmed:true});
 const [inviteA,inviteB]=await Promise.all([invitedA,invitedB]);
 assert.equal(inviteA.foreheadOptions,undefined);
 assert.equal(inviteB.foreheadCategories,undefined);
 assert.equal(inviteB.categoryAgreement,undefined);
 const unchanged=wait(a,"game:state",g=>g?.phase==="categories",320);
 a.emit("forehead:configure",{id:inviteA.id,difficulty:"easy",durationSeconds:60});
 a.emit("forehead:categories:select",{id:inviteA.id,confirmed:true,categories:["Country"]});
 let skipped=false;
 unchanged.then(()=>skipped=true).catch(()=>{});
 await new Promise(resolve=>setTimeout(resolve,200));
 assert.equal(skipped,false,"Setup occurred before invitation acceptance");
 console.log("PASS invitation sent before setup, cannot be bypassed");
 const acceptedA=wait(a,"game:state",g=>g?.phase==="categories");
 const acceptedB=wait(b,"game:state",g=>g?.phase==="categories");
 b.emit("game:respond",true);
 const [catA,catB]=await Promise.all([acceptedA,acceptedB]);
 assert.equal(catA.foreheadCategories,undefined);
 assert.deepEqual(catB.categoryAgreement,[false,false]);
 // Live drafts are visible to both players, but never count as category consent.
 const liveA=wait(a,"game:state",g=>g?.foreheadCategoryDraft?.join(",")==="Animal,Food");
 const liveB=wait(b,"game:state",g=>g?.foreheadCategoryDraft?.join(",")==="Animal,Food");
 a.emit("forehead:categories:preview",{id:catA.id,categories:["Animal","Food"]});
 const [draftA,draftB]=await Promise.all([liveA,liveB]);
 assert.deepEqual(draftA.categoryAgreement,[false,false]);
 assert.equal(draftB.foreheadCategories,undefined);
 assert.deepEqual(draftB.foreheadCategoryDraft,["Animal","Food"]);
 const revised=wait(b,"game:state",g=>g?.foreheadCategoryDraft?.join(",")==="Country");
 a.emit("forehead:categories:preview",{id:catA.id,categories:["Country"]});
 await revised;
 const cleared=wait(b,"game:state",g=>Array.isArray(g?.foreheadCategoryDraft)&&g.foreheadCategoryDraft.length===0);
 a.emit("forehead:categories:preview",{id:catA.id,categories:[]});
 await cleared;
 const invalidPreview=wait(b,"game:state",g=>g?.foreheadCategoryDraft?.includes("Unknown"),300);
 a.emit("forehead:categories:preview",{id:catA.id,categories:["Unknown"]});
 let leaked=false;invalidPreview.then(()=>leaked=true).catch(()=>{});
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(leaked,false,"Invalid category preview accepted");
 const invalid=wait(a,"system:error");
 a.emit("forehead:categories:select",{id:catA.id,confirmed:true,categories:["Country","Country"]});
 await invalid;
 const chosenA=wait(a,"game:state",g=>g?.phase==="categories"&&g.categoryAgreement?.[0]);
 const chosenB=wait(b,"game:state",g=>g?.phase==="categories"&&g.categoryAgreement?.[0]);
 a.emit("forehead:categories:select",{id:catA.id,confirmed:true,categories:["Country"]});
 const [ca,cb]=await Promise.all([chosenA,chosenB]);
 assert.deepEqual(ca.foreheadCategories,["Country"]);
 assert.deepEqual(cb.categoryAgreement,[true,false]);
 // The invited player can request a new category set without ending the invitation.
 const resetA=wait(a,"game:state",g=>g?.phase==="categories"&&!g.foreheadCategories);
 b.emit("forehead:categories:request-change",{id:ca.id});await resetA;
 const chosenAgainA=wait(a,"game:state",g=>g?.categoryAgreement?.[0]&&g.foreheadCategories);
 const chosenAgainB=wait(b,"game:state",g=>g?.categoryAgreement?.[0]&&g.foreheadCategories);
 a.emit("forehead:categories:select",{id:ca.id,confirmed:true,categories:["Country"]});
 await Promise.all([chosenAgainA,chosenAgainB]);
 const rejectedMismatch=wait(b,"system:error");
 b.emit("forehead:categories:agree",{id:ca.id,confirmed:true,categories:["Animal"]});await rejectedMismatch;
 const settingsA=wait(a,"game:state",g=>g?.phase==="settings");
 const settingsB=wait(b,"game:state",g=>g?.phase==="settings");
 b.emit("forehead:categories:agree",{id:ca.id,confirmed:true,categories:["Country"]});
 const [sa,sb]=await Promise.all([settingsA,settingsB]);
 assert.deepEqual(sa.categoryAgreement,[true,true]);
 assert.deepEqual(sb.foreheadCategories,["Country"]);
 assert.equal(sa.forehead,undefined,"Gameplay started before timer setup");
 // The invited player is not allowed to change agreed settings or start a game.
 b.emit("forehead:configure",{id:sa.id,difficulty:"hard",durationSeconds:60});
 const badTimer=wait(a,"system:error");
 a.emit("forehead:configure",{id:sa.id,difficulty:"hard",durationSeconds:400});await badTimer;
 const startedA=wait(a,"game:state",g=>g?.kind==="forehead"&&g.phase==="playing");
 const startedB=wait(b,"game:state",g=>g?.kind==="forehead"&&g.phase==="playing");
 const permission=wait(a,"game:state",g=>g?.phase==="mic");
 a.emit("forehead:configure",{id:sa.id,difficulty:"medium",durationSeconds:60});
 const preMic=await permission;
 assert.deepEqual(preMic.micReady,[false,false]);
 const micPartial=wait(b,"game:state",g=>g?.phase==="mic"&&g.micReady?.[0]);
 a.emit("forehead:mic-ready",{id:sa.id});await micPartial;
 const loading=wait(a,"game:state",g=>g?.phase==="loading");
 b.emit("forehead:mic-ready",{id:sa.id});
 const waiting=await loading;
 assert.deepEqual(waiting.micReady,[true,true]);
 assert.deepEqual(waiting.sceneReady,[false,false]);
 const partly=wait(b,"game:state",g=>g?.phase==="loading"&&g.sceneReady?.[0]);
 a.emit("forehead:scene-ready",{id:sa.id});
 await partly;
 b.emit("forehead:scene-ready",{id:sa.id});
 const [gameA,gameB]=await Promise.all([startedA,startedB]);
 assert.deepEqual(gameA.categoryAgreement,[true,true]);
 assert.deepEqual(gameB.foreheadOptions.categories,["Country"]);
 const giver=gameA.forehead.turn===0?gameB:gameA;
 assert.ok(selectedWordPool(["Country"],"medium").includes(giver.forehead.otherWord));
 assert.equal((gameA.forehead.turn===0?gameA:gameB).forehead.otherWord,"");
 console.log("PASS dual category confirmation, requested changes, immutable word pool, timer after agreement and word secrecy");
 console.log("ALL INVITE-FIRST AGREEMENT TESTS PASSED");
}catch(e){console.error(e);process.exitCode=1;}finally{for(const s of sockets)s.disconnect();}
