import { test, expect } from '@playwright/test';

/**
 * Søk i "Alle oppskrifter" + kompakt filtrering.
 *
 * The dev server runs against mock data (NEXT_PUBLIC_MOCK_DATA=true), so
 * these tests search over the fixed mock recipe set rather than creating
 * their own recipes: "Classic Spaghetti Carbonara", "Chicken Tikka Masala",
 * "Chocolate Chip Cookies", "Caesar Salad".
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '🚀 Dev Login (Fake)' }).click();
  await expect(page.getByText('dev@example.com')).toBeVisible({ timeout: 60_000 });
  await page.goto('/alle-oppskrifter');
});

test.describe('Søk og filtrering på forsiden', () => {
  test('søk filtrerer rutenettet på tittel', async ({ page }) => {
    const search = page.getByPlaceholder('Søk i oppskrifter …');
    await search.fill('Carbonara');
    await search.blur();

    const grid = page.getByTestId('recipe-grid');
    await expect(grid).toContainText('Classic Spaghetti Carbonara');
    await expect(grid).not.toContainText('Caesar Salad');
  });

  test('søk uten treff viser tom-tilstand med nullstill-knapp', async ({ page }) => {
    const search = page.getByPlaceholder('Søk i oppskrifter …');
    await search.fill(`Ingen oppskrift heter dette ${Date.now()}`);

    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState.getByText('Ingen oppskrifter matcher søket')).toBeVisible();

    await emptyState.getByRole('button', { name: 'Nullstill søk og filtre' }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByTestId('recipe-grid')).toBeVisible();
  });

  test('nedtrekkslisten viser treff og navigerer ved klikk', async ({ page }) => {
    const search = page.getByPlaceholder('Søk i oppskrifter …');
    await search.fill('Chicken');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const option = listbox.getByRole('option', { name: 'Chicken Tikka Masala' });
    await expect(option).toBeVisible();

    await option.click();
    await expect(page).toHaveURL(/\/recipes\/2$/);
  });

  test('nedtrekkslisten støtter tastaturnavigasjon og Escape', async ({ page }) => {
    const search = page.getByPlaceholder('Søk i oppskrifter …');
    await search.fill('Ch');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    await search.press('ArrowDown');
    await expect(search).toHaveAttribute('aria-activedescendant', /search-suggestion-/);

    await search.press('Escape');
    await expect(listbox).toBeHidden();
    await expect(search).toHaveValue('Ch');
  });

  test('synlighetsvalg inne i trekkspillet filtrerer rutenettet', async ({ page }) => {
    const filterToggle = page.getByTestId('filter-toggle');
    await filterToggle.click();
    await page.getByRole('button', { name: '❤️ Favoritter' }).click();

    // None of the mock recipes are liked by default.
    await expect(page.getByTestId('empty-state')).toBeVisible();
  });

  test('teller-badgen viser riktig antall aktive filtre', async ({ page }) => {
    const filterToggle = page.getByTestId('filter-toggle');
    await filterToggle.click();

    await page.getByRole('button', { name: '❤️ Favoritter' }).click();
    await expect(filterToggle).toContainText('1');

    const categoryButton = page.getByRole('button', { name: 'Middag', exact: true });
    await expect(categoryButton).toBeVisible();
    await categoryButton.click();
    await expect(filterToggle).toContainText('2');
  });

  test('delt URL med q og vis gjenoppretter tilstand og åpner trekkspillet', async ({ page }) => {
    await page.goto('/alle-oppskrifter?q=carbonara&vis=public');

    const search = page.getByPlaceholder('Søk i oppskrifter …');
    await expect(search).toHaveValue('carbonara');

    await expect(page.getByRole('button', { name: '🌍 Offentlig' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🌍 Offentlig' })).toHaveClass(/bg-blue-500/);

    await expect(page.getByTestId('recipe-grid')).toContainText('Classic Spaghetti Carbonara');
  });

  test('q alene i URL åpner ikke trekkspillet', async ({ page }) => {
    await page.goto('/alle-oppskrifter?q=suppe');

    await expect(page.getByRole('button', { name: '🌍 Offentlig' })).not.toBeVisible();
  });
});
