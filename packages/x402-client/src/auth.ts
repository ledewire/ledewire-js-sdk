import { AuthError } from '@ledewire/core'
import type { AuthenticationResponse } from '@ledewire/core'

const DEFAULT_API_BASE = 'https://api.ledewire.com'
const AUTH_PATH = '/v1/auth/login/buyer-api-key'

/**
 * Authenticates with a buyer API key + secret and returns a fresh buyer JWT.
 *
 * @internal Used by `LedewireAuthManager` — do not call directly.
 */
export async function loginWithBuyerApiKey(
  key: string,
  secret: string,
  apiBase: string = DEFAULT_API_BASE,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<AuthenticationResponse> {
  const res = await fetchFn(`${apiBase}${AUTH_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, secret }),
  })

  if (!res.ok) {
    throw new AuthError(`Buyer API key authentication failed (${String(res.status)})`)
  }

  return res.json() as Promise<AuthenticationResponse>
}

/**
 * Manages a buyer JWT obtained from a buyer API key, refreshing it before
 * it expires.
 *
 * This is a lightweight auth holder for use in `@ledewire/x402-client`.
 * It does not persist tokens to storage — appropriate for short-lived agents.
 * For long-running processes, integrate with `TokenManager` from `@ledewire/core`.
 */
export class LedewireAuthManager {
  private readonly key: string
  private readonly secret: string
  private readonly fetchFn: typeof globalThis.fetch

  private accessToken: string | null = null
  private expiresAt = 0

  /** @internal resolved apiBase — set on first use from PAYMENT-REQUIRED extension */
  apiBase: string

  constructor(
    key: string,
    secret: string,
    apiBase: string = DEFAULT_API_BASE,
    fetchFn: typeof globalThis.fetch = globalThis.fetch,
  ) {
    this.key = key
    this.secret = secret
    this.apiBase = apiBase
    this.fetchFn = fetchFn
  }

  /**
   * Returns a valid access token, re-authenticating if the current token is
   * missing or within 60 seconds of expiry.
   */
  async getAccessToken(): Promise<string> {
    const THRESHOLD_MS = 60_000
    if (this.accessToken && Date.now() < this.expiresAt - THRESHOLD_MS) {
      return this.accessToken
    }
    const response = await loginWithBuyerApiKey(this.key, this.secret, this.apiBase, this.fetchFn)
    this.accessToken = response.access_token
    this.expiresAt = new Date(response.expires_at).getTime()
    return this.accessToken
  }
}
