export type PongSwingKind="scoop"|"lift"|"reach-left"|"reach-right"|"drive"|"smash";

type Ball={y:number;h:number};
type FlyingBall=Ball&{x:number;vx:number;vy:number;vh:number};
export type PongContactPose={kind:PongSwingKind;height:number;low:number;high:number;
 lateral:number;yaw:number;lean:number;pitch:number};
export type PongSwingMotion={side:number;vertical:number;forward:number;
 pitch:number;yaw:number;roll:number};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const PONG_REST_DEPTH=-.10;
export const PONG_NET_LIMIT=.46;

// Depth is measured along the table: player 0 approaches the net by moving
// toward 1, while player 1 approaches it by moving toward 0.
export function pongDepthFromReach(reach:number,side:0|1){
 const depth=PONG_REST_DEPTH+clamp(reach,0,1)*(PONG_NET_LIMIT-PONG_REST_DEPTH);
 return side===0?depth:1-depth;
}
export function pongReachFromDepth(depth:number,side:0|1){
 const ownDepth=side===0?depth:1-depth;
 return clamp((ownDepth-PONG_REST_DEPTH)/(PONG_NET_LIMIT-PONG_REST_DEPTH),0,1);
}

export function paddleSideAngle(screenX:number,own:boolean){
 const edge=clamp((screenX-.5)/.34,-1,1);
 return own?-Math.PI/2-edge*Math.PI/2:Math.PI/2-edge*Math.PI/2;
}

export function predictPongContact(ball:FlyingBall,side:0|1,
 depth=pongDepthFromReach(0,side)){
 const target=depth+(side===0?.014:-.014);
 const incoming=side===0?ball.vx<-.001:ball.vx>.001;
 if(!incoming)return null;
 const eta=(target-ball.x)/ball.vx;
 if(eta<0||eta>1.8)return null;
 let y=ball.y,h=ball.h,vy=ball.vy,vh=ball.vh;
 const steps=Math.max(1,Math.ceil(eta/.012)),step=eta/steps;
 for(let i=0;i<steps;i++){
  y+=vy*step;vh-=2.2*step;h+=vh*step;
  if(y<-.5||y>1.5)return null;
  if(h<.09){
   if(y<0||y>1)return null;
   h=.09;vh=Math.max(.90,-vh*.9);
  }
 }
 return {y,h,eta};
}

export function pongSwipePower(speed:number,travel:number,approach:number,ageMs=0){
 const fresh=clamp(1-ageMs/280,0,1);
 const aligned=approach>0?1:.32;
 return clamp(.12+fresh*aligned*(.48*clamp(speed/1.6,0,1)+
  .24*clamp(travel/.26,0,1))+.16*clamp(approach/.18,0,1),.12,1);
}

// Coordinates are mirrored for player 1, so left/right always mean what the
// person at the near end of this camera sees.
export function pongContactPose(ball:Ball,side:0|1,paddle:number,power=0):PongContactPose{
 const ballX=side===0?ball.y:1-ball.y;
 const paddleX=side===0?paddle:1-paddle;
 const lateral=clamp((ballX-paddleX)*5,-1,1);
 const physicalHeight=.31+Math.max(0,ball.h-.09)*2.8;
 const height=clamp(physicalHeight-.39,.28,1.35);
 const low=clamp((.77-physicalHeight)/.48,0,1);
 const high=clamp((physicalHeight-1.14)/.48,0,1);
 let kind:PongSwingKind="drive";
 if(high>.42&&power>.48)kind="smash";
 else if(low>.55)kind="scoop";
 else if(lateral<-.42)kind="reach-left";
 else if(lateral>.42)kind="reach-right";
 else if(low>.12)kind="lift";
 return {kind,height,low,high,lateral,
  yaw:clamp(lateral*.48,-.5,.5),
  lean:clamp(-lateral*.17,-.18,.18),
  pitch:clamp(-.14-low*.36+high*(power>.48?.60:.34),-.55,.55)};
}

// A swing moves through the contact point rather than only pitching the blade
// forward. The same stroke can scoop a low ball and reach sideways for it.
export function pongSwingMotion(pose:PongContactPose,progress:number,power:number):PongSwingMotion{
 const t=clamp(progress,0,1);
 const arc=Math.sin(Math.PI*t);
 const level=clamp(1-pose.low-pose.high,0,1);
 return {
  side:pose.lateral*.68*arc,
  vertical:(pose.low*.56-pose.high*.64)*t*arc,
  forward:(.13+.22*level+.08*clamp(power,0,1))*arc,
  pitch:(pose.pitch-pose.low*.25+pose.high*.28-.1*level)*arc,
  yaw:pose.yaw*1.8*arc,
  roll:pose.lean*2.8*arc
 };
}
