import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { wrapFetchWithPayment } from './fetch.js'
import type { PaymentSigner } from '../types.js'
import { LedewirePaymentClient } from '../payment-client.js'
import { InsufficientFundsError, PaymentRefusedError, PriceAboveMaximumError } from '../errors.js'
import type { LedewirePaymentPayload, LedewireRefusalCode } from '../types.js'
import {
  API_BASE,
  ORIGIN_URL,
  PAY_TO,
  PAYMENT_KEY,
  PAYMENT_REQUIRED_HEADER,
  THIRD_PARTY_URL,
  challenge,
  decodeSignature,
  refusalBody,
  refusalChallenge,
  signatureVerifies,
} from '../x402.test-helpers.js'
import {
  AuthError,
  ForbiddenError,
  LedewireError,
  RateLimitError,
  SpendCapReachedError,
} from '@ledewire/core'

/** Base64-encode an x402 v2 `SettleResponse` refusal for the `PAYMENT-RESPONSE` header. */
function paymentResponseHeader(errorReason: string, overrides?: Record<string, unknown>): string {
  return btoa(
    JSON.stringify({
      success: false,
      errorReason,
      transaction: '',
      network: 'ledewire:v1',
      ...overrides,
    }),
  )
}

const CAP_BODY = {
  error: { code: 402, message: 'Daily spend cap reached.', type: 'daily_spend_cap_reached' },
  cap_cents: 5000,
  spent_cents: 5000,
  remaining_cents: 0,
  resets_at: '2099-01-02T00:00:00Z',
  bulk_exempt: false,
}

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

const makeClient = (overrides: { maxPriceCents?: number } = {}) =>
  new LedewirePaymentClient({ paymentKey: PAYMENT_KEY, apiBase: API_BASE, ...overrides })

/**
 * Serves ORIGIN_URL: the first challenge to an unpaid request, then, for each
 * paid request in turn, the next of `paid` (the last one repeats). Records
 * every PAYMENT-SIGNATURE it receives, decoded.
 */
function serveContent(paid: (() => Response)[]): LedewirePaymentPayload[] {
  const payments: LedewirePaymentPayload[] = []
  server.use(
    http.get(ORIGIN_URL, ({ request }) => {
      const sig = request.headers.get('PAYMENT-SIGNATURE')
      if (!sig) {
        return new HttpResponse(null, {
          status: 402,
          headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
        })
      }
      payments.push(decodeSignature(sig))
      const next = paid[Math.min(payments.length, paid.length) - 1]
      return next ? next() : HttpResponse.json({ data: 'content' })
    }),
  )
  return payments
}

/** A refused paid request: 402, a fresh challenge naming `code`, and the matching body. */
function refused(code: LedewireRefusalCode, accepts: Record<string, unknown> = {}): () => Response {
  return () =>
    HttpResponse.json(refusalBody(code), {
      status: 402,
      headers: { 'PAYMENT-REQUIRED': refusalChallenge(code, accepts) },
    })
}

const settled = (): Response => HttpResponse.json({ data: 'content' })

describe('wrapFetchWithPayment', () => {
  it('passes through non-402 responses unchanged', async () => {
    server.use(http.get(ORIGIN_URL, () => HttpResponse.json({ ok: true })))
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    const res = await fetch(ORIGIN_URL)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('returns 402 directly when no PAYMENT-REQUIRED header is present', async () => {
    server.use(http.get(ORIGIN_URL, () => new HttpResponse(null, { status: 402 })))
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    const res = await fetch(ORIGIN_URL)
    expect(res.status).toBe(402)
  })

  it('returns a first-response 402 as-is even when its body looks like a spend-cap refusal', async () => {
    // The API never refuses the FIRST (unpaid) request this way — see api#1066.
    // A bare 402 with no PAYMENT-REQUIRED header always passes through unchanged now.
    server.use(http.get(ORIGIN_URL, () => HttpResponse.json(CAP_BODY, { status: 402 })))
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    const res = await fetch(ORIGIN_URL)
    expect(res.status).toBe(402)
    await expect(res.json()).resolves.toEqual(CAP_BODY)
  })

  it('sends the paid retry with redirect: "error", so PAYMENT-SIGNATURE never follows a redirect', async () => {
    const inits: (RequestInit | undefined)[] = []
    const spyFetch: typeof globalThis.fetch = (_input, init) => {
      inits.push(init)
      return Promise.resolve(
        init && new Headers(init.headers).has('PAYMENT-SIGNATURE')
          ? HttpResponse.json({ data: 'content' })
          : new HttpResponse(null, {
              status: 402,
              headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
            }),
      )
    }
    const res = await wrapFetchWithPayment(spyFetch, makeClient())(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(inits).toHaveLength(2)
    expect(inits[1]?.redirect).toBe('error')
  })

  it('calls buildPaymentSignature and sets PAYMENT-SIGNATURE on retry', async () => {
    const capturedSigs: string[] = []
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        const sig = request.headers.get('PAYMENT-SIGNATURE')
        if (!sig) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        capturedSigs.push(sig)
        return HttpResponse.json({ data: 'content' })
      }),
    )
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    const res = await fetch(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(capturedSigs).toHaveLength(1)
    // The header is a signed Payment authorization, not a session token
    const payment = decodeSignature(capturedSigs[0]!)
    expect(await signatureVerifies(payment)).toBe(true)
    expect(JSON.stringify(payment)).not.toContain('token')
  })

  it('delegates to client.buildPaymentSignature — works with a mock client', async () => {
    const mockSig = btoa('{"mock":true}')
    const buildSpy = vi.fn().mockResolvedValue(mockSig)
    const mockClient = { buildPaymentSignature: buildSpy } satisfies PaymentSigner

    server.use(
      http.get(THIRD_PARTY_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        return HttpResponse.json({ ok: true })
      }),
    )

    const fetch = wrapFetchWithPayment(globalThis.fetch, mockClient)
    await fetch(THIRD_PARTY_URL)
    expect(buildSpy).toHaveBeenCalledOnce()
    expect(buildSpy).toHaveBeenCalledWith(PAYMENT_REQUIRED_HEADER, THIRD_PARTY_URL)
  })

  it('throws InsufficientFundsError on 422 retry response', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        return HttpResponse.json({ error: 'Insufficient balance' }, { status: 422 })
      }),
    )
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    await expect(fetch(ORIGIN_URL)).rejects.toThrow(InsufficientFundsError)
  })

  it('throws LedewireError on other non-ok retry responses', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        return HttpResponse.json({ error: 'Bad request' }, { status: 400 })
      }),
    )
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    await expect(fetch(ORIGIN_URL)).rejects.toThrow(LedewireError)
  })

  it('throws RateLimitError with retryAfter when the paid retry is rate-limited', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        return HttpResponse.json(
          { error: { code: 429, message: 'Too many requests' } },
          { status: 429, headers: { 'Retry-After': '30' } },
        )
      }),
    )
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())

    const error = await fetch(ORIGIN_URL).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(RateLimitError)
    expect(error).toBeInstanceOf(LedewireError)
    expect(error).toMatchObject({ statusCode: 429, retryAfter: 30, message: 'Too many requests' })
  })

  it('throws RateLimitError with retryAfter undefined when a 429 paid retry has no Retry-After', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        return HttpResponse.json({ error: 'Too many requests' }, { status: 429 })
      }),
    )
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())

    const error = await fetch(ORIGIN_URL).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(RateLimitError)
    expect(error).toMatchObject({ statusCode: 429, retryAfter: undefined })
  })

  it('accepts a URL object as input', async () => {
    server.use(http.get(ORIGIN_URL, () => HttpResponse.json({ ok: true })))
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    const res = await fetch(new URL(ORIGIN_URL))
    expect(res.status).toBe(200)
  })

  it('accepts a Request object as input', async () => {
    server.use(http.get(ORIGIN_URL, () => HttpResponse.json({ ok: true })))
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    const res = await fetch(new Request(ORIGIN_URL))
    expect(res.status).toBe(200)
  })

  it('uses a fallback message when retry error body has no string error field', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        // Body has no `error` string — exercises the false branch of `typeof raw === 'string'`
        return HttpResponse.json({ code: 42 }, { status: 422 })
      }),
    )
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    const err = await fetch(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(InsufficientFundsError)
    expect((err as InsufficientFundsError).message).toContain('422')
  })

  describe('PAYMENT-RESPONSE refusal on the paid request (x402 v2 spec form, api#1066)', () => {
    function paidRespondsWith(build: () => Response) {
      return http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        return build()
      })
    }

    it('maps daily_spend_cap_reached with a well-formed cap body to SpendCapReachedError', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(JSON.stringify(CAP_BODY), {
              status: 402,
              headers: {
                'Content-Type': 'application/json',
                'PAYMENT-RESPONSE': paymentResponseHeader('daily_spend_cap_reached'),
              },
            }),
        ),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      const err = await fetch(ORIGIN_URL).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(SpendCapReachedError)
      const spendCapErr = err as SpendCapReachedError
      expect(spendCapErr.capCents).toBe(5000)
      expect(spendCapErr.spentCents).toBe(5000)
      expect(spendCapErr.remainingCents).toBe(0)
      expect(spendCapErr.resetsAt).toBe('2099-01-02T00:00:00Z')
      expect(spendCapErr.bulkExempt).toBe(false)
    })

    it('maps daily_spend_cap_reached with a cap body missing fields to LedewireError, not NaN', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(JSON.stringify({ error: { message: 'Cap reached' } }), {
              status: 402,
              headers: {
                'Content-Type': 'application/json',
                'PAYMENT-RESPONSE': paymentResponseHeader('daily_spend_cap_reached'),
              },
            }),
        ),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      const err = await fetch(ORIGIN_URL).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(LedewireError)
      expect(err).not.toBeInstanceOf(SpendCapReachedError)
      expect((err as LedewireError).type).toBe('daily_spend_cap_reached')
      expect((err as LedewireError).statusCode).toBe(402)
      expect(Number.isNaN((err as SpendCapReachedError).capCents)).toBe(false)
    })

    it('maps insufficient_funds to InsufficientFundsError', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(null, {
              status: 402,
              headers: { 'PAYMENT-RESPONSE': paymentResponseHeader('insufficient_funds') },
            }),
        ),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      await expect(fetch(ORIGIN_URL)).rejects.toThrow(InsufficientFundsError)
    })

    it('maps invalid_ledewire_wallet_payload_token to AuthError', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(null, {
              status: 402,
              headers: {
                'PAYMENT-RESPONSE': paymentResponseHeader('invalid_ledewire_wallet_payload_token'),
              },
            }),
        ),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      await expect(fetch(ORIGIN_URL)).rejects.toThrow(AuthError)
    })

    it('maps invalid_ledewire_wallet_payload_role to ForbiddenError', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(null, {
              status: 402,
              headers: {
                'PAYMENT-RESPONSE': paymentResponseHeader('invalid_ledewire_wallet_payload_role'),
              },
            }),
        ),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      await expect(fetch(ORIGIN_URL)).rejects.toThrow(ForbiddenError)
    })

    it('maps an unknown errorReason to a LedewireError whose type is the reason', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(null, {
              status: 402,
              headers: { 'PAYMENT-RESPONSE': paymentResponseHeader('some_future_reason') },
            }),
        ),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      const err = await fetch(ORIGIN_URL).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(LedewireError)
      expect((err as LedewireError).type).toBe('some_future_reason')
    })
  })

  describe('legacy paid-response mapping (pre-api#1066, no PAYMENT-RESPONSE header)', () => {
    function paidRespondsWith(build: () => Response) {
      return http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        return build()
      })
    }

    it('throws SpendCapReachedError for a 402 cap body with no PAYMENT-RESPONSE header', async () => {
      server.use(paidRespondsWith(() => HttpResponse.json(CAP_BODY, { status: 402 })))
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      const err = await fetch(ORIGIN_URL).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(SpendCapReachedError)
      expect((err as SpendCapReachedError).capCents).toBe(5000)
    })

    it('throws AuthError for a 401 with no PAYMENT-RESPONSE header', async () => {
      server.use(
        paidRespondsWith(() => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      await expect(fetch(ORIGIN_URL)).rejects.toThrow(AuthError)
    })

    it('throws ForbiddenError for a 403 with no PAYMENT-RESPONSE header', async () => {
      server.use(paidRespondsWith(() => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })))
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      await expect(fetch(ORIGIN_URL)).rejects.toThrow(ForbiddenError)
    })

    it('falls back to the legacy mapping without crashing when PAYMENT-RESPONSE is malformed', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(JSON.stringify({ error: 'Insufficient balance' }), {
              status: 422,
              headers: { 'Content-Type': 'application/json', 'PAYMENT-RESPONSE': '!!!not-base64' },
            }),
        ),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      await expect(fetch(ORIGIN_URL)).rejects.toThrow(InsufficientFundsError)
    })
  })

  describe('payment origin restriction', () => {
    it('returns a 402 from another origin as-is, with no paid retry', async () => {
      const signatures: (string | null)[] = []
      server.use(
        http.get(THIRD_PARTY_URL, ({ request }) => {
          signatures.push(request.headers.get('PAYMENT-SIGNATURE'))
          return HttpResponse.json(
            { reason: 'pay me' },
            { status: 402, headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER } },
          )
        }),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      const res = await fetch(THIRD_PARTY_URL)
      expect(res.status).toBe(402)
      expect(res.headers.get('PAYMENT-REQUIRED')).toBe(PAYMENT_REQUIRED_HEADER)
      await expect(res.json()).resolves.toEqual({ reason: 'pay me' })
      expect(signatures).toEqual([null])
    })

    it('returns the very same Response object for a refused origin', async () => {
      const first = new Response(null, {
        status: 402,
        headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
      })
      const inner = vi.fn().mockResolvedValue(first)
      const fetch = wrapFetchWithPayment(inner, makeClient())
      await expect(fetch(new URL(THIRD_PARTY_URL))).resolves.toBe(first)
      expect(inner).toHaveBeenCalledOnce()
    })

    it('pays only the configured origin, whatever host the challenge names', async () => {
      const otherHostHits: string[] = []
      const header = challenge(
        { payTo: PAY_TO },
        {
          resource: { url: ORIGIN_URL, description: 'x', mimeType: 'application/json' },
          extensions: { 'ledewire-wallet': { apiBase: 'https://evil.example' } },
        },
      )
      const paidUrls: string[] = []
      server.use(
        http.all('https://evil.example/*', ({ request }) => {
          otherHostHits.push(request.url)
          return HttpResponse.error()
        }),
        http.get(ORIGIN_URL, ({ request }) => {
          if (!request.headers.get('PAYMENT-SIGNATURE')) {
            return new HttpResponse(null, { status: 402, headers: { 'PAYMENT-REQUIRED': header } })
          }
          paidUrls.push(request.url)
          return HttpResponse.json({ data: 'content' })
        }),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
      const res = await fetch(ORIGIN_URL)
      expect(res.status).toBe(200)
      expect(paidUrls).toEqual([ORIGIN_URL])
      expect(otherHostHits).toEqual([])
    })

    it('pays a third-party 402 through a custom signer that has no allowsPaymentTo', async () => {
      const buildSpy = vi.fn().mockResolvedValue(btoa('{"mock":true}'))
      server.use(
        http.get(THIRD_PARTY_URL, ({ request }) => {
          if (!request.headers.get('PAYMENT-SIGNATURE')) {
            return new HttpResponse(null, {
              status: 402,
              headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
            })
          }
          return HttpResponse.json({ ok: true })
        }),
      )
      const fetch = wrapFetchWithPayment(globalThis.fetch, { buildPaymentSignature: buildSpy })
      const res = await fetch(THIRD_PARTY_URL)
      expect(res.status).toBe(200)
      expect(buildSpy).toHaveBeenCalledOnce()
    })

    it('returns the 402 unpaid when a custom signer refuses the origin', async () => {
      const buildSpy = vi.fn().mockResolvedValue(btoa('{"mock":true}'))
      const allowsSpy = vi.fn().mockReturnValue(false)
      server.use(
        http.get(ORIGIN_URL, () => {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }),
      )
      const signer: PaymentSigner = { buildPaymentSignature: buildSpy, allowsPaymentTo: allowsSpy }
      const fetch = wrapFetchWithPayment(globalThis.fetch, signer)
      const res = await fetch(ORIGIN_URL)
      expect(res.status).toBe(402)
      expect(allowsSpy).toHaveBeenCalledWith(ORIGIN_URL)
      expect(buildSpy).not.toHaveBeenCalled()
    })
  })
})

describe('wrapFetchWithPayment: the signed payment the API receives', () => {
  it('sends { x402Version: 2, accepted, payload: { signature, authorization } } matching the challenge', async () => {
    const payments = serveContent([settled])
    const res = await wrapFetchWithPayment(globalThis.fetch, makeClient())(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(payments).toHaveLength(1)

    const payment = payments[0]!
    const raw: Record<string, unknown> = { ...payment }
    expect(Object.keys(raw).sort()).toEqual(['accepted', 'payload', 'x402Version'])
    expect(payment.x402Version).toBe(2)
    expect(payment.accepted).toMatchObject({ scheme: 'ledewire-wallet', network: 'ledewire:v1' })
    expect(payment.payload.authorization).toMatchObject({
      from: PAYMENT_KEY.id,
      to: PAY_TO,
      value: '250',
      asset: 'USD',
      resource: ORIGIN_URL,
    })
    expect(raw).not.toHaveProperty('nonce')
    expect(payment.payload).not.toHaveProperty('token')
    expect(payment.payload).not.toHaveProperty('contentId')
    expect(await signatureVerifies(payment)).toBe(true)
  })

  it('gives two payments two different nonces, each 64 lowercase hex characters', async () => {
    const payments = serveContent([settled])
    const fetch = wrapFetchWithPayment(globalThis.fetch, makeClient())
    await fetch(ORIGIN_URL)
    await fetch(ORIGIN_URL)
    const nonces = payments.map((p) => p.payload.authorization.nonce)
    expect(nonces).toHaveLength(2)
    for (const nonce of nonces) expect(nonce).toMatch(/^[0-9a-f]{64}$/)
    expect(nonces[0]).not.toBe(nonces[1])
  })
})

describe('wrapFetchWithPayment: refusals', () => {
  it.each([
    'invalid_ledewire_wallet_signature',
    'unknown_payment_key',
    'recipient_mismatch',
    'resource_mismatch',
    'nonce_already_used',
  ] as const)(
    'surfaces %s as a PaymentRefusedError naming it, without re-sending',
    async (code) => {
      const payments = serveContent([refused(code)])
      const err = await wrapFetchWithPayment(
        globalThis.fetch,
        makeClient({ maxPriceCents: 1000 }),
      )(ORIGIN_URL).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(PaymentRefusedError)
      expect(err).toBeInstanceOf(LedewireError)
      expect(err).toMatchObject({ refusal: code, type: code, statusCode: 402 })
      expect((err as Error).message).toBe(`Refused: ${code}`)
      expect(payments).toHaveLength(1)
    },
  )

  it('re-signs payment_authorization_expired once, with a fresh window and nonce', async () => {
    const payments = serveContent([refused('payment_authorization_expired'), settled])
    const res = await wrapFetchWithPayment(globalThis.fetch, makeClient())(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(payments).toHaveLength(2)
    const [first, second] = payments.map((p) => p.payload.authorization)
    expect(second!.nonce).not.toBe(first!.nonce)
    expect(second!.validAfter).toBeGreaterThanOrEqual(first!.validAfter)
  })

  it('re-signs payment_authorization_expired only once', async () => {
    const payments = serveContent([refused('payment_authorization_expired')])
    const err = await wrapFetchWithPayment(
      globalThis.fetch,
      makeClient(),
    )(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PaymentRefusedError)
    expect(err).toMatchObject({ refusal: 'payment_authorization_expired' })
    expect(payments).toHaveLength(2)
  })

  it("re-signs amount_mismatch at the fresh challenge's price when it is within maxPriceCents", async () => {
    const payments = serveContent([refused('amount_mismatch', { amount: '300' }), settled])
    const res = await wrapFetchWithPayment(
      globalThis.fetch,
      makeClient({ maxPriceCents: 300 }),
    )(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(payments.map((p) => p.payload.authorization.value)).toEqual(['250', '300'])
  })

  it('throws PriceAboveMaximumError for amount_mismatch above maxPriceCents, sending nothing more', async () => {
    const payments = serveContent([refused('amount_mismatch', { amount: '301' })])
    const err = await wrapFetchWithPayment(
      globalThis.fetch,
      makeClient({ maxPriceCents: 300 }),
    )(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PriceAboveMaximumError)
    expect(err).toMatchObject({ amountCents: 301, maxPriceCents: 300 })
    expect(payments).toHaveLength(1)
  })

  it('surfaces amount_mismatch when no maxPriceCents is configured', async () => {
    const payments = serveContent([refused('amount_mismatch', { amount: '300' })])
    const err = await wrapFetchWithPayment(
      globalThis.fetch,
      makeClient(),
    )(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toMatchObject({ refusal: 'amount_mismatch' })
    expect(payments).toHaveLength(1)
  })

  it('signs at most twice even when every refusal could be re-signed', async () => {
    const payments = serveContent([
      refused('payment_authorization_expired'),
      refused('amount_mismatch', { amount: '250' }),
    ])
    const err = await wrapFetchWithPayment(
      globalThis.fetch,
      makeClient({ maxPriceCents: 1000 }),
    )(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toMatchObject({ refusal: 'amount_mismatch' })
    expect(payments).toHaveLength(2)
  })

  it('never re-signs for a custom signer without shouldResign', async () => {
    const buildSpy = vi.fn().mockResolvedValue(btoa('{"mock":true}'))
    let paid = 0
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
          })
        }
        paid++
        return refused('payment_authorization_expired')()
      }),
    )
    const err = await wrapFetchWithPayment(globalThis.fetch, { buildPaymentSignature: buildSpy })(
      ORIGIN_URL,
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PaymentRefusedError)
    expect(buildSpy).toHaveBeenCalledOnce()
    expect(paid).toBe(1)
  })

  it('uses a generic message when the refusal body carries none', async () => {
    serveContent([
      () =>
        new HttpResponse(null, {
          status: 402,
          headers: { 'PAYMENT-REQUIRED': refusalChallenge('nonce_already_used') },
        }),
    ])
    const err = await wrapFetchWithPayment(
      globalThis.fetch,
      makeClient(),
    )(ORIGIN_URL).catch((e: unknown) => e)
    expect((err as Error).message).toBe('Payment refused: nonce_already_used')
  })

  it('maps a paid 402 spend-cap body with no PAYMENT-REQUIRED to SpendCapReachedError', async () => {
    serveContent([() => HttpResponse.json(CAP_BODY, { status: 402 })])
    const err = await wrapFetchWithPayment(
      globalThis.fetch,
      makeClient(),
    )(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SpendCapReachedError)
  })
})
