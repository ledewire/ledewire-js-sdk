import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { HttpClient, LedewireError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { createClient } from '../client.js'
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

// Node surfaces the header on the error it throws. These tests pin that for the
// two rate-limited endpoints a caller is most likely to back off from.
describe('Retry-After on rate-limited node calls', () => {
  it('content.search exposes retryAfter from a 429', async () => {
    server.use(
      http.post(`${BASE}/v1/content/search`, () =>
        HttpResponse.json(
          { error: { code: 429, message: 'Too many searches' } },
          { status: 429, headers: { 'Retry-After': '12' } },
        ),
      ),
    )

    const error = await createClient({ baseUrl: BASE })
      .content.search({ query: 'quantum' })
      .catch((err: unknown) => err)
    expect(error).toBeInstanceOf(LedewireError)
    expect(error).toMatchObject({ statusCode: 429, retryAfter: 12 })
  })

  it('publications.listWorks exposes retryAfter from a 429', async () => {
    server.use(
      http.get(`${BASE}/v1/publications/pub-id-1/works`, () =>
        HttpResponse.json(
          { error: { code: 429, message: 'Too many requests' } },
          { status: 429, headers: { 'Retry-After': '30' } },
        ),
      ),
    )
    const namespace = new PublicationsNamespace(
      new HttpClient({ baseUrl: BASE, getAccessToken: () => null }),
    )

    const error = await namespace.listWorks('pub-id-1').catch((err: unknown) => err)
    expect(error).toBeInstanceOf(LedewireError)
    expect(error).toMatchObject({ statusCode: 429, retryAfter: 30 })
  })
})
