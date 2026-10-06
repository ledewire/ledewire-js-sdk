/**
 * Company member management.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { CompanyMember, CompanyMemberList, CompanyMemberUpdateRequest } from '@ledewire/core'

/**
 * Manage the Company's open memberships: list them, change a member's role or
 * daily Spend cap, and remove a member. Company admins only.
 *
 * Every method takes the **membership id** (`CompanyMember.id`), not the
 * member's `user_id`.
 *
 * A member's daily Spend cap is never `null` — Company members are never
 * uncapped. It defaults to 1000 cents ($10) on joining, is read in the
 * Company's timezone, and also binds bulk acquisitions.
 *
 * Obtain via `client.company.members` — do not construct directly.
 *
 * @example
 * ```ts
 * const { data: members } = await client.company.members.list()
 * const analyst = members.find((m) => m.email === 'analyst@example.com')
 * if (analyst) {
 *   await client.company.members.update(analyst.id, { daily_spend_limit_cents: 5000 })
 * }
 * ```
 */
export class CompanyMembersNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists the Company's open memberships, Machine users included
   * (`kind: 'machine'`, `email: null`).
   *
   * @returns The members.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {NotFoundError} When the caller belongs to no Company.
   */
  async list(): Promise<CompanyMemberList> {
    return this.http.get<CompanyMemberList>('/v1/company/members')
  }

  /**
   * Changes a member's role, daily Spend cap, or both. Any admin may set any
   * member's cap, their own included.
   *
   * @param id - The membership id (`CompanyMember.id`).
   * @param body - At least one of `role` and `daily_spend_limit_cents`.
   * @returns The updated member.
   * @throws {LedewireError} With `statusCode === 400` when neither field is
   *   given or the cap is `null`/negative; with `statusCode === 422` for an
   *   unknown role, or a change that would leave the Company with no admin.
   */
  async update(id: string, body: CompanyMemberUpdateRequest): Promise<CompanyMember> {
    return this.http.patch<CompanyMember>(`/v1/company/members/${encodeURIComponent(id)}`, body)
  }

  /**
   * Removes a member, closing their membership. Their ledger accounts stay
   * with the Company. Removing a Machine user deactivates it permanently.
   *
   * @param id - The membership id (`CompanyMember.id`).
   * @throws {LedewireError} With `statusCode === 422` when it would leave the
   *   Company with no admin.
   */
  async remove(id: string): Promise<void> {
    return this.http.delete(`/v1/company/members/${encodeURIComponent(id)}`)
  }
}
