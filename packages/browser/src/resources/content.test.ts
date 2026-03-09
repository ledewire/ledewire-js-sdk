import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { errorResponseFixture, contentWithAccessFixture } from '@ledewire/core/test-utils'
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

    expect(result).toEqual(fixture)
    expect(result.access_info).toBeDefined()
  })

  it('forwards optional user_id query param', async () => {
    const fixture = contentWithAccessFixture()
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/v1/content/content-id-1/with-access`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().content.getWithAccess('content-id-1', 'user-id-99')

    expect(capturedUrl).toContain('user_id=user-id-99')
  })

  it('does not add user_id param when omitted', async () => {
    const fixture = contentWithAccessFixture()
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/v1/content/content-id-1/with-access`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().content.getWithAccess('content-id-1')

    expect(capturedUrl).not.toContain('user_id')
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/content/missing/with-access`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().content.getWithAccess('missing')).rejects.toThrow(NotFoundError)
  })
})
