import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { companyMachineUserFixture, errorResponseFixture } from '@ledewire/core/test-utils'
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
// company.machineUsers.list
// ---------------------------------------------------------------------------

describe('company.machineUsers.list', () => {
  it('GETs /v1/company/machine-users and returns the envelope', async () => {
    const users = [
      companyMachineUserFixture(),
      companyMachineUserFixture({
        id: 'machine-user-id-2',
        name: 'old-agent',
        deactivated_at: '2099-02-01T00:00:00Z',
      }),
    ]
    server.use(
      http.get(`${BASE}/v1/company/machine-users`, () => HttpResponse.json({ data: users })),
    )

    const result = await makeClient().company.machineUsers.list()

    expect(result.data).toEqual(users)
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.get(`${BASE}/v1/company/machine-users`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().company.machineUsers.list()).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// company.machineUsers.create
// ---------------------------------------------------------------------------

describe('company.machineUsers.create', () => {
  it('POSTs the name and description, and returns the new Machine user', async () => {
    const fixture = companyMachineUserFixture({ description: 'Nightly pull' })
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/company/machine-users`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const result = await makeClient().company.machineUsers.create({
      name: 'research-agent',
      description: 'Nightly pull',
    })

    expect(capturedBody).toEqual({ name: 'research-agent', description: 'Nightly pull' })
    expect(result).toEqual(fixture)
  })

  it('throws on 409 when an active Machine user already has the name', async () => {
    server.use(
      http.post(`${BASE}/v1/company/machine-users`, () =>
        HttpResponse.json(errorResponseFixture(4090, 'Name taken'), { status: 409 }),
      ),
    )

    await expect(
      makeClient().company.machineUsers.create({ name: 'research-agent' }),
    ).rejects.toThrow()
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/company/machine-users`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().company.machineUsers.create({ name: 'research-agent' }),
    ).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// company.machineUsers.update
// ---------------------------------------------------------------------------

describe('company.machineUsers.update', () => {
  it('PATCHes the Machine user with only the fields given', async () => {
    const fixture = companyMachineUserFixture({ description: 'Weekly sync' })
    let capturedBody: unknown
    let capturedUrl: string | undefined
    server.use(
      http.patch(`${BASE}/v1/company/machine-users/machine-user-id-1`, async ({ request }) => {
        capturedUrl = request.url
        capturedBody = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    const result = await makeClient().company.machineUsers.update('machine-user-id-1', {
      description: 'Weekly sync',
    })

    expect(capturedUrl).toBe(`${BASE}/v1/company/machine-users/machine-user-id-1`)
    expect(capturedBody).toEqual({ description: 'Weekly sync' })
    expect(result).toEqual(fixture)
  })

  it('sends a null description to clear it', async () => {
    let capturedBody: unknown
    server.use(
      http.patch(`${BASE}/v1/company/machine-users/machine-user-id-1`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(companyMachineUserFixture({ description: null }))
      }),
    )

    await makeClient().company.machineUsers.update('machine-user-id-1', { description: null })

    expect(capturedBody).toEqual({ description: null })
  })

  it('throws on 409 when another active Machine user has the name', async () => {
    server.use(
      http.patch(`${BASE}/v1/company/machine-users/machine-user-id-1`, () =>
        HttpResponse.json(errorResponseFixture(4090, 'Name taken'), { status: 409 }),
      ),
    )

    await expect(
      makeClient().company.machineUsers.update('machine-user-id-1', { name: 'taken' }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// company.machineUsers.deactivate
// ---------------------------------------------------------------------------

describe('company.machineUsers.deactivate', () => {
  it('DELETEs the Machine user and returns it as deactivated', async () => {
    const fixture = companyMachineUserFixture({ deactivated_at: '2099-02-01T00:00:00Z' })
    let method: string | undefined
    server.use(
      http.delete(`${BASE}/v1/company/machine-users/machine-user-id-1`, ({ request }) => {
        method = request.method
        return HttpResponse.json(fixture)
      }),
    )

    const result = await makeClient().company.machineUsers.deactivate('machine-user-id-1')

    expect(method).toBe('DELETE')
    expect(result.deactivated_at).toBe('2099-02-01T00:00:00Z')
  })

  it('throws on 409 when already deactivated', async () => {
    server.use(
      http.delete(`${BASE}/v1/company/machine-users/machine-user-id-1`, () =>
        HttpResponse.json(errorResponseFixture(4090, 'Already deactivated'), { status: 409 }),
      ),
    )

    await expect(
      makeClient().company.machineUsers.deactivate('machine-user-id-1'),
    ).rejects.toThrow()
  })
})
