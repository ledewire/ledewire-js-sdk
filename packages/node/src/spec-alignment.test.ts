/**
 * Type-level pins: each method's exported return type must be exactly what its
 * operation's success response declares in `ledewire.yml`. A divergence is a
 * compile error, so `pnpm typecheck` fails before any test runs.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type {
  AuthTokenRefreshResponse,
  CheckoutStateResponse,
  CompanyMemberUpdateRequest,
  ContentWithAccessResponse,
  WalletPaymentStatusResponse,
} from '@ledewire/core'
import type { OperationOk, Returns } from '@ledewire/core/test-utils'
import type { NodeClient } from './client.js'

describe('return types match the spec operation responses', () => {
  it('content.getWithAccess', () => {
    type Op = OperationOk<'/v1/content/{id}/with-access', 'get'>
    expectTypeOf<Returns<NodeClient['content']['getWithAccess']>>().toEqualTypeOf<Op>()
    expectTypeOf<ContentWithAccessResponse>().toEqualTypeOf<Op>()
  })

  it('checkout.state', () => {
    type Op = OperationOk<'/v1/checkout/state/{content_id}', 'get'>
    expectTypeOf<Returns<NodeClient['checkout']['state']>>().toEqualTypeOf<Op>()
    expectTypeOf<CheckoutStateResponse>().toEqualTypeOf<Op>()
  })

  it('wallet.getPaymentStatus', () => {
    type Op = OperationOk<'/v1/wallet/payment-status/{session_id}', 'get'>
    expectTypeOf<Returns<NodeClient['wallet']['getPaymentStatus']>>().toEqualTypeOf<Op>()
    expectTypeOf<WalletPaymentStatusResponse>().toEqualTypeOf<Op>()
  })

  it('auth.signup answers 201', () => {
    expectTypeOf<Returns<NodeClient['auth']['signup']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/signup', 'post', 201>
    >()
  })

  it('auth password reset returns a flat message', () => {
    expectTypeOf<Returns<NodeClient['auth']['requestPasswordReset']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/password/reset-request', 'post'>
    >()
    expectTypeOf<Returns<NodeClient['auth']['resetPassword']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/password/reset', 'post'>
    >()
    expectTypeOf<Returns<NodeClient['merchant']['auth']['requestPasswordReset']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/merchant/password/reset-request', 'post'>
    >()
    expectTypeOf<Returns<NodeClient['merchant']['auth']['resetPassword']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/merchant/password/reset', 'post'>
    >()
  })

  it('token refresh answers either token response', () => {
    expectTypeOf<AuthTokenRefreshResponse>().toEqualTypeOf<
      OperationOk<'/v1/auth/token/refresh', 'post'>
    >()
  })

  it('company.members.update needs role or daily_spend_limit_cents', () => {
    expectTypeOf<{ role: 'admin' }>().toExtend<CompanyMemberUpdateRequest>()
    expectTypeOf<{ daily_spend_limit_cents: 500 }>().toExtend<CompanyMemberUpdateRequest>()
    expectTypeOf<Record<string, never>>().not.toExtend<CompanyMemberUpdateRequest>()
  })
})
