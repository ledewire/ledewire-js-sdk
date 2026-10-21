import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { companyMemberFixture, errorResponseFixture } from '@ledewire/core/test-utils'
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
// company.members.list
// ---------------------------------------------------------------------------

describe('company.members.list', () => {
  it('GETs /v1/company/members and returns the member envelope', async () => {
    const members = [
      companyMemberFixture(),
      companyMemberFixture({ id: 'membership-id-2', kind: 'machine', email: null, role: 'member' }),
    ]
    server.use(http.get(`${BASE}/v1/company/members`, () => HttpResponse.json({ data: members })))

    const result = await makeClient().company.members.list()

    expect(result.data).toEqual(members)
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.get(`${BASE}/v1/company/members`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().company.members.list()).rejects.toThrow(ForbiddenError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/company/members`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().company.members.list()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// company.members.update
// ---------------------------------------------------------------------------

describe('company.members.update', () => {
  it('PATCHes the member with the role and cap, and returns the updated member', async () => {
    const fixture = companyMemberFixture({ role: 'admin', daily_spend_limit_cents: 5000 })
    let capturedBody: unknown
    let capturedUrl: string | undefined
    server.use(
      http.patch(`${BASE}/v1/company/members/membership-id-1`, async ({ request }) => {
        capturedUrl = request.url
        capturedBody = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    const result = await makeClient().company.members.update('membership-id-1', {
      role: 'admin',
      daily_spend_limit_cents: 5000,
    })

    expect(capturedUrl).toBe(`${BASE}/v1/company/members/membership-id-1`)
    expect(capturedBody).toEqual({ role: 'admin', daily_spend_limit_cents: 5000 })
    expect(result).toEqual(fixture)
  })

  it('sends only the cap when role is omitted', async () => {
    let capturedBody: unknown
    server.use(
      http.patch(`${BASE}/v1/company/members/membership-id-1`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(companyMemberFixture({ daily_spend_limit_cents: 2000 }))
      }),
    )

    await makeClient().company.members.update('membership-id-1', { daily_spend_limit_cents: 2000 })

    expect(capturedBody).toEqual({ daily_spend_limit_cents: 2000 })
  })

  it('encodes the id in the URL', async () => {
    let capturedUrl: string | undefined
    server.use(
      http.patch(`${BASE}/v1/company/members/:id`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(companyMemberFixture())
      }),
    )

    await makeClient().company.members.update('id with space', { role: 'member' })

    expect(capturedUrl).toBe(`${BASE}/v1/company/members/id%20with%20space`)
  })

  it('throws on 422 when the change would leave no admin', async () => {
    server.use(
      http.patch(`${BASE}/v1/company/members/membership-id-1`, () =>
        HttpResponse.json(errorResponseFixture(4222, 'Last admin'), { status: 422 }),
      ),
    )

    await expect(
      makeClient().company.members.update('membership-id-1', { role: 'member' }),
    ).rejects.toThrow()
  })

  it("throws NotFoundError when the member is not in the caller's Company", async () => {
    server.use(
      http.patch(`${BASE}/v1/company/members/missing`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(
      makeClient().company.members.update('missing', { daily_spend_limit_cents: 1 }),
    ).rejects.toThrow(NotFoundError)
  })
})

// ---------------------------------------------------------------------------
// company.members.remove
// ---------------------------------------------------------------------------

describe('company.members.remove', () => {
  it('DELETEs the member and resolves on 204', async () => {
    let method: string | undefined
    server.use(
      http.delete(`${BASE}/v1/company/members/membership-id-1`, ({ request }) => {
        method = request.method
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(makeClient().company.members.remove('membership-id-1')).resolves.toBeUndefined()
    expect(method).toBe('DELETE')
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.delete(`${BASE}/v1/company/members/membership-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().company.members.remove('membership-id-1')).rejects.toThrow(
      ForbiddenError,
    )
  })
})
