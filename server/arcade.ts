import { randomInt } from "node:crypto";
import {pongSwipePower,predictPongContact} from "../src/pongSwing.js";

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
  paddles:[number,number];scores:[number,number];serveAt:number;lastTick:number;
  drag:[PongDrag,PongDrag];lastHit:[number,number];hitPower:[number,number];netHits:number;
};
type PongDrag={active:boolean;startY:number;lastAt:number;speed:number;travel:number;direction:number};
export type PongView={
  ball:{x:number;y:number;h:number;vx:number;vy:number;vh:number};
  paddles:[number,number];scores:[number,number];serving:boolean;
  dragging:[boolean,boolean];swipe:[number,number];lastHit:[number,number];
  hitPower:[number,number];netHits:number;
};
export const PONG_PADDLE_HALF = 0.12;
export const PONG_RADIUS = 0.014;
export const PONG_WIN_SCORE = 5;

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
const BALL_FLOOR=.09,NET_HEIGHT=.26,GRAVITY=-2.20;
function serve(pong:PongState,toward:Side){
  pong.ball={x:.5,y:.34+Math.random()*.32,vx:(toward===1?1:-1)*(.39+Math.random()*.07),
    vy:(Math.random()-.5)*.21,h:.42,vh:.46};
  pong.serveAt=Date.now()+1100;
  pong.drag.forEach((drag,side)=>{drag.startY=pong.paddles[side];drag.speed=0;drag.travel=0;});
}
export function createPong():PongState{
  const now=Date.now();
  const p:PongState={
    ball:{x:.5,y:.5,vx:.42,vy:.12,h:.42,vh:.4},
    paddles:[.5,.5],scores:[0,0],serveAt:now,lastTick:now,
    drag:[0,1].map(()=>({active:false,startY:.5,lastAt:now,speed:0,travel:0,direction:0})) as [PongDrag,PongDrag],
    lastHit:[0,0],hitPower:[0,0],netHits:0
  };
  serve(p,Math.random()>.5?0:1);
  return p;
}
export function pongView(p:PongState,now=Date.now()):PongView{
  return {ball:{...p.ball},paddles:[...p.paddles] as [number,number],
   scores:[...p.scores] as [number,number],serving:now<p.serveAt,
   dragging:p.drag.map(d=>d.active) as [boolean,boolean],
   swipe:p.drag.map((d,side)=>d.travel>.01&&now-d.lastAt<280?
    pongSwipePower(d.speed,d.travel,
     Math.abs(p.ball.y-d.startY)-Math.abs(p.ball.y-p.paddles[side]),now-d.lastAt):0) as [number,number],
   lastHit:[...p.lastHit] as [number,number],hitPower:[...p.hitPower] as [number,number],
   netHits:p.netHits};
}
export function movePaddle(p:PongState,side:Side,y:number,now=Date.now()){
  if(!Number.isFinite(y)||y<0||y>1)return;
  const next=Math.max(PONG_PADDLE_HALF,Math.min(1-PONG_PADDLE_HALF,y));
  const drag=p.drag[side],delta=next-p.paddles[side];
  if(drag.active&&Math.abs(delta)>.0001){
   const elapsed=Math.max(.016,Math.min((now-drag.lastAt)/1000,.2));
   drag.speed=Math.max(Math.abs(delta)/elapsed,drag.speed*.45);
   drag.travel=Math.min(.8,drag.travel+Math.abs(delta));
   drag.direction=Math.sign(delta);
   drag.lastAt=now;
  }else if(!drag.active){
   drag.startY=next;drag.speed=0;drag.travel=0;drag.lastAt=now;
  }
  p.paddles[side]=next;
}
export function setPongDragging(p:PongState,side:Side,active:boolean,now=Date.now()){
  if(typeof active!=="boolean")return;
  const drag=p.drag[side];
  if(active&&!drag.active){
   Object.assign(drag,{active:true,startY:p.paddles[side],lastAt:now,speed:0,travel:0,direction:0});
  }else if(!active){drag.active=false;}
}
export function tickPong(p:PongState,now=Date.now()):Side|null{
 const dt=Math.max(0,Math.min((now-p.lastTick)/1000,.05));
 p.lastTick=now;
 if(now<p.serveAt)return null;
 const ball=p.ball;
 // A small idle assist follows the future arrival point. Manual swipes always
 // take priority, and the limited speed cannot catch a badly placed paddle.
 for(const side of [0,1] as const){
  const drag=p.drag[side],prediction=predictPongContact(ball,side);
  if(!drag.active&&now-drag.lastAt>350&&prediction&&prediction.eta<.9){
   const shift=Math.max(-.17*dt,Math.min(.17*dt,prediction.y-p.paddles[side]));
   p.paddles[side]=Math.max(PONG_PADDLE_HALF,Math.min(1-PONG_PADDLE_HALF,p.paddles[side]+shift));
  }
 }
 // Integrate height and gravity at substeps so low-power phones and network
 // timing cannot tunnel the ball through the net or floor.
 const steps=Math.max(1,Math.ceil(dt/.012));
 const step=dt/steps;
 for(let k=0;k<steps;k++){
  const previousX=ball.x;
  ball.x+=ball.vx*step;ball.y+=ball.vy*step;
  ball.vh+=GRAVITY*step;ball.h+=ball.vh*step;
  if(ball.h<BALL_FLOOR){
    ball.h=BALL_FLOOR;
    ball.vh=Math.max(.32,-ball.vh*.82);
  }
  if(ball.y<PONG_RADIUS){ball.y=PONG_RADIUS;ball.vy=Math.abs(ball.vy)*.94;}
  if(ball.y>1-PONG_RADIUS){ball.y=1-PONG_RADIUS;ball.vy=-Math.abs(ball.vy)*.94;}
  // Net in the middle has physical collision and kills speed.
  if((previousX-.5)*(ball.x-.5)<=0&&Math.abs(ball.x-previousX)>.00001&&ball.h<NET_HEIGHT){
    ball.x=previousX<.5?.49:.51;
    ball.vx=-ball.vx*.42;
    ball.vh=Math.max(.12,ball.vh*.45);
    p.netHits++;
  }
  for(const side of [0,1] as const){
   const edge=side===0?.05:.95;
   const toward=side===0?ball.vx<0:ball.vx>0;
   const collisionX=side===0?edge+PONG_RADIUS:edge-PONG_RADIUS;
   // Only the first crossing can make contact; a late swipe cannot retrieve
   // a ball already behind the paddle.
   const crossed=side===0?previousX>collisionX&&ball.x<=collisionX:
    previousX<collisionX&&ball.x>=collisionX;
   if(!toward||!crossed)continue;
   if(Math.abs(ball.y-p.paddles[side])>PONG_PADDLE_HALF+PONG_RADIUS)continue;
   const drag=p.drag[side];
   // An aligned but idle paddle is not a strike. A recent released swipe can
   // still connect as the ball reaches the blade a fraction later.
   if(drag.travel<=.01||now-drag.lastAt>280)continue;
   ball.x=collisionX;
   const offset=Math.max(-1,Math.min(1,(ball.y-p.paddles[side])/PONG_PADDLE_HALF));
   const through=Math.min(drag.startY,p.paddles[side])<=ball.y&&
    ball.y<=Math.max(drag.startY,p.paddles[side]);
   const approach=through?Math.min(.18,drag.travel):
    Math.abs(ball.y-drag.startY)-Math.abs(ball.y-p.paddles[side]);
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
   drag.startY=p.paddles[side];drag.speed*=.25;drag.travel=0;
  }
 }
 if(ball.x<-.038||ball.x>1.038){
   const scorer:Side=ball.x<0?1:0;
   p.scores[scorer]++;
   if(p.scores[scorer]>=PONG_WIN_SCORE){
     p.ball={x:.5,y:.5,vx:0,vy:0,h:.12,vh:0};
     return scorer;
   }
   serve(p,scorer===0?1:0);
 }
 return null;
}
