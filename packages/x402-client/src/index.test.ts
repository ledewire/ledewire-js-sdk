import { describe, it, expect } from 'vitest'
import * as x402Client from './index.js'

describe('index exports', () => {
  it('re-exports AuthError, LedewireError, and SpendCapReachedError from @ledewire/core', () => {
    // The docs point users at these classes as `@ledewire/x402-client` imports
    // (never `@ledewire/core`, which is private and unpublished) — this locks
    // in that the package actually exports them.
    expect(x402Client.AuthError).toBeTypeOf('function')
    expect(x402Client.LedewireError).toBeTypeOf('function')
    expect(x402Client.SpendCapReachedError).toBeTypeOf('function')
  })
})
