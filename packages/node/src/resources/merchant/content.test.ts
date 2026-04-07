import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError, decodeContentFields } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { contentResponseFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const STORE_ID = 'store-123'

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
// merchant.content.list
// ---------------------------------------------------------------------------

describe('merchant.content.list', () => {
  it('returns a paginated list of content items', async () => {
    const fixture = {
      data: [contentResponseFixture()],
      pagination: { page: 1, per_page: 25, total: 1 },
    }
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/content`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.content.list(STORE_ID)

    expect(result.data).toHaveLength(1)
    expect(result.pagination).toBeDefined()
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/content`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.content.list(STORE_ID)).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// merchant.content.create
// ---------------------------------------------------------------------------

describe('merchant.content.create', () => {
  it('returns the created content item', async () => {
    const fixture = contentResponseFixture()
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/content`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.content.create(STORE_ID, {
      content_type: 'markdown',
      title: 'Test Post',
      content_body: '# Hello',
      price_cents: 500,
      visibility: 'public',
    })

    expect(result).toEqual(decodeContentFields(fixture))
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/content`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().merchant.content.create(STORE_ID, {
        content_type: 'markdown',
        title: 'Test',
        content_body: 'body',
        price_cents: 100,
        visibility: 'public',
      }),
    ).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// merchant.content.get
// ---------------------------------------------------------------------------

describe('merchant.content.get', () => {
  it('returns a single content item by ID', async () => {
    const fixture = contentResponseFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/content/${fixture.id}`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.content.get(STORE_ID, fixture.id)

    expect(result).toEqual(decodeContentFields(fixture))
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/content/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().merchant.content.get(STORE_ID, 'missing-id')).rejects.toThrow(
      NotFoundError,
    )
  })
})

// ---------------------------------------------------------------------------
// merchant.content.update
// ---------------------------------------------------------------------------

describe('merchant.content.update', () => {
  it('returns the updated content item', async () => {
    const fixture = contentResponseFixture({ title: 'Updated Title' })
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE_ID}/content/${fixture.id}`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.content.update(STORE_ID, fixture.id, {
      title: 'Updated Title',
    })

    expect(result.title).toBe('Updated Title')
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE_ID}/content/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(
      makeClient().merchant.content.update(STORE_ID, 'missing-id', { title: 'New' }),
    ).rejects.toThrow(NotFoundError)
  })
})

// ---------------------------------------------------------------------------
// merchant.content.delete
// ---------------------------------------------------------------------------

describe('merchant.content.delete', () => {
  it('resolves on 204 No Content', async () => {
    server.use(
      http.delete(
        `${BASE}/v1/merchant/${STORE_ID}/content/content-id`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(
      makeClient().merchant.content.delete(STORE_ID, 'content-id'),
    ).resolves.toBeUndefined()
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE_ID}/content/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().merchant.content.delete(STORE_ID, 'missing-id')).rejects.toThrow(
      NotFoundError,
    )
  })
})

// ---------------------------------------------------------------------------
// merchant.content.search
// ---------------------------------------------------------------------------

describe('merchant.content.search', () => {
  it('returns matching content items (paginated)', async () => {
    const fixture = {
      data: [contentResponseFixture({ title: 'Matching Post' })],
      pagination: { page: 1, per_page: 25, total: 1 },
    }
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/content/search`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.content.search(STORE_ID, { title: 'Matching' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.title).toBe('Matching Post')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/content/search`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.content.search(STORE_ID, { title: 'test' })).rejects.toThrow(
      AuthError,
    )
  })
})
