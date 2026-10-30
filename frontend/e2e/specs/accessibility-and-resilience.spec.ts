import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/test';
import { login } from '../helpers/workflows';

test('S10 keyboard-accessible sign in and automated accessibility scan @expanded', async ({ page, fixture, evidence }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).focus();
  await page.keyboard.type(fixture.users.member.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await evidence('login-accessibility', { violations: scan.violations.map(item => ({ id: item.id, impact: item.impact })) });
  expect(scan.violations).toEqual([]);
});

test('S11 distinguish a failed portfolio request from an empty portfolio @expanded', async ({ page, fixture, evidence }) => {
  await login(page, fixture);
  const before = await evidence('before-network-failure');
  await page.route('**/api/accomplishments/my/**', route => route.abort('failed'));
  await page.goto('/member/accomplishments');
  const after = await evidence('failed-request', { visibleErrorRequired: true });
  expect(after.accomplishments).toEqual(before.accomplishments);
  // A known empty-state fallback is a failed requirement, not a passing mock.
  await expect(page.getByText(/failed to load|unable to load|error loading/i).first()).toBeVisible();
});
