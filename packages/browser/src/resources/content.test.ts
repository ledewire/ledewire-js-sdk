import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { NotFoundError, decodeContentFields } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  errorResponseFixture,
  contentWithAccessFixture,
  externalRefContentResponseFixture,
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

  it('returns external_ref content with content_uri when buyer has purchased', async () => {
    const fixture = contentWithAccessFixture({
      ...externalRefContentResponseFixture(),
      access_info: contentAccessInfoFixture({ has_purchased: true, next_required_action: 'none' }),
    })
    server.use(
      http.get(`${BASE}/v1/content/content-id-ext-1/with-access`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().content.getWithAccess('content-id-ext-1')

    expect(result.content_type).toBe('external_ref')
    expect(result.content_uri).toBe('https://vimeo.com/987654321')
    expect(result.access_info.has_purchased).toBe(true)
  })

  it('returns external_ref content without content_uri when buyer has not purchased', async () => {
    const fixture = contentWithAccessFixture({
      ...externalRefContentResponseFixture({ content_uri: null }),
      access_info: contentAccessInfoFixture({
        has_purchased: false,
        next_required_action: 'purchase',
      }),
    })
    server.use(
      http.get(`${BASE}/v1/content/content-id-ext-1/with-access`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().content.getWithAccess('content-id-ext-1')

    expect(result.content_type).toBe('external_ref')
    expect(result.content_uri).toBeNull()
    expect(result.access_info.has_purchased).toBe(false)
  })
})
