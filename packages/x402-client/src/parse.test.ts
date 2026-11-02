import { describe, it, expect } from 'vitest'
import { parsePaymentRequired, parsePaymentResponse, parsePaymentRefusal } from './parse.js'
import { UnsupportedSchemeError, MalformedPaymentRequiredError } from './errors.js'
import { API_CONTENT_ID, apiChallenge, encodeChallenge } from './api-challenge.fixture.js'

// Challenges here are the API's own shape — see `api-challenge.fixture.ts`,
// which mirrors ledewire/api `app/services/x402/wallet_service.rb`.
const API_BASE = 'https://api.ledewire.com'

describe('parsePaymentRequired', () => {
  it("parses the API's challenge: extensions {} and extra { nonce, expiresAt }", () => {
    const challenge = apiChallenge({
      baseUrl: API_BASE,
      nonce: 'nonce-1',
      expiresAt: 1_900_000_000,
    })
    const { accepted, contentId } = parsePaymentRequired(encodeChallenge(challenge))
    expect(accepted.scheme).toBe('ledewire-wallet')
    expect(accepted.extra).toEqual({ nonce: 'nonce-1', expiresAt: 1_900_000_000 })
    expect(contentId).toBe(API_CONTENT_ID)
  })

  it('takes the content id from resource.url, the only place the API puts it', () => {
    const id = 'AB12CD34-0000-4000-8000-0123456789EF'
    const { contentId } = parsePaymentRequired(
      encodeChallenge(apiChallenge({ baseUrl: 'http://localhost:3001', contentId: id })),
    )
    expect(contentId).toBe(id)
  })

  it.each([
    ['a non-API path', 'https://blog.example.com/posts/article'],
    ['a non-UUID id', 'https://api.ledewire.com/v1/x402/contents/content-uuid-1'],
    ['a trailing segment', `https://api.ledewire.com/v1/x402/contents/${API_CONTENT_ID}/extra`],
    ['a path prefix', `https://api.ledewire.com/evil/v1/x402/contents/${API_CONTENT_ID}`],
    ['a query string', `https://api.ledewire.com/v1/x402/contents/${API_CONTENT_ID}?x=1`],
    ['a fragment', `https://api.ledewire.com/v1/x402/contents/${API_CONTENT_ID}#x`],
    ['a relative URL', `/v1/x402/contents/${API_CONTENT_ID}`],
  ])('throws MalformedPaymentRequiredError when resource.url is %s', (_label, url) => {
    const challenge = { ...apiChallenge({ baseUrl: API_BASE }), resource: { url } }
    expect(() => parsePaymentRequired(encodeChallenge(challenge))).toThrow(
      MalformedPaymentRequiredError,
    )
  })

  it('throws MalformedPaymentRequiredError when resource is missing', () => {
    const challenge: Partial<ReturnType<typeof apiChallenge>> = apiChallenge({ baseUrl: API_BASE })
    delete challenge.resource
    expect(() => parsePaymentRequired(encodeChallenge(challenge))).toThrow(
      MalformedPaymentRequiredError,
    )
  })

  it.each([
    ['nonce missing', { expiresAt: 1_900_000_000 }],
    ['nonce empty', { nonce: '', expiresAt: 1_900_000_000 }],
    ['expiresAt missing', { nonce: 'n' }],
    ['expiresAt a string', { nonce: 'n', expiresAt: '1900000000' }],
  ])('throws MalformedPaymentRequiredError when extra has %s', (_label, extra) => {
    const challenge = apiChallenge({ baseUrl: API_BASE })
    challenge.accepts[0] = { ...challenge.accepts[0]!, extra: extra as never }
    expect(() => parsePaymentRequired(encodeChallenge(challenge))).toThrow(
      MalformedPaymentRequiredError,
    )
  })

  it('surfaces no login destination from an extensions.ledewire-wallet block', () => {
    const challenge = apiChallenge({
      baseUrl: API_BASE,
      extensions: { 'ledewire-wallet': { apiBase: 'https://evil.example' } },
    })
    const parsed = parsePaymentRequired(encodeChallenge(challenge))
    expect(Object.keys(parsed).sort()).toEqual(['accepted', 'contentId', 'paymentRequired'])
  })

  it('throws UnsupportedSchemeError when no ledewire-wallet entry', () => {
    const challenge = apiChallenge({ baseUrl: API_BASE })
    challenge.accepts[0] = { ...challenge.accepts[0]!, scheme: 'exact', network: 'eip155:8453' }
    expect(() => parsePaymentRequired(encodeChallenge(challenge))).toThrow(UnsupportedSchemeError)
  })

  it('throws MalformedPaymentRequiredError when accepts is not an array', () => {
    const challenge = { ...apiChallenge({ baseUrl: API_BASE }), accepts: {} }
    expect(() => parsePaymentRequired(encodeChallenge(challenge))).toThrow(
      MalformedPaymentRequiredError,
    )
  })

  it('throws MalformedPaymentRequiredError for invalid base64', () => {
    expect(() => parsePaymentRequired('not-valid-base64!!!')).toThrow(MalformedPaymentRequiredError)
  })

  it('throws MalformedPaymentRequiredError for base64 JSON that is not an object', () => {
    expect(() => parsePaymentRequired(encodeChallenge('just a string'))).toThrow(
      MalformedPaymentRequiredError,
    )
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
