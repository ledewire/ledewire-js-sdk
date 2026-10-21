/**
 * Company members namespace: admin management of open memberships.
 *
 * @module
 */
import type {
  HttpClient,
  CompanyMember,
  CompanyMemberList,
  CompanyMemberRoleRequest,
} from '@ledewire/core'

/**
 * Manage a Company's open members. Every call requires Company admin rights.
 *
 * Obtain via `client.company.members` — do not construct directly.
 *
 * @example
 * ```ts
 * const { data } = await client.company.members.list()
 *
 * // Promote a member and raise their daily Spend cap
 * await client.company.members.update(data[0].id, {
 *   role: 'admin',
 *   daily_spend_limit_cents: 5000,
 * })
 *
 * // Remove a member (a Machine user is deactivated permanently)
 * await client.company.members.remove(data[1].id)
 * ```
 */
export class CompanyMembersNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists the Company's open members. Secrets and balances are not included.
   *
   * @returns The member envelope (`{ data }`), one row per open membership.
   */
  async list(): Promise<CompanyMemberList> {
    return this.http.get<CompanyMemberList>('/v1/company/members')
  }

  /**
   * Changes a member's role, daily Spend cap, or both. Any admin may set any
   * member's cap, including their own. The Company must keep at least one admin,
   * and a Machine user cannot be made an admin. `daily_spend_limit_cents` cannot
   * be `null`: a member is never uncapped.
   *
   * @param id - The membership id (`member.id`).
   * @param body - `role`, `daily_spend_limit_cents`, or both.
   * @returns The updated member.
   *
   * @example
   * ```ts
   * await client.company.members.update('membership-id', { daily_spend_limit_cents: 2000 })
   * ```
   */
  async update(id: string, body: CompanyMemberRoleRequest): Promise<CompanyMember> {
    return this.http.patch<CompanyMember>(`/v1/company/members/${encodeURIComponent(id)}`, body)
  }

  /**
   * Removes a member, closing their membership. Their ledger accounts stay with the
   * Company. The last admin cannot be removed. Removing a Machine user deactivates it
   * permanently.
   *
   * @param id - The membership id (`member.id`).
   *
   * @example
   * ```ts
   * await client.company.members.remove('membership-id')
   * ```
   */
  async remove(id: string): Promise<void> {
    return this.http.delete(`/v1/company/members/${encodeURIComponent(id)}`)
  }
}
