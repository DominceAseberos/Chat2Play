import { randomInt } from "node:crypto";
import {PONG_NET_LIMIT,PONG_REST_DEPTH,pongSwipePower,predictPongContact} from "../src/pongSwing.js";

export type Side = 0 | 1;
export type SymbolId = "sun" | "moon" | "heart" | "star" | "gem" | "zap";
const SYMBOLS: SymbolId[] = ["sun","moon","heart","star","gem","zap"];

export type MemoryState = {
  deck: SymbolId[]; revealed: number[]; matched: boolean[];
  scores: [number,number]; turn: Side; resolving: boolean;
};
export type MemoryView = {
  cards: (SymbolId | null)[]; matched: boolean[]; revealed: number[];
  scores: [number,number]; turn: Side; resolving: boolean;
};
export type PongState = {
  ball:{x:number;y:number;vx:number;vy:number;h:number;vh:number};
  paddles:[number,number];depths:[number,number];previousDepths:[number,number];
  scores:[number,number];serveAt:number;lastTick:number;
  drag:[PongDrag,PongDrag];lastHit:[number,number];hitPower:[number,number];netHits:number;
  firstServer:Side;server:Side;lastHitter:Side;bounceQueue:Side[];serveActive:boolean;
};
type PongDrag={active:boolean;startY:number;startDepth:number;lastAt:number;
 speed:number;travel:number;direction:number};
export type PongView={
  ball:{x:number;y:number;h:number;vx:number;vy:number;vh:number};
  paddles:[number,number];depths:[number,number];scores:[number,number];serving:boolean;
  dragging:[boolean,boolean];swipe:[number,number];lastHit:[number,number];
  hitPower:[number,number];netHits:number;
};
export const PONG_PADDLE_HALF = 0.16;
export const PONG_RADIUS = 0.014;
export const PONG_WIN_SCORE = 11;
export const PONG_SIDE_REACH = 0.35;
export type PongPaddleInput=number|{y:number;depth:number};

export function createMemory(): MemoryState {
  const deck = [...SYMBOLS,...SYMBOLS];
  for(let i=deck.length-1;i>0;i--){
    const j=randomInt(i+1);
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return {
    deck, revealed:[], matched:Array(12).fill(false),
    scores:[0,0], turn: randomInt(2) as Side, resolving:false
  };
}
export function memoryView(mem: MemoryState): MemoryView {
  return {
    cards:mem.deck.map((id,i)=> mem.matched[i]||mem.revealed.includes(i)?id:null),
    matched:[...mem.matched], revealed:[...mem.revealed],
    scores:[...mem.scores] as [number,number],turn:mem.turn,resolving:mem.resolving
  };
}
export function flipMemory(mem:MemoryState,index:number,side:Side): "ignored"|"first"|"match"|"miss"|"finished" {
  if(mem.resolving || mem.turn!==side || !Number.isInteger(index)||index<0||index>=12 ||
    mem.matched[index]||mem.revealed.includes(index)||mem.revealed.length>=2) return "ignored";
  mem.revealed.push(index);
  if(mem.revealed.length===1)return "first";
  const [a,b]=mem.revealed;
  if(mem.deck[a]===mem.deck[b]){
    mem.matched[a]=true;mem.matched[b]=true;
    mem.scores[side]++;
    mem.revealed=[];
    return mem.matched.every(Boolean)?"finished":"match";
  }
  mem.resolving=true;
  return "miss";
}
export function resolveMemoryMismatch(mem:MemoryState) {
  if(!mem.resolving)return;
  mem.revealed=[];
  mem.resolving=false;
  mem.turn=mem.turn===0?1:0;
}
export function memoryWinner(mem:MemoryState): Side|"draw" {
  if(mem.scores[0]===mem.scores[1])return "draw";
  return mem.scores[0]>mem.scores[1]?0:1;
}

// Fixed-step, server-authoritative arcade ball dynamics. Height, table bounce,
 // net impacts and paddle impulses are actual simulated values, not client
 // generated movement. Units are normalized to the table footprint.
const BALL_FLOOR=.09,BALL_GROUND=-.17,NET_HEIGHT=.26,GRAVITY=-2.20;
const other=(side:Side):Side=>side===0?1:0;
function serve(pong:PongState,server:Side,now=Date.now()){
  pong.server=server;pong.lastHitter=server;pong.bounceQueue=[server,other(server)];
  pong.serveActive=true;
  pong.ball={x:server===0?.1:.9,y:.34+Math.random()*.32,
    vx:(server===0?1:-1)*(.46+Math.random()*.03),
    vy:(Math.random()-.5)*.08,h:.24,vh:.12};
  pong.serveAt=now+1100;
  pong.previousDepths=[...pong.depths];
  pong.drag.forEach((drag,side)=>{drag.startY=pong.paddles[side];
   drag.startDepth=pong.depths[side];drag.speed=0;drag.travel=0;});
}
export function createPong():PongState{
  const now=Date.now();
  const firstServer:Side=Math.random()>.5?0:1;
  const p:PongState={
    ball:{x:.5,y:.5,vx:.42,vy:.12,h:.42,vh:.4},
    paddles:[.5,.5],depths:[PONG_REST_DEPTH,1-PONG_REST_DEPTH],
    previousDepths:[PONG_REST_DEPTH,1-PONG_REST_DEPTH],
    scores:[0,0],serveAt:now,lastTick:now,
    drag:[0,1].map((side)=>({active:false,startY:.5,
     startDepth:side===0?PONG_REST_DEPTH:1-PONG_REST_DEPTH,
     lastAt:now,speed:0,travel:0,direction:0})) as [PongDrag,PongDrag],
    lastHit:[0,0],hitPower:[0,0],netHits:0,
    firstServer,server:firstServer,lastHitter:firstServer,bounceQueue:[],serveActive:false
  };
  serve(p,firstServer,now);
  return p;
}
export function pongView(p:PongState,now=Date.now()):PongView{
  return {ball:{...p.ball},paddles:[...p.paddles] as [number,number],
   depths:[...p.depths] as [number,number],
   scores:[...p.scores] as [number,number],serving:now<p.serveAt,
   dragging:p.drag.map(d=>d.active) as [boolean,boolean],
   swipe:p.drag.map((d,side)=>d.travel>.01&&now-d.lastAt<280?
    pongSwipePower(d.speed,d.travel,
     Math.hypot(p.ball.y-d.startY,p.ball.x-d.startDepth)-
     Math.hypot(p.ball.y-p.paddles[side],p.ball.x-p.depths[side]),now-d.lastAt):0) as [number,number],
   lastHit:[...p.lastHit] as [number,number],hitPower:[...p.hitPower] as [number,number],
   netHits:p.netHits};
}
export function movePaddle(p:PongState,side:Side,input:PongPaddleInput,now=Date.now()){
  const y=typeof input==="number"?input:input?.y;
  const requestedDepth=typeof input==="number"?p.depths[side]:input?.depth;
  if(!Number.isFinite(y)||!Number.isFinite(requestedDepth))return;
  const next=Math.max(-PONG_SIDE_REACH,Math.min(1+PONG_SIDE_REACH,y));
  const depth=side===0?
   Math.max(PONG_REST_DEPTH,Math.min(PONG_NET_LIMIT,requestedDepth)):
   Math.max(1-PONG_NET_LIMIT,Math.min(1-PONG_REST_DEPTH,requestedDepth));
  const drag=p.drag[side],delta=next-p.paddles[side],depthDelta=depth-p.depths[side];
  const distance=Math.hypot(delta,depthDelta);
  if(drag.active&&distance>.0001){
   const elapsed=Math.max(.016,Math.min((now-drag.lastAt)/1000,.2));
   drag.speed=Math.max(distance/elapsed,drag.speed*.45);
   drag.travel=Math.min(.8,drag.travel+distance);
   drag.direction=Math.sign(delta);
   drag.lastAt=now;
  }else if(!drag.active){
   drag.startY=next;drag.startDepth=depth;
   drag.speed=0;drag.travel=0;drag.lastAt=now;
  }
  p.paddles[side]=next;
  p.depths[side]=depth;
}
export function setPongDragging(p:PongState,side:Side,active:boolean,now=Date.now()){
  if(typeof active!=="boolean")return;
  const drag=p.drag[side];
  if(active&&!drag.active){
   Object.assign(drag,{active:true,startY:p.paddles[side],startDepth:p.depths[side],
    lastAt:now,speed:0,travel:0,direction:0});
  }else if(!active){drag.active=false;}
}
export function tickPong(p:PongState,now=Date.now()):Side|null{
 const dt=Math.max(0,Math.min((now-p.lastTick)/1000,.05));
 p.lastTick=now;
 if(now<p.serveAt){p.previousDepths=[...p.depths];return null;}
 const point=(winner:Side):Side|null=>{
  p.scores[winner]++;
  if(p.scores[winner]>=PONG_WIN_SCORE&&
   p.scores[winner]-p.scores[other(winner)]>=2){
   p.ball={x:.5,y:.5,vx:0,vy:0,h:.12,vh:0};
   return winner;
  }
  const total=p.scores[0]+p.scores[1];
  const change=Math.floor(total<20?total/2:total-10)%2;
  serve(p,change===0?p.firstServer:other(p.firstServer),now);
  return null;
 };
 const ball=p.ball;
 // A small idle assist follows the future arrival point. Manual swipes always
 // take priority, and the limited speed cannot catch a badly placed paddle.
 for(const side of [0,1] as const){
  const drag=p.drag[side],prediction=predictPongContact(ball,side,p.depths[side]);
  if(!drag.active&&now-drag.lastAt>350&&prediction&&prediction.eta<.9){
   const shift=Math.max(-.17*dt,Math.min(.17*dt,prediction.y-p.paddles[side]));
   p.paddles[side]=Math.max(-PONG_SIDE_REACH,
    Math.min(1+PONG_SIDE_REACH,p.paddles[side]+shift));
  }
 }
 // Integrate height and gravity at substeps so low-power phones and network
 // timing cannot tunnel the ball through the net or floor.
 const steps=Math.max(1,Math.ceil(dt/.012));
 const step=dt/steps;
 const startDepths=[...p.previousDepths] as [number,number];
 for(let k=0;k<steps;k++){
  const previousX=ball.x;
  const previousH=ball.h;
  ball.x+=ball.vx*step;ball.y+=ball.vy*step;
  ball.vh+=GRAVITY*step;ball.h+=ball.vh*step;
  // Crossing a sideline is not a miss yet. Let the ball fall all the way to
  // the ground so either player can still reach an airborne wide shot.
  const outside=ball.y<0||ball.y>1||ball.x<0||ball.x>1;
  if(outside&&ball.h<=BALL_GROUND){
   return point(p.bounceQueue.length?other(p.lastHitter):p.lastHitter);
  }
  // A serve that clips the net after its own bounce is replayed.
  if((previousX-.5)*(ball.x-.5)<=0&&Math.abs(ball.x-previousX)>.00001&&
   ball.y>=0&&ball.y<=1&&ball.h<NET_HEIGHT){
    p.netHits++;
    if(p.serveActive&&p.bounceQueue.length===1){
     serve(p,p.server,now);return null;
    }
    return point(other(p.lastHitter));
  }
  if(previousH>BALL_FLOOR&&ball.h<=BALL_FLOOR&&ball.vh<0){
   if(!outside){
    const court:Side=ball.x<.5?0:1;
    if(p.bounceQueue.length===0)return point(p.lastHitter);
    if(p.bounceQueue[0]!==court)return point(other(p.lastHitter));
    p.bounceQueue.shift();
    if(p.bounceQueue.length===0)p.serveActive=false;
    ball.h=BALL_FLOOR;
    ball.vh=Math.max(.90,-ball.vh*.9);
   }
  }
  for(const side of [0,1] as const){
   const toward=side===0?ball.vx<0:ball.vx>0;
   const startPlane=startDepths[side]+(p.depths[side]-startDepths[side])*k/steps+
    (side===0?PONG_RADIUS:-PONG_RADIUS);
   const collisionX=startDepths[side]+(p.depths[side]-startDepths[side])*(k+1)/steps+
    (side===0?PONG_RADIUS:-PONG_RADIUS);
   // Only the first crossing can make contact; a late swipe cannot retrieve
   // a ball already behind the paddle.
   const crossed=side===0?previousX>startPlane&&ball.x<=collisionX:
    previousX<startPlane&&ball.x>=collisionX;
   if(!toward||!crossed)continue;
   if(Math.abs(ball.y-p.paddles[side])>PONG_PADDLE_HALF+PONG_RADIUS)continue;
   if(p.lastHitter===side||p.bounceQueue.length)continue;
   const drag=p.drag[side];
   // An aligned but idle paddle is not a strike. A recent released swipe can
   // still connect as the ball reaches the blade a fraction later.
   if(drag.travel<=.01||now-drag.lastAt>280)continue;
   ball.x=collisionX;
   const offset=Math.max(-1,Math.min(1,(ball.y-p.paddles[side])/PONG_PADDLE_HALF));
   const approach=Math.hypot(ball.y-drag.startY,ball.x-drag.startDepth)-
    Math.hypot(ball.y-p.paddles[side],ball.x-p.depths[side]);
   const power=drag.travel>.01?
    pongSwipePower(drag.speed,drag.travel,approach,now-drag.lastAt):.12;
   // Drag speed and travel produce the impulse; aim comes from blade offset.
   const speed=Math.min(.95,Math.max(.36,Math.hypot(ball.vx,ball.vy))*(1.02+.70*power));
   const angle=offset*.73+drag.direction*power*.12;
   ball.vx=(side===0?1:-1)*Math.max(.26,speed*Math.cos(angle));
   ball.vy=speed*Math.sin(angle);
   ball.h=Math.max(ball.h,.18);
   ball.vh=.68+.27*power;
   p.lastHit[side]=now;p.hitPower[side]=power;
   p.lastHitter=side;p.bounceQueue=[other(side)];p.serveActive=false;
   drag.startY=p.paddles[side];drag.startDepth=p.depths[side];
   drag.speed*=.25;drag.travel=0;
  }
 }
 p.previousDepths=[...p.depths];
 return null;
}
