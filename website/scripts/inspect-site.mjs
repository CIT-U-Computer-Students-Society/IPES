import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('d:/_src/PyCharm Projects/IPES/IPES/frontend/node_modules/@playwright/test/index.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../public/inspection');
mkdirSync(outputDir, { recursive: true });

const target = process.argv[2] || 'hero';

async function inspect() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  if (target === 'hero') {
    console.log('Targeted capture: Homepage Hero...');
    await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(outputDir, 'homepage_hero.png'), fullPage: false });
  } else if (target === 'dark') {
    console.log('Targeted capture: Homepage Dark Mode...');
    await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
    await page.click('#theme-toggle-btn');
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(outputDir, 'homepage_dark.png'), fullPage: false });
  } else if (target === 'all') {
    console.log('Full suite capture...');
    await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: resolve(outputDir, 'homepage_hero.png'), fullPage: false });
    await page.screenshot({ path: resolve(outputDir, 'homepage_full.png'), fullPage: true });
  } else {
    console.log(`Targeted capture for: ${target}...`);
    await page.goto(`http://localhost:4321/${target.replace(/^\//, '')}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(outputDir, `${target.replace(/[\/:]/g, '_')}.png`), fullPage: false });
  }

  await browser.close();
  console.log('Inspection capture completed in:', outputDir);
}

inspect().catch(err => {
  console.error('Inspect failed:', err);
  process.exit(1);
});
