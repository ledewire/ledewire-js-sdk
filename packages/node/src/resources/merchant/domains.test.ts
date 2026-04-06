import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { merchantDomainVerificationFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const STORE_ID = 'store-id-1'
const DOMAIN_ID = 'domain-id-1'

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
// merchant.domains.list
// ---------------------------------------------------------------------------

describe('merchant.domains.list', () => {
  it('returns an array of domain verification records', async () => {
    const records = [
      merchantDomainVerificationFixture(),
      merchantDomainVerificationFixture({
        id: 'domain-id-2',
        domain: 'blog.example.com',
        status: 'verified',
        verified_at: '2099-01-02T00:00:00Z',
      }),
    ]
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/domains`, () => HttpResponse.json(records)),
    )

    const result = await makeClient().merchant.domains.list(STORE_ID)

    expect(result).toEqual(records)
    expect(result).toHaveLength(2)
  })

  it('returns an empty array when no domains are registered', async () => {
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/domains`, () => HttpResponse.json([])))

    const result = await makeClient().merchant.domains.list(STORE_ID)

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/domains`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.domains.list(STORE_ID)).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/domains`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.domains.list(STORE_ID)).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// merchant.domains.add
// ---------------------------------------------------------------------------

describe('merchant.domains.add', () => {
  it('creates a domain verification record and returns DNS TXT instructions', async () => {
    const fixture = merchantDomainVerificationFixture()
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/domains`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const result = await makeClient().merchant.domains.add(STORE_ID, { domain: 'example.com' })

    expect(result).toEqual(fixture)
    expect(result.txt_record_name).toBeDefined()
    expect(result.txt_record_value).toBeDefined()
    expect(capturedBody).toEqual({ domain: 'example.com' })
  })

  it('strips www. prefix (server behaviour reflected in fixture)', async () => {
    const fixture = merchantDomainVerificationFixture({ domain: 'example.com' })
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/domains`, () =>
        HttpResponse.json(fixture, { status: 201 }),
      ),
    )

    const result = await makeClient().merchant.domains.add(STORE_ID, { domain: 'www.example.com' })

    expect(result.domain).toBe('example.com')
  })

  it('throws ForbiddenError on 403 (non-owner)', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/domains`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().merchant.domains.add(STORE_ID, { domain: 'example.com' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('throws on 422 when domain is already registered for the store', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/domains`, () =>
        HttpResponse.json(errorResponseFixture(4221, 'Domain already added'), { status: 422 }),
      ),
    )

    await expect(
      makeClient().merchant.domains.add(STORE_ID, { domain: 'example.com' }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// merchant.domains.remove
// ---------------------------------------------------------------------------

describe('merchant.domains.remove', () => {
  it('resolves without a value on 204', async () => {
    server.use(
      http.delete(
        `${BASE}/v1/merchant/${STORE_ID}/domains/${DOMAIN_ID}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(makeClient().merchant.domains.remove(STORE_ID, DOMAIN_ID)).resolves.toBeUndefined()
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE_ID}/domains/${DOMAIN_ID}`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().merchant.domains.remove(STORE_ID, DOMAIN_ID)).rejects.toThrow(
      NotFoundError,
    )
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE_ID}/domains/${DOMAIN_ID}`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.domains.remove(STORE_ID, DOMAIN_ID)).rejects.toThrow(
      ForbiddenError,
    )
  })
})
