import * as THREE from "three";
import {FirstPersonController,type RpsChoice} from "../../src/FirstPersonController";

const params=new URLSearchParams(location.search),host=document.querySelector<HTMLElement>("#world")!;
const character=document.querySelector<HTMLSelectElement>("#character")!;
character.value=params.get("character")==="male"?"male":"female";
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:"low-power"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.outputColorSpace=THREE.SRGBColorSpace;host.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color("#f6f3f0");
scene.add(new THREE.HemisphereLight("#fff0eb","#7d6f96",1.8));
for(const [x,y,z,color,power] of [[-4,7,3,"#ffe1cd",2.2],[4,5,-5,"#b6b8ff",1.8]] as const){const light=new THREE.DirectionalLight(color,power);light.position.set(x,y,z);scene.add(light);}
const camera=new THREE.PerspectiveCamera(84,1,.025,80);
const self=character.value==="male"?0:1,controller=new FirstPersonController(scene,camera,self);
const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight,false);};new ResizeObserver(resize).observe(host);resize();
let selected:RpsChoice="paper",manual=false,elapsed=0,previous=performance.now(),stopped=false;
const choiceButtons=[...document.querySelectorAll<HTMLButtonElement>("[data-choice]")],throwButton=document.querySelector<HTMLButtonElement>("#throw")!,status=document.querySelector<HTMLOutputElement>("#status")!;
function select(choice:RpsChoice){if(controller.throwing)return;selected=choice;choiceButtons.forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.choice===choice)));}
function startThrow(){
 if(!controller.throwRps(selected))return false;
 controller.setLook(0,-.88);paint(0);return true;
}
choiceButtons.forEach(button=>button.onclick=()=>select(button.dataset.choice as RpsChoice));throwButton.onclick=startThrow;
document.querySelector<HTMLButtonElement>("#reset")!.onclick=()=>{controller.reset();paint(0);};
character.onchange=()=>{const url=new URL(location.href);url.searchParams.set("character",character.value);location.assign(url);};
window.addEventListener("keydown",event=>{
 if(event.target instanceof HTMLElement&&event.target.closest("button,select,a,input"))return;
 const choices:Record<string,RpsChoice>={Digit1:"rock",Digit2:"paper",Digit3:"scissors"};
 if(choices[event.code]){event.preventDefault();select(choices[event.code]);}
 if(event.code==="Space"){event.preventDefault();startThrow();}
});
const drag={id:-1,x:0,y:0};
renderer.domElement.addEventListener("pointerdown",event=>{if(drag.id!==-1)return;drag.id=event.pointerId;drag.x=event.clientX;drag.y=event.clientY;renderer.domElement.setPointerCapture(event.pointerId);});
renderer.domElement.addEventListener("pointermove",event=>{if(drag.id!==event.pointerId)return;controller.setLook(controller.lookYaw-(event.clientX-drag.x)*.004,controller.lookPitch-(event.clientY-drag.y)*.004);drag.x=event.clientX;drag.y=event.clientY;});
const release=(event:PointerEvent)=>{if(drag.id===event.pointerId)drag.id=-1;};
renderer.domElement.addEventListener("pointerup",release);renderer.domElement.addEventListener("pointercancel",release);window.addEventListener("blur",()=>{drag.id=-1;});
function paint(dt:number){
 elapsed+=dt;controller.update(dt,elapsed);
 const phase=controller.rpsPhase;
 renderer.render(scene,camera);
 const label=phase==="ready"?"Ready to throw":phase==="windup"?"Wind up…":phase==="throw"?"Throw…":`You threw ${controller.rpsChoice}`;
 if(status.textContent!==label)status.textContent=label;
 throwButton.disabled=controller.throwing;throwButton.textContent=controller.throwing?"Throwing…":phase==="revealed"?"Throw again":"Throw";
 choiceButtons.forEach(button=>button.disabled=controller.throwing);
 document.body.dataset.phase=phase;document.body.dataset.choice=controller.rpsChoice??"";document.body.dataset.action=controller.actor.action;
}
try{
 await controller.ready;controller.rpsMode=true;controller.actor.setFirstPersonHandsOnly(true);controller.reset();camera.zoom=1.5;controller.update(0,0);paint(0);
 document.querySelector<HTMLElement>("#loading")!.hidden=true;document.body.dataset.ready="true";
}catch(error){document.querySelector<HTMLElement>("#loading")!.textContent="The characters could not load. Please reload to retry.";throw error;}
function frame(now:number){if(stopped)return;requestAnimationFrame(frame);if(manual||document.hidden){previous=now;return;}if(now-previous<1000/30)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;paint(dt);}requestAnimationFrame(frame);
window.addEventListener("beforeunload",()=>{stopped=true;controller.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>material.dispose());}});renderer.dispose();});
Object.assign(window,{firstPersonRps:{controller,scene,camera,renderer,setManual:(value:boolean)=>{manual=value;},select,throw:startThrow,step:paint}});
