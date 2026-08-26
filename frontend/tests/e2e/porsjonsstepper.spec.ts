import { test, expect, type Page } from '@playwright/test';

/**
 * The servings stepper on the recipe page.
 *
 * Mock recipe 1 ("Classic Spaghetti Carbonara") serves 4 and leads with
 * "400 g spaghetti".
 *
 * Stepping is snapped to the whole-number grid, with a half portion as the
 * floor. The regression these tests guard: stepping down to 0.5 and back up
 * used to land on 1.5, because the step was a plain ±1 from an off-grid value.
 */

/** Seed a token before any page script runs; the recipe page is behind ProtectedRoute. */
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

async function openRecipe(page: Page) {
  await seedAuth(page);
  await page.goto('/recipes/1');
  await expect(page.getByRole('button', { name: 'Flere' }).first()).toBeVisible();
}

function stepper(page: Page) {
  return {
    less: page.getByRole('button', { name: 'Færre' }).first(),
    more: page.getByRole('button', { name: 'Flere' }).first(),
    value: page.getByRole('spinbutton', { name: 'Antall' }).first(),
  };
}

test.describe('Servings stepper', () => {
  test('stepping down to the half portion and back up returns to 1', async ({ page }) => {
    await openRecipe(page);
    const { less, more, value } = stepper(page);

    await value.fill('2');
    await less.click();
    await expect(value).toHaveValue('1');
    await less.click();
    await expect(value).toHaveValue('0.5');

    // The regression: this used to give 1.5.
    await more.click();
    await expect(value).toHaveValue('1');
    await more.click();
    await expect(value).toHaveValue('2');
  });

  test('the half portion is the floor and the button stops there', async ({ page }) => {
    await openRecipe(page);
    const { less, value } = stepper(page);

    await value.fill('1');
    await less.click();
    await expect(value).toHaveValue('0.5');
    await expect(less).toBeDisabled();
  });

  test('an off-grid value snaps back onto whole numbers', async ({ page }) => {
    await openRecipe(page);
    const { less, more, value } = stepper(page);

    // Typed by hand rather than stepped into.
    await value.fill('1.5');
    await more.click();
    await expect(value).toHaveValue('2');

    await value.fill('1.5');
    await less.click();
    await expect(value).toHaveValue('1');
  });

  test('halving twice shows a sixteenth rather than a decimal', async ({ page }) => {
    await openRecipe(page);
    const { value } = stepper(page);

    // 400 g spaghetti at 4 servings, scaled to a half portion.
    await value.fill('0.5');
    await expect(page.getByText('50 g', { exact: false }).first()).toBeVisible();
  });
});
