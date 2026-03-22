import { describe, it, expect, beforeEach } from 'vitest'
import { sessionStorageAdapter } from './session-storage-adapter.js'

// jsdom provides sessionStorage in the vitest browser environment

const DEFAULT_KEY = 'lw:tokens'

const sampleTokens = {
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
  expiresAt: 4070908800000, // 2099-01-01 as Unix ms
}

describe('sessionStorageAdapter', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // getTokens
  // -------------------------------------------------------------------------

  it('returns null when sessionStorage is empty', async () => {
    const adapter = sessionStorageAdapter()
    expect(await adapter.getTokens()).toBeNull()
  })

  it('returns parsed tokens after setTokens', async () => {
    const adapter = sessionStorageAdapter()
    await adapter.setTokens(sampleTokens)
    const result = await adapter.getTokens()
    expect(result).not.toBeNull()
    expect(result?.accessToken).toBe(sampleTokens.accessToken)
    expect(result?.refreshToken).toBe(sampleTokens.refreshToken)
  })

  it('returns null (not a thrown error) when the stored value is corrupted JSON', async () => {
    sessionStorage.setItem(DEFAULT_KEY, 'not-valid-json}}}')
    const adapter = sessionStorageAdapter()
    // Exercises the catch branch; a thrown exception would fail the test.
    expect(await adapter.getTokens()).toBeNull()
  })

  it('round-trips numeric expiresAt without loss', async () => {
    const adapter = sessionStorageAdapter()
    await adapter.setTokens(sampleTokens)
    const result = await adapter.getTokens()
    expect(result?.expiresAt).toBe(sampleTokens.expiresAt)
  })

  // -------------------------------------------------------------------------
  // setTokens
  // -------------------------------------------------------------------------

  it('persists tokens to sessionStorage under the default key', async () => {
    const adapter = sessionStorageAdapter()
    await adapter.setTokens(sampleTokens)
    const raw = sessionStorage.getItem(DEFAULT_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(String(raw))).toMatchObject({ accessToken: 'access-123' })
  })

  // -------------------------------------------------------------------------
  // clearTokens
  // -------------------------------------------------------------------------

  it('removes the stored tokens from sessionStorage', async () => {
    const adapter = sessionStorageAdapter()
    await adapter.setTokens(sampleTokens)
    await adapter.clearTokens()
    expect(sessionStorage.getItem(DEFAULT_KEY)).toBeNull()
  })

  it('does not throw when clearTokens is called with nothing stored', async () => {
    const adapter = sessionStorageAdapter()
    // Any exception would fail the test; we just verify the key stays absent.
    await adapter.clearTokens()
    expect(sessionStorage.getItem(DEFAULT_KEY)).toBeNull()
  })

  // -------------------------------------------------------------------------
  // custom key
  // -------------------------------------------------------------------------

  it('uses a custom storage key when provided', async () => {
    const CUSTOM_KEY = 'my-app:tokens'
    const adapter = sessionStorageAdapter(CUSTOM_KEY)
    await adapter.setTokens(sampleTokens)
    expect(sessionStorage.getItem(DEFAULT_KEY)).toBeNull()
    expect(sessionStorage.getItem(CUSTOM_KEY)).not.toBeNull()
  })

  it('reads only from the custom key when provided', async () => {
    // Stored under the default key — adapter with a custom key must see nothing.
    sessionStorage.setItem(DEFAULT_KEY, JSON.stringify(sampleTokens))
    const adapter = sessionStorageAdapter('other-app:tokens')
    expect(await adapter.getTokens()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // isolation from localStorage
  // -------------------------------------------------------------------------

  it('does not read tokens stored in localStorage', async () => {
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(sampleTokens))
    const adapter = sessionStorageAdapter()
    expect(await adapter.getTokens()).toBeNull()
  })

  it('does not write tokens to localStorage', async () => {
    const adapter = sessionStorageAdapter()
    await adapter.setTokens(sampleTokens)
    expect(localStorage.getItem(DEFAULT_KEY)).toBeNull()
  })
})
