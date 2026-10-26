import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

async function testRecord() {
  const recDir = "C:/Users/user/OneDrive/Desktop/Projects_personal/video_studio/out/hd_test_rec";
  fs.mkdirSync(recDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    args: ["--no-sandbox"]
  });

  const c1 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: recDir, size: { width: 780, height: 1688 } }
  });

  const page = await c1.newPage();
  await page.goto("http://127.0.0.1:3002/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Click next on pager
  for (let i = 0; i < 3; i++) {
    const nextBtn = page.locator(".home-pager-next");
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(600);
    }
  }

  await page.waitForTimeout(1000);
  await c1.close();
  await browser.close();

  const files = fs.readdirSync(recDir).filter(f => f.endsWith('.webm'));
  console.log("Recorded files:", files);
  for (const f of files) {
    const stat = fs.statSync(path.join(recDir, f));
    console.log("File:", f, "Size:", stat.size, "bytes");
  }
}

testRecord().catch(err => {
  console.error("Recording error:", err);
  process.exit(1);
});
