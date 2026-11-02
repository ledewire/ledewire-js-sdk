import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  LedewirePaymentClient,
  throwPaymentError,
  throwLegacyPaymentError,
  throwPaymentRefusal,
} from './payment-client.js'
import type { LedewirePaymentPayload, LedewirePaymentRefusal } from './types.js'
import {
  extractApiErrorMessage,
  NonceExpiredError,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  InsufficientFundsError,
} from './errors.js'
import {
  AuthError,
  ForbiddenError,
  LedewireError,
  RateLimitError,
  SpendCapReachedError,
} from '@ledewire/core'
import { API_CONTENT_ID, apiChallenge, encodeChallenge } from './api-challenge.fixture.js'

// Challenges are the API's own shape (`api-challenge.fixture.ts`, mirroring
// ledewire/api `app/services/x402/wallet_service.rb`): `extensions: {}`, the
// nonce in `accepts[0].extra`, and the content id only in `resource.url`.
const API_BASE = 'http://api.test'
const CONTENT_URL = `${API_BASE}/v1/x402/contents/${API_CONTENT_ID}`
const NOW_SECONDS = Math.floor(Date.now() / 1000)
const NONCE = 'nonce-abc'

const makePaymentRequired = (extensions: Record<string, unknown> = {}) =>
  encodeChallenge(apiChallenge({ baseUrl: API_BASE, nonce: NONCE, extensions }))

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
  it("pays the API's challenge with the token, the content id and the challenge's nonce", async () => {
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    const sig = await client.buildPaymentSignature(makePaymentRequired(), CONTENT_URL)
    const payload = JSON.parse(atob(sig)) as LedewirePaymentPayload
    expect(payload.x402Version).toBe(2)
    expect(payload.resource.url).toBe(CONTENT_URL)
    expect(payload.accepted.scheme).toBe('ledewire-wallet')
    expect(payload.accepted.network).toBe('ledewire:v1')
    expect(payload.payload).toEqual({ token: 'buyer-jwt', contentId: API_CONTENT_ID, nonce: NONCE })
    expect(payload.extensions).toBeUndefined()
  })

  it('includes payment-identifier UUID when server advertises support', async () => {
    const header = makePaymentRequired({ 'payment-identifier': { supported: true } })
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    const sig = await client.buildPaymentSignature(header, CONTENT_URL)
    const payload = JSON.parse(atob(sig)) as LedewirePaymentPayload
    const paymentId = payload.extensions?.['payment-identifier']
    expect(typeof paymentId).toBe('string')
    expect(paymentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('throws NonceExpiredError when extra.expiresAt is in the past', async () => {
    const header = encodeChallenge(apiChallenge({ baseUrl: API_BASE, expiresAt: NOW_SECONDS - 10 }))
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    await expect(client.buildPaymentSignature(header, CONTENT_URL)).rejects.toThrow(
      NonceExpiredError,
    )
  })

  it('throws UnsupportedSchemeError for non-ledewire-wallet accepts', async () => {
    const challenge = apiChallenge({ baseUrl: API_BASE })
    challenge.accepts[0] = { ...challenge.accepts[0]!, scheme: 'exact', network: 'eip155:8453' }
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    await expect(
      client.buildPaymentSignature(encodeChallenge(challenge), CONTENT_URL),
    ).rejects.toThrow(UnsupportedSchemeError)
  })

  it('throws MalformedPaymentRequiredError when resource.url names no content', async () => {
    const challenge = {
      ...apiChallenge({ baseUrl: API_BASE }),
      resource: { url: 'https://blog.example.com/posts/article' },
    }
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    await expect(
      client.buildPaymentSignature(encodeChallenge(challenge), CONTENT_URL),
    ).rejects.toThrow(MalformedPaymentRequiredError)
  })

  it('authenticates against the default production apiBase when none is configured', async () => {
    const urls: string[] = []
    server.use(
      http.post('https://api.ledewire.com/v1/auth/login/buyer-api-key', ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
    )
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's' })
    await client.buildPaymentSignature(makePaymentRequired(), CONTENT_URL)
    expect(urls).toEqual(['https://api.ledewire.com/v1/auth/login/buyer-api-key'])
  })

  it('never sends the buyer key to an apiBase named in the challenge', async () => {
    // The 402's server is untrusted: following its apiBase would hand the
    // buyer key and secret to any host it names.
    const evilHits: string[] = []
    const loginUrls: string[] = []
    server.use(
      http.all('https://evil.example/*', ({ request }) => {
        evilHits.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
      http.post(`${API_BASE}/v1/auth/login/buyer-api-key`, ({ request }) => {
        loginUrls.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
    )
    const header = makePaymentRequired({ 'ledewire-wallet': { apiBase: 'https://evil.example' } })
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    await client.buildPaymentSignature(header, CONTENT_URL)
    expect(evilHits).toEqual([])
    expect(loginUrls).toEqual([`${API_BASE}/v1/auth/login/buyer-api-key`])
    expect(client.auth.apiBase).toBe(API_BASE)
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

  it('throws RateLimitError on 429, carrying retryAfter when given', () => {
    let error: unknown
    try {
      throwPaymentError(429, 'slow down', 20)
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(RateLimitError)
    expect(error).toBeInstanceOf(LedewireError)
    expect(error).toMatchObject({ statusCode: 429, retryAfter: 20, message: 'slow down' })
  })

  it('throws RateLimitError on 429 with retryAfter undefined when not given', () => {
    expect(() => throwPaymentError(429, 'slow down')).toThrow(RateLimitError)
  })

  it('throws LedewireError for any other status', () => {
    // Exercises the final `throw new LedewireError` — false branch of the known statuses
    expect(() => throwPaymentError(500, 'internal')).toThrow(LedewireError)
  })
})

describe('extractApiErrorMessage', () => {
  it('reads error as a plain string', () => {
    expect(extractApiErrorMessage({ error: 'Insufficient balance' }, 'fallback')).toBe(
      'Insufficient balance',
    )
  })

  it('reads error.message from an object-shaped error', () => {
    expect(
      extractApiErrorMessage(
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
    expect(extractApiErrorMessage({ code: 42 }, 'fallback')).toBe('fallback')
  })

  it('falls back when body is not an object', () => {
    expect(extractApiErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(extractApiErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('falls back when error.message is not a string', () => {
    expect(extractApiErrorMessage({ error: { code: 42 } }, 'fallback')).toBe('fallback')
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

  it('passes retryAfter through to a RateLimitError on 429', () => {
    expect(() => throwLegacyPaymentError(429, { error: 'slow down' }, 7)).toThrow(
      expect.objectContaining({ statusCode: 429, retryAfter: 7 }) as Error,
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
