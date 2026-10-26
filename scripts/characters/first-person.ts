import * as THREE from "three";
import {FirstPersonController,type WalkObstacle} from "../../src/FirstPersonController";
const host=document.querySelector<HTMLElement>("#world")!,params=new URLSearchParams(location.search);
const character=document.querySelector<HTMLSelectElement>("#character")!;character.value=params.get("character")==="male"?"male":"female";
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:"low-power"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color("#c9c4e1");scene.fog=new THREE.Fog("#c9c4e1",15,40);
scene.add(new THREE.HemisphereLight("#fff0e3","#78739b",1.9));const sun=new THREE.DirectionalLight("#fff0dc",2.2);sun.position.set(-5,9,6);scene.add(sun);
const material=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true});
function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y,z);scene.add(m);return m;}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),material("#bdb2d0"));floor.rotation.x=-Math.PI/2;floor.position.y=-.008;scene.add(floor);
const grid=new THREE.GridHelper(24,24,"#8f7ba5","#ab9dbe");grid.position.y=.001;scene.add(grid);
for(const x of [-10,10])box(.22,2.6,20,x,1.3,0,"#9388ab");for(const z of [-10,10])box(20,2.6,.22,0,1.3,z,"#9388ab");
const colliders:WalkObstacle[]=[];
for(const [x,z,color] of [[-4,-3,"#e390b6"],[4,-4,"#797cdb"],[-4,4,"#a791d2"],[4,4,"#6ea7bd"]] as const){
 box(1.8,.35,.65,x,.58,z,color);for(const xx of [x-.65,x+.65])box(.12,.45,.44,xx,.20,z,"#766687");
 colliders.push({minX:x-.9,maxX:x+.9,minZ:z-.325,maxZ:z+.325});
}
for(const x of [-6,6])for(const z of [-6,0,6]){
 const post=new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,2.5,8),material("#796784"));post.position.set(x,1.25,z);scene.add(post);
 const lamp=new THREE.Mesh(new THREE.IcosahedronGeometry(.24,1),new THREE.MeshBasicMaterial({color:x<0?"#ffcf88":"#a3ddf3"}));lamp.position.set(x,2.6,z);scene.add(lamp);
 colliders.push({minX:x-.18,maxX:x+.18,minZ:z-.18,maxZ:z+.18});
}
const camera=new THREE.PerspectiveCamera(74,1,.025,80),controller=new FirstPersonController(scene,camera,character.value==="male"?0:1,colliders);
const shadow=new THREE.Mesh(new THREE.CircleGeometry(.66,24),new THREE.MeshBasicMaterial({color:"#352a43",transparent:true,opacity:.16,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.003;scene.add(shadow);
const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight,false);};new ResizeObserver(resize).observe(host);resize();
const keys=new Set<string>();let autoWalk=params.get("walk")==="1",manual=false,time=0,previous=performance.now(),stopped=false;
const joy={x:0,y:0,id:-1},look={id:-1,x:0,y:0};
const walk=document.querySelector<HTMLButtonElement>("#walk")!,stick=document.querySelector<HTMLElement>("#stick")!,pad=document.querySelector<HTMLElement>("#joystick")!;
function showWalk(){walk.setAttribute("aria-pressed",String(autoWalk));walk.textContent=autoWalk?"Stop":"Walk";}
showWalk();walk.onclick=()=>{autoWalk=!autoWalk;showWalk();};
document.querySelector<HTMLButtonElement>("#down")!.onclick=()=>controller.setLook(controller.lookYaw,-1.15);
document.querySelector<HTMLButtonElement>("#ahead")!.onclick=()=>controller.setLook(controller.lookYaw,-.12);
document.querySelector<HTMLButtonElement>("#reset")!.onclick=()=>{autoWalk=false;showWalk();controller.setInput(0,0);controller.reset();keys.clear();};
character.onchange=()=>{const url=new URL(location.href);url.searchParams.set("character",character.value);location.assign(url);};
window.addEventListener("keydown",e=>{if(e.target instanceof HTMLSelectElement)return;if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowLeft","ArrowDown","ArrowRight"].includes(e.code)){keys.add(e.code);e.preventDefault();}});
window.addEventListener("keyup",e=>keys.delete(e.code));
window.addEventListener("blur",()=>{keys.clear();joy.x=joy.y=0;joy.id=look.id=-1;stick.style.transform="none";});
function joystick(e:PointerEvent){const r=pad.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,d=Math.max(1,Math.hypot(x,y)/32);joy.x=x/d/32;joy.y=-y/d/32;stick.style.transform=`translate(${joy.x*32}px,${-joy.y*32}px)`;}
pad.addEventListener("pointerdown",e=>{if(joy.id!==-1)return;joy.id=e.pointerId;pad.setPointerCapture(e.pointerId);joystick(e);e.preventDefault();});
pad.addEventListener("pointermove",e=>{if(joy.id===e.pointerId)joystick(e);});
const releaseJoy=(e:PointerEvent)=>{if(joy.id!==e.pointerId)return;joy.id=-1;joy.x=joy.y=0;stick.style.transform="none";if(pad.hasPointerCapture(e.pointerId))pad.releasePointerCapture(e.pointerId);};
pad.addEventListener("pointerup",releaseJoy);pad.addEventListener("pointercancel",releaseJoy);
renderer.domElement.addEventListener("pointerdown",e=>{if(look.id!==-1)return;look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener("pointermove",e=>{if(look.id!==e.pointerId)return;controller.setLook(controller.lookYaw-(e.clientX-look.x)*.0045,controller.lookPitch-(e.clientY-look.y)*.0045);look.x=e.clientX;look.y=e.clientY;});
const releaseLook=(e:PointerEvent)=>{if(look.id===e.pointerId)look.id=-1;};renderer.domElement.addEventListener("pointerup",releaseLook);renderer.domElement.addEventListener("pointercancel",releaseLook);
await controller.ready;if(params.get("look")==="down")controller.setLook(0,-1.15,true);controller.update(0,0);
document.querySelector<HTMLElement>("#loading")!.hidden=true;document.body.dataset.ready="true";
function paint(dt:number){
 time+=dt;const forward=(autoWalk?1:0)+joy.y+(keys.has("KeyW")||keys.has("ArrowUp")?1:0)-(keys.has("KeyS")||keys.has("ArrowDown")?1:0);
 const right=joy.x+(keys.has("KeyD")||keys.has("ArrowRight")?1:0)-(keys.has("KeyA")||keys.has("ArrowLeft")?1:0);
 controller.setInput(forward,right);controller.update(dt,time);
 shadow.position.x=controller.actor.group.position.x;shadow.position.z=controller.actor.group.position.z;
 renderer.render(scene,camera);document.querySelector("#status")!.textContent=controller.walking?"Walking":"Standing";
 document.body.dataset.action=controller.actor.action;document.body.dataset.pitch=controller.pitch.toFixed(3);document.body.dataset.yaw=controller.yaw.toFixed(3);
}
function frame(now:number){if(stopped)return;requestAnimationFrame(frame);if(manual||document.hidden){previous=now;return;}if(now-previous<1000/30)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;paint(dt);}requestAnimationFrame(frame);
window.addEventListener("beforeunload",()=>{stopped=true;controller.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();});
Object.assign(window,{firstPersonDemo:{controller,camera,scene,renderer,setManual:(v:boolean)=>{manual=v;},setWalk:(v:boolean)=>{autoWalk=v;showWalk();},step:(dt:number)=>paint(dt),lookDown:()=>{controller.setLook(controller.lookYaw,-1.15,true);paint(0);}}});
