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
   * @throws {ForbiddenError} When the credentials are valid but the account has no
   *   merchant store associations (e.g. a buyer account). `err.message` will be
   *   `"This account does not have merchant access. Use a merchant or owner account."`
   *   This is a `403`, **not** a `401` — the credentials are correct; the account
   *   role is wrong. Use a different account or have a store owner add you.
   * @throws {NotFoundError} When the email or password is incorrect (404).
   * @throws {AuthError} When the session is expired or tokens are invalid (401).
   *
   * @example
   * ```ts
   * import { ForbiddenError, AuthError } from '@ledewire/node'
   *
   * try {
   *   await client.merchant.auth.loginWithEmail({
   *     email: 'owner@example.com',
   *     password: 'hunter2',
   *   })
   * } catch (err) {
   *   if (err instanceof ForbiddenError) {
   *     // Wrong account role — not a credential problem.
   *     console.error(err.message) // "This account does not have merchant access..."
   *   }
   * }
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
   * **Common development pitfall:** if you test with a personal Google account
   * that was previously registered as a buyer, this method throws `ForbiddenError`
   * (not `AuthError`). The Google token is valid; the account simply has no
   * merchant store associations. Use a dedicated merchant/owner Google account.
   *
   * @throws {ForbiddenError} When the Google token is valid but the account has no
   *   merchant store associations. `err.message` will be
   *   `"This account does not have merchant access. Use a merchant or owner account."`
   * @throws {AuthError} When the Google token is invalid or expired (401).
   *
   * @example
   * ```ts
   * import { ForbiddenError, AuthError } from '@ledewire/node'
   *
   * try {
   *   await client.merchant.auth.loginWithGoogle({ id_token: googleIdToken })
   * } catch (err) {
   *   if (err instanceof ForbiddenError) {
   *     // Token is valid — this account has no merchant access.
   *     console.error(err.message) // "This account does not have merchant access..."
   *   } else if (err instanceof AuthError) {
   *     // Bad or expired Google token.
   *   }
   * }
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
   * @throws {ForbiddenError} When the credentials are valid but the account has no
   *   merchant store associations. See {@link loginWithEmail} for details.
   * @throws {NotFoundError} When the email or password is incorrect.
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
   * @throws {ForbiddenError} When the Google token is valid but the account has no
   *   merchant store associations. See {@link loginWithGoogle} for details.
   * @throws {AuthError} When the Google token is invalid or expired.
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
