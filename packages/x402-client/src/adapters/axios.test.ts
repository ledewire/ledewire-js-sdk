import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import axios from 'axios'
import { wrapAxiosWithPayment } from './axios.js'
import type { PaymentSigner } from '../types.js'
import { LedewirePaymentClient } from '../payment-client.js'
import { InsufficientFundsError, PaymentRefusedError, PriceAboveMaximumError } from '../errors.js'
import type { LedewirePaymentPayload, LedewireRefusalCode } from '../types.js'
import {
  API_BASE,
  CONTENT_ID,
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
import { AuthError, ForbiddenError, LedewireError, SpendCapReachedError } from '@ledewire/core'

/** Base64-encode an x402 v2 `SettleResponse` refusal for the `payment-response` header. */
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
      const sig = request.headers.get('payment-signature')
      if (!sig) {
        return new HttpResponse(null, {
          status: 402,
          headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
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
      headers: { 'payment-required': refusalChallenge(code, accepts) },
    })
}

const settled = (): Response => HttpResponse.json({ data: 'content' })

describe('wrapAxiosWithPayment', () => {
  it('passes through non-402 responses unchanged', async () => {
    server.use(http.get(ORIGIN_URL, () => HttpResponse.json({ ok: true })))
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    const res = await instance.get(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(res.data).toEqual({ ok: true })
  })

  it('handles 402, sets PAYMENT-SIGNATURE, and returns 200 on retry', async () => {
    const capturedSigs: string[] = []
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        const sig = request.headers.get('payment-signature')
        if (!sig) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }
        capturedSigs.push(sig)
        return HttpResponse.json({ data: 'content' })
      }),
    )
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    const res = await instance.get(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(capturedSigs).toHaveLength(1)
    const payment = decodeSignature(capturedSigs[0]!)
    expect(await signatureVerifies(payment)).toBe(true)
    expect(JSON.stringify(payment)).not.toContain('token')
  })

  it('sends the paid retry with maxRedirects: 0', async () => {
    const seen: (number | undefined)[] = []
    server.use(
      http.get(ORIGIN_URL, ({ request }) =>
        request.headers.get('payment-signature')
          ? HttpResponse.json({ data: 'content' })
          : new HttpResponse(null, {
              status: 402,
              headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
            }),
      ),
    )
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    instance.interceptors.request.use((config) => {
      seen.push(config.maxRedirects)
      return config
    })
    const res = await instance.get(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(seen.at(-1)).toBe(0)
  })

  it('pays at most once: a paid retry that is challenged again is not paid again', async () => {
    let paidAttempts = 0
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (request.headers.get('payment-signature')) paidAttempts += 1
        // Always challenge, even the paid retry.
        return new HttpResponse(null, {
          status: 402,
          headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
        })
      }),
    )
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    await expect(instance.get(ORIGIN_URL)).rejects.toMatchObject({
      name: 'LedewireError',
      statusCode: 402,
    })
    expect(paidAttempts).toBe(1)
  })

  it('delegates to client.buildPaymentSignature — works with a mock client', async () => {
    const mockSig = btoa(
      JSON.stringify({
        x402Version: 2,
        resource: { url: THIRD_PARTY_URL },
        accepted: {},
        payload: { token: 't', contentId: 'c' },
      }),
    )
    const buildSpy = vi.fn().mockResolvedValue(mockSig)
    const mockClient = { buildPaymentSignature: buildSpy } satisfies PaymentSigner

    server.use(
      http.get(THIRD_PARTY_URL, ({ request }) => {
        if (!request.headers.get('payment-signature')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }
        return HttpResponse.json({ ok: true })
      }),
    )

    const instance = wrapAxiosWithPayment(axios.create(), mockClient)
    await instance.get(THIRD_PARTY_URL)
    expect(buildSpy).toHaveBeenCalledOnce()
  })

  it('throws InsufficientFundsError when retry returns 422', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('payment-signature')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }
        return HttpResponse.json({ error: 'Insufficient balance' }, { status: 422 })
      }),
    )
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    await expect(instance.get(ORIGIN_URL)).rejects.toThrow(InsufficientFundsError)
  })

  it('throws LedewireError when retry returns other non-ok status', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('payment-signature')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }
        return HttpResponse.json({ error: 'Forbidden' }, { status: 403 })
      }),
    )
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    await expect(instance.get(ORIGIN_URL)).rejects.toThrow(LedewireError)
  })

  it('passes through non-402 axios errors unchanged', async () => {
    server.use(
      http.get(ORIGIN_URL, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })),
    )
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    await expect(instance.get(ORIGIN_URL)).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('passes through 402 with no payment-required header unchanged', async () => {
    server.use(http.get(ORIGIN_URL, () => new HttpResponse(null, { status: 402 })))
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    // Without a payment-required header the interceptor rejects with the original error
    await expect(instance.get(ORIGIN_URL)).rejects.toMatchObject({ response: { status: 402 } })
  })

  it('passes through a first-response 402 as-is even when its body looks like a spend-cap refusal', async () => {
    // The API never refuses the FIRST (unpaid) request this way — see api#1066.
    // A bare 402 with no payment-required header always passes through unchanged now.
    server.use(http.get(ORIGIN_URL, () => HttpResponse.json(CAP_BODY, { status: 402 })))
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    const err = await instance.get(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(SpendCapReachedError)
    expect((err as { response?: { status: number } }).response?.status).toBe(402)
  })

  it('uses a fallback message when retry error body has no string error field', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('payment-signature')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }
        // Body has no `error` string key — exercises false branch of `typeof raw === 'string'`
        return HttpResponse.json({ code: 42 }, { status: 422 })
      }),
    )
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    const err = await instance.get(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(InsufficientFundsError)
    expect((err as InsufficientFundsError).message).toContain('422')
  })

  it('uses a fallback message when retry error has no response data', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('payment-signature')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }
        // No body at all — exercises `errorData?.['error']` when errorData is undefined
        return new HttpResponse(null, { status: 422 })
      }),
    )
    const instance = wrapAxiosWithPayment(axios.create(), makeClient())
    const err = await instance.get(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(InsufficientFundsError)
  })

  describe('payment-response refusal on the paid request (x402 v2 spec form, api#1066)', () => {
    function paidRespondsWith(build: () => Response) {
      return http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('payment-signature')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
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
                'payment-response': paymentResponseHeader('daily_spend_cap_reached'),
              },
            }),
        ),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      const err = await instance.get(ORIGIN_URL).catch((e: unknown) => e)
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
                'payment-response': paymentResponseHeader('daily_spend_cap_reached'),
              },
            }),
        ),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      const err = await instance.get(ORIGIN_URL).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(LedewireError)
      expect(err).not.toBeInstanceOf(SpendCapReachedError)
      expect((err as LedewireError).type).toBe('daily_spend_cap_reached')
      expect((err as LedewireError).statusCode).toBe(402)
    })

    it('maps insufficient_funds to InsufficientFundsError', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(null, {
              status: 402,
              headers: { 'payment-response': paymentResponseHeader('insufficient_funds') },
            }),
        ),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      await expect(instance.get(ORIGIN_URL)).rejects.toThrow(InsufficientFundsError)
    })

    it('maps invalid_ledewire_wallet_payload_token to AuthError', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(null, {
              status: 402,
              headers: {
                'payment-response': paymentResponseHeader('invalid_ledewire_wallet_payload_token'),
              },
            }),
        ),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      await expect(instance.get(ORIGIN_URL)).rejects.toThrow(AuthError)
    })

    it('maps invalid_ledewire_wallet_payload_role to ForbiddenError', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(null, {
              status: 402,
              headers: {
                'payment-response': paymentResponseHeader('invalid_ledewire_wallet_payload_role'),
              },
            }),
        ),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      await expect(instance.get(ORIGIN_URL)).rejects.toThrow(ForbiddenError)
    })

    it('maps an unknown errorReason to a LedewireError whose type is the reason', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(null, {
              status: 402,
              headers: { 'payment-response': paymentResponseHeader('some_future_reason') },
            }),
        ),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      const err = await instance.get(ORIGIN_URL).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(LedewireError)
      expect((err as LedewireError).type).toBe('some_future_reason')
    })
  })

  describe('legacy paid-response mapping (pre-api#1066, no payment-response header)', () => {
    function paidRespondsWith(build: () => Response) {
      return http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('payment-signature')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }
        return build()
      })
    }

    it('throws SpendCapReachedError for a 402 cap body with no payment-response header', async () => {
      server.use(paidRespondsWith(() => HttpResponse.json(CAP_BODY, { status: 402 })))
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      const err = await instance.get(ORIGIN_URL).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(SpendCapReachedError)
      expect((err as SpendCapReachedError).capCents).toBe(5000)
    })

    it('throws AuthError for a 401 with no payment-response header', async () => {
      server.use(
        paidRespondsWith(() => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      await expect(instance.get(ORIGIN_URL)).rejects.toThrow(AuthError)
    })

    it('throws ForbiddenError for a 403 with no payment-response header', async () => {
      server.use(paidRespondsWith(() => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })))
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      await expect(instance.get(ORIGIN_URL)).rejects.toThrow(ForbiddenError)
    })

    it('falls back to the legacy mapping without crashing when payment-response is malformed', async () => {
      server.use(
        paidRespondsWith(
          () =>
            new HttpResponse(JSON.stringify({ error: 'Insufficient balance' }), {
              status: 422,
              headers: { 'Content-Type': 'application/json', 'payment-response': '!!!not-base64' },
            }),
        ),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      await expect(instance.get(ORIGIN_URL)).rejects.toThrow(InsufficientFundsError)
    })
  })

  describe('payment origin restriction', () => {
    it('rejects with the original 402 from another origin, with no paid retry', async () => {
      const signatures: (string | null)[] = []
      server.use(
        http.get(THIRD_PARTY_URL, ({ request }) => {
          signatures.push(request.headers.get('payment-signature'))
          if (request.headers.get('payment-signature')) return HttpResponse.json({ paid: true })
          return HttpResponse.json(
            { reason: 'pay me' },
            { status: 402, headers: { 'payment-required': PAYMENT_REQUIRED_HEADER } },
          )
        }),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      const err = await instance.get(THIRD_PARTY_URL).catch((e: unknown) => e)
      expect(axios.isAxiosError(err)).toBe(true)
      expect(err).toMatchObject({ response: { status: 402, data: { reason: 'pay me' } } })
      expect(signatures).toEqual([null])
    })

    it('refuses a relative url resolved against a third-party baseURL', async () => {
      const signatures: (string | null)[] = []
      server.use(
        http.get(THIRD_PARTY_URL, ({ request }) => {
          signatures.push(request.headers.get('payment-signature'))
          if (request.headers.get('payment-signature')) return HttpResponse.json({ paid: true })
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }),
      )
      const instance = wrapAxiosWithPayment(
        axios.create({ baseURL: 'https://blog.example.com' }),
        makeClient(),
      )
      await expect(instance.get('/posts/article')).rejects.toMatchObject({
        response: { status: 402 },
      })
      expect(signatures).toEqual([null])
    })

    it('pays a relative url resolved against the API baseURL, passing the full url to the signer', async () => {
      const signatures: string[] = []
      server.use(
        http.get(ORIGIN_URL, ({ request }) => {
          const sig = request.headers.get('payment-signature')
          if (!sig) {
            return new HttpResponse(null, {
              status: 402,
              headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
            })
          }
          signatures.push(sig)
          return HttpResponse.json({ data: 'content' })
        }),
      )
      const instance = wrapAxiosWithPayment(axios.create({ baseURL: API_BASE }), makeClient())
      const res = await instance.get(`/v1/x402/contents/${CONTENT_ID}`)
      expect(res.status).toBe(200)
      expect(signatures).toHaveLength(1)
      expect(decodeSignature(signatures[0]!).payload.authorization.resource).toBe(ORIGIN_URL)
    })

    it('pays only the configured origin, whatever host the challenge names', async () => {
      const otherHostHits: string[] = []
      const header = challenge(
        {},
        { extensions: { 'ledewire-wallet': { apiBase: 'https://evil.example' } } },
      )
      const paidUrls: string[] = []
      server.use(
        http.all('https://evil.example/*', ({ request }) => {
          otherHostHits.push(request.url)
          return HttpResponse.error()
        }),
        http.get(ORIGIN_URL, ({ request }) => {
          if (!request.headers.get('payment-signature')) {
            return new HttpResponse(null, { status: 402, headers: { 'payment-required': header } })
          }
          paidUrls.push(request.url)
          return HttpResponse.json({ data: 'content' })
        }),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      const res = await instance.get(ORIGIN_URL)
      expect(res.status).toBe(200)
      expect(paidUrls).toEqual([ORIGIN_URL])
      expect(otherHostHits).toEqual([])
    })

    it('rejects with the original 402 when a custom signer refuses the origin', async () => {
      const buildSpy = vi.fn().mockResolvedValue(btoa('{"mock":true}'))
      const allowsSpy = vi.fn().mockReturnValue(false)
      server.use(
        http.get(ORIGIN_URL, ({ request }) => {
          if (request.headers.get('payment-signature')) return HttpResponse.json({ paid: true })
          return new HttpResponse(null, {
            status: 402,
            headers: { 'payment-required': PAYMENT_REQUIRED_HEADER },
          })
        }),
      )
      const signer: PaymentSigner = { buildPaymentSignature: buildSpy, allowsPaymentTo: allowsSpy }
      const instance = wrapAxiosWithPayment(axios.create(), signer)
      await expect(instance.get(ORIGIN_URL)).rejects.toMatchObject({ response: { status: 402 } })
      expect(allowsSpy).toHaveBeenCalledWith(ORIGIN_URL)
      expect(buildSpy).not.toHaveBeenCalled()
    })
  })
})

describe('wrapAxiosWithPayment: the signed payment and refusals', () => {
  it('sends a signed authorization matching the challenge, with no token or content id', async () => {
    const payments = serveContent([settled])
    const res = await wrapAxiosWithPayment(axios.create(), makeClient()).get(ORIGIN_URL)
    expect(res.status).toBe(200)
    const payment = payments[0]!
    const raw: Record<string, unknown> = { ...payment }
    expect(Object.keys(raw).sort()).toEqual(['accepted', 'payload', 'x402Version'])
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
      const err = await wrapAxiosWithPayment(axios.create(), makeClient({ maxPriceCents: 1000 }))
        .get(ORIGIN_URL)
        .catch((e: unknown) => e)
      expect(err).toBeInstanceOf(PaymentRefusedError)
      expect(err).toMatchObject({ refusal: code, type: code, statusCode: 402 })
      expect(payments).toHaveLength(1)
    },
  )

  it('re-signs payment_authorization_expired once, with a fresh nonce', async () => {
    const payments = serveContent([refused('payment_authorization_expired'), settled])
    const res = await wrapAxiosWithPayment(axios.create(), makeClient()).get(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(payments).toHaveLength(2)
    expect(payments[1]!.payload.authorization.nonce).not.toBe(
      payments[0]!.payload.authorization.nonce,
    )
  })

  it('re-signs payment_authorization_expired only once', async () => {
    const payments = serveContent([refused('payment_authorization_expired')])
    const err = await wrapAxiosWithPayment(axios.create(), makeClient())
      .get(ORIGIN_URL)
      .catch((e: unknown) => e)
    expect(err).toMatchObject({ refusal: 'payment_authorization_expired' })
    expect(payments).toHaveLength(2)
  })

  it('re-signs amount_mismatch within maxPriceCents and throws above it', async () => {
    const within = serveContent([refused('amount_mismatch', { amount: '300' }), settled])
    const res = await wrapAxiosWithPayment(axios.create(), makeClient({ maxPriceCents: 300 })).get(
      ORIGIN_URL,
    )
    expect(res.status).toBe(200)
    expect(within.map((p) => p.payload.authorization.value)).toEqual(['250', '300'])

    const above = serveContent([refused('amount_mismatch', { amount: '301' })])
    const err = await wrapAxiosWithPayment(axios.create(), makeClient({ maxPriceCents: 300 }))
      .get(ORIGIN_URL)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PriceAboveMaximumError)
    expect(above).toHaveLength(1)
  })

  it('signs at most twice even when every refusal could be re-signed', async () => {
    const payments = serveContent([
      refused('payment_authorization_expired'),
      refused('amount_mismatch', { amount: '250' }),
    ])
    const err = await wrapAxiosWithPayment(axios.create(), makeClient({ maxPriceCents: 1000 }))
      .get(ORIGIN_URL)
      .catch((e: unknown) => e)
    expect(err).toMatchObject({ refusal: 'amount_mismatch' })
    expect(payments).toHaveLength(2)
  })
})
