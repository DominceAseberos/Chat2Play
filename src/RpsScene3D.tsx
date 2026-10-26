import {useEffect,useRef} from "react";
import * as THREE from "three";
import {CharacterActor,type CharacterAction} from "./CharacterActor";
import {FirstPersonController} from "./FirstPersonController";
import type {Choice,Side} from "./Pieces";
import {RPS_BEAT_MS,RPS_CHANT_MS,RPS_REVEAL_MS} from "./rpsTiming";
import {createRpsStage} from "./rpsStage";
import {RpsSignIcon} from "./RpsSignIcon";

type View="pov"|"arena";
type Props={side:Side;view:View;ownChoice:Choice|null;
 reveal?:{choices:[Choice|null,Choice|null];winner:Side|"draw"};
 gameId:string;round:number;stage?:"choosing"|"chant"|"reveal";
 chantEndsAt?:number;revealEndsAt?:number;pauseAt?:number;onReady:()=>void};

/** One match world. Both cameras render the same opponent, floor and podiums. */
export default function RpsScene3D({side,view,ownChoice,reveal,gameId,round,stage,chantEndsAt,revealEndsAt,pauseAt,onReady}:Props){
 const mount=useRef<HTMLDivElement>(null);
 const state=useRef({view,reveal,round,stage,chantEndsAt,revealEndsAt,pauseAt});
 const onReadyRef=useRef(onReady);
 useEffect(()=>{state.current={view,reveal,round,stage,chantEndsAt,revealEndsAt,pauseAt};onReadyRef.current=onReady;},
  [view,reveal,round,stage,chantEndsAt,revealEndsAt,pauseAt,onReady]);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"low-power"});}
  catch{host.dataset.fallback="true";onReadyRef.current();return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.3));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.style.cssText="width:100%;height:100%;display:block;";
  renderer.domElement.setAttribute("aria-hidden","true");host.appendChild(renderer.domElement);

  const scene=new THREE.Scene();
  const opponentZ=-3.85,arenaMidZ=opponentZ/2;
  const disposeStage=createRpsStage(scene,[{x:0,z:0},{x:0,z:opponentZ}]);
  // Camera layers keep the local first-person arms and full body in the same
  // scene. Only the active camera decides which representation it sees.
  scene.traverse(object=>{if(object instanceof THREE.Light){object.layers.enable(1);object.layers.enable(2);}});
  const povCamera=new THREE.PerspectiveCamera(84,1,.025,80);
  povCamera.layers.enable(1);
  const arenaCamera=new THREE.PerspectiveCamera(44,1,.1,70);
  arenaCamera.layers.enable(2);
  const self=new FirstPersonController(scene,povCamera,side);
  const local=new CharacterActor(side),opponent=new CharacterActor(side===0?1:0);
  local.group.position.set(0,.05,0);local.group.rotation.y=Math.PI;
  opponent.group.position.set(0,.05,opponentZ);
  scene.add(local.group,opponent.group);
  const signs=[host.querySelector<HTMLElement>('[data-sign-slot="0"]'),host.querySelector<HTMLElement>('[data-sign-slot="1"]')];
  const signPoint=new THREE.Vector3();
  const resize=()=>{
   const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
   renderer.setSize(w,h,false);
   povCamera.aspect=w/h;povCamera.updateProjectionMatrix();
   arenaCamera.aspect=w/h;
   const halfFov=Math.tan(THREE.MathUtils.degToRad(arenaCamera.fov/2));
   const distance=Math.max(9.8,2.82/(halfFov*arenaCamera.aspect));
   arenaCamera.position.set(distance,3.45,arenaMidZ);
   arenaCamera.lookAt(0,1.65,arenaMidZ);arenaCamera.updateProjectionMatrix();
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const drag={id:-1,x:0,y:0};
  const down=(event:PointerEvent)=>{if(state.current.view!=="pov"||drag.id!==-1)return;
   drag.id=event.pointerId;drag.x=event.clientX;drag.y=event.clientY;renderer.domElement.setPointerCapture(event.pointerId);};
  const move=(event:PointerEvent)=>{if(drag.id!==event.pointerId)return;
   self.setLook(self.lookYaw-(event.clientX-drag.x)*.004,self.lookPitch-(event.clientY-drag.y)*.004);
   drag.x=event.clientX;drag.y=event.clientY;};
  const up=(event:PointerEvent)=>{if(drag.id===event.pointerId)drag.id=-1;};
  renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",move);
  renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointercancel",up);
  let alive=true,loaded=false,readySent=false,inView=true,raf=0,lastPaint=0;
  let lastRound=-1,lastPumpBeat=-1,lastReveal="",localRevealTime=0;
  const visibility=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;},{threshold:.01});
  visibility.observe(host);
  void Promise.all([self.ready,local.ready,opponent.ready]).then(()=>{
   if(!alive)return;
   self.rpsMode=true;self.actor.setFirstPersonHandsOnly(true);self.reset();self.setLook(0,-.58,true);
   self.actor.group.traverse(object=>object.layers.set(1));
   local.group.traverse(object=>object.layers.set(2));
   loaded=true;host.dataset.characterSource="blender-glb";
  }).catch(()=>{
   if(!alive)return;host.dataset.assetError="true";host.dataset.fallback="true";
   const message=document.createElement("p");message.role="alert";
   message.textContent="Characters could not load. Please reopen the game to retry.";
   host.appendChild(message);onReadyRef.current();
  });
  function animate(now:number){
   if(!alive)return;raf=requestAnimationFrame(animate);
   if(!inView){lastPaint=now;return;}
   if(now-lastPaint<32)return;
   const current=state.current,paused=Boolean(current.pauseAt);
   const dt=paused?0:Math.min(.05,(now-lastPaint)/1000||0);lastPaint=now;
   if(!loaded)return;
   const shown=current.reveal,effectiveNow=current.pauseAt||Date.now();
   if(current.round!==lastRound){
    lastRound=current.round;lastReveal="";lastPumpBeat=-1;localRevealTime=0;
    self.reset();self.setLook(0,-.58,true);
   }
   const chant=current.stage==="chant";
   const chantElapsed=chant?Math.max(0,Math.min(RPS_CHANT_MS,RPS_CHANT_MS-((current.chantEndsAt??effectiveNow)-effectiveNow))):0;
   const pumping=chant&&(current.chantEndsAt??0)-effectiveNow<=RPS_CHANT_MS;
   const beat=pumping?Math.min(1,Math.floor(chantElapsed/RPS_BEAT_MS)):-1;
   const progress=pumping?(chantElapsed-beat*RPS_BEAT_MS)/RPS_BEAT_MS:0;
   if(pumping)self.setRpsPump(beat,progress);
   const revealKey=shown?`${current.round}:${shown.choices.join(":")}`:"";
   if(revealKey&&revealKey!==lastReveal){
    lastReveal=revealKey;localRevealTime=0;
    const localChoice=shown?.choices[side];
    if(localChoice)self.throwRps(localChoice);
    else {self.reset();self.setLook(0,-.58,true);}
   }
   const elapsed=shown?Math.max(0,(RPS_REVEAL_MS-((current.revealEndsAt??effectiveNow)-effectiveNow))/1000):0;
   if(shown)localRevealTime+=dt;
   const visualElapsed=Math.min(elapsed,.4+localRevealTime);
   if(shown?.choices[side])self.syncRpsClock(visualElapsed);
   self.update(dt,now/1000);
   for(const [i,model] of [local,opponent].entries()){
    const player=i===0?side:(side===0?1:0),choice=shown?.choices[player];
    const outcome=shown?(shown.winner==="draw"?"draw":shown.winner===player?"win":"lose"):"idle";
    const gesture:CharacterAction=choice==="rock"?"Rock":choice==="paper"?"Paper":"Scissors";
    const action:CharacterAction=pumping?"RPSPump":!shown?"RPSAnticipation":visualElapsed<.5?"Throw":
     visualElapsed<1.2?gesture:outcome==="win"?"VictoryDance":outcome==="lose"?"Lose":gesture;
    model.play(action,action==="Throw",pumping&&beat!==lastPumpBeat);
    if(pumping)model.seekCurrentNormalized(progress);
    model.update(dt,now/1000);
    host!.dataset[`bodyAction${i}`]=action;
   }
   lastPumpBeat=pumping?beat:-1;
   arenaCamera.updateMatrixWorld();
   signs.forEach((sign,i)=>{
    if(!sign)return;
    signPoint.set(0,3.42,i===0?0:opponentZ).project(arenaCamera);
    sign.style.left=`${(signPoint.x+1)*50}%`;
    sign.style.top=`${(1-signPoint.y)*50}%`;
   });
   const activeCamera=current.view==="pov"?povCamera:arenaCamera;
   host!.dataset.view=current.view;
   host!.dataset.action0=current.view==="pov"?self.actor.action:local.action;
   host!.dataset.action1=opponent.action;
   host!.dataset.phase=chant?"chant":current.view==="pov"?self.rpsPhase:shown?"revealed":"choosing";
   host!.dataset.beat=pumping?String(beat+1):shown?"3":"";
   host!.dataset.result=shown?.winner==="draw"?"draw":shown?shown.winner===side?"win":"lose":"waiting";
   renderer.render(scene,activeCamera);
   host!.dataset.renderer="three";host!.dataset.drawCalls=String(renderer.info.render.calls);
   host!.dataset.triangles=String(renderer.info.render.triangles);
   if(!readySent&&host!.getBoundingClientRect().width>10){readySent=true;onReadyRef.current();}
  }
  raf=requestAnimationFrame(animate);
  return()=>{
   alive=false;cancelAnimationFrame(raf);observer.disconnect();visibility.disconnect();
   renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);
   renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",up);
   self.dispose();local.dispose();opponent.dispose();disposeStage();renderer.dispose();renderer.domElement.remove();
  };
 },[side,gameId]);
 return <div className={"rps-scene-3d "+(view==="pov"?"rps-scene-pov":"rps-scene-arena")} ref={mount} role="img"
  aria-label={view==="pov"?"First-person view of one Rock Paper Scissors arena":"Side camera showing both players facing each other in the same arena"}>
  {([0,1] as const).map(i=>{
   const player=i===0?side:(side===0?1:0);
   const choice=reveal?reveal.choices[player]:i===0?ownChoice:null;
   return <div key={i} className="rps-arena-sign" data-sign-slot={i} data-choice={choice??""}
    hidden={view!=="arena"||!choice} aria-label={choice?`${choice} sign`:undefined}>
    {choice&&<RpsSignIcon choice={choice} size={74}/>}
   </div>;
  })}
 </div>;
}
