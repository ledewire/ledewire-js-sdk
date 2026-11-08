import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { AuthError, ForbiddenError, LedewireError, RateLimitError } from '@ledewire/core'
import { createPaymentKeyRegistration, registerPaymentKey } from './payment-keys.js'
import type { PaymentKeyCreateBody } from './payment-keys.js'
import { base64urlDecode } from './encoding.js'
import { derivePublicKey, verifyEd25519 } from './signing.js'
import { API_BASE, PAYMENT_KEY, PUBLIC_KEY } from './x402.test-helpers.js'

const LOGIN_URL = `${API_BASE}/v1/auth/login/buyer-api-key`
const KEYS_URL = `${API_BASE}/v1/user/payment-keys`

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

/** Verifies a registration proof with a real Ed25519 verify. */
async function proofVerifies(body: PaymentKeyCreateBody): Promise<boolean> {
  return verifyEd25519(
    base64urlDecode(body.public_key),
    base64urlDecode(body.proof),
    new TextEncoder().encode(`ledewire-payment-key:${body.public_key}`),
  )
}

/** Serves login and registration, recording each registration request. */
function serveRegistration(): { bodies: unknown[]; authorizations: (string | null)[] } {
  const bodies: unknown[] = []
  const authorizations: (string | null)[] = []
  server.use(
    http.post(LOGIN_URL, () =>
      HttpResponse.json({
        token_type: 'Bearer',
        access_token: 'buyer-jwt',
        refresh_token: 'r',
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
      }),
    ),
    http.post(KEYS_URL, async ({ request }) => {
      const body = (await request.json()) as PaymentKeyCreateBody
      bodies.push(body)
      authorizations.push(request.headers.get('Authorization'))
      return HttpResponse.json(
        {
          id: 'payment-key-uuid',
          name: body.name,
          public_key: body.public_key,
          created_by_user_id: null,
          last_used_at: null,
          created_at: '2026-11-07T00:00:00Z',
        },
        { status: 201 },
      )
    }),
  )
  return { bodies, authorizations }
}

describe('createPaymentKeyRegistration', () => {
  it('builds { name, public_key, proof } whose proof verifies over ledewire-payment-key: + public_key', async () => {
    const { privateKey, body } = await createPaymentKeyRegistration('agent')
    expect(Object.keys(body).sort()).toEqual(['name', 'proof', 'public_key'])
    expect(body.name).toBe('agent')
    expect(base64urlDecode(body.public_key)).toHaveLength(32)
    expect(body.proof).toMatch(/^[A-Za-z0-9_-]{86}$/)
    expect(await proofVerifies(body)).toBe(true)
    expect(await derivePublicKey(privateKey)).toBe(body.public_key)
  })

  it('never puts the private key in the body', async () => {
    const { privateKey, body } = await createPaymentKeyRegistration('agent')
    expect(JSON.stringify(body)).not.toContain(privateKey)
  })

  it('registers an existing key when given one', async () => {
    const { privateKey, body } = await createPaymentKeyRegistration('agent', PAYMENT_KEY.privateKey)
    expect(privateKey).toBe(PAYMENT_KEY.privateKey)
    expect(body.public_key).toBe(PUBLIC_KEY)
    expect(await proofVerifies(body)).toBe(true)
  })

  it('a proof does not verify against another key', async () => {
    const a = await createPaymentKeyRegistration('a')
    const b = await createPaymentKeyRegistration('b')
    expect(await proofVerifies({ ...a.body, public_key: b.body.public_key })).toBe(false)
  })
})

describe('registerPaymentKey', () => {
  it('logs in at apiBase and sends { name, public_key, proof } with the buyer token', async () => {
    const { bodies, authorizations } = serveRegistration()
    const { paymentKey, record } = await registerPaymentKey({
      key: 'bk',
      secret: 's',
      name: 'agent',
      apiBase: API_BASE,
    })
    expect(bodies).toHaveLength(1)
    const body = bodies[0] as PaymentKeyCreateBody
    expect(Object.keys(body).sort()).toEqual(['name', 'proof', 'public_key'])
    expect(await proofVerifies(body)).toBe(true)
    expect(authorizations).toEqual(['Bearer buyer-jwt'])
    expect(paymentKey.id).toBe('payment-key-uuid')
    expect(await derivePublicKey(paymentKey.privateKey)).toBe(body.public_key)
    expect(record.public_key).toBe(body.public_key)
    expect(JSON.stringify(bodies)).not.toContain(paymentKey.privateKey)
  })

  it('uses a buyer access token without logging in', async () => {
    const { authorizations } = serveRegistration()
    server.use(http.post(LOGIN_URL, () => HttpResponse.error()))
    await registerPaymentKey({ accessToken: 'given-jwt', name: 'agent', apiBase: API_BASE })
    expect(authorizations).toEqual(['Bearer given-jwt'])
  })

  it('sends the registration with redirect: "error"', async () => {
    const inits: (RequestInit | undefined)[] = []
    const spy: typeof globalThis.fetch = (input, init) => {
      inits.push(init)
      return globalThis.fetch(input, init)
    }
    serveRegistration()
    await registerPaymentKey({ accessToken: 't', name: 'agent', apiBase: API_BASE, fetch: spy })
    expect(inits.map((i) => i?.redirect)).toEqual(['error'])
  })

  it('goes only to the configured apiBase', async () => {
    const urls: string[] = []
    const spy: typeof globalThis.fetch = (input, init) => {
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      return globalThis.fetch(input, init)
    }
    serveRegistration()
    await registerPaymentKey({
      key: 'bk',
      secret: 's',
      name: 'agent',
      apiBase: API_BASE,
      fetch: spy,
    })
    expect(urls).toEqual([LOGIN_URL, KEYS_URL])
  })

  it.each([
    [401, AuthError],
    [403, ForbiddenError],
    [429, RateLimitError],
    [422, LedewireError],
  ] as const)('maps a %s refusal to its typed error with the API message', async (status, cls) => {
    server.use(
      http.post(KEYS_URL, () =>
        HttpResponse.json(
          { error: { code: status, message: 'Proof is not a valid signature by this key' } },
          { status, headers: { 'Retry-After': '7' } },
        ),
      ),
    )
    const err = await registerPaymentKey({ accessToken: 't', name: 'a', apiBase: API_BASE }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(cls)
    expect(err).toMatchObject({
      statusCode: status,
      message: 'Proof is not a valid signature by this key',
    })
    if (status === 429) expect(err).toMatchObject({ retryAfter: 7 })
  })

  it('uses a generic message when the refusal body is not JSON', async () => {
    server.use(http.post(KEYS_URL, () => new HttpResponse('nope', { status: 500 })))
    const err = await registerPaymentKey({ accessToken: 't', name: 'a', apiBase: API_BASE }).catch(
      (e: unknown) => e,
    )
    expect(err).toMatchObject({ statusCode: 500, message: 'Payment key registration failed (500)' })
  })

  it('refuses a response that does not echo the registered public key', async () => {
    server.use(
      http.post(KEYS_URL, () =>
        HttpResponse.json({ id: 'x', public_key: 'something-else' }, { status: 201 }),
      ),
    )
    await expect(
      registerPaymentKey({ accessToken: 't', name: 'a', apiBase: API_BASE }),
    ).rejects.toBeInstanceOf(LedewireError)
  })

  it('defaults to the production API base', async () => {
    const urls: string[] = []
    const spy: typeof globalThis.fetch = (input) => {
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      return Promise.resolve(HttpResponse.json({}, { status: 500 }))
    }
    await registerPaymentKey({ accessToken: 't', name: 'a', fetch: spy }).catch(() => undefined)
    expect(urls).toEqual(['https://api.ledewire.com/v1/user/payment-keys'])
  })
})
