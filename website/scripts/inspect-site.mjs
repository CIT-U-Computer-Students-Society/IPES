import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('d:/_src/PyCharm Projects/IPES/IPES/frontend/node_modules/@playwright/test/index.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../public/inspection');
mkdirSync(outputDir, { recursive: true });

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

  // 1. Homepage (Light Mode - Hero)
  console.log('Capturing Homepage Hero...');
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(outputDir, 'homepage_hero.png'), fullPage: false });

  // 2. Homepage (Full Page)
  console.log('Capturing Homepage Full Page...');
  await page.screenshot({ path: resolve(outputDir, 'homepage_full.png'), fullPage: true });

  // 3. Officer Getting Started Doc Page
  console.log('Capturing Officer Guide...');
  await page.goto('http://localhost:4321/officer/getting-started/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(outputDir, 'officer_guide.png'), fullPage: false });

  // 4. Admin Organization Setup Doc Page
  console.log('Capturing Admin Guide...');
  await page.goto('http://localhost:4321/admin/organization-setup/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(outputDir, 'admin_guide.png'), fullPage: false });

  // 5. Dark Mode Homepage
  console.log('Capturing Homepage Dark Mode...');
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await page.click('#theme-toggle-btn');
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(outputDir, 'homepage_dark.png'), fullPage: false });

  await browser.close();
  console.log('Inspection captures completed in:', outputDir);
}

inspect().catch(err => {
  console.error('Inspect failed:', err);
  process.exit(1);
});
