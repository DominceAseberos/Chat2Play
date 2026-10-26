import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";

export type CharacterAction="Idle"|"Walk"|"Blink"|"Happy"|"Sad"|"Surprised"|"Celebrate"|"VictoryDance"|"NodYes"|"ShakeNo"|
 "LookLeft"|"LookRight"|"Sit"|"Stand"|"RaiseArms"|"LowerArms"|"RPSAnticipation"|
 "RPSPump"|"Rock"|"Paper"|"Scissors"|"Throw"|"Lose"|"POVReady"|"POVPump"|"POVThrow"|"POVRock"|"POVPaper"|"POVScissors";
type Motion={seated?:boolean;pitch?:number;yaw?:number;torsoPitch?:number;torsoYaw?:number;happy?:number;sad?:number;surprised?:number};
const loader=new GLTFLoader();
const axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0);
let actorSequence=0;

/** Each actor owns its GLTF resources and mixer, including late-load disposal. */
export class CharacterActor {
 readonly group=new THREE.Group();
 readonly headRig=new THREE.Group();
 readonly ready:Promise<void>;
 readonly bones=new Map<string,THREE.Bone>();
 readonly clips:THREE.AnimationClip[]=[];
 private mixer?:THREE.AnimationMixer;
 private mesh?:THREE.SkinnedMesh;
 private current?:THREE.AnimationAction;
 private model?:THREE.Group;
 private fullGeometry?:THREE.BufferGeometry;
 private bodyGeometry?:THREE.BufferGeometry;
 private handsGeometry?:THREE.BufferGeometry;
 private disposed=false;
 private rest=new Map<string,{q:THREE.Quaternion;p:THREE.Vector3}>();
 private animatedPose:{bone:THREE.Bone;q:THREE.Quaternion;p:THREE.Vector3;s:THREE.Vector3}[]=[];
 private animatedMorphs:number[]=[];
 private q=new THREE.Quaternion();
 private firstPerson:boolean;
 private desired:CharacterAction="Idle";
 private readonly phaseOffset:number;
 private motionClock=0;
 private nextBlinkAt:number;
 private blinkStart=-100;
 private blinkDuration=.18;
 private blinkCount=0;
 private idleWeight=0;
 constructor(which:0|1,firstPerson=false){
  const serial=actorSequence++;
  this.phaseOffset=serial*1.91+which*.73;
  this.nextBlinkAt=2.0+(serial%4)*.61+which*.32;
  this.firstPerson=firstPerson;
  this.group.name=which===0?"BlenderMale":"BlenderFemale";
  this.ready=loader.loadAsync(`/models/characters/${which===0?"male":"female"}.glb`).then(gltf=>{
   this.model=gltf.scene;
   if(this.disposed){this.release();return;}
   this.group.add(gltf.scene);
   gltf.scene.traverse(o=>{
    if(o instanceof THREE.Bone){
     this.bones.set(o.name,o);this.rest.set(o.name,{q:o.quaternion.clone(),p:o.position.clone()});
     this.animatedPose.push({bone:o,q:o.quaternion.clone(),p:o.position.clone(),s:o.scale.clone()});
    }
    if(o instanceof THREE.SkinnedMesh){
     this.mesh=o;o.frustumCulled=false;
    }
   });
   this.clips.push(...gltf.animations);
   if(!this.mesh||!this.bones.get("head")||this.clips.length<22)throw Error("Incomplete character asset");
   if(firstPerson)this.setFirstPerson(true);
   this.mixer=new THREE.AnimationMixer(gltf.scene);
   // Orient an attachment at the face center in the game's Y-up coordinates.
   this.group.updateMatrixWorld(true);
   const bone=this.bones.get("head")!;
   this.headRig.position.copy(bone.worldToLocal(this.group.localToWorld(new THREE.Vector3(0,2.40,0))));
   this.headRig.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert())
    .multiply(this.group.getWorldQuaternion(new THREE.Quaternion()));
   bone.add(this.headRig);
   this.play(this.desired);
  }).catch(error=>{this.release();throw error;});
 }
 /** Remove only self head/neck triangles; keep shoulders, chest and all limbs. */
 setFirstPerson(enabled:boolean){
  this.firstPerson=enabled;
  const mesh=this.mesh;if(!mesh)return;
  this.fullGeometry??=mesh.geometry;
  if(enabled&&!this.bodyGeometry){
   const geometry=this.fullGeometry,skin=geometry.getAttribute("skinIndex"),weights=geometry.getAttribute("skinWeight");
   const hidden=new Set(mesh.skeleton.bones.flatMap((b,i)=>b.name==="head"||b.name==="neck"?[i]:[]));
   const hide=(v:number)=>[0,1,2,3].some(k=>hidden.has(skin.getComponent(v,k))&&weights.getComponent(v,k)>.35);
   const index=geometry.getIndex(),count=index?.count??geometry.getAttribute("position").count,kept:number[]=[];
   for(let i=0;i<count;i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;if(!hide(a)&&!hide(b)&&!hide(c))kept.push(a,b,c);}
   this.bodyGeometry=geometry.clone();this.bodyGeometry.setIndex(kept);this.bodyGeometry.clearGroups();
  }
  mesh.geometry=enabled?this.bodyGeometry!:this.fullGeometry;
 }
 /** Show complete arms and hands while hiding the torso in the RPS close-up. */
 setFirstPersonHandsOnly(enabled:boolean){
  const mesh=this.mesh;if(!mesh)return;
  if(enabled&&!this.handsGeometry){
   const geometry=this.fullGeometry??mesh.geometry;
   const skin=geometry.getAttribute("skinIndex"),weights=geometry.getAttribute("skinWeight"),index=geometry.getIndex();
   const handPart=(v:number)=>{
    let strongest=0,bone=0;
    for(let k=0;k<4;k++)if(weights.getComponent(v,k)>strongest){strongest=weights.getComponent(v,k);bone=skin.getComponent(v,k);}
    return /^(upper_arm[LR]|forearm[LR]|hand[LR]|(?:thumb|index|middle|ring|pinky)(?:01|02)[LR])$/.test(mesh.skeleton.bones[bone].name);
   };
   const kept:number[]=[],count=index?.count??geometry.getAttribute("position").count;
   for(let i=0;i<count;i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
    if(handPart(a)&&handPart(b)&&handPart(c))kept.push(a,b,c);
   }
   this.handsGeometry=geometry.clone();this.handsGeometry.setIndex(kept);this.handsGeometry.clearGroups();
  }
  mesh.geometry=enabled?this.handsGeometry!:this.firstPerson?this.bodyGeometry!:this.fullGeometry!;
 }
 setPlaybackRate(rate:number){this.current?.setEffectiveTimeScale(rate);}
 seekCurrentNormalized(progress:number){const clip=this.current?.getClip();if(clip&&this.current)this.current.time=THREE.MathUtils.clamp(progress,0,.999)*clip.duration;}
 get animationTime(){return this.current?.time??0;}
 play(name:CharacterAction,once=false,restart=false){
  once=once||["RaiseArms","LowerArms","Throw","POVThrow","NodYes","ShakeNo"].includes(name);
  this.desired=name;
  if(!this.mixer)return;
  const clip=this.clips.find(c=>c.name===name);if(!clip)throw Error(`Missing animation: ${name}`);
  const next=this.mixer.clipAction(clip);
  if(next===this.current&&!restart)return;
  const old=this.current;
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
  next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
  next.play();
  if(old&&old!==next){
   const prior=old.getClip().name;
   // Let planted movement settle naturally; hand gestures stay responsive.
   const fade=(name==="Sit"||name==="Stand") ? .40 :
    (name==="Idle"&&prior==="Walk") ? .28 :
    name==="Walk" ? .24 :
    name==="VictoryDance" ? .26 :
    name.startsWith("POV") ? .14 : .18;
   next.crossFadeFrom(old,fade,false);
  }
  this.current=next;
 }
 private rotate(name:string,angle:number,axis:THREE.Vector3,absolute=false){
  const bone=this.bones.get(name),rest=this.rest.get(name);if(!bone||!rest)return;
  if(absolute)bone.quaternion.copy(rest.q);
  bone.quaternion.multiply(this.q.setFromAxisAngle(axis,angle));
 }
 update(dt:number,_time:number,motion:Motion={}){
  if(!this.mixer||!this.mesh)return;
  // Restore the sampled pose before mixing. Constant tracks may skip writes;
  // without this, head-look overlays accumulate and a blink stays closed.
  for(const p of this.animatedPose){p.bone.quaternion.copy(p.q);p.bone.position.copy(p.p);p.bone.scale.copy(p.s);}
  const morphs=this.mesh.morphTargetInfluences;
  if(morphs)for(let i=0;i<this.animatedMorphs.length;i++)morphs[i]=this.animatedMorphs[i];
  this.mixer.update(Math.min(dt,.1));
  for(const p of this.animatedPose){p.q.copy(p.bone.quaternion);p.p.copy(p.bone.position);p.s.copy(p.bone.scale);}
  if(morphs)for(let i=0;i<morphs.length;i++)this.animatedMorphs[i]=morphs[i];
  if(motion.seated){
   const hip=this.bones.get("hips")!;
   hip.position.y=this.rest.get("hips")!.p.y-.30;
   for(const side of ["L","R"]){
    this.rotate(`thigh${side}`,-1.35,axisX,true);this.rotate(`shin${side}`,1.35,axisX,true);
    this.rotate(`foot${side}`,0,axisX,true);
   }
  }
  if(this.firstPerson&&!this.desired.startsWith("POV")){
   // Keep the actual connected arms slightly ahead of the chest in self view;
   // the chibi puff sleeves otherwise hide the hands from the eye camera.
   for(const side of ["L","R"]){this.rotate(`upper_arm${side}`,-.30,axisX);this.rotate(`forearm${side}`,-.42,axisX);}
  }
  // Small breathing and gaze shifts make otherwise static waiting poses alive.
  // Limit them to resting clips so authored throws, walking, and dances stay exact.
  const still=["Idle","Sit","RPSAnticipation"].includes(this.desired);
  const elapsed=THREE.MathUtils.clamp(dt,0,.1);
  this.motionClock+=elapsed;
  this.idleWeight=THREE.MathUtils.damp(this.idleWeight,still?1:0,3.5,elapsed);
  if(this.idleWeight>.001){
   const phase=this.motionClock*1.67+this.phaseOffset;
   const inhale=Math.sin(phase)*this.idleWeight;
   this.rotate("chest",inhale*.012,axisX);
   this.rotate("head",-inhale*.006,axisX);
   this.rotate("head",Math.sin(phase*.51)*.009*this.idleWeight,axisY);
  }
  // Three.js sanitizes dots from Blender bone names (upper_arm.R -> upper_armR).
  if(motion.pitch)this.rotate("head",motion.pitch,axisX);
  if(motion.yaw)this.rotate("head",motion.yaw,axisY);
  if(motion.torsoPitch)this.rotate("chest",motion.torsoPitch,axisX);
  if(motion.torsoYaw)this.rotate("chest",motion.torsoYaw,axisY);
  const dict=this.mesh.morphTargetDictionary,values=this.mesh.morphTargetInfluences;
  if(dict&&values){
   // Actor-specific intervals prevent identical, metronomic blinks.
   if(this.motionClock>=this.nextBlinkAt){
    this.blinkStart=this.motionClock;
    this.blinkCount++;
    this.blinkDuration=.15+.035*(.5+.5*Math.sin(this.blinkCount*1.8+this.phaseOffset));
    this.nextBlinkAt=this.motionClock+3.0+2.6*(.5+.5*Math.sin(this.blinkCount*2.27+this.phaseOffset));
   }
   const age=this.motionClock-this.blinkStart;
   const blink=age>=0&&age<this.blinkDuration?Math.pow(Math.sin(Math.PI*age/this.blinkDuration),.8):0;
   if(dict.Blink!==undefined)values[dict.Blink]=Math.max(values[dict.Blink]||0,blink);
   if(motion.happy!==undefined)values[dict.Happy]=motion.happy;
   if(motion.sad!==undefined)values[dict.Sad]=motion.sad;
   if(motion.surprised!==undefined)values[dict.Surprised]=motion.surprised;
  }
 }
 get action(){return this.desired;}
 private release(){
  if(!this.model)return;
  const geometries=new Set<THREE.BufferGeometry>();
  if(this.fullGeometry)geometries.add(this.fullGeometry);if(this.bodyGeometry)geometries.add(this.bodyGeometry);if(this.handsGeometry)geometries.add(this.handsGeometry);
  this.model.traverse(o=>{
   if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}
   if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();
  });
  geometries.forEach(g=>g.dispose());this.fullGeometry=undefined;this.bodyGeometry=undefined;this.handsGeometry=undefined;
  this.mixer?.stopAllAction();if(this.mixer)this.mixer.uncacheRoot(this.model);
  this.model.removeFromParent();this.model=undefined;
 }
 dispose(){this.disposed=true;this.headRig.removeFromParent();this.release();}
}
