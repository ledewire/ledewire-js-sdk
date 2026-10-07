/**
 * Company invitations.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type {
  CompanyInvitation,
  CompanyInvitationAcceptRequest,
  CompanyInvitationList,
  CompanyInvitationRequest,
  CompanyMembership,
} from '@ledewire/core'

/**
 * Invite people to a Company, and accept an invitation.
 *
 * Nobody joins until they accept, because joining moves their spending onto
 * the Company wallet. Every invitation emails a token that accepting requires,
 * even for a buyer already signed in as the invited address. An existing buyer
 * passes it to {@link accept}; a new address passes it to `auth.signup()` or
 * `auth.loginWithGoogle()` as `company_invitation_token`, which creates the
 * account and joins in one step.
 *
 * `list()`, `create()` and `revoke()` are Company-admin only; `accept()` is for
 * the invitee.
 *
 * Obtain via `client.company.invitations` — do not construct directly.
 *
 * @example
 * ```ts
 * // Admin: invite an analyst
 * await client.company.invitations.create({ email: 'analyst@example.com' })
 *
 * // Invitee (already has an account): accept with the emailed token
 * const membership = await client.company.invitations.accept({ token })
 * ```
 */
export class CompanyInvitationsNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists the Company's pending invitations. Company admins only.
   *
   * @returns The pending invitations.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {NotFoundError} When the caller belongs to no Company.
   */
  async list(): Promise<CompanyInvitationList> {
    return this.http.get<CompanyInvitationList>('/v1/company/invitations')
  }

  /**
   * Invites someone to the Company and emails them the acceptance token.
   * Company admins only. Inviting someone who belongs to another Company
   * succeeds; their accept is refused until they leave it.
   *
   * @param body - The invitee's email, and their role (default `'member'`).
   * @returns The invitation. It expires seven days after it is sent.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {LedewireError} With `statusCode === 409` when the address is
   *   already a member or already has a pending invitation.
   */
  async create(body: CompanyInvitationRequest): Promise<CompanyInvitation> {
    return this.http.post<CompanyInvitation>('/v1/company/invitations', body)
  }

  /**
   * Revokes a pending invitation. Company admins only. The emailed token can no
   * longer be accepted, and the address can be invited again at once rather
   * than when this invitation would have expired.
   *
   * @param id - The invitation id (`CompanyInvitation.id`).
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {NotFoundError} When the caller belongs to no Company, or the
   *   invitation is not one of its own.
   * @throws {LedewireError} With `statusCode === 409` when the invitation is no
   *   longer pending (accepted, already revoked, or expired).
   */
  async revoke(id: string): Promise<void> {
    return this.http.delete(`/v1/company/invitations/${encodeURIComponent(id)}`)
  }

  /**
   * Accepts an invitation, opening a membership with the invited role. The
   * token must belong to an invitation addressed to one of the buyer's
   * addresses.
   *
   * Every refusal carries `type === 'invitation_not_accepted'` and the reason
   * as `details.reason` (an `InvitationRefusalReason`).
   *
   * @param body - The token from the invitation email.
   * @returns The new membership.
   * @throws {NotFoundError} When no invitation with this token is addressed to
   *   this buyer (`details.reason === 'not_found'`).
   * @throws {LedewireError} With `statusCode === 409` when already accepted
   *   (`'already_accepted'`), or when the buyer already belongs to a Company
   *   (`'already_in_company'`; leave it first); with `statusCode === 410` when
   *   the invitation has expired or was withdrawn (`'expired'`).
   */
  async accept(body: CompanyInvitationAcceptRequest): Promise<CompanyMembership> {
    return this.http.post<CompanyMembership>('/v1/company/invitations/accept', body)
  }
}
