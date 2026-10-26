import * as THREE from "three";
import {CharacterActor} from "../../src/CharacterActor";
import type {CharacterAction} from "../../src/CharacterActor";
const host=document.querySelector<HTMLElement>("#studio")!;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setClearColor("#29213f");host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight("#e7ddff","#686087",1.8));
for(const [x,y,z,color,intensity] of [[-3,6,6,"#ffe6d6",2.3],[4,4,-3,"#a5b8ff",2.4]] as const){
 const l=new THREE.DirectionalLight(color,intensity);l.position.set(x,y,z);scene.add(l);
}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:"#302642",roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);
const shadows:THREE.Mesh[]=[];
for(const x of [-1.08,1.08]){
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.70,32),new THREE.MeshBasicMaterial({color:"#171126",transparent:true,opacity:.4}));shadow.rotation.x=-Math.PI/2;shadow.position.set(x,.002,0);scene.add(shadow);shadows.push(shadow);
}
const female=new CharacterActor(1),male=new CharacterActor(0);const actors=[female,male];actors.forEach(a=>scene.add(a.group));
const camera=new THREE.PerspectiveCamera(32,1,.1,100);
const action=document.querySelector<HTMLSelectElement>("#action")!,character=document.querySelector<HTMLSelectElement>("#character")!,view=document.querySelector<HTMLSelectElement>("#view")!,seated=document.querySelector<HTMLInputElement>("#seated")!;
let paused=false,elapsed=0,previous=performance.now(),frames:number[]=[];
function layout(){
 if(view.value==="first-person-rps"){location.assign(`/assets/characters/first-person-rps.html?character=${character.value==="male"?"male":"female"}`);return;}
 if(view.value==="first-person"){location.assign(`/assets/characters/first-person.html?character=${character.value==="male"?"male":"female"}&look=down`);return;}
 const pair=character.value==="pair";female.group.visible=pair||character.value==="female";male.group.visible=pair||character.value==="male";
 actors.forEach((a,i)=>{a.group.position.x=pair?(i===0?-1.08:1.08):0;shadows[i].position.x=a.group.position.x;shadows[i].visible=a.group.visible;});
 const target=new THREE.Vector3(0,1.58,0),r=pair?9.1:7.2;
 camera.position.set(view.value==="side"?r:view.value==="three-quarter"?r*.46:0,2.85,view.value==="back"?-r:view.value==="side"?0:r);
 if(view.value==="hand"){
  const actor=character.value==="male"?male:female;
  actor.group.updateMatrixWorld(true);const hand=actor.bones.get("handR");
  if(hand){hand.getWorldPosition(target);target.y+=.07;camera.position.copy(target).add(new THREE.Vector3(0,.04,1.30));}
 }
 camera.lookAt(target);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight,false);
}
new ResizeObserver(layout).observe(host);character.onchange=view.onchange=layout;
action.onchange=()=>actors.forEach(a=>{
 a.play(action.value as CharacterAction,false,true);
 if(paused)for(let i=0;i<6;i++)a.update(.04,elapsed,{seated:seated.checked});
});
document.querySelector<HTMLButtonElement>("#replay")!.onclick=()=>{
 elapsed=0;paused=false;document.querySelector<HTMLButtonElement>("#pause")!.textContent="Pause";
 actors.forEach(a=>a.play(action.value as CharacterAction,false,true));
};
document.querySelector<HTMLButtonElement>("#pause")!.onclick=e=>{paused=!paused;(e.currentTarget as HTMLButtonElement).textContent=paused?"Play":"Pause";};
await Promise.all(actors.map(a=>a.ready));
for(const c of female.clips){const option=document.createElement("option");option.value=c.name;option.textContent=c.name==="VictoryDance"?"Victory dance":c.name;action.append(option);}
const requestedAction=new URLSearchParams(location.search).get("action");
if(requestedAction&&female.clips.some(c=>c.name===requestedAction)){
 action.value=requestedAction;actors.forEach(a=>a.play(requestedAction as CharacterAction));
}
layout();document.body.dataset.ready="true";
function render(now:number){
 const dt=Math.min(.05,(now-previous)/1000);previous=now;
 if(!paused){elapsed+=dt;actors.forEach(a=>a.update(dt,elapsed,{seated:seated.checked}));}
 const start=performance.now();renderer.render(scene,camera);frames.push(performance.now()-start);if(frames.length>120)frames.shift();
 document.querySelector("#stats")!.textContent=`${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.render.calls} draw calls · ${renderer.info.memory.geometries} geometries · ${action.value}`;
 requestAnimationFrame(render);
}requestAnimationFrame(render);
Object.assign(window,{characterReview:{actors,scene,renderer,camera,layout,setPaused:(v:boolean)=>{paused=v;},sample:(name:CharacterAction,u:number)=>{
 actors.forEach(a=>{a.play(name,false,true);for(let i=0;i<3;i++)a.update(.1,0);const internal=a as unknown as {mixer:THREE.AnimationMixer;current:THREE.AnimationAction};
 internal.current.paused=false;internal.current.enabled=true;internal.current.time=internal.current.getClip().duration*u;a.update(0,0,{seated:seated.checked});});scene.updateMatrixWorld(true);renderer.render(scene,camera);
},metrics:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:renderer.info.memory,medianSubmitMs:[...frames].sort((a,b)=>a-b)[Math.floor(frames.length/2)]})}});
