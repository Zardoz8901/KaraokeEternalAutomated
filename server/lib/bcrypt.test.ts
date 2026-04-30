import { describe, expect, it } from 'vitest'
import bcrypt from './bcrypt.js'

const LEGACY_NATIVE_BCRYPT_HASH = '$2b$12$6x4l0wDD9wzXAc7fN3oKbuJa0SdR/L4ATyytUXxaDZSSnhIqNerP6'

describe('bcrypt wrapper', () => {
  it('hashes and verifies passwords through the wrapper contract', async () => {
    const hash = await bcrypt.hash('correct-password', 12)

    expect(hash).toMatch(/^\$2[aby]\$12\$/)
    await expect(bcrypt.compare('correct-password', hash)).resolves.toBe(true)
    await expect(bcrypt.compare('wrong-password', hash)).resolves.toBe(false)
  })

  it('verifies hashes produced by the previous native bcrypt dependency', async () => {
    await expect(bcrypt.compare('correct-password', LEGACY_NATIVE_BCRYPT_HASH)).resolves.toBe(true)
    await expect(bcrypt.compare('wrong-password', LEGACY_NATIVE_BCRYPT_HASH)).resolves.toBe(false)
  })

  it('identifies bcrypt hashes as legacy hashes for future migration passes', () => {
    expect(bcrypt.isLegacy(LEGACY_NATIVE_BCRYPT_HASH)).toBe(true)
    expect(bcrypt.isLegacy('$argon2id$v=19$m=65536,t=3,p=1$salt$hash')).toBe(false)
    expect(bcrypt.isLegacy('')).toBe(false)
  })
})
