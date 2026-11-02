/**
 * Type-level pins: each x402-client wire type that `ledewire.yml` defines as a
 * schema must be exactly that schema. A divergence is a compile error, so
 * `pnpm typecheck` fails before any test runs. The prose-only shapes listed in
 * `types.ts` have no schema to pin against yet (ledewire/api#1700).
 */
import { describe, it, expectTypeOf } from 'vitest'
import type { SpecSchema } from '@ledewire/core/test-utils'
import type { LedewireSettlementResponse } from './types.js'
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
})
