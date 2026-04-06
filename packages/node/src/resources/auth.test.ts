import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, MemoryTokenStorage } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { authTokenFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { createClient } from '../client.js'

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

function makeClient() {
  return createClient()
}

// ---------------------------------------------------------------------------
// auth.signup
// ---------------------------------------------------------------------------

describe('auth.signup', () => {
  it('returns the token response', async () => {
    const fixture = authTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/signup`, () => HttpResponse.json(fixture)))

    const result = await makeClient().auth.signup({
      email: 'user@example.com',
      password: 'correct-horse',
      name: 'Alice',
    })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful signup', async () => {
    const fixture = authTokenFixture({ access_token: 'signup-access-token' })
    server.use(http.post(`${BASE}/v1/auth/signup`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.auth.signup({
      email: 'user@example.com',
      password: 'correct-horse',
      name: 'Alice',
    })

    expect(storage.getTokens()?.accessToken).toBe('signup-access-token')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/signup`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Account already exists'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().auth.signup({ email: 'x@x.com', password: 'y', name: 'X' }),
    ).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// auth.loginWithEmail
// ---------------------------------------------------------------------------

describe('auth.loginWithEmail', () => {
  it('returns the token response', async () => {
    const fixture = authTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/login/email`, () => HttpResponse.json(fixture)))

    const result = await makeClient().auth.loginWithEmail({
      email: 'user@example.com',
      password: 'secret',
    })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful login', async () => {
    const fixture = authTokenFixture({ access_token: 'email-login-access-token' })
    server.use(http.post(`${BASE}/v1/auth/login/email`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.auth.loginWithEmail({ email: 'user@example.com', password: 'secret' })

    expect(storage.getTokens()?.accessToken).toBe('email-login-access-token')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/email`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid email or password'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().auth.loginWithEmail({ email: 'x@x.com', password: 'wrong' }),
    ).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// auth.loginWithGoogle
// ---------------------------------------------------------------------------

describe('auth.loginWithGoogle', () => {
  it('returns the token response', async () => {
    const fixture = authTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/login/google`, () => HttpResponse.json(fixture)))

    const result = await makeClient().auth.loginWithGoogle({ id_token: 'google-id-token' })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful login', async () => {
    const fixture = authTokenFixture({ access_token: 'google-login-access-token' })
    server.use(http.post(`${BASE}/v1/auth/login/google`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.auth.loginWithGoogle({ id_token: 'google-id-token' })

    expect(storage.getTokens()?.accessToken).toBe('google-login-access-token')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/google`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid or expired token'), { status: 401 }),
      ),
    )

    await expect(makeClient().auth.loginWithGoogle({ id_token: 'expired-token' })).rejects.toThrow(
      AuthError,
    )
  })
})

// ---------------------------------------------------------------------------
// auth.loginWithApiKey
// ---------------------------------------------------------------------------

describe('auth.loginWithApiKey', () => {
  it('returns the token response', async () => {
    const fixture = authTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/login/api-key`, () => HttpResponse.json(fixture)))

    const result = await makeClient().auth.loginWithApiKey({ key: 'my-api-key' })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful login', async () => {
    const fixture = authTokenFixture({ access_token: 'api-key-access-token' })
    server.use(http.post(`${BASE}/v1/auth/login/api-key`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.auth.loginWithApiKey({ key: 'my-api-key', secret: 'my-api-secret' })

    expect(storage.getTokens()?.accessToken).toBe('api-key-access-token')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/api-key`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Invalid API key'), { status: 401 }),
      ),
    )

    await expect(makeClient().auth.loginWithApiKey({ key: 'bad-key' })).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// auth.loginWithBuyerApiKey
// ---------------------------------------------------------------------------

describe('auth.loginWithBuyerApiKey', () => {
  it('returns the token response', async () => {
    const fixture = authTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/login/buyer-api-key`, () => HttpResponse.json(fixture)))

    const result = await makeClient().auth.loginWithBuyerApiKey({
      key: 'bktst_abc123',
      secret: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful authentication', async () => {
    const fixture = authTokenFixture({ access_token: 'buyer-key-access-token' })
    server.use(http.post(`${BASE}/v1/auth/login/buyer-api-key`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.auth.loginWithBuyerApiKey({
      key: 'bktst_abc123',
      secret: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    })

    expect(storage.getTokens()?.accessToken).toBe('buyer-key-access-token')
  })

  it('throws AuthError on 401 (invalid key or secret)', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/buyer-api-key`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Invalid key or secret'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().auth.loginWithBuyerApiKey({ key: 'bad', secret: 'bad' }),
    ).rejects.toThrow(AuthError)
  })
})
