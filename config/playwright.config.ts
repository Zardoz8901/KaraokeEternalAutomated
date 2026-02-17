import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// Isolated data directory — fresh DB every run
const configDir = path.dirname(fileURLToPath(import.meta.url))
const e2eDataDir = path.resolve(configDir, '..', '.tmp', 'e2e-data')

// Clean stale data from previous runs
fs.rmSync(e2eDataDir, { recursive: true, force: true })
fs.mkdirSync(e2eDataDir, { recursive: true })

const projectRoot = path.resolve(configDir, '..')
const E2E_PORT = 3033

export default defineConfig({
  testDir: '../e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,

  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
          launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
        }),
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: `KES_PATH_DATA=${e2eDataDir} NODE_ENV=development tsx watch server/main.ts -p ${E2E_PORT}`,
    cwd: projectRoot,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
