/**
 * The authenticated buyer's own Company membership.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { CompanyMembership } from '@ledewire/core'

/**
 * Read or close the authenticated buyer's own Company membership.
 *
 * While a buyer holds an open membership, the Company wallet pays for their
 * purchases and their own membership Spend cap limits them. They never see the
 * Company balance: `wallet.balance()` reports `balance_cents: null` and a
 * `remaining_cents` allowance instead, with `company_name` naming whose wallet
 * pays.
 *
 * Obtain via `client.company.membership` — do not construct directly.
 *
 * @example
 * ```ts
 * try {
 *   const { company_name, role } = await client.company.membership.get()
 *   console.log(`Purchases are paid by ${company_name} (${role})`)
 * } catch (err) {
 *   if (err instanceof NotFoundError) console.log('Not in a Company')
 *   else throw err
 * }
 * ```
 */
export class CompanyMembershipNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns the authenticated buyer's open Company membership. Names the
   * Company, never its balance.
   *
   * @returns The membership.
   * @throws {NotFoundError} When the buyer belongs to no Company.
   */
  async get(): Promise<CompanyMembership> {
    return this.http.get<CompanyMembership>('/v1/company/membership')
  }

  /**
   * Leaves the Company. The buyer's purchases are paid from their personal
   * wallet again afterwards.
   *
   * @throws {NotFoundError} When the buyer belongs to no Company.
   * @throws {ForbiddenError} For a Machine user, which cannot leave — an admin
   *   deactivates it instead.
   * @throws {LedewireError} With `statusCode === 422` when the buyer is the
   *   Company's last admin.
   */
  async leave(): Promise<void> {
    return this.http.delete('/v1/company/membership')
  }
}
