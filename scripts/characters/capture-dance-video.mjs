import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const directory=fileURLToPath(new URL('../../assets/characters/validation/dance-video-frames/',import.meta.url));
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,
 args:['--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:720,height:875}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(new URL('assets/characters/review.html',process.env.C2P_BASE_URL||'http://127.0.0.1:5176/').href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.characterReview&&document.body.dataset.ready==='true');
 await page.evaluate(()=>{
  const api=window.characterReview;api.setPaused(true);
  // Capture exact animation times without an unrelated 60 fps render loop.
  window.requestAnimationFrame=()=>0;
  document.querySelector('#view').value='three-quarter';api.layout();
  api.renderer.setPixelRatio(1);api.camera.zoom=1.12;api.camera.updateProjectionMatrix();
 });
 for(let frame=0;frame<120;frame++){
  const png=await page.evaluate(u=>{
   const api=window.characterReview;api.sample('VictoryDance',u);
   return api.renderer.domElement.toDataURL('image/png').split(',')[1];
  },frame/120);
  await fs.writeFile(`${directory}/${String(frame).padStart(3,'0')}.png`,Buffer.from(png,'base64'));
 }
 if(errors.length)throw Error(errors.join('; '));
 console.log('PASS captured 120 rendered dance frames at 30 fps');
}finally{await browser.close();}
