import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  contentResponseFixture,
  externalRefContentResponseFixture,
  errorResponseFixture,
} from '@ledewire/core/test-utils'
import { init } from '../../client.js'

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

// ---------------------------------------------------------------------------
// seller.content.list
// ---------------------------------------------------------------------------

describe('seller.content.list', () => {
  it('returns an array of content items', async () => {
    const items = [contentResponseFixture(), contentResponseFixture({ id: 'content-id-2' })]
    server.use(http.get(`${BASE}/v1/seller/content`, () => HttpResponse.json(items)))

    const result = await makeClient().seller.content.list()

    expect(result).toEqual(items)
    expect(result).toHaveLength(2)
  })

  it('returns an empty array when no content exists', async () => {
    server.use(http.get(`${BASE}/v1/seller/content`, () => HttpResponse.json([])))

    const result = await makeClient().seller.content.list()

    expect(result).toEqual([])
  })

  it('returns external_ref items with content_uri', async () => {
    const item = externalRefContentResponseFixture()
    server.use(http.get(`${BASE}/v1/seller/content`, () => HttpResponse.json([item])))

    const [result] = await makeClient().seller.content.list()

    expect(result!.content_type).toBe('external_ref')
    expect(result!.content_uri).toBe('https://vimeo.com/987654321')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/content`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.content.list()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// seller.content.search
// ---------------------------------------------------------------------------

describe('seller.content.search', () => {
  it('returns matching content items', async () => {
    const items = [contentResponseFixture()]
    server.use(http.post(`${BASE}/v1/seller/content/search`, () => HttpResponse.json(items)))

    const result = await makeClient().seller.content.search({ title: 'intro' })

    expect(result).toEqual(items)
  })

  it('sends the correct request body for title search', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/seller/content/search`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json([])
      }),
    )

    await makeClient().seller.content.search({ title: 'intro' })

    expect(capturedBody).toEqual({ title: 'intro' })
  })

  it('sends the correct request body for uri search', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/seller/content/search`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json([])
      }),
    )

    await makeClient().seller.content.search({ uri: 'vimeo.com' })

    expect(capturedBody).toEqual({ uri: 'vimeo.com' })
  })

  it('sends the correct request body for metadata search', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/seller/content/search`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json([])
      }),
    )

    await makeClient().seller.content.search({ metadata: { author: 'Alice' } })

    expect(capturedBody).toEqual({ metadata: { author: 'Alice' } })
  })

  it('sends combined title, uri, and metadata criteria', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/seller/content/search`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json([])
      }),
    )

    await makeClient().seller.content.search({
      title: 'tutorial',
      uri: 'vimeo.com',
      metadata: { category: 'ml' },
    })

    expect(capturedBody).toEqual({
      title: 'tutorial',
      uri: 'vimeo.com',
      metadata: { category: 'ml' },
    })
  })

  it('returns empty array when no content matches', async () => {
    server.use(http.post(`${BASE}/v1/seller/content/search`, () => HttpResponse.json([])))

    const result = await makeClient().seller.content.search({ title: 'nonexistent' })

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/seller/content/search`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.content.search({ title: 'x' })).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// seller.content.get
// ---------------------------------------------------------------------------

describe('seller.content.get', () => {
  it('returns a single content item by id', async () => {
    const fixture = contentResponseFixture()
    server.use(
      http.get(`${BASE}/v1/seller/content/${fixture.id}`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().seller.content.get(fixture.id)

    expect(result).toEqual(fixture)
  })

  it('returns external_ref content with content_uri', async () => {
    const fixture = externalRefContentResponseFixture()
    server.use(
      http.get(`${BASE}/v1/seller/content/${fixture.id}`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().seller.content.get(fixture.id)

    expect(result.content_type).toBe('external_ref')
    expect(result.content_uri).toBe('https://vimeo.com/987654321')
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/content/missing-id`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Content not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().seller.content.get('missing-id')).rejects.toThrow(NotFoundError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/content/content-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.content.get('content-id-1')).rejects.toThrow(AuthError)
  })
})
