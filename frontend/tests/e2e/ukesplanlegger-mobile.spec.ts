import { test, expect, devices } from '@playwright/test';

/**
 * Ukesplanlegger on a phone.
 *
 * Both behaviours here are viewport-conditional, so the desktop projects can't
 * see them: the recipe picker is a `lg:hidden` overlay, and the calendar's
 * 700px floor only applies from `lg` up. Pinned to 375px — the narrowest
 * common phone, and the width the grid was sized against (Pixel 5 is 393px).
 */
test.use({ ...devices['Pixel 5'], viewport: { width: 375, height: 667 } });

test.describe('Ukesplanlegger mobile', () => {
  test('picker stays closed on load and nothing scrolls horizontally', async ({ page }) => {
    await page.goto('/ukesplanlegger');
    await expect(page.getByRole('heading', { name: 'Ukesplanlegger' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Velg oppskrift' })).toHaveCount(0);

    const documentOverflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(documentOverflows).toBe(false);

    // The document check alone is not enough: overflow-x-auto would absorb a
    // too-wide grid and leave the document itself clean. This is the assertion
    // that proves the 700px floor is gone below lg.
    const grid = await page
      .locator('.overflow-x-auto')
      .first()
      .evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth);
  });

  test('tapping a day opens the picker', async ({ page }) => {
    await page.goto('/ukesplanlegger');

    await page.getByTestId('day-cell').first().click();

    await expect(page.getByRole('heading', { name: 'Velg oppskrift' })).toBeVisible();
  });

  test('days from neighbouring months are live, so a whole week is plannable', async ({ page }) => {
    await page.goto('/ukesplanlegger');

    // A month grid always spans whole weeks, so some cells belong to the
    // previous/next month. They must be real cells, not inert fillers.
    const cells = page.getByTestId('day-cell');
    const count = await cells.count();
    expect(count % 7).toBe(0);
    expect(count).toBeGreaterThanOrEqual(28);

    // Overflow days carry a short month label (e.g. "1 sep") to disambiguate.
    const labelled = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="day-cell"]')].filter((c) =>
        /jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des/.test(c.textContent ?? '')
      ).length
    );
    expect(labelled).toBeGreaterThan(0);

    // Tapping one opens the picker without navigating away from the month.
    const monthHeading = await page.locator('h2').first().textContent();
    await cells.last().click();
    await expect(page.getByRole('heading', { name: 'Velg oppskrift' })).toBeVisible();
    expect(await page.locator('h2').first().textContent()).toBe(monthHeading);
  });
});
