import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  mcpApiKeyFixture,
  mcpApiKeyCreateResponseFixture,
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
// user.mcpKeys.list
// ---------------------------------------------------------------------------

describe('user.mcpKeys.list', () => {
  it('returns an array of MCP API keys', async () => {
    const keys = [mcpApiKeyFixture(), mcpApiKeyFixture({ id: 'mcp-key-id-2', label: 'Second' })]
    server.use(http.get(`${BASE}/v1/mcp/keys`, () => HttpResponse.json(keys)))

    const result = await makeClient().user.mcpKeys.list()

    expect(result).toEqual(keys)
    expect(result).toHaveLength(2)
  })

  it('returns an empty array when no keys exist', async () => {
    server.use(http.get(`${BASE}/v1/mcp/keys`, () => HttpResponse.json([])))

    const result = await makeClient().user.mcpKeys.list()

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/mcp/keys`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().user.mcpKeys.list()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// user.mcpKeys.create
// ---------------------------------------------------------------------------

describe('user.mcpKeys.create', () => {
  it('returns the new key with a one-time secret', async () => {
    const fixture = mcpApiKeyCreateResponseFixture()
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/mcp/keys`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const result = await makeClient().user.mcpKeys.create({ label: 'My Agent Key' })

    expect(result.key).toBe('mcpk_abc123')
    expect(result.secret).toHaveLength(64)
    expect(capturedBody).toEqual({ label: 'My Agent Key' })
  })

  it('forwards scopes and store_id for a seller-tier key', async () => {
    const fixture = mcpApiKeyCreateResponseFixture({
      can_manage_content: true,
      can_read_analytics: true,
      store_id: 'store-id-1',
    })
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/mcp/keys`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const body = {
      label: 'Seller Key',
      can_search: true,
      can_purchase: false,
      can_manage_content: true,
      can_read_analytics: true,
      store_id: 'store-id-1',
    }
    const result = await makeClient().user.mcpKeys.create(body)

    expect(result.store_id).toBe('store-id-1')
    expect(capturedBody).toEqual(body)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/mcp/keys`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().user.mcpKeys.create({ label: 'Agent' })).rejects.toThrow(AuthError)
  })

  it('throws on 422 when store_id is not owned/authored by the user', async () => {
    server.use(
      http.post(`${BASE}/v1/mcp/keys`, () =>
        HttpResponse.json(errorResponseFixture(4222, 'Not an owner or author of this store'), {
          status: 422,
        }),
      ),
    )

    await expect(
      makeClient().user.mcpKeys.create({ label: 'Agent', store_id: 'not-mine' }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// user.mcpKeys.revoke
// ---------------------------------------------------------------------------

describe('user.mcpKeys.revoke', () => {
  it('resolves without a value on 204', async () => {
    server.use(
      http.delete(
        `${BASE}/v1/mcp/keys/mcp-key-id-1`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(makeClient().user.mcpKeys.revoke('mcp-key-id-1')).resolves.toBeUndefined()
  })

  it('encodes the id in the URL', async () => {
    let requestedUrl: string | undefined
    server.use(
      http.delete(`${BASE}/v1/mcp/keys/:id`, ({ request }) => {
        requestedUrl = request.url
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await makeClient().user.mcpKeys.revoke('id with space')

    expect(requestedUrl).toBe(`${BASE}/v1/mcp/keys/id%20with%20space`)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.delete(`${BASE}/v1/mcp/keys/missing`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().user.mcpKeys.revoke('missing')).rejects.toThrow(NotFoundError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.delete(`${BASE}/v1/mcp/keys/mcp-key-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().user.mcpKeys.revoke('mcp-key-id-1')).rejects.toThrow(AuthError)
  })
})
