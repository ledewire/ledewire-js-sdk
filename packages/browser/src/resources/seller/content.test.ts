import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, NotFoundError, MemoryTokenStorage, decodeContentFields } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  authTokenFixture,
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
// seller.loginWithApiKey
// ---------------------------------------------------------------------------

describe('seller.loginWithApiKey', () => {
  it('returns the token response', async () => {
    const fixture = authTokenFixture()
    server.use(http.post(`${BASE}/v1/auth/login/api-key`, () => HttpResponse.json(fixture)))

    const result = await makeClient().seller.loginWithApiKey({ key: 'test-api-key' })

    expect(result).toEqual(fixture)
  })

  it('stores tokens automatically after successful login', async () => {
    const fixture = authTokenFixture({ access_token: 'api-key-token' })
    server.use(http.post(`${BASE}/v1/auth/login/api-key`, () => HttpResponse.json(fixture)))

    const storage = new MemoryTokenStorage()
    const client = init({ apiKey: 'test-api-key', storage })
    await client.seller.loginWithApiKey({ key: 'test-api-key' })

    expect(storage.getTokens()?.accessToken).toBe('api-key-token')
  })

  it('sends key and secret when both are provided', async () => {
    let capturedBody: unknown = null
    const fixture = authTokenFixture()
    server.use(
      http.post(`${BASE}/v1/auth/login/api-key`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().seller.loginWithApiKey({ key: 'my-key', secret: 'my-secret' })

    expect(capturedBody).toEqual({ key: 'my-key', secret: 'my-secret' })
  })

  it('sends only key when secret is omitted (view access)', async () => {
    let capturedBody: unknown = null
    const fixture = authTokenFixture()
    server.use(
      http.post(`${BASE}/v1/auth/login/api-key`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().seller.loginWithApiKey({ key: 'my-key' })

    expect(capturedBody).toEqual({ key: 'my-key' })
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/login/api-key`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Invalid API key'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.loginWithApiKey({ key: 'bad-key' })).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// seller.content.list
// ---------------------------------------------------------------------------

describe('seller.content.list', () => {
  it('returns an array of content items', async () => {
    const items = [contentResponseFixture(), contentResponseFixture({ id: 'content-id-2' })]
    server.use(http.get(`${BASE}/v1/seller/content`, () => HttpResponse.json(items)))

    const result = await makeClient().seller.content.list()

    expect(result).toEqual(items.map(decodeContentFields))
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

    expect(result).toEqual(items.map(decodeContentFields))
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

  it('sends the correct request body for external_identifier search', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/seller/content/search`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json([])
      }),
    )

    await makeClient().seller.content.search({ external_identifier: 'vimeo:123456789' })

    expect(capturedBody).toEqual({ external_identifier: 'vimeo:123456789' })
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

    expect(result).toEqual(decodeContentFields(fixture))
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
