import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, MemoryTokenStorage } from '@ledewire/core'
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

    const storage = new MemoryTokenStorage()
    const client = init({ apiKey: 'test-api-key', storage })
    await client.auth.signup({
      email: 'user@example.com',
      password: 'correct-horse',
      name: 'Alice',
    })

    expect(storage.getTokens()?.accessToken).toBe('signup-stored-token')
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

    const storage = new MemoryTokenStorage()
    const client = init({ apiKey: 'test-api-key', storage })
    await client.auth.loginWithEmail({ email: 'user@example.com', password: 'secret' })

    expect(storage.getTokens()?.accessToken).toBe('email-login-token')
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

    const storage = new MemoryTokenStorage()
    const client = init({ apiKey: 'test-api-key', storage })
    await client.auth.loginWithGoogle({ id_token: 'google-token' })

    expect(storage.getTokens()?.accessToken).toBe('google-login-token')
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
// auth.requestPasswordReset
// ---------------------------------------------------------------------------

describe('auth.requestPasswordReset', () => {
  const successBody = {
    data: { message: 'If an account with this email exists, a reset code has been sent.' },
  }

  it('returns the confirmation message', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/password/reset-request`, () => HttpResponse.json(successBody)),
    )

    const result = await makeClient().auth.requestPasswordReset({ email: 'buyer@example.com' })

    expect(result).toEqual(successBody)
  })

  it('sends the email in the request body', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/auth/password/reset-request`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(successBody)
      }),
    )

    await makeClient().auth.requestPasswordReset({ email: 'buyer@example.com' })

    expect(capturedBody).toEqual({ email: 'buyer@example.com' })
  })

  it('does not store tokens', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/password/reset-request`, () => HttpResponse.json(successBody)),
    )

    const storage = new MemoryTokenStorage()
    const client = init({ apiKey: 'test-api-key', storage })
    await client.auth.requestPasswordReset({ email: 'buyer@example.com' })

    expect(storage.getTokens()).toBeNull()
  })

  it('throws on 400 (invalid email)', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/password/reset-request`, () =>
        HttpResponse.json(errorResponseFixture(400, 'email must be a valid email address'), {
          status: 400,
        }),
      ),
    )

    await expect(
      makeClient().auth.requestPasswordReset({ email: 'not-an-email' }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// auth.resetPassword
// ---------------------------------------------------------------------------

describe('auth.resetPassword', () => {
  const successBody = { data: { message: 'Password has been successfully reset.' } }
  const validBody = { email: 'buyer@example.com', reset_code: '123456', password: 'new-pass-word' }

  it('returns the confirmation message', async () => {
    server.use(http.post(`${BASE}/v1/auth/password/reset`, () => HttpResponse.json(successBody)))

    const result = await makeClient().auth.resetPassword(validBody)

    expect(result).toEqual(successBody)
  })

  it('sends all required fields in the request body', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/auth/password/reset`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(successBody)
      }),
    )

    await makeClient().auth.resetPassword(validBody)

    expect(capturedBody).toEqual(validBody)
  })

  it('does not store tokens', async () => {
    server.use(http.post(`${BASE}/v1/auth/password/reset`, () => HttpResponse.json(successBody)))

    const storage = new MemoryTokenStorage()
    const client = init({ apiKey: 'test-api-key', storage })
    await client.auth.resetPassword(validBody)

    expect(storage.getTokens()).toBeNull()
  })

  it('throws on 400 (invalid or expired code)', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/password/reset`, () =>
        HttpResponse.json(errorResponseFixture(400, 'Invalid or expired reset code'), {
          status: 400,
        }),
      ),
    )

    await expect(makeClient().auth.resetPassword(validBody)).rejects.toThrow()
  })

  it('throws on 404 (user not found)', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/password/reset`, () =>
        HttpResponse.json(errorResponseFixture(404, 'User not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().auth.resetPassword(validBody)).rejects.toThrow()
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
    const client = init({ apiKey: 'test-api-key', storage })
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
