import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { authTokenFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { init } from '../client.js'

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
  return init({ apiKey: 'test-api-key' })
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
    const fixture = authTokenFixture({ access_token: 'signup-stored-token' })
    server.use(http.post(`${BASE}/v1/auth/signup`, () => HttpResponse.json(fixture)))

    const client = makeClient()
    await client.auth.signup({
      email: 'user@example.com',
      password: 'correct-horse',
      name: 'Alice',
    })

    await expect(client._tokenManager.getAccessToken()).resolves.toBe('signup-stored-token')
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
    const fixture = authTokenFixture({ access_token: 'email-login-token' })
    server.use(http.post(`${BASE}/v1/auth/login/email`, () => HttpResponse.json(fixture)))

    const client = makeClient()
    await client.auth.loginWithEmail({ email: 'user@example.com', password: 'secret' })

    await expect(client._tokenManager.getAccessToken()).resolves.toBe('email-login-token')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/email`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid credentials'), { status: 401 }),
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

    const result = await makeClient().auth.loginWithGoogle({ id_token: 'google-token' })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after Google login', async () => {
    const fixture = authTokenFixture({ access_token: 'google-login-token' })
    server.use(http.post(`${BASE}/v1/auth/login/google`, () => HttpResponse.json(fixture)))

    const client = makeClient()
    await client.auth.loginWithGoogle({ id_token: 'google-token' })

    await expect(client._tokenManager.getAccessToken()).resolves.toBe('google-login-token')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/google`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid Google token'), { status: 401 }),
      ),
    )

    await expect(makeClient().auth.loginWithGoogle({ id_token: 'bad-token' })).rejects.toThrow(
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

    const result = await makeClient().auth.loginWithApiKey({ key: 'test-api-key' })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful login', async () => {
    const fixture = authTokenFixture({ access_token: 'api-key-token' })
    server.use(http.post(`${BASE}/v1/auth/login/api-key`, () => HttpResponse.json(fixture)))

    const client = makeClient()
    await client.auth.loginWithApiKey({ key: 'test-api-key' })

    await expect(client._tokenManager.getAccessToken()).resolves.toBe('api-key-token')
  })

  it('sends key and secret when both are provided', async () => {
    let capturedBody: unknown = null
    const fixture = authTokenFixture()
    server.use(
      http.post(`${BASE}/v1/auth/login/api-key`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().auth.loginWithApiKey({ key: 'my-key', secret: 'my-secret' })

    expect(capturedBody).toEqual({ key: 'my-key', secret: 'my-secret' })
  })

  it('sends only key when secret is omitted (view access)', async () => {
    let capturedBody: unknown = null
    const fixture = authTokenFixture()
    server.use(
      http.post(`${BASE}/v1/auth/login/api-key`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().auth.loginWithApiKey({ key: 'my-key' })

    expect(capturedBody).toEqual({ key: 'my-key' })
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/api-key`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid API key'), { status: 401 }),
      ),
    )

    await expect(makeClient().auth.loginWithApiKey({ key: 'bad-key' })).rejects.toThrow(AuthError)
  })
})
