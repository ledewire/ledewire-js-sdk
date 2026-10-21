/**
 * Company membership namespace: the authenticated buyer's own membership.
 *
 * @module
 */
import type { HttpClient, CompanyMembership } from '@ledewire/core'

/**
 * Read and leave the authenticated buyer's own Company membership.
 *
 * A buyer belongs to at most one Company. Membership is open to any buyer, so
 * these calls do not require Company admin rights.
 *
 * Obtain via `client.company.membership` — do not construct directly.
 *
 * @example
 * ```ts
 * const membership = await client.company.membership.get()
 * console.log(`Member of ${membership.company_name} as ${membership.role}`)
 *
 * // Leave the Company; purchases go back to your personal wallet
 * await client.company.membership.leave()
 * ```
 */
export class CompanyMembershipNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns the authenticated buyer's open Company membership. Names the Company
   * but never its balance.
   *
   * @returns The membership: Company, role, and join time.
   *
   * @example
   * ```ts
   * const membership = await client.company.membership.get()
   * ```
   */
  async get(): Promise<CompanyMembership> {
    return this.http.get<CompanyMembership>('/v1/company/membership')
  }

  /**
   * Leaves the Company. The buyer's purchases are paid from their personal wallet
   * again afterwards. The Company's last admin cannot leave, and a Machine user
   * cannot leave (an admin deactivates it instead).
   *
   * @example
   * ```ts
   * await client.company.membership.leave()
   * ```
   */
  async leave(): Promise<void> {
    return this.http.delete('/v1/company/membership')
  }
}
