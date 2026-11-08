/**
 * Type-level pins: each method's exported return type must be exactly what its
 * operation's success response declares in `ledewire.yml`. A divergence is a
 * compile error, so `pnpm typecheck` fails before any test runs.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type {
  CheckoutStateResponse,
  ContentWithAccessResponse,
  WalletPaymentStatusResponse,
} from '@ledewire/core'
import type { OperationOk, Returns } from '@ledewire/core/test-utils'
import type { BrowserClient } from './client.js'

describe('return types match the spec operation responses', () => {
  it('content.getWithAccess', () => {
    type Op = OperationOk<'/v1/content/{id}/with-access', 'get'>
    expectTypeOf<Returns<BrowserClient['content']['getWithAccess']>>().toEqualTypeOf<Op>()
    expectTypeOf<ContentWithAccessResponse>().toEqualTypeOf<Op>()
  })

  it('checkout.state', () => {
    type Op = OperationOk<'/v1/checkout/state/{content_id}', 'get'>
    expectTypeOf<Returns<BrowserClient['checkout']['state']>>().toEqualTypeOf<Op>()
    expectTypeOf<CheckoutStateResponse>().toEqualTypeOf<Op>()
  })

  it('wallet.getPaymentStatus', () => {
    type Op = OperationOk<'/v1/wallet/payment-status/{session_id}', 'get'>
    expectTypeOf<Returns<BrowserClient['wallet']['getPaymentStatus']>>().toEqualTypeOf<Op>()
    expectTypeOf<WalletPaymentStatusResponse>().toEqualTypeOf<Op>()
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

  it('Payment keys: the Buyer list is a bare array, the Machine user list an envelope', () => {
    type UserList = OperationOk<'/v1/user/payment-keys', 'get'>
    expectTypeOf<Returns<BrowserClient['user']['paymentKeys']['list']>>().toEqualTypeOf<UserList>()
    expectTypeOf<Returns<BrowserClient['user']['paymentKeys']['create']>>().toEqualTypeOf<
      OperationOk<'/v1/user/payment-keys', 'post', 201>
    >()
    expectTypeOf<
      Returns<BrowserClient['company']['machineUsers']['paymentKeys']['list']>
    >().toEqualTypeOf<
      OperationOk<'/v1/company/machine-users/{machine_user_id}/payment-keys', 'get'>
    >()
    expectTypeOf<
      Returns<BrowserClient['company']['machineUsers']['paymentKeys']['create']>
    >().toEqualTypeOf<
      OperationOk<'/v1/company/machine-users/{machine_user_id}/payment-keys', 'post', 201>
    >()
  })
})
