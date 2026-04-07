import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { wrapFetchWithPayment } from './fetch.js'
import type { PaymentSigner } from '../types.js'
import { LedewirePaymentClient } from '../payment-client.js'
import { InsufficientFundsError } from '../errors.js'
import { LedewireError } from '@ledewire/core'

const API_BASE = 'http://api.test'
const ORIGIN_URL = 'https://blog.example.com/posts/article'
const NOW_SECONDS = Math.floor(Date.now() / 1000)
const CONTENT_ID = 'content-uuid-1'

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
    // Signature is valid base64 JSON
    const payload = JSON.parse(atob(capturedSigs[0]!)) as { payload: { token: string } }
    expect(payload.payload.token).toBe('buyer-jwt')
  })

  it('delegates to client.buildPaymentSignature — works with a mock client', async () => {
    const mockSig = btoa('{"mock":true}')
    const buildSpy = vi.fn().mockResolvedValue(mockSig)
    const mockClient = { buildPaymentSignature: buildSpy } satisfies PaymentSigner

    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
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
    await fetch(ORIGIN_URL)
    expect(buildSpy).toHaveBeenCalledOnce()
    expect(buildSpy).toHaveBeenCalledWith(PAYMENT_REQUIRED_HEADER, ORIGIN_URL)
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
})
