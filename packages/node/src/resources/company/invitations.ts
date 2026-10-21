/**
 * Company invitations namespace: invite, list, revoke, and accept.
 *
 * @module
 */
import type {
  HttpClient,
  CompanyInvitation,
  CompanyInvitationList,
  CompanyInvitationRequest,
  CompanyInvitationAcceptRequest,
  CompanyMembership,
} from '@ledewire/core'

/**
 * Invite people to a Company and accept invitations.
 *
 * Every invitation emails a token. Nobody joins until they accept it with that
 * token, so accepting needs the token even when already signed in as the invited
 * address. Invitations expire seven days after they are sent.
 *
 * `list`, `create` and `revoke` require Company admin rights. `accept` is for the
 * invited buyer.
 *
 * Obtain via `client.company.invitations` — do not construct directly.
 *
 * @example
 * ```ts
 * // Admin: invite a new admin
 * const invitation = await client.company.invitations.create({
 *   email: 'cfo@example.com',
 *   role: 'admin',
 * })
 *
 * // Invitee: accept with the token from the email
 * const membership = await client.company.invitations.accept({ token: emailedToken })
 * ```
 */
export class CompanyInvitationsNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists the Company's pending invitations. Accepted, withdrawn and expired
   * invitations are excluded.
   *
   * @returns The invitation envelope (`{ data }`).
   */
  async list(): Promise<CompanyInvitationList> {
    return this.http.get<CompanyInvitationList>('/v1/company/invitations')
  }

  /**
   * Invites an email address to the Company. Inviting an address that belongs to
   * another Company succeeds, but that person's accept is refused.
   *
   * @param body - The invited `email`, and an optional `role` (defaults to `member`).
   * @returns The pending invitation.
   *
   * @example
   * ```ts
   * await client.company.invitations.create({ email: 'analyst@example.com' })
   * ```
   */
  async create(body: CompanyInvitationRequest): Promise<CompanyInvitation> {
    return this.http.post<CompanyInvitation>('/v1/company/invitations', body)
  }

  /**
   * Withdraws a pending invitation so the address can be invited again at once.
   * The emailed token can no longer be accepted.
   *
   * @param id - The invitation id.
   *
   * @example
   * ```ts
   * await client.company.invitations.revoke('invitation-id')
   * ```
   */
  async revoke(id: string): Promise<void> {
    return this.http.delete(`/v1/company/invitations/${encodeURIComponent(id)}`)
  }

  /**
   * Accepts an invitation and opens a membership with the invited role. The token
   * must belong to an invitation addressed to one of the buyer's addresses. Refused
   * while the buyer belongs to another Company; they must leave it first.
   *
   * @param body - The `token` from the invitation email.
   * @returns The new membership.
   *
   * @example
   * ```ts
   * const membership = await client.company.invitations.accept({ token })
   * ```
   */
  async accept(body: CompanyInvitationAcceptRequest): Promise<CompanyMembership> {
    return this.http.post<CompanyMembership>('/v1/company/invitations/accept', body)
  }
}
