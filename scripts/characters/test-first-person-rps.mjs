import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const base=process.env.C2P_BASE_URL||'http://127.0.0.1:5176/';
const out=fileURLToPath(new URL('../../assets/characters/validation/',import.meta.url));
const report=[];
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const advance=(page,count)=>page.evaluate(count=>{for(let i=0;i<count;i++)window.firstPersonRps.step(.025);},count);
try{
 for(const [width,height] of [[390,844],[320,568],[1024,768]].filter(([w])=>!process.env.C2P_TEST_WIDTH||String(w)===process.env.C2P_TEST_WIDTH)){
  for(const character of ['female','male'].filter(c=>!process.env.C2P_CHARACTER||c===process.env.C2P_CHARACTER)){
   const context=await browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700});
   const page=await context.newPage(),errors=[],failedAssets=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{if(response.url().includes('/models/characters/')&&!response.ok())failedAssets.push(response.status());});
   try{
    await page.goto(`${base}assets/characters/first-person-rps.html?character=${character}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.firstPersonRps&&document.body.dataset.ready==='true',null,{timeout:45000});
    await page.evaluate(()=>window.firstPersonRps.setManual(true));
    const choices=[];
    for(const choice of ['rock','paper','scissors']){
     await page.getByRole('button',{name:choice[0].toUpperCase()+choice.slice(1),exact:true}).click();
     await page.locator('#throw').click();
     assert.equal(await page.locator('body').getAttribute('data-phase'),'windup');
     assert.equal(await page.locator('body').getAttribute('data-action'),'POVReady');
     assert.equal(await page.locator('#throw').isDisabled(),true);
     assert.equal(await page.evaluate(()=>window.firstPersonRps.throw()),false,'Another throw interrupts the current one');
     await advance(page,20);
     assert.equal(await page.locator('body').getAttribute('data-phase'),'throw');
     assert.equal(await page.locator('body').getAttribute('data-action'),'POVThrow');
     const start=await page.evaluate(()=>window.firstPersonRps.controller.actor.bones.get('handR').matrixWorld.elements.slice(12,15));
     await advance(page,42);
     assert.equal(await page.locator('body').getAttribute('data-phase'),'revealed');
     assert.equal(await page.locator('body').getAttribute('data-action'),'POV'+choice[0].toUpperCase()+choice.slice(1));
     assert.equal(await page.locator('#status').textContent(),'You threw '+choice);
     const info=await page.evaluate(()=>{
      const api=window.firstPersonRps,actor=api.controller.actor,mesh=actor.group.getObjectByProperty('isSkinnedMesh',true);
      const g=mesh.geometry,skin=g.attributes.skinIndex,weights=g.attributes.skinWeight;
      const hand=actor.bones.get('handR'),wrist=hand.matrixWorld.elements.slice(12,15);
      const fingerReach=['index','middle','ring','pinky'].map(n=>{const m=actor.bones.get(n+'02R').matrixWorld.elements;
       return Math.hypot(m[12]+m[4]*.075-wrist[0],m[13]+m[5]*.075-wrist[1],m[14]+m[6]*.075-wrist[2]);});
      const forearm=actor.bones.get('forearmR').matrixWorld.elements.slice(12,15);
      const forearmDirection=wrist.map((v,i)=>v-forearm[i]);
      const axis=[hand.matrixWorld.elements[4],hand.matrixWorld.elements[5],hand.matrixWorld.elements[6]];
      const wristBend=Math.acos(Math.max(-1,Math.min(1,axis.reduce((sum,v,i)=>sum+v*forearmDirection[i],0)/Math.hypot(...axis)/Math.hypot(...forearmDirection))));
      const palmNormals=['L','R'].map(side=>{const bone=actor.bones.get('hand'+side),index=mesh.skeleton.bones.indexOf(bone);
       const front=actor.group.position.clone().set(0,0,1);
       front.transformDirection(bone.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[index]));
       return {side,normal:front.toArray()};});
      const left=actor.bones.get('handL').getWorldPosition(actor.group.position.clone()).project(api.camera);
      const right=actor.bones.get('handR').getWorldPosition(actor.group.position.clone()).project(api.camera);
      const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};let handVertices=0;
      const point=actor.group.position.clone();
      for(let i=0;i<g.attributes.position.count;i++){
       const belongs=[0,1,2,3].some(k=>weights.getComponent(i,k)>.35&&/^(handR|(?:thumb|index|middle|ring|pinky)(?:01|02)R)$/.test(mesh.skeleton.bones[skin.getComponent(i,k)].name));
       if(!belongs)continue;mesh.getVertexPosition(i,point);mesh.localToWorld(point);point.project(api.camera);
       bounds.minX=Math.min(bounds.minX,point.x);bounds.maxX=Math.max(bounds.maxX,point.x);bounds.minY=Math.min(bounds.minY,point.y);bounds.maxY=Math.max(bounds.maxY,point.y);handVertices++;
      }
      const index=g.index,used=new Set(index.array);let selfHeadVertices=0,upperArmVertices=0,torsoVertices=0;
      for(const i of used){let strongest=0,bone='';for(let k=0;k<4;k++)if(weights.getComponent(i,k)>strongest){strongest=weights.getComponent(i,k);bone=mesh.skeleton.bones[skin.getComponent(i,k)].name;}
       if(/^(head|neck)$/.test(bone))selfHeadVertices++;
       if(/^upper_arm[LR]$/.test(bone))upperArmVertices++;
       if(/^(chest|spine|hips|thigh[LR]|shin[LR]|foot[LR])$/.test(bone))torsoVertices++;
      }
      return {wrist,fingerReach,wristBend,palmNormals,leftX:left.x,rightX:right.x,bounds,handVertices,selfHeadVertices,upperArmVertices,torsoVertices,cameraY:api.camera.position.y,cameraRoll:api.camera.rotation.z,
       drawCalls:api.renderer.info.render.calls,triangles:api.renderer.info.render.triangles,overflow:document.documentElement.scrollWidth>innerWidth+1,
       canvasBottom:api.renderer.domElement.getBoundingClientRect().bottom,controlsTop:document.querySelector('footer').getBoundingClientRect().top};
     });
     await page.screenshot({path:`${out}/pov-rps-${character}-${width}-${choice}.png`});
     assert.ok(info.handVertices>100,'The actual skinned hand is missing');assert.equal(info.selfHeadVertices,0);
     assert.ok(info.upperArmVertices>0,'An arm is disconnected');assert.equal(info.torsoVertices,0,'The torso enters the hand close-up');
     for(const value of Object.values(info.bounds))assert.ok(Number.isFinite(value)&&Math.abs(value)<.98,'The throwing hand is cut off: '+JSON.stringify(info.bounds));
     if(choice==='rock')assert.ok(info.fingerReach.every(h=>h<.20),'Fist has an extended finger');
     if(choice==='paper')assert.ok(info.fingerReach.every(h=>h>.20),'Paper has a folded finger');
     if(choice==='scissors')assert.ok(info.fingerReach[0]>.20&&info.fingerReach[1]>.20&&info.fingerReach[2]<.20&&info.fingerReach[3]<.20,'Scissors does not show two fingers');
     assert.ok(info.wristBend<.55,'The wrist still bends sharply: '+info.wristBend);
     for(const palm of info.palmNormals)assert.ok(palm.normal[1]<-.90,`${palm.side} palm does not face the ground: ${palm.normal}`);
     assert.ok(info.leftX<-.10&&info.rightX>.05&&info.rightX-info.leftX>.35,'The hands are not separated to the sides');
     assert.ok(Math.hypot(...info.wrist.map((v,i)=>v-start[i]))>.09,'The wrist does not follow through');
     assert.ok(info.canvasBottom<=info.controlsTop+2,'Controls cover the hand view');assert.equal(info.overflow,false);
     assert.equal(info.cameraRoll,0);assert.ok(Math.abs(info.cameraY-2.36)<.001);assert.ok(info.drawCalls<50&&info.triangles<22000);
     await advance(page,20);assert.equal(await page.locator('body').getAttribute('data-phase'),'revealed','The gesture does not stay visible');
     choices.push({choice,...info});
    }
    await page.getByRole('button',{name:'Reset view',exact:true}).click();assert.equal(await page.locator('body').getAttribute('data-phase'),'ready');
    await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('1');await page.keyboard.press('Space');await advance(page,64);
    assert.equal(await page.locator('body').getAttribute('data-choice'),'rock');
    const rect=await page.locator('canvas').boundingBox(),yaw=await page.evaluate(()=>window.firstPersonRps.controller.lookYaw);
    await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.55,{steps:4});await page.mouse.up();
    assert.notEqual(await page.evaluate(()=>window.firstPersonRps.controller.lookYaw),yaw);
    assert.equal(errors.length,0,errors.join('; '));assert.equal(failedAssets.length,0);
    report.push({character,width,height,choices,keyboard:true,lookDrag:true,errors});console.log('PASS first-person throw',character,width,height,'wind-up, throw, three held signs, framing and controls');
   }catch(error){await page.screenshot({path:`${out}/pov-rps-${character}-${width}-failure.png`}).catch(()=>{});throw error;}
   finally{await context.close();}
  }
 }
 const suffix=process.env.C2P_TEST_WIDTH?`-${process.env.C2P_TEST_WIDTH}-${process.env.C2P_CHARACTER||'both'}`:'';
 await fs.writeFile(`${out}/first-person-rps${suffix}.json`,JSON.stringify(report,null,2));
}finally{await browser.close();}
