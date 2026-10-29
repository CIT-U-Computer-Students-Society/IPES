import { test, expect } from '../fixtures/test';
import { login, signOut } from '../helpers/workflows';
import { snapshot } from '../helpers/database';

test('S01 sign in, select organization and invalidate the session @core', async ({ page, context, playwright, fixture, evidence }) => {
  await login(page, fixture);
  const before = await evidence('signed-in', { organizationId: fixture.organization.id });
  expect(before.organizations[0].id).toBe(fixture.organization.id);
  expect(before.sessions[0].active_count).toBe(1);
  const profile = await page.request.get('/api/auth/me/');
  expect(profile.ok()).toBe(true);
  expect((await profile.json()).id).toBe(fixture.users.member.id);
  expect((await page.request.post('/api/auth/logout/', { data: {} })).status()).toBe(403);
  const cookies = await context.cookies();
  for (const name of ['ipes_sessionid', 'ipes_csrftoken']) {
    const cookie = cookies.find(item => item.name === name);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.domain).toBe('127.0.0.1');
  }
  const oldState = await context.storageState();
  await signOut(page);
  const oldSession = await playwright.request.newContext({ storageState: oldState });
  try {
    expect([401, 403]).toContain((await oldSession.get('http://127.0.0.1:5175/api/auth/me/')).status());
  } finally { await oldSession.dispose(); }
  expect((await evidence('signed-out', { oldSessionRejected: true, activeSessions: 0 })).sessions[0].active_count).toBe(0);
});

test('S06 tenant selection and denied evaluation mutations preserve foreign rows @core', async ({ page, fixture, evidence }) => {
  await login(page, fixture, 'admin');
  await page.goto('/select-organization');
  await page.getByText(fixture.foreignOrganization.name, { exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.goto('/admin/forms');
  await expect(page.getByText(fixture.title, { exact: true })).toHaveCount(0);
  await signOut(page);
  await login(page, fixture, 'member');
  const beforeForeign = await snapshot(fixture.foreignOrganization.id);
  const csrf = await (await page.request.get('/api/auth/csrf/')).json();
  const denied = await page.request.post('/api/forms/' + fixture.formId + '/deactivate/', {
    headers: { 'X-CSRFToken': csrf.csrfToken, 'X-Organization-Id': String(fixture.foreignOrganization.id) },
  });
  expect([403, 404]).toContain(denied.status());
  const afterForeign = await snapshot(fixture.foreignOrganization.id);
  expect({ ...afterForeign, capturedAt: '' }).toEqual({ ...beforeForeign, capturedAt: '' });
  const main = await evidence('tenant-denial', { foreignRowsUnchanged: true, deniedStatus: denied.status() });
  expect(main.forms[0].is_active).toBe(true);
});
