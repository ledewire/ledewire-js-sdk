/**
 * Type-level pins: each x402-client wire type that `ledewire.yml` defines as a
 * schema must be exactly that schema. A divergence is a compile error, so
 * `pnpm typecheck` fails before any test runs.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type { SpecSchema } from '@ledewire/core/test-utils'
import type {
  LedewirePaymentAuthorization,
  LedewirePaymentKeyRecord,
  LedewirePaymentPayload,
  LedewirePaymentRequired,
  LedewirePaymentRequirements,
  LedewireRefusalCode,
  LedewireSettlementResponse,
  LedewireWalletPayload,
} from './types.js'
import type { PaymentKeyCreateBody } from './payment-keys.js'
import type { parsePaymentResponse } from './parse.js'

describe('x402-client wire types match the spec schemas', () => {
  it('LedewireSettlementResponse is SettlementResponse', () => {
    expectTypeOf<LedewireSettlementResponse>().toEqualTypeOf<SpecSchema<'SettlementResponse'>>()
  })

  it('parsePaymentResponse returns the settlement accessToken', () => {
    expectTypeOf<ReturnType<typeof parsePaymentResponse>>().toEqualTypeOf<Pick<
      SpecSchema<'SettlementResponse'>,
      'accessToken'
    > | null>()
  })

  it('LedewirePaymentRequired is X402PaymentRequired', () => {
    expectTypeOf<LedewirePaymentRequired>().toEqualTypeOf<SpecSchema<'X402PaymentRequired'>>()
  })

  it('LedewirePaymentRequirements is X402PaymentRequirements', () => {
    expectTypeOf<LedewirePaymentRequirements>().toEqualTypeOf<
      SpecSchema<'X402PaymentRequirements'>
    >()
  })

  it('LedewireWalletPayload is X402PaymentAuthorization', () => {
    expectTypeOf<LedewireWalletPayload>().toEqualTypeOf<SpecSchema<'X402PaymentAuthorization'>>()
    expectTypeOf<LedewirePaymentAuthorization>().toEqualTypeOf<
      SpecSchema<'X402PaymentAuthorization'>['authorization']
    >()
  })

  it('LedewirePaymentPayload is an X402PaymentPayload', () => {
    // `accepted` echoes the whole accepts entry, a superset of the two members
    // the spec reads (`scheme`, `network`), so this pins assignability.
    expectTypeOf<LedewirePaymentPayload>().toExtend<SpecSchema<'X402PaymentPayload'>>()
  })

  it('LedewireRefusalCode is every refusal code X402PaymentRequired.error names', () => {
    expectTypeOf<LedewireRefusalCode>().toEqualTypeOf<
      Exclude<SpecSchema<'X402PaymentRequired'>['error'], 'PAYMENT-SIGNATURE header is required'>
    >()
  })

  it('LedewirePaymentKeyRecord is PaymentKey, and PaymentKeyCreateBody is PaymentKeyCreateRequest', () => {
    expectTypeOf<LedewirePaymentKeyRecord>().toEqualTypeOf<SpecSchema<'PaymentKey'>>()
    expectTypeOf<PaymentKeyCreateBody>().toEqualTypeOf<SpecSchema<'PaymentKeyCreateRequest'>>()
  })
})
