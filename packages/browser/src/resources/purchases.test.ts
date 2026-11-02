import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError, SpendCapReachedError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  errorResponseFixture,
  purchaseResponseFixture,
  spendCapReachedErrorFixture,
} from '@ledewire/core/test-utils'
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

  it('returns content_body verbatim — plain UTF-8 text, never base64-decoded', async () => {
    const body = 'Café résumé — 日本語のテキスト'
    const fixture = purchaseResponseFixture({ content_body: body })
    server.use(http.post(`${BASE}/v1/purchases`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.create({
      content_id: 'content-id-1',
      price_cents: 500,
    })

    expect(result.content_body).toBe(body)
  })

  it('returns content_uri for a remotely-hosted deliverable', async () => {
    const fixture = purchaseResponseFixture({
      content_uri: 'https://cdn.example.com/videos/content-id-1.mp4',
    })
    delete (fixture as { content_body?: string }).content_body
    server.use(http.post(`${BASE}/v1/purchases`, () => HttpResponse.json(fixture)))

    const result = await makeClient().purchases.create({
      content_id: 'content-id-1',
      price_cents: 500,
    })

    expect(result.content_uri).toBe('https://cdn.example.com/videos/content-id-1.mp4')
    expect(result.content_body).toBeUndefined()
  })

  it('throws SpendCapReachedError with the cap fields populated on a 402', async () => {
    const fixture = spendCapReachedErrorFixture()
    server.use(http.post(`${BASE}/v1/purchases`, () => HttpResponse.json(fixture, { status: 402 })))

    const err = await makeClient()
      .purchases.create({ content_id: 'content-id-1', price_cents: 500 })
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(SpendCapReachedError)
    const spendCapErr = err as SpendCapReachedError
    expect(spendCapErr.capCents).toBe(fixture.cap_cents)
    expect(spendCapErr.spentCents).toBe(fixture.spent_cents)
    expect(spendCapErr.remainingCents).toBe(fixture.remaining_cents)
    expect(spendCapErr.resetsAt).toBe(fixture.resets_at)
    expect(spendCapErr.bulkExempt).toBe(fixture.bulk_exempt)
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

// ---------------------------------------------------------------------------
// purchases.licenseDocument
// ---------------------------------------------------------------------------

describe('purchases.licenseDocument', () => {
  const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x00, 0xff])

  it('returns a PDF document as bytes with its content type', async () => {
    let receivedAccept = ''
    server.use(
      http.get(`${BASE}/v1/purchases/purchase-id-1/license_document`, ({ request }) => {
        receivedAccept = request.headers.get('Accept') ?? ''
        return new HttpResponse(PDF_BYTES, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="licence.pdf"',
          },
        })
      }),
    )

    const doc = await makeClient().purchases.licenseDocument('purchase-id-1')

    expect(doc.contentType).toBe('application/pdf')
    expect(doc.body).toBeInstanceOf(ArrayBuffer)
    expect(new Uint8Array(doc.body)).toEqual(PDF_BYTES)
    expect(receivedAccept).toBe('*/*')
  })

  it('returns a markdown document whose bytes decode as UTF-8 text', async () => {
    const markdown = '# Terms for SEC filings\n\nPublic domain — no licence needed.\n'
    server.use(
      http.get(
        `${BASE}/v1/purchases/purchase-id-1/license_document`,
        () =>
          new HttpResponse(markdown, {
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
          }),
      ),
    )

    const doc = await makeClient().purchases.licenseDocument('purchase-id-1')

    expect(doc.contentType).toBe('text/markdown; charset=utf-8')
    expect(new TextDecoder().decode(doc.body)).toBe(markdown)
  })

  it('reports application/octet-stream when the response names no content type', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases/purchase-id-1/license_document`, () => {
        const response = new HttpResponse(PDF_BYTES)
        response.headers.delete('Content-Type')
        return response
      }),
    )

    const doc = await makeClient().purchases.licenseDocument('purchase-id-1')

    expect(doc.contentType).toBe('application/octet-stream')
  })

  it('encodes the purchase id in the path', async () => {
    server.use(
      http.get(
        `${BASE}/v1/purchases/a%2Fb/license_document`,
        () => new HttpResponse('ok', { headers: { 'Content-Type': 'text/markdown' } }),
      ),
    )

    const doc = await makeClient().purchases.licenseDocument('a/b')

    expect(doc.contentType).toBe('text/markdown')
  })

  it('throws ForbiddenError on 403 (not a buyer credential)', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases/purchase-id-1/license_document`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Invalid Role'), { status: 403 }),
      ),
    )

    await expect(makeClient().purchases.licenseDocument('purchase-id-1')).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('throws NotFoundError on 404 (no captured document for this purchase)', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases/missing/license_document`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'License document (missing) was not found'), {
          status: 404,
        }),
      ),
    )

    await expect(makeClient().purchases.licenseDocument('missing')).rejects.toThrow(NotFoundError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/purchases/purchase-id-1/license_document`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().purchases.licenseDocument('purchase-id-1')).rejects.toThrow(AuthError)
  })
})
