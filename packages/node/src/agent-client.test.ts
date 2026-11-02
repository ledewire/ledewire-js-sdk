import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, MemoryTokenStorage } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { authTokenFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { createAgentClient } from './client.js'

const BASE = 'https://api.ledewire.com'

const BUYER_KEY = 'bktst_abc123'
const BUYER_SECRET = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'

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

function makeAgent() {
  return createAgentClient({ key: BUYER_KEY, secret: BUYER_SECRET })
}

// ---------------------------------------------------------------------------
// createAgentClient — structure
// ---------------------------------------------------------------------------

describe('createAgentClient — namespace shape', () => {
  it('exposes auth, wallet, purchases, content, checkout, and user', () => {
    const agent = makeAgent()

    expect(agent).toHaveProperty('auth')
    expect(agent).toHaveProperty('wallet')
    expect(agent).toHaveProperty('purchases')
    expect(agent).toHaveProperty('content')
    expect(agent).toHaveProperty('checkout')
    expect(agent).toHaveProperty('user')
  })

  it('exposes the buyer bulk-licensing and x402 discovery namespaces', () => {
    const agent = createAgentClient({ key: BUYER_KEY, secret: BUYER_SECRET })

    expect(typeof agent.publications.list).toBe('function')
    expect(typeof agent.acquisitions.create).toBe('function')
    expect(typeof agent.x402.discoverResources).toBe('function')
    expect(typeof agent.user.spendCap.get).toBe('function')
  })

  it('does NOT expose merchant, seller, or config', () => {
    const agent = makeAgent() as Record<string, unknown>

    expect(agent).not.toHaveProperty('merchant')
    expect(agent).not.toHaveProperty('seller')
    expect(agent).not.toHaveProperty('config')
  })

  it('provides user.apiKeys.list, create, revoke', () => {
    const agent = makeAgent()

    expect(typeof agent.user.apiKeys.list).toBe('function')
    expect(typeof agent.user.apiKeys.create).toBe('function')
    expect(typeof agent.user.apiKeys.revoke).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// createAgentClient — auth flow
// ---------------------------------------------------------------------------

describe('createAgentClient — auth.loginWithBuyerApiKey', () => {
  it('authenticates and stores tokens', async () => {
    const fixture = authTokenFixture({ access_token: 'agent-access-token' })
    server.use(http.post(`${BASE}/v1/auth/login/buyer-api-key`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const agent = createAgentClient({ key: BUYER_KEY, secret: BUYER_SECRET, storage })
    await agent.auth.loginWithBuyerApiKey({ key: BUYER_KEY, secret: BUYER_SECRET })

    expect(storage.getTokens()?.accessToken).toBe('agent-access-token')
  })

  it('throws AuthError on invalid credentials', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/buyer-api-key`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Invalid key or secret'), { status: 401 }),
      ),
    )

    await expect(
      makeAgent().auth.loginWithBuyerApiKey({ key: 'bad-key', secret: 'bad-secret' }),
    ).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// createAgentClient — custom storage is honoured
// ---------------------------------------------------------------------------

describe('createAgentClient — storage option', () => {
  it('persists tokens in the provided storage', async () => {
    const fixture = authTokenFixture({ access_token: 'persisted-agent-token' })
    server.use(http.post(`${BASE}/v1/auth/login/buyer-api-key`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const agent = createAgentClient({ key: BUYER_KEY, secret: BUYER_SECRET, storage })
    await agent.auth.loginWithBuyerApiKey({ key: BUYER_KEY, secret: BUYER_SECRET })

    expect(storage.getTokens()?.accessToken).toBe('persisted-agent-token')
  })
})

// ---------------------------------------------------------------------------
// createAgentClient — automatic login with the buyer key
// ---------------------------------------------------------------------------

describe('createAgentClient — automatic login', () => {
  const LOGIN = `${BASE}/v1/auth/login/buyer-api-key`
  const BALANCE = `${BASE}/v1/wallet/balance`

  /** Records every request as `METHOD path` in order, with login bodies and auth headers. */
  function recordTraffic() {
    const calls: string[] = []
    const loginBodies: unknown[] = []
    const balanceAuth: string[] = []
    return {
      calls,
      loginBodies,
      balanceAuth,
      login: (response: () => Response) =>
        http.post(LOGIN, async ({ request }) => {
          calls.push('POST /v1/auth/login/buyer-api-key')
          loginBodies.push(await request.json())
          return response()
        }),
      balance: (response: (attempt: number) => Response = () => HttpResponse.json({})) =>
        http.get(BALANCE, ({ request }) => {
          calls.push('GET balance')
          balanceAuth.push(request.headers.get('Authorization') ?? '')
          return response(balanceAuth.length)
        }),
      refresh: (response: () => Response) =>
        http.post(`${BASE}/v1/auth/token/refresh`, () => {
          calls.push('POST /v1/auth/token/refresh')
          return response()
        }),
    }
  }

  it('logs in with the buyer key and secret before the first authenticated request', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(authTokenFixture({ access_token: 'auto-agent' }))),
      t.balance(),
    )

    await makeAgent().wallet.balance()

    expect(t.calls).toEqual(['POST /v1/auth/login/buyer-api-key', 'GET balance'])
    expect(t.loginBodies).toEqual([{ key: BUYER_KEY, secret: BUYER_SECRET }])
    expect(t.balanceAuth).toEqual(['Bearer auto-agent'])
  })

  it('shares one login between two concurrent first requests', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(authTokenFixture({ access_token: 'shared' }))),
      t.balance(),
    )

    const agent = makeAgent()
    await Promise.all([agent.wallet.balance(), agent.wallet.balance()])

    expect(t.loginBodies).toHaveLength(1)
    expect(t.balanceAuth).toEqual(['Bearer shared', 'Bearer shared'])
  })

  it('logs in again after a failed refresh and retries the request once', async () => {
    const storage = new MemoryTokenStorage()
    storage.setTokens({
      accessToken: 'stale',
      refreshToken: 'dead-refresh',
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    const t = recordTraffic()
    server.use(
      t.balance((attempt) =>
        attempt === 1
          ? HttpResponse.json(errorResponseFixture(1001, 'Token expired'), { status: 401 })
          : HttpResponse.json({}),
      ),
      t.refresh(() =>
        HttpResponse.json(errorResponseFixture(1001, 'Bad refresh'), { status: 401 }),
      ),
      t.login(() => HttpResponse.json(authTokenFixture({ access_token: 'relogged' }))),
    )

    await createAgentClient({ key: BUYER_KEY, secret: BUYER_SECRET, storage }).wallet.balance()

    expect(t.calls).toEqual([
      'GET balance',
      'POST /v1/auth/token/refresh',
      'POST /v1/auth/login/buyer-api-key',
      'GET balance',
    ])
    expect(t.balanceAuth).toEqual(['Bearer stale', 'Bearer relogged'])
  })

  it('rejects the first request with the API message after exactly one login attempt for a wrong key', async () => {
    const t = recordTraffic()
    server.use(
      t.login(() =>
        HttpResponse.json(errorResponseFixture(1003, 'Invalid key or secret'), { status: 401 }),
      ),
      t.balance(),
    )

    const agent = createAgentClient({ key: 'bktst_wrong', secret: 'very-secret-value' })
    const err: unknown = await agent.wallet.balance().catch((e: unknown) => e)

    expect(err).toBeInstanceOf(AuthError)
    expect((err as AuthError).message).toBe('Invalid key or secret')
    expect((err as AuthError).message).not.toContain('very-secret-value')
    expect(t.calls).toEqual(['POST /v1/auth/login/buyer-api-key'])
  })

  it('sends no login request when a token is already stored', async () => {
    const storage = new MemoryTokenStorage()
    storage.setTokens({
      accessToken: 'existing',
      refreshToken: 'r',
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    const t = recordTraffic()
    server.use(
      t.login(() => HttpResponse.json(authTokenFixture())),
      t.balance(),
    )

    await createAgentClient({ key: BUYER_KEY, secret: BUYER_SECRET, storage }).wallet.balance()

    expect(t.calls).toEqual(['GET balance'])
    expect(t.balanceAuth).toEqual(['Bearer existing'])
  })
})
