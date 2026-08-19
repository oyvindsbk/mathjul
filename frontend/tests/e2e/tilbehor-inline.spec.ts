import { test, expect, type Page } from '@playwright/test';

/**
 * Tilbehør merged inline (feature 044).
 *
 * The merge itself happens on the server and is covered by the backend tests. What is under
 * test here is the frontend contract around it, which the backend cannot see:
 *
 * - a side dish marked `Inline` must not also appear as a chip, since its content is on the
 *   page already
 * - a side dish marked `Link` keeps the chip and stays out of the sections
 * - the edit form must show the stored mode and send it back, or every save silently resets
 *   the choice to Lenke
 *
 * The API is stood in for, the same way `del-oppskrift.spec.ts` does it: the dev server the
 * suite runs against has no backend attached, so the responses are the fixture.
 */

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
const RECIPE_ID = 901;
const SIDE_DISH_ID = 902;
const MAIN_TITLE = 'E2E Tikka masala';
const SIDE_TITLE = 'E2E Ris';

/** Seeds a dev token so ProtectedRoute renders instead of bouncing to /login. */
async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    const b64 = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ email: 'e2e@example.com', exp })}.e2e`;
    localStorage.setItem('jwt_token', token);
    document.cookie = `auth_token=${token}; path=/; SameSite=Lax`;
  });
}

/**
 * The detail response as the API builds it for an Inline side dish: the sections arrive
 * already merged, and the side dish is still listed so the client can suppress its chip.
 */
function mergedRecipeJson() {
  return {
    id: RECIPE_ID,
    title: MAIN_TITLE,
    description: 'Hovedrett med innflettet tilbehør',
    ingredients: [],
    instructionSteps: [],
    ingredientSections: [
      { heading: MAIN_TITLE, ingredients: [{ quantity: 500, unit: 'g', name: 'kylling' }] },
      { heading: SIDE_TITLE, ingredients: [{ quantity: 2, unit: 'dl', name: 'basmatiris' }] },
    ],
    instructionSections: [
      { heading: MAIN_TITLE, steps: [{ text: 'Stek kyllingen', imageUrl: null }] },
      { heading: SIDE_TITLE, steps: [{ text: 'Kok risen', imageUrl: null }] },
    ],
    prepTime: 10,
    cookTime: '30 min',
    cookTimeMinutes: 30,
    servings: 4,
    quantityType: 'porsjoner',
    customUnit: null,
    imageUrl: null,
    categories: [],
    groups: [],
    tips: [],
    sideDishes: [{ id: SIDE_DISH_ID, title: SIDE_TITLE, imageUrl: null, displayMode: 'Inline' }],
    usedAsSideDishIn: [],
    ownerEmail: 'e2e@example.com',
    ownerDisplayName: 'E2E Eier',
    ownerUserId: null,
    visibility: 'Public',
  };
}

/** The same recipe with the side dish left as a link: nothing merged, chip kept. */
function linkedRecipeJson() {
  return {
    ...mergedRecipeJson(),
    ingredientSections: [],
    instructionSections: [],
    ingredients: [{ quantity: 500, unit: 'g', name: 'kylling' }],
    instructionSteps: [{ text: 'Stek kyllingen', imageUrl: null }],
    sideDishes: [{ id: SIDE_DISH_ID, title: SIDE_TITLE, imageUrl: null, displayMode: 'Link' }],
  };
}

/**
 * What `GET /api/recipes/{id}?merged=false` returns — the recipe's own lists, untouched.
 * The edit form reads this so saving cannot bake the tilbehør's content into the main dish.
 */
function unmergedRecipeJson() {
  return {
    ...mergedRecipeJson(),
    ingredientSections: [],
    instructionSections: [],
    ingredients: [{ quantity: 500, unit: 'g', name: 'kylling' }],
    instructionSteps: [{ text: 'Stek kyllingen', imageUrl: null }],
  };
}

/** Routes the detail read, honouring the `merged` flag the way the API does. */
async function mockDetail(page: Page, merged: object, unmerged: object) {
  await page.route(`${API}/api/recipes/${RECIPE_ID}*`, (route) => {
    const isUnmerged = route.request().url().includes('merged=false');
    return route.fulfill({ json: isUnmerged ? unmerged : merged });
  });
}

/** The tilbehør list the edit form's picker is built from. */
async function mockTilbehorList(page: Page) {
  await page.route(`${API}/api/recipes?**`, (route) =>
    route.fulfill({
      json: [{ id: SIDE_DISH_ID, title: SIDE_TITLE, imageUrl: null, categories: [{ id: 16, name: 'Tilbehør', group: 'Måltidstype' }] }],
    })
  );
  await page.route(`${API}/api/categories`, (route) => route.fulfill({ json: [] }));
}

test.describe('Tilbehør innflettet', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('an inline tilbehør renders as a section and not as a chip', async ({ page }) => {
    await mockDetail(page, mergedRecipeJson(), unmergedRecipeJson());

    await page.goto(`/recipes/${RECIPE_ID}`);
    await expect(page.getByRole('heading', { name: MAIN_TITLE, level: 1 })).toBeVisible();

    // The chip block is gone entirely — the only side dish is merged in.
    await expect(page.getByTestId('side-dishes')).toHaveCount(0);

    // The main dish keeps its own ingredients under a heading of its own, and the tilbehør
    // follows in a section named after it. Both headings appear twice (ingredients and
    // instructions), which is exactly the shape the merge is supposed to produce.
    await expect(page.getByRole('heading', { name: MAIN_TITLE, level: 3 })).toHaveCount(2);
    await expect(page.getByRole('heading', { name: SIDE_TITLE, level: 3 })).toHaveCount(2);

    // The layout renders the list for both mobile and desktop, so match the first.
    await expect(page.getByText('kylling', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('basmatiris', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Kok risen').first()).toBeVisible();
  });

  test('step numbering runs continuously into the inline tilbehør', async ({ page }) => {
    await mockDetail(page, mergedRecipeJson(), unmergedRecipeJson());

    await page.goto(`/recipes/${RECIPE_ID}`);

    // The tilbehør's step continues the main dish's numbering rather than restarting at 1.
    await expect(page.getByText('2.')).toBeVisible();
  });

  test('a Lenke tilbehør keeps its chip and stays out of the sections', async ({ page }) => {
    await mockDetail(page, linkedRecipeJson(), linkedRecipeJson());

    await page.goto(`/recipes/${RECIPE_ID}`);

    const sideDishes = page.getByTestId('side-dishes');
    await expect(sideDishes).toBeVisible();
    await expect(sideDishes.getByText(SIDE_TITLE)).toBeVisible();

    await expect(page.getByText('basmatiris')).toHaveCount(0);
  });

  test('the edit form shows the stored Innflettet choice', async ({ page }) => {
    await mockDetail(page, mergedRecipeJson(), unmergedRecipeJson());
    await mockTilbehorList(page);

    await page.goto(`/recipes/${RECIPE_ID}/edit`);

    const inlineButton = page.getByTestId(`side-dish-mode-inline-${SIDE_DISH_ID}`);
    await expect(inlineButton).toBeVisible();

    // Load-bearing: if this came back unpressed, saving would reset the mode to Lenke.
    await expect(inlineButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId(`side-dish-mode-link-${SIDE_DISH_ID}`)).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  test('the edit form loads the unmerged lists, not the merged view', async ({ page }) => {
    const requested: string[] = [];
    await page.route(`${API}/api/recipes/${RECIPE_ID}*`, (route) => {
      const url = route.request().url();
      requested.push(url);
      return route.fulfill({
        json: url.includes('merged=false') ? unmergedRecipeJson() : mergedRecipeJson(),
      });
    });
    await mockTilbehorList(page);

    await page.goto(`/recipes/${RECIPE_ID}/edit`);
    await expect(page.getByTestId('side-dish-picker')).toBeVisible();

    // Editing the merged view would copy the tilbehør's content into the main dish on save.
    expect(requested.some((url) => url.includes('merged=false'))).toBe(true);

    // The form holds the recipe's own ingredient, and none of the tilbehør's.
    await expect(page.locator('input[value="kylling"]')).toHaveCount(1);
    await expect(page.locator('input[value="basmatiris"]')).toHaveCount(0);
  });

  test('switching a tilbehør to Lenke sends it back without the inline id', async ({ page }) => {
    await mockDetail(page, mergedRecipeJson(), unmergedRecipeJson());
    await mockTilbehorList(page);

    let savedBody: { sideDishIds?: number[]; inlineSideDishIds?: number[] } | null = null;
    await page.route(`${API}/api/recipes/${RECIPE_ID}`, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      savedBody = route.request().postDataJSON();
      return route.fulfill({ json: unmergedRecipeJson() });
    });

    await page.goto(`/recipes/${RECIPE_ID}/edit`);
    await page.getByTestId(`side-dish-mode-link-${SIDE_DISH_ID}`).click();
    await page.getByRole('button', { name: 'Lagre endringer' }).click();

    await expect.poll(() => savedBody).not.toBeNull();
    expect(savedBody!.sideDishIds).toEqual([SIDE_DISH_ID]);
    expect(savedBody!.inlineSideDishIds).toEqual([]);
  });

  // The FAB that opens matlagingsmodus only exists on a phone-width viewport.
  test.describe('på mobil', () => {
    test.use({ viewport: { width: 375, height: 667 } });

  test('matlagingsmodus walks through the inline tilbehør steps too', async ({ page }) => {
    await mockDetail(page, mergedRecipeJson(), unmergedRecipeJson());

    await page.goto(`/recipes/${RECIPE_ID}`);
    await page.getByTestId('matlagingsmodus-fab').click();

    const overlay = page.getByTestId('matlagingsmodus-overlay');
    await expect(overlay).toBeVisible();

    // Both dishes' ingredients are in the guided run...
    await expect(overlay.getByText('kylling', { exact: true })).toBeVisible();
    await expect(overlay.getByText('basmatiris', { exact: true })).toBeVisible();

    // ...and so are their steps, which is the whole point: the tilbehør is no longer
    // stranded on another page while you are being walked through the main dish.
    await page.getByTestId('matlagingsmodus-tab-instruksjoner').click();
    await expect(overlay.getByRole('button', { name: /^Trinn 1:.*Stek kyllingen/ })).toBeVisible();
    await expect(overlay.getByRole('button', { name: /^Trinn 2:.*Kok risen/ })).toBeVisible();
  });
  });

  test('a shared link shows the inline tilbehør merged in', async ({ page }) => {
    const token = 'e2e-inline-token-abcdefghijkl';

    await page.route(`${API}/api/public/recipes/shared/*`, (route) => {
      const merged = mergedRecipeJson();
      return route.fulfill({
        json: {
          title: merged.title,
          description: merged.description,
          cookTime: merged.cookTime,
          cookTimeMinutes: merged.cookTimeMinutes,
          prepTime: merged.prepTime,
          imageUrl: null,
          servings: merged.servings,
          quantityType: merged.quantityType,
          customUnit: null,
          ingredients: [],
          instructionSteps: [],
          ingredientSections: merged.ingredientSections,
          instructionSections: merged.instructionSections,
          tips: [],
          // The API filters Inline side dishes out of this list server-side.
          sideDishes: [],
          ownerDisplayName: 'E2E Eier',
          updatedAt: new Date().toISOString(),
        },
      });
    });

    await page.goto(`/delt/${token}`);

    await expect(page.getByText('kylling', { exact: true })).toBeVisible();
    await expect(page.getByText('basmatiris', { exact: true })).toBeVisible();
    await expect(page.getByTestId('side-dishes')).toHaveCount(0);
  });
});
