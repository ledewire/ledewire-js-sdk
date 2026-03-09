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

    server.use(
      // Initial login seeds expired tokens
      http.post(`${BASE}/v1/auth/login/email`, () => HttpResponse.json(expiredTokens)),
      // Refresh endpoint returns fresh tokens
      http.post(`${BASE}/v1/auth/token/refresh`, () => HttpResponse.json(refreshed)),
    )

    const client = createClient()
    await client.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })

    // getAccessToken detects expiry and calls refreshFn
    const token = await client._tokenManager.getAccessToken()
    expect(token).toBe('refreshed-access')
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
    )

    const client = createClient({ onTokenRefreshed })
    await client.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })
    await client._tokenManager.getAccessToken()

    expect(onTokenRefreshed).toHaveBeenCalledOnce()
    expect(onTokenRefreshed).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'refreshed' }),
    )
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
    await expect(client._http.get('/v1/wallet/balance')).rejects.toThrow()
    expect(onAuthExpired).toHaveBeenCalledOnce()
  })
})
