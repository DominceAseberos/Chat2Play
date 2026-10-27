import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const base=process.env.C2P_BASE_URL||"http://127.0.0.1:3003/";
const browser=await chromium.launch({
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 headless:true,
 args:["--no-sandbox"]
});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage();

try{
 await page.goto(base,{waitUntil:"networkidle",timeout:30000});
 const manifest=await page.evaluate(async()=>{
  const link=document.querySelector('link[rel="manifest"]');
  assertLink(link);
  return fetch(link.href).then(response=>response.json());
  function assertLink(value){if(!(value instanceof HTMLLinkElement))throw new Error("Manifest link missing");}
 });
 assert.equal(manifest.name,"Chat2Play");
 assert.equal(manifest.display,"standalone");
 assert.equal(manifest.start_url,"/");
 assert.ok(manifest.icons?.some(icon=>icon.sizes==="192x192"));
 assert.ok(manifest.icons?.some(icon=>icon.sizes==="512x512"));

 await page.waitForFunction(async()=>{
  const registration=await navigator.serviceWorker.getRegistration();
  return registration?.active?.state==="activated";
 },null,{timeout:20000});
 await page.reload({waitUntil:"networkidle"});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:15000});
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js")),true);

 await context.setOffline(true);
 await page.reload({waitUntil:"domcontentloaded",timeout:15000});
 assert.equal(await page.title(),"Chat2Play — Meet. Chat. Play.");
 await page.locator("#root").waitFor({state:"visible",timeout:10000});
 assert.ok((await page.locator("#root").innerHTML()).length>100,"Offline app shell did not render");
 console.log("PASS: manifest, service worker activation, and offline app shell verified");
}finally{
 await context.setOffline(false).catch(()=>{});
 await browser.close();
}
