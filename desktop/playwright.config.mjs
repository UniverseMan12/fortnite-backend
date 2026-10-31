import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: '*.spec.mjs', timeout: 45000, workers: 1, reporter: 'list', outputDir: '../test-results' });
