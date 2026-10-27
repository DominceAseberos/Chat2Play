import {useEffect,useRef} from "react";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import type {Game,Side} from "./Pieces";
import {PONG_BACK_REACH,PONG_SERVE_FORWARD_LIMIT,paddleSideAngle,pongContactPose,pongDepthFromReach,pongReachFromDepth,
 pongSwingMotion,pongSwipePower,predictPongContact,type PongContactPose} from "./pongSwing";

type Pong=NonNullable<Game["pong"]>;
type Props={side:Side;snapshot:Pong;onPaddle:(value:{y:number;depth:number;forwardStroke:number})=>void;
 onDrag:(active:boolean)=>void;onReady:()=>void;active:boolean};

// Server continues to simulate canonical sideways Pong; only the camera
// transforms coordinates for the local player.
export default function PongScene3D({side,snapshot,onPaddle,onDrag,onReady,active}:Props){
 const mount=useRef<HTMLDivElement>(null);
 const latest=useRef(snapshot),receivedAt=useRef(performance.now()),send=useRef(onPaddle),dragCallback=useRef(onDrag),
 readyCallback=useRef(onReady),activeRef=useRef(active);
 const initialized=useRef(false);
 useEffect(()=>{if(latest.current!==snapshot)receivedAt.current=performance.now();
  latest.current=snapshot;send.current=onPaddle;dragCallback.current=onDrag;
  readyCallback.current=onReady;activeRef.current=active;},[snapshot,onPaddle,onDrag,onReady,active]);
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
  const floor=new THREE.Mesh(new THREE.BoxGeometry(80,.15,80),
   new THREE.MeshBasicMaterial({color:"#15152f"}));
  floor.position.set(0,-.62,0);scene.add(floor);
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
  // The white sideline marks the court; there are no side rails or walls.
  const paddles=[new THREE.Group(),new THREE.Group()];
  const buildPaddle=(player:Side,own:boolean)=>{
   const g=new THREE.Group();
   const rubber=player===0?"#202733":"#db3f46";
   // A broad bat with a side grip. Both visible rubber faces use the
   // player's color, regardless of which camera sees them.
   const blade=new THREE.Shape();
   blade.absellipse(0,0,.65,.54,0,Math.PI*2,false,0);
   const rim=new THREE.Mesh(new THREE.ExtrudeGeometry(blade,{depth:.09,bevelEnabled:true,
    bevelThickness:.025,bevelSize:.025,bevelSegments:2,curveSegments:12}),
    material("#161c27",.04,.72));
   rim.position.z=-.045;g.add(rim);
   const faceShape=new THREE.ShapeGeometry(blade,20);
   const back=new THREE.Mesh(faceShape,material(rubber,.02,.86));
   back.scale.set(.96,.95,1);back.position.z=.074;g.add(back);
   const front=new THREE.Mesh(faceShape,material(rubber,.02,.86));
   front.scale.set(.96,.95,1);front.rotation.y=Math.PI;front.position.z=-.074;g.add(front);
   const woodMaterial=material("#d9a264",.02,.72);
   const gripMaterial=material(player===0?"#1e9f81":"#c99e4e",.02,.75);
   // Rotate the handle in the blade plane: the local -Y axis becomes the
   // player's right-hand grip, rather than a stick hanging below the bat.
   const handle=new THREE.Group();handle.position.set(own?.59:-.59,-.10,.025);
   handle.rotation.z=own?Math.PI/2-.10:-Math.PI/2+.10;g.add(handle);
   const neck=new THREE.Mesh(new THREE.CylinderGeometry(.135,.12,.25,12),woodMaterial);
   neck.position.y=-.12;handle.add(neck);
   const grip=new THREE.Mesh(new THREE.CylinderGeometry(.13,.145,.61,12),gripMaterial);
   grip.position.y=-.48;handle.add(grip);
   const cap=new THREE.Mesh(new THREE.SphereGeometry(.145,12,8),gripMaterial);
   cap.scale.y=.46;cap.position.y=-.77;handle.add(cap);
   const size=own?1:.66;
   g.scale.set(size,size*.82,size);
   return g;
  };
  const me=buildPaddle(side,true),them=buildPaddle(side===0?1:0,false);
  paddles[side]=me;paddles[side===0?1:0]=them;scene.add(me,them);
  let paddleModelReady=false;
  new GLTFLoader().load("/models/pong/paddle.glb",asset=>{
   if(!alive)return;
   for(const player of [0,1] as const){
    const target=paddles[player];
    target.traverse(obj=>{if(obj instanceof THREE.Mesh){
     obj.geometry.dispose();
     const mats=Array.isArray(obj.material)?obj.material:[obj.material];
     mats.forEach(mat=>mat.dispose());
    }});
    target.clear();
    const model=asset.scene.clone(true);
    // Both rubber faces belong to the player, not to the camera angle.
    // Player 0 stays charcoal and player 1 stays red on both phones.
    const rubberColor=player===0?"#202733":"#db3f46";
    model.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;
     const recolor=(mat:THREE.Material)=>{
      if(mat.name!=="Matte charcoal rubber"&&mat.name!=="Crimson rubber")return mat;
      const ownMaterial=mat.clone();
      if(ownMaterial instanceof THREE.MeshStandardMaterial)ownMaterial.color.set(rubberColor);
      return ownMaterial;
     };
     obj.material=Array.isArray(obj.material)?obj.material.map(recolor):recolor(obj.material);
    });
    // Mirror the far grip, while keeping the same player's rubber color.
    if(player!==side)model.rotation.y=Math.PI;
    target.add(model);
    const size=player===side?.9:.74;
    target.scale.set(size,size,size);
   }
   host.dataset.paddleModel="blender";
   host.dataset.selfPaddleColor=side===0?"charcoal":"red";
   host.dataset.opponentPaddleColor=side===0?"red":"charcoal";
   paddleModelReady=true;
  },undefined,()=>{
   host.dataset.paddleModel="fallback";
   paddleModelReady=true;
  });
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.132,12,8),
   new THREE.MeshStandardMaterial({color:"#ffffff",roughness:.18,emissive:"#d1b9ff",emissiveIntensity:.15}));
  scene.add(ball);
  const ballLight=new THREE.PointLight("#d2c4ff",.7,3.4);scene.add(ballLight);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.18,16),
   new THREE.MeshBasicMaterial({color:"#111039",transparent:true,opacity:.28,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.193;scene.add(shadow);
  const camera=new THREE.PerspectiveCamera(42,1,.1,70);
  // The viewpoint follows the player's depth and circles behind wide shots.
  camera.position.set(0,6.35,11);camera.lookAt(0,.12,.35);
  let cameraFocusX=0,cameraFocusZ=.35;
  const smooth={x:.5,y:.5,h:.42,paddles:[.5,.5],depths:[-.1,1.1]};
  const previousScreenX=[.5,.5],paddleLean=[0,0];
  const touchingNet=[false,false],netHorizontalAngle=[0,0];
  const paddleRotationMatrix=new THREE.Matrix4();
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
 let lastHistory=0,readySent=false;
 const strikeAt=[0,0],lastPaddlePower=[0,0];
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
  let pendingPaddle:{y:number;depth:number;forwardStroke:number}|null=null,sendTimer:ReturnType<typeof setTimeout>|null=null;
  let lastInputX:number|null=null,localLeanMomentum=0;
  let pointerStartX=0,pointerStartY=0,swipeStartX=.5,swipeStartReach=0;
  let lastPointerY=0,forwardStroke=0;
  let swipeTravel=0,swipeSpeed=0,lastSwipeMoveAt=0;
  let lastInputReach:number|null=null;
  let localSwipePreview=0,localSwipePreviewAt=0;
  let localPaddleTarget:{y:number;depth:number}|null=null,lastLocalInputAt=0;
  const flushPaddle=()=>{
   if(sendTimer!==null){clearTimeout(sendTimer);sendTimer=null;}
   if(pendingPaddle===null||!activeRef.current)return;
   send.current(pendingPaddle);pendingPaddle=null;lastSent=performance.now();
  };
  function input(event:PointerEvent,forceSend=false){
   if(!activeRef.current||!host)return;
   const rect=host.getBoundingClientRect();
   // Keep the starting position under the player's control. Dragging upward
   // advances from behind the near edge; dragging downward retreats there.
   const fraction=THREE.MathUtils.clamp(swipeStartX+
    1.7*(event.clientX-pointerStartX)/Math.max(rect.width,1),-.35,1.35);
   const reach=THREE.MathUtils.clamp(swipeStartReach+
    (pointerStartY-event.clientY)/Math.max(rect.height*.38,1),PONG_BACK_REACH,1);
   let depth=pongDepthFromReach(reach,side);
   if(latest.current.serving&&latest.current.server===side)
    depth=side===0?Math.min(depth,PONG_SERVE_FORWARD_LIMIT):Math.max(depth,1-PONG_SERVE_FORWARD_LIMIT);
   if(down){forwardStroke=Math.min(3,forwardStroke+
    Math.max(0,(lastPointerY-event.clientY)/Math.max(rect.height,1)));}
   lastPointerY=event.clientY;
   const now=performance.now();
   // Accumulate a small directional impulse. Frame damping makes it settle
   // naturally even when pointer events arrive at uneven intervals.
   if(lastInputX!==null)
    localLeanMomentum=THREE.MathUtils.clamp(
     localLeanMomentum-(fraction-lastInputX)*4.5,-.38,.38);
   if(down&&lastInputX!==null&&lastInputReach!==null){
    const distance=Math.hypot(fraction-lastInputX,reach-lastInputReach);
    if(distance>.001){
    const elapsed=Math.max((now-lastSwipeMoveAt)/1000,.016);
    swipeSpeed=THREE.MathUtils.lerp(swipeSpeed,distance/elapsed,.62);
    swipeTravel+=distance;
    const ballX=side===0?latest.current.ball.y:1-latest.current.ball.y;
    const ballReach=pongReachFromDepth(latest.current.ball.x,side);
    const approach=Math.hypot(ballX-swipeStartX,ballReach-swipeStartReach)-
     Math.hypot(ballX-fraction,ballReach-reach);
    localSwipePreview=pongSwipePower(swipeSpeed,swipeTravel,approach);
    localSwipePreviewAt=now;
    }
   }
   lastSwipeMoveAt=now;
   lastInputX=fraction;lastInputReach=reach;
   const canonical=side===0?fraction:1-fraction;
   localPaddleTarget={y:canonical,depth};lastLocalInputAt=now;
   pendingPaddle={y:canonical,depth,forwardStroke};
   if(forceSend||now-lastSent>=25)flushPaddle();
   else if(sendTimer===null)sendTimer=setTimeout(flushPaddle,25-(now-lastSent));
  }
  const onDown=(e:PointerEvent)=>{
   if(!activeRef.current)return;
   if(down)return;
   down=true;id=e.pointerId;
   pointerStartX=e.clientX;pointerStartY=e.clientY;
   lastPointerY=e.clientY;forwardStroke=0;
   const target=localPaddleTarget??{y:latest.current.paddles[side],depth:latest.current.depths[side]};
   swipeStartX=side===0?target.y:1-target.y;
   swipeStartReach=pongReachFromDepth(target.depth,side);
   lastInputX=swipeStartX;lastInputReach=swipeStartReach;
   swipeTravel=0;swipeSpeed=0;
   localSwipePreview=0;localSwipePreviewAt=0;lastSwipeMoveAt=performance.now();
   host.setPointerCapture(e.pointerId);dragCallback.current(true);
 };
  const onMove=(e:PointerEvent)=>{
   if(down&&id===e.pointerId)input(e);
  };
  const onUp=(e:PointerEvent)=>{
   if(e.pointerId===id){
    // The release position must reach the server even if the last move was throttled.
    if(activeRef.current)input(e,true);
    down=false;id=-1;
    lastInputX=null;lastInputReach=null;
    if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);
    if(activeRef.current)dragCallback.current(false);
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
   let resetBall=false;
   if(next!==observedSnapshot){
    const before=observedSnapshot.ball,after=next.ball;
    if(next.serving&&!observedSnapshot.serving&&!down)localPaddleTarget=null;
    resetBall=next.serving!==observedSnapshot.serving||
     before.vx*after.vx<0||next.lastHit.some((hit,index)=>hit>observedSnapshot.lastHit[index]);
    for(const player of [0,1] as const){
     const rebound=player===0?before.vx<0&&after.vx>0&&after.x<.21:
      before.vx>0&&after.vx<0&&after.x>.79;
     const impact=next.lastHit[player]>observedSnapshot.lastHit[player];
     if(rebound||impact){
      strikeAt[player]=now;
      const strikePower=next.hitPower[player];
      lastPaddlePower[player]=strikePower;
      strikePose[player]=pongContactPose(before,player,next.paddles[player],strikePower);
     }
    }
    observedSnapshot=next;
   }
   // Render a short distance ahead of the last network sample. Easing toward
   // old samples added an extra visible delay at the exact moment of contact.
   const lead=next.serving?0:THREE.MathUtils.clamp(
    (now-receivedAt.current)/1000+.045,0,.12);
   const ballTarget={x:next.ball.x+next.ball.vx*lead,
    y:next.ball.y+next.ball.vy*lead+(next.ball.sideSpin??0)*lead*lead*.5,
    h:next.ball.h+next.ball.vh*lead-1.1*lead*lead};
   const gap=Math.hypot(ballTarget.x-smooth.x,ballTarget.y-smooth.y);
   const blend=1-Math.exp(-48*dt);
   if(resetBall||gap>.10){smooth.x=ballTarget.x;smooth.y=ballTarget.y;smooth.h=ballTarget.h;}
   else{smooth.x=THREE.MathUtils.lerp(smooth.x,ballTarget.x,blend);
    smooth.y=THREE.MathUtils.lerp(smooth.y,ballTarget.y,blend);
    smooth.h=THREE.MathUtils.lerp(smooth.h,ballTarget.h,blend);}
   for(const player of [0,1] as const){
    const pendingLocal=localPaddleTarget!==null&&
     (Math.abs(next.paddles[player]-localPaddleTarget.y)>.008||
      Math.abs(next.depths[player]-localPaddleTarget.depth)>.008);
    const useLocal=player===side&&localPaddleTarget!==null&&
     (down||pendingLocal&&now-lastLocalInputAt<1800);
    const paddleTarget=useLocal?localPaddleTarget!.y:next.paddles[player];
    const depthTarget=useLocal?localPaddleTarget!.depth:next.depths[player];
    smooth.paddles[player]=THREE.MathUtils.lerp(smooth.paddles[player],paddleTarget,
     1-Math.exp(-(useLocal?40:24)*dt));
    smooth.depths[player]=THREE.MathUtils.lerp(smooth.depths[player],depthTarget,
     1-Math.exp(-(useLocal?40:24)*dt));
    const sx=side===0?smooth.paddles[player]:1-smooth.paddles[player];
    paddles[player].position.x=(sx-.5)*5.0;
    // Depth shares the server's table coordinate, so the resting blade sits
    // behind the near edge and the net stop is the same in both cameras.
    const viewDepth=side===0?1-smooth.depths[player]:smooth.depths[player];
    const baseZ=(viewDepth-.5)*8;
    paddles[player].position.z=baseZ;
    const reach=pongReachFromDepth(smooth.depths[player],player);
    if(reach>.985&&!touchingNet[player]){
     touchingNet[player]=true;
     const options=player===side?[-Math.PI,0]:[0,Math.PI];
     netHorizontalAngle[player]=options.reduce((best,angle)=>
      Math.abs(angle-paddles[player].rotation.z)<Math.abs(best-paddles[player].rotation.z)?angle:best);
    }else if(reach<.90)touchingNet[player]=false;
    // A small motion lean sits on top of the deliberate center-to-edge pose.
    const horizontalSpeed=(sx-previousScreenX[player])/Math.max(dt,.001);
    previousScreenX[player]=sx;
    const targetLean=player===side?localLeanMomentum:
     THREE.MathUtils.clamp(-horizontalSpeed*.32,-.38,.38);
    paddleLean[player]=THREE.MathUtils.lerp(paddleLean[player],targetLean,1-Math.exp(-14*dt));
    const localPower=player===side?localSwipePreview*
     THREE.MathUtils.clamp(1-(now-localSwipePreviewAt)/500,0,1):0;
    const power=Math.max(next.swipe[player],localPower);
    const prediction=predictPongContact(next.ball,player,next.depths[player]);
    const near=prediction?THREE.MathUtils.clamp((.9-prediction.eta)/.75,0,1):0;
    const aimedBall=prediction?{y:prediction.y,h:prediction.h}:next.ball;
    const livePose=pongContactPose(aimedBall,player,smooth.paddles[player],power);
    const pose=strikePose[player];
    const progress=THREE.MathUtils.clamp((now-strikeAt[player])/480,0,1);
    const swing=strikeAt[player]>0&&progress<1?Math.sin(Math.PI*progress):0;
    const motion=strikeAt[player]>0&&progress<1?
     pongSwingMotion(pose,progress,lastPaddlePower[player]):null;
    // Low balls rise, high balls drive down, and wide balls are met with a
    // side step, wrist turn and blade angle rather than another forward swipe.
    paddles[player].position.x+=motion?.side??0;
    // Move the blade forward without tipping its face toward the tabletop.
    // Small contact adjustments are enough to suggest a low or high stroke.
    const targetPitch=livePose.pitch*near*.08+(motion?.pitch??0)*.12;
    paddles[player].rotation.x=THREE.MathUtils.lerp(paddles[player].rotation.x,
     THREE.MathUtils.clamp(targetPitch,-.18,.18),1-Math.exp(-20*dt));
    const targetYaw=livePose.yaw*near*.3+(motion?.yaw??0)*.2;
    paddles[player].rotation.y=THREE.MathUtils.lerp(paddles[player].rotation.y,
     THREE.MathUtils.clamp(targetYaw,-.35,.35),1-Math.exp(-16*dt));
    // At the net stop the blade turns across the table. Keep that direction
    // latched while touching the net so small sideways movements cannot flip it.
    const targetSideLean=touchingNet[player]?netHorizontalAngle[player]:
     paddleSideAngle(sx,player===side)+paddleLean[player]*.22+
     livePose.lean*near*.25+(motion?.roll??0);
    paddles[player].rotation.z=THREE.MathUtils.lerp(paddles[player].rotation.z,
     targetSideLean,1-Math.exp(-16*dt));
    // Project the full racket, including its handle, onto the net normal.
    // The 3D swing stops before the mesh can pass through the net plane.
    paddleRotationMatrix.makeRotationFromEuler(paddles[player].rotation);
    const m=paddleRotationMatrix.elements,size=player===side?.9:.74;
    const racketDepth=size*(1.515*Math.abs(m[2])+.635*Math.abs(m[6])+.041*Math.abs(m[10]));
    const netClearance=.09+racketDepth;
    const proposedZ=baseZ+(player===side?-1:1)*(motion?.forward??0);
    paddles[player].position.z=player===side?
     Math.max(netClearance,proposedZ):Math.min(-netClearance,proposedZ);
    const targetY=THREE.MathUtils.lerp(.62,livePose.height+livePose.high*.26,near*.88);
    const contactY=THREE.MathUtils.lerp(targetY,pose.height,swing*.55);
    const bladeVertical=size*(.665*Math.abs(m[1])+.635*Math.abs(m[5])+.041*Math.abs(m[9]));
    const clearTableY=.22+bladeVertical;
    const minY=Math.max(clearTableY,touchingNet[player] ? .90 : 0);
    paddles[player].position.y=Math.max(minY,
     THREE.MathUtils.lerp(paddles[player].position.y,
      Math.max(contactY+(motion?.vertical??0),minY),1-Math.exp(-15*dt)));
    if(player===side){
      host!.parentElement?.style.setProperty("--swipe-power",String(power));
      host!.dataset.power=power.toFixed(2);
      host!.dataset.dragging=down?"true":"false";
      host!.dataset.swinging=swing>0?"true":"false";
      host!.dataset.swingKind=swing>0?pose.kind:"idle";
      host!.dataset.paddleYaw=paddles[player].rotation.y.toFixed(3);
      host!.dataset.paddlePitch=paddles[player].rotation.x.toFixed(3);
      host!.dataset.paddleHeight=paddles[player].position.y.toFixed(3);
      host!.dataset.paddleTableClearance=clearTableY.toFixed(3);
      host!.dataset.paddleZ=paddles[player].position.z.toFixed(3);
      host!.dataset.netClearance=netClearance.toFixed(3);
      host!.dataset.paddleBaseZ=baseZ.toFixed(3);
      host!.dataset.netContact=touchingNet[player]?"true":"false";
      host!.dataset.paddleRoll=paddles[player].rotation.z.toFixed(3);
      host!.dataset.paddleSwingX=(motion?.side??0).toFixed(3);
    }
    host!.dataset[player===side?"selfPaddleX":"opponentPaddleX"]=sx.toFixed(3);
    host!.dataset[player===side?"selfPaddleReach":"opponentPaddleReach"]=
     pongReachFromDepth(smooth.depths[player],player).toFixed(3);
    host!.dataset[player===side?"selfPaddleTilt":"opponentPaddleTilt"]=paddleLean[player].toFixed(3);
   }
   const projected=toView(smooth.x,smooth.y);
   const worldX=(projected.x-.5)*5.0;
   const worldZ=(projected.y-.5)*8.0;
   const physicalHeight=.31+(smooth.h-.09)*2.8;
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
   // draws predictions; collisions, points and swipe power remain authoritative.
   let px=next.ball.x,py=next.ball.y,ph=next.ball.h,pvh=next.ball.vh;
   let pvx=next.ball.vx,pvy=next.ball.vy,pSpin=next.ball.sideSpin??0;
   trajectory.forEach((dot,i)=>{
    dot.visible=Math.abs(pvx)>.05;
    if(!dot.visible)return;
    const step=.075;
    const prev=px;
    px+=pvx*step;pvy+=pSpin*step;py+=pvy*step;
    pSpin*=Math.exp(-.38*step);pvh-=2.20*step;ph+=pvh*step;
    if(ph<.09){
     if(px<0||px>1||py<0||py>1){
      if(ph<=-.17){dot.visible=false;return;}
     }else{ph=.09;pvh=Math.max(.90,-pvh*.9);pSpin*=.6;}
    }
    if((prev-.5)*(px-.5)<=0&&py>=0&&py<=1&&ph<.26){dot.visible=false;return;}
    const pos=toView(px,py);
    dot.position.set((pos.x-.5)*5,.31+(ph-.09)*2.8,(pos.y-.5)*8);
   });
   shadow.visible=next.ball.x>=0&&next.ball.x<=1&&next.ball.y>=0&&next.ball.y<=1;
   shadow.position.set(worldX,.189,worldZ);
   host!.dataset.ballX=projected.x.toFixed(3);host!.dataset.ballY=projected.y.toFixed(3);
   host!.dataset.renderer="three";host!.dataset.drawCalls=String(renderer.info.render.calls);
   host!.dataset.ballHeight=next.ball.h?.toFixed(3)??"0";
   const ownReach=pongReachFromDepth(smooth.depths[side],side);
   host!.parentElement!.dataset.farBack=ownReach<-.20?"true":"false";
   const ownScreenX=side===0?smooth.paddles[side]:1-smooth.paddles[side];
   const lateral=(ownScreenX-.5)*5*.68;
   const wide=THREE.MathUtils.smoothstep(Math.abs(ownScreenX-.5),.20,.60);
   const cameraBlend=1-Math.exp(-5*dt);
   camera.position.x=THREE.MathUtils.lerp(camera.position.x,lateral*1.45*wide,cameraBlend);
   cameraFocusX=THREE.MathUtils.lerp(cameraFocusX,lateral*.38*wide,cameraBlend);
   camera.position.z=THREE.MathUtils.lerp(camera.position.z,
    11-(ownReach<0?5:3.1)*ownReach+Math.abs(lateral)*.85*wide,cameraBlend);
   camera.position.y=THREE.MathUtils.lerp(camera.position.y,6.35-.45*ownReach,cameraBlend);
   cameraFocusZ=THREE.MathUtils.lerp(cameraFocusZ,
    ownReach<0?.35-2.6*ownReach:.35-.55*ownReach,cameraBlend);
   camera.lookAt(cameraFocusX,.12,cameraFocusZ);
   host!.dataset.cameraX=camera.position.x.toFixed(3);
   host!.dataset.cameraFocusX=cameraFocusX.toFixed(3);
   host!.dataset.cameraZ=camera.position.z.toFixed(3);
   host!.dataset.serveCountdown=String(next.serveCountdown);
   host!.dataset.servePending=next.serving?"true":"false";
   renderer.render(scene,camera);
   if(!readySent&&paddleModelReady){
    readySent=true;host!.dataset.sceneReadySent="true";readyCallback.current();
   }
  }
  raf=requestAnimationFrame(frame);
  return()=>{
   alive=false;cancelAnimationFrame(raf);observer.disconnect();
   if(sendTimer!==null)clearTimeout(sendTimer);
   if(down)dragCallback.current(false);
   host.removeEventListener("pointerdown",onDown);host.removeEventListener("pointermove",onMove);
   host.removeEventListener("pointerup",onUp);host.removeEventListener("pointercancel",onUp);
   scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});
   renderer.dispose();renderer.domElement.remove();
   initialized.current=false;
  };
 },[side]);
 return <div ref={mount} className="pong-scene-3d" role="img"
  aria-label="3D ping pong table. Drag the paddle toward the ball to strike"
  data-perspective={side===0?"side-0-bottom":"side-1-bottom"}/>;
}
