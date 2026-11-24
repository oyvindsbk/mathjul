import { expect, type Page } from '@playwright/test';

/** Signs in with the development login and lands on the current week. */
export async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Logg inn (utvikling)' }).click();
  await expect(page).toHaveURL(/\/uke\/\d{4}-W\d{2}$/);
}

/** Today's editor in the week view (today starts expanded). */
export function today(page: Page) {
  return page.locator('[data-testid^="day-"]').first();
}

/** Waits until every editor on the page has finished saving. */
export async function saved(page: Page) {
  await expect(page.locator('[data-saving="true"]')).toHaveCount(0);
}

export const unique = (label: string) => `${label} ${Date.now().toString(36)}`;
