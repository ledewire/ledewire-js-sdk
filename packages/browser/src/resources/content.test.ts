import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { ForbiddenError, NotFoundError, decodeContentFields } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  errorResponseFixture,
  contentWithAccessFixture,
  contentAccessInfoFixture,
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

describe('content.getWithAccess', () => {
  it('returns content with access information', async () => {
    const fixture = contentWithAccessFixture()
    server.use(
      http.get(`${BASE}/v1/content/content-id-1/with-access`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().content.getWithAccess('content-id-1')

    expect(result).toEqual(decodeContentFields(fixture))
    expect(result.access_info).toBeDefined()
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/content/missing/with-access`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().content.getWithAccess('missing')).rejects.toThrow(NotFoundError)
  })

  it('throws ForbiddenError when a store credential calls it (403)', async () => {
    server.use(
      http.get(`${BASE}/v1/content/content-id-1/with-access`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Invalid Role'), { status: 403 }),
      ),
    )

    await expect(makeClient().content.getWithAccess('content-id-1')).rejects.toThrow(ForbiddenError)
  })

  it('URL-encodes the content id, so an id containing / stays one path segment', async () => {
    let capturedPath = ''
    server.use(
      http.get(`${BASE}/v1/content/:id/with-access`, ({ request }) => {
        capturedPath = new URL(request.url).pathname
        return HttpResponse.json(contentWithAccessFixture())
      }),
    )

    await makeClient().content.getWithAccess('pub/article-1')

    expect(capturedPath).toBe('/v1/content/pub%2Farticle-1/with-access')
  })

  it('returns an external_ref item with its resource_url and no deliverable', async () => {
    const fixture = contentWithAccessFixture({
      content_type: 'external_ref',
      resource_url: 'https://vimeo.com/987654321',
      access_info: contentAccessInfoFixture({
        has_purchased: true,
        next_required_action: 'purchase',
      }),
    })
    server.use(
      http.get(`${BASE}/v1/content/content-id-ext-1/with-access`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().content.getWithAccess('content-id-ext-1')

    expect(result.content_type).toBe('external_ref')
    expect(result.resource_url).toBe('https://vimeo.com/987654321')
    expect(result).not.toHaveProperty('content_uri')
    expect(result).not.toHaveProperty('content_body')
    expect(result.access_info.has_purchased).toBe(true)
  })
})
