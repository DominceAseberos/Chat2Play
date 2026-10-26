import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const dir=new URL('../../assets/characters/validation/',import.meta.url);
const file=name=>new URL(name,dir).pathname.replace(/^\/(?=[A-Za-z]:)/,'');
await fs.mkdir(file('motion-frames'),{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:800,height:960}});
 await page.goto('http://127.0.0.1:5174/assets/characters/review.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.characterReview&&document.body.dataset.ready==='true');
 await page.evaluate(()=>window.characterReview.setPaused(true));
 const report=await page.evaluate(()=>{
  const api=window.characterReview,result=[];
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const pos=b=>b.matrixWorld.elements.slice(12,15);
  const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((n,v,i)=>n+v*b[i],0))));
  for(const actor of api.actors){
   const motions=[];
   for(const action of ['Idle','Happy','RaiseArms','LowerArms','RPSAnticipation','Throw','Celebrate','NodYes','ShakeNo']){
    const samples=[];
    for(const u of [.05,.20,.40,.65,.85,.98]){
     api.sample(action,u);samples.push({u,feet:['L','R'].map(s=>pos(actor.bones.get('foot'+s))),body:['hips','spine','chest'].map(n=>actor.bones.get(n).quaternion.toArray())});
    }
    const maxFootDrift=Math.max(...samples.flatMap(s=>s.feet.map((p,i)=>distance(p,samples[0].feet[i]))));
    const bodyTravel=Math.max(...samples.map(s=>s.body.reduce((sum,q,i)=>sum+angle(q,samples[0].body[i]),0)));
    if(maxFootDrift>.010)throw Error(`${action}: planted foot drifts ${maxFootDrift}`);
    if(bodyTravel<.008)throw Error(`${action}: gesture does not carry through the body`);
    motions.push({action,maxFootDrift,bodyTravelRadians:bodyTravel});
   }
   const gestures=[];
   for(const action of ['Rock','Paper','Scissors']){
    api.sample(action,.5);const wrist=actor.bones.get('handR').matrixWorld.elements[13];
    const fingers=['index','middle','ring','pinky'].map(n=>{const m=actor.bones.get(n+'02R').matrixWorld.elements;return m[13]+m[5]*(n==='pinky'?.06:.075)-wrist;});
    if(action==='Rock'&&fingers.some(v=>v>.15))throw Error('Fist has an extended finger');
    if(action==='Paper'&&fingers.some(v=>v<.16))throw Error('Paper has a folded finger');
    if(action==='Scissors'&&(fingers[0]<.18||fingers[1]<.18||fingers[2]>.15||fingers[3]>.15))throw Error('Scissors is not a two-finger V');
    gestures.push({action,fingertipHeightAboveWrist:fingers});
   }
   const mesh=actor.group.getObjectByProperty('isSkinnedMesh',true),geometry=mesh.geometry,p=geometry.attributes.position;
   const ids=[];for(let i=0;i<p.count;i++)if(p.getZ(i)>.54&&p.getY(i)>2.0&&p.getY(i)<2.255&&Math.abs(p.getX(i))<.2)ids.push(i);
   if(ids.length<20)throw Error('Mouth mesh was not found');
   const expressions=[];
   for(const action of ['Idle','Happy','Sad','Surprised']){
    api.sample(action,.5);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const i of ids){let x=p.getX(i),y=p.getY(i);for(let k=0;k<mesh.morphTargetInfluences.length;k++){const m=geometry.morphAttributes.position[k],w=mesh.morphTargetInfluences[k];x+=m.getX(i)*w;y+=m.getY(i)*w;}minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    expressions.push({action,width:maxX-minX,height:maxY-minY});
   }
   const [idle,happy,sad,surprised]=expressions;
   if(idle.height>.07||sad.height>.07||happy.height<.14||surprised.height<.14||surprised.width>happy.width*.65)throw Error('Mouth shapes do not distinguish the expressions');
   result.push({character:actor.group.name,motions,gestures,expressions});
  }
  return result;
 });
 await fs.writeFile(file('whole-body-motion.json'),JSON.stringify(report,null,2));
 await page.selectOption('#character','female');await page.selectOption('#view','front');
 for(const action of ['Throw','RaiseArms','Celebrate']){
  await page.selectOption('#action',action);
  for(let i=0;i<16;i++){
   await page.evaluate(([a,u])=>window.characterReview.sample(a,u),[action,i/15]);
   await page.locator('canvas').screenshot({path:file(`motion-frames/${action}-${String(i).padStart(2,'0')}.png`)});
  }
 }
 assert.equal(report.length,2);console.log('PASS whole-body motion, planted feet, three hand formations, four distinct mouth shapes');
}finally{await browser.close();}
