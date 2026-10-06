/**
 * Company purchase and spend reports.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type {
  CompanyPurchaseList,
  CompanyPurchasesParams,
  CompanySpendList,
  CompanySpendParams,
} from '@ledewire/core'

/**
 * Everything the Company paid for. Company admins only.
 *
 * Obtain via `client.company.purchases` — do not construct directly.
 *
 * @example
 * ```ts
 * const { data, pagination } = await client.company.purchases.list({
 *   kind: 'bulk_acquisition',
 *   from: '2026-09-01',
 *   to: '2026-09-30',
 * })
 * ```
 */
export class CompanyPurchasesNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists every purchase and Bulk acquisition drawn on the Company wallet,
   * newest first, each attributed to the membership that bought it — including
   * members who have since left. A Bulk acquisition's per-work purchases are
   * not listed separately, and a failed purchase is not listed.
   *
   * A Bulk acquisition's corpus and manifest are reachable by a Company admin
   * through `acquisitions.getCorpus()` / `downloadCorpus()` / `getManifest()`
   * with its `id`.
   *
   * @param params - Optional filters (`member`, `from`, `to`, `kind`) and pagination.
   * @returns A paginated list of Company purchases.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {LedewireError} With `statusCode === 400` for an invalid filter.
   */
  async list(params?: CompanyPurchasesParams): Promise<CompanyPurchaseList> {
    return this.http.get<CompanyPurchaseList>('/v1/company/purchases', params)
  }
}

/**
 * What each member has spent of the Company's money. Company admins only.
 *
 * Obtain via `client.company.spend` — do not construct directly.
 *
 * @example
 * ```ts
 * const { data } = await client.company.spend.list({ from: '2026-09-01' })
 * for (const { member, spend_cents } of data) console.log(member.name, spend_cents)
 * ```
 */
export class CompanySpendNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns one row per membership the Company has had, open or closed, oldest
   * first, with what each spent in the range — lifetime when neither `from`
   * nor `to` is given.
   *
   * `spend_cents` is net of refunds and counts what a Bulk acquisition
   * captured; a live hold does not count until it captures, so it can be lower
   * than the same member's `amount_cents` in `company.purchases.list()`.
   *
   * @param params - Optional `member`, `from`, and `to` filters.
   * @returns Spend per membership.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {LedewireError} With `statusCode === 400` for an invalid filter.
   */
  async list(params?: CompanySpendParams): Promise<CompanySpendList> {
    return this.http.get<CompanySpendList>('/v1/company/spend', params)
  }
}
