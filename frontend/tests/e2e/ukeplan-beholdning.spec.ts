import { test, expect, type Page } from '@playwright/test';
import { API, GROUP_ID, mockGroups, seedAuth } from './helpers/stock-api';
import { mockShoppingList } from './helpers/shopping-api';

const COVERAGE_URL = new RegExp(`${API}/api/groups/${GROUP_ID}/stock/week-coverage`);

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mondayKey(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  return dateKey(d);
}

// The 15th is always inside the current month's grid, never an overflow cell from a neighbouring month.
const PLAN_DAY = new Date(new Date().getFullYear(), new Date().getMonth(), 15);

async function mockPlanner(page: Page) {
  await page.route(`${API}/api/groups/${GROUP_ID}`, (route) =>
    route.fulfill({
      json: {
        id: GROUP_ID, name: 'Husholdning', ownerEmail: 'e2e@example.com',
        createdAt: new Date().toISOString(), mealPlanEnabled: true, members: [], recipes: [],
      },
    })
  );
  await page.route(`${API}/api/groups/${GROUP_ID}/mealplans**`, (route) =>
    route.fulfill({
      json: [
        {
          id: 11, groupId: GROUP_ID, date: dateKey(PLAN_DAY), recipeId: 700,
          recipe: {
            id: 700, title: 'Pasta carbonara', imageUrl: null, mealTypeCategory: 'Middag',
            mealTypeCategories: ['Middag'], sideDishTitles: [],
          },
          matkasseRecipeId: null, matkasseRecipe: null, customTitle: null, customNote: null,
          isCustom: false, createdByEmail: 'e2e@example.com',
        },
      ],
    })
  );
  await page.route(`${API}/api/recipes**`, (route) => route.fulfill({ json: [] }));
}

const coverage = {
  entries: [
    {
      mealPlanId: 11, date: dateKey(PLAN_DAY), title: 'Pasta carbonara', withoutIngredients: false,
      ingredients: [
        { name: 'spagetti', quantity: 400, unit: 'g', status: 'har', stockItemId: 1, stockName: 'Spagetti', stockQuantity: 500, stockUnit: 'g', sideDishTitle: null },
        { name: 'bacon', quantity: 150, unit: 'g', status: 'kanskje', stockItemId: 2, stockName: 'Baconterninger', stockQuantity: null, stockUnit: null, sideDishTitle: null },
        { name: 'egg', quantity: 4, unit: 'stk', status: 'mangler', stockItemId: null, stockName: null, stockQuantity: null, stockUnit: null, sideDishTitle: null },
      ],
    },
    {
      mealPlanId: 12, date: dateKey(PLAN_DAY), title: 'Pizza fra Adams Matkasse', withoutIngredients: true, ingredients: [],
    },
  ],
  missing: [
    { name: 'egg', normalizedName: 'egg', status: 'mangler', quantities: [{ quantity: 4, unit: 'stk' }], recipes: ['Pasta carbonara'] },
    {
      name: 'fløte', normalizedName: 'flote', status: 'mangler',
      quantities: [{ quantity: 2, unit: 'dl' }, { quantity: 1, unit: 'pk' }], recipes: ['Pasta carbonara'],
    },
    { name: 'bacon', normalizedName: 'bacon', status: 'kanskje', quantities: [{ quantity: 150, unit: 'g' }], recipes: ['Pasta carbonara'] },
  ],
};

test.describe('Ukesplanlegger med beholdning', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockGroups(page);
    await mockPlanner(page);
  });

  test('day modal shows which ingredients are at home', async ({ page }) => {
    await page.route(COVERAGE_URL, (route) => route.fulfill({ json: coverage }));
    await page.goto('/ukesplanlegger');

    await page.getByTestId('day-cell').filter({ hasText: /^15(?!\d)/ }).first().click();
    const modal = page.getByTestId('day-detail-modal');
    const summary = modal.getByText('Har 1 av 3, kanskje 1, mangler 1');
    await expect(summary).toBeVisible();

    await summary.click();
    const rows = modal.getByTestId('coverage-ingredient');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('har');
    await expect(rows.nth(1)).toContainText('kanskje');
    await expect(rows.nth(1)).toContainText('Baconterninger');
    await expect(rows.nth(2)).toContainText('mangler');
  });

  test('day modal still works when coverage cannot be loaded', async ({ page }) => {
    await page.route(COVERAGE_URL, (route) => route.fulfill({ status: 500, json: { error: 'feil' } }));
    await page.goto('/ukesplanlegger');

    await page.getByTestId('day-cell').filter({ hasText: /^15(?!\d)/ }).first().click();
    await expect(page.getByTestId('day-detail-modal')).toContainText('Pasta carbonara');
    await expect(page.getByTestId('ingredient-coverage')).toHaveCount(0);
  });

  test('week panel pre-checks what is missing and adds the checked items to the shopping list', async ({ page }) => {
    let requestedWeek: string | null = null;
    await page.route(COVERAGE_URL, (route) => {
      requestedWeek = new URL(route.request().url()).searchParams.get('weekStart');
      return route.fulfill({ json: coverage });
    });
    const shopping = await mockShoppingList(page);
    await page.goto('/ukesplanlegger');

    await page.getByTestId('week-missing-button').click();
    const panel = page.getByTestId('week-missing-panel');
    await expect(panel.getByTestId('missing-item')).toHaveCount(3);
    expect(requestedWeek).toBe(mondayKey(new Date()));

    await expect(panel.getByLabel(/egg/)).toBeChecked();
    await expect(panel.getByLabel(/fløte/)).toBeChecked();
    await expect(panel.getByLabel(/bacon/)).not.toBeChecked();
    await expect(panel.getByTestId('without-ingredients')).toContainText('Pizza fra Adams Matkasse');

    await panel.getByLabel(/egg/).uncheck();
    await panel.getByLabel(/bacon/).check();
    await panel.getByRole('button', { name: 'Legg på handlelisten' }).click();

    await expect(panel.getByRole('status')).toContainText('2 varer lagt på handlelisten');
    await expect(panel.getByRole('link', { name: 'Åpne handlelisten' })).toHaveAttribute('href', /view=beholdning.*tab=handleliste/);

    // Fløte is needed in two units, so it becomes two entries rather than a wrong sum.
    expect(shopping.items.map((i) => [i.name, i.quantity, i.unit, i.source])).toEqual([
      ['fløte', 2, 'dl', 'ukeplan'],
      ['fløte', 1, 'pk', 'ukeplan'],
      ['bacon', 150, 'g', 'ukeplan'],
    ]);
  });

  test('week panel says so when nothing is missing', async ({ page }) => {
    await page.route(COVERAGE_URL, (route) =>
      route.fulfill({ json: { entries: [{ ...coverage.entries[0] }], missing: [] } })
    );
    await page.goto('/ukesplanlegger');

    await page.getByTestId('week-missing-button').click();
    await expect(page.getByTestId('nothing-missing')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Legg på handlelisten' })).toBeDisabled();
  });

  test('week panel closes with Escape', async ({ page }) => {
    await page.route(COVERAGE_URL, (route) => route.fulfill({ json: { entries: [], missing: [] } }));
    await page.goto('/ukesplanlegger');

    await page.getByTestId('week-missing-button').click();
    await expect(page.getByText('Ingen måltider er planlagt denne uka.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('week-missing-panel')).toHaveCount(0);
  });
});

