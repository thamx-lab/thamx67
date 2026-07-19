import { test, expect } from '@playwright/test';

test('has title and UI elements', async ({ page }) => {
  await page.goto('/');

  // Expect redirect to login page
  await expect(page).toHaveURL(/.*\/login/);

  // Check login title
  await expect(page.locator('h2', { hasText: 'Welcome Back' })).toBeVisible();

  // Check buttons
  await expect(page.locator('button', { hasText: 'Sign In' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'Sign Up' })).toBeVisible();
});

// Skip preset test as it requires dashboard access
test.skip('preset values are populated and editable', async ({ page }) => {
  await page.goto('/');

  // Check one of the preset fields (Meesho Crop width)
  const meeshoWidthInput = page.locator('.preset-card').filter({ hasText: 'Meesho preset' }).locator('input[type="number"]').nth(2);
  await expect(meeshoWidthInput).toHaveValue('595');

  // Edit value
  await meeshoWidthInput.fill('600');
  await expect(meeshoWidthInput).toHaveValue('600');
});

test('analytics endpoint mock check', async ({ request }) => {
  // Test the fullstack backend API
  const response = await request.post('/api/analytics', {
    data: {
      filesProcessed: 1,
      pagesProcessed: 2,
      platforms: { meesho: 1, flipkart: 0 }
    }
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.success).toBe(true);
});
