export type PongSwingKind="scoop"|"lift"|"reach-left"|"reach-right"|"drive"|"smash";

type Ball={y:number;h:number};
export type PongContactPose={kind:PongSwingKind;height:number;low:number;high:number;
 lateral:number;yaw:number;lean:number;pitch:number};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

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
