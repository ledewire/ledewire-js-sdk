import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { LedewirePaymentClient, throwPaymentError } from './payment-client.js'
import type { LedewirePaymentPayload } from './types.js'
import {
  NonceExpiredError,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  InsufficientFundsError,
} from './errors.js'
import { AuthError, LedewireError } from '@ledewire/core'

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

  it('throws LedewireError for any other status', () => {
    // Exercises the final `throw new LedewireError` — false branch of `status === 401`
    expect(() => throwPaymentError(500, 'internal')).toThrow(LedewireError)
    expect(() => throwPaymentError(403, 'forbidden')).toThrow(LedewireError)
  })
})
