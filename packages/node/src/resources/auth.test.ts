import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, LedewireError, MemoryTokenStorage, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  authTokenFixture,
  errorResponseFixture,
  inviteInfoFixture,
  storeAuthTokenFixture,
} from '@ledewire/core/test-utils'
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
  it('refuses the signup with a 422 naming the invitation and the reason', async () => {
    let captured: unknown
    server.use(
      http.post(`${BASE}/v1/auth/signup`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(
          {
            ...errorResponseFixture(422, 'Invitation not found', 'invitation_not_accepted'),
            reason: 'not_found',
            invitation: 'store',
          },
          { status: 422 },
        )
      }),
    )

    const storage = new MemoryTokenStorage()
    const err = await createClient({ storage })
      .auth.signup({
        email: 'new@example.com',
        password: 'pw',
        name: 'New',
        invitation_token: 'store-invite',
      })
      .catch((e: unknown) => e)

    expect(captured).toMatchObject({ invitation_token: 'store-invite' })
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(422)
    expect((err as LedewireError).type).toBe('invitation_not_accepted')
    expect((err as LedewireError).details).toEqual({ reason: 'not_found', invitation: 'store' })
    expect(storage.getTokens()).toBeNull()
  })

  it('returns the token response', async () => {
    const fixture = authTokenFixture()
    server.use(
      http.post(`${BASE}/v1/auth/signup`, () => HttpResponse.json(fixture, { status: 201 })),
    )

    const result = await makeClient().auth.signup({
      email: 'user@example.com',
      password: 'correct-horse',
      name: 'Alice',
    })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful signup', async () => {
    const fixture = authTokenFixture({ access_token: 'signup-access-token' })
    server.use(
      http.post(`${BASE}/v1/auth/signup`, () => HttpResponse.json(fixture, { status: 201 })),
    )

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
  it('sends invitation tokens and returns the per-invitation outcomes', async () => {
    const fixture = {
      ...authTokenFixture(),
      invitations: {
        company: {
          accepted: false,
          reason: 'already_in_company' as const,
          message: 'Leave your current Company first',
        },
      },
    }
    let captured: unknown
    server.use(
      http.post(`${BASE}/v1/auth/login/google`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    const result = await makeClient().auth.loginWithGoogle({
      id_token: 'google-id-token',
      company_invitation_token: 'company-invite',
    })

    expect(captured).toEqual({
      id_token: 'google-id-token',
      company_invitation_token: 'company-invite',
    })
    expect(result.invitations?.company?.accepted).toBe(false)
    expect(result.invitations?.company?.reason).toBe('already_in_company')
  })

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
    const fixture = storeAuthTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/login/api-key`, () => HttpResponse.json(fixture)))

    const result = await makeClient().auth.loginWithApiKey({ key: 'my-api-key' })

    expect(result).toEqual(fixture)
  })

  it('resolves with the store_id the API returned, not one read from the token', async () => {
    // The access token is opaque: store_id can only come from the response body.
    const fixture = storeAuthTokenFixture({
      access_token: 'opaque-not-a-jwt',
      store_id: 'store-from-response',
    })
    server.use(http.post(`${BASE}/v1/auth/login/api-key`, () => HttpResponse.json(fixture)))

    const { store_id } = await makeClient().auth.loginWithApiKey({ key: 'k', secret: 's' })

    expect(store_id).toBe('store-from-response')
  })

  it('stores the store_id alongside the tokens as storeId', async () => {
    const fixture = storeAuthTokenFixture({ store_id: 'store-from-response' })
    server.use(http.post(`${BASE}/v1/auth/login/api-key`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    await createClient({ storage }).auth.loginWithApiKey({ key: 'k', secret: 's' })

    expect(storage.getTokens()?.storeId).toBe('store-from-response')
  })

  it('stores tokens automatically after successful login', async () => {
    const fixture = storeAuthTokenFixture({ access_token: 'api-key-access-token' })
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

// ---------------------------------------------------------------------------
// auth.requestPasswordReset
// ---------------------------------------------------------------------------

describe('auth.requestPasswordReset', () => {
  it('returns confirmation message', async () => {
    const fixture = {
      message: 'If an account with this email exists, a reset code has been sent.',
    }
    server.use(
      http.post(`${BASE}/v1/auth/password/reset-request`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().auth.requestPasswordReset({ email: 'user@example.com' })

    expect(result).toEqual(fixture)
    expect(result.message).toContain('reset code')
  })

  it('sends the email in the request body', async () => {
    let capturedEmail = ''
    server.use(
      http.post(`${BASE}/v1/auth/password/reset-request`, async ({ request }) => {
        const body = await request.json()
        capturedEmail = (body as { email: string }).email
        return HttpResponse.json({ message: 'ok' })
      }),
    )

    await makeClient().auth.requestPasswordReset({ email: 'test@example.com' })

    expect(capturedEmail).toBe('test@example.com')
  })

  it('does not store tokens (password reset does not authenticate)', async () => {
    const fixture = { message: 'ok' }
    server.use(
      http.post(`${BASE}/v1/auth/password/reset-request`, () => HttpResponse.json(fixture)),
    )

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.auth.requestPasswordReset({ email: 'user@example.com' })

    expect(storage.getTokens()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// auth.resetPassword
// ---------------------------------------------------------------------------

describe('auth.resetPassword', () => {
  it('returns confirmation message', async () => {
    const fixture = { message: 'Password has been successfully reset.' }
    server.use(http.post(`${BASE}/v1/auth/password/reset`, () => HttpResponse.json(fixture)))

    const result = await makeClient().auth.resetPassword({
      email: 'user@example.com',
      reset_code: '123456',
      password: 'new-password',
    })

    expect(result).toEqual(fixture)
    expect(result.message).toContain('successfully reset')
  })

  it('sends all required fields in the request body', async () => {
    let capturedBody: { email: string; reset_code: string; password: string } | null = null
    server.use(
      http.post(`${BASE}/v1/auth/password/reset`, async ({ request }) => {
        capturedBody = (await request.json()) as {
          email: string
          reset_code: string
          password: string
        }
        return HttpResponse.json({ message: 'ok' })
      }),
    )

    await makeClient().auth.resetPassword({
      email: 'test@example.com',
      reset_code: '654321',
      password: 'new-secure-password',
    })

    expect(capturedBody).toEqual({
      email: 'test@example.com',
      reset_code: '654321',
      password: 'new-secure-password',
    })
  })

  it('does not store tokens (password reset does not authenticate)', async () => {
    const fixture = { message: 'ok' }
    server.use(http.post(`${BASE}/v1/auth/password/reset`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.auth.resetPassword({
      email: 'user@example.com',
      reset_code: '123456',
      password: 'new-password',
    })

    expect(storage.getTokens()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// auth.getInviteInfo
// ---------------------------------------------------------------------------

describe('auth.getInviteInfo', () => {
  const URL_PATTERN = `${BASE}/v1/auth/invite-info/:token`

  it('returns the pending store invitation', async () => {
    const fixture = inviteInfoFixture({ role: 'owner' })
    server.use(http.get(URL_PATTERN, () => HttpResponse.json(fixture)))

    await expect(makeClient().auth.getInviteInfo('invite-token')).resolves.toEqual(fixture)
  })

  it('sends no Authorization header, even with a session stored', async () => {
    let authHeader: string | null = 'unset'
    server.use(
      http.get(URL_PATTERN, ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json(inviteInfoFixture())
      }),
    )
    const storage = new MemoryTokenStorage()
    storage.setTokens({
      accessToken: 'live-access',
      refreshToken: 'live-refresh',
      expiresAt: Date.now() + 60 * 60 * 1000,
    })

    await createClient({ storage }).auth.getInviteInfo('invite-token')

    expect(authHeader).toBeNull()
  })

  it('percent-encodes the token', async () => {
    let capturedPath = ''
    server.use(
      http.get(URL_PATTERN, ({ request }) => {
        capturedPath = new URL(request.url).pathname
        return HttpResponse.json(inviteInfoFixture())
      }),
    )

    await makeClient().auth.getInviteInfo('a/b')

    expect(capturedPath).toBe('/v1/auth/invite-info/a%2Fb')
  })

  it('throws NotFoundError when no invitation has this token (404)', async () => {
    server.use(
      http.get(URL_PATTERN, () =>
        HttpResponse.json(errorResponseFixture(404, 'Invitation not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().auth.getInviteInfo('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws a 409 LedewireError when the invitation was already accepted', async () => {
    server.use(
      http.get(URL_PATTERN, () =>
        HttpResponse.json(errorResponseFixture(409, 'Invitation already accepted'), {
          status: 409,
        }),
      ),
    )

    const err = await makeClient()
      .auth.getInviteInfo('used')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(409)
  })

  it('throws a 410 LedewireError when the invitation has expired', async () => {
    server.use(
      http.get(URL_PATTERN, () =>
        HttpResponse.json(errorResponseFixture(410, 'Invitation has expired'), { status: 410 }),
      ),
    )

    const err = await makeClient()
      .auth.getInviteInfo('old')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(410)
    expect((err as LedewireError).message).toBe('Invitation has expired')
  })
})
