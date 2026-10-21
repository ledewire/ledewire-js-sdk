import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { companySpendItemFixture, errorResponseFixture } from '@ledewire/core/test-utils'
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
// company.spend.list
// ---------------------------------------------------------------------------

describe('company.spend.list', () => {
  it('GETs /v1/company/spend and returns one row per membership', async () => {
    const rows = [
      companySpendItemFixture(),
      companySpendItemFixture({
        member: {
          id: 'membership-id-2',
          user_id: 'user-id-2',
          name: 'Former Member',
          kind: 'human',
          left_at: '2099-01-15T00:00:00Z',
        },
        spend_cents: 0,
      }),
    ]
    server.use(http.get(`${BASE}/v1/company/spend`, () => HttpResponse.json({ data: rows })))

    const result = await makeClient().company.spend.list()

    expect(result.data).toEqual(rows)
  })

  it('forwards member and date filters as query string', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get(`${BASE}/v1/company/spend`, ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({ data: [] })
      }),
    )

    await makeClient().company.spend.list({
      member: 'membership-id-1',
      from: '2099-01-01',
      to: '2099-01-31',
    })

    expect(capturedUrl?.searchParams.get('member')).toBe('membership-id-1')
    expect(capturedUrl?.searchParams.get('from')).toBe('2099-01-01')
    expect(capturedUrl?.searchParams.get('to')).toBe('2099-01-31')
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.get(`${BASE}/v1/company/spend`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().company.spend.list()).rejects.toThrow(ForbiddenError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/company/spend`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().company.spend.list()).rejects.toThrow(AuthError)
  })
})
