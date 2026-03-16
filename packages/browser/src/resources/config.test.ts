import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { publicConfigFixture } from '@ledewire/core/test-utils'
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

// ---------------------------------------------------------------------------
// config.getPublic
// ---------------------------------------------------------------------------

describe('config.getPublic', () => {
  it('returns the public platform configuration', async () => {
    const fixture = publicConfigFixture()
    server.use(http.get(`${BASE}/v1/config/public`, () => HttpResponse.json(fixture)))

    const result = await makeClient().config.getPublic()

    expect(result).toEqual(fixture)
    expect(result.google_client_id).toBe('google-client-id-test')
  })

  it('fetches without an Authorization header when no token is stored', async () => {
    let authHeader: string | null = null
    server.use(
      http.get(`${BASE}/v1/config/public`, ({ request }) => {
        authHeader = request.headers.get('authorization')
        return HttpResponse.json(publicConfigFixture())
      }),
    )

    await makeClient().config.getPublic()

    expect(authHeader).toBeNull()
  })
})
