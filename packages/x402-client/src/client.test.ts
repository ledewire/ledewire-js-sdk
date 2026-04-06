import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createLedewireFetch } from './client.js'
import {
  NonceExpiredError,
  InsufficientFundsError,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
} from './errors.js'
import { LedewireError } from '@ledewire/core'

const API_BASE = 'http://api.test'
const ORIGIN_URL = 'https://blog.example.com/posts/article'
const NOW_SECONDS = Math.floor(Date.now() / 1000)
const CONTENT_ID = 'content-uuid-1'

const PAYMENT_REQUIRED_PAYLOAD = {
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
      extra: { nonce: 'test-nonce', expiresAt: NOW_SECONDS + 120, contentId: CONTENT_ID },
    },
  ],
  extensions: {
    'ledewire-wallet': {
      apiBase: API_BASE,
      authEndpoint: '/v1/auth/login/buyer-api-key',
      signupUrl: 'https://ledewire.com/signup',
      schemeVersion: 'ledewire:v1',
      contentId: CONTENT_ID,
    },
  },
}

const AUTH_RESPONSE = {
  token_type: 'Bearer',
  access_token: 'buyer-jwt',
  refresh_token: 'refresh',
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
}

const CONTENT_RESPONSE = {
  id: CONTENT_ID,
  title: 'Great Article',
  content_type: 'markdown',
  price_cents: 100,
  teaser: '',
  visibility: 'public',
}

const server = setupServer(
  http.post(`${API_BASE}/v1/auth/login/buyer-api-key`, () => HttpResponse.json(AUTH_RESPONSE)),
)

beforeEach(() => {
  server.resetHandlers()
})

describe('createLedewireFetch', () => {
  server.listen({ onUnhandledRequest: 'error' })

  it('passes through non-402 responses unchanged', async () => {
    server.use(http.get(ORIGIN_URL, () => HttpResponse.json({ ok: true })))
    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    const res = await fetchFn(ORIGIN_URL)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('handles x402 challenge end-to-end and returns 200', async () => {
    const settledSignatures: string[] = []
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        const sig = request.headers.get('PAYMENT-SIGNATURE')
        if (!sig) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': btoa(JSON.stringify(PAYMENT_REQUIRED_PAYLOAD)) },
          })
        }
        settledSignatures.push(sig)
        return HttpResponse.json(CONTENT_RESPONSE)
      }),
    )

    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    const res = await fetchFn(ORIGIN_URL)
    expect(res.status).toBe(200)
    expect(settledSignatures).toHaveLength(1)

    // Verify PAYMENT-SIGNATURE contains correct contentId and token
    const sig = settledSignatures[0]
    expect(sig).toBeDefined()
    const decoded = JSON.parse(atob(sig!)) as {
      payload: { contentId: string; token: string }
      x402Version: number
    }
    expect(decoded.payload.contentId).toBe(CONTENT_ID)
    expect(decoded.payload.token).toBe('buyer-jwt')
    expect(decoded.x402Version).toBe(2)
  })

  it('throws NonceExpiredError when nonce is expired', async () => {
    const expiredPayload = {
      ...PAYMENT_REQUIRED_PAYLOAD,
      accepts: [
        {
          ...PAYMENT_REQUIRED_PAYLOAD.accepts[0]!,
          extra: { ...PAYMENT_REQUIRED_PAYLOAD.accepts[0]!.extra, expiresAt: NOW_SECONDS - 10 },
        },
      ],
    }
    server.use(
      http.get(
        ORIGIN_URL,
        () =>
          new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': btoa(JSON.stringify(expiredPayload)) },
          }),
      ),
    )
    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    await expect(fetchFn(ORIGIN_URL)).rejects.toThrow(NonceExpiredError)
  })

  it('throws UnsupportedSchemeError for non-ledewire 402', async () => {
    server.use(
      http.get(
        ORIGIN_URL,
        () =>
          new HttpResponse(null, {
            status: 402,
            headers: {
              'PAYMENT-REQUIRED': btoa(
                JSON.stringify({
                  x402Version: 2,
                  resource: { url: ORIGIN_URL },
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
              ),
            },
          }),
      ),
    )
    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    await expect(fetchFn(ORIGIN_URL)).rejects.toThrow(UnsupportedSchemeError)
  })

  it('throws MalformedPaymentRequiredError for missing extension block', async () => {
    server.use(
      http.get(
        ORIGIN_URL,
        () =>
          new HttpResponse(null, {
            status: 402,
            headers: {
              'PAYMENT-REQUIRED': btoa(
                JSON.stringify({
                  x402Version: 2,
                  resource: { url: ORIGIN_URL },
                  accepts: [PAYMENT_REQUIRED_PAYLOAD.accepts[0]],
                  extensions: {},
                }),
              ),
            },
          }),
      ),
    )
    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    await expect(fetchFn(ORIGIN_URL)).rejects.toThrow(MalformedPaymentRequiredError)
  })

  it('throws InsufficientFundsError on 422 payment response', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': btoa(JSON.stringify(PAYMENT_REQUIRED_PAYLOAD)) },
          })
        }
        return HttpResponse.json({ error: 'Insufficient wallet balance' }, { status: 422 })
      }),
    )
    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    await expect(fetchFn(ORIGIN_URL)).rejects.toThrow(InsufficientFundsError)
  })

  it('throws LedewireError on other payment failures', async () => {
    server.use(
      http.get(ORIGIN_URL, ({ request }) => {
        if (!request.headers.get('PAYMENT-SIGNATURE')) {
          return new HttpResponse(null, {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': btoa(JSON.stringify(PAYMENT_REQUIRED_PAYLOAD)) },
          })
        }
        return HttpResponse.json({ error: 'Bad request' }, { status: 400 })
      }),
    )
    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    await expect(fetchFn(ORIGIN_URL)).rejects.toThrow(LedewireError)
  })

  it('returns 402 directly when no PAYMENT-REQUIRED header is present', async () => {
    server.use(http.get(ORIGIN_URL, () => new HttpResponse(null, { status: 402 })))
    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    const res = await fetchFn(ORIGIN_URL)
    expect(res.status).toBe(402)
  })

  it('uses apiBase from extensions.ledewire-wallet when present', async () => {
    const capturedUrls: string[] = []
    const stagingBase = 'http://api-staging.test'
    let firstRequest = true

    server.use(
      http.get(ORIGIN_URL, () => {
        if (firstRequest) {
          firstRequest = false
          return new HttpResponse(null, {
            status: 402,
            headers: {
              'PAYMENT-REQUIRED': btoa(
                JSON.stringify({
                  ...PAYMENT_REQUIRED_PAYLOAD,
                  extensions: {
                    'ledewire-wallet': {
                      ...PAYMENT_REQUIRED_PAYLOAD.extensions['ledewire-wallet'],
                      apiBase: stagingBase,
                    },
                  },
                }),
              ),
            },
          })
        }
        return HttpResponse.json(CONTENT_RESPONSE)
      }),
      http.post(`${stagingBase}/v1/auth/login/buyer-api-key`, ({ request }) => {
        capturedUrls.push(request.url)
        return HttpResponse.json(AUTH_RESPONSE)
      }),
    )

    const fetchFn = createLedewireFetch({
      key: 'bk_key',
      secret: 'secret',
      apiBase: API_BASE,
      fetch: globalThis.fetch,
    })
    await fetchFn(ORIGIN_URL)
    expect(capturedUrls[0]).toContain(stagingBase)
  })
})
