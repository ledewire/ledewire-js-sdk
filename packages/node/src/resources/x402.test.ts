import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, HttpClient, LedewireError, RateLimitError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { x402BazaarDiscoveryFixture } from '@ledewire/core/test-utils'
import { X402Namespace } from './x402.js'

const BASE = 'https://api.ledewire.com'

const server = createTestServer()
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

function makeNamespace() {
  return new X402Namespace(new HttpClient({ baseUrl: BASE }))
}

// ---------------------------------------------------------------------------
// x402.discoverResources
// ---------------------------------------------------------------------------

describe('x402.discoverResources', () => {
  it('returns the bazaar discovery response', async () => {
    const fixture = x402BazaarDiscoveryFixture()
    server.use(http.get(`${BASE}/v1/x402/discovery/resources`, () => HttpResponse.json(fixture)))

    const result = await makeNamespace().discoverResources()

    expect(result).toEqual(fixture)
  })

  it('sends limit and offset as query parameters', async () => {
    server.use(
      http.get(`${BASE}/v1/x402/discovery/resources`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('limit')).toBe('10')
        expect(url.searchParams.get('offset')).toBe('20')
        return HttpResponse.json(x402BazaarDiscoveryFixture())
      }),
    )

    await makeNamespace().discoverResources({ limit: 10, offset: 20 })
  })

  it('sends no Authorization header — the endpoint is unauthenticated', async () => {
    server.use(
      http.get(`${BASE}/v1/x402/discovery/resources`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBeNull()
        return HttpResponse.json(x402BazaarDiscoveryFixture())
      }),
    )

    await makeNamespace().discoverResources()
  })
})

// ---------------------------------------------------------------------------
// x402.verifyOrigin
// ---------------------------------------------------------------------------

describe('x402.verifyOrigin', () => {
  const PAGE = 'https://theirsite.com/articles/slug'

  it('returns the verified response and sends url as a query parameter', async () => {
    const verified = {
      verified: true as const,
      content_id: 'content-id-1',
      store_id: 'store-id-1',
      amount: '10',
      title: 'Test Article',
    }
    let seen: URLSearchParams | undefined
    server.use(
      http.get(`${BASE}/v1/x402/verify-origin`, ({ request }) => {
        seen = new URL(request.url).searchParams
        return HttpResponse.json(verified)
      }),
    )

    const result = await makeNamespace().verifyOrigin({ url: PAGE })

    expect(result).toEqual(verified)
    expect(seen?.get('url')).toBe(PAGE)
    expect(seen?.has('store_id')).toBe(false)
  })

  it('sends store_id as a query parameter when given', async () => {
    let seen: URLSearchParams | undefined
    server.use(
      http.get(`${BASE}/v1/x402/verify-origin`, ({ request }) => {
        seen = new URL(request.url).searchParams
        return HttpResponse.json({ verified: false })
      }),
    )

    await makeNamespace().verifyOrigin({ url: PAGE, store_id: 'store-id-1' })

    expect(seen?.get('url')).toBe(PAGE)
    expect(seen?.get('store_id')).toBe('store-id-1')
  })

  it('returns { verified: false } for an unregistered URL', async () => {
    server.use(
      http.get(`${BASE}/v1/x402/verify-origin`, () => HttpResponse.json({ verified: false })),
    )

    await expect(makeNamespace().verifyOrigin({ url: PAGE })).resolves.toEqual({ verified: false })
  })

  it('throws RateLimitError with retryAfter from Retry-After on 429', async () => {
    server.use(
      http.get(`${BASE}/v1/x402/verify-origin`, () =>
        HttpResponse.json(
          { error: { code: 429, message: 'Rate limit exceeded' } },
          { status: 429, headers: { 'Retry-After': '60' } },
        ),
      ),
    )

    const error = await makeNamespace()
      .verifyOrigin({ url: PAGE })
      .catch((err: unknown) => err)

    expect(error).toBeInstanceOf(RateLimitError)
    expect(error).toMatchObject({
      statusCode: 429,
      retryAfter: 60,
      message: 'Rate limit exceeded',
    })
  })
})

// ---------------------------------------------------------------------------
// x402.getJwks
// ---------------------------------------------------------------------------

describe('x402.getJwks', () => {
  it('returns the JWKS document', async () => {
    const jwks = {
      keys: [
        {
          kty: 'RSA' as const,
          use: 'sig' as const,
          alg: 'RS256' as const,
          kid: 'kid-1',
          n: 'n',
          e: 'AQAB',
        },
      ],
    }
    server.use(http.get(`${BASE}/.well-known/x402-jwks.json`, () => HttpResponse.json(jwks)))

    await expect(makeNamespace().getJwks()).resolves.toEqual(jwks)
  })

  it('throws a 503 LedewireError carrying the bare-string "JWKS unavailable" body', async () => {
    server.use(
      http.get(`${BASE}/.well-known/x402-jwks.json`, () =>
        HttpResponse.json(
          { error: 'JWKS unavailable' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        ),
      ),
    )

    const error = await makeNamespace()
      .getJwks()
      .catch((err: unknown) => err)

    expect(error).toBeInstanceOf(LedewireError)
    expect(error).toMatchObject({ statusCode: 503, message: 'JWKS unavailable' })
  })
})

/** An HttpClient whose session is dead: any attempt to read or refresh the token throws. */
function deadSessionHttp() {
  return new HttpClient({
    baseUrl: BASE,
    getAccessToken: () => {
      throw new AuthError('Token refresh failed')
    },
    onUnauthorized: () => {
      throw new AuthError('Token refresh failed')
    },
  })
}

describe('X402Namespace — public endpoints skip auth', () => {
  it('discoverResources sends no Authorization header and never touches a dead session', async () => {
    let authHeader: string | null = 'unset'
    server.use(
      http.get(`${BASE}/v1/x402/discovery/resources`, ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json(x402BazaarDiscoveryFixture())
      }),
    )
    const ns = new X402Namespace(deadSessionHttp())

    await expect(ns.discoverResources()).resolves.toBeDefined()
    expect(authHeader).toBeNull()
  })

  it('verifyOrigin and getJwks send no Authorization header and never touch a dead session', async () => {
    const headers: (string | null)[] = []
    server.use(
      http.get(`${BASE}/v1/x402/verify-origin`, ({ request }) => {
        headers.push(request.headers.get('Authorization'))
        return HttpResponse.json({ verified: false })
      }),
      http.get(`${BASE}/.well-known/x402-jwks.json`, ({ request }) => {
        headers.push(request.headers.get('Authorization'))
        return HttpResponse.json({ keys: [] })
      }),
    )
    const ns = new X402Namespace(deadSessionHttp())

    await expect(ns.verifyOrigin({ url: 'https://theirsite.com/a' })).resolves.toBeDefined()
    await expect(ns.getJwks()).resolves.toBeDefined()
    expect(headers).toEqual([null, null])
  })
})
