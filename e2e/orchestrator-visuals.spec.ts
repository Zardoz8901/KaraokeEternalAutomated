import { test, expect, type Page } from '@playwright/test'
import { seedAdminSession } from './fixtures/auth'

async function expectNoHorizontalOverflow (page: Page) {
  await expect.poll(async () => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
  ))).toBe(true)
}

test.describe('Visuals product navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page)
  })

  test('desktop discovers Visuals from app navigation and lands in the host workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/library')

    await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Queue' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Visuals' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Account' })).toBeVisible()

    await page.getByRole('link', { name: 'Visuals' }).click()

    await expect(page).toHaveURL(/\/orchestrator$/)
    await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
    await expect(page.locator('[aria-label="Orchestrator status"]')).toContainText('Host live coding')
    await expect(page.getByRole('tab', { name: 'Presets' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'API' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.screenshot({ path: '.tmp/playwright-visuals-desktop.png', fullPage: true })
  })

  test('mobile keeps Library escape outside the Orchestrator tablist', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/library')

    await page.getByRole('link', { name: 'Visuals' }).click()

    await expect(page).toHaveURL(/\/orchestrator$/)
    await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
    await expect(page.getByRole('tablist', { name: 'Orchestrator panels' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Stage' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Code' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Presets' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.screenshot({ path: '.tmp/playwright-visuals-mobile.png', fullPage: true })
  })
})
