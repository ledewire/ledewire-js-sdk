import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { authTokenFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { MemoryTokenStorage } from '@ledewire/core'
import { createClient } from './client.js'

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

// ---------------------------------------------------------------------------
// createClient — wiring and options
// ---------------------------------------------------------------------------

describe('createClient', () => {
  it('uses the default base URL when none is provided', async () => {
    let capturedUrl = ''
    server.use(
      http.post(`${BASE}/v1/auth/login/email`, ({ request }) => {
        capturedUrl = new URL(request.url).origin
        return HttpResponse.json(authTokenFixture())
      }),
    )

    await createClient().auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })

    expect(capturedUrl).toBe(BASE)
  })

  it('uses a custom baseUrl when provided', async () => {
    const STAGING = 'https://api-staging.ledewire.com'
    let capturedUrl = ''
    server.use(
      http.post(`${STAGING}/v1/auth/login/email`, ({ request }) => {
        capturedUrl = new URL(request.url).origin
        return HttpResponse.json(authTokenFixture())
      }),
    )

    const client = createClient({ baseUrl: STAGING })
    await client.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })

    expect(capturedUrl).toBe(STAGING)
  })

  it('uses a provided custom storage implementation', async () => {
    const storage = new MemoryTokenStorage()
    server.use(
      http.post(`${BASE}/v1/auth/login/email`, () =>
        HttpResponse.json(authTokenFixture({ access_token: 'custom-storage-token' })),
      ),
    )

    const client = createClient({ storage })
    await client.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })

    expect(storage.getTokens()?.accessToken).toBe('custom-storage-token')
  })
})

// ---------------------------------------------------------------------------
// createClient — refreshFn bridge
// ---------------------------------------------------------------------------

describe('createClient refreshFn', () => {
  it('exchanges an expired token via POST /v1/auth/token/refresh', async () => {
    // Seed the client with an already-expired token so TokenManager triggers refresh
    const expiredTokens = authTokenFixture({
      access_token: 'expired-access',
      refresh_token: 'valid-refresh',
      expires_at: '2000-01-01T00:00:00Z', // deep in the past
    })
    const refreshed = authTokenFixture({
      access_token: 'refreshed-access',
      refresh_token: 'new-refresh',
    })

    let authHeader = ''
    server.use(
      // Initial login seeds expired tokens
      http.post(`${BASE}/v1/auth/login/email`, () => HttpResponse.json(expiredTokens)),
      // Refresh endpoint returns fresh tokens
      http.post(`${BASE}/v1/auth/token/refresh`, () => HttpResponse.json(refreshed)),
      // Any authenticated request triggers getAccessToken → refresh
      http.get(`${BASE}/v1/wallet/balance`, ({ request }) => {
        authHeader = request.headers.get('Authorization') ?? ''
        return HttpResponse.json({ balance_cents: 0 })
      }),
    )

    const client = createClient()
    await client.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })

    // wallet.balance() calls getAccessToken() internally, detects expiry, refreshes
    await client.wallet.balance()
    expect(authHeader).toBe('Bearer refreshed-access')
  })

  it('fires onTokenRefreshed callback after a successful refresh', async () => {
    const onTokenRefreshed = vi.fn()
    const expiredTokens = authTokenFixture({
      access_token: 'expired',
      refresh_token: 'valid-refresh',
      expires_at: '2000-01-01T00:00:00Z',
    })
    const refreshed = authTokenFixture({ access_token: 'refreshed', refresh_token: 'new-refresh' })

    server.use(
      http.post(`${BASE}/v1/auth/login/email`, () => HttpResponse.json(expiredTokens)),
      http.post(`${BASE}/v1/auth/token/refresh`, () => HttpResponse.json(refreshed)),
      http.get(`${BASE}/v1/wallet/balance`, () => HttpResponse.json({ balance_cents: 0 })),
    )

    const client = createClient({ onTokenRefreshed })
    await client.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })
    await client.wallet.balance() // triggers getAccessToken → refresh → fires onTokenRefreshed

    expect(onTokenRefreshed).toHaveBeenCalledOnce()
    expect(onTokenRefreshed).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'refreshed' }),
    )
  })

  it('emits a console.warn in non-production when both storage and onTokenRefreshed are provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      // NODE_ENV is 'test' in this environment — process exists and !== 'production'
      createClient({
        storage: new MemoryTokenStorage(),
        onTokenRefreshed: vi.fn(),
      })
      expect(warnSpy).toHaveBeenCalledOnce()
      expect(warnSpy.mock.calls[0]![0]).toContain('[LedeWire]')
      expect(warnSpy.mock.calls[0]![0]).toContain('onTokenRefreshed')
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('does not emit a console.warn in production when both storage and onTokenRefreshed are provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const originalEnv = process.env['NODE_ENV']

    try {
      process.env['NODE_ENV'] = 'production'
      createClient({
        storage: new MemoryTokenStorage(),
        onTokenRefreshed: vi.fn(),
      })
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      process.env['NODE_ENV'] = originalEnv
      warnSpy.mockRestore()
    }
  })

  it('does not emit a console.warn when only onTokenRefreshed is provided (no custom storage)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      createClient({ onTokenRefreshed: vi.fn() })
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('fires onAuthExpired when a 401 is received and no tokens are stored', async () => {
    const onAuthExpired = vi.fn()

    server.use(
      http.get(`${BASE}/v1/wallet/balance`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    const client = createClient({ onAuthExpired })
    // No login — no stored tokens.  The 401 triggers handleUnauthorized(),
    // which finds no tokens and calls onAuthExpired before returning null.
    await expect(client.wallet.balance()).rejects.toThrow()
    expect(onAuthExpired).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// createClient — namespaces added for the 2026-09 API sync
// ---------------------------------------------------------------------------

describe('createClient — bulk licensing and discovery namespaces', () => {
  it('routes client.publications.list through the configured base URL', async () => {
    server.use(
      http.get(`${BASE}/v1/publications`, () =>
        HttpResponse.json({
          data: [],
          pagination: { total: 0, per_page: 25, current_page: 1, total_pages: 0 },
        }),
      ),
    )

    const result = await createClient().publications.list()

    expect(result.data).toEqual([])
  })

  it('routes client.acquisitions.get to /v1/acquisitions/{id}', async () => {
    let hit = false
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-1`, () => {
        hit = true
        return HttpResponse.json(errorResponseFixture(404, 'Not found'), { status: 404 })
      }),
    )

    await expect(createClient().acquisitions.get('acq-1')).rejects.toThrow()
    expect(hit).toBe(true)
  })

  it('routes client.x402.discoverResources to the discovery endpoint', async () => {
    server.use(
      http.get(`${BASE}/v1/x402/discovery/resources`, () =>
        HttpResponse.json({ total: 0, resources: [] }),
      ),
    )

    const result = await createClient().x402.discoverResources()

    expect(result.total).toBe(0)
  })
})
