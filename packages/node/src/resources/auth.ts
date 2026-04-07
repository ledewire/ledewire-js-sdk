/**
 * Buyer authentication namespace.
 *
 * Handles signup, email/password login, Google OAuth, and API key login.
 * Tokens are stored automatically in the `TokenManager` after every
 * successful call — callers never need to manage tokens directly.
 *
 * @module
 */
import { parseExpiresAt } from '@ledewire/core'
import type { HttpClient, TokenManager } from '@ledewire/core'
import type {
  AuthSignupRequest,
  AuthLoginEmailRequest,
  AuthLoginOAuthRequest,
  AuthLoginApiKeyRequest,
  AuthLoginBuyerApiKeyRequest,
  AuthenticationResponse,
  AuthPasswordResetRequestBody,
  AuthPasswordResetBody,
  AuthPasswordResetResponse,
} from '@ledewire/core'

/**
 * Buyer authentication: signup, email/password login, Google OAuth, API key.
 *
 * Obtain via `client.auth` — do not construct directly.
 */
export class AuthNamespace {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly tokenManager: TokenManager,
  ) {}

  /**
   * Register a new buyer account with email and password.
   * Tokens are stored automatically after successful signup.
   *
   * @example
   * ```ts
   * const tokens = await client.auth.signup({
   *   email: 'user@example.com',
   *   password: 'correct-horse-battery-staple',
   *   name: 'Alice',
   * })
   * ```
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
   * @example
   * ```ts
   * await client.auth.loginWithEmail({
   *   email: 'user@example.com',
   *   password: 'correct-horse-battery-staple',
   * })
   * ```
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
   * @example
   * ```ts
   * await client.auth.loginWithGoogle({ id_token: googleIdToken })
   * ```
   */
  async loginWithGoogle(body: AuthLoginOAuthRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/login/google', body)
    await this.storeTokens(res)
    return res
  }

  /**
   * Log in using a buyer API key and secret.
   * Returns a buyer-scoped JWT identical in shape to the email/password login response.
   * Tokens are stored automatically after successful authentication.
   *
   * This is the primary authentication method for autonomous agents — the key+secret
   * are stored in environment variables and used to self-authenticate with no human
   * in the loop.
   *
   * @remarks
   * Rate-limited to 60 requests per minute per IP.
   *
   * @example
   * ```ts
   * await client.auth.loginWithBuyerApiKey({
   *   key: process.env.LEDEWIRE_BUYER_KEY,
   *   secret: process.env.LEDEWIRE_BUYER_SECRET,
   * })
   * ```
   */
  async loginWithBuyerApiKey(body: AuthLoginBuyerApiKeyRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/login/buyer-api-key', body)
    await this.storeTokens(res)
    return res
  }

  /**
   * Log in using an API key. Provide `secret` alongside `key` for full
   * (read/write) access; omit it for view (read-only) access.
   * Tokens are stored automatically after successful authentication.
   *
   * @example
   * ```ts
   * // View access
   * await client.auth.loginWithApiKey({ key: process.env.LEDEWIRE_API_KEY })
   *
   * // Full access
   * await client.auth.loginWithApiKey({
   *   key: process.env.LEDEWIRE_API_KEY,
   *   secret: process.env.LEDEWIRE_API_SECRET,
   * })
   * ```
   */
  async loginWithApiKey(body: AuthLoginApiKeyRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/login/api-key', body)
    await this.storeTokens(res)
    return res
  }

  /**
   * Request a password reset code via email for a buyer account.
   *
   * Sends a 6-digit numeric code to the buyer's email if an account exists.
   * For security, the response does not reveal whether the account exists.
   *
   * @param body - The buyer's email address.
   * @returns A response with a confirmation message.
   *
   * @example
   * ```ts
   * await client.auth.requestPasswordReset({ email: 'buyer@example.com' })
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
   * await client.auth.resetPassword({
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
