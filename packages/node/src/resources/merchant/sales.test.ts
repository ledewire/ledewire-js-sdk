import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  errorResponseFixture,
  salesSummaryFixture,
  salesStatisticsItemFixture,
  merchantSaleFixture,
  paginationMetaFixture,
} from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const STORE_ID = 'store-id-1'

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
// merchant.sales.summary
// ---------------------------------------------------------------------------

describe('merchant.sales.summary', () => {
  it('returns aggregated sales statistics', async () => {
    const fixture = salesSummaryFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/summary`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.sales.summary(STORE_ID)

    expect(result).toEqual(fixture)
  })

  it('includes monthly breakdowns', async () => {
    const fixture = salesSummaryFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/summary`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.sales.summary(STORE_ID)

    expect(result.total_sales).toBe(3)
    expect(result.total_revenue_cents).toBe(15000)
    expect(result.monthly_revenue_cents).toBeDefined()
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/summary`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.sales.summary(STORE_ID)).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/summary`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.sales.summary(STORE_ID)).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// merchant.sales.list
// ---------------------------------------------------------------------------

describe('merchant.sales.list', () => {
  it('returns a paginated list of per-title sales', async () => {
    const items = [
      salesStatisticsItemFixture(),
      salesStatisticsItemFixture({ content_id: 'content-id-2', title: 'Second Article' }),
    ]
    const fixture = { data: items, pagination: paginationMetaFixture({ total: 2 }) }
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/sales`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.sales.list(STORE_ID)

    expect(result.data).toEqual(items)
    expect(result.pagination.total).toBe(2)
  })

  it('returns an empty page when no sales exist', async () => {
    const fixture = { data: [], pagination: paginationMetaFixture({ total: 0, total_pages: 0 }) }
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/sales`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.sales.list(STORE_ID)

    expect(result.data).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.sales.list(STORE_ID)).rejects.toThrow(AuthError)
  })

  it('forwards page and per_page as query params', async () => {
    let capturedUrl = ''
    const fixture = { data: [], pagination: paginationMetaFixture() }
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().merchant.sales.list(STORE_ID, { page: 2, per_page: 10 })

    const url = new URL(capturedUrl)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('per_page')).toBe('10')
  })
})

// ---------------------------------------------------------------------------
// merchant.sales.get
// ---------------------------------------------------------------------------

describe('merchant.sales.get', () => {
  it('returns sale detail with fee breakdown', async () => {
    const fixture = merchantSaleFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/sale-id-1`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.sales.get(STORE_ID, 'sale-id-1')

    expect(result).toEqual(fixture)
  })

  it('includes the fee split in the response', async () => {
    const fixture = merchantSaleFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/sale-id-1`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.sales.get(STORE_ID, 'sale-id-1')

    expect(result.fees.platform_fee_cents).toBe(50)
    expect(result.fees.store_net_cents).toBe(450)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Sale not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().merchant.sales.get(STORE_ID, 'missing-id')).rejects.toThrow(
      NotFoundError,
    )
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/sale-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.sales.get(STORE_ID, 'sale-id-1')).rejects.toThrow(
      ForbiddenError,
    )
  })
})
