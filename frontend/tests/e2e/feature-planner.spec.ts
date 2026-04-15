import { test, expect, type Page } from '@playwright/test';

test.describe('Feature Planner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feature-planner');
    // Wait for the board to load
    await expect(page.getByRole('heading', { name: 'Feature Planner' })).toBeVisible();
  });

  test('should display the board with default columns', async ({ page }) => {
    await expect(page.getByText('New Feature')).toBeVisible();
    await expect(page.getByText('Planned Feature')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('should show feature planner in sidebar nav', async ({ page }) => {
    await expect(page.getByTestId('nav-feature-planner')).toBeVisible();
  });

  test('should create a card manually', async ({ page }) => {
    // Open new card modal via header button
    await page.getByRole('button', { name: 'New Feature' }).click();

    // Switch to manual tab
    await page.getByRole('button', { name: 'Write it yourself' }).click();

    // Fill in required fields
    await page.getByPlaceholder('e.g. Shopping list from meal plan').fill('My Test Feature');
    await page.getByPlaceholder('A 1-2 sentence description').fill('This feature does something useful for the user.');

    // Save
    await page.getByRole('button', { name: 'Add to board' }).click();

    // Card should appear on the board
    await expect(page.getByText('My Test Feature')).toBeVisible();
  });

  test('should open card detail modal when clicking a card', async ({ page }) => {
    // Create a card first
    await createCardManually(page, 'Detail Test Card', 'A feature for testing the detail modal.');

    // Click the card
    await page.getByText('Detail Test Card').click();

    // Detail modal should be visible with content
    await expect(page.getByRole('heading', { name: 'Detail Test Card' })).toBeVisible();
    await expect(page.getByText('A feature for testing the detail modal.')).toBeVisible();
  });

  test('should copy card content to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await createCardManually(page, 'Copy Test Feature', 'This tests clipboard copy.');

    // Open card detail
    await page.getByText('Copy Test Feature').click();
    await expect(page.getByText('Copy for VS Code')).toBeVisible();

    // Click copy button
    await page.getByRole('button', { name: 'Copy for VS Code' }).click();

    // Button should show "Copied!"
    await expect(page.getByText('Copied!')).toBeVisible();

    // Clipboard should contain the feature title
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('# Copy Test Feature');
    expect(clipboardText).toContain('This tests clipboard copy.');
  });

  test('should delete a card', async ({ page }) => {
    await createCardManually(page, 'Card To Delete', 'This card will be deleted.');

    await page.getByText('Card To Delete').click();

    // Click delete
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Yes, delete' }).click();

    // Card should be gone
    await expect(page.getByText('Card To Delete')).not.toBeVisible();
  });

  test('should edit a card', async ({ page }) => {
    await createCardManually(page, 'Original Title', 'Original summary.');

    // Open detail, then edit
    await page.getByText('Original Title').click();
    await page.getByRole('button', { name: 'Edit' }).click();

    // Change title
    const titleInput = page.getByPlaceholder('e.g. Shopping list from meal plan');
    await titleInput.clear();
    await titleInput.fill('Updated Title');

    await page.getByRole('button', { name: 'Save changes' }).click();

    // Updated title should be on the board
    await expect(page.getByText('Updated Title')).toBeVisible();
    await expect(page.getByText('Original Title')).not.toBeVisible();
  });

  test('should add a new column', async ({ page }) => {
    await page.getByRole('button', { name: 'Add column' }).click();

    await page.getByPlaceholder('e.g. Backlog').fill('My New Column');
    await page.getByRole('button', { name: 'Add column' }).last().click();

    await expect(page.getByText('My New Column')).toBeVisible();
  });

  test('should show technical fields collapsed by default in card form', async ({ page }) => {
    await page.getByRole('button', { name: 'New Feature' }).click();
    await page.getByRole('button', { name: 'Write it yourself' }).click();

    // Technical section should exist but be collapsed
    await expect(page.getByText('Technical notes')).toBeVisible();
    // The data model field should not be visible (it's inside the collapsed section)
    await expect(page.getByText('What data needs to be stored?')).not.toBeVisible();

    // Expand it
    await page.getByText('Technical notes').click();
    await expect(page.getByText('What data needs to be stored?')).toBeVisible();
  });

  test('should show AI generation tab by default for new cards', async ({ page }) => {
    await page.getByRole('button', { name: 'New Feature' }).click();

    // AI tab should be active by default
    await expect(page.getByPlaceholder(/Describe the feature/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate with AI' })).toBeVisible();
  });
});

async function createCardManually(page: Page, title: string, summary: string) {
  await page.getByRole('button', { name: 'New Feature' }).click();
  await page.getByRole('button', { name: 'Write it yourself' }).click();
  await page.getByPlaceholder('e.g. Shopping list from meal plan').fill(title);
  await page.getByPlaceholder('A 1-2 sentence description').fill(summary);
  await page.getByRole('button', { name: 'Add to board' }).click();
  await expect(page.getByText(title)).toBeVisible();
}
