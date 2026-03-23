import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { HttpClient } from './http-client.js'
import { AuthError, ForbiddenError, LedewireError, NotFoundError } from './errors.js'
import { createTestServer, http, HttpResponse } from './test-utils/server.js'
import { errorResponseFixture } from './test-utils/fixtures.js'

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

function makeClient(overrides?: ConstructorParameters<typeof HttpClient>[0]) {
  return new HttpClient({ baseUrl: BASE, ...overrides })
}

describe('HttpClient.get', () => {
  it('returns parsed JSON on 200', async () => {
    server.use(http.get(`${BASE}/v1/test`, () => HttpResponse.json({ ok: true })))
    const result = await makeClient().get<{ ok: boolean }>('/v1/test')
    expect(result).toEqual({ ok: true })
  })

  it('appends string query params', async () => {
    let receivedUrl = ''
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedUrl = request.url
        return HttpResponse.json({})
      }),
    )
    await makeClient().get('/v1/test', { foo: 'bar', page: '2' })
    expect(receivedUrl).toContain('foo=bar')
    expect(receivedUrl).toContain('page=2')
  })

  it('coerces numeric params to strings and omits undefined values', async () => {
    let receivedUrl = ''
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedUrl = request.url
        return HttpResponse.json({})
      }),
    )
    await makeClient().get('/v1/test', { page: 3, per_page: 25, omitted: undefined })
    expect(receivedUrl).toContain('page=3')
    expect(receivedUrl).toContain('per_page=25')
    expect(receivedUrl).not.toContain('omitted')
  })

  it('injects Bearer token when getAccessToken returns one', async () => {
    let receivedAuth = ''
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedAuth = request.headers.get('Authorization') ?? ''
        return HttpResponse.json({})
      }),
    )
    const client = makeClient({ getAccessToken: () => 'my-token' })
    await client.get('/v1/test')
    expect(receivedAuth).toBe('Bearer my-token')
  })

  it('sends no Authorization header when getAccessToken returns null', async () => {
    let receivedAuth: string | null = 'initial'
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedAuth = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    await makeClient().get('/v1/test')
    expect(receivedAuth).toBeNull()
  })
})

describe('HttpClient error mapping', () => {
  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )
    const client = makeClient({ onUnauthorized: () => null })
    await expect(client.get('/v1/test')).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )
    await expect(makeClient().get('/v1/test')).rejects.toThrow(ForbiddenError)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Not found'), { status: 404 }),
      ),
    )
    await expect(makeClient().get('/v1/test')).rejects.toThrow(NotFoundError)
  })

  it('throws LedewireError with statusCode for other HTTP errors', async () => {
    server.use(
      http.post(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Unprocessable'), { status: 422 }),
      ),
    )
    const err = await makeClient()
      .post('/v1/test', {})
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(422)
    expect((err as LedewireError).message).toBe('Unprocessable')
  })
})

describe('HttpClient 401 retry', () => {
  it('retries with new token after calling onUnauthorized', async () => {
    let callCount = 0
    server.use(
      http.get(`${BASE}/v1/test`, () => {
        callCount++
        if (callCount === 1) return HttpResponse.json({}, { status: 401 })
        return HttpResponse.json({ retried: true })
      }),
    )
    const client = makeClient({ onUnauthorized: () => 'new-token' })
    const result = await client.get<{ retried: boolean }>('/v1/test')
    expect(result).toEqual({ retried: true })
    expect(callCount).toBe(2)
  })

  it('throws AuthError when onUnauthorized returns null (no refresh token)', async () => {
    server.use(http.get(`${BASE}/v1/test`, () => HttpResponse.json({}, { status: 401 })))
    const client = makeClient({ onUnauthorized: () => null })
    await expect(client.get('/v1/test')).rejects.toThrow(AuthError)
  })

  it('throws AuthError when retried request also returns 401', async () => {
    // Always 401 - the retry gets another 401 which goes through throwApiError
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Still unauthorized'), { status: 401 }),
      ),
    )
    const client = makeClient({ onUnauthorized: () => 'retry-token' })
    await expect(client.get('/v1/test')).rejects.toThrow(AuthError)
  })
})

describe('HttpClient.delete', () => {
  it('returns undefined on 204 No Content', async () => {
    server.use(http.delete(`${BASE}/v1/test/1`, () => new HttpResponse(null, { status: 204 })))
    await expect(makeClient().delete('/v1/test/1')).resolves.toBeUndefined()
  })
})

describe('HttpClient.put and .patch', () => {
  it('PUT sends the right method and body', async () => {
    let method = ''
    server.use(
      http.put(`${BASE}/v1/test/1`, ({ request }) => {
        method = request.method
        return HttpResponse.json({ updated: true })
      }),
    )
    const result = await makeClient().put<{ updated: boolean }>('/v1/test/1', { name: 'x' })
    expect(method).toBe('PUT')
    expect(result).toEqual({ updated: true })
  })

  it('PATCH sends the right method', async () => {
    let method = ''
    server.use(
      http.patch(`${BASE}/v1/test/1`, ({ request }) => {
        method = request.method
        return HttpResponse.json({ patched: true })
      }),
    )
    const result = await makeClient().patch<{ patched: boolean }>('/v1/test/1', { name: 'y' })
    expect(method).toBe('PATCH')
    expect(result).toEqual({ patched: true })
  })
})

describe('HttpClient non-JSON error body fallback', () => {
  it('uses response.statusText when the error body is not JSON', async () => {
    server.use(
      http.get(
        `${BASE}/v1/test`,
        () =>
          new HttpResponse('Internal Server Error', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
          }),
      ),
    )
    const err = await makeClient()
      .get('/v1/test')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(500)
  })
})
