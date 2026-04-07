import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import axios from 'axios'
import { wrapAxiosWithPayment } from './axios.js'
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

  it('delegates to client.buildPaymentSignature — works with a mock client', async () => {
    const mockSig = btoa(
      JSON.stringify({
        x402Version: 2,
        resource: { url: ORIGIN_URL },
        accepted: {},
        payload: { token: 't', contentId: 'c' },
      }),
    )
    const buildSpy = vi.fn().mockResolvedValue(mockSig)
    const mockClient = { buildPaymentSignature: buildSpy } satisfies PaymentSigner

    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
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
    await instance.get(ORIGIN_URL)
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
})
