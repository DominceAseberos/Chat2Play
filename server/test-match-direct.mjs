import { chromium } from "playwright-core";
import fs from "node:fs";

async function testMatch() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    args: ["--no-sandbox"]
  });

  const base = "http://127.0.0.1:3002/";
  const c1 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const a = await c1.newPage();
  const b = await c2.newPage();

  console.log("Navigating to", base);
  await Promise.all([
    a.goto(base, { waitUntil: "domcontentloaded" }),
    b.goto(base, { waitUntil: "domcontentloaded" })
  ]);

  console.log("Checking online status...");
  await a.locator(".online-status strong").waitFor({ timeout: 10000 });
  console.log("Online status visible!");

  for (const p of [a, b]) {
    for (let step = 0; step < 3; step++) {
      const nextBtn = p.locator(".home-pager-next");
      if (await nextBtn.isVisible()) await nextBtn.click();
    }
    const consent = p.locator(".consent input");
    if (await consent.isVisible()) await consent.check();
  }

  console.log("Clicking Find a stranger...");
  await Promise.all([
    a.getByRole("button", { name: /Find a stranger/i }).click(),
    b.getByRole("button", { name: /Find a stranger/i }).click()
  ]);

  await Promise.all([
    a.locator(".partner-name-button").waitFor({ timeout: 15000 }),
    b.locator(".partner-name-button").waitFor({ timeout: 15000 })
  ]);
  console.log("MATCH SUCCESSFUL ON 3002!");

  await browser.close();
}

testMatch().catch(err => {
  console.error("Match test failed:", err);
  process.exit(1);
});
