import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { errorResponseFixture } from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

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
// seller.config.get
// ---------------------------------------------------------------------------

describe('seller.config.get', () => {
  it('returns the store configuration', async () => {
    const fixture = {
      google_client_id: '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com',
    }
    server.use(http.get(`${BASE}/v1/seller/config`, () => HttpResponse.json(fixture)))

    const result = await makeClient().seller.config.get()

    expect(result.google_client_id).toBe(
      '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com',
    )
  })

  it('returns config with optional google_client_id', async () => {
    const fixture = { google_client_id: undefined }
    server.use(http.get(`${BASE}/v1/seller/config`, () => HttpResponse.json(fixture)))

    const result = await makeClient().seller.config.get()

    expect(result.google_client_id).toBeUndefined()
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/config`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().seller.config.get()).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/seller/config`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().seller.config.get()).rejects.toThrow(ForbiddenError)
  })
})
