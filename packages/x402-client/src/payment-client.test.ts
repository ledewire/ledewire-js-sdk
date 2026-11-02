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
  PaymentOriginNotAllowedError,
} from './errors.js'
import {
  AuthError,
  ForbiddenError,
  LedewireError,
  RateLimitError,
  SpendCapReachedError,
} from '@ledewire/core'

const API_BASE = 'http://api.test'
const NOW_SECONDS = Math.floor(Date.now() / 1000)
const CONTENT_ID = 'content-uuid-1'
/** A paid resource on the configured Ledewire API origin. */
const ORIGIN_URL = `${API_BASE}/v1/x402/contents/${CONTENT_ID}`
/** A resource on some other origin — never paid, never authenticated against. */
const THIRD_PARTY_URL = 'https://blog.example.com/posts/article'

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
    const loginUrls: string[] = []
    server.use(
      http.post('https://api.ledewire.com/v1/auth/login/buyer-api-key', ({ request }) => {
        loginUrls.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
    )
    // No apiBase provided — exercises the `?? 'https://api.ledewire.com'` branch
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's' })
    const sig = await client.buildPaymentSignature(
      makePaymentRequired(),
      `https://api.ledewire.com/v1/x402/contents/${CONTENT_ID}`,
    )
    expect(sig).toBeDefined()
    expect(loginUrls).toEqual(['https://api.ledewire.com/v1/auth/login/buyer-api-key'])
  })

  it('ignores an apiBase named in the challenge and logs in at the configured base', async () => {
    const otherHostHits: string[] = []
    const loginUrls: string[] = []
    server.use(
      http.all('https://evil.example/*', ({ request }) => {
        otherHostHits.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
      http.post(`${API_BASE}/v1/auth/login/buyer-api-key`, ({ request }) => {
        loginUrls.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
    )
    const header = makePaymentRequired({
      extensions: {
        'ledewire-wallet': {
          apiBase: 'https://evil.example',
          authEndpoint: '/v1/auth/login/buyer-api-key',
          schemeVersion: 'ledewire:v1',
          contentId: CONTENT_ID,
        },
      },
    })
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    const sig = await client.buildPaymentSignature(header, ORIGIN_URL)
    expect(sig).toBeDefined()
    expect(otherHostHits).toEqual([])
    expect(loginUrls).toEqual([`${API_BASE}/v1/auth/login/buyer-api-key`])
    expect(client.auth.apiBase).toBe(API_BASE)
  })

  it('throws PaymentOriginNotAllowedError for a url outside the configured API origin, without logging in', async () => {
    const loginUrls: string[] = []
    server.use(
      http.post(`${API_BASE}/v1/auth/login/buyer-api-key`, ({ request }) => {
        loginUrls.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
    )
    const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })
    const err = await client
      .buildPaymentSignature(makePaymentRequired(), THIRD_PARTY_URL)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PaymentOriginNotAllowedError)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as PaymentOriginNotAllowedError).statusCode).toBe(402)
    expect((err as PaymentOriginNotAllowedError).name).toBe('PaymentOriginNotAllowedError')
    expect((err as PaymentOriginNotAllowedError).message).toContain('https://blog.example.com')
    expect((err as PaymentOriginNotAllowedError).message).toContain(API_BASE)
    expect(loginUrls).toEqual([])
  })
})

describe('LedewirePaymentClient.allowsPaymentTo', () => {
  const client = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })

  it('allows a url on the configured API origin', () => {
    expect(client.allowsPaymentTo(ORIGIN_URL)).toBe(true)
    expect(client.allowsPaymentTo(`${API_BASE}/`)).toBe(true)
    expect(client.allowsPaymentTo(`${API_BASE}/v1/x402/contents/x?y=1#z`)).toBe(true)
  })

  it('refuses a url on another host', () => {
    expect(client.allowsPaymentTo(THIRD_PARTY_URL)).toBe(false)
    expect(client.allowsPaymentTo('http://api.test.example.com/v1/x402')).toBe(false)
    expect(client.allowsPaymentTo('http://sub.api.test/v1/x402')).toBe(false)
  })

  it('refuses a different scheme or port on the same host', () => {
    expect(client.allowsPaymentTo('https://api.test/v1/x402')).toBe(false)
    expect(client.allowsPaymentTo('http://api.test:8080/v1/x402')).toBe(false)
  })

  it('treats the default port as the same origin', () => {
    expect(client.allowsPaymentTo('http://api.test:80/v1/x402')).toBe(true)
    const prod = new LedewirePaymentClient({ key: 'bk', secret: 's' })
    expect(prod.allowsPaymentTo('https://api.ledewire.com:443/v1/x402')).toBe(true)
    expect(prod.allowsPaymentTo('https://api.ledewire.com/v1/x402')).toBe(true)
    expect(prod.allowsPaymentTo('https://api-staging.ledewire.com/v1/x402')).toBe(false)
  })

  it('refuses relative and unparseable urls', () => {
    expect(client.allowsPaymentTo('/v1/x402/contents/x')).toBe(false)
    expect(client.allowsPaymentTo('v1/x402')).toBe(false)
    expect(client.allowsPaymentTo('')).toBe(false)
    expect(client.allowsPaymentTo('not a url')).toBe(false)
    expect(client.allowsPaymentTo('http://')).toBe(false)
  })

  it('refuses everything when the configured apiBase is unparseable', () => {
    const broken = new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: 'nonsense' })
    expect(broken.allowsPaymentTo(ORIGIN_URL)).toBe(false)
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
