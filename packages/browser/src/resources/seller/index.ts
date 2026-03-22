/**
 * Browser seller namespace — API-key-authenticated read operations.
 *
 * @module
 */
import { parseExpiresAt } from '@ledewire/core'
import type { HttpClient, TokenManager } from '@ledewire/core'
import type { AuthLoginApiKeyRequest, AuthenticationResponse } from '@ledewire/core'
import { BrowserSellerContentNamespace } from './content.js'

/**
 * Seller operations accessible with a view-permission API key token.
 *
 * Obtain via `lw.seller` — do not construct directly.
 *
 * @example
 * ```ts
 * const lw = Ledewire.init({ apiKey: 'your_api_key' })
 *
 * // Authenticate as a seller (key-only = view; key+secret = full)
 * await lw.seller.loginWithApiKey({ key: 'your_api_key' })
 * const items = await lw.seller.content.list()
 * ```
 */
export class BrowserSellerNamespace {
  /** Seller content: list, search, and get by API key. */
  readonly content: BrowserSellerContentNamespace

  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly tokenManager: TokenManager,
  ) {
    this.content = new BrowserSellerContentNamespace(http)
  }

  /**
   * Log in using an API key to obtain a seller token.
   * Provide only `key` for read-only (`view`) access.
   * Provide both `key` and `secret` for read/write (`full`) access.
   * Tokens are stored automatically after successful authentication.
   *
   * Use this before calling `lw.seller.content.*` methods.
   *
   * @param body - API key credentials.
   * @returns The authentication token response.
   *
   * @example
   * ```ts
   * // View access (read-only) — sufficient for seller.content.list/search/get
   * await lw.seller.loginWithApiKey({ key: 'your_api_key' })
   *
   * // Full access (read/write)
   * await lw.seller.loginWithApiKey({ key: 'your_api_key', secret: 'your_secret' })
   * ```
   */
  async loginWithApiKey(body: AuthLoginApiKeyRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/login/api-key', body)
    await this.tokenManager.setTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: parseExpiresAt(res.expires_at),
    })
    return res
  }
}
