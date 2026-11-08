import { describe, it, expect } from 'vitest'
import * as x402Client from './index.js'

describe('index exports', () => {
  it('re-exports AuthError, ForbiddenError, LedewireError, RateLimitError, and SpendCapReachedError from @ledewire/core', () => {
    // The docs point users at these classes as `@ledewire/x402-client` imports
    // (never `@ledewire/core`, which is private and unpublished) — this locks
    // in that the package actually exports them.
    expect(x402Client.AuthError).toBeTypeOf('function')
    expect(x402Client.ForbiddenError).toBeTypeOf('function')
    expect(x402Client.LedewireError).toBeTypeOf('function')
    expect(x402Client.SpendCapReachedError).toBeTypeOf('function')
    expect(x402Client.RateLimitError).toBeTypeOf('function')
  })

  it('exports PaymentOriginNotAllowedError as a LedewireError', () => {
    const err = new x402Client.PaymentOriginNotAllowedError(
      'https://a.example',
      'https://b.example',
    )
    expect(err).toBeInstanceOf(x402Client.LedewireError)
    expect(err.name).toBe('PaymentOriginNotAllowedError')
  })

  it('exports PaymentRefusedError and PriceAboveMaximumError as LedewireErrors', () => {
    const refused = new x402Client.PaymentRefusedError('nonce_already_used')
    expect(refused).toBeInstanceOf(x402Client.LedewireError)
    expect(refused).toMatchObject({ name: 'PaymentRefusedError', type: 'nonce_already_used' })
    const above = new x402Client.PriceAboveMaximumError(301, 300)
    expect(above).toBeInstanceOf(x402Client.LedewireError)
    expect(above.name).toBe('PriceAboveMaximumError')
  })

  it('exports the Payment key helpers', () => {
    expect(x402Client.registerPaymentKey).toBeTypeOf('function')
    expect(x402Client.createPaymentKeyRegistration).toBeTypeOf('function')
    expect(x402Client.generatePaymentKey).toBeTypeOf('function')
    expect(x402Client.canonicalAuthorization).toBeTypeOf('function')
  })
})
