import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, HttpClient } from '@ledewire/core'
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
})
