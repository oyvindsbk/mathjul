# E2E Smoke Tests

This directory contains end-to-end smoke tests for the Food Recipes application using Playwright.

## Overview

The smoke test suite (`smoke.spec.ts`) includes one test per major functionality:

1. **Home Page Navigation** - Verifies home page loads and displays navigation
2. **Spin Wheel Functionality** - Tests the spin wheel animation and recipe selection
3. **Recipe Detail Page** - Verifies recipe detail page loads with correct data
4. **Sidebar Navigation** - Tests navigation between pages using the sidebar
5. **Spin to Recipe Flow** - Tests clicking "View Recipe" from spin results
6. **Available Recipes List** - Verifies recipe list displays on spin page
7. **Responsive Layout** - Tests mobile viewport layout

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests with UI (interactive mode)
```bash
npm run test:e2e:ui
```

### Run tests with browser visible (headed mode)
```bash
npm run test:e2e:headed
```

### Debug tests
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/e2e/smoke.spec.ts
```

### Run tests for specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Configuration

Tests are configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000`
- **Browsers**: Chromium, Firefox, WebKit
- **Web Server**: Automatically starts dev server if needed
- **Reports**: HTML report generated in `playwright-report/`

## Test Results

After running tests, view the HTML report:
```bash
npx playwright show-report
```

## Adding New Tests

Add new tests to `tests/e2e/` directory following the same pattern:

```typescript
test('should do something', async ({ page }) => {
  await page.goto('/path');
  await expect(page.locator('selector')).toBeVisible();
  // More assertions...
});
```

## Troubleshooting

- **Dev server not starting**: Ensure port 3000 is available
- **Tests timing out**: Increase timeout in `playwright.config.ts`
- **Flaky tests**: Add explicit waits with `page.waitForTimeout()` or `page.waitForNavigation()`
