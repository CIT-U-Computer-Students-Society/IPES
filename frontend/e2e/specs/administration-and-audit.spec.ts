import { test, expect } from '../fixtures/test';
import { login } from '../helpers/workflows';

test('S07 request to join another organization @expanded', async ({ page, fixture, evidence }) => {
  await login(page, fixture, 'outsider', true);
  await page.goto('/select-organization');
  expect((await evidence('before-join')).joinRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'Join Organization', exact: true }).click();
  await page.getByLabel('Organization Code', { exact: true }).fill(fixture.organization.code);
  await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const state = await evidence('join-pending', { requester: fixture.users.outsider.id, status: 'Pending' });
  expect(state.joinRequests).toHaveLength(1);
  expect(state.joinRequests[0]).toMatchObject({ user_id: fixture.users.outsider.id, status: 'Pending' });
});

test('S08 find a form beyond the first API page @expanded', async ({ page, fixture, evidence }) => {
  await login(page, fixture, 'admin');
  await page.goto('/admin/forms');
  expect((await evidence('pagination-fixture', { forms: 21 })).forms).toHaveLength(21);
  await page.getByPlaceholder('Search forms...').fill(fixture.title);
  // Intended acceptance behavior; a first-page-only hook must fail this regression.
  await expect(page.getByText(fixture.title, { exact: true })).toBeVisible();
  await evidence('pagination-search', { oldestFormReachable: true });
});

test('S09 soft-delete a form and retain assignment and audit history @expanded', async ({ page, fixture, evidence }) => {
  await login(page, fixture, 'admin');
  await page.goto('/admin/forms');
  const before = await evidence('before-deactivate');
  await page.locator('[title="Double-click to open in Form Editor"]').filter({ hasText: fixture.title }).getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, Delete', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(fixture.title, { exact: true })).toHaveCount(0);
  const after = await evidence('retained-history', { deleted: true, active: false });
  expect(after.forms[0]).toMatchObject({ is_deleted: true, is_active: false });
  expect(after.assignments).toEqual(before.assignments);
  expect(after.questions).toEqual(before.questions);
  expect(after.audit.length).toBeGreaterThan(before.audit.length);
});
