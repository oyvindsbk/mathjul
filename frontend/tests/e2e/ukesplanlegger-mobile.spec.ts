import { test, expect, devices, type Page } from '@playwright/test';

/**
 * Ukesplanlegger on a phone.
 *
 * Pinned to 375px — the narrowest common phone, and the width the grid was
 * sized against (Pixel 5 is 393px). Several behaviours here are
 * viewport-conditional and invisible to the desktop projects: the recipe picker
 * is a `lg:hidden` overlay, the calendar's 700px floor only applies from `lg`
 * up, and the chip cap is 2 on mobile against 3 on `lg+`.
 */
test.use({ ...devices['Pixel 5'], viewport: { width: 375, height: 667 } });

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
const GROUP_ID = 1;

/** Today, and two other days in the same month, as yyyy-MM-dd. */
const today = new Date();
today.setHours(0, 0, 0, 0);

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** A day guaranteed to be in the current month and not in the past. */
function dayInCurrentMonth(dayOfMonth: number): Date {
  return new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
}

/**
 * Seed a token before any page script runs.
 *
 * ProtectedRoute redirects to /login whenever AuthContext has no token, and
 * AuthContext reads it from localStorage on mount — so without this every
 * navigation lands on the login page. The value is never verified client-side,
 * so a structurally valid dev token is enough.
 */
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

interface SeedPlan {
  id: number;
  date: string;
  title: string;
  custom?: boolean;
  note?: string | null;
}

function toMealPlan(seed: SeedPlan) {
  return seed.custom
    ? {
        id: seed.id,
        groupId: GROUP_ID,
        date: seed.date,
        recipeId: null,
        recipe: null,
        matkasseRecipeId: null,
        matkasseRecipe: null,
        customTitle: seed.title,
        customNote: seed.note ?? null,
        isCustom: true,
        createdByEmail: 'e2e@example.com',
      }
    : {
        id: seed.id,
        groupId: GROUP_ID,
        date: seed.date,
        recipeId: seed.id * 100,
        recipe: {
          id: seed.id * 100,
          title: seed.title,
          imageUrl: null,
          mealTypeCategory: 'Middag',
          mealTypeCategories: ['Middag'],
          sideDishTitles: [],
        },
        matkasseRecipeId: null,
        matkasseRecipe: null,
        customTitle: null,
        customNote: null,
        isCustom: false,
        createdByEmail: 'e2e@example.com',
      };
}

/**
 * Stand in for the API.
 *
 * The planner is useless without a group and its entries, and the dev server
 * has no backend attached, so every test here would otherwise stop at the
 * "du er ikke med i noen grupper" branch. Mutations are served from an
 * in-memory list so delete/move/note round-trip the way the real API does.
 */
async function mockApi(page: Page, seeds: SeedPlan[] = []) {
  const plans = seeds.map(toMealPlan);

  await page.route(`${API}/api/groups`, (route) =>
    route.fulfill({
      json: [
        {
          id: GROUP_ID,
          name: 'Husholdning',
          ownerEmail: 'e2e@example.com',
          memberCount: 1,
          createdAt: new Date().toISOString(),
        },
      ],
    })
  );

  await page.route(`${API}/api/groups/${GROUP_ID}`, (route) =>
    route.fulfill({
      json: {
        id: GROUP_ID,
        name: 'Husholdning',
        ownerEmail: 'e2e@example.com',
        createdAt: new Date().toISOString(),
        mealPlanEnabled: true,
        members: [],
        recipes: [],
      },
    })
  );

  await page.route(`${API}/api/groups/${GROUP_ID}/mealplans**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const idMatch = /\/mealplans\/(\d+)$/.exec(url.pathname);

    if (method === 'GET') {
      return route.fulfill({ json: plans });
    }

    if (method === 'DELETE' && idMatch) {
      const index = plans.findIndex((p) => p.id === Number(idMatch[1]));
      if (index >= 0) plans.splice(index, 1);
      return route.fulfill({ status: 204, body: '' });
    }

    if (method === 'PATCH' && idMatch) {
      const changes = request.postDataJSON() as {
        date?: string;
        customTitle?: string;
        customNote?: string | null;
      };
      const plan = plans.find((p) => p.id === Number(idMatch[1]));
      if (!plan) return route.fulfill({ status: 404, body: '' });
      if (changes.date !== undefined) plan.date = changes.date;
      if (changes.customTitle !== undefined) plan.customTitle = changes.customTitle;
      if (changes.customNote !== undefined) plan.customNote = changes.customNote;
      return route.fulfill({ json: plan });
    }

    return route.fulfill({ status: 404, body: '' });
  });

  // The picker lists recipes; an empty list is enough to render its shell.
  await page.route(`${API}/api/recipes**`, (route) => route.fulfill({ json: [] }));
}

/** Opens the day modal for a given day-of-month in the current month. */
async function openDay(page: Page, dayOfMonth: number) {
  await page
    .getByTestId('day-cell')
    .filter({ hasText: new RegExp(`^${dayOfMonth}(?!\\d)`) })
    .first()
    .click();
  await expect(page.getByTestId('day-detail-modal')).toBeVisible();
}

test.describe('Ukesplanlegger mobile', () => {
  test('no modal on load and nothing scrolls horizontally', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto('/ukesplanlegger');
    await expect(page.getByRole('heading', { name: 'Ukesplanlegger' })).toBeVisible();

    await expect(page.getByTestId('day-detail-modal')).toHaveCount(0);
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

  test('tapping a day opens the day modal, and the picker is one step further in', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto('/ukesplanlegger');

    await openDay(page, today.getDate());
    await expect(page.getByText('Ingen måltider planlagt.')).toBeVisible();

    await page.getByRole('button', { name: '+ Legg til oppskrift' }).click();

    await expect(page.getByTestId('day-detail-modal')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Velg oppskrift' })).toBeVisible();
  });

  test('the modal lists every entry for the day, including ones the cell collapses', async ({ page }) => {
    const day = dayInCurrentMonth(15);
    await seedAuth(page);
    await mockApi(page, [
      { id: 1, date: dateKey(day), title: 'Laks med potet' },
      { id: 2, date: dateKey(day), title: 'Tomatsuppe' },
      { id: 3, date: dateKey(day), title: 'Fiskepinner' },
    ]);
    await page.goto('/ukesplanlegger');

    // Mobile caps at two chips, so the third collapses into "+N til".
    const cell = page.getByTestId('day-cell').filter({ hasText: /^15(?!\d)/ }).first();
    await expect(cell.getByTestId('day-cell-overflow').filter({ visible: true })).toHaveText('+2 til');

    await openDay(page, 15);
    await expect(page.getByTestId('day-detail-entry')).toHaveCount(3);
  });

  test('deleting an entry removes it from the modal and the cell', async ({ page }) => {
    const day = dayInCurrentMonth(15);
    await seedAuth(page);
    await mockApi(page, [
      { id: 1, date: dateKey(day), title: 'Laks med potet' },
      { id: 2, date: dateKey(day), title: 'Tomatsuppe' },
    ]);
    await page.goto('/ukesplanlegger');

    await openDay(page, 15);
    await expect(page.getByTestId('day-detail-entry')).toHaveCount(2);

    await page
      .getByTestId('day-detail-entry')
      .filter({ hasText: 'Tomatsuppe' })
      .getByRole('button', { name: 'Slett' })
      .click();

    await expect(page.getByTestId('day-detail-entry')).toHaveCount(1);
    await expect(page.getByTestId('day-detail-modal')).not.toContainText('Tomatsuppe');
  });

  test('moving an entry lands it on the target day', async ({ page }) => {
    const from = dayInCurrentMonth(15);
    const to = dayInCurrentMonth(19);
    await seedAuth(page);
    await mockApi(page, [{ id: 1, date: dateKey(from), title: 'Laks med potet' }]);
    await page.goto('/ukesplanlegger');

    await openDay(page, 15);
    await page.getByRole('button', { name: 'Flytt' }).click();
    await page.getByLabel('Flytt til dato').fill(dateKey(to));
    await page.getByRole('button', { name: 'Flytt', exact: true }).click();

    // The entry has left the source day and arrived on the target.
    await expect(page.getByTestId('day-detail-entry')).toHaveCount(0);
    await page.getByRole('button', { name: 'Lukk' }).click();

    await openDay(page, 19);
    await expect(page.getByTestId('day-detail-entry')).toContainText('Laks med potet');
  });

  test('a custom card note can be edited after it was created', async ({ page }) => {
    const day = dayInCurrentMonth(15);
    await seedAuth(page);
    await mockApi(page, [
      { id: 1, date: dateKey(day), title: 'Rester', custom: true, note: 'fra søndag' },
    ]);
    await page.goto('/ukesplanlegger');

    await openDay(page, 15);
    await expect(page.getByTestId('day-detail-entry')).toContainText('fra søndag');

    await page.getByRole('button', { name: 'Notat' }).click();
    await page.getByLabel('Notat').fill('dobbel porsjon');
    await page.getByRole('button', { name: 'Lagre' }).click();

    await expect(page.getByTestId('day-detail-entry')).toContainText('dobbel porsjon');
    await expect(page.getByTestId('day-detail-entry')).not.toContainText('fra søndag');
  });

  test('the modal closes on Escape', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto('/ukesplanlegger');

    await openDay(page, today.getDate());
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('day-detail-modal')).toHaveCount(0);
  });

  test('days from neighbouring months are live, so a whole week is plannable', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto('/ukesplanlegger');

    // A month grid always spans whole weeks, so some cells belong to the
    // previous/next month. They must be real cells, not inert fillers.
    const cells = page.getByTestId('day-cell');
    await expect(cells.first()).toBeVisible();
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

    // Tapping one opens the day modal without navigating away from the month.
    const monthHeading = await page.locator('h2').first().textContent();
    await cells.last().click();
    await expect(page.getByTestId('day-detail-modal')).toBeVisible();
    expect(await page.locator('h2').first().textContent()).toBe(monthHeading);
  });
});
