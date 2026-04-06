import { describe, it, expect } from 'vitest'
import { parsePaymentRequired, parsePaymentResponse } from './parse.js'
import { UnsupportedSchemeError, MalformedPaymentRequiredError } from './errors.js'

const NOW_SECONDS = Math.floor(Date.now() / 1000)

function makePaymentRequired(overrides?: object) {
  const base = {
    x402Version: 2,
    resource: { url: 'https://blog.example.com/posts/article' },
    accepts: [
      {
        scheme: 'ledewire-wallet',
        network: 'ledewire:v1',
        amount: '100',
        asset: 'USD',
        payTo: 'store:uuid-1',
        maxTimeoutSeconds: 60,
        extra: {
          nonce: 'abc123',
          expiresAt: NOW_SECONDS + 120,
          contentId: 'content-uuid-1',
        },
      },
    ],
    extensions: {
      'ledewire-wallet': {
        apiBase: 'https://api.ledewire.com',
        authEndpoint: '/v1/auth/login/buyer-api-key',
        signupUrl: 'https://ledewire.com/signup',
        schemeVersion: 'ledewire:v1',
        contentId: 'content-uuid-1',
      },
    },
    ...overrides,
  }
  return btoa(JSON.stringify(base))
}

describe('parsePaymentRequired', () => {
  it('parses a valid PAYMENT-REQUIRED header', () => {
    const { accepted, extension } = parsePaymentRequired(makePaymentRequired())
    expect(accepted.scheme).toBe('ledewire-wallet')
    expect(accepted.extra.nonce).toBe('abc123')
    expect(accepted.extra.contentId).toBe('content-uuid-1')
    expect(extension.apiBase).toBe('https://api.ledewire.com')
    expect(extension.contentId).toBe('content-uuid-1')
  })

  it('throws UnsupportedSchemeError when no ledewire-wallet entry', () => {
    const header = btoa(
      JSON.stringify({
        x402Version: 2,
        resource: { url: 'https://example.com' },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1',
            asset: 'USDC',
            payTo: '0x123',
            maxTimeoutSeconds: 60,
            extra: {},
          },
        ],
      }),
    )
    expect(() => parsePaymentRequired(header)).toThrow(UnsupportedSchemeError)
  })

  it('throws MalformedPaymentRequiredError for invalid base64', () => {
    expect(() => parsePaymentRequired('not-valid-base64!!!')).toThrow(MalformedPaymentRequiredError)
  })

  it('throws MalformedPaymentRequiredError when extension block is missing', () => {
    const header = btoa(
      JSON.stringify({
        x402Version: 2,
        resource: { url: 'https://example.com' },
        accepts: [
          {
            scheme: 'ledewire-wallet',
            network: 'ledewire:v1',
            amount: '100',
            asset: 'USD',
            payTo: 'store:x',
            maxTimeoutSeconds: 60,
            extra: { nonce: 'n', expiresAt: NOW_SECONDS + 120, contentId: 'cid' },
          },
        ],
        extensions: {},
      }),
    )
    expect(() => parsePaymentRequired(header)).toThrow(MalformedPaymentRequiredError)
  })

  it('throws MalformedPaymentRequiredError when extension is missing contentId', () => {
    const header = btoa(
      JSON.stringify({
        x402Version: 2,
        resource: { url: 'https://example.com' },
        accepts: [
          {
            scheme: 'ledewire-wallet',
            network: 'ledewire:v1',
            amount: '100',
            asset: 'USD',
            payTo: 'store:x',
            maxTimeoutSeconds: 60,
            extra: { nonce: 'n', expiresAt: NOW_SECONDS + 120, contentId: 'cid' },
          },
        ],
        extensions: {
          'ledewire-wallet': {
            apiBase: 'https://api.ledewire.com',
            authEndpoint: '/v1/auth/...',
            schemeVersion: 'ledewire:v1',
          },
        },
      }),
    )
    expect(() => parsePaymentRequired(header)).toThrow(MalformedPaymentRequiredError)
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
