import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
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

    const client = makeClient()
    await client.merchant.auth.loginWithEmail({ email: 'owner@example.com', password: 'pw' })

    await expect(client._tokenManager.getAccessToken()).resolves.toBe('merchant-email-token')
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

    const client = makeClient()
    await client.merchant.auth.loginWithGoogle({ id_token: 'google-jwt' })

    await expect(client._tokenManager.getAccessToken()).resolves.toBe('merchant-google-token')
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

    const client = makeClient()
    await client.merchant.auth.loginWithEmailAndListStores({
      email: 'owner@example.com',
      password: 'password123',
    })

    await expect(client._tokenManager.getAccessToken()).resolves.toBe('combo-email-token')
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

    const client = makeClient()
    await client.merchant.auth.loginWithGoogleAndListStores({ id_token: 'google-jwt' })

    await expect(client._tokenManager.getAccessToken()).resolves.toBe('combo-google-token')
  })
})
