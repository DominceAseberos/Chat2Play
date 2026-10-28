import {PONG_BACK_LIMIT,PONG_NET_LIMIT,PONG_REST_DEPTH,PONG_SERVE_FORWARD_LIMIT,pongSwipePower,predictPongContact} from "./pongSwing.js";

export type Side=0|1;
export type PongState = {
  ball:{x:number;y:number;vx:number;vy:number;h:number;vh:number;sideSpin?:number};
  paddles:[number,number];previousPaddles:[number,number];depths:[number,number];previousDepths:[number,number];
  scores:[number,number];serveAt:number;lastTick:number;
  drag:[PongDrag,PongDrag];lastHit:[number,number];hitPower:[number,number];netHits:number;
  firstServer:Side;server:Side;lastHitter:Side;bounceQueue:Side[];serveActive:boolean;servePending:boolean;serveBallHeld:boolean;
  targetPoints:5|10;
};
type PongDrag={active:boolean;startY:number;startDepth:number;lastAt:number;
 speed:number;travel:number;direction:number;lateralSpeed:number;forwardStroke:number;
 serveForwardTravel:number;serveLateralTravel:number};
export type PongView={
  ball:{x:number;y:number;h:number;vx:number;vy:number;vh:number;sideSpin?:number};
  paddles:[number,number];depths:[number,number];scores:[number,number];serving:boolean;
  dragging:[boolean,boolean];swipe:[number,number];lastHit:[number,number];
  hitPower:[number,number];netHits:number;
  targetPoints:5|10;server:Side;serveCountdown:number;
};
export const PONG_PADDLE_HALF = 0.23;
export const PONG_RADIUS = 0.014;
export const PONG_WIN_SCORE = 5;
export const PONG_SIDE_REACH = 0.35;
export type PongPaddleInput=number|{y:number;depth:number;forwardStroke?:number};
const SERVE_STROKE_MIN=.08;

// Shared fixed-step arcade ball dynamics for server and elected browser host. Height, table bounce,
 // net impacts and paddle impulses are actual simulated values, not client
 // generated movement. Units are normalized to the table footprint.
const BALL_FLOOR=.09,BALL_GROUND=-.17,NET_HEIGHT=.26,GRAVITY=-2.20;
const other=(side:Side):Side=>side===0?1:0;
function serve(pong:PongState,server:Side,now=Date.now()){
  pong.server=server;pong.lastHitter=server;pong.bounceQueue=[server,other(server)];
  pong.serveActive=true;pong.servePending=true;
  pong.serveBallHeld=false;
  pong.depths[server]=server===0?PONG_REST_DEPTH:1-PONG_REST_DEPTH;
  pong.ball={x:server===0?.08:.92,y:pong.paddles[server],vx:0,vy:0,h:.24,vh:0,sideSpin:0};
  pong.serveAt=now+3000;
  pong.previousDepths=[...pong.depths];
  pong.previousPaddles=[...pong.paddles];
  pong.drag.forEach((drag,side)=>{drag.startY=pong.paddles[side];
   drag.startDepth=pong.depths[side];drag.speed=0;drag.travel=0;drag.lateralSpeed=0;
   drag.forwardStroke=0;drag.serveForwardTravel=0;drag.serveLateralTravel=0;});
}
function stageServeBall(pong:PongState){
 const side=pong.server,depth=pong.depths[side];
 // Keep the waiting ball close to the baseline, ahead of the bat. It must
 // stay put during a stroke so the player can actually swing into it.
 pong.ball.x=side===0?Math.max(.025,Math.min(.12,depth+.12)):
  Math.min(.975,Math.max(.88,depth-.12));
 pong.ball.y=Math.max(.16,Math.min(.84,pong.paddles[side]));
 pong.ball.h=.24;pong.ball.vx=0;pong.ball.vy=0;pong.ball.vh=0;pong.ball.sideSpin=0;
}
function launchServe(pong:PongState,now:number){
 const side=pong.server,ball=pong.ball,drag=pong.drag[side];
 // Only the sideways component of the forward stroke steers the serve.
 // A sideways setup before that stroke gives a smaller amount of aim.
 const aim=Math.max(-1,Math.min(1,
  drag.serveLateralTravel/Math.max(drag.serveForwardTravel,.08)*.8+
  (pong.paddles[side]-drag.startY)*.9));
 const targetY=Math.max(.08,Math.min(.92,ball.y+aim*.3));
 ball.vx=(side===0?1:-1)*.52;
 // The first bounce is on our side and the next is across the net. Account
 // for the gentle sidespin curve while aiming for that second bounce.
 ball.sideSpin=aim*.10;
 ball.vy=(targetY-ball.y)/1.38-ball.sideSpin*.55;
 ball.vh=.18;
 pong.servePending=false;pong.serveBallHeld=false;pong.lastTick=now;
 pong.lastHit[side]=now;pong.hitPower[side]=Math.min(1,.3+pong.drag[side].serveForwardTravel*2);
 pong.previousDepths=[...pong.depths];pong.previousPaddles=[...pong.paddles];
 drag.speed=0;drag.travel=0;drag.lateralSpeed=0;
}
export function createPong(targetPoints:5|10=PONG_WIN_SCORE):PongState{
  const now=Date.now();
  const firstServer:Side=Math.random()>.5?0:1;
  const p:PongState={
    ball:{x:.5,y:.5,vx:.42,vy:.12,h:.42,vh:.4,sideSpin:0},
    paddles:[.5,.5],previousPaddles:[.5,.5],depths:[PONG_REST_DEPTH,1-PONG_REST_DEPTH],
    previousDepths:[PONG_REST_DEPTH,1-PONG_REST_DEPTH],
    scores:[0,0],serveAt:now,lastTick:now,
    drag:[0,1].map((side)=>({active:false,startY:.5,
     startDepth:side===0?PONG_REST_DEPTH:1-PONG_REST_DEPTH,
     lastAt:now,speed:0,travel:0,direction:0,lateralSpeed:0,forwardStroke:0,
     serveForwardTravel:0,serveLateralTravel:0})) as [PongDrag,PongDrag],
    lastHit:[0,0],hitPower:[0,0],netHits:0,
    firstServer,server:firstServer,lastHitter:firstServer,bounceQueue:[],serveActive:false,servePending:false,serveBallHeld:false,
    targetPoints
  };
  serve(p,firstServer,now);
  return p;
}
export function pongView(p:PongState,now=Date.now()):PongView{
  return {ball:{...p.ball},paddles:[...p.paddles] as [number,number],
   depths:[...p.depths] as [number,number],
   scores:[...p.scores] as [number,number],serving:p.servePending,
   dragging:p.drag.map(d=>d.active) as [boolean,boolean],
   swipe:p.drag.map((d,side)=>d.travel>.01&&now-d.lastAt<280?
    pongSwipePower(d.speed,d.travel,
     Math.hypot(p.ball.y-d.startY,p.ball.x-d.startDepth)-
     Math.hypot(p.ball.y-p.paddles[side],p.ball.x-p.depths[side]),now-d.lastAt):0) as [number,number],
   lastHit:[...p.lastHit] as [number,number],hitPower:[...p.hitPower] as [number,number],
   netHits:p.netHits,targetPoints:p.targetPoints,server:p.server,
   serveCountdown:p.servePending?Math.max(0,Math.ceil((p.serveAt-now)/1000)):0};
}
export function movePaddle(p:PongState,side:Side,input:PongPaddleInput,now=Date.now()){
  const y=typeof input==="number"?input:input?.y;
  const requestedDepth=typeof input==="number"?p.depths[side]:input?.depth;
  if(!Number.isFinite(y)||!Number.isFinite(requestedDepth))return;
  const next=Math.max(-PONG_SIDE_REACH,Math.min(1+PONG_SIDE_REACH,y));
  let depth=side===0?
   Math.max(PONG_BACK_LIMIT,Math.min(PONG_NET_LIMIT,requestedDepth)):
   Math.max(1-PONG_NET_LIMIT,Math.min(1-PONG_BACK_LIMIT,requestedDepth));
  if(p.servePending&&p.server===side)
   depth=side===0?Math.min(depth,PONG_SERVE_FORWARD_LIMIT):Math.max(depth,1-PONG_SERVE_FORWARD_LIMIT);
  if(p.servePending&&p.server===side&&now>=p.serveAt&&!p.serveBallHeld){
   stageServeBall(p);p.serveBallHeld=true;
  }
  const drag=p.drag[side],delta=next-p.paddles[side],depthDelta=depth-p.depths[side];
  const distance=Math.hypot(delta,depthDelta);
  const rawStroke=typeof input==="number"?undefined:input.forwardStroke;
  const hasStroke=typeof rawStroke==="number"&&Number.isFinite(rawStroke)&&rawStroke>=0&&rawStroke<=3;
  const forwardDepth=side===0?depthDelta:-depthDelta;
  if(drag.active){
   const forwardStep=hasStroke?Math.max(0,rawStroke-drag.forwardStroke):Math.max(0,forwardDepth);
   if(hasStroke)drag.forwardStroke=Math.max(drag.forwardStroke,rawStroke);
   if(p.servePending&&p.server===side&&now>=p.serveAt){
    drag.serveForwardTravel=Math.min(3,drag.serveForwardTravel+forwardStep);
    if(forwardStep>.0001)
     drag.serveLateralTravel=Math.max(-.5,Math.min(.5,drag.serveLateralTravel+delta));
   }
  }
  if(drag.active&&distance>.0001){
   const elapsed=Math.max(.016,Math.min((now-drag.lastAt)/1000,.2));
   drag.speed=Math.max(distance/elapsed,drag.speed*.45);
   drag.travel=Math.min(.8,drag.travel+distance);
   drag.direction=Math.sign(delta);
   // Signed velocity matters: a slow reach and a fast sideways brush should
   // not send the ball to the same place.
   drag.lateralSpeed=Math.max(-4,Math.min(4,
    drag.lateralSpeed*.35+(delta/elapsed)*.65));
   drag.lastAt=now;
  }else if(!drag.active){
   drag.startY=next;drag.startDepth=depth;
   drag.speed=0;drag.travel=0;drag.lateralSpeed=0;drag.lastAt=now;
  }
  p.paddles[side]=next;
  p.depths[side]=depth;
  if(p.servePending&&p.server===side){
   if(!p.serveBallHeld)stageServeBall(p);
   else p.ball.y=Math.max(.16,Math.min(.84,next));
   if(now>=p.serveAt&&drag.active&&drag.serveForwardTravel>=SERVE_STROKE_MIN)
    launchServe(p,now);
  }
}
export function setPongDragging(p:PongState,side:Side,active:boolean,now=Date.now()){
  if(typeof active!=="boolean")return;
  const drag=p.drag[side];
  if(active&&!drag.active){
   Object.assign(drag,{active:true,startY:p.paddles[side],startDepth:p.depths[side],
    lastAt:now,speed:0,travel:0,direction:0,lateralSpeed:0,forwardStroke:0,
    serveForwardTravel:0,serveLateralTravel:0});
   if(p.servePending&&p.server===side&&now>=p.serveAt){
    stageServeBall(p);p.serveBallHeld=true;
   }
  }else if(!active){drag.active=false;
   if(p.servePending&&p.server===side)p.serveBallHeld=false;
  }
}
export function tickPong(p:PongState,now=Date.now()):Side|null{
 const dt=Math.max(0,Math.min((now-p.lastTick)/1000,.05));
 p.lastTick=now;
 if(p.servePending){
  if(now>=p.serveAt&&p.drag[p.server].active&&!p.serveBallHeld)p.serveBallHeld=true;
  if(!p.serveBallHeld)stageServeBall(p);
  else p.ball.y=Math.max(.16,Math.min(.84,p.paddles[p.server]));
  p.previousDepths=[...p.depths];p.previousPaddles=[...p.paddles];return null;
 }
 const point=(winner:Side):Side|null=>{
  p.scores[winner]++;
  if(p.scores[winner]>=p.targetPoints&&
   p.scores[winner]-p.scores[other(winner)]>=2){
   p.ball={x:.5,y:.5,vx:0,vy:0,h:.12,vh:0};
   return winner;
  }
  const total=p.scores[0]+p.scores[1];
  const deuceStarts=2*(p.targetPoints-1);
  const change=Math.floor(total<deuceStarts?total/2:total-(p.targetPoints-1))%2;
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
 const startPaddles=[...p.previousPaddles] as [number,number];
 for(let k=0;k<steps;k++){
  const previousX=ball.x;
  const previousH=ball.h;
  ball.x+=ball.vx*step;
  ball.vy+=(ball.sideSpin??0)*step;
  ball.y+=ball.vy*step;
  ball.sideSpin=(ball.sideSpin??0)*Math.exp(-.38*step);
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
    ball.vh=Math.max(p.serveActive?1:.90,-ball.vh*.9);
    ball.sideSpin=(ball.sideSpin??0)*.6;
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
   const oldGap=side===0?previousX-startPlane:startPlane-previousX;
   const newGap=side===0?ball.x-collisionX:collisionX-ball.x;
   // The blade has visible thickness. Sweep both it and the ball through this
   // substep, including lateral movement that arrived between server ticks.
   const crossed=oldGap>-.018&&newGap<=.018;
   if(!toward||!crossed)continue;
   const contactT=Math.max(0,Math.min(1,oldGap/(oldGap-newGap||1)));
   const frameT=(k+contactT)/steps;
   const paddleY=startPaddles[side]+(p.paddles[side]-startPaddles[side])*frameT;
   const contactY=ball.y-ball.vy*step*(1-contactT);
   if(Math.abs(contactY-paddleY)>PONG_PADDLE_HALF+PONG_RADIUS)continue;
   if(p.lastHitter===side||p.bounceQueue.length)continue;
   const drag=p.drag[side];
   // A near miss during a deliberate stroke still connects. Holding an idle
   // paddle in place does not return the ball.
   if(drag.travel<=.008||now-drag.lastAt>(drag.active?460:360))continue;
   ball.x=collisionX;
   const offset=Math.max(-1,Math.min(1,(contactY-paddleY)/PONG_PADDLE_HALF));
   const approach=Math.hypot(ball.y-drag.startY,ball.x-drag.startDepth)-
    Math.hypot(ball.y-p.paddles[side],ball.x-p.depths[side]);
   const power=drag.travel>.01?
    pongSwipePower(drag.speed,drag.travel,approach,now-drag.lastAt):.12;
   // The sideways component of the racket stroke and the contact offset set
   // the outgoing angle. A brushing stroke also gives the ball a small curve.
   // Solve initial velocity against that curve so the aimed bounce stays on
   // the opposite court; sideways aim still depends on the actual stroke.
   const flightTime=.98-.12*power;
   const landingX=side===0?.74:.26;
   const lateralVelocity=Math.max(-1,Math.min(1,drag.lateralSpeed/2.4));
   const lateralTravel=Math.max(-1,Math.min(1,
    (p.paddles[side]-drag.startY)/.24));
   const brush=Math.max(-1,Math.min(1,
    lateralVelocity*.65+lateralTravel*.35));
   const landingY=Math.max(.08,Math.min(.92,
    ball.y+offset*.16+brush*(.20+.18*power)+ball.vy*.04));
   ball.sideSpin=brush*(.18+.12*power);
   ball.vx=(landingX-ball.x)/flightTime;
   ball.vy=(landingY-ball.y)/flightTime-ball.sideSpin*flightTime*.46;
   ball.h=Math.max(ball.h,.18);
   ball.vh=(BALL_FLOOR-ball.h-GRAVITY*flightTime*flightTime/2)/flightTime;
   p.lastHit[side]=now;p.hitPower[side]=power;
   p.lastHitter=side;p.bounceQueue=[other(side)];p.serveActive=false;
   drag.startY=p.paddles[side];drag.startDepth=p.depths[side];
   drag.speed*=.25;drag.travel=0;drag.lateralSpeed=0;
  }
 }
 p.previousDepths=[...p.depths];
 p.previousPaddles=[...p.paddles];
 return null;
}
