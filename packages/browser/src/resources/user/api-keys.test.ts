import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  userApiKeyFixture,
  userApiKeyCreateResponseFixture,
  errorResponseFixture,
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

// ---------------------------------------------------------------------------
// user.apiKeys.list
// ---------------------------------------------------------------------------

describe('user.apiKeys.list', () => {
  it('returns an array of API keys (no secrets)', async () => {
    const keys = [
      userApiKeyFixture(),
      userApiKeyFixture({ id: 'key-id-2', name: 'Secondary Agent', key: 'bktst_def456' }),
    ]
    server.use(http.get(`${BASE}/v1/user/api-keys`, () => HttpResponse.json(keys)))

    const result = await makeClient().user.apiKeys.list()

    expect(result).toEqual(keys)
    expect(result).toHaveLength(2)
    // Secret must never be present on list response
    for (const k of result) {
      expect(k).not.toHaveProperty('secret')
    }
  })

  it('returns an empty array when no keys exist', async () => {
    server.use(http.get(`${BASE}/v1/user/api-keys`, () => HttpResponse.json([])))

    const result = await makeClient().user.apiKeys.list()

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/user/api-keys`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().user.apiKeys.list()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// user.apiKeys.create
// ---------------------------------------------------------------------------

describe('user.apiKeys.create', () => {
  it('returns the new key with a one-time secret', async () => {
    const fixture = userApiKeyCreateResponseFixture()
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/user/api-keys`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const result = await makeClient().user.apiKeys.create({ name: 'my-rag-agent' })

    expect(result.key).toBe('bktst_abc123')
    expect(result.secret).toHaveLength(64)
    expect(capturedBody).toEqual({ name: 'my-rag-agent' })
  })

  it('forwards optional spending_limit_cents', async () => {
    const fixture = userApiKeyCreateResponseFixture()
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/user/api-keys`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    await makeClient().user.apiKeys.create({ name: 'capped-agent', spending_limit_cents: 1000 })

    expect(capturedBody).toEqual({ name: 'capped-agent', spending_limit_cents: 1000 })
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/user/api-keys`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().user.apiKeys.create({ name: 'agent' })).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// user.apiKeys.revoke
// ---------------------------------------------------------------------------

describe('user.apiKeys.revoke', () => {
  it('resolves without a value on 204', async () => {
    server.use(
      http.delete(
        `${BASE}/v1/user/api-keys/key-id-1`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(makeClient().user.apiKeys.revoke('key-id-1')).resolves.toBeUndefined()
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.delete(`${BASE}/v1/user/api-keys/key-id-missing`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().user.apiKeys.revoke('key-id-missing')).rejects.toThrow(NotFoundError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.delete(`${BASE}/v1/user/api-keys/key-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().user.apiKeys.revoke('key-id-1')).rejects.toThrow(AuthError)
  })
})
