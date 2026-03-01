import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './playwright',
  outputDir: './test-results-phase7-b',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
})
