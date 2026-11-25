import { expect, test } from '@playwright/test';
import { saved, signIn, today, unique } from './helpers';

test.describe('Notater', () => {
  test('pages require sign-in', async ({ page }) => {
    await page.goto('/prosjekter');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('today carries over open to-dos from the last day', async ({ page }) => {
    await signIn(page);
    const day = today(page);
    // The dev seed's last workday has two open to-dos and one done.
    const carried = day.getByTestId('item-row').filter({ hasText: /fra / });
    await expect(day.locator('textarea[aria-label="Oppgave"]').first()).toBeVisible();
    await expect(day.getByText('fra ', { exact: false }).first()).toBeVisible();
    expect(await carried.count()).toBeGreaterThan(0);
    await expect(day.locator('textarea').filter({ hasText: 'Sende statusoppdatering' })).toHaveCount(0);
  });

  test('keyboard: Enter adds a line, Tab indents, Ctrl+Enter ticks, and it persists', async ({ page }) => {
    await signIn(page);
    const day = today(page);
    const first = unique('Første');
    const second = unique('Andre');

    await day.getByTestId('group-Dagens TODOs').getByRole('button', { name: '+ Ny' }).click();
    await page.keyboard.type(first);
    await page.keyboard.press('Enter');
    await page.keyboard.type(second);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Control+Enter');
    // Blur to commit the text of the last line.
    await page.getByTestId('week-title').click();

    const secondRow = day.getByTestId('item-row').filter({ has: page.locator(`textarea:text-is("${second}")`) });
    await expect(secondRow).toHaveAttribute('data-state', 'Done');

    await saved(page);

    await page.reload();
    const rowAfter = today(page)
      .getByTestId('item-row')
      .filter({ has: page.locator(`textarea:text-is("${second}")`) });
    await expect(rowAfter).toHaveAttribute('data-state', 'Done');
    await expect(rowAfter).toHaveAttribute('style', /padding-left: 1\.5rem/);
    await expect(today(page).locator(`textarea:text-is("${first}")`)).toBeVisible();
  });

  test('an emptied line is removed with Backspace', async ({ page }) => {
    await signIn(page);
    const day = today(page);
    const text = unique('Slettes');

    await day.getByTestId('group-Dagens TODOs').getByRole('button', { name: '+ Ny' }).click();
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await page.getByTestId('week-title').click();

    await saved(page);

    await page.reload();
    await expect(today(page).locator(`textarea:text-is("${text}")`)).toHaveCount(1);
    await expect(today(page).getByTestId('item-row').filter({ has: page.locator('textarea:text-is("")') })).toHaveCount(0);
  });

  test('week navigation moves between weeks and back to today', async ({ page }) => {
    await signIn(page);
    const title = page.getByTestId('week-title');
    const current = await title.textContent();

    const main = page.getByRole('main');
    await main.getByRole('link', { name: '← Forrige' }).click();
    await expect(title).not.toHaveText(current ?? '');
    await main.getByRole('link', { name: 'I dag', exact: true }).click();
    await expect(title).toHaveText(current ?? '');
  });

  test('projects can be created, renamed and archived', async ({ page }) => {
    await signIn(page);
    const name = unique('E2E');
    const renamed = `${name} ny`;

    await page.goto('/prosjekter');
    await page.getByLabel('Navn på nytt prosjekt').fill(name);
    await page.getByRole('button', { name: 'Legg til' }).click();
    const row = page.getByTestId('project-row').filter({ has: page.locator(`input[value="${name}"]`) });
    await expect(row).toBeVisible();

    await row.locator('input').fill(renamed);
    await row.locator('input').press('Enter');
    const renamedRow = page.getByTestId('project-row').filter({ has: page.locator(`input[value="${renamed}"]`) });
    await expect(renamedRow).toBeVisible();

    await page.goto('/');
    await expect(today(page).getByTestId(`group-${renamed}`)).toBeVisible();

    await page.goto('/prosjekter');
    await renamedRow.getByRole('button', { name: 'Arkiver' }).click();
    await expect(renamedRow.getByText('Arkivert')).toBeVisible();

    await page.goto('/');
    await expect(today(page).getByTestId(`group-${renamed}`)).toHaveCount(0);
  });

  test('an item can be moved to another project', async ({ page }) => {
    await signIn(page);
    const day = today(page);
    const text = unique('Flyttes');

    await day.getByTestId('group-Dagens TODOs').getByRole('button', { name: '+ Ny' }).click();
    await page.keyboard.type(text);
    await page.getByTestId('week-title').click();
    await saved(page);

    const row = day.getByTestId('item-row').filter({ has: page.locator(`textarea:text-is("${text}")`) });
    await row.getByLabel('Prosjekt').selectOption({ label: 'Jobb' });
    await saved(page);

    await expect(day.getByTestId('group-Jobb').locator(`textarea:text-is("${text}")`)).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  });

  test('old /kontekster links land on /prosjekter', async ({ page }) => {
    await signIn(page);
    await page.goto('/kontekster');
    await expect(page).toHaveURL(/\/prosjekter$/);
    await expect(page.getByRole('heading', { name: 'Prosjekter' })).toBeVisible();
  });

  test('the header has one home link and no "Denne uka"', async ({ page }) => {
    await signIn(page);
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Notater' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Prosjekter' })).toBeVisible();
    await expect(header.getByText('Denne uka')).toHaveCount(0);
  });

  test('a new project gets a color that can be changed and shows on the day', async ({ page }) => {
    await signIn(page);
    const name = unique('Farge');

    await page.goto('/prosjekter');
    await page.getByLabel('Navn på nytt prosjekt').fill(name);
    await page.getByRole('button', { name: 'Legg til' }).click();
    const row = page.getByTestId('project-row').filter({ has: page.locator(`input[value="${name}"]`) });
    await expect(row.getByTestId('color-swatch')).not.toHaveAttribute('data-color', '');

    await row.getByRole('button', { name: `Farge for ${name}` }).click();
    await page.getByRole('group', { name: `Velg farge for ${name}` }).getByRole('button', { name: 'Lilla' }).click();
    await expect(row.getByTestId('color-swatch')).toHaveAttribute('data-color', 'purple');

    await page.reload();
    await expect(row.getByTestId('color-swatch')).toHaveAttribute('data-color', 'purple');

    await page.goto('/');
    await expect(today(page).getByTestId(`group-${name}`)).toHaveAttribute('data-color', 'purple');

    // Tidy up so the project does not show on every later day.
    await page.goto('/prosjekter');
    await row.getByRole('button', { name: 'Arkiver' }).click();
    await expect(row.getByText('Arkivert')).toBeVisible();
  });

  test('the sidebar opens a day and marks it as the current page', async ({ page }) => {
    await signIn(page);
    const sidebar = page.getByTestId('sidebar');
    const week = page.url().split('/uke/')[1];
    const days = sidebar.getByTestId(`sidebar-week-${week}`).locator('[data-testid^="sidebar-day-"]');
    await expect(days.first()).toBeVisible();

    const monday = days.first();
    const date = (await monday.getAttribute('data-testid'))!.replace('sidebar-day-', '');
    await monday.click();

    await expect(page).toHaveURL(new RegExp(`/dag/${date}$`));
    await expect(sidebar.getByTestId(`sidebar-day-${date}`)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId(`day-${date}`)).toBeVisible();
  });

  test('the sidebar loads older weeks on demand', async ({ page }) => {
    await signIn(page);
    const weeks = page.getByTestId('sidebar').locator('[data-testid^="sidebar-week-"]');
    await expect(weeks).toHaveCount(8);
    await page.getByRole('button', { name: 'Eldre uker' }).click();
    await expect(weeks).toHaveCount(16);
  });

  test('the API proxy does not expose the API sign-in endpoints', async ({ request }) => {
    const response = await request.post('/api/proxy/auth/dev-token', {
      headers: { authorization: 'Bearer anything' },
    });
    expect(response.status()).toBe(404);
  });

  test('the API proxy rejects requests without a session', async ({ request }) => {
    const response = await request.get('/api/proxy/projects');
    expect(response.status()).toBe(401);
  });
});
