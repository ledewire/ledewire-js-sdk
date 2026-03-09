import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  errorResponseFixture,
  salesSummaryFixture,
  salesStatisticsItemFixture,
  merchantSaleFixture,
} from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const STORE_ID = 'store-id-1'

const server = createTestServer()
beforeAll(() => { server.listen({ onUnhandledRequest: 'error' }) })
afterEach(() => { server.resetHandlers() })
afterAll(() => { server.close() })

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
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/summary`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.sales.summary(STORE_ID)

    expect(result).toEqual(fixture)
  })

  it('includes monthly breakdowns', async () => {
    const fixture = salesSummaryFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/summary`, () =>
        HttpResponse.json(fixture),
      ),
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
  it('returns per-title sales rollup', async () => {
    const fixture = [salesStatisticsItemFixture(), salesStatisticsItemFixture({ content_id: 'content-id-2', title: 'Second Article' })]
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.sales.list(STORE_ID)

    expect(result).toEqual(fixture)
    expect(result).toHaveLength(2)
  })

  it('returns an empty list when no sales exist', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales`, () => HttpResponse.json([])),
    )

    const result = await makeClient().merchant.sales.list(STORE_ID)

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.sales.list(STORE_ID)).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// merchant.sales.get
// ---------------------------------------------------------------------------

describe('merchant.sales.get', () => {
  it('returns sale detail with fee breakdown', async () => {
    const fixture = merchantSaleFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/sale-id-1`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.sales.get(STORE_ID, 'sale-id-1')

    expect(result).toEqual(fixture)
  })

  it('includes the fee split in the response', async () => {
    const fixture = merchantSaleFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/sale-id-1`, () =>
        HttpResponse.json(fixture),
      ),
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

    await expect(
      makeClient().merchant.sales.get(STORE_ID, 'missing-id'),
    ).rejects.toThrow(NotFoundError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/sales/sale-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().merchant.sales.get(STORE_ID, 'sale-id-1'),
    ).rejects.toThrow(ForbiddenError)
  })
})
