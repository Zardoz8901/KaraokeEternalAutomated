import { test, expect } from '@playwright/test'
import { TEST_PRESET_CODE } from './fixtures/test-preset'

/**
 * Smoke E2E test — deterministic, local-only.
 *
 * Auth strategy: seeded local user via first-run setup or login API.
 * The dev server starts with a fresh DB on each CI run, so /api/setup
 * creates the initial admin. If setup returns 403 (already initialized),
 * we fall back to login with the same credentials.
 *
 * Hydra strategy: the React PlayerVisualizer only mounts during active
 * audio playback (requires queued media). Instead, we load hydra-synth's
 * UMD bundle and create a standalone canvas to verify Hydra rendering
 * works in the browser environment.
 *
 * No camera, no external URLs, no network beyond localhost.
 */

const TEST_USER = {
  username: 'e2e-admin',
  name: 'E2E Test Admin',
  newPassword: 'test-password-e2e-2026',
  newPasswordConfirm: 'test-password-e2e-2026',
}

test.describe('Player smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Seed test user: try first-run setup, fall back to login
    const setupRes = await page.request.post('/api/setup', {
      data: TEST_USER,
    })

    if (!setupRes.ok()) {
      // Already initialized — login instead
      const loginRes = await page.request.post('/api/login', {
        data: {
          username: TEST_USER.username,
          password: TEST_USER.newPassword,
        },
      })
      expect(loginRes.ok(), `Login failed: ${loginRes.status()}`).toBeTruthy()
    } else {
      expect(setupRes.ok(), `Setup failed: ${setupRes.status()}`).toBeTruthy()
    }
  })

  test('loads player route and renders Hydra preset', async ({ page }) => {
    // Navigate to player route — auth cookie is set from beforeEach
    await page.goto('/player')

    // Verify the player route loaded (playback controls visible)
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 15_000 })

    // Load hydra-synth UMD bundle (sets window.Hydra) and create a
    // standalone canvas to verify Hydra rendering capability.
    // We need to patch getContext to force preserveDrawingBuffer so
    // WebGL readPixels works after compositing.
    await page.addScriptTag({ path: 'node_modules/hydra-synth/dist/hydra-synth.js' })

    await page.evaluate((code) => {
      const canvas = document.createElement('canvas')
      canvas.id = 'e2e-hydra'
      canvas.width = 400
      canvas.height = 400

      // Patch getContext to inject preserveDrawingBuffer for WebGL
      const origGetContext = canvas.getContext.bind(canvas)
      canvas.getContext = ((type: string, attrs?: any) => {
        if (type === 'webgl' || type === 'webgl2') {
          return origGetContext(type, { ...attrs, preserveDrawingBuffer: true })
        }
        return origGetContext(type, attrs)
      }) as typeof canvas.getContext

      document.body.appendChild(canvas)

      // eslint-disable-next-line no-new
      new (window as any).Hydra({ canvas, makeGlobal: true, autoLoop: true })

      // Apply the known test preset via Hydra's global API
      new Function(code)()
    }, TEST_PRESET_CODE)

    // Wait several animation frames for Hydra + SwiftShader to render
    await page.evaluate(() => new Promise<void>(resolve => {
      let frames = 0
      const tick = () => {
        if (++frames >= 10) return resolve()
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }))

    // Read pixels via WebGL readPixels (canvas has WebGL context, not 2D)
    const canvas = page.locator('#e2e-hydra')
    const hasContent = await canvas.evaluate((el: HTMLCanvasElement) => {
      const gl = el.getContext('webgl', { preserveDrawingBuffer: true })
        || el.getContext('webgl2', { preserveDrawingBuffer: true })
      if (!gl) return false

      const pixels = new Uint8Array(el.width * el.height * 4)
      gl.readPixels(0, 0, el.width, el.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

      // Sample ~1000 pixels for non-black content
      let nonBlackPixels = 0
      const step = Math.max(4, Math.floor(pixels.length / 4000)) * 4
      for (let i = 0; i < pixels.length; i += step) {
        if (pixels[i] > 0 || pixels[i + 1] > 0 || pixels[i + 2] > 0) {
          nonBlackPixels++
        }
      }

      return nonBlackPixels > 5
    })

    expect(hasContent, 'Hydra canvas should render non-black pixels from test preset').toBeTruthy()
  })
})
