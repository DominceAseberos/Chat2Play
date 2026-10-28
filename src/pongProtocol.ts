import {z} from "zod";
import type {PongState,Side} from "./pongPhysics.js";

export type PongNetwork={mode:"server"|"connecting"|"peer";epoch:number;host:Side};
export type PaddleInput={y:number;depth:number;forwardStroke:number};
const side=z.union([z.literal(0),z.literal(1)]);
const num=z.number().finite();
const time=num.min(0).max(Number.MAX_SAFE_INTEGER);
const pair=<T extends z.ZodType>(item:T)=>z.tuple([item,item]);
const drag=z.object({
 active:z.boolean(),startY:num.min(-.35).max(1.35),startDepth:num.min(-.38).max(1.38),
 lastAt:time,speed:num.min(0).max(1000),travel:num.min(0).max(3),direction:num.min(-1).max(1),
 lateralSpeed:num.min(-4).max(4),forwardStroke:num.min(0).max(3),
 serveForwardTravel:num.min(0).max(3),serveLateralTravel:num.min(-.5).max(.5)
});
export const pongStateSchema:z.ZodType<PongState>=z.object({
 ball:z.object({x:num.min(-5).max(5),y:num.min(-5).max(5),h:num.min(-5).max(5),
  vx:num.min(-20).max(20),vy:num.min(-20).max(20),vh:num.min(-20).max(20),sideSpin:num.min(-5).max(5).optional()}),
 paddles:pair(num.min(-.35).max(1.35)),previousPaddles:pair(num.min(-.35).max(1.35)),
 depths:pair(num.min(-.38).max(1.38)),previousDepths:pair(num.min(-.38).max(1.38)),
 scores:pair(num.int().min(0).max(999)),serveAt:time,lastTick:time,drag:pair(drag),
 lastHit:pair(time),hitPower:pair(num.min(0).max(1)),netHits:num.int().min(0).max(100_000),
 firstServer:side,server:side,lastHitter:side,bounceQueue:z.array(side).max(2),
 serveActive:z.boolean(),servePending:z.boolean(),serveBallHeld:z.boolean(),
 targetPoints:z.union([z.literal(5),z.literal(10)])
});
export const paddleInputSchema=z.object({y:num.min(-.35).max(1.35),
 depth:num.min(-.38).max(1.38),forwardStroke:num.min(0).max(3)});
export const peerSignalSchema=z.object({id:z.string().uuid(),epoch:num.int().min(0),signal:z.union([
 z.object({type:z.enum(["offer","answer"]),sdp:z.string().max(12_000)}),
 z.object({type:z.literal("candidate"),candidate:z.object({candidate:z.string().max(2000),
  sdpMid:z.string().max(100).nullable().optional(),sdpMLineIndex:num.int().min(0).max(50).nullable().optional(),
  usernameFragment:z.string().max(256).nullable().optional()})})
])});
export type PeerSignal=z.infer<typeof peerSignalSchema>;
export function pongWinner(state:PongState):Side|null{
 for(const side of [0,1] as const)
  if(state.scores[side]>=state.targetPoints&&state.scores[side]-state.scores[1-side]>=2)return side;
 return null;
}
