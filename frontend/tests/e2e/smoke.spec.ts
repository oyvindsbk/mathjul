import { test, expect } from '@playwright/test';

test.describe('Food Recipes App - Smoke Tests', () => {
  test('should navigate to home page and display recipe cards', async ({ page }) => {
    await page.goto('/');
    
    // Verify sidebar is visible
    await expect(page.locator('text=Recipe Explorer')).toBeVisible();
    
    // Verify navigation links exist
    await expect(page.locator('a:has-text("Home")')).toBeVisible();
    await expect(page.locator('a:has-text("Snurr mathjulet")')).toBeVisible();
    
    // Wait for recipes to load - look for at least one recipe title
    await expect(page.locator('h3:has-text("Classic Spaghetti Carbonara")').first()).toBeVisible();
  });

  test('should navigate to spin wheel page and spin the wheel', async ({ page }) => {
    await page.goto('/spin');
    
    // Check page title
    await expect(page.locator('h1:has-text("Snurr mathjulet")')).toBeVisible();
    
    // Verify wheel is visible (look for recipe names on the wheel) - use first() to avoid strict mode
    await expect(page.locator('text=Classic Spaghetti Carbonara').first()).toBeVisible();
    
    // Find and click the spin button
    const spinButton = page.locator('button:has-text("Start Spinning!")');
    await expect(spinButton).toBeVisible();
    await expect(spinButton).toBeEnabled();
    
    // Click the spin button
    await spinButton.click();
    
    // Wait for button to change to "Spinning..." - this indicates the state changed
    await expect(page.locator('button:has-text("Spinning...")')).toBeVisible({ timeout: 1000 });
    
    // Wait for animation to complete (4 seconds + buffer)
    await page.waitForTimeout(5000);
    
    // Button should be re-enabled and show "Start Spinning!" again
    await expect(spinButton).toBeEnabled();
    
    // Result panel should show a recipe
    const resultPanel = page.locator('text=You got:');
    await expect(resultPanel).toBeVisible();
  });

  test('should navigate to recipe detail page', async ({ page }) => {
    await page.goto('/recipes/1');
    
    // Check for recipe title
    await expect(page.locator('h1:has-text("Classic Spaghetti Carbonara")')).toBeVisible();
    
    // Check for description
    await expect(page.locator('text=A traditional Italian pasta dish')).toBeVisible();
    
    // Check for sections (even if empty in mock data)
    await expect(page.locator('h2:has-text("Ingredients")')).toBeVisible();
    await expect(page.locator('h2:has-text("Instructions")')).toBeVisible();
    
    // Check for back link
    await expect(page.locator('a:has-text("Back to Recipes")')).toBeVisible();
  });

  test('should navigate between spin page and home using sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Verify on home page
    const homeLink = page.locator('a:has-text("Home")');
    await expect(homeLink).toBeVisible();
    
    // Navigate to spin page using sidebar
    const spinLink = page.locator('a:has-text("Snurr mathjulet")');
    await spinLink.click();
    
    // Should be on spin page
    await expect(page.locator('h1:has-text("Snurr mathjulet")')).toBeVisible();
    
    // Navigate back to home
    await homeLink.click();
    
    // Should be back on home page
    await expect(page.locator('text=Food Recipes')).toBeVisible();
  });

  test('should navigate from spin wheel result to recipe detail page', async ({ page }) => {
    await page.goto('/spin');
    
    // Spin the wheel
    const spinButton = page.locator('button:has-text("Start Spinning!")');
    await spinButton.click();
    
    // Wait for button to change to "Spinning..." to ensure animation started
    await expect(page.locator('button:has-text("Spinning...")')).toBeVisible({ timeout: 1000 });
    
    // Wait for animation and result to show
    await page.waitForTimeout(5500);
    
    // Wait for the "You got:" text to appear
    await expect(page.locator('text=You got:')).toBeVisible({ timeout: 2000 });
    
    // Click "View Recipe" button - use first() to avoid strict mode issues
    const viewRecipeLink = page.locator('a:has-text("View Recipe")').first();
    await expect(viewRecipeLink).toBeVisible();
    await viewRecipeLink.click();
    
    // Should navigate to a recipe detail page and URL should contain /recipes/
    await expect(page).toHaveURL(/\/recipes\/\d+/);
  });

  test('should display available recipes list on spin page', async ({ page }) => {
    await page.goto('/spin');
    
    // Check for "Available Recipes" heading
    await expect(page.locator('h3:has-text("Available Recipes")')).toBeVisible();
    
    // Check for each recipe - use first() to handle duplicate text nodes
    const recipes = [
      'Classic Spaghetti Carbonara',
      'Chicken Tikka Masala',
      'Chocolate Chip Cookies',
      'Caesar Salad',
    ];
    
    for (const recipe of recipes) {
      await expect(page.locator(`text=${recipe}`).first()).toBeVisible();
    }
    
    // Recipes should be clickable - find the link with first()
    const recipeLink = page.locator('a:has-text("Classic Spaghetti Carbonara")').first();
    await expect(recipeLink).toBeVisible();
  });

  test('should handle responsive layout on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto('/spin');
    
    // Check that main elements are still visible
    await expect(page.locator('h1:has-text("Snurr mathjulet")')).toBeVisible();
    await expect(page.locator('button:has-text("Start Spinning!")')).toBeVisible();
    
    // Sidebar should still be present
    await expect(page.locator('text=Recipe Explorer')).toBeVisible();
  });
});
