import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { errorResponseFixture, purchaseResponseFixture } from '@ledewire/core/test-utils'
import { createClient } from '../client.js'

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
// purchases.create
// ---------------------------------------------------------------------------

describe('purchases.create', () => {
  it('returns the completed purchase record', async () => {
    const fixture = purchaseResponseFixture()
    server.use(http.post(`${BASE}/v1/purchases`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.create({
      content_id: 'content-id-1',
      price_cents: 500,
    })

    expect(result).toEqual(fixture)
  })

  it('returns a purchase with completed status', async () => {
    const fixture = purchaseResponseFixture({ status: 'completed' })
    server.use(http.post(`${BASE}/v1/purchases`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.create({
      content_id: 'content-id-1',
      price_cents: 500,
    })

    expect(result.status).toBe('completed')
    expect(result.content_id).toBe('content-id-1')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/purchases`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
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

// ---------------------------------------------------------------------------
// purchases.list
// ---------------------------------------------------------------------------

describe('purchases.list', () => {
  it('returns all purchases for the authenticated buyer', async () => {
    const fixture = [purchaseResponseFixture(), purchaseResponseFixture({ id: 'purchase-id-2' })]
    server.use(http.get(`${BASE}/v1/purchases`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.list()

    expect(result).toEqual(fixture)
    expect(result).toHaveLength(2)
  })

  it('returns an empty list when no purchases exist', async () => {
    server.use(http.get(`${BASE}/v1/purchases`, () => HttpResponse.json([])))

    const result = await makeClient().purchases.list()

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
      ),
    )

    await expect(makeClient().purchases.list()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// purchases.get
// ---------------------------------------------------------------------------

describe('purchases.get', () => {
  it('returns a single purchase by ID', async () => {
    const fixture = purchaseResponseFixture()
    server.use(http.get(`${BASE}/v1/purchases/purchase-id-1`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.get('purchase-id-1')

    expect(result).toEqual(fixture)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Purchase not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().purchases.get('missing-id')).rejects.toThrow(NotFoundError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases/any-id`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
      ),
    )

    await expect(makeClient().purchases.get('any-id')).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// purchases.verify
// ---------------------------------------------------------------------------

describe('purchases.verify', () => {
  it('returns purchased: true when the user has purchased the content', async () => {
    const fixture = { purchased: true }
    server.use(
      http.get(`${BASE}/v1/purchase/verify`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('content_id')).toBe('content-123')
        return HttpResponse.json(fixture)
      }),
    )

    const result = await makeClient().purchases.verify('content-123')

    expect(result).toEqual({ purchased: true })
  })

  it('returns purchased: false when the user has not purchased the content', async () => {
    const fixture = { purchased: false }
    server.use(http.get(`${BASE}/v1/purchase/verify`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.verify('content-456')

    expect(result).toEqual({ purchased: false })
  })

  it('URL-encodes the content_id parameter', async () => {
    server.use(
      http.get(`${BASE}/v1/purchase/verify`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('content_id')).toBe('content/with/slashes')
        return HttpResponse.json({ purchased: false })
      }),
    )

    await makeClient().purchases.verify('content/with/slashes')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/purchase/verify`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
      ),
    )

    await expect(makeClient().purchases.verify('content-id')).rejects.toThrow(AuthError)
  })

  it('throws NotFoundError on 404 (content not found)', async () => {
    server.use(
      http.get(`${BASE}/v1/purchase/verify`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Content not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().purchases.verify('missing-content')).rejects.toThrow(NotFoundError)
  })
})
