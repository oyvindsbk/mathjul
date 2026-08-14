import { test, expect, devices } from '@playwright/test';

/**
 * Matlagingsmodus on a phone.
 *
 * Pinned to 375px because the entry point is viewport-conditional: the floating
 * button is the mobile route in, while desktop gets an inline button instead.
 * The desktop projects cannot see the mobile path at all.
 *
 * Runs against mock recipe 1 ("Classic Spaghetti Carbonara"), which has a flat
 * ingredient list and five flat instruction steps.
 */
test.use({ ...devices['Pixel 5'], viewport: { width: 375, height: 667 } });

/**
 * Seed a token before any page script runs.
 *
 * ProtectedRoute redirects to /login whenever AuthContext has no token, and
 * AuthContext reads it from localStorage on mount — so without this every
 * navigation lands on the login page. The value is never verified client-side
 * (AuthContext only stores it, and its ensure-user call already swallows
 * failures), so a structurally valid dev token is enough and no backend is
 * needed.
 */
async function seedAuth(page: import('@playwright/test').Page) {
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
 * Assert the overlay is dismissed.
 *
 * It stays mounted when closed and hides via opacity, which Playwright still
 * counts as "visible" — only display:none, visibility:hidden and zero size are
 * not. So assert the properties that actually matter: it is out of the
 * accessibility tree and cannot receive taps.
 */
async function expectOverlayClosed(page: import('@playwright/test').Page) {
  const overlay = page.getByTestId('matlagingsmodus-overlay');
  await expect(overlay).toHaveAttribute('inert', '');
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  await expect(overlay).toHaveCSS('pointer-events', 'none');
}

/** The FAB is always visible on mobile — no scrolling needed to reach it. */
async function openViaFab(page: import('@playwright/test').Page) {
  await page.goto('/recipes/1');
  await expect(page.getByRole('heading', { name: 'Classic Spaghetti Carbonara' })).toBeVisible();

  const fab = page.getByTestId('matlagingsmodus-fab');
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(page.getByTestId('matlagingsmodus-overlay')).toBeVisible();
}

test.describe('Matlagingsmodus', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    // Progress persists by design, so each test starts from a clean store.
    await page.goto('/recipes/1');
    await page.evaluate(() => {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith('matlagingsmodus:')) localStorage.removeItem(k);
      }
    });
  });

  /**
   * Regression: the FAB used to reveal only once the ingredients section
   * scrolled clear of the viewport. On a phone that section is the full-width
   * ingredients card, so on a long recipe it never cleared and matlagingsmodus
   * had no reachable entry point at all. Assert it is tappable at first paint,
   * before any scrolling.
   */
  test('floating button is visible without scrolling', async ({ page }) => {
    await page.goto('/recipes/1');
    await expect(page.getByRole('heading', { name: 'Classic Spaghetti Carbonara' })).toBeVisible();

    await expect(page.evaluate(() => window.scrollY)).resolves.toBe(0);

    const fab = page.getByTestId('matlagingsmodus-fab');
    await expect(fab).toBeVisible();
    await expect(fab).toHaveCSS('opacity', '1');
    await fab.click();
    await expect(page.getByTestId('matlagingsmodus-overlay')).toBeVisible();
  });

  test('opens from the floating button and shows both tabs', async ({ page }) => {
    await openViaFab(page);

    await expect(page.getByRole('tab', { name: 'Ingredienser' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Slik gjør du' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('button', { name: '400 g spaghetti' })).toBeVisible();
  });

  test('switching tabs swaps the panel and moves aria-selected', async ({ page }) => {
    await openViaFab(page);

    await page.getByTestId('matlagingsmodus-tab-instruksjoner').click();

    await expect(page.getByRole('tab', { name: 'Slik gjør du' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Ingredienser' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('button', { name: /^Trinn 1:/ })).toBeVisible();
  });

  test('ticked ingredients and steps survive a reload', async ({ page }) => {
    await openViaFab(page);

    const ingredient = page.getByRole('button', { name: '400 g spaghetti' });
    await ingredient.click();
    await expect(ingredient).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('matlagingsmodus-tab-instruksjoner').click();
    const step = page.getByRole('button', { name: /^Trinn 2:/ });
    await step.click();
    await expect(step).toHaveAttribute('aria-pressed', 'true');

    // The claim that matters at the stove: progress outlives the page.
    await openViaFab(page);
    await expect(page.getByRole('button', { name: '400 g spaghetti' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('matlagingsmodus-tab-instruksjoner').click();
    await expect(page.getByRole('button', { name: /^Trinn 2:/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a step ticked in the overlay shows as ticked on the page behind', async ({ page }) => {
    await openViaFab(page);

    await page.getByTestId('matlagingsmodus-tab-instruksjoner').click();
    await page.getByRole('button', { name: /^Trinn 3:/ }).click();
    await page.getByTestId('matlagingsmodus-close').click();

    await expect(page.locator('#step-3')).toBeChecked();
  });

  test('Begynn på nytt clears both lists', async ({ page }) => {
    await openViaFab(page);

    await page.getByRole('button', { name: '400 g spaghetti' }).click();
    await page.getByTestId('matlagingsmodus-tab-instruksjoner').click();
    await page.getByRole('button', { name: /^Trinn 1:/ }).click();

    await page.getByTestId('matlagingsmodus-reset').click();

    await expect(page.getByRole('button', { name: /^Trinn 1:/ })).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('matlagingsmodus-tab-ingredienser').click();
    await expect(page.getByRole('button', { name: '400 g spaghetti' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('Escape closes the overlay and restores page scrolling', async ({ page }) => {
    await openViaFab(page);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');

    await expectOverlayClosed(page);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });

  test('the backdrop closes the overlay', async ({ page }) => {
    await openViaFab(page);

    // Tap above the panel — on mobile it is full-height, so aim at the very top.
    await page.mouse.click(187, 2);

    await expectOverlayClosed(page);
  });

  test('the closed overlay does not intercept taps on the page', async ({ page }) => {
    // Regression guard: the md: translate override cancels translate-y-full, so
    // position alone never hid the closed panel on wider viewports — it sat over
    // the page as an invisible but fully clickable layer.
    await openViaFab(page);
    await page.getByTestId('matlagingsmodus-close').click();
    await expectOverlayClosed(page);

    const overlayOwnsCenter = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid=matlagingsmodus-overlay]');
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return overlay?.contains(el) ?? false;
    });
    expect(overlayOwnsCenter).toBe(false);
  });
});

test.describe('Matlagingsmodus on desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  /**
   * Matlagingsmodus is a cooking-at-the-counter surface and is intentionally
   * mobile-only. The FAB is hidden by a `md:hidden` class, so assert it is not
   * rendered to the user rather than merely absent from the DOM.
   */
  test('offers no entry point', async ({ page }) => {
    await seedAuth(page);
    await page.goto('/recipes/1');
    await expect(page.getByRole('heading', { name: 'Classic Spaghetti Carbonara' })).toBeVisible();

    await expect(page.getByTestId('matlagingsmodus-fab')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start matlagingsmodus' })).toHaveCount(0);
  });
});
