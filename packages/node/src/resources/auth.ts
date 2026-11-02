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
  StoreAuthenticationResponse,
  AuthPasswordResetRequestBody,
  AuthPasswordResetBody,
  AuthPasswordResetResponse,
  InviteInfoResponse,
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
   * Tokens are stored automatically after successful signup (`201 Created`).
   *
   * Pass `company_invitation_token` (from a Company invitation email) to sign
   * up and join the Company in one step, or `invitation_token` (from a store
   * invitation email) to join the store. If an invitation can't be accepted,
   * nothing is created and the signup is refused; with both tokens it joins
   * both or neither.
   *
   * @throws {LedewireError} With `statusCode === 422` and
   *   `type === 'invitation_not_accepted'` when an invitation token can't be
   *   accepted. `details.reason` says why (an `InvitationRefusalReason`) and
   *   `details.invitation` says which (`'store'` or `'company'`). A `409` still
   *   means only that the email is taken.
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
    const res = await this.http.post<AuthenticationResponse>('/v1/auth/signup', body, undefined, {
      auth: false,
    })
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
    const res = await this.http.post<AuthenticationResponse>(
      '/v1/auth/login/email',
      body,
      undefined,
      { auth: false },
    )
    await this.storeTokens(res)
    return res
  }

  /**
   * Log in with a Google ID token obtained from the Google OAuth flow.
   * Tokens are stored automatically after successful login.
   *
   * Pass `invitation_token` (store) or `company_invitation_token` (Company)
   * from an invitation email to accept it as you sign in. When this call
   * creates the account, an invitation that can't be accepted refuses the
   * whole call with a `422` (`type === 'invitation_not_accepted'`, as for
   * {@link signup}) and nothing is created. For an account that already
   * exists, the sign-in succeeds either way and the response's `invitations`
   * reports what happened to each token sent.
   *
   * @example
   * ```ts
   * const res = await client.auth.loginWithGoogle({
   *   id_token: googleIdToken,
   *   company_invitation_token: token,
   * })
   * if (res.invitations?.company?.accepted === false) {
   *   console.warn(res.invitations.company.message)
   * }
   * ```
   */
  async loginWithGoogle(body: AuthLoginOAuthRequest): Promise<AuthenticationResponse> {
    const res = await this.http.post<AuthenticationResponse>(
      '/v1/auth/login/google',
      body,
      undefined,
      { auth: false },
    )
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
    const res = await this.http.post<AuthenticationResponse>(
      '/v1/auth/login/buyer-api-key',
      body,
      undefined,
      { auth: false },
    )
    await this.storeTokens(res)
    return res
  }

  /**
   * Log in using a store API key. Provide `secret` alongside `key` for full
   * (read/write) access; omit it for view (read-only) access.
   * Tokens are stored automatically after successful authentication.
   *
   * Resolves with `store_id`, the store the key belongs to: pass it to
   * `client.merchant.*(storeId)`. It comes from the response, and is kept as
   * `StoredTokens.storeId` (refreshes of this session carry it too).
   *
   * @example
   * ```ts
   * // Full access
   * const { store_id } = await client.auth.loginWithApiKey({
   *   key: process.env.LEDEWIRE_API_KEY,
   *   secret: process.env.LEDEWIRE_API_SECRET,
   * })
   * const summary = await client.merchant.sales.summary(store_id)
   *
   * // View access
   * await client.auth.loginWithApiKey({ key: process.env.LEDEWIRE_API_KEY })
   * ```
   */
  async loginWithApiKey(body: AuthLoginApiKeyRequest): Promise<StoreAuthenticationResponse> {
    const res = await this.http.post<StoreAuthenticationResponse>(
      '/v1/auth/login/api-key',
      body,
      undefined,
      { auth: false },
    )
    await this.storeTokens(res, res.store_id)
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
   * // → { message: 'If an account with this email exists, a reset code has been sent.' }
   * ```
   */
  async requestPasswordReset(
    body: AuthPasswordResetRequestBody,
  ): Promise<AuthPasswordResetResponse> {
    return this.http.post<AuthPasswordResetResponse>(
      '/v1/auth/password/reset-request',
      body,
      undefined,
      { auth: false },
    )
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
    return this.http.post<AuthPasswordResetResponse>('/v1/auth/password/reset', body, undefined, {
      auth: false,
    })
  }

  /**
   * Look up the pending store invitation behind an emailed `invitation_token`,
   * so a signup page can show which store it is for before the invitee has an
   * account. A public call: it sends no `Authorization` header and needs no
   * session, because the token is the credential. Invitations expire 7 days
   * after they were sent.
   *
   * To act on the invitation, pass the same token as `invitation_token` to
   * {@link signup} or {@link loginWithGoogle}, or, for an existing merchant,
   * to `merchant.auth.acceptInvitation()`.
   *
   * @param token - The `invitation_token` from the store invitation email.
   * @returns The invited address, store name, role and expiry.
   * @throws {NotFoundError} When no invitation has this token (404).
   * @throws {LedewireError} With `statusCode === 409` when the invitation was
   *   already accepted, or `statusCode === 410` when it has expired.
   *
   * @example
   * ```ts
   * const invite = await client.auth.getInviteInfo(token)
   * console.log(`Join ${invite.store_name} as ${invite.invited_email ?? 'you'}`)
   * ```
   */
  async getInviteInfo(token: string): Promise<InviteInfoResponse> {
    return this.http.get<InviteInfoResponse>(
      `/v1/auth/invite-info/${encodeURIComponent(token)}`,
      undefined,
      { auth: false },
    )
  }

  private async storeTokens(res: AuthenticationResponse, storeId?: string): Promise<void> {
    await this.tokenManager.setTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: parseExpiresAt(res.expires_at),
      ...(storeId !== undefined && { storeId }),
    })
  }
}
