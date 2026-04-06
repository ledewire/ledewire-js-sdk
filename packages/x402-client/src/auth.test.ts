import { describe, it, expect, vi } from 'vitest'
import { LedewireAuthManager, loginWithBuyerApiKey } from './auth.js'
import { AuthError } from '@ledewire/core'

const mockTokenResponse = {
  token_type: 'Bearer' as const,
  access_token: 'test-jwt',
  refresh_token: 'test-refresh',
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
}

function makeFetch(status: number, body: object): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as ReturnType<typeof vi.fn>
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

  it('allows apiBase to be updated', async () => {
    const fetchFn = makeFetch(200, mockTokenResponse)
    const mgr = new LedewireAuthManager('key', 'secret', 'https://api.ledewire.com', fetchFn)
    mgr.apiBase = 'https://api-staging.ledewire.com'
    await mgr.getAccessToken()
    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[0] as string | undefined).toContain('api-staging')
  })
})
