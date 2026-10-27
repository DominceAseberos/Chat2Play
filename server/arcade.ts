import { randomInt } from "node:crypto";
import {MAX_SMASH_CHARGE_MS} from "../src/pongTiming.js";
export {MAX_SMASH_CHARGE_MS};

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
  chargeStarted:[number|null,number|null];shot:[{power:number;until:number}|null,{power:number;until:number}|null];
  lastSmash:[number,number];netHits:number;
};
export type PongView={
  ball:{x:number;y:number;h:number;vx:number;vy:number;vh:number};
  paddles:[number,number];scores:[number,number];serving:boolean;
  charge:[number,number];shot:[number,number];lastSmash:[number,number];netHits:number;
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
  pong.shot=[null,null];
}
export function createPong():PongState{
  const now=Date.now();
  const p:PongState={
    ball:{x:.5,y:.5,vx:.42,vy:.12,h:.42,vh:.4},
    paddles:[.5,.5],scores:[0,0],serveAt:now,lastTick:now,
    chargeStarted:[null,null],shot:[null,null],lastSmash:[0,0],netHits:0
  };
  serve(p,Math.random()>.5?0:1);
  return p;
}
export function pongView(p:PongState,now=Date.now()):PongView{
  return {ball:{...p.ball},paddles:[...p.paddles] as [number,number],
   scores:[...p.scores] as [number,number],serving:now<p.serveAt,
   charge:p.chargeStarted.map(t=>t===null?0:Math.min(1,(now-t)/MAX_SMASH_CHARGE_MS)) as [number,number],
   shot:p.shot.map(s=>s&&now<s.until?s.power:0) as [number,number],
   lastSmash:[...p.lastSmash] as [number,number],netHits:p.netHits};
}
export function movePaddle(p:PongState,side:Side,y:number){
  if(!Number.isFinite(y)||y<0||y>1)return;
  p.paddles[side]=Math.max(PONG_PADDLE_HALF,Math.min(1-PONG_PADDLE_HALF,y));
}
export function setPongCharge(p:PongState,side:Side,holding:boolean,now=Date.now()){
  if(typeof holding!=="boolean")return;
  if(holding){
    if(p.chargeStarted[side]===null)p.chargeStarted[side]=now;
  }else if(p.chargeStarted[side]!==null){
    // Releasing triggers a swing. A shot can hit only the next incoming ball,
    // within one second. Charging beyond one second never raises power.
    const power=Math.max(.08,Math.min(1,(now-p.chargeStarted[side]!)/MAX_SMASH_CHARGE_MS));
    p.shot[side]={power,until:now+1100};
    p.chargeStarted[side]=null;
  }
}
export function tickPong(p:PongState,now=Date.now()):Side|null{
 const dt=Math.max(0,Math.min((now-p.lastTick)/1000,.05));
 p.lastTick=now;
 if(now<p.serveAt)return null;
 const ball=p.ball;
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
   // A held paddle is winding up, not striking. The ball must cross the
   // paddle plane after release; a late release cannot pull it back.
   const crossed=side===0?previousX>collisionX&&ball.x<=collisionX:
    previousX<collisionX&&ball.x>=collisionX;
   if(!toward||!crossed||p.chargeStarted[side]!==null)continue;
   if(Math.abs(ball.y-p.paddles[side])>PONG_PADDLE_HALF+PONG_RADIUS)continue;
   ball.x=collisionX;
   const offset=Math.max(-1,Math.min(1,(ball.y-p.paddles[side])/PONG_PADDLE_HALF));
   const charged=p.shot[side]&&p.shot[side]!.until>=now?p.shot[side]!.power:0;
   // The physical impulse is capped at 0.95 table-length units/s, regardless
   // of long press duration, to preserve fairness across latency and devices.
   const speed=Math.min(.95,Math.max(.36,Math.hypot(ball.vx,ball.vy))*(1.02+.70*charged));
   const angle=offset*.73;
   ball.vx=(side===0?1:-1)*Math.max(.26,speed*Math.cos(angle));
   ball.vy=speed*Math.sin(angle);
   ball.h=Math.max(ball.h,.18);
   ball.vh=.73+.23*charged;
   if(charged>0){p.lastSmash[side]=now;p.shot[side]=null;}
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
