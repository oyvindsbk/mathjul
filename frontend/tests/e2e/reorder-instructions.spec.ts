import { test, expect } from '@playwright/test';

test.describe('Recipe instruction reordering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipes/1/edit');
    await expect(page.locator('h1:has-text("Edit Recipe")')).toBeVisible();

    // Add 3 steps to test with
    const addStep = page.getByRole('button', { name: '+ Add Step' });
    await addStep.click();
    await addStep.click();
    await addStep.click();

    // Fill in content so we can verify ordering
    await page.locator('textarea').nth(0).fill('Step A');
    await page.locator('textarea').nth(1).fill('Step B');
    await page.locator('textarea').nth(2).fill('Step C');
  });

  test('shows drag handle and step controls on each step', async ({ page }) => {
    const dragHandles = page.getByRole('button', { name: 'Drag to reorder' });
    // Instructions have 3, ingredients have 5
    const count = await dragHandles.count();
    expect(count).toBeGreaterThanOrEqual(3);

    await expect(page.getByTestId('insert-below-0')).toBeVisible();
    await expect(page.getByTestId('remove-instruction-0')).toBeVisible();
  });

  test('insert-below adds an empty step at the correct position', async ({ page }) => {
    const initialCount = await page.getByTestId(/^insert-below-\d+$/).count();

    await page.getByTestId('insert-below-0').click();

    const newCount = await page.getByTestId(/^insert-below-\d+$/).count();
    expect(newCount).toBe(initialCount + 1);

    // The new step at index 1 should be empty
    await expect(page.locator('textarea').nth(1)).toHaveValue('');
    // Original step B is now at index 2
    await expect(page.locator('textarea').nth(2)).toHaveValue('Step B');
  });

  test('delete removes the correct step', async ({ page }) => {
    await page.getByTestId('remove-instruction-1').click();

    await expect(page.locator('textarea').nth(0)).toHaveValue('Step A');
    await expect(page.locator('textarea').nth(1)).toHaveValue('Step C');
  });

  test('step numbers update after delete', async ({ page }) => {
    await page.getByTestId('remove-instruction-0').click();

    const badges = page.locator('span.font-medium');
    await expect(badges.first()).toHaveText('1');
    await expect(badges.nth(1)).toHaveText('2');
  });
});
