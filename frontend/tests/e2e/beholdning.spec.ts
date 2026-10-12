import { test, expect } from '@playwright/test';
import { dateFromToday, mockGroups, mockStock, seedAuth, type FakeStockItem } from './helpers/stock-api';

const milk: FakeStockItem = {
  id: 1,
  name: 'Melk',
  quantity: 2,
  unit: 'l',
  location: 'kjoleskap',
  bestBefore: dateFromToday(1),
  isStaple: false,
};
const peas: FakeStockItem = {
  id: 2,
  name: 'Erter',
  quantity: 1,
  unit: 'pk',
  location: 'fryser',
  bestBefore: null,
  isStaple: false,
};
const salt: FakeStockItem = {
  id: 3,
  name: 'Salt',
  quantity: null,
  unit: null,
  location: 'skap',
  bestBefore: null,
  isStaple: true,
};

test.describe('Beholdning', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockGroups(page);
  });

  test('groups items by location and flags best-before dates', async ({ page }) => {
    await mockStock(page, [
      milk,
      peas,
      salt,
      { ...milk, id: 4, name: 'Yoghurt', quantity: 1, unit: 'stk', bestBefore: dateFromToday(-2) },
    ]);
    await page.goto('/beholdning');

    await expect(page.getByRole('heading', { name: 'Beholdning', level: 1 })).toBeVisible();
    await expect(page.getByTestId('stock-location-kjoleskap')).toContainText('Melk');
    await expect(page.getByTestId('stock-location-fryser')).toContainText('Erter');
    await expect(page.getByTestId('stock-location-skap')).toContainText('Salt');
    await expect(page.getByTestId('stock-location-skap')).toContainText('Basisvare');

    const milkRow = page.getByTestId('stock-item').filter({ hasText: 'Melk' });
    await expect(milkRow).toContainText('2 l');
    await expect(milkRow).toContainText('Går snart ut');
    await expect(page.getByTestId('stock-item').filter({ hasText: 'Yoghurt' })).toContainText('Utløpt');
  });

  test('shows an empty state', async ({ page }) => {
    await mockStock(page);
    await page.goto('/beholdning');
    await expect(page.getByText('Ingen varer registrert ennå')).toBeVisible();
  });

  test('adds, edits and deletes an item', async ({ page }) => {
    const items = await mockStock(page);
    await page.goto('/beholdning');

    await page.getByTestId('stock-add').click();
    await page.getByLabel('Navn').fill('Egg');
    await page.getByLabel('Antall').fill('12');
    await page.getByLabel('Enhet').fill('stk');
    await page.getByLabel('Plassering').selectOption('kjoleskap');
    await page.getByRole('button', { name: 'Lagre' }).click();

    const row = page.getByTestId('stock-item').filter({ hasText: 'Egg' });
    await expect(row).toContainText('12 stk');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Egg', quantity: 12, unit: 'stk', location: 'kjoleskap' });

    await page.getByRole('button', { name: 'Endre Egg' }).click();
    await page.getByLabel('Antall').fill('6');
    await page.getByLabel('Plassering').selectOption('annet');
    await page.getByRole('button', { name: 'Lagre' }).click();

    await expect(page.getByTestId('stock-location-annet')).toContainText('6 stk');
    expect(items[0]).toMatchObject({ quantity: 6, location: 'annet' });

    await page.getByRole('button', { name: 'Slett Egg' }).click();
    await expect(page.getByTestId('stock-item')).toHaveCount(0);
    expect(items).toHaveLength(0);
  });

  test('a staple is saved without quantity and unit', async ({ page }) => {
    const items = await mockStock(page);
    await page.goto('/beholdning');

    await page.getByTestId('stock-add').click();
    await page.getByLabel('Navn').fill('Olivenolje');
    await page.getByLabel('Antall').fill('3');
    await page.getByLabel(/Basisvare/).check();
    await expect(page.getByLabel('Antall')).toHaveCount(0);
    await page.getByRole('button', { name: 'Lagre' }).click();

    await expect(page.getByTestId('stock-item').filter({ hasText: 'Olivenolje' })).toContainText('Basisvare');
    expect(items[0]).toMatchObject({ name: 'Olivenolje', quantity: null, unit: null, isStaple: true });
  });

  test('refuses an empty name and shows server errors', async ({ page }) => {
    await mockStock(page);
    await page.route(/\/api\/groups\/1\/stock$/, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 400, json: { error: 'Navn er for langt' } })
        : route.fallback()
    );
    await page.goto('/beholdning');

    await page.getByTestId('stock-add').click();
    await page.getByRole('button', { name: 'Lagre' }).click();
    await expect(page.getByTestId('stock-form').getByRole('alert')).toHaveText('Skriv et navn');

    await page.getByLabel('Navn').fill('Noe');
    await page.getByRole('button', { name: 'Lagre' }).click();
    await expect(page.getByTestId('stock-form').getByRole('alert')).toHaveText('Navn er for langt');
  });

  test('is reachable from the navigation', async ({ page }) => {
    await mockStock(page);
    await page.goto('/');
    const link = page.getByTestId('nav-beholdning').or(page.getByTestId('bottom-nav-beholdning')).first();
    await link.click();
    await expect(page).toHaveURL(/\/beholdning/);
  });
});
