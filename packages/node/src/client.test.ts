import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  authTokenFixture,
  errorResponseFixture,
  storeAuthTokenFixture,
} from '@ledewire/core/test-utils'
import { AuthError, MemoryTokenStorage } from '@ledewire/core'
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

  it('passes store_id from an API-key session refresh to onTokenRefreshed and storage', async () => {
    const onTokenRefreshed = vi.fn()
    const storage = new MemoryTokenStorage()
    let refreshedWith: unknown
    server.use(
      http.post(`${BASE}/v1/auth/login/api-key`, () =>
        HttpResponse.json(
          storeAuthTokenFixture({
            refresh_token: 'store-refresh',
            expires_at: '2000-01-01T00:00:00Z',
            store_id: 'store-1',
          }),
        ),
      ),
      http.post(`${BASE}/v1/auth/token/refresh`, async ({ request }) => {
        refreshedWith = await request.json()
        return HttpResponse.json(
          storeAuthTokenFixture({ access_token: 'refreshed-store', store_id: 'store-1' }),
        )
      }),
      http.get(`${BASE}/v1/merchant/store-1/sales/summary`, () => HttpResponse.json({})),
    )

    const client = createClient({ storage, onTokenRefreshed })
    const { store_id } = await client.auth.loginWithApiKey({ key: 'k', secret: 's' })
    await client.merchant.sales.summary(store_id)

    expect(refreshedWith).toEqual({ refresh_token: 'store-refresh' })
    expect(onTokenRefreshed).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'refreshed-store', storeId: 'store-1' }),
    )
    expect(storage.getTokens()?.storeId).toBe('store-1')
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
// createClient — automatic store API-key login (apiKey / apiSecret)
// ---------------------------------------------------------------------------

describe('createClient with apiKey', () => {
  const STORE = 'store-1'
  const SUMMARY = `${BASE}/v1/merchant/${STORE}/sales/summary`
  const LOGIN = `${BASE}/v1/auth/login/api-key`

  /** Records every request as `METHOD path` in order, with login bodies and auth headers. */
  function recordTraffic() {
    const calls: string[] = []
    const loginBodies: unknown[] = []
    const summaryAuth: string[] = []
    return {
      calls,
      loginBodies,
      summaryAuth,
      login: (response: () => Response) =>
        http.post(LOGIN, async ({ request }) => {
          calls.push('POST /v1/auth/login/api-key')
          loginBodies.push(await request.json())
          return response()
        }),
      summary: (response: (attempt: number) => Response = () => HttpResponse.json({})) =>
        http.get(SUMMARY, ({ request }) => {
          calls.push('GET summary')
          summaryAuth.push(request.headers.get('Authorization') ?? '')
          return response(summaryAuth.length)
        }),
      refresh: (response: () => Response) =>
        http.post(`${BASE}/v1/auth/token/refresh`, () => {
          calls.push('POST /v1/auth/token/refresh')
          return response()
        }),
    }
  }

  it('logs in with apiKey and apiSecret before the first authenticated request', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() =>
        HttpResponse.json(storeAuthTokenFixture({ access_token: 'auto-store', store_id: STORE })),
      ),
      t.summary(),
    )

    const client = createClient({ apiKey: 'key-1', apiSecret: 'secret-1' })
    await client.merchant.sales.summary(STORE)

    expect(t.calls).toEqual(['POST /v1/auth/login/api-key', 'GET summary'])
    expect(t.loginBodies).toEqual([{ key: 'key-1', secret: 'secret-1' }])
    expect(t.summaryAuth).toEqual(['Bearer auto-store'])
  })

  it('stores the auto-login session with its storeId, as an explicit login does', async () => {
    const storage = new MemoryTokenStorage()
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(storeAuthTokenFixture({ store_id: STORE }))),
      t.summary(),
    )

    await createClient({ apiKey: 'key-1', apiSecret: 'secret-1', storage }).merchant.sales.summary(
      STORE,
    )

    expect(storage.getTokens()?.storeId).toBe(STORE)
  })

  it('sends no secret in the login body when only apiKey is set', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(storeAuthTokenFixture())),
      t.summary(),
    )

    await createClient({ apiKey: 'view-key' }).merchant.sales.summary(STORE)

    expect(t.loginBodies).toEqual([{ key: 'view-key' }])
  })

  it('shares one login between two concurrent first requests', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(storeAuthTokenFixture({ access_token: 'shared' }))),
      t.summary(),
    )

    const client = createClient({ apiKey: 'key-1', apiSecret: 'secret-1' })
    await Promise.all([client.merchant.sales.summary(STORE), client.merchant.sales.summary(STORE)])

    expect(t.loginBodies).toHaveLength(1)
    expect(t.summaryAuth).toEqual(['Bearer shared', 'Bearer shared'])
  })

  it('logs in again after a failed refresh and retries the request once, without onAuthExpired', async () => {
    const onAuthExpired = vi.fn()
    const storage = new MemoryTokenStorage()
    storage.setTokens({
      accessToken: 'stale',
      refreshToken: 'dead-refresh',
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    const t = recordTraffic()
    server.use(
      t.summary((attempt) =>
        attempt === 1
          ? HttpResponse.json(errorResponseFixture(1001, 'Token expired'), { status: 401 })
          : HttpResponse.json({}),
      ),
      t.refresh(() =>
        HttpResponse.json(errorResponseFixture(1001, 'Bad refresh'), { status: 401 }),
      ),
      t.login(() => HttpResponse.json(storeAuthTokenFixture({ access_token: 'relogged' }))),
    )

    const client = createClient({ apiKey: 'key-1', apiSecret: 'secret-1', storage, onAuthExpired })
    await client.merchant.sales.summary(STORE)

    expect(t.calls).toEqual([
      'GET summary',
      'POST /v1/auth/token/refresh',
      'POST /v1/auth/login/api-key',
      'GET summary',
    ])
    expect(t.summaryAuth).toEqual(['Bearer stale', 'Bearer relogged'])
    expect(onAuthExpired).not.toHaveBeenCalled()
  })

  it('logs in again when a proactive refresh fails', async () => {
    const storage = new MemoryTokenStorage()
    storage.setTokens({ accessToken: 'old', refreshToken: 'dead-refresh', expiresAt: 0 })
    const t = recordTraffic()
    server.use(
      t.refresh(() =>
        HttpResponse.json(errorResponseFixture(1001, 'Bad refresh'), { status: 401 }),
      ),
      t.login(() => HttpResponse.json(storeAuthTokenFixture({ access_token: 'relogged' }))),
      t.summary(),
    )

    await createClient({ apiKey: 'key-1', apiSecret: 'secret-1', storage }).merchant.sales.summary(
      STORE,
    )

    expect(t.calls).toEqual([
      'POST /v1/auth/token/refresh',
      'POST /v1/auth/login/api-key',
      'GET summary',
    ])
    expect(t.summaryAuth).toEqual(['Bearer relogged'])
  })

  it('rejects with the login error and calls onAuthExpired once when the re-login fails', async () => {
    const onAuthExpired = vi.fn()
    const storage = new MemoryTokenStorage()
    storage.setTokens({
      accessToken: 'stale',
      refreshToken: 'dead-refresh',
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    const t = recordTraffic()
    server.use(
      t.summary(() =>
        HttpResponse.json(errorResponseFixture(1001, 'Token expired'), { status: 401 }),
      ),
      t.refresh(() =>
        HttpResponse.json(errorResponseFixture(1001, 'Bad refresh'), { status: 401 }),
      ),
      t.login(() =>
        HttpResponse.json(errorResponseFixture(1001, 'API key revoked'), { status: 401 }),
      ),
    )

    const client = createClient({ apiKey: 'key-1', apiSecret: 'secret-1', storage, onAuthExpired })
    const err: unknown = await client.merchant.sales.summary(STORE).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(AuthError)
    expect((err as AuthError).message).toBe('API key revoked')
    expect(t.loginBodies).toHaveLength(1)
    expect(t.calls.filter((c) => c === 'GET summary')).toHaveLength(1)
    expect(onAuthExpired).toHaveBeenCalledOnce()
  })

  it('rejects the first request with the API message after exactly one login attempt for a wrong key', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid API key or secret'), {
          status: 401,
        }),
      ),
      t.summary(),
    )

    const client = createClient({ apiKey: 'wrong', apiSecret: 'very-secret-value' })
    const err: unknown = await client.merchant.sales.summary(STORE).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(AuthError)
    expect((err as AuthError).message).toBe('Invalid API key or secret')
    expect((err as AuthError).message).not.toContain('very-secret-value')
    expect(t.calls).toEqual(['POST /v1/auth/login/api-key'])
  })

  it('sends no login request when a token is already stored', async () => {
    const storage = new MemoryTokenStorage()
    storage.setTokens({
      accessToken: 'from-storage',
      refreshToken: 'r',
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(storeAuthTokenFixture())),
      t.summary(),
    )

    await createClient({ apiKey: 'key-1', apiSecret: 'secret-1', storage }).merchant.sales.summary(
      STORE,
    )

    expect(t.calls).toEqual(['GET summary'])
    expect(t.summaryAuth).toEqual(['Bearer from-storage'])
  })

  it('does not log in again after an explicit loginWithApiKey', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(storeAuthTokenFixture({ store_id: STORE }))),
      t.summary(),
    )

    const client = createClient({ apiKey: 'key-1', apiSecret: 'secret-1' })
    const { store_id } = await client.auth.loginWithApiKey({ key: 'key-1', secret: 'secret-1' })
    await client.merchant.sales.summary(store_id)

    expect(t.calls).toEqual(['POST /v1/auth/login/api-key', 'GET summary'])
  })

  it('sends no login request when created without apiKey', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(storeAuthTokenFixture())),
      t.summary(),
    )

    await createClient().merchant.sales.summary(STORE)

    expect(t.calls).toEqual(['GET summary'])
    expect(t.summaryAuth).toEqual([''])
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
