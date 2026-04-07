import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { errorResponseFixture } from '@ledewire/core/test-utils'
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
// seller.sales.summary
// ---------------------------------------------------------------------------

describe('seller.sales.summary', () => {
  it('returns aggregated sales statistics', async () => {
    const fixture = {
      total_revenue_cents: 4389,
      total_sales: 48,
      monthly_revenue_cents: { '2025': { '5': 204, '6': 2210 } },
      monthly_sales: { '2025': { '5': 2, '6': 26 } },
    }
    server.use(http.get(`${BASE}/v1/seller/sales/summary`, () => HttpResponse.json(fixture)))

    const result = await makeClient().seller.sales.summary()

    expect(result.total_revenue_cents).toBe(4389)
    expect(result.total_sales).toBe(48)
    expect(result.monthly_revenue_cents).toBeDefined()
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/sales/summary`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.sales.summary()).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/sales/summary`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().seller.sales.summary()).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// seller.sales.list
// ---------------------------------------------------------------------------

describe('seller.sales.list', () => {
  it('returns an array of per-content sales statistics', async () => {
    const fixture = [
      {
        content_id: 'content-123',
        title: 'Sample Post',
        total_sales: 15,
        total_revenue_cents: 7500,
      },
      {
        content_id: 'content-456',
        title: 'Another Post',
        total_sales: 8,
        total_revenue_cents: 9600,
      },
    ]
    server.use(http.get(`${BASE}/v1/seller/sales`, () => HttpResponse.json(fixture)))

    const result = await makeClient().seller.sales.list()

    expect(result).toHaveLength(2)
    expect(result[0]!.content_id).toBe('content-123')
    expect(result[0]!.total_sales).toBe(15)
  })

  it('returns an empty array when no sales exist', async () => {
    server.use(http.get(`${BASE}/v1/seller/sales`, () => HttpResponse.json([])))

    const result = await makeClient().seller.sales.list()

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/sales`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.sales.list()).rejects.toThrow(AuthError)
  })
})
