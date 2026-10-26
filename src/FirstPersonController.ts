import * as THREE from "three";
import {CharacterActor,type CharacterAction} from "./CharacterActor";

export type WalkObstacle={minX:number;maxX:number;minZ:number;maxZ:number};
export type RpsChoice="rock"|"paper"|"scissors";
export type RpsPhase="ready"|"windup"|"throw"|"revealed";
const wrap=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const smooth=(v:number)=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};

/** A full skinned body beneath an independent eye camera. The Walk clip's
 * planted-foot speed is 0.9 units/s; animation speed follows actual travel. */
export class FirstPersonController {
 readonly actor:CharacterActor;
 readonly ready:Promise<void>;
 readonly velocity=new THREE.Vector3();
 readonly input={forward:0,right:0};
 readonly reducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
 lookYaw=0;lookPitch=-.18;
 yaw=0;pitch=-.18;bodyYaw=0;
 walking=false;distance=0;
 rpsMode=false;
 private choice:RpsChoice|null=null;
 private throwTime=0;
 private pumpBeat:number|null=null;
 private pumpProgress=0;
 private loaded=false;
 private head=new THREE.Vector3();
 private blend=0;
 constructor(readonly scene:THREE.Scene,readonly camera:THREE.PerspectiveCamera,which:0|1,readonly obstacles:WalkObstacle[]=[]){
  this.actor=new CharacterActor(which,true);this.actor.group.rotation.y=Math.PI;scene.add(this.actor.group);
  camera.near=.025;camera.far=80;
  this.ready=this.actor.ready.then(()=>{this.loaded=true;this.actor.update(0,0);this.scene.updateMatrixWorld(true);this.actor.headRig.getWorldPosition(this.head);camera.position.set(0,this.head.y,-.43);this.update(0,0);});
 }
 setLook(yaw:number,pitch:number,immediate=false){
  this.lookYaw=yaw;this.lookPitch=THREE.MathUtils.clamp(pitch,-1.15,.65);
  if(immediate){this.yaw=yaw;this.pitch=this.lookPitch;}
 }
 setInput(forward:number,right:number){this.input.forward=THREE.MathUtils.clamp(forward,-1,1);this.input.right=THREE.MathUtils.clamp(right,-1,1);}
 reset(){this.actor.group.position.set(0,0,0);this.velocity.set(0,0,0);this.bodyYaw=0;this.distance=0;this.choice=null;this.throwTime=0;this.pumpBeat=null;this.pumpProgress=0;this.setLook(0,this.rpsMode?-.88:-.18,true);}
 get rpsChoice(){return this.choice;}
 get rpsPhase():RpsPhase{return this.choice===null?"ready":this.throwTime<.40?"windup":this.throwTime<1.20?"throw":"revealed";}
 get throwing(){return this.rpsPhase==="windup"||this.rpsPhase==="throw";}
 throwRps(choice:RpsChoice){
  if(!this.loaded||this.throwing)return false;
  this.rpsMode=true;this.choice=choice;this.throwTime=0;this.pumpBeat=null;this.velocity.set(0,0,0);this.setInput(0,0);
  this.actor.play("POVReady",false,true);return true;
 }
 setRpsPump(beat:number,progress:number){
  if(!this.loaded)return;
  this.rpsMode=true;this.choice=null;
  if(this.pumpBeat!==beat){this.pumpBeat=beat;this.actor.play("POVPump",false,true);}
  this.pumpProgress=THREE.MathUtils.clamp(progress,0,1);
 }
 syncRpsClock(elapsed:number){if(this.choice!==null)this.throwTime=Math.max(this.throwTime,Math.max(0,elapsed));}
 private blocked(x:number,z:number){
  if(Math.abs(x)>9.1||Math.abs(z)>9.1)return true;
  const radius=.75;
  return this.obstacles.some(b=>x>b.minX-radius&&x<b.maxX+radius&&z>b.minZ-radius&&z<b.maxZ+radius);
 }
 update(dt:number,time:number){
  if(!this.loaded)return;dt=THREE.MathUtils.clamp(dt,0,.05);
  if(this.choice!==null)this.throwTime+=dt;
  let f=this.rpsMode?0:this.input.forward,r=this.rpsMode?0:this.input.right;const magnitude=Math.max(1,Math.hypot(f,r));f/=magnitude;r/=magnitude;
  const targetX=(-Math.sin(this.lookYaw)*f+Math.cos(this.lookYaw)*r)*.9;
  const targetZ=(-Math.cos(this.lookYaw)*f-Math.sin(this.lookYaw)*r)*.9;
  this.velocity.x=THREE.MathUtils.damp(this.velocity.x,targetX,10,dt);
  this.velocity.z=THREE.MathUtils.damp(this.velocity.z,targetZ,10,dt);
  const position=this.actor.group.position,oldX=position.x,oldZ=position.z;
  const x=position.x+this.velocity.x*dt;if(!this.blocked(x,position.z))position.x=x;else this.velocity.x=0;
  const z=position.z+this.velocity.z*dt;if(!this.blocked(position.x,z))position.z=z;else this.velocity.z=0;
  const travelled=Math.hypot(position.x-oldX,position.z-oldZ),speed=dt>0?travelled/dt:0;
  this.distance+=travelled;this.walking=speed>.035;
  const backwards=f<-.1&&Math.abs(r)<Math.abs(f)*.7;
  const desiredBody=this.walking?(backwards?this.lookYaw:Math.atan2(-this.velocity.x,-this.velocity.z)):
   Math.abs(wrap(this.lookYaw-this.bodyYaw))>.95?this.lookYaw:this.bodyYaw;
  this.bodyYaw+=wrap(desiredBody-this.bodyYaw)*(1-Math.exp(-11*dt));
  this.actor.group.rotation.y=Math.PI+this.bodyYaw;
  let action:CharacterAction=this.walking?"Walk":"Idle";
  if(this.rpsMode){
   action=this.pumpBeat!==null?"POVPump":"POVReady";
   if(this.rpsPhase==="throw")action="POVThrow";
   if(this.rpsPhase==="revealed")action=this.choice==="rock"?"POVRock":this.choice==="paper"?"POVPaper":"POVScissors";
  }
  this.actor.play(action);
  if(action==="POVPump")this.actor.seekCurrentNormalized(this.pumpProgress);
  this.actor.setPlaybackRate(this.walking&&!this.rpsMode?(backwards?-1:1)*speed/.9:1);
  this.actor.update(dt,time);
  this.blend=THREE.MathUtils.damp(this.blend,this.walking?1:0,8,dt);
  this.yaw+=wrap(this.lookYaw-this.yaw)*(1-Math.exp(-22*dt));
  this.pitch=THREE.MathUtils.damp(this.pitch,this.lookPitch,22,dt);
  this.scene.updateMatrixWorld(true);this.actor.headRig.getWorldPosition(this.head);
  const phase=this.actor.animationTime/1.2*Math.PI*2;
  const sway=this.reducedMotion?0:Math.sin(phase)*.006*this.blend;
  const eyeY=this.rpsMode?2.36:this.reducedMotion?2.4-.075*this.blend:this.head.y;
  const down=smooth((-this.pitch-.35)/.80),eyeForward=this.rpsMode ? .16 : .43+.24*down;
  this.camera.position.x=position.x-Math.sin(this.bodyYaw)*eyeForward+Math.cos(this.bodyYaw)*sway;
  this.camera.position.z=position.z-Math.cos(this.bodyYaw)*eyeForward-Math.sin(this.bodyYaw)*sway;
  this.camera.position.y=dt>0?THREE.MathUtils.damp(this.camera.position.y,eyeY,14,dt):eyeY;
  this.camera.rotation.set(this.pitch,this.yaw,0,"YXZ");
  // Portrait screens need a wider downward view to include chibi shoulders and
  // both hands. The forward view keeps a conventional perspective.
  const fullBodyFov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(42))/this.camera.aspect)),112,128);
  const rpsFov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(38))/this.camera.aspect)),84,104);
  this.camera.fov=this.rpsMode?rpsFov:THREE.MathUtils.lerp(74,fullBodyFov,down);this.camera.updateProjectionMatrix();
 }
 dispose(){this.actor.dispose();this.actor.group.removeFromParent();}
}
