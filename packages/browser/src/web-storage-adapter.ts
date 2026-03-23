import type { TokenStorage, StoredTokens } from '@ledewire/core'

const DEFAULT_STORAGE_KEY = 'lw:tokens'

/**
 * Shared implementation for `localStorage` and `sessionStorage` adapters.
 * Not exported from the public API — use {@link localStorageAdapter} or
 * {@link sessionStorageAdapter} instead.
 *
 * @internal
 */
export function webStorageAdapter(backend: Storage, key = DEFAULT_STORAGE_KEY): TokenStorage {
  return {
    getTokens(): StoredTokens | null {
      const raw = backend.getItem(key)
      if (!raw) return null
      try {
        return JSON.parse(raw) as StoredTokens
      } catch {
        // Corrupted value — treat as empty
        return null
      }
    },
    setTokens(tokens: StoredTokens): void {
      backend.setItem(key, JSON.stringify(tokens))
    },
    clearTokens(): void {
      backend.removeItem(key)
    },
  }
}
