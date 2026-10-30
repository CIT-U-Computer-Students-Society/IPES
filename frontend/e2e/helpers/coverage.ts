import type { Page } from '@playwright/test';
const collectors = new WeakMap<Page, () => Promise<void>>();
export function registerCoverage(page: Page, collect: () => Promise<void>) {
  collectors.set(page, collect);
}
export async function flushCoverage(page: Page) {
  await collectors.get(page)?.();
}
