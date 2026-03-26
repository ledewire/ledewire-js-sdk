import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, MemoryTokenStorage } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  merchantTokenFixture,
  merchantLoginStoreFixture,
  manageableStoreFixture,
  errorResponseFixture,
} from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

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
// merchant.auth.loginWithEmail
// ---------------------------------------------------------------------------

describe('merchant.auth.loginWithEmail', () => {
  it('returns the merchant token response', async () => {
    const fixture = merchantTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/merchant/login/email`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.auth.loginWithEmail({
      email: 'owner@example.com',
      password: 'password123',
    })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful login', async () => {
    const fixture = merchantTokenFixture({ access_token: 'merchant-email-token' })
    server.use(http.post(`${BASE}/v1/auth/merchant/login/email`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.merchant.auth.loginWithEmail({ email: 'owner@example.com', password: 'pw' })

    expect(storage.getTokens()?.accessToken).toBe('merchant-email-token')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/login/email`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid credentials'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().merchant.auth.loginWithEmail({ email: 'x@x.com', password: 'bad' }),
    ).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403 (account exists but has no store access)', async () => {
    const message = 'This account does not have merchant access. Use a merchant or owner account.'
    server.use(
      http.post(`${BASE}/v1/auth/merchant/login/email`, () =>
        HttpResponse.json(errorResponseFixture(403, message), { status: 403 }),
      ),
    )

    const err = await makeClient()
      .merchant.auth.loginWithEmail({ email: 'buyer@example.com', password: 'pw' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ForbiddenError)
    expect((err as ForbiddenError).message).toBe(message)
    expect((err as ForbiddenError).statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// merchant.auth.loginWithGoogle
// ---------------------------------------------------------------------------

describe('merchant.auth.loginWithGoogle', () => {
  it('returns the merchant token response', async () => {
    const fixture = merchantTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/merchant/login/google`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.auth.loginWithGoogle({ id_token: 'google-jwt' })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful login', async () => {
    const fixture = merchantTokenFixture({ access_token: 'merchant-google-token' })
    server.use(http.post(`${BASE}/v1/auth/merchant/login/google`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.merchant.auth.loginWithGoogle({ id_token: 'google-jwt' })

    expect(storage.getTokens()?.accessToken).toBe('merchant-google-token')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/login/google`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid token'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().merchant.auth.loginWithGoogle({ id_token: 'bad-token' }),
    ).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403 (buyer account authenticated via Google — no store access)', async () => {
    const message = 'This account does not have merchant access. Use a merchant or owner account.'
    server.use(
      http.post(`${BASE}/v1/auth/merchant/login/google`, () =>
        HttpResponse.json(errorResponseFixture(403, message), { status: 403 }),
      ),
    )

    const err = await makeClient()
      .merchant.auth.loginWithGoogle({ id_token: 'buyer-google-jwt' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ForbiddenError)
    expect((err as ForbiddenError).message).toBe(message)
    expect((err as ForbiddenError).statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// merchant.auth.listStores
// ---------------------------------------------------------------------------

describe('merchant.auth.listStores', () => {
  it('returns the list of manageable stores', async () => {
    const fixture = [manageableStoreFixture(), manageableStoreFixture({ id: 'store-id-2' })]
    server.use(http.get(`${BASE}/v1/auth/merchant/stores`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.auth.listStores()

    expect(result).toEqual(fixture)
    expect(result).toHaveLength(2)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/auth/merchant/stores`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.auth.listStores()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// merchant.auth.loginWithEmailAndListStores
// ---------------------------------------------------------------------------

describe('merchant.auth.loginWithEmailAndListStores', () => {
  it('returns tokens and embedded stores in a single HTTP call', async () => {
    const loginStore = merchantLoginStoreFixture()
    const tokenFixture = merchantTokenFixture({ stores: [loginStore] })
    server.use(
      http.post(`${BASE}/v1/auth/merchant/login/email`, () => HttpResponse.json(tokenFixture)),
    )

    const result = await makeClient().merchant.auth.loginWithEmailAndListStores({
      email: 'owner@example.com',
      password: 'password123',
    })

    expect(result.tokens).toEqual({
      accessToken: tokenFixture.access_token,
      refreshToken: tokenFixture.refresh_token,
      expiresAt: new Date(tokenFixture.expires_at).getTime(),
    })
    expect(result.stores).toEqual([loginStore])
  })

  it('stores tokens automatically', async () => {
    const tokenFixture = merchantTokenFixture({ access_token: 'combo-email-token' })
    server.use(
      http.post(`${BASE}/v1/auth/merchant/login/email`, () => HttpResponse.json(tokenFixture)),
    )

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.merchant.auth.loginWithEmailAndListStores({
      email: 'owner@example.com',
      password: 'password123',
    })

    expect(storage.getTokens()?.accessToken).toBe('combo-email-token')
  })
})

// ---------------------------------------------------------------------------
// merchant.auth.loginWithGoogleAndListStores
// ---------------------------------------------------------------------------

describe('merchant.auth.loginWithGoogleAndListStores', () => {
  it('returns tokens and embedded stores in a single HTTP call', async () => {
    const loginStores = [
      merchantLoginStoreFixture(),
      merchantLoginStoreFixture({ id: 'store-2', name: 'Second Store' }),
    ]
    const tokenFixture = merchantTokenFixture({ stores: loginStores })
    server.use(
      http.post(`${BASE}/v1/auth/merchant/login/google`, () => HttpResponse.json(tokenFixture)),
    )

    const result = await makeClient().merchant.auth.loginWithGoogleAndListStores({
      id_token: 'google-jwt',
    })

    expect(result.tokens).toEqual({
      accessToken: tokenFixture.access_token,
      refreshToken: tokenFixture.refresh_token,
      expiresAt: new Date(tokenFixture.expires_at).getTime(),
    })
    expect(result.stores).toHaveLength(2)
  })

  it('stores tokens automatically', async () => {
    const tokenFixture = merchantTokenFixture({ access_token: 'combo-google-token' })
    server.use(
      http.post(`${BASE}/v1/auth/merchant/login/google`, () => HttpResponse.json(tokenFixture)),
    )

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.merchant.auth.loginWithGoogleAndListStores({ id_token: 'google-jwt' })

    expect(storage.getTokens()?.accessToken).toBe('combo-google-token')
  })
})

// ---------------------------------------------------------------------------
// merchant.auth.requestPasswordReset
// ---------------------------------------------------------------------------

describe('merchant.auth.requestPasswordReset', () => {
  const successBody = {
    message: 'If an account with this email exists, a reset code has been sent.',
  }

  it('returns the confirmation message', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset-request`, () =>
        HttpResponse.json(successBody),
      ),
    )

    const result = await makeClient().merchant.auth.requestPasswordReset({
      email: 'owner@example.com',
    })

    expect(result).toEqual(successBody)
  })

  it('sends the email in the request body', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset-request`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(successBody)
      }),
    )

    await makeClient().merchant.auth.requestPasswordReset({ email: 'owner@example.com' })

    expect(capturedBody).toEqual({ email: 'owner@example.com' })
  })

  it('does not store tokens', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset-request`, () =>
        HttpResponse.json(successBody),
      ),
    )

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.merchant.auth.requestPasswordReset({ email: 'owner@example.com' })

    expect(storage.getTokens()).toBeNull()
  })

  it('throws on 400 (invalid email format)', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset-request`, () =>
        HttpResponse.json(errorResponseFixture(400, 'email must be a valid email address'), {
          status: 400,
        }),
      ),
    )

    await expect(
      makeClient().merchant.auth.requestPasswordReset({ email: 'not-an-email' }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// merchant.auth.resetPassword
// ---------------------------------------------------------------------------

describe('merchant.auth.resetPassword', () => {
  const successBody = { message: 'Password has been successfully reset.' }
  const validBody = {
    email: 'owner@example.com',
    reset_code: '246810',
    password: 'new-secure-password',
  }

  it('returns the confirmation message', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset`, () => HttpResponse.json(successBody)),
    )

    const result = await makeClient().merchant.auth.resetPassword(validBody)

    expect(result).toEqual(successBody)
  })

  it('sends all required fields in the request body', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(successBody)
      }),
    )

    await makeClient().merchant.auth.resetPassword(validBody)

    expect(capturedBody).toEqual(validBody)
  })

  it('does not store tokens', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset`, () => HttpResponse.json(successBody)),
    )

    const storage = new MemoryTokenStorage()
    const client = createClient({ storage })
    await client.merchant.auth.resetPassword(validBody)

    expect(storage.getTokens()).toBeNull()
  })

  it('throws on 400 (invalid or expired code)', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset`, () =>
        HttpResponse.json(errorResponseFixture(400, 'Invalid or expired reset code'), {
          status: 400,
        }),
      ),
    )

    await expect(makeClient().merchant.auth.resetPassword(validBody)).rejects.toThrow()
  })

  it('throws on 404 (user not found)', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/merchant/password/reset`, () =>
        HttpResponse.json(errorResponseFixture(404, 'User not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().merchant.auth.resetPassword(validBody)).rejects.toThrow()
  })
})
