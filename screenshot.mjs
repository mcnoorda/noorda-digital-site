// Screenshot a URL with Puppeteer.
// Usage: node screenshot.mjs <url> [label]
//   node screenshot.mjs http://localhost:3000
//   node screenshot.mjs http://localhost:3000 hero
// Saves to ./temporary screenshots/screenshot-N[-label].png (auto-incremented, never overwritten).
import puppeteer from 'puppeteer';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3].replace(/[^a-z0-9-_]/gi, '')}` : '';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = join(root, 'temporary screenshots');
await mkdir(outDir, { recursive: true });

// Auto-increment: find the highest existing screenshot-N and add 1.
let next = 1;
try {
  const files = await readdir(outDir);
  const nums = files
    .map((f) => f.match(/^screenshot-(\d+)/))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  if (nums.length) next = Math.max(...nums) + 1;
} catch {}

const outPath = join(outDir, `screenshot-${next}${label}.png`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  // Scroll the full page so IntersectionObserver scroll-reveal animations fire,
  // otherwise off-screen sections capture while still at opacity:0.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  // Give web fonts + reveal transitions a moment to settle.
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Saved ${outPath}`);
} finally {
  await browser.close();
}
