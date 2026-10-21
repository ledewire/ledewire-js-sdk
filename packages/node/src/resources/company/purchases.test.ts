import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  companyPurchaseFixture,
  errorResponseFixture,
  paginationMetaFixture,
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

// ---------------------------------------------------------------------------
// company.purchases.list
// ---------------------------------------------------------------------------

describe('company.purchases.list', () => {
  it('GETs /v1/company/purchases and returns the paginated envelope', async () => {
    const purchases = [
      companyPurchaseFixture(),
      companyPurchaseFixture({ kind: 'bulk_acquisition', id: 'acquisition-id-1' }),
    ]
    server.use(
      http.get(`${BASE}/v1/company/purchases`, () =>
        HttpResponse.json({
          data: purchases,
          pagination: paginationMetaFixture({ total: 2 }),
        }),
      ),
    )

    const result = await makeClient().company.purchases.list()

    expect(result.data).toEqual(purchases)
    expect(result.pagination.total).toBe(2)
  })

  it('forwards pagination and filter parameters as query string', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get(`${BASE}/v1/company/purchases`, ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({ data: [], pagination: paginationMetaFixture({ total: 0 }) })
      }),
    )

    await makeClient().company.purchases.list({
      page: 2,
      per_page: 50,
      member: 'membership-id-1',
      from: '2099-01-01',
      to: '2099-01-31',
      kind: 'purchase',
    })

    expect(capturedUrl?.searchParams.get('page')).toBe('2')
    expect(capturedUrl?.searchParams.get('per_page')).toBe('50')
    expect(capturedUrl?.searchParams.get('member')).toBe('membership-id-1')
    expect(capturedUrl?.searchParams.get('from')).toBe('2099-01-01')
    expect(capturedUrl?.searchParams.get('to')).toBe('2099-01-31')
    expect(capturedUrl?.searchParams.get('kind')).toBe('purchase')
  })

  it('sends no query string when called without params', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get(`${BASE}/v1/company/purchases`, ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({ data: [], pagination: paginationMetaFixture({ total: 0 }) })
      }),
    )

    await makeClient().company.purchases.list()

    expect(capturedUrl?.search).toBe('')
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.get(`${BASE}/v1/company/purchases`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().company.purchases.list()).rejects.toThrow(ForbiddenError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/company/purchases`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().company.purchases.list()).rejects.toThrow(AuthError)
  })
})
