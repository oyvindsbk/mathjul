import { test, expect, type Page } from '@playwright/test';
import { API, GROUP_ID, mockGroups, mockStock, seedAuth, type FakeStockItem } from './helpers/stock-api';

const STOCK_URL = `${API}/api/groups/${GROUP_ID}/stock`;

// 1x1 transparent PNG; the server is mocked, so only the upload itself matters.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const milk: FakeStockItem = {
  id: 1, name: 'Melk', quantity: 1, unit: 'l', location: 'kjoleskap', bestBefore: null, isStaple: false,
};
const yoghurt: FakeStockItem = {
  id: 2, name: 'Yoghurt', quantity: 1, unit: 'stk', location: 'kjoleskap', bestBefore: null, isStaple: false,
};
const mustard: FakeStockItem = {
  id: 3, name: 'Sennep', quantity: null, unit: null, location: 'kjoleskap', bestBefore: null, isStaple: true,
};

interface DraftBody {
  location: string;
  mode: string;
  items: { name: string; quantity: number | null; unit: string | null }[];
  keepIds: number[];
}

async function openScan(page: Page, seeds: FakeStockItem[]) {
  await mockStock(page, seeds);
  await page.goto('/beholdning');
  await page.getByTestId('stock-scan').click();
  await page.getByLabel('Bilder (maks 4)').setInputFiles({ name: 'kjoleskap.png', mimeType: 'image/png', buffer: PNG });
}

test.describe('Skann beholdning', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockGroups(page);
  });

  test('scans, reviews with badges, edits a row and saves', async ({ page }) => {
    let scanBody = '';
    let applied: DraftBody | null = null;
    await page.route(`${STOCK_URL}/scan`, (route) => {
      scanBody = route.request().postData() ?? '';
      return route.fulfill({
        json: {
          items: [
            { name: 'Melk', quantity: 2, unit: 'l' },
            { name: 'Egg', quantity: 12, unit: 'stk' },
          ],
        },
      });
    });
    await page.route(`${STOCK_URL}/scan/apply`, (route) => {
      applied = route.request().postDataJSON() as DraftBody;
      return route.fulfill({ json: { added: 1, updated: 1, removed: 0 } });
    });

    await openScan(page, [milk]);
    await expect(page.getByLabel('Bilder (maks 4)')).toHaveAttribute('capture', 'environment');
    await page.getByLabel('Hva er på bildet?').selectOption('kjoleskap');
    await page.getByRole('button', { name: 'Les av bildet' }).click();

    expect(scanBody).toContain('name="location"');
    expect(scanBody).toContain('kjoleskap.png');

    const rows = page.getByTestId('draft-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByTestId('draft-badge')).toHaveText('finnes');
    await expect(rows.nth(1).getByTestId('draft-badge')).toHaveText('ny');

    await rows.nth(1).getByLabel('Antall').fill('6');
    await page.getByRole('button', { name: 'Lagre', exact: true }).click();

    await expect(page.getByRole('status')).toContainText('Lagret: 1 nye, 1 oppdatert');
    expect(applied).toMatchObject({
      location: 'kjoleskap',
      mode: 'legg-til',
      items: [
        { name: 'Melk', quantity: 2, unit: 'l' },
        { name: 'Egg', quantity: 6, unit: 'stk' },
      ],
      keepIds: [],
    });
  });

  test('replace mode lists what will be removed, never staples, and keep sends keepIds', async ({ page }) => {
    let applied: DraftBody | null = null;
    await page.route(`${STOCK_URL}/scan`, (route) =>
      route.fulfill({ json: { items: [{ name: 'Melk', quantity: 1, unit: 'l' }] } })
    );
    await page.route(`${STOCK_URL}/scan/apply`, (route) => {
      applied = route.request().postDataJSON() as DraftBody;
      return route.fulfill({ json: { added: 0, updated: 1, removed: 0 } });
    });

    await openScan(page, [milk, yoghurt, mustard]);
    await page.getByRole('button', { name: 'Les av bildet' }).click();
    await expect(page.getByTestId('draft-row')).toHaveCount(1);

    // In add mode nothing is removed.
    await expect(page.getByTestId('removal-list')).toHaveCount(0);

    await page.getByLabel(/Erstatt/).check();
    const removal = page.getByTestId('removal-list');
    await expect(removal).toContainText('Yoghurt');
    await expect(removal).not.toContainText('Sennep');
    await expect(removal).not.toContainText('Melk');
    await expect(removal.getByText('fjernes', { exact: true })).toBeVisible();

    await page.getByLabel(/Behold Yoghurt/).check();
    await expect(removal.getByText('beholdes', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Lagre', exact: true }).click();
    await expect(page.getByTestId('scan-review')).toHaveCount(0);
    expect(applied).toMatchObject({ mode: 'erstatt', keepIds: [2] });
  });

  test('corrects the draft with text and shows applied and rejected changes', async ({ page }) => {
    let correctBody = '';
    await page.route(`${STOCK_URL}/scan`, (route) =>
      route.fulfill({
        json: {
          items: [
            { name: 'Yoghurt', quantity: 1, unit: 'stk' },
            { name: 'Melk', quantity: 1, unit: 'l' },
          ],
        },
      })
    );
    await page.route(`${STOCK_URL}/scan/correct`, (route) => {
      correctBody = route.request().postData() ?? '';
      return route.fulfill({
        json: {
          items: [
            { name: 'Melk', quantity: 2, unit: 'l' },
            { name: 'Egg', quantity: 12, unit: 'stk' },
          ],
          applied: ['Fjernet «Yoghurt»', 'La til «Egg» (12 stk)'],
          rejected: ['Kunne ikke fjerne rad 9: raden finnes ikke'],
        },
      });
    });

    await openScan(page, []);
    await page.getByRole('button', { name: 'Les av bildet' }).click();
    await expect(page.getByTestId('draft-row')).toHaveCount(2);

    await page.getByLabel('Rett med tekst').fill('fjern yoghurten, det er 2 melk, legg til 12 egg');
    await page.getByRole('button', { name: 'Rett', exact: true }).click();

    await expect(page.getByTestId('draft-row')).toHaveCount(2);
    await expect(page.getByTestId('draft-row').nth(0).getByLabel('Navn')).toHaveValue('Melk');
    await expect(page.getByTestId('draft-row').nth(0).getByLabel('Antall')).toHaveValue('2');
    await expect(page.getByTestId('correction-applied')).toContainText('Fjernet «Yoghurt»');
    await expect(page.getByTestId('correction-rejected')).toContainText('raden finnes ikke');
    await expect(page.getByLabel('Rett med tekst')).toHaveValue('');

    // The photo is not re-sent unless asked for.
    expect(correctBody).toContain('name="instruction"');
    expect(correctBody).not.toContain('kjoleskap.png');
  });

  test('re-sends the photo when "Se på bildet igjen" is ticked', async ({ page }) => {
    let correctBody = '';
    await page.route(`${STOCK_URL}/scan`, (route) =>
      route.fulfill({ json: { items: [{ name: 'Melk', quantity: 1, unit: 'l' }] } })
    );
    await page.route(`${STOCK_URL}/scan/correct`, (route) => {
      correctBody = route.request().postData() ?? '';
      return route.fulfill({ json: { items: [{ name: 'Melk', quantity: 1, unit: 'l' }], applied: [], rejected: [] } });
    });

    await openScan(page, []);
    await page.getByRole('button', { name: 'Les av bildet' }).click();
    await page.getByLabel('Se på bildet igjen').check();
    await page.getByLabel('Rett med tekst').fill('er det flere egg der?');
    await page.getByRole('button', { name: 'Rett', exact: true }).click();

    await expect(page.getByLabel('Rett med tekst')).toHaveValue('');
    expect(correctBody).toContain('kjoleskap.png');
  });

  test('cannot save an empty draft', async ({ page }) => {
    await page.route(`${STOCK_URL}/scan`, (route) => route.fulfill({ json: { items: [] } }));
    await openScan(page, []);
    await page.getByRole('button', { name: 'Les av bildet' }).click();

    await expect(page.getByText('Ingen varer funnet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lagre', exact: true })).toBeDisabled();
  });

  test('shows a scan error and keeps the upload step', async ({ page }) => {
    await page.route(`${STOCK_URL}/scan`, (route) =>
      route.fulfill({ status: 400, json: { error: 'Skanning er ikke konfigurert i dette miljøet' } })
    );
    await openScan(page, []);
    await page.getByRole('button', { name: 'Les av bildet' }).click();

    await expect(page.getByTestId('scan-start').getByRole('alert')).toHaveText(
      'Skanning er ikke konfigurert i dette miljøet'
    );
    await expect(page.getByTestId('scan-review')).toHaveCount(0);
  });
});
