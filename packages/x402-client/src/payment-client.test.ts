import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  LedewirePaymentClient,
  throwPaymentError,
  extractPaymentErrorMessage,
  throwLegacyPaymentError,
  throwPaymentRefusal,
} from './payment-client.js'
import type { LedewirePaymentPayload, LedewirePaymentRefusal } from './types.js'
import {
  NonceExpiredError,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  InsufficientFundsError,
} from './errors.js'
import { AuthError, ForbiddenError, LedewireError, SpendCapReachedError } from '@ledewire/core'

const API_BASE = 'http://api.test'
const ORIGIN_URL = 'https://blog.example.com/posts/article'
const NOW_SECONDS = Math.floor(Date.now() / 1000)
const CONTENT_ID = 'content-uuid-1'

const makePaymentRequired = (overrides: Record<string, unknown> = {}) =>
  btoa(
    JSON.stringify({
      x402Version: 2,
      resource: { url: ORIGIN_URL },
      accepts: [
        {
          scheme: 'ledewire-wallet',
          network: 'ledewire:v1',
          amount: '100',
          asset: 'USD',
          payTo: 'store:uuid-1',
          maxTimeoutSeconds: 60,
          extra: { nonce: 'nonce-abc', expiresAt: NOW_SECONDS + 120, contentId: CONTENT_ID },
        },
      ],
      extensions: {
        'ledewire-wallet': {
          apiBase: API_BASE,
          authEndpoint: '/v1/auth/login/buyer-api-key',
          schemeVersion: 'ledewire:v1',
          contentId: CONTENT_ID,
        },
      },
      ...overrides,
    }),
  )

const AUTH_RESPONSE = {
  token_type: 'Bearer',
  access_token: 'buyer-jwt',
  refresh_token: 'refresh',
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
}

const server = setupServer(
  http.post(`${API_BASE}/v1/auth/login/buyer-api-key`, () => HttpResponse.json(AUTH_RESPONSE)),
)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

describe('LedewirePaymentClient.buildPaymentSignature', () => {
  it('returns a valid base64 PAYMENT-SIGNATURE with correct fields', async () => {
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    const sig = await client.buildPaymentSignature(makePaymentRequired(), ORIGIN_URL)
    const payload = JSON.parse(atob(sig)) as LedewirePaymentPayload
    expect(payload.x402Version).toBe(2)
    expect(payload.resource.url).toBe(ORIGIN_URL)
    expect(payload.payload.token).toBe('buyer-jwt')
    expect(payload.payload.contentId).toBe(CONTENT_ID)
    expect(payload.extensions).toBeUndefined()
  })

  it('includes payment-identifier UUID when server advertises support', async () => {
    const header = makePaymentRequired({
      extensions: {
        'ledewire-wallet': {
          apiBase: API_BASE,
          authEndpoint: '/v1/auth/login/buyer-api-key',
          schemeVersion: 'ledewire:v1',
          contentId: CONTENT_ID,
        },
        'payment-identifier': { supported: true },
      },
    })
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    const sig = await client.buildPaymentSignature(header, ORIGIN_URL)
    const payload = JSON.parse(atob(sig)) as LedewirePaymentPayload
    const paymentId = payload.extensions?.['payment-identifier']
    expect(typeof paymentId).toBe('string')
    expect(paymentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('throws NonceExpiredError when nonce is expired', async () => {
    const header = makePaymentRequired({
      accepts: [
        {
          scheme: 'ledewire-wallet',
          network: 'ledewire:v1',
          amount: '100',
          asset: 'USD',
          payTo: 'store:uuid-1',
          maxTimeoutSeconds: 60,
          extra: { nonce: 'n', expiresAt: NOW_SECONDS - 10, contentId: CONTENT_ID },
        },
      ],
    })
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    await expect(client.buildPaymentSignature(header, ORIGIN_URL)).rejects.toThrow(
      NonceExpiredError,
    )
  })

  it('throws UnsupportedSchemeError for non-ledewire-wallet accepts', async () => {
    const header = btoa(
      JSON.stringify({
        x402Version: 2,
        resource: { url: ORIGIN_URL },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1',
            asset: 'USDC',
            payTo: '0x0',
            maxTimeoutSeconds: 60,
            extra: {},
          },
        ],
      }),
    )
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    await expect(client.buildPaymentSignature(header, ORIGIN_URL)).rejects.toThrow(
      UnsupportedSchemeError,
    )
  })

  it('throws MalformedPaymentRequiredError for missing extension block', async () => {
    const header = btoa(
      JSON.stringify({
        x402Version: 2,
        resource: { url: ORIGIN_URL },
        accepts: [
          {
            scheme: 'ledewire-wallet',
            network: 'ledewire:v1',
            amount: '100',
            asset: 'USD',
            payTo: 'store:uuid-1',
            maxTimeoutSeconds: 60,
            extra: { nonce: 'n', expiresAt: NOW_SECONDS + 60, contentId: CONTENT_ID },
          },
        ],
        extensions: {},
      }),
    )
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    await expect(client.buildPaymentSignature(header, ORIGIN_URL)).rejects.toThrow(
      MalformedPaymentRequiredError,
    )
  })

  it('uses the default production apiBase when none is provided in config', async () => {
    // Exercises `config.apiBase ?? 'https://api.ledewire.com'` default branch.
    // The extension block overrides apiBase to API_BASE before the auth call.
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's' })
    const sig = await client.buildPaymentSignature(makePaymentRequired(), ORIGIN_URL)
    const payload = JSON.parse(atob(sig)) as LedewirePaymentPayload
    expect(payload.x402Version).toBe(2)
  })

  it('overrides apiBase from the extension block', async () => {
    const stagingBase = 'http://api-staging.test'
    const stagingUrls: string[] = []
    server.use(
      http.post(`${stagingBase}/v1/auth/login/buyer-api-key`, ({ request }) => {
        stagingUrls.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
    )
    const header = makePaymentRequired({
      extensions: {
        'ledewire-wallet': {
          apiBase: stagingBase,
          authEndpoint: '/v1/auth/login/buyer-api-key',
          schemeVersion: 'ledewire:v1',
          contentId: CONTENT_ID,
        },
      },
    })
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    await client.buildPaymentSignature(header, ORIGIN_URL)
    expect(stagingUrls[0]).toContain(stagingBase)
  })

  it('uses default apiBase when none provided in config', async () => {
    server.use(
      http.post('https://api.ledewire.com/v1/auth/login/buyer-api-key', () =>
        HttpResponse.json(AUTH_RESPONSE),
      ),
    )
    // No apiBase provided — exercises the `?? 'https://api.ledewire.com'` branch
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's' })
    const header = makePaymentRequired({
      extensions: {
        'ledewire-wallet': {
          apiBase: 'https://api.ledewire.com',
          authEndpoint: '/v1/auth/login/buyer-api-key',
          schemeVersion: 'ledewire:v1',
          contentId: CONTENT_ID,
        },
      },
    })
    const sig = await client.buildPaymentSignature(header, ORIGIN_URL)
    expect(sig).toBeDefined()
  })
})

describe('throwPaymentError', () => {
  it('throws InsufficientFundsError on 422', () => {
    expect(() => throwPaymentError(422, 'Insufficient balance')).toThrow(InsufficientFundsError)
  })

  it('throws AuthError on 401', () => {
    expect(() => throwPaymentError(401, 'Unauthorized')).toThrow(AuthError)
  })

  it('throws LedewireError for other statuses', () => {
    expect(() => throwPaymentError(400, 'Bad request')).toThrow(LedewireError)
    expect(() => throwPaymentError(403, 'Forbidden')).toThrow(LedewireError)
    expect(() => throwPaymentError(500, 'Server error')).toThrow(LedewireError)
  })
})

describe('throwPaymentError', () => {
  it('throws InsufficientFundsError on 422', () => {
    expect(() => throwPaymentError(422, 'low balance')).toThrow(InsufficientFundsError)
  })

  it('throws AuthError on 401', () => {
    expect(() => throwPaymentError(401, 'bad creds')).toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', () => {
    expect(() => throwPaymentError(403, 'forbidden')).toThrow(ForbiddenError)
  })

  it('throws LedewireError for any other status', () => {
    // Exercises the final `throw new LedewireError` — false branch of the known statuses
    expect(() => throwPaymentError(500, 'internal')).toThrow(LedewireError)
  })
})

describe('extractPaymentErrorMessage', () => {
  it('reads error as a plain string', () => {
    expect(extractPaymentErrorMessage({ error: 'Insufficient balance' }, 'fallback')).toBe(
      'Insufficient balance',
    )
  })

  it('reads error.message from an object-shaped error', () => {
    expect(
      extractPaymentErrorMessage(
        {
          error: {
            code: 402,
            message: 'Daily spend cap reached.',
            type: 'daily_spend_cap_reached',
          },
        },
        'fallback',
      ),
    ).toBe('Daily spend cap reached.')
  })

  it('falls back when error is missing', () => {
    expect(extractPaymentErrorMessage({ code: 42 }, 'fallback')).toBe('fallback')
  })

  it('falls back when body is not an object', () => {
    expect(extractPaymentErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(extractPaymentErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('falls back when error.message is not a string', () => {
    expect(extractPaymentErrorMessage({ error: { code: 42 } }, 'fallback')).toBe('fallback')
  })
})

describe('throwLegacyPaymentError', () => {
  it('throws SpendCapReachedError when the body is a well-formed spend-cap refusal', () => {
    const body = {
      error: { code: 402, message: 'Daily spend cap reached.', type: 'daily_spend_cap_reached' },
      cap_cents: 5000,
      spent_cents: 5000,
      remaining_cents: 0,
      resets_at: '2099-01-02T00:00:00Z',
      bulk_exempt: false,
    }
    expect(() => throwLegacyPaymentError(402, body)).toThrow(SpendCapReachedError)
  })

  it('falls back to throwPaymentError when the body is not a spend-cap refusal', () => {
    expect(() => throwLegacyPaymentError(422, { error: 'Insufficient balance' })).toThrow(
      InsufficientFundsError,
    )
  })

  it('extracts an object-shaped error message before delegating', () => {
    expect(() =>
      throwLegacyPaymentError(401, { error: { code: 401, message: 'Bad creds' } }),
    ).toThrow('Bad creds')
  })
})

describe('throwPaymentRefusal', () => {
  const refusal = (errorReason: string): LedewirePaymentRefusal => ({
    success: false,
    errorReason,
    transaction: '',
    network: 'ledewire:v1',
  })

  it('maps insufficient_funds to InsufficientFundsError', () => {
    expect(() => throwPaymentRefusal(refusal('insufficient_funds'), undefined)).toThrow(
      InsufficientFundsError,
    )
  })

  it('maps daily_spend_cap_reached with a well-formed body to SpendCapReachedError', () => {
    const body = {
      error: { code: 402, message: 'Daily spend cap reached.', type: 'daily_spend_cap_reached' },
      cap_cents: 5000,
      spent_cents: 5000,
      remaining_cents: 0,
      resets_at: '2099-01-02T00:00:00Z',
      bulk_exempt: false,
    }
    const err = (() => {
      try {
        throwPaymentRefusal(refusal('daily_spend_cap_reached'), body)
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(SpendCapReachedError)
    expect((err as SpendCapReachedError).capCents).toBe(5000)
  })

  it('maps daily_spend_cap_reached with a body missing cap fields to a typed LedewireError, never NaN', () => {
    const err = (() => {
      try {
        throwPaymentRefusal(refusal('daily_spend_cap_reached'), {
          error: { message: 'Cap reached' },
        })
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(LedewireError)
    expect(err).not.toBeInstanceOf(SpendCapReachedError)
    expect((err as LedewireError).type).toBe('daily_spend_cap_reached')
    expect((err as LedewireError).statusCode).toBe(402)
  })

  it('maps invalid_ledewire_wallet_payload_token to AuthError', () => {
    expect(() =>
      throwPaymentRefusal(refusal('invalid_ledewire_wallet_payload_token'), undefined),
    ).toThrow(AuthError)
  })

  it('maps invalid_ledewire_wallet_payload_role to ForbiddenError', () => {
    expect(() =>
      throwPaymentRefusal(refusal('invalid_ledewire_wallet_payload_role'), undefined),
    ).toThrow(ForbiddenError)
  })

  it('maps an unknown errorReason to a LedewireError whose type is the reason', () => {
    const err = (() => {
      try {
        throwPaymentRefusal(refusal('some_future_reason'), undefined)
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).type).toBe('some_future_reason')
    expect((err as LedewireError).message).toContain('some_future_reason')
  })

  it('prefers the body message over the generic fallback', () => {
    expect(() =>
      throwPaymentRefusal(refusal('some_future_reason'), {
        error: { message: 'Custom refusal text' },
      }),
    ).toThrow('Custom refusal text')
  })
})
