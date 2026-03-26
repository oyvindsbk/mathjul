import { test, expect } from '@playwright/test';

test.describe('Food Recipes App - Smoke Tests', () => {
  test('should navigate to home page and display recipe cards', async ({ page }) => {
    await page.goto('/');
    
    // Verify sidebar is visible
    await expect(page.getByTestId('sidebar-title')).toBeVisible();
    
    // Verify navigation links exist
    await expect(page.getByTestId('nav-home')).toBeVisible();
    
    // Wait for recipes to load - look for recipe grid
    await expect(page.getByTestId('recipe-grid')).toBeVisible();
    await expect(page.getByTestId('recipe-card-1')).toBeVisible();
  });

  test('should navigate to recipe detail page', async ({ page }) => {
    await page.goto('/recipes/1');
    
    // Check for recipe title
    await expect(page.locator('h1:has-text("Classic Spaghetti Carbonara")')).toBeVisible();
    
    // Check for description
    await expect(page.locator('text=A traditional Italian pasta dish')).toBeVisible();
    
    // Check for sections using test IDs
    await expect(page.getByTestId('ingredients-heading')).toBeVisible();
    await expect(page.getByTestId('instructions-heading')).toBeVisible();
    
    // Check for back link
    await expect(page.getByTestId('back-link')).toBeVisible();
  });
});
