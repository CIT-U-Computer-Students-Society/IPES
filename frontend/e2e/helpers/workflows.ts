import { expect, type Page } from '@playwright/test';
import type { Fixture } from './database';
import { flushCoverage } from './coverage';

export async function login(page: Page, fixture: Fixture, role = 'member', foreign = false) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).fill(fixture.users[role].email);
  await page.getByLabel('Password', { exact: true }).fill(fixture.users[role].password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Select Organization' })).toBeVisible();
  await page.getByText((foreign ? fixture.foreignOrganization : fixture.organization).name, { exact: true }).click();
  await expect(page).toHaveURL(/\/(admin|member)\/dashboard$/);
}

export async function signOut(page: Page) {
  await flushCoverage(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function submitEvaluation(page: Page, fixture: Fixture, draft = false) {
  await page.goto('/member/evaluations/' + fixture.assignmentId);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#q' + fixture.questionIds[0] + '-2').click();
  await page.locator('#q' + fixture.questionIds[1] + '-4').click();
  if (draft) {
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(page.getByText('Draft Saved', { exact: true })).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Submit', exact: true }).click();
  await expect(page).toHaveURL(/\/member\/evaluations$/);
}
