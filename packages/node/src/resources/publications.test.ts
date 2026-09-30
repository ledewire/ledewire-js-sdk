import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, HttpClient } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { publicationFixture, publicationWorkListFixture } from '@ledewire/core/test-utils'
import { PublicationsNamespace } from './publications.js'

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

function makeNamespace() {
  return new PublicationsNamespace(new HttpClient({ baseUrl: BASE, getAccessToken: () => 'tok' }))
}

// ---------------------------------------------------------------------------
// publications.list
// ---------------------------------------------------------------------------

describe('publications.list', () => {
  it('returns a paginated list of publications', async () => {
    const fixture = {
      data: [publicationFixture()],
      pagination: {
        total: 1,
        per_page: 25,
        current_page: 1,
        total_pages: 1,
        next_page: null,
        prev_page: null,
      },
    }
    server.use(http.get(`${BASE}/v1/publications`, () => HttpResponse.json(fixture)))

    const result = await makeNamespace().list()

    expect(result).toEqual(fixture)
  })

  it('sends page and per_page as query parameters', async () => {
    server.use(
      http.get(`${BASE}/v1/publications`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('page')).toBe('2')
        expect(url.searchParams.get('per_page')).toBe('10')
        return HttpResponse.json({
          data: [],
          pagination: {
            total: 0,
            per_page: 10,
            current_page: 2,
            total_pages: 0,
            next_page: null,
            prev_page: null,
          },
        })
      }),
    )

    await makeNamespace().list({ page: 2, per_page: 10 })
  })
})

// ---------------------------------------------------------------------------
// publications.listWorks
// ---------------------------------------------------------------------------

describe('publications.listWorks', () => {
  it("returns a page of a publication's works", async () => {
    const fixture = publicationWorkListFixture()
    server.use(http.get(`${BASE}/v1/publications/pub-id-1/works`, () => HttpResponse.json(fixture)))

    const result = await makeNamespace().listWorks('pub-id-1')

    expect(result).toEqual(fixture)
  })

  it('sends from, to, cursor and limit as query parameters', async () => {
    server.use(
      http.get(`${BASE}/v1/publications/pub-id-1/works`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('from')).toBe('2026-01-01')
        expect(url.searchParams.get('to')).toBe('2026-01-31')
        expect(url.searchParams.get('cursor')).toBe('cursor-abc')
        expect(url.searchParams.get('limit')).toBe('500')
        return HttpResponse.json(publicationWorkListFixture())
      }),
    )

    await makeNamespace().listWorks('pub-id-1', {
      from: '2026-01-01',
      to: '2026-01-31',
      cursor: 'cursor-abc',
      limit: 500,
    })
  })

  it('URL-encodes the publication id path segment', async () => {
    server.use(
      http.get(`${BASE}/v1/publications/pub%2Fwith%2Fslashes/works`, () =>
        HttpResponse.json(publicationWorkListFixture()),
      ),
    )

    await makeNamespace().listWorks('pub/with/slashes')
  })

  it('reports date_filter: unsupported on an empty page rather than treating it as out of range', async () => {
    const fixture = publicationWorkListFixture({
      date_filter: 'unsupported',
      works: [],
      next_cursor: null,
    })
    server.use(http.get(`${BASE}/v1/publications/pub-id-1/works`, () => HttpResponse.json(fixture)))

    const result = await makeNamespace().listWorks('pub-id-1', { from: '2026-01-01' })

    expect(result.date_filter).toBe('unsupported')
    expect(result.works).toEqual([])
  })
})

/** An HttpClient whose session is dead: any attempt to read or refresh the token throws. */
function deadSessionHttp() {
  return new HttpClient({
    baseUrl: BASE,
    getAccessToken: () => {
      throw new AuthError('Token refresh failed')
    },
    onUnauthorized: () => {
      throw new AuthError('Token refresh failed')
    },
  })
}

describe('PublicationsNamespace — public endpoints skip auth', () => {
  it('list sends no Authorization header and never touches a dead session', async () => {
    let authHeader: string | null = 'unset'
    server.use(
      http.get(`${BASE}/v1/publications`, ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, per_page: 25, current_page: 1, total_pages: 0 },
        })
      }),
    )
    const ns = new PublicationsNamespace(deadSessionHttp())

    await expect(ns.list()).resolves.toBeDefined()
    expect(authHeader).toBeNull()
  })

  it('listWorks sends no Authorization header and never touches a dead session', async () => {
    let authHeader: string | null = 'unset'
    server.use(
      http.get(`${BASE}/v1/publications/pub-1/works`, ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json(publicationWorkListFixture())
      }),
    )
    const ns = new PublicationsNamespace(deadSessionHttp())

    await expect(ns.listWorks('pub-1')).resolves.toBeDefined()
    expect(authHeader).toBeNull()
  })
})
