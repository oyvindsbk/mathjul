import { test, expect, type Page } from '@playwright/test';

/**
 * Authoring and reading @-mentions in instruction steps.
 *
 * Mock recipe 1 ("Classic Spaghetti Carbonara") is the fixture: a flat
 * ingredient list led by "400 g spaghetti", and five flat steps.
 *
 * The authoring tests drive the real form. The reading test asserts on the
 * payload the form submits, since a save needs a backend this suite does not
 * have; the read surfaces themselves are covered by matlagingsmodus.spec.ts,
 * which renders mentions through the same resolver.
 */

/**
 * Seed a token before any page script runs.
 *
 * The edit page is behind ProtectedRoute, which redirects to /login whenever
 * AuthContext has no token. The value is never verified client-side, so a
 * structurally valid dev token is enough and no backend is needed.
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

/**
 * Start a step from a known plain-prose baseline.
 *
 * Recipe 1's first step ships with a mention already in it, so tests that want
 * to author one from scratch must not simply append to whatever is there —
 * `fill` replaces the value outright and takes the caret to the end.
 */
async function resetStep(page: Page, stepIndex: number, text: string) {
  const field = page.getByTestId(`instruction-text-${stepIndex}`);
  await field.fill(text);
  return field;
}

/** Type `@` plus a query at the caret, then accept the highlighted option. */
async function mention(page: Page, stepIndex: number, query: string) {
  const field = page.getByTestId(`instruction-text-${stepIndex}`);
  await field.pressSequentially(` @${query}`);
  await expect(page.getByTestId('mention-picker')).toBeVisible();
  await field.press('Enter');
  await expect(page.getByTestId('mention-picker')).toHaveCount(0);
}

async function openEditForm(page: Page) {
  await seedAuth(page);
  await page.goto('/recipes/1/edit');
  await expect(page.getByRole('heading', { name: 'Rediger oppskrift' })).toBeVisible();
  // The form mounts only once the recipe has loaded.
  await expect(page.getByTestId('instruction-text-0')).toBeVisible();
}

test.describe('Authoring', () => {
  test('@ opens a filtered picker and inserts a bound mention', async ({ page }) => {
    await openEditForm(page);

    const field = await resetStep(page, 0, 'Cook the pasta');
    await field.pressSequentially(' @spag');

    const picker = page.getByTestId('mention-picker');
    await expect(picker).toBeVisible();
    // Filtered to the one match, previewing the amount it will render with.
    await expect(picker.getByRole('option')).toHaveCount(1);
    await expect(picker.getByRole('option').first()).toContainText('400 g');
    await expect(picker.getByRole('option').first()).toContainText('spaghetti');

    await field.press('Enter');
    await expect(picker).toHaveCount(0);

    // The textarea holds the storage token; the preview line resolves it.
    await expect(field).toHaveValue(/@\[0\]/);
    await expect(page.getByTestId('instruction-preview-0')).toContainText('400 g spaghetti');
    await expect(page.getByTestId('mention-chips-0')).toContainText('spaghetti');
  });

  test('arrow keys move the highlighted option', async ({ page }) => {
    await openEditForm(page);

    const field = await resetStep(page, 0, 'Cook the pasta');
    await field.pressSequentially(' @');

    const picker = page.getByTestId('mention-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('option').nth(0)).toHaveAttribute('aria-selected', 'true');

    await field.press('ArrowDown');
    await expect(picker.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');

    // Accepting takes the option the arrows landed on, not the first.
    await field.press('Enter');
    await expect(page.getByTestId('mention-chips-0')).toContainText('pancetta');
  });

  test('Escape dismisses the picker without inserting', async ({ page }) => {
    await openEditForm(page);

    const before = 'Cook the pasta';
    const field = await resetStep(page, 0, before);
    await field.pressSequentially(' @spag');
    await expect(page.getByTestId('mention-picker')).toBeVisible();

    await field.press('Escape');
    await expect(page.getByTestId('mention-picker')).toHaveCount(0);
    // The typed text stays; only the picker closed.
    await expect(field).toHaveValue(`${before} @spag`);
    await expect(page.getByTestId('mention-chips-0')).toHaveCount(0);
  });

  test('a mention can be switched to name-only and removed', async ({ page }) => {
    await openEditForm(page);

    await resetStep(page, 0, 'Cook the pasta');
    await mention(page, 0, 'spag');
    const preview = page.getByTestId('instruction-preview-0');
    await expect(preview).toContainText('400 g spaghetti');

    // Full -> name only.
    await page
      .getByTestId('mention-chips-0')
      .getByRole('button', { name: /vis bare navnet/i })
      .click();
    await expect(preview).toContainText('spaghetti');
    await expect(preview).not.toContainText('400 g');

    // Removing drops the token from the text as well as the chip.
    await page
      .getByTestId('mention-chips-0')
      .getByRole('button', { name: /^Fjern/ })
      .click();
    await expect(page.getByTestId('mention-chips-0')).toHaveCount(0);
    await expect(page.getByTestId('instruction-text-0')).not.toHaveValue(/@\[\d+\]/);
  });

  test('removing a mentioned ingredient warns which steps use it', async ({ page }) => {
    await openEditForm(page);
    await resetStep(page, 0, 'Cook the pasta');
    await mention(page, 0, 'spag');

    let message = '';
    page.on('dialog', (dialog) => {
      message = dialog.message();
      void dialog.dismiss();
    });

    // The spaghetti row is the first ingredient.
    await page.getByTestId('remove-ingredient-0').click();
    await expect.poll(() => message).toContain('trinn 1');

    // Dismissing the warning keeps the ingredient — removal is opt-in.
    await expect(page.getByTestId('mention-chips-0')).toContainText('spaghetti');
  });
});

test.describe('Saving', () => {
  test('the submitted payload carries the token and its bound mention', async ({ page }) => {
    let saved: {
      ingredients: { id?: string; name: string }[];
      instructionSteps: { text: string; mentions?: { ingredientId: string }[] }[];
    } | null = null;

    await page.route('**/api/recipes/**', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      saved = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, ...saved }),
      });
    });

    await openEditForm(page);
    await resetStep(page, 0, 'Cook the pasta');
    await mention(page, 0, 'spag');
    await page.getByRole('button', { name: 'Lagre endringer' }).click();

    await expect.poll(() => saved).not.toBeNull();
    const payload = saved!;

    // The ingredient got an id, and the step's token points at exactly that id —
    // binding by id is what survives a rename or a reorder.
    const spaghetti = payload.ingredients.find((i) => i.name === 'spaghetti');
    expect(spaghetti?.id).toBeTruthy();
    expect(payload.instructionSteps[0].text).toContain('@[0]');
    expect(payload.instructionSteps[0].mentions?.[0].ingredientId).toBe(spaghetti?.id);
  });
});

test.describe('Reading', () => {
  /** The steps list on the recipe detail page. */
  const stepsOf = (page: Page) =>
    page.getByTestId('instructions-heading').locator('xpath=../..').locator('li');

  test('a broken reference still reads, using the stored name', async ({ page }) => {
    await seedAuth(page);
    // Recipe 2's second step mentions an ingredient no longer in its list.
    await page.goto('/recipes/2');
    await expect(page.getByRole('heading', { name: 'Chicken Tikka Masala' })).toBeVisible();

    const steps = stepsOf(page);
    // Bound mention, name-only display.
    await expect(steps.nth(0)).toContainText('Marinate chicken breast in spices');
    // Broken reference: the sentence still reads via the stored fallback name.
    await expect(steps.nth(1)).toContainText('Grill or pan-fry yogurt until cooked.');

    // ...and unlike a live mention, it does not scale with the servings.
    await page.getByRole('button', { name: 'Flere' }).click();
    await expect(steps.nth(1)).toContainText('Grill or pan-fry yogurt until cooked.');
  });

  test('the detail page and matlagingsmodus resolve a step identically', async ({ page }) => {
    await seedAuth(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/recipes/1');
    await expect(page.getByRole('heading', { name: 'Classic Spaghetti Carbonara' })).toBeVisible();

    // Regression guard for the spec's "cannot drift apart" requirement: a future
    // surface that bypassed the shared resolver would show up here as a mismatch.
    const onPage = await stepsOf(page).first().innerText();

    await page.getByTestId('matlagingsmodus-fab').click();
    const overlay = page.getByTestId('matlagingsmodus-overlay');
    await overlay.getByRole('tab', { name: 'Slik gjør du' }).click();
    const inOverlay = await overlay.getByRole('button', { name: /Trinn 1:/ }).innerText();

    expect(inOverlay).toContain('400 g spaghetti');
    expect(onPage).toContain('400 g spaghetti');
  });
});
