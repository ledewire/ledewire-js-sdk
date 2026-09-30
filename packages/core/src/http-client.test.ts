import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { HttpClient } from './http-client.js'
import {
  AuthError,
  ForbiddenError,
  LedewireError,
  NotFoundError,
  SpendCapReachedError,
} from './errors.js'
import { createTestServer, http, HttpResponse } from './test-utils/server.js'
import { errorResponseFixture, spendCapReachedErrorFixture } from './test-utils/fixtures.js'

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

describe('HttpClient.get with { auth: false }', () => {
  it('does not send a stored token as an Authorization header', async () => {
    let receivedAuth: string | null = 'initial'
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedAuth = request.headers.get('Authorization')
        return HttpResponse.json({ ok: true })
      }),
    )
    const client = makeClient({ getAccessToken: () => 'my-token' })
    await client.get('/v1/test', undefined, { auth: false })
    expect(receivedAuth).toBeNull()
  })

  it('does not call getAccessToken', async () => {
    server.use(http.get(`${BASE}/v1/test`, () => HttpResponse.json({ ok: true })))
    const getAccessToken = vi.fn(() => 'my-token')
    const client = makeClient({ getAccessToken })
    await client.get('/v1/test', undefined, { auth: false })
    expect(getAccessToken).not.toHaveBeenCalled()
  })

  it('does not call onUnauthorized on a 401, and maps it straight to AuthError', async () => {
    server.use(http.get(`${BASE}/v1/test`, () => HttpResponse.json({}, { status: 401 })))
    const onUnauthorized = vi.fn(() => 'new-token')
    const client = makeClient({ onUnauthorized })
    await expect(client.get('/v1/test', undefined, { auth: false })).rejects.toThrow(AuthError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('still behaves normally (sends token) with no options or { auth: true }', async () => {
    let receivedAuth: string | null = null
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedAuth = request.headers.get('Authorization')
        return HttpResponse.json({ ok: true })
      }),
    )
    const client = makeClient({ getAccessToken: () => 'my-token' })
    await client.get('/v1/test', undefined, { auth: true })
    expect(receivedAuth).toBe('Bearer my-token')
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

  it('passes error.type through to the thrown error', async () => {
    server.use(
      http.post(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(2001, 'Insufficient funds', 'insufficient_funds'), {
          status: 402,
        }),
      ),
    )
    const err = await makeClient()
      .post('/v1/test', {})
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).type).toBe('insufficient_funds')
  })

  it('leaves type undefined when the error body has none', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Not found'), { status: 404 }),
      ),
    )
    const err = await makeClient()
      .get('/v1/test')
      .catch((e: unknown) => e)
    expect((err as LedewireError).type).toBeUndefined()
  })

  it('throws SpendCapReachedError on 402 with error.type daily_spend_cap_reached', async () => {
    const fixture = spendCapReachedErrorFixture({
      cap_cents: 5000,
      spent_cents: 5000,
      remaining_cents: 0,
      resets_at: '2099-01-02T00:00:00Z',
      bulk_exempt: true,
    })
    server.use(http.post(`${BASE}/v1/test`, () => HttpResponse.json(fixture, { status: 402 })))
    const err = await makeClient()
      .post('/v1/test', {})
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SpendCapReachedError)
    expect(err).toBeInstanceOf(LedewireError)
    const spendCapErr = err as SpendCapReachedError
    expect(spendCapErr.statusCode).toBe(402)
    expect(spendCapErr.type).toBe('daily_spend_cap_reached')
    expect(spendCapErr.capCents).toBe(5000)
    expect(spendCapErr.spentCents).toBe(5000)
    expect(spendCapErr.remainingCents).toBe(0)
    expect(spendCapErr.resetsAt).toBe('2099-01-02T00:00:00Z')
    expect(spendCapErr.bulkExempt).toBe(true)
  })

  it('keeps generic LedewireError behaviour for other 402s', async () => {
    server.use(
      http.post(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(2002, 'Insufficient funds', 'insufficient_funds'), {
          status: 402,
        }),
      ),
    )
    const err = await makeClient()
      .post('/v1/test', {})
      .catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(SpendCapReachedError)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(402)
    expect((err as LedewireError).type).toBe('insufficient_funds')
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

describe('HttpClient defaults', () => {
  it('uses DEFAULT_BASE_URL when no baseUrl is configured', async () => {
    server.use(http.get('https://api.ledewire.com/v1/test', () => HttpResponse.json({ ok: true })))
    const client = new HttpClient()
    const result = await client.get<{ ok: boolean }>('/v1/test')
    expect(result).toEqual({ ok: true })
  })

  it('throws AuthError on 401 when no onUnauthorized handler is configured', async () => {
    server.use(http.get(`${BASE}/v1/test`, () => HttpResponse.json({}, { status: 401 })))
    // No onUnauthorized provided — default () => null returns null, throws AuthError
    await expect(makeClient().get('/v1/test')).rejects.toThrow(AuthError)
  })

  it('omits the query string entirely when all param values are undefined', async () => {
    let receivedUrl = ''
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedUrl = request.url
        return HttpResponse.json({})
      }),
    )
    await makeClient().get('/v1/test', { only: undefined })
    expect(receivedUrl).toBe(`${BASE}/v1/test`)
  })
})

describe('HttpClient.getRaw', () => {
  it('returns the raw Response on 200', async () => {
    server.use(
      http.get(
        `${BASE}/v1/acquisitions/acq-id-1/corpus/download`,
        () =>
          new HttpResponse('binary-gzip-bytes', {
            headers: { 'Content-Type': 'application/gzip' },
          }),
      ),
    )
    const res = await makeClient().getRaw('/v1/acquisitions/acq-id-1/corpus/download')
    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('binary-gzip-bytes')
  })

  it('sends Accept: application/gzip, application/json', async () => {
    let receivedAccept = ''
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedAccept = request.headers.get('Accept') ?? ''
        return new HttpResponse(null)
      }),
    )
    await makeClient().getRaw('/v1/test')
    expect(receivedAccept).toBe('application/gzip, application/json')
  })

  it('injects the Bearer token like get()', async () => {
    let receivedAuth = ''
    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        receivedAuth = request.headers.get('Authorization') ?? ''
        return new HttpResponse(null)
      }),
    )
    const client = makeClient({ getAccessToken: () => 'my-token' })
    await client.getRaw('/v1/test')
    expect(receivedAuth).toBe('Bearer my-token')
  })

  it('retries once after a 401 via onUnauthorized', async () => {
    let callCount = 0
    server.use(
      http.get(`${BASE}/v1/test`, () => {
        callCount++
        if (callCount === 1) return new HttpResponse(null, { status: 401 })
        return new HttpResponse('retried-bytes')
      }),
    )
    const client = makeClient({ onUnauthorized: () => 'new-token' })
    const res = await client.getRaw('/v1/test')
    expect(await res.text()).toBe('retried-bytes')
    expect(callCount).toBe(2)
  })

  it('throws AuthError when onUnauthorized returns null', async () => {
    server.use(http.get(`${BASE}/v1/test`, () => new HttpResponse(null, { status: 401 })))
    const client = makeClient({ onUnauthorized: () => null })
    await expect(client.getRaw('/v1/test')).rejects.toThrow(AuthError)
  })

  it('maps a non-2xx response to a typed error, same as request()', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Not found'), { status: 404 }),
      ),
    )
    await expect(makeClient().getRaw('/v1/test')).rejects.toThrow(NotFoundError)
  })
})

describe('HttpClient robust error-body parsing', () => {
  it('falls back to statusText for an empty object body', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () => HttpResponse.json({}, { status: 500, statusText: 'oops' })),
    )
    const err = await makeClient()
      .get('/v1/test')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(500)
    expect((err as LedewireError).message).toBeTruthy()
  })

  it('falls back to statusText for a body with no error field, and exposes the rest as details', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () => HttpResponse.json({ message: 'x' }, { status: 400 })),
    )
    const err = await makeClient()
      .get('/v1/test')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(400)
    expect((err as LedewireError).details).toEqual({ message: 'x' })
  })

  it('uses error as the message when error is a string (spec 404 purchase example)', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json({ error: 'Content abc123 not found' }, { status: 404 }),
      ),
    )
    const err = await makeClient()
      .get('/v1/test')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NotFoundError)
    expect((err as LedewireError).message).toBe('Content abc123 not found')
  })

  it('does not crash on a null JSON body', async () => {
    server.use(http.get(`${BASE}/v1/test`, () => HttpResponse.json(null, { status: 500 })))
    const err = await makeClient()
      .get('/v1/test')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect(err).not.toBeInstanceOf(TypeError)
  })

  it('does not crash on non-object JSON (e.g. a bare string)', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () => HttpResponse.json('just a string', { status: 500 })),
    )
    const err = await makeClient()
      .get('/v1/test')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect(err).not.toBeInstanceOf(TypeError)
  })
})

describe('HttpClient open-ended error.type and details', () => {
  it('surfaces an error.type beyond the documented ErrorType enum, and extra top-level fields as details', async () => {
    server.use(
      http.post(`${BASE}/v1/test`, () =>
        HttpResponse.json(
          {
            error: { code: 4220, message: 'Selection too large.', type: 'selection_too_large' },
            maximum: 100,
            submitted: 142,
          },
          { status: 422 },
        ),
      ),
    )
    const err = await makeClient()
      .post('/v1/test', {})
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).type).toBe('selection_too_large')
    expect((err as LedewireError).details).toEqual({ maximum: 100, submitted: 142 })
  })
})

describe('HttpClient spend-cap body validation', () => {
  it('falls back to the generic error path when error.type matches but a field is missing', async () => {
    server.use(
      http.post(`${BASE}/v1/test`, () =>
        HttpResponse.json(
          {
            error: {
              code: 402,
              message: 'Daily spend cap reached.',
              type: 'daily_spend_cap_reached',
            },
            cap_cents: 5000,
            spent_cents: 5000,
            // remaining_cents is missing
            resets_at: '2099-01-02T00:00:00Z',
            bulk_exempt: false,
          },
          { status: 402 },
        ),
      ),
    )
    const err = await makeClient()
      .post('/v1/test', {})
      .catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(SpendCapReachedError)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(402)
    expect((err as LedewireError).type).toBe('daily_spend_cap_reached')
    // Never NaN/'undefined' fields smuggled onto the generic error.
    expect((err as SpendCapReachedError).capCents).toBeUndefined()
  })
})
