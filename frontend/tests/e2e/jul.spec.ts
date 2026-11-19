import { test, expect, type Page } from '@playwright/test';
import { API, seedAuth } from './helpers/stock-api';

/**
 * Julesider (feature 066): the /jul page, its Christmas mood and the seasonal
 * entry points.
 *
 * Works whether the dev server runs on mock data or against the API: the stub
 * below returns the same six Jul recipes as the mock set, and is only hit when
 * mocking is off. Dates are pinned with page.clock, in Europe/Oslo time.
 */

const JUL = { id: 18, name: 'Jul', group: 'Anledning' };
const cat = (id: number, name: string) => ({ id, name, group: 'Måltidstype' });

function recipe(id: number, title: string, categories: { id: number; name: string; group: string }[]) {
  return {
    id,
    title,
    description: '',
    ingredients: [],
    instructionSteps: [],
    ingredientSections: [],
    instructionSections: [],
    imageUrl: null,
    categories: [...categories, JUL],
    tips: [],
    sideDishes: [],
    isLikedByMe: false,
  };
}

/** Mirrors the Jul recipes in mock-data.ts. */
const JUL_RECIPES = [
  recipe(8, 'Pepperkaker', [cat(6, 'Søtbakst')]),
  recipe(9, 'Krumkaker', [cat(6, 'Søtbakst'), cat(4, 'Dessert')]),
  recipe(10, 'Pinnekjøtt', [cat(3, 'Middag')]),
  recipe(11, 'Riskrem', [cat(4, 'Dessert')]),
  recipe(12, 'Gløgg', [cat(8, 'Drikke')]),
  recipe(13, 'Sursild', [cat(2, 'Lunsj')]),
];

async function stubApi(page: Page) {
  await page.route(
    (url) => url.href.startsWith(API) && url.pathname === '/api/recipes' && url.searchParams.get('categories') === '18',
    (route) => route.fulfill({ json: JUL_RECIPES })
  );
  await page.route(`${API}/api/recipes/newest*`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/api/recipes/liked*`, (route) => route.fulfill({ json: [] }));
}

async function setup(page: Page, isoDate: string) {
  await seedAuth(page);
  await stubApi(page);
  await page.clock.setFixedTime(new Date(isoDate));
}

const countdown = (page: Page) => page.getByTestId('jul-countdown');
const flakes = (page: Page) => page.getByTestId('jul-flake');
const snowLevel = (page: Page) => page.getByTestId('jul-snow-level');

test.describe('Julesider', () => {
  test('lists Jul recipes in festive sections, each once, empty sections hidden', async ({ page }) => {
    await setup(page, '2026-12-01T10:00:00+01:00');
    await page.goto('/jul');

    await expect(page.getByRole('heading', { level: 1, name: 'Jul på mathjul' })).toBeVisible();

    const headings = page.locator('section h2');
    await expect(headings).toHaveText([
      'Julebakst og kaker',
      'Julemiddag',
      'Desserter',
      'Drikke',
      'Mer jul',
    ].map((t) => new RegExp(t)));

    // Nothing is Tilbehør, so that section is not rendered at all.
    await expect(page.getByTestId('jul-section-tilbehor')).toHaveCount(0);

    // Krumkaker carries both Søtbakst and Dessert, and shows up in Julebakst only.
    await expect(page.getByTestId('jul-recipe')).toHaveCount(6);
    const bakst = page.getByTestId('jul-section-bakst');
    await expect(bakst.getByRole('heading', { level: 3 })).toHaveText(['Krumkaker', 'Pepperkaker']);
    await expect(page.getByTestId('jul-section-dessert').getByRole('heading', { level: 3 })).toHaveText(['Riskrem']);
    await expect(page.getByTestId('jul-section-mer').getByRole('heading', { level: 3 })).toHaveText(['Sursild']);
  });

  test('1 December shows the nav link, the home card and the countdown', async ({ page }) => {
    await setup(page, '2026-12-01T10:00:00+01:00');

    await page.goto('/');
    await expect(page.getByTestId('nav-jul')).toBeVisible();
    const card = page.getByTestId('jul-home-card');
    await expect(card).toBeVisible();

    await card.click();
    await expect(page).toHaveURL(/\/jul$/);
    await expect(countdown(page)).toHaveText('23 dager til julaften');
  });

  test('23 December says julaften is tomorrow', async ({ page }) => {
    await setup(page, '2026-12-23T08:00:00+01:00');
    await page.goto('/jul');
    await expect(countdown(page)).toHaveText('I morgen er det julaften!');
  });

  test('25 December says God jul', async ({ page }) => {
    await setup(page, '2026-12-25T12:00:00+01:00');
    await page.goto('/jul');
    await expect(countdown(page)).toHaveText(/God jul!/);
  });

  test('15 February hides the entry points, but /jul still loads', async ({ page }) => {
    await setup(page, '2027-02-15T12:00:00+01:00');

    await page.goto('/jul');
    // The countdown renders after mount, so the season check has run by now.
    await expect(countdown(page)).toHaveText('312 dager til julaften');
    await expect(page.getByTestId('jul-recipe')).toHaveCount(6);
    await expect(page.getByTestId('nav-alle-oppskrifter')).toBeVisible();
    await expect(page.getByTestId('nav-jul')).toHaveCount(0);

    await page.goto('/');
    await expect(page.getByTestId('nav-alle-oppskrifter')).toBeVisible();
    await expect(page.getByTestId('jul-home-card')).toHaveCount(0);
  });

  test('reduced motion renders no snowflakes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, '2026-12-01T10:00:00+01:00');
    await page.goto('/jul');

    await expect(countdown(page)).toHaveText('23 dager til julaften');
    await expect(page.getByTestId('jul-snow')).toBeAttached();
    await expect(flakes(page)).toHaveCount(0);

    // Not even a storm moves, but the slider still works.
    await snowLevel(page).fill('4');
    await expect(page.getByTestId('jul-snow-level-name')).toHaveText('Snøstorm');
    await expect(flakes(page)).toHaveCount(0);
  });

  test('the snow slider sets the amount of snow and is remembered', async ({ page }) => {
    await setup(page, '2026-12-01T10:00:00+01:00');
    await page.goto('/jul');

    const slider = snowLevel(page);
    const name = page.getByTestId('jul-snow-level-name');

    // Default: Lett snøfall.
    await expect(slider).toHaveValue('2');
    await expect(name).toHaveText('Lett snøfall');
    await expect(slider).toHaveAttribute('aria-valuetext', 'Lett snøfall');
    await expect(flakes(page)).toHaveCount(32);

    await slider.fill('1');
    await expect(name).toHaveText('Små snøfnugg');
    const few = await flakes(page).count();

    await slider.fill('3');
    await expect(name).toHaveText('Snøen laver ned');
    expect(await flakes(page).count()).toBeGreaterThan(few);

    // Keyboard moves one stop at a time; all the way left is no snow.
    await slider.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
    await expect(name).toHaveText('Ingen snø');
    await expect(flakes(page)).toHaveCount(0);

    await page.reload();
    await expect(countdown(page)).toHaveText('23 dager til julaften');
    await expect(snowLevel(page)).toHaveValue('0');
    await expect(flakes(page)).toHaveCount(0);
  });

  test('Snøstorm whirls a dense storm of flakes, within the cap', async ({ page }) => {
    await setup(page, '2026-12-01T10:00:00+01:00');
    await page.goto('/jul');

    await snowLevel(page).fill('4');
    await expect(page.getByTestId('jul-snow-level-name')).toHaveText('Snøstorm');

    const storm = page.locator('[data-testid="jul-flake"][data-motion="whirl"]');
    await expect(storm.first()).toBeAttached();
    const count = await storm.count();
    expect(count).toBeGreaterThan(80);
    expect(count).toBeLessThanOrEqual(150);
    await expect(page.locator('[data-testid="jul-flake"][data-motion="fall"]')).toHaveCount(0);

    // Back down a step, the snow falls again.
    await snowLevel(page).fill('3');
    await expect(page.locator('[data-testid="jul-flake"][data-motion="whirl"]')).toHaveCount(0);
  });

  test('the old "snow off" choice from 066 carries over as Ingen snø', async ({ page }) => {
    await setup(page, '2026-12-01T10:00:00+01:00');
    await page.addInitScript(() => {
      if (!localStorage.getItem('mathjul.jul.snowLevel')) localStorage.setItem('mathjul.jul.snow', 'off');
    });
    await page.goto('/jul');

    await expect(snowLevel(page)).toHaveValue('0');
    await expect(page.getByTestId('jul-snow-level-name')).toHaveText('Ingen snø');
    await expect(flakes(page)).toHaveCount(0);
  });
});
