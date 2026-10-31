import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let app, page, userData;
test.beforeEach(async () => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-ui-'));
  const env = { ...process.env, LAUNCHER_TEST_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ['.'], env });
  page = await app.firstWindow();
  await expect(page.locator('#app-version')).toHaveText('0.2.0');
});
test.afterEach(async () => { await app?.close(); fs.rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); });

test('navigation, mode selection and empty setup recovery', async () => {
  await expect(page.getByRole('heading', { name: 'Your next drop starts here.' })).toBeVisible();
  await page.locator('#launch').click();
  await expect(page.locator('#error-banner')).toContainText('Choose your Fortnite folder first');
  await expect(page.locator('#page-setup')).toBeVisible();
  await page.locator('[data-page="play"]').click();
  await page.locator('[data-mode="join"]').click();
  await expect(page.locator('#join-row')).toBeVisible();
  await page.locator('[data-mode="host"]').click();
  await expect(page.locator('#join-row')).toBeHidden();
  await expect(page.locator('#mode-note')).toContainText('Start Bus Countdown');
  await page.screenshot({ path: 'test-results/launcher-home.png' });
});

test('invalid installation fails visibly and allows another attempt', async () => {
  await page.locator('[data-page="setup"]').click();
  await page.locator('#game-path').fill(path.join(userData, 'missing-game'));
  await page.locator('#check').click();
  await expect(page.locator('#error-banner')).toContainText('missing FortniteGame');
  await expect(page.locator('#launch')).toBeEnabled();
  await expect(page.locator('#activity-list')).toContainText('missing FortniteGame');
  const result = await page.evaluate(() => window.launcher.link('file:///C:/Windows').catch(e => e.message));
  expect(result).toBe('Unknown link.');
});

test('renderer has no Node access and blocks injected script markup in errors', async () => {
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  expect(await page.evaluate(() => typeof window.process)).toBe('undefined');
  await page.locator('[data-page="setup"]').click();
  await page.locator('#game-path').fill('<img src=x onerror=window.pwned=1>');
  await page.locator('#check').click();
  await expect(page.locator('#error-banner')).toBeVisible();
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  expect(await page.locator('#error-banner img').count()).toBe(0);
});

test('main process rejects overlapping starts and handles immediate cancellation', async () => {
  const replies = await page.evaluate(async () => {
    const options = { mode: 'solo', gamePath: 'C:/missing-launcher-test-folder', host: '' };
    const first = window.launcher.start('launch', options);
    const second = window.launcher.start('launch', options).catch(error => error.message);
    await window.launcher.stop();
    return Promise.all([first, second]);
  });
  expect(replies[0]).toBe(true);
  expect(replies[1]).toContain('already running');
  await expect(page.locator('#launch')).toBeVisible();
  await expect(page.locator('#stop')).toBeHidden();
});

test('layout fits the minimum window size and keeps primary controls accessible', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(940, 700));
  await page.locator('[data-mode="join"]').click();
  await expect(page.locator('#host-address')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#launch').scrollIntoViewIfNeeded();
  await expect(page.locator('#launch')).toBeInViewport();
});
