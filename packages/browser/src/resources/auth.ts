/**
 * Buyer authentication namespace for browser environments.
 *
 * Tokens are stored automatically in the `TokenManager` after every
 * successful call — callers never need to manage tokens directly.
 *
 * @module
 */
import { parseExpiresAt } from '@ledewire/core'
import type { HttpClient, TokenManager } from '@ledewire/core'
import type {
  AuthLoginApiKeyRequest,
  AuthLoginEmailRequest,
  AuthLoginOAuthRequest,
  AuthPasswordResetBody,
  AuthPasswordResetRequestBody,
  AuthPasswordResetResponse,
  AuthSignupRequest,
  AuthenticationResponse,
} from '@ledewire/core'

/**
 * Buyer authentication: signup, email/password login, Google OAuth.
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
   * await lw.auth.loginWithApiKey({ key: 'your_api_key' })
   *
   * // Full access (read/write)
   * await lw.auth.loginWithApiKey({ key: 'your_api_key', secret: 'your_secret' })
   * ```
   */
  async loginWithApiKey(body: AuthLoginApiKeyRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/login/api-key', body)
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
