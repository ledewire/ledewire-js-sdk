import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  errorResponseFixture,
  buyerStatisticsItemFixture,
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
// merchant.buyers.list
// ---------------------------------------------------------------------------

describe('merchant.buyers.list', () => {
  it('returns paginated buyer statistics', async () => {
    const items = [
      buyerStatisticsItemFixture(),
      buyerStatisticsItemFixture({ buyer_ref: 'buyer-ref-2', buyer_status: 'new' }),
    ]
    const fixture = { data: items, pagination: paginationMetaFixture({ total: 2 }) }
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.buyers.list(STORE_ID)

    expect(result.data).toEqual(items)
    expect(result.pagination.total).toBe(2)
  })

  it('returns an empty page when no buyers exist', async () => {
    const fixture = { data: [], pagination: paginationMetaFixture({ total: 0, total_pages: 0 }) }
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.buyers.list(STORE_ID)

    expect(result.data).toEqual([])
  })

  it('returns buyer statistics with expected fields', async () => {
    const items = [buyerStatisticsItemFixture()]
    const fixture = { data: items, pagination: paginationMetaFixture() }
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.buyers.list(STORE_ID)

    const [buyer] = result.data
    expect(buyer).toMatchObject({
      buyer_ref: 'buyer-ref-1',
      purchases_count: 2,
      total_spent_cents: 1000,
      buyer_status: 'repeat',
    })
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.buyers.list(STORE_ID)).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.buyers.list(STORE_ID)).rejects.toThrow(ForbiddenError)
  })

  it('forwards page and per_page as query params', async () => {
    let capturedUrl = ''
    const fixture = { data: [], pagination: paginationMetaFixture() }
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().merchant.buyers.list(STORE_ID, { page: 2, per_page: 10 })

    const url = new URL(capturedUrl)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('per_page')).toBe('10')
  })
})
