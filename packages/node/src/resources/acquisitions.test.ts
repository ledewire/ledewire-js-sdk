import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, LedewireError, NotFoundError, SpendCapReachedError } from '@ledewire/core'
import { HttpClient } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  acquisitionFixture,
  acquisitionWorkFixture,
  corpusFixture,
  corpusManifestFixture,
  errorResponseFixture,
  signingKeyHistoryFixture,
  spendCapReachedErrorFixture,
} from '@ledewire/core/test-utils'
import { AcquisitionsNamespace } from './acquisitions.js'

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
  return new AcquisitionsNamespace(new HttpClient({ baseUrl: BASE, getAccessToken: () => 'tok' }))
}

// ---------------------------------------------------------------------------
// acquisitions.create
// ---------------------------------------------------------------------------

describe('acquisitions.create', () => {
  it('submits a Selection and returns the opened acquisition', async () => {
    const fixture = acquisitionFixture({ quote_state: 'pending' })
    server.use(
      http.post(`${BASE}/v1/acquisitions`, async ({ request }) => {
        const body = (await request.json()) as { urls: string[] }
        expect(body.urls).toEqual(['https://example.com/articles/1'])
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const result = await makeNamespace().create({ urls: ['https://example.com/articles/1'] })

    expect(result).toEqual(fixture)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/acquisitions`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Authentication required'), { status: 401 }),
      ),
    )

    await expect(makeNamespace().create({ urls: ['https://example.com/1'] })).rejects.toThrow(
      AuthError,
    )
  })
})

// ---------------------------------------------------------------------------
// acquisitions.get
// ---------------------------------------------------------------------------

describe('acquisitions.get', () => {
  it('returns the acquisition by id', async () => {
    const fixture = acquisitionFixture()
    server.use(http.get(`${BASE}/v1/acquisitions/acq-id-1`, () => HttpResponse.json(fixture)))

    const result = await makeNamespace().get('acq-id-1')

    expect(result).toEqual(fixture)
  })

  it('URL-encodes the acquisition id', async () => {
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq%2Fwith%2Fslashes`, () =>
        HttpResponse.json(acquisitionFixture()),
      ),
    )

    await makeNamespace().get('acq/with/slashes')
  })

  it("throws NotFoundError on 404 (not this buyer's acquisition)", async () => {
    server.use(
      http.get(`${BASE}/v1/acquisitions/missing`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not found'), { status: 404 }),
      ),
    )

    await expect(makeNamespace().get('missing')).rejects.toThrow(NotFoundError)
  })
})

// ---------------------------------------------------------------------------
// acquisitions.requote
// ---------------------------------------------------------------------------

describe('acquisitions.requote', () => {
  it('re-prices the quote and returns the acquisition (202)', async () => {
    const fixture = acquisitionFixture({ quote_state: 'pending' })
    server.use(
      http.post(`${BASE}/v1/acquisitions/acq-id-1/quote`, () =>
        HttpResponse.json(fixture, { status: 202 }),
      ),
    )

    const result = await makeNamespace().requote('acq-id-1')

    expect(result).toEqual(fixture)
  })
})

// ---------------------------------------------------------------------------
// acquisitions.acknowledgeExclusions
// ---------------------------------------------------------------------------

describe('acquisitions.acknowledgeExclusions', () => {
  it('registers the exclusions and returns the acquisition', async () => {
    const fixture = acquisitionFixture({
      quote: {
        state: 'ready',
        firm_micros: 2_000_000,
        estimated_micros: 0,
        maximum_chargeable_total_cents: 200,
        quoted_at: '2099-01-01T00:00:00Z',
        expires_at: '2099-01-02T00:00:00Z',
        exclusions_acknowledged_at: '2099-01-01T00:05:00Z',
      },
    })
    server.use(
      http.post(`${BASE}/v1/acquisitions/acq-id-1/acknowledgement`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeNamespace().acknowledgeExclusions('acq-id-1')

    expect(result.quote.exclusions_acknowledged_at).toBe('2099-01-01T00:05:00Z')
  })
})

// ---------------------------------------------------------------------------
// acquisitions.authorize
// ---------------------------------------------------------------------------

describe('acquisitions.authorize', () => {
  it('places the hold and starts the run (202)', async () => {
    const fixture = acquisitionFixture({ status: 'authorized' })
    server.use(
      http.post(`${BASE}/v1/acquisitions/acq-id-1/authorization`, () =>
        HttpResponse.json(fixture, { status: 202 }),
      ),
    )

    const result = await makeNamespace().authorize('acq-id-1')

    expect(result.status).toBe('authorized')
  })

  it('throws SpendCapReachedError on 402', async () => {
    const fixture = spendCapReachedErrorFixture()
    server.use(
      http.post(`${BASE}/v1/acquisitions/acq-id-1/authorization`, () =>
        HttpResponse.json(fixture, { status: 402 }),
      ),
    )

    const error = await makeNamespace()
      .authorize('acq-id-1')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SpendCapReachedError)
    const spendCapError = error as SpendCapReachedError
    expect(spendCapError.capCents).toBe(fixture.cap_cents)
    expect(spendCapError.spentCents).toBe(fixture.spent_cents)
    expect(spendCapError.remainingCents).toBe(fixture.remaining_cents)
    expect(spendCapError.resetsAt).toBe(fixture.resets_at)
    expect(spendCapError.bulkExempt).toBe(fixture.bulk_exempt)
  })
})

// ---------------------------------------------------------------------------
// acquisitions.listWorks
// ---------------------------------------------------------------------------

describe('acquisitions.listWorks', () => {
  it('returns per-work dispositions, including failures, from a normal 200', async () => {
    const failedWork = acquisitionWorkFixture({
      position: 2,
      line_state: 'excluded',
      purchased: false,
      delivery_state: 'undelivered',
      failure_reason: 'retrieval_failed',
      attempts: 3,
    })
    const fixture = {
      data: [acquisitionWorkFixture(), failedWork],
      pagination: {
        total: 2,
        per_page: 25,
        current_page: 1,
        total_pages: 1,
        next_page: null,
        prev_page: null,
      },
    }
    server.use(http.get(`${BASE}/v1/acquisitions/acq-id-1/works`, () => HttpResponse.json(fixture)))

    const result = await makeNamespace().listWorks('acq-id-1')

    expect(result.data).toHaveLength(2)
    expect(result.data[1]?.failure_reason).toBe('retrieval_failed')
  })

  it('sends page and per_page as query parameters', async () => {
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/works`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('page')).toBe('3')
        expect(url.searchParams.get('per_page')).toBe('50')
        return HttpResponse.json({
          data: [],
          pagination: {
            total: 0,
            per_page: 50,
            current_page: 3,
            total_pages: 3,
            next_page: null,
            prev_page: 2,
          },
        })
      }),
    )

    await makeNamespace().listWorks('acq-id-1', { page: 3, per_page: 50 })
  })
})

// ---------------------------------------------------------------------------
// acquisitions.getCorpus / buildCorpus
// ---------------------------------------------------------------------------

describe('acquisitions.getCorpus', () => {
  it('returns the corpus state', async () => {
    const fixture = corpusFixture()
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus`, () => HttpResponse.json(fixture)),
    )

    const result = await makeNamespace().getCorpus('acq-id-1')

    expect(result).toEqual(fixture)
  })

  it('never throws for a non-ready state — rebuild_required is a 200, not an error', async () => {
    const fixture = corpusFixture({ state: 'rebuild_required', download_url: null })
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus`, () => HttpResponse.json(fixture)),
    )

    const result = await makeNamespace().getCorpus('acq-id-1')

    expect(result.state).toBe('rebuild_required')
  })
})

describe('acquisitions.buildCorpus', () => {
  it('starts an assembly (202)', async () => {
    const fixture = corpusFixture({ state: 'assembling', download_url: null })
    server.use(
      http.post(`${BASE}/v1/acquisitions/acq-id-1/corpus`, () =>
        HttpResponse.json(fixture, { status: 202 }),
      ),
    )

    const result = await makeNamespace().buildCorpus('acq-id-1')

    expect(result.state).toBe('assembling')
  })

  it('is a no-op returning the existing corpus (200) when one is already downloadable', async () => {
    const fixture = corpusFixture()
    server.use(
      http.post(`${BASE}/v1/acquisitions/acq-id-1/corpus`, () => HttpResponse.json(fixture)),
    )

    const result = await makeNamespace().buildCorpus('acq-id-1')

    expect(result.state).toBe('ready')
  })
})

// ---------------------------------------------------------------------------
// acquisitions.downloadCorpus
// ---------------------------------------------------------------------------

describe('acquisitions.downloadCorpus', () => {
  it('returns a readable stream when the corpus is ready (application/gzip)', async () => {
    const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00])
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus/download`, () => {
        return new HttpResponse(bytes, {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        })
      }),
    )

    const result = await makeNamespace().downloadCorpus('acq-id-1')

    expect(result.ready).toBe(true)
    if (result.ready) {
      expect(result.body).toBeInstanceOf(ReadableStream)
      expect(result.response).toBeInstanceOf(Response)
    }
  })

  it('returns the corpus state when not ready (application/json)', async () => {
    const fixture = corpusFixture({ state: 'rebuild_required', download_url: null })
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus/download`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeNamespace().downloadCorpus('acq-id-1')

    expect(result.ready).toBe(false)
    if (!result.ready) {
      expect(result.corpus).toEqual(fixture)
    }
  })

  it('throws a LedewireError when the content-type is neither an archive nor JSON', async () => {
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus/download`, () => {
        return new HttpResponse('<html>unexpected proxy page</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      }),
    )

    await expect(makeNamespace().downloadCorpus('acq-id-1')).rejects.toThrow(LedewireError)
  })

  it('throws a LedewireError when the content-type header is missing', async () => {
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus/download`, () => {
        return new HttpResponse(new Uint8Array([0x1f, 0x8b]), { status: 200, headers: {} })
      }),
    )

    await expect(makeNamespace().downloadCorpus('acq-id-1')).rejects.toThrow(/content-type header/)
  })

  it('throws a LedewireError when an archive content-type response has no body', async () => {
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus/download`, () => {
        return new HttpResponse(null, {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        })
      }),
    )

    await expect(makeNamespace().downloadCorpus('acq-id-1')).rejects.toThrow(LedewireError)
  })

  it('recognizes application/x-gzip as a ready archive', async () => {
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus/download`, () => {
        return new HttpResponse(new Uint8Array([0x1f, 0x8b]), {
          status: 200,
          headers: { 'Content-Type': 'application/x-gzip' },
        })
      }),
    )

    const result = await makeNamespace().downloadCorpus('acq-id-1')

    expect(result.ready).toBe(true)
  })

  it('recognizes application/problem+json as the not-ready corpus state', async () => {
    const fixture = corpusFixture({ state: 'assembling', download_url: null })
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/corpus/download`, () => {
        return HttpResponse.json(fixture, {
          headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
        })
      }),
    )

    const result = await makeNamespace().downloadCorpus('acq-id-1')

    expect(result.ready).toBe(false)
    if (!result.ready) {
      expect(result.corpus).toEqual(fixture)
    }
  })
})

// ---------------------------------------------------------------------------
// acquisitions.getManifest
// ---------------------------------------------------------------------------

describe('acquisitions.getManifest', () => {
  it('returns the signed manifest', async () => {
    const fixture = corpusManifestFixture()
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/manifest`, () => HttpResponse.json(fixture)),
    )

    const result = await makeNamespace().getManifest('acq-id-1')

    expect(result).toEqual(fixture)
  })

  it('throws LedewireError on 409 when the acquisition has no manifest yet', async () => {
    server.use(
      http.get(`${BASE}/v1/acquisitions/acq-id-1/manifest`, () =>
        HttpResponse.json(
          errorResponseFixture(1010, 'No manifest yet. Ask for the corpus first.'),
          { status: 409 },
        ),
      ),
    )

    const error = await makeNamespace()
      .getManifest('acq-id-1')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(LedewireError)
    expect((error as LedewireError).statusCode).toBe(409)
  })
})

// ---------------------------------------------------------------------------
// acquisitions.signingKeyHistory
// ---------------------------------------------------------------------------

describe('acquisitions.signingKeyHistory', () => {
  it('returns the signing key history without authentication', async () => {
    const fixture = signingKeyHistoryFixture()
    server.use(
      http.get(`${BASE}/.well-known/ledewire-signing-keys.json`, () => HttpResponse.json(fixture)),
    )

    const result = await makeNamespace().signingKeyHistory()

    expect(result).toEqual(fixture)
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

describe('AcquisitionsNamespace — public endpoints skip auth', () => {
  it('signingKeyHistory sends no Authorization header and never touches a dead session', async () => {
    let authHeader: string | null = 'unset'
    server.use(
      http.get(`${BASE}/.well-known/ledewire-signing-keys.json`, ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json(signingKeyHistoryFixture())
      }),
    )
    const ns = new AcquisitionsNamespace(deadSessionHttp())

    await expect(ns.signingKeyHistory()).resolves.toBeDefined()
    expect(authHeader).toBeNull()
  })
})
