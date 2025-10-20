import { test, expect } from '@playwright/test';

test.describe('Food Recipes App - Smoke Tests', () => {
  test('should navigate to home page and display recipe cards', async ({ page }) => {
    await page.goto('/');
    
    // Verify sidebar is visible
    await expect(page.getByTestId('sidebar-title')).toBeVisible();
    
    // Verify navigation links exist
    await expect(page.getByTestId('nav-home')).toBeVisible();
    await expect(page.getByTestId('nav-spin')).toBeVisible();
    
    // Wait for recipes to load - look for recipe grid
    await expect(page.getByTestId('recipe-grid')).toBeVisible();
    await expect(page.getByTestId('recipe-card-1')).toBeVisible();
  });

  test('should navigate to spin wheel page and spin the wheel', async ({ page }) => {
    await page.goto('/spin');
    
    // Check page title
    await expect(page.locator('h1:has-text("Snurr mathjulet")')).toBeVisible();
    
    // Find and click the spin button
    const spinButton = page.getByTestId('spin-button');
    await expect(spinButton).toBeVisible();
    await expect(spinButton).toBeEnabled();
    
    // Click the spin button
    await spinButton.click();
    
    // Wait for button to change disabled state
    await expect(spinButton).toBeDisabled();
    
    // Wait for animation to complete (4 seconds + buffer)
    await page.waitForTimeout(5000);
    
    // Button should be re-enabled
    await expect(spinButton).toBeEnabled();
    
    // Result panel should be visible
    await expect(page.getByTestId('result-panel')).toBeVisible();
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

  test('should navigate between spin page and home using sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Verify on home page
    const homeLink = page.getByTestId('nav-home');
    await expect(homeLink).toBeVisible();
    
    // Navigate to spin page using sidebar
    const spinLink = page.getByTestId('nav-spin');
    await spinLink.click();
    
    // Should be on spin page
    await expect(page.locator('h1:has-text("Snurr mathjulet")')).toBeVisible();
    
    // Navigate back to home
    await homeLink.click();
    
    // Should be back on home page - verify recipe grid is visible
    await expect(page.getByTestId('recipe-grid')).toBeVisible();
  });

  test('should navigate from spin wheel result to recipe detail page', async ({ page }) => {
    await page.goto('/spin');
    
    // Spin the wheel
    const spinButton = page.getByTestId('spin-button');
    await spinButton.click();
    
    // Wait for button to be disabled
    await expect(spinButton).toBeDisabled();
    
    // Wait for animation and result to show
    await page.waitForTimeout(5500);
    
    // Wait for the result panel to appear
    await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 2000 });
    
    // Click "View Recipe" button
    const viewRecipeLink = page.getByTestId('view-recipe-link');
    await expect(viewRecipeLink).toBeVisible();
    await viewRecipeLink.click();
    
    // Should navigate to a recipe detail page
    await expect(page).toHaveURL(/\/recipes\/\d+/);
  });

  test('should display available recipes list on spin page', async ({ page }) => {
    await page.goto('/spin');
    
    // Check for recipes list
    await expect(page.getByTestId('recipes-list')).toBeVisible();
    
    // Check for each recipe
    await expect(page.getByTestId('recipe-list-item-1')).toBeVisible();
    await expect(page.getByTestId('recipe-list-item-2')).toBeVisible();
    await expect(page.getByTestId('recipe-list-item-3')).toBeVisible();
    await expect(page.getByTestId('recipe-list-item-4')).toBeVisible();
  });

  test('should handle responsive layout on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto('/spin');
    
    // Check that main elements are still visible
    await expect(page.locator('h1:has-text("Snurr mathjulet")')).toBeVisible();
    await expect(page.getByTestId('spin-button')).toBeVisible();
    
    // Sidebar should still be present
    await expect(page.getByTestId('sidebar-title')).toBeVisible();
  });
});
