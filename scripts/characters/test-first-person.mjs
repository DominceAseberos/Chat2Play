import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.C2P_BASE_URL||'http://127.0.0.1:5176/';
const output=new URL('../../assets/characters/validation/',import.meta.url);
const file=name=>new URL(name,output).pathname.replace(/^\/(?=[A-Za-z]:)/,'');
await fs.mkdir(file('first-person-frames'),{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const reports=[];
try{
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768]])for(const character of ['female','male']){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(`${base}assets/characters/first-person.html?character=${character}&look=down`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.firstPersonDemo&&document.body.dataset.ready==='true',null,{timeout:30000});
   await page.evaluate(()=>{const a=window.firstPersonDemo;a.setManual(true);a.setWalk(true);for(let i=0;i<48;i++)a.step(.025);});
   const info=await page.evaluate(()=>{
    const a=window.firstPersonDemo,c=a.controller,mesh=c.actor.group.getObjectByProperty('isSkinnedMesh',true),g=mesh.geometry;
    const skin=g.attributes.skinIndex,weights=g.attributes.skinWeight,index=g.index,used=new Set(index.array);
    let headVertices=0;const counts={};
    for(const i of used)for(let k=0;k<4;k++)if(weights.getComponent(i,k)>.35){const n=mesh.skeleton.bones[skin.getComponent(i,k)].name;counts[n]=(counts[n]||0)+1;if(n==='head'||n==='neck')headVertices++;}
    const parts={};for(const n of ['chest','hips','handL','handR','footL','footR']){
     const b=c.actor.bones.get(n),p=b.getWorldPosition(a.camera.position.clone());
     const front=n==='chest'?.30:n==='hips'?.26:n.startsWith('foot')?.25:0;
     p.x-=Math.sin(c.bodyYaw)*front;p.z-=Math.cos(c.bodyYaw)*front;p.project(a.camera);
     parts[n]={x:p.x,y:p.y,inFrame:Math.abs(p.x)<1.05&&Math.abs(p.y)<1.05&&p.z>-1&&p.z<1};
    }
    return {headVertices,counts,parts,action:c.actor.action,distance:c.distance,cameraHeight:a.camera.position.y,
     bodyHeight:c.actor.group.position.y,fov:a.camera.fov,calls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,
     clippingPlanes:(mesh.material.clippingPlanes||[]).length,overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.equal(info.headVertices,0,'Self head/neck remain in first-person geometry');
   for(const n of ['chest','hips','forearmL','forearmR','handL','handR','thighL','thighR','shinL','shinR','footL','footR'])assert.ok(info.counts[n]>0,`${n} missing from body`);
   for(const [name,p] of Object.entries(info.parts))assert.ok(p.inFrame,`${name} is outside the downward view: ${JSON.stringify(p)}`);
   assert.equal(info.clippingPlanes,0,'Body is still cut off with a world-height clipping plane');
   assert.equal(info.action,'Walk');assert.ok(info.distance>.9&&info.cameraHeight>2);assert.ok(info.calls<65&&info.triangles<20000);assert.equal(info.overflow,false);
   await page.screenshot({path:file(`first-person-${character}-${width}-down.png`)});
   await page.getByRole('button',{name:'Look ahead',exact:true}).click();
   await page.evaluate(()=>{const a=window.firstPersonDemo;for(let i=0;i<30;i++)a.step(.025);});
   await page.screenshot({path:file(`first-person-${character}-${width}-ahead.png`)});
   await page.evaluate(()=>{const a=window.firstPersonDemo;a.setWalk(false);for(let i=0;i<45;i++)a.step(.025);});
   assert.equal(await page.evaluate(()=>window.firstPersonDemo.controller.actor.action),'Idle','Feet keep walking after stopping');
   // Keyboard walking, right-hand look dragging, reset and movement-pad release.
   await page.keyboard.down('KeyW');await page.evaluate(()=>{const a=window.firstPersonDemo;for(let i=0;i<20;i++)a.step(.025);});await page.keyboard.up('KeyW');
   const before=await page.evaluate(()=>window.firstPersonDemo.controller.lookYaw);
   await page.mouse.move(width*.76,height*.40);await page.mouse.down();await page.mouse.move(width*.55,height*.47,{steps:5});await page.mouse.up();
   assert.notEqual(await page.evaluate(()=>window.firstPersonDemo.controller.lookYaw),before);
   const pad=await page.locator('#joystick').boundingBox();
   await page.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2);await page.mouse.down();await page.mouse.move(pad.x+pad.width/2,pad.y+14,{steps:3});
   await page.evaluate(()=>{const a=window.firstPersonDemo;for(let i=0;i<20;i++)a.step(.025);});
   assert.equal(await page.evaluate(()=>window.firstPersonDemo.controller.actor.action),'Walk');await page.mouse.up();
   await page.evaluate(()=>{const a=window.firstPersonDemo;for(let i=0;i<45;i++)a.step(.025);});
   assert.equal(await page.evaluate(()=>window.firstPersonDemo.controller.actor.action),'Idle');
   await page.getByRole('button',{name:'Reset',exact:true}).click();
   const bound=await page.evaluate(()=>{const a=window.firstPersonDemo;a.setWalk(true);for(let i=0;i<500;i++)a.step(.025);return {z:a.controller.actor.group.position.z,action:a.controller.actor.action};});
   assert.ok(bound.z>=-9.101,'Player walked through the boundary');assert.equal(bound.action,'Idle','Walking continues against a wall');
   assert.equal(errors.length,0,errors.join(';'));reports.push({character,width,height,...info,controls:true,boundary:true});
   console.log('PASS first person',character,width,height,'full body, walk/stop, look, pad and boundary');
  }catch(error){await page.screenshot({path:file(`first-person-${character}-${width}-failure.png`)}).catch(()=>{});throw error;}
  finally{await context.close();}
 }
 // Capture a continuous walking view, then look down while the body keeps moving.
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(`${base}assets/characters/first-person.html?character=female`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.firstPersonDemo);
 await page.evaluate(()=>{const a=window.firstPersonDemo;a.setManual(true);a.setWalk(true);});
 for(let i=0;i<64;i++){
  if(i===18)await page.getByRole('button',{name:'Look down',exact:true}).click();
  await page.evaluate(()=>window.firstPersonDemo.step(.05));await page.screenshot({path:file(`first-person-frames/${String(i).padStart(2,'0')}.png`)});
 }
 await fs.writeFile(file('first-person-browser.json'),JSON.stringify(reports,null,2));
}finally{await browser.close();}
