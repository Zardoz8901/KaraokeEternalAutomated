import { describe, expect, it } from 'vitest'
import { defaultMiddlewareOptions } from './middlewareOptions'

describe('store middleware configuration', () => {
  it('ignores only redux-optimistic-ui wrapper history for immutable state checks', () => {
    expect(defaultMiddlewareOptions.immutableCheck.ignoredPaths).toEqual([
      'queue.history',
      'userStars.history',
    ])
  })
})
