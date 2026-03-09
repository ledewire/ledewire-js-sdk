import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { errorResponseFixture, purchaseResponseFixture } from '@ledewire/core/test-utils'
import { init } from '../client.js'

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
  return init({ apiKey: 'test-api-key' })
}

describe('purchases.create', () => {
  it('returns the completed purchase', async () => {
    const fixture = purchaseResponseFixture()
    server.use(http.post(`${BASE}/v1/purchases`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.create({
      content_id: 'content-id-1',
      price_cents: 500,
    })

    expect(result).toEqual(fixture)
    expect(result.status).toBe('completed')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/purchases`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().purchases.create({ content_id: 'c', price_cents: 100 }),
    ).rejects.toThrow(AuthError)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.post(`${BASE}/v1/purchases`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Content not found'), { status: 404 }),
      ),
    )

    await expect(
      makeClient().purchases.create({ content_id: 'missing', price_cents: 100 }),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('purchases.list', () => {
  it('returns all purchases', async () => {
    const fixture = [purchaseResponseFixture(), purchaseResponseFixture({ id: 'purchase-id-2' })]
    server.use(http.get(`${BASE}/v1/purchases`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.list()

    expect(result).toEqual(fixture)
    expect(result).toHaveLength(2)
  })

  it('returns an empty list', async () => {
    server.use(http.get(`${BASE}/v1/purchases`, () => HttpResponse.json([])))

    expect(await makeClient().purchases.list()).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().purchases.list()).rejects.toThrow(AuthError)
  })
})

describe('purchases.get', () => {
  it('returns a single purchase by ID', async () => {
    const fixture = purchaseResponseFixture()
    server.use(http.get(`${BASE}/v1/purchases/purchase-id-1`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.get('purchase-id-1')

    expect(result).toEqual(fixture)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases/missing`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().purchases.get('missing')).rejects.toThrow(NotFoundError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases/any`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().purchases.get('any')).rejects.toThrow(AuthError)
  })
})
