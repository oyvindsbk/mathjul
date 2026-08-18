import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * Del oppskrift med lenke.
 *
 * The share API is stood in for, the same way ukesplanlegger-mobile does it: the
 * dev server the suite runs against has no backend attached, and the point under
 * test is the frontend contract — the owner gets a link, the link opens the
 * recipe with no chrome and no cookies, and a revoked link is a dead end.
 *
 * The share state lives in `shareState` below, shared by the owner's context and
 * the recipient's, so revoking in one really does break the link in the other.
 */

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
const RECIPE_ID = 1;
const RECIPE_TITLE = 'E2E Delt Gryte';
const TOKEN = 'e2e-share-token-abcdefghijklmnop';

interface ShareState {
  token: string | null;
}

/** Seeds a dev token so ProtectedRoute renders the owner's pages. */
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

function recipeJson() {
  return {
    id: RECIPE_ID,
    title: RECIPE_TITLE,
    description: 'En gryte til deling',
    ingredients: [{ quantity: 2, unit: 'dl', name: 'fløte' }],
    instructionSteps: [{ text: 'Kok opp', imageUrl: null }],
    ingredientSections: [],
    instructionSections: [],
    prepTime: 10,
    cookTime: '30 min',
    cookTimeMinutes: 30,
    servings: 4,
    quantityType: 'porsjoner',
    customUnit: null,
    imageUrl: null,
    categories: [],
    tips: [],
    sideDishes: [],
    ownerEmail: 'e2e@example.com',
    ownerDisplayName: 'E2E Eier',
    ownerUserId: null,
  };
}

/** The owner-facing detail page plus the three share endpoints. */
async function mockOwnerApi(page: Page, state: ShareState) {
  await page.route(`${API}/api/recipes/${RECIPE_ID}`, (route) =>
    route.fulfill({ json: recipeJson() })
  );

  await page.route(`${API}/api/recipes/${RECIPE_ID}/share`, async (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      // Idempotent, like the real endpoint: an existing token is returned as-is.
      state.token = state.token ?? TOKEN;
    } else if (method === 'DELETE') {
      state.token = null;
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({
      json: state.token
        ? {
            isShared: true,
            token: state.token,
            shareUrl: `http://localhost:3000/delt/${state.token}`,
            createdAt: new Date().toISOString(),
          }
        : { isShared: false, token: null, shareUrl: null, createdAt: null },
    });
  });
}

/** The public read, which 404s once the token has been revoked. */
async function mockPublicApi(page: Page, state: ShareState) {
  await page.route(`${API}/api/public/recipes/shared/*`, async (route) => {
    const token = decodeURIComponent(route.request().url().split('/').pop() ?? '');

    if (!state.token || token !== state.token) {
      return route.fulfill({
        status: 404,
        json: { message: 'Denne delingen finnes ikke lenger' },
      });
    }

    const recipe = recipeJson();
    return route.fulfill({
      json: {
        recipeId: RECIPE_ID,
        title: recipe.title,
        description: recipe.description,
        cookTime: recipe.cookTime,
        cookTimeMinutes: recipe.cookTimeMinutes,
        prepTime: recipe.prepTime,
        imageUrl: null,
        servings: recipe.servings,
        quantityType: recipe.quantityType,
        customUnit: null,
        ingredients: recipe.ingredients,
        instructionSteps: recipe.instructionSteps,
        ingredientSections: [],
        instructionSections: [],
        tips: [],
        sideDishes: ['Ris'],
        ownerDisplayName: 'E2E Eier',
      },
    });
  });
}

/**
 * A recipient's browser: a brand-new context, so it carries none of the owner's
 * cookies or localStorage. That is the property under test — the link has to
 * work for someone who has never logged in.
 */
async function openAsRecipient(browser: Browser, state: ShareState, url: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockPublicApi(page, state);
  await page.goto(url);
  return { context, page };
}

test.describe('Del oppskrift med lenke', () => {
  test('owner opens the modal and gets a link with a QR code', async ({ page }) => {
    const state: ShareState = { token: null };
    await seedAuth(page);
    await mockOwnerApi(page, state);

    await page.goto(`/recipes/${RECIPE_ID}`);
    await page.getByTestId('del-oppskrift-knapp').click();

    const link = page.getByTestId('del-oppskrift-lenke');
    await expect(link).toHaveValue(`http://localhost:3000/delt/${TOKEN}`);
    await expect(page.getByTestId('del-oppskrift-qr')).toBeVisible();

    // The warning is the whole point of the modal — an unauthenticated reader.
    await expect(page.getByText(/uten å logge inn/i)).toBeVisible();
  });

  test('copying the link confirms and puts the URL on the clipboard', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const state: ShareState = { token: null };
    await seedAuth(page);
    await mockOwnerApi(page, state);

    await page.goto(`/recipes/${RECIPE_ID}`);
    await page.getByTestId('del-oppskrift-knapp').click();
    await page.getByTestId('del-oppskrift-kopier').click();

    await expect(page.getByTestId('del-oppskrift-kopier')).toHaveText('Kopiert!');

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(`http://localhost:3000/delt/${TOKEN}`);
  });

  test('the link opens the recipe in a fresh context with no chrome', async ({
    page,
    browser,
  }) => {
    const state: ShareState = { token: null };
    await seedAuth(page);
    await mockOwnerApi(page, state);

    await page.goto(`/recipes/${RECIPE_ID}`);
    await page.getByTestId('del-oppskrift-knapp').click();
    const shareUrl = await page.getByTestId('del-oppskrift-lenke').inputValue();

    const { context, page: guest } = await openAsRecipient(browser, state, shareUrl);

    await expect(guest.getByTestId('delt-oppskrift')).toBeVisible();
    await expect(guest.getByRole('heading', { name: RECIPE_TITLE })).toBeVisible();
    await expect(guest.getByText('E2E Eier')).toBeVisible();

    // No login step, and none of the app chrome.
    expect(new URL(guest.url()).pathname).toContain('/delt/');
    await expect(guest.getByTestId('sidebar-title')).toHaveCount(0);
    await expect(guest.locator('[data-testid^="bottom-nav-"]')).toHaveCount(0);

    // Side dishes are text, not a way into a second recipe.
    await expect(guest.getByTestId('side-dishes').getByRole('link')).toHaveCount(0);

    await context.close();
  });

  test('the share page offers a link into the full recipe', async ({
    page,
    browser,
  }) => {
    const state: ShareState = { token: null };
    await seedAuth(page);
    await mockOwnerApi(page, state);

    await page.goto(`/recipes/${RECIPE_ID}`);
    await page.getByTestId('del-oppskrift-knapp').click();
    const shareUrl = await page.getByTestId('del-oppskrift-lenke').inputValue();

    const { context, page: guest } = await openAsRecipient(browser, state, shareUrl);

    const fullRecipeLink = guest.getByTestId('delt-full-oppskrift-lenke');
    await expect(fullRecipeLink).toBeVisible();
    // The label promises a login step, so it has to be there in the text.
    await expect(fullRecipeLink).toContainText('krever innlogging');
    await expect(fullRecipeLink).toHaveAttribute('href', `/recipes/${RECIPE_ID}`);

    // A plain <a>, so leaving the token-scoped share context is a full page load
    // rather than a client-side transition into an app shell this layout never
    // renders. Where the recipient lands afterwards is the auth layer's business
    // (middleware + ProtectedRoute) and is deliberately not asserted here: local
    // dev sets NEXT_PUBLIC_ALLOW_UNAUTHENTICATED, so a /login assertion would pass
    // or fail on env config rather than on this feature.
    expect(await fullRecipeLink.evaluate((el) => el.tagName)).toBe('A');

    await context.close();
  });

  test('revoking makes the link show the dead-link state', async ({ page, browser }) => {
    const state: ShareState = { token: null };
    await seedAuth(page);
    await mockOwnerApi(page, state);

    await page.goto(`/recipes/${RECIPE_ID}`);
    await page.getByTestId('del-oppskrift-knapp').click();
    const shareUrl = await page.getByTestId('del-oppskrift-lenke').inputValue();

    // The link works before the revoke.
    const before = await openAsRecipient(browser, state, shareUrl);
    await expect(before.page.getByTestId('delt-oppskrift')).toBeVisible();
    await before.context.close();

    // Turning sharing off is behind a confirm step.
    await page.getByTestId('del-oppskrift-slaa-av').click();
    await page.getByTestId('del-oppskrift-bekreft-av').click();
    await expect(page.getByTestId('del-oppskrift-avslatt')).toBeVisible();

    const after = await openAsRecipient(browser, state, shareUrl);
    await expect(after.page.getByTestId('delt-oppskrift-utlopt')).toBeVisible();
    await expect(after.page.getByTestId('delt-oppskrift')).toHaveCount(0);
    // A dead link is a friendly page, not a bounce to /login.
    expect(new URL(after.page.url()).pathname).not.toContain('/login');
    await after.context.close();
  });
});
