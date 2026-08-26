import { test, expect, type Page } from '@playwright/test';

/**
 * Entering ingredient quantities as fractions, and reading them back.
 *
 * Mock recipe 1 ("Classic Spaghetti Carbonara") is the fixture: a flat
 * ingredient list led by "400 g spaghetti".
 *
 * Quantities are stored as decimals — a fraction is notation applied at the
 * edges. These tests drive the real form for input, and assert on display
 * through the mention picker's preview line, which formats an ingredient with
 * the same helper the recipe views use. A save needs a backend this suite does
 * not have.
 */

/** Seed a token before any page script runs; the edit page is behind ProtectedRoute. */
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

async function openEditForm(page: Page) {
  await seedAuth(page);
  await page.goto('/recipes/1/edit');
  await expect(page.getByRole('heading', { name: 'Rediger oppskrift' })).toBeVisible();
  await expect(page.getByTestId('instruction-text-0')).toBeVisible();
}

/** The first ingredient row's quantity field. */
function quantityField(page: Page) {
  return page.getByLabel('Mengde').first();
}

test.describe('Fraction input', () => {
  test('a simple fraction is accepted and kept as a fraction', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('1/4');
    await qty.blur();

    // Round-trips as typed rather than turning into 0.25.
    await expect(qty).toHaveValue('1/4');
    await expect(qty).toHaveAttribute('aria-invalid', 'false');
  });

  test('a mixed number is accepted', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('1 1/2');
    await qty.blur();

    await expect(qty).toHaveValue('1 1/2');
    await expect(qty).toHaveAttribute('aria-invalid', 'false');
  });

  test('a decimal is normalised to a fraction when it is a common one', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('0,5');
    await qty.blur();

    await expect(qty).toHaveValue('1/2');
  });

  test('an uncommon decimal stays a decimal', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('0.35');
    await qty.blur();

    // 7/20 would be worse to read than 0.35, so no fraction is forced.
    await expect(qty).toHaveValue('0.35');
    await expect(qty).toHaveAttribute('aria-invalid', 'false');
  });

  test('partial input is not rewritten while typing', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('');
    // "1/4" passes through "1" and "1/"; neither may reset the field.
    await qty.pressSequentially('1/4');
    await expect(qty).toHaveValue('1/4');
  });
});

test.describe('Invalid input', () => {
  test('a zero denominator is flagged and blocks saving', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('1/0');
    await qty.blur();

    await expect(qty).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('button', { name: 'Lagre endringer' })).toBeDisabled();
    // Scoped by text: Next.js's route announcer also carries role="alert".
    await expect(
      page.getByRole('alert').filter({ hasText: 'Rett opp ugyldig mengde' })
    ).toBeVisible();
  });

  test('correcting an invalid quantity re-enables saving', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('abc');
    await qty.blur();
    await expect(page.getByRole('button', { name: 'Lagre endringer' })).toBeDisabled();

    await qty.fill('1/4');
    await qty.blur();

    await expect(qty).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByRole('button', { name: 'Lagre endringer' })).toBeEnabled();
  });

  test('an empty quantity is valid — not every ingredient has an amount', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('');
    await qty.blur();

    await expect(qty).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByRole('button', { name: 'Lagre endringer' })).toBeEnabled();
  });
});

test.describe('Fraction display', () => {
  test('a fractional quantity renders as a fraction in the mention preview', async ({ page }) => {
    await openEditForm(page);

    const qty = quantityField(page);
    await qty.fill('1/4');
    await qty.blur();

    // The picker previews the ingredient through the same formatting helper
    // the recipe views use, so this covers display without a backend.
    const field = page.getByTestId('instruction-text-0');
    await field.fill('Cook the pasta');
    await field.pressSequentially(' @spag');

    const picker = page.getByTestId('mention-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('option').first()).toContainText('1/4 g');
  });
});
