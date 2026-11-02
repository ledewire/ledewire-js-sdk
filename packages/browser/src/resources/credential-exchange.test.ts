import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { AuthError, MemoryTokenStorage } from '@ledewire/core'
import {
  authTokenFixture,
  createTestServer,
  errorResponseFixture,
  http,
  HttpResponse,
} from '@ledewire/core/test-utils'
import { init } from '../client.js'
import type { BrowserClient } from '../client.js'

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

// Every public credential exchange. A 401 from any of these means the
// credentials were rejected, not that the stored session expired, so none of
// them may send the stored bearer token, refresh it, or retry.
const calls: { path: string; call: (client: BrowserClient) => Promise<unknown> }[] = [
  {
    path: '/v1/auth/login/email',
    call: (c) => c.auth.loginWithEmail({ email: 'x@example.com', password: 'wrong' }),
  },
  { path: '/v1/auth/login/google', call: (c) => c.auth.loginWithGoogle({ id_token: 'bad' }) },
  {
    path: '/v1/auth/login/buyer-api-key',
    call: (c) => c.auth.loginWithBuyerApiKey({ key: 'k', secret: 'wrong' }),
  },
  {
    path: '/v1/auth/signup',
    call: (c) => c.auth.signup({ email: 'x@example.com', password: 'pw', name: 'X' }),
  },
  {
    path: '/v1/auth/password/reset-request',
    call: (c) => c.auth.requestPasswordReset({ email: 'x@example.com' }),
  },
  {
    path: '/v1/auth/password/reset',
    call: (c) =>
      c.auth.resetPassword({ email: 'x@example.com', reset_code: '123456', password: 'pw' }),
  },
]

const MESSAGE = 'Invalid email or password'

/** Storage holding a live session, as when a signed-in user retries a login. */
function storageWithSession(): MemoryTokenStorage {
  const storage = new MemoryTokenStorage()
  storage.setTokens({
    accessToken: 'live-access-token',
    refreshToken: 'live-refresh-token',
    expiresAt: Date.now() + 60 * 60 * 1000,
  })
  return storage
}

/**
 * Answers `path` with a 401 and counts requests to it and to the refresh
 * endpoint, which answers with `refreshStatus`.
 */
function rejectCredentials(path: string, refreshStatus: 200 | 401) {
  const seen = { requests: 0, refreshes: 0, authorization: [] as (string | null)[] }
  server.use(
    http.post(`${BASE}${path}`, ({ request }) => {
      seen.requests++
      seen.authorization.push(request.headers.get('Authorization'))
      return HttpResponse.json(errorResponseFixture(401, MESSAGE), { status: 401 })
    }),
    http.post(`${BASE}/v1/auth/token/refresh`, () => {
      seen.refreshes++
      return refreshStatus === 200
        ? HttpResponse.json(authTokenFixture({ access_token: 'refreshed-token' }))
        : HttpResponse.json(errorResponseFixture(401, 'Invalid refresh token'), { status: 401 })
    }),
  )
  return seen
}

describe.each(calls)('a rejected credential exchange: POST $path', ({ path, call }) => {
  it("rejects with AuthError carrying the API's message when no session is stored", async () => {
    rejectCredentials(path, 200)
    const client = init({ apiKey: 'test-api-key', storage: new MemoryTokenStorage() })
    const err = await call(client).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect(err).toMatchObject({ message: MESSAGE, statusCode: 401, code: 401 })
  })

  it('with a stored session, makes exactly one request with no bearer token and no refresh', async () => {
    const seen = rejectCredentials(path, 200)
    const storage = storageWithSession()
    const err = await call(init({ apiKey: 'test-api-key', storage })).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect((err as AuthError).message).toBe(MESSAGE)
    expect(seen.requests).toBe(1)
    expect(seen.authorization).toEqual([null])
    expect(seen.refreshes).toBe(0)
    expect(storage.getTokens()?.accessToken).toBe('live-access-token')
  })

  it('with a stored session, does not call onAuthExpired or clear the session', async () => {
    rejectCredentials(path, 401)
    const onAuthExpired = vi.fn()
    const storage = storageWithSession()
    const err = await call(init({ apiKey: 'test-api-key', storage, onAuthExpired })).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(AuthError)
    expect(onAuthExpired).not.toHaveBeenCalled()
    expect(storage.getTokens()?.accessToken).toBe('live-access-token')
  })
})

describe('a successful login with a stored session', () => {
  it('replaces the stored tokens', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/email`, () =>
        HttpResponse.json(authTokenFixture({ access_token: 'new-access-token' })),
      ),
    )
    const storage = storageWithSession()
    await init({ apiKey: 'test-api-key', storage }).auth.loginWithEmail({
      email: 'x@example.com',
      password: 'pw',
    })
    expect(storage.getTokens()?.accessToken).toBe('new-access-token')
  })
})
