import assert from "node:assert/strict";
import {createPong,pongView,movePaddle,setPongDragging,tickPong} from "./arcade.js";
import {paddleSideAngle,pongContactPose,pongSwingMotion,predictPongContact} from "../src/pongSwing.js";
const fixed=10_000;
function draggedHit(duration:number,travel:number){
 const p=createPong();p.serveAt=0;
 p.lastHitter=1;p.bounceQueue=[];
 movePaddle(p,0,.62-travel,fixed);
 setPongDragging(p,0,true,fixed+10);
 movePaddle(p,0,.62,fixed+10+duration);
 p.lastTick=fixed+10+duration;
 p.ball={x:-.075,y:.62,vx:-.4,vy:0,h:.38,vh:0};
 assert.ok(pongView(p,fixed+10+duration).swipe[0]>0,"Swipe strength should appear while dragging");
 tickPong(p,fixed+43+duration);
 assert.ok(p.ball.vx>0,"Paddle must return the incoming ball: "+JSON.stringify({ball:p.ball,score:p.scores,hit:p.lastHit,paddle:p.paddles,drag:p.drag[0]}));
 assert.ok(p.lastHit[0]>0,"Impact should be recorded");
 return p.hitPower[0];
}
const fast=draggedHit(75,.26),slow=draggedHit(600,.26),short=draggedHit(75,.05);
assert.ok(fast>slow&&fast>short,`Power should grow with drag speed and travel: ${fast}, ${slow}, ${short}`);
assert.ok(fast<=1,"Swipe power should be capped");
console.log("PASS: faster and longer drags produce stronger physical strikes.");
const idle=createPong();idle.serveAt=0;idle.lastTick=fixed;
idle.lastHitter=1;idle.bounceQueue=[];
idle.ball={x:-.075,y:.5,vx:-.4,vy:0,h:.38,vh:0};
tickPong(idle,fixed+33);
assert.ok(idle.ball.vx<0&&idle.lastHit[0]===0,
 "A still paddle must not strike an incoming ball");
const stale=createPong();stale.serveAt=0;
stale.lastHitter=1;stale.bounceQueue=[];
movePaddle(stale,0,.36,fixed-1000);
setPongDragging(stale,0,true,fixed-950);
movePaddle(stale,0,.5,fixed-900);
setPongDragging(stale,0,false,fixed-899);
stale.lastTick=fixed;
stale.ball={x:-.075,y:.5,vx:-.4,vy:0,h:.38,vh:0};
tickPong(stale,fixed+33);
assert.ok(stale.ball.vx<0&&stale.lastHit[0]===0,
 "An old drag must not cause a delayed strike");
console.log("PASS: still paddles and expired swipes cannot return the ball.");
const range=createPong();
movePaddle(range,0,{y:1.7,depth:-.1},fixed);
movePaddle(range,1,{y:-.7,depth:1.1},fixed);
assert.equal(range.paddles[0],1.35,"Paddle must travel past the right side of the table");
assert.equal(range.paddles[1],-.35,"Other paddle must travel past the left side");
movePaddle(range,0,{y:.5,depth:1},fixed);
movePaddle(range,1,{y:.5,depth:0},fixed);
assert.equal(range.depths[0],.46,"Near paddle must stop before the net");
assert.equal(range.depths[1],.54,"Far paddle must stop before the net");
movePaddle(range,0,{y:.5,depth:-1},fixed);
movePaddle(range,1,{y:.5,depth:2},fixed);
assert.equal(range.depths[0],-.1,"Near paddle must be able to retreat outside the board");
assert.equal(range.depths[1],1.1,"Far paddle must be able to retreat outside the board");
const forward=createPong();forward.serveAt=0;forward.lastTick=fixed;
forward.lastHitter=1;forward.bounceQueue=[];
setPongDragging(forward,0,true,fixed);
movePaddle(forward,0,{y:.5,depth:.25},fixed+20);
forward.ball={x:.18,y:.5,vx:-.4,vy:0,h:.38,vh:0};
tickPong(forward,fixed+33);
assert.ok(forward.ball.vx>0&&forward.lastHit[0]>0,
 "A forward drag must strike a ball when the moving paddle crosses it");
console.log("PASS: paddle moves behind the board or up to the net and hits on its forward sweep.");
const assist=createPong();assist.serveAt=0;assist.lastTick=fixed;
assist.ball={x:.20,y:.78,vx:-.4,vy:0,h:.43,vh:.2};
assist.drag[0].lastAt=fixed-1000;
tickPong(assist,fixed+33);
assert.ok(assist.paddles[0]>.5&&assist.paddles[0]<.51,"Idle assist should move gently toward the arriving ball");
const predicted=predictPongContact(assist.ball,0);
assert.ok(predicted&&predicted.y>.75&&Number.isFinite(predicted.h)&&predicted.eta>0,
 "Prediction should include lateral arrival, time and airborne height");
assert.ok(Math.abs(paddleSideAngle(.5,true)+Math.PI/2)<.001&&
 Math.abs(paddleSideAngle(.12,true))<.001&&
 Math.abs(paddleSideAngle(.88,true)+Math.PI)<.001,
 "Paddle should rotate from upright center to horizontal at either edge");
console.log("PASS: paddle anticipates arrival height and angle while idle.");
const low=pongContactPose({y:.5,h:.09},0,.5,1);
const high=pongContactPose({y:.5,h:.52},0,.5,1);
assert.equal(low.kind,"scoop");assert.equal(high.kind,"smash");
assert.ok(low.pitch<0&&high.pitch>0&&low.height<high.height,
 "Low and high swings need different pitch and contact height");
const left=pongContactPose({y:.38,h:.35},0,.5,.3);
const right=pongContactPose({y:.62,h:.35},0,.5,.3);
assert.ok(left.yaw<0&&right.yaw>0&&left.lean>0&&right.lean<0,
 "The blade must turn toward balls at either side");
assert.ok(pongContactPose({y:.62,h:.35},1,.5,.3).yaw<0,
 "The opposite camera must mirror left/right aiming");
const lowStroke=pongSwingMotion(low,.5,1),highStroke=pongSwingMotion(high,.5,1);
const leftStroke=pongSwingMotion(left,.5,.3),rightStroke=pongSwingMotion(right,.5,.3);
assert.ok(lowStroke.vertical>.2&&highStroke.vertical<-.2,
 "Low and high shots must travel in opposite vertical directions");
assert.ok(leftStroke.side<-.2&&rightStroke.side>.2&&leftStroke.roll>0&&rightStroke.roll<0,
 "Side shots must sweep and turn toward the incoming ball");
console.log("PASS: low, high, left and right contacts select distinct paddle poses.");
const net=createPong();net.serveAt=0;net.lastTick=fixed;
net.server=1;net.lastHitter=0;net.bounceQueue=[1];net.serveActive=false;
net.ball={x:.496,y:.5,vx:.45,vy:0,h:.13,vh:0};
tickPong(net,fixed+25);
assert.ok(net.netHits>0&&net.scores[1]===1,"Low return at the net must lose the point");
console.log("PASS: low return at the net is a fault.");
const letServe=createPong();letServe.serveAt=0;letServe.lastTick=fixed;
letServe.server=0;letServe.lastHitter=0;letServe.bounceQueue=[1];letServe.serveActive=true;
letServe.ball={x:.496,y:.5,vx:.45,vy:0,h:.13,vh:0};
tickPong(letServe,fixed+25);
assert.deepEqual(letServe.scores,[0,0],"A serve that clips the net is a let");
assert.ok(letServe.serveAt>fixed+25&&letServe.bounceQueue.length===2,
 "A net let must replay the same serve");
const bounce=createPong();bounce.serveAt=0;bounce.lastTick=fixed;
bounce.lastHitter=0;bounce.bounceQueue=[0,1];
bounce.ball={x:.30,y:.50,vx:.08,vy:0,h:.0901,vh:-.5};
tickPong(bounce,fixed+25);
assert.ok(bounce.ball.vh>0&&bounce.ball.h>=.09&&bounce.bounceQueue[0]===1,
 "Serve must bounce on server's side before receiver's side");
console.log("PASS: gravity and table bounce produce vertical physical motion.");
const sideOut=createPong();sideOut.serveAt=0;sideOut.lastTick=fixed;
sideOut.lastHitter=0;sideOut.bounceQueue=[1];
sideOut.ball={x:.7,y:.99,vx:.25,vy:.8,h:.4,vh:0};
tickPong(sideOut,fixed+33);
assert.deepEqual(sideOut.scores,[0,0],"An airborne ball beyond the sideline is still live");
let airborneTicks=0;
for(let t=fixed+66;t<fixed+1200&&!sideOut.scores[1];t+=33){
 tickPong(sideOut,t);
 if(!sideOut.scores[1])airborneTicks++;
}
assert.ok(airborneTicks>=5,"The point must wait for the ball's visible fall");
assert.equal(sideOut.scores[1],1,"A shot missing the table scores only when it reaches the ground");
const chase=createPong();chase.serveAt=0;chase.lastTick=fixed;
chase.lastHitter=0;chase.bounceQueue=[];
chase.ball={x:.8,y:.99,vx:.25,vy:.8,h:.3,vh:0};
tickPong(chase,fixed+33);
assert.deepEqual(chase.scores,[0,0],"A legal bounce may be chased beyond the sideline");
chase.ball.h=-.16;chase.ball.vh=-.5;
tickPong(chase,fixed+66);
assert.equal(chase.scores[0],1,"A missed return beyond the sideline awards the hitter");
const secondBounce=createPong();secondBounce.serveAt=0;secondBounce.lastTick=fixed;
secondBounce.lastHitter=0;secondBounce.bounceQueue=[];
secondBounce.ball={x:.8,y:.5,vx:.2,vy:0,h:.0901,vh:-.5};
tickPong(secondBounce,fixed+33);
assert.equal(secondBounce.scores[0],1,"A second bounce awards the hitter");
const wrongCourt=createPong();wrongCourt.serveAt=0;wrongCourt.lastTick=fixed;
wrongCourt.lastHitter=0;wrongCourt.bounceQueue=[1];
wrongCourt.ball={x:.2,y:.5,vx:.2,vy:0,h:.0901,vh:-.5};
tickPong(wrongCourt,fixed+33);
assert.equal(wrongCourt.scores[1],1,"A return bouncing on the hitter's side is a fault");
console.log("PASS: open sidelines, legal outside chase, second bounce and wrong-court faults.");
const legalServe=createPong();legalServe.serveAt=0;legalServe.lastTick=fixed;
legalServe.server=0;legalServe.lastHitter=0;legalServe.bounceQueue=[0,1];
legalServe.ball={x:.1,y:.5,vx:.47,vy:0,h:.24,vh:.12};
let ownBounce=false,receiverBounce=false;
for(let t=fixed+25;t<fixed+2500;t+=25){
 tickPong(legalServe,t);
 if(legalServe.bounceQueue.length===1)ownBounce=true;
 if(ownBounce&&legalServe.bounceQueue.length===0){receiverBounce=true;break;}
 if(legalServe.scores[0]||legalServe.scores[1]||legalServe.netHits)break;
}
assert.ok(ownBounce&&receiverBounce,
 "Automatic serve must bounce on both sides before a return is allowed: "+
 JSON.stringify({scores:legalServe.scores,netHits:legalServe.netHits,queue:legalServe.bounceQueue}));
console.log("PASS: serve bounces on the server's side, clears the net, then bounces for the receiver.");
const deuce=createPong();deuce.serveAt=0;deuce.lastTick=fixed;
deuce.scores=[10,10];deuce.lastHitter=0;deuce.bounceQueue=[1];
deuce.ball={x:.7,y:1.01,vx:.25,vy:.8,h:-.16,vh:-.5};
assert.equal(tickPong(deuce,fixed+33),null,"11–10 must not end a game");
assert.deepEqual(deuce.scores,[10,11]);
deuce.serveAt=0;deuce.lastTick=fixed+33;
deuce.lastHitter=0;deuce.bounceQueue=[1];
deuce.ball={x:.7,y:1.01,vx:.25,vy:.8,h:-.16,vh:-.5};
assert.equal(tickPong(deuce,fixed+66),1,"A two-point lead after deuce wins");
console.log("PASS: first to eleven requires a two-point lead.");
const rotation=createPong();rotation.serveAt=0;rotation.lastTick=fixed;
rotation.firstServer=0;rotation.server=0;
for(let i=1;i<=4;i++){
 rotation.lastHitter=0;rotation.bounceQueue=[1];rotation.serveActive=false;
 rotation.ball={x:.7,y:1.01,vx:.25,vy:.8,h:-.16,vh:-.5};
 rotation.serveAt=0;rotation.lastTick=fixed+i*33-33;
 tickPong(rotation,fixed+i*33);
 assert.equal(rotation.server,i<=1||i>=4?0:1,
  "Server must change after every two points: "+i);
}
console.log("PASS: net lets replay and service alternates every two points.");
