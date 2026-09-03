import { test, expect, type Page } from '@playwright/test';
import { PAN_PRESETS } from '../../src/lib/pan-size';

/**
 * Kaker: skalering etter formstørrelse.
 *
 * A cake has no portion count — it has a tin. `quantityType: "form"` marks
 * those recipes, and `servings` carries the tin's volume in cm³ rather than a
 * number of people, so the existing scaling pipeline divides two volumes
 * exactly as it would two portion counts.
 *
 * Mock recipe 5 ("Sjokoladekake") is the fixture: a round Ø24 tin at the
 * standard 6,5 cm depth (2941 cm³) whose five ingredients cover one rounding
 * class each — countable, gram, spoon and decilitre.
 *
 * Converting Ø24 to langpanne 30×40 gives 4200/2941 ≈ 1.428 — the published
 * Norwegian charts quote 1,5 for this conversion, rounded up from their own
 * stated 4,2-litre pan. Every expected amount below is the unit-aware rounding
 * of the true factor, never a hand-rounded one, so errors cannot compound down
 * the list.
 */

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
const CAKE_ID = 5;
/** Mock recipe 6: author-restricted to Ø24 (source) + liten langpanne + langpanne, default langpanne. */
const RESTRICTED_CAKE_ID = 6;

/** Seed a token before any page script runs; both pages are behind ProtectedRoute. */
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

async function openCake(page: Page, id: number = CAKE_ID, expectedInitialPanId: string = 'rund-24') {
  await seedAuth(page);
  await page.goto(`/recipes/${id}`);
  await expect(velger(page)).toBeVisible();
  // The page seeds `desiredServings` from the recipe after it loads, so the
  // picker briefly renders before the tin is known. Waiting for the initial
  // tin to settle means later steps act on a settled page.
  await expect(panSelect(page)).toHaveValue(expectedInitialPanId);
}

async function openEditForm(page: Page, id: number) {
  await seedAuth(page);
  await page.goto(`/recipes/${id}/edit`);
  await expect(page.getByRole('heading', { name: 'Rediger oppskrift' })).toBeVisible();
}

/**
 * The ingredient lines on the detail page, as "<amount> <name>".
 *
 * The amount and the name are adjacent spans with no whitespace between them,
 * so the raw text content reads "285 gsukker". Reading the two spans and
 * joining them keeps the expectations legible as the amounts a baker would
 * actually see.
 */
async function ingredientLines(page: Page): Promise<string[]> {
  // The amount and the name are adjacent spans with no whitespace between them,
  // so a line's raw text reads "285 gsukker". Read the spans separately and
  // join them, rather than trying to split the concatenation back apart.
  const items = ingredientsCard(page).getByRole('listitem');
  const lines: string[] = [];
  for (let i = 0; i < (await items.count()); i++) {
    const spans = await items.nth(i).locator('span').allTextContents();
    lines.push(
      spans
        .map((t) => t.trim())
        .filter(Boolean)
        .join(' ')
    );
  }
  return lines;
}

/**
 * The ingredients card on the detail page.
 *
 * Matlagingsmodus keeps a second copy of both the picker and the ingredient
 * list mounted inside its closed overlay, so every locator here is anchored to
 * the card on the page itself rather than to a bare testid.
 */
const ingredientsCard = (page: Page) =>
  page
    .getByRole('main')
    .locator('div')
    .filter({ has: page.getByTestId('ingredients-heading') })
    .last();

/** The detail page's own pan picker. */
const velger = (page: Page) => ingredientsCard(page).getByTestId('form-velger');

/** The detail page's tin select. */
const panSelect = (page: Page) => velger(page).getByRole('combobox');

/**
 * Pick a tin and wait for the change to land.
 *
 * The select is controlled by state derived from the scaled volume, so its
 * value settles a render after the change event. Asserting it here keeps every
 * later assertion from racing that re-render.
 */
async function choosePan(page: Page, label: string, id: string) {
  await panSelect(page).selectOption({ label });
  await expect(panSelect(page)).toHaveValue(id);
}

/** The edit form's tin select. */
const formPanSelect = (page: Page) =>
  page.getByTestId('form-picker').getByRole('combobox');

/** Capture the PUT the form submits; a save needs a backend this suite has not got. */
async function capturePut(page: Page, id: number, sink: { body: Record<string, unknown> | null }) {
  await page.route(`${API}/api/recipes/${id}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    sink.body = route.request().postDataJSON();
    return route.fulfill({ status: 200, json: { id, ...sink.body } });
  });
}

test.describe('Kakeoppskrift - visning', () => {
  test('a cake shows the pan picker instead of the servings stepper', async ({ page }) => {
    await openCake(page);

    await expect(velger(page)).toBeVisible();
    // The stepper is what the picker replaces; a cake has nothing to nudge.
    await expect(page.getByRole('button', { name: 'Flere' })).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: 'Antall' })).toHaveCount(0);
  });

  test('the recipe opens on its own tin, marked as the original', async ({ page }) => {
    await openCake(page);

    // The recipe's own tin is both the selection and the one marked original.
    await expect(panSelect(page)).toHaveValue('rund-24');
    await expect(panSelect(page).locator('option[value="rund-24"]')).toHaveText(
      'Rund Ø24 (original)'
    );

    // Unscaled: the authored amounts, exactly as entered.
    await expect
      .poll(() => ingredientLines(page))
      .toEqual(['3 egg', '200 g sukker', '2 ts bakepulver', '2 dl melk', '1 ts vaniljesukker']);
  });

  test('no warning is shown before anything is converted', async ({ page }) => {
    await openCake(page);
    await expect(velger(page).getByTestId('form-velger-warning')).toHaveCount(0);
  });
});

test.describe('Konvertering til langpanne', () => {
  test('every amount is scaled and rounded to something measurable', async ({ page }) => {
    await openCake(page);
    await choosePan(page, 'Langpanne 30×40', 'langpanne-30x40');

    // 4200/2941 = 1.4281. Each amount is rounded against its own unit:
    // 3 egg -> 4.28 -> 4 (countable, whole); 200 g -> 285.6 -> 285 (nearest
    // 5); 2 ts -> 2.86 -> 2 3/4 and 2 dl -> 2.86 -> 2 3/4 (nearest spoon
    // step); 1 ts -> 1.43 -> 1 1/2 (likewise).
    await expect
      .poll(() => ingredientLines(page))
      .toEqual([
        '4 egg',
        '285 g sukker',
        '2 3/4 ts bakepulver',
        '2 3/4 dl melk',
        '1 1/2 ts vaniljesukker',
      ]);
  });

  test('the shape change shows concrete bake guidance, and the original stays marked', async ({ page }) => {
    await openCake(page);
    await choosePan(page, 'Langpanne 30×40', 'langpanne-30x40');

    // langpanne-30x40 has chart coverage (054), so its exact numbers replace
    // the qualitative warning entirely rather than stacking with it.
    await expect(velger(page).getByTestId('form-velger-bake-guidance')).toHaveText(
      '160–170°C i 35–40 min'
    );
    await expect(velger(page).getByTestId('form-velger-warning')).toHaveCount(0);

    // The source tin stays marked even though it is no longer selected — that
    // is the baker's way back to the amounts the recipe was written with.
    await expect(panSelect(page).locator('option[value="rund-24"]')).toHaveText(
      'Rund Ø24 (original)'
    );
  });

  test('converting back to the original restores the authored amounts', async ({ page }) => {
    await openCake(page);
    await choosePan(page, 'Langpanne 30×40', 'langpanne-30x40');
    await expect.poll(() => ingredientLines(page)).toContain('4 egg');

    await choosePan(page, 'Rund Ø24 (original)', 'rund-24');

    // Rounding is applied to each conversion independently rather than
    // accumulated, so a round trip lands back on the original numbers.
    await expect
      .poll(() => ingredientLines(page))
      .toEqual(['3 egg', '200 g sukker', '2 ts bakepulver', '2 dl melk', '1 ts vaniljesukker']);
    await expect(velger(page).getByTestId('form-velger-warning')).toHaveCount(0);
    // Ø24 has chart coverage too — selecting the source pan shows its own
    // guidance rather than nothing, since coverage doesn't depend on whether
    // a conversion happened.
    await expect(velger(page).getByTestId('form-velger-bake-guidance')).toHaveText(
      '175–180°C i 30–35 min'
    );
  });

  test('a modest size change scales without warning', async ({ page }) => {
    await openCake(page);
    await choosePan(page, 'Rund Ø26', 'rund-26');

    // Same shape and the same standard depth, so nothing about the bake
    // changes and a warning would be noise. Rund-26 also has chart coverage,
    // so its guidance shows in place of the (already-absent) warning.
    await expect(velger(page).getByTestId('form-velger-warning')).toHaveCount(0);
    await expect(velger(page).getByTestId('form-velger-bake-guidance')).toHaveText(
      '175–180°C i 35–40 min'
    );
    await expect.poll(() => ingredientLines(page)).toContain('235 g sukker');
  });
});

test.describe('Temperatur og steketid', () => {
  test('an uncovered pan still falls back to the qualitative warning', async ({ page }) => {
    // Stor langpanne 40x50 isn't in the reference chart (054's spec), so it
    // must keep today's warning rather than showing nothing.
    await openCake(page);
    await choosePan(page, 'Stor langpanne 40×50', 'stor-langpanne-40x50');

    await expect(velger(page).getByTestId('form-velger-bake-guidance')).toHaveCount(0);
    await expect(velger(page).getByTestId('form-velger-warning')).toHaveText(
      'Kaken blir tynnere enn originalen. Følg med på steketiden.'
    );
  });

  test('guidance and the qualitative warning never both show', async ({ page }) => {
    await openCake(page);
    await choosePan(page, 'Liten langpanne 20×30', 'liten-langpanne-20x30');

    await expect(velger(page).getByTestId('form-velger-bake-guidance')).toHaveText(
      '175–180°C i 25–30 min'
    );
    await expect(velger(page).getByTestId('form-velger-warning')).toHaveCount(0);
  });
});

test.describe('Skalerte mengder i trinn', () => {
  test('the spoken label carries the same rounded amount as the visible text', async ({ page }) => {
    await openCake(page);
    await choosePan(page, 'Langpanne 30×40', 'langpanne-30x40');

    // The visible step text and the checkbox's aria-label are produced by two
    // different helpers — resolveStepSegments and stepPlainText — and only the
    // first used to round. A screen reader announcing "4.2842 egg" beside a
    // visible "4 egg" is the bug this guards.
    const expected = 'Trinn 2: Visp 4 egg og sukker til eggedosis.';
    await expect(
      page.locator(`input[type="checkbox"][aria-label="${expected}"]`)
    ).toHaveCount(1);

    // And the text beside it agrees, so the two helpers cannot drift apart
    // without one of these failing.
    await expect(page.getByRole('main').getByText('Visp 4 egg og sukker til eggedosis.')).toBeVisible();
  });
});

test.describe('Kakeform i redigering', () => {
  test('choosing Kakeform swaps the portion field for the pan picker', async ({ page }) => {
    await openEditForm(page, 1);

    // Recipe 1 is a portion recipe, so it starts on the numeric field.
    await expect(page.getByTestId('form-picker')).toHaveCount(0);

    await page.getByRole('button', { name: 'Kakeform' }).click();

    await expect(page.getByTestId('form-picker')).toBeVisible();
  });

  test('a cake with no tin cannot be saved', async ({ page }) => {
    await openEditForm(page, 1);
    await page.getByRole('button', { name: 'Kakeform' }).click();

    // The API rejects a "form" recipe with no pan, so the form says so here
    // rather than letting the save round-trip into a 400.
    await expect(page.getByText('Velg en bakeform for kakeoppskriften.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lagre endringer' })).toBeDisabled();

    await formPanSelect(page).selectOption({ label: 'Rund Ø24' });

    await expect(page.getByText('Velg en bakeform for kakeoppskriften.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lagre endringer' })).toBeEnabled();
  });

  test('the saved payload carries the tin, not just its area', async ({ page }) => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    await capturePut(page, CAKE_ID, sink);

    await openEditForm(page, CAKE_ID);
    await expect(page.getByTestId('form-picker')).toBeVisible();

    await formPanSelect(page).selectOption({ label: 'Langpanne 30×40' });
    await page.getByRole('button', { name: 'Lagre endringer' }).click();

    await expect.poll(() => sink.body).not.toBeNull();
    const payload = sink.body!;

    expect(payload.quantityType).toBe('form');
    expect(payload.servings).toBe(4200);
    // The volume alone is ambiguous — different tins can share a volume —
    // so the shape and its dimensions have to be stored too.
    expect(payload.panShape).toBe('rektangulaer');
    expect(payload.panLength).toBe(40);
    expect(payload.panWidth).toBe(30);
    expect(payload.panDiameter).toBeNull();
  });

  test('switching away from Kakeform clears the tin', async ({ page }) => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    await capturePut(page, CAKE_ID, sink);

    await openEditForm(page, CAKE_ID);
    await expect(page.getByTestId('form-picker')).toBeVisible();

    await page.getByRole('button', { name: 'Porsjoner' }).click();
    await expect(page.getByTestId('form-picker')).toHaveCount(0);

    // The tin's area is dropped rather than reinterpreted, so the portion
    // count starts empty and the baker states it themselves.
    const portions = page.getByPlaceholder('Porsjoner');
    await expect(portions).toHaveValue('');
    await portions.fill('12');

    await page.getByRole('button', { name: 'Lagre endringer' }).click();

    await expect.poll(() => sink.body).not.toBeNull();
    const payload = sink.body!;

    // A leftover tin on a portion recipe would make `servings` ambiguous
    // between a portion count and a volume, and 2941 cm³ must never resurface
    // as 2941 portions.
    expect(payload.quantityType).toBe('porsjoner');
    expect(payload.servings).toBe(12);
    expect(payload.panShape).toBeNull();
    expect(payload.panDiameter).toBeNull();
  });

  test('the optional height is kept when the tin changes', async ({ page }) => {
    const sink: { body: Record<string, unknown> | null } = { body: null };
    await capturePut(page, CAKE_ID, sink);

    await openEditForm(page, CAKE_ID);
    const height = page.getByLabel('Høyde (cm)');
    await expect(height).toHaveValue('7');

    // Height belongs to the baker, not to the preset, so picking another tin
    // must not overwrite it.
    await formPanSelect(page).selectOption({ label: 'Rund Ø28' });
    await expect(height).toHaveValue('7');

    await page.getByRole('button', { name: 'Lagre endringer' }).click();
    await expect.poll(() => sink.body).not.toBeNull();

    expect(sink.body!.panHeight).toBe(7);
    expect(sink.body!.panDiameter).toBe(28);
  });
});

test.describe('Forfatterstyrt formutvalg', () => {
  test('a restricted recipe only offers its configured subset, plus the source tin', async ({ page }) => {
    // Recipe 6 is restricted to Ø24 (its own tin) + liten langpanne + langpanne,
    // with langpanne configured as the default — so the picker opens there
    // rather than on the source tin.
    await openCake(page, RESTRICTED_CAKE_ID, 'langpanne-30x40');

    const options = await panSelect(page).locator('option').allTextContents();
    expect(options.map((o) => o.trim())).toEqual([
      'Rund Ø24 (original)',
      'Liten langpanne 20×30',
      'Langpanne 30×40',
    ]);
  });

  test('the configured default is preselected on load', async ({ page }) => {
    await openCake(page, RESTRICTED_CAKE_ID, 'langpanne-30x40');
    // openCake already asserts the select's value; this test exists to name the
    // behavior explicitly rather than leaving it implicit in the helper.
    await expect(panSelect(page)).toHaveValue('langpanne-30x40');
  });

  test('a recipe with no configured subset still shows every preset', async ({ page }) => {
    // Regression guard for 052: recipe 5 carries no availablePanPresetIds, so
    // narrowing must never apply to it.
    await openCake(page);

    const options = await panSelect(page).locator('option').allTextContents();
    expect(options.length).toBe(PAN_PRESETS.length);
  });

  test('editing a restricted recipe shows its stored subset and default, not a blank slate', async ({ page }) => {
    // Regression guard: the edit form must populate availablePanPresetIds and
    // defaultPanPresetId from the fetched recipe. Recipe 6 is stored with
    // Ø24 (source) + liten langpanne + langpanne, defaulted to langpanne.
    await openEditForm(page, RESTRICTED_CAKE_ID);
    await expect(page.getByTestId('form-picker')).toBeVisible();

    await page.getByText('Begrens tilgjengelige former').click();

    await expect(page.getByRole('checkbox', { name: /Rund Ø24/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Liten langpanne 20×30' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Langpanne 30×40' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Rund Ø26' })).not.toBeChecked();

    await expect(page.getByLabel('Standardform')).toHaveValue('langpanne-30x40');
  });

  test('saving an untouched restricted recipe keeps its subset and default', async ({ page }) => {
    // Without the fix, the edit form starts with an empty subset, and since
    // the form posts every field on every save, an untouched edit would wipe
    // out the author's configured restriction and default.
    const sink: { body: Record<string, unknown> | null } = { body: null };
    await capturePut(page, RESTRICTED_CAKE_ID, sink);

    await openEditForm(page, RESTRICTED_CAKE_ID);
    await expect(page.getByTestId('form-picker')).toBeVisible();
    await page.getByRole('button', { name: 'Lagre endringer' }).click();

    await expect.poll(() => sink.body).not.toBeNull();
    const payload = sink.body!;
    expect(payload.availablePanPresetIds).toEqual([
      'rund-24',
      'liten-langpanne-20x30',
      'langpanne-30x40',
    ]);
    expect(payload.defaultPanPresetId).toBe('langpanne-30x40');
  });
});
