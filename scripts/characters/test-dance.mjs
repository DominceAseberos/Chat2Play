import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
const output=new URL('../../assets/characters/validation/',import.meta.url);
const path=name=>new URL(name,output).pathname.replace(/^\/(?=[A-Za-z]:)/,'');
await fs.mkdir(path('dance-frames'),{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('assets/characters/review.html',process.env.C2P_BASE_URL||'http://127.0.0.1:5174/').href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.characterReview&&document.body.dataset.ready==='true',null,{timeout:60000});
 await page.evaluate(()=>window.characterReview.setPaused(true));
 const report=await page.evaluate(()=>{
  const api=window.characterReview,result=[];
  const pos=bone=>bone.matrixWorld.elements.slice(12,15);
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  for(const actor of api.actors){
   const clip=actor.clips.find(c=>c.name==='VictoryDance');if(!clip||Math.abs(clip.duration-4)>.01)throw Error('Missing four-second dance');
   const samples=[];
   for(let i=0;i<=240;i++){
    api.sample('VictoryDance',i/240);
    const mesh=actor.group.getObjectByProperty('isSkinnedMesh',true);
    const pose=[...actor.bones].map(([name,b])=>({name,p:pos(b),q:b.quaternion.toArray()}));
    if(pose.some(b=>b.p.some(v=>!Number.isFinite(v))))throw Error('Invalid dance transform');
    if(mesh.morphTargetInfluences[mesh.morphTargetDictionary.Happy]<.99)throw Error('Dance face is not happy');
    const shoeIndices=[];const geometry=mesh.geometry;
    for(let v=0;v<geometry.attributes.position.count;v++)if(geometry.attributes.position.getY(v)<.07)shoeIndices.push(v);
    let soleMinY=Infinity;const vertex=actor.group.position.clone();
    for(const v of shoeIndices){mesh.getVertexPosition(v,vertex);mesh.localToWorld(vertex);soleMinY=Math.min(soleMinY,vertex.y);}
    samples.push({u:i/240,pose,soleMinY,feet:['L','R'].map(s=>pos(actor.bones.get('foot'+s))),hands:['L','R'].map(s=>pos(actor.bones.get('hand'+s))),hip:pos(actor.bones.get('hips'))});
   }
   const first=samples[0],last=samples.at(-1);
   const loopPositionError=Math.max(...first.pose.map((b,i)=>distance(b.p,last.pose[i].p)));
   const loopRotationError=Math.max(...first.pose.map((b,i)=>2*Math.acos(Math.min(1,Math.abs(b.q.reduce((s,v,j)=>s+v*last.pose[i].q[j],0))))));
   if(loopPositionError>.001||loopRotationError>.003)throw Error('Dance loop pops');
   let largestStep={angle:0,bone:'',u:0};
   samples.slice(1).forEach((s,k)=>s.pose.forEach((b,i)=>{const angle=2*Math.acos(Math.min(1,Math.abs(b.q.reduce((sum,v,j)=>sum+v*samples[k].pose[i].q[j],0))));if(angle>largestStep.angle)largestStep={angle,bone:b.name,u:s.u};}));
   const maxBoneAngularStep=largestStep.angle;
   if(maxBoneAngularStep>.55)throw Error('Dance contains a sudden joint flip '+JSON.stringify(largestStep));
   let maxContactDrift=0,groundedSamples=0,airborneSamples=0;
   for(const sample of samples){
    const phrase=Math.min(1,Math.floor(sample.u*2)),t=sample.u*2-phrase;
    const moving=phrase===0?0:1;
    const inHop=t>.68&&t<.87,inKnee=t>.12&&t<.43;
    for(let foot=0;foot<2;foot++)if(!inHop&&!(inKnee&&foot===moving)){
     maxContactDrift=Math.max(maxContactDrift,distance(first.feet[foot],sample.feet[foot]));groundedSamples++;
    }
    if(sample.feet.every(p=>p[1]>.225))airborneSamples++;
   }
   if(maxContactDrift>.005)throw Error('Standing foot slides during a step '+maxContactDrift);
   const minSoleHeight=Math.min(...samples.map(s=>s.soleMinY));
   if(minSoleHeight<-.003)throw Error('A shoe penetrates the ground '+minSoleHeight);
   const lift=Math.max(...samples.flatMap(s=>s.feet.map(p=>p[1])))-.20;
   const hipTravel=Math.max(...samples.map(s=>s.hip[0]))-Math.min(...samples.map(s=>s.hip[0]));
   const footTravel=Math.max(...samples.map(s=>s.feet[0][0]))-Math.min(...samples.map(s=>s.feet[0][0]));
   const handTravel=Math.max(...[0,1].map(h=>Math.max(...samples.map(s=>s.hands[h][1]))-Math.min(...samples.map(s=>s.hands[h][1]))));
   const kneeForwardTravel=Math.max(...[0,1].map(f=>Math.max(...samples.map(s=>s.feet[f][2]))-Math.min(...samples.map(s=>s.feet[f][2]))));
   if(lift<.20||hipTravel<.24||kneeForwardTravel<.20||handTravel<.45||airborneSamples<10)throw Error('Missing knee lift, weight transfer, arm reach or hop '+JSON.stringify({lift,hipTravel,kneeForwardTravel,handTravel,airborneSamples}));
   result.push({character:actor.group.name,duration:clip.duration,loopPositionError,loopRotationError,maxBoneAngularStep,maxContactDrift,minSoleHeight,groundedSamples,airborneSamples,footLift:lift,hipTravel,footTravel,kneeForwardTravel,handTravel});
  }
  return result;
 });
 await fs.writeFile(path('victory-dance.json'),JSON.stringify({report,errors},null,2));
 await page.selectOption('#character','pair');await page.selectOption('#view','front');await page.selectOption('#action','VictoryDance');
 for(let i=0;i<64;i++){
  await page.evaluate(u=>window.characterReview.sample('VictoryDance',u),i/64);
  await page.locator('canvas').screenshot({path:path(`dance-frames/${String(i).padStart(2,'0')}.png`)});
 }
 await page.selectOption('#view','three-quarter');
 for(const [i,u] of [.035,.125,.23,.32,.3875,.455,.625,.8875].entries()){
  await page.evaluate(u=>window.characterReview.sample('VictoryDance',u),u);
  await page.locator('canvas').screenshot({path:path(`dance-frames/pose-${i}.png`)});
 }
 if(errors.length)throw Error(errors.join(';'));
 await fs.writeFile(path('victory-dance.json'),JSON.stringify({report,errors},null,2));
 console.log('PASS both victory dances: knee lifts, diagonal reaches, anticipation, grounded support, soft landings and seamless four-second loop');
}finally{await browser.close();}
