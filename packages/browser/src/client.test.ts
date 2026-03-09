import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { authTokenFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { MemoryTokenStorage } from '@ledewire/core'
import { init } from './client.js'

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
// init — wiring and options
// ---------------------------------------------------------------------------

describe('init', () => {
  it('returns a BrowserClient with all namespaces', () => {
    const client = init({ apiKey: 'test-api-key' })

    expect(client.auth).toBeDefined()
    expect(client.checkout).toBeDefined()
    expect(client.wallet).toBeDefined()
    expect(client.purchases).toBeDefined()
    expect(client.content).toBeDefined()
  })

  it('uses the default production base URL', async () => {
    let capturedUrl = ''
    server.use(
      http.post(`${BASE}/v1/auth/login/email`, ({ request }) => {
        capturedUrl = new URL(request.url).origin
        return HttpResponse.json(authTokenFixture())
      }),
    )

    await init({ apiKey: 'test-api-key' }).auth.loginWithEmail({
      email: 'u@example.com',
      password: 'pw',
    })

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

    await init({ apiKey: 'test-api-key', baseUrl: STAGING }).auth.loginWithEmail({
      email: 'u@example.com',
      password: 'pw',
    })

    expect(capturedUrl).toBe(STAGING)
  })

  it('uses a provided custom storage implementation', async () => {
    const storage = new MemoryTokenStorage()
    server.use(
      http.post(`${BASE}/v1/auth/login/email`, () =>
        HttpResponse.json(authTokenFixture({ access_token: 'storage-token' })),
      ),
    )

    const client = init({ apiKey: 'test-api-key', storage })
    await client.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })

    expect(storage.getTokens()?.accessToken).toBe('storage-token')
  })
})

// ---------------------------------------------------------------------------
// init — refreshFn bridge
// ---------------------------------------------------------------------------

describe('init refreshFn', () => {
  it('refreshes an expired token via POST /v1/auth/token/refresh', async () => {
    const expiredTokens = authTokenFixture({
      access_token: 'expired-access',
      refresh_token: 'valid-refresh',
      expires_at: '2000-01-01T00:00:00Z',
    })
    const refreshed = authTokenFixture({
      access_token: 'refreshed-access',
      refresh_token: 'new-refresh',
    })

    server.use(
      http.post(`${BASE}/v1/auth/login/email`, () => HttpResponse.json(expiredTokens)),
      http.post(`${BASE}/v1/auth/token/refresh`, () => HttpResponse.json(refreshed)),
    )

    const client = init({ apiKey: 'test-api-key' })
    await client.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })

    const token = await client._tokenManager.getAccessToken()
    expect(token).toBe('refreshed-access')
  })

  it('fires onAuthExpired when a 401 is received with no stored tokens', async () => {
    const onAuthExpired = vi.fn()

    server.use(
      http.get(`${BASE}/v1/wallet/balance`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    const client = init({ apiKey: 'test-api-key', onAuthExpired })
    await expect(client._http.get('/v1/wallet/balance')).rejects.toThrow()
    expect(onAuthExpired).toHaveBeenCalledOnce()
  })
})
