/**
 * Type-level pins: each method's exported return type must be exactly what its
 * operation's success response declares in `ledewire.yml`. A divergence is a
 * compile error, so `pnpm typecheck` fails before any test runs.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type { OperationOk } from '@ledewire/core/test-utils'
import type { BrowserClient } from './client.js'

type Returns<F> = F extends (...args: never[]) => Promise<infer R> ? R : never

describe('return types match the spec operation responses', () => {
  it('content.getWithAccess', () => {
    expectTypeOf<Returns<BrowserClient['content']['getWithAccess']>>().toEqualTypeOf<
      OperationOk<'/v1/content/{id}/with-access', 'get'>
    >()
  })

  it('checkout.state', () => {
    expectTypeOf<Returns<BrowserClient['checkout']['state']>>().toEqualTypeOf<
      OperationOk<'/v1/checkout/state/{content_id}', 'get'>
    >()
  })

  it('wallet.getPaymentStatus', () => {
    expectTypeOf<Returns<BrowserClient['wallet']['getPaymentStatus']>>().toEqualTypeOf<
      OperationOk<'/v1/wallet/payment-status/{session_id}', 'get'>
    >()
  })

  it('auth.signup answers 201', () => {
    expectTypeOf<Returns<BrowserClient['auth']['signup']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/signup', 'post', 201>
    >()
  })

  it('auth password reset returns a flat message', () => {
    expectTypeOf<Returns<BrowserClient['auth']['requestPasswordReset']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/password/reset-request', 'post'>
    >()
    expectTypeOf<Returns<BrowserClient['auth']['resetPassword']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/password/reset', 'post'>
    >()
  })
})
