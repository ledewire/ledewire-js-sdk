import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, LedewireError, MemoryTokenStorage, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  authTokenFixture,
  errorResponseFixture,
  contentWithAccessFixture,
  contentSearchResultFixture,
  brokeredContentSearchResultFixture,
} from '@ledewire/core/test-utils'
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
// content.getWithAccess
// ---------------------------------------------------------------------------

describe('content.getWithAccess', () => {
  it('returns content with access information', async () => {
    const fixture = contentWithAccessFixture()
    server.use(
      http.get(`${BASE}/v1/content/content-id-1/with-access`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().content.getWithAccess('content-id-1')

    expect(result).toEqual(fixture)
  })

  it('includes access_info in the response', async () => {
    const fixture = contentWithAccessFixture()
    server.use(
      http.get(`${BASE}/v1/content/content-id-1/with-access`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().content.getWithAccess('content-id-1')

    expect(result.access_info).toBeDefined()
    expect(result.access_info.has_purchased).toBe(false)
    expect(result.access_info.next_required_action).toBe('purchase')
  })

  it('forwards optional user_id query param', async () => {
    const fixture = contentWithAccessFixture()
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/v1/content/content-id-1/with-access`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().content.getWithAccess('content-id-1', 'user-id-99')

    expect(capturedUrl).toContain('user_id=user-id-99')
  })

  it('does not add user_id param when omitted', async () => {
    const fixture = contentWithAccessFixture()
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/v1/content/content-id-1/with-access`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().content.getWithAccess('content-id-1')

    expect(capturedUrl).not.toContain('user_id')
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/content/missing-id/with-access`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Content not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().content.getWithAccess('missing-id')).rejects.toThrow(NotFoundError)
  })
})

// ---------------------------------------------------------------------------
// content.search
// ---------------------------------------------------------------------------

describe('content.search', () => {
  const page = {
    data: [
      {
        id: 'content-id-1',
        title: 'Quantum Guide',
        teaser: 'A primer',
        price_cents: 500,
        content_type: 'markdown',
        store_id: 'store-id-1',
        store_name: 'Test Store',
        tags: [],
        authors: [],
        abstract: null,
        doi: null,
        publication_date: null,
        last_modified_date: null,
        citation_count: 0,
        publication: null,
      },
    ],
    next_cursor: null,
    partial_results: false,
    unavailable_providers: [],
  }

  it('posts the search criteria and returns one page of results', async () => {
    let receivedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/content/search`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(page)
      }),
    )

    const result = await makeClient().content.search({ query: 'quantum', max_price_cents: 500 })

    expect(receivedBody).toEqual({ query: 'quantum', max_price_cents: 500 })
    expect(result.data[0]?.title).toBe('Quantum Guide')
    expect(result.next_cursor).toBeNull()
  })

  it('sends the cursor from the previous page to fetch the next one', async () => {
    let receivedBody: unknown = null
    server.use(
      http.post(`${BASE}/v1/content/search`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({ ...page, next_cursor: null })
      }),
    )

    await makeClient().content.search({ query: 'quantum', cursor: 'cursor-2' })

    expect(receivedBody).toEqual({ query: 'quantum', cursor: 'cursor-2' })
  })

  it('throws LedewireError with code 422 on a stale cursor', async () => {
    server.use(
      http.post(`${BASE}/v1/content/search`, () =>
        HttpResponse.json(
          { error: { code: 422, message: 'Cursor expired', type: 'client_error' } },
          { status: 422 },
        ),
      ),
    )

    const error = await makeClient()
      .content.search({ cursor: 'stale' })
      .catch((err: unknown) => err)
    expect(error).toBeInstanceOf(LedewireError)
    expect(error).toMatchObject({ code: 422, statusCode: 422 })
  })

  it('refreshes a stored session once on 401 and retries with the new token', async () => {
    const authHeaders: string[] = []
    let refreshCalls = 0
    server.use(
      http.post(`${BASE}/v1/content/search`, ({ request }) => {
        const header = request.headers.get('Authorization') ?? ''
        authHeaders.push(header)
        if (header === 'Bearer stale-access') {
          return HttpResponse.json(
            { error: { code: 401, message: 'Unauthorized' } },
            { status: 401 },
          )
        }
        return HttpResponse.json(page)
      }),
      http.post(`${BASE}/v1/auth/token/refresh`, () => {
        refreshCalls += 1
        return HttpResponse.json(authTokenFixture({ access_token: 'refreshed-access' }))
      }),
    )

    const storage = new MemoryTokenStorage()
    storage.setTokens({
      accessToken: 'stale-access',
      refreshToken: 'valid-refresh',
      expiresAt: Date.now() + 60 * 60 * 1000,
    })
    const client = createClient({ storage })

    const result = await client.content.search({ query: 'quantum' })

    expect(result.data[0]?.title).toBe('Quantum Guide')
    expect(authHeaders).toEqual(['Bearer stale-access', 'Bearer refreshed-access'])
    expect(refreshCalls).toBe(1)
  })

  it('throws AuthError when a 401 cannot be recovered because the refresh fails', async () => {
    server.use(
      http.post(`${BASE}/v1/content/search`, () =>
        HttpResponse.json({ error: { code: 401, message: 'Unauthorized' } }, { status: 401 }),
      ),
      http.post(`${BASE}/v1/auth/token/refresh`, () =>
        HttpResponse.json(
          { error: { code: 401, message: 'Refresh token revoked' } },
          { status: 401 },
        ),
      ),
    )

    const storage = new MemoryTokenStorage()
    storage.setTokens({
      accessToken: 'stale-access',
      refreshToken: 'revoked-refresh',
      expiresAt: Date.now() + 60 * 60 * 1000,
    })

    await expect(createClient({ storage }).content.search({ query: 'quantum' })).rejects.toThrow(
      AuthError,
    )
  })

  it('throws AuthError on 401 when there is no session to refresh', async () => {
    server.use(
      http.post(`${BASE}/v1/content/search`, () =>
        HttpResponse.json({ error: { code: 401, message: 'Unauthorized' } }, { status: 401 }),
      ),
    )

    await expect(makeClient().content.search({ query: 'quantum' })).rejects.toThrow(AuthError)
  })

  it('surfaces a 429 with its status, so the caller can wait and retry', async () => {
    server.use(
      http.post(`${BASE}/v1/content/search`, () =>
        HttpResponse.json(
          { error: { code: 429, message: 'Too many searches' } },
          { status: 429, headers: { 'Retry-After': '12' } },
        ),
      ),
    )

    const error = await makeClient()
      .content.search({ query: 'quantum' })
      .catch((err: unknown) => err)
    expect(error).toBeInstanceOf(LedewireError)
    expect(error).toMatchObject({ code: 429, statusCode: 429 })
  })

  it('returns brokered results with the Publication they name, and Store results with none', async () => {
    const page = {
      data: [brokeredContentSearchResultFixture(), contentSearchResultFixture()],
      next_cursor: null,
      partial_results: false,
      unavailable_providers: [],
    }
    server.use(http.post(`${BASE}/v1/content/search`, () => HttpResponse.json(page)))

    const result = await makeClient().content.search({ query: 'quantum' })

    expect(result.data[0]?.publication).toEqual({
      id: 'pub-id-1',
      name: 'Test Publication',
      bulk_licensable: true,
      topics: ['business-and-finance'],
    })
    expect(result.data[1]?.publication).toBeNull()
  })

  it('returns an envelope with partial_results and unavailable_providers unchanged', async () => {
    const page = {
      data: [contentSearchResultFixture()],
      next_cursor: 'cursor-next',
      partial_results: true,
      unavailable_providers: ['tollbit'],
    }
    server.use(http.post(`${BASE}/v1/content/search`, () => HttpResponse.json(page)))

    const result = await makeClient().content.search({ query: 'quantum' })

    expect(result).toEqual(page)
    expect(result.next_cursor).toBe('cursor-next')
  })
})
