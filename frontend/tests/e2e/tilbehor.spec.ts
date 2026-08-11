import { test, expect, type Page } from '@playwright/test';

/**
 * Tilbehør (side dishes).
 *
 * A recipe marked Tilbehør can be attached to other recipes. These tests create
 * their own tilbehør recipe, since no seeded recipe carries the category.
 */

const TILBEHOR_CATEGORY = 'Tilbehør';

/** Creates a recipe via the manual-entry tab and returns its detail URL. */
async function createRecipe(
  page: Page,
  title: string,
  options: { asTilbehor?: boolean } = {}
): Promise<string> {
  await page.goto('/last-opp-oppskrift');
  await page.getByRole('button', { name: 'Manuelt' }).click();

  await page.getByLabel('Tittel', { exact: false }).fill(title);

  if (options.asTilbehor) {
    await page.getByRole('button', { name: TILBEHOR_CATEGORY, exact: true }).click();
  }

  await page.getByRole('button', { name: 'Lagre oppskrift' }).click();
  await page.waitForURL((url) => !url.pathname.includes('last-opp-oppskrift'));

  return page.url();
}

/** Opens a recipe's edit page by navigating from its detail page. */
async function openEditPage(page: Page, recipeTitle: string) {
  await page.goto('/alle-oppskrifter');
  await page.getByText(recipeTitle, { exact: true }).first().click();
  await page.getByRole('link', { name: /rediger/i }).click();
}

test.describe('Tilbehør', () => {
  test('side-dish picker is hidden when the recipe is itself marked Tilbehør', async ({ page }) => {
    await page.goto('/recipes/1/edit');

    // A non-tilbehør recipe shows the picker (assuming at least one tilbehør exists).
    const picker = page.getByTestId('side-dish-picker');

    await page.getByRole('button', { name: TILBEHOR_CATEGORY, exact: true }).click();

    await expect(picker).toBeHidden();
  });

  test('attaching a tilbehør shows it on the main dish and links back', async ({ page }) => {
    const sideTitle = `E2E Ris ${Date.now()}`;
    const mainTitle = `E2E Tikka ${Date.now()}`;

    await createRecipe(page, sideTitle, { asTilbehor: true });
    const mainUrl = await createRecipe(page, mainTitle);

    // Attach the tilbehør from the main dish's edit form.
    await page.goto(`${mainUrl}/edit`);
    await expect(page.getByTestId('side-dish-picker')).toBeVisible();
    await page.getByRole('button', { name: sideTitle, exact: true }).click();
    await page.getByRole('button', { name: 'Lagre endringer' }).click();

    // Forward direction: the main dish lists its tilbehør.
    await page.goto(mainUrl);
    const sideDishes = page.getByTestId('side-dishes');
    await expect(sideDishes).toBeVisible();
    await expect(sideDishes.getByText(sideTitle)).toBeVisible();

    // Reverse direction: the tilbehør shows which dish uses it, read-only.
    await sideDishes.getByText(sideTitle).click();
    const usedIn = page.getByTestId('used-as-side-dish-in');
    await expect(usedIn).toBeVisible();
    await expect(usedIn.getByText(mainTitle)).toBeVisible();
  });

  test('tilbehør recipes are not offered in the ukesplanlegger picker', async ({ page }) => {
    const sideTitle = `E2E Naan ${Date.now()}`;
    await createRecipe(page, sideTitle, { asTilbehor: true });

    await page.goto('/ukesplanlegger');

    // The picker defaults to "Alle"; a tilbehør must not appear even there.
    const search = page.getByPlaceholder(/søk/i).first();
    await search.fill(sideTitle);

    await expect(page.getByText(sideTitle, { exact: true })).toHaveCount(0);
  });
});
