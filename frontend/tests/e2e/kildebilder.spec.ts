import { test, expect, type Page } from '@playwright/test';
import { API, seedAuth } from './helpers/stock-api';

/**
 * Kildebilder (feature 064): the photos an image-mode recipe was extracted from.
 *
 * Works whether the dev server runs on mock data or against the API: recipe 1
 * has two source images in both the mock set and the stubs below, recipe 2 has
 * none. The stubs are only hit when mocking is off.
 */

/** A 300×400 PNG with a red top-left quarter, drawn in the page so no fixture file is needed. */
async function makePng(page: Page, width = 300, height = 400): Promise<Buffer> {
  const b64 = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f5f0e6';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c33';
      ctx.fillRect(0, 0, w / 2, h / 2);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    [width, height]
  );
  return Buffer.from(b64, 'base64');
}

function recipeJson(id: number, sourceImageUrls: string[]) {
  return {
    id,
    title: `Kildebilde-test ${id}`,
    description: 'Fra et skannet ark',
    ingredients: [{ quantity: 2, unit: 'dl', name: 'mel' }],
    instructionSteps: [{ text: 'Bland', imageUrl: null }],
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
    sourceImageUrls,
  };
}

async function stubApi(page: Page, png: Buffer) {
  await page.route(`${API}/fake-blob/**`, (route) => route.fulfill({ body: png, contentType: 'image/png' }));
  await page.route(`${API}/api/recipes/1`, (route) =>
    route.fulfill({ json: recipeJson(1, [`${API}/fake-blob/a.png`, `${API}/fake-blob/b.png`]) })
  );
  await page.route(`${API}/api/recipes/2`, (route) => route.fulfill({ json: recipeJson(2, []) }));
  await page.route(new RegExp(`${API}/api/recipes/1/source-images/(\\d+)$`), (route) => {
    const index = Number(/source-images\/(\d+)$/.exec(route.request().url())![1]);
    return route.fulfill({
      body: png,
      contentType: 'image/png',
      headers: {
        // What the API's CORS policy sends, so the page may read the file name.
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Content-Disposition': `attachment; filename=kildebilde-test-1-kilde-${index + 1}.png`,
      },
    });
  });
}

test.describe('Kildebilder på oppskriftssiden', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await page.goto('/offline.html');
    await stubApi(page, await makePng(page));
  });

  test('viser miniatyrer med lenke og nedlasting', async ({ page }) => {
    await page.goto('/recipes/1');

    const section = page.getByTestId('recipe-meta-desktop').getByTestId('kildebilder');
    // Generous: the first visit compiles the page on the dev server.
    await expect(section).toBeVisible({ timeout: 20_000 });
    await expect(section.getByRole('img')).toHaveCount(2);

    const firstLink = section.getByRole('link', { name: 'Åpne kildebilde 1 i ny fane' });
    await expect(firstLink).toHaveAttribute('target', '_blank');
    await expect(firstLink).toHaveAttribute('rel', /noopener/);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      section.getByRole('button', { name: 'Last ned kildebilde 1' }).click(),
    ]);
    // API mode names the file from Content-Disposition; mock mode uses the fallback,
    // whose extension Firefox rewrites to match the blob type.
    expect(download.suggestedFilename()).toMatch(/kilde-1\.\w+$/);
  });

  test('skjuler seksjonen når oppskriften ikke har kildebilder', async ({ page }) => {
    await page.goto('/recipes/2');

    await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('kildebilder')).toHaveCount(0);
  });
});

test.describe('Beskjæring før uttrekk', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await page.route(`${API}/api/**`, (route) => route.fulfill({ json: [] }));
  });

  test('beskjær, se merket, tilbakestill', async ({ page }) => {
    await page.goto('/offline.html');
    const png = await makePng(page);
    await page.goto('/last-opp-oppskrift');

    await page.locator('input[type=file]').first().setInputFiles({ name: 'side.png', mimeType: 'image/png', buffer: png });
    const thumbnail = page.getByTestId('upload-thumbnail').first();
    await expect(thumbnail).toBeVisible();
    await expect(thumbnail.getByText('Beskjært', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Beskjær bilde 1' }).click();
    const dialog = page.getByRole('dialog');
    const canvas = dialog.locator('canvas');
    await expect(canvas).toBeVisible();

    // The crop starts as the whole page; dragging inside it draws a new selection.
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await dialog.getByRole('button', { name: 'Beskjær' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(thumbnail.getByText('Beskjært', { exact: true })).toBeVisible();
    const preview = thumbnail.locator('img');
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeLessThan(300);

    await page.getByRole('button', { name: 'Tilbakestill bilde 1' }).click();
    await expect(thumbnail.getByText('Beskjært', { exact: true })).toHaveCount(0);
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(300);
  });

  test('Avbryt beholder bildet uendret', async ({ page }) => {
    await page.goto('/offline.html');
    const png = await makePng(page);
    await page.goto('/last-opp-oppskrift');

    await page.locator('input[type=file]').first().setInputFiles({ name: 'side.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'Beskjær bilde 1' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Avbryt' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Beskjært', { exact: true })).toHaveCount(0);
  });
});
