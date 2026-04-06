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
