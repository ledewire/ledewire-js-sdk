import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { errorResponseFixture } from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const STORE_ID = 'store-id-1'

const server = createTestServer()
beforeAll(() => { server.listen({ onUnhandledRequest: 'error' }) })
afterEach(() => { server.resetHandlers() })
afterAll(() => { server.close() })

function makeClient() {
  return createClient()
}

// ---------------------------------------------------------------------------
// merchant.config.get
// ---------------------------------------------------------------------------

describe('merchant.config.get', () => {
  it('returns the store configuration', async () => {
    const fixture = { google_client_id: 'goog-client-id-123' }
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/config`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.config.get(STORE_ID)

    expect(result).toEqual(fixture)
  })

  it('returns config with optional google_client_id', async () => {
    const fixture = { google_client_id: 'goog-client-id-123' }
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/config`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.config.get(STORE_ID)

    expect(result.google_client_id).toBe('goog-client-id-123')
  })

  it('handles config with no google_client_id', async () => {
    const fixture = {}
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/config`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().merchant.config.get(STORE_ID)

    expect(result.google_client_id).toBeUndefined()
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/config`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.config.get(STORE_ID)).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/config`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.config.get(STORE_ID)).rejects.toThrow(ForbiddenError)
  })
})
