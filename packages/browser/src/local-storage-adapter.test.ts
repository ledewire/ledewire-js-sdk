import { describe, it, expect, beforeEach } from 'vitest'
import { localStorageAdapter } from './local-storage-adapter.js'

// jsdom provides localStorage in the vitest browser environment

const DEFAULT_KEY = 'lw:tokens'

const sampleTokens = {
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
  expiresAt: 4070908800000, // 2099-01-01 as Unix ms
}

describe('localStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // getTokens
  // -------------------------------------------------------------------------

  it('returns null when localStorage is empty', async () => {
    const adapter = localStorageAdapter()
    expect(await adapter.getTokens()).toBeNull()
  })

  it('returns parsed tokens after setTokens', async () => {
    const adapter = localStorageAdapter()
    await adapter.setTokens(sampleTokens)
    const result = await adapter.getTokens()
    expect(result).not.toBeNull()
    expect(result?.accessToken).toBe(sampleTokens.accessToken)
    expect(result?.refreshToken).toBe(sampleTokens.refreshToken)
  })

  it('returns null (not a thrown error) when the stored value is corrupted JSON', async () => {
    localStorage.setItem(DEFAULT_KEY, 'not-valid-json}}}')
    const adapter = localStorageAdapter()
    // Exercises the catch branch; a thrown exception would fail the test.
    expect(await adapter.getTokens()).toBeNull()
  })

  it('round-trips numeric expiresAt without loss', async () => {
    const adapter = localStorageAdapter()
    await adapter.setTokens(sampleTokens)
    const result = await adapter.getTokens()
    expect(result?.expiresAt).toBe(sampleTokens.expiresAt)
  })

  // -------------------------------------------------------------------------
  // setTokens
  // -------------------------------------------------------------------------

  it('persists tokens to localStorage under the default key', async () => {
    const adapter = localStorageAdapter()
    await adapter.setTokens(sampleTokens)
    const raw = localStorage.getItem(DEFAULT_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(String(raw))).toMatchObject({ accessToken: 'access-123' })
  })

  // -------------------------------------------------------------------------
  // clearTokens
  // -------------------------------------------------------------------------

  it('removes the stored tokens from localStorage', async () => {
    const adapter = localStorageAdapter()
    await adapter.setTokens(sampleTokens)
    await adapter.clearTokens()
    expect(localStorage.getItem(DEFAULT_KEY)).toBeNull()
  })

  it('does not throw when clearTokens is called with nothing stored', async () => {
    const adapter = localStorageAdapter()
    // Any exception would fail the test; we just verify the key stays absent.
    await adapter.clearTokens()
    expect(localStorage.getItem(DEFAULT_KEY)).toBeNull()
  })

  // -------------------------------------------------------------------------
  // custom key
  // -------------------------------------------------------------------------

  it('uses a custom storage key when provided', async () => {
    const CUSTOM_KEY = 'my-app:tokens'
    const adapter = localStorageAdapter(CUSTOM_KEY)
    await adapter.setTokens(sampleTokens)
    expect(localStorage.getItem(DEFAULT_KEY)).toBeNull()
    expect(localStorage.getItem(CUSTOM_KEY)).not.toBeNull()
  })

  it('reads only from the custom key when provided', async () => {
    // Stored under the default key — adapter with a custom key must see nothing.
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(sampleTokens))
    const adapter = localStorageAdapter('other-app:tokens')
    expect(await adapter.getTokens()).toBeNull()
  })
})
