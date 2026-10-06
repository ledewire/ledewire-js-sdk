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
 * passes it to {@link accept}; a new address passes it to `auth.signup()` as
 * `company_invitation_token`, which signs up and joins in one step.
 *
 * `list()` and `create()` are Company-admin only; `accept()` is for the invitee.
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
   * Accepts an invitation, opening a membership with the invited role. The
   * token must belong to an invitation addressed to one of the buyer's
   * addresses.
   *
   * @param body - The token from the invitation email.
   * @returns The new membership.
   * @throws {NotFoundError} When no invitation with this token is addressed to
   *   this buyer.
   * @throws {LedewireError} With `statusCode === 409` when already accepted, or
   *   when the buyer already belongs to a Company (leave it first); with
   *   `statusCode === 410` when the invitation has expired or was withdrawn.
   */
  async accept(body: CompanyInvitationAcceptRequest): Promise<CompanyMembership> {
    return this.http.post<CompanyMembership>('/v1/company/invitations/accept', body)
  }
}
