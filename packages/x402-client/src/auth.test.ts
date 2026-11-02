import { describe, it, expect, vi } from 'vitest'
import { LedewireAuthManager, loginWithBuyerApiKey } from './auth.js'
import { AuthError, RateLimitError } from '@ledewire/core'

const mockTokenResponse = {
  token_type: 'Bearer' as const,
  access_token: 'test-jwt',
  refresh_token: 'test-refresh',
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
}

function makeFetch(status: number, body: object): typeof fetch {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

describe('loginWithBuyerApiKey', () => {
  it('returns the token response on success', async () => {
    const fetchFn = makeFetch(200, mockTokenResponse)
    const result = await loginWithBuyerApiKey(
      'bktst_key',
      'secret',
      'https://api.ledewire.com',
      fetchFn,
    )
    expect(result.access_token).toBe('test-jwt')
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.ledewire.com/v1/auth/login/buyer-api-key',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'bktst_key', secret: 'secret' }),
      }),
    )
  })

  it('throws AuthError on non-200', async () => {
    const fetchFn = makeFetch(401, { error: 'Invalid credentials' })
    await expect(
      loginWithBuyerApiKey('bad', 'bad', 'https://api.ledewire.com', fetchFn),
    ).rejects.toThrow(AuthError)
  })

  it('rejects a 401 with the API message from the ErrorResponse envelope', async () => {
    const fetchFn = makeFetch(401, { error: { code: 401, message: 'Invalid API key or secret' } })
    const error = await loginWithBuyerApiKey(
      'bad',
      'bad',
      'https://api.ledewire.com',
      fetchFn,
    ).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(AuthError)
    expect(error).toMatchObject({ statusCode: 401, message: 'Invalid API key or secret' })
  })

  it('rejects a 401 with a bare-string error body as its message', async () => {
    const fetchFn = makeFetch(401, { error: 'Invalid credentials' })
    await expect(
      loginWithBuyerApiKey('bad', 'bad', 'https://api.ledewire.com', fetchFn),
    ).rejects.toThrow('Invalid credentials')
  })

  it('falls back to a generic message when the 401 body is not JSON', async () => {
    const fetchFn = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('Unauthorized', { status: 401 })),
    )
    await expect(
      loginWithBuyerApiKey('bad', 'bad', 'https://api.ledewire.com', fetchFn),
    ).rejects.toThrow('Buyer API key authentication failed (401)')
  })

  it('carries the API message onto a 429 RateLimitError', async () => {
    const fetchFn = makeFetch(429, { error: { code: 429, message: 'Rate limit exceeded' } })
    await expect(
      loginWithBuyerApiKey('k', 's', 'https://api.ledewire.com', fetchFn),
    ).rejects.toThrow('Rate limit exceeded')
  })

  it('throws RateLimitError, not AuthError, on 429 with retryAfter from Retry-After', async () => {
    const fetchFn = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
        }),
      ),
    )
    const error = await loginWithBuyerApiKey('k', 's', 'https://api.ledewire.com', fetchFn).catch(
      (err: unknown) => err,
    )
    expect(error).toBeInstanceOf(RateLimitError)
    expect(error).not.toBeInstanceOf(AuthError)
    expect(error).toMatchObject({ statusCode: 429, retryAfter: 60 })
  })

  it('throws RateLimitError with retryAfter undefined on 429 without Retry-After', async () => {
    const fetchFn = makeFetch(429, { error: 'Too many requests' })
    const error = await loginWithBuyerApiKey('k', 's', 'https://api.ledewire.com', fetchFn).catch(
      (err: unknown) => err,
    )
    expect(error).toBeInstanceOf(RateLimitError)
    expect(error).toMatchObject({ retryAfter: undefined })
  })
})

describe('LedewireAuthManager', () => {
  it('authenticates on first getAccessToken call', async () => {
    const fetchFn = makeFetch(200, mockTokenResponse)
    const mgr = new LedewireAuthManager('key', 'secret', 'https://api.ledewire.com', fetchFn)
    const token = await mgr.getAccessToken()
    expect(token).toBe('test-jwt')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('returns cached token without re-authenticating', async () => {
    const fetchFn = makeFetch(200, mockTokenResponse)
    const mgr = new LedewireAuthManager('key', 'secret', 'https://api.ledewire.com', fetchFn)
    await mgr.getAccessToken()
    await mgr.getAccessToken()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('re-authenticates when token is near expiry', async () => {
    const expiredResponse = {
      ...mockTokenResponse,
      expires_at: new Date(Date.now() + 30_000).toISOString(), // 30s — below 60s threshold
    }
    const fetchFn = makeFetch(200, expiredResponse)
    const mgr = new LedewireAuthManager('key', 'secret', 'https://api.ledewire.com', fetchFn)
    await mgr.getAccessToken()
    await mgr.getAccessToken()
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('logs in at the apiBase it was constructed with', async () => {
    const fetchFn = makeFetch(200, mockTokenResponse)
    const mgr = new LedewireAuthManager(
      'key',
      'secret',
      'https://api-staging.ledewire.com',
      fetchFn,
    )
    await mgr.getAccessToken()
    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[0]).toBe('https://api-staging.ledewire.com/v1/auth/login/buyer-api-key')
  })
})
