import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import {
  TokenManager,
  MemoryTokenStorage,
  parseExpiresAt,
  createRefreshFn,
} from './token-manager.js'
import { AuthError } from './errors.js'
import type { StoredTokens } from './types.js'

type RefreshFn = (refreshToken: string) => Promise<StoredTokens>

function makeTokens(overrides?: Partial<StoredTokens>): StoredTokens {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
    ...overrides,
  }
}

interface MakeManagerOptions {
  refreshFn?: RefreshFn
  onTokenRefreshed?: (tokens: StoredTokens) => void
  onAuthExpired?: () => void
  initialTokens?: StoredTokens
}

function makeManager(options?: MakeManagerOptions) {
  const storage = new MemoryTokenStorage()
  if (options?.initialTokens) storage.setTokens(options.initialTokens)

  const refreshFn: RefreshFn =
    options?.refreshFn ?? vi.fn<RefreshFn>().mockResolvedValue(makeTokens())

  const manager = new TokenManager({
    storage,
    refreshFn,
    ...(options?.onTokenRefreshed !== undefined && { onTokenRefreshed: options.onTokenRefreshed }),
    ...(options?.onAuthExpired !== undefined && { onAuthExpired: options.onAuthExpired }),
  })

  return { manager, storage, refreshFn }
}

describe('TokenManager.getAccessToken', () => {
  it('returns null when no tokens are stored', async () => {
    const { manager } = makeManager()
    expect(await manager.getAccessToken()).toBeNull()
  })

  it('returns access token when not near expiry', async () => {
    const { manager } = makeManager({ initialTokens: makeTokens() })
    expect(await manager.getAccessToken()).toBe('access-token')
  })

  it('proactively refreshes when token expires within 60 seconds', async () => {
    const expiringSoon = makeTokens({ expiresAt: Date.now() + 30_000 }) // 30s left
    const refreshFn = vi
      .fn<RefreshFn>()
      .mockResolvedValue(makeTokens({ accessToken: 'new-access-token' }))
    const { manager } = makeManager({ initialTokens: expiringSoon, refreshFn })

    const token = await manager.getAccessToken()
    expect(token).toBe('new-access-token')
    expect(refreshFn).toHaveBeenCalledWith('refresh-token')
  })

  it('deduplicates concurrent refresh calls', async () => {
    const expiringSoon = makeTokens({ expiresAt: Date.now() + 30_000 })
    const refreshFn = vi.fn<RefreshFn>().mockResolvedValue(makeTokens({ accessToken: 'refreshed' }))
    const { manager } = makeManager({ initialTokens: expiringSoon, refreshFn })

    // Fire 5 concurrent calls — only one refresh should happen
    const results = await Promise.all(Array.from({ length: 5 }, () => manager.getAccessToken()))
    expect(refreshFn).toHaveBeenCalledTimes(1)
    expect(results.every((t) => t === 'refreshed')).toBe(true)
  })
})

describe('TokenManager.handleUnauthorized', () => {
  it('refreshes and returns new token', async () => {
    const refreshFn = vi.fn<RefreshFn>().mockResolvedValue(makeTokens({ accessToken: 'after-401' }))
    const { manager } = makeManager({ initialTokens: makeTokens(), refreshFn })
    expect(await manager.handleUnauthorized()).toBe('after-401')
  })

  it('calls onAuthExpired and returns null when no tokens are stored', async () => {
    const onAuthExpired = vi.fn()
    const { manager } = makeManager({ onAuthExpired })
    const result = await manager.handleUnauthorized()
    expect(result).toBeNull()
    expect(onAuthExpired).toHaveBeenCalledOnce()
  })

  it('throws AuthError and calls onAuthExpired when refresh fails', async () => {
    const onAuthExpired = vi.fn()
    const refreshFn = vi.fn<RefreshFn>().mockRejectedValue(new Error('network error'))
    const { manager } = makeManager({ initialTokens: makeTokens(), refreshFn, onAuthExpired })

    await expect(manager.handleUnauthorized()).rejects.toThrow(AuthError)
    // onAuthExpired not called in this path — error is propagated
  })
})

describe('TokenManager.setTokens / clearTokens', () => {
  it('stores tokens', async () => {
    const { manager, storage } = makeManager()
    const tokens = makeTokens()
    await manager.setTokens(tokens)
    expect(storage.getTokens()).toEqual(tokens)
  })

  it('clears tokens on logout', async () => {
    const { manager, storage } = makeManager({ initialTokens: makeTokens() })
    await manager.clearTokens()
    expect(storage.getTokens()).toBeNull()
  })
})

describe('TokenManager onTokenRefreshed callback', () => {
  it('is called after a successful refresh', async () => {
    const onTokenRefreshed = vi.fn()
    const expiringSoon = makeTokens({ expiresAt: Date.now() + 30_000 })
    const newTokens = makeTokens({ accessToken: 'fresh' })
    const { manager } = makeManager({
      initialTokens: expiringSoon,
      refreshFn: vi.fn<RefreshFn>().mockResolvedValue(newTokens),
      onTokenRefreshed,
    })

    await manager.getAccessToken()
    expect(onTokenRefreshed).toHaveBeenCalledWith(newTokens)
  })
})

describe('MemoryTokenStorage', () => {
  it('returns null before any tokens are set', () => {
    const storage = new MemoryTokenStorage()
    expect(storage.getTokens()).toBeNull()
  })

  it('stores and retrieves tokens', () => {
    const storage = new MemoryTokenStorage()
    const tokens = makeTokens()
    storage.setTokens(tokens)
    expect(storage.getTokens()).toEqual(tokens)
  })

  it('clears tokens', () => {
    const storage = new MemoryTokenStorage()
    storage.setTokens(makeTokens())
    storage.clearTokens()
    expect(storage.getTokens()).toBeNull()
  })
})

describe('parseExpiresAt', () => {
  it('converts an ISO 8601 string to a Unix timestamp in ms', () => {
    const ts = parseExpiresAt('2026-01-01T12:00:00Z')
    expect(ts).toBe(new Date('2026-01-01T12:00:00Z').getTime())
    expect(typeof ts).toBe('number')
  })
})

describe('createRefreshFn', () => {
  const BASE = 'https://api.example.com'
  const server = setupServer()

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })
  afterEach(() => {
    server.resetHandlers()
  })
  afterAll(() => {
    server.close()
  })

  it('returns new StoredTokens on a successful refresh', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/token/refresh`, () =>
        HttpResponse.json({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_at: '2099-01-01T00:00:00Z',
        }),
      ),
    )

    const refresh = createRefreshFn(BASE)
    const result = await refresh('old-refresh')

    expect(result.accessToken).toBe('new-access')
    expect(result.refreshToken).toBe('new-refresh')
    expect(result.expiresAt).toBe(new Date('2099-01-01T00:00:00Z').getTime())
  })

  it('throws when the refresh endpoint returns a non-2xx status', async () => {
    server.use(
      http.post(`${BASE}/v1/auth/token/refresh`, () =>
        HttpResponse.json({ error: 'invalid_grant' }, { status: 401 }),
      ),
    )

    const refresh = createRefreshFn(BASE)
    await expect(refresh('expired-refresh')).rejects.toThrow('Token refresh failed')
  })
})
