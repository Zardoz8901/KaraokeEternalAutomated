/**
 * Minimal Hydra preset code for deterministic E2E testing.
 * Produces visible colored output — no camera, no external URLs, no network.
 */
export const TEST_PRESET_CODE = `
osc(10, 0.1, 0.8)
  .color(1.0, 0.5, 0.2)
  .rotate(0.1)
  .out()
`.trim()
