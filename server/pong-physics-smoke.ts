import assert from "node:assert/strict";
import {createPong,pongView,setPongCharge,tickPong,MAX_SMASH_CHARGE_MS} from "./arcade.js";
import {pongContactPose} from "../src/pongSwing.js";
const fixed=10_000;
const partial=createPong();
setPongCharge(partial,0,true,fixed);
assert.equal(pongView(partial,fixed+250).charge[0],.25,"A short hold should build some power");
assert.equal(pongView(partial,fixed+750).charge[0],.75,"A longer hold should build more power");
setPongCharge(partial,0,false,fixed+600);
assert.equal(partial.shot[0]?.power,.6,"Release should preserve proportional power");
const p=createPong();
p.serveAt=0;p.lastTick=fixed+MAX_SMASH_CHARGE_MS*2;p.ball={x:.069,y:.5,vx:-.40,vy:0,h:.38,vh:0};p.paddles=[.5,.5];
setPongCharge(p,0,true,fixed);
assert.equal(pongView(p,fixed+MAX_SMASH_CHARGE_MS*2).charge[0],1);
setPongCharge(p,0,false,fixed+MAX_SMASH_CHARGE_MS*2);
assert.equal(p.shot[0]?.power,1,"2x hold must cap to 100%");
const result=tickPong(p,fixed+MAX_SMASH_CHARGE_MS*2+33);
assert.equal(result,null);
assert.ok(p.ball.vx>0,"Paddle must reverse ball velocity on collision");
assert.ok(Math.hypot(p.ball.vx,p.ball.vy)<=.951,"Impact impulse exceeds speed cap");
assert.ok(p.ball.vh>0,"Paddle must send ball upward");
assert.ok(p.lastSmash[0]>0,"Server did not register charged smash");
console.log("PASS: capped long-press smash releases a physical collision, changes ball velocity/height and registers impact.");
for(const side of [0,1] as const){
 const held=createPong();held.serveAt=0;held.lastTick=fixed;
 held.ball={x:side===0?.069:.931,y:.5,vx:side===0?-.4:.4,vy:0,h:.38,vh:0};
 held.paddles=[.5,.5];
 setPongCharge(held,side,true,fixed);
 tickPong(held,fixed+33);
 assert.equal(Math.sign(held.ball.vx),side===0?-1:1,"Holding must not rebound the ball");
 assert.equal(held.lastSmash[side],0,"Holding must not register a hit");
 setPongCharge(held,side,false,fixed+34);
 tickPong(held,fixed+67);
 assert.equal(Math.sign(held.ball.vx),side===0?-1:1,
  "Releasing after the ball crossed the blade must not pull it back");
}
console.log("PASS: both paddles let the ball pass while held; a late release cannot hit it.");
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
