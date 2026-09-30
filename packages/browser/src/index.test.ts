import { describe, it, expect } from 'vitest'
import * as sdk from './index.js'

describe('@ledewire/browser public exports', () => {
  it('exports SpendCapReachedError as a LedewireError subclass', () => {
    const err = new sdk.SpendCapReachedError('Daily spend cap reached', {
      capCents: 1000,
      spentCents: 1000,
      remainingCents: 0,
      resetsAt: '2026-08-21T00:00:00Z',
      bulkExempt: false,
    })

    expect(err).toBeInstanceOf(sdk.LedewireError)
    expect(err.statusCode).toBe(402)
  })
})
