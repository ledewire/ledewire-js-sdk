import { describe, it, expect } from 'vitest'
import {
  parsePaymentRequired,
  parsePaymentResponse,
  parsePaymentRefusal,
  refusalCodeOf,
  sameRecipientAndResource,
} from './parse.js'
import { UnsupportedSchemeError, MalformedPaymentRequiredError } from './errors.js'
import { encodeJsonHeader } from './encoding.js'
import {
  ORIGIN_URL,
  PAY_TO,
  challenge,
  challengeObject,
  refusalChallenge,
} from './x402.test-helpers.js'

describe('parsePaymentRequired', () => {
  it('parses the spec challenge, whose extra and extensions are {}, with no MalformedPaymentRequiredError', () => {
    const { paymentRequired, accepted } = parsePaymentRequired(challenge())
    expect(accepted).toEqual({
      scheme: 'ledewire-wallet',
      network: 'ledewire:v1',
      amount: '250',
      asset: 'USD',
      payTo: PAY_TO,
      maxTimeoutSeconds: 300,
      extra: {},
    })
    expect(paymentRequired.resource.url).toBe(ORIGIN_URL)
    expect(paymentRequired.extensions).toEqual({})
  })

  it('decodes a UTF-8 resource description', () => {
    const header = challenge(
      {},
      { resource: { url: ORIGIN_URL, description: 'Caf\u00e9 \u2014 \u65b0\u95fb' } },
    )
    expect(parsePaymentRequired(header).paymentRequired.resource.description).toBe(
      'Caf\u00e9 \u2014 \u65b0\u95fb',
    )
  })

  it('picks the ledewire-wallet entry among others', () => {
    const value = challengeObject()
    const other = { ...value.accepts[0], scheme: 'exact', network: 'eip155:8453' }
    const header = encodeJsonHeader({ ...value, accepts: [other, ...value.accepts] })
    expect(parsePaymentRequired(header).accepted.scheme).toBe('ledewire-wallet')
  })

  it('throws UnsupportedSchemeError when no ledewire-wallet entry', () => {
    expect(() => parsePaymentRequired(challenge({ network: 'eip155:8453' }))).toThrow(
      UnsupportedSchemeError,
    )
  })

  it.each([
    ['invalid base64', 'not-valid-base64!!!'],
    ['a JSON array', btoa('[]')],
    ['no accepts array', encodeJsonHeader({ x402Version: 2 })],
    ['an amount above 2^53', challenge({ amount: '9007199254740993' })],
    ['a negative maxTimeoutSeconds', challenge({ maxTimeoutSeconds: -1 })],
    ['a fractional maxTimeoutSeconds', challenge({ maxTimeoutSeconds: 1.5 })],
    ['an empty payTo', challenge({ payTo: '' })],
    ['an array extra', challenge({ extra: [] })],
    ['no resource', challenge({}, { resource: undefined })],
  ])('throws MalformedPaymentRequiredError for %s', (_label, header) => {
    expect(() => parsePaymentRequired(header)).toThrow(MalformedPaymentRequiredError)
  })
})

describe('sameRecipientAndResource', () => {
  it('is true when only the price or the error changed', () => {
    expect(
      sameRecipientAndResource(challenge(), refusalChallenge('amount_mismatch', { amount: '999' })),
    ).toBe(true)
  })

  it('is false when payTo or resource.url changed, or a challenge does not parse', () => {
    expect(sameRecipientAndResource(challenge(), challenge({ payTo: 'store:other' }))).toBe(false)
    expect(
      sameRecipientAndResource(challenge(), challenge({}, { resource: { url: `${ORIGIN_URL}x` } })),
    ).toBe(false)
    expect(sameRecipientAndResource(challenge(), 'garbage')).toBe(false)
  })
})

describe('refusalCodeOf', () => {
  it.each([
    'unknown_payment_key',
    'invalid_ledewire_wallet_signature',
    'recipient_mismatch',
    'amount_mismatch',
    'resource_mismatch',
    'payment_authorization_expired',
    'nonce_already_used',
  ] as const)('reads %s from a fresh challenge', (code) => {
    expect(refusalCodeOf(refusalChallenge(code))).toBe(code)
  })

  it('returns null for the first challenge, which refuses nothing', () => {
    expect(refusalCodeOf(challenge())).toBeNull()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['not base64 JSON', '%%%'],
    ['a JSON string', btoa('"amount_mismatch"')],
    ['an unknown code', challenge({}, { error: 'something_new' })],
  ])('returns null for a header that is %s', (_label, header) => {
    expect(refusalCodeOf(header)).toBeNull()
  })
})

describe('parsePaymentResponse', () => {
  it('returns null for null header', () => {
    expect(parsePaymentResponse(null)).toBeNull()
  })

  it('decodes a valid PAYMENT-RESPONSE header', () => {
    const payload = {
      success: true,
      transaction: 'tx-1',
      network: 'ledewire:v1',
      payer: 'user-1',
      accessToken: 'jwt',
    }
    const header = btoa(JSON.stringify(payload))
    const result = parsePaymentResponse(header)
    expect(result?.accessToken).toBe('jwt')
  })

  it('returns null for malformed base64', () => {
    expect(parsePaymentResponse('!!!invalid')).toBeNull()
  })
})

describe('parsePaymentRefusal', () => {
  it('returns null for a null header', () => {
    expect(parsePaymentRefusal(null)).toBeNull()
  })

  it('decodes a valid x402 v2 SettleResponse refusal', () => {
    const header = btoa(
      JSON.stringify({
        success: false,
        errorReason: 'daily_spend_cap_reached',
        transaction: '',
        network: 'ledewire:v1',
        payer: 'buyer-1',
      }),
    )
    const result = parsePaymentRefusal(header)
    expect(result).toEqual({
      success: false,
      errorReason: 'daily_spend_cap_reached',
      transaction: '',
      network: 'ledewire:v1',
      payer: 'buyer-1',
    })
  })

  it('defaults transaction and network when absent, and omits payer', () => {
    const header = btoa(JSON.stringify({ success: false, errorReason: 'insufficient_funds' }))
    const result = parsePaymentRefusal(header)
    expect(result).toEqual({
      success: false,
      errorReason: 'insufficient_funds',
      transaction: '',
      network: 'ledewire:v1',
    })
    expect(result?.payer).toBeUndefined()
  })

  it('returns null for malformed base64', () => {
    expect(parsePaymentRefusal('!!!invalid')).toBeNull()
  })

  it('returns null for valid base64 JSON that is not an object', () => {
    expect(parsePaymentRefusal(btoa(JSON.stringify('just a string')))).toBeNull()
  })

  it('returns null when success is not false', () => {
    const header = btoa(JSON.stringify({ success: true, errorReason: 'insufficient_funds' }))
    expect(parsePaymentRefusal(header)).toBeNull()
  })

  it('returns null when errorReason is missing or not a string', () => {
    expect(parsePaymentRefusal(btoa(JSON.stringify({ success: false })))).toBeNull()
    expect(
      parsePaymentRefusal(btoa(JSON.stringify({ success: false, errorReason: 42 }))),
    ).toBeNull()
  })
})
