import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
try{
 const p=await browser.newPage();await p.goto('http://127.0.0.1:5174/assets/characters/review.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.characterReview);
 const result=await p.evaluate(()=>{
  const a=window.characterReview;a.setPaused(true);const results=[];
  const pos=b=>b.matrixWorld.elements.slice(12,15),distance=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]));
  for(const actor of a.actors){
   const clip=actor.clips.find(c=>c.name==='Walk');if(!clip||Math.abs(clip.duration-1.2)>.001)throw Error('Missing 1.2-second walking clip');
   const samples=[];for(let i=0;i<=72;i++){
    const u=i/72;a.sample('Walk',u);const q=[...actor.bones.values()].map(b=>b.quaternion.toArray());
    samples.push({u,q,feet:['L','R'].map(s=>pos(actor.bones.get('foot'+s))),armDifference:pos(actor.bones.get('handL'))[2]-pos(actor.bones.get('handR'))[2]});
   }
   let stanceDrift=0;for(const [side,start,end] of [[0,0,36],[1,36,72]]){
    const first=samples[start].feet[side].slice();first[2]+=.9*clip.duration*samples[start].u;
    for(let i=start;i<=end;i++){const v=samples[i].feet[side].slice();v[2]+=.9*clip.duration*samples[i].u;stanceDrift=Math.max(stanceDrift,distance(v,first));}
   }
   const loopError=Math.max(...samples[0].feet.map((v,i)=>distance(v,samples.at(-1).feet[i])));
   const footLift=Math.max(...samples.flatMap(s=>s.feet.map(v=>v[1])))-.2;
   const maxJointStep=Math.max(...samples.slice(1).flatMap((s,k)=>s.q.map((q,i)=>2*Math.acos(Math.min(1,Math.abs(q.reduce((v,x,j)=>v+x*samples[k].q[i][j],0)))))));
   if(stanceDrift>.01||loopError>.001||footLift<.08||maxJointStep>.5)throw Error('Walking mechanics failed '+JSON.stringify({stanceDrift,loopError,footLift,maxJointStep}));
   if(samples[0].armDifference*samples[36].armDifference>=0)throw Error('Arms do not alternate');
   results.push({character:actor.group.name,duration:clip.duration,stanceDrift,loopError,footLift,maxJointStep,speed:.9});
  }
  return results;
 });
 await fs.writeFile(new URL('../../assets/characters/validation/walk-animation.json',import.meta.url),JSON.stringify(result,null,2));console.log('PASS both walking clips: stride/world speed match, planted feet, arm swing, smooth loop');
}finally{await browser.close();}
