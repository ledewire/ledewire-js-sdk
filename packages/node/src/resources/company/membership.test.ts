import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { NotFoundError, AuthError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { companyMembershipFixture, errorResponseFixture } from '@ledewire/core/test-utils'
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
// company.membership.get
// ---------------------------------------------------------------------------

describe('company.membership.get', () => {
  it('GETs /v1/company/membership and returns the membership', async () => {
    const fixture = companyMembershipFixture()
    let method: string | undefined
    server.use(
      http.get(`${BASE}/v1/company/membership`, ({ request }) => {
        method = request.method
        return HttpResponse.json(fixture)
      }),
    )

    const result = await makeClient().company.membership.get()

    expect(method).toBe('GET')
    expect(result).toEqual(fixture)
  })

  it('throws NotFoundError when the buyer belongs to no Company', async () => {
    server.use(
      http.get(`${BASE}/v1/company/membership`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().company.membership.get()).rejects.toThrow(NotFoundError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/company/membership`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().company.membership.get()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// company.membership.leave
// ---------------------------------------------------------------------------

describe('company.membership.leave', () => {
  it('DELETEs /v1/company/membership and resolves on 204', async () => {
    let method: string | undefined
    server.use(
      http.delete(`${BASE}/v1/company/membership`, ({ request }) => {
        method = request.method
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(makeClient().company.membership.leave()).resolves.toBeUndefined()
    expect(method).toBe('DELETE')
  })

  it('throws on 422 when the buyer is the last admin', async () => {
    server.use(
      http.delete(`${BASE}/v1/company/membership`, () =>
        HttpResponse.json(errorResponseFixture(4222, 'Last admin'), { status: 422 }),
      ),
    )

    await expect(makeClient().company.membership.leave()).rejects.toThrow()
  })
})
