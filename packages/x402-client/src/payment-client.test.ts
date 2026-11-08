import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  LedewirePaymentClient,
  throwPaymentError,
  throwLegacyPaymentError,
  throwPaymentRefusal,
} from './payment-client.js'
import type { LedewirePaymentRefusal } from './types.js'
import { decodeJsonHeader } from './encoding.js'
import {
  extractApiErrorMessage,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  InsufficientFundsError,
  PaymentOriginNotAllowedError,
  PriceAboveMaximumError,
} from './errors.js'
import {
  AuthError,
  ForbiddenError,
  LedewireError,
  RateLimitError,
  SpendCapReachedError,
} from '@ledewire/core'
import {
  API_BASE,
  ORIGIN_URL,
  PAY_TO,
  PAYMENT_KEY,
  PAYMENT_REQUIRED_HEADER,
  THIRD_PARTY_URL,
  challenge,
  decodeSignature,
  signatureVerifies,
} from './x402.test-helpers.js'

const makeClient = (overrides: { maxPriceCents?: number } = {}) =>
  new LedewirePaymentClient({ paymentKey: PAYMENT_KEY, apiBase: API_BASE, ...overrides })

afterEach(() => {
  vi.useRealTimers()
})

describe('LedewirePaymentClient.buildPaymentSignature', () => {
  it('parses a challenge whose extra is {} (no server nonce)', async () => {
    const header = await makeClient().buildPaymentSignature(PAYMENT_REQUIRED_HEADER, ORIGIN_URL)
    expect(typeof header).toBe('string')
  })

  it('builds { x402Version: 2, accepted, payload: { signature, authorization } } from the challenge', async () => {
    const payment = decodeSignature(
      await makeClient().buildPaymentSignature(PAYMENT_REQUIRED_HEADER, ORIGIN_URL),
    )
    expect(Object.keys(payment).sort()).toEqual(['accepted', 'payload', 'x402Version'])
    expect(payment.x402Version).toBe(2)
    expect(payment.accepted).toMatchObject({ scheme: 'ledewire-wallet', network: 'ledewire:v1' })
    expect(Object.keys(payment.payload).sort()).toEqual(['authorization', 'signature'])
    expect(payment.payload.authorization).toMatchObject({
      from: PAYMENT_KEY.id,
      to: PAY_TO,
      value: '250',
      asset: 'USD',
      resource: ORIGIN_URL,
    })
  })

  it('carries no session token, content id or top-level nonce', async () => {
    const payment = decodeJsonHeader(
      await makeClient().buildPaymentSignature(PAYMENT_REQUIRED_HEADER, ORIGIN_URL),
    ) as Record<string, Record<string, unknown>>
    expect(payment).not.toHaveProperty('nonce')
    expect(payment['payload']).not.toHaveProperty('token')
    expect(payment['payload']).not.toHaveProperty('contentId')
    expect(JSON.stringify(payment)).not.toMatch(/"token"|"contentId"/)
  })

  it("signs the authorization with the configured key, over the scheme's signed bytes", async () => {
    const payment = decodeSignature(
      await makeClient().buildPaymentSignature(PAYMENT_REQUIRED_HEADER, ORIGIN_URL),
    )
    expect(payment.payload.signature).toMatch(/^[A-Za-z0-9_-]{86}$/)
    expect(await signatureVerifies(payment)).toBe(true)
  })

  it('gives every payment a fresh nonce of 64 lowercase hex characters', async () => {
    const client = makeClient()
    const nonces = await Promise.all(
      [1, 2].map(
        async () =>
          decodeSignature(await client.buildPaymentSignature(PAYMENT_REQUIRED_HEADER, ORIGIN_URL))
            .payload.authorization.nonce,
      ),
    )
    expect(nonces[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(nonces[1]).toMatch(/^[0-9a-f]{64}$/)
    expect(nonces[0]).not.toBe(nonces[1])
  })

  it('opens the window now and keeps it within maxTimeoutSeconds', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), toFake: ['Date'] })
    const now = Math.floor(Date.now() / 1000)
    const { authorization } = decodeSignature(
      await makeClient().buildPaymentSignature(challenge({ maxTimeoutSeconds: 120 }), ORIGIN_URL),
    ).payload
    expect(authorization.validAfter).toBe(now)
    expect(authorization.validBefore).toBe(now + 120)
  })

  it('never opens a window longer than 300 seconds, whatever the challenge allows', async () => {
    const { authorization } = decodeSignature(
      await makeClient().buildPaymentSignature(
        challenge({ maxTimeoutSeconds: 86_400 }),
        ORIGIN_URL,
      ),
    ).payload
    expect(authorization.validBefore - authorization.validAfter).toBe(300)
  })

  it('signs the challenge resource.url as the resource, whatever origin the API names', async () => {
    const resource = `https://api-internal.example${new URL(ORIGIN_URL).pathname}`
    const { authorization } = decodeSignature(
      await makeClient().buildPaymentSignature(
        challenge({}, { resource: { url: resource } }),
        `${ORIGIN_URL}?ref=search`,
      ),
    ).payload
    expect(authorization.resource).toBe(resource)
  })

  it('refuses a challenge whose resource.url is another work', async () => {
    const other = `${API_BASE}/v1/x402/contents/other-id`
    await expect(
      makeClient().buildPaymentSignature(challenge({}, { resource: { url: other } }), ORIGIN_URL),
    ).rejects.toBeInstanceOf(MalformedPaymentRequiredError)
  })

  it('pays a price at or below maxPriceCents', async () => {
    const header = await makeClient({ maxPriceCents: 250 }).buildPaymentSignature(
      PAYMENT_REQUIRED_HEADER,
      ORIGIN_URL,
    )
    expect(decodeSignature(header).payload.authorization.value).toBe('250')
  })

  it('refuses a price above maxPriceCents before signing', async () => {
    const err = await makeClient({ maxPriceCents: 249 })
      .buildPaymentSignature(PAYMENT_REQUIRED_HEADER, ORIGIN_URL)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PriceAboveMaximumError)
    expect(err).toMatchObject({ amountCents: 250, maxPriceCents: 249, statusCode: 402 })
  })

  it('throws UnsupportedSchemeError for non-ledewire-wallet accepts', async () => {
    await expect(
      makeClient().buildPaymentSignature(challenge({ scheme: 'exact' }), ORIGIN_URL),
    ).rejects.toBeInstanceOf(UnsupportedSchemeError)
  })

  it.each([
    ['amount is not a decimal string', { amount: 250 }],
    ['amount has a leading zero', { amount: '0250' }],
    ['asset is not USD', { asset: 'EUR' }],
    ['payTo is missing', { payTo: undefined }],
    ['payTo is not a store', { payTo: '0xabc' }],
    ['maxTimeoutSeconds is not positive', { maxTimeoutSeconds: 0 }],
    ['extra is missing', { extra: undefined }],
  ])('throws MalformedPaymentRequiredError when %s', async (_label, accepts) => {
    await expect(
      makeClient().buildPaymentSignature(challenge(accepts), ORIGIN_URL),
    ).rejects.toBeInstanceOf(MalformedPaymentRequiredError)
  })

  it('throws MalformedPaymentRequiredError when resource.url is missing', async () => {
    await expect(
      makeClient().buildPaymentSignature(challenge({}, { resource: {} }), ORIGIN_URL),
    ).rejects.toBeInstanceOf(MalformedPaymentRequiredError)
  })

  it('throws MalformedPaymentRequiredError for a value the scheme cannot sign', async () => {
    await expect(
      makeClient().buildPaymentSignature(challenge({ payTo: 'store:café' }), ORIGIN_URL),
    ).rejects.toBeInstanceOf(MalformedPaymentRequiredError)
  })

  it('throws PaymentOriginNotAllowedError for a url outside the configured API origin', async () => {
    const err = await makeClient()
      .buildPaymentSignature(PAYMENT_REQUIRED_HEADER, THIRD_PARTY_URL)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PaymentOriginNotAllowedError)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as Error).message).toContain('https://blog.example.com')
    expect((err as Error).message).toContain(API_BASE)
  })

  it('uses the default production apiBase when none is provided in config', async () => {
    const client = new LedewirePaymentClient({ paymentKey: PAYMENT_KEY })
    expect(client.apiBase).toBe('https://api.ledewire.com')
    await expect(
      client.buildPaymentSignature(PAYMENT_REQUIRED_HEADER, ORIGIN_URL),
    ).rejects.toBeInstanceOf(PaymentOriginNotAllowedError)
  })
})

describe('LedewirePaymentClient constructor', () => {
  it.each([
    ['too short', 'AAAA'],
    ['padded', `${PAYMENT_KEY.privateKey}=`],
    ['standard base64', PAYMENT_KEY.privateKey.replace(/[-_]/g, '+') + '/'],
  ])('refuses a private key that is %s, without echoing it', (_label, privateKey) => {
    let caught: unknown
    try {
      new LedewirePaymentClient({ paymentKey: { id: PAYMENT_KEY.id, privateKey } })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(TypeError)
    expect((caught as Error).message).not.toContain(privateKey)
  })

  it('refuses an empty key id', () => {
    expect(() => new LedewirePaymentClient({ paymentKey: { ...PAYMENT_KEY, id: '' } })).toThrow(
      TypeError,
    )
  })

  it.each([-1, 1.5, Number.NaN])('refuses maxPriceCents %s', (maxPriceCents) => {
    expect(() => new LedewirePaymentClient({ paymentKey: PAYMENT_KEY, maxPriceCents })).toThrow(
      TypeError,
    )
  })

  it('keeps the private key out of its enumerable state', () => {
    const client = makeClient()
    expect(JSON.stringify(client)).not.toContain(PAYMENT_KEY.privateKey)
    expect(Object.values(client)).not.toContain(PAYMENT_KEY.privateKey)
  })
})

describe('LedewirePaymentClient.shouldResign', () => {
  it('re-signs payment_authorization_expired', () => {
    expect(makeClient().shouldResign('payment_authorization_expired')).toBe(true)
  })

  it('re-signs amount_mismatch only when a maximum price is configured', () => {
    expect(makeClient().shouldResign('amount_mismatch')).toBe(false)
    expect(makeClient({ maxPriceCents: 500 }).shouldResign('amount_mismatch')).toBe(true)
  })

  it.each([
    'invalid_ledewire_wallet_signature',
    'unknown_payment_key',
    'recipient_mismatch',
    'resource_mismatch',
    'nonce_already_used',
  ] as const)('never re-signs %s', (code) => {
    expect(makeClient({ maxPriceCents: 500 }).shouldResign(code)).toBe(false)
  })
})

describe('LedewirePaymentClient.allowsPaymentTo', () => {
  const client = new LedewirePaymentClient({ paymentKey: PAYMENT_KEY, apiBase: API_BASE })

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
    const prod = new LedewirePaymentClient({ paymentKey: PAYMENT_KEY })
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
    const broken = new LedewirePaymentClient({ paymentKey: PAYMENT_KEY, apiBase: 'nonsense' })
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
