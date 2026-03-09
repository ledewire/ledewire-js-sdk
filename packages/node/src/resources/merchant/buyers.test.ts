import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { errorResponseFixture, buyerStatisticsItemFixture } from '@ledewire/core/test-utils'
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
  it('returns aggregated buyer statistics', async () => {
    const fixture = [
      buyerStatisticsItemFixture(),
      buyerStatisticsItemFixture({ buyer_ref: 'buyer-ref-2', buyer_status: 'new' }),
    ]
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.buyers.list(STORE_ID)

    expect(result).toEqual(fixture)
    expect(result).toHaveLength(2)
  })

  it('returns an empty list when no buyers exist', async () => {
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, () => HttpResponse.json([])))

    const result = await makeClient().merchant.buyers.list(STORE_ID)

    expect(result).toEqual([])
  })

  it('returns buyer statistics with expected fields', async () => {
    const fixture = [buyerStatisticsItemFixture()]
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/buyers`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.buyers.list(STORE_ID)

    const [buyer] = result
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
})
