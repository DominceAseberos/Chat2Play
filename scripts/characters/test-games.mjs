import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const base=process.env.C2P_BASE_URL||'http://127.0.0.1:5175/';
const out=new URL('../../assets/characters/validation/',import.meta.url);
const file=name=>new URL(name,out).pathname.replace(/^\/(?=[A-Za-z]:)/,'');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,
 args:['--use-gl=angle','--use-angle=swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const report=[];
async function joined(width,height){
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700,permissions:['microphone']})));
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];
 for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 await Promise.all([a,b].map(p=>p.goto(base,{waitUntil:'domcontentloaded'})));
 for(const p of [a,b]){
  await p.locator('.online-status strong').waitFor({timeout:15000});
  const next=p.locator('.home-pager-next');if(await next.isVisible())for(let i=0;i<3;i++)await next.click();
  const consent=p.locator('.consent input');if(await consent.isVisible())await consent.check();
 }
 await Promise.all([a,b].map(p=>p.getByRole('button',{name:'Find a stranger'}).click()));
 await Promise.all([a,b].map(p=>p.locator('.partner-name-button').waitFor({timeout:18000})));
 const message='Character review '+width+' '+Date.now();
 const input=a.getByRole('textbox',{name:'Message',exact:true});await input.fill(message);await input.press('Enter');
 await b.getByText(message,{exact:true}).waitFor({timeout:8000});
 return {a,b,contexts,errors};
}
async function invite(a,b,kind){
 const open=a.getByRole('button',{name:'Open mini games'});if(await open.isVisible())await open.click();
 await a.locator('.sidebar-game:visible').filter({hasText:kind}).first().click();
 await b.getByRole('button',{name:'Accept invitation'}).first().click();
}
for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768]].filter(([w])=>!process.env.C2P_TEST_WIDTH||String(w)===process.env.C2P_TEST_WIDTH)){
 let ctx;
 if(process.env.C2P_GAME!=='henyo'){
 try{
  ctx=await joined(width,height);const {a,b,errors}=ctx;
  await invite(a,b,'Rock Paper Scissors');
  await Promise.race([a.getByRole('button',{name:'Load 3D game'}).waitFor(),a.locator('.rps-scene-3d').first().waitFor()]);
  const load=a.getByRole('button',{name:'Load 3D game'});if(await load.isVisible())await load.click();
  for(const p of [a,b])await p.waitForFunction(()=>[...document.querySelectorAll('.rps-scene-3d')].some(e=>e.getClientRects().length&&e.dataset.characterSource==='blender-glb'&&e.dataset.renderer==='three'),null,{timeout:20000});
  const rounds=width===390?3:1;
  for(let round=1;round<=rounds;round++){
   // Submit inside the three-second round without spending its clock on
   // scroll/stability checks. The mobile page also mounts a hidden desktop
   // sidebar: choose the visible arena's button, never the first DOM match.
   await Promise.all([[a,'rock'],[b,'scissors']].map(([page,choice])=>page.waitForFunction(({round,choice})=>{
    const status=[...document.querySelectorAll('.rps-stage-status')].find(e=>e.getClientRects().length&&e.textContent.includes('Round '+round+' '));
    const button=[...document.querySelectorAll(`[aria-label="Choose ${choice}"]`)].find(e=>e.getClientRects().length&&!e.disabled);
    if(!status||!button)return false;button.click();return true;
   },{round,choice},{timeout:12000})));
   await a.waitForFunction(()=>[...document.querySelectorAll('.rps-scene-3d')].some(e=>e.dataset.result==='win'),null,{timeout:10000});
   await b.waitForFunction(()=>[...document.querySelectorAll('.rps-scene-3d')].some(e=>e.dataset.result==='lose'),null,{timeout:10000});
   await a.waitForFunction(()=>[...document.querySelectorAll('.rps-scene-3d')].some(e=>e.dataset.action0==='VictoryDance'),null,{timeout:5000});
   if(round===rounds){
    const values=await Promise.all([a,b].map(p=>p.locator('.rps-scene-3d:visible').first().evaluate(e=>({calls:+e.dataset.drawCalls,triangles:+e.dataset.triangles,result:e.dataset.result,actions:[e.dataset.action0,e.dataset.action1],width:e.clientWidth,height:e.clientHeight}))));
    for(const v of values){assert.ok(v.calls<100);assert.ok(v.triangles<25000);assert.deepEqual(v.actions.sort(),['Lose','VictoryDance']);}
    assert.equal(errors.length,0,errors.join(';'));report.push({kind:'RPS',width,height,rounds,values});
    await Promise.all([a.screenshot({path:file(`rps-${width}-winner.png`)}),b.screenshot({path:file(`rps-${width}-loser.png`)} )]);
   }
   if(round<rounds)await a.waitForFunction(()=>[...document.querySelectorAll('.rps-scene-3d')].some(e=>e.dataset.result==='waiting'),null,{timeout:12000});
  }
  if(rounds===3){
   await a.waitForTimeout(4500);
   const action=await a.locator('.rps-scene-3d:visible').first().getAttribute('data-action0');
   assert.equal(action,'VictoryDance','Match winner stopped dancing after the reveal');
   await a.screenshot({path:file(`rps-${width}-dance.png`)});
  }
  console.log('PASS RPS',width,height,rounds,'rounds');
 }catch(e){console.error('FAIL RPS',width,String(e));if(ctx)await ctx.a.screenshot({path:file(`rps-${width}-failure.png`)});report.push({kind:'RPS',width,error:String(e)});process.exitCode=1;}
 finally{if(ctx)await Promise.all(ctx.contexts.map(c=>c.close()));}
 }
 try{
  ctx=await joined(width,height);const {a,b,errors}=ctx;
  await invite(a,b,'Pinoy Henyo');
  const setup=a.getByRole('dialog',{name:'Pinoy Henyo setup'});
  await setup.getByRole('checkbox').check();await setup.getByRole('button',{name:'Share categories'}).click();
  await b.getByRole('checkbox').first().check();await b.getByRole('button',{name:'Confirm categories'}).first().click();
  await setup.getByRole('button',{name:'Start game'}).click();
  await Promise.race([a.getByRole('button',{name:'Allow microphone'}).waitFor(),a.locator('.forehead-overlay').waitFor()]);
  for(const p of [a,b]){const mic=p.getByRole('button',{name:'Allow microphone'});if(await mic.isVisible())await mic.click();}
  for(const p of [a,b])await p.waitForFunction(()=>document.querySelector('.forehead-scene')?.dataset.assetsReady==='true',null,{timeout:22000});
  const giver=(await a.locator('.forehead-scene').getAttribute('aria-label')).startsWith("Partner's")?a:b,guesser=giver===a?b:a;
  const values=[];
  for(const p of [giver,guesser]){
   const info=await p.locator('.forehead-scene').evaluate(e=>({source:e.dataset.characterSource,calls:+e.dataset.drawCalls,triangles:+e.dataset.triangles,label:e.getAttribute('aria-label'),overflow:document.documentElement.scrollWidth>innerWidth+2}));
   assert.equal(info.source,'blender-glb');assert.ok(info.calls<220&&info.triangles<60000);assert.equal(info.overflow,false);values.push(info);
  }
  assert.ok(values[0].label.startsWith("Partner's forehead word:"));assert.ok(values[1].label.includes('secret word is hidden'));
  await giver.screenshot({path:file(`henyo-${width}-giver.png`)});
  const canvas=guesser.locator('.forehead-scene canvas'),rect=await canvas.boundingBox();
  const x=rect.x+rect.width*.5,y=rect.y+rect.height*.2;
  await guesser.mouse.move(x,y);await guesser.mouse.down();await guesser.mouse.move(x,y+Math.max(205,rect.height*.55),{steps:10});await guesser.waitForTimeout(800);await guesser.mouse.up();
  await guesser.waitForFunction(()=>Number(document.querySelector('.forehead-scene')?.dataset.cameraPitch)<-.95,null,{timeout:8000});
  await guesser.screenshot({path:file(`henyo-${width}-look-down.png`)});
  await giver.waitForFunction(()=>Number(document.querySelector('.forehead-scene')?.dataset.headMotion)>.4,null,{timeout:12000}).catch(async e=>{
   const debug=await Promise.all([giver,guesser].map(p=>p.locator('.forehead-scene').evaluate(e=>({...e.dataset}))));throw Error('Remote head sync '+JSON.stringify(debug)+' '+e.message);
  });
  assert.equal(errors.length,0,errors.join(';'));report.push({kind:'Henyo',width,height,values,lookSync:true});console.log('PASS Henyo',width,height,'secret card, first person, remote head synchronization');
 }catch(e){console.error('FAIL Henyo',width,String(e));if(ctx)await ctx.a.screenshot({path:file(`henyo-${width}-failure.png`)}).catch(()=>{});report.push({kind:'Henyo',width,error:String(e)});process.exitCode=1;}
 finally{if(ctx)await Promise.all(ctx.contexts.map(c=>c.close()));ctx=undefined;}
}
const reportFile=process.env.C2P_TEST_WIDTH?`games-${process.env.C2P_TEST_WIDTH}-browser.json`:process.env.C2P_GAME==='henyo'?'games-henyo-browser.json':'games-browser.json';
await fs.writeFile(file(reportFile),JSON.stringify(report,null,2));await browser.close();
