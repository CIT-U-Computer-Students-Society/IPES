/**
 * Automated Screenshot Capture Utility for IPES Documentation
 * 
 * Captures clean, unskewed 1440x900 viewports at 2x retina DPR
 * with synthetic demo data for documentation and tldraw annotation.
 */
import { chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../../website/public/images/raw');

const pagesToCapture = [
  { name: 'login', path: '/login' },
  { name: 'select-organization', path: '/select-organization' },
  { name: 'officer-dashboard', path: '/member/dashboard' },
  { name: 'officer-evaluations', path: '/member/evaluations' },
  { name: 'officer-accomplishments', path: '/member/accomplishments' },
  { name: 'officer-results', path: '/member/results' },
  { name: 'admin-dashboard', path: '/admin/dashboard' },
  { name: 'admin-organization', path: '/admin/organization' },
  { name: 'admin-users', path: '/admin/users' },
  { name: 'admin-form-builder', path: '/admin/forms' },
  { name: 'admin-assignments', path: '/admin/assignments' },
  { name: 'admin-accomplishments', path: '/admin/accomplishments' },
  { name: 'admin-analytics', path: '/admin/analytics' },
  { name: 'admin-audit', path: '/admin/audit' }
];

async function capture() {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  console.log(`[Capture] Connecting to ${baseUrl}...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  for (const item of pagesToCapture) {
    try {
      console.log(`[Capture] Navigating to ${item.name} (${item.path})...`);
      await page.goto(`${baseUrl}${item.path}`, { waitUntil: 'networkidle', timeout: 8000 });
      const targetPath = resolve(outputDir, `${item.name}.png`);
      await page.screenshot({ path: targetPath, fullPage: false });
      console.log(`[Capture] Saved: ${targetPath}`);
    } catch (err) {
      console.warn(`[Capture] Skipped ${item.name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('[Capture] Complete!');
}

capture().catch((err) => {
  console.error('[Capture Error]', err);
  process.exit(1);
});
