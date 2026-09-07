import { test, expect } from '@playwright/test';

/**
 * Velg bort alternativer i "Snurr mathjulet" før man snurrer.
 *
 * Runs against the real dev backend (Aspire), so the seeded recipe set can
 * vary — assertions are written against counts and the first option's title
 * rather than hardcoded mock-data titles.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '🚀 Dev Login (Fake)' }).click();
  await expect(page.getByRole('button', { name: 'dev@example.com' })).toBeVisible({ timeout: 60_000 });
  await page.goto('/snurr-mathjulet');
});

test.describe('Velg bort alternativer på Snurr mathjulet', () => {
  test('avhuking av et alternativ fjerner det fra hjulet, og Inkluder alle gjenoppretter utvalget', async ({ page }) => {
    const optionsList = page.getByText(/Alternativer på hjulet/);
    await expect(optionsList).toBeVisible({ timeout: 15_000 });

    const rows = page.locator('label').filter({ has: page.getByRole('checkbox') });
    const total = await rows.count();
    test.skip(total < 2, 'Trenger minst 2 oppskrifter i det seedede datasettet');

    await expect(optionsList).toContainText(`${total} av ${total}`);

    const firstRow = rows.first();
    const firstTitle = (await firstRow.locator('span').last().textContent())?.trim() ?? '';
    await firstRow.getByRole('checkbox').uncheck();

    await expect(optionsList).toContainText(`${total - 1} av ${total}`);

    await page.getByRole('button', { name: 'Snurr! 🎲' }).click();
    await expect(page.getByText('Dagens oppskrift')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: firstTitle, exact: true })).not.toBeVisible();

    await page.getByRole('button', { name: 'Inkluder alle' }).click();
    await expect(optionsList).toContainText(`${total} av ${total}`);
    await expect(firstRow.getByRole('checkbox')).toBeChecked();
  });

  test('for mange fravalgt viser sjekkliste og Inkluder alle i stedet for hjulet', async ({ page }) => {
    await expect(page.getByText(/Alternativer på hjulet/)).toBeVisible({ timeout: 15_000 });

    const rows = page.locator('label').filter({ has: page.getByRole('checkbox') });
    const total = await rows.count();
    test.skip(total < 2, 'Trenger minst 2 oppskrifter i det seedede datasettet');

    for (let i = 1; i < total; i++) {
      await rows.nth(i).getByRole('checkbox').uncheck();
    }

    await expect(page.getByText('Du har valgt bort for mange alternativer')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Snurr! 🎲' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Inkluder alle' }).click();
    await expect(page.getByRole('button', { name: 'Snurr! 🎲' })).toBeVisible();
  });
});
