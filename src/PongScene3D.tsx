import {useEffect,useRef} from "react";
import * as THREE from "three";
import type {Game,Side} from "./Pieces";
import {MAX_SMASH_CHARGE_MS} from "./pongTiming";
import {pongContactPose,pongSwingMotion,type PongContactPose} from "./pongSwing";

type Pong=NonNullable<Game["pong"]>;
type Props={side:Side;snapshot:Pong;onPaddle:(value:number)=>void;
 onCharge:(holding:boolean)=>void;onReady:()=>void;active:boolean};

// Server continues to simulate canonical sideways Pong; only the camera
// transforms coordinates for the local player.
export default function PongScene3D({side,snapshot,onPaddle,onCharge,onReady,active}:Props){
 const mount=useRef<HTMLDivElement>(null);
 const latest=useRef(snapshot),send=useRef(onPaddle),chargeCallback=useRef(onCharge),
 readyCallback=useRef(onReady),activeRef=useRef(active);
 const initialized=useRef(false);
 useEffect(()=>{latest.current=snapshot;send.current=onPaddle;chargeCallback.current=onCharge;
  readyCallback.current=onReady;activeRef.current=active;},[snapshot,onPaddle,onCharge,onReady,active]);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"low-power"});}
  catch{host.dataset.fallback="true";return;}
  initialized.current=true;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x11142f,1);
  renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none";
  renderer.domElement.setAttribute("aria-hidden","true");
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color("#15152f");
  // A narrower REAL table and a closer camera fill tall phone screens instead
  // of leaving empty sky/floor. Ball/paddle X coordinates share this scaling.
  scene.scale.x=.68;
  scene.fog=new THREE.Fog("#15152f",14,30);
  const ambient=new THREE.HemisphereLight("#dbe8ff","#635787",2.0);scene.add(ambient);
  const key=new THREE.DirectionalLight("#fff0d9",2.8);key.position.set(-3,9,6);scene.add(key);
  const rim=new THREE.DirectionalLight("#52cde2",1.4);rim.position.set(4,4,-7);scene.add(rim);
  const material=(color:string,metalness=.1,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const box=(w:number,h:number,d:number,color:string,x:number,y:number,z:number)=>{
   const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));
   m.position.set(x,y,z);scene.add(m);return m;
  };
  // Keep the court clear so the paddles and ball are the only game pieces.
  box(20,.15,25,"#1c1b38",0,-.62,0);
  // Table surface and structural details. +Z is always YOUR end.
  box(5.28,.24,8.45,"#333ca2",0,.02,0);
  box(5.10,.025,8.25,"#4151be",0,.159,0);
  const bright=new THREE.MeshBasicMaterial({color:"#d3f5ff"});
  const line=(w:number,d:number,x:number,z:number)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,.015,d),bright);
   mesh.position.set(x,.181,z);scene.add(mesh);
  };
  line(5.1,.035,0,-4.08);line(5.1,.035,0,4.08);
  for(const x of [-2.54,2.54])line(.035,8.2,x,0);
  line(.027,8.2,0,0);
  const net=new THREE.Mesh(new THREE.PlaneGeometry(5.15,.58),
   new THREE.MeshBasicMaterial({color:"#b7d7fd",side:THREE.DoubleSide,transparent:true,opacity:.52,depthWrite:false}));
  net.position.set(0,.51,0);scene.add(net);
  box(5.42,.08,.09,"#e4e4ff",0,.81,0);
  for(const x of [-2.62,2.62])box(.09,.9,.09,"#b1a4ff",x,.48,0);
  for(const z of [-3.2,3.2])for(const x of [-1.95,1.95])box(.18,1.2,.18,"#65628c",x,-.72,z);
  // Table side light strips.
  for(const x of [-2.65,2.65])box(.075,.07,8.3,"#71e7fa",x,-.08,0);
  const paddles=[new THREE.Group(),new THREE.Group()];
  const buildPaddle=(own:boolean)=>{
   const g=new THREE.Group();
   // A tapered oval blade and centered handle form one continuous paddle.
   const blade=new THREE.Shape();
   blade.moveTo(0,-.34);
   blade.bezierCurveTo(-.18,-.30,-.45,-.13,-.55,.23);
   blade.bezierCurveTo(-.67,.90,-.34,1.42,0,1.45);
   blade.bezierCurveTo(.34,1.42,.67,.90,.55,.23);
   blade.bezierCurveTo(.45,-.13,.18,-.30,0,-.34);
   const rim=new THREE.Mesh(new THREE.ExtrudeGeometry(blade,{depth:.11,bevelEnabled:true,
    bevelThickness:.025,bevelSize:.025,bevelSegments:2,curveSegments:12}),
    material(own?"#623541":"#2c426b",.03,.67));
   rim.position.z=-.08;g.add(rim);
   const face=new THREE.Mesh(new THREE.ShapeGeometry(blade,16),
    material(own?"#e63844":"#3988d4",.02,.83));
   face.scale.set(.94,.94,1);face.position.set(0,.025,.07);g.add(face);
   const woodMaterial=material("#d9a264",.02,.72);
   const gripMaterial=material("#a56b3e",.02,.78);
   // The grip projects toward its player in depth, not sideways across the
   // face. Draw the full grip over the table so it stays connected to the blade.
   woodMaterial.depthTest=false;woodMaterial.depthWrite=false;
   gripMaterial.depthTest=false;gripMaterial.depthWrite=false;
   const handle=new THREE.Group();handle.position.set(0,-.32,.09);
   handle.rotation.x=own?-.75:.75;g.add(handle);
   const neck=new THREE.Mesh(new THREE.CylinderGeometry(.135,.155,.24,12),woodMaterial);
   neck.position.y=-.12;handle.add(neck);
   const wood=new THREE.Mesh(new THREE.CylinderGeometry(.14,.12,.70,12),woodMaterial);
   wood.position.y=-.53;handle.add(wood);
   const grip=new THREE.Mesh(new THREE.CylinderGeometry(.15,.145,.32,12),gripMaterial);
   grip.position.y=-.70;handle.add(grip);
   const cap=new THREE.Mesh(new THREE.SphereGeometry(.145,12,8),gripMaterial);
   cap.scale.y=.5;cap.position.y=-.86;handle.add(cap);
   const size=own?.78:.55;
   g.scale.set(size/.68,size,size);
   return g;
  };
  const me=buildPaddle(true),them=buildPaddle(false);
  paddles[side]=me;paddles[side===0?1:0]=them;scene.add(me,them);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.132,12,8),
   new THREE.MeshStandardMaterial({color:"#ffffff",roughness:.18,emissive:"#d1b9ff",emissiveIntensity:.15}));
  scene.add(ball);
  const ballLight=new THREE.PointLight("#d2c4ff",.7,3.4);scene.add(ballLight);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.18,16),
   new THREE.MeshBasicMaterial({color:"#111039",transparent:true,opacity:.28,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.193;scene.add(shadow);
  const camera=new THREE.PerspectiveCamera(42,1,.1,70);
  // Keep the near-end view centered, as in a first-person table tennis rally.
  camera.position.set(0,6.35,10.65);camera.lookAt(0,.12,.35);
  const smooth={x:.5,y:.5,h:.42,paddles:[.5,.5]},clock=new THREE.Clock();
  const previousScreenX=[.5,.5],paddleLean=[0,0];
 // Transparent diminishing ball trail + future ballistic trajectory guide.
 const trail:Array<THREE.Mesh>=[];
 const trajectory:Array<THREE.Mesh>=[];
 for(let i=0;i<13;i++){
  const t=new THREE.Mesh(new THREE.SphereGeometry(.12*(1-i/20),8,6),
   new THREE.MeshBasicMaterial({color:i<4?"#d6edff":"#b3a5ff",transparent:true,
    opacity:.32*(1-i/13),depthWrite:false}));
  t.visible=false;trail.push(t);scene.add(t);
 }
 for(let i=0;i<14;i++){
  const t=new THREE.Mesh(new THREE.SphereGeometry(.047,7,5),
   new THREE.MeshBasicMaterial({color:"#91ecff",transparent:true,opacity:.56*(1-i/14),depthWrite:false}));
  t.visible=false;trajectory.push(t);scene.add(t);
 }
 const history:Array<THREE.Vector3>=[];
 let lastHistory=0,remoteCharged=false,chargeLocalAt=0,readySent=false;
 const strikeAt=[0,0],lastPaddlePower=[0,0],lastReleaseAt=[0,0];
 const strikePose:[PongContactPose,PongContactPose]=[
  pongContactPose(snapshot.ball,0,snapshot.paddles[0]),
  pongContactPose(snapshot.ball,1,snapshot.paddles[1])];
 let observedSnapshot=latest.current;
  const resize=()=>{
   const w=host.clientWidth,h=host.clientHeight;
   if(!w||!h)return;
   renderer.setSize(w,h,false);camera.aspect=w/h;
   // Narrow phone portraits need slightly wider field of view.
   camera.fov=w/h<.68?44:40;
   camera.updateProjectionMatrix();
  };
  resize();const observer=new ResizeObserver(resize);observer.observe(host);
  const toView=(x:number,y:number)=>side===0?{x:y,y:1-x}:{x:1-y,y:x};
  let raf=0,alive=true,previous=performance.now(),lastSent=0,down=false,id=-1;
  let pendingPaddle:number|null=null,sendTimer:ReturnType<typeof setTimeout>|null=null;
  let lastInputX:number|null=null,localLeanMomentum=0;
  let localPaddleTarget:number|null=null,lastLocalInputAt=0;
  const flushPaddle=()=>{
   if(sendTimer!==null){clearTimeout(sendTimer);sendTimer=null;}
   if(pendingPaddle===null||!activeRef.current)return;
   send.current(pendingPaddle);pendingPaddle=null;lastSent=performance.now();
  };
  function input(event:PointerEvent,forceSend=false){
   if(!activeRef.current||!host)return;
   const rect=host.getBoundingClientRect();
   // x controls physical paddle position; no controls on vertical axis.
   // Match the server's .12..88 paddle limit for instant local feedback.
   const fraction=THREE.MathUtils.clamp((event.clientX-rect.left)/Math.max(rect.width,1),.12,.88);
   const now=performance.now();
   // Accumulate a small directional impulse. Frame damping makes it settle
   // naturally even when pointer events arrive at uneven intervals.
   if(lastInputX!==null)
    localLeanMomentum=THREE.MathUtils.clamp(
     localLeanMomentum-(fraction-lastInputX)*4.5,-.38,.38);
   lastInputX=fraction;
   const canonical=side===0?fraction:1-fraction;
   localPaddleTarget=canonical;lastLocalInputAt=now;
   pendingPaddle=canonical;
   if(forceSend||now-lastSent>=25)flushPaddle();
   else if(sendTimer===null)sendTimer=setTimeout(flushPaddle,25-(now-lastSent));
  }
  const onDown=(e:PointerEvent)=>{
   if(!activeRef.current)return;
   down=true;id=e.pointerId;chargeLocalAt=performance.now();
   host.setPointerCapture(e.pointerId);input(e);chargeCallback.current(true);
 };
  const onMove=(e:PointerEvent)=>{
   if(down&&id===e.pointerId)input(e);
   else if(!down&&e.pointerType==="mouse")input(e);
  };
  const onUp=(e:PointerEvent)=>{
   if(e.pointerId===id){
    // The release position must reach the server even if the last move was throttled.
    if(activeRef.current)input(e,true);
    const releasedAt=performance.now();
    lastPaddlePower[side]=Math.min(1,(releasedAt-chargeLocalAt)/MAX_SMASH_CHARGE_MS);
    lastReleaseAt[side]=releasedAt;
    down=false;id=-1;chargeLocalAt=0;
    const current=latest.current,edge=side===0?.05:.95;
    const incoming=side===0?current.ball.vx<0:current.ball.vx>0;
    if(incoming&&Math.abs(current.ball.x-edge)<.25){
     strikeAt[side]=releasedAt;
     strikePose[side]=pongContactPose(current.ball,side,
      localPaddleTarget??current.paddles[side],lastPaddlePower[side]);
    }
    lastInputX=null;
    if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);
    if(activeRef.current)chargeCallback.current(false);
   }
 };
  host.addEventListener("pointerdown",onDown);host.addEventListener("pointermove",onMove);
  host.addEventListener("pointerup",onUp);host.addEventListener("pointercancel",onUp);
  function frame(now:number){
   if(!alive)return;
   raf=requestAnimationFrame(frame);
   const dt=Math.min((now-previous)/1000,.06);previous=now;
   localLeanMomentum*=Math.exp(-(down?2.5:10)*dt);
   const next=latest.current;
   if(next!==observedSnapshot){
    const before=observedSnapshot.ball,after=next.ball;
    for(const player of [0,1] as const){
     const rebound=player===0?before.vx<0&&after.vx>0&&after.x<.21:
      before.vx>0&&after.vx<0&&after.x>.79;
     const chargedHit=next.lastSmash[player]>observedSnapshot.lastSmash[player];
     if(rebound||chargedHit){
      strikeAt[player]=now;
      const strikePower=now-lastReleaseAt[player]<1300?lastPaddlePower[player]:0;
      strikePose[player]=pongContactPose(before,player,next.paddles[player],strikePower);
     }
    }
    observedSnapshot=next;
   }
   const gap=Math.hypot(next.ball.x-smooth.x,next.ball.y-smooth.y);
   const blend=1-Math.exp(-19*dt);
   if(gap>.15){smooth.x=next.ball.x;smooth.y=next.ball.y;}
   else{smooth.x=THREE.MathUtils.lerp(smooth.x,next.ball.x,blend);smooth.y=THREE.MathUtils.lerp(smooth.y,next.ball.y,blend);}
   smooth.h=THREE.MathUtils.lerp(smooth.h,next.ball.h??.38,blend);
   for(const player of [0,1] as const){
    const useLocal=player===side&&localPaddleTarget!==null&&now-lastLocalInputAt<500;
    const paddleTarget=useLocal?localPaddleTarget!:next.paddles[player];
    smooth.paddles[player]=THREE.MathUtils.lerp(smooth.paddles[player],paddleTarget,
     1-Math.exp(-(useLocal?40:24)*dt));
    const sx=side===0?smooth.paddles[player]:1-smooth.paddles[player];
    paddles[player].position.x=(sx-.5)*5.0;
    // The visible blade sits at the same end plane as the server collision.
    paddles[player].position.z=player===side?3.6:-3.6;
    // Lean into the actual travel direction, then return upright at rest.
    // Positive Z rotation moves the top of the blade left on screen.
    const horizontalSpeed=(sx-previousScreenX[player])/Math.max(dt,.001);
    previousScreenX[player]=sx;
    const targetLean=player===side?localLeanMomentum:
     THREE.MathUtils.clamp(-horizontalSpeed*.32,-.38,.38);
    paddleLean[player]=THREE.MathUtils.lerp(paddleLean[player],targetLean,1-Math.exp(-14*dt));
    const power=player===side&&down?Math.min(1,(now-chargeLocalAt)/MAX_SMASH_CHARGE_MS):(next.charge?.[player]??0);
    if(power>.015)lastPaddlePower[player]=power;
    // Detect remote release using authoritative charge/shot updates. Both
    // players see the other paddle wind up and swing.
    if(player!==side){
      if(power>.015)remoteCharged=true;
      if(remoteCharged&&power===0){
       remoteCharged=false;
       lastReleaseAt[player]=now;
       const edge=player===0?.05:.95;
       const incoming=player===0?next.ball.vx<0:next.ball.vx>0;
       if(strikeAt[player]!==now&&incoming&&Math.abs(next.ball.x-edge)<.25){
        strikeAt[player]=now;
        strikePose[player]=pongContactPose(next.ball,player,next.paddles[player],lastPaddlePower[player]);
       }
      }
    }
    const edge=player===0?.05:.95;
    const incoming=player===0?next.ball.vx<0:next.ball.vx>0;
    const near=incoming?THREE.MathUtils.clamp((.44-Math.abs(next.ball.x-edge))/.36,0,1):0;
    const livePose=pongContactPose(next.ball,player,smooth.paddles[player],lastPaddlePower[player]);
    const pose=strikePose[player];
    const progress=THREE.MathUtils.clamp((now-strikeAt[player])/480,0,1);
    const swing=strikeAt[player]>0&&progress<1?Math.sin(Math.PI*progress):0;
    const motion=strikeAt[player]>0&&progress<1?
     pongSwingMotion(pose,progress,lastPaddlePower[player]):null;
    // Low balls rise, high balls drive down, and wide balls are met with a
    // side step, wrist turn and blade angle rather than another forward swipe.
    paddles[player].position.x+=motion?.side??0;
    paddles[player].position.z+=(player===side?-1:1)*(motion?.forward??0);
    const targetPitch=power*.2+livePose.pitch*near*.23+(motion?.pitch??0);
    paddles[player].rotation.x=THREE.MathUtils.lerp(paddles[player].rotation.x,
     THREE.MathUtils.clamp(targetPitch,-.95,.95),1-Math.exp(-20*dt));
    const targetYaw=livePose.yaw*near*.48+(motion?.yaw??0);
    paddles[player].rotation.y=THREE.MathUtils.lerp(paddles[player].rotation.y,
     THREE.MathUtils.clamp(targetYaw,-.95,.95),1-Math.exp(-16*dt));
    const targetSideLean=paddleLean[player]+livePose.lean*near*.25+(motion?.roll??0);
    paddles[player].rotation.z=THREE.MathUtils.lerp(paddles[player].rotation.z,
     targetSideLean,1-Math.exp(-16*dt));
    const targetY=THREE.MathUtils.lerp(.62,livePose.height+livePose.high*.26,near*.88);
    const contactY=THREE.MathUtils.lerp(targetY,pose.height,swing*.55);
    paddles[player].position.y=THREE.MathUtils.lerp(paddles[player].position.y,
      contactY+power*.1+(motion?.vertical??0),
      1-Math.exp(-15*dt));
    if(player===side){
      host!.parentElement?.style.setProperty("--charge",String(power));
      host!.dataset.power=power.toFixed(2);
      host!.dataset.swinging=swing>0?"true":"false";
      host!.dataset.swingKind=swing>0?pose.kind:"idle";
      host!.dataset.paddleYaw=paddles[player].rotation.y.toFixed(3);
      host!.dataset.paddlePitch=paddles[player].rotation.x.toFixed(3);
      host!.dataset.paddleHeight=paddles[player].position.y.toFixed(3);
      host!.dataset.paddleRoll=paddles[player].rotation.z.toFixed(3);
      host!.dataset.paddleSwingX=(motion?.side??0).toFixed(3);
    }
    host!.dataset[player===side?"selfPaddleX":"opponentPaddleX"]=sx.toFixed(3);
    host!.dataset[player===side?"selfPaddleTilt":"opponentPaddleTilt"]=paddleLean[player].toFixed(3);
   }
   const projected=toView(smooth.x,smooth.y);
   const worldX=(projected.x-.5)*5.0;
   const worldZ=(projected.y-.5)*8.0;
   const physicalHeight=.31+Math.max(0,smooth.h-.09)*2.8;
   ball.position.set(worldX,physicalHeight,worldZ);ballLight.position.copy(ball.position);
   if(now-lastHistory>42){
    lastHistory=now;history.unshift(ball.position.clone());
    if(history.length>14)history.pop();
   }
   trail.forEach((ghost,i)=>{
    ghost.visible=i+1<history.length&&next.ball.vx!==0;
    if(ghost.visible)ghost.position.copy(history[i+1]);
   });
   // Server-snapshot velocity forms the forward trajectory. Client only
   // draws predictions; collisions, points and charge remain authoritative.
   let px=next.ball.x,py=next.ball.y,ph=next.ball.h,pvh=next.ball.vh;
   let pvx=next.ball.vx,pvy=next.ball.vy;
   trajectory.forEach((dot,i)=>{
    dot.visible=Math.abs(pvx)>.05;
    if(!dot.visible)return;
    const step=.075;
    const prev=px;
    px+=pvx*step;py+=pvy*step;pvh-=2.20*step;ph+=pvh*step;
    if(ph<.09){ph=.09;pvh=Math.max(.32,-pvh*.82);}
    if(py<.014||py>.986)pvy=-pvy;
    if((prev-.5)*(px-.5)<=0&&ph<.26)pvx=-pvx*.42;
    const pos=toView(px,py);
    dot.position.set((pos.x-.5)*5,.31+Math.max(0,ph-.09)*2.8,(pos.y-.5)*8);
   });
   shadow.position.set(worldX,.189,worldZ);
   host!.dataset.ballX=projected.x.toFixed(3);host!.dataset.ballY=projected.y.toFixed(3);
   host!.dataset.renderer="three";host!.dataset.drawCalls=String(renderer.info.render.calls);
   host!.dataset.ballHeight=next.ball.h?.toFixed(3)??"0";
   renderer.render(scene,camera);
   if(!readySent){readySent=true;readyCallback.current();}
  }
  raf=requestAnimationFrame(frame);
  return()=>{
   alive=false;cancelAnimationFrame(raf);observer.disconnect();
   if(sendTimer!==null)clearTimeout(sendTimer);
   if(down)chargeCallback.current(false);
   host.removeEventListener("pointerdown",onDown);host.removeEventListener("pointermove",onMove);
   host.removeEventListener("pointerup",onUp);host.removeEventListener("pointercancel",onUp);
   scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});
   renderer.dispose();renderer.domElement.remove();
   initialized.current=false;
  };
 },[side]);
 return <div ref={mount} className="pong-scene-3d" role="img"
  aria-label="3D ping pong table. Drag horizontally to move your bottom paddle"
  data-perspective={side===0?"side-0-bottom":"side-1-bottom"}/>;
}
