import * as THREE from "three";

/** The same lighting, floor, and podiums in both RPS cameras. */
export function createRpsStage(scene:THREE.Scene,platforms:{x:number;z:number}[]){
 scene.background=new THREE.Color("#f6f3f0");
 scene.add(new THREE.HemisphereLight("#fff0eb","#7d6f96",1.8));
 const key=new THREE.DirectionalLight("#ffe1cd",2.2);key.position.set(-4,7,3);scene.add(key);
 const rim=new THREE.DirectionalLight("#b6b8ff",1.8);rim.position.set(4,5,-5);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(28,28),new THREE.MeshStandardMaterial({color:"#b9a9c4",roughness:1}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-.12;scene.add(floor);
 const podiums=platforms.map(({x,z})=>{
  const podium=new THREE.Mesh(new THREE.CylinderGeometry(.86,.96,.12,12),new THREE.MeshStandardMaterial({color:"#a98bb6",roughness:.8}));
  podium.position.set(x,-.025,z);scene.add(podium);return podium;
 });
 return ()=>{
  floor.geometry.dispose();(floor.material as THREE.Material).dispose();
  podiums.forEach(podium=>{podium.geometry.dispose();(podium.material as THREE.Material).dispose();});
 };
}
