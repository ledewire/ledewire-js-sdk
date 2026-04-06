/**
 * Buyer authentication namespace for browser environments.
 *
 * Handles buyer signup, email/password login, Google OAuth, and password reset.
 * Tokens are stored automatically in the `TokenManager` after every
 * successful call — callers never need to manage tokens directly.
 *
 * For seller/API key authentication, use {@link BrowserSellerNamespace.loginWithApiKey}
 * via `lw.seller.loginWithApiKey()`.
 *
 * @module
 */
import { parseExpiresAt } from '@ledewire/core'
import type { HttpClient, TokenManager } from '@ledewire/core'
import type {
  AuthLoginEmailRequest,
  AuthLoginBuyerApiKeyRequest,
  AuthLoginOAuthRequest,
  AuthPasswordResetBody,
  AuthPasswordResetRequestBody,
  AuthPasswordResetResponse,
  AuthSignupRequest,
  AuthenticationResponse,
} from '@ledewire/core'

/**
 * Buyer authentication: signup, email/password login, Google OAuth, password reset.
 *
 * Obtain via `lw.auth` — do not construct directly.
 *
 * @example
 * ```ts
 * const lw = Ledewire.init({ apiKey: 'your_api_key' })
 * await lw.auth.loginWithEmail({ email: 'u@example.com', password: 'pw' })
 * ```
 */
export class BrowserAuthNamespace {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly tokenManager: TokenManager,
  ) {}

  /**
   * Register a new buyer account with email and password.
   * Tokens are stored automatically after successful signup.
   *
   * @param body - Signup credentials and display name.
   * @returns The authentication token response.
   */
  async signup(body: AuthSignupRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/signup', body)
    await this.storeTokens(res)
    return res
  }

  /**
   * Log in with email and password.
   * Tokens are stored automatically after successful login.
   *
   * @param body - Email and password credentials.
   * @returns The authentication token response.
   */
  async loginWithEmail(body: AuthLoginEmailRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/login/email', body)
    await this.storeTokens(res)
    return res
  }

  /**
   * Log in with a Google ID token obtained from the Google OAuth flow.
   * Tokens are stored automatically after successful login.
   *
   * @param body - The Google ID token.
   * @returns The authentication token response.
   */
  async loginWithGoogle(body: AuthLoginOAuthRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/login/google', body)
    await this.storeTokens(res)
    return res
  }

  /**
   * Log in using a buyer API key and secret.
   * Returns a buyer-scoped JWT, stored automatically after successful authentication.
   *
   * Primarily useful when building buyer-facing dashboards where the user
   * has created a named API key and wishes to authenticate with it programmatically,
   * or for agent workflows running inside a browser context.
   *
   * @param body - The buyer API key and secret.
   * @returns The authentication token response.
   *
   * @example
   * ```ts
   * await lw.auth.loginWithBuyerApiKey({
   *   key: 'bktst_abc123',
   *   secret: 'deadbeef...',
   * })
   * ```
   */
  async loginWithBuyerApiKey(body: AuthLoginBuyerApiKeyRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/login/buyer-api-key', body)
    await this.storeTokens(res)
    return res
  }

  /**
   * Request a password reset code to be sent to the buyer's email address.
   *
   * The response is intentionally ambiguous — if the email does not exist,
   * the API returns the same success message to prevent account enumeration.
   *
   * @param body - The buyer's email address.
   * @returns A response with a confirmation message.
   *
   * @example
   * ```ts
   * await lw.auth.requestPasswordReset({ email: 'buyer@example.com' })
   * // → { data: { message: 'If an account with this email exists, a reset code has been sent.' } }
   * ```
   */
  async requestPasswordReset(
    body: AuthPasswordResetRequestBody,
  ): Promise<AuthPasswordResetResponse> {
    return this.http.post<AuthPasswordResetResponse>('/v1/auth/password/reset-request', body)
  }

  /**
   * Reset a buyer's password using the code delivered to their email.
   *
   * Obtain the reset code first by calling `requestPasswordReset()`.
   *
   * @param body - Email address, 6-digit reset code, and the new password.
   * @returns A response with a confirmation message.
   *
   * @example
   * ```ts
   * await lw.auth.resetPassword({
   *   email: 'buyer@example.com',
   *   reset_code: '123456',
   *   password: 'new-secure-password',
   * })
   * ```
   */
  async resetPassword(body: AuthPasswordResetBody): Promise<AuthPasswordResetResponse> {
    return this.http.post<AuthPasswordResetResponse>('/v1/auth/password/reset', body)
  }

  private async storeTokens(res: AuthenticationResponse): Promise<void> {
    await this.tokenManager.setTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: parseExpiresAt(res.expires_at),
    })
  }
}
