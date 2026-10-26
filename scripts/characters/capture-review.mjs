import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=new URL('../../assets/characters/previews/',import.meta.url);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5174/assets/characters/review.html',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.characterReview&&document.body.dataset.ready==='true',null,{timeout:60000});
await page.evaluate(()=>window.characterReview.setPaused(true));
const report=await page.evaluate(()=>{
 const api=window.characterReview,results=[];
 for(const a of api.actors){
  const mesh=a.group.getObjectByProperty('isSkinnedMesh',true);
  const character=[];
  for(const clip of a.clips){
   api.sample(clip.name,.35);
   const bones=[...a.bones.values()];
   if(bones.some(b=>b.matrixWorld.elements.some(v=>!Number.isFinite(v))))throw Error('Non-finite bone transform '+clip.name);
   if(mesh.morphTargetInfluences.some(v=>!Number.isFinite(v)))throw Error('Non-finite morph '+clip.name);
   character.push({name:clip.name,duration:clip.duration,tracks:clip.tracks.length,morph:mesh.morphTargetInfluences.slice()});
  }
  results.push({character:a.group.name,bones:[...a.bones.keys()],clips:character});
 }
 return results;
});
for(const r of report)assert.equal(r.clips.length,22);
const regressions=await page.evaluate(()=>{
 const api=window.characterReview;const checks=[];
 for(const a of api.actors){
  api.sample('LookLeft',.5);const left=a.bones.get('head').matrixWorld.elements[8];
  api.sample('LookRight',.5);const right=a.bones.get('head').matrixWorld.elements[8];
  if(left<.25||right>-.25)throw Error('Head look uses wrong rotation axis');
  api.sample('Celebrate',.35);
  for(const side of ['L','R']){
   const hand=a.bones.get('hand'+side),shoulder=a.bones.get('upper_arm'+side);
   if(hand.matrixWorld.elements[13]<shoulder.matrixWorld.elements[13]+.2)throw Error('Celebration hand folds through body');
  }
  api.sample('Scissors',.5);
  const i=a.bones.get('index02R').matrixWorld.elements,m=a.bones.get('middle02R').matrixWorld.elements;
  const separation=Math.hypot(i[12]-m[12],i[13]-m[13],i[14]-m[14]);
  if(separation<.06)throw Error('Scissors fingers overlap');
  a.play('Stand');for(let k=0;k<12;k++)a.update(.03,k*.03);
  a.update(.03,5.42,{pitch:.2,yaw:.3});
  const mesh=a.group.getObjectByProperty('isSkinnedMesh',true),dict=mesh.morphTargetDictionary;
  const closed=mesh.morphTargetInfluences[dict.Blink];a.update(.03,5.8,{pitch:.2,yaw:.3});
  const reopened=mesh.morphTargetInfluences[dict.Blink];
  if(closed<.9||reopened>.01)throw Error('Blink fails to reopen');
  const q=a.bones.get('head').quaternion.clone();
  for(let k=0;k<180;k++)a.update(1/30,k/30,{pitch:.2,yaw:.3});
  const drift=q.angleTo(a.bones.get('head').quaternion);
  if(drift>.01)throw Error('Head look accumulates rotation');
  checks.push({character:a.group.name,scissorsSeparation:separation,closed,reopened,headDriftRadians:drift,leftForwardX:left,rightForwardX:right});
 }
 return checks;
});
for(const char of ['female','male']){
 await page.selectOption('#character',char);
 for(const [action,view,u] of [['Idle','front',.2],['Idle','three-quarter',.2],['Idle','side',.2],['Idle','back',.2],['Happy','front',.5],['Happy','three-quarter',.5],['Sad','front',.5],['Surprised','front',.5],['Sit','three-quarter',.5],['Celebrate','front',.3],['VictoryDance','front',.25],['Throw','three-quarter',.55],['RPSAnticipation','three-quarter',.25],['Rock','three-quarter',.5],['Paper','three-quarter',.5],['Scissors','three-quarter',.5],['Rock','hand',.5],['Paper','hand',.5],['Scissors','hand',.5]]){
  await page.selectOption('#view',view);await page.selectOption('#action',action);
  await page.evaluate(([action,u])=>window.characterReview.sample(action,u),[action,u]);
  if(view==='hand')await page.evaluate(()=>window.characterReview.layout());
  await page.locator('canvas').screenshot({path:new URL(`${char}-web-${action}-${view}.png`,output).pathname.replace(/^\/(?=[A-Za-z]:)/,'')});
 }
}
await page.selectOption('#character','pair');await page.selectOption('#view','three-quarter');await page.selectOption('#action','Happy');
await page.evaluate(()=>window.characterReview.sample('Happy',.5));
await page.locator('canvas').screenshot({path:new URL('pair-web-Happy.png',output).pathname.replace(/^\/(?=[A-Za-z]:)/,'')});
const metrics=await page.evaluate(()=>window.characterReview.metrics());
const memory=await page.evaluate(async()=>{
 const api=window.characterReview,Actor=api.actors[0].constructor;
 const baseline={...api.renderer.info.memory},cycles=[];
 for(let i=0;i<3;i++){
  const extras=[new Actor(0),new Actor(1)];await Promise.all(extras.map(a=>a.ready));
  extras.forEach(a=>{api.scene.add(a.group);a.update(.03,.03);});api.renderer.render(api.scene,api.camera);
  extras.forEach(a=>{a.dispose();a.group.removeFromParent();});api.renderer.render(api.scene,api.camera);
  const after={...api.renderer.info.memory};if(after.geometries!==baseline.geometries||after.textures!==baseline.textures)throw Error('Character GPU resources leaked');cycles.push(after);
 }
 let decodedGeometryBytes=0;
 api.actors.forEach(a=>a.group.traverse(o=>{if(!o.isSkinnedMesh)return;const g=o.geometry;
  for(const x of Object.values(g.attributes))decodedGeometryBytes+=x.array.byteLength;
  if(g.index)decodedGeometryBytes+=g.index.array.byteLength;
  for(const list of Object.values(g.morphAttributes))for(const x of list)decodedGeometryBytes+=x.array.byteLength;
 }));
 return {baseline,cycles,decodedGeometryBytes};
});
assert.equal(errors.length,0,errors.join(';'));
await fs.writeFile(new URL('../../assets/characters/validation/animation-browser.json',import.meta.url),JSON.stringify({report,regressions,metrics,memory,errors},null,2));
console.log('PASS 44 exported clip playbacks; screenshots captured',JSON.stringify(metrics));
await browser.close();
