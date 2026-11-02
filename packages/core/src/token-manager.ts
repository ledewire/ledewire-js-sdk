import type { AuthTokenRefreshResponse, StoredTokens, TokenStorage } from './types.js'
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
  /**
   * Logs in with credentials the client already holds (e.g. a store API key),
   * persists the session, and resolves with the new access token. Rejects
   * with the login's own error when the credentials are refused.
   *
   * When set, the manager calls it instead of returning no token when nothing
   * is stored, and instead of giving up when a refresh fails. Concurrent
   * callers share one in-flight login. It must not authenticate through this
   * manager (use a credential-exchange request, `{ auth: false }`), or it
   * would wait on itself.
   */
  login?: () => Promise<string>
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
  private readonly login: TokenManagerOptions['login']
  private refreshPromise: Promise<StoredTokens | null> | null = null
  private loginPromise: Promise<string> | null = null

  constructor(options: TokenManagerOptions) {
    this.storage = options.storage
    this.refreshFn = options.refreshFn
    this.onTokenRefreshed = options.onTokenRefreshed
    this.onAuthExpired = options.onAuthExpired
    this.login = options.login
  }

  /**
   * Returns a valid access token, refreshing proactively if needed.
   * Returns `null` if no tokens are stored (user not authenticated), unless a
   * `login` is configured, in which case it logs in first.
   */
  async getAccessToken(): Promise<string | null> {
    const login = this.login
    const stored = await this.storage.getTokens()
    if (!stored) return login ? this.performLogin(login) : null

    const expiresInMs = stored.expiresAt - Date.now()
    if (expiresInMs < REFRESH_THRESHOLD_MS) {
      if (login) return this.refreshOrLogIn(stored.refreshToken, login)
      const refreshed = await this.performRefresh(stored.refreshToken)
      return refreshed?.accessToken ?? null
    }

    return stored.accessToken
  }

  /**
   * Called by `HttpClient` when a 401 is received.
   * Attempts one refresh (then, with a `login` configured, one login);
   * returns the new access token or null.
   */
  async handleUnauthorized(): Promise<string | null> {
    const login = this.login
    const stored = await this.storage.getTokens()
    if (login) return this.refreshOrLogIn(stored?.refreshToken, login)
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

  /**
   * Recovers a lost session for a client that can log itself in: refreshes
   * when there is a refresh token, and logs in again when that fails or there
   * is none. Fires `onAuthExpired` and rejects with the login's error only
   * when the login fails too.
   */
  private async refreshOrLogIn(
    refreshToken: string | undefined,
    login: () => Promise<string>,
  ): Promise<string> {
    if (refreshToken !== undefined) {
      const refreshed = await this.performRefresh(refreshToken).catch(() => null)
      if (refreshed) return refreshed.accessToken
    }
    try {
      return await this.performLogin(login)
    } catch (err) {
      await this.onAuthExpired?.()
      throw err
    }
  }

  /** Runs `login`, sharing one in-flight attempt between concurrent callers. */
  private performLogin(login: () => Promise<string>): Promise<string> {
    if (this.loginPromise) return this.loginPromise
    this.loginPromise = login().finally(() => {
      this.loginPromise = null
    })
    return this.loginPromise
  }

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

/**
 * Creates the standard LedeWire token refresh function for use with `TokenManager`.
 *
 * Encapsulates the `/v1/auth/token/refresh` fetch call, response mapping, and
 * error handling so both `createClient` (node) and `init` (browser) share a
 * single implementation.
 *
 * @param baseUrl - The resolved API base URL (e.g. `'https://api.ledewire.com'`)
 * @returns A `refreshFn` compatible with `TokenManagerOptions['refreshFn']`
 */
export function createRefreshFn(baseUrl: string): TokenManagerOptions['refreshFn'] {
  return async (refreshToken: string): Promise<StoredTokens> => {
    const res = await fetch(`${baseUrl}/v1/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) throw new Error('Token refresh failed')
    const data = (await res.json()) as AuthTokenRefreshResponse
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: parseExpiresAt(data.expires_at),
      // A store API-key refresh carries its store; the token is never decoded for it.
      ...('store_id' in data && { storeId: data.store_id }),
    }
  }
}
