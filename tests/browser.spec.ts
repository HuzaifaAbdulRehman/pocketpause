import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const card = { duration: 5, surroundings: 'courtyard', title: 'Notice light', steps: ['Observe a shadow from a safe spot.'], source: 'local-ai' };

test('defaults, every choice and keyboard generation', async ({ page }) => {
  let body: unknown;
  await page.route('**/api/activity', async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { ...card, ...(body as object) } });
  });
  await page.goto('/');
  const duration = page.getByLabel('Time away');
  const surroundings = page.getByLabel('Surroundings');
  await expect(duration).toHaveValue('5');
  await expect(surroundings).toHaveValue('courtyard');
  await expect(duration.locator('option')).toHaveText(['5 minutes', '10 minutes', '15 minutes']);
  await expect(surroundings.locator('option')).toHaveText(['Street', 'Terrace', 'Courtyard', 'Campus']);
  await duration.selectOption('15');
  await surroundings.selectOption('campus');
  await page.getByRole('button', { name: 'Generate activity' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Notice light' })).toBeVisible();
  expect(body).toEqual({ duration: 15, surroundings: 'campus' });
  await expect(page.getByText('15 minutes · campus', { exact: true })).toBeVisible();
});

test('one request while busy, then plain-text save', async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/api/activity', async route => { calls++; await wait; await route.fulfill({ json: card }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Generate activity' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole('button', { name: 'Generating…' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('local model');
  expect(calls).toBe(1);
  release();
  await expect(page.getByRole('heading', { name: 'Notice light' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save activity' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('pocketpause.txt');
  const path = await file.path();
  expect(path).not.toBeNull();
  const content = await readFile(path!, 'utf8');
  expect(content).toContain('5 minutes · courtyard');
  expect(content).toContain('Observe a shadow from a safe spot.');
  expect(content).toContain('Stay away from traffic and edges.');
});

test('failure preserves the old card and its selected context; retry succeeds', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/activity', async route => {
    calls++;
    await route.fulfill(calls === 2 ? { status: 504, json: { error: 'The local model took too long. Try again.' } } : { json: card });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Generate activity' }).click();
  await expect(page.getByRole('heading', { name: 'Notice light' })).toBeVisible();
  await page.getByLabel('Time away').selectOption('10');
  await page.getByLabel('Surroundings').selectOption('terrace');
  await page.getByRole('button', { name: 'Generate activity' }).click();
  await expect(page.getByRole('alert')).toContainText('took too long');
  await expect(page.getByText('5 minutes · courtyard', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save activity' })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save activity' }).click();
  expect(await readFile((await (await download).path())!, 'utf8')).toContain('5 minutes · courtyard');
  await page.getByRole('button', { name: 'Generate activity' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls).toBe(3);
});

test('model markup stays inert in the page and download', async ({ page }) => {
  const title = '<img src=x onerror="window.pwned=1">';
  await page.route('**/api/activity', route => route.fulfill({ json: { ...card, title } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Generate activity' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, 'pwned'))).toBe(false);
  await expect(page.locator('article img')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save activity' }).click();
  expect(await readFile((await (await download).path())!, 'utf8')).toContain(title);
});

test('network failure and narrow screen remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route('**/api/activity', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Generate activity' }).click();
  await expect(page.getByRole('alert')).toContainText('local server');
  for (const control of [page.getByLabel('Time away'), page.getByLabel('Surroundings'), page.getByRole('button', { name: 'Generate activity' })]) {
    await expect(control).toBeVisible();
    const rect = await control.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
