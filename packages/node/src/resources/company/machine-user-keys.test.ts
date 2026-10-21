import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  companyMachineUserBuyerKeyFixture,
  companyMachineUserMcpKeyFixture,
  errorResponseFixture,
} from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const MACHINE_USER_ID = 'machine-user-id-1'

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
// company.machineUsers.buyerKeys
// ---------------------------------------------------------------------------

describe('company.machineUsers.buyerKeys.list', () => {
  it('GETs the Machine user buyer-keys and returns the envelope', async () => {
    const keys = [companyMachineUserBuyerKeyFixture()]
    server.use(
      http.get(`${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/buyer-keys`, () =>
        HttpResponse.json({ data: keys }),
      ),
    )

    const result = await makeClient().company.machineUsers.buyerKeys.list(MACHINE_USER_ID)

    expect(result.data).toEqual(keys)
    expect(result.data[0]).not.toHaveProperty('secret')
  })

  it('throws NotFoundError when the Machine user is not in the Company', async () => {
    server.use(
      http.get(`${BASE}/v1/company/machine-users/missing/buyer-keys`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().company.machineUsers.buyerKeys.list('missing')).rejects.toThrow(
      NotFoundError,
    )
  })
})

describe('company.machineUsers.buyerKeys.create', () => {
  it('POSTs the name and returns the key with its one-time secret', async () => {
    const fixture = { ...companyMachineUserBuyerKeyFixture(), secret: 'a'.repeat(64) }
    let capturedBody: unknown
    server.use(
      http.post(
        `${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/buyer-keys`,
        async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json(fixture, { status: 201 })
        },
      ),
    )

    const result = await makeClient().company.machineUsers.buyerKeys.create(MACHINE_USER_ID, {
      name: 'primary',
    })

    expect(capturedBody).toEqual({ name: 'primary' })
    expect(result.secret).toHaveLength(64)
    expect(result.key).toBe('bktst_abc123')
  })

  it('throws on 409 when the Machine user is deactivated', async () => {
    server.use(
      http.post(`${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/buyer-keys`, () =>
        HttpResponse.json(errorResponseFixture(4090, 'Deactivated'), { status: 409 }),
      ),
    )

    await expect(
      makeClient().company.machineUsers.buyerKeys.create(MACHINE_USER_ID, { name: 'primary' }),
    ).rejects.toThrow()
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.post(`${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/buyer-keys`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().company.machineUsers.buyerKeys.create(MACHINE_USER_ID, { name: 'primary' }),
    ).rejects.toThrow(ForbiddenError)
  })
})

describe('company.machineUsers.buyerKeys.revoke', () => {
  it('DELETEs the key and resolves on 204', async () => {
    let method: string | undefined
    server.use(
      http.delete(
        `${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/buyer-keys/buyer-key-id-1`,
        ({ request }) => {
          method = request.method
          return new HttpResponse(null, { status: 204 })
        },
      ),
    )

    await expect(
      makeClient().company.machineUsers.buyerKeys.revoke(MACHINE_USER_ID, 'buyer-key-id-1'),
    ).resolves.toBeUndefined()
    expect(method).toBe('DELETE')
  })

  it('encodes both path segments', async () => {
    let capturedUrl: string | undefined
    server.use(
      http.delete(`${BASE}/v1/company/machine-users/:mu/buyer-keys/:id`, ({ request }) => {
        capturedUrl = request.url
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await makeClient().company.machineUsers.buyerKeys.revoke('mu id', 'key id')

    expect(capturedUrl).toBe(`${BASE}/v1/company/machine-users/mu%20id/buyer-keys/key%20id`)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.delete(
        `${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/buyer-keys/buyer-key-id-1`,
        () => HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().company.machineUsers.buyerKeys.revoke(MACHINE_USER_ID, 'buyer-key-id-1'),
    ).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// company.machineUsers.mcpKeys
// ---------------------------------------------------------------------------

describe('company.machineUsers.mcpKeys.list', () => {
  it('GETs the Machine user mcp-keys and returns the envelope', async () => {
    const keys = [companyMachineUserMcpKeyFixture()]
    server.use(
      http.get(`${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/mcp-keys`, () =>
        HttpResponse.json({ data: keys }),
      ),
    )

    const result = await makeClient().company.machineUsers.mcpKeys.list(MACHINE_USER_ID)

    expect(result.data).toEqual(keys)
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.get(`${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/mcp-keys`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().company.machineUsers.mcpKeys.list(MACHINE_USER_ID)).rejects.toThrow(
      ForbiddenError,
    )
  })
})

describe('company.machineUsers.mcpKeys.create', () => {
  it('POSTs the label and scopes, and returns the key with its one-time secret', async () => {
    const fixture = { ...companyMachineUserMcpKeyFixture(), secret: 'b'.repeat(64) }
    let capturedBody: unknown
    server.use(
      http.post(
        `${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/mcp-keys`,
        async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json(fixture, { status: 201 })
        },
      ),
    )

    const result = await makeClient().company.machineUsers.mcpKeys.create(MACHINE_USER_ID, {
      label: 'search-only',
      scopes: ['mcp:search'],
    })

    expect(capturedBody).toEqual({ label: 'search-only', scopes: ['mcp:search'] })
    expect(result.secret).toHaveLength(64)
    expect(result.scopes).toEqual(['mcp:search'])
  })
})

describe('company.machineUsers.mcpKeys.revoke', () => {
  it('DELETEs the key and resolves on 204', async () => {
    let method: string | undefined
    server.use(
      http.delete(
        `${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/mcp-keys/mcp-key-id-1`,
        ({ request }) => {
          method = request.method
          return new HttpResponse(null, { status: 204 })
        },
      ),
    )

    await expect(
      makeClient().company.machineUsers.mcpKeys.revoke(MACHINE_USER_ID, 'mcp-key-id-1'),
    ).resolves.toBeUndefined()
    expect(method).toBe('DELETE')
  })

  it('throws NotFoundError when no such active key exists', async () => {
    server.use(
      http.delete(`${BASE}/v1/company/machine-users/${MACHINE_USER_ID}/mcp-keys/missing`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(
      makeClient().company.machineUsers.mcpKeys.revoke(MACHINE_USER_ID, 'missing'),
    ).rejects.toThrow(NotFoundError)
  })
})
