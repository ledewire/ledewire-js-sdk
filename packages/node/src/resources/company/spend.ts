/**
 * Company spend namespace: what each membership has spent of the Company's money.
 *
 * @module
 */
import type { HttpClient, CompanySpendList, CompanySpendListParams } from '@ledewire/core'

/**
 * Reports spend per membership. Every call requires Company admin rights.
 *
 * Returns one row per membership, including members who have left. With no `from`
 * or `to`, the totals are lifetime. Spend is what each member's ledger account has
 * captured, net of refunds, so a live Bulk acquisition hold is not yet counted.
 *
 * Obtain via `client.company.spend` — do not construct directly.
 *
 * @example
 * ```ts
 * const { data } = await client.company.spend.list({ from: '2026-10-01', to: '2026-10-31' })
 * for (const row of data) {
 *   console.log(row.member.name, row.spend_cents)
 * }
 * ```
 */
export class CompanySpendNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists spend per membership, oldest membership first.
   *
   * @param params - Optional `member`, `from`, and `to` filters.
   * @returns The spend envelope (`{ data }`).
   */
  async list(params?: CompanySpendListParams): Promise<CompanySpendList> {
    return this.http.get<CompanySpendList>(
      '/v1/company/spend',
      params && { member: params.member, from: params.from, to: params.to },
    )
  }
}
