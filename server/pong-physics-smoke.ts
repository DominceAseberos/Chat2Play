import assert from "node:assert/strict";
import {createPong,pongView,movePaddle,setPongDragging,tickPong} from "./arcade.js";
import {paddleSideAngle,pongContactPose,pongSwingMotion,predictPongContact} from "../src/pongSwing.js";
const fixed=10_000;
function draggedHit(duration:number,travel:number){
 const p=createPong();p.serveAt=0;
 movePaddle(p,0,.62-travel,fixed);
 setPongDragging(p,0,true,fixed+10);
 movePaddle(p,0,.62,fixed+10+duration);
 p.lastTick=fixed+10+duration;
 p.ball={x:-.081,y:.62,vx:-.4,vy:0,h:.38,vh:0};
 assert.ok(pongView(p,fixed+10+duration).swipe[0]>0,"Swipe strength should appear while dragging");
 tickPong(p,fixed+43+duration);
 assert.ok(p.ball.vx>0,"Paddle must return the incoming ball");
 assert.ok(p.lastHit[0]>0,"Impact should be recorded");
 return p.hitPower[0];
}
const fast=draggedHit(75,.26),slow=draggedHit(600,.26),short=draggedHit(75,.05);
assert.ok(fast>slow&&fast>short,`Power should grow with drag speed and travel: ${fast}, ${slow}, ${short}`);
assert.ok(fast<=1,"Swipe power should be capped");
console.log("PASS: faster and longer drags produce stronger physical strikes.");
const idle=createPong();idle.serveAt=0;idle.lastTick=fixed;
idle.ball={x:-.081,y:.5,vx:-.4,vy:0,h:.38,vh:0};
tickPong(idle,fixed+33);
assert.ok(idle.ball.vx<0&&idle.lastHit[0]===0,
 "A still paddle must not strike an incoming ball");
const stale=createPong();stale.serveAt=0;
movePaddle(stale,0,.36,fixed-1000);
setPongDragging(stale,0,true,fixed-950);
movePaddle(stale,0,.5,fixed-900);
setPongDragging(stale,0,false,fixed-899);
stale.lastTick=fixed;
stale.ball={x:-.081,y:.5,vx:-.4,vy:0,h:.38,vh:0};
tickPong(stale,fixed+33);
assert.ok(stale.ball.vx<0&&stale.lastHit[0]===0,
 "An old drag must not cause a delayed strike");
console.log("PASS: still paddles and expired swipes cannot return the ball.");
const range=createPong();
movePaddle(range,0,{y:.5,depth:1},fixed);
movePaddle(range,1,{y:.5,depth:0},fixed);
assert.equal(range.depths[0],.46,"Near paddle must stop before the net");
assert.equal(range.depths[1],.54,"Far paddle must stop before the net");
movePaddle(range,0,{y:.5,depth:-1},fixed);
movePaddle(range,1,{y:.5,depth:2},fixed);
assert.equal(range.depths[0],-.1,"Near paddle must be able to retreat outside the board");
assert.equal(range.depths[1],1.1,"Far paddle must be able to retreat outside the board");
const forward=createPong();forward.serveAt=0;forward.lastTick=fixed;
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
net.ball={x:.496,y:.5,vx:.45,vy:0,h:.13,vh:0};
tickPong(net,fixed+25);
assert.ok(net.ball.vx<0&&net.netHits>0,"Low ball did not collide with net");
console.log("PASS: low ball hits the physical net and rebounds.");
const bounce=createPong();bounce.serveAt=0;bounce.lastTick=fixed;
bounce.ball={x:.30,y:.50,vx:.08,vy:0,h:.0901,vh:-.5};
tickPong(bounce,fixed+25);
assert.ok(bounce.ball.vh>0&&bounce.ball.h>=.09,"Gravity/table bounce invalid");
console.log("PASS: gravity and table bounce produce vertical physical motion.");
