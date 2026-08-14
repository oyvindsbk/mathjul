import { test, expect } from '@playwright/test';

/**
 * Min side (/profil) and other users' profiles (/profil/[userId]).
 *
 * The favourites route was folded into /profil, so these also guard that the
 * navigation no longer points at the removed page.
 */

test.describe('Min side', () => {
  test('shows favourites and own recipes as separate sections', async ({ page }) => {
    await page.goto('/profil');

    await expect(page.getByTestId('profil-favoritter')).toBeVisible();
    await expect(page.getByTestId('profil-mine-oppskrifter')).toBeVisible();

    // Favourites come first, per the agreed layout.
    const sections = page.locator('[data-testid^="profil-"]');
    await expect(sections.first()).toHaveAttribute('data-testid', 'profil-favoritter');
  });

  test('edits the profile on its own page, not inline', async ({ page }) => {
    await page.goto('/profil');

    // The form lives on /profil/rediger now.
    await expect(page.getByLabel('Kallenavn')).toHaveCount(0);

    await page.getByTestId('rediger-profil').click();
    await expect(page).toHaveURL(/\/profil\/rediger$/);

    await expect(page.getByLabel('Navn')).toBeVisible();
    await expect(page.getByLabel('Kallenavn')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lagre' })).toBeVisible();
  });

  test('cancelling the edit returns to Min side', async ({ page }) => {
    await page.goto('/profil/rediger');

    await page.getByRole('link', { name: 'Avbryt' }).click();

    await expect(page).toHaveURL(/\/profil$/);
  });

  test('is reachable from the sidebar as "Min side"', async ({ page }) => {
    await page.goto('/');

    const link = page.getByTestId('nav-min-side');
    await expect(link).toBeVisible();

    await link.click();
    await expect(page).toHaveURL(/\/profil$/);
  });

  test('no longer exposes a favourites nav link', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('nav-favoritter')).toHaveCount(0);
  });
});

test.describe('Andres profil', () => {
  test('unknown user id renders a not-found message', async ({ page }) => {
    await page.goto('/profil/999999');

    await expect(page.getByTestId('profil-ikke-funnet')).toBeVisible();
  });

  test('shows only a recipe section, no favourites or settings', async ({ page }) => {
    // User 1 is the account the dev login provisions.
    await page.goto('/profil/1');

    // Either the profile renders, or it redirects to /profil when id 1 is you.
    await page.waitForLoadState('networkidle');

    if (new URL(page.url()).pathname === '/profil') {
      test.skip(true, 'User 1 is the signed-in user; covered by the Min side tests.');
    }

    await expect(page.getByTestId('profil-brukers-oppskrifter')).toBeVisible();
    await expect(page.getByTestId('profil-favoritter')).toHaveCount(0);
    // No edit affordance on someone else's profile.
    await expect(page.getByTestId('rediger-profil')).toHaveCount(0);
  });
});
