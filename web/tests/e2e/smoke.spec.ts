import { test, expect } from '@playwright/test';

test.describe('smoke pages', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Taskal AI/);
  });

  test('pricing page loads', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).toHaveTitle(/Taskal AI/);
  });

  test('grading page loads', async ({ page }) => {
    await page.goto('/grading');
    await expect(page).toHaveTitle(/Taskal AI/);
  });
});

test.describe('stripe api graceful failure', () => {
  test('checkout endpoint returns JSON and no 500 in missing env', async ({ request }) => {
    const res = await request.post('/api/stripe/checkout', {
      data: { planName: 'light' },
    });
    expect([401, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('portal endpoint returns JSON and no 500 in missing env', async ({ request }) => {
    const res = await request.post('/api/stripe/portal', { data: {} });
    expect([401, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('sync endpoint returns JSON and no 500 in missing env', async ({ request }) => {
    const res = await request.post('/api/stripe/sync', { data: {} });
    expect([401, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('webhook endpoint returns JSON and no 500 in missing env', async ({ request }) => {
    const res = await request.post('/api/stripe/webhook', {
      headers: { 'stripe-signature': 'test' },
      data: {},
    });
    expect([400, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toBeTruthy();
  });
});
