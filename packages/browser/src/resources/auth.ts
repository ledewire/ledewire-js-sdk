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
  AuthLoginEmailRequest,
  AuthLoginOAuthRequest,
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

  private async storeTokens(res: AuthenticationResponse): Promise<void> {
    await this.tokenManager.setTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: parseExpiresAt(res.expires_at),
    })
  }
}
