import {useEffect,useRef} from "react";
import * as THREE from "three";
import {CharacterActor} from "./CharacterActor";

type Pose={yaw:number;pitch:number};
type Nod={key:number;yes:boolean}|null;
type Expression={id:number;kind:"correct"|"wrong"|"pass"}|null;
type Props={
 word:string;side:0|1;active:boolean;isGuesser:boolean;
 reaction:Nod;povReaction:Nod;expression:Expression;
 remoteLook:Pose;onLocalLook?:(pose:Pose)=>void;onGesture?:(yes:boolean)=>void;onReady?:()=>void;
};
type EventMotion={key:number;yes:boolean;start:number};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const ease=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const YES:[[number,number],...Array<[number,number]>]=[[0,0],[.13,-.08],[.35,.31],[.56,-.04],[.79,.17],[1,0]];
const NO:[[number,number],...Array<[number,number]>]=[[0,0],[.16,.30],[.41,-.34],[.68,.20],[1,0]];
function sample(frames:[number,number][],progress:number){
 const t=clamp(progress,0,1);
 for(let j=1;j<frames.length;j++){
  const [end,y]=frames[j];
  if(t>end)continue;
  const [start,from]=frames[j-1];
  return THREE.MathUtils.lerp(from,y,ease((t-start)/(end-start)));
 }
 return 0;
}
function motion(item:EventMotion|null,now:number){
 if(!item)return {x:0,y:0,active:false};
 const time=(now-item.start)/(item.yes?1030:1120);
 if(time<0||time>=1)return {x:0,y:0,active:false};
 return item.yes?{x:sample(YES,time),y:0,active:true}:{x:0,y:sample(NO,time),active:true};
}
function mat(color:string){
 return new THREE.MeshStandardMaterial({color,roughness:.88,flatShading:true});
}
function cube(w:number,h:number,d:number,color:string,x=0,y=0,z=0){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));
 m.position.set(x,y,z);return m;
}
function shape(r:number,color:string,detail=1){
 return new THREE.Mesh(new THREE.IcosahedronGeometry(r,detail),mat(color));
}
function chair(color:string){
 const group=new THREE.Group();
 group.add(cube(2,.18,1.32,color,0,.54,-.32));
 group.add(cube(1.9,.97,.17,color,0,1.34,-.94));
 group.add(cube(1.93,.12,.21,"#ffe1af",0,1.83,-.94));
 for(const x of [-.9,.9]){
  for(const z of [-.78,.34])group.add(cube(.14,.56,.15,color,x,.27,z));
  group.add(cube(.17,.12,1.09,"#eacfac",x,1.04,-.12));
  group.add(cube(.13,.48,.15,color,x,.83,.35));
 }
 return group;
}
function glossy(color:string,roughness=.3,metalness=.1){
 return new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
}
function led(color:string,intensity=1.6){
 return new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity)});
}
function makeTextTexture(title:string,subtitle:string,accent:string){
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=320;
 const c=canvas.getContext("2d")!;
 c.fillStyle="#181932";c.fillRect(0,0,1024,320);
 c.fillStyle=accent;c.fillRect(0,0,1024,13);
 c.fillStyle="#fdf7f9";c.textAlign="center";c.textBaseline="middle";
 c.font="900 91px Arial";c.fillText(title,512,143);
 c.fillStyle="#d4c6e7";c.font="bold 28px Arial";c.fillText(subtitle,512,246);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function stage(scene:THREE.Scene){
 // A compact TV soundstage, not an audience stage. Architectural detail is
 // static and uses no shadow maps or postprocessing, even on mobile GPUs.
 const backdrop=mat("#252341");
 scene.add(new THREE.Mesh(new THREE.BoxGeometry(18,10,.25),backdrop));
 scene.children[scene.children.length-1].position.set(0,1,-7.20);
 // Inset acoustic wall panels have staggered colors and real gaps.
 for(let i=-4;i<=4;i++){
  const x=i*1.73;
  const wall=cube(1.64,5.85,.1,i%2===0?"#3b365b":"#343255",x,1.80,-7.03);
  scene.add(wall);
  scene.add(cube(.043,5.76,.09,"#565078",x+.80,1.79,-6.96));
 }
 // Two vertical display towers, with warm and blue/cyan edge lighting.
 for(const x of [-3.25,3.25]){
  const panel=cube(1.55,3.35,.20,"#202443",x,1.53,-6.68);
  scene.add(panel);
  scene.add(cube(1.43,3.10,.06,"#3e3b71",x,1.54,-6.53));
  for(let j=0;j<6;j++){
   scene.add(cube(1.27,.062,.09,j%2?"#917ec1":"#6ccac8",x,.38+j*.45,-6.44));
  }
  for(const inset of [-.69,.69]){
   scene.add(cube(.042,3.28,.105,x<0?"#ffc99c":"#8ee8e3",x+inset,1.53,-6.40));
  }
  scene.add(cube(1.5,.09,.13,"#e1cfa3",x,3.26,-6.40));
 }
 // Back-lit overhead marquee hangs from slender black support brackets.
 const signText=makeTextTexture("PINOY HENYO","CHAT  +  PLAY", "#74d1cc");
 const signBack=cube(5.22,.85,.22,"#1d203c",0,3.90,-6.62);
 scene.add(signBack);
 scene.add(cube(5.36,.09,.28,"#75d8d7",0,4.34,-6.53));
 scene.add(cube(5.36,.075,.25,"#e6b5df",0,3.46,-6.53));
 for(const x of [-2.62,2.62]){
  scene.add(cube(.075,.87,.25,"#e7bf9b",x,3.90,-6.51));
  scene.add(cube(.09,.42,.10,"#9997b6",x,4.52,-6.62));
 }
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.06,.75),
  new THREE.MeshBasicMaterial({map:signText,side:THREE.DoubleSide}));
 sign.position.set(0,3.90,-6.47);scene.add(sign);
 // Lightweight ceiling truss and focused practical lights.
 const rig=new THREE.Group();rig.position.set(0,4.42,-3.56);
 for(const y of [-.12,.12])rig.add(cube(8.5,.065,.085,"#b1a6bc",0,y,0));
 for(let i=0;i<15;i++){
  const x=(i-7)*.56;
  const brace=cube(.045,.34,.08,"#81778f",x,0,.0);
  brace.rotation.z=i%2===0?.73:-.73;rig.add(brace);
 }
 for(const x of [-3.0,-1.5,1.5,3.0]){
  rig.add(cube(.48,.30,.38,"#383954",x,-.26,.0));
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.18,.23,.14,10),
   glossy(x%3===0?"#ffe1a8":"#a6d7f3",.24,.15));
  lens.rotation.x=Math.PI/2;lens.position.set(x,-.48,.15);rig.add(lens);
  const flare=new THREE.Mesh(new THREE.CircleGeometry(.145,12),
   new THREE.MeshBasicMaterial({color:x===0?"#ffe6bb":"#a5ecf4",transparent:true,opacity:.91}));
  flare.position.set(x,-.49,.245);rig.add(flare);
 }
 scene.add(rig);
 // Transparent stylized spotlight cones suggest real stage lighting, using
 // only two 12-sided meshes instead of expensive volumetric light effects.
 for(const x of [-2.30,2.30]){
  const beam=new THREE.Mesh(new THREE.ConeGeometry(1.05,3.2,12,1,true),
   new THREE.MeshBasicMaterial({
    color:x<0?"#ffdfbf":"#a1e2f0",transparent:true,opacity:.062,
    depthWrite:false,side:THREE.DoubleSide}));
  beam.position.set(x,2.30,-2.65);
  beam.renderOrder=1;scene.add(beam);
 }
 // Floor, layered front fascia, and accent inlays are physical set geometry.
 const outer=new THREE.Mesh(new THREE.CylinderGeometry(3.36,3.49,.26,32),glossy("#574777",.59));
 outer.position.set(0,-.22,0);scene.add(outer);
 const deck=new THREE.Mesh(new THREE.CylinderGeometry(3.28,3.30,.11,32),glossy("#e0c8ed",.53));
 deck.position.set(0,-.05,0);scene.add(deck);
 for(const [radius,y,color] of [[3.30,.006,"#f2ddb3"],[3.08,.012,"#88cbd1"],[2.7,.018,"#bd9fd5"]] as const){
  const hoop=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,5,36),led(color,1.02));
  hoop.rotation.x=Math.PI/2;hoop.position.y=y;scene.add(hoop);
 }
 for(const x of [-2.55,2.55]){
  const boxLight=cube(.85,.23,1.06,"#655684",x,.10,-1.6);scene.add(boxLight);
  scene.add(cube(.73,.08,.94,x<0?"#f0c4a4":"#7cd7d7",x,.24,-1.6));
 }
 // Contact shadows ground the chair and shoes without GPU shadow mapping.
 for(const [x,z,scale,opacity] of [[0,-.10,1.0,.17],[-.45,1.00,.44,.15],[.45,1.00,.44,.15]] as const){
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(scale,18),
   new THREE.MeshBasicMaterial({color:"#312342",transparent:true,opacity,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.set(x,.018,z);scene.add(shadow);
 }
 // Foreground studio columns and light panels frame the scene without hiding faces.
 for(const x of [-4.6,4.6]){
  scene.add(cube(.20,4.3,.35,"#574a71",x,1.92,-3.95));
  scene.add(cube(.08,4.05,.38,x<0?"#eec3a8":"#77d9db",x,1.92,-3.70));
  const display=cube(.74,.83,.35,"#3f3e6c",x,1.36,-4.02);
  scene.add(display);
  scene.add(cube(.50,.52,.10,x<0?"#f7d0aa":"#8fe9df",x,1.36,-3.80));
 }
 // Additional side-set framing continues toward BOTH players' seats.
 // Short low-poly vertical stacks fill blank side views without an audience.
 for(const side of [-1,1]){
  const x=side*4.15;
  for(const z of [1.6,4.7]){
   scene.add(cube(.29,3.35,.34,"#575574",x,1.67,z));
   scene.add(cube(.08,3.11,.38,side<0?"#ffd6b0":"#82e8e2",x-side*.13,1.67,z+.19));
   scene.add(cube(.89,.78,.38,"#323552",x,1.95,z));
   scene.add(cube(.73,.62,.055,"#504c87",x,1.96,z+.22));
   scene.add(cube(.61,.07,.08,"#ffe1a7",x,2.12,z+.275));
   scene.add(cube(.61,.055,.08,"#89d9dd",x,1.89,z+.275));
  }
  // A compact show-light pylon gives height near the player's chair.
  const xNear=side*2.65;
  scene.add(cube(.18,2.30,.20,"#666081",xNear,1.20,5.15));
  for(let j=0;j<3;j++){
   const bulb=shape(.15,j%2===0?"#f6d5a8":"#96e4e2",0);
   bulb.position.set(xNear,.72+j*.70,5.29);scene.add(bulb);
  }
 }
 // Overhead canopy, simple suspended light pods and decorative ceiling rails.
 // These are deliberately placed ABOVE the local POV to show when looking up.
 for(const z of [2.2,5.15]){
  for(const y of [3.57,3.88]){
   scene.add(cube(8.9,.085,.12,"#736a96",0,y,z));
  }
  for(let i=-5;i<=5;i++){
   const x=i*.80;
   const strut=cube(.048,.36,.09,"#b1a4bc",x,3.74,z);
   strut.rotation.z=i%2===0?.64:-.64;scene.add(strut);
  }
  for(const x of [-3.3,3.3]){
   scene.add(cube(.52,.21,.43,"#3f3d60",x,3.45,z));
   const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,.12,8),
    led(x===0?"#ffe7ba":"#bceaf5",1.05));
   lamp.rotation.x=Math.PI/2;
   lamp.position.set(x,3.26,z+.13);scene.add(lamp);
  }
 }
 // Narrow ceiling strips are visible on tilting up and side-to-side.
 for(const x of [-4.25,4.25]){
  scene.add(cube(.13,.11,10.4,x<0?"#f7cfbc":"#a1e2ed",x,3.84,1.0));
 }
 // One practical key and one cyan edge fill are enough for the toy-like set.
 return [signText];
}
function wordTexture(word:string){
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=320;
 const c=canvas.getContext("2d")!;
 c.fillStyle="#fffdfa";c.beginPath();c.roundRect(17,20,990,278,43);c.fill();
 c.strokeStyle="#aaa1ce";c.lineWidth=11;c.stroke();
 c.textAlign="center";c.textBaseline="middle";
 c.fillStyle="#78649f";c.font="bold 26px Arial";c.fillText("GUESS THE WORD",512,77);
 c.fillStyle="#2d2849";
 // Fit text using actual canvas metrics rather than a few fixed length tiers.
 let size=106;
 while(size>51){
  c.font="900 "+size+"px Arial";
  if(c.measureText(word).width<=915)break;
  size-=3;
 }
 c.fillText(word,512,185,915);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
export default function ForeheadScene({word,side,active,isGuesser,reaction,povReaction,expression,remoteLook,onLocalLook,onGesture,onReady}:Props){
 const mount=useRef<HTMLDivElement|null>(null);
 const remoteRef=useRef(remoteLook);
 const callbackRef=useRef(onLocalLook);
 const gestureCallbackRef=useRef(onGesture);
 useEffect(()=>{gestureCallbackRef.current=onGesture;},[onGesture]);
 const readyCallback=useRef(onReady);
 useEffect(()=>{readyCallback.current=onReady;},[onReady]);
 const activeRef=useRef(active);
 const roleRef=useRef(isGuesser);
 useEffect(()=>{activeRef.current=active;roleRef.current=isGuesser;},[active,isGuesser]);
 const gestureRef=useRef<EventMotion|null>(null),ownGestureRef=useRef<EventMotion|null>(null);
 const expressionRef=useRef<{id:number;kind:NonNullable<Expression>["kind"];start:number}|null>(null);
 const textureRef=useRef<{plane:THREE.Mesh;texture:THREE.Texture}|null>(null);
 useEffect(()=>{remoteRef.current=remoteLook;callbackRef.current=onLocalLook;},[remoteLook,onLocalLook]);
 useEffect(()=>{
  if(reaction&&gestureRef.current?.key!==reaction.key)gestureRef.current={...reaction,start:performance.now()};
  else if(!reaction)gestureRef.current=null;
 },[reaction?.key,reaction?.yes]);
 useEffect(()=>{
  if(povReaction&&ownGestureRef.current?.key!==povReaction.key)ownGestureRef.current={...povReaction,start:performance.now()};
  else if(!povReaction)ownGestureRef.current=null;
 },[povReaction?.key,povReaction?.yes]);
 useEffect(()=>{
  if(expression&&expressionRef.current?.id!==expression.id)expressionRef.current={...expression,start:performance.now()};
 },[expression?.id,expression?.kind]);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});}
  catch{host!.dataset.fallback="true";return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.3));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const canvas=renderer.domElement;canvas.style.touchAction="none";canvas.setAttribute("aria-hidden","true");
  host.appendChild(canvas);
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe5f0ff,0x8581b0,2.45));
  const key=new THREE.DirectionalLight(0xffe6cd,2.75);key.position.set(-3,6,6);scene.add(key);
  const rim=new THREE.DirectionalLight(0xb9c4ff,1.35);rim.position.set(4,4,-3);scene.add(rim);
  const studioTextures=stage(scene);
  const seat=chair(side===0?"#e3b8d3":"#acb9de");seat.position.z=-.15;scene.add(seat);
  const actor=new CharacterActor(side===0?1:0);
  actor.group.position.z=-.17;scene.add(actor.group);
  const signTexture=wordTexture(word||" ");
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.53,.47),
    new THREE.MeshBasicMaterial({map:signTexture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  sign.position.set(0,.48,1.04);sign.visible=Boolean(word);
  actor.headRig.add(sign);textureRef.current={plane:sign,texture:signTexture};
  const camera=new THREE.PerspectiveCamera(34,1,.1,65);
  // Camera lives under an eye pivot. This is the local player's POV.
  const eyePivot=new THREE.Group();eyePivot.position.set(0,2.18,isGuesser?7.85:8.65);
  scene.add(eyePivot);eyePivot.add(camera);
  const ownActor=new CharacterActor(side,true);
  const localBody=ownActor.group;localBody.visible=false;
  localBody.rotation.y=Math.PI;
  scene.add(localBody);
  const localFloor=new THREE.Mesh(new THREE.CircleGeometry(2.7,28),new THREE.MeshBasicMaterial({color:"#aa96c3",side:THREE.DoubleSide}));
  localFloor.rotation.x=-Math.PI/2;localFloor.position.y=-.012;scene.add(localFloor);
  let modelsReady=false;
  void Promise.all([actor.ready,ownActor.ready]).then(()=>{
   if(stopped)return;modelsReady=true;host.dataset.characterSource="blender-glb";
  }).catch(()=>{if(stopped)return;host.dataset.fallback="true";host.dataset.assetError="true";readyCallback.current?.();});
  camera.position.set(0,0,0);
  // Camera is parented to the rotating eye pivot. Use a LOCAL camera
  // quaternion, never lookAt() after parenting: world-space lookAt would
  // counter-rotate the head and make downward drag show empty background.
  camera.rotation.set(-.044,0,0);
  const originalQuaternion=camera.quaternion.clone();
  const resize=()=>{
   camera.aspect=Math.max(120,host.clientWidth)/Math.max(120,host.clientHeight);
   camera.fov=host.clientHeight<host.clientWidth?37:34;
   camera.updateProjectionMatrix();
   renderer.setSize(Math.max(120,host.clientWidth),Math.max(120,host.clientHeight),false);
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const pointer={down:false,id:-1,x:0,y:0,startX:0,startY:0,startAt:0,yaw:0,pitch:0};
  function down(e:PointerEvent){
   if(!activeRef.current||pointer.down)return;
   pointer.down=true;pointer.id=e.pointerId;pointer.x=e.clientX;pointer.y=e.clientY;
   pointer.startX=e.clientX;pointer.startY=e.clientY;pointer.startAt=performance.now();
   canvas.setPointerCapture(e.pointerId);e.preventDefault();
  }
  function move(e:PointerEvent){
   if(!pointer.down||pointer.id!==e.pointerId)return;
   pointer.yaw=clamp(pointer.yaw-(e.clientX-pointer.x)*.005,-.86,.86);
   pointer.pitch=clamp(pointer.pitch-(e.clientY-pointer.y)*.0063,-1.15,.58);
   pointer.x=e.clientX;pointer.y=e.clientY;e.preventDefault();
  }
  function up(e:PointerEvent){
   if(pointer.id!==e.pointerId)return;
   pointer.down=false;pointer.id=-1;
   if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
   // A deliberate, quick swipe moves the hint giver's head naturally.
   // Vertical = nod YES, horizontal = shake NO, without visible buttons.
   // Ordinary drags still let BOTH players freely look around the studio.
   const dx=e.clientX-pointer.startX,dy=e.clientY-pointer.startY;
   const elapsed=performance.now()-pointer.startAt;
   if(gestureCallbackRef.current&&activeRef.current&&elapsed<720){
    if(Math.abs(dy)>44&&Math.abs(dy)>Math.abs(dx)*1.38){
     pointer.pitch=0;gestureCallbackRef.current(true);
    }else if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)*1.38){
     pointer.yaw=0;gestureCallbackRef.current(false);
    }
   }
  }
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);
  canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);
  let raf=0,stopped=false,last=0,lastPose=0,firstFrame=false;
  let previousRole=isGuesser,lastActorGesture=-1;
  const beginning=performance.now();
  function frame(now:number){
   if(stopped)return;raf=requestAnimationFrame(frame);
   if(now-last<1000/28)return;
   const dt=Math.min(.08,Math.max(.003,(now-last)/1000));last=now;
   if(roleRef.current!==previousRole){
    // Preserve WebGL canvas and existing character, but gracefully center
    // the player's line of sight each time they swap roles.
    previousRole=roleRef.current;
    pointer.yaw=0;pointer.pitch=0;
   }
   const t=(now-beginning)/1000,fast=1-Math.exp(-13*dt),slow=1-Math.exp(-8*dt);
   const shown=motion(gestureRef.current,now),own=motion(ownGestureRef.current,now);
   const peer=remoteRef.current;
   const peerYaw=activeRef.current?-peer.yaw:0;
   const peerPitch=activeRef.current?-peer.pitch:0;
   // Smooth camera relocation between guesser and hint giver WITHOUT
   // destroying/recreating the WebGL canvas at each turn change.
   eyePivot.position.z=THREE.MathUtils.lerp(eyePivot.position.z,
    roleRef.current?7.85:8.65,slow);
   const exp=expressionRef.current;
   const expAge=exp?(now-exp.start)/1000:99;
   const lively=expAge<1.4?1-ease(expAge/1.4):0;
   const happy=exp?.kind==="correct"?lively:0;
   const wrong=exp?.kind==="wrong"?lively:0;
   const switching=exp?.kind==="pass"?lively:0;
   actor.group.position.y=Math.sin(t*1.5)*.006+Math.sin(t*11)*.032*happy;
   const newGesture=shown.active&&gestureRef.current?.key!==lastActorGesture;
   if(newGesture)lastActorGesture=gestureRef.current!.key;
   actor.play(shown.active?(gestureRef.current?.yes?"NodYes":"ShakeNo"):happy>.1?"Happy":wrong>.1?"Sad":"Idle",shown.active,newGesture);
   actor.update(dt,t,{seated:true,pitch:-peerPitch*.86+wrong*.15,
    yaw:peerYaw*.92+switching*.2,torsoPitch:shown.x*.26-peerPitch*.09,
    torsoYaw:shown.y*.22+peerYaw*.11,happy,sad:wrong,surprised:0});
   ownActor.update(dt,t,{seated:true});
   eyePivot.rotation.y=THREE.MathUtils.lerp(eyePivot.rotation.y,
    clamp(pointer.yaw+own.y*.72,-1.02,1.02),fast);
   eyePivot.rotation.x=THREE.MathUtils.lerp(eyePivot.rotation.x,
    clamp(pointer.pitch-own.x*.78,-1.20,.70),fast);
   camera.quaternion.copy(originalQuaternion);
   // Wider view only on a deep downward look: keep feet and hands in frame
   // without shrinking the opponent during regular play.
   const baseFov=host!.clientHeight<host!.clientWidth?37:34;
   const downAmount=clamp((-eyePivot.rotation.x-.24)/.86,0,1);
   const bodyFov=clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(38))/camera.aspect)),76,116);
   const targetFov=THREE.MathUtils.lerp(baseFov,bodyFov,ease(downAmount));
   const nextFov=THREE.MathUtils.lerp(camera.fov,targetFov,slow);
   if(Math.abs(camera.fov-nextFov)>.025){camera.fov=nextFov;camera.updateProjectionMatrix();}
   // The complete seated body stays in place as the head looks around.
   // Perspective reveals it naturally, without toggling limbs on and off.
   localBody.position.z=eyePivot.position.z+.43;
   localFloor.position.z=localBody.position.z;
   localBody.visible=modelsReady;
   host!.dataset.selfVisible=String(localBody.visible);
   if(activeRef.current&&callbackRef.current&&now-lastPose>110){
    lastPose=now;
    // The camera can look farther down than the network's accepted pose range.
    callbackRef.current({yaw:+eyePivot.rotation.y.toFixed(3),pitch:+clamp(eyePivot.rotation.x,-1,1).toFixed(3)});
   }
   host!.dataset.cameraYaw=eyePivot.rotation.y.toFixed(3);
   host!.dataset.cameraPitch=eyePivot.rotation.x.toFixed(3);
   host!.dataset.remoteYaw=peerYaw.toFixed(3);
   host!.dataset.remotePitch=peerPitch.toFixed(3);
   host!.dataset.headMotion=(Math.abs(shown.x-peerPitch*.86)+Math.abs(shown.y+peerYaw*.92)).toFixed(3);
   host!.dataset.torsoMotion=(Math.abs(shown.x*.26-peerPitch*.09)+Math.abs(shown.y*.22+peerYaw*.11)).toFixed(3);
   host!.dataset.cameraMotion=(Math.abs(eyePivot.rotation.x)+Math.abs(eyePivot.rotation.y)).toFixed(3);
   host!.dataset.expression=wrong>.1?"confused":happy>.1?"happy":switching>.1?"pass":"idle";
   renderer.render(scene,camera);
   if(!firstFrame&&modelsReady){firstFrame=true;host!.dataset.assetsReady="true";readyCallback.current?.();}
   host!.dataset.drawCalls=String(renderer.info.render.calls);
   host!.dataset.triangles=String(renderer.info.render.triangles);
  }
  raf=requestAnimationFrame(frame);
  return()=>{
   stopped=true;cancelAnimationFrame(raf);observer.disconnect();
   canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);
   canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);
   textureRef.current?.texture.dispose();textureRef.current=null;
   studioTextures.forEach(t=>t.dispose());
   actor.dispose();ownActor.dispose();
   scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
    o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(material=>material.dispose());
   });
   renderer.dispose();canvas.remove();
  };
 },[side]);
 useEffect(()=>{
  const item=textureRef.current;if(!item)return;
  const t=wordTexture(word||" ");
  item.plane.visible=Boolean(word);
  const m=item.plane.material as THREE.MeshBasicMaterial;
  m.map=t;m.needsUpdate=true;item.texture.dispose();item.texture=t;
 },[word,isGuesser]);
 return <div ref={mount} className="forehead-scene" role="img"
  data-reaction={reaction?(reaction.yes?"yes":"no"):"none"}
  data-camera-reaction={povReaction?(povReaction.yes?"yes":"no"):"none"}
  aria-label={word?"Partner's forehead word: "+word:"First-person view. Your secret word is hidden."}>
  <div className="forehead-scene-fallback">{word?<>Their forehead says <strong>{word}</strong></>:"Your word is hidden."}</div>
 </div>;
}
