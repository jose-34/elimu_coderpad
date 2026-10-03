// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const API_PORT = 5050;
const WEB_PORT = 4173;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL || 'postgresql://ci:ci@localhost:5432/codelive_e2e_test';

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Migrate + seed, then run the real backend against a throwaway database.
      command: 'npx prisma migrate deploy && node prisma/seed.js && node src/server.js',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL,
        PORT: String(API_PORT),
        // Skips rate limiting: one machine drives every request in the suite.
        NODE_ENV: 'test',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        JWT_SECRET: 'e2e-access-secret',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret',
      },
    },
    {
      // The production bundle, served the way nginx would (with SPA fallback).
      command: `npm run build && npx vite preview --port ${WEB_PORT} --strictPort`,
      cwd: '../frontend',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_API_URL: `http://localhost:${API_PORT}`,
        VITE_JITSI_DOMAIN: 'jitsi.invalid',
      },
    },
  ],
});
