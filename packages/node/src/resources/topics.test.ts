import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { HttpClient } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { TopicsNamespace } from './topics.js'

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
  return new TopicsNamespace(new HttpClient({ baseUrl: BASE, getAccessToken: () => 'tok' }))
}

// ---------------------------------------------------------------------------
// topics.list
// ---------------------------------------------------------------------------

describe('topics.list', () => {
  it('returns the Topic directory with each publication count', async () => {
    const fixture = {
      data: [
        { slug: 'sports', iab_id: '483', name: 'Sports', publication_count: 4 },
        { slug: 'travel', iab_id: '553', name: 'Travel', publication_count: 0 },
      ],
      iab_version: '3.1',
      unclassified_count: 2,
    }
    server.use(http.get(`${BASE}/v1/topics`, () => HttpResponse.json(fixture)))

    const result = await makeNamespace().list()

    expect(result).toEqual(fixture)
  })

  it('sends no credentials, since the directory is public', async () => {
    let authorization: string | null = 'unset'
    server.use(
      http.get(`${BASE}/v1/topics`, ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json({ data: [], iab_version: '3.1', unclassified_count: 0 })
      }),
    )

    await makeNamespace().list()

    expect(authorization).toBeNull()
  })
})
