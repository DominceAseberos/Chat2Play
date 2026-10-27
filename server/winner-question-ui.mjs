import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const small=process.argv.includes("--small");
const width=small?320:390,height=small?568:844;
const browser=await chromium.launch({headless:true,
 executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
 args:["--no-sandbox"]});
try{
 const pages=await Promise.all([0,1].map(async()=>{
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto(process.env.C2P_BASE_URL||"http://127.0.0.1:3003/",{waitUntil:"domcontentloaded"});
  await page.locator(".online-status strong").waitFor();
  const next=page.locator(".home-pager-next");
  if(await next.isVisible())for(let i=0;i<3;i++)await next.click();
  const consent=page.locator(".consent input");if(await consent.isVisible())await consent.check();
  return page;
 }));
 const errors=[];pages.forEach(p=>p.on("pageerror",error=>errors.push(error.message)));
 const [a,b]=pages;
 await Promise.all(pages.map(p=>p.getByRole("button",{name:"Find a stranger"}).click()));
 await Promise.all(pages.map(p=>p.locator(".partner-name-button").waitFor()));
 const open=a.getByRole("button",{name:"Open mini games"});if(await open.isVisible())await open.click();
 await a.locator(".sidebar-game").filter({hasText:"Tic-Tac-Toe"}).filter({visible:true}).first().click();
 await b.getByRole("button",{name:"Accept invitation"}).first().click();
 await a.getByRole("button",{name:"Square 1"}).waitFor();
 const first=await a.getByRole("button",{name:"Square 1"}).isEnabled()?a:b;
 const second=first===a?b:a;
 for(const [page,cell] of [[first,1],[second,4],[first,2],[second,5],[first,3]])
  await page.getByRole("button",{name:`Square ${cell}`}).click();
 await Promise.all(pages.map(p=>p.locator(".winner-question-card").waitFor()));
 assert.match(await first.locator(".winner-question-card").textContent(),/Your skips: 3\/3/);
 assert.match(await second.locator(".winner-question-card").textContent(),/Your skips: 3\/3/);
 await first.locator("#winner-question-input").fill("What is the best thing you did this year?");
 await first.getByRole("button",{name:"Ask question"}).click();
 await second.locator(".winner-question-prompt").getByText("What is the best thing you did this year?").waitFor();
 const card=await second.locator(".winner-question-card").boundingBox();
 assert.ok(card&&card.y>=0&&card.y+card.height<=height+1,
  `Question card should fit within a ${width}x${height} phone: ${JSON.stringify(card)}`);
 await second.screenshot({path:`winner-question-phone-${width}.png`});
 await second.getByRole("button",{name:"Skip · 3 left"}).click();
 await first.locator("#winner-question-input").waitFor();
 assert.match(await second.locator(".winner-question-card").textContent(),/Your skips: 2\/3/);
 await first.locator("#winner-question-input").fill("What food would you happily eat every week?");
 await first.getByRole("button",{name:"Ask question"}).click();
 await second.locator("#winner-answer-input").fill("Pizza with friends.");
 await second.getByRole("button",{name:"Send answer"}).click();
 await Promise.all(pages.map(p=>p.locator(".winner-question-card").waitFor({state:"hidden"})));
 await Promise.all(pages.map(p=>p.getByRole("textbox",{name:"Message"}).waitFor()));
 assert.equal(await first.locator(".winner-chat-bubble").filter({hasText:"Pizza with friends."}).count(),1);
 assert.deepEqual(errors,[]);
 console.log(`PASS: ${width}px mobile winner question, skip, replacement, answer, and chat resume`);
}finally{await browser.close();}
