import { chromium } from "playwright-core";
import fs from "node:fs";

async function recordLiveFlow() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"]
  });

  const base = "http://127.0.0.1:3002/";
  const outDir = "C:/Users/user/OneDrive/Desktop/Projects_personal/video_studio/out/hd_recording";
  fs.mkdirSync(outDir, { recursive: true });

  const c1 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: outDir, size: { width: 390, height: 844 } }
  });
  const c2 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  const a = await c1.newPage();
  const b = await c2.newPage();

  console.log("Loading pages...");
  await Promise.all([
    a.goto(base, { waitUntil: "networkidle" }),
    b.goto(base, { waitUntil: "networkidle" })
  ]);
  await a.waitForTimeout(1000);

  console.log("Navigating setup on A...");
  // Step 1 -> 2
  const nextA = a.locator(".home-pager-next");
  if (await nextA.isVisible()) {
    await nextA.click();
    await a.waitForTimeout(1000);
  }

  // Step 2 -> 3 (Games)
  if (await nextA.isVisible()) {
    await nextA.click();
    await a.waitForTimeout(1000);
  }

  // Step 3 -> 4 (Ready)
  if (await nextA.isVisible()) {
    await nextA.click();
    await a.waitForTimeout(1000);
  }

  // Setup B quickly
  for (let i = 0; i < 3; i++) {
    const nextB = b.locator(".home-pager-next");
    if (await nextB.isVisible()) await nextB.click();
  }
  const consentB = b.locator(".consent input");
  if (await consentB.isVisible()) await consentB.check();

  const consentA = a.locator(".consent input");
  if (await consentA.isVisible()) {
    await consentA.check();
    await a.waitForTimeout(600);
  }

  console.log("Matching...");
  await Promise.all([
    a.getByRole("button", { name: /Find a stranger/i }).click(),
    b.getByRole("button", { name: /Find a stranger/i }).click()
  ]);

  // Wait for match
  await Promise.all([
    a.locator(".partner-name-button").waitFor({ timeout: 15000 }),
    b.locator(".partner-name-button").waitFor({ timeout: 15000 })
  ]);
  console.log("Matched!");
  await a.waitForTimeout(2000);

  // Send message from B
  const chatInputB = b.locator(".composer textarea, .composer input");
  if (await chatInputB.isVisible()) {
    await chatInputB.fill("hiii");
    await b.locator(".composer-send, button[type='submit']").click();
  }
  await a.waitForTimeout(2000);

  // Open mini games on A
  const openGames = a.getByRole("button", { name: /Open mini games|Play a game/i }).first();
  if (await openGames.isVisible()) {
    await openGames.click();
    console.log("Opened mini games");
    await a.waitForTimeout(1500);

    const ttt = a.getByRole("button", { name: /Tic-Tac-Toe/i }).first();
    if (await ttt.isVisible()) {
      await ttt.click();
      console.log("Clicked Tic-Tac-Toe");
      await a.waitForTimeout(1200);

      // Accept on B
      const acceptBtn = b.getByRole("button", { name: /Let's play|Accept/i }).first();
      if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
        console.log("Accepted on B");
        await a.waitForTimeout(2000);

        // Play moves on board
        const cellsA = a.locator(".inline-game button, .ttt-cell, [aria-label*='cell']");
        const countA = await cellsA.count();
        console.log("Found cells on A:", countA);
        if (countA >= 9) {
          await cellsA.nth(4).click(); // center
          await a.waitForTimeout(1500);
          const cellsB = b.locator(".inline-game button, .ttt-cell, [aria-label*='cell']");
          await cellsB.nth(0).click(); // top-left
          await a.waitForTimeout(1500);
          await cellsA.nth(2).click(); // top-right
          await a.waitForTimeout(1500);
        }
      }
    }
  }

  await a.waitForTimeout(2000);
  await c1.close();
  await c2.close();
  await browser.close();
  console.log("Recorded live flow successfully!");
}

recordLiveFlow().catch(err => {
  console.error("Live flow failed:", err);
  process.exit(1);
});
