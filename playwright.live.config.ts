import { defineConfig, devices } from '@playwright/test';

const botSuffix = ' DevOpsDailyLiveCheck-bot/1.0';

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 1,
  timeout: 60_000,
  workers: 4,
  reporter: process.env.CI
    ? [['list'], ['json', { outputFile: 'test-results/live-report.json' }], ['github']]
    : [['list'], ['json', { outputFile: 'test-results/live-report.json' }]],
  use: {
    baseURL: 'https://devops-daily.com',
    screenshot: 'only-on-failure',
    // Local runs on machines without Playwright's browser, e.g. /usr/bin/chromium.
    launchOptions: process.env.LIVE_CHECK_CHROMIUM
      ? { executablePath: process.env.LIVE_CHECK_CHROMIUM }
      : {},
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        userAgent: `${devices['Desktop Chrome'].userAgent}${botSuffix}`,
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        userAgent: `${devices['Pixel 7'].userAgent}${botSuffix}`,
      },
    },
  ],
});
