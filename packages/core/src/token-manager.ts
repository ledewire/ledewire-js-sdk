import type { StoredTokens, TokenStorage } from './types.js'
import { AuthError } from './errors.js'

/** How many milliseconds before expiry to proactively refresh the token. */
const REFRESH_THRESHOLD_MS = 60_000 // 60 seconds

/**
 * Options for constructing a `TokenManager`.
 */
export interface TokenManagerOptions {
  storage: TokenStorage
  /**
   * Exchanges a refresh token for a new token pair.
   * Implemented by each package's client factory using the
   * `/v1/auth/token/refresh` endpoint.
   */
  refreshFn: (refreshToken: string) => Promise<StoredTokens>
  /**
   * Called after a successful background token refresh (not on initial login).
   * Use for side-effects only — e.g. audit logging, cache invalidation, or
   * notifying a secondary system when tokens rotate.
   *
   * **Do not use this for token persistence.** The `storage` adapter's
   * `setTokens` is the canonical persistence hook and is already called on
   * every refresh. Providing both will result in double-writes.
   *
   * @example
   * ```ts
   * onTokenRefreshed: async (tokens) => {
   *   await auditLog.record('token_refreshed', { expiresAt: tokens.expiresAt })
   * }
   * ```
   */
  onTokenRefreshed?: (tokens: StoredTokens) => void | Promise<void>
  /**
   * Called when a refresh attempt fails and the user must re-authenticate.
   * Typically used to redirect to login or emit a UI event.
   *
   * @example
   * ```ts
   * onAuthExpired: () => { window.location.href = '/login' }
   * ```
   */
  onAuthExpired?: () => void | Promise<void>
}

/**
 * Manages the JWT token lifecycle transparently.
 *
 * - Proactively refreshes the access token when it expires within 60 seconds
 * - Handles reactive refresh on 401 responses from the HTTP client
 * - Deduplicates concurrent refresh calls (only one in-flight refresh at a time)
 * - Fires `onAuthExpired` when refresh fails so the UI can prompt re-login
 *
 * This is an internal class - use the package-level client factories instead.
 */
export class TokenManager {
  private readonly storage: TokenStorage
  private readonly refreshFn: TokenManagerOptions['refreshFn']
  private readonly onTokenRefreshed: TokenManagerOptions['onTokenRefreshed']
  private readonly onAuthExpired: TokenManagerOptions['onAuthExpired']
  private refreshPromise: Promise<StoredTokens | null> | null = null

  constructor(options: TokenManagerOptions) {
    this.storage = options.storage
    this.refreshFn = options.refreshFn
    this.onTokenRefreshed = options.onTokenRefreshed
    this.onAuthExpired = options.onAuthExpired
  }

  /**
   * Returns a valid access token, refreshing proactively if needed.
   * Returns `null` if no tokens are stored (user not authenticated).
   */
  async getAccessToken(): Promise<string | null> {
    const stored = await this.storage.getTokens()
    if (!stored) return null

    const expiresInMs = stored.expiresAt - Date.now()
    if (expiresInMs < REFRESH_THRESHOLD_MS) {
      const refreshed = await this.performRefresh(stored.refreshToken)
      return refreshed?.accessToken ?? null
    }

    return stored.accessToken
  }

  /**
   * Called by `HttpClient` when a 401 is received.
   * Attempts one refresh; returns the new access token or null.
   */
  async handleUnauthorized(): Promise<string | null> {
    const stored = await this.storage.getTokens()
    if (!stored) {
      await this.onAuthExpired?.()
      return null
    }
    const refreshed = await this.performRefresh(stored.refreshToken)
    if (!refreshed) await this.onAuthExpired?.()
    return refreshed?.accessToken ?? null
  }

  /** Store new tokens after a successful login or signup. */
  async setTokens(tokens: StoredTokens): Promise<void> {
    await this.storage.setTokens(tokens)
  }

  /** Clear all stored tokens (call on logout). */
  async clearTokens(): Promise<void> {
    await this.storage.clearTokens()
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private performRefresh(refreshToken: string): Promise<StoredTokens | null> {
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = this.refreshFn(refreshToken)
      .then(async (tokens) => {
        await this.storage.setTokens(tokens)
        await this.onTokenRefreshed?.(tokens)
        return tokens
      })
      .catch((_err: unknown) => {
        void this.storage.clearTokens()
        throw new AuthError('Token refresh failed. Please re-authenticate.')
      })
      .finally(() => {
        this.refreshPromise = null
      })

    return this.refreshPromise
  }
}

// ---------------------------------------------------------------------------
// Built-in storage adapters
// ---------------------------------------------------------------------------

/**
 * In-memory token storage (default for both packages).
 * Tokens are cleared when the page unloads or the process exits.
 * This is the most secure default for browser environments.
 */
export class MemoryTokenStorage implements TokenStorage {
  private tokens: StoredTokens | null = null

  getTokens(): StoredTokens | null {
    return this.tokens
  }

  setTokens(tokens: StoredTokens): void {
    this.tokens = tokens
  }

  clearTokens(): void {
    this.tokens = null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts an `expires_at` ISO 8601 string from an API auth response
 * into a Unix timestamp (milliseconds) for use in `StoredTokens.expiresAt`.
 *
 * @param expiresAt - ISO 8601 datetime string, e.g. `"2026-01-01T12:00:00Z"`
 * @returns Unix timestamp in milliseconds
 */
export function parseExpiresAt(expiresAt: string): number {
  return new Date(expiresAt).getTime()
}
