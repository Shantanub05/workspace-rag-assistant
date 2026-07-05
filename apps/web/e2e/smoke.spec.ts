import { expect, test } from '@playwright/test';

test('renders sign-in experience', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Workspace RAG Assistant' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
