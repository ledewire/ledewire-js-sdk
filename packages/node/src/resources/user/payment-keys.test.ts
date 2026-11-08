import { generateKeyPairSync, sign, verify } from 'node:crypto'
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, LedewireError, NotFoundError } from '@ledewire/core'
import {
  createTestServer,
  errorResponseFixture,
  http,
  HttpResponse,
  paymentKeyFixture,
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

// ---------------------------------------------------------------------------
// The documented recipe: public_key and proof from Node's crypto
// ---------------------------------------------------------------------------

describe('user.paymentKeys.create JSDoc recipe', () => {
  it('builds a public_key and proof that verify over ledewire-payment-key: + public_key', async () => {
    // Exactly as the JSDoc example on UserPaymentKeysNamespace.create does it.
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const public_key = publicKey
      .export({ type: 'spki', format: 'der' })
      .subarray(-32)
      .toString('base64url')
    const message = Buffer.from(`ledewire-payment-key:${public_key}`, 'ascii')
    const proof = sign(null, message, privateKey).toString('base64url')

    // Unpadded base64url of 32 and 64 bytes.
    expect(public_key).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(proof).toMatch(/^[A-Za-z0-9_-]{86}$/)
    // The 32 bytes are the raw key: the same as the JWK `x`.
    expect(public_key).toBe(publicKey.export({ format: 'jwk' }).x)
    // The proof verifies over the ASCII bytes the API checks.
    expect(
      verify(
        null,
        Buffer.from('ledewire-payment-key:' + public_key, 'ascii'),
        publicKey,
        Buffer.from(proof, 'base64url'),
      ),
    ).toBe(true)

    let captured: unknown
    server.use(
      http.post(`${BASE}/v1/user/payment-keys`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(paymentKeyFixture({ public_key }), { status: 201 })
      }),
    )
    const key = await makeClient().user.paymentKeys.create({
      name: 'research-agent',
      public_key,
      proof,
    })

    expect(captured).toEqual({ name: 'research-agent', public_key, proof })
    expect(key.public_key).toBe(public_key)
  })
})

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
