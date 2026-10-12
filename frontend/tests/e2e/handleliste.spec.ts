import { test, expect } from '@playwright/test';
import { API, GROUP_ID, mockGroups, mockStock, seedAuth } from './helpers/stock-api';
import { mockShoppingList, type FakeShoppingItem } from './helpers/shopping-api';

const bread: FakeShoppingItem = {
  id: 1, name: 'Brød', quantity: 1, unit: 'stk', note: null, source: 'manuell', status: 'aapen',
};
const butter: FakeShoppingItem = {
  id: 2, name: 'Smør', quantity: 250, unit: 'g', note: null, source: 'ukeplan', status: 'aapen',
};

const SUGGESTIONS_URL = `${API}/api/groups/${GROUP_ID}/stock/suggestions?limit=10`;

test.describe('Handleliste', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockGroups(page);
    await mockStock(page);
  });

  test('adds an item and shows where it came from', async ({ page }) => {
    const state = await mockShoppingList(page, [butter]);
    await page.goto('/beholdning?tab=handleliste');

    await expect(page.getByTestId('shopping-item').filter({ hasText: 'Smør' })).toContainText('Fra ukeplanen');

    await page.getByLabel('Vare').fill('Melk');
    await page.getByLabel('Antall').fill('2');
    await page.getByLabel('Enhet').fill('l');
    await page.getByRole('button', { name: 'Legg til' }).click();

    await expect(page.getByTestId('shopping-open')).toContainText('Melk');
    await expect(page.getByTestId('shopping-open')).toContainText('2 l');
    expect(state.items.find((i) => i.name === 'Melk')).toMatchObject({ quantity: 2, unit: 'l' });
  });

  test('ticking moves an item to bought and unticking brings it back', async ({ page }) => {
    await mockShoppingList(page, [bread]);
    await page.goto('/beholdning?tab=handleliste');

    await page.getByLabel('Kjøpt: Brød').click();
    await expect(page.getByTestId('shopping-bought')).toContainText('Brød');
    await expect(page.getByTestId('shopping-open')).toHaveCount(0);

    await page.getByLabel('Angre kjøpt: Brød').click();
    await expect(page.getByTestId('shopping-open')).toContainText('Brød');
  });

  test('deletes an item', async ({ page }) => {
    const state = await mockShoppingList(page, [bread, butter]);
    await page.goto('/beholdning?tab=handleliste');

    await page.getByRole('button', { name: 'Slett Brød' }).click();
    await expect(page.getByTestId('shopping-item')).toHaveCount(1);
    expect(state.items.map((i) => i.name)).toEqual(['Smør']);
  });

  test('clears bought items', async ({ page }) => {
    await mockShoppingList(page, [{ ...bread, status: 'kjopt' }, butter]);
    await page.goto('/beholdning?tab=handleliste');

    await page.getByRole('button', { name: 'Tøm kjøpte' }).click();
    await expect(page.getByTestId('shopping-bought')).toHaveCount(0);
    await expect(page.getByTestId('shopping-open')).toContainText('Smør');
  });

  test('moves bought items to the chosen location', async ({ page }) => {
    const state = await mockShoppingList(page, [{ ...bread, status: 'kjopt' }]);
    await page.goto('/beholdning?tab=handleliste');

    await page.getByLabel('Legg i').selectOption('skap');
    await page.getByRole('button', { name: 'Legg kjøpte i beholdningen' }).click();

    await expect(page.getByRole('status')).toContainText('1 vare lagt i skap');
    await expect(page.getByTestId('shopping-bought')).toHaveCount(0);
    expect(state.moves).toEqual(['skap']);
  });

  test('shows an empty state', async ({ page }) => {
    await mockShoppingList(page);
    await page.goto('/beholdning?tab=handleliste');
    await expect(page.getByText('Handlelisten er tom.')).toBeVisible();
  });
});

test.describe('Forslag', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockGroups(page);
    await mockStock(page);
    await mockShoppingList(page);
  });

  test('lists suggestions with coverage and missing ingredients', async ({ page }) => {
    await page.route(SUGGESTIONS_URL, (route) =>
      route.fulfill({
        json: [
          {
            recipeId: 7, title: 'Pasta carbonara', imageUrl: null, score: 0.75,
            haveCount: 3, maybeCount: 0, missingCount: 1, missing: ['guanciale'], usesExpiring: ['egg'],
          },
          {
            recipeId: 8, title: 'Omelett', imageUrl: null, score: 1,
            haveCount: 2, maybeCount: 0, missingCount: 0, missing: [], usesExpiring: [],
          },
        ],
      })
    );
    await page.goto('/beholdning?tab=forslag');

    const first = page.getByTestId('suggestion').first();
    await expect(first).toContainText('Pasta carbonara');
    await expect(first).toContainText('75 %');
    await expect(first).toContainText('Mangler: guanciale');
    await expect(first).toContainText('Bruker opp: egg');
    await expect(first.getByRole('link', { name: 'Pasta carbonara' })).toHaveAttribute('href', '/recipes/7');
    await expect(page.getByTestId('suggestion').nth(1)).toContainText('100 %');
  });

  test('shows an empty state when nothing matches', async ({ page }) => {
    await page.route(SUGGESTIONS_URL, (route) => route.fulfill({ json: [] }));
    await page.goto('/beholdning?tab=forslag');
    await expect(page.getByTestId('suggestions-empty')).toBeVisible();
  });

  test('switching tabs updates the URL', async ({ page }) => {
    await page.route(SUGGESTIONS_URL, (route) => route.fulfill({ json: [] }));
    await page.goto('/beholdning');
    await page.getByTestId('tab-forslag').click();
    await expect(page).toHaveURL(/tab=forslag/);
    await page.getByTestId('tab-handleliste').click();
    await expect(page).toHaveURL(/tab=handleliste/);
  });
});
