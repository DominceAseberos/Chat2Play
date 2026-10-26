import {useEffect,useRef} from "react";
import * as THREE from "three";
import type {Game,Side} from "./Pieces";

type Pong=NonNullable<Game["pong"]>;
type Props={side:Side;snapshot:Pong;onPaddle:(value:number)=>void;
 onCharge:(holding:boolean)=>void;onReady:()=>void;active:boolean;outcome?:"win"|"lose"|"draw"|null};

// Compact versions of the two Pinoy Henyo character designs. The distinctive
// blue hoodie and pink overalls/hair bow are retained, while geometry stays
// light enough to run alongside the server-authoritative Pong simulation.
function arenaAvatar(which:Side){
 const g=new THREE.Group(),blue=which===0;
 const skin=blue?"#e9c3a4":"#ffd8bf",hair=blue?"#403b61":"#84536c";
 const clothing=blue?"#7bb5ed":"#ef9eaf",pants=blue?"#535b9a":"#8f77ad";
 function orb(color:string,r:number,x:number,y:number,z:number,sx=1,sy=1,sz=1){
  const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),
   new THREE.MeshStandardMaterial({color,flatShading:true,roughness:.83}));
  mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);g.add(mesh);return mesh;
 }
 const body=orb(clothing,.56,0,.89,0,1.12,1.1,.74);
 const head=new THREE.Group();head.position.y=1.7;g.add(head);
 const addHead=(color:string,r:number,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{
  const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),
   new THREE.MeshStandardMaterial({color,flatShading:true,roughness:.83}));
  mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);head.add(mesh);return mesh;
 };
 addHead(skin,.55,0,0,0,1,1,.84);
 addHead(hair,.53,0,.31,-.07,1.04,.48,.90);
 if(!blue){addHead(hair,.23,-.47,.03,-.05,.72,1.5,.88);
  addHead("#ffe49a",.13,.31,.51,.22,1.4,.69,.65);}
 else addHead(hair,.18,-.33,.40,.29,1.2,.65,.90);
 for(const x of [-.19,.19])addHead("#36314e",.064,x,.01,.455,1,1.3,.54);
 const mouth=addHead("#965f75",.065,0,-.23,.458,1.2,.48,.3);
 const hands=[] as THREE.Mesh[];
 for(const x of [-.59,.59]){
  hands.push(orb(skin,.17,x,.71,.31,1,.98,.86));
  orb(pants,.24,x*.50,.27,.13,.9,1,.9);
  orb(blue?"#ede3fb":"#ad7298",.19,x*.53,.10,.31,1.15,.54,1.45);
 }
 g.userData.avatarVariant=which;
 return {group:g,head,hands,mouth,body};
}
// Server continues to simulate canonical sideways Pong; only the camera
// transforms coordinates for the local player.
export default function PongScene3D({side,snapshot,onPaddle,onCharge,onReady,active,outcome}:Props){
 const mount=useRef<HTMLDivElement>(null);
 const latest=useRef(snapshot),send=useRef(onPaddle),chargeCallback=useRef(onCharge),
 readyCallback=useRef(onReady),activeRef=useRef(active),resultRef=useRef(outcome);
 const initialized=useRef(false);
 useEffect(()=>{latest.current=snapshot;send.current=onPaddle;chargeCallback.current=onCharge;
  readyCallback.current=onReady;activeRef.current=active;resultRef.current=outcome;},[snapshot,onPaddle,onCharge,onReady,active,outcome]);
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
  // Decorative studio without an audience, low draw call count.
  box(20,.15,25,"#1c1b38",0,-.62,0);
  for(const x of [-3.6,3.6]){
   box(.22,2.8,.26,"#41416e",x,.7,-3.5);
   box(.13,2.6,.10,x<0?"#89edec":"#d59ff4",x,.75,-3.36);
   for(const z of [-4.2,0,4.2]){
    box(.15,.09,1.15,x<0?"#61dbe7":"#c5a9ed",x,.10,z);
   }
  }
  // Keep overhead rigging behind the court; never cross the playable table
  // in screen-space (especially on a tall, steep mobile camera).
  for(const z of [-5.4,-4.5]){
   box(7.5,.10,.15,"#514e7e",0,3.1,z);
   for(const x of [-2.3,0,2.3]){
    const lamp=new THREE.Mesh(new THREE.IcosahedronGeometry(.16,1),
     new THREE.MeshBasicMaterial({color:x===0?"#e3c6ff":"#83e5f7"}));
    lamp.position.set(x,2.9,z);scene.add(lamp);
   }
  }
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
  const buildPaddle=(color:string,own:boolean)=>{
   const g=new THREE.Group();
   const core=new THREE.Mesh(new THREE.BoxGeometry(1.20,.21,.35),material(color,.18,.27));
   g.add(core);
   const edge=new THREE.Mesh(new THREE.BoxGeometry(1.24,.06,.38),
    new THREE.MeshBasicMaterial({color:own?"#ffe4c2":"#d8cbff"}));
   edge.position.y=.14;g.add(edge);
   const grip=new THREE.Mesh(new THREE.CylinderGeometry(.085,.10,.42,7),material("#f2cd9f"));
   grip.position.set(0,-.12,.24);grip.rotation.x=Math.PI/2;g.add(grip);
   return g;
  };
  const me=buildPaddle("#ffa281",true),them=buildPaddle("#ac91ff",false);
  paddles[side]=me;paddles[side===0?1:0]=them;scene.add(me,them);
  // Both characters are visual-only: far opponent and near-side player.
  // Their poses never modify the multiplayer paddle or ball coordinates.
  const nearAvatar=arenaAvatar(side),farAvatar=arenaAvatar(side===0?1:0);
  nearAvatar.group.position.set(-2.65,-.55,2.25);
  nearAvatar.group.rotation.y=2.25;
  nearAvatar.group.scale.setScalar(.64);
  farAvatar.group.position.set(0,-.55,-5.95);
  farAvatar.group.scale.setScalar(.93);
  scene.add(nearAvatar.group,farAvatar.group);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.132,12,8),
   new THREE.MeshStandardMaterial({color:"#ffffff",roughness:.18,emissive:"#d1b9ff",emissiveIntensity:.15}));
  scene.add(ball);
  const ballLight=new THREE.PointLight("#d2c4ff",.7,3.4);scene.add(ballLight);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.18,16),
   new THREE.MeshBasicMaterial({color:"#111039",transparent:true,opacity:.28,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.193;scene.add(shadow);
  const camera=new THREE.PerspectiveCamera(42,1,.1,70);
  camera.position.set(0,7.95,10.5);camera.lookAt(0,.12,0);
  const smooth={x:.5,y:.5,h:.42,paddles:[.5,.5]},clock=new THREE.Clock();
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
 let lastHistory=0,smashAt=0,remoteSmashAt=0,remoteCharged=false,chargeLocalAt=0,readySent=false;
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
  function input(event:PointerEvent){
   if(!activeRef.current||!host)return;
   const rect=host.getBoundingClientRect();
   // x controls physical paddle position; no controls on vertical axis.
   const fraction=Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(rect.width,1)));
   const canonical=side===0?fraction:1-fraction;
   if(performance.now()-lastSent>25){lastSent=performance.now();send.current(canonical);}
  }
  const onDown=(e:PointerEvent)=>{
   if(!activeRef.current)return;
   down=true;id=e.pointerId;chargeLocalAt=performance.now();
   host.setPointerCapture(e.pointerId);input(e);chargeCallback.current(true);
 };
  const onMove=(e:PointerEvent)=>{if(down&&id===e.pointerId)input(e);};
  const onUp=(e:PointerEvent)=>{
   if(e.pointerId===id){
    down=false;id=-1;smashAt=performance.now();chargeLocalAt=0;
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
   // Lightweight character reactions: opponents celebrate on a miss, the
   // local player celebrates a win or slumps on a loss.
   for(const [i,avatar] of [nearAvatar,farAvatar].entries()){
    const who=i===0?resultRef.current:(resultRef.current==="win"?"lose":resultRef.current==="lose"?"win":"draw");
    const win=who==="win",lose=who==="lose";
    avatar.group.position.y=-.55+(win?.18+Math.abs(Math.sin(now*.010))*.14:lose?-.11:Math.sin(now*.0018+i)*.035);
    avatar.head.rotation.x=lose?.26:win?-.14:Math.sin(now*.0015+i)*.04;
    avatar.head.rotation.z=lose?(i===0?.15:-.15):Math.sin(now*.0011+i)*.025;
    avatar.hands.forEach((hand,k)=>{hand.position.y=win?1.03+Math.sin(now*.009+k)*.10:lose?.58:.71+Math.sin(now*.003+k)*.06;});
    avatar.mouth.scale.y=lose?.2:win?1.6:1;
   }
   const next=latest.current;
   const gap=Math.hypot(next.ball.x-smooth.x,next.ball.y-smooth.y);
   const blend=1-Math.exp(-19*dt);
   if(gap>.15){smooth.x=next.ball.x;smooth.y=next.ball.y;}
   else{smooth.x=THREE.MathUtils.lerp(smooth.x,next.ball.x,blend);smooth.y=THREE.MathUtils.lerp(smooth.y,next.ball.y,blend);}
   smooth.h=THREE.MathUtils.lerp(smooth.h,next.ball.h??.38,blend);
   for(const player of [0,1] as const){
    smooth.paddles[player]=THREE.MathUtils.lerp(smooth.paddles[player],next.paddles[player],1-Math.exp(-24*dt));
    const sx=side===0?smooth.paddles[player]:1-smooth.paddles[player];
    paddles[player].position.set((sx-.5)*5.0,.40,player===side?3.78:-3.78);
    paddles[player].rotation.z=(sx-.5)*-.12;
    const power=player===side&&down?Math.min(1,(now-chargeLocalAt)/1500):(next.charge?.[player]??0);
    // Detect remote release using authoritative charge/shot updates. Both
    // players see the other paddle wind up and swing.
    if(player!==side){
      if(power>.015)remoteCharged=true;
      if(remoteCharged&&power===0){remoteSmashAt=now;remoteCharged=false;}
    }
    const swing=player===side?Math.max(0,1-(now-smashAt)/430):
      Math.max(0,1-(now-remoteSmashAt)/430);
    const forward=swing>0?Math.sin(Math.PI*swing)*.92:0;
    const target=power*.70-forward;
    paddles[player].rotation.x=THREE.MathUtils.lerp(paddles[player].rotation.x,target,1-Math.exp(-24*dt));
    // Follow the incoming ball's true simulated height during the strike.
    const edge=player===0?.05:.95;
    const near=Math.abs(next.ball.x-edge)<.22;
    const targetY=near?Math.max(.34,Math.min(1.05,.32+(next.ball.h-.09)*2.0)):.40;
    paddles[player].position.y=THREE.MathUtils.lerp(paddles[player].position.y,
      targetY+power*.12+forward*.07,1-Math.exp(-15*dt));
    if(player===side){
      host!.parentElement?.style.setProperty("--charge",String(power));
      host!.dataset.power=power.toFixed(2);
      host!.dataset.swinging=swing>0?"true":"false";
    }
    host!.dataset[player===side?"selfPaddleX":"opponentPaddleX"]=sx.toFixed(3);
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
