import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  contentResponseFixture,
  externalRefContentResponseFixture,
  errorResponseFixture,
  paginationMetaFixture,
} from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const STORE = 'store-id-1'

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
// seller.content.list
// ---------------------------------------------------------------------------

describe('seller.content.list', () => {
  it('returns a paginated list of content items', async () => {
    const items = [contentResponseFixture(), contentResponseFixture({ id: 'content-id-2' })]
    const fixture = { data: items, pagination: paginationMetaFixture({ total: 2 }) }
    server.use(http.get(`${BASE}/v1/merchant/${STORE}/content`, () => HttpResponse.json(fixture)))

    const result = await makeClient().seller.content.list(STORE)

    expect(result.data).toEqual(items)
    expect(result.pagination.total).toBe(2)
  })

  it('forwards page and per_page as query params', async () => {
    let capturedUrl: string | undefined
    const fixture = { data: [], pagination: paginationMetaFixture() }
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE}/content`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().seller.content.list(STORE, { page: 2, per_page: 10 })

    const url = new URL(capturedUrl!)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('per_page')).toBe('10')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE}/content`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.content.list(STORE)).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// seller.content.create
// ---------------------------------------------------------------------------

describe('seller.content.create', () => {
  it('returns the created content item', async () => {
    const fixture = contentResponseFixture()
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE}/content`, () =>
        HttpResponse.json(fixture, { status: 201 }),
      ),
    )

    const result = await makeClient().seller.content.create(STORE, {
      content_type: 'markdown',
      title: 'Test Article',
      content_body: btoa('# Test'),
      price_cents: 500,
      visibility: 'public',
    })

    expect(result).toEqual(fixture)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE}/content`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().seller.content.create(STORE, {
        content_type: 'markdown',
        title: 'Test',
        content_body: btoa('body'),
        price_cents: 100,
        visibility: 'public',
      }),
    ).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE}/content`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().seller.content.create(STORE, {
        content_type: 'markdown',
        title: 'Test',
        content_body: btoa('body'),
        price_cents: 100,
        visibility: 'public',
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('creates external_ref content with content_uri', async () => {
    const fixture = externalRefContentResponseFixture()
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE}/content`, () =>
        HttpResponse.json(fixture, { status: 201 }),
      ),
    )

    const result = await makeClient().seller.content.create(STORE, {
      content_type: 'external_ref',
      title: 'Intro to Machine Learning',
      content_uri: 'https://vimeo.com/987654321',
      external_identifier: 'vimeo:987654321',
      price_cents: 1500,
      visibility: 'public',
    })

    expect(result).toEqual(fixture)
    expect(result.content_type).toBe('external_ref')
    expect(result.content_body).toBeNull()
    expect(result.content_uri).toBe('https://vimeo.com/987654321')
    expect(result.external_identifier).toBe('vimeo:987654321')
  })
})

// ---------------------------------------------------------------------------
// seller.content.search
// ---------------------------------------------------------------------------

describe('seller.content.search', () => {
  it('returns matching content items (paginated)', async () => {
    const items = [contentResponseFixture()]
    const fixture = { data: items, pagination: paginationMetaFixture() }
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE}/content/search`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().seller.content.search(STORE, {
      metadata: { author: 'Alice' },
    })

    expect(result.data).toEqual(items)
  })

  it('forwards page and per_page as query params', async () => {
    let capturedUrl: string | undefined
    const fixture = { data: [], pagination: paginationMetaFixture() }
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE}/content/search`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().seller.content.search(
      STORE,
      { metadata: { tag: 'js' } },
      { page: 2, per_page: 10 },
    )

    const url = new URL(capturedUrl!)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('per_page')).toBe('10')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE}/content/search`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().seller.content.search(STORE, { metadata: { author: 'Alice' } }),
    ).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// seller.content.get
// ---------------------------------------------------------------------------

describe('seller.content.get', () => {
  it('returns a single content item by id', async () => {
    const fixture = contentResponseFixture()
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE}/content/${fixture.id}`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().seller.content.get(STORE, fixture.id)

    expect(result).toEqual(fixture)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE}/content/content-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.content.get(STORE, 'content-id-1')).rejects.toThrow(AuthError)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE}/content/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().seller.content.get(STORE, 'missing-id')).rejects.toThrow(
      NotFoundError,
    )
  })
})

// ---------------------------------------------------------------------------
// seller.content.update
// ---------------------------------------------------------------------------

describe('seller.content.update', () => {
  it('returns the updated content item', async () => {
    const fixture = contentResponseFixture({ title: 'Updated Title', price_cents: 750 })
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE}/content/${fixture.id}`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().seller.content.update(STORE, fixture.id, {
      title: 'Updated Title',
      price_cents: 750,
    })

    expect(result).toEqual(fixture)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE}/content/content-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().seller.content.update(STORE, 'content-id-1', { title: 'New' }),
    ).rejects.toThrow(AuthError)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE}/content/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not found'), { status: 404 }),
      ),
    )

    await expect(
      makeClient().seller.content.update(STORE, 'missing-id', { title: 'New' }),
    ).rejects.toThrow(NotFoundError)
  })

  it('updates external_ref content_uri and external_identifier', async () => {
    const fixture = externalRefContentResponseFixture({
      content_uri: 'https://vimeo.com/111222333',
      external_identifier: 'vimeo:111222333',
    })
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE}/content/${fixture.id}`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().seller.content.update(STORE, fixture.id, {
      content_uri: 'https://vimeo.com/111222333',
      external_identifier: 'vimeo:111222333',
    })

    expect(result.content_uri).toBe('https://vimeo.com/111222333')
    expect(result.external_identifier).toBe('vimeo:111222333')
  })
})

// ---------------------------------------------------------------------------
// seller.content.delete
// ---------------------------------------------------------------------------

describe('seller.content.delete', () => {
  it('resolves on 204 No Content', async () => {
    server.use(
      http.delete(
        `${BASE}/v1/merchant/${STORE}/content/content-id-1`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(makeClient().seller.content.delete(STORE, 'content-id-1')).resolves.toBeUndefined()
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE}/content/content-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.content.delete(STORE, 'content-id-1')).rejects.toThrow(
      AuthError,
    )
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE}/content/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().seller.content.delete(STORE, 'missing-id')).rejects.toThrow(
      NotFoundError,
    )
  })
})
