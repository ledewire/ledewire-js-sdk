import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import axios from 'axios'
import { wrapAxiosWithPayment } from './axios.js'
import type { PaymentSigner } from '../types.js'
import { LedewirePaymentClient } from '../payment-client.js'
import { InsufficientFundsError } from '../errors.js'
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

const API_BASE = 'http://api.test'
const NOW_SECONDS = Math.floor(Date.now() / 1000)
const CONTENT_ID = 'content-uuid-1'
/** A paid resource on the configured Ledewire API origin. */
const ORIGIN_URL = `${API_BASE}/v1/x402/contents/${CONTENT_ID}`
/** A resource on some other origin — a real client never pays or authenticates for it. */
const THIRD_PARTY_URL = 'https://blog.example.com/posts/article'

const PAYMENT_REQUIRED_HEADER = btoa(
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
        extra: { nonce: 'n', expiresAt: NOW_SECONDS + 120, contentId: CONTENT_ID },
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
  }),
)

const server = setupServer(
  http.post(`${API_BASE}/v1/auth/login/buyer-api-key`, () =>
    HttpResponse.json({
      token_type: 'Bearer',
      access_token: 'buyer-jwt',
      refresh_token: 'r',
      expires_at: new Date(Date.now() + 1800_000).toISOString(),
    }),
  ),
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

const makeClient = () => new LedewirePaymentClient({ key: 'bk', secret: 's', apiBase: API_BASE })

/** A PAYMENT-REQUIRED header whose discovery block names `apiBase`. */
function paymentRequiredNaming(apiBase: string): string {
  const decoded = JSON.parse(atob(PAYMENT_REQUIRED_HEADER)) as {
    extensions: { 'ledewire-wallet': Record<string, unknown> }
  }
  decoded.extensions['ledewire-wallet']['apiBase'] = apiBase
  return btoa(JSON.stringify(decoded))
}

/** Records every buyer-key login against the configured API base. */
function recordLogins(): string[] {
  const logins: string[] = []
  server.use(
    http.post(`${API_BASE}/v1/auth/login/buyer-api-key`, ({ request }) => {
      logins.push(request.url)
      return HttpResponse.json({
        token_type: 'Bearer',
        access_token: 'buyer-jwt',
        refresh_token: 'r',
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
      })
    }),
  )
  return logins
}

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
    const payload = JSON.parse(atob(capturedSigs[0]!)) as { payload: { token: string } }
    expect(payload.payload.token).toBe('buyer-jwt')
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
    it('rejects with the original 402 from another origin, with no login and no paid retry', async () => {
      const logins = recordLogins()
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
      expect(logins).toEqual([])
    })

    it('refuses a relative url resolved against a third-party baseURL', async () => {
      const logins = recordLogins()
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
      expect(logins).toEqual([])
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
      const payload = JSON.parse(atob(signatures[0]!)) as { resource: { url: string } }
      expect(payload.resource.url).toBe(ORIGIN_URL)
    })

    it('never contacts an apiBase named in the challenge; logs in at the configured base and pays', async () => {
      const otherHostHits: string[] = []
      const logins = recordLogins()
      const header = paymentRequiredNaming('https://evil.example')
      const signatures: string[] = []
      server.use(
        http.all('https://evil.example/*', ({ request }) => {
          otherHostHits.push(request.url)
          return HttpResponse.error()
        }),
        http.get(ORIGIN_URL, ({ request }) => {
          const sig = request.headers.get('payment-signature')
          if (!sig) {
            return new HttpResponse(null, { status: 402, headers: { 'payment-required': header } })
          }
          signatures.push(sig)
          return HttpResponse.json({ data: 'content' })
        }),
      )
      const instance = wrapAxiosWithPayment(axios.create(), makeClient())
      const res = await instance.get(ORIGIN_URL)
      expect(res.status).toBe(200)
      expect(signatures).toHaveLength(1)
      expect(otherHostHits).toEqual([])
      expect(logins).toEqual([`${API_BASE}/v1/auth/login/buyer-api-key`])
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
