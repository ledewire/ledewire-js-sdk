import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, LedewireError, NotFoundError } from '@ledewire/core'
import {
  createTestServer,
  errorResponseFixture,
  http,
  HttpResponse,
  paymentKeyFixture,
} from '@ledewire/core/test-utils'
import { init } from '../../client.js'

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

const body = {
  name: 'research-agent',
  public_key: '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo',
  proof: 'p'.repeat(86),
}

// ---------------------------------------------------------------------------
// user.paymentKeys.list
// ---------------------------------------------------------------------------

describe('user.paymentKeys.list', () => {
  it('sends GET /v1/user/payment-keys and returns the bare array', async () => {
    const keys = [paymentKeyFixture(), paymentKeyFixture({ id: 'payment-key-id-2' })]
    let method: string | undefined
    server.use(
      http.get(`${BASE}/v1/user/payment-keys`, ({ request }) => {
        method = request.method
        return HttpResponse.json(keys)
      }),
    )

    const result = await makeClient().user.paymentKeys.list()

    expect(method).toBe('GET')
    expect(result).toEqual(keys)
  })

  it('throws ForbiddenError when the token is not a buyer token', async () => {
    server.use(
      http.get(`${BASE}/v1/user/payment-keys`, () =>
        HttpResponse.json(errorResponseFixture(403, 'Invalid Role'), { status: 403 }),
      ),
    )

    await expect(makeClient().user.paymentKeys.list()).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// user.paymentKeys.create
// ---------------------------------------------------------------------------

describe('user.paymentKeys.create', () => {
  it('sends POST /v1/user/payment-keys with the name, public key and proof', async () => {
    const created = paymentKeyFixture()
    let method: string | undefined
    let captured: unknown
    server.use(
      http.post(`${BASE}/v1/user/payment-keys`, async ({ request }) => {
        method = request.method
        captured = await request.json()
        return HttpResponse.json(created, { status: 201 })
      }),
    )

    const result = await makeClient().user.paymentKeys.create(body)

    expect(method).toBe('POST')
    expect(captured).toEqual(body)
    expect(result).toEqual(created)
    expect(result).not.toHaveProperty('secret')
  })

  it('surfaces an invalid proof, malformed or duplicate key as a 422', async () => {
    server.use(
      http.post(`${BASE}/v1/user/payment-keys`, () =>
        HttpResponse.json(errorResponseFixture(422, 'Proof is not a valid signature by this key'), {
          status: 422,
        }),
      ),
    )

    const err = await makeClient()
      .user.paymentKeys.create(body)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(422)
  })

  it('throws ForbiddenError when the caller is a Machine user', async () => {
    server.use(
      http.post(`${BASE}/v1/user/payment-keys`, () =>
        HttpResponse.json(errorResponseFixture(403, 'Machine users cannot manage their own keys'), {
          status: 403,
        }),
      ),
    )

    await expect(makeClient().user.paymentKeys.create(body)).rejects.toThrow(ForbiddenError)
  })
})

// The documented Node `crypto` recipe for public_key and proof is exercised in
// @ledewire/node's copy of this file; jsdom has no `node:crypto`.

// ---------------------------------------------------------------------------
// user.paymentKeys.revoke
// ---------------------------------------------------------------------------

describe('user.paymentKeys.revoke', () => {
  it('sends DELETE /v1/user/payment-keys/{id} and resolves without a value on 204', async () => {
    let method: string | undefined
    server.use(
      http.delete(`${BASE}/v1/user/payment-keys/payment-key-id-1`, ({ request }) => {
        method = request.method
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(makeClient().user.paymentKeys.revoke('payment-key-id-1')).resolves.toBeUndefined()
    expect(method).toBe('DELETE')
  })

  it('encodes the id as one path segment', async () => {
    let pathname: string | undefined
    server.use(
      http.delete(`${BASE}/v1/user/payment-keys/:id`, ({ request }) => {
        pathname = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await makeClient().user.paymentKeys.revoke('a/b?c')

    expect(pathname).toBe('/v1/user/payment-keys/a%2Fb%3Fc')
  })

  it('throws NotFoundError for an unknown or already-revoked key', async () => {
    server.use(
      http.delete(`${BASE}/v1/user/payment-keys/missing`, () =>
        HttpResponse.json(errorResponseFixture(404, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().user.paymentKeys.revoke('missing')).rejects.toThrow(NotFoundError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.delete(`${BASE}/v1/user/payment-keys/payment-key-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().user.paymentKeys.revoke('payment-key-id-1')).rejects.toThrow(
      AuthError,
    )
  })
})
