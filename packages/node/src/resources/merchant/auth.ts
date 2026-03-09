/**
 * Merchant authentication namespace.
 *
 * Handles merchant email/password and Google OAuth login, plus store discovery.
 * Tokens are stored automatically after every successful login.
 *
 * @module
 */
import { parseExpiresAt } from '@ledewire/core'
import type { HttpClient, TokenManager } from '@ledewire/core'
import type {
  MerchantEmailLoginRequest,
  MerchantGoogleLoginRequest,
  MerchantAuthenticationResponse,
  ManageableStore,
} from '@ledewire/core'

/**
 * Merchant authentication: email/password login, Google OAuth, store discovery.
 *
 * Obtain via `client.merchant.auth` — do not construct directly.
 */
export class MerchantAuthNamespace {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly tokenManager: TokenManager,
  ) {}

  /**
   * Log in as a merchant with email and password.
   * Tokens are stored automatically after successful login.
   *
   * @example
   * ```ts
   * await client.merchant.auth.loginWithEmail({
   *   email: 'owner@example.com',
   *   password: 'hunter2',
   * })
   * const stores = await client.merchant.auth.listStores()
   * ```
   */
  async loginWithEmail(body: MerchantEmailLoginRequest): Promise<MerchantAuthenticationResponse> {
    const res = await this.http.post<MerchantAuthenticationResponse>(
      '/v1/auth/merchant/login/email',
      body,
    )
    await this.storeTokens(res)
    return res
  }

  /**
   * Log in as a merchant with a Google ID token.
   * Tokens are stored automatically after successful login.
   *
   * @example
   * ```ts
   * await client.merchant.auth.loginWithGoogle({ id_token: googleIdToken })
   * ```
   */
  async loginWithGoogle(body: MerchantGoogleLoginRequest): Promise<MerchantAuthenticationResponse> {
    const res = await this.http.post<MerchantAuthenticationResponse>(
      '/v1/auth/merchant/login/google',
      body,
    )
    await this.storeTokens(res)
    return res
  }

  /**
   * List all stores the authenticated merchant user can manage.
   * Requires a valid merchant JWT (call `loginWithEmail` or `loginWithGoogle` first).
   *
   * @example
   * ```ts
   * const stores = await client.merchant.auth.listStores()
   * const storeId = stores[0].store_id
   * ```
   */
  async listStores(): Promise<ManageableStore[]> {
    return this.http.get<ManageableStore[]>('/v1/auth/merchant/stores')
  }

  private async storeTokens(res: MerchantAuthenticationResponse): Promise<void> {
    await this.tokenManager.setTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: parseExpiresAt(res.expires_at),
    })
  }
}
