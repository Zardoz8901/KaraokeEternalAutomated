import { expect, type Page } from '@playwright/test'

export const TEST_ADMIN = {
  username: 'e2e-admin',
  name: 'E2E Test Admin',
  newPassword: 'test-password-e2e-2026',
  newPasswordConfirm: 'test-password-e2e-2026',
}

export async function seedAdminSession (page: Page) {
  const setupRes = await page.request.post('/api/setup', {
    data: TEST_ADMIN,
  })

  const status = setupRes.status()
  if (status === 401 || status === 403) {
    const loginRes = await page.request.post('/api/login', {
      data: {
        username: TEST_ADMIN.username,
        password: TEST_ADMIN.newPassword,
        roomId: 1,
      },
    })
    expect(loginRes.ok(), `Login failed: ${loginRes.status()}`).toBeTruthy()
    return
  }

  expect(setupRes.ok(), `Setup failed: ${status}`).toBeTruthy()
}
