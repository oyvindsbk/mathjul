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

    await page.getByRole('link', { name: '← Forrige' }).click();
    await expect(title).not.toHaveText(current ?? '');
    await page.getByRole('link', { name: 'I dag' }).click();
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
