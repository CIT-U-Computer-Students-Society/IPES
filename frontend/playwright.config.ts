import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const report = process.env.IPES_E2E_REPORT_DIR || path.resolve('e2e-artifacts/discovery');
export default defineConfig({
  testDir: './e2e/specs',
  grep: process.env.IPES_E2E_EXPANDED === '1' ? undefined : /@core/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  failOnFlakyTests: true,
  forbidOnly: Boolean(process.env.CI),
  timeout: 90000,
  expect: { timeout: 10000 },
  outputDir: path.join(report, 'test-results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(report, 'playwright'), open: 'never' }],
    ['json', { outputFile: path.join(report, 'playwright-results.json') }],
    ['./e2e/reporters/requirements-reporter.ts'],
  ],
  use: {
    navigationTimeout: 20000,
    actionTimeout: 10000,
    baseURL: 'http://127.0.0.1:5175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
