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
  MerchantLoginStore,
  ManageableStore,
} from '@ledewire/core'

/**
 * Result returned by the one-step login-and-discover helpers.
 * Contains both the raw token response and the list of stores the
 * authenticated user can manage, sourced directly from the login response.
 */
export interface MerchantLoginResult {
  /** Raw token response from the authentication endpoint. */
  tokens: MerchantAuthenticationResponse
  /**
   * Stores the authenticated user can manage.
   * Sourced from the login response — no additional network request needed.
   */
  stores: MerchantLoginStore[]
}

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
   * List all stores the authenticated merchant user can manage (`ManageableStore`).
   * Requires a valid merchant JWT (call `loginWithEmail` or `loginWithGoogle` first).
   *
   * **Tip:** prefer `loginWithEmailAndListStores()` which returns the embedded
   * `MerchantLoginStore` list from the login response in a single HTTP call.
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

  /**
   * Log in with email/password and immediately return the accessible stores list
   * in a single call. The stores are embedded in the login response — no extra
   * network request is made.
   *
   * This is the recommended entry point for merchant backends.
   *
   * @example
   * ```ts
   * const { stores } = await client.merchant.auth.loginWithEmailAndListStores({
   *   email: 'owner@example.com',
   *   password: process.env.MERCHANT_PASSWORD,
   * })
   * const storeId = stores[0].id
   * ```
   */
  async loginWithEmailAndListStores(body: MerchantEmailLoginRequest): Promise<MerchantLoginResult> {
    const tokens = await this.loginWithEmail(body)
    return { tokens, stores: tokens.stores }
  }

  /**
   * Log in with a Google ID token and immediately return the accessible stores list
   * in a single call. The stores are embedded in the login response — no extra
   * network request is made.
   *
   * @example
   * ```ts
   * const { stores } = await client.merchant.auth.loginWithGoogleAndListStores({
   *   id_token: googleIdToken,
   * })
   * const storeId = stores[0].id
   * ```
   */
  async loginWithGoogleAndListStores(
    body: MerchantGoogleLoginRequest,
  ): Promise<MerchantLoginResult> {
    const tokens = await this.loginWithGoogle(body)
    return { tokens, stores: tokens.stores }
  }

  private async storeTokens(res: MerchantAuthenticationResponse): Promise<void> {
    await this.tokenManager.setTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: parseExpiresAt(res.expires_at),
    })
  }
}
