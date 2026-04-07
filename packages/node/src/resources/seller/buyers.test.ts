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
// seller.buyers.list
// ---------------------------------------------------------------------------

describe('seller.buyers.list', () => {
  it('returns an array of anonymized buyer statistics', async () => {
    const fixture = [
      {
        buyer_ref: 'bref_v1_Cm9kQZ0W1rKq7c0g0m5b0A',
        purchases_count: 3,
        total_spent_cents: 2200,
        first_purchase_at: '2026-01-01T12:00:00Z',
        last_purchase_at: '2026-02-01T12:00:00Z',
        buyer_status: 'repeat',
      },
      {
        buyer_ref: 'bref_v1_b4nS71wYl8p1e3yGJmQx2Q',
        purchases_count: 1,
        total_spent_cents: 500,
        first_purchase_at: '2026-02-03T12:00:00Z',
        last_purchase_at: '2026-02-03T12:00:00Z',
        buyer_status: 'new',
      },
    ]
    server.use(http.get(`${BASE}/v1/seller/buyers`, () => HttpResponse.json(fixture)))

    const result = await makeClient().seller.buyers.list()

    expect(result).toHaveLength(2)
    expect(result[0]!.buyer_ref).toBe('bref_v1_Cm9kQZ0W1rKq7c0g0m5b0A')
    expect(result[0]!.purchases_count).toBe(3)
    expect(result[1]!.buyer_status).toBe('new')
  })

  it('returns an empty array when no buyers exist', async () => {
    server.use(http.get(`${BASE}/v1/seller/buyers`, () => HttpResponse.json([])))

    const result = await makeClient().seller.buyers.list()

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/buyers`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.buyers.list()).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/buyers`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().seller.buyers.list()).rejects.toThrow(ForbiddenError)
  })
})
